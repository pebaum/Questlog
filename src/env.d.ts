/// <reference types="vite/client" />

interface QuestApi {
  getQuests(): Promise<import('./types/quest').QuestWithObjectives[]>
  getQuestById(id: string): Promise<import('./types/quest').QuestWithObjectives | null>
  getActiveQuests(): Promise<import('./types/quest').QuestWithObjectives[]>
  createQuest(data: Partial<import('./types/quest').Quest>): Promise<import('./types/quest').QuestWithObjectives>
  updateQuest(id: string, data: Partial<import('./types/quest').Quest>): Promise<import('./types/quest').QuestWithObjectives | { error: string } | null>
  deleteQuest(id: string): Promise<boolean>

  createObjective(questId: string, text: string): Promise<import('./types/quest').Objective>
  updateObjective(id: string, data: Partial<import('./types/quest').Objective>): Promise<boolean>
  deleteObjective(id: string): Promise<boolean>
  reorderObjectives(questId: string, orderedIds: string[]): Promise<boolean>

  getDomains(): Promise<import('./types/quest').Domain[]>
  createDomain(name: string, color: string): Promise<import('./types/quest').Domain>
  updateDomain(id: string, data: { name?: string; color?: string; sort_order?: number }): Promise<boolean>
  deleteDomain(id: string): Promise<boolean>
  reorderDomains(orderedIds: string[]): Promise<boolean>

  importObsidian(dir: string): Promise<{ imported: number; skipped: number }>
  pickImportFolder(): Promise<{ folder: string; imported: number; skipped: number } | null>
  initializeJournal(): Promise<{ folder: string; imported: number; skipped: number } | null>

  getSettings(): Promise<{ importFolder: string | null }>
  saveSettings(settings: Record<string, unknown>): Promise<unknown>

  toggleOverlay(): Promise<boolean>
  closeOverlay(): Promise<boolean>
  showOverlayContextMenu(): Promise<void>

  onQuestsUpdated(callback: () => void): () => void
}

interface Window {
  questApi: QuestApi
}
