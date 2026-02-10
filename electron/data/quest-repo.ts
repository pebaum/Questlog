import { v4 as uuid } from 'uuid'
import { getDb, saveDb } from './db'

export interface QuestRow {
  id: string
  title: string
  goal: string
  description: string
  domain: string
  active: number
  waiting_for: string | null
  priority: number
  completed_at: string | null
  created_at: string
  updated_at: string
  source_file: string | null
}

export interface ObjectiveRow {
  id: string
  quest_id: string
  text: string
  completed: number
  sort_order: number
}

function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const db = getDb()
  const stmt = db.prepare(sql)
  if (params.length) stmt.bind(params)
  const results: T[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    results.push(row as T)
  }
  stmt.free()
  return results
}

function queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
  const results = queryAll<T>(sql, params)
  return results[0]
}

function run(sql: string, params: unknown[] = []): void {
  const db = getDb()
  db.run(sql, params)
}

export function getAllQuests(): QuestRow[] {
  return queryAll<QuestRow>('SELECT * FROM quests ORDER BY updated_at DESC')
}

export function getQuestById(id: string): QuestRow | undefined {
  return queryOne<QuestRow>('SELECT * FROM quests WHERE id = ?', [id])
}

export function getActiveQuests(): QuestRow[] {
  return queryAll<QuestRow>('SELECT * FROM quests WHERE active = 1 AND completed_at IS NULL ORDER BY priority DESC')
}


export function createQuest(data: {
  title: string
  goal?: string
  description?: string
  domain?: string
  active?: boolean
  waiting_for?: string | null
  priority?: number
  source_file?: string | null
}): QuestRow {
  const id = uuid()
  const now = new Date().toISOString()
  run(
    `INSERT INTO quests (id, title, goal, description, domain, active, waiting_for, priority, created_at, updated_at, source_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.title,
      data.goal || '',
      data.description || '',
      data.domain || '',
      data.active ? 1 : 0,
      data.waiting_for || null,
      data.priority ?? 0,
      now,
      now,
      data.source_file || null
    ]
  )
  saveDb()
  return getQuestById(id)!
}

export function updateQuest(id: string, data: Partial<{
  title: string
  goal: string
  description: string
  domain: string
  active: boolean
  waiting_for: string | null
  priority: number
  completed_at: string | null
}>): QuestRow | undefined {
  const quest = getQuestById(id)
  if (!quest) return undefined

  const fields: string[] = []
  const values: unknown[] = []

  if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title) }
  if (data.goal !== undefined) { fields.push('goal = ?'); values.push(data.goal) }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description) }
  if (data.domain !== undefined) { fields.push('domain = ?'); values.push(data.domain) }
  if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0) }
  if (data.waiting_for !== undefined) { fields.push('waiting_for = ?'); values.push(data.waiting_for) }
  if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority) }
  if (data.completed_at !== undefined) { fields.push('completed_at = ?'); values.push(data.completed_at) }

  if (fields.length === 0) return quest

  fields.push("updated_at = datetime('now')")
  values.push(id)

  run(`UPDATE quests SET ${fields.join(', ')} WHERE id = ?`, values)
  saveDb()
  return getQuestById(id)
}

export function deleteQuest(id: string): void {
  run('DELETE FROM objectives WHERE quest_id = ?', [id])
  run('DELETE FROM quests WHERE id = ?', [id])
  saveDb()
}

// Objectives
export function getObjectivesForQuest(questId: string): ObjectiveRow[] {
  return queryAll<ObjectiveRow>('SELECT * FROM objectives WHERE quest_id = ? ORDER BY sort_order ASC', [questId])
}

export function createObjective(questId: string, text: string): ObjectiveRow {
  const id = uuid()
  const maxRow = queryOne<{ mx: number }>('SELECT COALESCE(MAX(sort_order), -1) as mx FROM objectives WHERE quest_id = ?', [questId])
  const order = (maxRow?.mx ?? -1) + 1
  run('INSERT INTO objectives (id, quest_id, text, completed, sort_order) VALUES (?, ?, ?, 0, ?)', [id, questId, text, order])
  run("UPDATE quests SET updated_at = datetime('now') WHERE id = ?", [questId])
  saveDb()
  return { id, quest_id: questId, text, completed: 0, sort_order: order }
}

export function updateObjective(id: string, data: Partial<{ text: string; completed: boolean; order: number }>): void {
  const fields: string[] = []
  const values: unknown[] = []
  if (data.text !== undefined) { fields.push('text = ?'); values.push(data.text) }
  if (data.completed !== undefined) { fields.push('completed = ?'); values.push(data.completed ? 1 : 0) }
  if (data.order !== undefined) { fields.push('sort_order = ?'); values.push(data.order) }
  if (fields.length === 0) return
  values.push(id)
  run(`UPDATE objectives SET ${fields.join(', ')} WHERE id = ?`, values)

  const obj = queryOne<{ quest_id: string }>('SELECT quest_id FROM objectives WHERE id = ?', [id])
  if (obj) {
    run("UPDATE quests SET updated_at = datetime('now') WHERE id = ?", [obj.quest_id])
  }
  saveDb()
}

export function deleteObjective(id: string): void {
  const obj = queryOne<{ quest_id: string }>('SELECT quest_id FROM objectives WHERE id = ?', [id])
  run('DELETE FROM objectives WHERE id = ?', [id])
  if (obj) {
    run("UPDATE quests SET updated_at = datetime('now') WHERE id = ?", [obj.quest_id])
  }
  saveDb()
}

export function getObjectiveParent(id: string): string | undefined {
  const obj = queryOne<{ quest_id: string }>('SELECT quest_id FROM objectives WHERE id = ?', [id])
  return obj?.quest_id
}

export function reorderObjectives(questId: string, orderedIds: string[]): void {
  orderedIds.forEach((id, index) => {
    run('UPDATE objectives SET sort_order = ? WHERE id = ? AND quest_id = ?', [index, id, questId])
  })
  saveDb()
}
