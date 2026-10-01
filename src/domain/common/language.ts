/**
 * Languages the app is translated into. It lives in the domain so every layer can use the
 * type (settings, report options, UI); the texts themselves live in the outer layers.
 */
export const LANGUAGES = ['en', 'es'] as const

export type Language = (typeof LANGUAGES)[number]

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}
