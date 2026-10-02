import { z } from 'zod'
import {
  err,
  fromProjectData,
  ok,
  toProjectData,
  type DomainError,
  type DomainErrorReason,
  type ErrorParams,
  type ProjectState,
  type Result
} from '@domain'
import type { ProjectSerializer } from '@application'
import type { InfraErrorReason } from '@shared/ipc/errors'
import { MemberSchema, MetaSchema, StructureSchema, TaskSchema } from '../../validation/schemas'

export const PROJECT_FORMAT = 'planner.project'
export const CURRENT_SCHEMA_VERSION = 4

const ProjectDocSchema = z.object({
  format: z.literal(PROJECT_FORMAT),
  schemaVersion: z.number().int().min(1),
  meta: MetaSchema,
  members: z.array(MemberSchema),
  tasks: z.array(TaskSchema),
  structure: StructureSchema
})

type RawDoc = Record<string, unknown> & { schemaVersion: number }

/** Colors given in turn to the tags converted from free text. Frozen, like every migration. */
const MIGRATED_TAG_COLORS = ['red', 'orange', 'amber', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'fuchsia', 'pink']

/**
 * 2 → 3: tasks get an empty status history (their past is unknown) and projects 2-week sprints.
 * The free-text tags of the tasks become tags of the project: one per name, ignoring case (the
 * first spelling wins), with fixed ids "tag-1", "tag-2"… so decoding the same file twice gives
 * the same project. It never throws: a malformed document is left for the schema to reject.
 */
function migrateTo3(doc: RawDoc): RawDoc {
  const meta = typeof doc['meta'] === 'object' && doc['meta'] !== null ? (doc['meta'] as Record<string, unknown>) : {}
  const tags: { id: string; name: string; color: string }[] = []
  const idByKey = new Map<string, string>()
  const tagIdsOf = (names: unknown): string[] => {
    const ids: string[] = []
    for (const value of Array.isArray(names) ? names : []) {
      if (typeof value !== 'string') continue
      const name = value.trim().slice(0, 40)
      if (!name) continue
      const key = name.toLocaleLowerCase('es')
      let id = idByKey.get(key)
      if (id === undefined) {
        id = `tag-${tags.length + 1}`
        idByKey.set(key, id)
        tags.push({ id, name, color: MIGRATED_TAG_COLORS[tags.length % MIGRATED_TAG_COLORS.length]! })
      }
      if (!ids.includes(id)) ids.push(id)
    }
    return ids
  }
  const tasks = Array.isArray(doc['tasks'])
    ? doc['tasks'].map((raw: unknown) => {
        if (typeof raw !== 'object' || raw === null) return raw
        const { tags: names, ...task } = raw as Record<string, unknown>
        return { ...task, tagIds: tagIdsOf(names), statusHistory: [] }
      })
    : doc['tasks']
  return { ...doc, schemaVersion: 3, meta: { ...meta, sprints: { length: 2, unit: 'week' }, tags }, tasks }
}

/**
 * 3 → 4: the quote gets the client as a party of the contract, empty (blank lines in the PDF), and
 * the default contract model of the library.
 */
function migrateTo4(doc: RawDoc): RawDoc {
  const meta = typeof doc['meta'] === 'object' && doc['meta'] !== null ? (doc['meta'] as Record<string, unknown>) : {}
  const quote = typeof meta['quote'] === 'object' && meta['quote'] !== null ? (meta['quote'] as Record<string, unknown>) : null
  if (!quote) return { ...doc, schemaVersion: 4 }
  const client = { legalName: '', taxId: '', address: '', email: '', signerName: '', signerId: '', signerRole: '' }
  return { ...doc, schemaVersion: 4, meta: { ...meta, quote: { ...quote, client, contractModelId: null } } }
}

/**
 * Format migrations: MIGRATIONS[n] turns a document of version n into version n+1.
 * When the format changes: bump CURRENT_SCHEMA_VERSION, add the migration and a test fixture.
 */
const MIGRATIONS: Record<number, (doc: RawDoc) => RawDoc> = {
  // 1 → 2: projects get a story points → hours scale, off by default. A literal on purpose:
  // a migration must keep producing the same document even if the domain defaults change.
  1: (doc) => ({ ...doc, schemaVersion: 2, meta: { ...(doc['meta'] as object), pointScale: null } }),
  2: migrateTo3,
  3: migrateTo4
}

/**
 * Error of the codec. Its reason is an infrastructure one (not JSON, not a Planner file…) or,
 * when the data breaks a domain invariant, the domain reason.
 */
export type CodecError = Omit<DomainError, 'reason'> & {
  readonly reason?: DomainErrorReason | InfraErrorReason | undefined
}

function codecError(
  code: 'CORRUPT' | 'NEWER_SCHEMA',
  message: string,
  reason: InfraErrorReason,
  params?: ErrorParams
): CodecError {
  return { code, message, reason, ...(params ? { params } : {}) }
}

export interface DecodedProject {
  readonly state: ProjectState
  /** Created by a newer version of the app: it opens without allowing changes. */
  readonly readOnly: boolean
  readonly migratedFrom: number | null
}

export function encodeProject(state: ProjectState): string {
  return JSON.stringify({ format: PROJECT_FORMAT, schemaVersion: CURRENT_SCHEMA_VERSION, ...toProjectData(state) }, null, 2)
}

export function decodeProject(text: string): Result<DecodedProject, CodecError> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return err(codecError('CORRUPT', 'The file is not valid JSON', 'NOT_JSON'))
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== PROJECT_FORMAT) {
    return err(codecError('CORRUPT', 'The file is not a Planner project', 'NOT_PLANNER_FILE'))
  }
  let doc = raw as RawDoc
  if (!Number.isInteger(doc.schemaVersion) || doc.schemaVersion < 1) {
    return err(codecError('CORRUPT', 'Invalid format version', 'BAD_FORMAT_VERSION'))
  }
  const original = doc.schemaVersion
  const readOnly = original > CURRENT_SCHEMA_VERSION
  while (doc.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[doc.schemaVersion]
    if (!migrate) {
      const version = doc.schemaVersion
      return err(codecError('CORRUPT', `There is no migration from version ${version}`, 'NO_MIGRATION', { version }))
    }
    doc = migrate(doc)
  }
  const parsed = ProjectDocSchema.safeParse(doc)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const detail = `${issue?.path.join('.') || 'document'}: ${issue?.message ?? 'error'}`
    return err(codecError('CORRUPT', `Project with invalid data (${detail})`, 'INVALID_PROJECT_DATA', { detail }))
  }
  const state = fromProjectData(parsed.data)
  if (!state.ok) return state
  return ok({ state: state.value, readOnly, migratedFrom: original < CURRENT_SCHEMA_VERSION ? original : null })
}

/** Interchange format for export/import: the same as on disk. */
export const jsonProjectSerializer: ProjectSerializer = {
  serialize: encodeProject,
  deserialize(text) {
    const decoded = decodeProject(text)
    if (!decoded.ok) return err(decoded.error)
    if (decoded.value.readOnly) {
      return err(codecError('NEWER_SCHEMA', 'The file comes from a newer version of Planner. Update the app.', 'NEWER_SCHEMA'))
    }
    return ok(decoded.value.state)
  }
}
