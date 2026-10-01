import { ExportPdfDialog } from '../features/dialogs/ExportPdfDialog'
import { ProjectSettingsDialog } from '../features/dialogs/ProjectSettingsDialog'
import { SettingsDialog } from '../features/dialogs/SettingsDialog'
import { ShortcutsDialog } from '../features/dialogs/ShortcutsDialog'
import { TagsDialog } from '../features/dialogs/TagsDialog'
import { CommandPalette, LinkChildDialog, LinkParentDialog, MoveTaskDialog } from '../features/dialogs/TaskDialogs'
import { TeamDialog } from '../features/dialogs/TeamDialog'
import { NewProjectDialog } from '../features/projects/NewProjectDialog'
import { useProject } from '../stores/project'
import { useUi } from '../stores/ui'

/** Mounts the open dialog (only one at a time). */
export function DialogHost() {
  const dialog = useUi((s) => s.dialog)
  const close = useUi((s) => s.closeDialog)
  const hasProject = useProject((s) => s.state !== null)
  if (!dialog) return null
  switch (dialog.type) {
    case 'newProject':
      return <NewProjectDialog onClose={close} />
    case 'settings':
      return <SettingsDialog onClose={close} />
    case 'shortcuts':
      return <ShortcutsDialog onClose={close} />
    case 'exportPdf':
      return <ExportPdfDialog projectId={dialog.projectId} onClose={close} />
  }
  if (!hasProject) return null
  switch (dialog.type) {
    case 'projectSettings':
      return <ProjectSettingsDialog onClose={close} />
    case 'team':
      return <TeamDialog onClose={close} />
    case 'tags':
      return <TagsDialog onClose={close} />
    case 'linkChild':
      return <LinkChildDialog parentId={dialog.parentId} onClose={close} />
    case 'linkParent':
      return <LinkParentDialog childId={dialog.childId} onClose={close} />
    case 'move':
      return <MoveTaskDialog childId={dialog.childId} fromParentId={dialog.fromParentId} onClose={close} />
    case 'palette':
      return <CommandPalette onClose={close} />
  }
}
