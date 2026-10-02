import type { ContractParty, SprintUnit } from '@domain'

/** Texts of the project settings dialog. */
export const en = {
  title: 'Project settings',
  saved: 'Project settings saved',
  checkFields: 'Check the highlighted fields',
  tabs: { general: 'General', planning: 'Planning and costs', points: 'Story points', sprints: 'Sprints', quote: 'Quote (PDF)', contract: 'Contract' },
  /** Sprint length; the PDF groups the status changes of the tasks by sprint. */
  sprints: {
    intro:
      'Sprints split the project into periods of the same length. When the PDF includes the status of the tasks, it shows sprint by sprint which tasks changed status.',
    enabled: 'This project works in sprints',
    length: 'Length of each sprint',
    unit: 'Unit',
    units: { day: 'days', week: 'weeks', month: 'months' } satisfies Record<SprintUnit, string>,
    invalidLength: (max: number) => `A whole number from 1 to ${max}`,
    startsOnStart: (date: string) => `Sprint 1 starts on ${date}, the start date of the project (Planning and costs tab).`,
    startsOnCreation: (date: string) =>
      `Sprint 1 starts on ${date}, the day the project was created. Set a start date in the Planning and costs tab to change it.`,
    current: (n: number, range: string) => `Current sprint: Sprint ${n} · ${range}`,
    notStarted: (date: string) => `The first sprint starts on ${date}.`,
    offHint: 'Without sprints, the PDF shows the status of the tasks without dividing their changes by period.',
    historyHint:
      'Every status change of a task is recorded with its date and time. Changing the length of the sprints regroups the changes already recorded.'
  },
  /** Story points → hours scale. */
  points: {
    intro:
      'Tasks with story points and no hours typed by hand take their hours from this scale. Changing it updates all of them.',
    pointsColumn: 'Story points',
    hoursColumn: 'Hours',
    /** `points` is already formatted. */
    points: (points: string) => (points === '1' ? '1 point' : `${points} points`),
    hoursFor: (points: string) => (points === '1' ? 'Hours for 1 story point' : `Hours for ${points} story points`),
    basePlaceholder: 'e.g. 2h',
    baseHint: 'Base of the scale',
    byRule: 'Rule of three',
    useRule: 'Use the rule of three',
    otherValues: 'Any other value follows the rule of three: points × the hours of 1 point.',
    offHint: 'Leave 1 point empty to turn the scale off: hours then only come from what you type in each task.',
    mustBePositive: 'One point must be worth more than 0'
  },
  name: 'Name',
  nameRequired: 'The name is required',
  client: 'Client',
  description: 'Description / scope',
  descriptionHint: 'Appears in the PDF summary',
  currency: 'Currency',
  currencyHint: 'A single currency for the whole project',
  currencyWarning: (currency: string) =>
    `Changing the currency does not convert the amounts: rates are reinterpreted in ${currency}.`,
  color: 'Color',
  colorOption: (color: string) => `Color ${color}`,
  archived: 'Archived project (hidden from the main list)',
  defaultRate: (symbol: string) => `Default rate (${symbol}/h)`,
  defaultRateHint: 'When neither the task nor the person has a rate',
  noRate: 'No rate',
  invalidAmount: 'Invalid amount',
  hoursPerDay: 'Working hours per day',
  hoursPerDayHint: 'For “2d” and for unassigned work',
  hoursPerDayRange: 'Between 0 and 24',
  startDate: 'Start date',
  startDateHint: 'To calculate the estimated end date',
  workingDays: 'Working days',
  noWorkingDays: 'Choose at least one day',
  /** Working day chips: `short` is the chip text, `long` its tooltip and accessible name. */
  weekdays: {
    mon: { short: 'Mo', long: 'Monday' },
    tue: { short: 'Tu', long: 'Tuesday' },
    wed: { short: 'We', long: 'Wednesday' },
    thu: { short: 'Th', long: 'Thursday' },
    fri: { short: 'Fr', long: 'Friday' },
    sat: { short: 'Sa', long: 'Saturday' },
    sun: { short: 'Su', long: 'Sunday' }
  },
  contingency: 'Contingency (%)',
  contingencyHint: 'Risk margin on hours, cost and duration',
  tax: 'Tax (%)',
  taxHint: 'Applied on top of the cost',
  taxName: 'Name',
  invalidPercent: 'Invalid percentage',
  quoteNumber: 'Quote no.',
  quoteNumberPlaceholder: 'Q-2026-001',
  quoteDate: 'Date',
  quoteDateHint: 'Empty = export date',
  validity: 'Valid for (days)',
  validityError: 'Number of days',
  contract: {
    title: 'Client in the contract',
    hint: 'For the signatures page of the PDF. Whatever you leave empty is printed as a line to fill in by hand.',
    fields: {
      legalName: 'Company or full name',
      taxId: 'Tax ID',
      address: 'Address',
      email: 'Email',
      signerName: 'Signs for the client',
      signerId: 'Their ID document',
      signerRole: 'Their position'
    } satisfies Record<keyof ContractParty, string>,
    model: 'Contract model',
    defaultModel: (name: string | null) => (name ? `Default (${name})` : 'Default (none yet)'),
    modelHint: 'General terms, governing law and courts. The models are written in Settings → Contracts.',
    law: 'Law',
    courts: 'Courts',
    noLaw: 'No governing law or courts',
    noModel: 'No contract model: the PDF only has the particular terms.',
    missingModel: 'The model this project chose no longer exists: it uses the default one.',
    insert: 'Insert saved text',
    noTexts: 'No saved texts yet',
    saveToLibrary: 'Save to the library',
    saveWhole: 'All of it as one text',
    saveClauses: 'Clause by clause',
    wholeName: (project: string) => `Particular terms of “${project}”`,
    saved: (count: number) => (count === 1 ? '1 text saved to the library' : `${count} texts saved to the library`),
    nothingNew: 'They were all in the library already',
    libraryFull: 'The library is full: delete some saved texts in Settings → Contracts'
  },
  terms: 'Particular terms',
  termsHint:
    'The terms of this project: payment, exclusions, warranties… The general ones come from its contract model; if they contradict each other, these prevail.'
}

