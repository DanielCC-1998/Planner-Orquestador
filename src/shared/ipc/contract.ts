import type { Command, ErrorParams, Member, NewProjectInput } from '@domain'
import type {
  Delta,
  ImportOutcome,
  ImportResolution,
  ProjectCard,
  ReportOptions,
  SaveStatus,
  Settings,
  SettingsPatch,
  Snapshot
} from '@application'

/**
 * Error sent across the bridge. `reason` and `params` let the UI show it in the current
 * language; `message` is an English fallback.
 */
export interface IpcError {
  readonly code: string
  readonly message: string
  readonly reason?: string | undefined
  readonly params?: ErrorParams | undefined
}

/** Every IPC response is a result: errors are never thrown across the bridge. */
export type IpcResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: IpcError }

export interface AppInfo {
  readonly version: string
  readonly dataDir: string
  readonly portable: boolean
  /** Operating-system languages in order of preference (to resolve the 'system' language). */
  readonly systemLocales: readonly string[]
}

type Id = { readonly id: string }

/** Channel → [input, output]. */
export interface Contract {
  'app.info': [void, AppInfo]
  'app.openDataDir': [void, void]
  'projects.list': [void, ProjectCard[]]
  'projects.create': [NewProjectInput, ProjectCard]
  'projects.duplicate': [Id, ProjectCard]
  'projects.trash': [Id, void]
  'projects.exportJson': [Id, { readonly path: string } | null]
  /** null = no file chosen. */
  'projects.importJson': [void, ImportOutcome | null]
  /** After a 'clash': what to do with the project that already exists. null = cancelled. */
  'projects.resolveImport': [{ readonly ticket: string; readonly mode: ImportResolution }, ProjectCard | null]
  'projects.members': [Id, Member[]]
  'project.open': [Id, Snapshot]
  'project.close': [Id, void]
  'project.command': [{ readonly id: string; readonly command: Command }, Delta]
  'project.undo': [Id, Delta]
  'project.redo': [Id, Delta]
  'project.exportPdf': [{ readonly id: string; readonly options: ReportOptions }, { readonly path: string } | null]
  'settings.get': [void, Settings]
  'settings.set': [SettingsPatch, Settings]
  'settings.pickLogo': [void, string | null]
}

export type Channel = keyof Contract
export type Input<K extends Channel> = Contract[K][0]
export type Output<K extends Channel> = Contract[K][1]

export const CHANNELS = [
  'app.info',
  'app.openDataDir',
  'projects.list',
  'projects.create',
  'projects.duplicate',
  'projects.trash',
  'projects.exportJson',
  'projects.importJson',
  'projects.resolveImport',
  'projects.members',
  'project.open',
  'project.close',
  'project.command',
  'project.undo',
  'project.redo',
  'project.exportPdf',
  'settings.get',
  'settings.set',
  'settings.pickLogo'
] as const satisfies readonly Channel[]

type Assert<T extends true> = T
/** Fails to compile if a channel of the contract is missing from CHANNELS. */
export type _AllChannelsListed = Assert<[Exclude<Channel, (typeof CHANNELS)[number]>] extends [never] ? true : false>

/** Events main → renderer. */
export interface Events {
  'project.saveStatus': { readonly projectId: string; readonly status: SaveStatus }
}
export type EventName = keyof Events
export const EVENTS = ['project.saveStatus'] as const satisfies readonly EventName[]

/** API the preload script exposes as `window.planner`. */
export interface PlannerBridge {
  invoke<K extends Channel>(channel: K, input: Input<K>): Promise<IpcResult<Output<K>>>
  on<E extends EventName>(event: E, listener: (payload: Events[E]) => void): () => void
}
