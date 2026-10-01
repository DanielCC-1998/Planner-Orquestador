/** Texts of the task tree (rows, cells, menus, actions, bulk bar). */
export const en = {
  /** Accessible name of the tree. */
  label: 'Project tasks',
  columns: {
    wbs: 'WBS',
    task: 'Task',
    /** Narrow column (40 px): a short word for "Assignee". */
    assignee: 'Who',
    status: 'Status',
    storyPoints: 'SP',
    own: 'Own',
    sumHours: 'Σ Hours',
    sumCost: 'Σ Cost',
    progress: 'Progress'
  },
  /** Tooltips of the column headers. */
  columnTips: {
    storyPoints: 'Story points (sum of its branch, without double-counting shared subtasks)',
    own: 'Hours of the task’s OWN work, in addition to those of its subtasks. Double-click to edit.',
    sumHours:
      'Contribution of the branch to the total: each shared subtask counts only under its primary task (★), so the rows can be added up. “+X h 🔗” marks shared hours it also needs but that count in another branch.',
    sumCost: 'Cost of the contribution (hours × applicable rate)'
  },
  /** Pinned ancestors header: levels hidden above the ones shown. */
  levelsAbove: (n: number) => (n === 1 ? '… 1 level above' : `… ${n} levels above`),
  empty: {
    noMatches: 'No task matches the filter',
    noMatchesHint: 'Try other criteria or clear the filter.',
    noSubtasks: 'This task has no subtasks yet',
    emptyProject: 'Empty project',
    /** Followed by each key and what it does: "Enter new task, Tab turns it into a subtask…". */
    keyboardIntro: 'Create tasks and nest them without limit. With the keyboard:',
    enterKey: 'new task',
    tabKey: 'turns it into a subtask',
    ctrlEnterKey: 'adds a subtask',
    firstTask: 'First task'
  },
  row: {
    deepLevel: (level: number) => `Level ${level}: focus its parent task to see it closer`,
    collapse: 'Collapse',
    expand: 'Expand',
    titlePlaceholder: 'Task name',
    hasDescription: 'Has a description',
    sharedReference: (count: number, code: string) =>
      `Shared in ${count} tasks. Here it is a reference: its hours count in ${code}.`,
    sharedPrimary: (count: number) => `Shared in ${count} tasks. This is where it counts (★).`,
    /** Badge of a reference: the code of its primary appearance. */
    see: (code: string) => `see ${code}`,
    subtasks: (n: number) => (n === 1 ? '1 subtask' : `${n} subtasks`),
    moreActions: 'More actions',
    branchNeeds: (total: string, extra: string) =>
      `The whole branch needs ${total}: it includes ${extra} of shared subtasks that count in another task.`,
    invalidStoryPoints: 'Invalid story points'
  },
  /** Assignee picker of a row. */
  assignee: 'Assignee',
  addPeopleInTeam: 'Add people in “Team”',
  menu: {
    addSubtask: 'Add subtask',
    addBelow: 'Add task below',
    linkChild: 'Link existing subtask…',
    linkParent: 'Also share in another task…',
    copy: 'Copy to share',
    paste: 'Paste as shared subtask',
    move: 'Move to…',
    indent: 'Indent',
    outdent: 'Outdent',
    moveUp: 'Move up',
    moveDown: 'Move down',
    focus: 'Focus on this task',
    makePrimary: 'Count here (make primary)',
    duplicate: 'Duplicate',
    delete: 'Delete…',
    removeFromHere: 'Remove from here'
  },
  bulk: {
    selected: (n: number) => `${n} selected`,
    updated: (n: number) => (n === 1 ? '1 task updated' : `${n} tasks updated`),
    status: 'Status…',
    assignee: 'Assignee…',
    priority: 'Priority…',
    clearSelection: 'Clear selection'
  },
  /** Toasts and confirmations of the tree actions. */
  actions: {
    /** A task title quoted inside a sentence. */
    quoted: (title: string) => `“${title}”`,
    exitFocusToOutdent: (shortcut: string) => `Exit focus (${shortcut}) to move the task above the focused task`,
    duplicated: 'Task duplicated',
    copyFirst: (shortcut: string) => `Copy a task first with ${shortcut}`,
    linked: (child: string, parent: string) => `“${child}” is now also a subtask of “${parent}”`,
    copied: (title: string, shortcut: string) =>
      `Copied “${title}”. Select another task and press ${shortcut} to share it.`,
    nothingToFocus: (shortcut: string) => `This task has no subtasks: add one with ${shortcut}`,
    nowCountsUnder: (parent: string) => `Now counts under “${parent}”`,
    /** `elsewhere`: another parent that still has the task (code or quoted title); null if it is now at the root. */
    unlinked: (parent: string, elsewhere: string | null) =>
      elsewhere === null ? `Removed from “${parent}”; now at the root` : `Removed from “${parent}”; still in ${elsewhere}`,
    sharedTitle: (title: string) => `“${title}” is shared`,
    sharedDescription: (count: number, parent: string) =>
      `It appears in ${count} tasks. You can remove it only from “${parent}” or delete it everywhere.`,
    deleteEverywhere: 'Delete everywhere',
    deleteTitle: (title: string) => `Delete “${title}”?`,
    /** `removed`: tasks that will be deleted; `kept`: shared subtasks kept because they are still in other tasks. */
    deleteDescription: (removed: number, kept: number) =>
      (removed === 1 ? '1 task will be deleted.' : `${removed} tasks will be deleted (this one and its subtasks).`) +
      (kept === 0
        ? ''
        : kept === 1
          ? ' 1 shared subtask is kept because it is still in other tasks.'
          : ` ${kept} shared subtasks are kept because they are still in other tasks.`) +
      ' You can also delete only this task and move its subtasks up one level.',
    onlyThis: 'Only this one (move subtasks up)',
    deleteCount: (n: number) => `Delete ${n}`,
    deletedSpliced: 'Task deleted; its subtasks moved up one level',
    deleted: 'Deleted'
  }
}

