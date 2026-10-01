import { describe, expect, it } from 'vitest'
import {
  clampDetailWidth,
  clampWidth,
  columnVars,
  DEFAULT_WIDTHS,
  gridTemplate,
  minTreeWidth,
  TREE_COLUMNS,
  validWidths
} from '@presentation/stores/layout'

describe('tree column widths', () => {
  it('the default grid is the one the tree always had', () => {
    expect(gridTemplate(DEFAULT_WIDTHS)).toBe('76px minmax(300px,1fr) 40px 116px 56px 78px 132px 124px 92px')
    expect(minTreeWidth(DEFAULT_WIDTHS)).toBe(1014)
    expect(columnVars(DEFAULT_WIDTHS)).toEqual({
      '--tree-cols': gridTemplate(DEFAULT_WIDTHS),
      '--tree-min': '1014px',
      '--tree-wbs': '76px'
    })
  })

  it('widths stay within the limits of each column', () => {
    expect(clampWidth('status', 10)).toBe(84)
    expect(clampWidth('status', 10_000)).toBe(240)
    expect(clampWidth('title', 512.4)).toBe(512)
  })

  it('stored widths are checked column by column; anything odd gets the default', () => {
    expect(validWidths(null)).toEqual(DEFAULT_WIDTHS)
    const stored = validWidths({ code: 120, title: 'wide', status: 5, unknown: 300, sumCost: Number.NaN })
    expect(stored).toMatchObject({ code: 120, title: DEFAULT_WIDTHS.title, status: 84, sumCost: DEFAULT_WIDTHS.sumCost })
    expect(Object.keys(stored).sort()).toEqual([...TREE_COLUMNS].sort())
  })

  it('the detail panel is at least 320 px and at most 60% of the window', () => {
    expect(clampDetailWidth(200, 1600)).toBe(320)
    expect(clampDetailWidth(500, 1600)).toBe(500)
    expect(clampDetailWidth(1200, 1600)).toBe(960)
    // In a very narrow window the minimum wins.
    expect(clampDetailWidth(400, 400)).toBe(320)
  })
})
