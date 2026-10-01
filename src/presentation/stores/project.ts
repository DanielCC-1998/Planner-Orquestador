import { create } from 'zustand'
import { estimate, fromProjectData, type Command, type Estimation, type ProjectState } from '@domain'
import type { Delta, SaveStatus } from '@application'
import { applyDelta } from '@shared/ipc/applyDelta'
import { getI18n } from '../i18n'
import { errorText } from '../i18n/errors'
import { ApiError, call, errorMessage, onEvent, tryCall } from '../lib/api'
import { toast } from './toasts'

interface ProjectStore {
  id: string | null
  state: ProjectState | null
  /** Recomputed on every change (the domain is pure and fast: O(tasks + edges)). */
  estimation: Estimation | null
  revision: number
  canUndo: boolean
  canRedo: boolean
  readOnly: boolean
  loading: boolean
  saveStatus: SaveStatus | null
  open(id: string): Promise<boolean>
  close(): void
  /** Sends a command to main. Returns the delta, or null if the domain rejected it (already reported). */
  dispatch(command: Command, options?: { quiet?: boolean }): Promise<Delta | null>
  undo(): Promise<void>
  redo(): Promise<void>
}

/** Commands run one after another: each one applies to the result of the previous one. */
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job)
  queue = run.catch(() => undefined)
  return run
}

export const useProject = create<ProjectStore>((set, get) => {
  const receive = (delta: Delta) => {
    const { state, revision } = get()
    if (!state) return
    if (delta.revision === revision) {
      // Command without effect (e.g. saving a field that did not change).
      set({ canUndo: delta.canUndo, canRedo: delta.canRedo })
      return
    }
    if (delta.revision !== revision + 1) {
      // Out of sync (should not happen): the full state is reloaded.
      void get().open(get().id!)
      return
    }
    const next = applyDelta(state, delta)
    set({
      state: next,
      estimation: estimate(next),
      revision: delta.revision,
      canUndo: delta.canUndo,
      canRedo: delta.canRedo
    })
  }

  return {
    id: null,
    state: null,
    estimation: null,
    revision: 0,
    canUndo: false,
    canRedo: false,
    readOnly: false,
    loading: false,
    saveStatus: null,

    async open(id) {
      set({ loading: true })
      try {
        const snap = await call('project.open', { id })
        const state = fromProjectData(snap)
        if (!state.ok) throw new ApiError(state.error)
        set({
          id,
          state: state.value,
          estimation: estimate(state.value),
          revision: snap.revision,
          canUndo: snap.canUndo,
          canRedo: snap.canRedo,
          readOnly: snap.readOnly,
          loading: false,
          saveStatus: null
        })
        if (snap.readOnly) toast.info(getI18n().t.projects.notices.readOnly)
        return true
      } catch (e) {
        set({ loading: false })
        toast.error(errorMessage(e))
        return false
      }
    },

    close() {
      const id = get().id
      if (id) void tryCall('project.close', { id })
      set({ id: null, state: null, estimation: null, revision: 0, canUndo: false, canRedo: false, saveStatus: null })
    },

    dispatch(command, options) {
      return enqueue(async () => {
        const id = get().id
        if (!id) return null
        const result = await tryCall('project.command', { id, command })
        if (!result.ok) {
          if (!options?.quiet) toast.error(errorText(getI18n().t, result.error))
          if (result.error.code === 'NOT_FOUND' || result.error.code === 'INTERNAL') await get().open(id)
          return null
        }
        receive(result.data)
        return result.data
      })
    },

    undo() {
      return enqueue(async () => {
        const id = get().id
        if (!id || !get().canUndo) return
        const r = await tryCall('project.undo', { id })
        if (r.ok) receive(r.data)
      })
    },

    redo() {
      return enqueue(async () => {
        const id = get().id
        if (!id || !get().canRedo) return
        const r = await tryCall('project.redo', { id })
        if (r.ok) receive(r.data)
      })
    }
  }
})

onEvent('project.saveStatus', ({ projectId, status }) => {
  if (useProject.getState().id === projectId) useProject.setState({ saveStatus: status })
})
