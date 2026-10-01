import { BrowserWindow, nativeTheme } from 'electron'
import type { ThemePreference } from '@application'

export const DARK_BACKGROUND = '#14161c'
export const LIGHT_BACKGROUND = '#fbfbfd'

export function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? DARK_BACKGROUND : LIGHT_BACKGROUND
}

/**
 * The main process sets the theme: Chromium reflects it in `prefers-color-scheme`, so the CSS
 * needs no classes and the native title bar changes too.
 */
export function applyTheme(theme: ThemePreference): void {
  nativeTheme.themeSource = theme
  for (const win of BrowserWindow.getAllWindows()) win.setBackgroundColor(windowBackground())
}
