import type { ProjectState, Result } from '@domain'
import type { AppError } from '../errors'

/** Converts projects to/from the interchange format (JSON export/import). */
export interface ProjectSerializer {
  serialize(state: ProjectState): string
  /** Errors carry the reason of the adapter (not JSON, not a Planner file, newer version…). */
  deserialize(text: string): Result<ProjectState, AppError>
}
