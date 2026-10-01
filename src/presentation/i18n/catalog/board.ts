/** Texts of the Kanban board. */
export const en = {
  scope: {
    leaves: 'All leaf tasks',
    leavesTip: 'Tasks without subtasks (the actual work)',
    children: 'Direct subtasks',
    topLevel: 'Top level'
  },
  /** Line next to the scope switch: the focused branch (if any), the card count and a hint. */
  summary: (count: number, branchCode: string | null) =>
    `${branchCode === null ? '' : `Branch ${branchCode} · `}${count === 1 ? '1 task' : `${count} tasks`} · drag a card to change its status`,
  emptyTitle: 'No tasks to show',
  emptyHint: 'Create tasks in the tree or change the filter.',
  unestimated: 'unestimated',
  /** Unit after the story points of a card. */
  storyPointsUnit: 'SP',
  hasDescription: 'Has a description',
  sharedIn: (n: number) => `Shared in ${n} tasks`,
  showMore: (n: number) => `Show ${n} more`,
  dropHere: 'Drag here'
}

// i18n:es-start
export const es: typeof en = {
  scope: {
    leaves: 'Todas las tareas finales',
    leavesTip: 'Tareas sin subtareas (el trabajo real)',
    children: 'Hijas directas',
    topLevel: 'Primer nivel'
  },
  summary: (count, branchCode) =>
    `${branchCode === null ? '' : `Rama ${branchCode} · `}${count === 1 ? '1 tarea' : `${count} tareas`} · arrastra una tarjeta para cambiar su estado`,
  emptyTitle: 'No hay tareas que mostrar',
  emptyHint: 'Crea tareas en el árbol o cambia el filtro.',
  unestimated: 'sin estimar',
  storyPointsUnit: 'SP',
  hasDescription: 'Tiene descripción',
  sharedIn: (n) => `Compartida en ${n} tareas`,
  showMore: (n) => `Mostrar ${n} más`,
  dropHere: 'Arrastra aquí'
}
// i18n:es-end
