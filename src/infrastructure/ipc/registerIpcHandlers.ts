import { readFile, stat, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import type { IpcMain, IpcMainInvokeEvent, WebFrameMain } from 'electron'
import type { z } from 'zod'
import { ok, type Language, type Result } from '@domain'
import {
  fail,
  type AppError,
  type ProjectCatalog,
  type ProjectSessions,
  type ReportService,
  type SettingsService,
  type ThemePreference
} from '@application'
import type { AppInfo, Channel, Input, IpcResult, Output } from '@shared/ipc/contract'
import { MAIN_TEXT } from '../i18n/mainText'
import { atomicWrite } from '../persistence/json/atomicWrite'
import { reportFileName } from '../pdf/reportText'
import type { Dialogs } from './dialogs'
import {
  CommandInputSchema,
  ExportPdfInputSchema,
  IdInputSchema,
  NewProjectSchema,
  ResolveImportSchema,
  SettingsPatchSchema,
  VoidSchema
} from './inputSchemas'

export interface IpcDeps {
  readonly sessions: ProjectSessions
  readonly catalog: ProjectCatalog
  readonly settings: SettingsService
  readonly reports: ReportService
  readonly dialogs: Dialogs
  readonly info: () => AppInfo
  /** Current interface language ('system' already resolved), for dialogs and names of copies. */
  readonly uiLanguage: () => Promise<Language>
  readonly openDataDir: () => Promise<void>
  readonly applyTheme: (theme: ThemePreference) => void
  readonly isTrustedSender: (frame: WebFrameMain | null) => boolean
}

const MAX_IMPORT_BYTES = 50 * 1024 * 1024
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
}

type Handler<K extends Channel> = (input: Input<K>, event: IpcMainInvokeEvent) => Promise<Result<Output<K>, AppError>>

/**
 * Driving adapter: turns IPC messages into use-case calls.
 * It checks the sender, validates the input with zod and turns any failure into an IpcResult.
 */
export function registerIpc(ipcMain: IpcMain, deps: IpcDeps): void {
  const handle = <K extends Channel>(channel: K, schema: z.ZodType<unknown>, fn: Handler<K>) => {
    ipcMain.handle(channel, async (event, raw): Promise<IpcResult<Output<K>>> => {
      if (!deps.isTrustedSender(event.senderFrame)) {
        return { ok: false, error: { code: 'FORBIDDEN', message: 'Origin not allowed', reason: 'FORBIDDEN_ORIGIN' } }
      }
      const parsed = schema.safeParse(raw)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        const detail = `${issue?.path.join('.') || channel}: ${issue?.message}`
        return {
          ok: false,
          error: { code: 'INVALID_INPUT', message: `Invalid data (${detail})`, reason: 'INVALID_INPUT', params: { detail } }
        }
      }
      try {
        const result = await fn(parsed.data as Input<K>, event)
        return result.ok ? { ok: true, data: result.value } : { ok: false, error: result.error }
      } catch (e) {
        console.error(`[planner] ${channel}`, e)
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: { code: 'INTERNAL', message, reason: 'INTERNAL', params: { detail: message } } }
      }
    })
  }
  const text = async () => MAIN_TEXT[await deps.uiLanguage()]

  handle('app.info', VoidSchema, async () => ok(deps.info()))
  handle('app.openDataDir', VoidSchema, async () => ok(await deps.openDataDir()))

  handle('projects.list', VoidSchema, async () => ok(await deps.catalog.list()))
  handle('projects.create', NewProjectSchema, (input) => deps.catalog.create(input))
  handle('projects.duplicate', IdInputSchema, async ({ id }) => deps.catalog.duplicate(id, (await text()).copyName))
  handle('projects.trash', IdInputSchema, ({ id }) => deps.catalog.trash(id))
  handle('projects.members', IdInputSchema, ({ id }) => deps.catalog.membersOf(id))

  handle('projects.exportJson', IdInputSchema, async ({ id }) => {
    const t = await text()
    const exported = await deps.catalog.exportJson(id, t.defaultFileName)
    if (!exported.ok) return exported
    const path = await deps.dialogs.saveFile(exported.value.fileName, { name: t.projectFileFilter, extensions: ['json'] })
    if (!path) return ok(null)
    // A backup that is either complete or not there; no .bak next to it in the user's folder.
    await atomicWrite(path, exported.value.content, false)
    return ok({ path })
  })

  handle('projects.importJson', VoidSchema, async () => {
    const t = await text()
    const path = await deps.dialogs.openFile({ name: t.projectFileFilter, extensions: ['json'] })
    if (!path) return ok(null)
    if ((await stat(path)).size > MAX_IMPORT_BYTES) return fail('TOO_BIG', 'The file is too large', 'FILE_TOO_BIG')
    return deps.catalog.importJson(await readFile(path, 'utf8'))
  })

  handle('projects.resolveImport', ResolveImportSchema, async ({ ticket, mode }) =>
    deps.catalog.resolveImport(ticket, mode, (await text()).importedName)
  )

  handle('project.open', IdInputSchema, ({ id }) => deps.sessions.open(id))
  handle('project.close', IdInputSchema, async ({ id }) => ok(deps.sessions.close(id)))
  handle('project.command', CommandInputSchema, ({ id, command }) => deps.sessions.execute(id, command))
  handle('project.undo', IdInputSchema, ({ id }) => deps.sessions.undo(id))
  handle('project.redo', IdInputSchema, ({ id }) => deps.sessions.redo(id))

  handle('project.exportPdf', ExportPdfInputSchema, async ({ id, options }) => {
    // Ask where to save first: if the user cancels, nothing is rendered.
    const model = await deps.reports.prepare(id, options)
    if (!model.ok) return model
    const filter = { name: (await text()).pdfFileFilter, extensions: ['pdf'] }
    const path = await deps.dialogs.saveFile(reportFileName(model.value), filter)
    if (!path) return ok(null)
    await writeFile(path, await deps.reports.render(model.value))
    if (options.openAfterExport) await deps.dialogs.openPath(path).catch(() => undefined)
    return ok({ path })
  })

  handle('settings.get', VoidSchema, async () => ok(await deps.settings.get()))
  handle('settings.set', SettingsPatchSchema, async (patch) => {
    const next = await deps.settings.update(patch)
    if (patch.theme) deps.applyTheme(next.theme)
    return ok(next)
  })

  handle('settings.pickLogo', VoidSchema, async () => {
    const path = await deps.dialogs.openFile({
      name: (await text()).imageFileFilter,
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg']
    })
    if (!path) return ok(null)
    const type = IMAGE_TYPES[extname(path).toLowerCase()]
    if (!type) return fail('INVALID', 'Unsupported image format', 'IMAGE_FORMAT')
    if ((await stat(path)).size > MAX_LOGO_BYTES) return fail('TOO_BIG', 'The logo cannot exceed 2 MB', 'LOGO_TOO_BIG')
    const data = await readFile(path)
    return ok(`data:${type};base64,${data.toString('base64')}`)
  })
}
