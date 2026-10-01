import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { naiveDescendants, projectArb } from '@tests/support/arbitraries'
import { TaskGraph } from '@domain/graph/TaskGraph'
import { canonicalCodes } from '@domain/graph/wbs'

function build(edges: Array<[string, string]>, nodes: string[]): TaskGraph {
  let g = TaskGraph.empty()
  for (const n of nodes) {
    const r = g.addNode(n, null)
    if (!r.ok) throw new Error(r.error.message)
    g = r.value
  }
  for (const [p, c] of edges) {
    const r = g.link(p, c)
    if (!r.ok) throw new Error(`${p}→${c}: ${r.error.message}`)
    g = r.value
  }
  return g
}

function roundTrip(g: TaskGraph): void {
  const r = TaskGraph.fromDTO(g.toDTO(), [...g.nodes()])
  expect(r.ok, r.ok ? '' : r.error.message).toBe(true)
}

describe('TaskGraph: rules', () => {
  it('rejects self links, duplicates and cycles', () => {
    const g = build(
      [
        ['A', 'B'],
        ['B', 'C']
      ],
      ['A', 'B', 'C']
    )
    expect(g.link('A', 'A')).toMatchObject({ ok: false, error: { code: 'SELF' } })
    expect(g.link('A', 'B')).toMatchObject({ ok: false, error: { code: 'DUPLICATE' } })
    expect(g.link('C', 'A')).toMatchObject({ ok: false, error: { code: 'CYCLE' } })
    // The shortcut A→C next to A→B→C is legal (it is not a cycle).
    expect(g.link('A', 'C').ok).toBe(true)
  })

  it('the roots are exactly the tasks without parents', () => {
    const g = build([['A', 'B']], ['A', 'B', 'C'])
    expect(g.roots()).toEqual(['A', 'C'])
    const u = g.unlink('A', 'B')
    expect(u.ok && u.value.roots()).toEqual(['A', 'C', 'B'])
  })

  it('sharing: the first parent is the primary one, and changing the primary moves it to the front', () => {
    const g = build(
      [
        ['A', 'S'],
        ['B', 'S']
      ],
      ['A', 'B', 'S']
    )
    expect(g.parents('S')).toEqual(['A', 'B'])
    expect(g.primaryParent('S')).toBe('A')
    const p = g.setPrimary('S', 'B')
    expect(p.ok && p.value.parents('S')).toEqual(['B', 'A'])
  })

  it('removing the primary edge promotes the next parent', () => {
    const g = build(
      [
        ['A', 'S'],
        ['B', 'S']
      ],
      ['A', 'B', 'S']
    )
    const r = g.unlink('A', 'S')
    expect(r.ok && r.value.primaryParent('S')).toBe('B')
  })

  it('moveEdge keeps whether the edge was the primary one', () => {
    const g = build(
      [
        ['A', 'S'],
        ['B', 'S']
      ],
      ['A', 'B', 'C', 'S']
    )
    const moved = g.moveEdge('S', 'A', 'C', 0)
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.value.parents('S')).toEqual(['C', 'B'])
    expect(moved.value.children('A')).toEqual([])
    expect(moved.value.children('C')).toEqual(['S'])
    roundTrip(moved.value)
  })

  it('moveEdge merges when the destination already had that child', () => {
    const g = build(
      [
        ['A', 'S'],
        ['B', 'S']
      ],
      ['A', 'B', 'S']
    )
    const moved = g.moveEdge('S', 'A', 'B', 0)
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.value.parents('S')).toEqual(['B'])
    expect(moved.value.children('B')).toEqual(['S'])
    roundTrip(moved.value)
  })

  it('moveEdge detects cycles when indenting under a descendant', () => {
    const g = build([['A', 'B']], ['A', 'B'])
    expect(g.moveEdge('A', null, 'B', 0)).toMatchObject({ ok: false, error: { code: 'CYCLE' } })
  })

  it('a shared subtask cannot move up to the top level', () => {
    const g = build(
      [
        ['A', 'S'],
        ['B', 'S']
      ],
      ['A', 'B', 'S']
    )
    expect(g.moveEdge('S', 'A', null, 0)).toMatchObject({ ok: false, error: { code: 'SHARED_TO_ROOT' } })
    const single = build([['A', 'X']], ['A', 'X'])
    const up = single.moveEdge('X', 'A', null, 1)
    expect(up.ok && up.value.roots()).toEqual(['A', 'X'])
  })

  it('reordering within the same list uses the index after removing the item', () => {
    const g = build(
      [
        ['P', 'a'],
        ['P', 'b'],
        ['P', 'c']
      ],
      ['P', 'a', 'b', 'c']
    )
    const down = g.moveEdge('a', 'P', 'P', 1)
    expect(down.ok && down.value.children('P')).toEqual(['b', 'a', 'c'])
    const up = g.moveEdge('c', 'P', 'P', 0)
    expect(up.ok && up.value.children('P')).toEqual(['c', 'a', 'b'])
  })

  it('cascade by mark and sweep (counterexample from the plan)', () => {
    // X→A, X→B, A→C, B→C, E→B: C is still reachable through E→B→C.
    const g = build(
      [
        ['X', 'A'],
        ['X', 'B'],
        ['A', 'C'],
        ['B', 'C'],
        ['E', 'B']
      ],
      ['X', 'E', 'A', 'B', 'C']
    )
    const { graph, removed } = g.removeCascade('X')
    expect([...removed].sort()).toEqual(['A', 'X'])
    expect(graph.parents('C')).toEqual(['B'])
    expect(graph.parents('B')).toEqual(['E'])
    roundTrip(graph)
  })

  it('splice moves the children up to the place of the task in each parent', () => {
    const g = build(
      [
        ['P1', 'X'],
        ['P2', 'X'],
        ['X', 'C1'],
        ['X', 'C2'],
        ['P2', 'C2']
      ],
      ['P1', 'P2', 'X', 'C1', 'C2']
    )
    const s = g.removeSplice('X')
    expect(s.children('P1')).toEqual(['C1', 'C2'])
    expect(s.children('P2')).toEqual(['C1', 'C2'])
    expect(s.parents('C1')).toEqual(['P1', 'P2'])
    roundTrip(s)
  })

  it('splice of a root: the children without other parents take its place', () => {
    const g = build(
      [
        ['R', 'a'],
        ['R', 'b'],
        ['Q', 'b']
      ],
      ['Q', 'R', 'a', 'b']
    )
    const s = g.removeSplice('R')
    expect(s.roots()).toEqual(['Q', 'a'])
    expect(s.parents('b')).toEqual(['Q'])
    roundTrip(s)
  })

  it('duplicating copies a diamond as a diamond', () => {
    const g = build(
      [
        ['X', 'A'],
        ['X', 'B'],
        ['A', 'C'],
        ['B', 'C']
      ],
      ['X', 'A', 'B', 'C']
    )
    let n = 0
    const r = g.duplicateSubtree('X', () => `copy${n++}`, null)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const { graph, mapping } = r.value
    expect(mapping.size).toBe(4)
    const cCopy = mapping.get('C')!
    expect(graph.parents(cCopy)).toHaveLength(2)
    expect(graph.size).toBe(8)
    roundTrip(graph)
  })

  it('positional canonical WBS codes', () => {
    const g = build(
      [
        ['L', 'T'],
        ['L', 'F'],
        ['R', 'T'],
        ['R', 'V']
      ],
      ['L', 'R', 'T', 'F', 'V']
    )
    const codes = canonicalCodes(g)
    expect(codes.get('L')).toBe('1')
    expect(codes.get('T')).toBe('1.1')
    expect(codes.get('F')).toBe('1.2')
    expect(codes.get('R')).toBe('2')
    expect(codes.get('V')).toBe('2.2') // the reference to T takes 2.1
  })

  it('fromDTO rejects corrupt structures', () => {
    expect(TaskGraph.fromDTO({ roots: ['A'], children: { A: ['B'] }, parents: {} }, ['A', 'B']).ok).toBe(false)
    expect(
      TaskGraph.fromDTO({ roots: [], children: { A: ['B'], B: ['A'] }, parents: { A: ['B'], B: ['A'] } }, ['A', 'B']).ok
    ).toBe(false)
    expect(TaskGraph.fromDTO({ roots: [], children: {}, parents: {} }, ['A']).ok).toBe(false)
  })
})

