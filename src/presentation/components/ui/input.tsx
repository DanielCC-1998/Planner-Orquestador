import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const fieldBase =
  'w-full rounded-md border border-input bg-card px-2.5 text-sm text-foreground shadow-xs placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring disabled:opacity-50 aria-[invalid=true]:border-destructive'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(fieldBase, 'h-8', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref
) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-20 py-1.5 leading-relaxed', className)} {...props} />
})

export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function NativeSelect(
  { className, ...props },
  ref
) {
  return <select ref={ref} className={cn(fieldBase, 'h-8 pr-7', className)} {...props} />
})

export function Field({
  label,
  hint,
  error,
  children,
  className
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null | undefined
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  )
}
