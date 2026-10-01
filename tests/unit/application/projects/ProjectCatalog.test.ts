import { describe, expect, it } from 'vitest'
import { InMemoryProjectRepository } from '@infrastructure/persistence/memory/InMemoryProjectRepository'
import { domainError, err, estimate, fromProjectData, ok, toProjectData, type ProjectState, MAX_PROJECT_NAME_LENGTH } from '@domain'
import { fixedClock, loginSignupScenario, run, testId } from '@tests/support/builders'
import type { ProjectSerializer } from '@application/ports'
import { ProjectCatalog } from '@application/projects/ProjectCatalog'
import { ProjectSessions } from '@application/projects/ProjectSessions'

const serializer: ProjectSerializer = {
  serialize: (s: ProjectState) => JSON.stringify(toProjectData(s)),
  deserialize: (text: string) => {
    try {
      const r = fromProjectData(JSON.parse(text))
      return r.ok ? ok(r.value) : r
    } catch {
      return err(domainError('CORRUPT', 'Invalid JSON'))
    }
  }
}

function setup() {
  const repo = new InMemoryProjectRepository()
  const clock = fixedClock('2026-02-01T00:00:00.000Z')
  const ids = { next: testId }
  const sessions = new ProjectSessions({ repo, clock, ids })
  const catalog = new ProjectCatalog({ repo, sessions, serializer, clock, ids })
  return { repo, sessions, catalog }
}

