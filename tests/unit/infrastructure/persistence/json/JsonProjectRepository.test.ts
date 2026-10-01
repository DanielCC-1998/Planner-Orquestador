import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { estimate, toProjectData } from '@domain'
import { loginSignupScenario, run } from '@tests/support/builders'
import { CURRENT_SCHEMA_VERSION, decodeProject, encodeProject, jsonProjectSerializer } from '@infrastructure/persistence/json/codec'
import { JsonProjectRepository } from '@infrastructure/persistence/json/JsonProjectRepository'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'planner-test-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function repo() {
  const r = new JsonProjectRepository(root, { debounceMs: 5 })
  await r.init()
  return r
}

describe('codec', () => {
  it('decode(encode(s)) keeps the project', () => {
    const { state } = loginSignupScenario()
    const decoded = decodeProject(encodeProject(state))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(toProjectData(decoded.value.state)).toEqual(toProjectData(state))
    expect(decoded.value.readOnly).toBe(false)
  })

  it('a newer format opens read-only and cannot be imported', () => {
    const { state } = loginSignupScenario()
    const newer = JSON.stringify({ ...JSON.parse(encodeProject(state)), schemaVersion: CURRENT_SCHEMA_VERSION + 1, extra: 1 })
    const decoded = decodeProject(newer)
    expect(decoded.ok && decoded.value.readOnly).toBe(true)
    expect(jsonProjectSerializer.deserialize(newer)).toMatchObject({
      ok: false,
      error: { code: 'NEWER_SCHEMA', reason: 'NEWER_SCHEMA' }
    })
  })

  it('rejects foreign or damaged JSON with a reason the UI can translate', () => {
    expect(decodeProject('{')).toMatchObject({ ok: false, error: { code: 'CORRUPT', reason: 'NOT_JSON' } })
    expect(decodeProject('{"format":"other"}')).toMatchObject({ ok: false, error: { code: 'CORRUPT', reason: 'NOT_PLANNER_FILE' } })
    expect(jsonProjectSerializer.deserialize('{')).toMatchObject({ ok: false, error: { code: 'CORRUPT', reason: 'NOT_JSON' } })
    const { state } = loginSignupScenario()
    const doc = JSON.parse(encodeProject(state))
    expect(decodeProject(JSON.stringify({ ...doc, schemaVersion: 0 }))).toMatchObject({
      ok: false,
      error: { code: 'CORRUPT', reason: 'BAD_FORMAT_VERSION' }
    })
    expect(decodeProject(JSON.stringify({ ...doc, meta: { ...doc.meta, name: '' } }))).toMatchObject({
      ok: false,
      error: { code: 'CORRUPT', reason: 'INVALID_PROJECT_DATA', params: { detail: expect.stringContaining('meta.name') } }
    })
    doc.structure.children[doc.structure.roots[0]].push(doc.structure.roots[1])
    expect(decodeProject(JSON.stringify(doc))).toMatchObject({ ok: false, error: { code: 'CORRUPT' } })
  })
})

