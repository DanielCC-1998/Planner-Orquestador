import { memo, type MouseEvent } from 'react'
import { ChevronRight, CornerDownRight, Eye, Link2, MoreHorizontal, NotebookText, Plus, Star } from 'lucide-react'
import {
  parseDuration,
  progressOf,
  formatDurationInput,
  type Member,
  type Metrics,
  type Task
} from '@domain'
import { DescriptionPreview } from '../../components/DescriptionPreview'
import { ContextMenu, ContextMenuTrigger, DropdownMenu, DropdownMenuTrigger } from '../../components/ui/menu'
import { Tooltip } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { describeError } from '../../i18n/errors'
import { cn } from '../../lib/cn'
import { useProject } from '../../stores/project'
import { toast } from '../../stores/toasts'
import { useUi, type EditField } from '../../stores/ui'
import * as actions from './actions'
import { AssigneePicker, InlineEditor, StatusPill } from './cells'
import type { TreeRow } from './flatten'
import { TaskContextMenuContent, TaskDropdownMenuContent } from './TaskMenu'

export const ROW_HEIGHT = 34
/** Approximate height of a row with a visible description (measured when painted). */
export const ROW_WITH_DESCRIPTION_HEIGHT = 74
export const INDENT = 20
const WBS_WIDTH = 76
export const MAX_INDENT_LEVELS = 8
export const TREE_GRID = 'grid grid-cols-[76px_minmax(300px,1fr)_40px_116px_56px_78px_132px_124px_92px]'

const BRANCH_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']

export interface TreeRowProps {
  row: TreeRow
  task: Task
  own: Metrics
  attr: Metrics
  /** Minutes of the whole branch, if it includes shared subtasks counted in another branch. */
  branchMinutes: number | null
  member: Member | undefined
  members: readonly Member[]
  parentCount: number
  canonicalCode: string
  currency: string
  hoursPerDay: number
  selected: boolean
  inMulti: boolean
  echo: boolean
  editing: { field: EditField; fresh: boolean } | null
  readOnly: boolean
  focusDepth: number
  rowsRef: { current: readonly TreeRow[] }
  showDescriptions: boolean
}

function shortCode(code: string): string {
  const parts = code.split('.')
  return parts.length > 4 ? `…${parts.slice(-3).join('.')}` : code
}

const paren = (text: string, on: boolean) => (on ? `(${text})` : text)

