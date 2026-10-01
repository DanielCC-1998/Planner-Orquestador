import {
  err,
  ok,
  saturatingAdd,
  type DomainErrorReason,
  type ErrorParams,
  type Result,
  type TaskId
} from '../common/primitives'

/**
 * Persisted structure of the graph. `parents[child][0]` is the primary parent;
 * the rest follow in linking order. `children` keeps the display order.
 */
export interface StructureDTO {
  readonly roots: readonly TaskId[]
  readonly children: Readonly<Record<TaskId, readonly TaskId[]>>
  readonly parents: Readonly<Record<TaskId, readonly TaskId[]>>
}

export type GraphErrorCode =
  | 'UNKNOWN'
  | 'SELF'
  | 'DUPLICATE'
  | 'CYCLE'
  | 'NO_EDGE'
  | 'SHARED_TO_ROOT'
  | 'EXISTS'
  | 'CORRUPT'

export interface GraphError {
  readonly code: GraphErrorCode
  /** English text for logs and as a fallback when the UI has no translation. */
  readonly message: string
  /** Set when the `code` alone is not specific enough for the UI (e.g. which kind of cycle). */
  readonly reason?: DomainErrorReason | undefined
  readonly params?: ErrorParams | undefined
}

const EMPTY: readonly TaskId[] = Object.freeze([]) as readonly TaskId[]

const gErr = (code: GraphErrorCode, message: string, reason?: DomainErrorReason, params?: ErrorParams): GraphError => ({
  code,
  message,
  ...(reason ? { reason } : {}),
  ...(params ? { params } : {})
})

function insertAt(list: readonly TaskId[], item: TaskId, index?: number): TaskId[] {
  const out = list.slice()
  const i = index === undefined ? out.length : Math.max(0, Math.min(out.length, Math.trunc(index)))
  out.splice(i, 0, item)
  return out
}

interface Draft {
  roots: TaskId[]
  children: Map<TaskId, readonly TaskId[]>
  parents: Map<TaskId, readonly TaskId[]>
}

/**
 * Directed acyclic graph of tasks. Immutable: every change returns a new graph
 * and shares the arrays that do not change.
 *
 * Invariants:
 * - No cycles and no duplicate edges.
 * - `roots` are exactly the tasks without parents.
 * - `children` and `parents` describe the same edges.
 * - The first parent of each task is the primary one; the chains of primary parents form a spanning forest.
 */
export class TaskGraph {
  private constructor(
    private readonly rootList: readonly TaskId[],
    private readonly childMap: ReadonlyMap<TaskId, readonly TaskId[]>,
    private readonly parentMap: ReadonlyMap<TaskId, readonly TaskId[]>
  ) {}

  static empty(): TaskGraph {
    return new TaskGraph(EMPTY, new Map(), new Map())
  }

