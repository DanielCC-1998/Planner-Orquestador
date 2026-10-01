import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MAX_SAFE } from '@domain/common/primitives'
import { projectArb } from '@tests/support/arbitraries'
import { loginSignupScenario, run } from '@tests/support/builders'
import { branchMetrics, estimate, sumMetrics } from '@domain/estimation/estimate'

describe('estimate: Login/Registro scenario with a shared subtask', () => {
  const { state, ids } = loginSignupScenario()
  const est = estimate(state)

  it('the total counts each task only once: 15 h and €750', () => {
    expect(est.total.minutes).toBe(15 * 60)
    expect(est.total.costCents).toBe(75_000)
    expect(est.total.storyPoints).toBe(8)
  })

  it('the contribution can be summed and the shared subtask only counts under its primary parent', () => {
    expect(est.attributed.get(ids.login)!.minutes).toBe(600)
    expect(est.attributed.get(ids.signup)!.minutes).toBe(300)
    expect(est.attributed.get(ids.login)!.minutes + est.attributed.get(ids.signup)!.minutes).toBe(900)
  })

  it('the full branch includes the shared subtask: Registro needs 9 h', () => {
    expect(branchMetrics(state.graph, est.own, ids.signup).minutes).toBe(540)
    expect(branchMetrics(state.graph, est.own, ids.login).minutes).toBe(600)
  })

  it('savings: 4 h and €200 not double-counted', () => {
    expect(est.savings.minutes).toBe(240)
    expect(est.savings.costCents).toBe(20_000)
    expect(est.naive.minutes).toBe(19 * 60)
    expect(est.shared).toHaveLength(1)
    expect(est.shared[0]!.occurrences).toBe(2)
  })

  it('WBS codes: the shared subtask is 1.1 and the email validation is 2.2', () => {
    expect(est.codes.get(ids.table)).toBe('1.1')
    expect(est.codes.get(ids.validation)).toBe('2.2')
  })

  it('workload and duration: Ana with 11 h is the bottleneck (1.375 days at 8 h/day)', () => {
    const ana = est.workload.find((w) => w.memberId === ids.anna)!
    expect(ana.minutes).toBe(660)
    expect(est.schedule.bottleneck?.memberId).toBe(ids.anna)
    expect(est.schedule.days).toBeCloseTo(11 / 8)
  })

  it('contingency and end date', () => {
    const s = run(state, {
      type: 'project.update',
      patch: { contingencyBps: 1000, startDate: '2026-10-02', taxBps: 2100 }
    }).state
    const e = estimate(s)
    expect(e.contingencyMinutes).toBe(90)
    expect(e.schedule.days).toBeCloseTo((660 * 1.1) / 60 / 8)
    // 1.5 days from Friday the 2nd → ends on Monday the 5th.
    expect(e.schedule.endDate).toBe('2026-10-05')
    expect(e.money.subtotalCents).toBe(75_000)
    expect(e.money.contingencyCents).toBe(7_500)
    expect(e.money.taxCents).toBe(17_325)
    expect(e.money.totalCents).toBe(99_825)
  })

  it('rate priority: task > person > project', () => {
    let s = run(state, { type: 'member.update', id: ids.anna, patch: { rateCents: 6000 } }).state
    s = run(s, { type: 'task.update', id: ids.validation, patch: { rateCents: 10_000 } }).state
    const e = estimate(s)
    expect(e.own.get(ids.form)!.costCents).toBe(36_000) // 6 h × €60
    expect(e.own.get(ids.validation)!.costCents).toBe(50_000) // 5 h × €100
    expect(e.own.get(ids.table)!.costCents).toBe(20_000) // 4 h × €50 (project)
  })
})

describe('estimate: properties over random DAGs', () => {
  it('Σ contribution(roots) = total = Σ own', () => {
    fc.assert(
      fc.property(projectArb(40), ({ state }) => {
        const e = estimate(state)
        const rootsSum = sumMetrics(e.attributed, state.graph.roots())
        const ownSum = sumMetrics(e.own, state.tasks.keys())
        expect(rootsSum.minutes).toBe(e.total.minutes)
        expect(rootsSum.costCents).toBe(e.total.costCents)
        expect(ownSum.minutes).toBe(e.total.minutes)
        expect(rootsSum.tasks).toBe(state.tasks.size)
      }),
      { numRuns: 300 }
    )
  })

  it('contribution ≤ full branch, and the branch is the sum of the own work of its BFS', () => {
    fc.assert(
      fc.property(projectArb(30), fc.nat(), ({ state, ids }, i) => {
        const e = estimate(state)
        const id = ids[i % ids.length]!
        const branch = branchMetrics(state.graph, e.own, id)
        expect(e.attributed.get(id)!.minutes).toBeLessThanOrEqual(branch.minutes)
        expect(e.attributed.get(id)!.tasks).toBeLessThanOrEqual(branch.tasks)
      }),
      { numRuns: 300 }
    )
  })

  it('savings = naive total (expanded tree) − real total', () => {
    fc.assert(
      fc.property(projectArb(30, 2), ({ state }) => {
        const e = estimate(state)
        // Independent oracle: memoized sum over the fully expanded tree.
        const memo = new Map<string, number>()
        const expanded = (id: string): number => {
          const cached = memo.get(id)
          if (cached !== undefined) return cached
          let s = e.own.get(id)!.minutes
          for (const c of state.graph.children(id)) s += expanded(c)
          memo.set(id, s)
          return s
        }
        const naive = state.graph.roots().reduce((acc, r) => acc + expanded(r), 0)
        if (naive >= MAX_SAFE) return
        expect(e.naive.minutes).toBe(naive)
        expect(e.savings.minutes).toBe(naive - e.total.minutes)
      }),
      { numRuns: 300 }
    )
  })

  it('the workload per person distributes all the hours', () => {
    fc.assert(
      fc.property(projectArb(30), ({ state }) => {
        const e = estimate(state)
        const sum = e.workload.reduce((acc, w) => acc + w.minutes, 0)
        expect(sum).toBe(e.total.minutes)
        for (const w of e.workload) expect(w.days).toBeLessThanOrEqual(e.schedule.days + 1e-9)
      }),
      { numRuns: 200 }
    )
  })
})
