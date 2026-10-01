/** Texts of the task dialogs (go to task, pick a task). */
export const en = {
  picker: {
    placeholder: 'Search by name or code…',
    noResults: 'No results',
    limited: (n: number) => `Showing ${n} results: refine your search.`
  },
  /** Why a task cannot be picked (shown next to it, greyed out). */
  reasons: {
    sameTask: 'same task',
    alreadyChild: 'already a subtask',
    cycle: 'would create a cycle',
    alreadyParent: 'already contains it',
    alreadyHere: 'already here',
    shared: 'is shared'
  },
  linkChild: {
    title: (parent: string) => `Link an existing subtask to “${parent}”`,
    description:
      'The chosen task stays where it is and also appears here as a shared subtask (it is counted only once in the totals).',
    done: (child: string, parent: string) => `“${child}” is now also a subtask of “${parent}”. Its hours are counted only once.`
  },
  linkParent: {
    title: (child: string) => `Share “${child}” in another task`,
    description: 'Choose the task that also needs this subtask. Its hours and cost are still counted only once.',
    done: (child: string, parent: string) => `“${child}” is now also under “${parent}”`
  },
  move: {
    title: (task: string) => `Move “${task}”`,
    description: 'It moves together with all its subtasks.',
    root: 'Project root',
    rootPath: 'Top level',
    done: (parent: string) => `Moved to “${parent}”`,
    doneRoot: 'Moved to the root'
  },
  palette: {
    title: 'Go to task',
    description: 'Search by name, path or WBS code (e.g. 2.3).'
  }
}

// i18n:es-start
export const es: typeof en = {
  picker: {
    placeholder: 'Buscar por nombre o código…',
    noResults: 'Sin resultados',
    limited: (n) => `Mostrando ${n} resultados: afina la búsqueda.`
  },
  reasons: {
    sameTask: 'es la misma tarea',
    alreadyChild: 'ya es subtarea',
    cycle: 'crearía un ciclo',
    alreadyParent: 'ya la contiene',
    alreadyHere: 'ya está aquí',
    shared: 'es compartida'
  },
  linkChild: {
    title: (parent) => `Vincular subtarea existente a «${parent}»`,
    description:
      'La tarea elegida seguirá donde está y además aparecerá aquí como subtarea compartida (se cuenta una sola vez en los totales).',
    done: (child, parent) => `«${child}» ahora también es subtarea de «${parent}». Sus horas se cuentan una sola vez.`
  },
  linkParent: {
    title: (child) => `Compartir «${child}» en otra tarea`,
    description: 'Elige la tarea que también necesita esta subtarea. Sus horas y coste se siguen contando una sola vez.',
    done: (child, parent) => `«${child}» ahora también cuelga de «${parent}»`
  },
  move: {
    title: (task) => `Mover «${task}»`,
    description: 'Se mueve junto con todas sus subtareas.',
    root: 'Raíz del proyecto',
    rootPath: 'Primer nivel',
    done: (parent) => `Movida a «${parent}»`,
    doneRoot: 'Movida a la raíz'
  },
  palette: {
    title: 'Ir a tarea',
    description: 'Busca por nombre, ruta o código WBS (p. ej. 2.3).'
  }
}
// i18n:es-end
