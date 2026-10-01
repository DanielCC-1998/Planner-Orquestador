import { useEffect } from 'react'
import { ConfirmHost, Toaster } from '../components/feedback'
import { TooltipProvider } from '../components/ui/misc'
import { ProjectScreen } from '../features/project/ProjectScreen'
import { ProjectsScreen } from '../features/projects/ProjectsScreen'
import { useI18n } from '../i18n'
import { isMod, isTypingTarget, useWindowKeydown } from '../lib/keys'
import { useProject } from '../stores/project'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'
import { DialogHost } from './DialogHost'
import { TopBar } from './TopBar'

export function App() {
  const route = useUi((s) => s.route)
  const loaded = useSettings((s) => s.loaded)
  const { language } = useI18n()

  useEffect(() => {
    void useSettings.getState().load()
  }, [])

  // Screen readers and hyphenation follow the language of the page.
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  // Type-ahead: keys pressed while a task is being created are not lost.
  useEffect(() => {
    const capture = (e: KeyboardEvent) => {
      const ui = useUi.getState()
      if (ui.typeAhead === null || isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      // They are kept in order and the next editor replays them (text, Enter, Tab, Shift+Tab, Esc).
      if (e.key === 'Escape') ui.pushTypeAhead({ kind: 'key', key: 'escape' })
      else if (e.key === 'Enter') ui.pushTypeAhead({ kind: 'key', key: 'enter' })
      else if (e.key === 'Tab') ui.pushTypeAhead({ kind: 'key', key: e.shiftKey ? 'shift-tab' : 'tab' })
      else if (e.key === 'Backspace') ui.pushTypeAhead({ kind: 'backspace' })
      else if (e.key.length === 1) ui.pushTypeAhead({ kind: 'char', char: e.key })
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', capture, true)
    return () => window.removeEventListener('keydown', capture, true)
  }, [])

  useWindowKeydown((e) => {
    const ui = useUi.getState()
    const inProject = ui.route.name === 'project'
    if (isMod(e) && e.key.toLowerCase() === 'k' && inProject) {
      e.preventDefault()
      ui.openDialog({ type: 'palette' })
      return
    }
    if (isTypingTarget(e.target) || ui.dialog) return
    if (inProject && isMod(e) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      void useProject.getState().undo()
    } else if (inProject && isMod(e) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault()
      void useProject.getState().redo()
    } else if (inProject && e.altKey && !isMod(e) && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      ui.toggleDescriptions()
    } else if (e.key === 'F1' || (e.key === '?' && !isMod(e))) {
      e.preventDefault()
      ui.openDialog({ type: 'shortcuts' })
    }
  })

  // Nothing is drawn until the settings arrive: the first frame is already in the right language.
  if (!loaded) return null

  return (
    <TooltipProvider delayDuration={350}>
      <div className="flex h-full flex-col">
        <TopBar />
        <main className="min-h-0 flex-1">
          {route.name === 'projects' ? <ProjectsScreen /> : <ProjectScreen key={route.id} id={route.id} />}
        </main>
      </div>
      <DialogHost />
      <Toaster />
      <ConfirmHost />
    </TooltipProvider>
  )
}