  /** Rebuilds and validates a persisted graph. */
  static fromDTO(dto: StructureDTO, taskIds: Iterable<TaskId>): Result<TaskGraph, GraphError> {
    const ids = new Set(taskIds)
    const children = new Map<TaskId, readonly TaskId[]>()
    const parents = new Map<TaskId, readonly TaskId[]>()
    for (const id of ids) {
      children.set(id, EMPTY)
      parents.set(id, EMPTY)
    }
    const corrupt = (detail: string) =>
      err(gErr('CORRUPT', `Invalid task structure: ${detail}`, 'GRAPH_CORRUPT', { detail }))

    for (const [p, list] of Object.entries(dto.children)) {
      if (!ids.has(p)) return corrupt(`unknown parent ${p}`)
      if (new Set(list).size !== list.length) return corrupt(`duplicate children in ${p}`)
      for (const c of list) {
        if (!ids.has(c)) return corrupt(`unknown child ${c}`)
        if (c === p) return corrupt(`self-reference ${p}`)
      }
      if (list.length > 0) children.set(p, list.slice())
    }
    for (const [c, list] of Object.entries(dto.parents)) {
      if (!ids.has(c)) return corrupt(`unknown child ${c}`)
      if (new Set(list).size !== list.length) return corrupt(`duplicate parents in ${c}`)
      for (const p of list) if (!ids.has(p)) return corrupt(`unknown parent ${p}`)
      if (list.length > 0) parents.set(c, list.slice())
    }
    let edgesA = 0
    for (const [p, list] of children) {
      for (const c of list) {
        edgesA++
        if (!(parents.get(c) ?? EMPTY).includes(p)) return corrupt(`edge ${p}→${c} missing from parents`)
      }
    }
    let edgesB = 0
    for (const list of parents.values()) edgesB += list.length
    if (edgesA !== edgesB) return corrupt('children and parents do not match')

    if (new Set(dto.roots).size !== dto.roots.length) return corrupt('duplicate roots')
    const rootSet = new Set(dto.roots)
    for (const r of dto.roots) {
      if (!ids.has(r)) return corrupt(`unknown root ${r}`)
      if ((parents.get(r) ?? EMPTY).length > 0) return corrupt(`root ${r} has parents`)
    }
    for (const id of ids) {
      if ((parents.get(id) ?? EMPTY).length === 0 && !rootSet.has(id)) return corrupt(`orphan task ${id}`)
    }
    const graph = new TaskGraph(dto.roots.slice(), children, parents)
    if (graph.topoOrder().length !== ids.size) return corrupt('there is a cycle')
    return ok(graph)
  }

