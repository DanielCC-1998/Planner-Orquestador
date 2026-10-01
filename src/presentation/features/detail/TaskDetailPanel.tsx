import { useMemo, useRef } from 'react'
import {
  ArrowUpRight,
  CopyPlus,
  Link2,
  Plus,
  Share2,
  Star,
  Trash2,
  Unlink,
  X,
  ZoomIn
} from 'lucide-react'
import {
  branchTaskIds,
  effectiveEstimate,
  effectiveRate,
  formatDurationInput,
  minutesForPoints,
  parseDuration,
  POINT_SCALE_VALUES,
  PRIORITIES,
  progressOf,
  scheduleFor,
  sumMetrics,
  tagsOfTask,
  TASK_STATUSES,
  workloadFor,
  type Priority,
  type TaskPatch,
  type TaskStatus
} from '@domain'
import { DraftInput, DraftTextarea } from '../../components/DraftField'
import { Rich } from '../../components/Rich'
import { TagChip } from '../../components/TagChip'
import { Button } from '../../components/ui/button'
import { Field, NativeSelect } from '../../components/ui/input'
import { ProgressBar, Tooltip } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { describeError } from '../../i18n/errors'
import { cn } from '../../lib/cn'
import { clampDetailWidth, DETAIL_WIDTH, useLayout } from '../../stores/layout'
import { useProject } from '../../stores/project'
import { useUi } from '../../stores/ui'
import { TagPicker } from '../tags/TagPicker'
import * as actions from '../tree/actions'
import { canonicalKey, canonicalPath, type TreeRow } from '../tree/flatten'

/** Synthetic row to reuse the tree actions from the panel (canonical appearance). */
function canonicalRow(id: string): TreeRow | null {
  const { state } = useProject.getState()
  if (!state) return null
  const path = canonicalPath(state.graph, id)
  const parentId = path.length > 1 ? path[path.length - 2]! : null
  const siblings = state.graph.siblings(parentId)
  return {
    key: path.join('/'),
    id,
    parentId,
    parentKey: path.length > 1 ? path.slice(0, -1).join('/') : null,
    parentRow: -1,
    depth: path.length - 1,
    code: '',
    canonical: true,
    childCount: state.graph.children(id).length,
    expanded: false,
    index: siblings.indexOf(id),
    siblingCount: siblings.length,
    branch: 0,
    context: false
  }
}

/**
 * The panel, with the width the user left it at (CSS keeps it between 320 px and 60% of the window).
 * Its left edge is a grip: dragging changes the width live (only this element) and saves it when
 * released; double click goes back to the default.
 */
