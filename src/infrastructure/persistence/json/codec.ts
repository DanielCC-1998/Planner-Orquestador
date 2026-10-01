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
export const CURRENT_SCHEMA_VERSION = 1

const ProjectDocSchema = z.object({
  format: z.literal(PROJECT_FORMAT),
  schemaVersion: z.number().int().min(1),
  meta: MetaSchema,
  members: z.array(MemberSchema),
  tasks: z.array(TaskSchema),
  structure: StructureSchema
})

type RawDoc = Record<string, unknown> & { schemaVersion: number }

/**
 * Format migrations: MIGRATIONS[n] turns a document of version n into version n+1.
 * When the format changes: bump CURRENT_SCHEMA_VERSION, add the migration and a test fixture.
 */
const MIGRATIONS: Record<number, (doc: RawDoc) => RawDoc> = {}

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
