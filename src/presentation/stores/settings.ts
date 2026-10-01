import { create } from 'zustand'
import type { LanguagePreference, Settings, SettingsPatch, ThemePreference } from '@application'
import { resolveLanguage } from '@shared/i18n/language'
import type { AppInfo } from '@shared/ipc/contract'
import { useLanguage } from '../i18n/languageStore'
import { call, errorMessage } from '../lib/api'
import { toast } from './toasts'

interface SettingsStore {
  settings: Settings | null
  info: AppInfo | null
  /** Settings and app info have been requested (successfully or not): the UI can render. */
  loaded: boolean
  load(): Promise<void>
  update(patch: SettingsPatch): Promise<void>
  setTheme(theme: ThemePreference): Promise<void>
  setLanguage(language: LanguagePreference): Promise<void>
}

/** Shows `preference` right away ('system' resolved with the OS languages reported by main). */
function applyLanguage(preference: LanguagePreference, info: AppInfo | null): void {
  useLanguage.getState().setLanguage(resolveLanguage(preference, info?.systemLocales ?? []))
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: null,
  info: null,
  loaded: false,

  async load() {
    try {
      const [settings, info] = await Promise.all([call('settings.get'), call('app.info')])
      applyLanguage(settings.language, info)
      set({ settings, info })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      set({ loaded: true })
    }
  },

  async update(patch) {
    // The language changes at once; main confirms it right after.
    if (patch.language) applyLanguage(patch.language, get().info)
    try {
      const settings = await call('settings.set', patch)
      applyLanguage(settings.language, get().info)
      set({ settings })
    } catch (e) {
      const current = get().settings
      if (current) applyLanguage(current.language, get().info)
      toast.error(errorMessage(e))
    }
  },

  setTheme(theme) {
    return get().update({ theme })
  },

  setLanguage(language) {
    return get().update({ language })
  }
}))
