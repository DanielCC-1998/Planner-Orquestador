import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { cell, expect, launchApp, plainText, row, test } from './fixtures'

/** Opens the story points tab of the project settings, applies `edit` and saves. */
async function editScale(page: Page, edit: () => Promise<void>) {
  await page.getByRole('button', { name: 'Project settings' }).click()
  await page.getByRole('dialog').getByRole('tab', { name: 'Story points' }).click()
  await edit()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('hours from story points: a scale per project, exceptions and typed hours that win', async ({ page, dataDir, app }) => {
  // Three tasks at €50/h: two with story points only, one with typed hours as well.
  await page.evaluate(async () => {
    const r = await window.planner.invoke('projects.create', { name: 'Points', defaultRateCents: 5000 })
    if (!r.ok) throw new Error(r.error.message)
    const id = r.data.id
    await window.planner.invoke('project.open', { id })
    for (const fields of [
      { title: 'Login', storyPoints: 3 },
      { title: 'Sign-up', storyPoints: 5 },
      { title: 'Search', storyPoints: 5, estimateMinutes: 240 }
    ]) {
      await window.planner.invoke('project.command', { id, command: { type: 'task.create', parentId: null, fields } })
    }
    await window.planner.invoke('project.close', { id })
  })
  await page.reload()
  await page.getByText('Points').click()
  const footer = page.locator('footer')

  // Without a scale, story points give no hours.
  await expect(cell(row(page, 'Login'), 'estimate')).toHaveAttribute('data-source', 'none')
  await expect(footer).toContainText('2 unestimated')

  // 1 point = 2 h, and 5 points = 8 h instead of the 10 h of the rule of three.
  await editScale(page, async () => {
    await page.getByLabel('Hours for 1 story point').fill('2h')
    await expect(page.getByLabel('Hours for 5 story points')).toHaveAttribute('placeholder', '10 h')
    await page.getByLabel('Hours for 5 story points').fill('8h')
  })
  await expect(cell(row(page, 'Login'), 'estimate')).toHaveText('6 h')
  await expect(cell(row(page, 'Login'), 'estimate')).toHaveAttribute('data-source', 'points')
  await expect(cell(row(page, 'Sign-up'), 'estimate')).toHaveText('8 h')
  await expect(cell(row(page, 'Search'), 'estimate')).toHaveText('4 h')
  await expect(cell(row(page, 'Search'), 'estimate')).toHaveAttribute('data-source', 'manual')
  await expect.poll(() => plainText(footer)).toContain('18 h')
  await expect.poll(() => plainText(footer)).toContain('€900.00')
  await expect(footer).not.toContainText('unestimated')

  // Typed hours win; emptying the field goes back to the story points.
  await cell(row(page, 'Login'), 'estimate').dblclick()
  await page.keyboard.type('1')
  await page.keyboard.press('Enter')
  await expect(cell(row(page, 'Login'), 'estimate')).toHaveAttribute('data-source', 'manual')
  await expect.poll(() => plainText(footer)).toContain('13 h')
  await cell(row(page, 'Login'), 'estimate').dblclick()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Enter')
  await expect(cell(row(page, 'Login'), 'estimate')).toHaveText('6 h')
  await expect(cell(row(page, 'Login'), 'estimate')).toHaveAttribute('data-source', 'points')

  // Changing the scale updates every task that follows it, and it can be undone.
  await editScale(page, async () => {
    await page.getByLabel('Hours for 1 story point').fill('3h')
  })
  await expect(cell(row(page, 'Login'), 'estimate')).toHaveText('9 h')
  await expect.poll(() => plainText(footer)).toContain('21 h')
  await page.locator('header').click({ position: { x: 700, y: 10 } })
  await page.keyboard.press('Control+z')
  await expect(cell(row(page, 'Login'), 'estimate')).toHaveText('6 h')
  await expect.poll(() => plainText(footer)).toContain('18 h')

  // The scale is saved with the project and kept after restarting.
  await app.close()
  const again = await launchApp(dataDir)
  try {
    const page2 = await again.firstWindow()
    await page2.getByText('Points').click()
    await expect(cell(row(page2, 'Login'), 'estimate')).toHaveText('6 h')
  } finally {
    await again.close()
  }
  const projects = join(dataDir, 'projects')
  const file = readdirSync(projects).find((f) => f.endsWith('.json'))!
  const saved = JSON.parse(readFileSync(join(projects, file), 'utf8'))
  expect(saved.schemaVersion).toBe(3)
  expect(saved.meta.pointScale).toEqual({ minutesPerPoint: 120, overrides: [{ points: 5, minutes: 480 }] })
})
