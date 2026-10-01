import { describe, expect, it } from 'vitest'
import { TAG_COLORS } from '@domain'
import { TAG_PALETTE } from '@shared/tagPalette'

/** WCAG relative luminance of a '#rrggbb' color. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe('tag palette', () => {
  it('every tag color has a fill and a text color', () => {
    expect(Object.keys(TAG_PALETTE).sort()).toEqual([...TAG_COLORS].sort())
  })

  it.each(TAG_COLORS)('the text of a %s chip is readable (contrast ≥ 4.5:1)', (color) => {
    const { bg, fg } = TAG_PALETTE[color]
    expect(contrast(bg, fg)).toBeGreaterThanOrEqual(4.5)
  })
})
