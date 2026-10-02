import type { IsoDate, IsoDateTime, MemberId, ProjectId, TaskId } from '../common/primitives'
import type { PointScale } from '../estimation/pointScale'
import type { TaskGraph } from '../graph/TaskGraph'
import type { SprintSettings } from '../progress/sprints'
import type { Task } from '../task/Task'
import type { Member } from '../team/Member'
import type { TagDef } from './tags'

/** Maximum length of a project name. */
export const MAX_PROJECT_NAME_LENGTH = 200

/**
 * A party of the contract the quote becomes once it is signed: how it is identified and who signs
 * for it. Every field is optional text; an empty one is a blank line to fill in by hand in the PDF.
 */
export interface ContractParty {
  /** Company name or full name. */
  readonly legalName: string
  readonly taxId: string
  readonly address: string
  readonly email: string
  readonly signerName: string
  /** ID document of whoever signs. */
  readonly signerId: string
  readonly signerRole: string
}

export const EMPTY_PARTY: ContractParty = {
  legalName: '',
  taxId: '',
  address: '',
  email: '',
  signerName: '',
  signerId: '',
  signerRole: ''
}

/** Maximum length of each field of a contract party. */
export const PARTY_FIELD_LIMITS: Readonly<Record<keyof ContractParty, number>> = {
  legalName: 200,
  taxId: 50,
  address: 500,
  email: 200,
  signerName: 200,
  signerId: 50,
  signerRole: 100
}

/** Quote details shown in the PDF. */
export interface QuoteInfo {
  readonly number: string
  readonly date: IsoDate | null
  readonly validityDays: number | null
  /** Particular terms of this project (the general ones come from its contract model). */
  readonly terms: string
  /** The client as a party of the contract. */
  readonly client: ContractParty
  /**
   * Contract model of the issuer's library (general terms, law and courts) the quote is signed
   * under; null = their default model. The library lives outside the project.
   */
  readonly contractModelId: string | null
}

/** Maximum length of the id of a contract model. */
export const MAX_CONTRACT_MODEL_ID_LENGTH = 64

/** General details and calculation parameters of the project. */
export interface ProjectMeta {
  readonly id: ProjectId
  readonly name: string
  readonly client: string
  readonly description: string
  readonly color: string
  /** ISO 4217 (EUR, USD…). A single currency per project. */
  readonly currency: string
  readonly defaultRateCents: number | null
  readonly defaultHoursPerDay: number
  readonly startDate: IsoDate | null
  /** ISO working weekdays (1 = Monday … 7 = Sunday). */
  readonly workingWeekdays: readonly number[]
  readonly contingencyBps: number
  readonly taxBps: number
  readonly taxLabel: string
  /** How story points turn into hours; null = they do not (hours are only typed by hand). */
  readonly pointScale: PointScale | null
  /** Length of the sprints, counted from the start date (or the creation day); null = no sprints. */
  readonly sprints: SprintSettings | null
  /** Tags of the project, in creation order. Tasks refer to them by id; the tag commands change them. */
  readonly tags: readonly TagDef[]
  readonly quote: QuoteInfo
  readonly archived: boolean
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type MetaPatch = Partial<Omit<ProjectMeta, 'id' | 'createdAt' | 'updatedAt' | 'tags'>>

/**
 * The Project aggregate: details, team, tasks and their structure (graph).
 * It is immutable: every command produces a new state (see `apply`).
 */
export interface ProjectState {
  readonly meta: ProjectMeta
  /** Insertion order is display order. */
  readonly members: ReadonlyMap<MemberId, Member>
  readonly tasks: ReadonlyMap<TaskId, Task>
  readonly graph: TaskGraph
}
