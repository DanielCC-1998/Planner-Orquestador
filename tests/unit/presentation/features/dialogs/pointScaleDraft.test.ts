import { describe, expect, it } from 'vitest'
import { draftFromScale, draftRows, ruleOfThree, scaleFromDraft } from '@presentation/features/dialogs/pointScaleDraft'

describe('story point scale draft', () => {
  it('turns a saved scale into editable texts and back', () => {
    const scale = { minutesPerPoint: 120, overrides: [{ points: 5, minutes: 480 }] }
    const draft = draftFromScale(scale)
    expect(draft).toEqual({ base: '2h', overrides: { '5': '8h' } })
    expect(scaleFromDraft(draft, 8)).toMatchObject({ valid: true, scale })
    expect(draftFromScale(null)).toEqual({ base: '', overrides: {} })
  })

  it('the rows are the usual values plus any saved exception, without 1', () => {
    expect(draftRows({ base: '2h', overrides: {} })).toEqual([2, 3, 5, 8, 13])
    expect(draftRows({ base: '2h', overrides: { '21': '30h', '5': '' } })).toEqual([2, 3, 5, 8, 13, 21])
  })

  it('an empty base turns the scale off; empty exceptions follow the rule of three', () => {
    expect(scaleFromDraft({ base: '', overrides: { '5': '8h' } }, 8)).toMatchObject({ valid: true, scale: null })
    expect(scaleFromDraft({ base: '90m', overrides: { '5': '' } }, 8)).toMatchObject({
      valid: true,
      scale: { minutesPerPoint: 90, overrides: [] }
    })
  })

  it('"1d" uses the hours per day given, and the rule of three previews the rows', () => {
    expect(scaleFromDraft({ base: '1d', overrides: {} }, 6).scale).toEqual({ minutesPerPoint: 360, overrides: [] })
    expect(ruleOfThree({ base: '2h', overrides: {} }, 5, 8)).toBe(600)
    expect(ruleOfThree({ base: '', overrides: {} }, 5, 8)).toBeNull()
  })

  it('reports a wrong base or exception instead of saving', () => {
    expect(scaleFromDraft({ base: '0h', overrides: {} }, 8)).toMatchObject({ valid: false, baseError: { kind: 'zero' } })
    expect(scaleFromDraft({ base: 'two', overrides: {} }, 8)).toMatchObject({ valid: false, baseError: { kind: 'duration' } })
    const r = scaleFromDraft({ base: '2h', overrides: { '5': '8 lots' } }, 8)
    expect(r.valid).toBe(false)
    expect(r.overrideErrors['5']).toMatchObject({ kind: 'duration', error: { reason: 'DURATION_UNIT' } })
  })
})
