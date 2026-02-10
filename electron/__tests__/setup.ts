import { vi } from 'vitest'
import initSqlJs, { type Database } from 'sql.js'

let testDb: Database | null = null

export async function setupTestDb(): Promise<Database> {
  const SQL = await initSqlJs()
  testDb = new SQL.Database()

  // Run the same migrations as db.ts
  testDb.run(`
    CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#c8a84e',
      sort_order INTEGER DEFAULT 0
    )
  `)
  testDb.run(`
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
  testDb.run(`
    CREATE TABLE IF NOT EXISTS objectives (
      id TEXT PRIMARY KEY,
      quest_id TEXT NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE
    )
  `)
  testDb.run(`CREATE INDEX IF NOT EXISTS idx_quests_domain ON quests(domain)`)
  testDb.run(`CREATE INDEX IF NOT EXISTS idx_quests_active ON quests(active)`)
  testDb.run(`CREATE INDEX IF NOT EXISTS idx_objectives_quest ON objectives(quest_id)`)

  return testDb
}

export function teardownTestDb(): void {
  if (testDb) {
    testDb.close()
    testDb = null
  }
}

let counter = 0

export function mockDbModule(db: Database): void {
  vi.doMock('../data/db', () => ({
    getDb: () => db,
    saveDb: () => {},
    initDb: async () => db,
    closeDb: () => {}
  }))

  // Mock uuid to work in vitest ESM context
  counter++
  const prefix = counter
  let seq = 0
  vi.doMock('uuid', () => ({
    v4: () => `${prefix}-${++seq}-${Date.now()}-${'xxxx'.replace(/x/g, () => Math.random().toString(16)[2])}`
  }))
}
