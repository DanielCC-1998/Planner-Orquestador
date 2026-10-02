import { chooseContractModel, type Language } from '@domain'
import type { StoredReportOptions } from '../reports/ReportModel'

export type ThemePreference = 'system' | 'light' | 'dark'

/** Interface language: a fixed one, or 'system' to follow the operating system. */
export type LanguagePreference = 'system' | Language

export const LANGUAGE_PREFERENCES = ['system', 'en', 'es'] as const satisfies readonly LanguagePreference[]

/** Details of whoever issues the quote (PDF cover and footer) and who signs it for them. */
export interface Issuer {
  readonly name: string
  readonly taxId: string
  /** Name of the tax ID (RUT, NIF…); '' = the default label of the PDF language. */
  readonly taxIdLabel: string
  readonly address: string
  readonly email: string
  readonly phone: string
  readonly website: string
  /** Logo as a data URL (png/jpeg/svg), embedded in the PDF. */
  readonly logoDataUrl: string | null
  /** Who signs for the issuer: name, ID document and role ('' = a blank line in the PDF). */
  readonly signerName: string
  readonly signerId: string
  readonly signerRole: string
}

/**
 * A contract of the library, usually one per country: the general terms of the quotes signed
 * under it, the law that governs them and the courts for disputes ('' = not stated). Projects
 * point to one, so editing it changes the next PDFs of all of them.
 */
export interface ContractModel {
  readonly id: string
  readonly name: string
  readonly governingLaw: string
  readonly courts: string
  readonly generalTerms: string
}

/** A text of the library to insert into the particular terms of any project (a clause, usually). */
export interface SavedText {
  readonly id: string
  readonly name: string
  readonly text: string
}

export interface Settings {
  readonly theme: ThemePreference
  readonly language: LanguagePreference
  readonly issuer: Issuer
  /** Last export options used for each project. */
  readonly reportOptions: Readonly<Record<string, StoredReportOptions>>
  readonly contractModels: readonly ContractModel[]
  /** Model of the projects that do not choose one; null = none. */
  readonly defaultContractModelId: string | null
  readonly savedTexts: readonly SavedText[]
}

export const EMPTY_ISSUER: Issuer = {
  name: '',
  taxId: '',
  taxIdLabel: '',
  address: '',
  email: '',
  phone: '',
  website: '',
  logoDataUrl: null,
  signerName: '',
  signerId: '',
  signerRole: ''
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'system',
  issuer: EMPTY_ISSUER,
  reportOptions: {},
  contractModels: [],
  defaultContractModelId: null,
  savedTexts: []
}

/** The lists of the library are replaced whole. */
export type SettingsPatch = {
  readonly theme?: ThemePreference | undefined
  readonly language?: LanguagePreference | undefined
  readonly issuer?: Partial<Issuer> | undefined
  readonly reportOptions?: Readonly<Record<string, StoredReportOptions>> | undefined
  readonly contractModels?: readonly ContractModel[] | undefined
  readonly defaultContractModelId?: string | null | undefined
  readonly savedTexts?: readonly SavedText[] | undefined
}

export function mergeSettings(current: Settings, patch: SettingsPatch): Settings {
  const contractModels = patch.contractModels ?? current.contractModels
  const defaultId = patch.defaultContractModelId !== undefined ? patch.defaultContractModelId : current.defaultContractModelId
  return {
    theme: patch.theme ?? current.theme,
    language: patch.language ?? current.language,
    issuer: patch.issuer ? { ...current.issuer, ...patch.issuer } : current.issuer,
    reportOptions: patch.reportOptions ? { ...current.reportOptions, ...patch.reportOptions } : current.reportOptions,
    contractModels,
    // A default that is no longer in the library is no default.
    defaultContractModelId: defaultId !== null && contractModels.some((m) => m.id === defaultId) ? defaultId : null,
    savedTexts: patch.savedTexts ?? current.savedTexts
  }
}

/**
 * The contract model of a project: the one it chose if it still exists, otherwise the default
 * one; null when the library has neither.
 */
export function contractModelFor(settings: Settings, modelId: string | null): ContractModel | null {
  return chooseContractModel(settings.contractModels, settings.defaultContractModelId, modelId)
}
