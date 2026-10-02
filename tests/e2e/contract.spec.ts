import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, projectFile, savedPdfs, seedProject, test } from './fixtures'

test('the quote as a contract: a library of contracts per country and saved texts, reused in a project and signed in the PDF', async ({
  page,
  dataDir
}) => {
  await seedProject(page, 'Contract', [{ title: 'Login', estimateMinutes: 120 }])
  await page.reload()

  // Settings: the name of the tax ID and who signs.
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Your details' }).click()
  await dialog.getByLabel('Name of the ID').fill('RUT')
  await dialog.getByLabel('Name', { exact: true }).fill('Dana Lee')

  // The library: two contract models (the first one is the default) and a saved text.
  await dialog.getByRole('tab', { name: 'Contracts' }).click()
  await dialog.getByRole('button', { name: 'New model' }).click()
  await dialog.getByLabel('Name', { exact: true }).fill('Uruguay')
  await dialog.getByLabel('Governing law').fill('Uruguay')
  await dialog.getByLabel('Courts for disputes').fill('Montevideo')
  await dialog.getByLabel('General terms').fill('1. Confidentiality.\n\n2. Signing.')
  await dialog.getByRole('button', { name: 'New model' }).click()
  await dialog.getByLabel('Name', { exact: true }).fill('Spain')
  await dialog.getByLabel('Governing law').fill('Spain')
  await dialog.getByLabel('General terms').fill('1. Spanish terms.')
  await expect(dialog.getByRole('button', { name: /^Uruguay/ })).toContainText('Default')
  await dialog.getByRole('tab', { name: 'Saved texts' }).click()
  await dialog.getByRole('button', { name: 'New text' }).click()
  await dialog.getByLabel('Name', { exact: true }).fill('Billing')
  await dialog.getByLabel('Text', { exact: true }).fill('Billing and payment. Per sprint.')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Settings saved')).toBeVisible()

  // The project chooses Spain and writes its particular terms with a saved text: it gets the next number.
  await page.getByText('Contract', { exact: true }).click()
  await page.getByRole('button', { name: 'Project settings' }).click()
  await dialog.getByRole('tab', { name: 'Contract', exact: true }).click()
  await expect(dialog.getByLabel('Contract model')).toContainText('Default (Uruguay)')
  await dialog.getByLabel('Contract model').selectOption({ label: 'Spain' })
  await expect(dialog.getByText('Law: Spain')).toBeVisible()
  await dialog.getByLabel('Company or full name').fill('ACME Retail Ltd.')
  await dialog.getByLabel('Signs for the client').fill('Jordan Smith')
  await dialog.getByLabel('Particular terms').fill('1. Scope. Only the breakdown.')
  await dialog.getByRole('button', { name: 'Insert saved text' }).click()
  await page.getByRole('menuitem', { name: 'Billing' }).click()
  await expect(dialog.getByLabel('Particular terms')).toHaveValue('1. Scope. Only the breakdown.\n\n2. Billing and payment. Per sprint.')
  // Its clauses go to the library one by one; the one that was there already is not repeated.
  await dialog.getByRole('button', { name: 'Save to the library' }).click()
  await page.getByRole('menuitem', { name: 'Clause by clause' }).click()
  await expect(page.getByText('1 text saved to the library')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Project settings saved')).toBeVisible()

  // The export says which general terms go in the PDF; the signatures page and the initials are on.
  await page.getByRole('button', { name: 'Export PDF' }).click()
  await expect(dialog.getByText('General terms: contract model “Spain”')).toBeVisible()
  await expect(dialog.getByLabel('Acceptance and signatures')).toBeChecked()
  await expect(dialog.getByText('This quote has no number yet')).toBeVisible()
  await dialog.getByLabel('Acceptance and signatures').uncheck()
  await expect(dialog.getByLabel('Boxes for the initials of both parties on every page')).toBeDisabled()
  await dialog.getByLabel('Acceptance and signatures').check()
  await page.getByRole('button', { name: 'Save PDF…' }).click()
  await expect(page.getByText(/PDF saved/)).toBeVisible({ timeout: 30_000 })
  const [pdf] = savedPdfs(dataDir)
  expect(readFileSync(join(dataDir, pdf!)).subarray(0, 5).toString()).toBe('%PDF-')

  // The project keeps the model it chose (format 4); the library is in the settings.
  const settings = JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'))
  const [uruguay, spain] = settings.contractModels
  expect([uruguay.name, spain.name]).toEqual(['Uruguay', 'Spain'])
  expect(settings.defaultContractModelId).toBe(uruguay.id)
  expect(settings.savedTexts.map((saved: { name: string }) => saved.name)).toEqual(['Billing', 'Scope'])
  await expect.poll(() => JSON.parse(readFileSync(projectFile(dataDir), 'utf8')).meta.quote.contractModelId).toBe(spain.id)
  const saved = JSON.parse(readFileSync(projectFile(dataDir), 'utf8'))
  expect(saved.schemaVersion).toBe(4)
  expect(saved.meta.quote.client).toMatchObject({ legalName: 'ACME Retail Ltd.', signerName: 'Jordan Smith' })
})
