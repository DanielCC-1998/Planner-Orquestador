import { describe, expect, it } from 'vitest'
import { buildReportModel, DEFAULT_REPORT_OPTIONS, EMPTY_ISSUER, type ReportOptions } from '@application'
import { apply, EMPTY_PARTY, LANGUAGES, type Language, type ProjectState } from '@domain'
import { loginSignupScenario, run, testContext } from '@tests/support/builders'
import { escapeHtml, renderDescriptionHtml } from '@infrastructure/pdf/descriptionHtml'
import { footerTemplate, renderReportHtml } from '@infrastructure/pdf/reportHtml'
import { reportCss } from '@infrastructure/pdf/reportCss'
import { reportFileName } from '@infrastructure/pdf/reportText'

const NOW = '2026-09-30T10:00:00.000Z'

const optionsIn = (language: Language, extra: Partial<ReportOptions> = {}): ReportOptions => ({
  ...DEFAULT_REPORT_OPTIONS,
  ...extra,
  language
})

// Intl uses special spaces: no-break (U+00A0) between amount and symbol, thin ones (U+2009, U+202F)
// around the dash of date ranges. They are normalized for comparisons.
const SPECIAL_SPACES = new RegExp(`[${String.fromCharCode(0xa0, 0x2009, 0x202f)}]`, 'g')
const plain = (s: string) => s.replace(SPECIAL_SPACES, ' ')

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
      quote: { number: 'P-2026-07', date: '2026-09-30', validityDays: 30, terms: 'Payment within 30 days', client: EMPTY_PARTY, contractModelId: null }
    }
  }).state
  const titleOf = (id: string) => state.tasks.get(id)!.title
  const issuer = { ...EMPTY_ISSUER, name: 'Studio & Co', taxId: 'B-12345678' }
  const modelIn = (language: Language, s: ProjectState = withTax, extra: Partial<ReportOptions> = {}) =>
    buildReportModel(s, optionsIn(language, extra), issuer, { now: NOW })
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
  // Only the <body>: the embedded CSS also mentions the classes and the section. Without the appendix,
  // whose rows list below each subtask the tasks that need it, the same way as the descriptions.
  const html = (language: Language, descriptions: 'none' | 'inline' | 'section', s = described) => {
    const sections = { ...DEFAULT_REPORT_OPTIONS.sections, shared: false }
    const doc = renderReportHtml(buildReportModel(s, optionsIn(language, { descriptions, sections }), EMPTY_ISSUER, { now: NOW }))
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
        expect(out).toContain('<tr class="has-desc keep">')
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

describe('"Task status" section and tags in the PDF', () => {
  const at = (date: string) => `${date}T10:00:00.000Z`
  /** Weekly sprints from Sep 7: two tasks finish in sprint 1, one goes back in sprint 4 (the current one). */
  function scenario() {
    const { state, ids } = loginSignupScenario()
    let s = run(state, { type: 'project.update', patch: { startDate: '2026-09-07', sprints: { length: 1, unit: 'week' } } }).state
    const change = (id: string, status: 'done' | 'review', date: string) => {
      const r = apply(s, { type: 'task.update', id, patch: { status } }, testContext(at(date)))
      if (!r.ok) throw new Error(r.error.message)
      s = r.value.state
    }
    change(ids.form, 'done', '2026-09-08')
    change(ids.table, 'done', '2026-09-09')
    change(ids.table, 'review', '2026-09-29')
    s = run(s, { type: 'task.create', parentId: ids.signup, fields: { title: '' } }).state
    const tag = run(s, { type: 'tag.create', name: 'Design <UX>', color: 'teal', assignTo: [ids.form] })
    return { state: tag.state, ids }
  }
  const { state } = scenario()
  const body = (language: Language, columns: Partial<ReportOptions['columns']>) => {
    const options = optionsIn(language, { columns: { ...DEFAULT_REPORT_OPTIONS.columns, ...columns } })
    const doc = plain(renderReportHtml(buildReportModel(state, options, EMPTY_ISSUER, { now: NOW, localDate: (iso) => iso.slice(0, 10) })))
    return doc.slice(doc.indexOf('<body>'))
  }

  const TEXTS: Readonly<Record<Language, readonly string[]>> = {
    en: [
      'Task status',
      'Status on Sep 30, 2026 · sprints of 1 week starting Sep 7, 2026',
      'Progress by sprint',
      '<b>Sprint 1</b><span class="when">Sep 7 – 13, 2026</span>',
      '2 done',
      '<b>Sprints 2–3</b> · Sep 14 – 27, 2026 · No status changes',
      '<span class="current">in progress</span>',
      '1 moved back',
      '<span class="back">Moved back</span>',
      '<span class="ltitle">Untitled</span>'
    ],
    // i18n:es-start
    es: [
      'Estado de las tareas',
      'Estado a 30 sept 2026 · sprints de 1 semana desde el 7 sept 2026',
      'Progreso por sprint',
      '<b>Sprint 1</b><span class="when">7–13 sept 2026</span>',
      '2 terminadas',
      '<b>Sprints 2–3</b> · 14–27 sept 2026 · Sin cambios de estado',
      '<span class="current">en curso</span>',
      '1 retrocede',
      '<span class="back">Retrocede</span>',
      '<span class="ltitle">Sin título</span>'
    ]
    // i18n:es-end
  }

  for (const language of LANGUAGES) {
    describe(`in ${language}`, () => {
      it('with the status option: lanes, the sprint by sprint changes and the quiet sprints in one line', () => {
        const html = body(language, { status: true })
        for (const text of TEXTS[language]) expect(html).toContain(text)
        expect(html).toContain('<span class="dir backward">▼</span><span class="pill done">')
        expect(html).toContain('<table class="lane review">')
      })

      it('without it there is no section', () => {
        const html = body(language, { status: false })
        expect(html).not.toContain(TEXTS[language][0])
        expect(html).not.toContain('class="lane')
      })

      it('tag chips only with the tags option, escaped and in their colors', () => {
        expect(body(language, { status: true })).not.toContain('class="chip"')
        const html = body(language, { status: true, tags: true })
        expect(html).toContain('<span class="chip" style="background:#0f766e;color:#ffffff">Design &lt;UX&gt;</span>')
      })
    })
  }

  it('a project without sprints says so', () => {
    const off = run(state, { type: 'project.update', patch: { sprints: null } }).state
    const doc = renderReportHtml(buildReportModel(off, optionsIn('en', { columns: { ...DEFAULT_REPORT_OPTIONS.columns, status: true } }), EMPTY_ISSUER, { now: NOW }))
    expect(doc).toContain('This project does not work in sprints.')
  })
})

describe('page breaks of the PDF', () => {
  const { state, ids } = loginSignupScenario()
  const body = (s: ProjectState, extra: Partial<ReportOptions> = {}) => {
    const doc = renderReportHtml(buildReportModel(s, optionsIn('en', extra), EMPTY_ISSUER, { now: NOW, localDate: (iso) => iso.slice(0, 10) }))
    return doc.slice(doc.indexOf('<body>'))
  }
  const withTerms = (terms: string) =>
    run(state, { type: 'project.update', patch: { quote: { number: '', date: null, validityDays: 30, terms, client: EMPTY_PARTY, contractModelId: null } } }).state

  it('the terms go in one block per clause (blank lines separate them), with their line breaks and indents', () => {
    const html = body(withTerms('1. Payment.\n   - 30 % upfront\n\n \n2. Warranty.\r\n\r\nAccepting the quote accepts these terms.  \n\n'))
    const clauses = [...html.matchAll(/<p class="pre clause">([^]*?)<\/p>/g)].map((m) => m[1])
    expect(clauses).toEqual(['1. Payment.\n   - 30 % upfront', '2. Warranty.', 'Accepting the quote accepts these terms.'])
    expect(body(withTerms(' \n\n '))).not.toContain('<h2>Terms</h2>')
  })

  it('the appendix and the terms only stay after the previous section if all of them fit', () => {
    const html = body(withTerms('Payment within 30 days'))
    expect(html).toContain('<section class="flow together">\n  <h2>Appendix: shared subtasks</h2>')
    expect(html).toContain('<section class="flow together">\n  <h2>Terms</h2>')
    expect(reportCss('#000000')).toContain('section.together { break-inside: avoid; }')
  })

  it('a task keeps its description, a parent its first subtask and a subtotal the rows it adds up', () => {
    const described = run(state, { type: 'task.update', id: ids.login, patch: { description: 'Sign-in story.' } }).state
    const html = body(described, { descriptions: 'inline' })
    expect(html).toContain('<tr class="level-1 parent has-desc keep">')
    expect(html).toContain('<tr class="desc-row level-1 keep">')
    expect(html).toContain('<tr class="level-1 parent keep">')
    // Without its subtasks in the table a parent is a row like any other.
    expect(body(described, { maxDepth: 1 })).toContain('<tr class="level-1 parent">')
    const css = reportCss('#000000')
    expect(css).toContain('tr.keep { break-after: avoid; }')
    expect(css).toContain('tr.subtotal, tr.grand { break-before: avoid; }')
  })

  it('the tasks that need a shared subtask go below it, across the appendix table', () => {
    expect(body(state)).toContain('<div class="desc"><b>Needed by:</b> 1 Login · 2 Sign-up</div>')
  })

  it('each lane repeats its head on every page, and a top-level task never leaves its subtasks', () => {
    const extra = run(state, { type: 'task.create', parentId: ids.signup, fields: { title: 'Captcha' } }).state
    const html = body(extra, { columns: { ...DEFAULT_REPORT_OPTIONS.columns, status: true } })
    const lane = html.slice(html.indexOf('<table class="lane todo">'), html.indexOf('<table class="lane in_progress">'))
    expect(lane).toContain('<thead><tr><th><div class="lane-head"><span class="dot todo"></span>To do · 6</div></th></tr></thead>')
    const groups = [...lane.matchAll(/<li>([^]*?)<\/li>/g)].map((m) => [...m[1]!.matchAll(/class="lcode">([^<]+)</g)].map((c) => c[1]))
    expect(groups).toEqual([
      ['1', '1.1', '1.2'],
      ['2', '2.2', '2.3']
    ])
  })
})

describe('the quote as a contract', () => {
  const { state } = loginSignupScenario()
  const client = {
    legalName: 'ACME <Retail> Ltd.',
    taxId: 'B-87654321',
    address: '22 Market Road, Leeds',
    email: 'buy@acme.example',
    signerName: 'Jordan Smith',
    signerId: '',
    signerRole: 'Head of Digital'
  }
  const quote = { number: 'Q-7', date: '2026-09-30', validityDays: 30, terms: '1. Payment within 30 days.', client, contractModelId: null }
  const signed = run(state, { type: 'project.update', patch: { client: 'ACME', quote } }).state
  const issuer = {
    ...EMPTY_ISSUER,
    name: 'North Studio',
    taxId: 'GB 123',
    taxIdLabel: 'VAT no.',
    address: '1 High Street',
    email: 'hi@north.example',
    signerName: 'Emma North',
    signerId: 'P-123'
  }
  /** The contract model of the project, as the report service resolves it from the library. */
  const contract = {
    id: '00000000-0000-4000-8000-0000000000c1',
    name: 'England',
    generalTerms: '1. Confidentiality.\n\n2. Signing.',
    governingLaw: 'England and Wales',
    courts: 'London'
  }
  type Contract = typeof contract
  const modelOf = (language: Language, s: ProjectState, extra: Partial<ReportOptions>, model: Contract | null = contract, who = issuer) =>
    buildReportModel(s, optionsIn(language, extra), who, { now: NOW, contract: model })
  const body = (language: Language, s = signed, extra: Partial<ReportOptions> = {}, model: Contract | null = contract, who = issuer) => {
    const doc = plain(renderReportHtml(modelOf(language, s, extra, model, who)))
    return doc.slice(doc.indexOf('<body>'))
  }
  const withoutSignatures = { sections: { ...DEFAULT_REPORT_OPTIONS.sections, signatures: false } }
  // i18n:es-start
  const ES = {
    title: '<h2>Aceptación y firmas</h2>',
    client: '<div class="role">Cliente</div><div class="name"><span class="value">ACME</span></div>',
    acceptance:
      'Las partes aceptan el presupuesto nº Q-7 de fecha 30 de septiembre de 2026 para el proyecto «Project»: el alcance del desglose de tareas y las condiciones de este documento.',
    signer: '<span class="label">Aclaración:</span><span class="value">Emma North</span>',
    terms: '<h2>Condiciones</h2>',
    general: 'Condiciones generales'
  }
  // i18n:es-end

  it('ends with the parties, what they accept, the law and courts, and room for both signatures', () => {
    const html = body('en')
    expect(html).toContain('<h2>Acceptance and signatures</h2>')
    expect(html).toContain('<div class="role">Provider</div><div class="name"><span class="value">North Studio</span></div>')
    expect(html).toContain('<span class="label">VAT no.:</span><span class="value">GB 123</span>')
    expect(html).toContain('<div class="role">Client</div><div class="name"><span class="value">ACME &lt;Retail&gt; Ltd.</span></div>')
    expect(html).toContain(
      'The parties accept quote no. Q-7 dated September 30, 2026 for the project “Project”: the scope in the task breakdown, the amount of €750.00 and the terms of this document. The offer is valid until October 30, 2026.'
    )
    expect(html).toContain(
      '<p class="law">This agreement is governed by the laws of England and Wales. The parties submit any dispute arising from it to the courts of London.</p>'
    )
    // Empty details are lines to fill in by hand: the client's ID document and the place and date of both.
    expect(html).toContain('<span class="label">ID document:</span><span class="value blank"></span>')
    expect(html.match(/Place and date:<\/span><span class="value blank"><\/span>/g)).toHaveLength(2)
    // The issuer signs without a role; the client always has the line.
    expect(html.match(/>Position:</g)).toHaveLength(1)
  })

  it('in Spanish, with the client of the project when there is no company name, and without amounts if the PDF has none', () => {
    const unnamed = run(signed, { type: 'project.update', patch: { quote: { ...quote, client: { ...client, legalName: '' } } } }).state
    const html = body('es', unnamed, { columns: { ...DEFAULT_REPORT_OPTIONS.columns, cost: false } })
    expect(html).toContain(ES.title)
    expect(html).toContain(ES.client)
    expect(html).toContain(ES.acceptance)
    expect(html).toContain(ES.signer)
    // Without law and courts in the contract model, nothing is said about them.
    expect(body('es', signed, {}, { ...contract, governingLaw: '', courts: '' })).not.toContain('class="law"')
  })

  it('without the option there is no signatures page', () => {
    const html = body('en', signed, withoutSignatures)
    expect(html).not.toContain('Acceptance and signatures')
    expect(html).not.toContain('class="sign"')
  })

  it('the particular terms come first, with the note on which prevail; with one kind only, a single "Terms" section', () => {
    const html = body('en')
    expect(html).toContain('<h2>Particular terms</h2>\n  <p class="small muted lead">Whatever these particular terms do not cover')
    expect(html.indexOf('<h2>Particular terms</h2>')).toBeLessThan(html.indexOf('<h2>General terms</h2>'))
    expect(html).toContain('<p class="pre clause">2. Signing.</p>')
    const generalOnly = body('en', run(signed, { type: 'project.update', patch: { quote: { ...quote, terms: '' } } }).state)
    expect(generalOnly).toContain('<h2>Terms</h2>')
    expect(generalOnly).toContain('<p class="pre clause">1. Confidentiality.</p>')
    expect(generalOnly).not.toContain('Particular terms')
    const particularOnly = body('es', signed, {}, { ...contract, generalTerms: ' ' })
    expect(particularOnly).toContain(ES.terms)
    expect(particularOnly).not.toContain(ES.general)
  })

  it('every page names the quote and, when it is signed, has a box for the initials of each party', () => {
    const footer = (extra: Partial<ReportOptions>) => footerTemplate(modelOf('en', signed, extra))
    expect(footer({})).toContain('<span>North Studio · Project · Quote no. Q-7</span>')
    expect(footer({})).toContain('Initials')
    expect(footer({}).match(/border:0\.6px solid/g)).toHaveLength(2)
    expect(footer({ initials: false })).not.toContain('Initials')
    expect(footer(withoutSignatures)).not.toContain('Initials')
  })

  it('the cover shows the tax ID with the name the issuer gave it', () => {
    expect(body('es')).toContain('VAT no.: GB 123')
    expect(body('es', signed, {}, contract, { ...issuer, taxIdLabel: '' })).toContain('NIF/CIF: GB 123')
  })

  it('without a contract model there are only the particular terms, and nothing about law or courts', () => {
    const html = body('en', signed, {}, null)
    expect(html).toContain('<h2>Terms</h2>')
    expect(html).toContain('<p class="pre clause">1. Payment within 30 days.</p>')
    expect(html).not.toContain('General terms')
    expect(html).not.toContain('class="law"')
  })
})
