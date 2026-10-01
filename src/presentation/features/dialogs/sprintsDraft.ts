import {
  DEFAULT_SPRINT_SETTINGS,
  MAX_SPRINT_LENGTH,
  sprintIndexOf,
  sprintWindow,
  validateSprintSettings,
  type IsoDate,
  type SprintSettings,
  type SprintUnit
} from '@domain'

/** What the "Sprints" tab of the project settings is editing (the length as typed). */
export interface SprintsDraft {
  readonly enabled: boolean
  readonly length: string
  readonly unit: SprintUnit
}

/** Quick choices offered next to the length. */
export const SPRINT_PRESETS: ReadonlyArray<SprintSettings> = [
  { length: 1, unit: 'week' },
  { length: 2, unit: 'week' },
  { length: 1, unit: 'month' }
]

/** A project without sprints opens the tab with the default length ready, switched off. */
export function draftFromSprints(settings: SprintSettings | null): SprintsDraft {
  const { length, unit } = settings ?? DEFAULT_SPRINT_SETTINGS
  return { enabled: settings !== null, length: String(length), unit }
}

/** Settings of the draft, or an error carrying the maximum length of its unit. */
export function sprintsFromDraft(draft: SprintsDraft): { settings: SprintSettings | null; error: { max: number } | null } {
  if (!draft.enabled) return { settings: null, error: null }
  const typed = draft.length.trim()
  const valid = typed === '' ? null : validateSprintSettings({ length: Number(typed), unit: draft.unit })
  if (!valid?.ok) return { settings: null, error: { max: MAX_SPRINT_LENGTH[draft.unit] } }
  return { settings: valid.value, error: null }
}

/** Number and days of the sprint that contains `today`; null before the first sprint starts. */
export function currentSprint(
  start: IsoDate,
  settings: SprintSettings,
  today: IsoDate
): { readonly number: number; readonly start: IsoDate; readonly end: IsoDate } | null {
  const index = sprintIndexOf(start, settings, today)
  return index < 0 ? null : { number: index + 1, ...sprintWindow(start, settings, index) }
}
