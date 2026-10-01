// Generates the README screenshots (docs/images/*.png) and a sample PDF (docs/sample-quote.pdf).
//
//   pnpm docs:screenshots      (builds the app and runs this script)
//
// It starts the built app (out/) with temporary folders for data and preferences, creates
// sample projects over IPC and walks through the interface in English, plus one screenshot in
// Spanish. It never touches the user's real data.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { _electron } from '@playwright/test'
import electronPath from 'electron'

const ROOT = resolve(import.meta.dirname, '..')
const MAIN = join(ROOT, 'out', 'main', 'index.js')
const IMAGES = join(ROOT, 'docs', 'images')
const PDF = join(ROOT, 'docs', 'sample-quote.pdf')

if (!existsSync(MAIN)) {
  console.error('out/main/index.js does not exist: build first with "pnpm build" (or use "pnpm docs:screenshots").')
  process.exit(1)
}

// Labels of the Spanish interface used to switch back to English.
// i18n:es-start
const LANGUAGE_NAMES = { es: 'Español' }
const SPANISH_LANGUAGE_LABEL = 'Idioma'
// i18n:es-end

// ─── Sample data ─────────────────────────────────────────────────────────────
// Declarative tree: `h` estimated hours, `who` person key, `sp` story points,
// `ref` links a task created earlier (shared subtask) at that position.

const ISSUER = {
  name: 'North Studio Ltd.',
  taxId: 'GB 123 4567 89',
  address: '1 High Street, London',
  email: 'hello@northstudio.example',
  phone: '+44 20 0000 0000',
  website: 'northstudio.example'
}

