import type { ComponentProps, ReactNode } from 'react'
import { ContextMenu as CM, DropdownMenu as DM } from 'radix-ui'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'

const contentClass =
  'z-50 min-w-48 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'
const itemClass =
  'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

// ─── Dropdown menu ────────────────────────────────────────────────────────────

export const DropdownMenu = DM.Root
export const DropdownMenuTrigger = DM.Trigger

export function DropdownMenuContent({ className, align = 'start', ...props }: ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={4} className={cn(contentClass, className)} {...props} />
    </DM.Portal>
  )
}

export function DropdownMenuItem({
  className,
  danger,
  shortcut,
  children,
  ...props
}: ComponentProps<typeof DM.Item> & { danger?: boolean; shortcut?: string }) {
  return (
    <DM.Item className={cn(itemClass, danger && 'text-destructive [&_svg]:text-destructive', className)} {...props}>
      {children}
      {shortcut ? <span className="ml-auto pl-4 text-xs text-muted-foreground">{shortcut}</span> : null}
    </DM.Item>
  )
}

export function DropdownMenuCheckItem({
  checked,
  children,
  ...props
}: ComponentProps<typeof DM.CheckboxItem>) {
  return (
    <DM.CheckboxItem checked={checked} className={cn(itemClass, 'pl-7')} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <DM.ItemIndicator>
          <Check className="size-4" />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.CheckboxItem>
  )
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <DM.Label className="px-2 py-1 text-xs font-medium text-muted-foreground">{children}</DM.Label>
}

export function DropdownMenuSeparator() {
  return <DM.Separator className="-mx-1 my-1 h-px bg-border" />
}

// ─── Context menu ─────────────────────────────────────────────────────────────

export const ContextMenu = CM.Root
export const ContextMenuTrigger = CM.Trigger

export function ContextMenuContent({ className, ...props }: ComponentProps<typeof CM.Content>) {
  return (
    <CM.Portal>
      <CM.Content className={cn(contentClass, className)} {...props} />
    </CM.Portal>
  )
}

export function ContextMenuItem({
  className,
  danger,
  shortcut,
  children,
  ...props
}: ComponentProps<typeof CM.Item> & { danger?: boolean; shortcut?: string }) {
  return (
    <CM.Item className={cn(itemClass, danger && 'text-destructive [&_svg]:text-destructive', className)} {...props}>
      {children}
      {shortcut ? <span className="ml-auto pl-6 text-xs text-muted-foreground">{shortcut}</span> : null}
    </CM.Item>
  )
}

export function ContextMenuSeparator() {
  return <CM.Separator className="-mx-1 my-1 h-px bg-border" />
}

export function ContextMenuSub({ label, icon, children }: { label: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <CM.Sub>
      <CM.SubTrigger className={cn(itemClass, 'data-[state=open]:bg-accent')}>
        {icon}
        {label}
        <ChevronRight className="ml-auto" />
      </CM.SubTrigger>
      <CM.Portal>
        <CM.SubContent className={contentClass}>{children}</CM.SubContent>
      </CM.Portal>
    </CM.Sub>
  )
}
