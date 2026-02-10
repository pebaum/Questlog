import { app, BrowserWindow, globalShortcut } from 'electron'
import { createMainWindow, createOverlayWindow, toggleOverlay } from './window-manager'
import { initDb, closeDb } from './data/db'
import { ensureDefaultDomains } from './data/domain-repo'
import { registerIpcHandlers } from './ipc-handlers'
import { importFromObsidian } from './data/importer'
import { getSettings } from './data/settings'

app.whenReady().then(async () => {
  await initDb()
  ensureDefaultDomains()

  // Auto-import from configured folder if set
  const settings = getSettings()
  if (settings.importFolder) {
    try {
      const result = importFromObsidian(settings.importFolder)
      console.log(`Imported ${result.imported} quests, skipped ${result.skipped}`)
    } catch (err) {
      console.error('Failed to import:', err)
    }
  }

  registerIpcHandlers()

  createMainWindow()
  createOverlayWindow()

  globalShortcut.register('CommandOrControl+Shift+Q', toggleOverlay)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  closeDb()
})
