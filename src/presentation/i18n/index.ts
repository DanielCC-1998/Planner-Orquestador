import type { Language } from '@domain'
import { createFormatter, type Formatter } from '@shared/format'
import { useLanguage } from './languageStore'
import { MESSAGES, type Messages } from './messages'

/** Texts (`t`) and number/date formatting (`f`) of one language. */
export interface I18n {
  readonly language: Language
  readonly t: Messages
  readonly f: Formatter
}

const BUNDLES: Readonly<Record<Language, I18n>> = {
  en: { language: 'en', t: MESSAGES.en, f: createFormatter('en') },
  es: { language: 'es', t: MESSAGES.es, f: createFormatter('es') }
}

/**
 * Current language for React components. Every component that shows text must call it, so it
 * re-renders when the language changes. The bundle is the same object per language, so `t` and
 * `f` are stable and safe in hook dependencies.
 */
export function useI18n(): I18n {
  return BUNDLES[useLanguage((s) => s.language)]
}

/**
 * Current language for code outside React (actions, stores, confirmations). Call it when the
 * text is needed, never at module scope: a value read at import time would not follow changes.
 */
export function getI18n(): I18n {
  return BUNDLES[useLanguage.getState().language]
}

export type { Messages }