export const TreeRowView = memo(function TreeRowView(p: TreeRowProps) {
  const { t, f } = useI18n()
  const { row, task, own, attr, readOnly } = p
  const isRef = !row.canonical
  const dispatch = useProject.getState().dispatch

  const select = (e: MouseEvent) => {
    const ui = useUi.getState()
    if (e.shiftKey && ui.selectedKey) {
      const rows = p.rowsRef.current
      const a = rows.findIndex((r) => r.key === ui.selectedKey)
      const b = rows.findIndex((r) => r.key === row.key)
      if (a >= 0 && b >= 0) {
        const [from, to] = a < b ? [a, b] : [b, a]
        ui.select(row.key, row.id, { range: [...new Set(rows.slice(from, to + 1).map((r) => r.id))] })
        return
      }
    }
    ui.select(row.key, row.id, { additive: e.ctrlKey || e.metaKey })
  }

  const toggle = (e: MouseEvent) => {
    e.stopPropagation()
    const ui = useUi.getState()
    if (row.canonical) ui.toggleExpanded(row.id)
    else ui.togglePeek(row.key)
  }

  const edit = (field: EditField) => {
    if (readOnly) return
    if (field === 'sp' && row.childCount > 0) {
      useUi.getState().setDetailOpen(true)
      return
    }
    useUi.getState().startEdit(row.key, field)
  }

  const stopEdit = () => {
    useUi.getState().stopEdit()
    // The keyboard goes back to the tree to keep navigating.
    requestAnimationFrame(() => {
      if (!useUi.getState().editing) (document.querySelector('[role="tree"]') as HTMLElement | null)?.focus({ preventScroll: true })
    })
  }

  const commitTitle = async (value: string, via: 'enter' | 'blur' | 'tab' | 'shift-tab') => {
    const fresh = p.editing?.fresh ?? false
    const continues = (via === 'enter' && fresh) || via === 'tab' || via === 'shift-tab'
    // If another editor comes next, keep capturing keystrokes; otherwise drop what is pending.
    if (continues) useUi.getState().beginTypeAhead()
    else useUi.getState().clearTypeAhead()
    stopEdit()
    if (value.trim() !== task.title) await dispatch({ type: 'task.update', id: task.id, patch: { title: value } })
    if (via === 'enter' && fresh) await actions.createSibling(row)
    if (via === 'tab') await actions.indent(row, p.rowsRef.current)
    if (via === 'shift-tab') await actions.outdent(row)
    if (via === 'tab' || via === 'shift-tab') {
      const ui = useUi.getState()
      if (ui.selectedKey) ui.startEdit(ui.selectedKey, 'title', fresh)
    }
    return true
  }

  const cancelTitle = (value: string) => {
    const fresh = p.editing?.fresh ?? false
    useUi.getState().clearTypeAhead()
    stopEdit()
    if (!fresh) return
    // Newly created task: keep what was typed; if it is left untitled, discard it.
    if (value.trim()) {
      if (value.trim() !== task.title) void dispatch({ type: 'task.update', id: task.id, patch: { title: value } })
    }
    else if (!task.title && row.childCount === 0) void dispatch({ type: 'task.delete', id: task.id, mode: 'cascade' }, { quiet: true })
  }

  const commitEstimate = async (value: string) => {
    const parsed = parseDuration(value, p.hoursPerDay)
    if (!parsed.ok) {
      toast.error(describeError(parsed.error))
      return false
    }
    stopEdit()
    if (parsed.value !== task.estimateMinutes) {
      await dispatch({ type: 'task.update', id: task.id, patch: { estimateMinutes: parsed.value } })
    }
    return true
  }

  const commitSp = async (value: string) => {
    const sp = f.parseDecimalInput(value)
    if (sp === 'invalid') {
      toast.error(t.tree.row.invalidStoryPoints)
      return false
    }
    stopEdit()
    if (sp !== task.storyPoints) await dispatch({ type: 'task.update', id: task.id, patch: { storyPoints: sp } })
    return true
  }

  const indentLevels = Math.min(row.depth, MAX_INDENT_LEVELS)
  const tooDeep = row.depth > MAX_INDENT_LEVELS
  const absoluteLevel = p.focusDepth + row.depth + 1
  const branchColor = BRANCH_COLORS[row.branch % BRANCH_COLORS.length]
  const extraShared = p.branchMinutes !== null ? p.branchMinutes - attr.minutes : 0
  const progress = progressOf(attr)
  const valueTone = isRef ? 'text-muted-foreground italic' : ''
  const description = task.description.trim()
  // The description is shown only on the primary appearance: references point to it.
  const showDescription = p.showDescriptions && row.canonical && description !== ''
  const titleOffset = WBS_WIDTH + 4 + indentLevels * INDENT + (tooDeep ? 28 : 0) + 24

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) useUi.getState().select(row.key, row.id)
      }}
    >
      <ContextMenuTrigger asChild>
        <div
          role="treeitem"
          aria-level={absoluteLevel}
          aria-expanded={row.childCount > 0 ? row.expanded : undefined}
          aria-selected={p.selected}
          onMouseDown={(e) => e.button === 0 && select(e)}
          onDoubleClick={() => useUi.getState().setDetailOpen(true)}
          onMouseEnter={() => useUi.getState().setHovered(task.id)}
          className={cn(
            'group relative border-b border-border/60 text-sm',
            p.selected ? 'bg-row-selected' : p.inMulti ? 'bg-row-selected/60' : 'hover:bg-row-hover',
            p.echo && !p.selected && 'bg-shared-soft/50',
            row.context && 'opacity-55'
          )}
        >
          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: branchColor, opacity: 0.55 }} />
          {/* Indent guides along the full height of the row (also next to the description). */}
          {Array.from({ length: indentLevels }, (_, level) => (
            <span key={level} className="absolute inset-y-0 w-px bg-guide" style={{ left: WBS_WIDTH + 4 + level * INDENT + 8 }} />
          ))}
          <div className={cn(TREE_GRID, 'h-[34px] items-center')}>

          {/* WBS */}
          <Tooltip content={row.code.split('.').length > 4 ? row.code : null}>
            <div data-col="code" className={cn('truncate pl-3 text-xs tabular-nums text-muted-foreground', isRef && 'italic')}>{shortCode(row.code)}</div>
          </Tooltip>

          {/* Task */}
          <div data-col="title" className="relative flex h-full min-w-0 items-center gap-1 pr-1" style={{ paddingLeft: 4 + indentLevels * INDENT }}>
            {tooDeep ? (
              <Tooltip content={t.tree.row.deepLevel(absoluteLevel)}>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => row.parentId && useUi.getState().focus(row.parentId)}
                  className="z-[1] shrink-0 rounded bg-accent px-1 text-[10px] font-semibold text-accent-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  L{absoluteLevel}
                </button>
              </Tooltip>
            ) : null}
            {row.childCount > 0 ? (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={toggle}
                aria-label={row.expanded ? t.tree.row.collapse : t.tree.row.expand}
                className={cn(
                  'z-[1] flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground',
                  isRef && 'text-shared'
                )}
              >
                {isRef && !row.expanded ? <Eye className="size-3.5" /> : <ChevronRight className={cn('size-4 transition-transform', row.expanded && 'rotate-90')} />}
              </button>
            ) : (
              <span className="size-5 shrink-0" />
            )}
            {isRef ? <CornerDownRight className="size-3.5 shrink-0 text-shared" /> : null}

            {p.editing?.field === 'title' ? (
              <InlineEditor
                initial={task.title}
                placeholder={t.tree.row.titlePlaceholder}
                onCommit={commitTitle}
                onCancel={cancelTitle}
                takeTypeAhead={() => useUi.getState().takeTypeAhead()}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  edit('title')
                }}
                className={cn(
                  'min-w-0 truncate',
                  row.childCount > 0 && !isRef && 'font-medium',
                  isRef && 'italic text-muted-foreground',
                  !task.title && 'text-muted-foreground/70'
                )}
              >
                {task.title || t.common.untitled}
              </span>
            )}

            {description && !showDescription ? (
              <Tooltip content={<span className="line-clamp-6 whitespace-pre-line">{description.slice(0, 300)}{description.length > 300 ? '…' : ''}</span>}>
                <span className="inline-flex shrink-0 text-muted-foreground/70" aria-label={t.tree.row.hasDescription}>
                  <NotebookText className="size-3.5" />
                </span>
              </Tooltip>
            ) : null}

            {p.parentCount > 1 ? (
              <Tooltip
                content={
                  isRef ? t.tree.row.sharedReference(p.parentCount, p.canonicalCode) : t.tree.row.sharedPrimary(p.parentCount)
                }
              >
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-shared-soft px-1.5 text-[10px] font-semibold text-shared">
                  {!isRef ? <Star className="size-2.5 fill-current" /> : null}
                  <Link2 className="size-3" />
                  {p.parentCount}
                  {isRef ? <span className="font-normal">· {t.tree.row.see(p.canonicalCode)}</span> : null}
                </span>
              </Tooltip>
            ) : null}

            {row.childCount > 0 && !row.expanded && p.editing?.field !== 'title' ? (
              <span className="shrink-0 text-[11px] text-muted-foreground">{t.tree.row.subtasks(row.childCount)}</span>
            ) : null}

            {!readOnly && p.editing?.field !== 'title' ? (
              <div className="z-[1] ml-auto flex shrink-0 items-center opacity-0 group-hover:opacity-100 data-[on=true]:opacity-100" data-on={p.selected}>
                <Tooltip content={`${t.tree.menu.addSubtask} (${t.common.keys.ctrl}+${t.common.keys.enter})`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => void actions.createChild(row)}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={t.tree.menu.addSubtask}
                  >
                    <Plus className="size-4" />
                  </button>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={t.tree.row.moreActions}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <TaskDropdownMenuContent row={row} rowsRef={p.rowsRef} readOnly={readOnly} />
                </DropdownMenu>
              </div>
            ) : null}
          </div>

          {/* Assignee (on parent tasks without an assignee, the slot only shows on hover) */}
          <div data-col="assignee" className={cn('flex justify-center', row.childCount > 0 && !p.member && !p.selected && 'opacity-0 group-hover:opacity-100')}>
            <AssigneePicker
              member={p.member}
              members={p.members}
              disabled={readOnly || isRef}
              muted={isRef}
              onChange={(assigneeId) => void dispatch({ type: 'task.update', id: task.id, patch: { assigneeId } })}
            />
          </div>

          {/* Status */}
          <div data-col="status" className="px-1">
            <StatusPill
              status={task.status}
              disabled={readOnly || isRef}
              muted={isRef}
              onChange={(status) => void dispatch({ type: 'task.update', id: task.id, patch: { status } })}
            />
          </div>

          {/* SP (contribution) */}
          <div
            data-col="sp"
            className={cn('px-2 text-right tabular-nums', valueTone)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              edit('sp')
            }}
          >
            {p.editing?.field === 'sp' ? (
              <InlineEditor
                initial={f.decimalToInput(task.storyPoints)}
                align="right"
                onCommit={commitSp}
                onCancel={stopEdit}
              />
            ) : attr.storyPoints > 0 ? (
              paren(f.storyPoints(attr.storyPoints), isRef)
            ) : (
              <span className="text-muted-foreground/50">—</span>
            )}
          </div>

          {/* Own hours */}
          <div
            data-col="estimate"
            className={cn('px-2 text-right tabular-nums', valueTone)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              edit('estimate')
            }}
          >
            {p.editing?.field === 'estimate' ? (
              <InlineEditor
                initial={formatDurationInput(task.estimateMinutes)}
                placeholder="1h 30m"
                align="right"
                onCommit={commitEstimate}
                onCancel={stopEdit}
              />
            ) : task.estimateMinutes === null ? (
              <span className={cn('text-muted-foreground/50', row.childCount === 0 && !isRef && 'text-warning/80')}>—</span>
            ) : (
              paren(f.hours(own.minutes), isRef)
            )}
          </div>

          {/* Σ hours (contribution) */}
          <div data-col="sum-hours" className={cn('flex items-center justify-end gap-1.5 px-2 tabular-nums', valueTone)}>
            {extraShared > 0 && !isRef ? (
              <Tooltip content={t.tree.row.branchNeeds(f.hours(p.branchMinutes!), f.hours(extraShared))}>
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-shared">
                  +{f.hours(extraShared)}
                  <Link2 className="size-3" />
                </span>
              </Tooltip>
            ) : null}
            <span className={cn(row.childCount > 0 && !isRef && 'font-semibold')}>{paren(f.hours(attr.minutes), isRef)}</span>
          </div>

          {/* Σ cost */}
          <div data-col="sum-cost" className={cn('px-2 text-right tabular-nums', valueTone, row.childCount > 0 && !isRef && 'font-semibold')}>
            {attr.minutes > 0 || attr.costCents > 0 ? paren(f.money(attr.costCents, p.currency), isRef) : <span className="text-muted-foreground/50">—</span>}
          </div>

          {/* Progress */}
          <div data-col="progress" className="flex items-center gap-1.5 pl-1 pr-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full bg-status-done', isRef && 'opacity-50')} style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{f.percent(progress)}</span>
          </div>
          </div>
          {showDescription ? (
            <div
              data-col="description"
              className="pb-2 pr-8 text-xs leading-relaxed text-muted-foreground"
              style={{ paddingLeft: titleOffset }}
            >
              <DescriptionPreview text={description} />
            </div>
          ) : null}
        </div>
      </ContextMenuTrigger>
      <TaskContextMenuContent row={row} rowsRef={p.rowsRef} readOnly={readOnly} />
    </ContextMenu>
  )
})
