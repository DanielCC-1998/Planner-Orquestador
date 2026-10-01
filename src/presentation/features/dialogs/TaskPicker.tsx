import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { compareCodes } from '@domain'
import { Input } from '../../components/ui/input'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/cn'
import { useProject } from '../../stores/project'
import { normalizeSearch } from '../tree/filter'
import { canonicalPath } from '../tree/flatten'

export interface PickerItem {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly path: string
  /** When set, the item is shown disabled with this reason. */
  readonly disabled?: string | undefined
  readonly icon?: ReactNode
}

const LIMIT = 200

/**
 * Tasks of the project with code, title and path (to link, move, search…). Pass a stable
 * `disabledReason` (`useCallback`): the list is rebuilt whenever it changes.
 */
export function useTaskItems(disabledReason?: (id: string) => string | undefined): PickerItem[] {
  const { t } = useI18n()
  const state = useProject((s) => s.state)
  const codes = useProject((s) => s.estimation?.codes)
  return useMemo(() => {
    if (!state || !codes) return []
    const items: PickerItem[] = []
    for (const task of state.tasks.values()) {
      const path = canonicalPath(state.graph, task.id)
        .slice(0, -1)
        .map((p) => state.tasks.get(p)?.title || t.common.untitled)
        .join(' › ')
      items.push({ id: task.id, code: codes.get(task.id) ?? '', title: task.title || t.common.untitled, path, disabled: disabledReason?.(task.id) })
    }
    return items.sort((a, b) => compareCodes(a.code, b.code))
  }, [state, codes, t, disabledReason])
}

export function TaskPicker({
  items,
  onPick,
  placeholder,
  top
}: {
  items: readonly PickerItem[]
  onPick: (id: string) => void
  placeholder?: string
  /** Fixed options at the top (e.g. "Project root"). */
  top?: readonly PickerItem[]
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = normalizeSearch(query.trim())
    const pool = [...(top ?? []), ...items]
    const matched = q ? pool.filter((i) => normalizeSearch(`${i.title} ${i.path}`).includes(q) || i.code.startsWith(q)) : pool
    return matched.slice(0, LIMIT)
  }, [query, items, top])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (item: PickerItem | undefined) => {
    if (item && !item.disabled) onPick(item.id)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? t.taskDialogs.picker.placeholder}
          className="pl-8"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(results.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              pick(results[active])
            }
          }}
        />
      </div>
      <div ref={listRef} className="max-h-[50vh] min-h-40 overflow-y-auto rounded-lg border">
        {results.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">{t.taskDialogs.picker.noResults}</div> : null}
        {results.map((item, i) => (
          <button
            key={item.id}
            type="button"
            data-index={i}
            disabled={Boolean(item.disabled)}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(item)}
            className={cn(
              'flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0',
              i === active && !item.disabled && 'bg-accent',
              item.disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {item.icon}
            <span className="w-16 shrink-0 truncate text-xs tabular-nums text-muted-foreground">{item.code}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium wrap-anywhere">{item.title}</span>
              {item.path ? <span className="block truncate text-xs text-muted-foreground">{item.path}</span> : null}
            </span>
            {item.disabled ? <span className="shrink-0 text-xs text-muted-foreground">{item.disabled}</span> : null}
          </button>
        ))}
      </div>
      {results.length === LIMIT ? <div className="text-xs text-muted-foreground">{t.taskDialogs.picker.limited(LIMIT)}</div> : null}
    </div>
  )
}
