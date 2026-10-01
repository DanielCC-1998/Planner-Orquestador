import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { endDateAfterWorkingDays, isIsoDate } from '@domain/common/calendar'
import { formatDurationInput, MAX_ESTIMATE_MINUTES, parseDuration } from '@domain/common/duration'
import { applyBps, costOf, moneyBreakdown } from '@domain/common/money'

const parse = (s: string, hpd = 8) => parseDuration(s, hpd)

describe('parseDuration', () => {
  it.each([
    ['', null],
    ['1,5', 90],
    ['1.5', 90],
    ['90m', 90],
    ['90 min', 90],
    ['1h 30m', 90],
    ['1h30', 90],
    ['1 h 30 min', 90],
    ['1:30', 90],
    ['2d', 960],
    ['1d 4h', 720],
    ['0', 0]
  ])('%s → %s', (input, expected) => {
    expect(parse(input)).toEqual({ ok: true, value: expected })
  })

  it.each([
    ['1.5 hours', 90],
    ['90 minutes', 90],
    ['2 days', 960],
    ['1 hour 30 minutes', 90],
    ['1 day 4 hrs', 720],
    ['45 mins', 45]
  ])('accepts English unit words: %s → %s', (input, expected) => {
    expect(parse(input)).toEqual({ ok: true, value: expected })
  })

  it.each([
    // i18n:es-start
    ['3 horas', 180],
    ['2 días', 960],
    ['1 dia 4 horas', 720]
    // i18n:es-end
  ])('accepts Spanish unit words: %s → %s', (input, expected) => {
    expect(parse(input)).toEqual({ ok: true, value: expected })
  })

  it('"2d" uses the hours per day of the project', () => {
    expect(parse('2d', 6)).toEqual({ ok: true, value: 720 })
  })

  it.each(['abc', '-5', '1.5.3', '2x', 'h'])('rejects %s', (input) => {
    expect(parse(input).ok).toBe(false)
  })

  it('errors carry a reason (and its parameters) for the UI', () => {
    expect(parse('2 weeks')).toEqual({
      ok: false,
      error: { code: 'INVALID', message: 'Unknown unit: "weeks"', reason: 'DURATION_UNIT', params: { unit: 'weeks' } }
    })
    expect(parse('abc')).toMatchObject({ ok: false, error: { code: 'INVALID', reason: 'DURATION_FORMAT' } })
    expect(parse('1.5.3')).toMatchObject({ ok: false, error: { reason: 'DURATION_FORMAT' } })
    expect(parse('100001h')).toMatchObject({ ok: false, error: { reason: 'DURATION_TOO_LARGE' } })
    // So many digits that the number overflows to Infinity: still "too large".
    expect(parse(`${'9'.repeat(400)}h`)).toMatchObject({ ok: false, error: { reason: 'DURATION_TOO_LARGE' } })
  })

  it('parse(format(m)) = m and it never throws', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_ESTIMATE_MINUTES }), (m) => {
        expect(parse(formatDurationInput(m))).toEqual({ ok: true, value: m })
      })
    )
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(() => parse(s)).not.toThrow()
      })
    )
  })
})

describe('money and calendar', () => {
  it('cost per task rounded to cents', () => {
    expect(costOf(90, 5000)).toBe(7500)
    expect(costOf(1, 3333)).toBe(56)
    expect(applyBps(10_000, 2100)).toBe(2100)
    expect(moneyBreakdown(10_000, 1000, 2100)).toEqual({
      subtotalCents: 10_000,
      contingencyCents: 1000,
      baseCents: 11_000,
      taxCents: 2310,
      totalCents: 13_310
    })
  })

  it('end date skipping weekends', () => {
    // 2026-10-02 is a Friday.
    expect(endDateAfterWorkingDays('2026-10-02', 1, [1, 2, 3, 4, 5])).toBe('2026-10-02')
    expect(endDateAfterWorkingDays('2026-10-02', 1.4, [1, 2, 3, 4, 5])).toBe('2026-10-05')
    expect(endDateAfterWorkingDays('2026-10-03', 1, [1, 2, 3, 4, 5])).toBe('2026-10-05')
    expect(endDateAfterWorkingDays('2026-10-02', 3, [])).toBeNull()
  })

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-1-1')).toBe(false)
  })
})
