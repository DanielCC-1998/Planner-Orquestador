import { create } from 'zustand'
import type { NewProjectInput } from '@domain'
import type { ProjectCard } from '@application'
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
    const card = await attempt(() => call('projects.importJson'))
    if (card) {
      await get().refresh()
      toast.success(getI18n().t.projects.notices.imported(card.name))
    }
    return card
  },

  async exportJson(id) {
    const saved = await attempt(() => call('projects.exportJson', { id }))
    if (saved) toast.success(getI18n().t.projects.notices.exportedJson)
  }
}))
