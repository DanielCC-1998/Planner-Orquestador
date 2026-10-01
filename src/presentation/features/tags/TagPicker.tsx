import { useMemo, useState, type ReactNode } from 'react'
import { Check, Minus, Plus, Settings2 } from 'lucide-react'
import { MAX_TAG_NAME_LENGTH, tagKey, type TagDef } from '@domain'
import { TagChip } from '../../components/TagChip'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/cn'
import { useUi } from '../../stores/ui'
import { normalizeSearch } from '../tree/filter'

/** Whether the task (or every selected task, or only some of them) has a tag. */
export type TagState = 'on' | 'off' | 'some'

/**
 * Picks project tags for one task or several: search, tick the existing ones, or create a new
 * one from what was typed (it is assigned in the same step). Tags are chosen, never retyped.
 */
export function TagPicker({
  tags,
  stateOf,
  onToggle,
  onCreate,
  children
}: {
  tags: readonly TagDef[]
  stateOf: (tagId: string) => TagState
  onToggle: (tag: TagDef, assign: boolean) => void
  onCreate: (name: string) => void
  /** The button that opens it. */
  children: ReactNode
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const trimmed = query.trim()
  const shown = useMemo(() => {
    const q = normalizeSearch(trimmed)
    return q ? tags.filter((tag) => normalizeSearch(tag.name).includes(q)) : tags
  }, [tags, trimmed])
  const exact = trimmed ? tags.find((tag) => tagKey(tag.name) === tagKey(trimmed)) : undefined
  const toggle = (tag: TagDef) => onToggle(tag, stateOf(tag.id) !== 'on')
  /** Enter gives the typed tag (creating it if needed); it never takes one away. */
  const submit = () => {
    if (!trimmed) return
    if (!exact) onCreate(trimmed)
    else if (stateOf(exact.id) !== 'on') onToggle(exact, true)
    setQuery('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <input
          value={query}
          maxLength={MAX_TAG_NAME_LENGTH}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={t.tags.searchPlaceholder}
          aria-label={t.tags.searchPlaceholder}
          className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div role="group" aria-label={t.tags.button} className="mt-2 max-h-64 overflow-y-auto">
          {shown.map((tag) => {
            const state = stateOf(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                role="checkbox"
                aria-checked={state === 'on' ? true : state === 'some' ? 'mixed' : false}
                onClick={() => toggle(tag)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border',
                    state !== 'off' && 'border-primary bg-primary text-primary-foreground'
                  )}
                >
                  {state === 'on' ? <Check className="size-3" /> : state === 'some' ? <Minus className="size-3" /> : null}
                </span>
                <TagChip name={tag.name} color={tag.color} />
              </button>
            )
          })}
          {tags.length === 0 && !trimmed ? <p className="px-2 py-1.5 text-xs text-muted-foreground">{t.tags.noTags}</p> : null}
          {trimmed && shown.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">{t.tags.noMatches}</p> : null}
          {trimmed && !exact ? (
            <button
              type="button"
              onClick={submit}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <Plus className="size-4 shrink-0" />
              <span className="min-w-0 wrap-anywhere">{t.tags.create(trimmed)}</span>
            </button>
          ) : null}
        </div>
        <div className="mt-2 border-t pt-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              useUi.getState().openDialog({ type: 'tags' })
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Settings2 className="size-3.5" /> {t.tags.manage}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
