import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { LOCALE_OF, resolveLanguage } from '@shared/i18n/language'
import { automaticDialogs, electronDialogs } from '../../ipc/dialogs'
import { registerIpc } from '../../ipc/registerIpcHandlers'
import { createContainer, type Container } from './container'
import { readStoredLanguage } from './language'
import { resolveDataLocation } from './paths'
import { applySecurityPolicy, isTrustedUrl } from './security'
import { applyTheme, windowBackground } from './theme'

let mainWindow: BrowserWindow | null = null
let container: Container | null = null

// The data folder is known before the app is ready: the stored language must be read now.
const location = resolveDataLocation()

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 620,
    show: false,
    title: 'Planner',
    autoHideMenuBar: true,
    backgroundColor: windowBackground(),
    icon: app.isPackaged ? undefined : join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false
    }
  })
  win.once('ready-to-show', () => win.show())

  // No menu: zoom shortcuts and (only in development) the developer tools.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const ctrl = input.control || input.meta
    if (ctrl && (input.key === '+' || input.key === '=')) {
      win.webContents.setZoomLevel(Math.min(win.webContents.getZoomLevel() + 0.5, 3))
      event.preventDefault()
    } else if (ctrl && input.key === '-') {
      win.webContents.setZoomLevel(Math.max(win.webContents.getZoomLevel() - 0.5, -3))
      event.preventDefault()
    } else if (ctrl && input.key === '0') {
      win.webContents.setZoomLevel(0)
      event.preventDefault()
    } else if (!app.isPackaged && (input.key === 'F12' || (ctrl && input.shift && input.key.toLowerCase() === 'i'))) {
      win.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  // Emergency save when the Windows session ends.
  win.on('session-end', () => void container?.repo.flush())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

/** Operating-system languages in order of preference (not affected by our own `--lang`). */
function systemLocales(): readonly string[] {
  const preferred = app.getPreferredSystemLanguages()
  return preferred.length > 0 ? preferred : [app.getLocale()]
}

async function start(): Promise<void> {
  container = await createContainer({
    dataDir: location.dir,
    tempDir: app.getPath('temp'),
    onSaveStatus: (projectId, status) => {
      mainWindow?.webContents.send('project.saveStatus', { projectId, status })
    }
  })
  const settings = await container.settings.get()
  applyTheme(settings.theme)

  const locales = systemLocales()
  const e2eDir = process.env['PLANNER_E2E_DIR']
  const e2eOpen = process.env['PLANNER_E2E_OPEN']
  registerIpc(ipcMain, {
    ...container,
    dialogs: e2eDir ? automaticDialogs(e2eDir, e2eOpen ? [e2eOpen] : []) : electronDialogs(() => mainWindow),
    info: () => ({ version: app.getVersion(), dataDir: location.dir, portable: location.portable, systemLocales: locales }),
    uiLanguage: async () => resolveLanguage((await container!.settings.get()).language, locales),
    openDataDir: async () => {
      await shell.openPath(location.dir)
    },
    applyTheme,
    isTrustedSender: (frame) => frame !== null && isTrustedUrl(frame.url)
  })

  mainWindow = createMainWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Native controls (date inputs and their pickers) follow Chromium's locale, which can only be
// set at startup: use the language chosen in the settings. With 'system', Chromium follows the OS.
const storedLanguage = readStoredLanguage(join(location.dir, 'settings.json'))
if (storedLanguage) app.commandLine.appendSwitch('lang', LOCALE_OF[storedLanguage])
app.setAppUserModelId('com.planner.desktop')
applySecurityPolicy()
Menu.setApplicationMenu(null)

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(start, (e) => {
    console.error('[planner] could not start', e)
    app.exit(1)
  })

  app.on('activate', () => {
    if (container && BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
  })

  // Before quitting, everything pending is written (writes are grouped every ~300 ms).
  let flushed = false
  app.on('before-quit', (event) => {
    if (flushed || !container) return
    event.preventDefault()
    container.repo
      .flush()
      .catch((e) => console.error('[planner] error while saving before quitting', e))
      .finally(() => {
        flushed = true
        app.quit()
      })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
