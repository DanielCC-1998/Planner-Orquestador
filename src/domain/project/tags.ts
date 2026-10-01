import { domainError, err, ok, type DomainError, type Result, type TagId } from '../common/primitives'
import { invalid } from '../common/validation'

/** Vivid colors a tag can have. The interface and the PDF turn each key into actual colors. */
export const TAG_COLORS = [
  'red',
  'orange',
  'amber',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'fuchsia',
  'pink'
] as const
export type TagColor = (typeof TAG_COLORS)[number]

/** A tag of the project: it is created once and then picked for any of its tasks. */
export interface TagDef {
  readonly id: TagId
  readonly name: string
  readonly color: TagColor
}

export type TagPatch = Partial<Pick<TagDef, 'name' | 'color'>>

export const MAX_TAG_NAME_LENGTH = 40
export const MAX_PROJECT_TAGS = 200

/** Identity of a tag name: two names that only differ in case are the same tag. */
export const tagKey = (name: string): string => name.trim().toLocaleLowerCase('es')

export const isTagColor = (value: unknown): value is TagColor =>
  typeof value === 'string' && (TAG_COLORS as readonly string[]).includes(value)

/** Color of a new tag: the one after the color of the latest tag, so tags created in a row never share it. */
export function nextTagColor(tags: readonly TagDef[]): TagColor {
  const last = tags[tags.length - 1]
  return last ? TAG_COLORS[(TAG_COLORS.indexOf(last.color) + 1) % TAG_COLORS.length]! : TAG_COLORS[0]
}

/** The tags of a task, in the order of the project's list. */
export function tagsOfTask(tags: readonly TagDef[], ids: readonly TagId[]): TagDef[] {
  return ids.length === 0 ? [] : tags.filter((t) => ids.includes(t.id))
}

/** Validates and trims the name of a tag, unique in the project. `exceptId` is the tag being renamed. */
export function validateTagName(raw: unknown, tags: readonly TagDef[], exceptId?: TagId): Result<string, DomainError> {
  const name = String(raw ?? '').trim()
  if (!name) return invalid('The name is required', 'NAME_REQUIRED')
  if (name.length > MAX_TAG_NAME_LENGTH) {
    return invalid(`Each tag can have at most ${MAX_TAG_NAME_LENGTH} characters`, 'TAG_TOO_LONG')
  }
  const key = tagKey(name)
  if (tags.some((t) => t.id !== exceptId && tagKey(t.name) === key)) {
    return err(domainError('INVALID', `There is already a tag called "${name}"`, 'TAG_EXISTS', { name }))
  }
  return ok(name)
}
