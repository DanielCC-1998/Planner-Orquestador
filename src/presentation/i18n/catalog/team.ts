/** Texts of the team dialog. */
export const en = {
  title: 'Project team',
  /** Receives the names of the Enter key and of the “Add” and “Done” buttons. */
  description: (enter: string, add: string, done: string) =>
    `Who does each task, their hourly rate and their daily availability (for the estimated duration). The details of each person are saved when you leave the field. To add someone, type their name and press ${enter} or “${add}” (it is also saved when you press “${done}”).`,
  name: 'Name',
  role: 'Role',
  rate: 'Rate',
  ratePerHour: (symbol: string) => `${symbol}/hour`,
  hoursPerDay: 'Hours/day',
  empty: 'There is nobody on the team yet.',
  color: 'Color',
  required: 'Required',
  invalid: 'Invalid',
  removeMember: (name: string) => `Remove ${name}`,
  /** Confirmation strip of a removal; `tasks` is how many tasks the person has assigned. */
  removeConfirm: (name: string, tasks: number) =>
    tasks === 0
      ? `Remove **${name}**.`
      : tasks === 1
        ? `Remove **${name}** (has 1 task). Reassign it to:`
        : `Remove **${name}** (has ${tasks} tasks). Reassign them to:`,
  newName: 'First and last name',
  newRole: 'Role (optional)',
  newNameLabel: 'Name of the new person',
  newRoleLabel: 'Role of the new person',
  newRateLabel: 'Rate of the new person',
  newHoursLabel: 'Hours per day of the new person',
  addHint: (enter: string, add: string) => `Type the name and press ${enter} or “${add}”.`,
  nameMissing: 'Type the name of the person',
  invalidRate: 'Invalid rate',
  hoursRange: 'Hours per day between 0 and 24',
  added: (name: string) => `“${name}” has been added to the team`,
  importTitle: 'Import team from another project',
  chooseProject: 'Choose project…',
  ratesCopied: (currency: string) => `Rates are copied as they are, in the currency of this project (${currency}).`,
  importCount: (n: number) => `Import ${n}`,
  imported: (n: number) => (n === 1 ? '1 person imported' : `${n} people imported`)
}

// i18n:es-start
export const es: typeof en = {
  title: 'Equipo del proyecto',
  description: (enter, add, done) =>
    `Quién hace cada tarea, su tarifa por hora y su dedicación diaria (para la duración estimada). Los datos de cada persona se guardan al salir del campo. Para añadir a alguien, escribe su nombre y pulsa ${enter} o «${add}» (también se guarda al pulsar «${done}»).`,
  name: 'Nombre',
  role: 'Rol',
  rate: 'Tarifa',
  ratePerHour: (symbol) => `${symbol}/hora`,
  hoursPerDay: 'Horas/día',
  empty: 'Aún no hay nadie en el equipo.',
  color: 'Color',
  required: 'Obligatorio',
  invalid: 'No válido',
  removeMember: (name) => `Quitar a ${name}`,
  removeConfirm: (name, tasks) =>
    tasks === 0
      ? `Quitar a **${name}**.`
      : tasks === 1
        ? `Quitar a **${name}** (tiene 1 tarea). Reasignarla a:`
        : `Quitar a **${name}** (tiene ${tasks} tareas). Reasignarlas a:`,
  newName: 'Nombre y apellido',
  newRole: 'Rol (opcional)',
  newNameLabel: 'Nombre de la nueva persona',
  newRoleLabel: 'Rol de la nueva persona',
  newRateLabel: 'Tarifa de la nueva persona',
  newHoursLabel: 'Horas por día de la nueva persona',
  addHint: (enter, add) => `Escribe el nombre y pulsa ${enter} o «${add}».`,
  nameMissing: 'Escribe el nombre de la persona',
  invalidRate: 'Tarifa no válida',
  hoursRange: 'Horas por día entre 0 y 24',
  added: (name) => `«${name}» se ha añadido al equipo`,
  importTitle: 'Importar equipo de otro proyecto',
  chooseProject: 'Elegir proyecto…',
  ratesCopied: (currency) => `Las tarifas se copian tal cual, en la moneda de este proyecto (${currency}).`,
  importCount: (n) => `Importar ${n}`,
  imported: (n) => (n === 1 ? '1 persona importada' : `${n} personas importadas`)
}
// i18n:es-end
