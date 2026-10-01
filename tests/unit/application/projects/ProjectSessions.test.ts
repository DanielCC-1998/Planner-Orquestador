import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { InMemoryProjectRepository } from '@infrastructure/persistence/memory/InMemoryProjectRepository'
import { applyDelta } from '@shared/ipc/applyDelta'
import {
  fromProjectData,
  MAX_TITLE_LENGTH,
  ok,
  toProjectData,
  type Command,
  type ProjectId,
  type ProjectState,
  type Result
} from '@domain'
import type { LoadedProject, RepoError } from '@application/ports'
import { projectArb } from '@tests/support/arbitraries'
import { fixedClock, loginSignupScenario, testId } from '@tests/support/builders'
import { ProjectSessions } from '@application/projects/ProjectSessions'

/** Repository whose projects come from a newer version of the app (they open read-only). */
class NewerVersionRepository extends InMemoryProjectRepository {
  override async load(id: ProjectId): Promise<Result<LoadedProject, RepoError>> {
    const loaded = await super.load(id)
    return loaded.ok ? ok({ ...loaded.value, readOnly: true }) : loaded
  }
}

function setup(state: ProjectState, repo = new InMemoryProjectRepository()) {
  repo.store.set(state.meta.id, state)
  const sessions = new ProjectSessions({
    repo,
    clock: fixedClock(),
    ids: { next: testId }
  })
  return { repo, sessions, id: state.meta.id }
}

/** The order of the task map has no meaning (the graph gives the visible order). */
const dataOf = (s: ProjectState) => {
  const w = JSON.parse(JSON.stringify(toProjectData(s)))
  w.tasks.sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))
  return w
}

/** Random commands (valid or not) built from indices. */
function commandFrom(state: ProjectState, [a, b, c, d]: [number, number, number, number]): Command {
  const ids = [...state.tasks.keys()]
  const pick = (n: number) => ids[n % Math.max(1, ids.length)]
  const child = pick(b)
  if (!child) return { type: 'task.create', parentId: null, fields: { title: 'x', estimateMinutes: d % 500 } }
  const ps = state.graph.parents(child)
  const from = ps.length ? ps[c % ps.length]! : null
  switch (a % 6) {
    case 0:
      return { type: 'task.create', parentId: d % 2 ? pick(c)! : null, fields: { estimateMinutes: d % 500 } }
    case 1:
      return { type: 'edge.link', parentId: pick(c)!, childId: child }
    case 2:
      return { type: 'edge.move', childId: child, fromParentId: from, toParentId: d % 3 ? pick(d)! : null, index: d % 3 }
    case 3:
      return { type: 'task.delete', id: child, mode: d % 2 ? 'cascade' : 'splice' }
    case 4:
      return { type: 'task.update', id: child, patch: { status: 'done', storyPoints: d % 13 } }
    default:
      return { type: 'project.update', patch: { contingencyBps: d % 3000 } }
  }
}

