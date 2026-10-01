import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron, test as base, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import electronPath from 'electron'
import type { Language } from '@domain'

interface Fixtures {
  dataDir: string
  app: ElectronApplication
  page: Page
}

/**
 * Starts the built app on `dataDir` with automatic dialogs, its own Chromium profile and a fixed
 * interface language, so a run depends neither on the machine (OS language) nor on earlier runs.
 * The language is only written on the first launch: a relaunch keeps what the test changed.
 */
export function launchApp(dataDir: string, options: { language?: Language } = {}): Promise<ElectronApplication> {
  mkdirSync(dataDir, { recursive: true })
  const settings = join(dataDir, 'settings.json')
  if (!existsSync(settings)) writeFileSync(settings, JSON.stringify({ language: options.language ?? 'en' }))
  return _electron.launch({
    executablePath: electronPath as unknown as string,
    args: [`--user-data-dir=${join(dataDir, 'user-data')}`, resolve('out/main/index.js')],
    env: { ...process.env, PLANNER_DATA_DIR: dataDir, PLANNER_E2E_DIR: dataDir }
  })
}

/** Each test starts the app on an empty data folder, in English. */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  dataDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'planner-e2e-'))
    await use(dir)
    rmSync(dir, { recursive: true, force: true })
  },
  app: async ({ dataDir }, use) => {
    const app = await launchApp(dataDir)
    await use(app)
    await app.close()
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow()
    // No color-scheme emulation: nativeTheme decides, as in the real app.
    await page.emulateMedia({ colorScheme: null })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  }
})

export { expect } from '@playwright/test'

export function row(page: Page, text: string, nth = 0): Locator {
  return page.getByRole('treeitem').filter({ hasText: text }).nth(nth)
}

export function cell(r: Locator, col: string): Locator {
  return r.locator(`[data-col="${col}"]`)
}

/** Text without non-breaking spaces (Spanish number formats put one before "€"). */
export async function plainText(l: Locator): Promise<string> {
  return ((await l.textContent()) ?? '').split(String.fromCharCode(0xa0)).join(' ')
}

/** PDF files saved in the data folder by the automatic dialogs. */
export function savedPdfs(dataDir: string): string[] {
  return readdirSync(dataDir).filter((f) => f.endsWith('.pdf'))
}
