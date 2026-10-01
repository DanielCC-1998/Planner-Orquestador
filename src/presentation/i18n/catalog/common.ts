/** Words shared by the whole interface. */
export const en = {
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  delete: 'Delete',
  remove: 'Remove',
  add: 'Add',
  done: 'Done',
  undo: 'Undo',
  redo: 'Redo',
  untitled: 'Untitled',
  noClient: 'No client',
  unassigned: 'Unassigned',
  readOnly: 'Read-only',
  /** Title of a duplicated task. */
  copyOf: (title: string) => `${title} (copy)`,
  /** Tax name when the project leaves it empty. */
  defaultTaxLabel: 'Tax',
  /** Key names shown in shortcuts and tooltips. */
  keys: { ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', del: 'Del', space: 'Space', enter: 'Enter', esc: 'Esc', tab: 'Tab' },
  theme: { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' },
  language: {
    label: 'Language',
    /** "System" option, with the language it resolves to in brackets. */
    system: (resolved: string) => `System (${resolved})`
  }
}

// i18n:es-start
export const es: typeof en = {
  save: 'Guardar',
  cancel: 'Cancelar',
  close: 'Cerrar',
  delete: 'Eliminar',
  remove: 'Quitar',
  add: 'Añadir',
  done: 'Hecho',
  undo: 'Deshacer',
  redo: 'Rehacer',
  untitled: 'Sin título',
  noClient: 'Sin cliente',
  unassigned: 'Sin asignar',
  readOnly: 'Solo lectura',
  copyOf: (title) => `${title} (copia)`,
  defaultTaxLabel: 'IVA',
  keys: { ctrl: 'Ctrl', shift: 'Mayús', alt: 'Alt', del: 'Supr', space: 'Espacio', enter: 'Enter', esc: 'Esc', tab: 'Tab' },
  theme: { label: 'Tema', light: 'Claro', dark: 'Oscuro', system: 'Sistema' },
  language: {
    label: 'Idioma',
    system: (resolved) => `Sistema (${resolved})`
  }
}
// i18n:es-end
