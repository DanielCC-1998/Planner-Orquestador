import { cell, expect, launchApp, plainText, row, savedPdfs, test } from './fixtures'

test('switch the interface and the PDF between English and Spanish', async ({ page, dataDir, app }) => {
  // A project worth €750: one task of 15 h at €50/h.
  await page.evaluate(async () => {
    const r = await window.planner.invoke('projects.create', { name: 'Bilingual', defaultRateCents: 5000 })
    if (!r.ok) throw new Error(r.error.message)
    const id = r.data.id
    await window.planner.invoke('project.open', { id })
    await window.planner.invoke('project.command', {
      id,
      command: { type: 'task.create', parentId: null, fields: { title: 'Login', estimateMinutes: 900 } }
    })
    await window.planner.invoke('project.close', { id })
  })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'New project' }).first()).toBeVisible()

  // Spanish from the language menu of the top bar: the whole interface changes at once.
  await page.getByRole('button', { name: 'Language' }).click()
  // i18n:es-start
  await page.getByRole('menuitem', { name: 'Español' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(page.getByRole('button', { name: 'Nuevo proyecto' }).first()).toBeVisible()
  await page.getByText('Bilingual').click()
  await expect(page.getByRole('tab', { name: 'Árbol' })).toBeVisible()
  await expect(cell(row(page, 'Login'), 'estimate')).toHaveText('15 h')
  await expect.poll(() => plainText(page.locator('footer'))).toContain('750,00 €')

  // The PDF follows the interface language by default…
  await page.getByRole('button', { name: 'Exportar PDF' }).click()
  await page.getByRole('button', { name: 'Guardar PDF…' }).click()
  await expect(page.getByText(/PDF guardado/)).toBeVisible({ timeout: 30_000 })
  expect(savedPdfs(dataDir)).toEqual([expect.stringMatching(/^Bilingual - presupuesto \d{4}-\d{2}-\d{2}\.pdf$/)])

  // …and can be exported in English from the Spanish interface.
  await page.getByRole('button', { name: 'Exportar PDF' }).click()
  await page.getByRole('dialog').getByRole('tab', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Guardar PDF…' }).click()
  // i18n:es-end
  await expect
    .poll(() => savedPdfs(dataDir).some((f) => /^Bilingual - quote \d{4}-\d{2}-\d{2}\.pdf$/.test(f)), { timeout: 30_000 })
    .toBe(true)

  // The language is kept after restarting the app.
  await app.close()
  const again = await launchApp(dataDir)
  try {
    const page2 = await again.firstWindow()
    await expect(page2.locator('html')).toHaveAttribute('lang', 'es')
    // i18n:es-start
    await expect(page2.getByRole('button', { name: 'Nuevo proyecto' }).first()).toBeVisible()
    // i18n:es-end
  } finally {
    await again.close()
  }
})
