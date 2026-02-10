import { create } from 'zustand'
import type { QuestWithObjectives, Domain, QuestFilters, SortField, SortDirection } from '../types/quest'

interface QuestStore {
  quests: QuestWithObjectives[]
  domains: Domain[]
  selectedQuestId: string | null
  filters: QuestFilters

  // Actions
  loadQuests: () => Promise<void>
  loadDomains: () => Promise<void>
  selectQuest: (id: string | null) => void
  setSearch: (search: string) => void
  setDomainFilter: (domain: string | null) => void
  setActiveOnly: (activeOnly: boolean) => void
  setShowCompleted: (show: boolean) => void
  setSort: (field: SortField, direction?: SortDirection) => void

  // Derived
  filteredQuests: () => QuestWithObjectives[]
  selectedQuest: () => QuestWithObjectives | null
  activeQuests: () => QuestWithObjectives[]
  questsByDomain: () => Map<string, QuestWithObjectives[]>
}

export const useQuestStore = create<QuestStore>((set, get) => ({
  quests: [],
  domains: [],
  selectedQuestId: null,
  filters: {
    search: '',
    domain: null,
    activeOnly: false,
    showCompleted: false,
    sortField: 'updated_at',
    sortDirection: 'desc'
  },

  loadQuests: async () => {
    const quests = await window.questApi.getQuests()
    set({ quests })
  },

  loadDomains: async () => {
    const domains = await window.questApi.getDomains()
    set({ domains })
  },

  selectQuest: (id) => set({ selectedQuestId: id }),

  setSearch: (search) => set((s) => ({ filters: { ...s.filters, search } })),
  setDomainFilter: (domain) => set((s) => ({ filters: { ...s.filters, domain } })),
  setActiveOnly: (activeOnly) => set((s) => ({ filters: { ...s.filters, activeOnly } })),
  setShowCompleted: (show) => set((s) => ({ filters: { ...s.filters, showCompleted: show } })),
  setSort: (field, direction) => set((s) => ({
    filters: {
      ...s.filters,
      sortField: field,
      sortDirection: direction ?? (s.filters.sortField === field && s.filters.sortDirection === 'asc' ? 'desc' : 'asc')
    }
  })),

  filteredQuests: () => {
    const { quests, filters, domains } = get()
    let result = [...quests]

    // Filter completed
    if (!filters.showCompleted) {
      result = result.filter(q => !q.completed_at)
    }

    // Filter active only
    if (filters.activeOnly) {
      result = result.filter(q => q.active)
    }

    // Filter by domain
    if (filters.domain) {
      result = result.filter(q => q.domain === filters.domain)
    }

    // Search
    if (filters.search) {
      const s = filters.search.toLowerCase()
      result = result.filter(q =>
        q.title.toLowerCase().includes(s) ||
        q.goal.toLowerCase().includes(s) ||
        q.description.toLowerCase().includes(s) ||
        q.waiting_for?.toLowerCase().includes(s)
      )
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (filters.sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'domain': {
          const da = domains.find(d => d.id === a.domain)?.name || ''
          const db_ = domains.find(d => d.id === b.domain)?.name || ''
          cmp = da.localeCompare(db_)
          break
        }
        case 'priority':
          cmp = a.priority - b.priority
          break
        case 'updated_at':
          cmp = a.updated_at.localeCompare(b.updated_at)
          break
      }
      return filters.sortDirection === 'desc' ? -cmp : cmp
    })

    return result
  },

  selectedQuest: () => {
    const { quests, selectedQuestId } = get()
    if (!selectedQuestId) return null
    return quests.find(q => q.id === selectedQuestId) || null
  },

  activeQuests: () => {
    return get().quests.filter(q => q.active && !q.completed_at)
  },

  questsByDomain: () => {
    const filtered = get().filteredQuests()
    const { domains } = get()
    const map = new Map<string, QuestWithObjectives[]>()

    // Initialize with all domains
    for (const d of domains) {
      map.set(d.id, [])
    }
    map.set('', []) // uncategorized

    for (const q of filtered) {
      const existing = map.get(q.domain) || []
      existing.push(q)
      map.set(q.domain, existing)
    }

    // Remove empty groups
    for (const [key, value] of map) {
      if (value.length === 0) map.delete(key)
    }

    return map
  }
}))
