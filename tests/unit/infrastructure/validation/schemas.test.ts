import { describe, expect, it } from 'vitest'
import { DEFAULT_REPORT_OPTIONS } from '@application'
import { ReportOptionsSchema } from '@infrastructure/validation/schemas'

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
