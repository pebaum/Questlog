import { v4 as uuid } from 'uuid'
import { getDb, saveDb } from './db'

export interface DomainRow {
  id: string
  name: string
  color: string
  sort_order: number
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
  return queryAll<DomainRow>('SELECT * FROM domains ORDER BY sort_order ASC, name ASC')
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
  return { id, name, color: c, sort_order: 0 }
}

export function updateDomain(id: string, data: { name?: string; color?: string; sort_order?: number }): void {
  const fields: string[] = []
  const values: unknown[] = []
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color) }
  if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order) }
  if (fields.length === 0) return
  values.push(id)
  run(`UPDATE domains SET ${fields.join(', ')} WHERE id = ?`, values)
  saveDb()
}

export function getDomainById(id: string): DomainRow | undefined {
  return queryOne<DomainRow>('SELECT * FROM domains WHERE id = ?', [id])
}

export function deleteDomain(id: string): void {
  // Reassign quests from this domain to "Personal" domain
  const personal = getDomainByName('Personal')
  const reassignTo = personal && personal.id !== id ? personal.id : ''
  run('UPDATE quests SET domain = ? WHERE domain = ?', [reassignTo, id])
  run('DELETE FROM domains WHERE id = ?', [id])
  saveDb()
}

export function reorderDomains(orderedIds: string[]): void {
  orderedIds.forEach((id, index) => {
    run('UPDATE domains SET sort_order = ? WHERE id = ?', [index, id])
  })
  saveDb()
}

export function getQuestsByDomainId(domainId: string): { id: string }[] {
  return queryAll<{ id: string }>('SELECT id FROM quests WHERE domain = ?', [domainId])
}
