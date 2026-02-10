import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { getDb } from './db'
import { setContentHash, md5 } from './file-watcher'
import { getSettings } from './settings'

interface QuestForExport {
  id: string
  title: string
  goal: string
  description: string
  domain: string
  active: number
  waiting_for: string | null
  priority: number
  completed_at: string | null
  source_file: string | null
}

function getDomainName(domainId: string): string {
  if (!domainId) return ''
  const db = getDb()
  const stmt = db.prepare('SELECT name FROM domains WHERE id = ?')
  stmt.bind([domainId])
  if (stmt.step()) {
    const row = stmt.getAsObject() as { name: string }
    stmt.free()
    return row.name
  }
  stmt.free()
  return ''
}

function getObjectives(questId: string): { text: string; completed: boolean }[] {
  const db = getDb()
  const stmt = db.prepare('SELECT text, completed FROM objectives WHERE quest_id = ? ORDER BY sort_order ASC')
  stmt.bind([questId])
  const objectives: { text: string; completed: boolean }[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as { text: string; completed: number }
    objectives.push({ text: row.text, completed: !!row.completed })
  }
  stmt.free()
  return objectives
}

export function writeQuestToMarkdown(questId: string): void {
  const settings = getSettings()
  if (!settings.importFolder) return

  const db = getDb()
  const stmt = db.prepare('SELECT * FROM quests WHERE id = ?')
  stmt.bind([questId])
  if (!stmt.step()) { stmt.free(); return }
  const quest = stmt.getAsObject() as QuestForExport
  stmt.free()

  const domainName = getDomainName(quest.domain)
  const objectives = getObjectives(questId)

  // Build frontmatter (omit undefined values — js-yaml cannot serialize them)
  const frontmatter: Record<string, unknown> = {
    domain: domainName || null,
    quick: false,
    active: !!quest.active,
    priority: quest.priority
  }
  if (quest.waiting_for) frontmatter.waiting_for = quest.waiting_for

  // Build content
  let content = ''

  // QuestLog section
  content += '\n## QuestLog\n\n'
  if (quest.goal) {
    content += `- ${new Date().toISOString().split('T')[0]}: ${quest.goal}\n`
  }

  // Objectives section (if any)
  if (objectives.length > 0) {
    content += '\n## Objectives\n\n'
    for (const obj of objectives) {
      content += `- [${obj.completed ? 'x' : ' '}] ${obj.text}\n`
    }
  }

  // Notes section
  content += '\n## Notes\n\n'
  if (quest.description) {
    content += quest.description + '\n'
  }

  const md = matter.stringify(content, frontmatter)

  // Determine file path
  const filePath = quest.source_file || path.join(settings.importFolder, `${quest.title}.md`)

  // Store content hash so the file watcher knows this was our write
  setContentHash(filePath, md5(md))

  fs.writeFileSync(filePath, md, 'utf-8')

  // Update source_file in DB if it was a new file
  if (!quest.source_file) {
    db.run('UPDATE quests SET source_file = ? WHERE id = ?', [filePath, questId])
  }
}

export function deleteQuestMarkdown(questId: string): void {
  const db = getDb()
  const stmt = db.prepare('SELECT source_file FROM quests WHERE id = ?')
  stmt.bind([questId])
  if (!stmt.step()) { stmt.free(); return }
  const row = stmt.getAsObject() as { source_file: string | null }
  stmt.free()

  if (row.source_file && fs.existsSync(row.source_file)) {
    fs.unlinkSync(row.source_file)
  }
}
