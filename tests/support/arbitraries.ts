import fc from 'fast-check'
import { TaskGraph, type StructureDTO } from '@domain/graph/TaskGraph'
import { TAG_COLORS, TASK_STATUSES, type Member, type PointScale, type ProjectState, type TagDef, type Task } from '@domain'
import { newState } from '@tests/support/builders'

const uuid = (i: number, prefix: string) => `${prefix}-0000-4000-8000-${i.toString(16).padStart(12, '0')}`
export const taskUuid = (i: number) => uuid(i, 'aaaaaaaa')
const memberUuid = (i: number) => uuid(i, 'bbbbbbbb')

export interface GeneratedProject {
  readonly state: ProjectState
  readonly ids: readonly string[]
}

/**
 * Random project with a DAG of up to `maxTasks` tasks: each task i picks 0 to
 * `maxParents` parents among the previous tasks (so there are no cycles). The order of the
 * parents is random, so the primary parent is random too.
 */
export function projectArb(maxTasks = 40, maxParents = 3): fc.Arbitrary<GeneratedProject> {
  return fc
    .record({
      n: fc.integer({ min: 1, max: maxTasks }),
      members: fc.integer({ min: 0, max: 3 }),
      seed: fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: maxTasks * 8, maxLength: maxTasks * 8 }),
      defaultRate: fc.option(fc.integer({ min: 0, max: 20_000 }), { nil: null }),
      contingencyBps: fc.integer({ min: 0, max: 5000 })
    })
    .map(({ n, members, seed, defaultRate, contingencyBps }) => {
      let k = 0
      const rnd = (mod: number) => (mod <= 0 ? 0 : seed[k++ % seed.length]! % mod)
      const ids = Array.from({ length: n }, (_, i) => taskUuid(i))
      const children: Record<string, string[]> = {}
      const parents: Record<string, string[]> = {}
      const roots: string[] = []
      for (let i = 0; i < n; i++) {
        const id = ids[i]!
        const want = i === 0 ? 0 : rnd(maxParents + 1)
        const chosen = new Set<string>()
        for (let j = 0; j < want; j++) chosen.add(ids[rnd(i)]!)
        const list = [...chosen]
        if (list.length === 0) roots.push(id)
        else parents[id] = list
        for (const p of list) (children[p] ??= []).push(id)
      }
      const dto: StructureDTO = { roots, children, parents }
      const g = TaskGraph.fromDTO(dto, ids)
      if (!g.ok) throw new Error(g.error.message)

      const memberList: Member[] = Array.from({ length: members }, (_, i) => ({
        id: memberUuid(i),
        name: `Person ${i}`,
        role: '',
        initials: `P${i}`,
        color: '#6366f1',
        rateCents: rnd(3) === 0 ? null : rnd(15_000),
        hoursPerDay: 1 + rnd(8)
      }))
      // Up to 3 project tags, given at random to the tasks.
      const tags: TagDef[] = Array.from({ length: rnd(4) }, (_, i) => ({ id: `tag-${i + 1}`, name: `Tag ${i + 1}`, color: TAG_COLORS[i]! }))
      const tasks = new Map<string, Task>()
      for (const id of ids) {
        const status = TASK_STATUSES[rnd(4)]!
        tasks.set(id, {
          id,
          title: `T ${id.slice(-4)}`,
          description: '',
          status,
          priority: 'medium',
          storyPoints: rnd(4) === 0 ? null : rnd(14),
          estimateMinutes: rnd(4) === 0 ? null : rnd(600),
          assigneeId: members > 0 && rnd(3) > 0 ? memberUuid(rnd(members)) : null,
          rateCents: rnd(5) === 0 ? rnd(10_000) : null,
          tagIds: tags.filter(() => rnd(2) === 0).map((t) => t.id),
          statusHistory: [{ at: '2026-01-01T00:00:00.000Z', from: null, to: status }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        })
      }
      // A story point scale in two of every three projects, so derived hours are covered too.
      const pointScale: PointScale | null =
        rnd(3) === 0
          ? null
          : { minutesPerPoint: 1 + rnd(240), overrides: rnd(2) === 0 ? [] : [{ points: 5, minutes: rnd(600) }] }
      const base = newState({ defaultRateCents: defaultRate })
      const state: ProjectState = {
        ...base,
        meta: { ...base.meta, contingencyBps, pointScale, tags },
        members: new Map(memberList.map((m) => [m.id, m])),
        tasks,
        graph: g.value
      }
      return { state, ids }
    })
}

/** Oracle: descendants by naive DFS. */
export function naiveDescendants(graph: TaskGraph, id: string): Set<string> {
  const out = new Set<string>()
  const visit = (n: string) => {
    for (const c of graph.children(n)) {
      if (!out.has(c)) {
        out.add(c)
        visit(c)
      }
    }
  }
  visit(id)
  return out
}

/** Checks every structural invariant by rebuilding the graph from its DTO. */
export function assertGraphInvariants(state: ProjectState): void {
  const rebuilt = TaskGraph.fromDTO(state.graph.toDTO(), state.tasks.keys())
  if (!rebuilt.ok) throw new Error(rebuilt.error.message)
  if (state.graph.size !== state.tasks.size) throw new Error('The graph and the tasks do not match')
  for (const id of state.tasks.keys()) if (!state.graph.has(id)) throw new Error(`Task outside the graph ${id}`)
}
