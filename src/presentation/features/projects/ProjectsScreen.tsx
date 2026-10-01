import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Copy,
  FileDown,
  FileJson,
  FolderOpen,
  FolderPlus,
  Link2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload
} from 'lucide-react'
import type { ProjectCard } from '@application'
import { confirmDanger } from '../../components/feedback'
import { Button } from '../../components/ui/button'
import { Input, NativeSelect } from '../../components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../components/ui/menu'
import { Avatar, Badge, EmptyState, ProgressBar, Tooltip } from '../../components/ui/misc'
import { getI18n, useI18n } from '../../i18n'
import { call, errorMessage } from '../../lib/api'
import { useCatalog } from '../../stores/catalog'
import { toast } from '../../stores/toasts'
import { useUi } from '../../stores/ui'

async function setArchived(card: ProjectCard, archived: boolean) {
  try {
    await call('project.open', { id: card.id })
    await call('project.command', { id: card.id, command: { type: 'project.update', patch: { archived } } })
    await call('project.close', { id: card.id })
    await useCatalog.getState().refresh()
    const { notices } = getI18n().t.projects
    toast.success(archived ? notices.archived : notices.restored)
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

function ProjectCardView({ card }: { card: ProjectCard }) {
  const { t, f } = useI18n()
  const openProject = useUi((s) => s.openProject)
  const openDialog = useUi((s) => s.openDialog)
  const catalog = useCatalog()

  const remove = async () => {
    const { trash } = t.projects
    const ok = await confirmDanger(trash.title(card.name), trash.description, trash.confirm)
    if (ok && (await catalog.trash(card.id))) toast.success(getI18n().t.projects.notices.trashed)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openProject(card.id)}
      onKeyDown={(e) => e.key === 'Enter' && openProject(card.id)}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="h-1.5" style={{ backgroundColor: card.color }} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[15px] font-semibold leading-snug">{card.name}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{card.client || t.common.noClient}</div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 -mt-1 opacity-60 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
                aria-label={t.projects.card.actions}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => openProject(card.id)}>
                <FolderOpen /> {t.projects.card.open}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void catalog.duplicate(card.id)}>
                <Copy /> {t.projects.card.duplicate}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => openDialog({ type: 'exportPdf', projectId: card.id, currency: card.currency })}>
                <FileDown /> {t.projects.card.exportPdf}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void catalog.exportJson(card.id)}>
                <FileJson /> {t.projects.card.exportJson}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {card.archived ? (
                <DropdownMenuItem onSelect={() => void setArchived(card, false)}>
                  <ArchiveRestore /> {t.projects.card.restore}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void setArchived(card, true)}>
                  <Archive /> {t.projects.card.archive}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem danger onSelect={() => void remove()}>
                <Trash2 /> {t.projects.card.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-2.5">
          <Stat label={t.projects.card.tasks} value={String(card.taskCount)} />
          <Stat label={t.projects.card.hours} value={f.hours(card.totalMinutes)} />
          <Stat label={t.projects.card.cost} value={f.money(card.totalCostCents, card.currency, false)} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{t.projects.card.storyPoints(f.storyPoints(card.storyPoints))}</Badge>
          <Badge>{card.currency}</Badge>
          {card.sharedCount > 0 ? (
            <Tooltip content={t.projects.card.sharedTip}>
              <span>
                <Badge tone="shared">
                  <Link2 className="size-3" /> {card.sharedCount}
                </Badge>
              </span>
            </Tooltip>
          ) : null}
          {card.archived ? <Badge tone="warning">{t.projects.card.archived}</Badge> : null}
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t.projects.card.progress}</span>
            <span className="tabular-nums">{f.percent(card.progress)}</span>
          </div>
          <ProgressBar value={card.progress} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {card.members.slice(0, 5).map((m) => (
              <Avatar key={`${m.name}${m.initials}`} name={m.name} initials={m.initials} color={m.color} />
            ))}
            {card.members.length > 5 ? (
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-card">
                +{card.members.length - 5}
              </span>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">{f.relative(card.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export function ProjectsScreen() {
  const { t, f } = useI18n()
  const { cards, loaded, refresh, importJson } = useCatalog()
  const openDialog = useUi((s) => s.openDialog)
  const openProject = useUi((s) => s.openProject)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'name' | 'cost'>('recent')
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const archivedCount = cards.filter((c) => c.archived).length
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es')
    const list = cards.filter(
      (c) =>
        c.archived === showArchived &&
        (!q || c.name.toLocaleLowerCase('es').includes(q) || c.client.toLocaleLowerCase('es').includes(q))
    )
    if (sort === 'name') list.sort((a, b) => f.compare(a.name, b.name))
    if (sort === 'cost') list.sort((a, b) => b.totalCostCents - a.totalCostCents)
    return list
  }, [cards, query, sort, showArchived, f])

  const doImport = async () => {
    const card = await importJson()
    if (card) openProject(card.id)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-8 py-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <h1 className="text-2xl font-bold tracking-tight">{showArchived ? t.projects.archivedTitle : t.projects.title}</h1>
            <p className="text-sm text-muted-foreground">{t.projects.intro}</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.projects.search}
              className="w-64 pl-8"
            />
          </div>
          <NativeSelect
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="w-40"
            aria-label={t.projects.sortLabel}
          >
            <option value="recent">{t.projects.sort.recent}</option>
            <option value="name">{t.projects.sort.name}</option>
            <option value="cost">{t.projects.sort.cost}</option>
          </NativeSelect>
          {archivedCount > 0 || showArchived ? (
            <Button variant="ghost" onClick={() => setShowArchived(!showArchived)}>
              <Archive /> {showArchived ? t.projects.showActive : t.projects.showArchived(archivedCount)}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => void doImport()}>
            <Upload /> {t.projects.import}
          </Button>
          <Button variant="primary" onClick={() => openDialog({ type: 'newProject' })}>
            <Plus /> {t.projects.newProject}
          </Button>
        </div>

        {loaded && cards.length === 0 ? (
          <EmptyState
            icon={<FolderPlus />}
            title={t.projects.empty.title}
            description={t.projects.empty.description}
            action={
              <Button variant="primary" size="lg" onClick={() => openDialog({ type: 'newProject' })}>
                <Plus /> {t.projects.newProject}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4">
            {visible.map((card) => (
              <ProjectCardView key={card.id} card={card} />
            ))}
            {!showArchived ? (
              <button
                type="button"
                onClick={() => openDialog({ type: 'newProject' })}
                className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition hover:border-primary/50 hover:bg-accent/40 hover:text-foreground"
              >
                <Plus className="size-6" />
                <span className="text-sm font-medium">{t.projects.newProject}</span>
              </button>
            ) : null}
          </div>
        )}
        {loaded && cards.length > 0 && visible.length === 0 && query ? (
          <p className="text-center text-sm text-muted-foreground">{t.projects.noMatch(query)}</p>
        ) : null}
      </div>
    </div>
  )
}
