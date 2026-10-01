import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { estimate, sumMetrics } from '@domain/estimation/estimate'
import { assertGraphInvariants, projectArb } from '@tests/support/arbitraries'
import { loginSignupScenario, newState, run, testContext } from '@tests/support/builders'
import { apply } from '@domain/project/apply'
import type { Command } from '@domain/project/commands'
import { MAX_TITLE_LENGTH } from '@domain'

describe('apply', () => {
  it('creates nested tasks with no depth limit', () => {
    let s = newState()
    let parent: string | null = null
    for (let depth = 0; depth < 60; depth++) {
      const r = run(s, { type: 'task.create', parentId: parent, fields: { title: `Level ${depth}` } })
      s = r.state
      parent = r.id
    }
    expect(s.tasks.size).toBe(60)
    expect(s.graph.roots()).toHaveLength(1)
    assertGraphInvariants(s)
  })

  it('validates fields and references', () => {
    const s = newState()
    const ctx = testContext()
    expect(apply(s, { type: 'task.create', parentId: null, fields: { estimateMinutes: -1 } }, ctx).ok).toBe(false)
    expect(apply(s, { type: 'task.create', parentId: null, fields: { assigneeId: 'x' } }, ctx).ok).toBe(false)
    expect(apply(s, { type: 'project.update', patch: { currency: 'euro' } }, ctx).ok).toBe(false)
    expect(apply(s, { type: 'project.update', patch: { name: '  ' } }, ctx).ok).toBe(false)
    expect(apply(s, { type: 'member.add', fields: { name: 'Ana', hoursPerDay: 0 } }, ctx).ok).toBe(false)
  })

  it('does not mutate the previous state and shares what does not change', () => {
    const { state, ids } = loginSignupScenario()
    const next = run(state, { type: 'task.update', id: ids.form, patch: { status: 'done' } }).state
    expect(state.tasks.get(ids.form)!.status).toBe('todo')
    expect(next.tasks.get(ids.table)).toBe(state.tasks.get(ids.table))
    expect(next.graph).toBe(state.graph)
  })

  it('cascade-deleting a branch keeps the shared subtask that is still under another one', () => {
    const { state, ids } = loginSignupScenario()
    const next = run(state, { type: 'task.delete', id: ids.login, mode: 'cascade' }).state
    expect(next.tasks.has(ids.form)).toBe(false)
    expect(next.tasks.has(ids.table)).toBe(true)
    expect(next.graph.parents(ids.table)).toEqual([ids.signup])
    const e = estimate(next)
    expect(e.total.minutes).toBe(540)
  })

  it('removing a person reassigns their tasks', () => {
    const { state, ids } = loginSignupScenario()
    const next = run(state, { type: 'member.remove', id: ids.anna, reassignTo: ids.james }).state
    expect(next.tasks.get(ids.form)!.assigneeId).toBe(ids.james)
    expect(next.members.has(ids.anna)).toBe(false)
  })

  it('duplicating puts the copy right after the original', () => {
    const { state, ids } = loginSignupScenario()
    const r = run(state, { type: 'task.duplicate', id: ids.login, parentId: null, title: 'Login (copy)' })
    expect(r.state.graph.roots()[1]).toBe(r.created[0])
    expect(r.state.tasks.get(r.created[0]!)!.title).toBe('Login (copy)')
    // The copy does not share the subtask with the original: they are new tasks.
    expect(r.state.tasks.size).toBe(state.tasks.size + 3)
  })

  it('duplicate keeps the title when none is given and clamps a long one to the limit', () => {
    const { state, ids } = loginSignupScenario()
    const same = run(state, { type: 'task.duplicate', id: ids.login, parentId: null })
    expect(same.state.tasks.get(same.created[0]!)!.title).toBe('Login')
    const long = run(state, { type: 'task.duplicate', id: ids.login, parentId: null, title: 'x'.repeat(400) })
    expect(long.state.tasks.get(long.created[0]!)!.title).toHaveLength(MAX_TITLE_LENGTH)
  })

  it('random command sequences keep the invariants and the total adds up', () => {
    const opsArb = fc.array(fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat(), fc.nat()), { maxLength: 25 })
    fc.assert(
      fc.property(projectArb(15), opsArb, (gen, ops) => {
        let s = gen.state
        for (const [a, b, c, d, e] of ops) {
          const ids = [...s.tasks.keys()]
          if (ids.length === 0) break
          const pick = (n: number) => ids[n % ids.length]!
          const child = pick(b)
          const ps = s.graph.parents(child)
          const from = ps.length ? ps[c % ps.length]! : null
          let cmd: Command
          switch (a % 7) {
            case 0:
              cmd = { type: 'task.create', parentId: d % 3 === 0 ? null : pick(c), index: e % 4, fields: { estimateMinutes: e % 300 } }
              break
            case 1:
              cmd = { type: 'edge.link', parentId: pick(c), childId: child }
              break
            case 2:
              cmd = from ? { type: 'edge.unlink', parentId: from, childId: child } : { type: 'edge.unlink', parentId: pick(c), childId: child }
              break
            case 3:
              cmd = { type: 'edge.move', childId: child, fromParentId: from, toParentId: d % 4 === 0 ? null : pick(d), index: e % 5 }
              break
            case 4:
              cmd = { type: 'task.delete', id: child, mode: d % 2 === 0 ? 'cascade' : 'splice' }
              break
            case 5:
              cmd = from ? { type: 'edge.setPrimary', parentId: from, childId: child } : { type: 'task.update', id: child, patch: { status: 'done' } }
              break
            default:
              cmd = { type: 'task.duplicate', id: child, parentId: from }
          }
          const before = s
          const r = apply(s, cmd, testContext())
          if (!r.ok) {
            continue
          }
          s = r.value.state
          assertGraphInvariants(s)
          const est = estimate(s)
          expect(sumMetrics(est.attributed, s.graph.roots()).minutes).toBe(est.total.minutes)
          if (cmd.type === 'task.delete' && cmd.mode === 'cascade') {
            const removed = [...before.tasks.keys()].filter((id) => !s.tasks.has(id))
            const removedMinutes = removed.reduce((acc, id) => acc + (before.tasks.get(id)!.estimateMinutes ?? 0), 0)
            expect(estimate(before).total.minutes - est.total.minutes).toBe(removedMinutes)
          }
        }
      }),
      { numRuns: 150 }
    )
  })
})
