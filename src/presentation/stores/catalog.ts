import { create } from 'zustand'
import type { NewProjectInput } from '@domain'
import type { ImportResolution, ProjectCard } from '@application'
import { confirmChoice } from '../components/feedback'
import { getI18n } from '../i18n'
import { call, errorMessage } from '../lib/api'
import { toast } from './toasts'

interface CatalogStore {
  cards: ProjectCard[]
  loaded: boolean
  refresh(): Promise<void>
  create(input: NewProjectInput): Promise<ProjectCard | null>
  duplicate(id: string): Promise<ProjectCard | null>
  trash(id: string): Promise<boolean>
  /** Imports a backup; if the project already exists, asks whether to replace it or keep both. */
  importJson(): Promise<ProjectCard | null>
  exportJson(id: string): Promise<void>
}

async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (e) {
    toast.error(errorMessage(e))
    return null
  }
}

export const useCatalog = create<CatalogStore>((set, get) => ({
  cards: [],
  loaded: false,

  async refresh() {
    const cards = await attempt(() => call('projects.list'))
    if (cards) set({ cards, loaded: true })
  },

  async create(input) {
    const card = await attempt(() => call('projects.create', input))
    if (card) await get().refresh()
    return card
  },

  async duplicate(id) {
    const card = await attempt(() => call('projects.duplicate', { id }))
    if (card) {
      await get().refresh()
      toast.success(getI18n().t.projects.notices.duplicated(card.name))
    }
    return card
  },

  async trash(id) {
    const ok = await attempt(() => call('projects.trash', { id }))
    if (ok === null) return false
    await get().refresh()
    return true
  },

  async importJson() {
    const outcome = await attempt(() => call('projects.importJson'))
    if (!outcome) return null
    const { t } = getI18n()
    if (outcome.kind === 'imported') {
      await get().refresh()
      toast.success(t.projects.notices.imported(outcome.card.name))
      return outcome.card
    }
    // The safe option goes last: it gets the focus, so Enter keeps both.
    const choice = await confirmChoice(t.projects.clash.title(outcome.existingName), t.projects.clash.description, [
      { value: 'replace', label: t.projects.clash.replace, variant: 'destructive' },
      { value: 'copy', label: t.projects.clash.keepBoth }
    ])
    const mode: ImportResolution = choice === 'replace' || choice === 'copy' ? choice : 'cancel'
    const card = await attempt(() => call('projects.resolveImport', { ticket: outcome.ticket, mode }))
    if (!card) return null
    await get().refresh()
    toast.success(mode === 'replace' ? t.projects.notices.replaced(card.name) : t.projects.notices.imported(card.name))
    return card
  },

  async exportJson(id) {
    const saved = await attempt(() => call('projects.exportJson', { id }))
    if (saved) toast.success(getI18n().t.projects.notices.exportedJson(saved.path))
  }
}))
