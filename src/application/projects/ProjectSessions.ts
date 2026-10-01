import { apply, ok, type Command, type ProjectId, type ProjectState, type Result } from '@domain'
import { fail, readOnlyNewer, type AppError } from '../errors'
import type { Clock, IdGenerator, LoadedProject, ProjectRepository } from '../ports'
import { diffStates, toSnapshot, type Delta, type Snapshot } from './snapshot'

export type SaveStatus =
  | { readonly state: 'saving' }
  | { readonly state: 'saved'; readonly at: string }
  | { readonly state: 'error'; readonly message: string }

export interface SessionDeps {
  readonly repo: ProjectRepository
  readonly clock: Clock
  readonly ids: IdGenerator
  readonly historyLimit?: number
  readonly onSaveStatus?: (projectId: ProjectId, status: SaveStatus) => void
  readonly onChanged?: (projectId: ProjectId) => void
}

interface Session {
  state: ProjectState
  revision: number
  undo: ProjectState[]
  redo: ProjectState[]
  readOnly: boolean
}

/**
 * Projects open in memory. Each command is applied with the domain reducer, saved in the
 * background, and only the delta is returned. Undo/redo keeps whole states: since they are
 * immutable, they share almost all of their memory.
 */
export class ProjectSessions {
  private readonly sessions = new Map<ProjectId, Session>()
  private readonly loading = new Map<ProjectId, Promise<Result<Session, AppError>>>()
  private readonly historyLimit: number

  constructor(private readonly deps: SessionDeps) {
    this.historyLimit = deps.historyLimit ?? 100
  }

  isOpen(id: ProjectId): boolean {
    return this.sessions.has(id)
  }

  current(id: ProjectId): ProjectState | undefined {
    return this.sessions.get(id)?.state
  }

  async open(id: ProjectId): Promise<Result<Snapshot, AppError>> {
    const session = await this.session(id)
    if (!session.ok) return session
    const s = session.value
    return ok(toSnapshot(s.state, s.revision, s.undo.length > 0, s.redo.length > 0, s.readOnly))
  }

  /** Current state of the project and whether it is read-only, whether it is open or not. */
  async loadedOf(id: ProjectId): Promise<Result<LoadedProject, AppError>> {
    const open = this.sessions.get(id)
    if (open) return ok({ state: open.state, readOnly: open.readOnly })
    return this.deps.repo.load(id)
  }

  /** Current state of the project, whether it is open or not (for exporting or listing). */
  async stateOf(id: ProjectId): Promise<Result<ProjectState, AppError>> {
    const loaded = await this.loadedOf(id)
    if (!loaded.ok) return loaded
    return ok(loaded.value.state)
  }

  /** Registers a newly created or imported project and saves it. */
  async adopt(state: ProjectState): Promise<void> {
    this.sessions.set(state.meta.id, { state, revision: 0, undo: [], redo: [], readOnly: false })
    await this.persist(state.meta.id, state)
  }

  async execute(id: ProjectId, command: Command): Promise<Result<Delta, AppError>> {
    const session = await this.session(id)
    if (!session.ok) return session
    const s = session.value
    if (s.readOnly) return readOnlyNewer()
    const result = apply(s.state, command, { now: this.deps.clock.now(), newId: () => this.deps.ids.next() })
    if (!result.ok) return result
    const prev = s.state
    const next = result.value.state
    if (next === prev) return ok(this.delta(s, prev, prev, result.value.created))
    s.undo.push(prev)
    if (s.undo.length > this.historyLimit) s.undo.shift()
    s.redo = []
    return ok(this.commit(id, s, prev, next, result.value.created))
  }

  async undo(id: ProjectId): Promise<Result<Delta, AppError>> {
    return this.travel(id, 'undo')
  }

  async redo(id: ProjectId): Promise<Result<Delta, AppError>> {
    return this.travel(id, 'redo')
  }

  close(id: ProjectId): void {
    this.sessions.delete(id)
  }

  private async travel(id: ProjectId, direction: 'undo' | 'redo'): Promise<Result<Delta, AppError>> {
    const session = await this.session(id)
    if (!session.ok) return session
    const s = session.value
    if (s.readOnly) return fail('READ_ONLY', 'Read-only project', 'READ_ONLY')
    const from = direction === 'undo' ? s.undo : s.redo
    const to = direction === 'undo' ? s.redo : s.undo
    const target = from.pop()
    if (!target) {
      return direction === 'undo'
        ? fail('NOTHING', 'Nothing to undo', 'NOTHING_TO_UNDO')
        : fail('NOTHING', 'Nothing to redo', 'NOTHING_TO_REDO')
    }
    to.push(s.state)
    return ok(this.commit(id, s, s.state, target, []))
  }

  private commit(id: ProjectId, s: Session, prev: ProjectState, next: ProjectState, created: readonly string[]): Delta {
    s.state = next
    s.revision++
    void this.persist(id, next)
    this.deps.onChanged?.(id)
    return this.delta(s, prev, next, created)
  }

  private delta(s: Session, prev: ProjectState, next: ProjectState, created: readonly string[]): Delta {
    return {
      ...diffStates(prev, next),
      revision: s.revision,
      created,
      canUndo: s.undo.length > 0,
      canRedo: s.redo.length > 0
    }
  }

  private async persist(id: ProjectId, state: ProjectState): Promise<void> {
    this.deps.onSaveStatus?.(id, { state: 'saving' })
    try {
      await this.deps.repo.save(id, state)
      if (this.sessions.get(id)?.state === state || !this.sessions.has(id)) {
        this.deps.onSaveStatus?.(id, { state: 'saved', at: this.deps.clock.now() })
      }
    } catch (e) {
      this.deps.onSaveStatus?.(id, { state: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  private async session(id: ProjectId): Promise<Result<Session, AppError>> {
    const open = this.sessions.get(id)
    if (open) return ok(open)
    let pending = this.loading.get(id)
    if (!pending) {
      pending = this.deps.repo.load(id).then((loaded): Result<Session, AppError> => {
        if (!loaded.ok) return loaded
        const session: Session = {
          state: loaded.value.state,
          revision: 0,
          undo: [],
          redo: [],
          readOnly: loaded.value.readOnly
        }
        this.sessions.set(id, session)
        return ok(session)
      })
      this.loading.set(id, pending)
      void pending.finally(() => this.loading.delete(id))
    }
    return pending
  }
}
