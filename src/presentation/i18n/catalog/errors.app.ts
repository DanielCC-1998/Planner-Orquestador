import type { AppErrorReason } from '@application'
import type { ErrorText } from '../types'

/** Texts of the application error reasons. */
export const en: Readonly<Record<AppErrorReason, ErrorText>> = {
  PROJECT_NOT_FOUND: 'The project does not exist',
  READ_ONLY: 'Read-only project',
  READ_ONLY_NEWER: 'This project was created with a newer version of the app and is read-only',
  NOTHING_TO_UNDO: 'Nothing to undo',
  NOTHING_TO_REDO: 'Nothing to redo',
  IMPORT_EXPIRED: 'That import is no longer pending. Import the file again.'
}

// i18n:es-start
export const es: Readonly<Record<AppErrorReason, ErrorText>> = {
  PROJECT_NOT_FOUND: 'El proyecto no existe',
  READ_ONLY: 'Proyecto de solo lectura',
  READ_ONLY_NEWER: 'Este proyecto se creó con una versión más nueva de la app y es de solo lectura',
  NOTHING_TO_UNDO: 'No hay nada que deshacer',
  NOTHING_TO_REDO: 'No hay nada que rehacer',
  IMPORT_EXPIRED: 'Esa importación ya no está pendiente. Vuelve a importar el archivo.'
}
// i18n:es-end
