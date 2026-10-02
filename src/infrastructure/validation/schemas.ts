import { z } from 'zod'
import {
  DEFAULT_SPRINT_SETTINGS,
  isTagColor,
  LANGUAGES,
  MAX_ESTIMATE_MINUTES,
  MAX_POINT_OVERRIDES,
  MAX_SPRINT_LENGTH,
  MAX_STATUS_HISTORY,
  MAX_TAG_NAME_LENGTH,
  MAX_TAGS_PER_TASK,
  PARTY_FIELD_LIMITS,
  PRIORITIES,
  SPRINT_UNITS,
  TASK_STATUSES,
  tagKey,
  type StatusChange,
  type TagDef,
  type TaskStatus
} from '@domain'
import { LANGUAGE_PREFERENCES } from '@application'
import { LIBRARY_LIMITS } from '@shared/terms'

/**
 * Zod schemas shared by the adapters: they validate everything that comes in from outside
 * the hexagon (files on disk and IPC messages from the renderer).
 */
export const IdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid id')
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
/** Tag ids are UUIDs; tags converted from free text by the 2 → 3 migration have short ids ("tag-1"). */
const TAG_ID = /^[A-Za-z0-9-]{1,64}$/
export const TagIdSchema = z.string().regex(TAG_ID, 'Invalid id')
const Cents = z.number().int().min(0).max(1_000_000_000)
const Bps = z.number().int().min(0).max(100_000)
const Color = z.string().regex(/^#[0-9a-f]{6}$/i)
const Minutes = z.number().int().min(0).max(MAX_ESTIMATE_MINUTES)

/** Story points → hours scale of a project (see the domain's PointScale). */
export const PointScaleSchema = z
  .object({
    minutesPerPoint: Minutes.min(1),
    overrides: z
      .array(z.object({ points: z.number().gt(0).max(10_000), minutes: Minutes }))
      .max(MAX_POINT_OVERRIDES)
  })
  .superRefine((scale, ctx) => {
    const points = scale.overrides.map((o) => o.points)
    if (points.includes(1)) ctx.addIssue({ code: 'custom', message: 'One point is the base, not an exception' })
    if (new Set(points).size !== points.length) ctx.addIssue({ code: 'custom', message: 'Repeated story points' })
  })

// The fields added in format 3 are read leniently: a damaged history or tag list is cleaned up
// instead of sending the whole project to quarantine.

const isStatus = (value: unknown): value is TaskStatus => (TASK_STATUSES as readonly unknown[]).includes(value)

/** Keeps the valid entries (latest MAX_STATUS_HISTORY), with their timestamps in one ISO format. */
function cleanHistory(entries: readonly unknown[]): StatusChange[] {
  const out: StatusChange[] = []
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue
    const { at, from, to } = entry as Record<string, unknown>
    const time = typeof at === 'string' ? Date.parse(at) : Number.NaN
    if (Number.isNaN(time) || !isStatus(to) || (from !== null && !isStatus(from))) continue
    out.push({ at: new Date(time).toISOString(), from, to })
  }
  return out.slice(-MAX_STATUS_HISTORY)
}

/**
 * Safety limit when reading. It is far above MAX_PROJECT_TAGS (a limit to create tags) so the tags of
 * an older file with many free-text tags are not lost when it is migrated.
 */
const MAX_STORED_TAGS = 10_000

/** Keeps the valid tags of a project, without repeated ids or names. */
function cleanTags(entries: readonly unknown[]): TagDef[] {
  const out: TagDef[] = []
  const ids = new Set<string>()
  const keys = new Set<string>()
  for (const entry of entries) {
    if (out.length >= MAX_STORED_TAGS) break
    if (typeof entry !== 'object' || entry === null) continue
    const { id, name, color } = entry as Record<string, unknown>
    if (typeof id !== 'string' || !TAG_ID.test(id) || typeof name !== 'string' || !isTagColor(color)) continue
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > MAX_TAG_NAME_LENGTH || ids.has(id) || keys.has(tagKey(trimmed))) continue
    ids.add(id)
    keys.add(tagKey(trimmed))
    out.push({ id, name: trimmed, color })
  }
  return out
}

/** Tag ids of a task, without repetitions; ids of tags that do not exist are dropped by the domain. */
function cleanTagIds(entries: readonly unknown[]): string[] {
  const out: string[] = []
  for (const id of entries) {
    if (typeof id === 'string' && TAG_ID.test(id) && !out.includes(id)) out.push(id)
  }
  return out.slice(0, MAX_TAGS_PER_TASK)
}

const SprintSettingsSchema = z
  .object({ length: z.number().int().min(1), unit: z.enum(SPRINT_UNITS) })
  .refine((s) => s.length <= MAX_SPRINT_LENGTH[s.unit], 'Sprint too long')

export const TaskSchema = z.object({
  id: IdSchema,
  title: z.string().max(300),
  description: z.string().max(20_000),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  storyPoints: z.number().min(0).max(10_000).nullable(),
  estimateMinutes: z.number().int().min(0).max(100_000 * 60).nullable(),
  assigneeId: IdSchema.nullable(),
  rateCents: Cents.nullable(),
  tagIds: z.array(z.unknown()).catch([]).transform(cleanTagIds),
  statusHistory: z.array(z.unknown()).catch([]).transform(cleanHistory),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const MemberSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(100),
  role: z.string().max(100),
  initials: z.string().min(1).max(3),
  color: Color,
  rateCents: Cents.nullable(),
  hoursPerDay: z.number().gt(0).max(24)
})

