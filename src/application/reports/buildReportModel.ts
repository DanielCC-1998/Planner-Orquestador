import {
  addCalendarDays,
  codeDepth,
  codePrefix,
  compareCodes,
  effectiveRate,
  estimate,
  isoDateOf,
  sprintAnchor,
  sprintChanges,
  tagsOfTask,
  TASK_STATUSES,
  type Estimation,
  type ProjectState,
  type Task,
  type TaskId,
  type TaskStatus
} from '@domain'
import type { Issuer } from '../settings/Settings'
import type { ReportLaneTask, ReportModel, ReportOptions, ReportProgress, ReportRow, ReportTag } from './ReportModel'

/** Tags of a task as printed, in the order of the project's list. */
function tagsOf(state: ProjectState, task: Task): ReportTag[] {
  return tagsOfTask(state.meta.tags, task.tagIds).map((t) => ({ name: t.name, color: t.color }))
}

/**
 * "Task status" section: every task (parents too, whatever the breakdown depth) in a lane by
 * status, and the net status changes of each sprint up to the one that contains `today`.
 */
function buildProgress(
  state: ProjectState,
  est: Estimation,
  today: string,
  localDate: (at: string) => string
): ReportProgress {
  const codeOf = (id: TaskId) => est.codes.get(id) ?? '?'
  const ids = [...state.tasks.keys()].sort((a, b) => compareCodes(codeOf(a), codeOf(b)))
  const lanes = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as ReportLaneTask[]])) as Record<TaskStatus, ReportLaneTask[]>
  for (const id of ids) {
    const task = state.tasks.get(id)!
    lanes[task.status].push({
      code: codeOf(id),
      title: task.title,
      isParent: state.graph.children(id).length > 0,
      tags: tagsOf(state, task)
    })
  }
  const sprintStart = sprintAnchor(state.meta, localDate)
  const settings = state.meta.sprints
  const sprints =
    settings === null
      ? []
      : sprintChanges(state.tasks.values(), sprintStart, settings, today, localDate).map((sprint) => ({
          number: sprint.number,
          start: sprint.start,
          end: sprint.end,
          current: sprint.current,
          changes: sprint.changes
            .map((c) => {
              const task = state.tasks.get(c.taskId)!
              return { code: codeOf(c.taskId), title: task.title, from: c.from, to: c.to, direction: c.direction, tags: tagsOf(state, task) }
            })
            .sort((a, b) => compareCodes(a.code, b.code))
        }))
  return { asOf: today, lanes, sprintSettings: settings, sprintStart, sprints }
}

/** What the report needs besides the project: the time, and the estimation if it is already computed. */
export interface ReportContext {
  /** ISO timestamp of the report. */
  readonly now: string
  /** Calendar date of a timestamp for the user (the report date and the sprints); UTC by default. */
  readonly localDate?: ((at: string) => string) | undefined
  readonly estimation?: Estimation | undefined
}

/**
 * Builds the PDF model. The breakdown walks the forest of primary parents: each task appears
 * ONCE with amounts; under its other parents it appears as a reference without amounts. That
 * way the non-subtotal rows add up exactly to the total.
 *
 * Texts are raw data (titles may be '', the unassigned group has no name): the renderer adds
 * the localized placeholders, because the application layer does not know about languages.
 */
