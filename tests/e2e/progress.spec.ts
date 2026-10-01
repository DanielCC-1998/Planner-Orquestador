import { readFileSync, writeFileSync } from 'node:fs'
import { cell, expect, launchApp, projectFile, row, savedPdfs, seedProject, test } from './fixtures'

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

test('status changes are recorded with their time, sprints are set per project, and the PDF prints the progress by sprint', async ({
  page,
  app,
  dataDir
}) => {
  await seedProject(page, 'Sprinted', [{ title: 'Login' }, { title: 'Sign-up' }])
  await page.reload()
  await page.getByText('Sprinted').click()

  // A status change from the tree goes into the history of the task, with its time.
  await cell(row(page, 'Login'), 'status').getByRole('button').click()
  await page.getByRole('menuitem', { name: 'Done' }).click()
  const historyOf = (title: string) => {
    const saved = JSON.parse(readFileSync(projectFile(dataDir), 'utf8'))
    return saved.tasks.find((t: { title: string }) => t.title === title).statusHistory as Array<{ from: string | null; to: string }>
  }
  await expect
    .poll(() => historyOf('Login').map((h) => `${h.from}→${h.to}`))
    .toEqual(['null→todo', 'todo→done'])

  // Sprints of one week, chosen in the project settings.
  await page.getByRole('button', { name: 'Project settings' }).click()
  const settings = page.getByRole('dialog')
  await settings.getByRole('tab', { name: 'Sprints' }).click()
  await settings.getByRole('button', { name: '1 week', exact: true }).click()
  await expect(settings).toContainText('Current sprint: Sprint 1')
  await settings.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(settings).toBeHidden()
  await expect.poll(() => JSON.parse(readFileSync(projectFile(dataDir), 'utf8')).meta.sprints).toEqual({ length: 1, unit: 'week' })

  // A history spread over several sprints (written into the file, as it would be after weeks of work).
  await app.close()
  const doc = JSON.parse(readFileSync(projectFile(dataDir), 'utf8'))
  doc.meta.startDate = daysAgo(35).slice(0, 10)
  for (const task of doc.tasks) {
    if (task.title === 'Login') {
      task.status = 'done'
      task.statusHistory = [
        { at: daysAgo(34), from: null, to: 'todo' },
        { at: daysAgo(30), from: 'todo', to: 'in_progress' },
        { at: daysAgo(20), from: 'in_progress', to: 'done' }
      ]
    } else {
      task.status = 'in_progress'
      task.statusHistory = [
        { at: daysAgo(34), from: null, to: 'todo' },
        { at: daysAgo(12), from: 'todo', to: 'review' },
        { at: daysAgo(1), from: 'review', to: 'in_progress' }
      ]
    }
  }
  writeFileSync(projectFile(dataDir), JSON.stringify(doc, null, 2))

  const again = await launchApp(dataDir)
  try {
    const page2 = await again.firstWindow()
    await page2.setViewportSize({ width: 1440, height: 900 })
    await page2.getByText('Sprinted').click()
    await expect(row(page2, 'Sign-up')).toBeVisible()
    await page2.getByRole('button', { name: 'Export PDF' }).click()
    const dialog = page2.getByRole('dialog')
    await dialog.getByLabel('Status', { exact: true }).check()
    await dialog.getByLabel('Tags', { exact: true }).check()
    await dialog.getByRole('button', { name: 'Save PDF…' }).click()
    await expect.poll(() => savedPdfs(dataDir).length).toBe(1)
    expect(readFileSync(`${dataDir}/${savedPdfs(dataDir)[0]}`).subarray(0, 5).toString()).toBe('%PDF-')
  } finally {
    await again.close()
  }
})