describe('ProjectSessions', () => {
  it('undo and redo go through the exact states', async () => {
    const { state, ids } = loginSignupScenario()
    const { sessions, id, repo } = setup(state)
    await sessions.open(id)
    const r1 = await sessions.execute(id, { type: 'task.update', id: ids.table, patch: { estimateMinutes: 480 } })
    expect(r1.ok && r1.value.canUndo).toBe(true)
    const afterEdit = sessions.current(id)!
    await sessions.undo(id)
    expect(sessions.current(id)).toBe(state)
    await sessions.redo(id)
    expect(sessions.current(id)).toBe(afterEdit)
    expect(repo.store.get(id)).toBe(afterEdit)
    const none = await sessions.redo(id)
    expect(none.ok).toBe(false)
  })

  it('a new command clears the redo history', async () => {
    const { state, ids } = loginSignupScenario()
    const { sessions, id } = setup(state)
    await sessions.execute(id, { type: 'task.update', id: ids.table, patch: { title: 'A' } })
    await sessions.undo(id)
    const r = await sessions.execute(id, { type: 'task.update', id: ids.table, patch: { title: 'B' } })
    expect(r.ok && r.value.canRedo).toBe(false)
  })

  it('the delta only carries what changed', async () => {
    const { state, ids } = loginSignupScenario()
    const { sessions, id } = setup(state)
    const r = await sessions.execute(id, { type: 'task.update', id: ids.table, patch: { title: 'Users table' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.tasks).toHaveLength(1)
    expect(r.value.structure).toBeUndefined()
    expect(r.value.members).toBeUndefined()
  })

  it('errors carry the reason the UI translates, and domain errors pass through unchanged', async () => {
    const { state, ids } = loginSignupScenario()
    const { sessions, id } = setup(state)
    expect(await sessions.undo(id)).toMatchObject({ ok: false, error: { code: 'NOTHING', reason: 'NOTHING_TO_UNDO' } })
    expect(await sessions.redo(id)).toMatchObject({ ok: false, error: { code: 'NOTHING', reason: 'NOTHING_TO_REDO' } })
    const cycle = await sessions.execute(id, { type: 'edge.link', parentId: ids.table, childId: ids.login })
    expect(cycle).toMatchObject({ ok: false, error: { code: 'CYCLE', reason: 'CYCLE_LINK' } })
    const tooLong = await sessions.execute(id, {
      type: 'task.update',
      id: ids.table,
      patch: { title: 'x'.repeat(MAX_TITLE_LENGTH + 1) }
    })
    expect(tooLong).toMatchObject({ ok: false, error: { code: 'INVALID', reason: 'TITLE_TOO_LONG' } })
  })

  it('a project from a newer version of the app cannot be changed', async () => {
    const { state, ids } = loginSignupScenario()
    const { sessions, id } = setup(state, new NewerVersionRepository())
    const snapshot = await sessions.open(id)
    expect(snapshot.ok && snapshot.value.readOnly).toBe(true)
    const edit = await sessions.execute(id, { type: 'task.update', id: ids.table, patch: { estimateMinutes: 60 } })
    expect(edit).toMatchObject({ ok: false, error: { code: 'READ_ONLY', reason: 'READ_ONLY_NEWER' } })
    expect(await sessions.undo(id)).toMatchObject({ ok: false, error: { code: 'READ_ONLY', reason: 'READ_ONLY' } })
  })

  it('applying the deltas in the UI reproduces the state of main (undo/redo too)', async () => {
    await fc.assert(
      fc.asyncProperty(
        projectArb(12),
        fc.array(fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()), { maxLength: 20 }),
        fc.nat(),
        async ({ state }, ops, undos) => {
          const { sessions, id } = setup(state)
          const snap = await sessions.open(id)
          if (!snap.ok) throw new Error(snap.error.message)
          const initial = fromProjectData(snap.value)
          if (!initial.ok) throw new Error(initial.error.message)
          let client = initial.value
          for (const op of ops) {
            const r = await sessions.execute(id, commandFrom(sessions.current(id)!, op))
            if (r.ok) client = applyDelta(client, r.value)
          }
          expect(dataOf(client)).toEqual(dataOf(sessions.current(id)!))
          const final = sessions.current(id)!
          const k = undos % (ops.length + 1)
          for (let i = 0; i < k; i++) {
            const r = await sessions.undo(id)
            if (r.ok) client = applyDelta(client, r.value)
          }
          expect(dataOf(client)).toEqual(dataOf(sessions.current(id)!))
          for (let i = 0; i < k; i++) {
            const r = await sessions.redo(id)
            if (r.ok) client = applyDelta(client, r.value)
          }
          expect(sessions.current(id)).toBe(final)
          expect(dataOf(client)).toEqual(dataOf(final))
        }
      ),
      { numRuns: 100 }
    )
  })
})
