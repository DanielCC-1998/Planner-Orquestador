import { Tags, X } from 'lucide-react'
import { PRIORITIES, TASK_STATUSES, type BulkTaskPatch, type Priority, type TaskStatus } from '@domain'
import { Button } from '../../components/ui/button'
import { NativeSelect } from '../../components/ui/input'
import { useI18n } from '../../i18n'
import { useProject } from '../../stores/project'
import { toast } from '../../stores/toasts'
import { useUi } from '../../stores/ui'
import { TagPicker, type TagState } from '../tags/TagPicker'

/** Bulk edit bar shown when several tasks are selected (Ctrl/Shift + click). */
export function BulkBar({ ids }: { ids: readonly string[] }) {
  const { t } = useI18n()
  const members = useProject((s) => s.state?.members)
  const tasks = useProject((s) => s.state?.tasks)
  const tags = useProject((s) => s.tags)
  const dispatch = useProject((s) => s.dispatch)
  const readOnly = useProject((s) => s.readOnly)
  const undo = { label: t.common.undo, run: () => void useProject.getState().undo() }
  const clear = () => {
    const ui = useUi.getState()
    ui.select(ui.selectedKey, ui.selectedId)
  }
  const apply = async (patch: BulkTaskPatch) => {
    const delta = await dispatch({ type: 'task.bulkUpdate', ids: [...ids], patch })
    if (delta) toast.success(t.tree.bulk.updated(ids.length), undo)
  }
  /** 'on' if every selected task has the tag, 'some' if only part of them. */
  const tagState = (tagId: string): TagState => {
    const count = ids.filter((id) => tasks?.get(id)?.tagIds.includes(tagId)).length
    return count === 0 ? 'off' : count === ids.length ? 'on' : 'some'
  }
  return (
    <div role="region" aria-label={t.tree.bulk.label} className="flex shrink-0 items-center gap-3 border-t bg-accent/60 px-4 py-2 text-sm">
      <span className="font-semibold">{t.tree.bulk.selected(ids.length)}</span>
      {!readOnly ? (
        <>
          <NativeSelect className="w-40" value="" onChange={(e) => e.target.value && void apply({ status: e.target.value as TaskStatus })}>
            <option value="">{t.tree.bulk.status}</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            className="w-48"
            value=""
            onChange={(e) => {
              const v = e.target.value
              if (v) void apply({ assigneeId: v === 'none' ? null : v })
            }}
          >
            <option value="">{t.tree.bulk.assignee}</option>
            <option value="none">{t.common.unassigned}</option>
            {[...(members?.values() ?? [])].map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect className="w-36" value="" onChange={(e) => e.target.value && void apply({ priority: e.target.value as Priority })}>
            <option value="">{t.tree.bulk.priority}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t.priority[p]}
              </option>
            ))}
          </NativeSelect>
          <TagPicker
            tags={tags}
            stateOf={tagState}
            onToggle={async (tag, assign) => {
              // The notice counts the tasks that actually change, not the whole selection.
              const changing = ids.filter((id) => (tasks?.get(id)?.tagIds.includes(tag.id) ?? assign) !== assign).length
              const delta = await dispatch({ type: 'tag.assign', ids: [...ids], tagId: tag.id, assigned: assign })
              if (delta) toast.success(assign ? t.tags.bulkAdded(tag.name, changing) : t.tags.bulkRemoved(tag.name, changing), undo)
            }}
            onCreate={(name) => void dispatch({ type: 'tag.create', name, assignTo: [...ids] })}
          >
            <Button variant="outline" size="sm">
              <Tags /> {t.tags.bulk}
            </Button>
          </TagPicker>
        </>
      ) : null}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={clear}>
        <X /> {t.tree.bulk.clearSelection}
      </Button>
    </div>
  )
}
