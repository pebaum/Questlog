import { ipcMain, Menu, dialog } from 'electron'
import * as questRepo from './data/quest-repo'
import * as domainRepo from './data/domain-repo'
import { importFromObsidian } from './data/importer'
import { writeQuestToMarkdown, deleteQuestMarkdown } from './data/md-writer'
import { startFileWatcher } from './data/file-watcher'
import { getSettings, saveSettings } from './data/settings'
import { getMainWindow, getOverlayWindow, toggleOverlay } from './window-manager'

function getQuestIdForObjective(objId: string): string | null {
  const obj = questRepo.getObjectiveParent(objId)
  return obj || null
}

export function registerIpcHandlers(): void {
  // Quests
  ipcMain.handle('quests:getAll', () => {
    const quests = questRepo.getAllQuests()
    return quests.map(q => ({
      ...q,
      active: !!q.active,
      objectives: questRepo.getObjectivesForQuest(q.id).map(o => ({ ...o, completed: !!o.completed }))
    }))
  })

  ipcMain.handle('quests:getById', (_e, id: string) => {
    const q = questRepo.getQuestById(id)
    if (!q) return null
    return {
      ...q,
      active: !!q.active,
      objectives: questRepo.getObjectivesForQuest(q.id).map(o => ({ ...o, completed: !!o.completed }))
    }
  })

  ipcMain.handle('quests:getActive', () => {
    const quests = questRepo.getActiveQuests()
    return quests.map(q => ({
      ...q,
      active: true,
      objectives: questRepo.getObjectivesForQuest(q.id).map(o => ({ ...o, completed: !!o.completed }))
    }))
  })

  ipcMain.handle('quests:create', (_e, data) => {
    const quest = questRepo.createQuest(data)
    writeQuestToMarkdown(quest.id)
    broadcastUpdate()
    return { ...quest, active: !!quest.active, objectives: [] }
  })

  ipcMain.handle('quests:update', (_e, id: string, data) => {
    if (data.active === true) {
      const currentCount = questRepo.getActiveCount()
      const existing = questRepo.getQuestById(id)
      if (existing && !existing.active && currentCount >= 5) {
        return { error: 'Maximum 5 active quests allowed' }
      }
    }
    const quest = questRepo.updateQuest(id, data)
    if (quest) writeQuestToMarkdown(id)
    broadcastUpdate()
    if (!quest) return null
    return {
      ...quest,
      active: !!quest.active,
      objectives: questRepo.getObjectivesForQuest(quest.id).map(o => ({ ...o, completed: !!o.completed }))
    }
  })

  ipcMain.handle('quests:delete', (_e, id: string) => {
    deleteQuestMarkdown(id)
    questRepo.deleteQuest(id)
    broadcastUpdate()
    return true
  })

  // Objectives
  ipcMain.handle('objectives:create', (_e, questId: string, text: string) => {
    const obj = questRepo.createObjective(questId, text)
    writeQuestToMarkdown(questId)
    broadcastUpdate()
    return { ...obj, completed: !!obj.completed }
  })

  ipcMain.handle('objectives:update', (_e, id: string, data) => {
    const questId = getQuestIdForObjective(id)
    questRepo.updateObjective(id, data)
    if (questId) writeQuestToMarkdown(questId)
    broadcastUpdate()
    return true
  })

  ipcMain.handle('objectives:delete', (_e, id: string) => {
    const questId = getQuestIdForObjective(id)
    questRepo.deleteObjective(id)
    if (questId) writeQuestToMarkdown(questId)
    broadcastUpdate()
    return true
  })

  ipcMain.handle('objectives:reorder', (_e, questId: string, orderedIds: string[]) => {
    questRepo.reorderObjectives(questId, orderedIds)
    writeQuestToMarkdown(questId)
    broadcastUpdate()
    return true
  })

  // Domains
  ipcMain.handle('domains:getAll', () => domainRepo.getAllDomains())
  ipcMain.handle('domains:create', (_e, name: string, color: string) => domainRepo.getOrCreateDomain(name, color))
  ipcMain.handle('domains:update', (_e, id: string, name: string, color: string) => {
    domainRepo.updateDomain(id, name, color)
    return true
  })

  // Import
  ipcMain.handle('import:obsidian', (_e, dir: string) => importFromObsidian(dir))

  ipcMain.handle('import:pickFolder', async () => {
    const main = getMainWindow()
    if (!main) return null
    const result = await dialog.showOpenDialog(main, {
      properties: ['openDirectory'],
      title: 'Select folder containing quest markdown files'
    })
    if (result.canceled || !result.filePaths.length) return null
    const folder = result.filePaths[0]
    saveSettings({ importFolder: folder })
    const importResult = importFromObsidian(folder)
    startFileWatcher(folder)
    broadcastUpdate()
    return { folder, ...importResult }
  })

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_e, settings) => saveSettings(settings))

  // Overlay
  ipcMain.handle('overlay:toggle', () => { toggleOverlay(); return true })
  ipcMain.handle('overlay:close', () => {
    const overlay = getOverlayWindow()
    if (overlay && !overlay.isDestroyed()) overlay.close()
    return true
  })
  ipcMain.handle('overlay:contextmenu', () => {
    const overlay = getOverlayWindow()
    if (!overlay || overlay.isDestroyed()) return
    Menu.buildFromTemplate([{
      label: 'Close Duty List',
      click: () => { if (overlay && !overlay.isDestroyed()) overlay.close() }
    }]).popup({ window: overlay })
  })
}

function broadcastUpdate(): void {
  for (const win of require('electron').BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('quests:updated')
  }
}
