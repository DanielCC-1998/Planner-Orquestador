import { Fragment } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Keyboard,
  Languages,
  Loader2,
  Monitor,
  Moon,
  Redo2,
  Search,
  Settings,
  Sun,
  Undo2
} from 'lucide-react'
import type { ThemePreference } from '@application'
import logo from '../assets/logo.svg'
import { Button } from '../components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/menu'
import { Kbd, Tooltip } from '../components/ui/misc'
import { canonicalPath } from '../features/tree/flatten'
import { useI18n } from '../i18n'
import { useLanguageOptions } from '../i18n/useLanguageOptions'
import { cn } from '../lib/cn'
import { useProject } from '../stores/project'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'

function ThemeMenu() {
  const { t } = useI18n()
  const theme = useSettings((s) => s.settings?.theme ?? 'system')
  const setTheme = useSettings((s) => s.setTheme)
  const themes: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: 'light', label: t.common.theme.light, icon: Sun },
    { value: 'dark', label: t.common.theme.dark, icon: Moon },
    { value: 'system', label: t.common.theme.system, icon: Monitor }
  ]
  const Current = themes.find((th) => th.value === theme)?.icon ?? Monitor
  return (
    <DropdownMenu>
      <Tooltip content={t.app.themeTip}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t.common.theme.label}>
            <Current />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        {themes.map((th) => (
          <DropdownMenuItem key={th.value} onSelect={() => void setTheme(th.value)}>
            <th.icon />
            {th.label}
            {th.value === theme ? <Check className="ml-auto !text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LanguageMenu() {
  const { t } = useI18n()
  const preference = useSettings((s) => s.settings?.language ?? 'system')
  const setLanguage = useSettings((s) => s.setLanguage)
  const options = useLanguageOptions()
  return (
    <DropdownMenu>
      <Tooltip content={t.common.language.label}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t.common.language.label}>
            <Languages />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => void setLanguage(o.value)}>
            {o.label}
            {o.value === preference ? <Check className="ml-auto !text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SaveIndicator() {
  const { t } = useI18n()
  const status = useProject((s) => s.saveStatus)
  const readOnly = useProject((s) => s.readOnly)
  if (readOnly) return <span className="text-xs text-warning">{t.common.readOnly}</span>
  if (!status) return null
  if (status.state === 'saving')
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> {t.app.saving}
      </span>
    )
  if (status.state === 'error')
    return (
      <Tooltip content={status.message}>
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="size-3.5" /> {t.app.saveError}
        </span>
      </Tooltip>
    )
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="size-3.5 text-success" /> {t.app.saved}
    </span>
  )
}

function Breadcrumbs() {
  const { t } = useI18n()
  const route = useUi((s) => s.route)
  const focusId = useUi((s) => s.focusId)
  const goProjects = useUi((s) => s.goProjects)
  const focus = useUi((s) => s.focus)
  const state = useProject((s) => s.state)
  const codes = useProject((s) => s.estimation?.codes)

  const crumbs: Array<{ key: string; label: string; onClick?: () => void; color?: string }> = [
    { key: 'projects', label: t.app.projects, onClick: goProjects }
  ]
  if (route.name === 'project' && state) {
    crumbs.push({ key: 'project', label: state.meta.name, color: state.meta.color, onClick: () => focus(null) })
    if (focusId && state.graph.has(focusId)) {
      const path = canonicalPath(state.graph, focusId)
      const items = path.map((id) => ({
        key: id,
        label: `${codes?.get(id) ?? ''} ${state.tasks.get(id)?.title || t.common.untitled}`.trim(),
        onClick: () => focus(id)
      }))
      // Long paths are shortened in the middle: first, …, last two.
      if (items.length > 4) {
        crumbs.push(items[0]!, { key: 'ellipsis', label: '…' }, ...items.slice(-2))
      } else crumbs.push(...items)
    }
  }
  return (
    <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label={t.app.breadcrumbs}>
      {crumbs.map((c, i) => (
        <Fragment key={c.key}>
          {i > 0 ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" /> : null}
          <button
            type="button"
            onClick={c.onClick}
            disabled={!c.onClick || i === crumbs.length - 1}
            className={cn(
              'flex min-w-0 items-center gap-1.5 truncate rounded px-1.5 py-0.5',
              i === crumbs.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              'disabled:cursor-default'
            )}
          >
            {c.color ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} /> : null}
            <span className="truncate">{c.label}</span>
          </button>
        </Fragment>
      ))}
    </nav>
  )
}

export function TopBar() {
  const { t } = useI18n()
  const route = useUi((s) => s.route)
  const goProjects = useUi((s) => s.goProjects)
  const openDialog = useUi((s) => s.openDialog)
  const canUndo = useProject((s) => s.canUndo)
  const canRedo = useProject((s) => s.canRedo)
  const undo = useProject((s) => s.undo)
  const redo = useProject((s) => s.redo)
  const inProject = route.name === 'project'
  const ctrl = t.common.keys.ctrl

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card/60 px-3 backdrop-blur">
      <button type="button" onClick={goProjects} className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 hover:bg-accent">
        <img src={logo} alt="" className="size-6" />
        <span className="text-sm font-bold tracking-tight">Planner</span>
      </button>
      <div className="h-5 w-px bg-border" />
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      {inProject ? (
        <>
          <button
            type="button"
            onClick={() => openDialog({ type: 'palette' })}
            className="flex h-8 w-64 items-center gap-2 rounded-md border bg-card px-2.5 text-sm text-muted-foreground hover:border-ring/50"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">{t.app.goToTask}</span>
            <Kbd>{ctrl}</Kbd>
            <Kbd>K</Kbd>
          </button>
          <div className="flex items-center">
            <Tooltip content={`${t.common.undo} (${ctrl}+Z)`}>
              <Button variant="ghost" size="icon" disabled={!canUndo} onClick={() => void undo()} aria-label={t.common.undo}>
                <Undo2 />
              </Button>
            </Tooltip>
            <Tooltip content={`${t.common.redo} (${ctrl}+Y)`}>
              <Button variant="ghost" size="icon" disabled={!canRedo} onClick={() => void redo()} aria-label={t.common.redo}>
                <Redo2 />
              </Button>
            </Tooltip>
          </div>
          <div className="w-24">
            <SaveIndicator />
          </div>
        </>
      ) : null}
      <div className="flex items-center">
        <Tooltip content={`${t.app.shortcuts} (F1)`}>
          <Button variant="ghost" size="icon" onClick={() => openDialog({ type: 'shortcuts' })} aria-label={t.app.shortcuts}>
            <Keyboard />
          </Button>
        </Tooltip>
        <LanguageMenu />
        <ThemeMenu />
        <Tooltip content={t.app.settings}>
          <Button variant="ghost" size="icon" onClick={() => openDialog({ type: 'settings' })} aria-label={t.app.settings}>
            <Settings />
          </Button>
        </Tooltip>
      </div>
    </header>
  )
}
