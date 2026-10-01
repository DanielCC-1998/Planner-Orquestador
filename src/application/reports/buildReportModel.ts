import {
  addCalendarDays,
  codeDepth,
  codePrefix,
  effectiveRate,
  estimate,
  isoDateOf,
  type Estimation,
  type ProjectState,
  type TaskId
} from '@domain'
import type { Issuer } from '../settings/Settings'
import type { ReportModel, ReportOptions, ReportRow } from './ReportModel'

/**
 * Builds the PDF model. The breakdown walks the forest of primary parents: each task appears
 * ONCE with amounts; under its other parents it appears as a reference without amounts. That
 * way the non-subtotal rows add up exactly to the total.
 *
 * Texts are raw data (titles may be '', the unassigned group has no name): the renderer adds
 * the localized placeholders, because the application layer does not know about languages.
 */
export function buildReportModel(
  state: ProjectState,
  options: ReportOptions,
  issuer: Issuer,
  now: string,
  est: Estimation = estimate(state)
): ReportModel {
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

  const quoteDate = meta.quote.date ?? isoDateOf(now)
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
