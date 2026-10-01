import { describe, expect, it } from 'vitest'
import { buildReportModel, DEFAULT_REPORT_OPTIONS, EMPTY_ISSUER, type ReportOptions } from '@application'
import { LANGUAGES, type Language, type ProjectState } from '@domain'
import { loginSignupScenario, run } from '@tests/support/builders'
import { escapeHtml, renderDescriptionHtml } from '@infrastructure/pdf/descriptionHtml'
import { footerTemplate, renderReportHtml } from '@infrastructure/pdf/reportHtml'
import { reportFileName } from '@infrastructure/pdf/reportText'

const NOW = '2026-09-30T10:00:00.000Z'

const optionsIn = (language: Language, extra: Partial<ReportOptions> = {}): ReportOptions => ({
  ...DEFAULT_REPORT_OPTIONS,
  ...extra,
  language
})

// Intl separates amount and symbol with a no-break space (U+00A0); it is normalized for comparisons.
const plain = (s: string) => s.split(String.fromCharCode(0xa0)).join(' ')

/** What the PDF must show in each language for the projects of these tests. */
interface Expected {
  readonly title: (project: string) => string
  readonly footer: string
  readonly cover: readonly string[]
  readonly sharedReference: string
  readonly budget: readonly string[]
  readonly bigBudget: readonly string[]
  readonly appendix: readonly string[]
  readonly placeholders: readonly string[]
  readonly savingsInDollars: string
  readonly fileName: (project: string) => string
  readonly fallbackFileName: string
  readonly details: string
}

const EXPECTED: Readonly<Record<Language, Expected>> = {
  en: {
    title: (project) => `<title>${project} — Quote</title>`,
    footer: 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>',
    cover: ['Project proposal', 'Prepared for ACME &lt;Inc.&gt;', 'Quote no.', 'September 30, 2026', 'Valid until', 'Tax ID: B-12345678'],
    sharedReference: 'shared · see 1.1',
    // Work 750 + contingency 75 = 825; tax 21% = 173.25; total 998.25.
    budget: ['€750.00', '€825.00', '€173.25', '€998.25', 'Tax (21%)', 'Tax included'],
    // Form 600 h × €50 = €30,000; total work €30,450.
    bigBudget: ['€30,000.00', '€30,450.00'],
    appendix: ['Appendix: shared subtasks', 'Savings (€)'],
    placeholders: ['>Untitled<', 'Sets the pace: <b>Unassigned</b>.', '★</span> Unassigned'],
    savingsInDollars: 'Savings ($)',
    fileName: (project) => `${project} - quote 2026-09-30.pdf`,
    fallbackFileName: 'project - quote 2026-09-30.pdf',
    details: 'Task details'
  },
  // i18n:es-start
  es: {
    title: (project) => `<title>${project} — Presupuesto</title>`,
    footer: 'Página <span class="pageNumber"></span> de <span class="totalPages"></span>',
    cover: ['Propuesta de proyecto', 'Para ACME &lt;Inc.&gt;', 'Nº de oferta', '30 de septiembre de 2026', 'Válida hasta', 'NIF/CIF: B-12345678'],
    sharedReference: 'compartida · ver 1.1',
    budget: ['750,00 €', '825,00 €', '173,25 €', '998,25 €', 'IVA (21 %)', 'IVA incluido'],
    bigBudget: ['30.000,00 €', '30.450,00 €'],
    appendix: ['Anexo: subtareas compartidas', 'Ahorro (€)'],
    placeholders: ['>Sin título<', 'Marca el ritmo: <b>Sin asignar</b>.', '★</span> Sin asignar'],
    savingsInDollars: 'Ahorro (US$)',
    fileName: (project) => `${project} - presupuesto 2026-09-30.pdf`,
    fallbackFileName: 'proyecto - presupuesto 2026-09-30.pdf',
    details: 'Detalle de las tareas'
  }
  // i18n:es-end
}

const otherLanguage = (language: Language): Language => (language === 'en' ? 'es' : 'en')

