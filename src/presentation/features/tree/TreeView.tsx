import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { HelpCircle, ListTree, Plus } from 'lucide-react'
import { branchTaskIds, codeDepth, effectiveEstimate, sumMetrics, ZERO_METRICS, type Estimation } from '@domain'
import { Button } from '../../components/ui/button'
import { EmptyState, Kbd, Tooltip } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/cn'
import { isMod } from '../../lib/keys'
import { clampWidth, columnVars, HEADER_HEIGHT, useLayout, type TreeColumn } from '../../stores/layout'
import { useProject } from '../../stores/project'
import { useUi } from '../../stores/ui'
import * as actions from './actions'
import { BulkBar } from './BulkBar'
import { computeMatches } from './filter'
import { canonicalKey, flatten, type TreeRow } from './flatten'
import { ROW_HEIGHT, ROW_WITH_DESCRIPTION_HEIGHT, TREE_GRID_STYLE, TreeRowView } from './TreeRowView'

function HeaderCell({ children, tip, className }: { children: React.ReactNode; tip?: string | undefined; className?: string | undefined }) {
  const content = (
    <div className={cn('flex h-full w-full min-w-0 items-center gap-1 px-2', className)}>
      <span className="truncate">{children}</span>
      {tip ? <HelpCircle className="size-3 shrink-0 opacity-60" /> : null}
    </div>
  )
  return tip ? <Tooltip content={tip}>{content}</Tooltip> : content
}

/**
 * Grip on the right edge of a column header. While dragging, only the CSS variables of the tree
 * change (once per frame); the width is saved when the pointer is released. Double click: default width.
 */
function ColumnResizer({
  column,
  label,
  last,
  rootRef,
  onResized
}: {
  column: TreeColumn
  label: string
  /** The grip of the last column stays inside it, or it would make the tree scroll sideways. */
  last: boolean
  rootRef: RefObject<HTMLDivElement | null>
  onResized: () => void
}) {
  const start = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget
    const fromX = e.clientX
    // The task column may be wider than its minimum (it takes the free space): start from what is seen.
    const fromWidth = handle.parentElement!.getBoundingClientRect().width
    let width = clampWidth(column, fromWidth)
    let frame = 0
    const paint = () => {
      frame = 0
      const root = rootRef.current
      if (!root) return
      for (const [name, value] of Object.entries(columnVars({ ...useLayout.getState().columns, [column]: width }))) {
        root.style.setProperty(name, value)
      }
    }
    const move = (ev: PointerEvent) => {
      width = clampWidth(column, fromWidth + ev.clientX - fromX)
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      if (frame) cancelAnimationFrame(frame)
      // Paint the final width now: if it equals the stored one, React would not touch the style
      // and the column would keep the width of the last frame.
      paint()
      useLayout.getState().setColumn(column, width)
      onResized()
    }
    handle.setPointerCapture(e.pointerId)
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      data-resize={column}
      onPointerDown={start}
      onDoubleClick={(e) => {
        e.stopPropagation()
        useLayout.getState().resetColumn(column)
        onResized()
      }}
      className={cn(
        'absolute top-0 z-10 h-full w-2 cursor-col-resize touch-none after:absolute after:inset-y-1.5 after:w-0.5 after:rounded-full after:bg-border hover:after:bg-primary',
        last ? 'right-0 after:right-0' : '-right-1 after:left-[3px]'
      )}
    />
  )
}

