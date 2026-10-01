import type { Language } from '@domain'
import type { LanguagePreference } from '@application'

/** BCP 47 locale used for numbers and dates in each language. */
export const LOCALE_OF: Readonly<Record<Language, string>> = { en: 'en-US', es: 'es-ES' }

/** Each language written in itself, for the language pickers. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  en: 'English',
  // i18n:es-start
  es: 'Español'
  // i18n:es-end
}

/** Languages whose speakers most likely prefer Spanish over English (Catalan, Galician, Basque). */
const SPANISH_FAMILY = ['es', 'ca', 'gl', 'eu']

/**
 * Language actually used for a preference. 'system' takes the first operating-system language
 * the app supports, in order of preference; English when none matches.
 */
export function resolveLanguage(pref: LanguagePreference, systemLocales: readonly string[]): Language {
  if (pref !== 'system') return pref
  for (const locale of systemLocales) {
    const base = locale.toLowerCase().split(/[-_]/)[0] ?? ''
    if (base === 'en') return 'en'
    if (SPANISH_FAMILY.includes(base)) return 'es'
  }
  return 'en'
}
