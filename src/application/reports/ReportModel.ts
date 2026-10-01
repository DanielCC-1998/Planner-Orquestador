import type { Language, MoneyBreakdown, TaskStatus } from '@domain'
import type { Issuer } from '../settings/Settings'

export interface ReportSections {
  readonly cover: boolean
  readonly summary: boolean
  readonly breakdown: boolean
  readonly workload: boolean
  readonly shared: boolean
  readonly terms: boolean
}

export interface ReportColumns {
  readonly hours: boolean
  readonly cost: boolean
  readonly rate: boolean
  readonly storyPoints: boolean
  readonly assignee: boolean
  readonly status: boolean
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
}

/**
 * Options remembered per project. Options saved before the PDF could be exported in English
 * have no language: the export dialog then uses the interface language.
 */
export type StoredReportOptions = Omit<ReportOptions, 'language'> & { readonly language?: Language | undefined }

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  language: 'en',
  sections: { cover: true, summary: true, breakdown: true, workload: true, shared: true, terms: true },
  columns: { hours: true, cost: true, rate: false, storyPoints: true, assignee: true, status: false },
  maxDepth: null,
  subtotalDepth: 2,
  pageSize: 'A4',
  landscape: false,
  openAfterExport: true,
  descriptions: 'section'
}

export type ReportRow =
  | {
      readonly kind: 'task'
      readonly code: string
      readonly depth: number
      /** Raw task title; '' = untitled (the renderer shows the localized placeholder). */
      readonly title: string
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

export interface ReportModel {
  readonly generatedAt: string
  readonly options: ReportOptions
  readonly issuer: Issuer
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
  readonly workload: readonly ReportWorkloadRow[]
  readonly shared: readonly ReportSharedRow[]
  readonly team: readonly { readonly name: string; readonly role: string; readonly rateCents: number | null; readonly hoursPerDay: number }[]
}
