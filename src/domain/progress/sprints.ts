import { addCalendarDays, addMonthsClamped, daysBetween } from '../common/calendar'
import {
  domainError,
  err,
  ok,
  type DomainError,
  type IsoDate,
  type IsoDateTime,
  type Result,
  type TaskId
} from '../common/primitives'
import { TASK_STATUSES, type Task, type TaskStatus } from '../task/Task'

export const SPRINT_UNITS = ['day', 'week', 'month'] as const
export type SprintUnit = (typeof SPRINT_UNITS)[number]

/** Length of the project's sprints, e.g. 2 weeks. They follow one another from the start date. */
export interface SprintSettings {
  readonly length: number
  readonly unit: SprintUnit
}

export const MAX_SPRINT_LENGTH: Readonly<Record<SprintUnit, number>> = { day: 365, week: 52, month: 12 }

/** Sprints of a new project, and of projects saved before sprints existed. */
export const DEFAULT_SPRINT_SETTINGS: SprintSettings = { length: 2, unit: 'week' }

/** Safety limit: older sprints are not listed (a start date decades ago with 1-day sprints). */
const MAX_LISTED_SPRINTS = 20_000

const invalidSprints = (message: string): Result<never, DomainError> =>
  err(domainError('INVALID', message, 'INVALID_SPRINTS'))

/** Validates the sprint length. null means the project does not work in sprints. */
export function validateSprintSettings(raw: unknown): Result<SprintSettings | null, DomainError> {
  if (raw === null) return ok(null)
  if (typeof raw !== 'object') return invalidSprints('Invalid sprint length')
  const { length, unit } = raw as { length?: unknown; unit?: unknown }
  if (typeof unit !== 'string' || !(SPRINT_UNITS as readonly string[]).includes(unit)) {
    return invalidSprints('Invalid sprint length')
  }
  const max = MAX_SPRINT_LENGTH[unit as SprintUnit]
  if (typeof length !== 'number' || !Number.isInteger(length) || length < 1 || length > max) {
    return invalidSprints(`A sprint lasts from 1 to ${max} ${unit}s`)
  }
  return ok({ length, unit: unit as SprintUnit })
}

/** First day of the first sprint: the project's start date or, without one, the day it was created. */
export function sprintAnchor(
  meta: { readonly startDate: IsoDate | null; readonly createdAt: IsoDateTime },
  localDate: (at: IsoDateTime) => IsoDate
): IsoDate {
  return meta.startDate ?? localDate(meta.createdAt)
}

const daysPerSprint = (s: SprintSettings): number => s.length * (s.unit === 'week' ? 7 : 1)

/** First day of the sprint with that index (0 = sprint 1; negative indexes go back in time). */
export function sprintStartDate(start: IsoDate, settings: SprintSettings, index: number): IsoDate {
  return settings.unit === 'month'
    ? addMonthsClamped(start, index * settings.length)
    : addCalendarDays(start, index * daysPerSprint(settings))
}

/** First and last day (inclusive) of the sprint with that index. */
export function sprintWindow(start: IsoDate, settings: SprintSettings, index: number): { readonly start: IsoDate; readonly end: IsoDate } {
  return { start: sprintStartDate(start, settings, index), end: addCalendarDays(sprintStartDate(start, settings, index + 1), -1) }
}

/** Index of the sprint that contains `date`: 0 = sprint 1, negative = before the first sprint. */
export function sprintIndexOf(start: IsoDate, settings: SprintSettings, date: IsoDate): number {
  if (settings.unit !== 'month') return Math.floor(daysBetween(start, date) / daysPerSprint(settings))
  const months =
    (Number(date.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + (Number(date.slice(5, 7)) - Number(start.slice(5, 7)))
  let index = Math.floor(months / settings.length)
  // A day clamped to a shorter month (31 → 28) moves a boundary a few days: one step fixes it.
  while (date < sprintStartDate(start, settings, index)) index--
  while (date >= sprintStartDate(start, settings, index + 1)) index++
  return index
}

export type ChangeDirection = 'forward' | 'backward'

/** Net change of a task in a sprint: its status at the start and at the end. */
export interface SprintChange {
  readonly taskId: TaskId
  readonly from: TaskStatus
  readonly to: TaskStatus
  readonly direction: ChangeDirection
}

export interface Sprint {
  /** 1, 2, 3…; 0 is the group of changes recorded before the first sprint. */
  readonly number: number
  /** First day; null for the group before the first sprint. */
  readonly start: IsoDate | null
  /** Last day (inclusive). */
  readonly end: IsoDate
  /** It contains today. */
  readonly current: boolean
  readonly changes: readonly SprintChange[]
}

const ORDER: ReadonlyMap<TaskStatus, number> = new Map(TASK_STATUSES.map((s, i) => [s, i]))

/**
 * Status changes sprint by sprint, from the first sprint to the one that contains `today`.
 * A task appears in a sprint when its status at the end differs from its status at the start;
 * what it went through in between does not count. Changes recorded before the first sprint
 * form a group of their own (number 0), listed only when it has changes.
 */
export function sprintChanges(
  tasks: Iterable<Task>,
  start: IsoDate,
  settings: SprintSettings,
  today: IsoDate,
  localDate: (at: IsoDateTime) => IsoDate
): Sprint[] {
  const todayIndex = sprintIndexOf(start, settings, today)
  // Changes after today (a clock set back) count in the current sprint; before the start, in group -1.
  const last = Math.max(todayIndex, -1)
  const first = Math.max(0, last - MAX_LISTED_SPRINTS + 1)
  const bucketOf = (at: IsoDateTime) => Math.min(Math.max(sprintIndexOf(start, settings, localDate(at)), -1), last)

  const changes = new Map<number, SprintChange[]>()
  for (const task of tasks) {
    const history = task.statusHistory
    const buckets = history.map((entry) => bucketOf(entry.at))
    let i = 0
    while (i < history.length) {
      let j = i
      while (j + 1 < history.length && buckets[j + 1] === buckets[i]) j++
      const from = history[i]!.from ?? history[i]!.to
      const to = history[j]!.to
      if (from !== to) {
        const list = changes.get(buckets[i]!) ?? []
        list.push({ taskId: task.id, from, to, direction: ORDER.get(to)! > ORDER.get(from)! ? 'forward' : 'backward' })
        changes.set(buckets[i]!, list)
      }
      i = j + 1
    }
  }

  const sprints: Sprint[] = []
  const before = changes.get(-1)
  if (before) sprints.push({ number: 0, start: null, end: addCalendarDays(start, -1), current: false, changes: before })
  for (let k = first; k <= last; k++) {
    sprints.push({ number: k + 1, ...sprintWindow(start, settings, k), current: k === todayIndex, changes: changes.get(k) ?? [] })
  }
  return sprints
}
