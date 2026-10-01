import type { GraphError, TaskGraph } from '../graph/TaskGraph'
import {
  clampText,
  domainError,
  err,
  ok,
  type DomainError,
  type DomainErrorReason,
  type IsoDateTime,
  type MemberId,
  type Result,
  type TagId,
  type TaskId
} from '../common/primitives'
import { invalid } from '../common/validation'
import { createdHistory, withStatus } from '../task/statusHistory'
import { DEFAULT_TASK_FIELDS, MAX_TAGS_PER_TASK, MAX_TITLE_LENGTH, type Task } from '../task/Task'
import { validateTaskPatch } from '../task/validateTask'
import type { Member } from '../team/Member'
import { memberFieldsFrom, validateMemberPatch } from '../team/validateMember'
import type { Command } from './commands'
import type { ProjectState } from './Project'
import { isTagColor, MAX_PROJECT_TAGS, nextTagColor, validateTagName, type TagDef } from './tags'
import { validateMetaPatch } from './validateProject'

export interface ApplyContext {
  readonly now: IsoDateTime
  readonly newId: () => string
}

export interface ApplyOutcome {
  readonly state: ProjectState
  /** Ids created by the command (tasks, people or tags), in order. */
  readonly created: readonly string[]
}

const NOT_FOUND_MESSAGES = {
  TASK_NOT_FOUND: 'The task does not exist',
  SOME_TASK_NOT_FOUND: 'One of the tasks does not exist',
  MEMBER_NOT_FOUND: 'The person does not exist',
  UNKNOWN_TAG: 'The tag is not part of the project'
} as const satisfies Partial<Record<DomainErrorReason, string>>

const notFound = (reason: keyof typeof NOT_FOUND_MESSAGES): Result<never, DomainError> =>
  err(domainError('NOT_FOUND', NOT_FOUND_MESSAGES[reason], reason))
const fromGraph = (e: GraphError): Result<never, DomainError> => err(domainError(e.code, e.message, e.reason, e.params))

function touch(state: ProjectState, now: IsoDateTime): ProjectState {
  return { ...state, meta: { ...state.meta, updatedAt: now } }
}

function done(state: ProjectState, ctx: ApplyContext, created: readonly string[] = []): Result<ApplyOutcome, DomainError> {
  return ok({ state: touch(state, ctx.now), created })
}

function withGraph(state: ProjectState, graph: Result<TaskGraph, GraphError>, ctx: ApplyContext) {
  if (!graph.ok) return fromGraph(graph.error)
  return done({ ...state, graph: graph.value }, ctx)
}

/** Tasks after giving the tag to `ids` (or taking it away). The same map when nothing changes. */
function assignTag(
  state: ProjectState,
  ids: readonly TaskId[],
  tagId: TagId,
  assigned: boolean,
  now: IsoDateTime
): Result<ReadonlyMap<TaskId, Task>, DomainError> {
  let tasks = state.tasks
  for (const id of new Set(ids)) {
    const task = state.tasks.get(id)
    if (!task) return notFound('SOME_TASK_NOT_FOUND')
    if (task.tagIds.includes(tagId) === assigned) continue
    if (assigned && task.tagIds.length >= MAX_TAGS_PER_TASK) {
      return invalid(`At most ${MAX_TAGS_PER_TASK} tags per task`, 'TOO_MANY_TAGS', { max: MAX_TAGS_PER_TASK })
    }
    if (tasks === state.tasks) tasks = new Map(state.tasks)
    const tagIds = assigned ? [...task.tagIds, tagId] : task.tagIds.filter((t) => t !== tagId)
    ;(tasks as Map<TaskId, Task>).set(id, { ...task, tagIds, updatedAt: now })
  }
  return ok(tasks)
}

/**
 * Pure reducer of the Project aggregate: validates the command and returns the new state.
 * It never mutates `state`; it shares the tasks, people and graph that do not change
 * (the application layer computes the deltas by identity).
 */
