import { useEffect } from 'react'
import { DatabaseBackup, FileDown, Loader2, Settings2, Tags, Users } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Avatar, Badge, Tooltip } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { readJson } from '../../lib/storage'
import { useCatalog } from '../../stores/catalog'
import { useProject } from '../../stores/project'
import { useUi } from '../../stores/ui'
import { BoardView } from '../board/BoardView'
import { TaskDetailPanel } from '../detail/TaskDetailPanel'
import { SummaryBar } from '../summary/SummaryBar'
import { idsToLevel } from '../tree/flatten'
import { TreeView } from '../tree/TreeView'
import { WorkloadView } from '../workload/WorkloadView'
import { Toolbar } from './Toolbar'

function ProjectHeader() {
  const { t } = useI18n()
  const state = useProject((s) => s.state)!
  const openDialog = useUi((s) => s.openDialog)
  const { meta } = state
  const members = [...state.members.values()]
  return (
    <div className="flex shrink-0 items-center gap-4 px-4 pb-1 pt-3">
      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight">{meta.name}</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{meta.client || t.common.noClient}</span>
          <Badge>{meta.currency}</Badge>
          {meta.archived ? <Badge tone="warning">{t.toolbar.archived}</Badge> : null}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => openDialog({ type: 'team' })}
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent"
        >
          <div className="flex -space-x-1.5">
            {members.slice(0, 4).map((m) => (
              <Avatar key={m.id} name={m.name} initials={m.initials} color={m.color} />
            ))}
          </div>
          <span className="flex items-center gap-1 text-sm font-medium">
            <Users className="size-4" /> {t.toolbar.team(members.length)}
          </span>
        </button>
        <Button variant="outline" onClick={() => openDialog({ type: 'tags' })}>
          <Tags /> {t.tags.button}
        </Button>
        <Button variant="outline" onClick={() => openDialog({ type: 'projectSettings' })}>
          <Settings2 /> {t.toolbar.projectSettings}
        </Button>
        <Tooltip content={t.toolbar.exportBackup}>
          <Button variant="outline" size="icon" onClick={() => void useCatalog.getState().exportJson(meta.id)} aria-label={t.toolbar.exportBackup}>
            <DatabaseBackup />
          </Button>
        </Tooltip>
        <Button variant="primary" onClick={() => openDialog({ type: 'exportPdf', projectId: meta.id, currency: meta.currency })}>
          <FileDown /> {t.toolbar.exportPdf}
        </Button>
      </div>
    </div>
  )
}

export function ProjectScreen({ id }: { id: string }) {
  const { t } = useI18n()
  const loaded = useProject((s) => s.id === id && s.state !== null)
  const view = useUi((s) => s.view)
  const detailOpen = useUi((s) => s.detailOpen)

  useEffect(() => {
    let cancelled = false
    void useProject
      .getState()
      .open(id)
      .then((ok) => {
        if (cancelled) return
        if (!ok) {
          useUi.getState().goProjects()
          return
        }
        // First time: the first level is expanded so the structure is visible.
        if (readJson<string[] | null>(`planner:expanded:${id}`, null) === null) {
          const state = useProject.getState().state
          if (state) useUi.getState().setExpanded(idsToLevel(state.graph, null, 2))
        }
      })
    return () => {
      cancelled = true
      useProject.getState().close()
    }
  }, [id])

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> {t.toolbar.opening}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ProjectHeader />
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {view === 'tree' ? <TreeView /> : view === 'board' ? <BoardView /> : <WorkloadView />}
        </div>
        {detailOpen ? <TaskDetailPanel /> : null}
      </div>
      <SummaryBar />
    </div>
  )
}
