import type { ErrorParams } from '@domain'

/** Text of an error: fixed, or built from the error parameters. */
export type ErrorText = string | ((params: ErrorParams) => string)

/** A parameter as text ('' when missing), for building error messages. */
export const param = (params: ErrorParams, key: string): string => String(params[key] ?? '')
