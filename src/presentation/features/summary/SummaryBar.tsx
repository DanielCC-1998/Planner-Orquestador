import { useMemo } from 'react'
import { AlertTriangle, Link2 } from 'lucide-react'
import {
  applyBps,
  branchTaskIds,
  moneyBreakdown,
  progressOf,
  scheduleFor,
  sumMetrics,
  workloadFor
} from '@domain'
import { ProgressBar, Tooltip } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/cn'
import { useProject } from '../../stores/project'
import { useUi, type FilterFlag } from '../../stores/ui'

function Item({ label, children, tip }: { label: string; children: React.ReactNode; tip?: React.ReactNode }) {
  const body = (
    <div className="flex min-w-0 flex-col leading-tight">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-semibold tabular-nums">{children}</span>
    </div>
  )
  return tip ? <Tooltip content={tip}>{body}</Tooltip> : body
}

/**
 * Totals of the current scope: the whole project, or the focused branch (deduplicated).
 * Clicking a warning filters the tree.
 */
export function SummaryBar() {
  const { t, f } = useI18n()
  const state = useProject((s) => s.state)!
  const est = useProject((s) => s.estimation)!
  const focusId = useUi((s) => s.focusId)
  const filters = useUi((s) => s.filters)
  const setFilters = useUi((s) => s.setFilters)

  const scope = useMemo(() => {
    if (!focusId || !state.graph.has(focusId)) {
      return { label: t.summary.project, total: est.total, schedule: est.schedule, contingency: est.contingencyMinutes, money: est.money }
    }
    const ids = branchTaskIds(state.graph, focusId)
    const total = sumMetrics(est.own, ids)
    return {
      label: t.summary.branch(est.codes.get(focusId) ?? ''),
      total,
      schedule: scheduleFor(state.meta, workloadFor(state, est.own, ids)),
      contingency: applyBps(total.minutes, state.meta.contingencyBps),
      money: moneyBreakdown(total.costCents, state.meta.contingencyBps, state.meta.taxBps)
    }
  }, [focusId, state, est, t])

  const { meta } = state
  const cur = meta.currency
  const taxLabel = meta.taxLabel || t.common.defaultTaxLabel
  const total = scope.total
  const toggleFlag = (flag: FilterFlag) =>
    setFilters({ flags: filters.flags.includes(flag) ? filters.flags.filter((other) => other !== flag) : [...filters.flags, flag] })
  const warnings: Array<{ flag: FilterFlag; count: number; label: string }> = [
    { flag: 'unestimated', count: total.unestimated, label: t.summary.unestimated(total.unestimated) },
    { flag: 'unpriced', count: total.unpriced, label: t.summary.unpriced(total.unpriced) },
    { flag: 'unassigned', count: total.unassigned, label: t.summary.unassigned(total.unassigned) }
  ]
  const bottleneck = scope.schedule.bottleneck

  return (
    <footer className="flex h-14 shrink-0 items-center gap-6 border-t bg-card px-4">
      <span className="shrink-0 rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">{scope.label}</span>
      <Item
        label={t.summary.hours}
        tip={
          scope.contingency > 0
            ? t.summary.hoursTip(f.hours(total.minutes), f.hours(scope.contingency), f.bps(meta.contingencyBps))
            : undefined
        }
      >
        {f.hours(total.minutes + scope.contingency)}
        {scope.contingency > 0 ? (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{t.summary.includesContingency}</span>
        ) : null}
      </Item>
      <Item label={t.summary.storyPoints}>{f.storyPoints(total.storyPoints)}</Item>
      <Item
        label={meta.taxBps > 0 ? t.summary.totalWithTax(taxLabel) : t.summary.cost}
        tip={
          <div className="flex flex-col gap-0.5">
            <span>{t.summary.work(f.money(scope.money.subtotalCents, cur))}</span>
            {meta.contingencyBps > 0 ? (
              <span>{t.summary.contingency(f.bps(meta.contingencyBps), f.money(scope.money.contingencyCents, cur))}</span>
            ) : null}
            {meta.taxBps > 0 ? <span>{t.summary.tax(taxLabel, f.bps(meta.taxBps), f.money(scope.money.taxCents, cur))}</span> : null}
            <span className="font-semibold">{t.summary.total(f.money(scope.money.totalCents, cur))}</span>
          </div>
        }
      >
        {f.money(scope.money.totalCents, cur)}
      </Item>
      <Item
        label={t.summary.duration}
        tip={
          bottleneck
            ? t.summary.durationTip(
                bottleneck.memberId ? (state.members.get(bottleneck.memberId)?.name ?? '') : t.summary.unassignedWork
              )
            : t.summary.noDuration
        }
      >
        {scope.schedule.days > 0 ? f.days(scope.schedule.days) : '—'}
        {scope.schedule.weeks !== null && scope.schedule.days > 0 ? (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ≈ {f.weeks(scope.schedule.weeks)}
            {scope.schedule.endDate ? ` · ${t.summary.endDate(f.date(scope.schedule.endDate))}` : ''}
          </span>
        ) : null}
      </Item>
      <div className="flex w-36 flex-col gap-1">
        <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>{t.summary.progress}</span>
          <span className="tabular-nums">{f.percent(progressOf(total))}</span>
        </div>
        <ProgressBar value={progressOf(total)} />
      </div>
      {!focusId && est.savings.minutes > 0 ? (
        <Tooltip content={t.summary.savingsTip(f.hours(est.savings.minutes), f.money(est.savings.costCents, cur))}>
          <button
            type="button"
            onClick={() => toggleFlag('shared')}
            className={cn(
              'flex items-center gap-1 rounded-full bg-shared-soft px-2.5 py-1 text-xs font-semibold text-shared',
              filters.flags.includes('shared') && 'ring-2 ring-shared'
            )}
          >
            <Link2 className="size-3.5" /> {t.summary.savings(f.hours(est.savings.minutes))}
          </button>
        </Tooltip>
      ) : null}
      <div className="ml-auto flex items-center gap-1.5">
        {warnings
          .filter((w) => w.count > 0)
          .map((w) => (
            <Tooltip key={w.flag} content={t.summary.clickToFilter}>
              <button
                type="button"
                onClick={() => toggleFlag(w.flag)}
                className={cn(
                  'flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/25',
                  filters.flags.includes(w.flag) && 'ring-2 ring-warning'
                )}
              >
                <AlertTriangle className="size-3.5" /> {w.label}
              </button>
            </Tooltip>
          ))}
      </div>
    </footer>
  )
}
