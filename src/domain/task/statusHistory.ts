import type { IsoDateTime } from '../common/primitives'
import { MAX_STATUS_HISTORY, type StatusChange, type Task, type TaskStatus } from './Task'

/** History of a task that is created now with status `status`. */
export function createdHistory(status: TaskStatus, now: IsoDateTime): readonly StatusChange[] {
  return [{ at: now, from: null, to: status }]
}

/**
 * The task with status `to`. A real change is appended to its history; this is the only place
 * that writes it. The timestamp never goes back in time, so the history stays in order even if
 * the system clock does. Only the latest MAX_STATUS_HISTORY changes are kept.
 */
export function withStatus(task: Task, to: TaskStatus, now: IsoDateTime): Task {
  if (task.status === to) return task
  const last = task.statusHistory[task.statusHistory.length - 1]
  const at = last !== undefined && last.at > now ? last.at : now
  const history = [...task.statusHistory, { at, from: task.status, to }]
  return {
    ...task,
    status: to,
    statusHistory: history.length > MAX_STATUS_HISTORY ? history.slice(history.length - MAX_STATUS_HISTORY) : history
  }
}
