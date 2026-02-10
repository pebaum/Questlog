export interface Quest {
  id: string
  title: string
  goal: string
  description: string
  domain: string
  active: boolean
  waiting_for: string | null
  priority: number
  completed_at: string | null
  created_at: string
  updated_at: string
  source_file: string | null
}

export interface Objective {
  id: string
  quest_id: string
  text: string
  completed: boolean
  order: number
}

export interface Domain {
  id: string
  name: string
  color: string
}

export interface QuestWithObjectives extends Quest {
  objectives: Objective[]
}

export type SortField = 'title' | 'domain' | 'priority' | 'updated_at'
export type SortDirection = 'asc' | 'desc'

export interface QuestFilters {
  search: string
  domain: string | null
  activeOnly: boolean
  showCompleted: boolean
  sortField: SortField
  sortDirection: SortDirection
}
