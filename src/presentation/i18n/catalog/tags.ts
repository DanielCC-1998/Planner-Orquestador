import type { TagColor } from '@domain'

/** Texts of the project tags: the picker of a task, the tags dialog and the bulk bar (US English). */
export const en = {
  /** Button that opens the picker of a task. */
  add: 'Tag',
  searchPlaceholder: 'Find or create a tag…',
  create: (name: string) => `Create “${name}”`,
  noTags: 'This project has no tags yet. Type a name to create the first one.',
  noMatches: 'No tag matches.',
  manage: 'Manage tags…',
  remove: (name: string) => `Remove the tag ${name}`,
  /** Header button and dialog. */
  button: 'Tags',
  title: 'Project tags',
  description:
    'Create each tag once and pick it for any task. Renaming it or changing its color changes it on every task at once.',
  empty: 'This project has no tags yet.',
  newPlaceholder: 'Name of the new tag',
  createButton: 'Create',
  /** Accessible names of the controls of each row. */
  renameLabel: (name: string) => `Name of the tag ${name}`,
  colorOf: (name: string, color: string) => `Color of the tag ${name}: ${color}`,
  newColor: (color: string) => `Color of the new tag: ${color}`,
  usage: (n: number) => (n === 0 ? 'Not used' : n === 1 ? '1 task' : `${n} tasks`),
  deleteTag: (name: string) => `Delete the tag ${name}`,
  deleteConfirm: (name: string, tasks: number) =>
    tasks === 0
      ? `Delete **${name}**.`
      : tasks === 1
        ? `Delete **${name}**. It will be removed from 1 task.`
        : `Delete **${name}**. It will be removed from ${tasks} tasks.`,
  created: (name: string) => `Tag “${name}” created`,
  /** Bulk bar. */
  bulk: 'Tags',
  bulkAdded: (name: string, n: number) => (n === 1 ? `“${name}” added to 1 task` : `“${name}” added to ${n} tasks`),
  bulkRemoved: (name: string, n: number) => (n === 1 ? `“${name}” removed from 1 task` : `“${name}” removed from ${n} tasks`),
  colors: {
    red: 'Red',
    orange: 'Orange',
    amber: 'Amber',
    lime: 'Lime',
    green: 'Green',
    teal: 'Teal',
    cyan: 'Cyan',
    blue: 'Blue',
    indigo: 'Indigo',
    violet: 'Violet',
    fuchsia: 'Fuchsia',
    pink: 'Pink'
  } satisfies Record<TagColor, string>
}

// i18n:es-start
export const es: typeof en = {
  add: 'Etiqueta',
  searchPlaceholder: 'Buscar o crear una etiqueta…',
  create: (name) => `Crear «${name}»`,
  noTags: 'Este proyecto aún no tiene etiquetas. Escribe un nombre para crear la primera.',
  noMatches: 'Ninguna etiqueta coincide.',
  manage: 'Gestionar etiquetas…',
  remove: (name) => `Quitar la etiqueta ${name}`,
  button: 'Etiquetas',
  title: 'Etiquetas del proyecto',
  description:
    'Crea cada etiqueta una vez y elígela en cualquier tarea. Si le cambias el nombre o el color, cambia a la vez en todas sus tareas.',
  empty: 'Este proyecto aún no tiene etiquetas.',
  newPlaceholder: 'Nombre de la nueva etiqueta',
  createButton: 'Crear',
  renameLabel: (name) => `Nombre de la etiqueta ${name}`,
  colorOf: (name, color) => `Color de la etiqueta ${name}: ${color}`,
  newColor: (color) => `Color de la nueva etiqueta: ${color}`,
  usage: (n) => (n === 0 ? 'Sin usar' : n === 1 ? '1 tarea' : `${n} tareas`),
  deleteTag: (name) => `Eliminar la etiqueta ${name}`,
  deleteConfirm: (name, tasks) =>
    tasks === 0
      ? `Eliminar **${name}**.`
      : tasks === 1
        ? `Eliminar **${name}**. Se quitará de 1 tarea.`
        : `Eliminar **${name}**. Se quitará de ${tasks} tareas.`,
  created: (name) => `Etiqueta «${name}» creada`,
  bulk: 'Etiquetas',
  bulkAdded: (name, n) => (n === 1 ? `«${name}» añadida a 1 tarea` : `«${name}» añadida a ${n} tareas`),
  bulkRemoved: (name, n) => (n === 1 ? `«${name}» quitada de 1 tarea` : `«${name}» quitada de ${n} tareas`),
  colors: {
    red: 'Rojo',
    orange: 'Naranja',
    amber: 'Ámbar',
    lime: 'Lima',
    green: 'Verde',
    teal: 'Verde azulado',
    cyan: 'Cian',
    blue: 'Azul',
    indigo: 'Índigo',
    violet: 'Violeta',
    fuchsia: 'Fucsia',
    pink: 'Rosa'
  }
}
// i18n:es-end
