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

describe('Domain CRUD', () => {
  it('should create default domains on ensureDefaultDomains', async () => {
    const { ensureDefaultDomains, getAllDomains } = await import('../data/domain-repo')

    ensureDefaultDomains()
    const domains = getAllDomains()

    expect(domains).toHaveLength(3)
    const names = domains.map(d => d.name).sort()
    expect(names).toEqual(['Home', 'Personal', 'Work'])
  })

  it('should not duplicate defaults when called twice', async () => {
    const { ensureDefaultDomains, getAllDomains } = await import('../data/domain-repo')

    ensureDefaultDomains()
    ensureDefaultDomains()
    const domains = getAllDomains()

    expect(domains).toHaveLength(3)
  })

  it('should have correct colors for default domains', async () => {
    const { ensureDefaultDomains, getDomainByName } = await import('../data/domain-repo')

    ensureDefaultDomains()

    const work = getDomainByName('Work')
    expect(work).toBeDefined()
    expect(work!.color).toBe('#4a90d9')

    const personal = getDomainByName('Personal')
    expect(personal).toBeDefined()
    expect(personal!.color).toBe('#c8a84e')

    const home = getDomainByName('Home')
    expect(home).toBeDefined()
    expect(home!.color).toBe('#6bb36b')
  })

  it('should get all domains sorted by sort_order then name', async () => {
    const { ensureDefaultDomains, getAllDomains } = await import('../data/domain-repo')

    ensureDefaultDomains()
    const domains = getAllDomains()

    // All have sort_order 0, so sorted by name: Home, Personal, Work
    expect(domains[0].name).toBe('Home')
    expect(domains[1].name).toBe('Personal')
    expect(domains[2].name).toBe('Work')
  })

  it('should get or create a domain', async () => {
    const { getOrCreateDomain, getAllDomains } = await import('../data/domain-repo')

    const domain = getOrCreateDomain('Fitness', '#ff0000')
    expect(domain.name).toBe('Fitness')
    expect(domain.color).toBe('#ff0000')

    // Getting the same domain again should return existing
    const same = getOrCreateDomain('Fitness')
    expect(same.id).toBe(domain.id)

    expect(getAllDomains()).toHaveLength(1)
  })

  it('should use default color when not specified', async () => {
    const { getOrCreateDomain } = await import('../data/domain-repo')

    const domain = getOrCreateDomain('NoColor')
    expect(domain.color).toBe('#c8a84e')
  })

  it('should update a domain', async () => {
    const { getOrCreateDomain, updateDomain, getDomainById } = await import('../data/domain-repo')

    const domain = getOrCreateDomain('Old Name', '#111111')
    updateDomain(domain.id, { name: 'New Name', color: '#222222' })

    const updated = getDomainById(domain.id)
    expect(updated).toBeDefined()
    expect(updated!.name).toBe('New Name')
    expect(updated!.color).toBe('#222222')
  })

  it('should delete a domain and reassign quests to Personal', async () => {
    const { ensureDefaultDomains, getOrCreateDomain, deleteDomain, getAllDomains, getDomainByName } = await import('../data/domain-repo')
    const { createQuest, getQuestById } = await import('../data/quest-repo')

    ensureDefaultDomains()
    const fitness = getOrCreateDomain('Fitness', '#ff0000')

    const quest = createQuest({ title: 'Gym', domain: fitness.id })

    deleteDomain(fitness.id)

    // Domain should be gone
    const domains = getAllDomains()
    expect(domains.find(d => d.name === 'Fitness')).toBeUndefined()

    // Quest should be reassigned to Personal
    const personal = getDomainByName('Personal')
    const updatedQuest = getQuestById(quest.id)
    expect(updatedQuest!.domain).toBe(personal!.id)
  })

  it('should reorder domains', async () => {
    const { ensureDefaultDomains, getAllDomains, reorderDomains, getDomainByName } = await import('../data/domain-repo')

    ensureDefaultDomains()
    const work = getDomainByName('Work')!
    const personal = getDomainByName('Personal')!
    const home = getDomainByName('Home')!

    // Reorder: Home first, then Work, then Personal
    reorderDomains([home.id, work.id, personal.id])

    const domains = getAllDomains()
    expect(domains[0].name).toBe('Home')
    expect(domains[1].name).toBe('Work')
    expect(domains[2].name).toBe('Personal')
  })
})
