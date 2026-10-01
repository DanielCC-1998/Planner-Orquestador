import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cell, expect, launchApp, plainText, row, savedPdfs, test } from './fixtures'

test('plan with the keyboard, share a subtask without double-counting hours, undo and export the PDF', async ({
  page,
  dataDir
}) => {
  // New project with a default rate of €50/h.
  await page.getByRole('button', { name: 'New project' }).first().click()
  await page.getByPlaceholder('e.g. Online store').fill('Store')
  await page.getByPlaceholder('e.g. 45').fill('50')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('heading', { name: 'Store' })).toBeVisible()

  // Outliner: Enter creates the next task, Tab nests it, Shift+Tab moves it up, Esc keeps what was typed.
  await page.getByRole('button', { name: 'First task' }).click()
  await page.keyboard.type('Login')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Users table')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Access form')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.type('Sign-up')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Email validation')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')

  await expect(cell(row(page, 'Login'), 'code')).toHaveText('1')
  await expect(cell(row(page, 'Users table'), 'code')).toHaveText('1.1')
  await expect(cell(row(page, 'Access form'), 'code')).toHaveText('1.2')
  await expect(cell(row(page, 'Sign-up'), 'code')).toHaveText('2')
  await expect(cell(row(page, 'Email validation'), 'code')).toHaveText('2.1')

  // Estimates with the inline editor (double click on "Own").
  for (const [name, hours] of [
    ['Users table', '4'],
    ['Access form', '6'],
    ['Email validation', '5']
  ] as const) {
    await cell(row(page, name), 'estimate').dblclick()
    await page.keyboard.type(hours)
    await page.keyboard.press('Enter')
    await expect(cell(row(page, name), 'estimate')).toHaveText(`${hours} h`)
  }

  // Share "Users table" under "Sign-up" too.
  await row(page, 'Sign-up').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Link existing subtask…' }).click()
  await page.getByPlaceholder('Search by name or code…').fill('Users')
  await page.getByRole('dialog').getByRole('button', { name: /Users table/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  // It appears twice: the primary one (1.1) and a reference under Sign-up (2.2 · see 1.1).
  await expect(page.getByRole('treeitem').filter({ hasText: 'Users table' })).toHaveCount(2)
  await expect(row(page, 'see 1.1')).toBeVisible()

  // Totals without double counting: 15 h and €750; Sign-up contributes 5 h (+4 h shared in its branch).
  const footer = page.locator('footer')
  await expect.poll(() => plainText(footer)).toContain('15 h')
  await expect.poll(() => plainText(footer)).toContain('€750.00')
  await expect(footer).toContainText('−4 h not double-counted')
  await expect(cell(row(page, 'Sign-up'), 'sum-hours')).toContainText('+4 h')
  await expect(cell(row(page, 'Sign-up'), 'sum-hours')).toContainText('5 h')

  // Undo and redo.
  await page.locator('header').click({ position: { x: 700, y: 10 } })
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('treeitem').filter({ hasText: 'Users table' })).toHaveCount(1)
  await expect(footer).not.toContainText('not double-counted')
  await page.keyboard.press('Control+y')
  await expect(footer).toContainText('−4 h not double-counted')

  // Del on the reference only unlinks it.
  await row(page, 'see 1.1').click()
  await page.keyboard.press('Delete')
  await expect(page.getByRole('treeitem').filter({ hasText: 'Users table' })).toHaveCount(1)
  await expect(page.getByText(/Removed from “Sign-up”/)).toBeVisible()
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('treeitem').filter({ hasText: 'Users table' })).toHaveCount(2)

  // Export the PDF (in E2E the save dialog is automatic); its name is in English.
  await page.getByRole('button', { name: 'Export PDF' }).click()
  await page.getByRole('button', { name: 'Save PDF…' }).click()
  await expect(page.getByText(/PDF saved/)).toBeVisible({ timeout: 30_000 })
  const [pdf] = savedPdfs(dataDir)
  expect(pdf).toMatch(/^Store - quote \d{4}-\d{2}-\d{2}\.pdf$/)
  expect(readFileSync(join(dataDir, pdf!)).subarray(0, 5).toString()).toBe('%PDF-')

  // Dark mode.
  await page.getByRole('button', { name: 'Theme' }).click()
  await page.getByRole('menuitem', { name: 'Dark' }).click()
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true)
})

test('the data persists after restarting the app', async ({ page, dataDir, app }) => {
  await page.evaluate(async () => {
    const r = await window.planner.invoke('projects.create', { name: 'Persistent', defaultRateCents: 1000 })
    if (!r.ok) throw new Error(r.error.message)
    const id = r.data.id
    await window.planner.invoke('project.open', { id })
    await window.planner.invoke('project.command', {
      id,
      command: { type: 'task.create', parentId: null, fields: { title: 'Saved task', estimateMinutes: 120 } }
    })
  })
  await app.close()
  const again = await launchApp(dataDir)
  try {
    const page2 = await again.firstWindow()
    await expect(page2.getByText('Persistent')).toBeVisible()
    await page2.getByText('Persistent').click()
    await expect(row(page2, 'Saved task')).toBeVisible()
    await expect(cell(row(page2, 'Saved task'), 'estimate')).toHaveText('2 h')
  } finally {
    await again.close()
  }
})