function DetailAside({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  const { t } = useI18n()
  const width = useLayout((s) => s.detailWidth)
  const ref = useRef<HTMLElement>(null)

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    const fromX = e.clientX
    const fromWidth = ref.current?.getBoundingClientRect().width ?? width
    let next = fromWidth
    const move = (ev: PointerEvent) => {
      next = clampDetailWidth(fromWidth + fromX - ev.clientX, window.innerWidth)
      if (ref.current) ref.current.style.width = `${next}px`
    }
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      useLayout.getState().setDetailWidth(next)
    }
    handle.setPointerCapture(e.pointerId)
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  return (
    <aside
      ref={ref}
      aria-label={label}
      className={cn('relative flex min-w-80 max-w-[60vw] shrink-0 flex-col border-l bg-card', className)}
      style={{ width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t.detail.resizePanel}
        data-resize="detail"
        onPointerDown={startResize}
        onDoubleClick={() => useLayout.getState().setDetailWidth(DETAIL_WIDTH.initial)}
        className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none hover:bg-primary/30"
      />
      {children}
    </aside>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Metric({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('truncate tabular-nums', strong ? 'text-base font-semibold' : 'text-sm font-medium')}>{value}</div>
      {sub ? <div className="truncate text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

export function TaskDetailPanel() {
  const { t, f } = useI18n()
  const state = useProject((s) => s.state)!
  const est = useProject((s) => s.estimation)!
  const readOnly = useProject((s) => s.readOnly)
  const dispatch = useProject((s) => s.dispatch)
  const projectTags = useProject((s) => s.tags)
  const selectedId = useUi((s) => s.selectedId)
  const setDetailOpen = useUi((s) => s.setDetailOpen)
  const openDialog = useUi((s) => s.openDialog)

  const task = selectedId ? state.tasks.get(selectedId) : undefined
  const branch = useMemo(() => {
    if (!task) return null
    const ids = branchTaskIds(state.graph, task.id)
    const metrics = sumMetrics(est.own, ids)
    const schedule = scheduleFor(state.meta, workloadFor(state, est.own, ids))
    return { metrics, schedule }
  }, [task, state, est])

  if (!task || !branch) {
    return (
      <DetailAside className="items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {t.detail.noSelection}
      </DetailAside>
    )
  }

  const id = task.id
  const currency = state.meta.currency
  const own = est.own.get(id)!
  const attr = est.attributed.get(id)!
  const code = est.codes.get(id) ?? ''
  const path = canonicalPath(state.graph, id).slice(0, -1)
  const parents = state.graph.parents(id)
  const children = state.graph.children(id)
  const rate = effectiveRate(task, state)
  // Hours of the task itself: typed by hand, or from its story points through the project scale.
  const estimate = effectiveEstimate(task, state.meta.pointScale)
  const scale = state.meta.pointScale
  const fromPoints = task.storyPoints === null ? null : minutesForPoints(task.storyPoints, scale)
  const estimateHint =
    estimate.source === 'points'
      ? t.detail.fromPoints(f.storyPoints(task.storyPoints!))
      : estimate.source === 'manual' && fromPoints !== null
        ? t.detail.manualOverride
        : estimate.source === null && task.storyPoints !== null && scale === null
          ? t.detail.noScaleHint
          : children.length > 0
            ? t.detail.ownWorkHint
            : t.detail.durationHint
  const members = [...state.members.values()]
  const inheritedRate = (() => {
    const member = task.assigneeId ? state.members.get(task.assigneeId) : undefined
    if (member?.rateCents != null) return { cents: member.rateCents, hint: t.detail.inheritedFromMember(member.name) }
    if (state.meta.defaultRateCents != null) return { cents: state.meta.defaultRateCents, hint: t.detail.inheritedFromProject }
    return null
  })()
  const sharedExtra = branch.metrics.minutes - attr.minutes
  const bottleneck = branch.schedule.bottleneck
  const patch = (p: TaskPatch) => dispatch({ type: 'task.update', id, patch: p })
  const row = () => canonicalRow(id)

  return (
    <DetailAside label={t.detail.label}>
      <div className="flex items-start gap-2 px-4 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-px font-semibold tabular-nums text-foreground">{code}</span>
            <span className="truncate">
              {path.length === 0 ? t.detail.topLevelTask : path.map((p) => state.tasks.get(p)?.title || t.common.untitled).join(' › ')}
            </span>
          </div>
        </div>
        <Tooltip content={t.detail.focusTip}>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={children.length === 0}
            onClick={() => {
              const r = row()
              if (r) actions.focusRow(r)
            }}
            aria-label={t.detail.focus}
          >
            <ZoomIn />
          </Button>
        </Tooltip>
        <Button variant="ghost" size="icon-sm" onClick={() => setDetailOpen(false)} aria-label={t.detail.closePanel}>
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 px-4 pb-3">
          <DraftTextarea
            key={`title-${id}`}
            value={task.title}
            submitOnEnter
            disabled={readOnly}
            placeholder={t.detail.titlePlaceholder}
            className="field-sizing-content min-h-0 resize-none border-transparent bg-transparent px-0 text-lg font-semibold shadow-none wrap-anywhere focus-visible:border-input focus-visible:px-2"
            rows={1}
            onCommit={(title) => void patch({ title })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.detail.status}>
              <NativeSelect value={task.status} disabled={readOnly} onChange={(e) => void patch({ status: e.target.value as TaskStatus })}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t.status[s]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t.detail.priority}>
              <NativeSelect value={task.priority} disabled={readOnly} onChange={(e) => void patch({ priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t.priority[p]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t.detail.assignee} className="col-span-2">
              <NativeSelect
                value={task.assigneeId ?? ''}
                disabled={readOnly}
                onChange={(e) => void patch({ assigneeId: e.target.value || null })}
              >
                <option value="">{t.common.unassigned}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.role ? ` · ${m.role}` : ''}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </div>

        <Section title={t.detail.description}>
          <DraftTextarea
            key={`desc-${id}`}
            value={task.description}
            disabled={readOnly}
            aria-label={t.detail.descriptionLabel}
            placeholder={t.detail.descriptionPlaceholder}
            className="min-h-32"
            onCommit={(description) => void patch({ description })}
          />
          <p className="text-[11px] text-muted-foreground">{t.detail.descriptionHint}</p>
        </Section>

        <Section title={t.detail.estimate}>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Field label={children.length > 0 ? t.detail.ownWork : t.detail.estimatedHours} hint={estimateHint}>
                {/* Only typed hours are the value: the ones from story points are a placeholder, so
                    confirming the field never turns them into typed hours by accident. */}
                <DraftInput
                  key={`est-${id}`}
                  value={formatDurationInput(task.estimateMinutes)}
                  disabled={readOnly}
                  placeholder={estimate.source === 'points' ? f.hours(estimate.minutes!) : t.detail.unestimated}
                  onCommit={(text) => {
                    const r = parseDuration(text, state.meta.defaultHoursPerDay)
                    if (!r.ok) return describeError(r.error)
                    void patch({ estimateMinutes: r.value })
                    return null
                  }}
                />
              </Field>
              {estimate.source === 'manual' && fromPoints !== null && !readOnly ? (
                <button
                  type="button"
                  onClick={() => void patch({ estimateMinutes: null })}
                  className="self-start text-xs font-medium text-primary hover:underline"
                >
                  {t.detail.useStoryPoints(f.hours(fromPoints))}
                </button>
              ) : null}
            </div>
            <Field
              label={t.detail.rate(f.currencySymbol(currency))}
              hint={task.rateCents === null ? (inheritedRate?.hint ?? t.detail.noRate) : t.detail.ownRate}
            >
              <DraftInput
                key={`rate-${id}`}
                value={f.centsToInput(task.rateCents)}
                disabled={readOnly}
                placeholder={inheritedRate ? f.centsToInput(inheritedRate.cents) : '—'}
                inputMode="decimal"
                onCommit={(text) => {
                  const cents = f.parseMoneyInput(text)
                  if (cents === 'invalid') return t.detail.invalidAmount
                  void patch({ rateCents: cents })
                  return null
                }}
              />
            </Field>
            <Field label={children.length > 0 ? t.detail.ownStoryPoints : t.detail.storyPoints} className="col-span-2">
              <div className="flex items-center gap-1.5">
                <div className="w-20">
                  <DraftInput
                    key={`sp-${id}`}
                    value={f.decimalToInput(task.storyPoints)}
                    disabled={readOnly}
                    placeholder="—"
                    inputMode="decimal"
                    onCommit={(text) => {
                      const sp = f.parseDecimalInput(text)
                      if (sp === 'invalid') return t.detail.invalidValue
                      void patch({ storyPoints: sp })
                      return null
                    }}
                  />
                </div>
                {POINT_SCALE_VALUES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={readOnly}
                    onClick={() => void patch({ storyPoints: task.storyPoints === n ? null : n })}
                    className={cn(
                      'h-7 min-w-7 rounded-md border px-1.5 text-xs font-medium tabular-nums transition',
                      task.storyPoints === n ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="text-xs text-muted-foreground">
            {t.detail.ownCost} <span className="font-medium text-foreground tabular-nums">{f.money(own.costCents, currency)}</span>
            {rate.rateCents !== null ? ` · ${f.money(rate.rateCents, currency)}/h` : own.minutes > 0 ? ` · ${t.detail.noApplicableRate}` : ''}
          </div>
        </Section>

        <Section title={t.detail.totals}>
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/60 p-3">
            <Metric label={t.detail.hours} value={f.hours(branch.metrics.minutes)} strong />
            <Metric label={t.detail.cost} value={f.money(branch.metrics.costCents, currency, false)} strong />
            <Metric label={t.detail.sp} value={f.storyPoints(branch.metrics.storyPoints)} strong />
          </div>
          {sharedExtra > 0 ? (
            <div className="flex items-start gap-2 rounded-lg bg-shared-soft px-3 py-2 text-xs text-shared">
              <Link2 className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <Rich text={t.detail.sharedExtra(f.hours(sharedExtra), f.hours(attr.minutes), f.money(attr.costCents, currency))} />
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <ProgressBar value={progressOf(branch.metrics)} className="flex-1" />
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{f.percent(progressOf(branch.metrics))}</span>
          </div>
          {branch.schedule.days > 0 ? (
            <div className="text-xs text-muted-foreground">
              {t.detail.branchDuration} <span className="font-medium text-foreground">{f.days(branch.schedule.days)}</span>
              {bottleneck
                ? ` · ${t.detail.setsThePace(bottleneck.memberId ? (state.members.get(bottleneck.memberId)?.name ?? '') : t.detail.unassignedWork)}`
                : ''}
              {branch.schedule.endDate ? ` · ${t.detail.endsOn(f.date(branch.schedule.endDate))}` : ''}
            </div>
          ) : null}
        </Section>

        <Section
          title={parents.length > 1 ? t.detail.appearsIn(parents.length) : t.detail.parentTask}
          action={
            readOnly ? null : (
              <Button variant="ghost" size="sm" onClick={() => openDialog({ type: 'linkParent', childId: id })}>
                <Share2 /> {t.detail.shareIn}
              </Button>
            )
          }
        >
          {parents.length === 0 ? (
            <div className="text-xs text-muted-foreground">{t.detail.isTopLevel}</div>
          ) : (
            <ul className="flex flex-col gap-1">
              {parents.map((pid, i) => (
                <li key={pid} className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/60">
                  <Tooltip content={i === 0 ? t.detail.primaryTip : t.detail.makePrimaryTip}>
                    <button
                      type="button"
                      disabled={readOnly || i === 0}
                      onClick={() => void dispatch({ type: 'edge.setPrimary', parentId: pid, childId: id })}
                      className={cn('shrink-0', i === 0 ? 'text-shared' : 'text-muted-foreground/50 hover:text-shared')}
                      aria-label={t.detail.primaryParent}
                    >
                      <Star className={cn('size-4', i === 0 && 'fill-current')} />
                    </button>
                  </Tooltip>
                  <button type="button" className="min-w-0 flex-1 text-left text-sm wrap-anywhere" onClick={() => actions.revealTask(pid)}>
                    <span className="mr-1.5 tabular-nums text-muted-foreground">{est.codes.get(pid)}</span>
                    {state.tasks.get(pid)?.title || t.common.untitled}
                  </button>
                  {!readOnly ? (
                    <Tooltip content={t.detail.removeFromTask}>
                      <button
                        type="button"
                        onClick={() => void dispatch({ type: 'edge.unlink', parentId: pid, childId: id })}
                        className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                        aria-label={t.common.remove}
                      >
                        <Unlink className="size-4" />
                      </button>
                    </Tooltip>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={t.detail.subtasks(children.length)}
          action={
            readOnly ? null : (
              <Button variant="ghost" size="sm" onClick={() => openDialog({ type: 'linkChild', parentId: id })}>
                <Link2 /> {t.detail.linkExisting}
              </Button>
            )
          }
        >
          <ul className="flex flex-col">
            {children.map((cid, i) => {
              const shared = state.graph.primaryParent(cid) !== id
              const m = est.attributed.get(cid)
              return (
                <li key={cid}>
                  <button
                    type="button"
                    onClick={() => {
                      useUi.getState().select(`${canonicalKey(state.graph, id)}/${cid}`, cid)
                      useUi.getState().requestScroll(`${canonicalKey(state.graph, id)}/${cid}`)
                    }}
                    className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent/60"
                  >
                    <span className="w-10 shrink-0 pt-px text-xs tabular-nums text-muted-foreground">{`${code}.${i + 1}`}</span>
                    {shared ? <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-shared" /> : null}
                    <span className={cn('min-w-0 flex-1 wrap-anywhere', shared && 'italic text-muted-foreground')}>
                      {state.tasks.get(cid)?.title || t.common.untitled}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {shared ? t.detail.see(est.codes.get(cid) ?? '') : m ? f.hours(m.minutes) : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {!readOnly ? (
            <DraftInput
              key={`new-child-${id}-${children.length}`}
              value=""
              placeholder={t.detail.newSubtaskPlaceholder(t.common.keys.enter)}
              onCommit={(title) => {
                if (!title.trim()) return null
                useUi.getState().toggleExpanded(id, true)
                void dispatch({ type: 'task.create', parentId: id, fields: { title: title.trim() } })
                return null
              }}
            />
          ) : null}
        </Section>

        <Section title={t.detail.tags}>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Relative commands (give / take one tag), so quick clicks never overwrite each other. */}
            {tagsOfTask(projectTags, task.tagIds).map((tag) =>
              readOnly ? (
                <TagChip key={tag.id} name={tag.name} color={tag.color} />
              ) : (
                <TagChip
                  key={tag.id}
                  name={tag.name}
                  color={tag.color}
                  removeLabel={t.tags.remove(tag.name)}
                  onRemove={() => void dispatch({ type: 'tag.assign', ids: [id], tagId: tag.id, assigned: false })}
                />
              )
            )}
            {!readOnly ? (
              <TagPicker
                tags={projectTags}
                stateOf={(tagId) => (task.tagIds.includes(tagId) ? 'on' : 'off')}
                onToggle={(tag, assign) => void dispatch({ type: 'tag.assign', ids: [id], tagId: tag.id, assigned: assign })}
                onCreate={(name) => void dispatch({ type: 'tag.create', name, assignTo: [id] })}
              >
                <Button variant="outline" size="sm" className="h-6 rounded-full px-2 text-xs">
                  <Plus /> {t.tags.add}
                </Button>
              </TagPicker>
            ) : task.tagIds.length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : null}
          </div>
        </Section>

        {!readOnly ? (
          <div className="flex items-center gap-2 border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const r = row()
                if (r) void actions.duplicate(r)
              }}
            >
              <CopyPlus /> {t.detail.duplicate}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const r = row()
                if (r) void actions.createChild(r)
              }}
            >
              <Plus /> {t.detail.subtask}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                const r = row()
                if (r) void actions.deleteRow(r)
              }}
            >
              <Trash2 /> {t.common.delete}
            </Button>
          </div>
        ) : null}
      </div>
    </DetailAside>
  )
}
