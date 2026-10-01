import { describe, expect, it } from 'vitest'
import {
  apply,
  DOMAIN_ERROR_REASONS,
  fromProjectData,
  MAX_PROJECT_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  parseDuration,
  toProjectData,
  type Command,
  type DomainError,
  type DomainErrorReason,
  type ErrorParams,
  type MemberInput,
  type MetaPatch,
  type Priority,
  type QuoteInfo,
  type Result,
  type TaskPatch,
  type TaskStatus
} from '@domain'
import { loginSignupScenario, testContext } from '@tests/support/builders'

const { state, ids } = loginSignupScenario()
const data = toProjectData(state)
const UNKNOWN_ID = '00000000-0000-4000-8000-ffffffffffff'

const run = (cmd: Command) => apply(state, cmd, testContext())
const createTask = (fields: TaskPatch) => run({ type: 'task.create', parentId: null, fields })
/** The scenario with `n` project tags called tag0, tag1… */
function withTags(n: number) {
  let s = state
  for (let i = 0; i < n; i++) {
    const r = apply(s, { type: 'tag.create', name: `tag${i}` }, testContext())
    if (!r.ok) throw new Error(r.error.message)
    s = r.value.state
  }
  return s
}
const addMember = (fields: MemberInput) => run({ type: 'member.add', fields })
const updateProject = (patch: MetaPatch) => run({ type: 'project.update', patch })
const updateQuote = (quote: Partial<QuoteInfo>) => updateProject({ quote: { ...state.meta.quote, ...quote } })

interface Case {
  /** Expected `code` (unchanged by the i18n work: the UI and the tests rely on it). */
  readonly code: string
  readonly result: () => Result<unknown, DomainError>
  readonly params?: ErrorParams
}

