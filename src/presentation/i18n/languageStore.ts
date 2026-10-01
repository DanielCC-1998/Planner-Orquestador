import { create } from 'zustand'
import type { Language } from '@domain'

/**
 * Language currently shown ('system' already resolved). A tiny store that imports nothing else
 * from the app, so i18n can be used anywhere without import cycles. The settings store keeps it
 * in sync with the saved preference.
 */
interface LanguageStore {
  language: Language
  setLanguage(language: Language): void
}

export const useLanguage = create<LanguageStore>((set) => ({
  language: 'en',
  setLanguage: (language) => set({ language })
}))
