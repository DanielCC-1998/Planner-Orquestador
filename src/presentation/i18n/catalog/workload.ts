/** Texts of the workload view. */
export const en = {
  emptyTitle: 'No team or assigned hours',
  emptyHint:
    'Add people to the team with their daily capacity and assign them tasks to see the workload and the estimated duration.',
  manageTeam: 'Manage team',
  /** Heading of the duration card: the focused branch, or the whole project when null. */
  duration: (branchCode: string | null) =>
    branchCode === null ? 'Estimated project duration' : `Estimated duration of branch ${branchCode}`,
  explanation: (withContingency: boolean) =>
    `Each person works in parallel at their daily capacity; the duration is set by whoever needs the most days${withContingency ? ' (contingency included)' : ''}. It is an optimistic estimate: it does not take dependencies between tasks into account.`,
  unassignedBottleneck: 'Unassigned work takes the longest: assign it for a more realistic estimate.',
  estimatedEnd: (date: string) => `Estimated end: **${date}**`,
  setStartDate: 'Set start date',
  editTeam: 'Edit team',
  columns: {
    person: 'Person',
    capacity: 'Capacity',
    tasks: 'Tasks',
    hours: 'Hours',
    storyPoints: 'SP',
    cost: 'Cost',
    days: 'Days',
    load: 'Workload'
  },
  /** Tooltip of the "★ pace" badge on the person who needs the most days. */
  setsDuration: 'Sets the project duration',
  pace: 'pace',
  noRole: 'No role',
  /** Second line of the "Unassigned" row. */
  unassignedTasks: 'Tasks with hours and no assignee',
  hoursPerDay: (hours: string) => `${hours} h/day`,
  rowHint: 'Click a row to see its tasks in the tree.'
}

// i18n:es-start
export const es: typeof en = {
  emptyTitle: 'Sin equipo ni horas asignadas',
  emptyHint:
    'Añade personas al equipo con su capacidad diaria y asígnales tareas para ver la carga y la duración estimada.',
  manageTeam: 'Gestionar equipo',
  duration: (branchCode) =>
    branchCode === null ? 'Duración estimada del proyecto' : `Duración estimada de la rama ${branchCode}`,
  explanation: (withContingency) =>
    `Cada persona trabaja en paralelo a su capacidad diaria; la duración la marca quien más días necesita${withContingency ? ' (incluida la contingencia)' : ''}. Es una estimación optimista: no tiene en cuenta dependencias entre tareas.`,
  unassignedBottleneck: 'El trabajo sin asignar es el que más dura: asígnalo para una estimación más realista.',
  estimatedEnd: (date) => `Fin previsto: **${date}**`,
  setStartDate: 'Fijar fecha de inicio',
  editTeam: 'Editar equipo',
  columns: {
    person: 'Persona',
    capacity: 'Capacidad',
    tasks: 'Tareas',
    hours: 'Horas',
    storyPoints: 'SP',
    cost: 'Coste',
    days: 'Días',
    load: 'Carga'
  },
  setsDuration: 'Marca la duración del proyecto',
  pace: 'ritmo',
  noRole: 'Sin rol',
  unassignedTasks: 'Tareas con horas y sin responsable',
  hoursPerDay: (hours) => `${hours} h/día`,
  rowHint: 'Pulsa una fila para ver sus tareas en el árbol.'
}
// i18n:es-end
