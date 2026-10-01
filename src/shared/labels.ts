import type { Language, Priority, TaskStatus } from '@domain'

/** Status names in each language (interface and PDF). */
export const STATUS_LABELS: Readonly<Record<Language, Readonly<Record<TaskStatus, string>>>> = {
  en: { todo: 'To do', in_progress: 'In progress', review: 'In review', done: 'Done' },
  // i18n:es-start
  es: { todo: 'Por hacer', in_progress: 'En curso', review: 'En revisión', done: 'Hecho' }
  // i18n:es-end
}

/** Priority names in each language (interface and PDF). */
export const PRIORITY_LABELS: Readonly<Record<Language, Readonly<Record<Priority, string>>>> = {
  en: { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' },
  // i18n:es-start
  es: { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' }
  // i18n:es-end
}
