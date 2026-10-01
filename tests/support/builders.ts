import { apply, type ApplyContext } from '@domain/project/apply'
import type { Command } from '@domain/project/commands'
import { createProjectState, type NewProjectInput } from '@domain'
import type { ProjectState } from '@domain'
import type { Clock } from '@application'

let counter = 0

/** Deterministic UUID v4 for tests. */
export function testId(): string {
  counter++
  const hex = counter.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

export function testContext(now = '2026-01-01T00:00:00.000Z'): ApplyContext {
  return { now, newId: testId }
}

/** Clock stopped at `now`. Local dates are the UTC ones, so tests do not depend on the machine's time zone. */
export function fixedClock(now = '2026-01-01T00:00:00.000Z'): Clock {
  return { now: () => now, localDate: (at) => at.slice(0, 10) }
}

export function newState(input: Partial<NewProjectInput> = {}): ProjectState {
  const r = createProjectState(testId(), { name: 'Project', ...input }, '2026-01-01T00:00:00.000Z')
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}

/** Applies a command and fails the test if the domain rejects it. Returns the state and the created ids. */
export function run(state: ProjectState, cmd: Command): { state: ProjectState; id: string; created: readonly string[] } {
  const r = apply(state, cmd, testContext())
  if (!r.ok) throw new Error(`${cmd.type}: ${r.error.message}`)
  return { state: r.value.state, id: r.value.created[0] ?? '', created: r.value.created }
}

/**
 * Scenario from the plan, with a rate of €50/h:
 * Login { Users table 4 h, Login form 6 h } and Sign-up { Email validation 5 h },
 * with "Users table" also shared under Sign-up.
 */
export function loginSignupScenario() {
  let s = newState({ defaultRateCents: 5000 })
  let r = run(s, { type: 'member.add', fields: { name: 'Anna Brooks', hoursPerDay: 8 } })
  s = r.state
  const anna = r.id
  r = run(s, { type: 'member.add', fields: { name: 'James Carter', hoursPerDay: 8 } })
  s = r.state
  const james = r.id
  r = run(s, { type: 'task.create', parentId: null, fields: { title: 'Login' } })
  s = r.state
  const login = r.id
  r = run(s, { type: 'task.create', parentId: null, fields: { title: 'Sign-up' } })
  s = r.state
  const signup = r.id
  r = run(s, {
    type: 'task.create',
    parentId: login,
    fields: { title: 'Users table', estimateMinutes: 240, storyPoints: 2, assigneeId: james }
  })
  s = r.state
  const table = r.id
  r = run(s, {
    type: 'task.create',
    parentId: login,
    fields: { title: 'Login form', estimateMinutes: 360, storyPoints: 3, assigneeId: anna }
  })
  s = r.state
  const form = r.id
  r = run(s, { type: 'edge.link', parentId: signup, childId: table, index: 0 })
  s = r.state
  r = run(s, {
    type: 'task.create',
    parentId: signup,
    fields: { title: 'Email validation', estimateMinutes: 300, storyPoints: 3, assigneeId: anna }
  })
  s = r.state
  const validation = r.id
  return { state: s, ids: { anna, james, login, signup, table, form, validation } }
}
