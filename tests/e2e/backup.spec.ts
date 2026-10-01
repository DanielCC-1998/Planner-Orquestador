import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test as base } from '@playwright/test'
import { expect, launchApp, seedProject } from './fixtures'

base('backups: export a project and import it back, keeping both or replacing the current one', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'planner-e2e-'))
  const backup = join(dataDir, 'Backup test.planner.json')
  // The "open" dialog returns the backup twice: once to keep both, once to replace.
  const app = await launchApp(dataDir, { open: [backup, backup] })
  try {
    const page = await app.firstWindow()
    await page.setViewportSize({ width: 1440, height: 900 })
    const id = await seedProject(page, 'Backup test', [{ title: 'Login', estimateMinutes: 120 }])
    await page.reload()
    const cards = page.getByRole('button', { name: 'Project actions', exact: true })

    // Export from the card menu: the same format as on disk.
    await cards.click()
    await page.getByRole('menuitem', { name: 'Export backup…' }).click()
    await expect.poll(() => existsSync(backup)).toBe(true)
    expect(JSON.parse(readFileSync(backup, 'utf8'))).toMatchObject({ format: 'planner.project', schemaVersion: 3, meta: { id, name: 'Backup test' } })

    // The project changes after the backup.
    await page.evaluate(async (id) => {
      await window.planner.invoke('project.open', { id })
      await window.planner.invoke('project.command', { id, command: { type: 'project.update', patch: { client: 'Changed later' } } })
      await window.planner.invoke('project.close', { id })
    }, id)
    await page.reload()
    await expect(page.getByText('Changed later')).toBeVisible()

    // Importing the backup of a project that exists asks first: "Keep both" adds a copy (and opens it).
    const heading = page.getByRole('heading', { level: 1 })
    const home = page.getByRole('button', { name: 'Planner', exact: true })
    await page.getByRole('button', { name: 'Import backup…' }).click()
    let dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('“Backup test” already exists')
    await dialog.getByRole('button', { name: 'Keep both' }).click()
    await expect(heading).toHaveText('Backup test (imported)')
    await home.click()
    await expect(cards).toHaveCount(2)

    // "Replace" puts the backup back in place of the current version, which goes to the trash.
    await page.getByRole('button', { name: 'Import backup…' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Replace' }).click()
    await expect(heading).toHaveText('Backup test')
    await expect(page.getByText('Changed later')).toHaveCount(0)
    expect(existsSync(join(dataDir, 'trash'))).toBe(true)

    // From inside the project, the header button saves the backup too.
    const before = statSync(backup).mtimeMs
    await page.getByRole('button', { name: 'Export backup (.json)' }).click()
    await expect.poll(() => statSync(backup).mtimeMs).toBeGreaterThan(before)
    await home.click()
    await expect(cards).toHaveCount(2)
  } finally {
    await app.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})