describe('ProjectCatalog', () => {
  it('create, list and move to the trash', async () => {
    const { catalog, repo } = setup()
    const created = await catalog.create({ name: 'Web store', client: 'ACME', currency: 'USD' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.value).toMatchObject({ name: 'Web store', currency: 'USD', taskCount: 0 })
    expect(await catalog.list()).toHaveLength(1)
    await catalog.trash(created.value.id)
    expect(await catalog.list()).toHaveLength(0)
    expect(repo.trashed.size).toBe(1)
  })

  it('rejects projects without a name', async () => {
    const { catalog } = setup()
    expect(await catalog.create({ name: '   ' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID', reason: 'PROJECT_NAME_REQUIRED' }
    })
  })

  it('moving an unknown project to the trash fails with a reason', async () => {
    const { catalog } = setup()
    expect(await catalog.trash('00000000-0000-4000-8000-ffffffffffff')).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', reason: 'PROJECT_NOT_FOUND' }
    })
  })

  it('duplicating generates new ids and keeps the totals and the shared subtasks', async () => {
    const { catalog, repo } = setup()
    const { state } = loginSignupScenario()
    repo.store.set(state.meta.id, state)
    const dup = await catalog.duplicate(state.meta.id, (name) => `${name} (copy)`)
    expect(dup.ok).toBe(true)
    if (!dup.ok) return
    expect(dup.value.id).not.toBe(state.meta.id)
    expect(dup.value.name).toBe(`${state.meta.name} (copy)`)
    expect(dup.value.totalMinutes).toBe(15 * 60)
    expect(dup.value.sharedCount).toBe(1)
    const copy = repo.store.get(dup.value.id)!
    for (const id of copy.tasks.keys()) expect(state.tasks.has(id)).toBe(false)
    expect(estimate(copy).total.costCents).toBe(estimate(state).total.costCents)
  })

  it('a duplicate starts its own status history: the changes of the original are not copied', async () => {
    const { catalog, repo } = setup()
    const { state, ids } = loginSignupScenario()
    const moved = run(state, { type: 'task.update', id: ids.form, patch: { status: 'done' } }).state
    repo.store.set(state.meta.id, moved)
    const dup = await catalog.duplicate(state.meta.id, (name) => `${name} (copy)`)
    if (!dup.ok) throw new Error(dup.error.message)
    const copy = repo.store.get(dup.value.id)!
    for (const task of copy.tasks.values()) {
      expect(task.statusHistory).toEqual([{ at: '2026-02-01T00:00:00.000Z', from: null, to: task.status }])
    }
    expect([...copy.tasks.values()].filter((t) => t.status === 'done')).toHaveLength(1)
  })

  it('exports a backup and imports it back when the project does not exist', async () => {
    const { catalog, repo } = setup()
    const { state } = loginSignupScenario()
    repo.store.set(state.meta.id, state)
    const exported = await catalog.exportJson(state.meta.id, 'project')
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    expect(exported.value.fileName).toBe('Project.planner.json')
    repo.store.delete(state.meta.id)
    const imported = await catalog.importJson(exported.value.content)
    expect(imported).toMatchObject({ ok: true, value: { kind: 'imported', card: { id: state.meta.id, totalMinutes: 900 } } })
    expect((await catalog.importJson('{not json')).ok).toBe(false)
  })

  describe('importing a backup of a project that already exists', () => {
    const clash = async () => {
      const ctx = setup()
      const { state } = loginSignupScenario()
      ctx.repo.store.set(state.meta.id, { ...state, meta: { ...state.meta, name: 'Current' } })
      const exported = await ctx.catalog.exportJson(state.meta.id, 'project')
      if (!exported.ok) throw new Error('export failed')
      const backup = { ...state, meta: { ...state.meta, name: 'Backup' } }
      const outcome = await ctx.catalog.importJson(serializer.serialize(backup))
      if (!outcome.ok || outcome.value.kind !== 'clash') throw new Error('expected a clash')
      return { ...ctx, state, outcome: outcome.value }
    }

    it('nothing is imported until the user decides; the clash names the project that exists', async () => {
      const { repo, outcome } = await clash()
      expect(outcome).toMatchObject({ kind: 'clash', existingName: 'Current' })
      expect(repo.store.size).toBe(1)
    })

    it('"keep both": the backup gets new ids and the name for copies', async () => {
      const { catalog, repo, state, outcome } = await clash()
      const card = await catalog.resolveImport(outcome.ticket, 'copy', (name) => `${name} (imported)`)
      expect(card.ok && card.value?.name).toBe('Backup (imported)')
      expect(card.ok && card.value?.id).not.toBe(state.meta.id)
      expect(repo.store.size).toBe(2)
      expect(repo.store.get(state.meta.id)!.meta.name).toBe('Current')
    })

    it('"replace": the current version goes to the trash and the backup takes its place', async () => {
      const { catalog, repo, state, outcome } = await clash()
      const card = await catalog.resolveImport(outcome.ticket, 'replace', (name) => name)
      expect(card).toMatchObject({ ok: true, value: { id: state.meta.id, name: 'Backup' } })
      expect(repo.store.get(state.meta.id)!.meta.name).toBe('Backup')
      expect(repo.trashed.get(state.meta.id)!.meta.name).toBe('Current')
      expect((await catalog.list()).map((c) => c.name)).toEqual(['Backup'])
    })

    it('"cancel" imports nothing, and a used or unknown ticket has expired', async () => {
      const { catalog, repo, outcome } = await clash()
      expect(await catalog.resolveImport(outcome.ticket, 'cancel', (name) => name)).toEqual({ ok: true, value: null })
      expect(repo.store.size).toBe(1)
      expect(await catalog.resolveImport(outcome.ticket, 'copy', (name) => name)).toMatchObject({
        ok: false,
        error: { reason: 'IMPORT_EXPIRED' }
      })
    })
  })

  it('a project from a newer version is neither exported nor duplicated (its newer data would be lost)', async () => {
    const { catalog, repo } = setup()
    const { state } = loginSignupScenario()
    repo.store.set(state.meta.id, state)
    repo.readOnlyIds.add(state.meta.id)
    const refused = { ok: false, error: { reason: 'READ_ONLY_NEWER' } }
    expect(await catalog.exportJson(state.meta.id, 'project')).toMatchObject(refused)
    expect(await catalog.duplicate(state.meta.id, (name) => name)).toMatchObject(refused)
  })

  it('names of copies are clamped to the maximum project name length', async () => {
    const { catalog, repo } = setup()
    const { state } = loginSignupScenario()
    const longName = { ...state, meta: { ...state.meta, name: 'n'.repeat(MAX_PROJECT_NAME_LENGTH) } }
    repo.store.set(state.meta.id, longName)
    const dup = await catalog.duplicate(state.meta.id, (name) => `${name} (copy)`)
    expect(dup.ok && dup.value.name.length).toBe(MAX_PROJECT_NAME_LENGTH)
  })
})
