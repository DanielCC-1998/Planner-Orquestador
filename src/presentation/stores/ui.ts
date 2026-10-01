import { create } from 'zustand'
import type { TaskStatus } from '@domain'
import { readJson, writeJson } from '../lib/storage'

export type ProjectView = 'tree' | 'board' | 'workload'
export type FilterFlag = 'unestimated' | 'unpriced' | 'unassigned' | 'shared'

export interface Filters {
  readonly text: string
  /** Person ids; 'none' = unassigned. */
  readonly assignees: readonly string[]
  readonly statuses: readonly TaskStatus[]
  /** Tag ids: tasks with any of them. */
  readonly tags: readonly string[]
  readonly flags: readonly FilterFlag[]
}

export const EMPTY_FILTERS: Filters = { text: '', assignees: [], statuses: [], tags: [], flags: [] }

export function hasActiveFilters(f: Filters): boolean {
  return f.text.trim() !== '' || f.assignees.length > 0 || f.statuses.length > 0 || f.tags.length > 0 || f.flags.length > 0
}

export type Route = { readonly name: 'projects' } | { readonly name: 'project'; readonly id: string }

export type DialogState =
  | { readonly type: 'newProject' }
  | { readonly type: 'projectSettings' }
  | { readonly type: 'team' }
  | { readonly type: 'tags' }
  | { readonly type: 'settings' }
  | { readonly type: 'exportPdf'; readonly projectId: string; readonly currency: string }
  /** Link an existing task as a child of `parentId`. */
  | { readonly type: 'linkChild'; readonly parentId: string }
  /** Add `childId` under another parent (this makes it shared). */
  | { readonly type: 'linkParent'; readonly childId: string }
  | { readonly type: 'move'; readonly childId: string; readonly fromParentId: string | null }
  | { readonly type: 'palette' }
  | { readonly type: 'shortcuts' }

export type EditField = 'title' | 'estimate' | 'sp'

/** Control keys kept in the type-ahead queue. */
export type TypeAheadKey = 'enter' | 'tab' | 'shift-tab' | 'escape'
export type TypeAheadItem = { readonly kind: 'text'; readonly value: string } | { readonly kind: 'key'; readonly key: TypeAheadKey }
export type TypeAheadInput = { kind: 'char'; char: string } | { kind: 'backspace' } | { kind: 'key'; key: TypeAheadKey }

interface UiStore {
  route: Route
  view: ProjectView
  focusId: string | null
  focusBack: Array<string | null>
  focusForward: Array<string | null>
  selectedKey: string | null
  selectedId: string | null
  /** Multiple selection (task ids) for bulk editing. */
  multi: string[]
  detailOpen: boolean
  /** `fresh`: task just created (Enter creates the next one; Esc without a title discards it). */
  editing: { readonly key: string; readonly field: EditField; readonly fresh: boolean } | null
  /** Expanded canonical rows (by task id). Remembered per project. */
  expanded: Set<string>
  /** References opened by hand ("peek"), by path. In memory only. */
  peeks: Set<string>
  hoveredId: string | null
  filters: Filters
  clipboardId: string | null
  dialog: DialogState | null
  /** Row the tree must scroll to on the next render. */
  scrollToKey: string | null
  /**
   * Keys pressed while a task is being created or moved (before its editor exists), in order.
   * Each new editor consumes the text up to the first control key and applies it.
   * null = not capturing.
   */
  typeAhead: TypeAheadItem[] | null
  /** Show the descriptions under each task (tree and board). A view preference. */
  showDescriptions: boolean

  goProjects(): void
  openProject(id: string): void
  setView(view: ProjectView): void
  focus(id: string | null): void
  focusBackStep(): void
  focusForwardStep(): void
  select(key: string | null, id: string | null, options?: { additive?: boolean; range?: string[] }): void
  setDetailOpen(open: boolean): void
  startEdit(key: string, field: EditField, fresh?: boolean): void
  stopEdit(): void
  setExpanded(ids: Iterable<string>): void
  toggleExpanded(id: string, open?: boolean): void
  togglePeek(key: string, open?: boolean): void
  setHovered(id: string | null): void
  setFilters(patch: Partial<Filters>): void
  clearFilters(): void
  setClipboard(id: string | null): void
  openDialog(dialog: DialogState): void
  closeDialog(): void
  requestScroll(key: string | null): void
  beginTypeAhead(): void
  pushTypeAhead(input: TypeAheadInput): void
  takeTypeAhead(): { text: string; action: TypeAheadKey | null }
  clearTypeAhead(): void
  toggleDescriptions(): void
}

const expandedKey = (projectId: string) => `planner:expanded:${projectId}`
const DESCRIPTIONS_KEY = 'planner:showDescriptions'

