import {
  toProjectData,
  type Member,
  type ProjectData,
  type ProjectMeta,
  type ProjectState,
  type StructureDTO,
  type Task
} from '@domain'

/** Full state the UI receives when it opens a project. */
export interface Snapshot extends ProjectData {
  readonly revision: number
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly readOnly: boolean
}

/** Changes made by a command. Only what changed is sent (compared by identity). */
export interface Delta {
  readonly revision: number
  readonly meta?: ProjectMeta
  readonly members?: readonly Member[]
  readonly tasks?: readonly Task[]
  readonly removed?: readonly string[]
  readonly structure?: StructureDTO
  readonly created: readonly string[]
  readonly canUndo: boolean
  readonly canRedo: boolean
}

export function toSnapshot(state: ProjectState, revision: number, canUndo: boolean, canRedo: boolean, readOnly: boolean): Snapshot {
  return { ...toProjectData(state), revision, canUndo, canRedo, readOnly }
}

export function diffStates(
  prev: ProjectState,
  next: ProjectState
): Pick<Delta, 'meta' | 'members' | 'tasks' | 'removed' | 'structure'> {
  const out: { -readonly [K in keyof Delta]?: Delta[K] } = {}
  if (prev.meta !== next.meta) out.meta = next.meta
  if (prev.members !== next.members) out.members = [...next.members.values()]
  if (prev.tasks !== next.tasks) {
    const changed: Task[] = []
    for (const [id, task] of next.tasks) if (prev.tasks.get(id) !== task) changed.push(task)
    const removed: string[] = []
    for (const id of prev.tasks.keys()) if (!next.tasks.has(id)) removed.push(id)
    if (changed.length) out.tasks = changed
    if (removed.length) out.removed = removed
  }
  if (prev.graph !== next.graph) out.structure = next.graph.toDTO()
  return out
}
