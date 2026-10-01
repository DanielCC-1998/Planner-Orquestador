import { MAX_ESTIMATE_MINUTES } from '../common/duration'
import { ok, type DomainError, type Result } from '../common/primitives'
import { has, invalid, isNonNegInt, MAX_RATE_CENTS } from '../common/validation'
import type { ProjectState } from '../project/Project'
import { MAX_TITLE_LENGTH, PRIORITIES, TASK_STATUSES, type TaskPatch } from './Task'

/** Validates and normalizes the fields of a task. Checks that the assignee exists. */
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
  if (has(patch, 'tags')) {
    if (!Array.isArray(patch.tags)) return invalid('Invalid tags', 'INVALID_TAGS')
    const seen = new Set<string>()
    const tags: string[] = []
    for (const raw of patch.tags) {
      const t = String(raw).trim()
      if (!t) continue
      if (t.length > 40) return invalid('Each tag can have at most 40 characters', 'TAG_TOO_LONG')
      const key = t.toLocaleLowerCase('es')
      if (seen.has(key)) continue
      seen.add(key)
      tags.push(t)
    }
    if (tags.length > 20) return invalid('At most 20 tags per task', 'TOO_MANY_TAGS')
    out.tags = tags
  }
  return ok(out)
}
