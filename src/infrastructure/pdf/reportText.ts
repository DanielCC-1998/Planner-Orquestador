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
    /** Default name of the issuer's tax ID (the issuer can set theirs: RUT, NIF…). */
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
  /** "Task status" section: lanes by status and the progress by sprint. */
  readonly progress: {
    readonly title: string
    readonly asOf: (date: string) => string
    /** "sprints of 2 weeks starting Sep 1, 2026"; `length` is already worded by the formatter. */
    readonly rhythm: (length: string, start: string) => string
    /** Caption of the bar and its legend. */
    readonly byCount: string
    readonly emptyLane: string
    readonly sprintsTitle: string
    readonly sprintsIntro: string
    readonly noSprints: string
    readonly firstSprintStarts: (date: string) => string
    readonly sprint: (n: number) => string
    /** Several sprints in a row without changes: "Sprints 4–6". */
    readonly sprintRange: (from: number, to: number) => string
    readonly beforeFirst: string
    readonly current: string
    readonly finished: (n: number) => string
    readonly forward: (n: number) => string
    readonly backward: (n: number) => string
    /** Badge of a task that went back to an earlier status. */
    readonly movedBack: string
    readonly noChanges: string
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
    /** When there is only one kind of terms. */
    readonly title: string
    /** Terms of the project, when the issuer has general terms too. */
    readonly particularTitle: string
    readonly generalTitle: string
    /** Under the particular terms: which ones prevail. */
    readonly precedence: string
  }
  /** Last page: the parties, the acceptance and room to sign. */
  readonly signatures: {
    readonly title: string
    readonly provider: string
    readonly client: string
    /** Label of the tax ID of the client (the issuer chooses theirs). */
    readonly clientTaxId: string
    readonly address: string
    readonly email: string
    /** `amount` is null when the PDF has no amounts. */
    readonly acceptance: (quote: { readonly number: string; readonly date: string; readonly project: string; readonly amount: string | null }) => string
    readonly validUntil: (date: string) => string
    readonly governingLaw: (law: string) => string
    readonly courts: (courts: string) => string
    readonly signature: string
    readonly signerName: string
    readonly signerId: string
    readonly signerRole: string
    readonly placeAndDate: string
    /** Footer label of the initials boxes. */
    readonly initials: string
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
      taxId: 'Tax ID',
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
    progress: {
      title: 'Task status',
      asOf: (date) => `Status on ${date}`,
      rhythm: (length, start) => `sprints of ${length} starting ${start}`,
      byCount: 'By number of tasks',
      emptyLane: 'No tasks',
      sprintsTitle: 'Progress by sprint',
      sprintsIntro:
        'Each sprint lists the tasks that ended it in a different status from the one they had when it started. Intermediate steps are not shown.',
      noSprints: 'This project does not work in sprints.',
      firstSprintStarts: (date) => `The first sprint starts on ${date}.`,
      sprint: (n) => `Sprint ${n}`,
      sprintRange: (from, to) => `Sprints ${from}–${to}`,
      beforeFirst: 'Before sprint 1',
      current: 'in progress',
      finished: (n) => `${n} done`,
      forward: (n) => `${n} moved forward`,
      backward: (n) => `${n} moved back`,
      movedBack: 'Moved back',
      noChanges: 'No status changes'
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
      title: 'Terms',
      particularTitle: 'Particular terms',
      generalTitle: 'General terms',
      precedence:
        'Whatever these particular terms do not cover is governed by the general terms below; if they contradict each other, these particular terms prevail.'
    },
    signatures: {
      title: 'Acceptance and signatures',
      provider: 'Provider',
      client: 'Client',
      clientTaxId: 'Tax ID',
      address: 'Address',
      email: 'Email',
      acceptance: ({ number, date, project, amount }) =>
        `The parties accept quote${number ? ` no. ${number}` : ''} dated ${date} for the project “${project}”: the scope in the task breakdown${
          amount ? `, the amount of ${amount}` : ''
        } and the terms of this document.`,
      validUntil: (date) => `The offer is valid until ${date}.`,
      governingLaw: (law) => `This agreement is governed by the laws of ${law}.`,
      courts: (courts) => `The parties submit any dispute arising from it to the courts of ${courts}.`,
      signature: 'Signature',
      signerName: 'Name',
      signerId: 'ID document',
      signerRole: 'Position',
      placeAndDate: 'Place and date',
      initials: 'Initials'
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
      taxId: 'NIF/CIF',
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
    progress: {
      title: 'Estado de las tareas',
      asOf: (date) => `Estado a ${date}`,
      rhythm: (length, start) => `sprints de ${length} desde el ${start}`,
      byCount: 'Por número de tareas',
      emptyLane: 'Sin tareas',
      sprintsTitle: 'Progreso por sprint',
      sprintsIntro:
        'Cada sprint muestra las tareas que lo terminaron en un estado distinto del que tenían al empezarlo. No se muestran los pasos intermedios.',
      noSprints: 'Este proyecto no trabaja por sprints.',
      firstSprintStarts: (date) => `El primer sprint empieza el ${date}.`,
      sprint: (n) => `Sprint ${n}`,
      sprintRange: (from, to) => `Sprints ${from}–${to}`,
      beforeFirst: 'Antes del sprint 1',
      current: 'en curso',
      finished: (n) => (n === 1 ? '1 terminada' : `${n} terminadas`),
      forward: (n) => (n === 1 ? '1 avanza' : `${n} avanzan`),
      backward: (n) => (n === 1 ? '1 retrocede' : `${n} retroceden`),
      movedBack: 'Retrocede',
      noChanges: 'Sin cambios de estado'
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
      title: 'Condiciones',
      particularTitle: 'Condiciones particulares',
      generalTitle: 'Condiciones generales',
      precedence:
        'En lo que no prevean estas condiciones particulares rigen las condiciones generales que siguen; si se contradicen, prevalecen las particulares.'
    },
    signatures: {
      title: 'Aceptación y firmas',
      provider: 'Proveedor',
      client: 'Cliente',
      clientTaxId: 'Identificación fiscal',
      address: 'Domicilio',
      email: 'Correo',
      acceptance: ({ number, date, project, amount }) =>
        `Las partes aceptan el presupuesto${number ? ` nº ${number}` : ''} de fecha ${date} para el proyecto «${project}»: el alcance del desglose de tareas${
          amount ? `, el importe de ${amount}` : ''
        } y las condiciones de este documento.`,
      validUntil: (date) => `La oferta es válida hasta el ${date}.`,
      governingLaw: (law) => `Este contrato se rige por las leyes de ${law}.`,
      courts: (courts) => `Para cualquier controversia que derive de él, las partes se someten a los juzgados y tribunales de ${courts}.`,
      signature: 'Firma',
      signerName: 'Aclaración',
      signerId: 'Documento',
      signerRole: 'Cargo',
      placeAndDate: 'Lugar y fecha',
      initials: 'Iniciales'
    }
  }
  // i18n:es-end
}

/** Suggested file name for the PDF, in the language of the report. */
export function reportFileName(model: ReportModel): string {
  const text = REPORT_TEXT[model.options.language]
  return `${safeFileName(model.project.name, text.defaultFileName)} - ${text.fileWord} ${model.project.quoteDate}.pdf`
}
