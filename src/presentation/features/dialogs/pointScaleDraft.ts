import {
  formatDurationInput,
  minutesForPoints,
  parseDuration,
  POINT_SCALE_VALUES,
  type DomainError,
  type PointScale
} from '@domain'

/**
 * The story point scale as it is being edited: duration texts exactly as typed ("2h", "90m").
 * An empty base turns the scale off; an empty exception means "follow the rule of three".
 */
export interface PointScaleDraft {
  readonly base: string
  /** Exceptions by number of points (the key is the number written with a dot). */
  readonly overrides: Readonly<Record<string, string>>
}

export type DraftError = { readonly kind: 'duration'; readonly error: DomainError } | { readonly kind: 'zero' }

export interface DraftResult {
  /** The scale to save (null = off). Only meaningful when `valid`. */
  readonly scale: PointScale | null
  readonly valid: boolean
  readonly baseError: DraftError | null
  readonly overrideErrors: Readonly<Record<string, DraftError>>
}

export function draftFromScale(scale: PointScale | null): PointScaleDraft {
  return {
    base: scale ? formatDurationInput(scale.minutesPerPoint) : '',
    overrides: Object.fromEntries((scale?.overrides ?? []).map((o) => [String(o.points), formatDurationInput(o.minutes)]))
  }
}

/**
 * Rows of the scale table after the base: the values of the interface scale and every exception
 * already in the draft, so an exception outside the usual values is never lost when saving.
 */
export function draftRows(draft: PointScaleDraft): number[] {
  const points = new Set<number>(POINT_SCALE_VALUES.filter((p) => p !== 1))
  for (const key of Object.keys(draft.overrides)) points.add(Number(key))
  return [...points].sort((a, b) => a - b)
}

/** Minutes that the rule of three gives to `points` with the base being typed (null without a valid base). */
export function ruleOfThree(draft: PointScaleDraft, points: number, hoursPerDay: number): number | null {
  const base = parseDuration(draft.base, hoursPerDay)
  if (!base.ok || base.value === null || base.value < 1) return null
  return minutesForPoints(points, { minutesPerPoint: base.value, overrides: [] })
}

/** Turns the draft into the scale to save, or reports which fields are wrong. */
export function scaleFromDraft(draft: PointScaleDraft, hoursPerDay: number): DraftResult {
  const base = parseDuration(draft.base, hoursPerDay)
  if (!base.ok) return { scale: null, valid: false, baseError: { kind: 'duration', error: base.error }, overrideErrors: {} }
  // Without a base the scale is off: the exceptions are not saved.
  if (base.value === null) return { scale: null, valid: true, baseError: null, overrideErrors: {} }
  if (base.value < 1) return { scale: null, valid: false, baseError: { kind: 'zero' }, overrideErrors: {} }

  const overrides: Array<{ points: number; minutes: number }> = []
  const overrideErrors: Record<string, DraftError> = {}
  for (const [key, text] of Object.entries(draft.overrides)) {
    const parsed = parseDuration(text, hoursPerDay)
    if (!parsed.ok) overrideErrors[key] = { kind: 'duration', error: parsed.error }
    else if (parsed.value !== null) overrides.push({ points: Number(key), minutes: parsed.value })
  }
  const valid = Object.keys(overrideErrors).length === 0
  overrides.sort((a, b) => a.points - b.points)
  return { scale: { minutesPerPoint: base.value, overrides }, valid, baseError: null, overrideErrors }
}
