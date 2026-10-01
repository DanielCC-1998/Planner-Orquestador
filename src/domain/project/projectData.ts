import { domainError, err, ok, type DomainError, type ProjectId, type Result } from '../common/primitives'
import { TaskGraph, type StructureDTO } from '../graph/TaskGraph'
import type { Task } from '../task/Task'
import type { Member } from '../team/Member'
import type { ProjectMeta, ProjectState } from './Project'

/**
 * Flat form of the aggregate (lists instead of maps, structure as a DTO).
 * It is what is saved to disk and what travels to the interface.
 */
export interface ProjectData {
  readonly meta: ProjectMeta
  readonly members: readonly Member[]
  readonly tasks: readonly Task[]
  readonly structure: StructureDTO
}

export function toProjectData(state: ProjectState): ProjectData {
  return {
    meta: state.meta,
    members: [...state.members.values()],
    tasks: [...state.tasks.values()],
    structure: state.graph.toDTO()
  }
}

/** Rebuilds the aggregate from flat data, checking all its invariants. */
export function fromProjectData(data: ProjectData): Result<ProjectState, DomainError> {
  const tasks = new Map(data.tasks.map((t) => [t.id, t] as const))
  if (tasks.size !== data.tasks.length) {
    return err(domainError('CORRUPT', 'Some tasks have a repeated id', 'DUPLICATE_TASK_ID'))
  }
  const members = new Map(data.members.map((m) => [m.id, m] as const))
  if (members.size !== data.members.length) {
    return err(domainError('CORRUPT', 'Some people have a repeated id', 'DUPLICATE_MEMBER_ID'))
  }
  const graph = TaskGraph.fromDTO(data.structure, tasks.keys())
  if (!graph.ok) return err(domainError('CORRUPT', graph.error.message, graph.error.reason, graph.error.params))
  for (const t of tasks.values()) {
    if (t.assigneeId !== null && !members.has(t.assigneeId)) {
      tasks.set(t.id, { ...t, assigneeId: null })
    }
  }
  return ok({ meta: data.meta, members, tasks, graph: graph.value })
}

/**
 * Deep copy with new ids (project, people and tasks). Used to duplicate
 * projects or to import one whose id already exists.
 */
export function copyWithNewIds(state: ProjectState, projectId: ProjectId, makeId: () => string): ProjectState {
  const memberMap = new Map<string, string>()
  for (const id of state.members.keys()) memberMap.set(id, makeId())
  const taskMap = new Map<string, string>()
  for (const id of state.tasks.keys()) taskMap.set(id, makeId())
  const t = (id: string) => taskMap.get(id)!
  const dto = state.graph.toDTO()
  const structure: StructureDTO = {
    roots: dto.roots.map(t),
    children: Object.fromEntries(Object.entries(dto.children).map(([p, cs]) => [t(p), cs.map(t)])),
    parents: Object.fromEntries(Object.entries(dto.parents).map(([c, ps]) => [t(c), ps.map(t)]))
  }
  const tasks = [...state.tasks.values()].map((task) => ({
    ...task,
    id: t(task.id),
    assigneeId: task.assigneeId ? (memberMap.get(task.assigneeId) ?? null) : null
  }))
  const members = [...state.members.values()].map((m) => ({ ...m, id: memberMap.get(m.id)! }))
  const rebuilt = fromProjectData({ meta: { ...state.meta, id: projectId }, members, tasks, structure })
  if (!rebuilt.ok) throw new Error(rebuilt.error.message)
  return rebuilt.value
}
