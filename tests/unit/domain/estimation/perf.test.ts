import { describe, expect, it } from 'vitest'
import { TaskGraph, type StructureDTO } from '@domain/graph/TaskGraph'
import type { ProjectState, Task } from '@domain'
import { newState } from '@tests/support/builders'
import { branchMetrics, estimate } from '@domain/estimation/estimate'

/** Big project: 5,000 tasks in a tree (up to 8 levels) + 10% shared edges. */
function bigProject(n = 5000): ProjectState {
  let seed = 42
  const rnd = (mod: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed % mod
  }
  const ids = Array.from({ length: n }, (_, i) => `aaaaaaaa-0000-4000-8000-${i.toString(16).padStart(12, '0')}`)
  const depth = new Map<string, number>()
  const children: Record<string, string[]> = {}
  const parents: Record<string, string[]> = {}
  const roots: string[] = []
  ids.forEach((id, i) => {
    if (i < 12) {
      roots.push(id)
      depth.set(id, 0)
      return
    }
    let p = ids[rnd(i)]!
    while ((depth.get(p) ?? 0) >= 7) p = ids[rnd(i)]!
    depth.set(id, (depth.get(p) ?? 0) + 1)
    parents[id] = [p]
    ;(children[p] ??= []).push(id)
  })
  // 10%: a second edge pointing back (a parent with a lower index = no cycles).
  for (let k = 0; k < n / 10; k++) {
    const i = 12 + rnd(n - 12)
    const child = ids[i]!
    const p = ids[rnd(i)]!
    if (p === child || parents[child]?.includes(p)) continue
    parents[child]!.push(p)
    ;(children[p] ??= []).push(child)
  }
  const dto: StructureDTO = { roots, children, parents }
  const graph = TaskGraph.fromDTO(dto, ids)
  if (!graph.ok) throw new Error(graph.error.message)
  const tasks = new Map<string, Task>()
  for (const id of ids) {
    tasks.set(id, {
      id,
      title: `Task ${id.slice(-4)}`,
      description: '',
      status: rnd(4) === 0 ? 'done' : 'todo',
      priority: 'medium',
      storyPoints: rnd(8),
      estimateMinutes: 30 + rnd(480),
      assigneeId: null,
      rateCents: null,
      tagIds: [],
      statusHistory: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
  }
  return { ...newState({ defaultRateCents: 5000 }), tasks, graph: graph.value }
}

describe('performance', () => {
  it('5,000 tasks with 10% shared: estimate < 50 ms on average', () => {
    const state = bigProject()
    estimate(state) // warm-up
    const runs = 10
    const t0 = performance.now()
    let est = estimate(state)
    for (let i = 1; i < runs; i++) est = estimate(state)
    const avg = (performance.now() - t0) / runs
    console.log(`estimate(5000 tasks, ${est.shared.length} shared): ${avg.toFixed(1)} ms`)
    expect(est.total.tasks).toBe(5000)
    expect(avg).toBeLessThan(50)
  })

  it('the full branch of a root is computed in a few milliseconds', () => {
    const state = bigProject()
    const est = estimate(state)
    const t0 = performance.now()
    for (const r of state.graph.roots()) branchMetrics(state.graph, est.own, r)
    const ms = performance.now() - t0
    console.log(`full branch of 12 roots: ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(100)
  })
})
