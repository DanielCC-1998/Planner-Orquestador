import { describe, expect, it } from 'vitest'
import { currentSprint, draftFromSprints, sprintsFromDraft } from '@presentation/features/dialogs/sprintsDraft'

describe('sprints tab draft', () => {
  it('a project without sprints opens with 2 weeks ready but switched off', () => {
    expect(draftFromSprints(null)).toEqual({ enabled: false, length: '2', unit: 'week' })
    expect(draftFromSprints({ length: 3, unit: 'day' })).toEqual({ enabled: true, length: '3', unit: 'day' })
  })

  it('turns the draft into settings, or an error with the maximum of the unit', () => {
    expect(sprintsFromDraft({ enabled: false, length: 'x', unit: 'week' })).toEqual({ settings: null, error: null })
    expect(sprintsFromDraft({ enabled: true, length: ' 2 ', unit: 'week' })).toEqual({
      settings: { length: 2, unit: 'week' },
      error: null
    })
    expect(sprintsFromDraft({ enabled: true, length: '13', unit: 'month' })).toEqual({ settings: null, error: { max: 12 } })
    expect(sprintsFromDraft({ enabled: true, length: '1.5', unit: 'week' })).toEqual({ settings: null, error: { max: 52 } })
    expect(sprintsFromDraft({ enabled: true, length: '', unit: 'day' })).toEqual({ settings: null, error: { max: 365 } })
  })

  it('the current sprint, or none before the first one starts', () => {
    const twoWeeks = { length: 2, unit: 'week' } as const
    expect(currentSprint('2026-09-07', twoWeeks, '2026-09-30')).toEqual({ number: 2, start: '2026-09-21', end: '2026-10-04' })
    expect(currentSprint('2026-09-07', twoWeeks, '2026-09-06')).toBeNull()
  })
})
