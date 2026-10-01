import type { Locator, Page } from '@playwright/test'
import { cell, expect, launchApp, row, seedProject, test } from './fixtures'

const width = async (l: Locator) => Math.round((await l.boundingBox())!.width)

/** Drags the element `dx` pixels sideways, from its center. */
async function drag(page: Page, handle: Locator, dx: number) {
  const box = (await handle.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + Math.min(box.height / 2, 60)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 6 })
  await page.mouse.up()
}

test('long titles wrap; tree columns and the detail panel can be resized and are remembered', async ({ page, app, dataDir }) => {
  const long = `A very long task title ${'that keeps going '.repeat(8)}${'x'.repeat(80)}`
  await seedProject(page, 'Layout', [{ title: long }, { title: 'Short' }])
  await page.reload()
  await page.getByText('Layout').click()

  // The long title wraps (even its word without spaces): its row grows and nothing scrolls sideways.
  const longRow = row(page, 'A very long task title')
  const shortRow = row(page, 'Short')
  expect((await longRow.boundingBox())!.height).toBeGreaterThan((await shortRow.boundingBox())!.height + 15)
  // The scroll area is the parent of the tree (the header sits beside the tree, inside it too).
  expect(await page.getByRole('tree').evaluate((el) => el.parentElement!.scrollWidth <= el.parentElement!.clientWidth)).toBe(true)

  // Dragging the edge of the Status header makes the column 60 px wider.
  expect(await width(cell(shortRow, 'status'))).toBe(116)
  await drag(page, page.locator('[data-resize="status"]'), 60)
  await expect.poll(() => width(cell(shortRow, 'status'))).toBe(176)

  // The detail panel grows by dragging its left edge.
  await cell(shortRow, 'code').dblclick()
  const panel = page.getByRole('complementary', { name: 'Task details' })
  expect(await width(panel)).toBe(400)
  await drag(page, page.locator('[data-resize="detail"]'), -100)
  await expect.poll(() => width(panel)).toBe(500)

  // With less room the titles wrap more: rows grow and never overlap the next one.
  const overlaps = () =>
    page.getByRole('treeitem').evaluateAll((items) => {
      const boxes = items.map((el) => el.getBoundingClientRect()).sort((a, b) => a.top - b.top)
      return boxes.some((box, i) => i > 0 && boxes[i - 1]!.bottom > box.top + 1)
    })
  await page.waitForTimeout(400)
  expect(await overlaps()).toBe(false)

  // Both are remembered after restarting.
  await app.close()
  const again = await launchApp(dataDir)
  try {
    const page2 = await again.firstWindow()
    await page2.setViewportSize({ width: 1440, height: 900 })
    await page2.getByText('Layout').click()
    await expect.poll(() => width(cell(row(page2, 'Short'), 'status'))).toBe(176)
    await cell(row(page2, 'Short'), 'code').dblclick()
    await expect.poll(() => width(page2.getByRole('complementary', { name: 'Task details' }))).toBe(500)
    // Double click on the grip goes back to the default width.
    await page2.locator('[data-resize="status"]').dblclick()
    await expect.poll(() => width(cell(row(page2, 'Short'), 'status'))).toBe(116)
  } finally {
    await again.close()
  }
})

test('the delete confirmation wraps a long title instead of overflowing', async ({ page }) => {
  const title = 'Unbreakable'.repeat(24)
  await page.evaluate(async (title) => {
    const r = await window.planner.invoke('projects.create', { name: 'Dialogs' })
    if (!r.ok) throw new Error(r.error.message)
    const id = r.data.id
    await window.planner.invoke('project.open', { id })
    const parent = await window.planner.invoke('project.command', { id, command: { type: 'task.create', parentId: null, fields: { title } } })
    if (!parent.ok) throw new Error(parent.error.message)
    await window.planner.invoke('project.command', {
      id,
      command: { type: 'task.create', parentId: parent.data.created[0]!, fields: { title: 'Child' } }
    })
    await window.planner.invoke('project.close', { id })
  }, title)
  await page.reload()
  await page.getByText('Dialogs').click()
  await cell(row(page, 'Unbreakable'), 'code').click()
  await page.keyboard.press('Delete')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Unbreakable')
  // The dialog keeps its width and nothing visible inside it is cut or pushed out.
  const overflowing = await dialog.evaluate((el) =>
    [...el.querySelectorAll('h2, p, div')].filter((n) => !n.classList.contains('sr-only') && n.scrollWidth > n.clientWidth + 1).length
  )
  expect(overflowing).toBe(0)
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(448 + 1)
})
