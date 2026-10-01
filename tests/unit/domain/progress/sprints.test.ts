import { describe, expect, it } from 'vitest'
import {
  addMonthsClamped,
  daysBetween,
  sprintAnchor,
  sprintChanges,
  sprintIndexOf,
  sprintStartDate,
  validateSprintSettings,
  type SprintSettings,
  type StatusChange,
  type Task,
  type TaskStatus
} from '@domain'

const TWO_WEEKS: SprintSettings = { length: 2, unit: 'week' }
const START = '2026-09-07' // a Monday
const utcDate = (at: string) => at.slice(0, 10)

/** A task with a given history (its current status is the last `to`). */
function task(id: string, history: Array<[at: string, from: TaskStatus | null, to: TaskStatus]>, status?: TaskStatus): Task {
  const statusHistory: StatusChange[] = history.map(([at, from, to]) => ({ at: `${at}T10:00:00.000Z`, from, to }))
  return {
    id,
    title: id,
    description: '',
    status: status ?? statusHistory[statusHistory.length - 1]?.to ?? 'todo',
    priority: 'medium',
    storyPoints: null,
    estimateMinutes: null,
    assigneeId: null,
    rateCents: null,
    tagIds: [],
    statusHistory,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  }
}

describe('calendar helpers', () => {
  it('days between dates and months that keep the day or clamp it', () => {
    expect(daysBetween('2026-09-07', '2026-09-21')).toBe(14)
    expect(daysBetween('2026-09-21', '2026-09-07')).toBe(-14)
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31')
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28')
  })
})

describe('sprint windows', () => {
  it('weeks and days: sprint k starts k × length after the start', () => {
    expect(sprintStartDate(START, TWO_WEEKS, 0)).toBe('2026-09-07')
    expect(sprintStartDate(START, TWO_WEEKS, 2)).toBe('2026-10-05')
    expect(sprintStartDate(START, { length: 10, unit: 'day' }, 1)).toBe('2026-09-17')
    expect(sprintIndexOf(START, TWO_WEEKS, '2026-09-07')).toBe(0)
    expect(sprintIndexOf(START, TWO_WEEKS, '2026-09-20')).toBe(0)
    expect(sprintIndexOf(START, TWO_WEEKS, '2026-09-21')).toBe(1)
    expect(sprintIndexOf(START, TWO_WEEKS, '2026-09-06')).toBe(-1)
  })

  it('months keep the start day, clamped to shorter months, computed from the start each time', () => {
    const monthly: SprintSettings = { length: 1, unit: 'month' }
    expect(sprintStartDate('2026-01-31', monthly, 1)).toBe('2026-02-28')
    expect(sprintStartDate('2026-01-31', monthly, 2)).toBe('2026-03-31')
    expect(sprintIndexOf('2026-01-31', monthly, '2026-02-27')).toBe(0)
    expect(sprintIndexOf('2026-01-31', monthly, '2026-02-28')).toBe(1)
    expect(sprintIndexOf('2026-01-31', monthly, '2026-03-30')).toBe(1)
    expect(sprintIndexOf('2026-01-31', monthly, '2026-03-31')).toBe(2)
    expect(sprintIndexOf('2026-01-31', monthly, '2026-01-30')).toBe(-1)
    expect(sprintIndexOf('2026-01-15', { length: 3, unit: 'month' }, '2026-07-14')).toBe(1)
    expect(sprintIndexOf('2026-01-15', { length: 3, unit: 'month' }, '2026-07-15')).toBe(2)
  })

  it('the anchor is the start date or, without one, the day the project was created', () => {
    expect(sprintAnchor({ startDate: '2026-09-07', createdAt: '2026-09-01T23:30:00.000Z' }, utcDate)).toBe('2026-09-07')
    expect(sprintAnchor({ startDate: null, createdAt: '2026-09-01T23:30:00.000Z' }, utcDate)).toBe('2026-09-01')
  })

  it('validates the length of each unit', () => {
    expect(validateSprintSettings({ length: 2, unit: 'week' })).toEqual({ ok: true, value: TWO_WEEKS })
    expect(validateSprintSettings(null)).toEqual({ ok: true, value: null })
    expect(validateSprintSettings({ length: 365, unit: 'day' }).ok).toBe(true)
    expect(validateSprintSettings({ length: 13, unit: 'month' })).toMatchObject({ ok: false, error: { reason: 'INVALID_SPRINTS' } })
    expect(validateSprintSettings({ length: 1.5, unit: 'week' }).ok).toBe(false)
    expect(validateSprintSettings({ length: 2, unit: 'year' }).ok).toBe(false)
  })
})

