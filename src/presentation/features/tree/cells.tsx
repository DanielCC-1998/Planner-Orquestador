import { useEffect, useRef, useState } from 'react'
import { Check, UserRound } from 'lucide-react'
import { TASK_STATUSES, type Member, type TaskStatus } from '@domain'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../components/ui/menu'
import { Avatar } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/cn'

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: 'bg-status-todo',
  in_progress: 'bg-status-progress',
  review: 'bg-status-review',
  done: 'bg-status-done'
}

export const STATUS_PILL: Record<TaskStatus, string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-status-progress/15 text-status-progress',
  review: 'bg-status-review/15 text-status-review',
  done: 'bg-status-done/15 text-status-done'
}

export function StatusPill({
  status,
  onChange,
  disabled,
  muted
}: {
  status: TaskStatus
  onChange: (status: TaskStatus) => void
  disabled?: boolean
  muted?: boolean
}) {
  const { t } = useI18n()
  const pill = (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium',
        STATUS_PILL[status],
        muted && 'opacity-60',
        !disabled && 'cursor-pointer hover:brightness-110'
      )}
    >
      <span className={cn('size-1.5 rounded-full', STATUS_DOT[status])} />
      {t.status[status]}
    </span>
  )
  if (disabled) return pill
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {pill}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-40">
        {TASK_STATUSES.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onChange(s)}>
            <span className={cn('size-2 rounded-full', STATUS_DOT[s])} />
            {t.status[s]}
            {s === status ? <Check className="ml-auto !text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AssigneePicker({
  member,
  members,
  onChange,
  disabled,
  muted
}: {
  member: Member | undefined
  members: readonly Member[]
  onChange: (memberId: string | null) => void
  disabled?: boolean
  muted?: boolean
}) {
  const { t } = useI18n()
  const face = member ? (
    <Avatar name={member.name} initials={member.initials} color={member.color} className={cn(muted && 'opacity-60')} />
  ) : (
    <span className="inline-flex size-6 items-center justify-center rounded-full border border-dashed text-muted-foreground/60">
      <UserRound className="size-3.5" />
    </span>
  )
  if (disabled) return face
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t.tree.assignee}>
          {face}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-52">
        {members.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">{t.tree.addPeopleInTeam}</div>
        ) : null}
        {members.map((m) => (
          <DropdownMenuItem key={m.id} onSelect={() => onChange(m.id)}>
            <Avatar name={m.name} initials={m.initials} color={m.color} size="sm" />
            <span className="truncate">{m.name}</span>
            {m.id === member?.id ? <Check className="ml-auto !text-primary" /> : null}
          </DropdownMenuItem>
        ))}
        {member ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(null)}>{t.common.unassigned}</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Inline editor: commits with Enter or on blur, and cancels with Esc.
 * `onCommit` returns false if the value is not valid (the editor stays open).
 */
export function InlineEditor({
  initial,
  placeholder,
  className,
  align = 'left',
  onCommit,
  onCancel,
  onKey,
  takeTypeAhead
}: {
  initial: string
  placeholder?: string
  className?: string
  align?: 'left' | 'right'
  onCommit: (value: string, via: 'enter' | 'blur' | 'tab' | 'shift-tab') => boolean | Promise<boolean>
  onCancel: (value: string) => void
  onKey?: (e: React.KeyboardEvent<HTMLInputElement>) => boolean
  /** Text typed before the editor existed is appended to the value. */
  takeTypeAhead?: () => { text: string; action: 'enter' | 'tab' | 'shift-tab' | 'escape' | null }
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)

  useEffect(() => {
    const pending = takeTypeAhead?.() ?? { text: '', action: null }
    const extra = pending.text
    const input = ref.current
    if (!input) return
    const typed = initial + extra
    if (pending.action === 'escape') {
      // Esc was pressed before the editor existed: editing ends right away.
      done.current = true
      onCancel(typed)
      return
    }
    if (pending.action) {
      // Enter / Tab / Shift+Tab pressed before the editor existed: apply them now.
      done.current = true
      setValue(typed)
      void Promise.resolve(onCommit(typed, pending.action)).then((okay) => {
        if (!okay) {
          done.current = false
          input.focus()
        }
      })
      return
    }
    input.focus()
    if (extra) {
      setValue((v) => v + extra)
      requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length))
    } else input.select()
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commit = async (via: 'enter' | 'blur' | 'tab' | 'shift-tab') => {
    if (done.current) return
    done.current = true
    const okay = await onCommit(value, via)
    if (!okay) {
      done.current = false
      ref.current?.focus()
    }
  }

  return (
    <input
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => void commit('blur')}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (onKey?.(e)) return
        if (e.key === 'Enter') {
          e.preventDefault()
          void commit('enter')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          done.current = true
          onCancel(value)
        } else if (e.key === 'Tab') {
          e.preventDefault()
          void commit(e.shiftKey ? 'shift-tab' : 'tab')
        }
      }}
      className={cn(
        'h-6 w-full min-w-0 rounded border border-ring bg-card px-1.5 text-sm outline-none ring-2 ring-ring/30',
        align === 'right' && 'text-right tabular-nums',
        className
      )}
    />
  )
}
