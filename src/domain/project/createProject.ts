import { DEFAULT_WORKING_WEEKDAYS } from '../common/calendar'
import { paletteColor } from '../common/palette'
import { domainError, err, ok, type DomainError, type IsoDateTime, type ProjectId, type Result } from '../common/primitives'
import { TaskGraph } from '../graph/TaskGraph'
import type { ProjectMeta, ProjectState } from './Project'
import { validateMetaPatch } from './validateProject'

export interface NewProjectInput {
  readonly name: string
  readonly client?: string | undefined
  readonly description?: string | undefined
  readonly color?: string | undefined
  readonly currency?: string | undefined
  readonly defaultRateCents?: number | null | undefined
  readonly defaultHoursPerDay?: number | undefined
}

/** Creates an empty project with sensible defaults (EUR, 8 h/day, Monday to Friday). */
export function createProjectState(
  id: ProjectId,
  input: NewProjectInput,
  now: IsoDateTime,
  colorIndex = 0
): Result<ProjectState, DomainError> {
  const v = validateMetaPatch({
    name: input.name,
    client: input.client ?? '',
    description: input.description ?? '',
    color: input.color ?? paletteColor(colorIndex),
    currency: input.currency ?? 'EUR',
    defaultRateCents: input.defaultRateCents ?? null,
    defaultHoursPerDay: input.defaultHoursPerDay ?? 8
  })
  if (!v.ok) return v
  if (!v.value.name) return err(domainError('INVALID', 'The project name is required', 'PROJECT_NAME_REQUIRED'))
  const meta: ProjectMeta = {
    id,
    name: v.value.name,
    client: v.value.client ?? '',
    description: v.value.description ?? '',
    color: v.value.color ?? paletteColor(colorIndex),
    currency: v.value.currency ?? 'EUR',
    defaultRateCents: v.value.defaultRateCents ?? null,
    defaultHoursPerDay: v.value.defaultHoursPerDay ?? 8,
    startDate: null,
    workingWeekdays: DEFAULT_WORKING_WEEKDAYS,
    contingencyBps: 0,
    taxBps: 0,
    taxLabel: '',
    pointScale: null,
    quote: { number: '', date: null, validityDays: 30, terms: '' },
    archived: false,
    createdAt: now,
    updatedAt: now
  }
  return ok({ meta, members: new Map(), tasks: new Map(), graph: TaskGraph.empty() })
}
