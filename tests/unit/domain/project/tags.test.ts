import { describe, expect, it } from 'vitest'
import { apply, TAG_COLORS, type Command, type MetaPatch, type ProjectState } from '@domain'
import { loginSignupScenario, run, testContext } from '@tests/support/builders'

const fails = (state: ProjectState, cmd: Command) => {
  const r = apply(state, cmd, testContext())
  return r.ok ? null : r.error
}

describe('project tags', () => {
  it('a tag is created once and then given to any task by its id', () => {
    const { state, ids } = loginSignupScenario()
    const created = run(state, { type: 'tag.create', name: '  Design ' })
    const tag = created.state.meta.tags[0]!
    expect(tag).toEqual({ id: created.id, name: 'Design', color: TAG_COLORS[0] })
    const s = run(created.state, { type: 'task.update', id: ids.form, patch: { tagIds: [tag.id, tag.id] } }).state
    expect(s.tasks.get(ids.form)!.tagIds).toEqual([tag.id])
  })

  it('a new tag takes the color after the last one (two in a row never match); a repeated name (in any case) is rejected', () => {
    let { state } = loginSignupScenario()
    state = run(state, { type: 'tag.create', name: 'Design' }).state
    state = run(state, { type: 'tag.create', name: 'Backend', color: 'teal' }).state
    state = run(state, { type: 'tag.create', name: 'QA' }).state
    state = run(state, { type: 'tag.create', name: 'Docs', color: 'pink' }).state
    state = run(state, { type: 'tag.create', name: 'Ops' }).state
    expect(state.meta.tags.map((t) => t.color)).toEqual(['red', 'teal', 'cyan', 'pink', 'red'])
    expect(fails(state, { type: 'tag.create', name: 'design' })).toMatchObject({ reason: 'TAG_EXISTS', params: { name: 'design' } })
    expect(fails(state, { type: 'tag.create', name: 'x', color: 'silver' as never })).toMatchObject({ reason: 'INVALID_COLOR' })
  })

  it('creating from a task assigns it in the same step (one undo)', () => {
    const { state, ids } = loginSignupScenario()
    const r = run(state, { type: 'tag.create', name: 'Urgent', assignTo: [ids.form, ids.table] })
    expect(r.state.tasks.get(ids.form)!.tagIds).toEqual([r.id])
    expect(r.state.tasks.get(ids.table)!.tagIds).toEqual([r.id])
  })

  it('renaming or recoloring changes the tag of every task at once; deleting removes it from them', () => {
    const { state, ids } = loginSignupScenario()
    const created = run(state, { type: 'tag.create', name: 'Design', assignTo: [ids.form] })
    let s = run(created.state, { type: 'tag.update', id: created.id, patch: { name: 'UX', color: 'teal' } }).state
    expect(s.meta.tags).toEqual([{ id: created.id, name: 'UX', color: 'teal' }])
    expect(s.tasks.get(ids.form)!.tagIds).toEqual([created.id])
    // Renaming a tag to its own name in another case is allowed.
    s = run(s, { type: 'tag.update', id: created.id, patch: { name: 'ux' } }).state
    expect(s.meta.tags[0]!.name).toBe('ux')
    s = run(s, { type: 'tag.delete', id: created.id }).state
    expect(s.meta.tags).toEqual([])
    expect(s.tasks.get(ids.form)!.tagIds).toEqual([])
  })

  it('renaming to the name of another tag is rejected', () => {
    let { state } = loginSignupScenario()
    state = run(state, { type: 'tag.create', name: 'Design' }).state
    const qa = run(state, { type: 'tag.create', name: 'QA' })
    expect(fails(qa.state, { type: 'tag.update', id: qa.id, patch: { name: 'DESIGN' } })).toMatchObject({ reason: 'TAG_EXISTS' })
  })

  it('assigns or removes a tag in bulk, without exceeding 20 tags per task', () => {
    const { state, ids } = loginSignupScenario()
    const created = run(state, { type: 'tag.create', name: 'Sprint goal' })
    let s = run(created.state, { type: 'tag.assign', ids: [ids.form, ids.table], tagId: created.id, assigned: true }).state
    expect([ids.form, ids.table].map((id) => s.tasks.get(id)!.tagIds)).toEqual([[created.id], [created.id]])
    s = run(s, { type: 'tag.assign', ids: [ids.form], tagId: created.id, assigned: false }).state
    expect(s.tasks.get(ids.form)!.tagIds).toEqual([])
    // Nothing to change: the same state (no undo step).
    const same = apply(s, { type: 'tag.assign', ids: [ids.form], tagId: created.id, assigned: false }, testContext())
    expect(same.ok && same.value.state).toBe(s)

    let full = s
    for (let i = 0; i < 20; i++) {
      const r = run(full, { type: 'tag.create', name: `t${i}`, assignTo: [ids.validation] })
      full = r.state
    }
    expect(fails(full, { type: 'tag.assign', ids: [ids.form, ids.validation], tagId: created.id, assigned: true })).toMatchObject({
      reason: 'TOO_MANY_TAGS',
      params: { max: 20 }
    })
  })

  it('unknown tags are rejected', () => {
    const { state, ids } = loginSignupScenario()
    expect(fails(state, { type: 'task.update', id: ids.form, patch: { tagIds: ['tag-1'] } })).toMatchObject({ reason: 'UNKNOWN_TAG' })
    expect(fails(state, { type: 'tag.delete', id: 'tag-1' })).toMatchObject({ code: 'NOT_FOUND', reason: 'UNKNOWN_TAG' })
    expect(fails(state, { type: 'tag.assign', ids: [ids.form], tagId: 'tag-1', assigned: true })).toMatchObject({
      reason: 'UNKNOWN_TAG'
    })
  })

  it('the tags of the project cannot be changed through project.update', () => {
    const { state } = loginSignupScenario()
    const created = run(state, { type: 'tag.create', name: 'Design' })
    const patch = { name: 'Renamed', tags: [] } as unknown as MetaPatch
    const s = run(created.state, { type: 'project.update', patch }).state
    expect(s.meta.name).toBe('Renamed')
    expect(s.meta.tags).toHaveLength(1)
  })
})
