import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { createQuest, createObjective, updateQuest } from './quest-repo'
import { getOrCreateDomain } from './domain-repo'
import { getDb, saveDb } from './db'

interface ObsidianFrontmatter {
  domain?: string
  active?: boolean
  quick?: boolean
  next_action?: string
  waiting_for?: string
  priority?: number
}

function getExistingSourceFiles(): Map<string, string> {
  const db = getDb()
  const stmt = db.prepare('SELECT id, source_file FROM quests WHERE source_file IS NOT NULL')
  const map = new Map<string, string>()
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string; source_file: string }
    map.set(row.source_file, row.id)
  }
  stmt.free()
  return map
}

export function importFromObsidian(questsDir: string): { imported: number; skipped: number; updated: number } {
  const files = fs.readdirSync(questsDir).filter(f => f.endsWith('.md'))
  let imported = 0
  let skipped = 0
  let updated = 0

  const existingBySource = getExistingSourceFiles()

  for (const file of files) {
    const filePath = path.join(questsDir, file)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)
    const fm = data as ObsidianFrontmatter

    const existingId = existingBySource.get(filePath)

    if (existingId) {
      // Sync priority from markdown if it has one
      if (fm.priority !== undefined) {
        updateQuest(existingId, { priority: fm.priority })
        updated++
      }
      skipped++
      continue
    }

    const title = path.basename(file, '.md')

    let goal = ''
    let description = ''
    const logMatch = content.match(/## Quest Log\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    if (logMatch) {
      const logLines = logMatch[1].trim().split('\n').filter(l => l.trim())
      if (logLines.length > 0) {
        const firstEntry = logLines[0].replace(/^-\s*\d{4}-\d{2}-\d{2}:\s*/, '').replace(/^Created from braindump\.\s*/, '')
        goal = firstEntry
      }
    }

    const notesMatch = content.match(/## Notes\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    if (notesMatch) {
      description = notesMatch[1].trim()
    }

    let domainId = ''
    if (fm.domain) {
      const domain = getOrCreateDomain(fm.domain)
      domainId = domain.id
    }

    const quest = createQuest({
      title,
      goal,
      description,
      domain: domainId,
      active: fm.active || false,
      waiting_for: fm.waiting_for || null,
      priority: fm.priority ?? 0,
      source_file: filePath
    })

    if (fm.next_action && fm.next_action.trim()) {
      createObjective(quest.id, fm.next_action.trim())
    }

    imported++
  }

  return { imported, skipped, updated }
}
