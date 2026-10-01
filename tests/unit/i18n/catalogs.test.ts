import { describe, expect, it } from 'vitest'
import { DOMAIN_ERROR_REASONS } from '@domain'
import { APP_ERROR_REASONS } from '@application'
import { MAIN_TEXT } from '@infrastructure/i18n/mainText'
import { REPORT_TEXT } from '@infrastructure/pdf/reportText'
import { MESSAGES } from '@presentation/i18n/messages'
import { INFRA_ERROR_REASONS } from '@shared/ipc/errors'

type Leaf = readonly [path: string, value: string]

/** Every text of a catalog, with functions called with sample arguments. */
function leaves(node: unknown, path = ''): Leaf[] {
  if (typeof node === 'string') return [[path, node]]
  if (typeof node === 'function') {
    const fn = node as (...args: unknown[]) => unknown
    const samples = Array.from({ length: fn.length }, () => '2')
    const out = fn(...samples)
    return [[`${path}()`, typeof out === 'string' ? out : '']]
  }
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key))
  }
  return [[path, '']]
}

const CATALOGS = { messages: MESSAGES, report: REPORT_TEXT, main: MAIN_TEXT }

// i18n:es-start
/** Spanish markers: accents, ¿¡«» and frequent words that do not exist in English. */
const SPANISH = /[áéíóúñÁÉÍÓÚÑ¿¡«»]|\b(el|los|las|del|una|unas|para|con|sin|por|que|está|tarea|tareas|proyecto|proyectos|subtarea|subtareas|horas|persona|personas)\b/
// i18n:es-end

/** Words that are the same in both languages on purpose (texts made only of them need no translation). */
const SAME_IN_BOTH = new Set([
  'PDF',
  'Email',
  'Logo',
  'Ctrl',
  'Alt',
  'Enter',
  'Esc',
  'Tab',
  'K',
  'Total',
  'Subtotal',
  'SP',
  'WBS',
  'Planner',
  'Kanban',
  'Color',
  'General',
  'Zoom',
  'incl.',
  'cont.'
])

/** A text that is only formatting (sample arguments, numbers, punctuation) or shared words. */
const sameOnPurpose = (value: string) =>
  value
    .replace(/\d/g, ' ')
    .split(/[^\p{L}.]+/u)
    .filter((word) => word !== '' && word !== '.')
    .every((word) => SAME_IN_BOTH.has(word))

describe.each(Object.entries(CATALOGS))('%s catalog', (_name, catalog) => {
  const en = new Map(leaves(catalog.en))
  const es = new Map(leaves(catalog.es))

  it('English and Spanish have the same keys', () => {
    expect([...es.keys()].sort()).toEqual([...en.keys()].sort())
  })

  it('no text is empty', () => {
    const empty = [...en, ...es].filter(([path, value]) => value === '' && !path.endsWith('()'))
    expect(empty.map(([path]) => path)).toEqual([])
  })

  it('English texts contain no Spanish', () => {
    const spanish = [...en].filter(([, value]) => SPANISH.test(value)).map(([path, value]) => `${path}: ${value}`)
    expect(spanish).toEqual([])
  })

  it('Spanish texts are translated', () => {
    const untranslated = [...es]
      .filter(([path, value]) => value === en.get(path) && !sameOnPurpose(value))
      .map(([path, value]) => `${path}: ${value}`)
    expect(untranslated).toEqual([])
  })
})

describe('error reasons', () => {
  it('every reason has a text in both languages', () => {
    for (const language of ['en', 'es'] as const) {
      const errors = MESSAGES[language].errors
      for (const reason of DOMAIN_ERROR_REASONS) expect(errors.domain[reason], reason).toBeTruthy()
      for (const reason of APP_ERROR_REASONS) expect(errors.app[reason], reason).toBeTruthy()
      for (const reason of INFRA_ERROR_REASONS) expect(errors.infra[reason], reason).toBeTruthy()
    }
  })
})
