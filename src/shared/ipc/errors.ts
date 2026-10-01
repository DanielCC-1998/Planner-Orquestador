/**
 * Machine-readable reasons for infrastructure errors (IPC, files, JSON format, PDF).
 * The UI translates them; the English `message` of each error is only a fallback.
 */
export const INFRA_ERROR_REASONS = [
  'FORBIDDEN_ORIGIN',
  'FORBIDDEN_CHANNEL',
  'INVALID_INPUT',
  'INTERNAL',
  'FILE_TOO_BIG',
  'IMAGE_FORMAT',
  'LOGO_TOO_BIG',
  'NOT_JSON',
  'NOT_PLANNER_FILE',
  'BAD_FORMAT_VERSION',
  'NO_MIGRATION',
  'INVALID_PROJECT_DATA',
  'NEWER_SCHEMA',
  'PROJECT_FILE_NOT_FOUND',
  'READ_FAILED',
  'QUARANTINED'
] as const

export type InfraErrorReason = (typeof INFRA_ERROR_REASONS)[number]