export function apply(state: ProjectState, cmd: Command, ctx: ApplyContext): Result<ApplyOutcome, DomainError> {
  switch (cmd.type) {
    case 'task.create': {
      const fields = validateTaskPatch(cmd.fields ?? {}, state)
      if (!fields.ok) return fields
      const id = ctx.newId()
      const graph = state.graph.addNode(id, cmd.parentId, cmd.index)
      if (!graph.ok) return fromGraph(graph.error)
      const values = { ...DEFAULT_TASK_FIELDS, ...fields.value }
      const task: Task = {
        ...values,
        id,
        statusHistory: createdHistory(values.status, ctx.now),
        createdAt: ctx.now,
        updatedAt: ctx.now
      }
      const tasks = new Map(state.tasks)
      tasks.set(id, task)
      return done({ ...state, tasks, graph: graph.value }, ctx, [id])
    }

    case 'task.update': {
      const current = state.tasks.get(cmd.id)
      if (!current) return notFound('TASK_NOT_FOUND')
      const patch = validateTaskPatch(cmd.patch, state)
      if (!patch.ok) return patch
      if (Object.keys(patch.value).length === 0) return ok({ state, created: [] })
      const { status, ...fields } = patch.value
      const updated: Task = { ...current, ...fields, updatedAt: ctx.now }
      const tasks = new Map(state.tasks)
      tasks.set(cmd.id, status === undefined ? updated : withStatus(updated, status, ctx.now))
      return done({ ...state, tasks }, ctx)
    }

    case 'task.bulkUpdate': {
      const patch = validateTaskPatch(
        {
          ...(cmd.patch.status !== undefined ? { status: cmd.patch.status } : {}),
          ...(cmd.patch.priority !== undefined ? { priority: cmd.patch.priority } : {}),
          ...(cmd.patch.assigneeId !== undefined ? { assigneeId: cmd.patch.assigneeId } : {})
        },
        state
      )
      if (!patch.ok) return patch
      const { status, ...fields } = patch.value
      const tasks = new Map(state.tasks)
      for (const id of new Set(cmd.ids)) {
        const current = tasks.get(id)
        if (!current) return notFound('SOME_TASK_NOT_FOUND')
        const updated: Task = { ...current, ...fields, updatedAt: ctx.now }
        tasks.set(id, status === undefined ? updated : withStatus(updated, status, ctx.now))
      }
      return done({ ...state, tasks }, ctx)
    }

    case 'task.delete': {
      if (!state.tasks.has(cmd.id)) return notFound('TASK_NOT_FOUND')
      const tasks = new Map(state.tasks)
      if (cmd.mode === 'splice') {
        tasks.delete(cmd.id)
        return done({ ...state, tasks, graph: state.graph.removeSplice(cmd.id) }, ctx)
      }
      const { graph, removed } = state.graph.removeCascade(cmd.id)
      for (const id of removed) tasks.delete(id)
      return done({ ...state, tasks, graph }, ctx)
    }

    case 'task.duplicate': {
      const original = state.tasks.get(cmd.id)
      if (!original) return notFound('TASK_NOT_FOUND')
      const siblings = state.graph.siblings(cmd.parentId)
      const at = siblings.indexOf(cmd.id)
      const index = cmd.index ?? (at >= 0 ? at + 1 : siblings.length)
      const result = state.graph.duplicateSubtree(cmd.id, ctx.newId, cmd.parentId, index)
      if (!result.ok) return fromGraph(result.error)
      const tasks = new Map(state.tasks)
      const created: TaskId[] = []
      for (const [oldId, newId] of result.value.mapping) {
        const source = state.tasks.get(oldId)!
        const title = oldId === cmd.id && cmd.title !== undefined ? clampText(cmd.title, MAX_TITLE_LENGTH) : source.title
        // The copy is a new task: its history starts now, with the status of the original.
        tasks.set(newId, {
          ...source,
          id: newId,
          title,
          statusHistory: createdHistory(source.status, ctx.now),
          createdAt: ctx.now,
          updatedAt: ctx.now
        })
        created.push(newId)
      }
      return done({ ...state, tasks, graph: result.value.graph }, ctx, created)
    }

    case 'edge.link':
      return withGraph(state, state.graph.link(cmd.parentId, cmd.childId, cmd.index), ctx)

    case 'edge.unlink':
      return withGraph(state, state.graph.unlink(cmd.parentId, cmd.childId), ctx)

    case 'edge.setPrimary':
      return withGraph(state, state.graph.setPrimary(cmd.childId, cmd.parentId), ctx)

    case 'edge.move':
      return withGraph(state, state.graph.moveEdge(cmd.childId, cmd.fromParentId, cmd.toParentId, cmd.index), ctx)

    case 'member.add':
    case 'member.addMany': {
      const inputs = cmd.type === 'member.add' ? [cmd.fields] : cmd.members
      const members = new Map(state.members)
      const created: MemberId[] = []
      for (const input of inputs) {
        const fields = memberFieldsFrom(input, members.size)
        if (!fields.ok) return fields
        const id = ctx.newId()
        members.set(id, { ...fields.value, id })
        created.push(id)
      }
      return done({ ...state, members }, ctx, created)
    }

    case 'member.update': {
      const current = state.members.get(cmd.id)
      if (!current) return notFound('MEMBER_NOT_FOUND')
      const patch = validateMemberPatch(cmd.patch)
      if (!patch.ok) return patch
      const members = new Map(state.members)
      const next: Member = { ...current, ...patch.value }
      members.set(cmd.id, next)
      return done({ ...state, members }, ctx)
    }

    case 'member.remove': {
      if (!state.members.has(cmd.id)) return notFound('MEMBER_NOT_FOUND')
      if (cmd.reassignTo !== null && (cmd.reassignTo === cmd.id || !state.members.has(cmd.reassignTo))) {
        return err(domainError('INVALID', 'The person to reassign the tasks to is not valid', 'INVALID_REASSIGN'))
      }
      const members = new Map(state.members)
      members.delete(cmd.id)
      let tasks = state.tasks
      for (const [id, task] of state.tasks) {
        if (task.assigneeId !== cmd.id) continue
        if (tasks === state.tasks) tasks = new Map(state.tasks)
        ;(tasks as Map<TaskId, Task>).set(id, { ...task, assigneeId: cmd.reassignTo, updatedAt: ctx.now })
      }
      return done({ ...state, members, tasks }, ctx)
    }

    case 'project.update': {
      const patch = validateMetaPatch(cmd.patch)
      if (!patch.ok) return patch
      return done({ ...state, meta: { ...state.meta, ...patch.value } }, ctx)
    }

    case 'tag.create': {
      const existing = state.meta.tags
      if (existing.length >= MAX_PROJECT_TAGS) {
        return invalid(`At most ${MAX_PROJECT_TAGS} tags per project`, 'TOO_MANY_PROJECT_TAGS', { max: MAX_PROJECT_TAGS })
      }
      const name = validateTagName(cmd.name, existing)
      if (!name.ok) return name
      if (cmd.color !== undefined && !isTagColor(cmd.color)) return invalid('Invalid color', 'INVALID_COLOR')
      const tag: TagDef = { id: ctx.newId(), name: name.value, color: cmd.color ?? nextTagColor(existing) }
      const withTag: ProjectState = { ...state, meta: { ...state.meta, tags: [...existing, tag] } }
      const tasks = assignTag(withTag, cmd.assignTo ?? [], tag.id, true, ctx.now)
      if (!tasks.ok) return tasks
      return done({ ...withTag, tasks: tasks.value }, ctx, [tag.id])
    }

    case 'tag.update': {
      const index = state.meta.tags.findIndex((t) => t.id === cmd.id)
      if (index < 0) return notFound('UNKNOWN_TAG')
      const current = state.meta.tags[index]!
      let next: TagDef = current
      if (cmd.patch.name !== undefined) {
        const name = validateTagName(cmd.patch.name, state.meta.tags, cmd.id)
        if (!name.ok) return name
        next = { ...next, name: name.value }
      }
      if (cmd.patch.color !== undefined) {
        if (!isTagColor(cmd.patch.color)) return invalid('Invalid color', 'INVALID_COLOR')
        next = { ...next, color: cmd.patch.color }
      }
      if (next.name === current.name && next.color === current.color) return ok({ state, created: [] })
      const tags = state.meta.tags.map((t, i) => (i === index ? next : t))
      return done({ ...state, meta: { ...state.meta, tags } }, ctx)
    }

    case 'tag.delete': {
      if (!state.meta.tags.some((t) => t.id === cmd.id)) return notFound('UNKNOWN_TAG')
      const tasks = assignTag(state, [...state.tasks.keys()], cmd.id, false, ctx.now)
      if (!tasks.ok) return tasks
      const tags = state.meta.tags.filter((t) => t.id !== cmd.id)
      return done({ ...state, meta: { ...state.meta, tags }, tasks: tasks.value }, ctx)
    }

    case 'tag.assign': {
      if (!state.meta.tags.some((t) => t.id === cmd.tagId)) return notFound('UNKNOWN_TAG')
      const tasks = assignTag(state, cmd.ids, cmd.tagId, cmd.assigned, ctx.now)
      if (!tasks.ok) return tasks
      if (tasks.value === state.tasks) return ok({ state, created: [] })
      return done({ ...state, tasks: tasks.value }, ctx)
    }
  }
}