/** One input that fails with each reason. A `Record`, so a new reason without a case does not compile. */
const CASES: Readonly<Record<DomainErrorReason, Case>> = {
  TITLE_TOO_LONG: { code: 'INVALID', result: () => createTask({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) }) },
  DESCRIPTION_TOO_LONG: { code: 'INVALID', result: () => createTask({ description: 'x'.repeat(20_001) }) },
  INVALID_STATUS: { code: 'INVALID', result: () => createTask({ status: 'blocked' as TaskStatus }) },
  INVALID_PRIORITY: { code: 'INVALID', result: () => createTask({ priority: 'urgent' as Priority }) },
  INVALID_STORY_POINTS: { code: 'INVALID', result: () => createTask({ storyPoints: 10_001 }) },
  INVALID_ESTIMATE: { code: 'INVALID', result: () => createTask({ estimateMinutes: 1.5 }) },
  UNKNOWN_ASSIGNEE: { code: 'INVALID', result: () => createTask({ assigneeId: UNKNOWN_ID }) },
  INVALID_RATE: { code: 'INVALID', result: () => createTask({ rateCents: -100 }) },
  INVALID_TAGS: { code: 'INVALID', result: () => createTask({ tagIds: 'urgent' as unknown as string[] }) },
  TAG_TOO_LONG: { code: 'INVALID', result: () => run({ type: 'tag.create', name: 'x'.repeat(41) }) },
  TOO_MANY_TAGS: {
    code: 'INVALID',
    result: () => {
      const tagged = withTags(21)
      return apply(tagged, { type: 'task.create', parentId: null, fields: { tagIds: tagged.meta.tags.map((t) => t.id) } }, testContext())
    },
    params: { max: 20 }
  },
  TAG_EXISTS: {
    code: 'INVALID',
    result: () => apply(withTags(1), { type: 'tag.create', name: ' TAG0 ' }, testContext()),
    params: { name: 'TAG0' }
  },
  UNKNOWN_TAG: { code: 'INVALID', result: () => createTask({ tagIds: ['tag-404'] }) },
  TOO_MANY_PROJECT_TAGS: {
    code: 'INVALID',
    result: () => apply(withTags(200), { type: 'tag.create', name: 'one more' }, testContext()),
    params: { max: 200 }
  },
  NAME_REQUIRED: { code: 'INVALID', result: () => addMember({ name: '   ' }) },
  NAME_TOO_LONG: { code: 'INVALID', result: () => addMember({ name: 'x'.repeat(101) }) },
  ROLE_TOO_LONG: { code: 'INVALID', result: () => addMember({ name: 'Ann', role: 'x'.repeat(101) }) },
  INVALID_INITIALS: { code: 'INVALID', result: () => addMember({ name: 'Ann', initials: 'ABCD' }) },
  INVALID_COLOR: { code: 'INVALID', result: () => addMember({ name: 'Ann', color: 'red' }) },
  INVALID_HOURS_PER_DAY: { code: 'INVALID', result: () => addMember({ name: 'Ann', hoursPerDay: 0 }) },
  PROJECT_NAME_REQUIRED: { code: 'INVALID', result: () => updateProject({ name: '  ' }) },
  CLIENT_TOO_LONG: { code: 'INVALID', result: () => updateProject({ client: 'x'.repeat(201) }) },
  INVALID_CURRENCY: { code: 'INVALID', result: () => updateProject({ currency: 'euro' }) },
  INVALID_CONTINGENCY: { code: 'INVALID', result: () => updateProject({ contingencyBps: 100_001 }) },
  INVALID_TAX: { code: 'INVALID', result: () => updateProject({ taxBps: -1 }) },
  TAX_LABEL_TOO_LONG: { code: 'INVALID', result: () => updateProject({ taxLabel: 'x'.repeat(21) }) },
  INVALID_START_DATE: { code: 'INVALID', result: () => updateProject({ startDate: '2026-02-30' }) },
  INVALID_WEEKDAY: { code: 'INVALID', result: () => updateProject({ workingWeekdays: [1, 8] }) },
  NO_WORKING_DAYS: { code: 'INVALID', result: () => updateProject({ workingWeekdays: [] }) },
  INVALID_QUOTE: { code: 'INVALID', result: () => updateProject({ quote: null as unknown as QuoteInfo }) },
  QUOTE_NUMBER_TOO_LONG: { code: 'INVALID', result: () => updateQuote({ number: 'x'.repeat(51) }) },
  INVALID_QUOTE_DATE: { code: 'INVALID', result: () => updateQuote({ date: 'tomorrow' }) },
  INVALID_VALIDITY: { code: 'INVALID', result: () => updateQuote({ validityDays: -1 }) },
  TERMS_TOO_LONG: { code: 'INVALID', result: () => updateQuote({ terms: 'x'.repeat(20_001) }) },
  INVALID_REASSIGN: { code: 'INVALID', result: () => run({ type: 'member.remove', id: ids.anna, reassignTo: ids.anna }) },
  TASK_NOT_FOUND: { code: 'NOT_FOUND', result: () => run({ type: 'task.update', id: UNKNOWN_ID, patch: {} }) },
  SOME_TASK_NOT_FOUND: {
    code: 'NOT_FOUND',
    result: () => run({ type: 'task.bulkUpdate', ids: [ids.login, UNKNOWN_ID], patch: { status: 'done' } })
  },
  MEMBER_NOT_FOUND: { code: 'NOT_FOUND', result: () => run({ type: 'member.update', id: UNKNOWN_ID, patch: {} }) },
  DUPLICATE_TASK_ID: { code: 'CORRUPT', result: () => fromProjectData({ ...data, tasks: [...data.tasks, data.tasks[0]!] }) },
  DUPLICATE_MEMBER_ID: {
    code: 'CORRUPT',
    result: () => fromProjectData({ ...data, members: [...data.members, data.members[0]!] })
  },
  DURATION_FORMAT: { code: 'INVALID', result: () => parseDuration('abc', 8) },
  DURATION_UNIT: { code: 'INVALID', result: () => parseDuration('2 weeks', 8), params: { unit: 'weeks' } },
  DURATION_NEGATIVE: { code: 'INVALID', result: () => parseDuration('1d', -8) },
  DURATION_TOO_LARGE: { code: 'INVALID', result: () => parseDuration('100001h', 8) },
  INVALID_POINT_SCALE: {
    code: 'INVALID',
    result: () => updateProject({ pointScale: { minutesPerPoint: 120, overrides: [{ points: 1, minutes: 60 }] } })
  },
  INVALID_SPRINTS: { code: 'INVALID', result: () => updateProject({ sprints: { length: 53, unit: 'week' } }) },
  CYCLE_MOVE: {
    code: 'CYCLE',
    result: () => run({ type: 'edge.move', childId: ids.login, fromParentId: null, toParentId: ids.form, index: 0 })
  },
  CYCLE_LINK: { code: 'CYCLE', result: () => run({ type: 'edge.link', parentId: ids.table, childId: ids.login }) },
  UNKNOWN_TASK: { code: 'UNKNOWN', result: () => run({ type: 'edge.link', parentId: ids.login, childId: UNKNOWN_ID }) },
  UNKNOWN_PARENT: { code: 'UNKNOWN', result: () => run({ type: 'task.create', parentId: UNKNOWN_ID }) },
  UNKNOWN_TARGET: {
    code: 'UNKNOWN',
    result: () => run({ type: 'edge.move', childId: ids.login, fromParentId: null, toParentId: UNKNOWN_ID, index: 0 })
  },
  NOT_A_CHILD: { code: 'NO_EDGE', result: () => run({ type: 'edge.unlink', parentId: ids.login, childId: ids.validation }) },
  NOT_AT_POSITION: {
    code: 'NO_EDGE',
    result: () => run({ type: 'edge.move', childId: ids.validation, fromParentId: ids.login, toParentId: null, index: 0 })
  },
  GRAPH_CORRUPT: {
    code: 'CORRUPT',
    result: () => fromProjectData({ ...data, structure: { ...data.structure, roots: [] } }),
    params: { detail: `orphan task ${ids.login}` }
  }
}

describe('domain error reasons', () => {
  it.each(DOMAIN_ERROR_REASONS)('%s', (reason) => {
    const { code, result, params } = CASES[reason]
    const r = result()
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.reason).toBe(reason)
    expect(r.error.code).toBe(code)
    expect(r.error.params).toEqual(params)
  })

  it('the length limits come from the exported maximums', () => {
    expect(createTask({ title: 'x'.repeat(MAX_TITLE_LENGTH) }).ok).toBe(true)
    expect(createTask({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) })).toMatchObject({ error: { reason: 'TITLE_TOO_LONG' } })
    expect(updateProject({ name: 'x'.repeat(MAX_PROJECT_NAME_LENGTH) }).ok).toBe(true)
    expect(updateProject({ name: 'x'.repeat(MAX_PROJECT_NAME_LENGTH + 1) })).toMatchObject({
      error: { reason: 'NAME_TOO_LONG' }
    })
  })
})
