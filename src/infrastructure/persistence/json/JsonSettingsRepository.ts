import { randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { z } from 'zod'
import { DEFAULT_SETTINGS, type ContractModel, type Settings, type SettingsRepository } from '@application'
import { LIBRARY_LIMITS } from '@shared/terms'
import {
  ContractModelSchema,
  IssuerSchema,
  LanguagePreferenceSchema,
  ReportOptionsSchema,
  SavedTextSchema,
  ThemeSchema
} from '../../validation/schemas'
import { atomicWrite, isNotFound } from './atomicWrite'

/** The valid items of a list of the file, without repeated ids, up to `limit`. */
function itemsOf<T extends { readonly id: string }>(value: unknown, schema: z.ZodType<T>, limit: number): T[] {
  const items: T[] = []
  for (const raw of Array.isArray(value) ? value : []) {
    const parsed = schema.safeParse(raw)
    if (parsed.success && !items.some((item) => item.id === parsed.data.id)) items.push(parsed.data)
    if (items.length === limit) break
  }
  return items
}

/** The general terms, law and courts an early version stored in the issuer, as a model of the library. */
function legacyContract(issuer: unknown): ContractModel | null {
  if (typeof issuer !== 'object' || issuer === null) return null
  const text = (key: string, max: number) => {
    const value = (issuer as Record<string, unknown>)[key]
    return typeof value === 'string' ? value.slice(0, max) : ''
  }
  const generalTerms = text('generalTerms', LIBRARY_LIMITS.text)
  const governingLaw = text('governingLaw', LIBRARY_LIMITS.place)
  const courts = text('courts', LIBRARY_LIMITS.place)
  if (!generalTerms.trim() && !governingLaw.trim() && !courts.trim()) return null
  const name = (governingLaw.trim() || courts.trim() || 'Contract').slice(0, LIBRARY_LIMITS.name)
  return { id: randomUUID(), name, governingLaw, courts, generalTerms }
}

/**
 * Settings in `settings.json`. It is read field by field (and the library item by item): an
 * invalid value falls back to its default without losing the rest.
 */
export class JsonSettingsRepository implements SettingsRepository {
  constructor(private readonly file: string) {}

  async load(): Promise<Settings> {
    let raw: unknown
    try {
      raw = JSON.parse(await readFile(this.file, 'utf8'))
    } catch (e) {
      if (!isNotFound(e)) console.warn('[planner] unreadable settings.json, using the defaults')
      return DEFAULT_SETTINGS
    }
    const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
    const theme = ThemeSchema.safeParse(obj['theme'])
    const language = LanguagePreferenceSchema.safeParse(obj['language'])
    const issuer = IssuerSchema.safeParse(obj['issuer'])
    const reportOptions: Record<string, Settings['reportOptions'][string]> = {}
    if (typeof obj['reportOptions'] === 'object' && obj['reportOptions'] !== null) {
      for (const [id, value] of Object.entries(obj['reportOptions'] as Record<string, unknown>)) {
        const parsed = ReportOptionsSchema.safeParse(value)
        if (parsed.success && /^[0-9a-f-]{36}$/i.test(id)) reportOptions[id] = parsed.data
      }
    }
    const contractModels = itemsOf(obj['contractModels'], ContractModelSchema, LIBRARY_LIMITS.models)
    let defaultId = obj['defaultContractModelId']
    // An early version kept a single contract in the issuer: it becomes the default model of the library.
    const legacy = legacyContract(obj['issuer'])
    if (legacy && contractModels.length === 0) {
      contractModels.push(legacy)
      defaultId = legacy.id
    }
    return {
      theme: theme.success ? theme.data : DEFAULT_SETTINGS.theme,
      language: language.success ? language.data : DEFAULT_SETTINGS.language,
      issuer: issuer.success ? issuer.data : DEFAULT_SETTINGS.issuer,
      reportOptions,
      contractModels,
      defaultContractModelId: contractModels.some((model) => model.id === defaultId) ? (defaultId as string) : null,
      savedTexts: itemsOf(obj['savedTexts'], SavedTextSchema, LIBRARY_LIMITS.texts)
    }
  }

  async save(settings: Settings): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    await atomicWrite(this.file, JSON.stringify(settings, null, 2))
  }
}
