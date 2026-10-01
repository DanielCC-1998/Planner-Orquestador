import type { Language } from '@domain'
import type { StoredReportOptions } from '../reports/ReportModel'

export type ThemePreference = 'system' | 'light' | 'dark'

/** Interface language: a fixed one, or 'system' to follow the operating system. */
export type LanguagePreference = 'system' | Language

export const LANGUAGE_PREFERENCES = ['system', 'en', 'es'] as const satisfies readonly LanguagePreference[]

/** Details of whoever issues the quote (PDF cover and footer). */
export interface Issuer {
  readonly name: string
  readonly taxId: string
  readonly address: string
  readonly email: string
  readonly phone: string
  readonly website: string
  /** Logo as a data URL (png/jpeg/svg), embedded in the PDF. */
  readonly logoDataUrl: string | null
}

export interface Settings {
  readonly theme: ThemePreference
  readonly language: LanguagePreference
  readonly issuer: Issuer
  /** Last export options used for each project. */
  readonly reportOptions: Readonly<Record<string, StoredReportOptions>>
}

export const EMPTY_ISSUER: Issuer = {
  name: '',
  taxId: '',
  address: '',
  email: '',
  phone: '',
  website: '',
  logoDataUrl: null
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'system',
  issuer: EMPTY_ISSUER,
  reportOptions: {}
}

export type SettingsPatch = {
  readonly theme?: ThemePreference | undefined
  readonly language?: LanguagePreference | undefined
  readonly issuer?: Partial<Issuer> | undefined
  readonly reportOptions?: Readonly<Record<string, StoredReportOptions>> | undefined
}

export function mergeSettings(current: Settings, patch: SettingsPatch): Settings {
  return {
    theme: patch.theme ?? current.theme,
    language: patch.language ?? current.language,
    issuer: patch.issuer ? { ...current.issuer, ...patch.issuer } : current.issuer,
    reportOptions: patch.reportOptions ? { ...current.reportOptions, ...patch.reportOptions } : current.reportOptions
  }
}
