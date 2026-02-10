import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDb, teardownTestDb, mockDbModule } from './setup'
import type { Database } from 'sql.js'
import matter from 'gray-matter'

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

describe('Markdown parsing', () => {
  it('should extract frontmatter fields', () => {
    const md = `---
domain: Work
active: true
priority: 3
waiting_for: Bob
next_action: Review the PR
---

## Quest Log
- 2024-01-15: Started the project

## Notes
Some detailed notes here.
`
    const { data, content } = matter(md)
    expect(data.domain).toBe('Work')
    expect(data.active).toBe(true)
    expect(data.priority).toBe(3)
    expect(data.waiting_for).toBe('Bob')
    expect(data.next_action).toBe('Review the PR')
    expect(content).toContain('## Quest Log')
    expect(content).toContain('## Notes')
  })

  it('should extract quest log section', () => {
    const md = `---
domain: Work
---

## Quest Log
- 2024-01-15: Started the quest
- 2024-01-16: Made progress

## Notes
Extra notes here.
`
    const { content } = matter(md)
    const logMatch = content.match(/## (?:Quest Log|QuestLog)\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    expect(logMatch).toBeTruthy()

    const logLines = logMatch![1].trim().split('\n').filter((l: string) => l.trim())
    expect(logLines).toHaveLength(2)

    // First line becomes goal, stripping date prefix
    const firstEntry = logLines[0].replace(/^-\s*\d{4}-\d{2}-\d{2}:\s*/, '')
    expect(firstEntry).toBe('Started the quest')
  })

  it('should extract notes section', () => {
    const md = `---
domain: Personal
---

## Quest Log
- 2024-01-10: Did something

## Notes
These are detailed notes.
They span multiple lines.
`
    const { content } = matter(md)
    const notesMatch = content.match(/## Notes\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    expect(notesMatch).toBeTruthy()
    expect(notesMatch![1].trim()).toBe('These are detailed notes.\nThey span multiple lines.')
  })

  it('should handle missing frontmatter', () => {
    const md = `# Just a title

Some content without frontmatter.
`
    const { data, content } = matter(md)
    expect(data.domain).toBeUndefined()
    expect(data.active).toBeUndefined()
    expect(content).toContain('# Just a title')
  })

  it('should handle missing quest log section', () => {
    const md = `---
domain: Home
---

## Notes
Only notes here, no quest log section.
`
    const { content } = matter(md)
    const logMatch = content.match(/## (?:Quest Log|QuestLog)\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    expect(logMatch).toBeNull()
  })

  it('should handle missing notes section', () => {
    const md = `---
domain: Work
---

## Quest Log
- 2024-03-01: Created the quest
`
    const { content } = matter(md)
    const notesMatch = content.match(/## Notes\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    expect(notesMatch).toBeNull()
  })

  it('should handle empty frontmatter', () => {
    const md = `---
---

## Quest Log
- 2024-01-01: Started
`
    const { data } = matter(md)
    expect(data.domain).toBeUndefined()
    expect(data.active).toBeUndefined()
    expect(data.priority).toBeUndefined()
  })

  it('should strip "Created from braindump." from first log entry', () => {
    const md = `---
domain: Work
---

## Quest Log
- 2024-01-01: Created from braindump. Actually do the thing
`
    const { content } = matter(md)
    const logMatch = content.match(/## (?:Quest Log|QuestLog)\s*\n([\s\S]*?)(?=\n## |\n*$)/)
    const logLines = logMatch![1].trim().split('\n').filter((l: string) => l.trim())
    const firstEntry = logLines[0]
      .replace(/^-\s*\d{4}-\d{2}-\d{2}:\s*/, '')
      .replace(/^Created from braindump\.\s*/, '')
    expect(firstEntry).toBe('Actually do the thing')
  })
})

describe('importFromObsidian', () => {
  it('should import markdown files into the database', async () => {
    const fs = await import('fs')
    vi.spyOn(fs.default, 'readdirSync').mockReturnValue([
      'Slay the Dragon.md' as unknown as fs.Dirent,
      'Build a Castle.md' as unknown as fs.Dirent,
      'notes.txt' as unknown as fs.Dirent  // should be filtered out
    ])
    vi.spyOn(fs.default, 'readFileSync').mockImplementation((filePath: fs.PathOrFileDescriptor) => {
      const p = String(filePath)
      if (p.includes('Slay the Dragon')) {
        return `---
domain: Work
active: true
priority: 2
next_action: Find the dragon's lair
---

## Quest Log
- 2024-01-01: Heard rumors of a dragon

## Notes
The dragon lives in the mountains.
`
      }
      if (p.includes('Build a Castle')) {
        return `---
domain: Home
active: false
---

## Quest Log
- 2024-02-01: Purchased the land
`
      }
      return ''
    })

    const { importFromObsidian } = await import('../data/importer')
    const { getAllQuests } = await import('../data/quest-repo')
    const { getAllDomains } = await import('../data/domain-repo')

    const result = importFromObsidian('/fake/quests')
    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(0)

    const quests = getAllQuests()
    expect(quests).toHaveLength(2)

    const dragon = quests.find(q => q.title === 'Slay the Dragon')
    expect(dragon).toBeDefined()
    expect(dragon!.goal).toBe('Heard rumors of a dragon')
    expect(dragon!.description).toBe("The dragon lives in the mountains.")
    expect(dragon!.priority).toBe(2)
    expect(dragon!.active).toBe(1)

    // Domains should have been created
    const domains = getAllDomains()
    expect(domains.length).toBeGreaterThanOrEqual(2)
  })

  it('should skip already-imported files', async () => {
    const fs = await import('fs')
    vi.spyOn(fs.default, 'readdirSync').mockReturnValue([
      'Existing Quest.md' as unknown as fs.Dirent
    ])
    vi.spyOn(fs.default, 'readFileSync').mockReturnValue(`---
domain: Work
active: true
---

## Quest Log
- 2024-01-01: Started
`)

    const { importFromObsidian } = await import('../data/importer')

    // First import
    const first = importFromObsidian('/fake/quests')
    expect(first.imported).toBe(1)

    // Reset modules to re-import with fresh module state but same db
    vi.resetModules()
    mockDbModule(db)

    // Re-mock fs for second import
    const fs2 = await import('fs')
    vi.spyOn(fs2.default, 'readdirSync').mockReturnValue([
      'Existing Quest.md' as unknown as fs.Dirent
    ])
    vi.spyOn(fs2.default, 'readFileSync').mockReturnValue(`---
domain: Work
active: true
---

## Quest Log
- 2024-01-01: Started
`)

    const { importFromObsidian: importAgain } = await import('../data/importer')
    const second = importAgain('/fake/quests')
    expect(second.imported).toBe(0)
    expect(second.skipped).toBe(1)
  })
})
