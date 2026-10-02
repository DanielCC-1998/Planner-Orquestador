import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, EMPTY_ISSUER, mergeSettings } from '@application'
import { JsonSettingsRepository } from '@infrastructure/persistence/json/JsonSettingsRepository'

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'planner-settings-'))
  file = join(dir, 'settings.json')
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const uruguay = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Uruguay',
  governingLaw: 'Uruguay',
  courts: 'Montevideo',
  generalTerms: '1. Confidentiality.'
}
const billing = { id: '00000000-0000-4000-8000-000000000011', name: 'Billing', text: 'Billing. Per sprint.' }

describe('JsonSettingsRepository: the library of contracts', () => {
  it('settings saved before the library have it empty, and the issuer without signer', async () => {
    const issuer = { name: 'Studio', taxId: 'B-1', address: '', email: '', phone: '', website: '', logoDataUrl: null }
    await writeFile(file, JSON.stringify({ theme: 'dark', language: 'es', issuer, reportOptions: {} }))
    const loaded = await new JsonSettingsRepository(file).load()
    expect(loaded).toMatchObject({ theme: 'dark', contractModels: [], defaultContractModelId: null, savedTexts: [] })
    expect(loaded.issuer).toEqual({ ...EMPTY_ISSUER, name: 'Studio', taxId: 'B-1' })
  })

  it('invalid or repeated entries are dropped, and a default that does not exist is none', async () => {
    await writeFile(
      file,
      JSON.stringify({
        contractModels: [uruguay, { ...uruguay, name: 'Copy' }, { id: 'not-an-id', name: 'X', governingLaw: '', courts: '', generalTerms: '' }, 'junk'],
        defaultContractModelId: '00000000-0000-4000-8000-00000000dead',
        savedTexts: [billing, { ...billing, id: '00000000-0000-4000-8000-000000000012', name: '   ' }]
      })
    )
    const loaded = await new JsonSettingsRepository(file).load()
    expect(loaded.contractModels).toEqual([uruguay])
    expect(loaded.defaultContractModelId).toBeNull()
    expect(loaded.savedTexts).toEqual([billing])
  })

  it('the library is saved and read back', async () => {
    const repo = new JsonSettingsRepository(file)
    const settings = mergeSettings(DEFAULT_SETTINGS, { contractModels: [uruguay], defaultContractModelId: uruguay.id, savedTexts: [billing] })
    await repo.save(settings)
    expect(await new JsonSettingsRepository(file).load()).toEqual(settings)
  })
})

describe('JsonSettingsRepository: settings of an early version', () => {
  it('the contract kept in the issuer becomes the default model of the library', async () => {
    const issuer = { ...EMPTY_ISSUER, generalTerms: '1. Confidentiality.', governingLaw: 'Uruguay', courts: 'Montevideo' }
    await writeFile(file, JSON.stringify({ theme: 'light', language: 'es', issuer, reportOptions: {} }))
    const loaded = await new JsonSettingsRepository(file).load()
    expect(loaded.contractModels).toEqual([
      { id: expect.any(String), name: 'Uruguay', governingLaw: 'Uruguay', courts: 'Montevideo', generalTerms: '1. Confidentiality.' }
    ])
    expect(loaded.defaultContractModelId).toBe(loaded.contractModels[0]!.id)
    expect(loaded.issuer).toEqual(EMPTY_ISSUER)
    // Once the library has models, the old fields are ignored.
    await writeFile(file, JSON.stringify({ issuer, contractModels: [uruguay], defaultContractModelId: uruguay.id }))
    expect((await new JsonSettingsRepository(file).load()).contractModels).toEqual([uruguay])
  })
})