// i18n:es-start
export const es: typeof en = {
  title: 'Ajustes del proyecto',
  saved: 'Ajustes del proyecto guardados',
  checkFields: 'Revisa los campos marcados',
  tabs: { general: 'General', planning: 'Planificación y costes', points: 'Puntos de historia', sprints: 'Sprints', quote: 'Presupuesto (PDF)', contract: 'Contrato' },
  sprints: {
    intro:
      'Los sprints dividen el proyecto en periodos de la misma duración. Cuando el PDF incluye el estado de las tareas, muestra sprint a sprint qué tareas cambiaron de estado.',
    enabled: 'Este proyecto trabaja por sprints',
    length: 'Duración de cada sprint',
    unit: 'Unidad',
    units: { day: 'días', week: 'semanas', month: 'meses' },
    invalidLength: (max) => `Un número entero de 1 a ${max}`,
    startsOnStart: (date) => `El sprint 1 empieza el ${date}, la fecha de inicio del proyecto (pestaña Planificación y costes).`,
    startsOnCreation: (date) =>
      `El sprint 1 empieza el ${date}, el día en que se creó el proyecto. Pon una fecha de inicio en la pestaña Planificación y costes para cambiarlo.`,
    current: (n, range) => `Sprint actual: sprint ${n} · ${range}`,
    notStarted: (date) => `El primer sprint empieza el ${date}.`,
    offHint: 'Sin sprints, el PDF muestra el estado de las tareas sin dividir sus cambios por periodos.',
    historyHint:
      'Cada cambio de estado de una tarea se guarda con su fecha y hora. Si cambias la duración de los sprints, los cambios ya guardados se reagrupan.'
  },
  points: {
    intro:
      'Las tareas con puntos de historia y sin horas escritas a mano toman sus horas de esta escala. Si la cambias, se actualizan todas.',
    pointsColumn: 'Puntos',
    hoursColumn: 'Horas',
    points: (points) => (points === '1' ? '1 punto' : `${points} puntos`),
    hoursFor: (points) => (points === '1' ? 'Horas para 1 punto de historia' : `Horas para ${points} puntos de historia`),
    basePlaceholder: 'p. ej. 2h',
    baseHint: 'Base de la escala',
    byRule: 'Regla de tres',
    useRule: 'Usar la regla de tres',
    otherValues: 'Cualquier otro valor sigue la regla de tres: puntos × las horas de 1 punto.',
    offHint: 'Deja vacío 1 punto para desactivar la escala: entonces las horas solo salen de lo que escribas en cada tarea.',
    mustBePositive: 'Un punto tiene que valer más de 0'
  },
  name: 'Nombre',
  nameRequired: 'El nombre es obligatorio',
  client: 'Cliente',
  description: 'Descripción / alcance',
  descriptionHint: 'Aparece en el resumen del PDF',
  currency: 'Moneda',
  currencyHint: 'Una sola moneda para todo el proyecto',
  currencyWarning: (currency) => `Cambiar la moneda no convierte los importes: las tarifas se reinterpretan en ${currency}.`,
  color: 'Color',
  colorOption: (color) => `Color ${color}`,
  archived: 'Proyecto archivado (se oculta de la lista principal)',
  defaultRate: (symbol) => `Tarifa por defecto (${symbol}/h)`,
  defaultRateHint: 'Si la tarea y la persona no tienen tarifa',
  noRate: 'Sin tarifa',
  invalidAmount: 'Importe no válido',
  hoursPerDay: 'Horas de trabajo por día',
  hoursPerDayHint: 'Para «2d» y para el trabajo sin asignar',
  hoursPerDayRange: 'Entre 0 y 24',
  startDate: 'Fecha de inicio',
  startDateHint: 'Para calcular la fecha de fin estimada',
  workingDays: 'Días laborables',
  noWorkingDays: 'Elige al menos un día',
  weekdays: {
    mon: { short: 'L', long: 'Lunes' },
    tue: { short: 'M', long: 'Martes' },
    wed: { short: 'X', long: 'Miércoles' },
    thu: { short: 'J', long: 'Jueves' },
    fri: { short: 'V', long: 'Viernes' },
    sat: { short: 'S', long: 'Sábado' },
    sun: { short: 'D', long: 'Domingo' }
  },
  contingency: 'Contingencia (%)',
  contingencyHint: 'Margen de riesgo sobre horas, coste y duración',
  tax: 'Impuesto (%)',
  taxHint: 'Se aplica sobre el coste',
  taxName: 'Nombre',
  invalidPercent: 'Porcentaje no válido',
  quoteNumber: 'Nº de oferta',
  quoteNumberPlaceholder: 'P-2026-001',
  quoteDate: 'Fecha',
  quoteDateHint: 'Vacía = fecha de exportación',
  validity: 'Validez (días)',
  validityError: 'Número de días',
  contract: {
    title: 'Cliente en el contrato',
    hint: 'Para la página de firmas del PDF. Lo que dejes vacío sale como una línea para rellenar a mano.',
    fields: {
      legalName: 'Razón social o nombre completo',
      taxId: 'Identificación fiscal',
      address: 'Domicilio',
      email: 'Correo',
      signerName: 'Firma por el cliente',
      signerId: 'Su documento',
      signerRole: 'Su cargo'
    },
    model: 'Modelo de contrato',
    defaultModel: (name) => (name ? `Predeterminado (${name})` : 'Predeterminado (aún no hay)'),
    modelHint: 'Condiciones generales, ley aplicable y tribunales. Los modelos se escriben en Ajustes → Contratos.',
    law: 'Ley',
    courts: 'Tribunales',
    noLaw: 'Sin ley aplicable ni tribunales',
    noModel: 'Sin modelo de contrato: el PDF solo lleva las condiciones particulares.',
    missingModel: 'El modelo que eligió este proyecto ya no existe: usa el predeterminado.',
    insert: 'Insertar texto guardado',
    noTexts: 'Aún no hay textos guardados',
    saveToLibrary: 'Guardar en la biblioteca',
    saveWhole: 'Todo como un texto',
    saveClauses: 'Cláusula a cláusula',
    wholeName: (project) => `Condiciones particulares de «${project}»`,
    saved: (count) => (count === 1 ? '1 texto guardado en la biblioteca' : `${count} textos guardados en la biblioteca`),
    nothingNew: 'Ya estaban todos en la biblioteca',
    libraryFull: 'La biblioteca está llena: borra algunos textos guardados en Ajustes → Contratos'
  },
  terms: 'Condiciones particulares',
  termsHint:
    'Las de este proyecto: forma de pago, exclusiones, garantías… Las generales vienen de su modelo de contrato; si se contradicen, prevalecen estas.'
}
// i18n:es-end
