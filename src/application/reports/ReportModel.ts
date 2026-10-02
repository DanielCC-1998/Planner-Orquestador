import type { ChangeDirection, ContractParty, Language, MoneyBreakdown, SprintSettings, TagColor, TaskStatus } from '@domain'
import type { ContractModel, Issuer } from '../settings/Settings'

export interface ReportSections {
  readonly cover: boolean
  readonly summary: boolean
  readonly breakdown: boolean
  readonly workload: boolean
  readonly shared: boolean
  /** Particular terms of the project and general terms of the issuer. */
  readonly terms: boolean
  /** Last page: the parties, the acceptance, the governing law and room for both signatures. */
  readonly signatures: boolean
}

export interface ReportColumns {
  readonly hours: boolean
  readonly cost: boolean
  readonly rate: boolean
  readonly storyPoints: boolean
  readonly assignee: boolean
  /** Status column, plus the "Task status" section with the progress by sprint. */
  readonly status: boolean
  /** Tag chips next to the task titles. */
  readonly tags: boolean
}

/** Where task descriptions go in the PDF. */
export type DescriptionPlacement = 'none' | 'inline' | 'section'

export interface ReportOptions {
  /** Language of the PDF texts, number and date formats, footer and file name. */
  readonly language: Language
  readonly sections: ReportSections
  readonly columns: ReportColumns
  /** Levels shown in the breakdown; null = all. Deeper levels are added into their ancestor. */
  readonly maxDepth: number | null
  /** Down to which level subtotal rows are added. */
  readonly subtotalDepth: number
  readonly pageSize: 'A4' | 'Letter'
  readonly landscape: boolean
  readonly openAfterExport: boolean
  /** 'inline': under each task of the breakdown; 'section': a separate "Task details" section. */
  readonly descriptions: DescriptionPlacement
  /** With the signatures page: boxes in the footer of every page for the initials of both parties. */
  readonly initials: boolean
}

/**
 * Options remembered per project. Options saved before the PDF could be exported in English
 * have no language: the export dialog then uses the interface language.
 */
export type StoredReportOptions = Omit<ReportOptions, 'language'> & { readonly language?: Language | undefined }

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  language: 'en',
  sections: { cover: true, summary: true, breakdown: true, workload: true, shared: true, terms: true, signatures: true },
  columns: { hours: true, cost: true, rate: false, storyPoints: true, assignee: true, status: false, tags: false },
  maxDepth: null,
  subtotalDepth: 2,
  pageSize: 'A4',
  landscape: false,
  openAfterExport: true,
  descriptions: 'section',
  initials: true
}

/** A tag as printed: its name and the key of its color. */
export interface ReportTag {
  readonly name: string
  readonly color: TagColor
}

export type ReportRow =
  | {
      readonly kind: 'task'
      readonly code: string
      readonly depth: number
      /** Raw task title; '' = untitled (the renderer shows the localized placeholder). */
      readonly title: string
      /** In the order of the project's tag list. */
      readonly tags: readonly ReportTag[]
      readonly assignee: string | null
      readonly status: TaskStatus
      readonly storyPoints: number
      readonly minutes: number
      readonly costCents: number
      readonly rateCents: number | null
      /** Descendants added into this row because of the depth limit. */
      readonly collapsedCount: number
      readonly isParent: boolean
      /** Trimmed description ('' if it has none). */
      readonly description: string
      /** Raw titles of the ancestors along the primary chain ('' = untitled). */
      readonly path: readonly string[]
      /** Contribution of the task (own work + subtasks counted under it). */
      readonly attrMinutes: number
      readonly attrCostCents: number
    }
  | {
      readonly kind: 'reference'
      readonly code: string
      readonly depth: number
      readonly title: string
      /** 'see': the task is at refCode; 'included': it is inside refCode because of the depth limit. */
      readonly refKind: 'see' | 'included'
      readonly refCode: string
    }
  | {
      readonly kind: 'subtotal'
      readonly code: string
      readonly depth: number
      readonly title: string
      readonly storyPoints: number
      readonly minutes: number
      readonly costCents: number
    }

