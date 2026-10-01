import { join } from 'node:path'
import {
  ProjectCatalog,
  ProjectSessions,
  ReportService,
  SettingsService,
  type SaveStatus
} from '@application'
import { jsonProjectSerializer } from '../../persistence/json/codec'
import { JsonProjectRepository } from '../../persistence/json/JsonProjectRepository'
import { JsonSettingsRepository } from '../../persistence/json/JsonSettingsRepository'
import { ElectronPdfRenderer } from '../../pdf/ElectronPdfRenderer'
import { cryptoIdGenerator } from '../../system/cryptoIdGenerator'
import { systemClock } from '../../system/systemClock'

export interface ContainerOptions {
  readonly dataDir: string
  readonly tempDir: string
  readonly onSaveStatus: (projectId: string, status: SaveStatus) => void
}

export type Container = Awaited<ReturnType<typeof createContainer>>

/** Composition root: here, and only here, the ports are wired to their adapters. */
export async function createContainer(options: ContainerOptions) {
  const repo = new JsonProjectRepository(options.dataDir)
  await repo.init()
  const settings = new SettingsService(new JsonSettingsRepository(join(options.dataDir, 'settings.json')))
  const invalidate: { fn: (id: string) => void } = { fn: () => undefined }
  const sessions = new ProjectSessions({
    repo,
    clock: systemClock,
    ids: cryptoIdGenerator,
    onSaveStatus: options.onSaveStatus,
    onChanged: (id) => invalidate.fn(id)
  })
  const catalog = new ProjectCatalog({
    repo,
    sessions,
    serializer: jsonProjectSerializer,
    clock: systemClock,
    ids: cryptoIdGenerator
  })
  invalidate.fn = (id) => catalog.invalidate(id)
  const reports = new ReportService({
    sessions,
    settings,
    pdf: new ElectronPdfRenderer(options.tempDir),
    clock: systemClock
  })
  return { repo, settings, sessions, catalog, reports }
}
