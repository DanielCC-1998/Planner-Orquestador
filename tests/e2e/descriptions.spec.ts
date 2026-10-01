import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cell, expect, row, savedPdfs, test } from './fixtures'

test('descriptions: written in the detail panel, shown or hidden in the tree and the board, and sent to the PDF', async ({
  page,
  dataDir
}) => {
  await page.evaluate(async () => {
    const r = await window.planner.invoke('projects.create', { name: 'With descriptions', defaultRateCents: 5000 })
    if (!r.ok) throw new Error(r.error.message)
    const id = r.data.id
    await window.planner.invoke('project.open', { id })
    await window.planner.invoke('project.command', {
      id,
      command: { type: 'task.create', parentId: null, fields: { title: 'Login', estimateMinutes: 120 } }
    })
    await window.planner.invoke('project.close', { id })
  })
  await page.reload()
  await page.getByText('With descriptions').click()

  // Write the description in the detail panel (it is saved when leaving the field).
  await row(page, 'Login').click()
  await page.keyboard.press(' ')
  const textarea = page.getByLabel('Task description')
  await textarea.fill('Sign-in screen with email.\n- Remember the session for 30 days')
  await textarea.press('Tab')
  await page.getByRole('button', { name: 'Close panel' }).click()

  // Hidden by default: only an icon next to the title.
  const toggle = page.getByRole('button', { name: 'Descriptions', exact: true })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(cell(row(page, 'Login'), 'description')).toHaveCount(0)
  await expect(row(page, 'Login').getByLabel('Has a description')).toBeVisible()

  // Turned on: it shows under the task in the tree.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(cell(row(page, 'Login'), 'description')).toContainText('Sign-in screen with email.')

  // Also on the board cards.
  await page.getByRole('tab', { name: 'Board' }).click()
  await expect(page.locator('[data-col="description"]').first()).toContainText('Remember the session for 30 days')

  // Turned off: it disappears.
  await page.getByRole('button', { name: 'Descriptions', exact: true }).click()
  await expect(page.locator('[data-col="description"]')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Tree' }).click()
  await expect(cell(row(page, 'Login'), 'description')).toHaveCount(0)

  // PDF with the "Task details" section (the default option).
  await page.getByRole('button', { name: 'Export PDF' }).click()
  await expect(page.getByRole('radio', { name: 'In a separate “Task details” section' })).toBeChecked()
  await expect(page.getByText('1 task has a description.')).toBeVisible()
  await page.getByRole('button', { name: 'Save PDF…' }).click()
  await expect(page.getByText(/PDF saved/)).toBeVisible({ timeout: 30_000 })
  const [pdf] = savedPdfs(dataDir)
  expect(pdf).toBeTruthy()
  expect(readFileSync(join(dataDir, pdf!)).subarray(0, 5).toString()).toBe('%PDF-')
})