export interface ReportWorkloadRow {
  /** Person's name; '' for the unassigned group (see `isUnassigned`). */
  readonly name: string
  readonly role: string
  readonly hoursPerDay: number
  readonly minutes: number
  readonly costCents: number
  readonly storyPoints: number
  readonly days: number
  readonly isBottleneck: boolean
  readonly isUnassigned: boolean
}

export interface ReportSharedRow {
  readonly code: string
  readonly title: string
  readonly parents: readonly { readonly code: string; readonly title: string }[]
  readonly occurrences: number
  readonly minutes: number
  readonly costCents: number
  readonly savedMinutes: number
  readonly savedCents: number
}

/** A task in the status lanes of the "Task status" section. */
export interface ReportLaneTask {
  readonly code: string
  /** Raw title ('' = untitled). */
  readonly title: string
  readonly isParent: boolean
  readonly tags: readonly ReportTag[]
}

/** Net status change of a task in a sprint. */
export interface ReportSprintChange {
  readonly code: string
  readonly title: string
  readonly from: TaskStatus
  readonly to: TaskStatus
  readonly direction: ChangeDirection
  readonly tags: readonly ReportTag[]
}

export interface ReportSprint {
  /** 1, 2, 3…; 0 = changes recorded before the first sprint. */
  readonly number: number
  /** Local dates; `start` is null for the group before the first sprint. */
  readonly start: string | null
  readonly end: string
  /** It contains the date of the report. */
  readonly current: boolean
  /** Sorted by WBS code; only tasks whose status at the end differs from the start. */
  readonly changes: readonly ReportSprintChange[]
}

/** "Task status" section, built only when the status option is on. */
export interface ReportProgress {
  /** Local date of the report. */
  readonly asOf: string
  /** Every task, parents included, by its current status and sorted by WBS code. */
  readonly lanes: Readonly<Record<TaskStatus, readonly ReportLaneTask[]>>
  /** null = the project does not work in sprints. */
  readonly sprintSettings: SprintSettings | null
  /** First day of sprint 1. */
  readonly sprintStart: string
  /** From the first sprint to the current one, plus the group before the first sprint if it has changes. */
  readonly sprints: readonly ReportSprint[]
}

export interface ReportModel {
  readonly generatedAt: string
  readonly options: ReportOptions
  readonly issuer: Issuer
  /** Contract model the quote is signed under (general terms, law and courts); null = none. */
  readonly contract: ContractModel | null
  readonly project: {
    readonly name: string
    readonly client: string
    readonly description: string
    readonly color: string
    readonly currency: string
    /** As set in the project; '' = the localized default label (IVA / Tax). */
    readonly taxLabel: string
    readonly contingencyBps: number
    readonly taxBps: number
    readonly startDate: string | null
    readonly quoteNumber: string
    readonly quoteDate: string
    readonly validUntil: string | null
    readonly terms: string
    /** The client as a party of the contract (its empty fields are blank lines). */
    readonly clientParty: ContractParty
  }
  readonly summary: {
    readonly totalMinutes: number
    readonly contingencyMinutes: number
    readonly storyPoints: number
    readonly taskCount: number
    readonly money: MoneyBreakdown
    readonly days: number
    readonly weeks: number | null
    readonly endDate: string | null
    /** Who sets the pace: a person or the unassigned group. */
    readonly bottleneck: { readonly name: string; readonly unassigned: boolean } | null
    readonly savingsMinutes: number
    readonly savingsCents: number
    readonly progress: number
  }
  readonly rows: readonly ReportRow[]
  /** null when the status option is off. */
  readonly progress: ReportProgress | null
  readonly workload: readonly ReportWorkloadRow[]
  readonly shared: readonly ReportSharedRow[]
  readonly team: readonly { readonly name: string; readonly role: string; readonly rateCents: number | null; readonly hoursPerDay: number }[]
}
