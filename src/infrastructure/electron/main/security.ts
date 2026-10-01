import { app, session, type WebContents } from 'electron'

/** Origins the UI is served from (the packaged file or Vite's development server). */
export function isTrustedUrl(url: string): boolean {
  if (url.startsWith('file://')) return true
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  return devUrl !== undefined && url.startsWith(devUrl)
}

function harden(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault()
  })
  contents.on('will-redirect', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault()
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

/** Global hardening: no new windows, no external navigation, no permissions, no webview. */
export function applySecurityPolicy(): void {
  app.on('web-contents-created', (_event, contents) => harden(contents))
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
  })
}
