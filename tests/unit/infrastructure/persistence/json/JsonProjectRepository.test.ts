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
