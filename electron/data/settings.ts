import fs from 'fs'
import path from 'path'
import { app } from 'electron'

interface AppSettings {
  importFolder: string | null
}

const defaults: AppSettings = {
  importFolder: null
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const merged = { ...current, ...settings }
  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2))
  return merged
}
