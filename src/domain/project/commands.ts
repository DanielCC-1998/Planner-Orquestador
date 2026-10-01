import type { MemberId, TagId, TaskId } from '../common/primitives'
import type { TaskPatch } from '../task/Task'
import type { MemberInput, MemberPatch } from '../team/Member'
import type { MetaPatch } from './Project'
import type { TagColor, TagPatch } from './tags'

export type BulkTaskPatch = Pick<TaskPatch, 'status' | 'priority' | 'assigneeId'>

export type DeleteMode = 'cascade' | 'splice'

/**
 * Every change to a project. The same union travels over IPC from the UI.
 * Structure operations act on EDGES (parent → child), not on tasks.
 */
export type Command =
  | {
      readonly type: 'task.create'
      readonly parentId: TaskId | null
      readonly index?: number | undefined
      readonly fields?: TaskPatch | undefined
    }
  | { readonly type: 'task.update'; readonly id: TaskId; readonly patch: TaskPatch }
  | { readonly type: 'task.bulkUpdate'; readonly ids: readonly TaskId[]; readonly patch: BulkTaskPatch }
  | { readonly type: 'task.delete'; readonly id: TaskId; readonly mode: DeleteMode }
  | {
      readonly type: 'task.duplicate'
      readonly id: TaskId
      readonly parentId: TaskId | null
      readonly index?: number | undefined
      /** Title of the copy (the UI sends a localized "X (copy)"); absent = same title. Clamped to the maximum. */
      readonly title?: string | undefined
    }
  | {
      readonly type: 'edge.link'
      readonly parentId: TaskId
      readonly childId: TaskId
      readonly index?: number | undefined
    }
  | { readonly type: 'edge.unlink'; readonly parentId: TaskId; readonly childId: TaskId }
  | { readonly type: 'edge.setPrimary'; readonly parentId: TaskId; readonly childId: TaskId }
  | {
      readonly type: 'edge.move'
      readonly childId: TaskId
      readonly fromParentId: TaskId | null
      readonly toParentId: TaskId | null
      readonly index: number
    }
  | { readonly type: 'member.add'; readonly fields: MemberInput }
  | { readonly type: 'member.addMany'; readonly members: readonly MemberInput[] }
  | { readonly type: 'member.update'; readonly id: MemberId; readonly patch: MemberPatch }
  | { readonly type: 'member.remove'; readonly id: MemberId; readonly reassignTo: MemberId | null }
  | { readonly type: 'project.update'; readonly patch: MetaPatch }
  | {
      readonly type: 'tag.create'
      readonly name: string
      /** Absent = the next color of the rotation. */
      readonly color?: TagColor | undefined
      /** Tasks that get the new tag in the same step (e.g. "Create 'X'" from a task). */
      readonly assignTo?: readonly TaskId[] | undefined
    }
  | { readonly type: 'tag.update'; readonly id: TagId; readonly patch: TagPatch }
  | { readonly type: 'tag.delete'; readonly id: TagId }
  /** Gives the tag to the tasks (or takes it away when `assigned` is false). */
  | { readonly type: 'tag.assign'; readonly ids: readonly TaskId[]; readonly tagId: TagId; readonly assigned: boolean }

export type CommandType = Command['type']
