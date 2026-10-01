import type { IsoDate } from './primitives'

/** ISO weekdays: 1 = Monday … 7 = Sunday. */
export const DEFAULT_WORKING_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5]

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false
  const m = ISO_DATE_RE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

function toUtc(date: IsoDate): Date {
  const m = ISO_DATE_RE.exec(date)
  if (!m) throw new Error(`Invalid date: ${date}`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10)
}

function isoWeekday(date: Date): number {
  const d = date.getUTCDay()
  return d === 0 ? 7 : d
}

export function addCalendarDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

/**
 * Date of the last working day of a job of `workDays` days that starts on `start`.
 * The start day counts as the first day if it is a working day. 1.4 days end on the 2nd working day.
 */
export function endDateAfterWorkingDays(start: IsoDate, workDays: number, weekdays: readonly number[]): IsoDate | null {
  if (weekdays.length === 0) return null
  const needed = Math.max(1, Math.ceil(workDays - 1e-9))
  const d = toUtc(start)
  let counted = 0
  // Safety limit: ~50 calendar years.
  for (let guard = 0; guard < 20000; guard++) {
    if (weekdays.includes(isoWeekday(d))) {
      counted++
      if (counted >= needed) return fromUtc(d)
    }
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return null
}

export function isoDateOf(dateTime: string): IsoDate {
  return dateTime.slice(0, 10)
}
