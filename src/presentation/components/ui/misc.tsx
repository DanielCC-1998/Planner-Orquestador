import type { ReactNode } from 'react'
import { Popover as P, Tooltip as T } from 'radix-ui'
import { cn } from '../../lib/cn'

// ─── Tooltip ──────────────────────────────────────────────────────────────────

export const TooltipProvider = T.Provider

export function Tooltip({
  content,
  children,
  side = 'top',
  delay
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}) {
  if (!content) return <>{children}</>
  return (
    <T.Root delayDuration={delay ?? 350}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={5}
          className="z-[60] max-w-xs rounded-md bg-foreground px-2 py-1 text-xs leading-snug text-background shadow-lg data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}

// ─── Popover ──────────────────────────────────────────────────────────────────

export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverAnchor = P.Anchor

export function PopoverContent({
  className,
  children,
  align = 'start',
  side = 'bottom'
}: {
  className?: string
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        side={side}
        sideOffset={6}
        className={cn(
          'z-50 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
      >
        {children}
      </P.Content>
    </P.Portal>
  )
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

export function Avatar({
  name,
  initials,
  color,
  size = 'md',
  className
}: {
  name: string
  initials: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dims = { sm: 'size-5 text-[9px]', md: 'size-6 text-[10px]', lg: 'size-8 text-xs' }[size]
  return (
    <Tooltip content={name}>
      <span
        className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-card', dims, className)}
        style={{ backgroundColor: color }}
      >
        {initials}
      </span>
    </Tooltip>
  )
}

export function ProgressBar({ value, className, color }: { value: number; className?: string; color?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className="h-full rounded-full bg-status-done transition-[width]"
        style={{ width: `${pct}%`, ...(color ? { backgroundColor: color } : {}) }}
      />
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

export function Badge({
  children,
  className,
  tone = 'neutral'
}: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'shared' | 'warning' | 'primary' | 'success'
}) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground',
    shared: 'bg-shared-soft text-shared',
    warning: 'bg-warning/15 text-warning',
    primary: 'bg-accent text-accent-foreground',
    success: 'bg-success/15 text-success'
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-medium leading-4', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: ReactNode; title?: string }>
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-lg bg-muted p-0.5', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          title={o.title}
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors [&_svg]:size-3.5',
            o.value === value ? 'bg-card text-foreground shadow-sm' : 'hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon ? <div className="rounded-2xl bg-accent p-3 text-accent-foreground [&_svg]:size-7">{icon}</div> : null}
      <div className="text-base font-semibold">{title}</div>
      {description ? <div className="max-w-md text-sm text-muted-foreground">{description}</div> : null}
      {action}
    </div>
  )
}
