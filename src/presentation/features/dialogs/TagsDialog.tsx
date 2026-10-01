import { useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { MAX_TAG_NAME_LENGTH, nextTagColor, TAG_COLORS, validateTagName, type TagColor, type TagDef } from '@domain'
import { TAG_PALETTE } from '@shared/tagPalette'
import { DraftInput } from '../../components/DraftField'
import { Rich } from '../../components/Rich'
import { SwatchPicker } from '../../components/SwatchPicker'
import { TagChip } from '../../components/TagChip'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { useI18n } from '../../i18n'
import { errorText } from '../../i18n/errors'
import { useProject } from '../../stores/project'
import { toast } from '../../stores/toasts'

const TAGS_GRID = 'grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1.2fr)_96px_36px] items-center gap-2'

function TagColorPicker({ color, onChange, label, disabled }: { color: TagColor; onChange: (c: TagColor) => void; label: string; disabled?: boolean }) {
  const { t } = useI18n()
  const swatches = TAG_COLORS.map((c) => ({ value: c, color: TAG_PALETTE[c].bg, ink: TAG_PALETTE[c].fg, label: t.tags.colors[c] }))
  return <SwatchPicker value={color} swatches={swatches} onChange={onChange} label={label} disabled={disabled ?? false} />
}

function TagRow({ tag, usage }: { tag: TagDef; usage: number }) {
  const { t } = useI18n()
  const tags = useProject((s) => s.tags)
  const dispatch = useProject((s) => s.dispatch)
  const readOnly = useProject((s) => s.readOnly)
  const [deleting, setDeleting] = useState(false)
  return (
    <div className={`${TAGS_GRID} border-b py-2 last:border-b-0`}>
      <TagColorPicker
        color={tag.color}
        disabled={readOnly}
        label={t.tags.colorOf(tag.name, t.tags.colors[tag.color])}
        onChange={(color) => void dispatch({ type: 'tag.update', id: tag.id, patch: { color } })}
      />
      <DraftInput
        value={tag.name}
        disabled={readOnly}
        maxLength={MAX_TAG_NAME_LENGTH}
        aria-label={t.tags.renameLabel(tag.name)}
        onCommit={(name) => {
          // Checked here too, so a repeated or empty name stays in the field with its message.
          const valid = validateTagName(name, tags, tag.id)
          if (!valid.ok) return errorText(t, valid.error)
          if (valid.value !== tag.name) void dispatch({ type: 'tag.update', id: tag.id, patch: { name: valid.value } })
          return null
        }}
      />
      <div className="min-w-0">
        <TagChip name={tag.name} color={tag.color} />
      </div>
      <span className="text-right text-xs text-muted-foreground">{t.tags.usage(usage)}</span>
      <Button
        variant="ghost"
        size="icon"
        className="justify-self-center"
        disabled={readOnly}
        onClick={() => setDeleting(!deleting)}
        aria-label={t.tags.deleteTag(tag.name)}
      >
        <Trash2 />
      </Button>
      {deleting ? (
        <div className="col-span-5 flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm">
          <span className="min-w-0 wrap-anywhere">
            <Rich text={t.tags.deleteConfirm(tag.name, usage)} />
          </span>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => void dispatch({ type: 'tag.delete', id: tag.id })}>
            {t.common.delete}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(false)}>
            {t.common.cancel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/** Tags of the project: create, rename, recolor and delete. Every change applies at once (with undo). */
export function TagsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const tags = useProject((s) => s.tags)
  const tasks = useProject((s) => s.state!.tasks)
  const readOnly = useProject((s) => s.readOnly)
  const dispatch = useProject((s) => s.dispatch)
  const [name, setName] = useState('')
  const [color, setColor] = useState<TagColor | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const usage = useMemo(() => {
    const count = new Map<string, number>()
    for (const task of tasks.values()) for (const id of task.tagIds) count.set(id, (count.get(id) ?? 0) + 1)
    return count
  }, [tasks])
  const newColor = color ?? nextTagColor(tags)

  const create = async () => {
    const valid = validateTagName(name, tags)
    if (!valid.ok) {
      toast.error(errorText(t, valid.error))
      nameRef.current?.focus()
      return
    }
    const delta = await dispatch({ type: 'tag.create', name: valid.value, color: newColor })
    if (!delta) return
    toast.success(t.tags.created(valid.value))
    setName('')
    setColor(null)
    nameRef.current?.focus()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t.tags.title}
      description={t.tags.description}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t.common.done}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          {tags.length === 0 ? <div className="py-4 text-center text-sm text-muted-foreground">{t.tags.empty}</div> : null}
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} usage={usage.get(tag.id) ?? 0} />
          ))}
        </div>
        {!readOnly ? (
          <form
            className="flex items-center gap-2 rounded-lg bg-muted/60 p-2"
            onSubmit={(e) => {
              e.preventDefault()
              void create()
            }}
          >
            <TagColorPicker color={newColor} label={t.tags.newColor(t.tags.colors[newColor])} onChange={setColor} />
            <Input
              ref={nameRef}
              value={name}
              maxLength={MAX_TAG_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.tags.newPlaceholder}
              aria-label={t.tags.newPlaceholder}
            />
            {name.trim() ? <TagChip name={name.trim()} color={newColor} /> : null}
            <Button type="submit" variant="primary">
              <Plus /> {t.tags.createButton}
            </Button>
          </form>
        ) : null}
      </div>
    </Dialog>
  )
}
