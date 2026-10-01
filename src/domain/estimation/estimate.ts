import { endDateAfterWorkingDays } from '../common/calendar'
import type { TaskGraph } from '../graph/TaskGraph'
import { canonicalCodes } from '../graph/wbs'
import { applyBps, costOf, moneyBreakdown, type MoneyBreakdown } from '../common/money'
import type { IsoDate, MemberId, TaskId } from '../common/primitives'
import type { ProjectMeta, ProjectState } from '../project/Project'
import type { Task } from '../task/Task'
import { minutesForPoints, type PointScale } from './pointScale'
import {
  accumulate,
  accumulator,
  addMetrics,
  progressOf,
  scaleMetrics,
  ZERO_METRICS,
  type Metrics
} from './metrics'

export type RateSource = 'task' | 'member' | 'project' | null

export interface EffectiveRate {
  readonly rateCents: number | null
  readonly source: RateSource
}

/** Applicable rate: the task's; otherwise the person's; otherwise the project's. */
export function effectiveRate(task: Task, state: ProjectState): EffectiveRate {
  if (task.rateCents !== null) return { rateCents: task.rateCents, source: 'task' }
  const member = task.assigneeId ? state.members.get(task.assigneeId) : undefined
  if (member && member.rateCents !== null) return { rateCents: member.rateCents, source: 'member' }
  if (state.meta.defaultRateCents !== null) return { rateCents: state.meta.defaultRateCents, source: 'project' }
  return { rateCents: null, source: null }
}

export type EstimateSource = 'manual' | 'points' | null

export interface EffectiveEstimate {
  readonly minutes: number | null
  readonly source: EstimateSource
}

/**
 * Hours of the task itself: the ones typed by hand; otherwise its story points through the
 * project scale; otherwise none (unestimated).
 */
export function effectiveEstimate(task: Task, scale: PointScale | null): EffectiveEstimate {
  if (task.estimateMinutes !== null) return { minutes: task.estimateMinutes, source: 'manual' }
  if (task.storyPoints !== null) {
    const minutes = minutesForPoints(task.storyPoints, scale)
    if (minutes !== null) return { minutes, source: 'points' }
  }
  return { minutes: null, source: null }
}

/** Metrics of a task's OWN work (without subtasks). */
export function ownMetrics(task: Task, state: ProjectState): Metrics {
  const estimate = effectiveEstimate(task, state.meta.pointScale)
  const minutes = estimate.minutes ?? 0
  const { rateCents } = effectiveRate(task, state)
  const isLeaf = state.graph.children(task.id).length === 0
  const isDone = task.status === 'done'
  return {
    minutes,
    storyPoints: task.storyPoints ?? 0,
    costCents: rateCents === null ? 0 : costOf(minutes, rateCents),
    doneMinutes: isDone ? minutes : 0,
    tasks: 1,
    doneTasks: isDone ? 1 : 0,
    unestimated: isLeaf && estimate.minutes === null ? 1 : 0,
    unpriced: minutes > 0 && rateCents === null ? 1 : 0,
    unassigned: minutes > 0 && !task.assigneeId ? 1 : 0
  }
}

export interface SharedInfo {
  readonly id: TaskId
  readonly parentIds: readonly TaskId[]
  /** Times it appears in the fully expanded tree (paths from the roots). */
  readonly occurrences: number
  /** The task and its non-shared descendants. */
  readonly part: Metrics
  /** What would have been counted twice by adding up every occurrence: part · (occurrences − 1). */
  readonly saved: Metrics
}

export interface WorkloadRow {
  /** null = unassigned work. */
  readonly memberId: MemberId | null
  readonly minutes: number
  readonly minutesWithContingency: number
  readonly costCents: number
  readonly storyPoints: number
  readonly tasks: number
  readonly hoursPerDay: number
  /** Working days of this person (with contingency) at their daily capacity. */
  readonly days: number
}

export interface Schedule {
  /** Working days: the maximum among people working in parallel. */
  readonly days: number
  readonly weeks: number | null
  readonly endDate: IsoDate | null
  /** Who sets the duration; null if there is no work. */
  readonly bottleneck: WorkloadRow | null
}

export interface Estimation {
  readonly own: ReadonlyMap<TaskId, Metrics>
  /** Contribution: own work + children whose primary parent is this task. Can be summed across siblings. */
  readonly attributed: ReadonlyMap<TaskId, Metrics>
  /** Each task counted only once. */
  readonly total: Metrics
  readonly contingencyMinutes: number
  /** What would have been added up by repeating every occurrence of the shared tasks. */
  readonly naive: Metrics
  /** naive − total, exactly. */
  readonly savings: Metrics
  readonly shared: readonly SharedInfo[]
  readonly workload: readonly WorkloadRow[]
  readonly schedule: Schedule
  readonly money: MoneyBreakdown
  readonly codes: ReadonlyMap<TaskId, string>
  readonly progress: number
}

/**
 * Full calculation of the project, O(tasks + edges).
 *
 * Savings from shared tasks: each task x is in the "part" of exactly one head h
 * (a root or a task with ≥2 parents), and all the tasks of that part have the same number of
 * paths from the roots. That is why naive − total = Σ part(h) · (paths(h) − 1).
 */
