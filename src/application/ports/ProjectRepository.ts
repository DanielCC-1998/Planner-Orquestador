import type { ErrorParams, ProjectId, ProjectState, Result } from '@domain'

export type RepoErrorCode = 'NOT_FOUND' | 'CORRUPT' | 'IO'

export interface RepoError {
  readonly code: RepoErrorCode
  /** English text for logs and as a fallback when the UI has no translation. */
  readonly message: string
  /** Machine-readable cause set by the adapter (translated by the UI). */
  readonly reason?: string | undefined
  readonly params?: ErrorParams | undefined
}

export interface LoadedProject {
  readonly state: ProjectState
  /** The file comes from a newer version of the app: it opens without allowing changes. */
  readonly readOnly: boolean
}

/** Persistence port for projects (one document per project). */
export interface ProjectRepository {
  listIds(): Promise<ProjectId[]>
  load(id: ProjectId): Promise<Result<LoadedProject, RepoError>>
  /** Deferred write: the promise resolves once the change is on disk. */
  save(id: ProjectId, state: ProjectState): Promise<void>
  /** Writes everything that is pending right away. */
  flush(): Promise<void>
  /** Moves the project to the trash. */
  trash(id: ProjectId): Promise<void>
}
