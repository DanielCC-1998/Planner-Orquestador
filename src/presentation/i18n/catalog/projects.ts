/** Texts of the projects screen (cards, new project dialog) and of the project notices. */
export const en = {
  title: 'Projects',
  archivedTitle: 'Archived projects',
  intro: 'Each card is a project: open it to plan tasks and subtasks without limits.',
  search: 'Search projects or clients',
  sortLabel: 'Sort',
  sort: { recent: 'Most recent', name: 'By name', cost: 'By cost' },
  showActive: 'Show active',
  showArchived: (count: number) => `Archived (${count})`,
  import: 'Import',
  newProject: 'New project',
  empty: {
    title: 'Create your first project',
    description:
      'Organize the work into tasks and subtasks, set assignees, hours and rates, and generate a PDF ready to present.'
  },
  noMatch: (query: string) => `No project matches “${query}”.`,
  card: {
    actions: 'Project actions',
    open: 'Open',
    duplicate: 'Duplicate',
    exportPdf: 'Export PDF…',
    exportJson: 'Export JSON…',
    archive: 'Archive',
    restore: 'Restore',
    delete: 'Delete…',
    tasks: 'Tasks',
    hours: 'Hours',
    cost: 'Cost',
    /** Story points badge; `points` is already formatted. */
    storyPoints: (points: string) => `${points} SP`,
    sharedTip: 'Subtasks shared by several tasks (counted once)',
    archived: 'Archived',
    progress: 'Progress'
  },
  trash: {
    title: (name: string) => `Delete “${name}”?`,
    description: 'The project is moved to the trash in the data folder (it is not deleted from disk).',
    confirm: 'Move to trash'
  },
  notices: {
    archived: 'Project archived',
    restored: 'Project restored',
    trashed: 'Project moved to trash',
    duplicated: (name: string) => `Project duplicated: ${name}`,
    imported: (name: string) => `Project imported: ${name}`,
    exportedJson: 'Project exported as JSON',
    readOnly: 'Project from a newer version: it opens in read-only mode'
  },
  create: {
    title: 'New project',
    description: 'You can change all of this later in the project settings.',
    submit: 'Create project',
    name: 'Project name',
    namePlaceholder: 'e.g. Online store',
    client: 'Client',
    clientPlaceholder: 'Optional',
    currency: 'Currency',
    currencyHint: 'One currency per project',
    /** Label of the default rate field, with the currency symbol. */
    defaultRate: (symbol: string) => `Default rate (${symbol}/h)`,
    defaultRateHint: 'Used when the task or the person has no rate',
    ratePlaceholder: 'e.g. 45',
    invalidAmount: 'Invalid amount',
    color: 'Color',
    /** Accessible name of a color swatch. */
    colorOption: (color: string) => `Color ${color}`
  }
}

// i18n:es-start
export const es: typeof en = {
  title: 'Proyectos',
  archivedTitle: 'Proyectos archivados',
  intro: 'Cada tarjeta es un proyecto: ábrelo para planificar tareas y subtareas sin límite.',
  search: 'Buscar proyecto o cliente',
  sortLabel: 'Ordenar',
  sort: { recent: 'Más recientes', name: 'Por nombre', cost: 'Por coste' },
  showActive: 'Ver activos',
  showArchived: (count) => `Archivados (${count})`,
  import: 'Importar',
  newProject: 'Nuevo proyecto',
  empty: {
    title: 'Crea tu primer proyecto',
    description:
      'Organiza el trabajo en tareas y subtareas, asigna responsables, horas y tarifas, y genera un PDF listo para presentar.'
  },
  noMatch: (query) => `Ningún proyecto coincide con «${query}».`,
  card: {
    actions: 'Acciones del proyecto',
    open: 'Abrir',
    duplicate: 'Duplicar',
    exportPdf: 'Exportar PDF…',
    exportJson: 'Exportar JSON…',
    archive: 'Archivar',
    restore: 'Restaurar',
    delete: 'Eliminar…',
    tasks: 'Tareas',
    hours: 'Horas',
    cost: 'Coste',
    storyPoints: (points) => `${points} SP`,
    sharedTip: 'Subtareas compartidas entre varias tareas (se cuentan una vez)',
    archived: 'Archivado',
    progress: 'Progreso'
  },
  trash: {
    title: (name) => `¿Eliminar «${name}»?`,
    description: 'El proyecto se mueve a la papelera de la carpeta de datos (no se borra del disco).',
    confirm: 'Mover a la papelera'
  },
  notices: {
    archived: 'Proyecto archivado',
    restored: 'Proyecto restaurado',
    trashed: 'Proyecto movido a la papelera',
    duplicated: (name) => `Proyecto duplicado: ${name}`,
    imported: (name) => `Proyecto importado: ${name}`,
    exportedJson: 'Proyecto exportado como JSON',
    readOnly: 'Proyecto de una versión más nueva: se abre en solo lectura'
  },
  create: {
    title: 'Nuevo proyecto',
    description: 'Podrás cambiar todo esto más tarde en los ajustes del proyecto.',
    submit: 'Crear proyecto',
    name: 'Nombre del proyecto',
    namePlaceholder: 'Ej.: Tienda online',
    client: 'Cliente',
    clientPlaceholder: 'Opcional',
    currency: 'Moneda',
    currencyHint: 'Una sola moneda por proyecto',
    defaultRate: (symbol) => `Tarifa por defecto (${symbol}/h)`,
    defaultRateHint: 'Se usa si la tarea o la persona no tienen tarifa',
    ratePlaceholder: 'Ej.: 45',
    invalidAmount: 'Importe no válido',
    color: 'Color',
    colorOption: (color) => `Color ${color}`
  }
}
// i18n:es-end