describe('JsonProjectRepository', () => {
  it('saves, lists and loads again', async () => {
    const r = await repo()
    const { state } = loginSignupScenario()
    await r.save(state.meta.id, state)
    expect(await r.listIds()).toEqual([state.meta.id])
    const fresh = await repo()
    const loaded = await fresh.load(state.meta.id)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(estimate(loaded.value.state).total.minutes).toBe(900)
  })

  it('a missing project or an invalid id is reported as not found', async () => {
    const r = await repo()
    const notFound = { ok: false, error: { code: 'NOT_FOUND', reason: 'PROJECT_FILE_NOT_FOUND' } }
    expect(await r.load('00000000-0000-4000-8000-ffffffffffff')).toMatchObject(notFound)
    expect(await r.load('../settings')).toMatchObject(notFound)
  })

  it('groups consecutive writes and saves the last one', async () => {
    const r = await repo()
    const { state, ids } = loginSignupScenario()
    const s2 = run(state, { type: 'task.update', id: ids.table, patch: { title: 'v2' } }).state
    const s3 = run(s2, { type: 'task.update', id: ids.table, patch: { title: 'v3' } }).state
    await Promise.all([r.save(state.meta.id, state), r.save(state.meta.id, s2), r.save(state.meta.id, s3)])
    const text = await readFile(join(r.projectsDir, `${state.meta.id}.json`), 'utf8')
    expect(text).toContain('"v3"')
    expect(text).not.toContain('"v2"')
  })

  it('recovers from .tmp if the main file is damaged and moves it to quarantine', async () => {
    const r = await repo()
    const { state } = loginSignupScenario()
    const file = join(r.projectsDir, `${state.meta.id}.json`)
    await writeFile(file, '{ broken', 'utf8')
    await writeFile(`${file}.tmp`, encodeProject(state), 'utf8')
    const loaded = await r.load(state.meta.id)
    expect(loaded.ok).toBe(true)
    expect(await readdir(r.quarantineDir)).toHaveLength(1)
    // The main file has been restored.
    expect(decodeProject(await readFile(file, 'utf8')).ok).toBe(true)
  })

  it('recovers from .bak and, if everything is damaged, reports it without deleting anything', async () => {
    const r = await repo()
    const { state } = loginSignupScenario()
    const file = join(r.projectsDir, `${state.meta.id}.json`)
    await writeFile(file, 'x', 'utf8')
    await writeFile(`${file}.bak`, encodeProject(state), 'utf8')
    expect((await r.load(state.meta.id)).ok).toBe(true)

    await writeFile(file, 'x', 'utf8')
    await rm(`${file}.bak`)
    const broken = await r.load(state.meta.id)
    expect(broken).toMatchObject({
      ok: false,
      error: { code: 'CORRUPT', reason: 'QUARANTINED', params: { detail: 'The file is not valid JSON' } }
    })
    expect((await readdir(r.quarantineDir)).length).toBeGreaterThanOrEqual(2)
  })

  it('keeps .bak with the previous version and a daily backup', async () => {
    const r = await repo()
    const { state, ids } = loginSignupScenario()
    await r.save(state.meta.id, state)
    const s2 = run(state, { type: 'task.update', id: ids.table, patch: { title: 'new' } }).state
    await r.save(state.meta.id, s2)
    const file = join(r.projectsDir, `${state.meta.id}.json`)
    expect(await readFile(`${file}.bak`, 'utf8')).toContain(JSON.stringify(state.tasks.get(ids.table)!.title))
    const days = await readdir(r.backupsDir)
    expect(days).toHaveLength(1)
  })

  it('trash: the project disappears from the list but the file is kept', async () => {
    const r = await repo()
    const { state } = loginSignupScenario()
    await r.save(state.meta.id, state)
    await r.trash(state.meta.id)
    expect(await r.listIds()).toEqual([])
    expect(await readdir(r.trashDir)).toHaveLength(1)
  })

  it('flush writes everything pending right away', async () => {
    const r = new JsonProjectRepository(root, { debounceMs: 60_000 })
    await r.init()
    const { state } = loginSignupScenario()
    void r.save(state.meta.id, state)
    await r.flush()
    expect(await readdir(r.projectsDir)).toContain(`${state.meta.id}.json`)
  })
})

describe('codec: format version 2 (story point scale)', () => {
  /** A project saved by version 1 of the format, written out by hand: it must keep opening. */
  const V1_DOCUMENT = {
    format: 'planner.project',
    schemaVersion: 1,
    meta: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Version 1 project',
      client: '',
      description: '',
      color: '#6366f1',
      currency: 'EUR',
      defaultRateCents: 5000,
      defaultHoursPerDay: 8,
      startDate: null,
      workingWeekdays: [1, 2, 3, 4, 5],
      contingencyBps: 0,
      taxBps: 0,
      taxLabel: 'VAT',
      quote: { number: '', date: null, validityDays: 30, terms: '' },
      archived: false,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z'
    },
    members: [],
    tasks: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Login',
        description: '',
        status: 'todo',
        priority: 'medium',
        storyPoints: 3,
        estimateMinutes: null,
        assigneeId: null,
        rateCents: null,
        tags: [],
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z'
      }
    ],
    structure: { roots: ['22222222-2222-4222-8222-222222222222'], children: {}, parents: {} }
  }

  it('a version 1 file is migrated: no scale, so story points give no hours', () => {
    const decoded = decodeProject(JSON.stringify(V1_DOCUMENT))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.value).toMatchObject({ readOnly: false, migratedFrom: 1 })
    expect(decoded.value.state.meta.pointScale).toBeNull()
    expect(estimate(decoded.value.state).total).toMatchObject({ minutes: 0, unestimated: 1 })
  })

  it('the scale is saved with the project and read back', () => {
    const { state } = loginSignupScenario()
    const scaled = { ...state, meta: { ...state.meta, pointScale: { minutesPerPoint: 120, overrides: [{ points: 5, minutes: 480 }] } } }
    const text = encodeProject(scaled)
    expect(JSON.parse(text).schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    const decoded = decodeProject(text)
    expect(decoded.ok && decoded.value.state.meta.pointScale).toEqual(scaled.meta.pointScale)
  })

  it('a version 1 file goes through every migration up to the current version', () => {
    const decoded = decodeProject(JSON.stringify(V1_DOCUMENT))
    expect(decoded.ok && decoded.value.state.meta).toMatchObject({ sprints: { length: 2, unit: 'week' }, tags: [] })
  })

  it('an invalid scale in a file is reported as invalid project data', () => {
    const { state } = loginSignupScenario()
    const doc = JSON.parse(encodeProject(state))
    const broken = { ...doc, meta: { ...doc.meta, pointScale: { minutesPerPoint: 60, overrides: [{ points: 1, minutes: 30 }] } } }
    expect(decodeProject(JSON.stringify(broken))).toMatchObject({
      ok: false,
      error: { code: 'CORRUPT', reason: 'INVALID_PROJECT_DATA', params: { detail: expect.stringContaining('meta.pointScale') } }
    })
  })
})