/** Pinned header with the ancestors of the first visible row (like the sticky scroll of VS Code). */
function StickyAncestors({ rows, firstIndex, onJump }: { rows: readonly TreeRow[]; firstIndex: number; onJump: (i: number) => void }) {
  const { t } = useI18n()
  const state = useProject((s) => s.state)
  const first = rows[firstIndex]
  if (!first || !state || first.parentRow < 0) return null
  const chain: number[] = []
  let i = first.parentRow
  while (i >= 0) {
    chain.unshift(i)
    i = rows[i]!.parentRow
  }
  // Only the ancestors that are no longer visible (all of them are above the first row).
  const shown = chain.slice(-3)
  const hidden = chain.length - shown.length
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: HEADER_HEIGHT }}>
      <div className="pointer-events-auto border-b bg-card shadow-md">
        {hidden > 0 ? (
          <div className="px-3 py-0.5 text-[11px] text-muted-foreground">{t.tree.levelsAbove(hidden)}</div>
        ) : null}
        {shown.map((index) => {
          const r = rows[index]!
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onJump(index)}
              className="flex h-7 w-full items-center gap-2 px-3 text-left text-xs hover:bg-row-hover"
              style={{ paddingLeft: 12 + Math.min(r.depth, 8) * 12 }}
            >
              <span className="tabular-nums text-muted-foreground">{r.code}</span>
              <span className="truncate font-medium">{state.tasks.get(r.id)?.title || t.common.untitled}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TreeView() {
  const { t } = useI18n()
  const state = useProject((s) => s.state)!
  const est = useProject((s) => s.estimation)!
  const readOnly = useProject((s) => s.readOnly)
  const focusId = useUi((s) => s.focusId)
  const expanded = useUi((s) => s.expanded)
  const peeks = useUi((s) => s.peeks)
  const filters = useUi((s) => s.filters)
  const selectedKey = useUi((s) => s.selectedKey)
  const multi = useUi((s) => s.multi)
  const hoveredId = useUi((s) => s.hoveredId)
  const editing = useUi((s) => s.editing)
  const scrollToKey = useUi((s) => s.scrollToKey)
  const showDescriptions = useUi((s) => s.showDescriptions)
  const tags = useProject((s) => s.tags)
  const columns = useLayout((s) => s.columns)
  const rootRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => computeMatches(state, est, filters), [state, est, filters])
  const rows = useMemo(
    () => flatten({ graph: state.graph, codes: est.codes, focusId, expanded, peeks, matches }),
    [state.graph, est.codes, focusId, expanded, peeks, matches]
  )
  const rowsRef = useRef<readonly TreeRow[]>(rows)
  rowsRef.current = rows

  const scrollRef = useRef<HTMLDivElement>(null)
  /** The element with role "tree": it takes the keyboard focus. */
  const treeRef = useRef<HTMLDivElement>(null)
  // Variable heights: rows with a visible description or a long (wrapped) title are taller and are
  // measured when painted. The key is the row path, so measurements do not get mixed up when rows
  // are collapsed or inserted. The header is pinned inside the scroll area: the list starts below it.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rows[index]?.key ?? index,
    estimateSize: (index) => {
      const row = rows[index]
      const described = showDescriptions && row?.canonical && (state.tasks.get(row.id)?.description.trim() ?? '') !== ''
      return described ? ROW_WITH_DESCRIPTION_HEIGHT : ROW_HEIGHT
    },
    overscan: 14,
    scrollMargin: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT
  })

  /**
   * Forgets every cached row height and measures the rows on screen again. `measure()` alone would
   * leave them at their estimate (the rows only report changes of their own size), so a wrapped
   * title would overlap the next row. Rows off screen use the estimate until they are shown.
   */
  const remeasure = useCallback(() => {
    virtualizer.measure()
    // Recompute with the estimates first: otherwise the new height of a row is compared with the
    // stale one, looks unchanged and is dropped.
    virtualizer.getVirtualItems()
    scrollRef.current?.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => virtualizer.measureElement(el))
  }, [virtualizer])

  // Showing or hiding descriptions changes every height.
  useEffect(() => {
    remeasure()
  }, [showDescriptions, remeasure])

  // A different width (window, detail panel) changes where titles wrap: rows off screen are measured again when shown.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let width = el.clientWidth
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      clearTimeout(timer)
      timer = setTimeout(remeasure, 120)
    })
    observer.observe(el)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [remeasure])

  // Whole branch (deduplicated) only for visible rows with children, and only if there are shared subtasks.
  // The cache is valid while the estimation does not change.
  const branchCache = useRef<{ est: Estimation | null; map: Map<string, number> }>({ est: null, map: new Map() })
  if (branchCache.current.est !== est) branchCache.current = { est, map: new Map() }
  const branchMinutes = (row: TreeRow): number | null => {
    if (est.shared.length === 0 || row.childCount === 0 || !row.canonical) return null
    const cache = branchCache.current.map
    let v = cache.get(row.id)
    if (v === undefined) {
      v = sumMetrics(est.own, branchTaskIds(state.graph, row.id)).minutes
      cache.set(row.id, v)
    }
    return v
  }

  const selectedIndex = selectedKey ? rows.findIndex((r) => r.key === selectedKey) : -1
  const selectedRow = selectedIndex >= 0 ? rows[selectedIndex] : undefined

  // Scroll requested by an action (create, move, reveal…).
  useEffect(() => {
    if (!scrollToKey) return
    const index = rows.findIndex((r) => r.key === scrollToKey)
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'auto' })
      useUi.getState().requestScroll(null)
      // If an editor is open, the focus belongs to it.
      if (!useUi.getState().editing) treeRef.current?.focus({ preventScroll: true })
    }
  }, [scrollToKey, rows, virtualizer])

  // If the selected row disappears (e.g. after deleting it), the selection is cleared.
  useEffect(() => {
    const ui = useUi.getState()
    if (ui.selectedKey && !rows.some((r) => r.key === ui.selectedKey) && ui.selectedId && !state.tasks.has(ui.selectedId)) {
      ui.select(null, null)
    }
  }, [rows, state.tasks])

  const selectIndex = (index: number, extend = false) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, index))
    const row = rows[clamped]
    if (!row) return
    const ui = useUi.getState()
    if (extend && selectedIndex >= 0) {
      const [a, b] = selectedIndex < clamped ? [selectedIndex, clamped] : [clamped, selectedIndex]
      ui.select(row.key, row.id, { range: [...new Set(rows.slice(a, b + 1).map((r) => r.id))] })
    } else ui.select(row.key, row.id)
    virtualizer.scrollToIndex(clamped, { align: 'auto' })
  }

  /** Rows that fit in the visible area (rows may be taller than one line). */
  const pageRows = (): number => {
    const items = virtualizer.getVirtualItems()
    const el = scrollRef.current
    if (!el || items.length === 0) return 15
    const average = (items[items.length - 1]!.end - items[0]!.start) / items.length
    return Math.max(1, Math.floor((el.clientHeight - HEADER_HEIGHT) / average) - 1)
  }

  /** Outliner-style keyboard. Returns true if the key was used. */
  const handleKey = (e: KeyboardEvent<HTMLDivElement>): boolean => {
    const ui = useUi.getState()
    const row = selectedRow
    const k = e.key
    const mod = isMod(e)
    const start = selectedIndex < 0 ? 0 : selectedIndex

    if (k === 'ArrowDown' && !e.altKey) selectIndex(selectedIndex < 0 ? 0 : start + 1, e.shiftKey)
    else if (k === 'ArrowUp' && !e.altKey) selectIndex(selectedIndex < 0 ? 0 : start - 1, e.shiftKey)
    else if (k === 'Home') selectIndex(0)
    else if (k === 'End') selectIndex(rows.length - 1)
    else if (k === 'PageDown') selectIndex(start + pageRows())
    else if (k === 'PageUp') selectIndex(start - pageRows())
    else if (k === 'ArrowLeft' && e.altKey) ui.focusBackStep()
    else if (k === 'Escape') {
      if (ui.multi.length > 1) ui.select(ui.selectedKey, ui.selectedId)
      else if (ui.detailOpen) ui.setDetailOpen(false)
      else ui.select(null, null)
    } else if (!row) {
      if (k !== 'Enter' || readOnly) return false
      void actions.createTask(focusId, focusId ? canonicalKey(state.graph, focusId) : null, undefined)
    } else if (k === 'ArrowRight' && e.altKey) actions.focusRow(row)
    else if (k === 'ArrowRight') {
      if (row.childCount > 0 && !row.expanded) {
        if (row.canonical) ui.toggleExpanded(row.id, true)
        else ui.togglePeek(row.key, true)
      } else if (row.expanded) selectIndex(selectedIndex + 1)
    } else if (k === 'ArrowLeft') {
      if (row.expanded) {
        if (row.canonical) ui.toggleExpanded(row.id, false)
        else ui.togglePeek(row.key, false)
      } else if (row.parentRow >= 0) selectIndex(row.parentRow)
    } else if (k === ' ') ui.setDetailOpen(!ui.detailOpen)
    else if (readOnly) return false
    else if (k === 'Enter' && mod) void actions.createChild(row)
    else if (k === 'Enter') void actions.createSibling(row)
    else if (k === 'F2') ui.startEdit(row.key, 'title')
    else if (k === 'Tab') void (e.shiftKey ? actions.outdent(row) : actions.indent(row, rows))
    else if (k === 'ArrowUp' && e.altKey) void actions.moveBy(row, -1)
    else if (k === 'ArrowDown' && e.altKey) void actions.moveBy(row, 1)
    else if (k === 'Delete') void actions.deleteRow(row)
    else if (mod && !e.shiftKey && k.toLowerCase() === 'd') void actions.duplicate(row)
    else if (mod && e.shiftKey && k.toLowerCase() === 'c') actions.copyForLink(row)
    else if (mod && e.shiftKey && k.toLowerCase() === 'v') void actions.pasteAsLink(row)
    else return false
    return true
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return
    if (handleKey(e)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const items = virtualizer.getVirtualItems()
  const scrollOffset = virtualizer.scrollOffset ?? 0
  // Item positions include the header (scrollMargin); the first visible row is the one below it.
  const firstIndex = items.find((item) => item.end > scrollOffset + HEADER_HEIGHT)?.index ?? 0
  const focusDepth = focusId ? codeDepth(est.codes.get(focusId) ?? '1') : 0
  const members = useMemo(() => [...state.members.values()], [state.members])

  if (rows.length === 0) {
    const keys = t.common.keys
    if (matches) {
      return <EmptyState title={t.tree.empty.noMatches} description={t.tree.empty.noMatchesHint} />
    }
    return (
      <EmptyState
        icon={<ListTree />}
        title={focusId ? t.tree.empty.noSubtasks : t.tree.empty.emptyProject}
        description={
          <>
            {t.tree.empty.keyboardIntro} <Kbd>{keys.enter}</Kbd> {t.tree.empty.enterKey}, <Kbd>{keys.tab}</Kbd>{' '}
            {t.tree.empty.tabKey}, <Kbd>{keys.ctrl}</Kbd>+<Kbd>{keys.enter}</Kbd> {t.tree.empty.ctrlEnterKey}.
          </>
        }
        action={
          readOnly ? null : (
            <Button variant="primary" onClick={() => void actions.createTask(focusId, focusId ? canonicalKey(state.graph, focusId) : null, undefined)}>
              <Plus /> {focusId ? t.tree.menu.addSubtask : t.tree.empty.firstTask}
            </Button>
          )
        }
      />
    )
  }

  const header: ReadonlyArray<{ column: TreeColumn; label: string; tip?: string; className?: string }> = [
    { column: 'code', label: t.tree.columns.wbs, className: 'pl-3' },
    { column: 'title', label: t.tree.columns.task },
    { column: 'assignee', label: t.tree.columns.assignee, className: 'justify-center px-0' },
    { column: 'status', label: t.tree.columns.status },
    { column: 'sp', label: t.tree.columns.storyPoints, tip: t.tree.columnTips.storyPoints, className: 'justify-end' },
    { column: 'estimate', label: t.tree.columns.own, tip: t.tree.columnTips.own, className: 'justify-end' },
    { column: 'sumHours', label: t.tree.columns.sumHours, tip: t.tree.columnTips.sumHours, className: 'justify-end' },
    { column: 'sumCost', label: t.tree.columns.sumCost, tip: t.tree.columnTips.sumCost, className: 'justify-end' },
    { column: 'progress', label: t.tree.columns.progress, className: 'pl-1' }
  ]

  return (
    <div
      ref={rootRef}
      className="flex h-full flex-col"
      style={columnVars(columns) as CSSProperties}
      onMouseLeave={() => useUi.getState().setHovered(null)}
    >
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          {/* Header pinned inside the scroll area: it scrolls sideways with the rows and stays aligned with them. */}
          <div
            className="sticky top-0 z-30 items-center border-b bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ ...TREE_GRID_STYLE, height: HEADER_HEIGHT, minWidth: 'var(--tree-min)' }}
          >
            {header.map((h, i) => (
              <div key={h.column} className="relative h-full min-w-0">
                <HeaderCell tip={h.tip} className={h.className}>
                  {h.label}
                </HeaderCell>
                <ColumnResizer
                  column={h.column}
                  label={t.tree.resizeColumn(h.label)}
                  last={i === header.length - 1}
                  rootRef={rootRef}
                  onResized={remeasure}
                />
              </div>
            ))}
          </div>
          {/* The tree itself: only rows (the header with its grips stays outside it). */}
          <div
            ref={treeRef}
            tabIndex={0}
            role="tree"
            aria-label={t.tree.label}
            aria-multiselectable
            onKeyDown={onKeyDown}
            className="outline-none"
            style={{ height: virtualizer.getTotalSize(), position: 'relative', minWidth: 'var(--tree-min)' }}
          >
            {items.map((item) => {
              const row = rows[item.index]!
              const task = state.tasks.get(row.id)
              if (!task) return null
              const isEditing = editing?.key === row.key ? { field: editing.field, fresh: editing.fresh } : null
              return (
                <div
                  key={row.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`
                  }}
                >
                  <TreeRowView
                    row={row}
                    task={task}
                    own={est.own.get(row.id) ?? ZERO_METRICS}
                    estimateSource={effectiveEstimate(task, state.meta.pointScale).source}
                    attr={est.attributed.get(row.id) ?? ZERO_METRICS}
                    branchMinutes={branchMinutes(row)}
                    member={task.assigneeId ? state.members.get(task.assigneeId) : undefined}
                    members={members}
                    tags={tags}
                    parentCount={state.graph.parents(row.id).length}
                    canonicalCode={est.codes.get(row.id) ?? ''}
                    currency={state.meta.currency}
                    hoursPerDay={state.meta.defaultHoursPerDay}
                    selected={row.key === selectedKey}
                    inMulti={multi.length > 1 && multi.includes(row.id)}
                    echo={hoveredId === row.id && row.key !== selectedKey && state.graph.isShared(row.id)}
                    editing={isEditing}
                    readOnly={readOnly}
                    focusDepth={focusDepth}
                    rowsRef={rowsRef}
                    showDescriptions={showDescriptions}
                  />
                </div>
              )
            })}
          </div>
        </div>
        {!matches ? (
          <StickyAncestors
            rows={rows}
            firstIndex={firstIndex}
            onJump={(index) => {
              selectIndex(index)
              virtualizer.scrollToIndex(index, { align: 'start' })
            }}
          />
        ) : null}
      </div>
      {multi.length > 1 ? <BulkBar ids={multi} /> : null}
    </div>
  )
}
