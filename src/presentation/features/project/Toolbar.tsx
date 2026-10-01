import { ArrowLeft, ArrowRight, ChevronsDownUp, ChevronsUpDown, Filter, KanbanSquare, ListTree, NotebookText, Plus, Search, Users, X } from 'lucide-react'
import { TASK_STATUSES } from '@domain'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../components/ui/menu'
import { Badge, Segmented, Tooltip } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { useProject } from '../../stores/project'
import { hasActiveFilters, useUi, type FilterFlag, type ProjectView } from '../../stores/ui'
import * as actions from '../tree/actions'
import { canonicalKey, idsToLevel } from '../tree/flatten'

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function Toolbar() {
  const { t } = useI18n()
  const state = useProject((s) => s.state)!
  const codes = useProject((s) => s.estimation?.codes)
  const readOnly = useProject((s) => s.readOnly)
  const view = useUi((s) => s.view)
  const setView = useUi((s) => s.setView)
  const filters = useUi((s) => s.filters)
  const setFilters = useUi((s) => s.setFilters)
  const clearFilters = useUi((s) => s.clearFilters)
  const focusId = useUi((s) => s.focusId)
  const focusBack = useUi((s) => s.focusBack)
  const focusForward = useUi((s) => s.focusForward)
  const showDescriptions = useUi((s) => s.showDescriptions)
  const toggleDescriptions = useUi((s) => s.toggleDescriptions)
  const members = [...state.members.values()]
  const active = hasActiveFilters(filters)
  const filterCount = filters.assignees.length + filters.statuses.length + filters.flags.length
  const alt = t.common.keys.alt
  const flagOptions: ReadonlyArray<{ flag: FilterFlag; label: string }> = [
    { flag: 'unestimated', label: t.toolbar.unestimated },
    { flag: 'unpriced', label: t.toolbar.noRate },
    { flag: 'unassigned', label: t.common.unassigned },
    { flag: 'shared', label: t.toolbar.shared }
  ]

  const expandTo = (level: number | 'all') => {
    const ui = useUi.getState()
    const ids = idsToLevel(state.graph, focusId, level === 'all' ? Number.MAX_SAFE_INTEGER : level)
    // What is expanded outside the current view is kept.
    ui.setExpanded(level === 'all' ? [...ui.expanded, ...ids] : ids)
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
      <Segmented<ProjectView>
        value={view}
        onChange={setView}
        options={[
          { value: 'tree', label: <><ListTree /> {t.toolbar.views.tree}</> },
          { value: 'board', label: <><KanbanSquare /> {t.toolbar.views.board}</> },
          { value: 'workload', label: <><Users /> {t.toolbar.views.workload}</> }
        ]}
      />

      <div className="relative ml-2">
        <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
        <Input
          value={filters.text}
          onChange={(e) => setFilters({ text: e.target.value })}
          placeholder={t.toolbar.filterPlaceholder}
          className="w-56 pl-8"
          onKeyDown={(e) => e.key === 'Escape' && setFilters({ text: '' })}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={filterCount > 0 ? 'outline' : 'ghost'} size="md">
            <Filter /> {t.toolbar.filters} {filterCount > 0 ? <Badge tone="primary">{filterCount}</Badge> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          <DropdownMenuLabel>{t.toolbar.assignee}</DropdownMenuLabel>
          {members.map((m) => (
            <DropdownMenuCheckItem
              key={m.id}
              checked={filters.assignees.includes(m.id)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => setFilters({ assignees: toggle(filters.assignees, m.id) })}
            >
              {m.name}
            </DropdownMenuCheckItem>
          ))}
          <DropdownMenuCheckItem
            checked={filters.assignees.includes('none')}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => setFilters({ assignees: toggle(filters.assignees, 'none') })}
          >
            {t.common.unassigned}
          </DropdownMenuCheckItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t.toolbar.status}</DropdownMenuLabel>
          {TASK_STATUSES.map((s) => (
            <DropdownMenuCheckItem
              key={s}
              checked={filters.statuses.includes(s)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => setFilters({ statuses: toggle(filters.statuses, s) })}
            >
              {t.status[s]}
            </DropdownMenuCheckItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t.toolbar.warnings}</DropdownMenuLabel>
          {flagOptions.map(({ flag, label }) => (
            <DropdownMenuCheckItem
              key={flag}
              checked={filters.flags.includes(flag)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => setFilters({ flags: toggle(filters.flags, flag) })}
            >
              {label}
            </DropdownMenuCheckItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {active ? (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X /> {t.toolbar.clear}
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {focusId ? (
          <div className="flex items-center gap-1 rounded-full bg-accent py-0.5 pl-1 pr-2 text-xs text-accent-foreground">
            <Tooltip content={`${t.toolbar.back} (${alt}+←)`}>
              <Button variant="ghost" size="icon-sm" className="size-6" disabled={focusBack.length === 0} onClick={() => useUi.getState().focusBackStep()}>
                <ArrowLeft />
              </Button>
            </Tooltip>
            <Tooltip content={t.toolbar.forward}>
              <Button variant="ghost" size="icon-sm" className="size-6" disabled={focusForward.length === 0} onClick={() => useUi.getState().focusForwardStep()}>
                <ArrowRight />
              </Button>
            </Tooltip>
            <span className="max-w-64 truncate font-medium">
              {t.toolbar.focused(`${codes?.get(focusId) ?? ''} ${state.tasks.get(focusId)?.title || t.common.untitled}`.trim())}
            </span>
            <Tooltip content={t.toolbar.showWholeProject}>
              <button type="button" onClick={() => useUi.getState().focus(null)} className="ml-1 rounded-full p-0.5 hover:bg-primary/15" aria-label={t.toolbar.exitFocus}>
                <X className="size-3.5" />
              </button>
            </Tooltip>
          </div>
        ) : null}
        {view !== 'workload' ? (
          <Tooltip content={`${showDescriptions ? t.toolbar.hideDescriptions : t.toolbar.showDescriptions} (${alt}+D)`}>
            <Button
              variant={showDescriptions ? 'outline' : 'ghost'}
              aria-pressed={showDescriptions}
              onClick={toggleDescriptions}
              className={showDescriptions ? 'border-primary/50 bg-accent text-accent-foreground' : ''}
            >
              <NotebookText /> {t.toolbar.descriptions}
            </Button>
          </Tooltip>
        ) : null}
        {view === 'tree' ? (
          <>
            <DropdownMenu>
              <Tooltip content={t.toolbar.expandToLevel}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t.toolbar.expandLevels}>
                    <ChevronsUpDown />
                  </Button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t.toolbar.showUpTo}</DropdownMenuLabel>
                {[1, 2, 3, 4, 5].map((l) => (
                  <DropdownMenuItem key={l} onSelect={() => expandTo(l)}>
                    {t.toolbar.level(l)}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onSelect={() => expandTo('all')}>{t.toolbar.all}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip content={t.toolbar.collapseAll}>
              <Button variant="ghost" size="icon" onClick={() => useUi.getState().setExpanded([])} aria-label={t.toolbar.collapseAll}>
                <ChevronsDownUp />
              </Button>
            </Tooltip>
          </>
        ) : null}
        {!readOnly ? (
          <Button
            variant="primary"
            onClick={() => void actions.createTask(focusId, focusId ? canonicalKey(state.graph, focusId) : null, undefined)}
          >
            <Plus /> {t.toolbar.newTask}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
