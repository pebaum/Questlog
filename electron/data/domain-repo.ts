import { v4 as uuid } from 'uuid'
import { getDb, saveDb } from './db'

export interface DomainRow {
  id: string
  name: string
  color: string
}

const DEFAULT_DOMAINS: { name: string; color: string }[] = [
  { name: 'Work', color: '#4a90d9' },
  { name: 'Personal', color: '#c8a84e' },
  { name: 'Home', color: '#6bb36b' }
]

function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const db = getDb()
  const stmt = db.prepare(sql)
  if (params.length) stmt.bind(params)
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return results
}

function queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
  const results = queryAll<T>(sql, params)
  return results[0]
}

function run(sql: string, params: unknown[] = []): void {
  getDb().run(sql, params)
}

export function ensureDefaultDomains(): void {
  for (const d of DEFAULT_DOMAINS) {
    const existing = queryOne<DomainRow>('SELECT * FROM domains WHERE name = ?', [d.name])
    if (!existing) {
      run('INSERT INTO domains (id, name, color) VALUES (?, ?, ?)', [uuid(), d.name, d.color])
    }
  }
  saveDb()
}

export function getAllDomains(): DomainRow[] {
  return queryAll<DomainRow>('SELECT * FROM domains ORDER BY name')
}

export function getDomainByName(name: string): DomainRow | undefined {
  return queryOne<DomainRow>('SELECT * FROM domains WHERE name = ?', [name])
}

export function getOrCreateDomain(name: string, color?: string): DomainRow {
  const existing = getDomainByName(name)
  if (existing) return existing
  const id = uuid()
  const c = color || '#c8a84e'
  run('INSERT INTO domains (id, name, color) VALUES (?, ?, ?)', [id, name, c])
  saveDb()
  return { id, name, color: c }
}

export function updateDomain(id: string, name: string, color: string): void {
  run('UPDATE domains SET name = ?, color = ? WHERE id = ?', [name, color, id])
  saveDb()
}
