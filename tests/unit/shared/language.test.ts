import { describe, expect, it } from 'vitest'
import { resolveLanguage } from '@shared/i18n/language'

describe('resolveLanguage', () => {
  it('a fixed preference wins over the system', () => {
    expect(resolveLanguage('en', ['es-ES'])).toBe('en')
    expect(resolveLanguage('es', ['en-US'])).toBe('es')
  })

  it("'system' takes the first supported OS language", () => {
    expect(resolveLanguage('system', ['es-ES', 'en-US'])).toBe('es')
    expect(resolveLanguage('system', ['en-GB', 'es-ES'])).toBe('en')
    expect(resolveLanguage('system', ['fr-FR', 'es-MX'])).toBe('es')
    expect(resolveLanguage('system', ['es_ES'])).toBe('es')
  })

  it('Catalan, Galician and Basque speakers get Spanish', () => {
    expect(resolveLanguage('system', ['ca-ES'])).toBe('es')
    expect(resolveLanguage('system', ['gl'])).toBe('es')
    expect(resolveLanguage('system', ['eu-ES'])).toBe('es')
  })

  it('falls back to English', () => {
    expect(resolveLanguage('system', ['fr-FR', 'de-DE'])).toBe('en')
    expect(resolveLanguage('system', [])).toBe('en')
  })
})
