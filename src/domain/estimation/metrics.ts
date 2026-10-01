import { saturatingAdd, saturatingMul } from '../common/primitives'

/** Quantities that add up over a set of tasks. All integers except story points. */
export interface Metrics {
  readonly minutes: number
  readonly storyPoints: number
  readonly costCents: number
  readonly doneMinutes: number
  readonly tasks: number
  readonly doneTasks: number
  /** Leaves without an estimate. */
  readonly unestimated: number
  /** Tasks with hours but no applicable rate. */
  readonly unpriced: number
  /** Tasks with hours but no assignee. */
  readonly unassigned: number
}

export const ZERO_METRICS: Metrics = Object.freeze({
  minutes: 0,
  storyPoints: 0,
  costCents: 0,
  doneMinutes: 0,
  tasks: 0,
  doneTasks: 0,
  unestimated: 0,
  unpriced: 0,
  unassigned: 0
})

const roundSp = (n: number) => Math.round(n * 100) / 100

export function addMetrics(a: Metrics, b: Metrics): Metrics {
  return {
    minutes: saturatingAdd(a.minutes, b.minutes),
    storyPoints: roundSp(a.storyPoints + b.storyPoints),
    costCents: saturatingAdd(a.costCents, b.costCents),
    doneMinutes: saturatingAdd(a.doneMinutes, b.doneMinutes),
    tasks: saturatingAdd(a.tasks, b.tasks),
    doneTasks: saturatingAdd(a.doneTasks, b.doneTasks),
    unestimated: saturatingAdd(a.unestimated, b.unestimated),
    unpriced: saturatingAdd(a.unpriced, b.unpriced),
    unassigned: saturatingAdd(a.unassigned, b.unassigned)
  }
}

export function scaleMetrics(m: Metrics, k: number): Metrics {
  return {
    minutes: saturatingMul(m.minutes, k),
    storyPoints: roundSp(m.storyPoints * k),
    costCents: saturatingMul(m.costCents, k),
    doneMinutes: saturatingMul(m.doneMinutes, k),
    tasks: saturatingMul(m.tasks, k),
    doneTasks: saturatingMul(m.doneTasks, k),
    unestimated: saturatingMul(m.unestimated, k),
    unpriced: saturatingMul(m.unpriced, k),
    unassigned: saturatingMul(m.unassigned, k)
  }
}

/** Mutable, to accumulate in hot loops without creating objects. */
export type MetricsAcc = { -readonly [K in keyof Metrics]: number }

export function accumulator(): MetricsAcc {
  return { ...ZERO_METRICS }
}

export function accumulate(acc: MetricsAcc, m: Metrics): void {
  acc.minutes = saturatingAdd(acc.minutes, m.minutes)
  acc.storyPoints = roundSp(acc.storyPoints + m.storyPoints)
  acc.costCents = saturatingAdd(acc.costCents, m.costCents)
  acc.doneMinutes = saturatingAdd(acc.doneMinutes, m.doneMinutes)
  acc.tasks = saturatingAdd(acc.tasks, m.tasks)
  acc.doneTasks = saturatingAdd(acc.doneTasks, m.doneTasks)
  acc.unestimated = saturatingAdd(acc.unestimated, m.unestimated)
  acc.unpriced = saturatingAdd(acc.unpriced, m.unpriced)
  acc.unassigned = saturatingAdd(acc.unassigned, m.unassigned)
}

/** Progress 0‥1: by hours if there are hours; otherwise by number of tasks. */
export function progressOf(m: Metrics): number {
  if (m.minutes > 0) return m.doneMinutes / m.minutes
  if (m.tasks > 0) return m.doneTasks / m.tasks
  return 0
}
