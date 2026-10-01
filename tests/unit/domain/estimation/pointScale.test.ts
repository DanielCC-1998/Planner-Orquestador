import { describe, expect, it } from 'vitest'
import { MAX_ESTIMATE_MINUTES, MAX_POINT_OVERRIDES, minutesForPoints, validatePointScale, type PointScale } from '@domain'

const twoHours: PointScale = { minutesPerPoint: 120, overrides: [] }

describe('minutesForPoints', () => {
  it('applies the rule of three to the value of one point', () => {
    expect(minutesForPoints(1, twoHours)).toBe(120)
    expect(minutesForPoints(5, twoHours)).toBe(600)
    expect(minutesForPoints(13, twoHours)).toBe(1560)
  })

  it('an exception wins over the rule of three, only for its exact value', () => {
    const scale: PointScale = { minutesPerPoint: 120, overrides: [{ points: 5, minutes: 480 }] }
    expect(minutesForPoints(5, scale)).toBe(480)
    expect(minutesForPoints(8, scale)).toBe(960)
  })

  it('without a scale story points give no hours', () => {
    expect(minutesForPoints(5, null)).toBeNull()
  })

  it('0 points are 0 minutes, and decimals are exact to the hundredth of a point', () => {
    expect(minutesForPoints(0, twoHours)).toBe(0)
    expect(minutesForPoints(0.5, { minutesPerPoint: 45, overrides: [] })).toBe(23)
    expect(minutesForPoints(0.29, { minutesPerPoint: 100, overrides: [] })).toBe(29)
    expect(minutesForPoints(2.5, { minutesPerPoint: 60, overrides: [{ points: 2.5, minutes: 200 }] })).toBe(200)
  })

  it('never goes past the maximum estimate of a task', () => {
    expect(minutesForPoints(10_000, { minutesPerPoint: MAX_ESTIMATE_MINUTES, overrides: [] })).toBe(MAX_ESTIMATE_MINUTES)
  })
})

describe('validatePointScale', () => {
  it('null turns the scale off', () => {
    expect(validatePointScale(null)).toEqual({ ok: true, value: null })
  })

  it('normalizes: points rounded to 2 decimals and exceptions sorted', () => {
    const r = validatePointScale({
      minutesPerPoint: 90,
      overrides: [
        { points: 8, minutes: 600 },
        { points: 2.505, minutes: 200 }
      ]
    })
    expect(r).toEqual({
      ok: true,
      value: {
        minutesPerPoint: 90,
        overrides: [
          { points: 2.51, minutes: 200 },
          { points: 8, minutes: 600 }
        ]
      }
    })
  })

  it.each([
    ['a base below 1 minute', { minutesPerPoint: 0, overrides: [] }],
    ['a base that is not a whole number of minutes', { minutesPerPoint: 1.5, overrides: [] }],
    ['an exception for 1 point (that is the base)', { minutesPerPoint: 60, overrides: [{ points: 1, minutes: 30 }] }],
    [
      'repeated points after rounding',
      {
        minutesPerPoint: 60,
        overrides: [
          { points: 3, minutes: 100 },
          { points: 3.001, minutes: 120 }
        ]
      }
    ],
    ['0 points', { minutesPerPoint: 60, overrides: [{ points: 0, minutes: 10 }] }],
    ['negative minutes', { minutesPerPoint: 60, overrides: [{ points: 3, minutes: -1 }] }],
    [
      'too many exceptions',
      {
        minutesPerPoint: 60,
        overrides: Array.from({ length: MAX_POINT_OVERRIDES + 1 }, (_, i) => ({ points: i + 2, minutes: 60 }))
      }
    ],
    ['something that is not a scale', 'two hours']
  ])('rejects %s', (_label, raw) => {
    const r = validatePointScale(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatchObject({ code: 'INVALID', reason: 'INVALID_POINT_SCALE' })
  })
})
