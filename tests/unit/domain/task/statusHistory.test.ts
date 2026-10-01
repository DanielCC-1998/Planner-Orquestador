import { describe, expect, it } from 'vitest'
import { apply, MAX_STATUS_HISTORY, withStatus, type Command, type ProjectState } from '@domain'
import { ProjectSessions } from '@application/projects/ProjectSessions'
import { InMemoryProjectRepository } from '@infrastructure/persistence/memory/InMemoryProjectRepository'
import { fixedClock, loginSignupScenario, newState, run, testContext, testId } from '@tests/support/builders'

const at = (day: number, hour = 9) => `2026-03-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`

/** Applies a command at a given moment. */
function runAt(state: ProjectState, cmd: Command, now: string) {
  const r = apply(state, cmd, testContext(now))
  if (!r.ok) throw new Error(r.error.message)
  return { state: r.value.state, id: r.value.created[0] ?? '' }
}

describe('status history', () => {
  it('a new task records its creation with its first status', () => {
    const r = runAt(newState(), { type: 'task.create', parentId: null, fields: { title: 'A', status: 'in_progress' } }, at(1))
    expect(r.state.tasks.get(r.id)!.statusHistory).toEqual([{ at: at(1), from: null, to: 'in_progress' }])
  })

  it('only real changes are recorded, with the previous status', () => {
    const created = runAt(newState(), { type: 'task.create', parentId: null, fields: { title: 'A' } }, at(1))
    const id = created.id
    let state = runAt(created.state, { type: 'task.update', id, patch: { status: 'in_progress' } }, at(2)).state
    state = runAt(state, { type: 'task.update', id, patch: { status: 'in_progress', title: 'B' } }, at(3)).state
    state = runAt(state, { type: 'task.bulkUpdate', ids: [id], patch: { status: 'done' } }, at(4)).state
    state = runAt(state, { type: 'task.bulkUpdate', ids: [id], patch: { status: 'done' } }, at(5)).state
    expect(state.tasks.get(id)!.statusHistory).toEqual([
      { at: at(1), from: null, to: 'todo' },
      { at: at(2), from: 'todo', to: 'in_progress' },
      { at: at(4), from: 'in_progress', to: 'done' }
    ])
  })

  it('a duplicate is a new task: its history starts now, with the status of the original', () => {
    const { state, ids } = loginSignupScenario()
    let s = runAt(state, { type: 'task.update', id: ids.form, patch: { status: 'review' } }, at(2)).state
    const copy = runAt(s, { type: 'task.duplicate', id: ids.form, parentId: ids.login }, at(3))
    s = copy.state
    expect(s.tasks.get(copy.id)!.statusHistory).toEqual([{ at: at(3), from: null, to: 'review' }])
    expect(s.tasks.get(ids.form)!.statusHistory).toHaveLength(2)
  })

  it('a clock that goes back does not put the history out of order', () => {
    const { state, ids } = loginSignupScenario()
    let s = runAt(state, { type: 'task.update', id: ids.form, patch: { status: 'in_progress' } }, at(10)).state
    s = runAt(s, { type: 'task.update', id: ids.form, patch: { status: 'done' } }, at(9)).state
    const history = s.tasks.get(ids.form)!.statusHistory
    expect(history.map((h) => h.at)).toEqual([history[0]!.at, at(10), at(10)])
  })

  it('keeps the latest changes only', () => {
    let task = run(newState(), { type: 'task.create', parentId: null }).state.tasks.values().next().value!
    for (let i = 0; i < MAX_STATUS_HISTORY + 5; i++) task = withStatus(task, i % 2 === 0 ? 'done' : 'todo', at(1))
    expect(task.statusHistory).toHaveLength(MAX_STATUS_HISTORY)
    expect(task.statusHistory[task.statusHistory.length - 1]!.to).toBe(task.status)
  })

  it('undo also takes the change out of the history', async () => {
    const { state, ids } = loginSignupScenario()
    const repo = new InMemoryProjectRepository()
    repo.store.set(state.meta.id, state)
    const sessions = new ProjectSessions({ repo, clock: fixedClock(at(2)), ids: { next: testId } })
    await sessions.execute(state.meta.id, { type: 'task.update', id: ids.form, patch: { status: 'done' } })
    expect(sessions.current(state.meta.id)!.tasks.get(ids.form)!.statusHistory).toHaveLength(2)
    await sessions.undo(state.meta.id)
    expect(sessions.current(state.meta.id)!.tasks.get(ids.form)!.statusHistory).toHaveLength(1)
  })
})
