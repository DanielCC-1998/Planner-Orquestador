import { useCallback, useMemo } from 'react'
import { FolderTree } from 'lucide-react'
import { Dialog } from '../../components/ui/dialog'
import { getI18n, useI18n } from '../../i18n'
import { useProject } from '../../stores/project'
import { toast } from '../../stores/toasts'
import { useUi } from '../../stores/ui'
import { revealTask } from '../tree/actions'
import { TaskPicker, useTaskItems, type PickerItem } from './TaskPicker'

const undoAction = () => ({ label: getI18n().t.common.undo, run: () => void useProject.getState().undo() })
const titleOf = (id: string) => useProject.getState().state?.tasks.get(id)?.title || getI18n().t.common.untitled

/** Links an existing task as a subtask of `parentId` (it becomes shared if it already had a parent). */
export function LinkChildDialog({ parentId, onClose }: { parentId: string; onClose: () => void }) {
  const { t } = useI18n()
  const graph = useProject((s) => s.state!.graph)
  const ancestors = useMemo(() => graph.ancestors(parentId), [graph, parentId])
  const disabledReason = useCallback(
    (id: string) => {
      if (id === parentId) return t.taskDialogs.reasons.sameTask
      if (graph.children(parentId).includes(id)) return t.taskDialogs.reasons.alreadyChild
      if (ancestors.has(id)) return t.taskDialogs.reasons.cycle
      return undefined
    },
    [graph, parentId, ancestors, t]
  )
  const items = useTaskItems(disabledReason)
  const pick = async (childId: string) => {
    const delta = await useProject.getState().dispatch({ type: 'edge.link', parentId, childId })
    if (!delta) return
    useUi.getState().toggleExpanded(parentId, true)
    onClose()
    toast.success(t.taskDialogs.linkChild.done(titleOf(childId), titleOf(parentId)), undoAction())
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t.taskDialogs.linkChild.title(titleOf(parentId))}
      description={t.taskDialogs.linkChild.description}
    >
      <TaskPicker items={items} onPick={(id) => void pick(id)} />
    </Dialog>
  )
}

/** Adds `childId` under another task, which makes it shared. */
export function LinkParentDialog({ childId, onClose }: { childId: string; onClose: () => void }) {
  const { t } = useI18n()
  const graph = useProject((s) => s.state!.graph)
  const descendants = useMemo(() => graph.descendants(childId), [graph, childId])
  const disabledReason = useCallback(
    (id: string) => {
      if (id === childId) return t.taskDialogs.reasons.sameTask
      if (graph.parents(childId).includes(id)) return t.taskDialogs.reasons.alreadyParent
      if (descendants.has(id)) return t.taskDialogs.reasons.cycle
      return undefined
    },
    [graph, childId, descendants, t]
  )
  const items = useTaskItems(disabledReason)
  const pick = async (parentId: string) => {
    const delta = await useProject.getState().dispatch({ type: 'edge.link', parentId, childId })
    if (!delta) return
    onClose()
    toast.success(t.taskDialogs.linkParent.done(titleOf(childId), titleOf(parentId)), undoAction())
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t.taskDialogs.linkParent.title(titleOf(childId))}
      description={t.taskDialogs.linkParent.description}
    >
      <TaskPicker items={items} onPick={(id) => void pick(id)} />
    </Dialog>
  )
}

/** Moves the edge `fromParentId → childId` to another parent (or to the root). */
export function MoveTaskDialog({ childId, fromParentId, onClose }: { childId: string; fromParentId: string | null; onClose: () => void }) {
  const { t } = useI18n()
  const graph = useProject((s) => s.state!.graph)
  const descendants = useMemo(() => graph.descendants(childId), [graph, childId])
  const shared = graph.parents(childId).length > 1
  const disabledReason = useCallback(
    (id: string) => {
      if (id === childId) return t.taskDialogs.reasons.sameTask
      if (id === fromParentId) return t.taskDialogs.reasons.alreadyHere
      if (descendants.has(id)) return t.taskDialogs.reasons.cycle
      return undefined
    },
    [childId, fromParentId, descendants, t]
  )
  const items = useTaskItems(disabledReason)
  const top: PickerItem[] = [
    {
      id: '__root__',
      code: '—',
      title: t.taskDialogs.move.root,
      path: t.taskDialogs.move.rootPath,
      icon: <FolderTree className="size-4 text-muted-foreground" />,
      disabled: fromParentId === null ? t.taskDialogs.reasons.alreadyHere : shared ? t.taskDialogs.reasons.shared : undefined
    }
  ]
  const pick = async (target: string) => {
    const toParentId = target === '__root__' ? null : target
    const index = graph.siblings(toParentId).length
    const delta = await useProject.getState().dispatch({ type: 'edge.move', childId, fromParentId, toParentId, index })
    if (!delta) return
    onClose()
    if (toParentId) useUi.getState().toggleExpanded(toParentId, true)
    revealTask(childId)
    toast.success(toParentId ? t.taskDialogs.move.done(titleOf(toParentId)) : t.taskDialogs.move.doneRoot, undoAction())
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t.taskDialogs.move.title(titleOf(childId))}
      description={t.taskDialogs.move.description}
    >
      <TaskPicker items={items} top={top} onPick={(id) => void pick(id)} />
    </Dialog>
  )
}

/** Ctrl+K: go to any task of the project. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const items = useTaskItems()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" title={t.taskDialogs.palette.title} description={t.taskDialogs.palette.description}>
      <TaskPicker
        items={items}
        onPick={(id) => {
          onClose()
          revealTask(id)
        }}
      />
    </Dialog>
  )
}