describe('TaskGraph: error reasons', () => {
  it('errors carry a reason when the code alone is not specific enough for the UI', () => {
    const g = build([['A', 'B']], ['A', 'B', 'C'])
    expect(g.link('B', 'A')).toMatchObject({ ok: false, error: { code: 'CYCLE', reason: 'CYCLE_LINK' } })
    expect(g.moveEdge('A', null, 'B', 0)).toMatchObject({ ok: false, error: { code: 'CYCLE', reason: 'CYCLE_MOVE' } })
    expect(g.link('A', 'Z')).toMatchObject({ ok: false, error: { code: 'UNKNOWN', reason: 'UNKNOWN_TASK' } })
    expect(g.moveEdge('Z', null, 'A', 0)).toMatchObject({ ok: false, error: { code: 'UNKNOWN', reason: 'UNKNOWN_TASK' } })
    expect(g.moveEdge('C', null, 'Z', 0)).toMatchObject({ ok: false, error: { code: 'UNKNOWN', reason: 'UNKNOWN_TARGET' } })
    expect(g.addNode('D', 'Z')).toMatchObject({ ok: false, error: { code: 'UNKNOWN', reason: 'UNKNOWN_PARENT' } })
    expect(g.duplicateSubtree('A', () => 'copy', 'Z')).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN', reason: 'UNKNOWN_PARENT' }
    })
    expect(g.unlink('A', 'C')).toMatchObject({ ok: false, error: { code: 'NO_EDGE', reason: 'NOT_A_CHILD' } })
    expect(g.setPrimary('B', 'C')).toMatchObject({ ok: false, error: { code: 'NO_EDGE', reason: 'NOT_A_CHILD' } })
    expect(g.moveEdge('B', null, 'C', 0)).toMatchObject({ ok: false, error: { code: 'NO_EDGE', reason: 'NOT_AT_POSITION' } })
  })

  it('errors whose code says it all carry no reason', () => {
    const g = build(
      [
        ['A', 'S'],
        ['B', 'S']
      ],
      ['A', 'B', 'S']
    )
    const results = [g.link('A', 'A'), g.link('A', 'S'), g.moveEdge('S', 'A', null, 0), g.addNode('A', null)]
    expect(results.map((r) => (r.ok ? 'ok' : r.error.code))).toEqual(['SELF', 'DUPLICATE', 'SHARED_TO_ROOT', 'EXISTS'])
    for (const r of results) if (!r.ok) expect(r.error).not.toHaveProperty('reason')
  })

  it('a corrupt structure carries the detail as a parameter', () => {
    expect(TaskGraph.fromDTO({ roots: [], children: {}, parents: {} }, ['A'])).toEqual({
      ok: false,
      error: {
        code: 'CORRUPT',
        message: 'Invalid task structure: orphan task A',
        reason: 'GRAPH_CORRUPT',
        params: { detail: 'orphan task A' }
      }
    })
  })
})

