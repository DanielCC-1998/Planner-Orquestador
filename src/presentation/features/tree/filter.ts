import type { Estimation, ProjectState } from '@domain'
import { hasActiveFilters, type Filters } from '../../stores/ui'

function normalize(text: string): string {
  return text
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Tasks that meet every criterion of the filter; null if no filter is active. */
export function computeMatches(state: ProjectState, est: Estimation, filters: Filters): Set<string> | null {
  if (!hasActiveFilters(filters)) return null
  const text = normalize(filters.text.trim())
  const assignees = new Set(filters.assignees)
  const statuses = new Set(filters.statuses)
  const tags = new Set(filters.tags)
  const tagNames = new Map(state.meta.tags.map((t) => [t.id, t.name]))
  const out = new Set<string>()
  for (const task of state.tasks.values()) {
    if (text) {
      const code = est.codes.get(task.id) ?? ''
      const names = task.tagIds.map((id) => tagNames.get(id) ?? '').join(' ')
      const haystack = normalize(`${task.title} ${names}`)
      if (!haystack.includes(text) && !code.startsWith(text)) continue
    }
    if (assignees.size > 0 && !assignees.has(task.assigneeId ?? 'none')) continue
    if (statuses.size > 0 && !statuses.has(task.status)) continue
    if (tags.size > 0 && !task.tagIds.some((id) => tags.has(id))) continue
    const own = est.own.get(task.id)
    let flagsOk = true
    for (const flag of filters.flags) {
      if (flag === 'unestimated' && !own?.unestimated) flagsOk = false
      if (flag === 'unpriced' && !own?.unpriced) flagsOk = false
      if (flag === 'unassigned' && !own?.unassigned) flagsOk = false
      if (flag === 'shared' && !state.graph.isShared(task.id)) flagsOk = false
    }
    if (flagsOk) out.add(task.id)
  }
  return out
}

export { normalize as normalizeSearch }
