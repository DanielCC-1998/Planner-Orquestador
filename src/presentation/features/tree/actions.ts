import type { TaskPatch } from '@domain'
import { confirmChoice } from '../../components/feedback'
import { getI18n } from '../../i18n'
import { useProject } from '../../stores/project'
import { toast } from '../../stores/toasts'
import { useUi } from '../../stores/ui'
import { canonicalKey, parentKeyOf, type TreeRow } from './flatten'

/**
 * Tree actions. They all work on the ROW (one specific appearance): the parent → child edge
 * of that row is the one that is moved, unlinked or deleted.
 */
const project = () => useProject.getState()
const ui = () => useUi.getState()

const title = (id: string) => project().state?.tasks.get(id)?.title || getI18n().t.common.untitled
const codeOf = (id: string) => project().estimation?.codes.get(id) ?? ''

function keyUnder(parentKey: string | null, id: string): string {
  return parentKey ? `${parentKey}/${id}` : id
}

const undoAction = () => ({ label: getI18n().t.common.undo, run: () => void project().undo() })

function expandRow(row: Pick<TreeRow, 'id' | 'key' | 'canonical'>): void {
  if (row.canonical) ui().toggleExpanded(row.id, true)
  else ui().togglePeek(row.key, true)
}

export async function createTask(parentId: string | null, parentKey: string | null, index?: number, fields?: TaskPatch) {
  if (ui().typeAhead === null) ui().beginTypeAhead()
  const delta = await project().dispatch({ type: 'task.create', parentId, index, fields })
  const id = delta?.created[0]
  if (!id) {
    ui().clearTypeAhead()
    return null
  }
  const key = keyUnder(parentKey, id)
  ui().select(key, id)
  ui().startEdit(key, 'title', true)
  ui().requestScroll(key)
  return id
}

export function createSibling(row: TreeRow) {
  return createTask(row.parentId, row.parentKey, row.index + 1)
}

export async function createChild(row: TreeRow) {
  expandRow(row)
  return createTask(row.id, row.key, undefined)
}

/** Tab: the row becomes the last child of its previous sibling. */
export async function indent(row: TreeRow, rows: readonly TreeRow[]) {
  if (row.index === 0) return
  const state = project().state
  if (!state) return
  const siblings = state.graph.siblings(row.parentId)
  const prevId = siblings[row.index - 1]
  if (!prevId) return
  const prevKey = keyUnder(row.parentKey, prevId)
  const prevRow = rows.find((r) => r.key === prevKey)
  const prevCanonical = prevRow ? prevRow.canonical : state.graph.isPrimaryEdge(row.parentId, prevId)
  const delta = await project().dispatch({
    type: 'edge.move',
    childId: row.id,
    fromParentId: row.parentId,
    toParentId: prevId,
    index: state.graph.children(prevId).length
  })
  if (!delta) return
  expandRow({ id: prevId, key: prevKey, canonical: prevCanonical })
  const key = `${prevKey}/${row.id}`
  ui().select(key, row.id)
  ui().requestScroll(key)
}

/** Shift+Tab: the row moves up one level and lands right after its former parent. */
export async function outdent(row: TreeRow) {
  const state = project().state
  if (!state || row.parentId === null || !row.parentKey) return
  const focusId = ui().focusId
  if (row.parentId === focusId) {
    const { t } = getI18n()
    toast.info(t.tree.actions.exitFocusToOutdent(`${t.common.keys.alt}+←`))
    return
  }
  const grandKey = parentKeyOf(row.parentKey)
  const grandId = grandKey ? grandKey.slice(grandKey.lastIndexOf('/') + 1) : null
  const parentIndex = state.graph.siblings(grandId).indexOf(row.parentId)
  const delta = await project().dispatch({
    type: 'edge.move',
    childId: row.id,
    fromParentId: row.parentId,
    toParentId: grandId,
    index: parentIndex + 1
  })
  if (!delta) return
  const key = keyUnder(grandKey, row.id)
  ui().select(key, row.id)
  ui().requestScroll(key)
}

export async function moveBy(row: TreeRow, offset: -1 | 1) {
  const target = row.index + offset
  if (target < 0 || target >= row.siblingCount) return
  const delta = await project().dispatch({
    type: 'edge.move',
    childId: row.id,
    fromParentId: row.parentId,
    toParentId: row.parentId,
    index: target
  })
  if (delta) ui().requestScroll(row.key)
}

export async function duplicate(row: TreeRow) {
  const { t } = getI18n()
  const delta = await project().dispatch({
    type: 'task.duplicate',
    id: row.id,
    parentId: row.parentId,
    title: t.common.copyOf(project().state?.tasks.get(row.id)?.title || t.common.untitled)
  })
  const id = delta?.created[0]
  if (!id) return
  const key = keyUnder(row.parentKey, id)
  ui().select(key, id)
  ui().requestScroll(key)
  toast.success(t.tree.actions.duplicated, undoAction())
}