export const useUi = create<UiStore>((set, get) => {
  const persistExpanded = (expanded: Set<string>) => {
    const route = get().route
    if (route.name === 'project') writeJson(expandedKey(route.id), [...expanded])
  }

  return {
    route: { name: 'projects' },
    view: 'tree',
    focusId: null,
    focusBack: [],
    focusForward: [],
    selectedKey: null,
    selectedId: null,
    multi: [],
    detailOpen: false,
    editing: null,
    expanded: new Set(),
    peeks: new Set(),
    hoveredId: null,
    filters: EMPTY_FILTERS,
    clipboardId: null,
    dialog: null,
    scrollToKey: null,
    typeAhead: null,
    showDescriptions: readJson<boolean>(DESCRIPTIONS_KEY, false),

    goProjects() {
      set({ route: { name: 'projects' }, dialog: null, editing: null })
    },

    openProject(id) {
      const stored = readJson<string[] | null>(expandedKey(id), null)
      set({
        route: { name: 'project', id },
        view: 'tree',
        focusId: null,
        focusBack: [],
        focusForward: [],
        selectedKey: null,
        selectedId: null,
        multi: [],
        detailOpen: false,
        editing: null,
        expanded: new Set(stored ?? []),
        peeks: new Set(),
        filters: EMPTY_FILTERS,
        dialog: null,
        scrollToKey: null
      })
    },

    setView(view) {
      set({ view, editing: null })
    },

    focus(id) {
      const { focusId, focusBack } = get()
      if (id === focusId) return
      set({ focusId: id, focusBack: [...focusBack, focusId].slice(-50), focusForward: [], editing: null })
    },

    focusBackStep() {
      const { focusBack, focusForward, focusId } = get()
      if (focusBack.length === 0) return
      const prev = focusBack[focusBack.length - 1]!
      set({ focusId: prev, focusBack: focusBack.slice(0, -1), focusForward: [focusId, ...focusForward] })
    },

    focusForwardStep() {
      const { focusBack, focusForward, focusId } = get()
      if (focusForward.length === 0) return
      const [next, ...rest] = focusForward
      set({ focusId: next ?? null, focusBack: [...focusBack, focusId], focusForward: rest })
    },

    select(key, id, options) {
      if (options?.range) {
        set({ selectedKey: key, selectedId: id, multi: options.range })
        return
      }
      if (options?.additive && id) {
        const multi = get().multi.includes(id) ? get().multi.filter((m) => m !== id) : [...get().multi, id]
        set({ selectedKey: key, selectedId: id, multi })
        return
      }
      set({ selectedKey: key, selectedId: id, multi: [] })
    },

    setDetailOpen(open) {
      set({ detailOpen: open })
    },

    startEdit(key, field, fresh = false) {
      set({ editing: { key, field, fresh } })
    },

    stopEdit() {
      set({ editing: null })
    },

    setExpanded(ids) {
      const expanded = new Set(ids)
      set({ expanded })
      persistExpanded(expanded)
    },

    toggleExpanded(id, open) {
      const expanded = new Set(get().expanded)
      const shouldOpen = open ?? !expanded.has(id)
      if (shouldOpen) expanded.add(id)
      else expanded.delete(id)
      set({ expanded })
      persistExpanded(expanded)
    },

    togglePeek(key, open) {
      const peeks = new Set(get().peeks)
      const shouldOpen = open ?? !peeks.has(key)
      if (shouldOpen) peeks.add(key)
      else peeks.delete(key)
      set({ peeks })
    },

    setHovered(id) {
      if (get().hoveredId !== id) set({ hoveredId: id })
    },

    setFilters(patch) {
      set({ filters: { ...get().filters, ...patch } })
    },

    clearFilters() {
      set({ filters: EMPTY_FILTERS })
    },

    setClipboard(id) {
      set({ clipboardId: id })
    },

    openDialog(dialog) {
      set({ dialog, editing: null })
    },

    closeDialog() {
      set({ dialog: null })
    },

    requestScroll(key) {
      set({ scrollToKey: key })
    },

    beginTypeAhead() {
      // If it is already capturing (chained actions), what is pending is kept.
      if (get().typeAhead !== null) return
      set({ typeAhead: [] })
      // Safety net: if no editor shows up, capturing stops.
      setTimeout(() => {
        if (get().typeAhead !== null && !get().editing) set({ typeAhead: null })
      }, 2000)
    },

    pushTypeAhead(input) {
      const queue = get().typeAhead
      if (queue === null) return
      const next = [...queue]
      const last = next[next.length - 1]
      if (input.kind === 'char') {
        if (last?.kind === 'text') next[next.length - 1] = { kind: 'text', value: last.value + input.char }
        else next.push({ kind: 'text', value: input.char })
      } else if (input.kind === 'backspace') {
        if (last?.kind === 'text') next[next.length - 1] = { kind: 'text', value: last.value.slice(0, -1) }
      } else {
        next.push({ kind: 'key', key: input.key })
      }
      set({ typeAhead: next })
    },

    takeTypeAhead() {
      const queue = get().typeAhead ?? []
      let text = ''
      let action: TypeAheadKey | null = null
      let i = 0
      for (; i < queue.length; i++) {
        const item = queue[i]!
        if (item.kind === 'text') text += item.value
        else {
          action = item.key
          i++
          break
        }
      }
      const rest = queue.slice(i)
      set({ typeAhead: rest.length > 0 ? rest : null })
      return { text, action }
    },

    clearTypeAhead() {
      if (get().typeAhead !== null) set({ typeAhead: null })
    },

    toggleDescriptions() {
      const showDescriptions = !get().showDescriptions
      set({ showDescriptions })
      writeJson(DESCRIPTIONS_KEY, showDescriptions)
    }
  }
})
