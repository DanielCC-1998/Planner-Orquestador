import {
  clampText,
  createProjectState,
  estimate,
  ok,
  copyWithNewIds,
  MAX_PROJECT_NAME_LENGTH,
  type Member,
  type NewProjectInput,
  type ProjectId,
  type ProjectState,
  type Result
} from '@domain'
import { fail, type AppError } from '../errors'
import type { Clock, IdGenerator, ProjectRepository, ProjectSerializer } from '../ports'
import type { ProjectSessions } from './ProjectSessions'

/** Summary for the project card on the main screen. */
export interface ProjectCard {
  readonly id: ProjectId
  readonly name: string
  readonly client: string
  readonly color: string
  readonly currency: string
  readonly archived: boolean
  readonly createdAt: string
  readonly updatedAt: string
  readonly taskCount: number
  readonly totalMinutes: number
  readonly totalCostCents: number
  readonly storyPoints: number
  readonly progress: number
  readonly sharedCount: number
  readonly members: readonly { readonly name: string; readonly initials: string; readonly color: string }[]
}

export interface CatalogDeps {
  readonly repo: ProjectRepository
  readonly sessions: ProjectSessions
  readonly serializer: ProjectSerializer
  readonly clock: Clock
  readonly ids: IdGenerator
}

export function cardOf(state: ProjectState): ProjectCard {
  const e = estimate(state)
  return {
    id: state.meta.id,
    name: state.meta.name,
    client: state.meta.client,
    color: state.meta.color,
    currency: state.meta.currency,
    archived: state.meta.archived,
    createdAt: state.meta.createdAt,
    updatedAt: state.meta.updatedAt,
    taskCount: state.tasks.size,
    totalMinutes: e.total.minutes,
    totalCostCents: e.total.costCents,
    storyPoints: e.total.storyPoints,
    progress: e.progress,
    sharedCount: e.shared.length,
    members: [...state.members.values()].map((m) => ({ name: m.name, initials: m.initials, color: m.color }))
  }
}

/** Characters Windows does not allow in file names. */
const UNSAFE_FILE_CHARS = /[\\/:*?"<>|]+/g

/** A file name derived from the project name; `fallback` when nothing usable is left. */
export function safeFileName(name: string, fallback: string): string {
  return name.replace(UNSAFE_FILE_CHARS, '_').trim() || fallback
}

/** Use cases over the set of projects (the cards screen). */
export class ProjectCatalog {
  private readonly cache = new Map<ProjectId, ProjectCard>()

  constructor(private readonly deps: CatalogDeps) {}

  /** Call when an open project changes. */
  invalidate(id: ProjectId): void {
    this.cache.delete(id)
  }

  async list(): Promise<ProjectCard[]> {
    const ids = await this.deps.repo.listIds()
    const cards: ProjectCard[] = []
    for (const id of ids) {
      const open = this.deps.sessions.current(id)
      if (open) {
        cards.push(cardOf(open))
        continue
      }
      let card = this.cache.get(id)
      if (!card) {
        const loaded = await this.deps.repo.load(id)
        if (!loaded.ok) continue
        card = cardOf(loaded.value.state)
        this.cache.set(id, card)
      }
      cards.push(card)
    }
    return cards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async create(input: NewProjectInput): Promise<Result<ProjectCard, AppError>> {
    const existing = await this.deps.repo.listIds()
    const created = createProjectState(this.deps.ids.next(), input, this.deps.clock.now(), existing.length)
    if (!created.ok) return created
    await this.deps.sessions.adopt(created.value)
    return ok(cardOf(created.value))
  }

  /** Copies a project with new ids. `copyName` builds the localized name of the copy (e.g. "X (copy)"). */
  async duplicate(id: ProjectId, copyName: (name: string) => string): Promise<Result<ProjectCard, AppError>> {
    const source = await this.deps.sessions.stateOf(id)
    if (!source.ok) return source
    const now = this.deps.clock.now()
    const copy = copyWithNewIds(source.value, this.deps.ids.next(), () => this.deps.ids.next())
    const state: ProjectState = {
      ...copy,
      meta: {
        ...copy.meta,
        name: clampText(copyName(copy.meta.name), MAX_PROJECT_NAME_LENGTH),
        archived: false,
        createdAt: now,
        updatedAt: now
      }
    }
    await this.deps.sessions.adopt(state)
    return ok(cardOf(state))
  }

  async trash(id: ProjectId): Promise<Result<void, AppError>> {
    const ids = await this.deps.repo.listIds()
    if (!ids.includes(id)) return fail('NOT_FOUND', 'The project does not exist', 'PROJECT_NOT_FOUND')
    this.deps.sessions.close(id)
    this.cache.delete(id)
    await this.deps.repo.trash(id)
    return ok(undefined)
  }

  /** `fallbackName` is the localized file name used when the project name has no usable characters. */
  async exportJson(id: ProjectId, fallbackName: string): Promise<Result<{ fileName: string; content: string }, AppError>> {
    const state = await this.deps.sessions.stateOf(id)
    if (!state.ok) return state
    const fileName = `${safeFileName(state.value.meta.name, fallbackName)}.planner.json`
    return ok({ fileName, content: this.deps.serializer.serialize(state.value) })
  }

  /** Imports a project; if its id already exists it gets new ids and the name from `renameOnClash`. */
  async importJson(content: string, renameOnClash: (name: string) => string): Promise<Result<ProjectCard, AppError>> {
    const parsed = this.deps.serializer.deserialize(content)
    if (!parsed.ok) return parsed
    const ids = await this.deps.repo.listIds()
    let state = parsed.value
    if (ids.includes(state.meta.id)) {
      state = copyWithNewIds(state, this.deps.ids.next(), () => this.deps.ids.next())
      state = { ...state, meta: { ...state.meta, name: clampText(renameOnClash(state.meta.name), MAX_PROJECT_NAME_LENGTH) } }
    }
    await this.deps.sessions.adopt(state)
    return ok(cardOf(state))
  }

  async membersOf(id: ProjectId): Promise<Result<Member[], AppError>> {
    const state = await this.deps.sessions.stateOf(id)
    if (!state.ok) return state
    return ok([...state.value.members.values()])
  }
}