describe('changes by sprint', () => {
  const run = (tasks: Task[], today = '2026-10-10') => sprintChanges(tasks, START, TWO_WEEKS, today, utcDate)

  it('lists every sprint up to the current one, with its days', () => {
    const sprints = run([])
    expect(sprints.map((s) => [s.number, s.start, s.end, s.current])).toEqual([
      [1, '2026-09-07', '2026-09-20', false],
      [2, '2026-09-21', '2026-10-04', false],
      [3, '2026-10-05', '2026-10-18', true]
    ])
  })

  it('compares the status at the start and at the end of each sprint, ignoring the steps in between', () => {
    const sprints = run([
      task('a', [
        ['2026-09-01', null, 'todo'],
        ['2026-09-08', 'todo', 'in_progress'],
        ['2026-09-09', 'in_progress', 'review'],
        ['2026-09-10', 'review', 'done']
      ])
    ])
    expect(sprints[0]!.changes).toEqual([{ taskId: 'a', from: 'todo', to: 'done', direction: 'forward' }])
    expect(sprints[1]!.changes).toEqual([])
  })

  it('moving back is reported; ending where it started is not', () => {
    const sprints = run([
      task('back', [
        ['2026-09-01', null, 'todo'],
        ['2026-09-08', 'todo', 'review'],
        ['2026-09-22', 'review', 'in_progress']
      ]),
      task('round trip', [
        ['2026-09-01', null, 'done'],
        ['2026-09-23', 'done', 'in_progress'],
        ['2026-09-24', 'in_progress', 'done']
      ])
    ])
    expect(sprints[0]!.changes).toEqual([{ taskId: 'back', from: 'todo', to: 'review', direction: 'forward' }])
    expect(sprints[1]!.changes).toEqual([{ taskId: 'back', from: 'review', to: 'in_progress', direction: 'backward' }])
  })

  it('a task created inside a sprint starts from the status it was created with', () => {
    const sprints = run([
      task('new', [
        ['2026-09-22', null, 'todo'],
        ['2026-09-30', 'todo', 'done']
      ]),
      task('created done', [['2026-09-22', null, 'done']])
    ])
    expect(sprints[1]!.changes).toEqual([{ taskId: 'new', from: 'todo', to: 'done', direction: 'forward' }])
  })

  it('a task from an older file (no history) changes from the status it had', () => {
    const sprints = run([task('old', [['2026-10-06', 'review', 'done']])])
    expect(sprints[2]!.changes).toEqual([{ taskId: 'old', from: 'review', to: 'done', direction: 'forward' }])
    expect(run([task('untouched', [], 'review')]).every((s) => s.changes.length === 0)).toBe(true)
  })

  it('changes before the first sprint form their own group; changes after today count in the current sprint', () => {
    const sprints = run([
      task('early', [
        ['2026-09-01', null, 'todo'],
        ['2026-09-02', 'todo', 'in_progress']
      ]),
      task('future', [
        ['2026-09-08', null, 'todo'],
        ['2026-12-01', 'todo', 'done']
      ])
    ])
    expect(sprints[0]).toMatchObject({ number: 0, start: null, end: '2026-09-06', current: false })
    expect(sprints[0]!.changes).toEqual([{ taskId: 'early', from: 'todo', to: 'in_progress', direction: 'forward' }])
    expect(sprints[3]!.changes).toEqual([{ taskId: 'future', from: 'todo', to: 'done', direction: 'forward' }])
  })

  it('before the first sprint starts there are no sprints yet', () => {
    expect(run([], '2026-09-01')).toEqual([])
  })
})
