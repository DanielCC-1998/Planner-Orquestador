import { describe, expect, it } from 'vitest'
import { contractModelFor, DEFAULT_SETTINGS, mergeSettings, type ContractModel } from '@application'

const model = (id: string, name: string): ContractModel => ({ id, name, governingLaw: '', courts: '', generalTerms: '' })
const uruguay = model('00000000-0000-4000-8000-000000000001', 'Uruguay')
const spain = model('00000000-0000-4000-8000-000000000002', 'Spain')
const DELETED = '00000000-0000-4000-8000-00000000dead'

describe('library of contracts in the settings', () => {
  const settings = mergeSettings(DEFAULT_SETTINGS, { contractModels: [uruguay, spain], defaultContractModelId: uruguay.id })

  it('a project uses the model it chose, otherwise the default one, otherwise none', () => {
    expect(contractModelFor(settings, spain.id)).toBe(spain)
    expect(contractModelFor(settings, null)).toBe(uruguay)
    expect(contractModelFor(settings, DELETED)).toBe(uruguay)
    expect(contractModelFor({ ...settings, defaultContractModelId: null }, null)).toBeNull()
  })

  it('lists are replaced whole, and a default that is no longer in the library is no default', () => {
    const withoutDefault = mergeSettings(settings, { contractModels: [spain] })
    expect(withoutDefault.contractModels).toEqual([spain])
    expect(withoutDefault.defaultContractModelId).toBeNull()
    expect(mergeSettings(settings, { defaultContractModelId: DELETED }).defaultContractModelId).toBeNull()
    // Changing something else keeps the library as it was.
    expect(mergeSettings(settings, { theme: 'dark' })).toMatchObject({ contractModels: [uruguay, spain], defaultContractModelId: uruguay.id })
  })
})