// i18n:es-start
export const es: typeof en = {
  label: 'Tareas del proyecto',
  columns: {
    wbs: 'WBS',
    task: 'Tarea',
    assignee: 'Resp.',
    status: 'Estado',
    storyPoints: 'SP',
    own: 'Propio',
    sumHours: 'Σ Horas',
    sumCost: 'Σ Coste',
    progress: 'Progreso'
  },
  columnTips: {
    storyPoints: 'Puntos de historia (suma de su rama, sin duplicar compartidas)',
    own: 'Horas de trabajo PROPIO de la tarea, además de las de sus subtareas. Doble clic para editar.',
    sumHours:
      'Aportación de la rama al total: cada subtarea compartida cuenta solo bajo su tarea principal (★), así que las filas se pueden sumar. «+X h 🔗» indica horas compartidas que también necesita pero que cuentan en otra rama.',
    sumCost: 'Coste de la aportación (horas × tarifa aplicable)'
  },
  levelsAbove: (n) => (n === 1 ? '… 1 nivel más arriba' : `… ${n} niveles más arriba`),
  empty: {
    noMatches: 'Ninguna tarea coincide con el filtro',
    noMatchesHint: 'Prueba con otros criterios o limpia el filtro.',
    noSubtasks: 'Esta tarea aún no tiene subtareas',
    emptyProject: 'Proyecto vacío',
    keyboardIntro: 'Crea tareas y anídalas sin límite. Con el teclado:',
    enterKey: 'nueva tarea',
    tabKey: 'la convierte en subtarea',
    ctrlEnterKey: 'añade una subtarea',
    firstTask: 'Primera tarea'
  },
  row: {
    deepLevel: (level) => `Nivel ${level}: enfocar su tarea padre para verla más cerca`,
    collapse: 'Plegar',
    expand: 'Desplegar',
    titlePlaceholder: 'Nombre de la tarea',
    hasDescription: 'Tiene descripción',
    sharedReference: (count, code) =>
      `Compartida en ${count} tareas. Aquí es una referencia: sus horas cuentan en ${code}.`,
    sharedPrimary: (count) => `Compartida en ${count} tareas. Aquí es donde cuenta (★).`,
    see: (code) => `ver ${code}`,
    subtasks: (n) => (n === 1 ? '1 subtarea' : `${n} subtareas`),
    moreActions: 'Más acciones',
    branchNeeds: (total, extra) =>
      `La rama completa necesita ${total}: incluye ${extra} de subtareas compartidas que cuentan en otra tarea.`,
    invalidStoryPoints: 'Puntos de historia no válidos'
  },
  assignee: 'Responsable',
  addPeopleInTeam: 'Añade personas en «Equipo»',
  menu: {
    addSubtask: 'Añadir subtarea',
    addBelow: 'Añadir tarea debajo',
    linkChild: 'Vincular subtarea existente…',
    linkParent: 'Compartir también en otra tarea…',
    copy: 'Copiar para compartir',
    paste: 'Pegar como subtarea compartida',
    move: 'Mover a…',
    indent: 'Sangrar',
    outdent: 'Desangrar',
    moveUp: 'Subir',
    moveDown: 'Bajar',
    focus: 'Enfocar esta tarea',
    makePrimary: 'Contar aquí (hacer principal)',
    duplicate: 'Duplicar',
    delete: 'Eliminar…',
    removeFromHere: 'Quitar de aquí'
  },
  bulk: {
    selected: (n) => (n === 1 ? '1 seleccionada' : `${n} seleccionadas`),
    updated: (n) => (n === 1 ? '1 tarea actualizada' : `${n} tareas actualizadas`),
    status: 'Estado…',
    assignee: 'Responsable…',
    priority: 'Prioridad…',
    clearSelection: 'Quitar selección'
  },
  actions: {
    quoted: (title) => `«${title}»`,
    exitFocusToOutdent: (shortcut) => `Sal del enfoque (${shortcut}) para subir la tarea por encima de la tarea enfocada`,
    duplicated: 'Tarea duplicada',
    copyFirst: (shortcut) => `Copia antes una tarea con ${shortcut}`,
    linked: (child, parent) => `«${child}» ahora también es subtarea de «${parent}»`,
    copied: (title, shortcut) => `Copiada «${title}». Selecciona otra tarea y pulsa ${shortcut} para compartirla.`,
    nothingToFocus: (shortcut) => `Esta tarea no tiene subtareas: añade una con ${shortcut}`,
    nowCountsUnder: (parent) => `Ahora cuenta bajo «${parent}»`,
    unlinked: (parent, elsewhere) =>
      elsewhere === null ? `Quitada de «${parent}»; ahora está en la raíz` : `Quitada de «${parent}»; sigue en ${elsewhere}`,
    sharedTitle: (title) => `«${title}» es compartida`,
    sharedDescription: (count, parent) =>
      `Aparece en ${count} tareas. Puedes quitarla solo de «${parent}» o eliminarla en todas partes.`,
    deleteEverywhere: 'Eliminar en todas partes',
    deleteTitle: (title) => `¿Eliminar «${title}»?`,
    deleteDescription: (removed, kept) =>
      (removed === 1 ? 'Se eliminará 1 tarea.' : `Se eliminarán ${removed} tareas (ella y sus subtareas).`) +
      (kept === 0
        ? ''
        : kept === 1
          ? ' 1 compartida se conserva porque sigue en otras tareas.'
          : ` ${kept} compartidas se conservan porque siguen en otras tareas.`) +
      ' También puedes eliminar solo esta tarea y subir sus subtareas un nivel.',
    onlyThis: 'Solo esta (subir subtareas)',
    deleteCount: (n) => `Eliminar ${n}`,
    deletedSpliced: 'Tarea eliminada; sus subtareas han subido un nivel',
    deleted: 'Eliminado'
  }
}
// i18n:es-end