/** Paste as link: the copied task also becomes a subtask of the row (shared). */
export async function pasteAsLink(row: TreeRow) {
  const clip = ui().clipboardId
  if (!clip) {
    const { t } = getI18n()
    const k = t.common.keys
    toast.info(t.tree.actions.copyFirst(`${k.ctrl}+${k.shift}+C`))
    return
  }
  const delta = await project().dispatch({ type: 'edge.link', parentId: row.id, childId: clip })
  if (!delta) return
  expandRow(row)
  toast.success(getI18n().t.tree.actions.linked(title(clip), title(row.id)), undoAction())
}

export function copyForLink(row: TreeRow) {
  ui().setClipboard(row.id)
  const { t } = getI18n()
  const k = t.common.keys
  toast.info(t.tree.actions.copied(title(row.id), `${k.ctrl}+${k.shift}+V`))
}

export function focusRow(row: TreeRow) {
  if (row.childCount === 0) {
    const { t } = getI18n()
    toast.info(t.tree.actions.nothingToFocus(`${t.common.keys.ctrl}+${t.common.keys.enter}`))
    return
  }
  ui().focus(row.id)
  ui().select(null, null)
}

export async function makePrimaryHere(row: TreeRow) {
  if (row.parentId === null) return
  const delta = await project().dispatch({ type: 'edge.setPrimary', parentId: row.parentId, childId: row.id })
  if (delta) toast.success(getI18n().t.tree.actions.nowCountsUnder(title(row.parentId)), undoAction())
}

export async function unlinkRow(row: TreeRow) {
  if (row.parentId === null) return
  const state = project().state!
  const others = state.graph.parents(row.id).filter((p) => p !== row.parentId)
  const delta = await project().dispatch({ type: 'edge.unlink', parentId: row.parentId, childId: row.id })
  if (!delta) return
  const { t } = getI18n()
  const other = others[0]
  const elsewhere = other ? codeOf(other) || t.tree.actions.quoted(title(other)) : null
  toast.success(t.tree.actions.unlinked(title(row.parentId), elsewhere), undoAction())
  ui().select(null, null)
}

/**
 * Del: depends on the row.
 * - Reference: only unlinks.
 * - Canonical row of a shared task: asks whether to remove it from here or delete it everywhere.
 * - With subtasks: confirms with a count (shared subtasks still in another branch are kept).
 * - Leaf: deleted at once (with Undo).
 */
export async function deleteRow(row: TreeRow) {
  const state = project().state
  if (!state) return
  if (!row.canonical && row.parentId !== null) {
    await unlinkRow(row)
    return
  }
  const { t } = getI18n()
  const shared = state.graph.isShared(row.id)
  let mode: 'cascade' | 'splice' = 'cascade'
  if (shared && row.parentId !== null) {
    const choice = await confirmChoice(
      t.tree.actions.sharedTitle(title(row.id)),
      t.tree.actions.sharedDescription(state.graph.parents(row.id).length, title(row.parentId)),
      [
        { value: 'unlink', label: t.tree.menu.removeFromHere, variant: 'secondary' },
        { value: 'delete', label: t.tree.actions.deleteEverywhere, variant: 'destructive' }
      ]
    )
    if (choice === null) return
    if (choice === 'unlink') {
      await unlinkRow(row)
      return
    }
  }
  if (row.childCount > 0) {
    const { removed, kept } = state.graph.previewCascade(row.id)
    const choice = await confirmChoice(
      t.tree.actions.deleteTitle(title(row.id)),
      t.tree.actions.deleteDescription(removed.size, kept.size),
      [
        { value: 'splice', label: t.tree.actions.onlyThis, variant: 'secondary' },
        { value: 'cascade', label: t.tree.actions.deleteCount(removed.size), variant: 'destructive' }
      ]
    )
    if (choice === null) return
    mode = choice === 'splice' ? 'splice' : 'cascade'
  }
  const delta = await project().dispatch({ type: 'task.delete', id: row.id, mode })
  if (!delta) return
  ui().select(null, null)
  toast.success(mode === 'splice' ? t.tree.actions.deletedSpliced : t.tree.actions.deleted, undoAction())
}

/** Expands the primary chain down to the task, selects it and scrolls it into view. */
export function revealTask(id: string) {
  const state = project().state
  if (!state || !state.graph.has(id)) return
  const key = canonicalKey(state.graph, id)
  const ancestors = key.split('/').slice(0, -1)
  const u = ui()
  if (u.focusId && !ancestors.includes(u.focusId)) u.focus(null)
  u.setExpanded([...u.expanded, ...ancestors])
  u.setView('tree')
  u.select(key, id)
  u.requestScroll(key)
}
