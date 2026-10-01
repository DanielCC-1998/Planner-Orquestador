import { cell, expect, row, seedProject, test } from './fixtures'

test('tags: created once in the project, picked for any task, shown in the tree and the board, renamed everywhere, filtered and given in bulk', async ({
  page
}) => {
  await seedProject(page, 'Tagged', [{ title: 'Login' }, { title: 'Sign-up' }, { title: 'Search' }])
  await page.reload()
  await page.getByText('Tagged').click()
  const panel = page.getByRole('complementary', { name: 'Task details' })
  const search = page.getByPlaceholder('Find or create a tag…')

  // "Design" is created from the detail panel of Login…
  await cell(row(page, 'Login'), 'code').dblclick()
  await panel.getByRole('button', { name: 'Tag' }).click()
  await search.fill('Design')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(row(page, 'Login').locator('[data-tag="Design"]')).toBeVisible()

  // …and Sign-up picks it from the list, without typing it again.
  await cell(row(page, 'Sign-up'), 'code').click()
  await panel.getByRole('button', { name: 'Tag' }).click()
  await page.getByRole('checkbox', { name: 'Design' }).click()
  await page.keyboard.press('Escape')
  await expect(row(page, 'Sign-up').locator('[data-tag="Design"]')).toBeVisible()

  // Renaming it in the tags dialog changes it on both tasks at once.
  await page.getByRole('button', { name: 'Tags', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const name = dialog.getByLabel('Name of the tag Design')
  await name.fill('UX')
  await name.press('Enter')
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(row(page, 'Login').locator('[data-tag="UX"]')).toBeVisible()
  await expect(row(page, 'Sign-up').locator('[data-tag="UX"]')).toBeVisible()
  await expect(page.locator('[data-tag="Design"]')).toHaveCount(0)

  // The board cards show them too (the detail panel, closed now, shows them as well).
  await panel.getByRole('button', { name: 'Close panel' }).click()
  await page.getByRole('tab', { name: 'Board' }).click()
  await expect(page.locator('[data-tag="UX"]')).toHaveCount(2)
  await page.getByRole('tab', { name: 'Tree' }).click()

  // Filtering by the tag hides the task without it.
  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'UX' }).click()
  await page.keyboard.press('Escape')
  await expect(row(page, 'Search')).toHaveCount(0)
  await expect(row(page, 'Login')).toBeVisible()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(row(page, 'Search')).toBeVisible()

  // A new tag for two selected tasks at once, from the bulk bar.
  await cell(row(page, 'Login'), 'code').click({ modifiers: ['Control'] })
  await cell(row(page, 'Search'), 'code').click({ modifiers: ['Control'] })
  await page.getByRole('region', { name: 'Edit the selected tasks' }).getByRole('button', { name: 'Tags' }).click()
  await search.fill('QA')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(row(page, 'Login').locator('[data-tag="QA"]')).toBeVisible()
  await expect(row(page, 'Search').locator('[data-tag="QA"]')).toBeVisible()
  await expect(row(page, 'Sign-up').locator('[data-tag="QA"]')).toHaveCount(0)
})