export function buildReportModel(state: ProjectState, options: ReportOptions, issuer: Issuer, context: ReportContext): ReportModel {
  const { now } = context
  const est = context.estimation ?? estimate(state)
  const localDate = context.localDate ?? isoDateOf
  const { graph, meta } = state
  const codes = est.codes
  const memberName = (id: string | null) => (id ? (state.members.get(id)?.name ?? null) : null)
  const title = (id: TaskId) => state.tasks.get(id)?.title ?? ''

  const rows: ReportRow[] = []
  const maxDepth = options.maxDepth

  const countCanonicalDescendants = (id: TaskId): number => {
    let n = 0
    const stack = [...graph.children(id)].filter((c) => graph.primaryParent(c) === id)
    while (stack.length > 0) {
      const c = stack.pop()!
      n++
      for (const g of graph.children(c)) if (graph.primaryParent(g) === c) stack.push(g)
    }
    return n
  }

  const visit = (id: TaskId, code: string, depth: number, ancestors: readonly string[]) => {
    const task = state.tasks.get(id)!
    const children = graph.children(id)
    const collapsed = maxDepth !== null && depth >= maxDepth && children.length > 0
    const metrics = collapsed ? est.attributed.get(id)! : est.own.get(id)!
    const attr = est.attributed.get(id)!
    rows.push({
      kind: 'task',
      code,
      depth,
      title: title(id),
      tags: tagsOf(state, task),
      assignee: memberName(task.assigneeId),
      status: task.status,
      storyPoints: metrics.storyPoints,
      minutes: metrics.minutes,
      costCents: metrics.costCents,
      rateCents: effectiveRate(task, state).rateCents,
      collapsedCount: collapsed ? countCanonicalDescendants(id) : 0,
      isParent: children.length > 0,
      description: task.description.trim(),
      path: ancestors,
      attrMinutes: attr.minutes,
      attrCostCents: attr.costCents
    })
    if (collapsed || children.length === 0) return
    children.forEach((c, i) => {
      const childCode = `${code}.${i + 1}`
      if (graph.primaryParent(c) === id) {
        visit(c, childCode, depth + 1, [...ancestors, title(id)])
        return
      }
      const canonical = codes.get(c) ?? '?'
      const hidden = maxDepth !== null && codeDepth(canonical) > maxDepth
      rows.push({
        kind: 'reference',
        code: childCode,
        depth: depth + 1,
        title: title(c),
        refKind: hidden ? 'included' : 'see',
        refCode: hidden ? codePrefix(canonical, maxDepth!) : canonical
      })
    })
    if (depth <= options.subtotalDepth) {
      rows.push({
        kind: 'subtotal',
        code,
        depth,
        title: title(id),
        storyPoints: attr.storyPoints,
        minutes: attr.minutes,
        costCents: attr.costCents
      })
    }
  }
  graph.roots().forEach((r, i) => visit(r, String(i + 1), 1, []))

  const bottleneck = est.schedule.bottleneck
  const workload = est.workload
    .filter((w) => w.minutes > 0 || w.memberId !== null)
    .map((w) => ({
      name: w.memberId === null ? '' : (state.members.get(w.memberId)?.name ?? '—'),
      role: w.memberId === null ? '' : (state.members.get(w.memberId)?.role ?? ''),
      hoursPerDay: w.hoursPerDay,
      minutes: w.minutes,
      costCents: w.costCents,
      storyPoints: w.storyPoints,
      days: w.days,
      isBottleneck: bottleneck !== null && bottleneck.memberId === w.memberId,
      isUnassigned: w.memberId === null
    }))

  const shared = est.shared.map((s) => ({
    code: codes.get(s.id) ?? '?',
    title: title(s.id),
    parents: s.parentIds.map((p) => ({ code: codes.get(p) ?? '?', title: title(p) })),
    occurrences: s.occurrences,
    minutes: s.part.minutes,
    costCents: s.part.costCents,
    savedMinutes: s.saved.minutes,
    savedCents: s.saved.costCents
  }))

  const today = localDate(now)
  const quoteDate = meta.quote.date ?? today
  return {
    generatedAt: now,
    options,
    issuer,
    project: {
      name: meta.name,
      client: meta.client,
      description: meta.description,
      color: meta.color,
      currency: meta.currency,
      taxLabel: meta.taxLabel,
      contingencyBps: meta.contingencyBps,
      taxBps: meta.taxBps,
      startDate: meta.startDate,
      quoteNumber: meta.quote.number,
      quoteDate,
      validUntil: meta.quote.validityDays !== null ? addCalendarDays(quoteDate, meta.quote.validityDays) : null,
      terms: meta.quote.terms
    },
    summary: {
      totalMinutes: est.total.minutes,
      contingencyMinutes: est.contingencyMinutes,
      storyPoints: est.total.storyPoints,
      taskCount: est.total.tasks,
      money: est.money,
      days: est.schedule.days,
      weeks: est.schedule.weeks,
      endDate: est.schedule.endDate,
      bottleneck: bottleneck
        ? bottleneck.memberId === null
          ? { name: '', unassigned: true }
          : { name: state.members.get(bottleneck.memberId)?.name ?? '—', unassigned: false }
        : null,
      savingsMinutes: est.savings.minutes,
      savingsCents: est.savings.costCents,
      progress: est.progress
    },
    rows,
    progress: options.columns.status ? buildProgress(state, est, today, localDate) : null,
    workload,
    shared,
    team: [...state.members.values()].map((m) => ({
      name: m.name,
      role: m.role,
      rateCents: m.rateCents,
      hoursPerDay: m.hoursPerDay
    }))
  }
}
