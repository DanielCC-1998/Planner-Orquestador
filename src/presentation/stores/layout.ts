import { create } from 'zustand'
import { readJson, writeJson } from '../lib/storage'

/**
 * Sizes the user sets by dragging: the columns of the tree and the width of the detail panel.
 * They are view preferences of this computer (localStorage), the same for every project.
 */

export const TREE_COLUMNS = ['code', 'title', 'assignee', 'status', 'sp', 'estimate', 'sumHours', 'sumCost', 'progress'] as const
export type TreeColumn = (typeof TREE_COLUMNS)[number]

export type ColumnWidths = Readonly<Record<TreeColumn, number>>

/** Width limits in px. The task column takes the free space: its width is a minimum. */
export const COLUMN_LIMITS: Readonly<Record<TreeColumn, { readonly min: number; readonly max: number; readonly initial: number }>> = {
  code: { min: 48, max: 240, initial: 76 },
  title: { min: 160, max: 1600, initial: 300 },
  assignee: { min: 36, max: 120, initial: 40 },
  status: { min: 84, max: 240, initial: 116 },
  sp: { min: 40, max: 160, initial: 56 },
  estimate: { min: 56, max: 200, initial: 78 },
  sumHours: { min: 72, max: 260, initial: 132 },
  sumCost: { min: 72, max: 260, initial: 124 },
  progress: { min: 60, max: 260, initial: 92 }
}

export const DEFAULT_WIDTHS = Object.fromEntries(TREE_COLUMNS.map((c) => [c, COLUMN_LIMITS[c].initial])) as ColumnWidths

/** Height of the tree header, pinned at the top of the scroll area. */
export const HEADER_HEIGHT = 32

export function clampWidth(column: TreeColumn, width: number): number {
  const { min, max } = COLUMN_LIMITS[column]
  return Math.round(Math.min(max, Math.max(min, width)))
}

/** Widths read from storage: known columns with numbers, clamped; anything else gets its default. */
export function validWidths(raw: unknown): ColumnWidths {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const out = {} as Record<TreeColumn, number>
  for (const column of TREE_COLUMNS) {
    const value = stored[column]
    out[column] = typeof value === 'number' && Number.isFinite(value) ? clampWidth(column, value) : DEFAULT_WIDTHS[column]
  }
  return out
}

/** `grid-template-columns` of the header and of every row. */
export function gridTemplate(w: ColumnWidths): string {
  return TREE_COLUMNS.map((c) => (c === 'title' ? `minmax(${w.title}px,1fr)` : `${w[c]}px`)).join(' ')
}

/** Width below which the tree scrolls sideways. */
export function minTreeWidth(w: ColumnWidths): number {
  return TREE_COLUMNS.reduce((sum, c) => sum + w[c], 0)
}

/** CSS variables of the tree root: the grid, its minimum width and the width of the WBS column. */
export function columnVars(w: ColumnWidths): Record<string, string> {
  return { '--tree-cols': gridTemplate(w), '--tree-min': `${minTreeWidth(w)}px`, '--tree-wbs': `${w.code}px` }
}

export const DETAIL_WIDTH = { min: 320, initial: 400, maxShare: 0.6 } as const

/** Detail panel width: at least 320 px and at most 60% of the window. */
export function clampDetailWidth(width: number, windowWidth: number): number {
  const max = Math.max(DETAIL_WIDTH.min, Math.floor(windowWidth * DETAIL_WIDTH.maxShare))
  return Math.round(Math.min(max, Math.max(DETAIL_WIDTH.min, width)))
}

const COLUMNS_KEY = 'planner:treeColumns'
const DETAIL_KEY = 'planner:detailWidth'

interface LayoutStore {
  columns: ColumnWidths
  detailWidth: number
  setColumn(column: TreeColumn, width: number): void
  resetColumn(column: TreeColumn): void
  setDetailWidth(width: number): void
}

export const useLayout = create<LayoutStore>((set, get) => ({
  columns: validWidths(readJson<unknown>(COLUMNS_KEY, null)),
  detailWidth: (() => {
    const stored = readJson<unknown>(DETAIL_KEY, null)
    return typeof stored === 'number' && Number.isFinite(stored) ? Math.max(DETAIL_WIDTH.min, Math.round(stored)) : DETAIL_WIDTH.initial
  })(),

  setColumn(column, width) {
    const columns = { ...get().columns, [column]: clampWidth(column, width) }
    set({ columns })
    writeJson(COLUMNS_KEY, columns)
  },

  resetColumn(column) {
    get().setColumn(column, COLUMN_LIMITS[column].initial)
  },

  setDetailWidth(width) {
    const detailWidth = Math.max(DETAIL_WIDTH.min, Math.round(width))
    set({ detailWidth })
    writeJson(DETAIL_KEY, detailWidth)
  }
}))
