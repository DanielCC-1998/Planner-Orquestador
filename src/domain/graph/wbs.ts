import type { TaskId } from '../common/primitives'
import type { TaskGraph } from './TaskGraph'

/**
 * Canonical WBS code of each task ("1.2.3"), following the primary edges.
 * Numbering is positional among ALL the children (references take a number too),
 * so it matches what is shown in the tree and in the PDF.
 */
export function canonicalCodes(graph: TaskGraph): Map<TaskId, string> {
  const codes = new Map<TaskId, string>()
  const stack: Array<[TaskId, string]> = graph.roots().map((r, i) => [r, String(i + 1)])
  while (stack.length > 0) {
    const [id, code] = stack.pop()!
    codes.set(id, code)
    const cs = graph.children(id)
    for (let i = cs.length - 1; i >= 0; i--) {
      const c = cs[i]!
      if (graph.primaryParent(c) === id) stack.push([c, `${code}.${i + 1}`])
    }
  }
  return codes
}

export function codeDepth(code: string): number {
  return code.split('.').length
}

/** Prefix of the code down to the given depth ("1.2.3", 2 → "1.2"). */
export function codePrefix(code: string, depth: number): string {
  return code.split('.').slice(0, depth).join('.')
}

/** Order of WBS codes, number by number: 1.2 < 1.10 < 2 (a plain string comparison puts 1.10 first). */
export function compareCodes(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const diff = Number(pa[i]) - Number(pb[i])
    if (diff !== 0) return diff
  }
  return pa.length - pb.length
}
