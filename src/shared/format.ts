import type { Language } from '@domain'
import { LOCALE_OF } from './i18n/language'

/**
 * Formatting and parsing of numbers, money, hours and dates for one language.
 * English uses en-US ("€7,327.16", "Sep 30, 2026"); Spanish uses es-ES ("7.327,16 €", "30 sept 2026").
 * Editable values never carry thousands separators, so what is shown in an input reads back unchanged.
 */
export interface Formatter {
  readonly language: Language
  readonly locale: string
  money(cents: number, currency: string, decimals?: boolean): string
  /** Currency symbol ("€", "$", "US$"…). */
  currencySymbol(currency: string): string
  number(value: number, maxDecimals?: number, minDecimals?: number): string
  /** Minutes → "1.5 h" / "1,5 h". */
  hours(minutes: number, withUnit?: boolean): string
  days(days: number): string
  weeks(weeks: number): string
  storyPoints(sp: number): string
  percent(fraction: number, decimals?: number): string
  /** Basis points → "21%" / "21 %". */
  bps(bps: number): string
  /** "Sep 30, 2026" / "30 sept 2026". */
  date(iso: string): string
  /** "September 30, 2026" / "30 de septiembre de 2026". */
  dateLong(iso: string): string
  /** How long ago: "5 min. ago", "yesterday"… (project cards). */
  relative(iso: string, now?: Date): string
  /** Locale-aware, case-insensitive comparison for sorting names. */
  compare(a: string, b: string): number
  /** Number → editable text without grouping: 1234.5 → "1234.5" / "1234,5". null → ''. */
  decimalToInput(value: number | null, maxDecimals?: number): string
  /** Editable text → number. Empty = null. */
  parseDecimalInput(text: string): number | null | 'invalid'
  /** Cents → editable text: 150050 → "1500.5" / "1500,5". */
  centsToInput(cents: number | null): string
  /** Editable text → cents. Accepts a currency symbol and thousands separators. Empty = null. */
  parseMoneyInput(text: string): number | null | 'invalid'
  /** Basis points → editable percentage: 2150 → "21.5" / "21,5". */
  bpsToInput(bps: number): string
  /** Editable percentage ("21", "21.5 %") → basis points. Empty = 0. */
  parsePercentInput(text: string): number | 'invalid'
}

/** Text that does not come from Intl: the only words the formatter writes itself. */
const JUST_NOW: Readonly<Record<Language, string>> = {
  en: 'just now',
  // i18n:es-start
  es: 'ahora mismo'
  // i18n:es-end
}

/**
 * Normalizes a typed decimal number to "1234.56" form, or null if it is not a number.
 * With both separators, the last one is the decimal separator. With only one kind, the
 * language decides whether it groups thousands ("1,500" in English, "1.500" in Spanish)
 * or marks decimals ("1,5" or "1.5" otherwise).
 */
