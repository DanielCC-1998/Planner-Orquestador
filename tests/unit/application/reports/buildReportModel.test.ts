import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { apply, estimate, type TaskStatus } from '@domain'
import { projectArb } from '@tests/support/arbitraries'
import { loginSignupScenario, run, testContext } from '@tests/support/builders'
import { EMPTY_ISSUER } from '@application/settings/Settings'
import { buildReportModel } from '@application/reports/buildReportModel'
import { DEFAULT_REPORT_OPTIONS, type ReportRow } from '@application/reports/ReportModel'

const NOW = '2026-09-30T10:00:00.000Z'

type TaskRow = Extract<ReportRow, { kind: 'task' }>
const taskRows = (rows: readonly ReportRow[]) => rows.filter((r): r is TaskRow => r.kind === 'task')

describe('buildReportModel', () => {
  it('plan scenario: a table that adds up, with a "see 1.1" reference', () => {
    const { state } = loginSignupScenario()
    const m = buildReportModel(state, DEFAULT_REPORT_OPTIONS, EMPTY_ISSUER, { now: NOW })
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
    const m = buildReportModel(described, DEFAULT_REPORT_OPTIONS, EMPTY_ISSUER, { now: NOW })
    const table = taskRows(m.rows).find((r) => r.title === 'Users table')!
    expect(table.description).toBe('Table with a unique email.\n- Index by email')
    expect(table.path).toEqual(['Login'])
    expect(table.attrMinutes).toBe(240)
    expect(taskRows(m.rows).find((r) => r.title === 'Login')!.description).toBe('')
    const ref = m.rows.find((r) => r.kind === 'reference')!
    expect(ref).not.toHaveProperty('description')
    // With depth 1 the subtask does not appear, so neither does its description.
    const shallow = buildReportModel(described, { ...DEFAULT_REPORT_OPTIONS, maxDepth: 1 }, EMPTY_ISSUER, { now: NOW })
    expect(taskRows(shallow.rows).some((r) => r.description !== '')).toBe(false)
  })

  it('with a limited depth, the reference points to the visible ancestor', () => {
    const { state } = loginSignupScenario()
    const m = buildReportModel(state, { ...DEFAULT_REPORT_OPTIONS, maxDepth: 1 }, EMPTY_ISSUER, { now: NOW })
    expect(m.rows.map((r) => r.kind)).toEqual(['task', 'task'])
    const rows = taskRows(m.rows)
    expect(rows[0]).toMatchObject({ minutes: 600, collapsedCount: 2 })
    expect(rows[1]).toMatchObject({ minutes: 300, collapsedCount: 1 })
  })

  it('the rows that are not subtotals add up exactly to the total for any depth', () => {
    fc.assert(
      fc.property(projectArb(35), fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }), fc.integer({ min: 0, max: 4 }), ({ state }, maxDepth, subtotalDepth) => {
        const est = estimate(state)
        const m = buildReportModel(state, { ...DEFAULT_REPORT_OPTIONS, maxDepth, subtotalDepth }, EMPTY_ISSUER, { now: NOW, estimation: est })
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

describe('buildReportModel: "Task status" section and tags', () => {
  const at = (date: string) => `${date}T10:00:00.000Z`
  const utcDate = (iso: string) => iso.slice(0, 10)
  const withStatus = { ...DEFAULT_REPORT_OPTIONS, columns: { ...DEFAULT_REPORT_OPTIONS.columns, status: true } }

  /** Weekly sprints from Monday Sep 7: Login form finishes in sprint 1, Users table goes back in sprint 4. */
  function progressScenario() {
    const { state, ids } = loginSignupScenario()
    let s = run(state, { type: 'project.update', patch: { startDate: '2026-09-07', sprints: { length: 1, unit: 'week' } } }).state
    const change = (id: string, status: TaskStatus, date: string) => {
      const r = apply(s, { type: 'task.update', id, patch: { status } }, testContext(at(date)))
      if (!r.ok) throw new Error(r.error.message)
      s = r.value.state
    }
    change(ids.form, 'in_progress', '2026-09-08')
    change(ids.form, 'done', '2026-09-10')
    change(ids.table, 'done', '2026-09-09')
    change(ids.table, 'review', '2026-09-29')
    return { state: s, ids }
  }

  it('is only built when the status option is on', () => {
    const { state } = progressScenario()
    expect(buildReportModel(state, DEFAULT_REPORT_OPTIONS, EMPTY_ISSUER, { now: NOW }).progress).toBeNull()
    expect(buildReportModel(state, withStatus, EMPTY_ISSUER, { now: NOW }).progress).not.toBeNull()
  })

  it('lanes hold every task by status (parents too, whatever the depth), sorted by WBS code', () => {
    const { state } = progressScenario()
    const p = buildReportModel(state, { ...withStatus, maxDepth: 1 }, EMPTY_ISSUER, { now: NOW, localDate: utcDate }).progress!
    expect([p.lanes.todo.length, p.lanes.in_progress.length, p.lanes.review.length, p.lanes.done.length]).toEqual([3, 0, 1, 1])
    expect(p.lanes.todo.map((t) => [t.code, t.title, t.isParent])).toEqual([
      ['1', 'Login', true],
      ['2', 'Sign-up', true],
      ['2.2', 'Email validation', false]
    ])
    expect(p.lanes.review.map((t) => t.title)).toEqual(['Users table'])
    expect(p.lanes.done.map((t) => t.title)).toEqual(['Login form'])
  })

  it('sprints carry the net change of each task, sorted by code, up to the current sprint', () => {
    const { state } = progressScenario()
    const p = buildReportModel(state, withStatus, EMPTY_ISSUER, { now: NOW, localDate: utcDate }).progress!
    expect(p).toMatchObject({ asOf: '2026-09-30', sprintStart: '2026-09-07', sprintSettings: { length: 1, unit: 'week' } })
    expect(p.sprints.map((s) => [s.number, s.start, s.end, s.current])).toEqual([
      [1, '2026-09-07', '2026-09-13', false],
      [2, '2026-09-14', '2026-09-20', false],
      [3, '2026-09-21', '2026-09-27', false],
      [4, '2026-09-28', '2026-10-04', true]
    ])
    expect(p.sprints[0]!.changes.map((c) => [c.code, c.title, c.from, c.to, c.direction])).toEqual([
      ['1.1', 'Users table', 'todo', 'done', 'forward'],
      ['1.2', 'Login form', 'todo', 'done', 'forward']
    ])
    expect(p.sprints[3]!.changes.map((c) => [c.title, c.from, c.to, c.direction])).toEqual([['Users table', 'done', 'review', 'backward']])
    // Without sprints there is nothing to group by.
    const off = run(state, { type: 'project.update', patch: { sprints: null } }).state
    expect(buildReportModel(off, withStatus, EMPTY_ISSUER, { now: NOW }).progress).toMatchObject({ sprintSettings: null, sprints: [] })
  })

  it('the date of the report is the local one', () => {
    const { state } = progressScenario()
    const tomorrow = () => '2026-10-01'
    const m = buildReportModel(state, withStatus, EMPTY_ISSUER, { now: NOW, localDate: tomorrow })
    expect(m.project.quoteDate).toBe('2026-10-01')
    expect(m.progress!.asOf).toBe('2026-10-01')
  })

  it('task rows carry their tags, in the order of the project list', () => {
    const { state, ids } = loginSignupScenario()
    const qa = run(state, { type: 'tag.create', name: 'QA', color: 'teal' })
    const design = run(qa.state, { type: 'tag.create', name: 'Design', color: 'pink', assignTo: [ids.form] })
    const tagged = run(design.state, { type: 'tag.assign', ids: [ids.form], tagId: qa.id, assigned: true }).state
    const m = buildReportModel(tagged, DEFAULT_REPORT_OPTIONS, EMPTY_ISSUER, { now: NOW })
    expect(taskRows(m.rows).find((r) => r.title === 'Login form')!.tags).toEqual([
      { name: 'QA', color: 'teal' },
      { name: 'Design', color: 'pink' }
    ])
  })
})

describe('buildReportModel with hours from story points', () => {
  it('derived hours appear in the rows and the table still adds up to the total', () => {
    const { state, ids } = loginSignupScenario()
    const cleared = run(state, { type: 'task.update', id: ids.table, patch: { estimateMinutes: null } }).state
    const scaled = { ...cleared, meta: { ...cleared.meta, pointScale: { minutesPerPoint: 60, overrides: [] } } }
    const m = buildReportModel(scaled, DEFAULT_REPORT_OPTIONS, EMPTY_ISSUER, { now: NOW })
    expect(taskRows(m.rows).find((r) => r.title === 'Users table')!.minutes).toBe(120)
    expect(taskRows(m.rows).reduce((a, r) => a + r.minutes, 0)).toBe(m.summary.totalMinutes)
    expect(m.summary.totalMinutes).toBe(13 * 60)
  })
})