export function estimate(state: ProjectState): Estimation {
  const { graph, meta } = state
  const order = graph.topoOrder()
  const own = new Map<TaskId, Metrics>()
  const totalAcc = accumulator()
  for (const id of order) {
    const task = state.tasks.get(id)
    const m = task ? ownMetrics(task, state) : ZERO_METRICS
    own.set(id, m)
    accumulate(totalAcc, m)
  }
  const total: Metrics = { ...totalAcc }

  const attributed = new Map<TaskId, Metrics>()
  const partSum = new Map<TaskId, Metrics>()
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!
    const attr = accumulator()
    const part = accumulator()
    const o = own.get(id)!
    accumulate(attr, o)
    accumulate(part, o)
    for (const c of graph.children(id)) {
      if (graph.primaryParent(c) === id) accumulate(attr, attributed.get(c)!)
      if (graph.parents(c).length === 1) accumulate(part, partSum.get(c)!)
    }
    attributed.set(id, { ...attr })
    partSum.set(id, { ...part })
  }

  const paths = graph.pathCounts(order)
  const shared: SharedInfo[] = []
  let savings: Metrics = ZERO_METRICS
  for (const id of order) {
    const parentIds = graph.parents(id)
    if (parentIds.length < 2) continue
    const occurrences = paths.get(id) ?? 1
    const part = partSum.get(id)!
    const saved = scaleMetrics(part, Math.max(0, occurrences - 1))
    savings = addMetrics(savings, saved)
    shared.push({ id, parentIds, occurrences, part, saved })
  }

  const workload = workloadFor(state, own, order)
  return {
    own,
    attributed,
    total,
    contingencyMinutes: applyBps(total.minutes, meta.contingencyBps),
    naive: addMetrics(total, savings),
    savings,
    shared,
    workload,
    schedule: scheduleFor(meta, workload),
    money: moneyBreakdown(total.costCents, meta.contingencyBps, meta.taxBps),
    codes: canonicalCodes(graph),
    progress: progressOf(total)
  }
}

/** Task + all its descendants, each one once (even if it is reached through several paths). */
export function branchTaskIds(graph: TaskGraph, id: TaskId): Set<TaskId> {
  const ids = graph.descendants(id)
  ids.add(id)
  return ids
}

export function sumMetrics(own: ReadonlyMap<TaskId, Metrics>, ids: Iterable<TaskId>): Metrics {
  const acc = accumulator()
  for (const id of ids) {
    const m = own.get(id)
    if (m) accumulate(acc, m)
  }
  return { ...acc }
}

/** Full deduplicated branch: what a task really needs, shared subtasks included. */
export function branchMetrics(graph: TaskGraph, own: ReadonlyMap<TaskId, Metrics>, id: TaskId): Metrics {
  return sumMetrics(own, branchTaskIds(graph, id))
}

/** Workload per person over a set of unique tasks (+ an "unassigned" group if it has hours). */
export function workloadFor(
  state: ProjectState,
  own: ReadonlyMap<TaskId, Metrics>,
  taskIds: Iterable<TaskId>
): WorkloadRow[] {
  type Acc = { -readonly [K in keyof WorkloadRow]: WorkloadRow[K] }
  const rows = new Map<MemberId | null, Acc>()
  const blank = (memberId: MemberId | null, hoursPerDay: number): Acc => ({
    memberId,
    minutes: 0,
    minutesWithContingency: 0,
    costCents: 0,
    storyPoints: 0,
    tasks: 0,
    hoursPerDay,
    days: 0
  })
  for (const m of state.members.values()) rows.set(m.id, blank(m.id, m.hoursPerDay))
  for (const id of taskIds) {
    const task = state.tasks.get(id)
    const m = own.get(id)
    if (!task || !m) continue
    const key = task.assigneeId && state.members.has(task.assigneeId) ? task.assigneeId : null
    if (key === null && m.minutes === 0) continue
    let row = rows.get(key)
    if (!row) {
      row = blank(null, state.meta.defaultHoursPerDay)
      rows.set(null, row)
    }
    row.minutes += m.minutes
    row.costCents += m.costCents
    row.storyPoints = Math.round((row.storyPoints + m.storyPoints) * 100) / 100
    row.tasks += 1
  }
  const out: WorkloadRow[] = []
  for (const row of rows.values()) {
    row.minutesWithContingency = row.minutes + applyBps(row.minutes, state.meta.contingencyBps)
    row.days = row.hoursPerDay > 0 ? row.minutesWithContingency / 60 / row.hoursPerDay : 0
    out.push({ ...row })
  }
  return out
}

export function scheduleFor(meta: ProjectMeta, rows: readonly WorkloadRow[]): Schedule {
  let bottleneck: WorkloadRow | null = null
  for (const r of rows) if (r.days > 0 && (!bottleneck || r.days > bottleneck.days)) bottleneck = r
  const days = bottleneck?.days ?? 0
  const perWeek = meta.workingWeekdays.length
  return {
    days,
    weeks: perWeek > 0 ? days / perWeek : null,
    endDate: meta.startDate && days > 0 ? endDateAfterWorkingDays(meta.startDate, days, meta.workingWeekdays) : null,
    bottleneck
  }
}
