/** Default colors for new projects and people (assigned in order). */
export const PALETTE = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#84cc16',
  '#06b6d4',
  '#a855f7'
] as const

export function paletteColor(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]!
}
