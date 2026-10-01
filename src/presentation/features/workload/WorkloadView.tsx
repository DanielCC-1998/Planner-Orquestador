import { useMemo } from 'react'
import { AlertTriangle, CalendarDays, Star, UserRound, Users } from 'lucide-react'
import { branchTaskIds, scheduleFor, workloadFor } from '@domain'
import { Rich } from '../../components/Rich'
import { Button } from '../../components/ui/button'
import { Avatar, EmptyState, Tooltip } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/cn'
import { useProject } from '../../stores/project'
import { useUi } from '../../stores/ui'

/** Workload per person over the unique tasks in scope (project or focused branch). */
export function WorkloadView() {
  const { t, f } = useI18n()
  const state = useProject((s) => s.state)!
  const est = useProject((s) => s.estimation)!
  const focusId = useUi((s) => s.focusId)
  const openDialog = useUi((s) => s.openDialog)

  const { rows, schedule } = useMemo(() => {
    const ids = focusId ? branchTaskIds(state.graph, focusId) : state.graph.nodes()
    const rows = workloadFor(state, est.own, ids)
    return { rows, schedule: scheduleFor(state.meta, rows) }
  }, [state, est, focusId])

  const cur = state.meta.currency
  const maxDays = Math.max(...rows.map((r) => r.days), 0)
  const bottleneck = schedule.bottleneck

  const filterBy = (memberId: string | null) => {
    const ui = useUi.getState()
    ui.setFilters({ assignees: [memberId ?? 'none'] })
    ui.setView('tree')
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title={t.workload.emptyTitle}
        description={t.workload.emptyHint}
        action={
          <Button variant="primary" onClick={() => openDialog({ type: 'team' })}>
            <Users /> {t.workload.manageTeam}
          </Button>
        }
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
        <div className="grid grid-cols-[1fr_auto] items-start gap-4 rounded-xl border bg-card p-5">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.workload.duration(focusId ? (est.codes.get(focusId) ?? '') : null)}
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {schedule.days > 0 ? f.days(schedule.days) : '—'}
              {schedule.weeks !== null && schedule.days > 0 ? (
                <span className="ml-2 text-base font-medium text-muted-foreground">≈ {f.weeks(schedule.weeks)}</span>
              ) : null}
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{t.workload.explanation(state.meta.contingencyBps > 0)}</p>
            {bottleneck?.memberId === null ? (
              <div className="mt-1 flex items-center gap-2 text-sm text-warning">
                <AlertTriangle className="size-4" /> {t.workload.unassignedBottleneck}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            {schedule.endDate ? (
              <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                <CalendarDays className="size-4" /> <Rich text={t.workload.estimatedEnd(f.date(schedule.endDate))} />
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => openDialog({ type: 'projectSettings' })}>
                <CalendarDays /> {t.workload.setStartDate}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => openDialog({ type: 'team' })}>
              <Users /> {t.workload.editTeam}
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">{t.workload.columns.person}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.workload.columns.capacity}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.workload.columns.tasks}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.workload.columns.hours}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.workload.columns.storyPoints}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.workload.columns.cost}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.workload.columns.days}</th>
                <th className="w-[30%] px-4 py-2 text-left font-semibold">{t.workload.columns.load}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const member = r.memberId ? state.members.get(r.memberId) : undefined
                const isBottleneck = bottleneck !== null && bottleneck.memberId === r.memberId && r.days > 0
                return (
                  <tr
                    key={r.memberId ?? 'none'}
                    onClick={() => filterBy(r.memberId)}
                    className={cn('cursor-pointer border-t hover:bg-row-hover', isBottleneck && 'bg-accent/40')}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {member ? (
                          <Avatar name={member.name} initials={member.initials} color={member.color} size="lg" />
                        ) : (
                          <span className="inline-flex size-8 items-center justify-center rounded-full border border-dashed text-muted-foreground">
                            <UserRound className="size-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium">
                            {member?.name ?? t.common.unassigned}
                            {isBottleneck ? (
                              <Tooltip content={t.workload.setsDuration}>
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                                  <Star className="size-3 fill-current" /> {t.workload.pace}
                                </span>
                              </Tooltip>
                            ) : null}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {member ? member.role || t.workload.noRole : t.workload.unassignedTasks}
                            {member?.rateCents != null ? ` · ${f.money(member.rateCents, cur)}/h` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 text-right tabular-nums">{t.workload.hoursPerDay(f.number(r.hoursPerDay))}</td>
                    <td className="px-3 text-right tabular-nums">{r.tasks}</td>
                    <td className="px-3 text-right tabular-nums">{f.hours(r.minutes)}</td>
                    <td className="px-3 text-right tabular-nums">{f.storyPoints(r.storyPoints)}</td>
                    <td className="px-3 text-right tabular-nums">{f.money(r.costCents, cur, false)}</td>
                    <td className="px-3 text-right font-semibold tabular-nums">{f.number(r.days, 1)}</td>
                    <td className="px-4">
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', isBottleneck ? 'bg-primary' : r.memberId === null ? 'bg-warning' : 'bg-primary/55')}
                          style={{ width: `${maxDays > 0 ? (r.days / maxDays) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">{t.workload.rowHint}</p>
      </div>
    </div>
  )
}
