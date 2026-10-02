import { describe, expect, it } from 'vitest'
import { appendClause, clauseNumber, nextClauseNumber, splitClauses, termsParagraphs } from '@shared/terms'

describe('terms as text', () => {
  const terms = '1. Scope. Only the breakdown.\n\n2. Billing and payment.\n   - Deposit: 30 %.\n   - Rest: per sprint.\n\nAccepting the quote accepts these terms.'

  it('splits the paragraphs and reads the number of each clause', () => {
    expect(termsParagraphs(terms)).toHaveLength(3)
    expect(termsParagraphs(terms).map(clauseNumber)).toEqual([1, 2, null])
    expect(nextClauseNumber(terms)).toBe(3)
    expect(nextClauseNumber('')).toBe(1)
  })

  it('a saved text goes at the end, with the next number when the terms are numbered or empty', () => {
    expect(appendClause(terms, 'Warranty. 30 days.')).toBe(`${terms}\n\n3. Warranty. 30 days.`)
    expect(appendClause('', '  Warranty. 30 days. ')).toBe('1. Warranty. 30 days.')
    expect(appendClause('1. Scope.\n\n\n', 'Warranty.')).toBe('1. Scope.\n\n2. Warranty.')
    // Terms written without numbers, or a text that has its own, are left as they are.
    expect(appendClause('Plain text.', 'Warranty.')).toBe('Plain text.\n\nWarranty.')
    expect(appendClause(terms, '7. Already numbered.')).toBe(`${terms}\n\n7. Already numbered.`)
    expect(appendClause(terms, '   ')).toBe(terms)
  })

  it('each clause becomes a text named after its title, without its number', () => {
    const clauses = splitClauses(
      '3. Exploratory tasks (7.3, 11.1 and 11.2). Research work.\n\n11. Billing and payment.\n   - Deposit.\n\nAccepting this quote accepts every term written above in this document, all of them.'
    )
    expect(clauses.slice(0, 2)).toEqual([
      { name: 'Exploratory tasks (7.3, 11.1 and 11.2)', text: 'Exploratory tasks (7.3, 11.1 and 11.2). Research work.' },
      { name: 'Billing and payment', text: 'Billing and payment.\n   - Deposit.' }
    ])
    // Without a short title, the first words name it.
    expect(clauses[2]!.name).toBe('Accepting this quote accepts every term…')
    expect(clauses[2]!.text).toBe('Accepting this quote accepts every term written above in this document, all of them.')
  })
})
