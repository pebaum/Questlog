import fs from 'fs'
import path from 'path'
import crypto from 'node:crypto'
import matter from 'gray-matter'
import { getDb, saveDb } from './db'
import { getOrCreateDomain } from './domain-repo'
import { BrowserWindow } from 'electron'

let watcher: fs.FSWatcher | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let watchingDir: string | null = null

// Prevent write-back loops: track MD5 hashes of file content we wrote
const contentHashes = new Map<string, string>()

export function setContentHash(filePath: string, hash: string): void {
  contentHashes.set(filePath, hash)
}

export function md5(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex')
}

function broadcastUpdate(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('quests:updated')
    }
  }
}

/** Parse objectives from markdown checkbox syntax */
function parseObjectives(content: string): { text: string; completed: boolean }[] {
  const objMatch = content.match(/## Objectives\s*\n([\s\S]*?)(?=\n## |\n*$)/)
  if (!objMatch) return []

  const lines = objMatch[1].split('\n')
  const objectives: { text: string; completed: boolean }[] = []

  for (const line of lines) {
    const match = line.match(/^-\s*\[([ xX])\]\s*(.+)/)
    if (match) {
      objectives.push({
        completed: match[1].toLowerCase() === 'x',
        text: match[2].trim()
      })
    }
  }

  return objectives
}

/** Sync objectives from markdown into DB for a given quest */
function syncObjectivesToDb(questId: string, markdownObjectives: { text: string; completed: boolean }[]): void {
  const db = getDb()

  // Get existing objectives
  const stmt = db.prepare('SELECT id, text, completed, sort_order FROM objectives WHERE quest_id = ? ORDER BY sort_order ASC')
  stmt.bind([questId])
  const existing: { id: string; text: string; completed: number; sort_order: number }[] = []
  while (stmt.step()) {
    existing.push(stmt.getAsObject() as { id: string; text: string; completed: number; sort_order: number })
  }
  stmt.free()

  // Match by text to preserve IDs where possible
  const matched = new Set<string>()

  for (let i = 0; i < markdownObjectives.length; i++) {
    const mdObj = markdownObjectives[i]
    const dbObj = existing.find(e => e.text === mdObj.text && !matched.has(e.id))

    if (dbObj) {
      // Update existing objective
      matched.add(dbObj.id)
      const newCompleted = mdObj.completed ? 1 : 0
      if (dbObj.completed !== newCompleted || dbObj.sort_order !== i) {
        db.run('UPDATE objectives SET completed = ?, sort_order = ? WHERE id = ?', [newCompleted, i, dbObj.id])
      }
    } else {
      // New objective from markdown
      const { v4: uuid } = require('uuid')
      const id = uuid()
      db.run('INSERT INTO objectives (id, quest_id, text, completed, sort_order) VALUES (?, ?, ?, ?, ?)',
        [id, questId, mdObj.text, mdObj.completed ? 1 : 0, i])
    }
  }

  // Delete objectives that were removed from markdown
  for (const dbObj of existing) {
    if (!matched.has(dbObj.id)) {
      db.run('DELETE FROM objectives WHERE id = ?', [dbObj.id])
    }
  }
}

function syncFileToDb(filePath: string): void {
  if (!filePath.endsWith('.md')) return
  // Skip the Tome of Values
  if (path.basename(filePath).startsWith('_')) return

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')

    // Compare content hash to detect our own writes
    const hash = md5(raw)
    if (contentHashes.get(filePath) === hash) return
    contentHashes.set(filePath, hash)

    const { data, content } = matter(raw)
    const fm = data as Record<string, unknown>

    const db = getDb()
    const title = path.basename(filePath, '.md')

    // Check if quest exists by source_file
    const stmt = db.prepare('SELECT id FROM quests WHERE source_file = ?')
    stmt.bind([filePath])
    const exists = stmt.step()
    const row = exists ? stmt.getAsObject() as { id: string } : null
    stmt.free()

    // Parse content sections
    let goal = ''
    let description = ''
    const logMatch = content.match(/## (?:Quest Log|QuestLog)\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    if (logMatch) {
      const logLines = logMatch[1].trim().split('\n').filter(l => l.trim())
      if (logLines.length > 0) {
        goal = logLines[0].replace(/^-\s*\d{4}-\d{2}-\d{2}:\s*/, '').replace(/^Created from braindump\.\s*/, '')
      }
    }
    const notesMatch = content.match(/## Notes\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    if (notesMatch) {
      description = notesMatch[1].trim()
    }

    // Parse objectives from markdown
    const objectives = parseObjectives(content)

    let domainId = ''
    if (fm.domain && typeof fm.domain === 'string') {
      const domain = getOrCreateDomain(fm.domain)
      domainId = domain.id
    }

    if (row) {
      // Update existing quest from markdown
      const fields: string[] = []
      const values: unknown[] = []
      fields.push('title = ?'); values.push(title)
      fields.push('goal = ?'); values.push(goal)
      fields.push('description = ?'); values.push(description)
      fields.push('domain = ?'); values.push(domainId)
      if (fm.active !== undefined) { fields.push('active = ?'); values.push(fm.active ? 1 : 0) }
      if (fm.waiting_for !== undefined) { fields.push('waiting_for = ?'); values.push((fm.waiting_for as string) || null) }
      if (fm.priority !== undefined) { fields.push('priority = ?'); values.push(fm.priority) }
      values.push(row.id)
      db.run(`UPDATE quests SET ${fields.join(', ')} WHERE id = ?`, values)

      // Sync objectives
      syncObjectivesToDb(row.id, objectives)

      saveDb()
    } else {
      // New file — import it
      const { createQuest, createObjective } = require('./quest-repo')
      const quest = createQuest({
        title,
        goal,
        description,
        domain: domainId,
        active: fm.active || false,
        waiting_for: (fm.waiting_for as string) || null,
        priority: (fm.priority as number) ?? 0,
        source_file: filePath
      })

      // Import objectives
      for (const obj of objectives) {
        const created = createObjective(quest.id, obj.text)
        if (obj.completed) {
          db.run('UPDATE objectives SET completed = 1 WHERE id = ?', [created.id])
        }
      }
      saveDb()
    }

    broadcastUpdate()
  } catch (err) {
    console.error(`File watcher: failed to sync ${filePath}:`, err)
  }
}

export function startFileWatcher(dir: string): void {
  stopFileWatcher()
  watchingDir = dir

  if (!fs.existsSync(dir)) return

  watcher = fs.watch(dir, { persistent: false }, (_eventType, filename) => {
    if (!filename || !filename.endsWith('.md')) return

    // Debounce rapid changes (editors often do multiple writes)
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const filePath = path.join(dir, filename)
      if (fs.existsSync(filePath)) {
        syncFileToDb(filePath)
      }
    }, 500)
  })

  console.log(`File watcher started on ${dir}`)
}

export function stopFileWatcher(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  watchingDir = null
}
