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

interface Section {
  header: string
  content: string
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

/** Parse markdown body into ordered sections */
function parseSections(content: string): { preamble: string; sections: Section[] } {
  const lines = content.split('\n')
  let preamble = ''
  const sections: Section[] = []
  let current: Section | null = null

  for (const line of lines) {
    if (line.match(/^## /)) {
      if (current) sections.push(current)
      current = { header: line, content: '' }
    } else if (current) {
      current.content += line + '\n'
    } else {
      preamble += line + '\n'
    }
  }
  if (current) sections.push(current)

  return { preamble, sections }
}

/** Check if a section header matches one of our managed section names */
function isManagedSection(header: string, name: string): boolean {
  const normalized = header.replace(/^## /, '').trim().toLowerCase()
  const target = name.toLowerCase()
  return normalized === target
}

function findSection(sections: Section[], name: string): Section | undefined {
  return sections.find(s => isManagedSection(s.header, name))
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
  const filePath = quest.source_file || path.join(settings.importFolder, `${quest.title}.md`)

  // Read existing file to preserve unknown frontmatter and extra content
  let existingFrontmatter: Record<string, unknown> = {}
  let existingSections: Section[] = []
  let preamble = '\n'

  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = matter(raw)
    existingFrontmatter = parsed.data as Record<string, unknown>
    const result = parseSections(parsed.content)
    preamble = result.preamble
    existingSections = result.sections
  }

  // Merge frontmatter: our fields win, unknown fields preserved
  const frontmatter: Record<string, unknown> = { ...existingFrontmatter }
  frontmatter.domain = domainName || null
  frontmatter.active = !!quest.active
  frontmatter.priority = quest.priority
  if (quest.waiting_for) {
    frontmatter.waiting_for = quest.waiting_for
  } else if ('waiting_for' in frontmatter) {
    frontmatter.waiting_for = null
  }
  // Remove undefined values (js-yaml can't serialize them)
  for (const key of Object.keys(frontmatter)) {
    if (frontmatter[key] === undefined) delete frontmatter[key]
  }

  // Build managed section content
  let objectivesContent = '\n'
  for (const obj of objectives) {
    objectivesContent += `- [${obj.completed ? 'x' : ' '}] ${obj.text}\n`
  }

  let notesContent = '\n'
  if (quest.description) {
    notesContent += quest.description + '\n'
  }

  // Update or add managed sections
  const questLogSection = findSection(existingSections, 'QuestLog') || findSection(existingSections, 'Quest Log')
  const objectivesSection = findSection(existingSections, 'Objectives')
  const notesSection = findSection(existingSections, 'Notes')

  if (objectivesSection) {
    objectivesSection.content = objectivesContent
  }
  if (notesSection) {
    notesSection.content = notesContent
  }

  // Build final sections list, adding missing managed sections
  const finalSections: Section[] = [...existingSections]

  if (!questLogSection) {
    let questLogContent = '\n'
    if (quest.goal) {
      questLogContent += `- ${new Date().toISOString().split('T')[0]}: ${quest.goal}\n`
    }
    finalSections.unshift({ header: '## QuestLog', content: questLogContent })
  }

  if (!objectivesSection && objectives.length > 0) {
    // Insert after QuestLog if it exists, otherwise at beginning
    const qlIdx = finalSections.findIndex(s => isManagedSection(s.header, 'QuestLog') || isManagedSection(s.header, 'Quest Log'))
    const insertIdx = qlIdx >= 0 ? qlIdx + 1 : finalSections.length
    finalSections.splice(insertIdx, 0, { header: '## Objectives', content: objectivesContent })
  }

  if (!notesSection) {
    finalSections.push({ header: '## Notes', content: notesContent })
  }

  // Reassemble content
  let content = preamble
  for (const section of finalSections) {
    content += section.header + '\n' + section.content
  }

  const mdOutput = matter.stringify(content, frontmatter)

  // Store content hash so the file watcher knows this was our write
  setContentHash(filePath, md5(mdOutput))
  fs.writeFileSync(filePath, mdOutput, 'utf-8')

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
