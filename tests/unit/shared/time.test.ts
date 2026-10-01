import { describe, expect, it } from 'vitest'
import { localDateOf, localIsoDate } from '@shared/time'

describe('local dates', () => {
  it('use the local calendar of the computer, not the UTC one', () => {
    expect(localIsoDate(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31')
    expect(localIsoDate(new Date(2026, 1, 1, 0, 1))).toBe('2026-02-01')
    expect(localDateOf(new Date(2026, 0, 31, 23, 59).toISOString())).toBe('2026-01-31')
  })

  it('a timestamp that cannot be read counts as today', () => {
    expect(localDateOf('not a date')).toBe(localIsoDate(new Date()))
  })
})
