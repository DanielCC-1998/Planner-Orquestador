import type { Language } from '@domain'
import { safeFileName, type ReportModel } from '@application'

/**
 * Texts of the PDF quote in each language. Functions receive values that are ALREADY
 * HTML-escaped (or formatted numbers and dates) by the renderer; they must not escape them
 * again. Some texts contain HTML markup (`<b>`).
 */
export interface ReportText {
  /** Placeholder for a task without a title. */
  readonly untitled: string
  /** The group of work without an assignee. */
  readonly unassigned: string
  /** Tax name when the project leaves it empty. */
  readonly defaultTaxLabel: string
  /** Word used in the file name: "<project> - quote <date>.pdf". */
  readonly fileWord: string
  /** File name used when the project name has no usable characters. */
  readonly defaultFileName: string
  /** `<title>` of the HTML document. */
  readonly documentTitle: (project: string) => string
  /** Page footer; `page` and `total` are the page-number placeholders of printToPDF. */
  readonly pageOf: (page: string, total: string) => string
  readonly total: string
  /** Labels of the key figures (cover and summary). */
  readonly kpi: {
    readonly totalAmount: string
    readonly effort: string
    readonly estimatedDuration: string
    readonly estimatedHours: string
    readonly duration: string
    readonly storyPoints: string
    readonly tasks: string
  }
  readonly cover: {
    readonly kicker: string
    readonly forClient: (client: string) => string
    readonly quoteNumber: string
    readonly date: string
    readonly validUntil: string
    readonly plannedStart: string
    /** Prefix of the issuer's tax id. */
    readonly taxId: string
    readonly taxIncluded: (taxLabel: string) => string
    /** `formatted` is `count` already formatted for the language. */
    readonly taskCount: (count: number, formatted: string) => string
    readonly estimatedEnd: (date: string) => string
  }
  readonly summary: {
    readonly title: string
    readonly withContingency: (work: string, contingency: string) => string
    /** End date after the duration in weeks: "3 weeks · ends Oct 14, 2026". */
    readonly ends: (date: string) => string
    readonly budget: string
    readonly estimatedWork: string
    readonly contingency: (percent: string) => string
    readonly taxableBase: string
    /** Note about shared subtasks; `savings` is '' or the hours and amount not double-counted. */
    readonly sharedNote: (savings: string) => string
    readonly durationNote: string
    readonly paceSetter: (name: string) => string
    readonly scope: string
  }
  /** Table headers. */
  readonly columns: {
    readonly wbs: string
    readonly task: string
    readonly assignee: string
    readonly status: string
    readonly storyPoints: string
    readonly hours: string
    readonly rate: string
    readonly amount: string
    readonly person: string
    readonly hoursPerDay: string
    readonly days: string
    readonly load: string
    readonly subtask: string
    readonly neededBy: string
    readonly occurrences: string
    readonly savedHours: string
    readonly savedMoney: (currencySymbol: string) => string
  }
  readonly breakdown: {
    readonly title: string
    /** Descendants added into a row because of the depth limit. */
    readonly includesSubtasks: (count: number) => string
    /** Reference to a shared subtask that has its amounts at `code`. */
    readonly seeShared: (code: string) => string
    /** Reference to a shared subtask added into `code` because of the depth limit. */
    readonly includedShared: (code: string) => string
    readonly subtotal: (code: string, title: string) => string
    readonly sharedCountedOnce: string
    readonly amountsNote: string
  }
  readonly details: {
    readonly title: string
    readonly intro: string
  }
  readonly workload: {
    readonly title: string
    readonly note: (withContingency: boolean) => string
  }
  readonly shared: {
    readonly title: string
    readonly intro: string
    readonly totalSaved: string
  }
  readonly terms: {
    readonly title: string
  }
}