describe('TaskGraph: properties', () => {
  it('link fails ⇔ self ∨ duplicate ∨ cycle (DFS oracle)', () => {
    fc.assert(
      fc.property(projectArb(25), fc.nat(), fc.nat(), ({ state, ids }, i, j) => {
        const g = state.graph
        const p = ids[i % ids.length]!
        const c = ids[j % ids.length]!
        const expectedFail = p === c || g.children(p).includes(c) || naiveDescendants(g, c).has(p)
        const r = g.link(p, c)
        expect(r.ok).toBe(!expectedFail)
        if (r.ok) roundTrip(r.value)
      }),
      { numRuns: 300 }
    )
  })

  it('cascade = oracle of reachability from the other roots', () => {
    fc.assert(
      fc.property(projectArb(25), fc.nat(), ({ state, ids }, i) => {
        const g = state.graph
        const x = ids[i % ids.length]!
        const { graph, removed } = g.removeCascade(x)
        // Oracle: n ∈ D(x) survives if some other root reaches it without going through x.
        const survives = (n: string) =>
          g.roots().some((r) => {
            if (r === x) return false
            const seen = new Set<string>()
            const stack = [r]
            while (stack.length) {
              const m = stack.pop()!
              if (m === n) return true
              if (seen.has(m)) continue
              seen.add(m)
              for (const ch of g.children(m)) if (ch !== x) stack.push(ch)
            }
            return false
          })
        const expected = new Set([x, ...[...naiveDescendants(g, x)].filter((n) => !survives(n))])
        expect([...removed].sort()).toEqual([...expected].sort())
        roundTrip(graph)
      }),
      { numRuns: 200 }
    )
  })

  it('moveEdge keeps the tasks, acyclicity and the primary parent rule', () => {
    fc.assert(
      fc.property(projectArb(25), fc.nat(), fc.nat(), fc.nat(), ({ state, ids }, i, j, k) => {
        const g = state.graph
        const child = ids[i % ids.length]!
        const ps = g.parents(child)
        const from = ps.length === 0 ? null : ps[j % ps.length]!
        const to = k % 5 === 0 ? null : ids[k % ids.length]!
        const wasPrimary = from !== null && ps[0] === from
        const r = g.moveEdge(child, from, to, k % 4)
        if (!r.ok) return
        roundTrip(r.value)
        expect(r.value.size).toBe(g.size)
        if (wasPrimary && to !== null) expect(r.value.parents(child)[0]).toBe(to)
      }),
      { numRuns: 300 }
    )
  })

  it('splice and duplicate keep a valid DAG', () => {
    fc.assert(
      fc.property(projectArb(25), fc.nat(), ({ state, ids }, i) => {
        const x = ids[i % ids.length]!
        const spliced = state.graph.removeSplice(x)
        roundTrip(spliced)
        expect(spliced.size).toBe(state.graph.size - 1)
        let n = 0
        const dup = state.graph.duplicateSubtree(x, () => `dup-${n++}`, state.graph.primaryParent(x))
        expect(dup.ok).toBe(true)
        if (dup.ok) {
          roundTrip(dup.value.graph)
          expect(dup.value.graph.size).toBe(state.graph.size + naiveDescendants(state.graph, x).size + 1)
        }
      }),
      { numRuns: 200 }
    )
  })
})
