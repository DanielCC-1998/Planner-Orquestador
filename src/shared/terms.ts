/**
 * Terms of a quote as plain text: clauses are paragraphs separated by blank lines, usually
 * numbered ("1. Scope. …"). Used by the PDF and by the library of saved texts.
 */

/** Limits of the library of contracts: models, saved texts and the length of their fields. */
export const LIBRARY_LIMITS = {
  models: 50,
  texts: 500,
  name: 100,
  place: 200,
  text: 20_000
} as const

/** Paragraphs of the terms, with their own line breaks and indents. */
export function termsParagraphs(terms: string): string[] {
  return terms
    .split(/\r?\n(?:[ \t]*\r?\n)+/)
    .map((paragraph) => paragraph.replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd())
    .filter((paragraph) => paragraph.trim() !== '')
}

const NUMBER = /^\s*(\d{1,3})\.\s+/

/** Number of a clause ("11. Billing…" → 11), or null when it has none. */
export function clauseNumber(paragraph: string): number | null {
  const match = NUMBER.exec(paragraph)
  return match ? Number(match[1]) : null
}

/** Number the next clause of these terms takes: one more than the highest one. */
export function nextClauseNumber(terms: string): number {
  return termsParagraphs(terms).reduce((n, paragraph) => Math.max(n, clauseNumber(paragraph) ?? 0), 0) + 1
}

/**
 * Adds a text as the last paragraph of the terms. A text without a number gets the next one when
 * the terms are empty or already numbered, so a saved clause fits in without retyping.
 */
export function appendClause(terms: string, text: string): string {
  const body = text.trim()
  if (!body) return terms
  const before = terms.trimEnd()
  const numbered = before === '' || termsParagraphs(before).some((paragraph) => clauseNumber(paragraph) !== null)
  const clause = clauseNumber(body) === null && numbered ? `${nextClauseNumber(before)}. ${body}` : body
  return before ? `${before}\n\n${clause}` : clause
}

const MAX_NAME = 60

/**
 * Each paragraph of the terms as a text for the library, without its number and named after its
 * title: "11. Billing and payment. The deposit…" → "Billing and payment". A paragraph without a
 * title is named after its first words.
 */
export function splitClauses(terms: string): Array<{ name: string; text: string }> {
  return termsParagraphs(terms).map((paragraph) => {
    const text = paragraph.replace(NUMBER, '')
    const firstLine = text.split(/\r?\n/)[0]!.trim()
    // The title ends at the first period or colon that ends a sentence ("(7.3, 11.1)" is not one).
    const title = /^(.+?)[.:](?=\s|$)/.exec(firstLine)?.[1]?.trim() ?? ''
    const name = title && title.length <= MAX_NAME ? title : shorten(firstLine)
    return { name, text }
  })
}

function shorten(line: string): string {
  return line.length <= 40 ? line : `${line.slice(0, 39).trimEnd()}…`
}
