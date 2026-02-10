import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDb, teardownTestDb, mockDbModule } from './setup'
import type { Database } from 'sql.js'

let db: Database

beforeEach(async () => {
  vi.resetModules()
  db = await setupTestDb()
  mockDbModule(db)
})

afterEach(() => {
  teardownTestDb()
  vi.restoreAllMocks()
})

describe('Quest CRUD', () => {
  it('should create a quest and retrieve it', async () => {
    const { createQuest, getQuestById } = await import('../data/quest-repo')

    const quest = createQuest({ title: 'Defeat the Dragon' })
    expect(quest).toBeDefined()
    expect(quest.title).toBe('Defeat the Dragon')
    expect(quest.id).toBeTruthy()

    const fetched = getQuestById(quest.id)
    expect(fetched).toBeDefined()
    expect(fetched!.title).toBe('Defeat the Dragon')
  })

  it('should create a quest with all fields', async () => {
    const { createQuest } = await import('../data/quest-repo')

    const quest = createQuest({
      title: 'Full Quest',
      goal: 'Save the world',
      description: 'An epic quest',
      domain: '',
      active: true,
      waiting_for: 'allies',
      priority: 3,
      source_file: '/quests/full.md'
    })

    expect(quest.title).toBe('Full Quest')
    expect(quest.goal).toBe('Save the world')
    expect(quest.description).toBe('An epic quest')
    expect(quest.active).toBe(1)
    expect(quest.waiting_for).toBe('allies')
    expect(quest.priority).toBe(3)
    expect(quest.source_file).toBe('/quests/full.md')
  })

  it('should get all quests', async () => {
    const { createQuest, getAllQuests } = await import('../data/quest-repo')

    createQuest({ title: 'Quest A' })
    createQuest({ title: 'Quest B' })
    createQuest({ title: 'Quest C' })

    const all = getAllQuests()
    expect(all).toHaveLength(3)
  })

  it('should update a quest', async () => {
    const { createQuest, updateQuest, getQuestById } = await import('../data/quest-repo')

    const quest = createQuest({ title: 'Old Title' })
    const updated = updateQuest(quest.id, { title: 'New Title', active: true, priority: 5 })

    expect(updated).toBeDefined()
    expect(updated!.title).toBe('New Title')
    expect(updated!.active).toBe(1)
    expect(updated!.priority).toBe(5)

    const fetched = getQuestById(quest.id)
    expect(fetched!.title).toBe('New Title')
  })

  it('should return undefined when updating non-existent quest', async () => {
    const { updateQuest } = await import('../data/quest-repo')
    const result = updateQuest('nonexistent-id', { title: 'Test' })
    expect(result).toBeUndefined()
  })

  it('should delete a quest', async () => {
    const { createQuest, deleteQuest, getQuestById, getAllQuests } = await import('../data/quest-repo')

    const quest = createQuest({ title: 'To Delete' })
    expect(getAllQuests()).toHaveLength(1)

    deleteQuest(quest.id)
    expect(getQuestById(quest.id)).toBeUndefined()
    expect(getAllQuests()).toHaveLength(0)
  })
})

describe('Objective CRUD', () => {
  it('should create an objective for a quest', async () => {
    const { createQuest, createObjective, getObjectivesForQuest } = await import('../data/quest-repo')

    const quest = createQuest({ title: 'Quest with Objectives' })
    const obj = createObjective(quest.id, 'Collect 10 items')

    expect(obj).toBeDefined()
    expect(obj.text).toBe('Collect 10 items')
    expect(obj.quest_id).toBe(quest.id)
    expect(obj.completed).toBe(0)
    expect(obj.sort_order).toBe(0)

    const objectives = getObjectivesForQuest(quest.id)
    expect(objectives).toHaveLength(1)
    expect(objectives[0].text).toBe('Collect 10 items')
  })

  it('should auto-increment sort_order', async () => {
    const { createQuest, createObjective } = await import('../data/quest-repo')

    const quest = createQuest({ title: 'Multi-objective Quest' })
    const obj1 = createObjective(quest.id, 'First')
    const obj2 = createObjective(quest.id, 'Second')
    const obj3 = createObjective(quest.id, 'Third')

    expect(obj1.sort_order).toBe(0)
    expect(obj2.sort_order).toBe(1)
    expect(obj3.sort_order).toBe(2)
  })

  it('should update an objective', async () => {
    const { createQuest, createObjective, updateObjective, getObjectivesForQuest } = await import('../data/quest-repo')

    const quest = createQuest({ title: 'Test Quest' })
    const obj = createObjective(quest.id, 'Original text')

    updateObjective(obj.id, { text: 'Updated text', completed: true })

    const objectives = getObjectivesForQuest(quest.id)
    expect(objectives[0].text).toBe('Updated text')
    expect(objectives[0].completed).toBe(1)
  })

  it('should delete an objective', async () => {
    const { createQuest, createObjective, deleteObjective, getObjectivesForQuest } = await import('../data/quest-repo')

    const quest = createQuest({ title: 'Test Quest' })
    const obj = createObjective(quest.id, 'To remove')
    expect(getObjectivesForQuest(quest.id)).toHaveLength(1)

    deleteObjective(obj.id)
    expect(getObjectivesForQuest(quest.id)).toHaveLength(0)
  })

  it('should reorder objectives', async () => {
    const { createQuest, createObjective, reorderObjectives, getObjectivesForQuest } = await import('../data/quest-repo')

    const quest = createQuest({ title: 'Reorder Quest' })
    const obj1 = createObjective(quest.id, 'First')
    const obj2 = createObjective(quest.id, 'Second')
    const obj3 = createObjective(quest.id, 'Third')

    // Reverse the order
    reorderObjectives(quest.id, [obj3.id, obj2.id, obj1.id])

    const objectives = getObjectivesForQuest(quest.id)
    expect(objectives[0].text).toBe('Third')
    expect(objectives[1].text).toBe('Second')
    expect(objectives[2].text).toBe('First')
  })

  it('should delete objectives when quest is deleted', async () => {
    const { createQuest, createObjective, deleteQuest, getObjectivesForQuest } = await import('../data/quest-repo')

    const quest = createQuest({ title: 'Quest to Delete' })
    createObjective(quest.id, 'Obj 1')
    createObjective(quest.id, 'Obj 2')
    expect(getObjectivesForQuest(quest.id)).toHaveLength(2)

    deleteQuest(quest.id)
    expect(getObjectivesForQuest(quest.id)).toHaveLength(0)
  })
})
