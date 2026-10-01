import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

async function newProjectInWorkload(page: Page) {
  await page.getByRole('button', { name: 'New project' }).first().click()
  await page.getByPlaceholder('e.g. Online store').fill('Test team')
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByRole('tab', { name: 'Workload' }).click()
}

function memberNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const r = await window.planner.invoke('projects.list', undefined)
    return r.ok ? (r.data[0]?.members.map((m) => m.name) ?? []) : []
  })
}

test('adding people to the team: pressing “Done” does not lose what was typed', async ({ page }) => {
  await newProjectInWorkload(page)

  // 1. Typing the name and pressing "Done" also adds the person.
  await page.getByRole('button', { name: 'Manage team' }).click()
  await page.getByLabel('Name of the new person').fill('Anna Brooks')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('cell', { name: /Anna Brooks/ })).toBeVisible()
  expect(await memberNames(page)).toEqual(['Anna Brooks'])

  // 2. Enter adds the person, empties the field and keeps the focus for the next one.
  await page.getByRole('button', { name: /Team \(/ }).click()
  const nameInput = page.getByLabel('Name of the new person')
  await nameInput.fill('James Carter')
  await nameInput.press('Enter')
  await expect(page.getByText('“James Carter” has been added to the team')).toBeVisible()
  await expect(nameInput).toHaveValue('')
  await expect(nameInput).toBeFocused()
  expect(await memberNames(page)).toEqual(['Anna Brooks', 'James Carter'])

  // 3. With an invalid rate, "Done" warns and neither closes nor adds.
  await nameInput.fill('Pete')
  await page.getByLabel('Rate of the new person').fill('abc')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByText('Invalid rate')).toBeVisible()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await memberNames(page)).toEqual(['Anna Brooks', 'James Carter'])

  // With a valid rate, "Done" adds the person and closes.
  await page.getByLabel('Rate of the new person').fill('40')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('cell', { name: /Pete/ })).toBeVisible()
  expect(await memberNames(page)).toEqual(['Anna Brooks', 'James Carter', 'Pete'])
})
