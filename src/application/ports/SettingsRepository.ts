import type { Settings } from '../settings/Settings'

/** Persistence port for the app preferences. */
export interface SettingsRepository {
  load(): Promise<Settings>
  save(settings: Settings): Promise<void>
}
