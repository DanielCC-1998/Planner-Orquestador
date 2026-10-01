import type { IsoDateTime, MemberId, TaskId } from '../common/primitives'

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type Priority = (typeof PRIORITIES)[number]

/** Maximum length of a task title. */
export const MAX_TITLE_LENGTH = 300

/** A task. Where it hangs (parents and children) is not part of the task: the graph keeps it. */
export interface Task {
  readonly id: TaskId
  readonly title: string
  readonly description: string
  readonly status: TaskStatus
  readonly priority: Priority
  readonly storyPoints: number | null
  /** The task's OWN work, on top of its subtasks' work. */
  readonly estimateMinutes: number | null
  readonly assigneeId: MemberId | null
  /** Hourly rate in cents that overrides the person's and the project's rates. */
  readonly rateCents: number | null
  readonly tags: readonly string[]
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type TaskFields = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
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
  tags: []
}
