import { ok, err, type ProjectId, type ProjectState, type Result } from '@domain'
import type { LoadedProject, ProjectRepository, RepoError } from '@application'

/** In-memory repository for tests and for the UI without Electron. */
export class InMemoryProjectRepository implements ProjectRepository {
  readonly store = new Map<ProjectId, ProjectState>()
  readonly trashed = new Map<ProjectId, ProjectState>()
  saves = 0

  async listIds(): Promise<ProjectId[]> {
    return [...this.store.keys()]
  }

  async load(id: ProjectId): Promise<Result<LoadedProject, RepoError>> {
    const state = this.store.get(id)
    if (!state) return err({ code: 'NOT_FOUND', message: 'The project does not exist', reason: 'PROJECT_FILE_NOT_FOUND' })
    return ok({ state, readOnly: false })
  }

  async save(id: ProjectId, state: ProjectState): Promise<void> {
    this.saves++
    this.store.set(id, state)
  }

  async flush(): Promise<void> {}

  async trash(id: ProjectId): Promise<void> {
    const state = this.store.get(id)
    if (state) this.trashed.set(id, state)
    this.store.delete(id)
  }
}