const PROJECTS = [
  {
    input: { name: 'ACME online store', client: 'ACME Retail Ltd.', defaultRateCents: 4500, currency: 'EUR' },
    members: [
      { key: 'anna', name: 'Anna Brooks', role: 'Frontend', rateCents: 5000, hoursPerDay: 7 },
      { key: 'james', name: 'James Carter', role: 'Backend', rateCents: 5500, hoursPerDay: 8 },
      { key: 'lucy', name: 'Lucy Martin', role: 'Design', rateCents: 4000, hoursPerDay: 6 }
    ],
    tasks: [
      {
        title: 'Authentication',
        description: 'Everything customers need to access their account securely.',
        children: [
          {
            title: 'Login',
            h: 2,
            who: 'anna',
            sp: 3,
            status: 'in_progress',
            description:
              'Sign-in screen with email and password.\n- Remember the session for 30 days\n- Temporary lock after 5 failed attempts\n- “Forgot my password” link',
            children: [
              {
                key: 'users',
                title: 'Design users table',
                h: 4,
                who: 'james',
                sp: 2,
                status: 'done',
                description:
                  'Data model shared by login, sign-up and payments.\n\nIncludes a **unique index on email** and audit fields.'
              },
              { title: 'Login form', h: 6, who: 'anna', sp: 3, status: 'in_progress' }
            ]
          },
          {
            title: 'Sign-up',
            children: [
              { ref: 'users' },
              { title: 'Email validation', h: 5, who: 'james', sp: 3 },
              { title: 'Terms and privacy', h: 2, who: 'anna', sp: 1, status: 'review' }
            ]
          }
        ]
      },
      {
        title: 'Catalog',
        children: [
          { title: 'Product list', h: 12, who: 'anna', sp: 5 },
          {
            title: 'Search',
            children: [
              { title: 'Search index', h: 8, who: 'james', sp: 5 },
              { title: 'Filters and facets', h: 6, who: 'anna', sp: 3 }
            ]
          },
          { title: 'Product page', h: 8, who: 'anna', sp: 3 }
        ]
      },
      {
        title: 'Checkout',
        children: [
          { title: 'Cart', h: 10, who: 'anna', sp: 5 },
          {
            title: 'Payment gateway',
            h: 16,
            who: 'james',
            sp: 8,
            priority: 'high',
            description: 'Stripe and PayPal integration.\n1. Card payments\n2. Wallets\n3. Refunds from the dashboard',
            children: [{ ref: 'users' }]
          },
          // No typed hours: they come from its story points (2 × 3 h).
          { title: 'Transactional emails', sp: 2 }
        ]
      },
      {
        title: 'Design',
        children: [
          {
            title: 'Wireframes',
            h: 12,
            who: 'lucy',
            sp: 5,
            status: 'done',
            description: 'Low-fidelity sketches of the 12 main screens, validated with the client in two iterations.'
          },
          { title: 'Visual design', h: 16, who: 'lucy', sp: 8, status: 'in_progress' },
          { title: 'Style guide', who: 'lucy' }
        ]
      }
    ],
    meta: {
      contingencyBps: 1000,
      taxBps: 2100,
      startDate: '2026-10-05',
      // Story points → hours: 1 point = 3 h by the rule of three, except 13 points = 36 h (not 39 h).
      pointScale: { minutesPerPoint: 180, overrides: [{ points: 13, minutes: 2160 }] },
      quote: {
        number: 'Q-2026-014',
        date: '2026-09-30',
        validityDays: 30,
        terms: 'Payment: 40% on signature, 60% on delivery.\nIncludes 3 months of support.'
      }
    }
  },
  {
    input: { name: 'Booking app', client: 'Smile Dental Clinic', defaultRateCents: 4000, currency: 'EUR' },
    members: [
      { key: 'martha', name: 'Martha Gill', role: 'Mobile', rateCents: 4800, hoursPerDay: 8 },
      { key: 'paul', name: 'Paul Reed', role: 'Backend', rateCents: 5000, hoursPerDay: 8 }
    ],
    tasks: [
      {
        title: 'Calendar',
        children: [
          { title: 'Appointment calendar', h: 14, who: 'martha', sp: 8, status: 'in_progress' },
          { title: 'SMS reminders', h: 6, who: 'paul', sp: 3 }
        ]
      },
      {
        title: 'Patients',
        children: [
          { title: 'Patient record', h: 10, who: 'martha', sp: 5, status: 'done' },
          { title: 'Visit history', h: 8, who: 'paul', sp: 5 }
        ]
      },
      { title: 'App store release', h: 4, who: 'martha', sp: 2 }
    ],
    meta: { startDate: '2026-10-19' }
  },
  {
    input: { name: 'Cloud migration', client: 'North Group', defaultRateCents: 7000, currency: 'USD' },
    members: [{ key: 'irene', name: 'Irene Shaw', role: 'DevOps', rateCents: 7500, hoursPerDay: 8 }],
    tasks: [
      { title: 'Service inventory', h: 6, who: 'irene', sp: 3, status: 'done' },
      {
        title: 'Infrastructure as code',
        children: [
          { title: 'Networking and security', h: 12, who: 'irene', sp: 5, status: 'in_progress' },
          { title: 'Managed databases', h: 10, who: 'irene', sp: 5 }
        ]
      },
      { title: 'Cut-over plan', h: 5, who: 'irene', sp: 2 }
    ],
    meta: { startDate: '2026-11-02' }
  }
]

// Runs inside the window (page.evaluate): it only uses the `planner` IPC bridge.
async function seedProject(spec) {
  const api = globalThis.planner
  const must = (r) => {
    if (!r.ok) throw new Error(JSON.stringify(r.error))
    return r.data
  }
  const { id } = must(await api.invoke('projects.create', spec.input))
  must(await api.invoke('project.open', { id }))
  const run = async (command) => must(await api.invoke('project.command', { id, command }))
  const members = {}
  for (const { key, ...fields } of spec.members) members[key] = (await run({ type: 'member.add', fields })).created[0]
  const keys = {}
  const create = async (parentId, nodes) => {
    for (const [index, node] of nodes.entries()) {
      if (node.ref) {
        await run({ type: 'edge.link', parentId, childId: keys[node.ref], index })
        continue
      }
      const fields = { title: node.title }
      if (node.h != null) fields.estimateMinutes = Math.round(node.h * 60)
      if (node.who) fields.assigneeId = members[node.who]
      if (node.sp != null) fields.storyPoints = node.sp
      if (node.status) fields.status = node.status
      if (node.priority) fields.priority = node.priority
      if (node.description) fields.description = node.description
      const taskId = (await run({ type: 'task.create', parentId, fields })).created[0]
      if (node.key) keys[node.key] = taskId
      if (node.children) await create(taskId, node.children)
    }
  }
  await create(null, spec.tasks)
  if (spec.meta) await run({ type: 'project.update', patch: spec.meta })
  must(await api.invoke('project.close', { id }))
}

