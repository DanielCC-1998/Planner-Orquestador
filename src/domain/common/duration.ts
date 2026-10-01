import { domainError, err, ok, type DomainError, type Result } from './primitives'

/** Maximum accepted per task: 100,000 hours. */
export const MAX_ESTIMATE_MINUTES = 100_000 * 60

/** Unit words accepted in estimates, in English and Spanish (users may type either). */
const UNIT_MINUTES: Record<string, 'd' | 'h' | 'm'> = {
  d: 'd',
  day: 'd',
  days: 'd',
  h: 'h',
  hr: 'h',
  hrs: 'h',
  hour: 'h',
  hours: 'h',
  m: 'm',
  min: 'm',
  mins: 'm',
  minute: 'm',
  minutes: 'm',
  // i18n:es-start
  dia: 'd',
  dias: 'd',
  día: 'd',
  días: 'd',
  hora: 'h',
  horas: 'h',
  minuto: 'm',
  minutos: 'm'
  // i18n:es-end
}

const formatError = (): Result<never, DomainError> =>
  err(domainError('INVALID', 'Invalid format. Examples: 1.5 · 90m · 1h 30m · 2d', 'DURATION_FORMAT'))

/**
 * Turns free text into minutes.
 * Accepts "1.5" or "1,5" (hours), "90m", "1h 30m", "1h30", "1:30" and "2d" (days of `hoursPerDay` hours).
 * An empty string means "no estimate" (null).
 */
export function parseDuration(input: string, hoursPerDay: number): Result<number | null, DomainError> {
  const text = input.trim().toLowerCase()
  if (text === '') return ok(null)

  const clock = /^(\d+):([0-5]\d)$/.exec(text)
  if (clock) return ok(Number(clock[1]) * 60 + Number(clock[2]))

  const tokenRe = /(\d+(?:[.,]\d+)?)\s*([a-zá-úñ]*)/gy
  let total = 0
  let pos = 0
  let lastUnit: 'd' | 'h' | 'm' | null = null
  let tokens = 0
  while (pos < text.length) {
    while (text[pos] === ' ') pos++
    if (pos >= text.length) break
    tokenRe.lastIndex = pos
    const m = tokenRe.exec(text)
    if (!m || m[0].length === 0) return formatError()
    pos = tokenRe.lastIndex
    const value = Number(m[1]!.replace(',', '.'))
    const rawUnit = m[2] ?? ''
    let unit: 'd' | 'h' | 'm'
    if (rawUnit === '') {
      // "1h30": a bare number after hours means minutes.
      unit = lastUnit === 'h' ? 'm' : lastUnit === 'd' ? 'h' : 'h'
    } else {
      const u = UNIT_MINUTES[rawUnit]
      if (!u) return err(domainError('INVALID', `Unknown unit: "${rawUnit}"`, 'DURATION_UNIT', { unit: rawUnit }))
      unit = u
    }
    const factor = unit === 'd' ? hoursPerDay * 60 : unit === 'h' ? 60 : 1
    total += value * factor
    lastUnit = unit
    tokens++
  }
  if (tokens === 0) return formatError()
  const minutes = Math.round(total)
  if (minutes < 0) {
    return err(domainError('INVALID', 'The duration cannot be negative', 'DURATION_NEGATIVE'))
  }
  if (!Number.isFinite(minutes) || minutes > MAX_ESTIMATE_MINUTES) {
    return err(domainError('INVALID', 'The duration is too large', 'DURATION_TOO_LARGE'))
  }
  return ok(minutes)
}

/** Editable format that `parseDuration` reads back unchanged: "1h 30m", "45m", "3h". */
export function formatDurationInput(minutes: number | null): string {
  if (minutes === null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
