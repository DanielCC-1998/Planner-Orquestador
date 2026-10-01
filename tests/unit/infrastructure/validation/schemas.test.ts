import { describe, expect, it } from 'vitest'
import { DEFAULT_REPORT_OPTIONS } from '@application'
import { CommandInputSchema } from '@infrastructure/ipc/inputSchemas'
import { PointScaleSchema, ReportOptionsSchema } from '@infrastructure/validation/schemas'

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
