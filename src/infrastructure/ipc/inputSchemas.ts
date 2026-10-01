import { z } from 'zod'
import { PRIORITIES, TASK_STATUSES, type Command, type MemberPatch, type MetaPatch, type TaskPatch } from '@domain'
import type { SettingsPatch } from '@application'
import {
  IdSchema,
  IsoDateSchema,
  IssuerSchema,
  LanguagePreferenceSchema,
  LanguageSchema,
  QuoteSchema,
  ReportOptionsSchema,
  ThemeSchema
} from '../validation/schemas'

/**
 * Validation of everything that comes from the renderer. Strict objects: an unknown key
 * is rejected. The domain checks the business rules again.
 */
const Index = z.number().int().min(0).max(1_000_000)
const ParentId = IdSchema.nullable()

export const TaskPatchSchema = z.strictObject({
  title: z.string().max(300).optional(),
  description: z.string().max(20_000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  storyPoints: z.number().min(0).max(10_000).nullable().optional(),
  estimateMinutes: z.number().int().min(0).max(100_000 * 60).nullable().optional(),
  assigneeId: IdSchema.nullable().optional(),
  rateCents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional()
})

const MemberFieldsShape = {
  name: z.string().max(100),
  role: z.string().max(100).optional(),
  initials: z.string().max(3).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  rateCents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  hoursPerDay: z.number().gt(0).max(24).optional()
}
export const MemberInputSchema = z.strictObject(MemberFieldsShape)
export const MemberPatchSchema = z.strictObject({ ...MemberFieldsShape, name: z.string().max(100).optional() })

export const MetaPatchSchema = z.strictObject({
  name: z.string().max(200).optional(),
  client: z.string().max(200).optional(),
  description: z.string().max(20_000).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  defaultRateCents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  defaultHoursPerDay: z.number().gt(0).max(24).optional(),
  startDate: IsoDateSchema.nullable().optional(),
  workingWeekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  contingencyBps: z.number().int().min(0).max(100_000).optional(),
  taxBps: z.number().int().min(0).max(100_000).optional(),
  taxLabel: z.string().max(20).optional(),
  pointScale: z
    .strictObject({
      minutesPerPoint: z.number().int().min(1).max(100_000 * 60),
      overrides: z
        .array(z.strictObject({ points: z.number().gt(0).max(10_000), minutes: z.number().int().min(0).max(100_000 * 60) }))
        .max(20)
    })
    .nullable()
    .optional(),
  quote: QuoteSchema.optional(),
  archived: z.boolean().optional()
})

export const CommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('task.create'),
    parentId: ParentId,
    index: Index.optional(),
    fields: TaskPatchSchema.optional()
  }),
  z.strictObject({ type: z.literal('task.update'), id: IdSchema, patch: TaskPatchSchema }),
  z.strictObject({
    type: z.literal('task.bulkUpdate'),
    ids: z.array(IdSchema).min(1).max(10_000),
    patch: z.strictObject({
      status: z.enum(TASK_STATUSES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      assigneeId: IdSchema.nullable().optional()
    })
  }),
  z.strictObject({ type: z.literal('task.delete'), id: IdSchema, mode: z.enum(['cascade', 'splice']) }),
  z.strictObject({
    type: z.literal('task.duplicate'),
    id: IdSchema,
    parentId: ParentId,
    index: Index.optional(),
    // The UI appends a localized " (copy)"; the domain clamps the result to the title limit.
    title: z.string().max(400).optional()
  }),
  z.strictObject({ type: z.literal('edge.link'), parentId: IdSchema, childId: IdSchema, index: Index.optional() }),
  z.strictObject({ type: z.literal('edge.unlink'), parentId: IdSchema, childId: IdSchema }),
  z.strictObject({ type: z.literal('edge.setPrimary'), parentId: IdSchema, childId: IdSchema }),
  z.strictObject({
    type: z.literal('edge.move'),
    childId: IdSchema,
    fromParentId: ParentId,
    toParentId: ParentId,
    index: Index
  }),
  z.strictObject({ type: z.literal('member.add'), fields: MemberInputSchema }),
  z.strictObject({ type: z.literal('member.addMany'), members: z.array(MemberInputSchema).max(200) }),
  z.strictObject({ type: z.literal('member.update'), id: IdSchema, patch: MemberPatchSchema }),
  z.strictObject({ type: z.literal('member.remove'), id: IdSchema, reassignTo: IdSchema.nullable() }),
  z.strictObject({ type: z.literal('project.update'), patch: MetaPatchSchema })
])

export const NewProjectSchema = z.strictObject({
  name: z.string().max(200),
  client: z.string().max(200).optional(),
  description: z.string().max(20_000).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  defaultRateCents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  defaultHoursPerDay: z.number().gt(0).max(24).optional()
})

export const SettingsPatchSchema = z.strictObject({
  theme: ThemeSchema.optional(),
  language: LanguagePreferenceSchema.optional(),
  issuer: IssuerSchema.partial().optional(),
  reportOptions: z.record(IdSchema, ReportOptionsSchema).optional()
})

export const IdInputSchema = z.strictObject({ id: IdSchema })
export const CommandInputSchema = z.strictObject({ id: IdSchema, command: CommandSchema })
export const ExportPdfInputSchema = z.strictObject({ id: IdSchema, options: ReportOptionsSchema.extend({ language: LanguageSchema }) })
export const VoidSchema = z.unknown().transform(() => undefined)

// ─── Compile-time checks: the schemas and the domain types cannot drift apart ───
type Assert<T extends true> = T
type Parsed = z.infer<typeof CommandSchema>
export type _ParsedIsCommand = Assert<Parsed extends Command ? true : false>
export type _AllCommandsCovered = Assert<[Exclude<Command['type'], Parsed['type']>] extends [never] ? true : false>
export type _TaskPatchCovered = Assert<
  [Exclude<keyof TaskPatch, keyof z.infer<typeof TaskPatchSchema>>] extends [never] ? true : false
>
export type _MemberPatchCovered = Assert<
  [Exclude<keyof MemberPatch, keyof z.infer<typeof MemberPatchSchema>>] extends [never] ? true : false
>
export type _MetaPatchCovered = Assert<
  [Exclude<keyof MetaPatch, keyof z.infer<typeof MetaPatchSchema>>] extends [never] ? true : false
>
export type _SettingsPatchOk = Assert<z.infer<typeof SettingsPatchSchema> extends SettingsPatch ? true : false>
