import { isIsoDate } from '../common/calendar'
import { isCurrencyCode } from '../common/money'
import { ok, type DomainError, type Result } from '../common/primitives'
import { has, HEX_COLOR, invalid, isNonNegInt, isValidHoursPerDay, MAX_RATE_CENTS } from '../common/validation'
import { validatePointScale } from '../estimation/pointScale'
import { validateSprintSettings } from '../progress/sprints'
import { MAX_PROJECT_NAME_LENGTH, type MetaPatch, type QuoteInfo } from './Project'

/** Validates and normalizes the general details of the project. */
export function validateMetaPatch(patch: MetaPatch): Result<MetaPatch, DomainError> {
  const out: { -readonly [K in keyof MetaPatch]: MetaPatch[K] } = {}
  if (has(patch, 'name')) {
    const name = String(patch.name).trim()
    if (!name) return invalid('The project name is required', 'PROJECT_NAME_REQUIRED')
    if (name.length > MAX_PROJECT_NAME_LENGTH) return invalid('The name is too long', 'NAME_TOO_LONG')
    out.name = name
  }
  if (has(patch, 'client')) {
    const client = String(patch.client).trim()
    if (client.length > 200) return invalid('The client name is too long', 'CLIENT_TOO_LONG')
    out.client = client
  }
  if (has(patch, 'description')) {
    const description = String(patch.description)
    if (description.length > 20_000) return invalid('The description is too long', 'DESCRIPTION_TOO_LONG')
    out.description = description
  }
  if (has(patch, 'color')) {
    if (!HEX_COLOR.test(String(patch.color))) return invalid('Invalid color', 'INVALID_COLOR')
    out.color = String(patch.color).toLowerCase()
  }
  if (has(patch, 'currency')) {
    const currency = String(patch.currency).trim().toUpperCase()
    if (!isCurrencyCode(currency)) return invalid('Invalid currency (3-letter ISO code)', 'INVALID_CURRENCY')
    out.currency = currency
  }
  if (has(patch, 'defaultRateCents')) {
    const r = patch.defaultRateCents
    if (r !== null && !isNonNegInt(r, MAX_RATE_CENTS)) return invalid('Invalid rate', 'INVALID_RATE')
    out.defaultRateCents = r ?? null
  }
  if (has(patch, 'defaultHoursPerDay')) {
    const h = patch.defaultHoursPerDay
    if (!isValidHoursPerDay(h)) {
      return invalid('Hours per day must be greater than 0 and at most 24', 'INVALID_HOURS_PER_DAY')
    }
    out.defaultHoursPerDay = Math.round(h * 100) / 100
  }
  if (has(patch, 'startDate')) {
    const d = patch.startDate
    if (d !== null && !isIsoDate(d)) return invalid('Invalid start date', 'INVALID_START_DATE')
    out.startDate = d ?? null
  }
  if (has(patch, 'workingWeekdays')) {
    const days = patch.workingWeekdays
    if (!Array.isArray(days) || days.length === 0) return invalid('Choose at least one working day', 'NO_WORKING_DAYS')
    const set = new Set<number>()
    for (const d of days) {
      if (!Number.isInteger(d) || d < 1 || d > 7) return invalid('Invalid working day', 'INVALID_WEEKDAY')
      set.add(d)
    }
    out.workingWeekdays = [...set].sort((a, b) => a - b)
  }
  if (has(patch, 'contingencyBps')) {
    if (!isNonNegInt(patch.contingencyBps, 100_000)) {
      return invalid('Invalid contingency (0–1000%)', 'INVALID_CONTINGENCY')
    }
    out.contingencyBps = patch.contingencyBps!
  }
  if (has(patch, 'taxBps')) {
    if (!isNonNegInt(patch.taxBps, 100_000)) return invalid('Invalid tax (0–1000%)', 'INVALID_TAX')
    out.taxBps = patch.taxBps!
  }
  if (has(patch, 'taxLabel')) {
    const label = String(patch.taxLabel).trim()
    if (label.length > 20) return invalid('The tax name is too long', 'TAX_LABEL_TOO_LONG')
    out.taxLabel = label
  }
  if (has(patch, 'pointScale')) {
    const scale = validatePointScale(patch.pointScale)
    if (!scale.ok) return scale
    out.pointScale = scale.value
  }
  if (has(patch, 'sprints')) {
    const sprints = validateSprintSettings(patch.sprints)
    if (!sprints.ok) return sprints
    out.sprints = sprints.value
  }
  if (has(patch, 'quote')) {
    const q = patch.quote as QuoteInfo
    if (typeof q !== 'object' || q === null) return invalid('Invalid quote details', 'INVALID_QUOTE')
    if (String(q.number ?? '').length > 50) return invalid('The quote number is too long', 'QUOTE_NUMBER_TOO_LONG')
    if (q.date !== null && !isIsoDate(q.date)) return invalid('Invalid quote date', 'INVALID_QUOTE_DATE')
    if (q.validityDays !== null && !isNonNegInt(q.validityDays, 3650)) {
      return invalid('Invalid validity period', 'INVALID_VALIDITY')
    }
    if (String(q.terms ?? '').length > 20_000) return invalid('The terms are too long', 'TERMS_TOO_LONG')
    out.quote = {
      number: String(q.number ?? '').trim(),
      date: q.date,
      validityDays: q.validityDays,
      terms: String(q.terms ?? '')
    }
  }
  if (has(patch, 'archived')) out.archived = Boolean(patch.archived)
  return ok(out)
}
