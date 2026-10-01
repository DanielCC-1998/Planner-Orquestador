import type { LanguagePreference } from '@application'
import { LANGUAGE_NAMES, resolveLanguage } from '@shared/i18n/language'
import { useSettings } from '../stores/settings'
import { useI18n } from './index'

/** Options of the language pickers: each language written in itself, plus "System (resolved language)". */
export function useLanguageOptions(): Array<{ value: LanguagePreference; label: string }> {
  const { t } = useI18n()
  const systemLocales = useSettings((s) => s.info?.systemLocales)
  return [
    { value: 'en', label: LANGUAGE_NAMES.en },
    { value: 'es', label: LANGUAGE_NAMES.es },
    { value: 'system', label: t.common.language.system(LANGUAGE_NAMES[resolveLanguage('system', systemLocales ?? [])]) }
  ]
}
