import { describe, expect, it } from 'vitest'
import { canonicalCodes, TaskGraph } from '@domain'
import { canonicalKey, flatten, idsToLevel } from '@presentation/features/tree/flatten'

function build(edges: Array<[string, string]>, nodes: string[]): TaskGraph {
  let g = TaskGraph.empty()
  for (const n of nodes) {
    const r = g.addNode(n, null)
    if (!r.ok) throw new Error(r.error.message)
    g = r.value
  }
  for (const [p, c] of edges) {
    const r = g.link(p, c)
    if (!r.ok) throw new Error(r.error.message)
    g = r.value
  }
  return g
}

// Login(L){ Table(T), Form(F) }, Register(R){ T (reference), Validation(V) }; T has a child X.
const g = build(
  [
    ['L', 'T'],
    ['L', 'F'],
    ['R', 'T'],
    ['R', 'V'],
    ['T', 'X']
  ],
  ['L', 'R', 'T', 'F', 'V', 'X']
)
const codes = canonicalCodes(g)
const base = { graph: g, codes, focusId: null, peeks: new Set<string>(), matches: null }

describe('flatten', () => {
  it('shows only the top level when nothing is expanded', () => {
    const rows = flatten({ ...base, expanded: new Set() })
    expect(rows.map((r) => r.code)).toEqual(['1', '2'])
  })

  it('does not expand references even if their task is expanded', () => {
    const rows = flatten({ ...base, expanded: new Set(['L', 'R', 'T']) })
    expect(rows.map((r) => `${r.code}${r.canonical ? '' : '↗'}`)).toEqual(['1', '1.1', '1.1.1', '1.2', '2', '2.1↗', '2.2'])
    const ref = rows.find((r) => r.code === '2.1')!
    expect(ref.expanded).toBe(false)
    expect(ref.key).toBe('R/T')
  })

  it('a peek opens the reference, and its children are references too', () => {
    const rows = flatten({ ...base, expanded: new Set(['L', 'R', 'T']), peeks: new Set(['R/T']) })
    const x = rows.find((r) => r.key === 'R/T/X')!
    expect(x.canonical).toBe(false)
    expect(x.code).toBe('2.1.1')
    expect(rows[x.parentRow]!.key).toBe('R/T')
  })

  it('focusing a task uses its code and canonical keys', () => {
    const rows = flatten({ ...base, focusId: 'T', expanded: new Set() })
    expect(rows.map((r) => [r.code, r.key, r.depth])).toEqual([['1.1.1', 'L/T/X', 0]])
    expect(canonicalKey(g, 'X')).toBe('L/T/X')
  })

  it('with a filter, follows only primary edges and marks the context', () => {
    const rows = flatten({ ...base, expanded: new Set(), matches: new Set(['X', 'V']) })
    expect(rows.map((r) => `${r.code}${r.context ? '·' : ''}`)).toEqual(['1·', '1.1·', '1.1.1', '2·', '2.2'])
  })

  it('expanding down to a level does not include references', () => {
    expect(idsToLevel(g, null, 1)).toEqual([])
    expect(new Set(idsToLevel(g, null, 2))).toEqual(new Set(['L', 'R']))
    expect(new Set(idsToLevel(g, null, 5))).toEqual(new Set(['L', 'R', 'T']))
  })

  it('handles unlimited depth without recursion', () => {
    let deep = TaskGraph.empty()
    const ids = Array.from({ length: 5000 }, (_, i) => `n${i}`)
    let parent: string | null = null
    for (const id of ids) {
      const r = deep.addNode(id, parent)
      if (!r.ok) throw new Error(r.error.message)
      deep = r.value
      parent = id
    }
    const rows = flatten({ graph: deep, codes: canonicalCodes(deep), focusId: null, expanded: new Set(ids), peeks: new Set(), matches: null })
    expect(rows).toHaveLength(5000)
    expect(rows[4999]!.depth).toBe(4999)
  })
})
