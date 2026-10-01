import type { TaskGraph } from '@domain'

/** A visible tree row = one APPEARANCE of a task (a shared task appears several times). */
export interface TreeRow {
  /** Path of ids from the project root: it identifies the appearance. */
  readonly key: string
  readonly id: string
  readonly parentId: string | null
  readonly parentKey: string | null
  /** Index of the parent row in the array (−1 if it is top level in the view). */
  readonly parentRow: number
  /** Depth relative to the view (0 = top level). */
  readonly depth: number
  /** Positional WBS code of this appearance. */
  readonly code: string
  /** Primary appearance (the one that adds up). The others are references. */
  readonly canonical: boolean
  readonly childCount: number
  readonly expanded: boolean
  readonly index: number
  readonly siblingCount: number
  /** Position of the top-level branch (for the color rail). */
  readonly branch: number
  /** With a filter: a row that does not match but is shown as context. */
  readonly context: boolean
}

export interface FlattenInput {
  readonly graph: TaskGraph
  readonly codes: ReadonlyMap<string, string>
  readonly focusId: string | null
  readonly expanded: ReadonlySet<string>
  readonly peeks: ReadonlySet<string>
  /** Tasks that match the filter; null = no filter. */
  readonly matches: ReadonlySet<string> | null
}

/** Canonical path (through primary parents) from the root to `id`. */
export function canonicalPath(graph: TaskGraph, id: string): string[] {
  const path = [id]
  let current = graph.primaryParent(id)
  while (current !== null) {
    path.unshift(current)
    current = graph.primaryParent(current)
  }
  return path
}

export function canonicalKey(graph: TaskGraph, id: string): string {
  return canonicalPath(graph, id).join('/')
}

export function parentOfKey(key: string): string | null {
  const parts = key.split('/')
  return parts.length > 1 ? parts[parts.length - 2]! : null
}

export function parentKeyOf(key: string): string | null {
  const i = key.lastIndexOf('/')
  return i === -1 ? null : key.slice(0, i)
}

interface Frame {
  id: string
  parentId: string | null
  parentKey: string | null
  parentRow: number
  depth: number
  code: string
  canonical: boolean
  index: number
  siblingCount: number
  branch: number
}

/**
 * Flattens the DAG into visible rows (iterative depth-first traversal: no limit of levels).
 * - Without a filter: follows what is expanded. References (non-primary appearances) only
 *   open with an explicit "peek"; that way a stack of diamonds does not explode into 2^k rows.
 * - With a filter: only primary edges, everything expanded, matches + their ancestors.
 */
export function flatten(input: FlattenInput): TreeRow[] {
  const { graph, codes, focusId, expanded, peeks, matches } = input
  const rows: TreeRow[] = []

  let visible: Set<string> | null = null
  if (matches) {
    visible = new Set()
    for (const m of matches) {
      let cur: string | null = m
      while (cur !== null && !visible.has(cur)) {
        visible.add(cur)
        cur = graph.primaryParent(cur)
      }
    }
  }

  const baseKey = focusId ? canonicalKey(graph, focusId) : null
  const baseCode = focusId ? (codes.get(focusId) ?? '') : ''
  const top = focusId ? graph.children(focusId) : graph.roots()
  const stack: Frame[] = []
  for (let i = top.length - 1; i >= 0; i--) {
    const id = top[i]!
    const canonical = focusId ? graph.primaryParent(id) === focusId : true
    if (visible && (!canonical || !visible.has(id))) continue
    stack.push({
      id,
      parentId: focusId,
      parentKey: baseKey,
      parentRow: -1,
      depth: 0,
      code: baseCode ? `${baseCode}.${i + 1}` : String(i + 1),
      canonical,
      index: i,
      siblingCount: top.length,
      branch: i
    })
  }

  while (stack.length > 0) {
    const frame = stack.pop()!
    const key = frame.parentKey ? `${frame.parentKey}/${frame.id}` : frame.id
    const children = graph.children(frame.id)
    const isOpen =
      children.length > 0 && (visible ? true : frame.canonical ? expanded.has(frame.id) : peeks.has(key))
    const rowIndex = rows.length
    rows.push({
      key,
      id: frame.id,
      parentId: frame.parentId,
      parentKey: frame.parentKey,
      parentRow: frame.parentRow,
      depth: frame.depth,
      code: frame.code,
      canonical: frame.canonical,
      childCount: children.length,
      expanded: isOpen,
      index: frame.index,
      siblingCount: frame.siblingCount,
      branch: frame.branch,
      context: visible !== null && !matches!.has(frame.id)
    })
    if (!isOpen) continue
    for (let i = children.length - 1; i >= 0; i--) {
      const c = children[i]!
      const canonical = frame.canonical && graph.primaryParent(c) === frame.id
      if (visible && (!canonical || !visible.has(c))) continue
      stack.push({
        id: c,
        parentId: frame.id,
        parentKey: key,
        parentRow: rowIndex,
        depth: frame.depth + 1,
        code: `${frame.code}.${i + 1}`,
        canonical,
        index: i,
        siblingCount: children.length,
        branch: frame.branch
      })
    }
  }
  return rows
}

/** Ids to expand to see down to level `level` (1 = top level only) without opening references. */
export function idsToLevel(graph: TaskGraph, focusId: string | null, level: number): string[] {
  const out: string[] = []
  let frontier = [...(focusId ? graph.children(focusId).filter((c) => graph.primaryParent(c) === focusId) : graph.roots())]
  for (let depth = 1; depth < level && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const id of frontier) {
      const cs = graph.children(id)
      if (cs.length === 0) continue
      out.push(id)
      for (const c of cs) if (graph.primaryParent(c) === id) next.push(c)
    }
    frontier = next
  }
  return out
}
