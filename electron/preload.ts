import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Quests
  getQuests: () => ipcRenderer.invoke('quests:getAll'),
  getQuestById: (id: string) => ipcRenderer.invoke('quests:getById', id),
  getActiveQuests: () => ipcRenderer.invoke('quests:getActive'),
  createQuest: (data: Record<string, unknown>) => ipcRenderer.invoke('quests:create', data),
  updateQuest: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('quests:update', id, data),
  deleteQuest: (id: string) => ipcRenderer.invoke('quests:delete', id),

  // Objectives
  createObjective: (questId: string, text: string) => ipcRenderer.invoke('objectives:create', questId, text),
  updateObjective: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('objectives:update', id, data),
  deleteObjective: (id: string) => ipcRenderer.invoke('objectives:delete', id),
  reorderObjectives: (questId: string, orderedIds: string[]) => ipcRenderer.invoke('objectives:reorder', questId, orderedIds),

  // Domains
  getDomains: () => ipcRenderer.invoke('domains:getAll'),
  createDomain: (name: string, color: string) => ipcRenderer.invoke('domains:create', name, color),
  updateDomain: (id: string, name: string, color: string) => ipcRenderer.invoke('domains:update', id, name, color),

  // Import
  importObsidian: (dir: string) => ipcRenderer.invoke('import:obsidian', dir),
  pickImportFolder: () => ipcRenderer.invoke('import:pickFolder'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:save', settings),

  // Overlay
  toggleOverlay: () => ipcRenderer.invoke('overlay:toggle'),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  showOverlayContextMenu: () => ipcRenderer.invoke('overlay:contextmenu'),

  // Events
  onQuestsUpdated: (callback: () => void) => {
    ipcRenderer.on('quests:updated', callback)
    return () => ipcRenderer.removeListener('quests:updated', callback)
  }
}

contextBridge.exposeInMainWorld('questApi', api)
