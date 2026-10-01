import { readFileSync } from 'node:fs'
import { isLanguage, type Language } from '@domain'

/**
 * Language explicitly chosen in `settings.json`, read synchronously before the app is ready.
 * Chromium's locale (native date inputs) can only be set at startup, so the main process
 * reads it here. Returns null for 'system', a missing file or an unreadable value.
 */
export function readStoredLanguage(settingsFile: string): Language | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(settingsFile, 'utf8'))
    const language = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)['language'] : null
    return isLanguage(language) ? language : null
  } catch {
    return null
  }
}
