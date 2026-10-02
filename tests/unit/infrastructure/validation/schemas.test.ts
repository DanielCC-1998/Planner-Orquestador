import { describe, expect, it } from 'vitest'
import { DEFAULT_REPORT_OPTIONS, DEFAULT_SETTINGS, EMPTY_ISSUER, mergeSettings } from '@application'
import { EMPTY_PARTY } from '@domain'
import { CommandInputSchema, SettingsPatchSchema } from '@infrastructure/ipc/inputSchemas'
import { PointScaleSchema, ReportOptionsSchema, SettingsSchema } from '@infrastructure/validation/schemas'

describe('ReportOptionsSchema', () => {
  it('options saved before `descriptions` existed are still valid and use the separate section', () => {
    const { descriptions: _omitted, ...legacy } = DEFAULT_REPORT_OPTIONS
    const parsed = ReportOptionsSchema.safeParse(legacy)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.descriptions).toBe('section')
  })

  it('options saved before the PDF language existed are still valid and have no language', () => {
    const { language: _omitted, ...legacy } = DEFAULT_REPORT_OPTIONS
    const parsed = ReportOptionsSchema.safeParse(legacy)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.language).toBeUndefined()
  })

  it('options saved before tags could be printed are still valid and print no tags', () => {
    const { tags: _omitted, ...columns } = DEFAULT_REPORT_OPTIONS.columns
    const parsed = ReportOptionsSchema.safeParse({ ...DEFAULT_REPORT_OPTIONS, columns })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.columns.tags).toBe(false)
  })

  it('rejects an unknown placement or language', () => {
    expect(ReportOptionsSchema.safeParse({ ...DEFAULT_REPORT_OPTIONS, descriptions: 'margin' }).success).toBe(false)
    expect(ReportOptionsSchema.safeParse({ ...DEFAULT_REPORT_OPTIONS, language: 'fr' }).success).toBe(false)
  })
})

describe('PointScaleSchema and the project.update input', () => {
  const scale = { minutesPerPoint: 120, overrides: [{ points: 5, minutes: 480 }] }

  it('accepts a scale, or null to turn it off', () => {
    expect(PointScaleSchema.safeParse(scale).success).toBe(true)
    expect(PointScaleSchema.nullable().safeParse(null).success).toBe(true)
  })

  it('rejects a base of 0, an exception for 1 point and repeated points', () => {
    expect(PointScaleSchema.safeParse({ ...scale, minutesPerPoint: 0 }).success).toBe(false)
    expect(PointScaleSchema.safeParse({ ...scale, overrides: [{ points: 1, minutes: 30 }] }).success).toBe(false)
    const repeated = [
      { points: 5, minutes: 480 },
      { points: 5, minutes: 500 }
    ]
    expect(PointScaleSchema.safeParse({ ...scale, overrides: repeated }).success).toBe(false)
  })

  it('the IPC input carries the scale and rejects unknown keys', () => {
    const input = (pointScale: unknown) => ({
      id: '00000000-0000-4000-8000-000000000001',
      command: { type: 'project.update', patch: { pointScale } }
    })
    expect(CommandInputSchema.safeParse(input(scale)).success).toBe(true)
    expect(CommandInputSchema.safeParse(input(null)).success).toBe(true)
    expect(CommandInputSchema.safeParse(input({ ...scale, rounding: 'up' })).success).toBe(false)
  })
})

describe('IPC input of sprints and tags', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  const command = (command: unknown) => CommandInputSchema.safeParse({ id, command }).success

  it('project.update carries the sprint length (or null) but not the tags', () => {
    expect(command({ type: 'project.update', patch: { sprints: { length: 2, unit: 'week' } } })).toBe(true)
    expect(command({ type: 'project.update', patch: { sprints: null } })).toBe(true)
    expect(command({ type: 'project.update', patch: { sprints: { length: 2, unit: 'year' } } })).toBe(false)
    expect(command({ type: 'project.update', patch: { tags: [] } })).toBe(false)
  })

  it('tag commands and tag ids of a task', () => {
    expect(command({ type: 'tag.create', name: 'Design', color: 'teal', assignTo: [id] })).toBe(true)
    expect(command({ type: 'tag.create', name: 'Design', color: 'silver' })).toBe(false)
    expect(command({ type: 'tag.update', id: 'tag-1', patch: { name: 'UX' } })).toBe(true)
    expect(command({ type: 'tag.update', id: 'tag 1', patch: {} })).toBe(false)
    expect(command({ type: 'tag.delete', id: 'tag-1' })).toBe(true)
    expect(command({ type: 'tag.assign', ids: [id], tagId: 'tag-1', assigned: true })).toBe(true)
    expect(command({ type: 'task.update', id, patch: { tagIds: ['tag-1'] } })).toBe(true)
    expect(command({ type: 'task.update', id, patch: { tags: ['Design'] } })).toBe(false)
  })
})

