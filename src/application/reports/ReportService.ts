import { ok, type ProjectId, type Result } from '@domain'
import type { AppError } from '../errors'
import type { Clock, PdfRenderer } from '../ports'
import type { ProjectSessions } from '../projects/ProjectSessions'
import { buildReportModel } from './buildReportModel'
import type { ReportModel, ReportOptions } from './ReportModel'
import type { SettingsService } from '../settings/SettingsService'

export interface ReportDeps {
  readonly sessions: ProjectSessions
  readonly settings: SettingsService
  readonly pdf: PdfRenderer
  readonly clock: Clock
}

/** Exports the project quote as a PDF. */
export class ReportService {
  constructor(private readonly deps: ReportDeps) {}

  /** Builds the report model and remembers the chosen options (language included) for that project. */
  async prepare(projectId: ProjectId, options: ReportOptions): Promise<Result<ReportModel, AppError>> {
    const state = await this.deps.sessions.stateOf(projectId)
    if (!state.ok) return state
    const settings = await this.deps.settings.update({ reportOptions: { [projectId]: options } })
    const { clock } = this.deps
    return ok(buildReportModel(state.value, options, settings.issuer, { now: clock.now(), localDate: (at) => clock.localDate(at) }))
  }

  render(model: ReportModel): Promise<Uint8Array> {
    return this.deps.pdf.render(model)
  }
}
