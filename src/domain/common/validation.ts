import { domainError, err, type DomainError, type DomainErrorReason, type ErrorParams, type Result } from './primitives'

/** Helpers shared by the task, member and project validations. */

export const invalid = (message: string, reason?: DomainErrorReason, params?: ErrorParams): Result<never, DomainError> =>
  err(domainError('INVALID', message, reason, params))

export const HEX_COLOR = /^#[0-9a-f]{6}$/i

export const MAX_RATE_CENTS = 1_000_000_000

export function isNonNegInt(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max
}

/** Does the patch carry that field (even as null)? `undefined` counts as absent. */
export function has<K extends string>(obj: object, key: K): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key) && (obj as Record<string, unknown>)[key] !== undefined
}

export function isValidHoursPerDay(h: unknown): h is number {
  return typeof h === 'number' && Number.isFinite(h) && h > 0 && h <= 24
}
