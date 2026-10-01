import { join } from 'node:path'
import { dialog, shell, type BrowserWindow } from 'electron'

/** Native dialogs and system actions used by the IPC handlers. */
export interface Dialogs {
  saveFile(defaultName: string, filter: { name: string; extensions: string[] }): Promise<string | null>
  openFile(filter: { name: string; extensions: string[] }): Promise<string | null>
  openPath(path: string): Promise<void>
}

export function electronDialogs(getWindow: () => BrowserWindow | null): Dialogs {
  return {
    async saveFile(defaultName, filter) {
      const win = getWindow()
      const options = { defaultPath: defaultName, filters: [filter] }
      const r = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
      return r.canceled || !r.filePath ? null : r.filePath
    },
    async openFile(filter) {
      const win = getWindow()
      const options = { properties: ['openFile' as const], filters: [filter] }
      const r = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
      return r.canceled ? null : (r.filePaths[0] ?? null)
    },
    async openPath(path) {
      const error = await shell.openPath(path)
      if (error) throw new Error(error)
    }
  }
}

/**
 * For E2E tests: saves into `dir` without asking and opens the files it is given, one per call.
 * Enabled with PLANNER_E2E_DIR (and PLANNER_E2E_OPEN for the files to open).
 */
export function automaticDialogs(dir: string, openQueue: string[] = []): Dialogs {
  return {
    async saveFile(defaultName) {
      return join(dir, defaultName)
    },
    async openFile() {
      return openQueue.shift() ?? null
    },
    async openPath() {}
  }
}
