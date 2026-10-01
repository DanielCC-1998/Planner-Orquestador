/**
 * Ports: what the application needs from the outside. They are implemented by the infrastructure
 * (JSON on disk, Electron for the PDF, system clock and UUIDs) or by the tests (in memory).
 */
export type { ProjectRepository, LoadedProject, RepoError, RepoErrorCode } from './ProjectRepository'
export type { SettingsRepository } from './SettingsRepository'
export type { ProjectSerializer } from './ProjectSerializer'
export type { PdfRenderer } from './PdfRenderer'
export type { Clock } from './Clock'
export type { IdGenerator } from './IdGenerator'
