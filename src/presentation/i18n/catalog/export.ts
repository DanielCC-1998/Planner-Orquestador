/** Texts of the PDF export dialog. */
export const en = {
  title: 'Export quote as PDF',
  description: 'Choose what to include. For an internal version, turn on rates and statuses; for the client, leave them out.',
  language: 'PDF language',
  sectionsTitle: 'Sections',
  sections: {
    cover: 'Cover',
    summary: 'Summary and budget',
    breakdown: 'Task breakdown (WBS)',
    workload: 'Team and workload',
    shared: 'Shared subtasks appendix',
    terms: 'Terms (particular and general)',
    signatures: 'Acceptance and signatures'
  },
  termsModel: (name: string) => `General terms: contract model “${name}”`,
  termsNoModel: 'No contract model: only the particular terms',
  signaturesHint: 'The parties, what they accept and room for both signatures: the quote becomes a contract',
  initials: 'Boxes for the initials of both parties on every page',
  noQuoteNumber: 'This quote has no number yet: give it one in the project settings (Quote tab) to identify the contract.',
  columnsTitle: 'Columns and data',
  columns: {
    hours: 'Hours',
    cost: 'Amounts',
    rate: 'Hourly rate',
    storyPoints: 'Story points',
    assignee: 'Assignee',
    status: 'Status',
    tags: 'Tags'
  },
  columnHints: {
    status: 'Also adds the “Task status” section, with the progress by sprint',
    tags: 'Colored chips next to each task'
  },
  depth: 'Breakdown depth',
  depthHint: 'Deeper levels are added up into their task',
  allLevels: 'All levels',
  upToLevel: (level: number) => `Up to level ${level}`,
  subtotals: 'Subtotals',
  subtotalsHint: 'Subtotal rows after each task with subtasks',
  noSubtotals: 'No subtotals',
  firstLevelOnly: 'First level only',
  everyLevel: 'At every level',
  paper: 'Paper',
  letter: 'Letter',
  orientation: 'Orientation',
  portrait: 'Portrait',
  landscape: 'Landscape',
  descriptionsTitle: 'Task descriptions',
  descriptions: {
    none: 'Do not include',
    inline: 'Under each task in the breakdown',
    section: 'In a separate “Task details” section'
  },
  /** How many tasks of the project have a description. */
  described: (n: number) =>
    n === 0
      ? 'No task has a description yet (descriptions are written in the detail panel of each task).'
      : n === 1
        ? '1 task has a description.'
        : `${n} tasks have a description.`,
  openAfterExport: 'Open the PDF when finished',
  generating: 'Generating…',
  savePdf: 'Save PDF…',
  saved: (path: string) => `PDF saved: ${path}`
}

// i18n:es-start
export const es: typeof en = {
  title: 'Exportar presupuesto en PDF',
  description: 'Elige qué incluir. Para una versión interna activa tarifas y estados; para el cliente, déjalos fuera.',
  language: 'Idioma del PDF',
  sectionsTitle: 'Secciones',
  sections: {
    cover: 'Portada',
    summary: 'Resumen y presupuesto',
    breakdown: 'Desglose de tareas (WBS)',
    workload: 'Equipo y carga',
    shared: 'Anexo de subtareas compartidas',
    terms: 'Condiciones (particulares y generales)',
    signatures: 'Aceptación y firmas'
  },
  termsModel: (name) => `Condiciones generales: modelo de contrato «${name}»`,
  termsNoModel: 'Sin modelo de contrato: solo las condiciones particulares',
  signaturesHint: 'Las partes, lo que aceptan y el espacio para las dos firmas: el presupuesto se convierte en contrato',
  initials: 'Casillas para las iniciales de ambas partes en cada página',
  noQuoteNumber: 'Este presupuesto aún no tiene número: ponle uno en Ajustes del proyecto (pestaña Presupuesto) para identificar el contrato.',
  columnsTitle: 'Columnas y datos',
  columns: {
    hours: 'Horas',
    cost: 'Importes',
    rate: 'Tarifa por hora',
    storyPoints: 'Puntos de historia',
    assignee: 'Responsable',
    status: 'Estado',
    tags: 'Etiquetas'
  },
  columnHints: {
    status: 'Añade también la sección «Estado de las tareas», con el progreso por sprint',
    tags: 'Chips de color junto a cada tarea'
  },
  depth: 'Profundidad del desglose',
  depthHint: 'Los niveles más profundos se suman en su tarea',
  allLevels: 'Todos los niveles',
  upToLevel: (level) => `Hasta el nivel ${level}`,
  subtotals: 'Subtotales',
  subtotalsHint: 'Filas de subtotal tras cada tarea con subtareas',
  noSubtotals: 'Sin subtotales',
  firstLevelOnly: 'Solo primer nivel',
  everyLevel: 'En todos los niveles',
  paper: 'Papel',
  letter: 'Carta (Letter)',
  orientation: 'Orientación',
  portrait: 'Vertical',
  landscape: 'Horizontal',
  descriptionsTitle: 'Descripciones de las tareas',
  descriptions: {
    none: 'No incluir',
    inline: 'Debajo de cada tarea en el desglose',
    section: 'En una sección aparte «Detalle de las tareas»'
  },
  described: (n) =>
    n === 0
      ? 'Ninguna tarea tiene descripción todavía (se escribe en el panel de detalle de cada tarea).'
      : n === 1
        ? '1 tarea tiene descripción.'
        : `${n} tareas tienen descripción.`,
  openAfterExport: 'Abrir el PDF al terminar',
  generating: 'Generando…',
  savePdf: 'Guardar PDF…',
  saved: (path) => `PDF guardado: ${path}`
}
// i18n:es-end
