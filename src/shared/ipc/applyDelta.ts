import { TaskGraph, type ProjectState, type Task } from '@domain'
import type { Delta } from '@application'

/**
 * Applies a delta received from main to the local state of the UI. Keeps the identity of
 * everything that did not change (memoized rows are not rendered again).
 */
export function applyDelta(state: ProjectState, delta: Delta): ProjectState {
  let tasks = state.tasks
  if (delta.tasks?.length || delta.removed?.length) {
    const next = new Map<string, Task>(state.tasks)
    for (const t of delta.tasks ?? []) next.set(t.id, t)
    for (const id of delta.removed ?? []) next.delete(id)
    tasks = next
  }
  let graph = state.graph
  if (delta.structure) {
    const rebuilt = TaskGraph.fromDTO(delta.structure, tasks.keys())
    if (!rebuilt.ok) throw new Error(rebuilt.error.message)
    graph = rebuilt.value
  }
  return {
    meta: delta.meta ?? state.meta,
    members: delta.members ? new Map(delta.members.map((m) => [m.id, m])) : state.members,
    tasks,
    graph
  }
}
