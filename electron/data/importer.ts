import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { createQuest, createObjective } from './quest-repo'
import { getOrCreateDomain } from './domain-repo'
import { getDb } from './db'

interface ObsidianFrontmatter {
  domain?: string
  active?: boolean
  quick?: boolean
  next_action?: string
  waiting_for?: string
}

function getExistingSourceFiles(): Set<string> {
  const db = getDb()
  const stmt = db.prepare('SELECT source_file FROM quests WHERE source_file IS NOT NULL')
  const set = new Set<string>()
  while (stmt.step()) {
    const row = stmt.getAsObject() as { source_file: string }
    set.add(row.source_file)
  }
  stmt.free()
  return set
}

export function importFromObsidian(questsDir: string): { imported: number; skipped: number } {
  const files = fs.readdirSync(questsDir).filter(f => f.endsWith('.md'))
  let imported = 0
  let skipped = 0

  const existingBySource = getExistingSourceFiles()

  for (const file of files) {
    const filePath = path.join(questsDir, file)

    if (existingBySource.has(filePath)) {
      skipped++
      continue
    }

    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)
    const fm = data as ObsidianFrontmatter

    const title = path.basename(file, '.md')

    // Extract goal from first Quest Log entry
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

    // Extract notes as description
    const notesMatch = content.match(/## Notes\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    if (notesMatch) {
      description = notesMatch[1].trim()
    }

    // Map domain
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
      priority: 50,
      source_file: filePath
    })

    // If there's a next_action, create it as the first objective
    if (fm.next_action && fm.next_action.trim()) {
      createObjective(quest.id, fm.next_action.trim())
    }

    imported++
  }

  return { imported, skipped }
}