describe('the quote as a contract: stored options, settings and the IPC input', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  const command = (command: unknown) => CommandInputSchema.safeParse({ id, command }).success

  it('options saved before the quote could be signed get the signatures page with the initials', () => {
    const { signatures: _signatures, ...sections } = DEFAULT_REPORT_OPTIONS.sections
    const { initials: _initials, ...legacy } = DEFAULT_REPORT_OPTIONS
    const parsed = ReportOptionsSchema.safeParse({ ...legacy, sections })
    expect(parsed.success && [parsed.data.sections.signatures, parsed.data.initials]).toEqual([true, true])
  })

  it('settings saved before have the contract fields of the issuer empty', () => {
    const issuer = { name: 'Studio', taxId: 'B-1', address: '', email: '', phone: '', website: '', logoDataUrl: null }
    const parsed = SettingsSchema.safeParse({ theme: 'light', language: 'es', issuer, reportOptions: {} })
    expect(parsed.success && parsed.data.issuer).toEqual({ ...EMPTY_ISSUER, name: 'Studio', taxId: 'B-1' })
  })

  it('changing some fields of the issuer keeps the others: the patch has no defaults', () => {
    const patch = SettingsPatchSchema.parse({ issuer: { name: 'Studio' } })
    expect(patch.issuer).toEqual({ name: 'Studio' })
    const current = { ...DEFAULT_SETTINGS, issuer: { ...EMPTY_ISSUER, taxIdLabel: 'RUT', signerName: 'Emma North' } }
    expect(mergeSettings(current, patch).issuer).toMatchObject({ name: 'Studio', taxIdLabel: 'RUT', signerName: 'Emma North' })
    expect(SettingsPatchSchema.safeParse({ issuer: { signature: 'x' } }).success).toBe(false)
  })

  it('project.update carries the whole quote with the client of the contract', () => {
    const quote = { number: 'P-1', date: null, validityDays: 30, terms: '', client: { ...EMPTY_PARTY, legalName: 'ACME Ltd.' }, contractModelId: null }
    expect(command({ type: 'project.update', patch: { quote } })).toBe(true)
    const { client: _client, ...withoutClient } = quote
    expect(command({ type: 'project.update', patch: { quote: withoutClient } })).toBe(false)
    expect(command({ type: 'project.update', patch: { quote: { ...quote, client: { ...EMPTY_PARTY, taxId: 'x'.repeat(51) } } } })).toBe(false)
  })
})

describe('IPC input of the library of contracts', () => {
  const uruguay = { id: '00000000-0000-4000-8000-000000000001', name: 'Uruguay', governingLaw: 'Uruguay', courts: 'Paysandu', generalTerms: '1. Terms.' }
  const billing = { id: '00000000-0000-4000-8000-000000000011', name: 'Billing', text: 'Billing. Per sprint.' }

  it('settings.set replaces the models, the default one and the saved texts; strict objects', () => {
    expect(SettingsPatchSchema.safeParse({ contractModels: [uruguay], defaultContractModelId: uruguay.id, savedTexts: [billing] }).success).toBe(true)
    expect(SettingsPatchSchema.safeParse({ defaultContractModelId: null }).success).toBe(true)
    expect(SettingsPatchSchema.safeParse({ contractModels: [{ ...uruguay, country: 'UY' }] }).success).toBe(false)
    expect(SettingsPatchSchema.safeParse({ savedTexts: [{ ...billing, name: '  ' }] }).success).toBe(false)
    expect(SettingsPatchSchema.safeParse({ contractModels: [{ ...uruguay, id: 'uruguay' }] }).success).toBe(false)
  })

  it('project.update carries the contract model of the quote: an id or null (the default one)', () => {
    const id = '00000000-0000-4000-8000-000000000099'
    const quote = (contractModelId: unknown) => ({ number: '', date: null, validityDays: 30, terms: '', client: EMPTY_PARTY, contractModelId })
    const update = (contractModelId: unknown) =>
      CommandInputSchema.safeParse({ id, command: { type: 'project.update', patch: { quote: quote(contractModelId) } } }).success
    expect(update(uruguay.id)).toBe(true)
    expect(update(null)).toBe(true)
    expect(update('uruguay')).toBe(false)
  })
})
