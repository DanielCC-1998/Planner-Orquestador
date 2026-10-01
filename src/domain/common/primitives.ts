/**
 * Base domain types. Ids are UUID strings; quantities are integers:
 * minutes for time, cents for money and basis points (10000 = 100%) for percentages.
 */
export type ProjectId = string
export type TaskId = string
export type MemberId = string
/** Id of a tag of the project (UUIDs; tags converted from older files keep short ids such as "tag-1"). */
export type TagId = string

/** Calendar date 'YYYY-MM-DD'. */
export type IsoDate = string
/** Full ISO 8601 timestamp. */
export type IsoDateTime = string

export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

/** Values interpolated into a localized error text (e.g. `{ max: 300 }`). */
export type ErrorParams = Readonly<Record<string, string | number>>

/**
 * Machine-readable reasons for domain errors. The UI translates them; `message` is only an
 * English fallback for logs and tests. Graph errors whose `code` says it all (SELF, DUPLICATE,
 * SHARED_TO_ROOT, EXISTS) carry no reason and are translated by their `code` instead.
 */
export const DOMAIN_ERROR_REASONS = [
  'TITLE_TOO_LONG',
  'DESCRIPTION_TOO_LONG',
  'INVALID_STATUS',
  'INVALID_PRIORITY',
  'INVALID_STORY_POINTS',
  'INVALID_ESTIMATE',
  'UNKNOWN_ASSIGNEE',
  'INVALID_RATE',
  'INVALID_TAGS',
  'TAG_TOO_LONG',
  'TOO_MANY_TAGS',
  'TAG_EXISTS',
  'UNKNOWN_TAG',
  'TOO_MANY_PROJECT_TAGS',
  'NAME_REQUIRED',
  'NAME_TOO_LONG',
  'ROLE_TOO_LONG',
  'INVALID_INITIALS',
  'INVALID_COLOR',
  'INVALID_HOURS_PER_DAY',
  'PROJECT_NAME_REQUIRED',
  'CLIENT_TOO_LONG',
  'INVALID_CURRENCY',
  'INVALID_CONTINGENCY',
  'INVALID_TAX',
  'TAX_LABEL_TOO_LONG',
  'INVALID_START_DATE',
  'INVALID_WEEKDAY',
  'NO_WORKING_DAYS',
  'INVALID_QUOTE',
  'QUOTE_NUMBER_TOO_LONG',
  'INVALID_QUOTE_DATE',
  'INVALID_VALIDITY',
  'TERMS_TOO_LONG',
  'INVALID_REASSIGN',
  'TASK_NOT_FOUND',
  'SOME_TASK_NOT_FOUND',
  'MEMBER_NOT_FOUND',
  'DUPLICATE_TASK_ID',
  'DUPLICATE_MEMBER_ID',
  'DURATION_FORMAT',
  'DURATION_UNIT',
  'DURATION_NEGATIVE',
  'DURATION_TOO_LARGE',
  'INVALID_POINT_SCALE',
  'INVALID_SPRINTS',
  'CYCLE_MOVE',
  'CYCLE_LINK',
  'UNKNOWN_TASK',
  'UNKNOWN_PARENT',
  'UNKNOWN_TARGET',
  'NOT_A_CHILD',
  'NOT_AT_POSITION',
  'GRAPH_CORRUPT'
] as const

export type DomainErrorReason = (typeof DOMAIN_ERROR_REASONS)[number]

export interface DomainError {
  readonly code: string
  /** English text for logs and as a fallback when the UI has no translation. */
  readonly message: string
  readonly reason?: DomainErrorReason | undefined
  readonly params?: ErrorParams | undefined
}

export const domainError = (
  code: string,
  message: string,
  reason?: DomainErrorReason,
  params?: ErrorParams
): DomainError => ({ code, message, ...(reason ? { reason } : {}), ...(params ? { params } : {}) })

export const MAX_SAFE = Number.MAX_SAFE_INTEGER

/** Addition that saturates at MAX_SAFE_INTEGER instead of losing precision. */
export function saturatingAdd(a: number, b: number): number {
  const s = a + b
  return s > MAX_SAFE ? MAX_SAFE : s
}

export function saturatingMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  const p = a * b
  return p > MAX_SAFE ? MAX_SAFE : p
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Cuts `text` to at most `max` characters (used when a suffix such as " (copy)" is appended). */
export function clampText(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text
}
