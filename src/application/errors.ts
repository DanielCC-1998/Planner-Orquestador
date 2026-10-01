import { err, type ErrorParams, type Result } from '@domain'

/** Machine-readable reasons for application errors; the UI translates them. */
export const APP_ERROR_REASONS = [
  'PROJECT_NOT_FOUND',
  'READ_ONLY',
  'READ_ONLY_NEWER',
  'NOTHING_TO_UNDO',
  'NOTHING_TO_REDO'
] as const

export type AppErrorReason = (typeof APP_ERROR_REASONS)[number]

/**
 * Error returned by the use cases. Domain and repository errors pass through unchanged,
 * so `reason` may come from any layer (domain, application or infrastructure).
 */
export interface AppError {
  readonly code: string
  /** English text for logs and as a fallback when the UI has no translation. */
  readonly message: string
  readonly reason?: string | undefined
  readonly params?: ErrorParams | undefined
}

export const appError = (code: string, message: string, reason?: string, params?: ErrorParams): AppError => ({
  code,
  message,
  ...(reason ? { reason } : {}),
  ...(params ? { params } : {})
})

export const fail = (code: string, message: string, reason?: string, params?: ErrorParams): Result<never, AppError> =>
  err(appError(code, message, reason, params))