export const REPORT_TEXT: Readonly<Record<Language, ReportText>> = {
  en: {
    untitled: 'Untitled',
    unassigned: 'Unassigned',
    defaultTaxLabel: 'Tax',
    fileWord: 'quote',
    defaultFileName: 'project',
    documentTitle: (project) => `${project} — Quote`,
    pageOf: (page, total) => `Page ${page} of ${total}`,
    total: 'Total',
    kpi: {
      totalAmount: 'Total amount',
      effort: 'Effort',
      estimatedDuration: 'Estimated duration',
      estimatedHours: 'Estimated hours',
      duration: 'Duration',
      storyPoints: 'Story points',
      tasks: 'Tasks'
    },
    cover: {
      kicker: 'Project proposal',
      forClient: (client) => `Prepared for ${client}`,
      quoteNumber: 'Quote no.',
      date: 'Date',
      validUntil: 'Valid until',
      plannedStart: 'Planned start',
      taxId: 'Tax ID:',
      taxIncluded: (taxLabel) => `${taxLabel} included`,
      taskCount: (count, formatted) => (count === 1 ? `${formatted} task` : `${formatted} tasks`),
      estimatedEnd: (date) => `Estimated end: ${date}`
    },
    summary: {
      title: 'Summary',
      withContingency: (work, contingency) => `${work} + ${contingency} contingency`,
      ends: (date) => `ends ${date}`,
      budget: 'Budget',
      estimatedWork: 'Estimated work',
      contingency: (percent) => `Contingency (${percent})`,
      taxableBase: 'Taxable base',
      sharedNote: (savings) =>
        `Some subtasks are needed by several tasks at once. They are budgeted <b>only once</b>${
          savings ? `, which avoids double-counting ${savings}` : ''
        }. See the appendix for details.`,
      durationNote:
        'The duration is an optimistic estimate: the team works in parallel, each person at their daily hours, with no dependencies between tasks.',
      paceSetter: (name) => `Sets the pace: <b>${name}</b>.`,
      scope: 'Scope'
    },
    columns: {
      wbs: 'WBS',
      task: 'Task',
      assignee: 'Assignee',
      status: 'Status',
      storyPoints: 'SP',
      hours: 'Hours',
      rate: 'Rate',
      amount: 'Amount',
      person: 'Person',
      hoursPerDay: 'Hours/day',
      days: 'Days',
      load: 'Load',
      subtask: 'Subtask',
      neededBy: 'Needed by',
      occurrences: 'Occurrences',
      savedHours: 'Savings (h)',
      savedMoney: (currencySymbol) => `Savings (${currencySymbol})`
    },
    breakdown: {
      title: 'Task breakdown',
      includesSubtasks: (count) => (count === 1 ? '(includes 1 subtask)' : `(includes ${count} subtasks)`),
      seeShared: (code) => `shared · see ${code}`,
      includedShared: (code) => `shared · included in ${code}`,
      subtotal: (code, title) => `Subtotal ${code} ${title}`,
      sharedCountedOnce: '(each shared subtask counted once)',
      amountsNote: 'Amounts exclude contingency and taxes; see the summary for the total.'
    },
    details: {
      title: 'Task details',
      intro: 'Descriptions of the tasks in the breakdown, in the same order (WBS code).'
    },
    workload: {
      title: 'Team and workload',
      note: (withContingency) =>
        `★ Person who sets the project duration. Working days at each person’s daily hours${
          withContingency ? ', including contingency' : ''
        }.`
    },
    shared: {
      title: 'Appendix: shared subtasks',
      intro:
        'These subtasks are needed by several tasks. In the breakdown they appear with an amount only once (at their own code) and as a ↗ reference everywhere else.',
      totalSaved: 'Total saved by not double-counting'
    },
    terms: {
      title: 'Terms'
    }
  },
  // i18n:es-start
  es: {
    untitled: 'Sin título',
    unassigned: 'Sin asignar',
    defaultTaxLabel: 'IVA',
    fileWord: 'presupuesto',
    defaultFileName: 'proyecto',
    documentTitle: (project) => `${project} — Presupuesto`,
    pageOf: (page, total) => `Página ${page} de ${total}`,
    total: 'Total',
    kpi: {
      totalAmount: 'Importe total',
      effort: 'Esfuerzo',
      estimatedDuration: 'Duración estimada',
      estimatedHours: 'Horas estimadas',
      duration: 'Duración',
      storyPoints: 'Puntos de historia',
      tasks: 'Tareas'
    },
    cover: {
      kicker: 'Propuesta de proyecto',
      forClient: (client) => `Para ${client}`,
      quoteNumber: 'Nº de oferta',
      date: 'Fecha',
      validUntil: 'Válida hasta',
      plannedStart: 'Inicio previsto',
      taxId: 'NIF/CIF:',
      taxIncluded: (taxLabel) => `${taxLabel} incluido`,
      taskCount: (count, formatted) => (count === 1 ? `${formatted} tarea` : `${formatted} tareas`),
      estimatedEnd: (date) => `Fin previsto: ${date}`
    },
    summary: {
      title: 'Resumen',
      withContingency: (work, contingency) => `${work} + ${contingency} de contingencia`,
      ends: (date) => `fin ${date}`,
      budget: 'Presupuesto',
      estimatedWork: 'Trabajo estimado',
      contingency: (percent) => `Contingencia (${percent})`,
      taxableBase: 'Base imponible',
      sharedNote: (savings) =>
        `Hay subtareas que necesitan varias tareas a la vez. Se presupuestan <b>una sola vez</b>${
          savings ? `, lo que evita contar de más ${savings}` : ''
        }. Detalle en el anexo.`,
      durationNote:
        'La duración es una estimación optimista: el equipo trabaja en paralelo según su dedicación diaria y sin dependencias entre tareas.',
      paceSetter: (name) => `Marca el ritmo: <b>${name}</b>.`,
      scope: 'Alcance'
    },
    columns: {
      wbs: 'WBS',
      task: 'Tarea',
      assignee: 'Responsable',
      status: 'Estado',
      storyPoints: 'SP',
      hours: 'Horas',
      rate: 'Tarifa',
      amount: 'Importe',
      person: 'Persona',
      hoursPerDay: 'Dedicación',
      days: 'Días',
      load: 'Carga',
      subtask: 'Subtarea',
      neededBy: 'Necesaria para',
      occurrences: 'Apariciones',
      savedHours: 'Ahorro (h)',
      savedMoney: (currencySymbol) => `Ahorro (${currencySymbol})`
    },
    breakdown: {
      title: 'Desglose de tareas',
      includesSubtasks: (count) => (count === 1 ? '(incluye 1 subtarea)' : `(incluye ${count} subtareas)`),
      seeShared: (code) => `compartida · ver ${code}`,
      includedShared: (code) => `compartida · incluida en ${code}`,
      subtotal: (code, title) => `Subtotal ${code} ${title}`,
      sharedCountedOnce: '(cada subtarea compartida contada una vez)',
      amountsNote: 'Importes sin contingencia ni impuestos; ver el resumen para el total.'
    },
    details: {
      title: 'Detalle de las tareas',
      intro: 'Descripción de las tareas del desglose, en el mismo orden (código WBS).'
    },
    workload: {
      title: 'Equipo y carga de trabajo',
      note: (withContingency) =>
        `★ Persona que marca la duración del proyecto. Días laborables a su dedicación diaria${
          withContingency ? ', con contingencia' : ''
        }.`
    },
    shared: {
      title: 'Anexo: subtareas compartidas',
      intro:
        'Estas subtareas son necesarias para varias tareas. En el desglose aparecen con importe una sola vez (en su código) y como referencia ↗ en el resto.',
      totalSaved: 'Ahorro total por no duplicar'
    },
    terms: {
      title: 'Condiciones'
    }
  }
  // i18n:es-end
}

/** Suggested file name for the PDF, in the language of the report. */
export function reportFileName(model: ReportModel): string {
  const text = REPORT_TEXT[model.options.language]
  return `${safeFileName(model.project.name, text.defaultFileName)} - ${text.fileWord} ${model.project.quoteDate}.pdf`
}