// ─── Walk-through ────────────────────────────────────────────────────────────

const temp = mkdtempSync(join(tmpdir(), 'planner-docs-'))
const dataDir = join(temp, 'data')
const exportDir = join(temp, 'exports')
mkdirSync(dataDir, { recursive: true })
mkdirSync(exportDir, { recursive: true })
mkdirSync(IMAGES, { recursive: true })
// English from the first frame, whatever the language of this machine.
writeFileSync(join(dataDir, 'settings.json'), JSON.stringify({ language: 'en', theme: 'light' }))

const app = await _electron.launch({
  executablePath: electronPath,
  // Own user data: the interface preferences (localStorage) do not mix with the real ones.
  args: [`--user-data-dir=${join(temp, 'user-data')}`, MAIN],
  env: { ...process.env, PLANNER_DATA_DIR: dataDir, PLANNER_E2E_DIR: exportDir }
})

try {
  const page = await app.firstWindow()
  await page.emulateMedia({ colorScheme: null })
  await page.setViewportSize({ width: 1440, height: 880 })
  await page.waitForLoadState('domcontentloaded')

  const shot = async (name) => {
    await page.mouse.move(700, 24) // away from buttons: no tooltips or highlighted rows
    await page.waitForTimeout(450)
    await page.screenshot({ path: join(IMAGES, `${name}.png`) })
    console.log(`  docs/images/${name}.png`)
  }
  const invoke = (channel, input) => page.evaluate(([c, i]) => globalThis.planner.invoke(c, i), [channel, input])

  await invoke('settings.set', { issuer: ISSUER })
  for (const spec of PROJECTS) await page.evaluate(seedProject, spec)
  await page.reload()
  await page.getByText('ACME online store').first().waitFor()
  await shot('projects')

  await page.getByText('ACME online store').first().click()
  await page.getByRole('button', { name: 'Expand levels' }).click()
  await page.getByRole('menuitem', { name: 'All' }).click()
  // The menu gives the focus back to its button, which opens its tooltip: drop the focus.
  await page.evaluate(() => globalThis.document.activeElement?.blur())
  await shot('tree')

  await page.getByRole('button', { name: 'Descriptions', exact: true }).click()
  await shot('descriptions')
  await page.getByRole('button', { name: 'Descriptions', exact: true }).click()

  await page.getByRole('treeitem').filter({ hasText: 'Design users table' }).first().click()
  await page.keyboard.press(' ')
  await shot('detail')
  await page.getByRole('button', { name: 'Close panel' }).click()

  await page.getByRole('tab', { name: 'Board' }).click()
  await shot('board')
  await page.getByRole('tab', { name: 'Workload' }).click()
  await shot('workload')

  await page.getByRole('button', { name: 'Project settings' }).click()
  await page.getByRole('dialog').getByRole('tab', { name: 'Story points' }).click()
  await shot('story-points')
  await page.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('tab', { name: 'Tree' }).click()
  await invoke('settings.set', { theme: 'dark' })
  await shot('dark-mode')
  await invoke('settings.set', { theme: 'light' })

  // The same tree in Spanish, for the Language section of the README: switched from the
  // language menu of the top bar, as a user would, and back to English.
  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('menuitem', { name: LANGUAGE_NAMES.es }).click()
  await page.locator('html[lang="es"]').waitFor({ state: 'attached' })
  await page.evaluate(() => globalThis.document.activeElement?.blur())
  await shot('tree-es')
  await page.getByRole('button', { name: SPANISH_LANGUAGE_LABEL }).click()
  await page.getByRole('menuitem', { name: 'English', exact: true }).click()
  await page.locator('html[lang="en"]').waitFor({ state: 'attached' })

  await page.getByRole('button', { name: 'Export PDF' }).click()
  await shot('export-pdf')
  await page.getByRole('button', { name: 'Save PDF…' }).click()

  // The PDF is written to exportDir (automatic dialogs); wait until it is complete.
  let pdfPath = null
  for (let i = 0; i < 80 && !pdfPath; i++) {
    await page.waitForTimeout(250)
    const name = readdirSync(exportDir).find((f) => f.endsWith('.pdf'))
    if (name && statSync(join(exportDir, name)).size > 0) pdfPath = join(exportDir, name)
  }
  if (!pdfPath) throw new Error('The PDF was not generated')
  await page.waitForTimeout(500)
  rmSync(PDF, { force: true })
  renameSync(pdfPath, PDF)
  console.log('  docs/sample-quote.pdf')

  // Preview of a few pages with Chromium's PDF viewer, cropped to the sheet.
  for (const [name, pageNumber] of [
    ['pdf-cover', 1],
    ['pdf-summary', 2],
    ['pdf-breakdown', 3]
  ]) {
    const png = await app.evaluate(
      async ({ BrowserWindow }, { url }) => {
        const win = new BrowserWindow({ show: false, width: 900, height: 1240, webPreferences: { plugins: true } })
        await win.loadURL(url)
        await new Promise((r) => setTimeout(r, 2500))
        const image = await win.webContents.capturePage()
        win.destroy()
        // The sheet is whatever is not the viewer background; the scrollbar sits on the right.
        const { width, height } = image.getSize()
        const bitmap = image.toBitmap()
        const scale = Math.sqrt(bitmap.length / 4 / (width * height))
        const w = Math.round(width * scale)
        const h = Math.round(height * scale)
        const pixel = (x, y) => bitmap.subarray((y * w + x) * 4, (y * w + x) * 4 + 3)
        const midY = Math.floor(h / 2)
        const bg = [...pixel(2, midY)]
        const isBg = (x, y) => pixel(x, y).every((v, i) => Math.abs(v - bg[i]) < 8)
        let x0 = 0
        while (x0 < w - 1 && isBg(x0, midY)) x0++
        let x1 = w - 1
        while (x1 > x0 && !isBg(x1, midY)) x1--
        while (x1 > x0 && isBg(x1, midY)) x1--
        const midX = Math.floor((x0 + x1) / 2)
        let y0 = 0
        while (y0 < h - 1 && isBg(midX, y0)) y0++
        let y1 = h - 1
        while (y1 > y0 && isBg(midX, y1)) y1--
        // Thin dark frame, the same on all four sides.
        const m = Math.min(12, x0, y0, w - 1 - x1, h - 1 - y1)
        const rect = { x: x0 - m, y: y0 - m, width: x1 - x0 + 1 + 2 * m, height: y1 - y0 + 1 + 2 * m }
        const dip = (v) => Math.round(v / scale)
        return image
          .crop({ x: dip(rect.x), y: dip(rect.y), width: dip(rect.width), height: dip(rect.height) })
          .toPNG()
          .toString('base64')
      },
      { url: `${pathToFileURL(PDF).href}#page=${pageNumber}&toolbar=0&navpanes=0&view=Fit` }
    )
    writeFileSync(join(IMAGES, `${name}.png`), Buffer.from(png, 'base64'))
    console.log(`  docs/images/${name}.png`)
  }
} finally {
  await app.close()
  rmSync(temp, { recursive: true, force: true })
}
