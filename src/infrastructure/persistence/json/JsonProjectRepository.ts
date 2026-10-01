import { copyFile, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { err, isUuid, ok, type ProjectId, type ProjectState, type Result } from '@domain'
import type { LoadedProject, ProjectRepository, RepoError } from '@application'
import { atomicWrite, isNotFound, withRetry } from './atomicWrite'
import { decodeProject, encodeProject } from './codec'

export interface JsonRepositoryOptions {
  /** Delay used to group consecutive writes of the same project. */
  readonly debounceMs?: number
  /** Days the daily backups are kept. */
  readonly backupDays?: number
  readonly now?: () => Date
}

interface Pending {
  state: ProjectState
  timer: ReturnType<typeof setTimeout> | null
  waiters: Array<{ resolve: () => void; reject: (e: unknown) => void }>
}

const notFound = (): RepoError => ({ code: 'NOT_FOUND', message: 'The project does not exist', reason: 'PROJECT_FILE_NOT_FOUND' })

/**
 * One JSON file per project:
 *   projects/<id>.json (+ .bak with the previous version and .tmp while writing)
 *   trash/        deleted projects
 *   backups/YYYY-MM-DD/<id>.json  daily backup (kept for `backupDays` days)
 *   quarantine/   unreadable files set aside so that they are not lost
 */
export class JsonProjectRepository implements ProjectRepository {
  private readonly pending = new Map<ProjectId, Pending>()
  private readonly writing = new Map<ProjectId, Promise<void>>()
  private readonly backedUpToday = new Set<string>()
  private readonly debounceMs: number
  private readonly backupDays: number
  private readonly now: () => Date

  readonly projectsDir: string
  readonly trashDir: string
  readonly backupsDir: string
  readonly quarantineDir: string

  constructor(root: string, options: JsonRepositoryOptions = {}) {
    this.projectsDir = join(root, 'projects')
    this.trashDir = join(root, 'trash')
    this.backupsDir = join(root, 'backups')
    this.quarantineDir = join(root, 'quarantine')
    this.debounceMs = options.debounceMs ?? 300
    this.backupDays = options.backupDays ?? 14
    this.now = options.now ?? (() => new Date())
  }

  async init(): Promise<void> {
    for (const dir of [this.projectsDir, this.trashDir, this.backupsDir, this.quarantineDir]) {
      await mkdir(dir, { recursive: true })
    }
    await this.pruneBackups()
  }

  private file(id: ProjectId): string {
    if (!isUuid(id)) throw new Error('Invalid project id')
    return join(this.projectsDir, `${id}.json`)
  }

  async listIds(): Promise<ProjectId[]> {
    const names = await readdir(this.projectsDir).catch((e) => (isNotFound(e) ? [] : Promise.reject(e)))
    const ids = new Set<string>()
    for (const name of names) {
      const m = /^([0-9a-f-]{36})\.json(\.tmp|\.bak)?$/i.exec(name)
      if (m && isUuid(m[1])) ids.add(m[1]!)
    }
    for (const id of this.pending.keys()) ids.add(id)
    return [...ids]
  }

  async load(id: ProjectId): Promise<Result<LoadedProject, RepoError>> {
    const pending = this.pending.get(id)
    if (pending) return ok({ state: pending.state, readOnly: false })
    let file: string
    try {
      file = this.file(id)
    } catch {
      return err(notFound())
    }
    let sawFile = false
    let lastError = ''
    // Recovery order: main file → .tmp (interrupted write) → .bak (previous version).
    for (const candidate of [file, `${file}.tmp`, `${file}.bak`]) {
      let text: string
      try {
        text = await readFile(candidate, 'utf8')
      } catch (e) {
        if (isNotFound(e)) continue
        const detail = String(e)
        return err({ code: 'IO', message: `The project could not be read: ${detail}`, reason: 'READ_FAILED', params: { detail } })
      }
      sawFile = true
      const decoded = decodeProject(text)
      if (!decoded.ok) {
        lastError = decoded.error.message
        await this.quarantine(candidate)
        continue
      }
      if (candidate !== file && !decoded.value.readOnly) {
        // Recovered from a copy: it is restored as the main file.
        await atomicWrite(file, text, false)
      }
      return ok({ state: decoded.value.state, readOnly: decoded.value.readOnly })
    }
    if (!sawFile) return err(notFound())
    return err({
      code: 'CORRUPT',
      message: `The project is damaged and has been moved to quarantine. ${lastError}`,
      reason: 'QUARANTINED',
      params: { detail: lastError }
    })
  }

  save(id: ProjectId, state: ProjectState): Promise<void> {
    return new Promise((resolve, reject) => {
      let p = this.pending.get(id)
      if (!p) {
        p = { state, timer: null, waiters: [] }
        this.pending.set(id, p)
      }
      p.state = state
      p.waiters.push({ resolve, reject })
      if (p.timer) clearTimeout(p.timer)
      p.timer = setTimeout(() => void this.writePending(id), this.debounceMs)
    })
  }

  async flush(): Promise<void> {
    const ids = [...this.pending.keys()]
    await Promise.all(ids.map((id) => this.writePending(id)))
    await Promise.all([...this.writing.values()])
  }

  async trash(id: ProjectId): Promise<void> {
    await this.writePending(id)
    await this.writing.get(id)
    const file = this.file(id)
    await mkdir(this.trashDir, { recursive: true })
    const stamp = this.now().toISOString().replace(/[:.]/g, '-')
    try {
      await withRetry(() => rename(file, join(this.trashDir, `${id}-${stamp}.json`)))
    } catch (e) {
      if (!isNotFound(e)) throw e
    }
    await rm(`${file}.bak`, { force: true })
    await rm(`${file}.tmp`, { force: true })
  }

  private writePending(id: ProjectId): Promise<void> {
    const p = this.pending.get(id)
    if (!p) return this.writing.get(id) ?? Promise.resolve()
    this.pending.delete(id)
    if (p.timer) clearTimeout(p.timer)
    // Writes of the same project run one after another; `writing` holds the last one (it never rejects).
    const previous = this.writing.get(id) ?? Promise.resolve()
    const run = previous.then(() => this.write(id, p.state))
    run.then(
      () => p.waiters.forEach((w) => w.resolve()),
      (e: unknown) => p.waiters.forEach((w) => w.reject(e))
    )
    const settled: Promise<void> = run.then(
      () => undefined,
      () => undefined
    )
    this.writing.set(id, settled)
    void settled.then(() => {
      if (this.writing.get(id) === settled) this.writing.delete(id)
    })
    return run
  }

  private async write(id: ProjectId, state: ProjectState): Promise<void> {
    const file = this.file(id)
    await mkdir(this.projectsDir, { recursive: true })
    await this.dailyBackup(id, file)
    await atomicWrite(file, encodeProject(state))
  }

  /** First write of the day: keeps a copy of the version that was on disk. */
  private async dailyBackup(id: ProjectId, file: string): Promise<void> {
    const day = this.now().toISOString().slice(0, 10)
    const key = `${day}:${id}`
    if (this.backedUpToday.has(key)) return
    this.backedUpToday.add(key)
    const dir = join(this.backupsDir, day)
    try {
      await mkdir(dir, { recursive: true })
      await copyFile(file, join(dir, `${id}.json`))
    } catch (e) {
      if (!isNotFound(e)) throw e
    }
  }

  private async pruneBackups(): Promise<void> {
    const limit = new Date(this.now().getTime() - this.backupDays * 86_400_000).toISOString().slice(0, 10)
    const days = await readdir(this.backupsDir).catch(() => [] as string[])
    for (const day of days) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day < limit) {
        await rm(join(this.backupsDir, day), { recursive: true, force: true })
      }
    }
  }

  private async quarantine(path: string): Promise<void> {
    try {
      await mkdir(this.quarantineDir, { recursive: true })
      const stamp = this.now().toISOString().replace(/[:.]/g, '-')
      const name = path.split(/[\\/]/).pop() ?? 'project.json'
      await withRetry(() => rename(path, join(this.quarantineDir, `${stamp}-${name}`)))
    } catch {
      // If it cannot be moved, it stays where it is: it is never deleted.
    }
  }
}
