import type { ErrorText } from '../types'

/**
 * Generic error texts by `code`, used when an error has no specific `reason`
 * (graph errors such as CYCLE or SELF, and older errors).
 */
export const en: Readonly<Record<string, ErrorText>> = {
  NOT_FOUND: 'It no longer exists',
  INVALID: 'Invalid value',
  CORRUPT: 'The data is damaged',
  IO: 'The file could not be read or written',
  READ_ONLY: 'This project is read-only',
  NOTHING: 'Nothing to do',
  FORBIDDEN: 'Action not allowed',
  INVALID_INPUT: 'Invalid data',
  INTERNAL: 'Unexpected error',
  TOO_BIG: 'The file is too large',
  NEWER_SCHEMA: 'The file comes from a newer version of Planner. Update the app.',
  CYCLE: 'Not possible: it would create a cycle',
  DUPLICATE: 'It is already a subtask of that task',
  SELF: 'A task cannot be a subtask of itself',
  SHARED_TO_ROOT: 'A shared subtask cannot move to the top level; remove it from its other parents first',
  NO_EDGE: 'The task is not at that position',
  UNKNOWN: 'Unknown task',
  EXISTS: 'The task already exists'
}

// i18n:es-start
export const es: Readonly<Record<string, ErrorText>> = {
  NOT_FOUND: 'Ya no existe',
  INVALID: 'Valor no válido',
  CORRUPT: 'Los datos están dañados',
  IO: 'No se pudo leer o escribir el archivo',
  READ_ONLY: 'Este proyecto es de solo lectura',
  NOTHING: 'No hay nada que hacer',
  FORBIDDEN: 'Acción no permitida',
  INVALID_INPUT: 'Datos no válidos',
  INTERNAL: 'Error inesperado',
  TOO_BIG: 'El archivo es demasiado grande',
  NEWER_SCHEMA: 'El archivo es de una versión más nueva de Planner. Actualiza la app.',
  CYCLE: 'No se puede: crearía un ciclo',
  DUPLICATE: 'Ya es subtarea de esa tarea',
  SELF: 'Una tarea no puede ser subtarea de sí misma',
  SHARED_TO_ROOT: 'Una subtarea compartida no puede subir a la raíz; quítala antes de sus otros padres',
  NO_EDGE: 'La tarea no está en esa posición',
  UNKNOWN: 'Tarea desconocida',
  EXISTS: 'La tarea ya existe'
}
// i18n:es-end
