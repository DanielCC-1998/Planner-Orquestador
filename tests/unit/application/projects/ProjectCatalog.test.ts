import { describe, expect, it } from 'vitest'
import { InMemoryProjectRepository } from '@infrastructure/persistence/memory/InMemoryProjectRepository'
import { domainError, err, estimate, fromProjectData, ok, toProjectData, type ProjectState, MAX_PROJECT_NAME_LENGTH } from '@domain'
import { loginSignupScenario, testId } from '@tests/support/builders'
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
  const clock = { now: () => '2026-02-01T00:00:00.000Z' }
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

  it('exports and imports JSON (a repeated id → a new project)', async () => {
    const { catalog, repo } = setup()
    const { state } = loginSignupScenario()
    repo.store.set(state.meta.id, state)
    const exported = await catalog.exportJson(state.meta.id, 'project')
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    expect(exported.value.fileName).toBe('Project.planner.json')
    const imported = await catalog.importJson(exported.value.content, (name) => `${name} (imported)`)
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(imported.value.id).not.toBe(state.meta.id)
    expect(imported.value.name).toBe('Project (imported)')
    expect(imported.value.totalMinutes).toBe(900)
    expect((await catalog.importJson('{not json', (name) => name)).ok).toBe(false)
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
