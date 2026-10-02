import { describe, expect, it } from 'vitest'
import { apply, chooseContractModel, EMPTY_PARTY, PARTY_FIELD_LIMITS, type ContractParty, type ProjectState, type QuoteInfo } from '@domain'
import { newState, run, testContext } from '@tests/support/builders'

/** The quote of `state` with another client; `client` may be anything, as if it came from outside. */
const withClient = (state: ProjectState, client: unknown): QuoteInfo => ({ ...state.meta.quote, client: client as ContractParty })
const reasonOf = (state: ProjectState, client: unknown) => {
  const r = apply(state, { type: 'project.update', patch: { quote: withClient(state, client) } }, testContext())
  return r.ok ? null : r.error.reason
}

describe('the client of the quote as a party of the contract', () => {
  it('a new project has it empty: every field is a blank line in the PDF', () => {
    expect(newState().meta.quote.client).toEqual(EMPTY_PARTY)
  })

  it('is saved with its fields trimmed', () => {
    const state = newState()
    const client = { ...EMPTY_PARTY, legalName: '  ACME Ltd. ', taxId: ' B-12345678', signerName: 'Ana Ruiz ', signerRole: ' CEO ' }
    const saved = run(state, { type: 'project.update', patch: { quote: withClient(state, client) } }).state.meta.quote.client
    expect(saved).toEqual({ ...EMPTY_PARTY, legalName: 'ACME Ltd.', taxId: 'B-12345678', signerName: 'Ana Ruiz', signerRole: 'CEO' })
  })

  it('a field that is too long or not text, or a missing client, is rejected', () => {
    const state = newState()
    expect(reasonOf(state, { ...EMPTY_PARTY, taxId: 'x'.repeat(PARTY_FIELD_LIMITS.taxId + 1) })).toBe('INVALID_QUOTE')
    expect(reasonOf(state, { ...EMPTY_PARTY, address: 'x'.repeat(PARTY_FIELD_LIMITS.address + 1) })).toBe('INVALID_QUOTE')
    expect(reasonOf(state, { ...EMPTY_PARTY, email: 42 })).toBe('INVALID_QUOTE')
    expect(reasonOf(state, undefined)).toBe('INVALID_QUOTE')
    expect(reasonOf(state, { ...EMPTY_PARTY, address: 'x'.repeat(PARTY_FIELD_LIMITS.address) })).toBeNull()
  })
})

describe('the contract model of the quote', () => {
  const library = [{ id: 'uy' }, { id: 'es' }]

  it('a new project uses the default model; a chosen one is kept by id, without checking the library', () => {
    const state = newState()
    expect(state.meta.quote.contractModelId).toBeNull()
    const quote = { ...state.meta.quote, contractModelId: '00000000-0000-4000-8000-000000000001' }
    expect(run(state, { type: 'project.update', patch: { quote } }).state.meta.quote.contractModelId).toBe(quote.contractModelId)
  })

  it('an id that is not text, empty or too long is rejected', () => {
    const state = newState()
    const reason = (contractModelId: unknown) => {
      const quote = { ...state.meta.quote, contractModelId: contractModelId as string | null }
      const r = apply(state, { type: 'project.update', patch: { quote } }, testContext())
      return r.ok ? null : r.error.reason
    }
    expect(reason(42)).toBe('INVALID_QUOTE')
    expect(reason('')).toBe('INVALID_QUOTE')
    expect(reason('x'.repeat(65))).toBe('INVALID_QUOTE')
    expect(reason(undefined)).toBe('INVALID_QUOTE')
  })

  it('the model of a quote: the one it chose if it still exists, otherwise the default one, otherwise none', () => {
    expect(chooseContractModel(library, 'uy', 'es')).toEqual({ id: 'es' })
    expect(chooseContractModel(library, 'uy', null)).toEqual({ id: 'uy' })
    expect(chooseContractModel(library, 'uy', 'deleted')).toEqual({ id: 'uy' })
    expect(chooseContractModel(library, null, null)).toBeNull()
    expect(chooseContractModel([], 'uy', 'es')).toBeNull()
  })
})
