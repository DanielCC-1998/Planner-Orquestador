import type { IsoDateTime, MemberId, TagId, TaskId } from '../common/primitives'

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type Priority = (typeof PRIORITIES)[number]

/** Maximum length of a task title. */
export const MAX_TITLE_LENGTH = 300

/** At most this many tags per task. */
export const MAX_TAGS_PER_TASK = 20

/** One status change of a task. `from` is null when the entry records the creation of the task. */
export interface StatusChange {
  readonly at: IsoDateTime
  readonly from: TaskStatus | null
  readonly to: TaskStatus
}

/** A task keeps its latest status changes; older ones are dropped beyond this many. */
export const MAX_STATUS_HISTORY = 1000

/** A task. Where it hangs (parents and children) is not part of the task: the graph keeps it. */
export interface Task {
  readonly id: TaskId
  readonly title: string
  readonly description: string
  readonly status: TaskStatus
  readonly priority: Priority
  readonly storyPoints: number | null
  /**
   * Hours typed by hand for the task's OWN work, on top of its subtasks' work. null = they come
   * from its story points through the project scale, or the task is unestimated.
   */
  readonly estimateMinutes: number | null
  readonly assigneeId: MemberId | null
  /** Hourly rate in cents that overrides the person's and the project's rates. */
  readonly rateCents: number | null
  /** Tags of the project (see ProjectMeta.tags) given to the task, without repetitions. */
  readonly tagIds: readonly TagId[]
  /**
   * Status changes, oldest first. Only the reducer writes it (see withStatus). Tasks from files
   * older than format 3 start with an empty history: their status is known, not its past.
   */
  readonly statusHistory: readonly StatusChange[]
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type TaskFields = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>
export type TaskPatch = Partial<TaskFields>

/** Values of a newly created task. */
export const DEFAULT_TASK_FIELDS: TaskFields = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  storyPoints: null,
  estimateMinutes: null,
  assigneeId: null,
  rateCents: null,
  tagIds: []
}
