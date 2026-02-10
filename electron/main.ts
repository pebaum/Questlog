import { app, BrowserWindow, globalShortcut } from 'electron'
import { createMainWindow, createOverlayWindow, toggleOverlay } from './window-manager'
import { initDb, closeDb } from './data/db'
import { ensureDefaultDomains } from './data/domain-repo'
import { registerIpcHandlers } from './ipc-handlers'
import { importFromObsidian } from './data/importer'
import { startFileWatcher, stopFileWatcher } from './data/file-watcher'
import { getSettings } from './data/settings'
import { initAutoUpdater } from './auto-updater'

app.whenReady().then(async () => {
  await initDb()
  ensureDefaultDomains()

  // Auto-import and start watching configured folder
  const settings = getSettings()
  if (settings.importFolder) {
    try {
      const result = importFromObsidian(settings.importFolder)
      console.log(`Imported ${result.imported} quests, skipped ${result.skipped}, updated ${result.updated}`)
      startFileWatcher(settings.importFolder)
    } catch (err) {
      console.error('Failed to import:', err)
    }
  }

  registerIpcHandlers()

  createMainWindow()
  createOverlayWindow()

  globalShortcut.register('CommandOrControl+Shift+Q', toggleOverlay)

  if (app.isPackaged) {
    initAutoUpdater()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  stopFileWatcher()
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopFileWatcher()
  closeDb()
})
