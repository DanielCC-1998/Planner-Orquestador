import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  readonly id: number
  readonly kind: ToastKind
  readonly message: string
  readonly action?: { readonly label: string; readonly run: () => void } | undefined
}

interface ToastStore {
  toasts: Toast[]
  push(kind: ToastKind, message: string, action?: Toast['action']): void
  dismiss(id: number): void
}

let nextId = 1

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push(kind, message, action) {
    const id = nextId++
    set({ toasts: [...get().toasts.slice(-3), { id, kind, message, action }] })
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3500)
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  }
}))

export const toast = {
  info: (message: string, action?: Toast['action']) => useToasts.getState().push('info', message, action),
  success: (message: string, action?: Toast['action']) => useToasts.getState().push('success', message, action),
  error: (message: string) => useToasts.getState().push('error', message)
}