describe('codec: format version 3 (status history, sprints, project tags)', () => {
  const task = (id: string, title: string, tags: string[]) => ({
    id,
    title,
    description: '',
    status: 'review',
    priority: 'medium',
    storyPoints: null,
    estimateMinutes: 60,
    assigneeId: null,
    rateCents: null,
    tags,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  })
  /** A project saved by version 2 of the format, with free-text tags. */
  const V2_DOCUMENT = {
    format: 'planner.project',
    schemaVersion: 2,
    meta: {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Version 2 project',
      client: '',
      description: '',
      color: '#6366f1',
      currency: 'EUR',
      defaultRateCents: null,
      defaultHoursPerDay: 8,
      startDate: '2026-09-07',
      workingWeekdays: [1, 2, 3, 4, 5],
      contingencyBps: 0,
      taxBps: 0,
      taxLabel: '',
      pointScale: null,
      quote: { number: '', date: null, validityDays: 30, terms: '' },
      archived: false,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z'
    },
    members: [],
    tasks: [
      task('44444444-4444-4444-8444-444444444441', 'Login', ['Design', 'Backend']),
      task('44444444-4444-4444-8444-444444444442', 'Sign-up', [' design ', 'QA', ''])
    ],
    structure: { roots: ['44444444-4444-4444-8444-444444444441', '44444444-4444-4444-8444-444444444442'], children: {}, parents: {} }
  }

  it('free-text tags become project tags (one per name, ignoring case) and tasks keep them by id', () => {
    const decoded = decodeProject(JSON.stringify(V2_DOCUMENT))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    const { state, migratedFrom } = decoded.value
    expect(migratedFrom).toBe(2)
    expect(state.meta.tags).toEqual([
      { id: 'tag-1', name: 'Design', color: 'red' },
      { id: 'tag-2', name: 'Backend', color: 'orange' },
      { id: 'tag-3', name: 'QA', color: 'amber' }
    ])
    expect([...state.tasks.values()].map((t) => t.tagIds)).toEqual([
      ['tag-1', 'tag-2'],
      ['tag-1', 'tag-3']
    ])
    // Their past is unknown: empty history, statuses as they were; 2-week sprints.
    expect([...state.tasks.values()].map((t) => [t.status, t.statusHistory])).toEqual([
      ['review', []],
      ['review', []]
    ])
    expect(state.meta.sprints).toEqual({ length: 2, unit: 'week' })
    // Decoding the same file twice gives the same ids.
    const again = decodeProject(JSON.stringify(V2_DOCUMENT))
    expect(again.ok && again.value.state.meta.tags.map((t) => t.id)).toEqual(['tag-1', 'tag-2', 'tag-3'])
  })

  it('history, tags and sprints survive saving and loading', () => {
    const { state, ids } = loginSignupScenario()
    let s = run(state, { type: 'task.update', id: ids.form, patch: { status: 'done' } }).state
    const tag = run(s, { type: 'tag.create', name: 'Design', assignTo: [ids.form] })
    s = run(tag.state, { type: 'project.update', patch: { sprints: { length: 1, unit: 'month' } } }).state
    const decoded = decodeProject(encodeProject(s))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    const back = decoded.value.state
    expect(back.tasks.get(ids.form)!.statusHistory).toEqual(s.tasks.get(ids.form)!.statusHistory)
    expect(back.tasks.get(ids.form)!.tagIds).toEqual([tag.id])
    expect(back.meta).toMatchObject({ sprints: { length: 1, unit: 'month' }, tags: s.meta.tags })
  })

  it('damaged history, tags or sprints are cleaned up instead of sending the project to quarantine', () => {
    const { state, ids } = loginSignupScenario()
    const tagged = run(state, { type: 'tag.create', name: 'Design', assignTo: [ids.form] })
    const doc = JSON.parse(encodeProject(tagged.state))
    doc.meta.sprints = { length: 99, unit: 'month' }
    doc.meta.tags = [...doc.meta.tags, { id: 'x', name: 'design', color: 'red' }, { id: 'bad id', name: 'B', color: 'red' }, 'junk']
    const form = doc.tasks.find((t: { id: string }) => t.id === ids.form)
    form.tagIds = [...form.tagIds, 'missing-tag', 42]
    form.statusHistory = [{ at: 'yesterday', from: null, to: 'todo' }, { at: '2026-03-01T10:00:00+02:00', from: 'todo', to: 'done' }, 'junk']
    const other = doc.tasks.find((t: { id: string }) => t.id === ids.table)
    other.statusHistory = 'not a list'
    delete other.tagIds
    const decoded = decodeProject(JSON.stringify(doc))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    const back = decoded.value.state
    expect(back.meta.sprints).toEqual({ length: 2, unit: 'week' })
    expect(back.meta.tags).toEqual(tagged.state.meta.tags)
    expect(back.tasks.get(ids.form)!.tagIds).toEqual([tagged.id])
    expect(back.tasks.get(ids.form)!.statusHistory).toEqual([{ at: '2026-03-01T08:00:00.000Z', from: 'todo', to: 'done' }])
    expect(back.tasks.get(ids.table)).toMatchObject({ statusHistory: [], tagIds: [] })
  })
})
