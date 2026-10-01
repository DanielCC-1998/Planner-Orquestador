import type { InfraErrorReason } from '@shared/ipc/errors'
import { param, type ErrorText } from '../types'

/** Texts of the infrastructure error reasons (IPC, files, JSON format). */
export const en: Readonly<Record<InfraErrorReason, ErrorText>> = {
  FORBIDDEN_ORIGIN: 'Origin not allowed',
  FORBIDDEN_CHANNEL: (p) => `Channel not allowed: ${param(p, 'channel')}`,
  INVALID_INPUT: (p) => `Invalid data (${param(p, 'detail')})`,
  INTERNAL: (p) => `Unexpected error: ${param(p, 'detail')}`,
  FILE_TOO_BIG: 'The file is too large',
  IMAGE_FORMAT: 'Unsupported image format',
  LOGO_TOO_BIG: 'The logo cannot exceed 2 MB',
  NOT_JSON: 'The file is not valid JSON',
  NOT_PLANNER_FILE: 'The file is not a Planner project',
  BAD_FORMAT_VERSION: 'Invalid format version',
  NO_MIGRATION: (p) => `There is no migration from version ${param(p, 'version')}`,
  INVALID_PROJECT_DATA: (p) => `Project with invalid data (${param(p, 'detail')})`,
  NEWER_SCHEMA: 'The file comes from a newer version of Planner. Update the app.',
  PROJECT_FILE_NOT_FOUND: 'The project does not exist',
  READ_FAILED: (p) => `The project could not be read: ${param(p, 'detail')}`,
  QUARANTINED: 'The project is damaged and has been moved to quarantine.'
}

// i18n:es-start
export const es: Readonly<Record<InfraErrorReason, ErrorText>> = {
  FORBIDDEN_ORIGIN: 'Origen no permitido',
  FORBIDDEN_CHANNEL: (p) => `Canal no permitido: ${param(p, 'channel')}`,
  INVALID_INPUT: (p) => `Datos no válidos (${param(p, 'detail')})`,
  INTERNAL: (p) => `Error inesperado: ${param(p, 'detail')}`,
  FILE_TOO_BIG: 'El archivo es demasiado grande',
  IMAGE_FORMAT: 'Formato de imagen no admitido',
  LOGO_TOO_BIG: 'El logo no puede superar 2 MB',
  NOT_JSON: 'El archivo no es JSON válido',
  NOT_PLANNER_FILE: 'El archivo no es un proyecto de Planner',
  BAD_FORMAT_VERSION: 'Versión de formato no válida',
  NO_MIGRATION: (p) => `No hay migración desde la versión ${param(p, 'version')}`,
  INVALID_PROJECT_DATA: (p) => `Proyecto con datos no válidos (${param(p, 'detail')})`,
  NEWER_SCHEMA: 'El archivo es de una versión más nueva de Planner. Actualiza la app.',
  PROJECT_FILE_NOT_FOUND: 'El proyecto no existe',
  READ_FAILED: (p) => `No se pudo leer el proyecto: ${param(p, 'detail')}`,
  QUARANTINED: 'El proyecto está dañado y se ha apartado a cuarentena.'
}
// i18n:es-end
