import {
  ArrowDown,
  ArrowUp,
  ClipboardPaste,
  Copy,
  CopyPlus,
  CornerDownRight,
  FolderInput,
  IndentDecrease,
  IndentIncrease,
  Link2,
  Plus,
  Share2,
  Star,
  Trash2,
  Unlink,
  ZoomIn,
  type LucideIcon
} from 'lucide-react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../../components/ui/menu'
import { useI18n, type Messages } from '../../i18n'
import { useUi } from '../../stores/ui'
import * as actions from './actions'
import type { TreeRow } from './flatten'

interface Entry {
  readonly key: string
  readonly label: string
  readonly icon: LucideIcon
  readonly shortcut?: string
  readonly danger?: boolean
  readonly disabled?: boolean
  readonly run: () => void
}
type MenuEntry = Entry | 'sep'

export function taskMenuEntries(row: TreeRow, rows: readonly TreeRow[], readOnly: boolean, t: Messages): MenuEntry[] {
  const ui = useUi.getState()
  const parentRow = row.parentRow >= 0 ? rows[row.parentRow] : undefined
  const parentCanonical = parentRow ? parentRow.canonical : true
  const m = t.tree.menu
  const k = t.common.keys
  const entries: MenuEntry[] = [
    { key: 'child', label: m.addSubtask, icon: Plus, shortcut: `${k.ctrl}+${k.enter}`, run: () => void actions.createChild(row) },
    { key: 'sibling', label: m.addBelow, icon: CornerDownRight, shortcut: k.enter, run: () => void actions.createSibling(row) },
    'sep',
    {
      key: 'linkChild',
      label: m.linkChild,
      icon: Link2,
      run: () => ui.openDialog({ type: 'linkChild', parentId: row.id })
    },
    {
      key: 'linkParent',
      label: m.linkParent,
      icon: Share2,
      run: () => ui.openDialog({ type: 'linkParent', childId: row.id })
    },
    { key: 'copy', label: m.copy, icon: Copy, shortcut: `${k.ctrl}+${k.shift}+C`, run: () => actions.copyForLink(row) },
    {
      key: 'paste',
      label: m.paste,
      icon: ClipboardPaste,
      shortcut: `${k.ctrl}+${k.shift}+V`,
      disabled: !ui.clipboardId || ui.clipboardId === row.id,
      run: () => void actions.pasteAsLink(row)
    },
    'sep',
    {
      key: 'move',
      label: m.move,
      icon: FolderInput,
      run: () => ui.openDialog({ type: 'move', childId: row.id, fromParentId: row.parentId })
    },
    {
      key: 'indent',
      label: m.indent,
      icon: IndentIncrease,
      shortcut: k.tab,
      disabled: row.index === 0,
      run: () => void actions.indent(row, rows)
    },
    {
      key: 'outdent',
      label: m.outdent,
      icon: IndentDecrease,
      shortcut: `${k.shift}+${k.tab}`,
      disabled: row.parentId === null,
      run: () => void actions.outdent(row)
    },
    { key: 'up', label: m.moveUp, icon: ArrowUp, shortcut: `${k.alt}+↑`, disabled: row.index === 0, run: () => void actions.moveBy(row, -1) },
    {
      key: 'down',
      label: m.moveDown,
      icon: ArrowDown,
      shortcut: `${k.alt}+↓`,
      disabled: row.index >= row.siblingCount - 1,
      run: () => void actions.moveBy(row, 1)
    },
    'sep',
    { key: 'focus', label: m.focus, icon: ZoomIn, shortcut: `${k.alt}+→`, disabled: row.childCount === 0, run: () => actions.focusRow(row) },
    {
      key: 'primary',
      label: m.makePrimary,
      icon: Star,
      disabled: row.canonical || !parentCanonical || row.parentId === null,
      run: () => void actions.makePrimaryHere(row)
    },
    { key: 'dup', label: m.duplicate, icon: CopyPlus, shortcut: `${k.ctrl}+D`, run: () => void actions.duplicate(row) },
    'sep',
    row.canonical || row.parentId === null
      ? { key: 'delete', label: m.delete, icon: Trash2, shortcut: k.del, danger: true, run: () => void actions.deleteRow(row) }
      : { key: 'unlink', label: m.removeFromHere, icon: Unlink, shortcut: k.del, danger: true, run: () => void actions.unlinkRow(row) }
  ]
  return readOnly ? entries.filter((e) => e !== 'sep' && e.key === 'focus') : entries
}

interface MenuProps {
  row: TreeRow
  rowsRef: { current: readonly TreeRow[] }
  readOnly: boolean
}

/** Entries are computed when the menu opens (Radix only mounts the open content). */
function Entries({ row, rowsRef, readOnly, kind }: MenuProps & { kind: 'context' | 'dropdown' }) {
  const { t } = useI18n()
  const entries = taskMenuEntries(row, rowsRef.current, readOnly, t)
  return kind === 'context' ? <ContextItems entries={entries} /> : <DropdownItems entries={entries} />
}

export function TaskContextMenuContent(props: MenuProps) {
  return (
    <ContextMenuContent className="w-72">
      <Entries {...props} kind="context" />
    </ContextMenuContent>
  )
}

export function TaskDropdownMenuContent(props: MenuProps) {
  return (
    <DropdownMenuContent className="w-72" align="end">
      <Entries {...props} kind="dropdown" />
    </DropdownMenuContent>
  )
}

function ContextItems({ entries }: { entries: MenuEntry[] }) {
  return (
    <>
      {entries.map((e, i) =>
        e === 'sep' ? (
          <ContextMenuSeparator key={`sep${i}`} />
        ) : (
          <ContextMenuItem key={e.key} danger={e.danger} disabled={e.disabled} shortcut={e.shortcut} onSelect={e.run}>
            <e.icon /> {e.label}
          </ContextMenuItem>
        )
      )}
    </>
  )
}

function DropdownItems({ entries }: { entries: MenuEntry[] }) {
  return (
    <>
      {entries.map((e, i) =>
        e === 'sep' ? (
          <DropdownMenuSeparator key={`sep${i}`} />
        ) : (
          <DropdownMenuItem key={e.key} danger={e.danger} disabled={e.disabled} shortcut={e.shortcut} onSelect={e.run}>
            <e.icon /> {e.label}
          </DropdownMenuItem>
        )
      )}
    </>
  )
}
