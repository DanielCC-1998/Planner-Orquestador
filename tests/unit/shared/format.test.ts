import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createFormatter } from '@shared/format'

const en = createFormatter('en')
const es = createFormatter('es')
/** Intl separates "€" and "%" with a non-breaking space in Spanish; compare with plain spaces. */
const plain = (s: string) => s.replace(/\s/g, ' ')

describe('createFormatter', () => {
  it('formats money, numbers and percentages per language', () => {
    expect(en.money(732716, 'EUR')).toBe('€7,327.16')
    expect(plain(es.money(732716, 'EUR'))).toBe('7.327,16 €')
    expect(en.money(247500, 'USD')).toBe('$2,475.00')
    expect(en.hours(7458)).toBe('124.3 h')
    expect(es.hours(7458)).toBe('124,3 h')
    expect(en.bps(2100)).toBe('21%')
    expect(plain(es.bps(2100))).toBe('21 %')
    expect(es.number(1234, 0)).toBe('1.234')
  })

  it('formats days, weeks and dates per language', () => {
    expect(en.days(7.2)).toBe('7.2 days')
    expect(en.days(1)).toBe('1 day')
    expect(en.date('2026-09-30')).toBe('Sep 30, 2026')
    expect(en.dateLong('2026-09-30')).toBe('September 30, 2026')
    // i18n:es-start
    expect(es.days(7.2)).toBe('7,2 días')
    expect(es.weeks(1.44)).toBe('1,4 semanas')
    expect(es.date('2026-09-30')).toBe('30 sept 2026')
    expect(es.dateLong('2026-09-30')).toBe('30 de septiembre de 2026')
    // i18n:es-end
  })

  it('writes relative times in each language', () => {
    const now = new Date('2026-09-30T12:00:00Z')
    expect(en.relative('2026-09-30T11:59:30Z', now)).toBe('just now')
    expect(en.relative('2026-09-30T11:55:00Z', now)).toBe('5 min. ago')
    expect(en.relative('2026-09-29T12:00:00Z', now)).toBe('yesterday')
    expect(en.relative('2026-09-01T12:00:00Z', now)).toBe('Sep 1, 2026')
    // i18n:es-start
    expect(es.relative('2026-09-30T11:59:30Z', now)).toBe('ahora mismo')
    expect(es.relative('2026-09-30T11:55:00Z', now)).toBe('hace 5 min')
    expect(es.relative('2026-09-27T12:00:00Z', now)).toBe('hace 3 días')
    // i18n:es-end
  })

  it('reads typed amounts with the conventions of each language', () => {
    expect(en.parseMoneyInput('1,500')).toBe(150000)
    expect(en.parseMoneyInput('1,234.56')).toBe(123456)
    expect(en.parseMoneyInput('50,5')).toBe(5050)
    expect(en.parseMoneyInput('1.5')).toBe(150)
    expect(en.parseMoneyInput('€ 45')).toBe(4500)
    expect(es.parseMoneyInput('1.500')).toBe(150000)
    expect(es.parseMoneyInput('1,5')).toBe(150)
    expect(es.parseMoneyInput('1.234,56 €')).toBe(123456)
    expect(es.parseMoneyInput('50.5')).toBe(5050)
    expect(en.parseMoneyInput('')).toBeNull()
    expect(en.parseMoneyInput('abc')).toBe('invalid')
    expect(es.parseMoneyInput('-5')).toBe('invalid')
  })

  it('reads percentages and plain decimals', () => {
    expect(en.parsePercentInput('21.5%')).toBe(2150)
    expect(es.parsePercentInput('21,5 %')).toBe(2150)
    expect(en.parsePercentInput('')).toBe(0)
    expect(en.parsePercentInput('x')).toBe('invalid')
    expect(en.parseDecimalInput('7.5')).toBe(7.5)
    expect(es.parseDecimalInput('7,5')).toBe(7.5)
    expect(en.parseDecimalInput(' ')).toBeNull()
  })

  it('editable values never carry thousands separators', () => {
    expect(en.decimalToInput(1000)).toBe('1000')
    expect(es.decimalToInput(1000)).toBe('1000')
    expect(es.decimalToInput(2.5)).toBe('2,5')
    expect(en.centsToInput(150050)).toBe('1500.5')
    expect(es.centsToInput(150050)).toBe('1500,5')
    expect(en.bpsToInput(2150)).toBe('21.5')
    expect(en.centsToInput(null)).toBe('')
  })

  it('what an input shows reads back unchanged', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000 }), (cents) => {
        expect(en.parseMoneyInput(en.centsToInput(cents))).toBe(cents)
        expect(es.parseMoneyInput(es.centsToInput(cents))).toBe(cents)
      })
    )
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (hundredths) => {
        const value = hundredths / 100
        expect(en.parseDecimalInput(en.decimalToInput(value))).toBe(value)
        expect(es.parseDecimalInput(es.decimalToInput(value))).toBe(value)
      })
    )
  })

  it('returns one shared instance per language', () => {
    expect(createFormatter('en')).toBe(en)
    expect(en.compare('apple', 'Banana')).toBeLessThan(0)
  })
})