describe('renderReportHtml', () => {
  const { state, ids } = loginSignupScenario()
  const withTax = run(state, {
    type: 'project.update',
    patch: {
      taxBps: 2100,
      contingencyBps: 1000,
      client: 'ACME <Inc.>',
      quote: { number: 'P-2026-07', date: '2026-09-30', validityDays: 30, terms: 'Payment within 30 days' }
    }
  }).state
  const titleOf = (id: string) => state.tasks.get(id)!.title
  const issuer = { ...EMPTY_ISSUER, name: 'Studio & Co', taxId: 'B-12345678' }
  const modelIn = (language: Language, s: ProjectState = withTax, extra: Partial<ReportOptions> = {}) =>
    buildReportModel(s, optionsIn(language, extra), issuer, NOW)
  const htmlIn = (language: Language, s: ProjectState = withTax, extra: Partial<ReportOptions> = {}) =>
    plain(renderReportHtml(modelIn(language, s, extra)))

  it('escapes the user text', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;')
    for (const language of LANGUAGES) {
      const html = htmlIn(language)
      expect(html).toContain('ACME &lt;Inc.&gt;')
      expect(html).not.toContain('ACME <Inc.>')
      expect(footerTemplate(modelIn(language))).toContain('Studio &amp; Co')
    }
  })

  for (const language of LANGUAGES) {
    const expected = EXPECTED[language]

    describe(`in ${language}`, () => {
      const html = htmlIn(language)

      it('sets the document language, the title and the page footer', () => {
        expect(html).toContain(`<html lang="${language}">`)
        expect(html).toContain(expected.title(escapeHtml(withTax.meta.name)))
        expect(footerTemplate(modelIn(language))).toContain(expected.footer)
      })

      it('shows the cover in the language of the report', () => {
        for (const text of expected.cover) expect(html).toContain(text)
      })

      it('includes the reference row of the shared subtask and an additive total', () => {
        expect(html).toContain(expected.sharedReference)
        expect(html).toContain(`Subtotal 1 ${escapeHtml(titleOf(ids.login))}`)
        expect(html).toMatch(/Total[\s\S]*15 h/)
      })

      it('budget with contingency and the default tax label, with thousands separators', () => {
        for (const text of expected.budget) expect(html).toContain(text)
        const big = run(withTax, { type: 'task.update', id: ids.form, patch: { estimateMinutes: 600 * 60 } }).state
        const bigHtml = htmlIn(language, big)
        for (const text of expected.bigBudget) expect(bigHtml).toContain(text)
      })

      it('shared subtasks appendix and a version without amounts', () => {
        for (const text of expected.appendix) expect(html).toContain(text)
        const noCost = htmlIn(language, withTax, { columns: { ...DEFAULT_REPORT_OPTIONS.columns, cost: false } })
        expect(noCost).not.toContain('€')
      })

      it('has none of the texts of the other language', () => {
        const other = EXPECTED[otherLanguage(language)]
        for (const text of [...other.cover, other.sharedReference, ...other.budget, ...other.appendix]) {
          expect(html).not.toContain(text)
        }
      })

      it('fills in the untitled and unassigned placeholders', () => {
        // A long task without title or assignee: the unassigned work sets the pace.
        const loose = run(withTax, {
          type: 'task.create',
          parentId: ids.signup,
          fields: { title: '', estimateMinutes: 40 * 60 }
        }).state
        const looseHtml = htmlIn(language, loose)
        for (const text of expected.placeholders) expect(looseHtml).toContain(text)
      })

      it('labels the savings column with the currency symbol of the project', () => {
        const usd = run(withTax, { type: 'project.update', patch: { currency: 'USD' } }).state
        const usdHtml = htmlIn(language, usd)
        expect(usdHtml).toContain(expected.savingsInDollars)
        expect(usdHtml).not.toContain('€')
      })

      it('suggests a file name in the language of the report', () => {
        const model = modelIn(language)
        expect(reportFileName(model)).toBe(expected.fileName(withTax.meta.name))
        expect(reportFileName({ ...model, project: { ...model.project, name: '  ' } })).toBe(expected.fallbackFileName)
      })
    })
  }
})

describe('renderDescriptionHtml', () => {
  it('paragraphs, line breaks, lists and bold', () => {
    const html = renderDescriptionHtml(
      'Sign-in screen.\nWith **email** and password.\n\n- Remember session\n* Lock after 5 attempts\n• Help\n\n1. Step one\n2) Step two\nEnd'
    )
    expect(html).toBe(
      '<p>Sign-in screen.<br>With <b>email</b> and password.</p>' +
        '<ul><li>Remember session</li><li>Lock after 5 attempts</li><li>Help</li></ul>' +
        '<ol><li>Step one</li><li>Step two</li></ol>' +
        '<p>End</p>'
    )
  })

  it('escapes all the HTML of the user', () => {
    const html = renderDescriptionHtml('<script>alert(1)</script>\n- <b>no</b> & "x"')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('<li>&lt;b&gt;no&lt;/b&gt; &amp; &quot;x&quot;</li>')
  })

  it('empty or blank text renders nothing', () => {
    expect(renderDescriptionHtml('   \n  ')).toBe('')
  })
})

describe('descriptions in the PDF', () => {
  const { state, ids } = loginSignupScenario()
  const described = run(state, {
    type: 'task.update',
    id: ids.form,
    patch: { description: 'Sign-in form.\n- Client-side validation\n- Clear <error> messages' }
  }).state
  const titleOf = (id: string) => state.tasks.get(id)!.title
  // Only the <body>: the embedded CSS also mentions the classes and the section.
  const html = (language: Language, descriptions: 'none' | 'inline' | 'section', s = described) => {
    const doc = renderReportHtml(buildReportModel(s, optionsIn(language, { descriptions }), EMPTY_ISSUER, NOW))
    return doc.slice(doc.indexOf('<body>'))
  }

  it('the default is a separate section', () => {
    expect(DEFAULT_REPORT_OPTIONS.descriptions).toBe('section')
  })

  for (const language of LANGUAGES) {
    const title = EXPECTED[language].details

    describe(`in ${language}`, () => {
      it('separate “Task details” section', () => {
        const out = html(language, 'section')
        expect(out).toContain(title)
        expect(out).toContain(`<span class="dcode">1.2</span><span class="dtitle">${escapeHtml(titleOf(ids.form))}</span>`)
        expect(out).toContain(`<div class="path">${escapeHtml(titleOf(ids.login))}</div>`)
        expect(out).toContain('<ul><li>Client-side validation</li><li>Clear &lt;error&gt; messages</li></ul>')
        expect(out).not.toContain('desc-row')
      })

      it('under each task of the breakdown', () => {
        const out = html(language, 'inline')
        expect(out).toContain('<tr class="has-desc">')
        expect(out).toContain('class="desc-row"')
        expect(out).toContain('Sign-in form.')
        expect(out).not.toContain(title)
      })

      it('nothing appears without descriptions, or if no task has one', () => {
        const none = html(language, 'none')
        expect(none).not.toContain(title)
        expect(none).not.toContain('desc-row')
        expect(none).not.toContain('Sign-in form.')
        expect(html(language, 'section', state)).not.toContain(title)
      })
    })
  }
})
