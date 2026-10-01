import { paletteColor } from '../common/palette'
import { ok, type DomainError, type Result } from '../common/primitives'
import { has, HEX_COLOR, invalid, isNonNegInt, isValidHoursPerDay, MAX_RATE_CENTS } from '../common/validation'
import { initialsFrom, type MemberFields, type MemberInput, type MemberPatch } from './Member'

/** Validates and normalizes the fields of a person. */
export function validateMemberPatch(patch: MemberPatch): Result<MemberPatch, DomainError> {
  const out: { -readonly [K in keyof MemberPatch]: MemberPatch[K] } = {}
  if (has(patch, 'name')) {
    const name = String(patch.name).trim()
    if (!name) return invalid('The name is required', 'NAME_REQUIRED')
    if (name.length > 100) return invalid('The name is too long', 'NAME_TOO_LONG')
    out.name = name
  }
  if (has(patch, 'role')) {
    const role = String(patch.role).trim()
    if (role.length > 100) return invalid('The role is too long', 'ROLE_TOO_LONG')
    out.role = role
  }
  if (has(patch, 'initials')) {
    const initials = String(patch.initials).trim().toUpperCase()
    if (!initials || initials.length > 3) {
      return invalid('Initials must have between 1 and 3 characters', 'INVALID_INITIALS')
    }
    out.initials = initials
  }
  if (has(patch, 'color')) {
    if (!HEX_COLOR.test(String(patch.color))) return invalid('Invalid color', 'INVALID_COLOR')
    out.color = String(patch.color).toLowerCase()
  }
  if (has(patch, 'rateCents')) {
    const r = patch.rateCents
    if (r !== null && !isNonNegInt(r, MAX_RATE_CENTS)) return invalid('Invalid rate', 'INVALID_RATE')
    out.rateCents = r ?? null
  }
  if (has(patch, 'hoursPerDay')) {
    const h = patch.hoursPerDay
    if (!isValidHoursPerDay(h)) {
      return invalid('Hours per day must be greater than 0 and at most 24', 'INVALID_HOURS_PER_DAY')
    }
    out.hoursPerDay = Math.round(h * 100) / 100
  }
  return ok(out)
}

/** Fills in the details of a new person with default values (initials, color from `index`, 8 h/day). */
export function memberFieldsFrom(input: MemberInput, index: number): Result<MemberFields, DomainError> {
  const v = validateMemberPatch(input)
  if (!v.ok) return v
  const name = v.value.name
  if (!name) return invalid('The name is required', 'NAME_REQUIRED')
  return ok({
    name,
    role: v.value.role ?? '',
    initials: v.value.initials ?? initialsFrom(name),
    color: v.value.color ?? paletteColor(index),
    rateCents: v.value.rateCents ?? null,
    hoursPerDay: v.value.hoursPerDay ?? 8
  })
}
