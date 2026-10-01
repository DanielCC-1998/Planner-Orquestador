/** Texts of the summary bar at the bottom of a project. Amounts, hours and dates arrive formatted. */
export const en = {
  project: 'Project',
  /** Scope when a task is focused; `code` is its WBS code. */
  branch: (code: string) => `Branch ${code}`,
  hours: 'Hours',
  hoursTip: (estimated: string, contingency: string, percent: string) =>
    `${estimated} estimated + ${contingency} contingency (${percent})`,
  includesContingency: '(incl. cont.)',
  storyPoints: 'SP',
  cost: 'Cost',
  /** Label of the total when the project has tax; `taxLabel` is the project tax name (e.g. VAT). */
  totalWithTax: (taxLabel: string) => `Total incl. ${taxLabel}`,
  work: (amount: string) => `Work: ${amount}`,
  contingency: (percent: string, amount: string) => `Contingency (${percent}): ${amount}`,
  tax: (taxLabel: string, percent: string, amount: string) => `${taxLabel} (${percent}): ${amount}`,
  total: (amount: string) => `Total: ${amount}`,
  duration: 'Duration',
  /** `pace` is whoever sets the duration: a person, or `unassignedWork`. */
  durationTip: (pace: string) => `Optimistic estimate in parallel, without dependencies. Sets the pace: ${pace}.`,
  unassignedWork: 'unassigned work',
  noDuration: 'Add hours to estimate the duration',
  endDate: (date: string) => `ends ${date}`,
  progress: 'Progress',
  savings: (hours: string) => `−${hours} not double-counted`,
  savingsTip: (hours: string, amount: string) =>
    `Shared subtasks counted only once: adding up every appearance would have added an extra ${hours} and ${amount}.`,
  clickToFilter: 'Click to filter',
  unestimated: (count: number) => `${count} unestimated`,
  unpriced: (count: number) => `${count} with no rate`,
  unassigned: (count: number) => `${count} unassigned`
}

// i18n:es-start
export const es: typeof en = {
  project: 'Proyecto',
  branch: (code) => `Rama ${code}`,
  hours: 'Horas',
  hoursTip: (estimated, contingency, percent) => `${estimated} estimadas + ${contingency} de contingencia (${percent})`,
  includesContingency: '(incl. cont.)',
  storyPoints: 'SP',
  cost: 'Coste',
  totalWithTax: (taxLabel) => `Total con ${taxLabel}`,
  work: (amount) => `Trabajo: ${amount}`,
  contingency: (percent, amount) => `Contingencia (${percent}): ${amount}`,
  tax: (taxLabel, percent, amount) => `${taxLabel} (${percent}): ${amount}`,
  total: (amount) => `Total: ${amount}`,
  duration: 'Duración',
  durationTip: (pace) => `Estimación optimista en paralelo, sin dependencias. Marca el ritmo: ${pace}.`,
  unassignedWork: 'trabajo sin asignar',
  noDuration: 'Añade horas para estimar la duración',
  endDate: (date) => `fin ${date}`,
  progress: 'Progreso',
  savings: (hours) => `−${hours} no duplicadas`,
  savingsTip: (hours, amount) =>
    `Subtareas compartidas contadas una sola vez: sumar cada aparición habría añadido ${hours} y ${amount} de más.`,
  clickToFilter: 'Pulsa para filtrar',
  unestimated: (count) => `${count} sin estimar`,
  unpriced: (count) => `${count} sin tarifa`,
  unassigned: (count) => `${count} sin asignar`
}
// i18n:es-end
