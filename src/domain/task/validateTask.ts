import { MAX_ESTIMATE_MINUTES } from '../common/duration'
import { ok, type DomainError, type Result } from '../common/primitives'
import { has, invalid, isNonNegInt, MAX_RATE_CENTS } from '../common/validation'
import type { ProjectState } from '../project/Project'
import { MAX_TAGS_PER_TASK, MAX_TITLE_LENGTH, PRIORITIES, TASK_STATUSES, type TaskPatch } from './Task'

/** Validates and normalizes the fields of a task. Checks that the assignee and the tags exist. */
export function validateTaskPatch(patch: TaskPatch, state: ProjectState): Result<TaskPatch, DomainError> {
  const out: { -readonly [K in keyof TaskPatch]: TaskPatch[K] } = {}
  if (has(patch, 'title')) {
    const title = String(patch.title).trim()
    if (title.length > MAX_TITLE_LENGTH) {
      return invalid(`The title cannot exceed ${MAX_TITLE_LENGTH} characters`, 'TITLE_TOO_LONG')
    }
    out.title = title
  }
  if (has(patch, 'description')) {
    const description = String(patch.description)
    if (description.length > 20_000) return invalid('The description is too long', 'DESCRIPTION_TOO_LONG')
    out.description = description
  }
  if (has(patch, 'status')) {
    if (!TASK_STATUSES.includes(patch.status!)) return invalid('Invalid status', 'INVALID_STATUS')
    out.status = patch.status!
  }
  if (has(patch, 'priority')) {
    if (!PRIORITIES.includes(patch.priority!)) return invalid('Invalid priority', 'INVALID_PRIORITY')
    out.priority = patch.priority!
  }
  if (has(patch, 'storyPoints')) {
    const sp = patch.storyPoints
    if (sp !== null) {
      if (typeof sp !== 'number' || !Number.isFinite(sp) || sp < 0 || sp > 10_000) {
        return invalid('Story points must be between 0 and 10,000', 'INVALID_STORY_POINTS')
      }
      out.storyPoints = Math.round(sp * 100) / 100
    } else out.storyPoints = null
  }
  if (has(patch, 'estimateMinutes')) {
    const m = patch.estimateMinutes
    if (m !== null && !isNonNegInt(m, MAX_ESTIMATE_MINUTES)) return invalid('Invalid estimate', 'INVALID_ESTIMATE')
    out.estimateMinutes = m ?? null
  }
  if (has(patch, 'assigneeId')) {
    const a = patch.assigneeId
    if (a !== null && !state.members.has(a!)) {
      return invalid('The assignee is not part of the project', 'UNKNOWN_ASSIGNEE')
    }
    out.assigneeId = a ?? null
  }
  if (has(patch, 'rateCents')) {
    const r = patch.rateCents
    if (r !== null && !isNonNegInt(r, MAX_RATE_CENTS)) return invalid('Invalid rate', 'INVALID_RATE')
    out.rateCents = r ?? null
  }
  if (has(patch, 'tagIds')) {
    if (!Array.isArray(patch.tagIds)) return invalid('Invalid tags', 'INVALID_TAGS')
    const known = new Set(state.meta.tags.map((t) => t.id))
    const tagIds: string[] = []
    for (const raw of patch.tagIds) {
      const id = String(raw)
      if (!known.has(id)) return invalid('The tag is not part of the project', 'UNKNOWN_TAG')
      if (!tagIds.includes(id)) tagIds.push(id)
    }
    if (tagIds.length > MAX_TAGS_PER_TASK) {
      return invalid(`At most ${MAX_TAGS_PER_TASK} tags per task`, 'TOO_MANY_TAGS', { max: MAX_TAGS_PER_TASK })
    }
    out.tagIds = tagIds
  }
  return ok(out)
}
