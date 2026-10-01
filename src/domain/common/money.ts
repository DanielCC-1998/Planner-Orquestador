/** Cost in cents of `minutes` of work at `rateCentsPerHour`. Rounded per task. */
export function costOf(minutes: number, rateCentsPerHour: number): number {
  return Math.round((minutes * rateCentsPerHour) / 60)
}

/** Applies a percentage expressed in basis points (10000 = 100%). */
export function applyBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10000)
}

export interface MoneyBreakdown {
  readonly subtotalCents: number
  readonly contingencyCents: number
  readonly baseCents: number
  readonly taxCents: number
  readonly totalCents: number
}

/** subtotal + contingency = base; base + tax = total. */
export function moneyBreakdown(subtotalCents: number, contingencyBps: number, taxBps: number): MoneyBreakdown {
  const contingencyCents = applyBps(subtotalCents, contingencyBps)
  const baseCents = subtotalCents + contingencyCents
  const taxCents = applyBps(baseCents, taxBps)
  return { subtotalCents, contingencyCents, baseCents, taxCents, totalCents: baseCents + taxCents }
}

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'MXN', 'COP', 'ARS', 'CLP', 'PEN', 'CHF'] as const

export function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value)
}
