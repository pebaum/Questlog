import path from 'path'
import fs from 'fs'
import { app } from 'electron'

// sql.js types
interface SqlJsDatabase {
  run(sql: string, params?: unknown[]): void
  exec(sql: string): { columns: string[]; values: unknown[][] }[]
  prepare(sql: string): SqlJsStatement
  export(): Uint8Array
  close(): void
}

interface SqlJsStatement {
  bind(params?: unknown[]): boolean
  step(): boolean
  getAsObject(): Record<string, unknown>
  free(): void
}

let db: SqlJsDatabase | null = null

export async function initDb(): Promise<SqlJsDatabase> {
  if (db) return db

  // Use require for sql.js since it's externalized
  const initSqlJs = require('sql.js')

  const wasmPath = path.join(
    __dirname,
    '../../node_modules/sql.js/dist/sql-wasm.wasm'
  )

  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  })

  const dbPath = path.join(app.getPath('userData'), 'quest-log.db')

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer) as SqlJsDatabase
  } else {
    db = new SQL.Database() as SqlJsDatabase
  }

  runMigrations(db)
  return db
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized. Call initDb() first.')
  return db
}

export function saveDb(): void {
  if (!db) return
  const dbPath = path.join(app.getPath('userData'), 'quest-log.db')
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

function runMigrations(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#c8a84e'
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS quests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      goal TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 0,
      waiting_for TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      source_file TEXT,
      FOREIGN KEY (domain) REFERENCES domains(id)
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS objectives (
      id TEXT PRIMARY KEY,
      quest_id TEXT NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_quests_domain ON quests(domain)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_quests_active ON quests(active)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_objectives_quest ON objectives(quest_id)`)
  // Normalize old priority=50 to 0 (none)
  db.run(`UPDATE quests SET priority = 0 WHERE priority = 50`)

  // Add sort_order column to domains if it doesn't exist
  try {
    db.run(`ALTER TABLE domains ADD COLUMN sort_order INTEGER DEFAULT 0`)
  } catch {
    // Column already exists
  }

  saveDb()
}

export function closeDb(): void {
  if (db) {
    saveDb()
    db.close()
    db = null
  }
}
