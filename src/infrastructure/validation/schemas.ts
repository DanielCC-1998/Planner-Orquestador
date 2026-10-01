import { z } from 'zod'
import { LANGUAGES, PRIORITIES, TASK_STATUSES } from '@domain'
import { LANGUAGE_PREFERENCES } from '@application'

/**
 * Zod schemas shared by the adapters: they validate everything that comes in from outside
 * the hexagon (files on disk and IPC messages from the renderer).
 */
export const IdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid id')
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
const Cents = z.number().int().min(0).max(1_000_000_000)
const Bps = z.number().int().min(0).max(100_000)
const Color = z.string().regex(/^#[0-9a-f]{6}$/i)

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
  tags: z.array(z.string().max(40)).max(20),
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

export const QuoteSchema = z.object({
  number: z.string().max(50),
  date: IsoDateSchema.nullable(),
  validityDays: z.number().int().min(0).max(3650).nullable(),
  terms: z.string().max(20_000)
})

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
  quote: QuoteSchema,
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
    terms: z.boolean()
  }),
  columns: z.object({
    hours: z.boolean(),
    cost: z.boolean(),
    rate: z.boolean(),
    storyPoints: z.boolean(),
    assignee: z.boolean(),
    status: z.boolean()
  }),
  maxDepth: z.number().int().min(1).max(50).nullable(),
  subtotalDepth: z.number().int().min(0).max(50),
  pageSize: z.enum(['A4', 'Letter']),
  landscape: z.boolean(),
  openAfterExport: z.boolean(),
  // Options saved before this field existed: descriptions go in a separate section.
  descriptions: z.enum(['none', 'inline', 'section']).default('section')
})

export const IssuerSchema = z.object({
  name: z.string().max(200),
  taxId: z.string().max(50),
  address: z.string().max(500),
  email: z.string().max(200),
  phone: z.string().max(50),
  website: z.string().max(200),
  logoDataUrl: z
    .string()
    .max(3_000_000)
    .regex(/^data:image\/(png|jpeg|svg\+xml|webp);base64,[A-Za-z0-9+/=]+$/, 'Invalid logo')
    .nullable()
})

export const ThemeSchema = z.enum(['system', 'light', 'dark'])

export const SettingsSchema = z.object({
  theme: ThemeSchema,
  language: LanguagePreferenceSchema,
  issuer: IssuerSchema,
  reportOptions: z.record(IdSchema, ReportOptionsSchema)
})
