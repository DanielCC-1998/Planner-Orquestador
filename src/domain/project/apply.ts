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
  type TaskId
} from '../common/primitives'
import { DEFAULT_TASK_FIELDS, MAX_TITLE_LENGTH, type Task } from '../task/Task'
import { validateTaskPatch } from '../task/validateTask'
import type { Member } from '../team/Member'
import { memberFieldsFrom, validateMemberPatch } from '../team/validateMember'
import type { Command } from './commands'
import type { ProjectState } from './Project'
import { validateMetaPatch } from './validateProject'

export interface ApplyContext {
  readonly now: IsoDateTime
  readonly newId: () => string
}

export interface ApplyOutcome {
  readonly state: ProjectState
  /** Ids created by the command (tasks or people), in order. */
  readonly created: readonly string[]
}

const NOT_FOUND_MESSAGES = {
  TASK_NOT_FOUND: 'The task does not exist',
  SOME_TASK_NOT_FOUND: 'One of the tasks does not exist',
  MEMBER_NOT_FOUND: 'The person does not exist'
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
      const task: Task = { ...DEFAULT_TASK_FIELDS, ...fields.value, id, createdAt: ctx.now, updatedAt: ctx.now }
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
      const tasks = new Map(state.tasks)
      tasks.set(cmd.id, { ...current, ...patch.value, updatedAt: ctx.now })
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
      const tasks = new Map(state.tasks)
      for (const id of new Set(cmd.ids)) {
        const current = tasks.get(id)
        if (!current) return notFound('SOME_TASK_NOT_FOUND')
        tasks.set(id, { ...current, ...patch.value, updatedAt: ctx.now })
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
        tasks.set(newId, { ...source, id: newId, title, createdAt: ctx.now, updatedAt: ctx.now })
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
  }
}
