import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { getDb, saveDb } from './db'
import { getOrCreateDomain } from './domain-repo'
import { BrowserWindow } from 'electron'

let watcher: fs.FSWatcher | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let watchingDir: string | null = null

// Prevent write-back loops: track files we just wrote
const recentWrites = new Set<string>()

export function markRecentWrite(filePath: string): void {
  recentWrites.add(filePath)
  setTimeout(() => recentWrites.delete(filePath), 2000)
}

function broadcastUpdate(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('quests:updated')
    }
  }
}

function syncFileToDb(filePath: string): void {
  if (!filePath.endsWith('.md')) return
  if (recentWrites.has(filePath)) return

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)
    const fm = data as {
      domain?: string
      active?: boolean
      waiting_for?: string
      priority?: number
    }

    const db = getDb()
    const title = path.basename(filePath, '.md')

    // Check if quest exists by source_file
    const stmt = db.prepare('SELECT id FROM quests WHERE source_file = ?')
    stmt.bind([filePath])
    const exists = stmt.step()
    const row = exists ? stmt.getAsObject() as { id: string } : null
    stmt.free()

    // Parse content
    let goal = ''
    let description = ''
    const logMatch = content.match(/## Quest Log\s*\n([\s\S]*?)(?=\n## |\n*$)/)
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

    let domainId = ''
    if (fm.domain) {
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
      if (fm.waiting_for !== undefined) { fields.push('waiting_for = ?'); values.push(fm.waiting_for || null) }
      if (fm.priority !== undefined) { fields.push('priority = ?'); values.push(fm.priority) }
      values.push(row.id)
      db.run(`UPDATE quests SET ${fields.join(', ')} WHERE id = ?`, values)
      saveDb()
    } else {
      // New file — import it
      const { createQuest } = require('./quest-repo')
      createQuest({
        title,
        goal,
        description,
        domain: domainId,
        active: fm.active || false,
        waiting_for: fm.waiting_for || null,
        priority: fm.priority ?? 0,
        source_file: filePath
      })
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
