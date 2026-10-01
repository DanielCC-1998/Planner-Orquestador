import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { Link2, NotebookText } from 'lucide-react'
import { branchTaskIds, TASK_STATUSES, type Member, type Task, type TaskStatus } from '@domain'
import { DescriptionPreview } from '../../components/DescriptionPreview'
import { Button } from '../../components/ui/button'
import { Avatar, EmptyState, Segmented, Tooltip } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/cn'
import { useProject } from '../../stores/project'
import { useUi } from '../../stores/ui'
import { STATUS_DOT } from '../tree/cells'
import { computeMatches } from '../tree/filter'
import { canonicalKey, canonicalPath } from '../tree/flatten'

type Scope = 'leaves' | 'children'

const PRIORITY_BAR: Record<Task['priority'], string> = {
  low: 'bg-muted-foreground/30',
  medium: 'bg-status-progress/70',
  high: 'bg-warning',
  critical: 'bg-destructive'
}

const PAGE = 120

interface CardData {
  task: Task
  code: string
  path: string
  minutes: number
  storyPoints: number
  member: Member | undefined
  shared: number
}

function CardView({
  card,
  dragging,
  onOpen,
  showDescription
}: {
  card: CardData
  dragging?: boolean
  onOpen?: () => void
  showDescription: boolean
}) {
  const { t, f } = useI18n()
  const { task } = card
  const description = task.description.trim()
  return (
    <div
      onClick={onOpen}
      className={cn(
        'relative flex cursor-grab flex-col gap-1.5 overflow-hidden rounded-lg border bg-card p-2.5 pl-3.5 text-sm shadow-sm transition hover:border-primary/40 hover:shadow',
        dragging && 'rotate-1 cursor-grabbing shadow-xl ring-2 ring-primary/40'
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', PRIORITY_BAR[task.priority])} />
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{card.code}</span>
        {card.path ? <span className="truncate">· {card.path}</span> : null}
      </div>
      <div className={cn('line-clamp-2 font-medium leading-snug', !task.title && 'text-muted-foreground')}>{task.title || t.common.untitled}</div>
      {showDescription && description ? (
        <div data-col="description" className="text-xs leading-relaxed text-muted-foreground">
          <DescriptionPreview text={description} />
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {card.member ? <Avatar name={card.member.name} initials={card.member.initials} color={card.member.color} size="sm" /> : null}
        {card.minutes > 0 ? <span className="tabular-nums">{f.hours(card.minutes)}</span> : <span className="text-warning">{t.board.unestimated}</span>}
        {card.storyPoints > 0 ? (
          <span className="rounded bg-muted px-1 tabular-nums">
            {f.storyPoints(card.storyPoints)} {t.board.storyPointsUnit}
          </span>
        ) : null}
        {description && !showDescription ? (
          <Tooltip content={<span className="line-clamp-6 whitespace-pre-line">{description.slice(0, 300)}</span>}>
            <span className="inline-flex text-muted-foreground/70" aria-label={t.board.hasDescription}>
              <NotebookText className="size-3.5" />
            </span>
          </Tooltip>
        ) : null}
        {card.shared > 1 ? (
          <Tooltip content={t.board.sharedIn(card.shared)}>
            <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-shared-soft px-1.5 font-semibold text-shared">
              <Link2 className="size-3" /> {card.shared}
            </span>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}

function DraggableCard({ card, readOnly, showDescription }: { card: CardData; readOnly: boolean; showDescription: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.task.id, disabled: readOnly })
  const open = () => {
    const state = useProject.getState().state
    if (!state) return
    const ui = useUi.getState()
    ui.select(canonicalKey(state.graph, card.task.id), card.task.id)
    ui.setDetailOpen(true)
  }
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && 'opacity-30')}>
      <CardView card={card} onOpen={open} showDescription={showDescription} />
    </div>
  )
}

function Column({
  status,
  cards,
  readOnly,
  showDescription
}: {
  status: TaskStatus
  cards: CardData[]
  readOnly: boolean
  showDescription: boolean
}) {
  const { t, f } = useI18n()
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const [limit, setLimit] = useState(PAGE)
  const minutes = cards.reduce((acc, c) => acc + c.minutes, 0)
  return (
    <div
      ref={setNodeRef}
      className={cn('flex min-h-0 w-72 shrink-0 flex-col rounded-xl bg-muted/50 transition', isOver && 'bg-accent ring-2 ring-primary/40')}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={cn('size-2 rounded-full', STATUS_DOT[status])} />
        <span className="text-sm font-semibold">{t.status[status]}</span>
        <span className="rounded-full bg-card px-1.5 text-xs tabular-nums text-muted-foreground">{cards.length}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{f.hours(minutes)}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
        {cards.slice(0, limit).map((c) => (
          <DraggableCard key={c.task.id} card={c} readOnly={readOnly} showDescription={showDescription} />
        ))}
        {cards.length > limit ? (
          <Button variant="ghost" size="sm" onClick={() => setLimit(limit + PAGE)}>
            {t.board.showMore(Math.min(PAGE, cards.length - limit))}
          </Button>
        ) : null}
        {cards.length === 0 ? <div className="rounded-lg border-2 border-dashed p-4 text-center text-xs text-muted-foreground">{t.board.dropHere}</div> : null}
      </div>
    </div>
  )
}

/** Board by status. Each task appears once even if it is shared. */
export function BoardView() {
  const { t } = useI18n()
  const state = useProject((s) => s.state)!
  const est = useProject((s) => s.estimation)!
  const readOnly = useProject((s) => s.readOnly)
  const dispatch = useProject((s) => s.dispatch)
  const focusId = useUi((s) => s.focusId)
  const filters = useUi((s) => s.filters)
  const showDescriptions = useUi((s) => s.showDescriptions)
  const [scope, setScope] = useState<Scope>('leaves')
  const [pending, setPending] = useState<ReadonlyMap<string, TaskStatus>>(new Map())
  const [dragId, setDragId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const cards = useMemo(() => {
    const { graph } = state
    let ids: string[]
    if (scope === 'children') ids = [...(focusId ? graph.children(focusId) : graph.roots())]
    else {
      const pool = focusId ? branchTaskIds(graph, focusId) : new Set(graph.nodes())
      ids = [...pool].filter((id) => id !== focusId && graph.children(id).length === 0)
    }
    const matches = computeMatches(state, est, filters)
    if (matches) ids = ids.filter((id) => matches.has(id))
    const out: CardData[] = []
    for (const id of ids) {
      const task = state.tasks.get(id)
      if (!task) continue
      const metrics = scope === 'children' ? est.attributed.get(id) : est.own.get(id)
      const path = canonicalPath(graph, id)
        .slice(0, -1)
        .slice(-2)
        .map((p) => state.tasks.get(p)?.title || t.common.untitled)
        .join(' › ')
      out.push({
        task,
        code: est.codes.get(id) ?? '',
        path,
        minutes: metrics?.minutes ?? 0,
        storyPoints: metrics?.storyPoints ?? 0,
        member: task.assigneeId ? state.members.get(task.assigneeId) : undefined,
        shared: graph.parents(id).length
      })
    }
    return out.sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }))
  }, [state, est, focusId, filters, scope, t])

  const byStatus = (status: TaskStatus) => cards.filter((c) => (pending.get(c.task.id) ?? c.task.status) === status)

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id))
  const onDragEnd = async (e: DragEndEvent) => {
    setDragId(null)
    const id = String(e.active.id)
    const status = e.over?.id as TaskStatus | undefined
    const task = state.tasks.get(id)
    if (!status || !task || task.status === status) return
    // The change shows at once; the real state arrives with the delta.
    setPending((p) => new Map(p).set(id, status))
    await dispatch({ type: 'task.update', id, patch: { status } })
    setPending((p) => {
      const next = new Map(p)
      next.delete(id)
      return next
    })
  }

  const dragged = dragId ? cards.find((c) => c.task.id === dragId) : undefined

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Segmented<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'leaves', label: t.board.scope.leaves, title: t.board.scope.leavesTip },
            { value: 'children', label: focusId ? t.board.scope.children : t.board.scope.topLevel }
          ]}
        />
        <span className="text-xs text-muted-foreground">
          {t.board.summary(cards.length, focusId ? (est.codes.get(focusId) ?? '') : null)}
        </span>
      </div>
      {cards.length === 0 ? (
        <EmptyState title={t.board.emptyTitle} description={t.board.emptyHint} />
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={(e) => void onDragEnd(e)} onDragCancel={() => setDragId(null)}>
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4">
            {TASK_STATUSES.map((s) => (
              <Column key={s} status={s} cards={byStatus(s)} readOnly={readOnly} showDescription={showDescriptions} />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>{dragged ? <CardView card={dragged} dragging showDescription={showDescriptions} /> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