function normalizeDecimal(text: string, language: Language): string | null {
  let t = text
  const lastComma = t.lastIndexOf(',')
  const lastDot = t.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else if (lastComma >= 0) {
    t = language === 'en' && /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.')
  } else if (lastDot >= 0) {
    if (language === 'es' && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  }
  return /^\d+(\.\d+)?$/.test(t) ? t : null
}

function toDate(iso: string): Date {
  return iso.length === 10 ? new Date(`${iso}T00:00:00Z`) : new Date(iso)
}

function buildFormatter(language: Language): Formatter {
  const locale = LOCALE_OF[language]
  const numberFormats = new Map<string, Intl.NumberFormat>()
  const nf = (key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => {
    let f = numberFormats.get(key)
    if (!f) {
      // 'always': es-ES would otherwise write "1234,56 €" without a thousands separator.
      f = new Intl.NumberFormat(locale, { useGrouping: 'always', ...options })
      numberFormats.set(key, f)
    }
    return f
  }
  const dateFormats = new Map<string, Intl.DateTimeFormat>()
  const df = (key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
    let f = dateFormats.get(key)
    if (!f) {
      f = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options })
      dateFormats.set(key, f)
    }
    return f
  }
  // Short style for minutes and hours ("5 min. ago"); long style for days ("3 days ago").
  const relativeShort = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  const relativeLong = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'long' })
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const inputFormats = new Map<number, Intl.NumberFormat>()
  const plain = (maxDecimals: number): Intl.NumberFormat => {
    let f = inputFormats.get(maxDecimals)
    if (!f) {
      f = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: maxDecimals })
      inputFormats.set(maxDecimals, f)
    }
    return f
  }

  const formatter: Formatter = {
    language,
    locale,
    money(cents, currency, decimals = true) {
      const digits = decimals ? 2 : 0
      try {
        return nf(`money:${currency}:${digits}`, {
          style: 'currency',
          currency,
          minimumFractionDigits: digits,
          maximumFractionDigits: digits
        }).format(cents / 100)
      } catch {
        return `${formatter.number(cents / 100, digits)} ${currency}`
      }
    },
    currencySymbol(currency) {
      try {
        const parts = nf(`sym:${currency}`, { style: 'currency', currency }).formatToParts(0)
        return parts.find((p) => p.type === 'currency')?.value ?? currency
      } catch {
        return currency
      }
    },
    number(value, maxDecimals = 2, minDecimals = 0) {
      return nf(`num:${minDecimals}:${maxDecimals}`, {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals
      }).format(value)
    },
    hours(minutes, withUnit = true) {
      const text = formatter.number(minutes / 60, 2)
      return withUnit ? `${text} h` : text
    },
    days(days) {
      return nf('days', { style: 'unit', unit: 'day', unitDisplay: 'long', maximumFractionDigits: 1 }).format(days)
    },
    weeks(weeks) {
      return nf('weeks', { style: 'unit', unit: 'week', unitDisplay: 'long', maximumFractionDigits: 1 }).format(weeks)
    },
    storyPoints(sp) {
      return formatter.number(sp, 2)
    },
    percent(fraction, decimals = 0) {
      return nf(`pct:${decimals}`, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      }).format(fraction)
    },
    bps(bps) {
      return formatter.percent(bps / 10000, 2)
    },
    date(iso) {
      return df('short', { day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(iso))
    },
    dateLong(iso) {
      return df('long', { day: 'numeric', month: 'long', year: 'numeric' }).format(toDate(iso))
    },
    relative(iso, now = new Date()) {
      const seconds = (now.getTime() - new Date(iso).getTime()) / 1000
      if (seconds < 60) return JUST_NOW[language]
      if (seconds < 3600) return relativeShort.format(-Math.floor(seconds / 60), 'minute')
      if (seconds < 86400) return relativeShort.format(-Math.floor(seconds / 3600), 'hour')
      if (seconds < 604800) return relativeLong.format(-Math.floor(seconds / 86400), 'day')
      return formatter.date(iso)
    },
    compare(a, b) {
      return collator.compare(a, b)
    },
    decimalToInput(value, maxDecimals = 2) {
      return value === null ? '' : plain(maxDecimals).format(value)
    },
    parseDecimalInput(text) {
      const t = text.trim().replace(/\s/g, '')
      if (t === '') return null
      const normalized = normalizeDecimal(t, language)
      if (normalized === null) return 'invalid'
      const value = Number(normalized)
      return Number.isFinite(value) ? value : 'invalid'
    },
    centsToInput(cents) {
      return cents === null ? '' : formatter.decimalToInput(cents / 100, 2)
    },
    parseMoneyInput(text) {
      const value = formatter.parseDecimalInput(text.replace(/[€$£]/g, ''))
      if (value === null || value === 'invalid') return value
      return value < 0 ? 'invalid' : Math.round(value * 100)
    },
    bpsToInput(bps) {
      return formatter.decimalToInput(bps / 100, 2)
    },
    parsePercentInput(text) {
      const value = formatter.parseDecimalInput(text.replace('%', ''))
      if (value === null) return 0
      if (value === 'invalid' || value < 0) return 'invalid'
      return Math.round(value * 100)
    }
  }
  return formatter
}

const formatters = new Map<Language, Formatter>()

/** Formatter for a language. There is one instance per language, so it is safe in React deps. */
export function createFormatter(language: Language): Formatter {
  let f = formatters.get(language)
  if (!f) {
    f = buildFormatter(language)
    formatters.set(language, f)
  }
  return f
}
