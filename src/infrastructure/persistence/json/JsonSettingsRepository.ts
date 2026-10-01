import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DEFAULT_SETTINGS, type Settings, type SettingsRepository } from '@application'
import { IssuerSchema, LanguagePreferenceSchema, ReportOptionsSchema, ThemeSchema } from '../../validation/schemas'
import { atomicWrite, isNotFound } from './atomicWrite'

/**
 * Settings in `settings.json`. It is read field by field: an invalid value falls back to its
 * default without losing the rest.
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
    return {
      theme: theme.success ? theme.data : DEFAULT_SETTINGS.theme,
      language: language.success ? language.data : DEFAULT_SETTINGS.language,
      issuer: issuer.success ? issuer.data : DEFAULT_SETTINGS.issuer,
      reportOptions
    }
  }

  async save(settings: Settings): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    await atomicWrite(this.file, JSON.stringify(settings, null, 2))
  }
}