  toDTO(): StructureDTO {
    const children: Record<TaskId, TaskId[]> = {}
    const parents: Record<TaskId, TaskId[]> = {}
    for (const [id, list] of this.childMap) if (list.length > 0) children[id] = list.slice()
    for (const [id, list] of this.parentMap) if (list.length > 0) parents[id] = list.slice()
    return { roots: this.rootList.slice(), children, parents }
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  get size(): number {
    return this.parentMap.size
  }

  has(id: TaskId): boolean {
    return this.parentMap.has(id)
  }

  nodes(): IterableIterator<TaskId> {
    return this.parentMap.keys()
  }

  roots(): readonly TaskId[] {
    return this.rootList
  }

  children(id: TaskId): readonly TaskId[] {
    return this.childMap.get(id) ?? EMPTY
  }

  parents(id: TaskId): readonly TaskId[] {
    return this.parentMap.get(id) ?? EMPTY
  }

  /** List an edge lives in: the roots list if `parent` is null. */
  siblings(parent: TaskId | null): readonly TaskId[] {
    return parent === null ? this.rootList : this.children(parent)
  }

  primaryParent(id: TaskId): TaskId | null {
    return this.parents(id)[0] ?? null
  }

  isShared(id: TaskId): boolean {
    return this.parents(id).length > 1
  }

  isPrimaryEdge(parent: TaskId | null, child: TaskId): boolean {
    return parent === null ? this.parents(child).length === 0 : this.parents(child)[0] === parent
  }

  /** Descendants (not including `id`). */
  descendants(id: TaskId): Set<TaskId> {
    return this.walk(id, (n) => this.children(n))
  }

  /** Ancestors (not including `id`). */
  ancestors(id: TaskId): Set<TaskId> {
    return this.walk(id, (n) => this.parents(n))
  }

  /** Is `a` an ancestor of `b`? Searches upwards from `b`, which is usually the short way. */
  isAncestorOf(a: TaskId, b: TaskId): boolean {
    if (a === b) return false
    const seen = new Set<TaskId>()
    const stack = [...this.parents(b)]
    while (stack.length > 0) {
      const n = stack.pop()!
      if (n === a) return true
      if (seen.has(n)) continue
      seen.add(n)
      for (const p of this.parents(n)) if (!seen.has(p)) stack.push(p)
    }
    return false
  }

  private walk(start: TaskId, next: (id: TaskId) => readonly TaskId[]): Set<TaskId> {
    const out = new Set<TaskId>()
    const stack = [...next(start)]
    while (stack.length > 0) {
      const n = stack.pop()!
      if (out.has(n)) continue
      out.add(n)
      for (const m of next(n)) if (!out.has(m)) stack.push(m)
    }
    return out
  }

  /** Topological order (parents before children), stable with respect to the order of the lists. */
  topoOrder(): TaskId[] {
    const pending = new Map<TaskId, number>()
    for (const [id, ps] of this.parentMap) pending.set(id, ps.length)
    const order: TaskId[] = []
    const queue: TaskId[] = [...this.rootList]
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]!
      order.push(id)
      for (const c of this.children(id)) {
        const left = (pending.get(c) ?? 0) - 1
        pending.set(c, left)
        if (left === 0) queue.push(c)
      }
    }
    return order
  }

  /** Number of paths from the roots to each task (= occurrences in the expanded tree). */
  pathCounts(order: readonly TaskId[] = this.topoOrder()): Map<TaskId, number> {
    const paths = new Map<TaskId, number>()
    for (const id of order) {
      const ps = this.parents(id)
      if (ps.length === 0) {
        paths.set(id, 1)
      } else {
        let sum = 0
        for (const p of ps) sum = saturatingAdd(sum, paths.get(p) ?? 0)
        paths.set(id, sum)
      }
    }
    return paths
  }

  canLink(parent: TaskId, child: TaskId): Result<void, GraphError> {
    if (!this.has(parent) || !this.has(child)) return err(gErr('UNKNOWN', 'Unknown task', 'UNKNOWN_TASK'))
    if (parent === child) return err(gErr('SELF', 'A task cannot be a subtask of itself'))
    if (this.children(parent).includes(child)) return err(gErr('DUPLICATE', 'It is already a subtask of that task'))
    if (this.isAncestorOf(child, parent)) {
      return err(gErr('CYCLE', 'It would create a cycle: the destination task is inside that subtask', 'CYCLE_LINK'))
    }
    return ok(undefined)
  }

  // ─── Changes ──────────────────────────────────────────────────────────────

  private draft(): Draft {
    return { roots: this.rootList.slice(), children: new Map(this.childMap), parents: new Map(this.parentMap) }
  }

  private static commit(d: Draft): TaskGraph {
    return new TaskGraph(d.roots, d.children, d.parents)
  }

  addNode(id: TaskId, parent: TaskId | null, index?: number): Result<TaskGraph, GraphError> {
    if (this.has(id)) return err(gErr('EXISTS', 'The task already exists'))
    if (parent !== null && !this.has(parent)) return err(gErr('UNKNOWN', 'Unknown parent task', 'UNKNOWN_PARENT'))
    const d = this.draft()
    d.children.set(id, EMPTY)
    if (parent === null) {
      d.roots = insertAt(d.roots, id, index)
      d.parents.set(id, EMPTY)
    } else {
      d.children.set(parent, insertAt(this.children(parent), id, index))
      d.parents.set(id, [parent])
    }
    return ok(TaskGraph.commit(d))
  }

  /** Adds `child` as a subtask (shared if it already had other parents). */
  link(parent: TaskId, child: TaskId, index?: number): Result<TaskGraph, GraphError> {
    const check = this.canLink(parent, child)
    if (!check.ok) return check
    const d = this.draft()
    d.children.set(parent, insertAt(this.children(parent), child, index))
    const ps = this.parents(child)
    if (ps.length === 0) d.roots = d.roots.filter((r) => r !== child)
    d.parents.set(child, [...ps, parent])
    return ok(TaskGraph.commit(d))
  }

  /** Removes an edge. If it was the last parent, the task becomes a root (it is never orphaned). */
  unlink(parent: TaskId, child: TaskId): Result<TaskGraph, GraphError> {
    if (!this.children(parent).includes(child)) {
      return err(gErr('NO_EDGE', 'It is not a subtask of that task', 'NOT_A_CHILD'))
    }
    const d = this.draft()
    d.children.set(
      parent,
      this.children(parent).filter((c) => c !== child)
    )
    const ps = this.parents(child).filter((p) => p !== parent)
    d.parents.set(child, ps)
    if (ps.length === 0) d.roots.push(child)
    return ok(TaskGraph.commit(d))
  }

  setPrimary(child: TaskId, parent: TaskId): Result<TaskGraph, GraphError> {
    const ps = this.parents(child)
    if (!ps.includes(parent)) return err(gErr('NO_EDGE', 'It is not a subtask of that task', 'NOT_A_CHILD'))
    if (ps[0] === parent) return ok(this)
    const d = this.draft()
    d.parents.set(child, [parent, ...ps.filter((p) => p !== parent)])
    return ok(TaskGraph.commit(d))
  }

  /**
   * The only structural primitive: moves the edge `from → child` to `to` at position `index`.
   * `null` means the roots list. It keeps whether the edge was the primary one.
   * If `to` already had that child, both edges are merged.
   * When reordering within the same list, `index` is read after removing the item.
   */
  moveEdge(child: TaskId, from: TaskId | null, to: TaskId | null, index: number): Result<TaskGraph, GraphError> {
    if (!this.has(child)) return err(gErr('UNKNOWN', 'Unknown task', 'UNKNOWN_TASK'))
    if (!this.siblings(from).includes(child)) {
      return err(gErr('NO_EDGE', 'The task is not at that position', 'NOT_AT_POSITION'))
    }
    if (to !== null) {
      if (!this.has(to)) return err(gErr('UNKNOWN', 'Unknown destination task', 'UNKNOWN_TARGET'))
      if (to === child) return err(gErr('SELF', 'A task cannot be a subtask of itself'))
      if (to !== from && this.isAncestorOf(child, to)) {
        return err(gErr('CYCLE', 'It would create a cycle: the destination is inside the task you are moving', 'CYCLE_MOVE'))
      }
    }
    const d = this.draft()

    if (to === from) {
      const next = insertAt(
        this.siblings(from).filter((x) => x !== child),
        child,
        index
      )
      if (from === null) d.roots = next
      else d.children.set(from, next)
      return ok(TaskGraph.commit(d))
    }

    if (to === null) {
      const ps = this.parents(child)
      if (ps.length !== 1) {
        return err(
          gErr('SHARED_TO_ROOT', 'A shared subtask cannot move to the top level; remove it from its other parents first')
        )
      }
      d.children.set(
        from!,
        this.children(from!).filter((x) => x !== child)
      )
      d.parents.set(child, EMPTY)
      d.roots = insertAt(d.roots, child, index)
      return ok(TaskGraph.commit(d))
    }

    const ps = this.parents(child)
    const alreadyInTarget = this.children(to).includes(child)
    if (from === null) d.roots = d.roots.filter((x) => x !== child)
    else
      d.children.set(
        from,
        this.children(from).filter((x) => x !== child)
      )

    if (alreadyInTarget) {
      const wasPrimary = from !== null && ps[0] === from
      let next = ps.filter((p) => p !== from)
      if (wasPrimary) next = [to, ...next.filter((p) => p !== to)]
      d.parents.set(child, next)
    } else {
      d.children.set(to, insertAt(this.children(to), child, index))
      d.parents.set(child, from === null ? [to] : ps.map((p) => (p === from ? to : p)))
    }
    return ok(TaskGraph.commit(d))
  }

  /**
   * Cascade delete by mark and sweep: removes `id` and the descendants that would no longer
   * be reachable from the roots. Shared tasks with another path survive.
   */
  removeCascade(id: TaskId): { graph: TaskGraph; removed: Set<TaskId> } {
    if (!this.has(id)) return { graph: this, removed: new Set() }
    const reachable = new Set<TaskId>()
    const stack = this.rootList.filter((r) => r !== id)
    while (stack.length > 0) {
      const n = stack.pop()!
      if (reachable.has(n)) continue
      reachable.add(n)
      for (const c of this.children(n)) if (c !== id && !reachable.has(c)) stack.push(c)
    }
    const removed = new Set<TaskId>([id])
    for (const n of this.descendants(id)) if (!reachable.has(n)) removed.add(n)
    return { graph: this.withoutNodes(removed), removed }
  }

  /** What `removeCascade` would remove, without applying it (for the confirmation dialog). */
  previewCascade(id: TaskId): { removed: Set<TaskId>; kept: Set<TaskId> } {
    const { removed } = this.removeCascade(id)
    const kept = new Set<TaskId>()
    for (const n of this.descendants(id)) if (!removed.has(n)) kept.add(n)
    return { removed, kept }
  }

  private withoutNodes(removed: ReadonlySet<TaskId>): TaskGraph {
    const d = this.draft()
    d.roots = d.roots.filter((r) => !removed.has(r))
    for (const r of removed) {
      for (const p of this.parents(r)) {
        if (!removed.has(p))
          d.children.set(
            p,
            (d.children.get(p) ?? EMPTY).filter((x) => !removed.has(x))
          )
      }
      for (const c of this.children(r)) {
        if (!removed.has(c))
          d.parents.set(
            c,
            (d.parents.get(c) ?? EMPTY).filter((x) => !removed.has(x))
          )
      }
    }
    for (const r of removed) {
      d.children.delete(r)
      d.parents.delete(r)
    }
    return TaskGraph.commit(d)
  }

  /**
   * Removes `id` and moves its children up to its place in each parent. Children whose primary
   * parent was `id` inherit the primary parent of `id`. If `id` was a root, its children without
   * other parents become roots.
   */
  removeSplice(id: TaskId): TaskGraph {
    if (!this.has(id)) return this
    const d = this.draft()
    const ps = this.parents(id)
    const cs = this.children(id)

    for (const p of ps) {
      const list = d.children.get(p) ?? EMPTY
      const out: TaskId[] = []
      for (const x of list) {
        if (x === id) {
          for (const c of cs) if (!list.includes(c) && !out.includes(c)) out.push(c)
        } else if (!out.includes(x)) {
          out.push(x)
        }
      }
      d.children.set(p, out)
    }
    for (const c of cs) {
      const cur = d.parents.get(c) ?? EMPTY
      const out: TaskId[] = []
      for (const x of cur) {
        if (x === id) {
          for (const p of ps) if (!cur.includes(p) && !out.includes(p)) out.push(p)
        } else if (!out.includes(x)) {
          out.push(x)
        }
      }
      d.parents.set(c, out)
    }
    if (ps.length === 0) {
      const idx = d.roots.indexOf(id)
      const promoted = cs.filter((c) => (d.parents.get(c) ?? EMPTY).length === 0)
      d.roots.splice(idx, 1, ...promoted)
    }
    d.children.delete(id)
    d.parents.delete(id)
    return TaskGraph.commit(d)
  }

  /**
   * Copies `id` and all its descendants with new ids, keeping the internal sharing
   * (a diamond is copied as a diamond, not twice). The copy is placed under `parent` at `index`.
   */
  duplicateSubtree(
    id: TaskId,
    makeId: () => TaskId,
    parent: TaskId | null,
    index?: number
  ): Result<{ graph: TaskGraph; mapping: Map<TaskId, TaskId> }, GraphError> {
    if (!this.has(id)) return err(gErr('UNKNOWN', 'Unknown task', 'UNKNOWN_TASK'))
    if (parent !== null && !this.has(parent)) return err(gErr('UNKNOWN', 'Unknown parent task', 'UNKNOWN_PARENT'))
    const nodes = [id, ...this.descendants(id)]
    const mapping = new Map<TaskId, TaskId>()
    for (const n of nodes) mapping.set(n, makeId())
    const d = this.draft()
    for (const n of nodes) {
      const copy = mapping.get(n)!
      d.children.set(
        copy,
        this.children(n).map((c) => mapping.get(c)!)
      )
      d.parents.set(
        copy,
        n === id ? EMPTY : this.parents(n).flatMap((p) => (mapping.has(p) ? [mapping.get(p)!] : []))
      )
    }
    const rootCopy = mapping.get(id)!
    if (parent === null) {
      d.roots = insertAt(d.roots, rootCopy, index)
    } else {
      d.children.set(parent, insertAt(this.children(parent), rootCopy, index))
      d.parents.set(rootCopy, [parent])
    }
    return ok({ graph: TaskGraph.commit(d), mapping })
  }
}
