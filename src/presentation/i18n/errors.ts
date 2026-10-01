import type { ErrorParams } from '@domain'
import { getI18n, type Messages } from './index'
import type { ErrorText } from './types'

/** Any error coming from main: the domain, the use cases or the infrastructure. */
export interface LocalizableError {
  readonly code: string
  readonly message: string
  readonly reason?: string | undefined
  readonly params?: ErrorParams | undefined
}

const lookup = (table: object, key: string): ErrorText | undefined =>
  (table as Readonly<Record<string, ErrorText | undefined>>)[key]

/** Error text in the current language: by reason, then by code, then the English message. */
export function errorText(t: Messages, error: LocalizableError): string {
  const { domain, app, infra, codes } = t.errors
  const text =
    (error.reason ? (lookup(domain, error.reason) ?? lookup(app, error.reason) ?? lookup(infra, error.reason)) : undefined) ??
    lookup(codes, error.code)
  if (text === undefined) return error.message
  return typeof text === 'function' ? text(error.params ?? {}) : text
}

function isLocalizable(e: unknown): e is LocalizableError {
  return typeof e === 'object' && e !== null && typeof (e as LocalizableError).code === 'string'
}

/** Text for anything caught in a `catch`: localized if it is an error from main. */
export function describeError(e: unknown): string {
  if (isLocalizable(e)) return errorText(getI18n().t, e)
  if (e instanceof Error) return e.message
  return String(e)
}