export const ContractPartySchema = z.object({
  legalName: z.string().max(PARTY_FIELD_LIMITS.legalName),
  taxId: z.string().max(PARTY_FIELD_LIMITS.taxId),
  address: z.string().max(PARTY_FIELD_LIMITS.address),
  email: z.string().max(PARTY_FIELD_LIMITS.email),
  signerName: z.string().max(PARTY_FIELD_LIMITS.signerName),
  signerId: z.string().max(PARTY_FIELD_LIMITS.signerId),
  signerRole: z.string().max(PARTY_FIELD_LIMITS.signerRole)
})

export const QuoteSchema = z.object({
  number: z.string().max(50),
  date: IsoDateSchema.nullable(),
  validityDays: z.number().int().min(0).max(3650).nullable(),
  terms: z.string().max(20_000),
  client: ContractPartySchema,
  contractModelId: IdSchema.nullable()
})

/** The quote in a file: an unreadable contract model (or none, in early files of format 4) is the default one. */
const StoredQuoteSchema = QuoteSchema.extend({ contractModelId: IdSchema.nullable().catch(null) })

export const MetaSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(200),
  client: z.string().max(200),
  description: z.string().max(20_000),
  color: Color,
  currency: z.string().regex(/^[A-Z]{3}$/),
  defaultRateCents: Cents.nullable(),
  defaultHoursPerDay: z.number().gt(0).max(24),
  startDate: IsoDateSchema.nullable(),
  workingWeekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  contingencyBps: Bps,
  taxBps: Bps,
  taxLabel: z.string().max(20),
  pointScale: PointScaleSchema.nullable(),
  sprints: SprintSettingsSchema.nullable().catch(DEFAULT_SPRINT_SETTINGS),
  tags: z.array(z.unknown()).catch([]).transform(cleanTags),
  quote: StoredQuoteSchema,
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const StructureSchema = z.object({
  roots: z.array(IdSchema),
  children: z.record(IdSchema, z.array(IdSchema)),
  parents: z.record(IdSchema, z.array(IdSchema))
})

export const LanguageSchema = z.enum(LANGUAGES)
export const LanguagePreferenceSchema = z.enum(LANGUAGE_PREFERENCES)

export const ReportOptionsSchema = z.object({
  // Options saved before the PDF could be exported in English have no language:
  // the export dialog then uses the interface language.
  language: LanguageSchema.optional(),
  sections: z.object({
    cover: z.boolean(),
    summary: z.boolean(),
    breakdown: z.boolean(),
    workload: z.boolean(),
    shared: z.boolean(),
    terms: z.boolean(),
    // Options saved before the quote could be signed: with the signatures page.
    signatures: z.boolean().default(true)
  }),
  columns: z.object({
    hours: z.boolean(),
    cost: z.boolean(),
    rate: z.boolean(),
    storyPoints: z.boolean(),
    assignee: z.boolean(),
    status: z.boolean(),
    // Options saved before tags could be printed: without them.
    tags: z.boolean().default(false)
  }),
  maxDepth: z.number().int().min(1).max(50).nullable(),
  subtotalDepth: z.number().int().min(0).max(50),
  pageSize: z.enum(['A4', 'Letter']),
  landscape: z.boolean(),
  openAfterExport: z.boolean(),
  // Options saved before this field existed: descriptions go in a separate section.
  descriptions: z.enum(['none', 'inline', 'section']).default('section'),
  // Options saved before the quote could be signed: initials boxes on every page.
  initials: z.boolean().default(true)
})

const ISSUER_SHAPE = {
  name: z.string().max(200),
  taxId: z.string().max(50),
  taxIdLabel: z.string().max(30),
  address: z.string().max(500),
  email: z.string().max(200),
  phone: z.string().max(50),
  website: z.string().max(200),
  logoDataUrl: z
    .string()
    .max(3_000_000)
    .regex(/^data:image\/(png|jpeg|svg\+xml|webp);base64,[A-Za-z0-9+/=]+$/, 'Invalid logo')
    .nullable(),
  signerName: z.string().max(200),
  signerId: z.string().max(50),
  signerRole: z.string().max(100)
}

/** Issuer in settings.json. Settings saved before the quote could be signed have no signer. */
export const IssuerSchema = z.object({
  ...ISSUER_SHAPE,
  taxIdLabel: ISSUER_SHAPE.taxIdLabel.default(''),
  signerName: ISSUER_SHAPE.signerName.default(''),
  signerId: ISSUER_SHAPE.signerId.default(''),
  signerRole: ISSUER_SHAPE.signerRole.default('')
})

/** Some fields of the issuer changed in the renderer: without defaults, so the other fields are kept. */
export const IssuerPatchSchema = z.strictObject(ISSUER_SHAPE).partial()

const { name: NAME, place: PLACE, text: TEXT } = LIBRARY_LIMITS

/** A contract of the library (one per country, usually). */
export const ContractModelSchema = z.strictObject({
  id: IdSchema,
  name: z.string().trim().min(1).max(NAME),
  governingLaw: z.string().max(PLACE),
  courts: z.string().max(PLACE),
  generalTerms: z.string().max(TEXT)
})

/** A text of the library for the particular terms of any project. */
export const SavedTextSchema = z.strictObject({
  id: IdSchema,
  name: z.string().trim().min(1).max(NAME),
  text: z.string().max(TEXT)
})

export const ThemeSchema = z.enum(['system', 'light', 'dark'])

export const SettingsSchema = z.object({
  theme: ThemeSchema,
  language: LanguagePreferenceSchema,
  issuer: IssuerSchema,
  reportOptions: z.record(IdSchema, ReportOptionsSchema),
  contractModels: z.array(ContractModelSchema).max(LIBRARY_LIMITS.models).default([]),
  defaultContractModelId: IdSchema.nullable().default(null),
  savedTexts: z.array(SavedTextSchema).max(LIBRARY_LIMITS.texts).default([])
})
