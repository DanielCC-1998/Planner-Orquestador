import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { estimate } from '@domain'
import { projectArb } from '@tests/support/arbitraries'
import { loginSignupScenario, run } from '@tests/support/builders'
import { EMPTY_ISSUER } from '@application/settings/Settings'
import { buildReportModel } from '@application/reports/buildReportModel'
import { DEFAULT_REPORT_OPTIONS, type ReportRow } from '@application/reports/ReportModel'

const NOW = '2026-09-30T10:00:00.000Z'

type TaskRow = Extract<ReportRow, { kind: 'task' }>
const taskRows = (rows: readonly ReportRow[]) => rows.filter((r): r is TaskRow => r.kind === 'task')

describe('buildReportModel', () => {
  it('plan scenario: a table that adds up, with a "see 1.1" reference', () => {
    const { state } = loginSignupScenario()
    const m = buildReportModel(state, DEFAULT_REPORT_OPTIONS, EMPTY_ISSUER, NOW)
    const view = m.rows.map((r) =>
      r.kind === 'reference' ? `${r.code} ↗ ${r.title} (see ${r.refCode})` : `${r.kind === 'subtotal' ? 'Σ' : ''}${r.code} ${r.title} ${r.minutes / 60}h`
    )
    expect(view).toEqual([
      '1 Login 0h',
      '1.1 Users table 4h',
      '1.2 Login form 6h',
      'Σ1 Login 10h',
      '2 Sign-up 0h',
      '2.1 ↗ Users table (see 1.1)',
      '2.2 Email validation 5h',
      'Σ2 Sign-up 5h'
    ])
    expect(taskRows(m.rows).reduce((a, r) => a + r.minutes, 0)).toBe(15 * 60)
    expect(m.summary.savingsMinutes).toBe(240)
    expect(m.shared[0]).toMatchObject({ code: '1.1', occurrences: 2, savedMinutes: 240 })
  })

  it('task rows carry the description and the path; references do not', () => {
    const { state, ids } = loginSignupScenario()
    const described = run(state, {
      type: 'task.update',
      id: ids.table,
      patch: { description: '  Table with a unique email.\n- Index by email  ' }
    }).state
    const m = buildReportModel(described, DEFAULT_REPORT_OPTIONS, EMPTY_ISSUER, NOW)
    const table = taskRows(m.rows).find((r) => r.title === 'Users table')!
    expect(table.description).toBe('Table with a unique email.\n- Index by email')
    expect(table.path).toEqual(['Login'])
    expect(table.attrMinutes).toBe(240)
    expect(taskRows(m.rows).find((r) => r.title === 'Login')!.description).toBe('')
    const ref = m.rows.find((r) => r.kind === 'reference')!
    expect(ref).not.toHaveProperty('description')
    // With depth 1 the subtask does not appear, so neither does its description.
    const shallow = buildReportModel(described, { ...DEFAULT_REPORT_OPTIONS, maxDepth: 1 }, EMPTY_ISSUER, NOW)
    expect(taskRows(shallow.rows).some((r) => r.description !== '')).toBe(false)
  })

  it('with a limited depth, the reference points to the visible ancestor', () => {
    const { state } = loginSignupScenario()
    const m = buildReportModel(state, { ...DEFAULT_REPORT_OPTIONS, maxDepth: 1 }, EMPTY_ISSUER, NOW)
    expect(m.rows.map((r) => r.kind)).toEqual(['task', 'task'])
    const rows = taskRows(m.rows)
    expect(rows[0]).toMatchObject({ minutes: 600, collapsedCount: 2 })
    expect(rows[1]).toMatchObject({ minutes: 300, collapsedCount: 1 })
  })

  it('the rows that are not subtotals add up exactly to the total for any depth', () => {
    fc.assert(
      fc.property(projectArb(35), fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }), fc.integer({ min: 0, max: 4 }), ({ state }, maxDepth, subtotalDepth) => {
        const est = estimate(state)
        const m = buildReportModel(state, { ...DEFAULT_REPORT_OPTIONS, maxDepth, subtotalDepth }, EMPTY_ISSUER, NOW, est)
        const rows = taskRows(m.rows)
        expect(rows.reduce((a, r) => a + r.minutes, 0)).toBe(est.total.minutes)
        expect(rows.reduce((a, r) => a + r.costCents, 0)).toBe(est.total.costCents)
        if (maxDepth === null) {
          expect(rows).toHaveLength(state.tasks.size)
          let edges = 0
          for (const id of state.graph.nodes()) edges += state.graph.children(id).length
          const refs = m.rows.filter((r) => r.kind === 'reference').length
          expect(refs).toBe(edges - (state.tasks.size - state.graph.roots().length))
        }
        // Each subtotal = sum of the task rows of its block.
        m.rows.forEach((row, i) => {
          if (row.kind !== 'subtotal') return
          const start = m.rows.findIndex((r) => r.kind === 'task' && r.code === row.code)
          const block = taskRows(m.rows.slice(start, i))
          expect(block.reduce((a, r) => a + r.minutes, 0)).toBe(row.minutes)
        })
      }),
      { numRuns: 300 }
    )
  })
})
