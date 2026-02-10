import { ipcMain, Menu, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
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
  ipcMain.handle('domains:create', (_e, name: string, color: string) => {
    const domain = domainRepo.getOrCreateDomain(name, color)
    broadcastUpdate()
    return domain
  })
  ipcMain.handle('domains:update', (_e, id: string, data: { name?: string; color?: string; sort_order?: number }) => {
    const oldDomain = domainRepo.getDomainById(id)
    const oldName = oldDomain?.name
    domainRepo.updateDomain(id, data)
    // If domain was renamed, update markdown files for all quests in this domain
    if (data.name && oldName && data.name !== oldName) {
      const questIds = domainRepo.getQuestsByDomainId(id)
      for (const q of questIds) {
        writeQuestToMarkdown(q.id)
      }
    }
    broadcastUpdate()
    return true
  })
  ipcMain.handle('domains:delete', (_e, id: string) => {
    // Update markdown files for quests that will be reassigned
    const questIds = domainRepo.getQuestsByDomainId(id)
    domainRepo.deleteDomain(id)
    for (const q of questIds) {
      writeQuestToMarkdown(q.id)
    }
    broadcastUpdate()
    return true
  })
  ipcMain.handle('domains:reorder', (_e, orderedIds: string[]) => {
    domainRepo.reorderDomains(orderedIds)
    broadcastUpdate()
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

  // Journal initialization (first-run)
  ipcMain.handle('journal:initialize', async () => {
    const main = getMainWindow()
    if (!main) return null
    const result = await dialog.showOpenDialog(main, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose a folder for your quest journal'
    })
    if (result.canceled || !result.filePaths.length) return null
    const folder = result.filePaths[0]

    // Create folder if it doesn't exist
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }

    // Create _tome_of_values.md
    const tomePath = path.join(folder, '_tome_of_values.md')
    if (!fs.existsSync(tomePath)) {
      fs.writeFileSync(tomePath, `---
type: tome_of_values
---

# Tome of Values

Write anything here about your values, priorities, and what matters to you.
AI tools can read this file to help prioritize and suggest quests.

## What Matters Most


## Current Life Priorities


## Guiding Principles

`, 'utf-8')
    }

    // Create a sample quest file
    const samplePath = path.join(folder, 'getting-started.md')
    if (!fs.existsSync(samplePath)) {
      fs.writeFileSync(samplePath, `---
domain: Personal
active: true
priority: 1
---

## QuestLog

- ${new Date().toISOString().split('T')[0]}: Set up QuestLog and organize my first quests

## Objectives

- [ ] Explore the quest list and detail views
- [ ] Create a new quest using the + Quest button
- [ ] Try organizing quests into domains

## Notes

This is a sample quest to help you get started with QuestLog.
Feel free to edit or delete this quest once you are comfortable.
`, 'utf-8')
    }

    // Save settings and import
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
