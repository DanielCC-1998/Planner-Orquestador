import { MAX_ESTIMATE_MINUTES } from '../common/duration'
import { domainError, err, ok, type DomainError, type Result } from '../common/primitives'
import { isNonNegInt } from '../common/validation'

/** Story point values offered in the interface: quick buttons and the rows of the project's scale. */
export const POINT_SCALE_VALUES = [1, 2, 3, 5, 8, 13] as const

/** Maximum number of exceptions to the rule of three. */
export const MAX_POINT_OVERRIDES = 20

/** Same limit as the story points of a task. */
const MAX_POINTS = 10_000

/** Hours of a given number of story points that do not follow the rule of three. */
export interface PointOverride {
  readonly points: number
  readonly minutes: number
}

/**
 * How story points turn into hours in a project. One point is `minutesPerPoint` and N points are
 * N × that value (rule of three), except for the values listed in `overrides`. A project without
 * a scale (null) never derives hours from story points.
 */
export interface PointScale {
  readonly minutesPerPoint: number
  /** Sorted by points, without repeated values and without 1 (one point is `minutesPerPoint`). */
  readonly overrides: readonly PointOverride[]
}

/** Story points keep 2 decimals; overrides are matched on that value. */
export const roundPoints = (points: number): number => Math.round(points * 100) / 100

/** Minutes of a task with `points` story points, or null when the project has no scale. */
export function minutesForPoints(points: number, scale: PointScale | null): number | null {
  if (scale === null) return null
  const key = roundPoints(points)
  const override = scale.overrides.find((o) => o.points === key)
  if (override) return override.minutes
  // Computed on hundredths of a point so 0.29 × 100 does not drift; rounded once per task.
  const minutes = Math.round((Math.round(key * 100) * scale.minutesPerPoint) / 100)
  return Math.min(minutes, MAX_ESTIMATE_MINUTES)
}

const invalidScale = (message: string): Result<never, DomainError> =>
  err(domainError('INVALID', message, 'INVALID_POINT_SCALE'))

/** Validates and normalizes a scale: rounded points, sorted overrides. null turns the scale off. */
export function validatePointScale(raw: unknown): Result<PointScale | null, DomainError> {
  if (raw === null) return ok(null)
  if (typeof raw !== 'object') return invalidScale('Invalid story point scale')
  const { minutesPerPoint, overrides } = raw as { minutesPerPoint?: unknown; overrides?: unknown }
  if (!isNonNegInt(minutesPerPoint, MAX_ESTIMATE_MINUTES) || minutesPerPoint < 1) {
    return invalidScale('One story point must be worth at least 1 minute')
  }
  if (!Array.isArray(overrides) || overrides.length > MAX_POINT_OVERRIDES) {
    return invalidScale(`At most ${MAX_POINT_OVERRIDES} exceptions to the rule of three`)
  }
  const seen = new Set<number>()
  const normalized: PointOverride[] = []
  for (const item of overrides as unknown[]) {
    const { points, minutes } = (typeof item === 'object' && item !== null ? item : {}) as {
      points?: unknown
      minutes?: unknown
    }
    if (typeof points !== 'number' || !Number.isFinite(points) || points > MAX_POINTS) {
      return invalidScale('Invalid story points in the scale')
    }
    const key = roundPoints(points)
    if (key <= 0) return invalidScale('Invalid story points in the scale')
    if (key === 1) return invalidScale('One story point is the base of the scale, not an exception')
    if (seen.has(key)) return invalidScale('Repeated story points in the scale')
    if (!isNonNegInt(minutes, MAX_ESTIMATE_MINUTES)) return invalidScale('Invalid hours in the scale')
    seen.add(key)
    normalized.push({ points: key, minutes })
  }
  normalized.sort((a, b) => a.points - b.points)
  return ok({ minutesPerPoint, overrides: normalized })
}
