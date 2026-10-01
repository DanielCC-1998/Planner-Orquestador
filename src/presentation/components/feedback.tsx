import type { ReactNode } from 'react'
import { create } from 'zustand'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { getI18n, useI18n } from '../i18n'
import { cn } from '../lib/cn'
import { useToasts } from '../stores/toasts'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'

export function Toaster() {
  const { t } = useI18n()
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className="pointer-events-none fixed bottom-14 right-4 z-[70] flex w-96 flex-col gap-2">
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-popover px-3 py-2.5 text-sm shadow-xl animate-in fade-in-0 slide-in-from-bottom-2',
            item.kind === 'error' && 'border-destructive/40'
          )}
        >
          {item.kind === 'error' ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          ) : item.kind === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0 flex-1 leading-snug wrap-anywhere">{item.message}</div>
          {item.action ? (
            <button
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
              onClick={() => {
                item.action!.run()
                dismiss(item.id)
              }}
            >
              {item.action.label}
            </button>
          ) : null}
          <button
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => dismiss(item.id)}
            aria-label={t.common.close}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Confirmation with options (promise) ──────────────────────────────────────

export interface ConfirmOption {
  readonly value: string
  readonly label: string
  readonly variant?: 'primary' | 'destructive' | 'secondary'
}

interface ConfirmRequest {
  readonly title: string
  readonly description?: ReactNode
  readonly options: readonly ConfirmOption[]
  readonly resolve: (value: string | null) => void
}

const useConfirmStore = create<{ request: ConfirmRequest | null }>(() => ({ request: null }))

/** Asks the user; resolves with the value of the chosen option, or null if cancelled. */
export function confirmChoice(title: string, description: ReactNode, options: readonly ConfirmOption[]): Promise<string | null> {
  return new Promise((resolve) => {
    useConfirmStore.setState({ request: { title, description, options, resolve } })
  })
}

export async function confirmDanger(title: string, description: ReactNode, label = getI18n().t.common.delete): Promise<boolean> {
  return (await confirmChoice(title, description, [{ value: 'ok', label, variant: 'destructive' }])) === 'ok'
}

export function ConfirmHost() {
  const { t } = useI18n()
  const request = useConfirmStore((s) => s.request)
  const finish = (value: string | null) => {
    request?.resolve(value)
    useConfirmStore.setState({ request: null })
  }
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => !open && finish(null)}
      title={request?.title ?? ''}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => finish(null)}>
            {t.common.cancel}
          </Button>
          {request?.options.map((o, i) => (
            <Button
              key={o.value}
              variant={o.variant ?? 'primary'}
              autoFocus={i === request.options.length - 1}
              onClick={() => finish(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </>
      }
    >
      <div className="text-sm leading-relaxed text-muted-foreground wrap-anywhere">{request?.description}</div>
    </Dialog>
  )
}
