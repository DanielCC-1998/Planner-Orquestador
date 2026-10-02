import { TASK_STATUSES, type TaskStatus } from '@domain'
import { STATUS_LABELS } from '@shared/labels'
import { createFormatter, type Formatter } from '@shared/format'
import { TAG_PALETTE } from '@shared/tagPalette'
import { termsParagraphs } from '@shared/terms'
import type { ReportLaneTask, ReportModel, ReportProgress, ReportRow, ReportSprint, ReportTag } from '@application'
import { reportCss } from './reportCss'
import { escapeHtml, renderDescriptionHtml } from './descriptionHtml'
import { REPORT_TEXT, type ReportText } from './reportText'

const e = escapeHtml

type TaskRow = Extract<ReportRow, { kind: 'task' }>

/** Colored chips of the tags of a task ('' when the option is off or it has none). */
function chips(model: ReportModel, tags: readonly ReportTag[]): string {
  if (!model.options.columns.tags) return ''
  return tags
    .map((tag) => {
      const c = TAG_PALETTE[tag.color]
      return `<span class="chip" style="background:${c.bg};color:${c.fg}">${e(tag.name)}</span>`
    })
    .join('')
}

/** Formatter and texts in the language of the report. */
interface Locale {
  readonly f: Formatter
  readonly text: ReportText
}

function localeOf(model: ReportModel): Locale {
  const language = model.options.language
  return { f: createFormatter(language), text: REPORT_TEXT[language] }
}

/** Usable height of the cover for the paper size and orientation (printToPDF margins included). */
function coverHeight(model: ReportModel): string {
  const { pageSize, landscape } = model.options
  const pageHeightMm = landscape ? (pageSize === 'A4' ? 210 : 215.9) : pageSize === 'A4' ? 297 : 279.4
  return `${Math.floor(pageHeightMm - 32)}mm`
}

function money(model: ReportModel, f: Formatter, cents: number): string {
  return f.money(cents, model.project.currency)
}

/** Name of the issuer's tax ID: theirs (RUT, NIF…) or the default of the language. Not escaped. */
function issuerTaxIdLabel(model: ReportModel): string {
  return model.issuer.taxIdLabel.trim() || localeOf(model).text.cover.taxId
}

function cover(model: ReportModel): string {
  const { project, summary, issuer, options } = model
  const { f, text } = localeOf(model)
  const cols = options.columns
  const issuerLines = [issuer.taxId && `${issuerTaxIdLabel(model)}: ${issuer.taxId}`, issuer.address, issuer.email, issuer.phone, issuer.website]
    .filter(Boolean)
    .map((l) => e(String(l)))
    .join(' · ')
  const hero: string[] = []
  if (cols.cost) {
    hero.push(
      kpi(
        text.kpi.totalAmount,
        money(model, f, summary.money.totalCents),
        project.taxBps > 0 ? text.cover.taxIncluded(e(project.taxLabel)) : '',
        true
      )
    )
  }
  if (cols.hours) {
    hero.push(
      kpi(
        text.kpi.effort,
        f.hours(summary.totalMinutes + summary.contingencyMinutes),
        text.cover.taskCount(summary.taskCount, f.number(summary.taskCount, 0))
      )
    )
  }
  if (summary.days > 0) {
    hero.push(
      kpi(text.kpi.estimatedDuration, f.days(summary.days), summary.endDate ? text.cover.estimatedEnd(f.date(summary.endDate)) : '')
    )
  }
  return `
<section class="cover" style="--cover-height:${coverHeight(model)}">
  <div class="band"></div>
  <div class="kicker">${e(text.cover.kicker)}</div>
  <h1>${e(project.name)}</h1>
  ${project.client ? `<div class="client">${text.cover.forClient(e(project.client))}</div>` : ''}
  <div class="quote">
    ${project.quoteNumber ? `<div><span class="label">${e(text.cover.quoteNumber)}</span><span class="value">${e(project.quoteNumber)}</span></div>` : ''}
    <div><span class="label">${e(text.cover.date)}</span><span class="value">${f.dateLong(project.quoteDate)}</span></div>
    ${project.validUntil ? `<div><span class="label">${e(text.cover.validUntil)}</span><span class="value">${f.dateLong(project.validUntil)}</span></div>` : ''}
    ${project.startDate ? `<div><span class="label">${e(text.cover.plannedStart)}</span><span class="value">${f.dateLong(project.startDate)}</span></div>` : ''}
  </div>
  ${hero.length ? `<div class="hero">${hero.join('')}</div>` : ''}
  <div class="spacer"></div>
  ${
    issuer.name || issuer.logoDataUrl
      ? `<div class="issuer">
    ${issuer.logoDataUrl ? `<img src="${e(issuer.logoDataUrl)}" alt="">` : ''}
    <div>
      ${issuer.name ? `<div class="name">${e(issuer.name)}</div>` : ''}
      ${issuerLines ? `<div class="lines">${issuerLines}</div>` : ''}
    </div>
  </div>`
      : ''
  }
</section>`
}

function kpi(label: string, value: string, sub = '', accent = false): string {
  return `<div class="kpi${accent ? ' accent' : ''}"><div class="label">${e(label)}</div><div class="value">${value}</div>${
    sub ? `<div class="sub">${sub}</div>` : ''
  }</div>`
}

function summarySection(model: ReportModel, flow: boolean): string {
  const { summary, project, options } = model
  const { f, text } = localeOf(model)
  const cols = options.columns
  const kpis: string[] = []
  if (cols.cost) kpis.push(kpi(text.kpi.totalAmount, money(model, f, summary.money.totalCents), '', true))
  if (cols.hours) {
    kpis.push(
      kpi(
        text.kpi.estimatedHours,
        f.hours(summary.totalMinutes + summary.contingencyMinutes),
        summary.contingencyMinutes > 0
          ? text.summary.withContingency(f.hours(summary.totalMinutes), f.hours(summary.contingencyMinutes))
          : ''
      )
    )
  }
  kpis.push(
    kpi(
      text.kpi.duration,
      summary.days > 0 ? f.days(summary.days) : '—',
      summary.weeks !== null && summary.days > 0
        ? `${f.weeks(summary.weeks)}${summary.endDate ? ` · ${text.summary.ends(f.date(summary.endDate))}` : ''}`
        : ''
    )
  )
  if (cols.storyPoints) kpis.push(kpi(text.kpi.storyPoints, f.storyPoints(summary.storyPoints)))
  kpis.push(kpi(text.kpi.tasks, f.number(summary.taskCount, 0)))

  const m = summary.money
  const budget = cols.cost
    ? `
  <h3>${e(text.summary.budget)}</h3>
  <table class="budget">
    <tbody>
      <tr><td>${e(text.summary.estimatedWork)}</td><td class="num">${money(model, f, m.subtotalCents)}</td></tr>
      ${project.contingencyBps > 0 ? `<tr><td>${text.summary.contingency(f.bps(project.contingencyBps))}</td><td class="num">${money(model, f, m.contingencyCents)}</td></tr>` : ''}
      ${project.taxBps > 0 ? `<tr><td>${e(text.summary.taxableBase)}</td><td class="num">${money(model, f, m.baseCents)}</td></tr>` : ''}
      ${project.taxBps > 0 ? `<tr><td>${e(project.taxLabel)} (${f.bps(project.taxBps)})</td><td class="num">${money(model, f, m.taxCents)}</td></tr>` : ''}
      <tr class="total"><td>${e(text.total)}</td><td class="num">${money(model, f, m.totalCents)}</td></tr>
    </tbody>
  </table>`
    : ''

  const notes: string[] = []
  if (summary.savingsMinutes > 0) {
    const parts = [cols.hours ? f.hours(summary.savingsMinutes) : '', cols.cost ? money(model, f, summary.savingsCents) : '']
      .filter(Boolean)
      .join(' · ')
    notes.push(`<div class="note shared">${text.summary.sharedNote(parts)}</div>`)
  }
  if (summary.days > 0) {
    notes.push(
      `<div class="note">${e(text.summary.durationNote)}${
        summary.bottleneck ? ` ${text.summary.paceSetter(e(summary.bottleneck.name))}` : ''
      }</div>`
    )
  }
  return `
<section class="${flow ? 'flow' : ''}">
  <h2>${e(text.summary.title)}</h2>
  <div class="kpis">${kpis.slice(0, 4).join('')}</div>
  ${budget}
  ${notes.join('')}
  ${project.description ? `<h3>${e(text.summary.scope)}</h3><p class="pre">${e(project.description)}</p>` : ''}
</section>`
}

function breakdownSection(model: ReportModel): string {
  const { f, text } = localeOf(model)
  const statusLabels = STATUS_LABELS[model.options.language]
  const c = model.options.columns
  const head = [
    `<th>${e(text.columns.wbs)}</th>`,
    `<th>${e(text.columns.task)}</th>`,
    c.assignee ? `<th>${e(text.columns.assignee)}</th>` : '',
    c.status ? `<th>${e(text.columns.status)}</th>` : '',
    c.storyPoints ? `<th class="num">${e(text.columns.storyPoints)}</th>` : '',
    c.hours ? `<th class="num">${e(text.columns.hours)}</th>` : '',
    c.rate ? `<th class="num">${e(text.columns.rate)}</th>` : '',
    c.cost ? `<th class="num">${e(text.columns.amount)}</th>` : ''
  ].join('')
  const valueCells = (sp: number | null, minutes: number | null, rate: number | null, cents: number | null, blankZero: boolean) => {
    const show = (v: number | null, format: (n: number) => string) => (v === null || (blankZero && v === 0) ? '—' : format(v))
    return [
      c.storyPoints ? `<td class="num">${show(sp, (n) => f.storyPoints(n))}</td>` : '',
      c.hours ? `<td class="num">${show(minutes, (n) => f.hours(n))}</td>` : '',
      c.rate ? `<td class="num">${rate === null ? '—' : `${money(model, f, rate)}/h`}</td>` : '',
      c.cost ? `<td class="num">${show(cents, (n) => money(model, f, n))}</td>` : ''
    ].join('')
  }
  const leadCells = (row: ReportRow) => {
    const pad = Math.min(row.depth - 1, 8) * 11
    return { pad }
  }
  const columnCount =
    2 +
    [c.assignee, c.status, c.storyPoints, c.hours, c.rate, c.cost].filter(Boolean).length
  const rows = model.rows
    .map((row) => {
      const { pad } = leadCells(row)
      if (row.kind === 'task') {
        const inlineDesc = model.options.descriptions === 'inline' && row.description !== ''
        // A parent whose subtasks are listed: its amounts are theirs, and it stays with the first one.
        const own = row.isParent && row.collapsedCount === 0
        // "keep": the page does not end after this row (a task without its description, a parent without its first subtask).
        const cls = [row.depth === 1 ? 'level-1' : '', row.isParent ? 'parent' : '', inlineDesc ? 'has-desc' : '', inlineDesc || own ? 'keep' : '']
          .filter(Boolean)
          .join(' ')
        const collapsed =
          row.collapsedCount > 0 ? ` <span class="collapsed">${e(text.breakdown.includesSubtasks(row.collapsedCount))}</span>` : ''
        const descRow = inlineDesc
          ? `
<tr class="${['desc-row', row.depth === 1 ? 'level-1' : '', own ? 'keep' : ''].filter(Boolean).join(' ')}"><td></td><td colspan="${columnCount - 1}" style="padding-left:${6 + pad}pt"><div class="desc">${renderDescriptionHtml(row.description)}</div></td></tr>`
          : ''
        return `<tr class="${cls}">
  <td class="code">${e(row.code)}</td>
  <td class="title" style="padding-left:${6 + pad}pt">${e(row.title)}${chips(model, row.tags)}${collapsed}</td>
  ${c.assignee ? `<td>${row.assignee ? e(row.assignee) : '<span class="muted">—</span>'}</td>` : ''}
  ${c.status ? `<td class="status">${e(statusLabels[row.status])}</td>` : ''}
  ${valueCells(row.storyPoints || null, row.minutes, own && row.minutes === 0 ? null : row.rateCents, row.costCents, own)}
</tr>${descRow}`
      }
      if (row.kind === 'reference') {
        const ref = row.refKind === 'see' ? text.breakdown.seeShared(e(row.refCode)) : text.breakdown.includedShared(e(row.refCode))
        return `<tr class="ref">
  <td class="code">${e(row.code)}</td>
  <td style="padding-left:${6 + pad}pt">↗ ${e(row.title)} <span class="tag">${ref}</span></td>
  ${c.assignee ? '<td></td>' : ''}
  ${c.status ? '<td></td>' : ''}
  ${valueCells(null, null, null, null, true)}
</tr>`
      }
      const span = 2 + (c.assignee ? 1 : 0) + (c.status ? 1 : 0)
      return `<tr class="subtotal">
  <td class="label" colspan="${span}">${text.breakdown.subtotal(e(row.code), e(row.title))}</td>
  ${valueCells(row.storyPoints, row.minutes, null, row.costCents, false)}
</tr>`
    })
    .join('\n')
  const s = model.summary
  const span = 2 + (c.assignee ? 1 : 0) + (c.status ? 1 : 0)
  const total = `<tr class="grand"><td colspan="${span}">${e(text.total)}${
    s.savingsMinutes > 0 ? ` <span class="collapsed">${e(text.breakdown.sharedCountedOnce)}</span>` : ''
  }</td>${valueCells(s.storyPoints, s.totalMinutes, null, s.money.subtotalCents, false)}</tr>`
  return `
<section class="flow">
  <h2>${e(text.breakdown.title)}</h2>
  <table class="wbs">
    <thead><tr>${head}</tr></thead>
    <tbody>
${rows}
${total}
    </tbody>
  </table>
  ${
    model.project.contingencyBps > 0 || model.project.taxBps > 0
      ? `<p class="small muted" style="margin-top:6pt">${e(text.breakdown.amountsNote)}</p>`
      : ''
  }
</section>`
}

/** "Task details": one card per task with a description, in the order of the breakdown. */
function detailsSection(model: ReportModel): string {
  const { f, text } = localeOf(model)
  const statusLabels = STATUS_LABELS[model.options.language]
  const c = model.options.columns
  const items = model.rows.filter((r): r is TaskRow => r.kind === 'task' && r.description !== '')
  if (items.length === 0) return ''
  const body = items
    .map((r) => {
      const meta = [
        c.assignee && r.assignee ? e(r.assignee) : '',
        c.status ? e(statusLabels[r.status]) : '',
        c.hours && r.attrMinutes > 0 ? f.hours(r.attrMinutes) : '',
        c.cost && r.attrCostCents > 0 ? money(model, f, r.attrCostCents) : ''
      ]
        .filter(Boolean)
        .join(' · ')
      const tags = chips(model, r.tags)
      return `<article class="detail${r.depth === 1 ? ' level-1' : ''}">
  <header><span class="dcode">${e(r.code)}</span><span class="dtitle">${e(r.title)}</span>${meta ? `<span class="meta">${meta}</span>` : ''}</header>
  ${tags ? `<div class="chips">${tags}</div>` : ''}
  ${r.path.length ? `<div class="path">${e(r.path.join(' › '))}</div>` : ''}
  <div class="desc">${renderDescriptionHtml(r.description)}</div>
</article>`
    })
    .join('')
  return `
<section class="flow details">
  <h2>${e(text.details.title)}</h2>
  <p class="small muted lead">${e(text.details.intro)}</p>
  ${body}
</section>`
}

/** Status pill ("To do", "Done"…) in the colors of the PDF. */
function pill(model: ReportModel, status: TaskStatus): string {
  return `<span class="pill ${status}">${e(STATUS_LABELS[model.options.language][status])}</span>`
}

/** One sprint: the head repeats on every page the table spans; one row per net status change. */
function sprintTable(model: ReportModel, sprint: ReportSprint): string {
  const { f, text } = localeOf(model)
  const t = text.progress
  const name = sprint.number === 0 ? t.beforeFirst : t.sprint(sprint.number)
  const when = sprint.start ? f.dateRange(sprint.start, sprint.end) : ''
  const finished = sprint.changes.filter((c) => c.to === 'done').length
  const forward = sprint.changes.filter((c) => c.direction === 'forward' && c.to !== 'done').length
  const backward = sprint.changes.filter((c) => c.direction === 'backward').length
  const counts = [finished ? t.finished(finished) : '', forward ? t.forward(forward) : '', backward ? t.backward(backward) : '']
    .filter(Boolean)
    .join(' · ')
  const rows = sprint.changes.length
    ? sprint.changes
        .map(
          (c) => `<tr class="${c.direction}">
  <td class="code">${e(c.code)}</td>
  <td class="title">${e(c.title)}${chips(model, c.tags)}</td>
  <td class="change"><span class="dir ${c.direction}">${c.direction === 'forward' ? '▲' : '▼'}</span>${pill(model, c.from)}<span class="arrow ${c.direction}">→</span>${pill(model, c.to)}${
    c.direction === 'backward' ? `<span class="back">${e(t.movedBack)}</span>` : ''
  }</td>
</tr>`
        )
        .join('\n')
    : `<tr><td colspan="3" class="muted">${e(t.noChanges)}</td></tr>`
  return `
<table class="sprint">
  <thead><tr class="sprint-head"><th colspan="3"><div class="sh"><span><b>${e(name)}</b>${when ? `<span class="when">${e(when)}</span>` : ''}${
    sprint.current ? `<span class="current">${e(t.current)}</span>` : ''
  }</span>${counts ? `<span class="counts">${e(counts)}</span>` : ''}</div></th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>`
}

/** A run of sprints without changes in a single line: "Sprints 4–6 · Oct 1 – Nov 11, 2026 · No status changes". */
function quietSprints(model: ReportModel, run: readonly ReportSprint[]): string {
  const { f, text } = localeOf(model)
  const t = text.progress
  const first = run[0]!
  const last = run[run.length - 1]!
  const name = run.length === 1 ? t.sprint(first.number) : t.sprintRange(first.number, last.number)
  const when = first.start ? f.dateRange(first.start, last.end) : ''
  return `<p class="quiet"><b>${e(name)}</b>${when ? ` · ${e(when)}` : ''} · ${e(t.noChanges)}</p>`
}

function sprintsPart(model: ReportModel, progress: ReportProgress): string {
  const { f, text } = localeOf(model)
  const t = text.progress
  const head = `<h3>${e(t.sprintsTitle)}</h3>`
  if (!progress.sprintSettings) return `${head}<p class="small muted">${e(t.noSprints)}</p>`
  const blocks: string[] = []
  let quiet: ReportSprint[] = []
  const flush = () => {
    if (quiet.length > 0) blocks.push(quietSprints(model, quiet))
    quiet = []
  }
  for (const sprint of progress.sprints) {
    // The current sprint is always shown, so the reader sees where the project is.
    if (sprint.changes.length === 0 && !sprint.current) {
      quiet.push(sprint)
      continue
    }
    flush()
    blocks.push(sprintTable(model, sprint))
  }
  flush()
  // The title and the notes stay with the first sprint: they never end a page on their own.
  const firstSprint = progress.sprints.some((s) => s.number > 0)
    ? ''
    : `<p class="small muted${blocks.length > 0 ? ' lead' : ''}">${t.firstSprintStarts(e(f.date(progress.sprintStart)))}</p>`
  return `${head}<p class="small muted lead">${e(t.sprintsIntro)}</p>${firstSprint}${blocks.join('\n')}`
}

/** Tasks of a lane grouped by their top-level task (the list is sorted by code): a group is never split. */
function laneGroups(tasks: readonly ReportLaneTask[]): ReportLaneTask[][] {
  const groups: ReportLaneTask[][] = []
  let top: string | null = null
  for (const task of tasks) {
    const key = task.code.split('.')[0] ?? ''
    if (key !== top) groups.push([])
    groups[groups.length - 1]!.push(task)
    top = key
  }
  return groups
}

/**
 * "Task status": every task in a lane by status (three columns per lane, so it stays compact with
 * hundreds of tasks) and the net status changes of each sprint. Shown when the status option is on.
 */
function progressSection(model: ReportModel): string {
  const progress = model.progress
  if (!progress) return ''
  const { f, text } = localeOf(model)
  const t = text.progress
  const labels = STATUS_LABELS[model.options.language]
  const count = (s: TaskStatus) => progress.lanes[s].length
  const total = TASK_STATUSES.reduce((n, s) => n + count(s), 0)
  const share = (n: number) => (total === 0 ? 0 : n / total)
  const stack = TASK_STATUSES.filter((s) => count(s) > 0)
    .map((s) => `<i class="${s}" style="width:${(share(count(s)) * 100).toFixed(3)}%"></i>`)
    .join('')
  const legend = TASK_STATUSES.map(
    (s) => `<span><span class="dot ${s}"></span>${e(labels[s])} <b>${f.number(count(s))}</b> (${f.percent(share(count(s)))})</span>`
  ).join('')
  const lanes = TASK_STATUSES.map((s) => {
    const tasks = progress.lanes[s]
    const item = (task: ReportLaneTask) =>
      `<div class="item${task.isParent ? ' parent' : ''}"><span class="lcode">${e(task.code)}</span><span class="ltitle">${e(task.title)}</span>${chips(model, task.tags)}</div>`
    const list = tasks.length
      ? `<ul>${laneGroups(tasks)
          .map((group) => `<li>${group.map(item).join('')}</li>`)
          .join('')}</ul>`
      : `<p class="empty">${e(t.emptyLane)}</p>`
    // A table so the head of the lane repeats at the top of every page its list continues on.
    return `<table class="lane ${s}"><thead><tr><th><div class="lane-head"><span class="dot ${s}"></span>${e(labels[s])} · ${f.number(tasks.length)}</div></th></tr></thead><tbody><tr><td>${list}</td></tr></tbody></table>`
  }).join('\n')
  const settings = progress.sprintSettings
  const rhythm = settings
    ? ` · ${t.rhythm(e(f.period(settings.length, settings.unit)), e(f.date(progress.sprintStart)))}`
    : ''
  return `
<section class="progress">
  <h2>${e(t.title)}</h2>
  <p class="small muted lead">${t.asOf(e(f.date(progress.asOf)))}${rhythm}</p>
  <div class="stack">${stack}</div>
  <div class="legend"><span class="muted">${e(t.byCount)}:</span>${legend}</div>
  ${lanes}
  ${sprintsPart(model, progress)}
</section>`
}

function workloadSection(model: ReportModel, flow: boolean): string {
  const { f, text } = localeOf(model)
  const c = model.options.columns
  const rows = model.workload
  if (rows.length === 0) return ''
  const maxDays = Math.max(...rows.map((r) => r.days), 0.0001)
  const body = rows
    .map(
      (r) => `<tr class="${r.isBottleneck ? 'bottleneck' : ''}">
  <td>${r.isBottleneck ? '<span class="star">★</span> ' : ''}${e(r.name)}${r.role ? ` <span class="muted small">${e(r.role)}</span>` : ''}</td>
  <td class="num">${f.number(r.hoursPerDay, 2)} h</td>
  ${c.hours ? `<td class="num">${f.hours(r.minutes)}</td>` : ''}
  ${c.storyPoints ? `<td class="num">${f.storyPoints(r.storyPoints)}</td>` : ''}
  ${c.cost ? `<td class="num">${money(model, f, r.costCents)}</td>` : ''}
  <td class="num">${f.number(r.days, 1)}</td>
  <td><div class="bar"><i style="width:${Math.round((r.days / maxDays) * 100)}%"></i></div></td>
</tr>`
    )
    .join('\n')
  return `
<section class="${flow ? 'flow' : ''}">
  <h2>${e(text.workload.title)}</h2>
  <table>
    <thead><tr>
      <th>${e(text.columns.person)}</th><th class="num">${e(text.columns.hoursPerDay)}</th>
      ${c.hours ? `<th class="num">${e(text.columns.hours)}</th>` : ''}
      ${c.storyPoints ? `<th class="num">${e(text.columns.storyPoints)}</th>` : ''}
      ${c.cost ? `<th class="num">${e(text.columns.amount)}</th>` : ''}
      <th class="num">${e(text.columns.days)}</th><th style="width:28%">${e(text.columns.load)}</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="small muted" style="margin-top:6pt">${e(text.workload.note(model.project.contingencyBps > 0))}</p>
</section>`
}

function sharedSection(model: ReportModel, flow: boolean): string {
  const { f, text } = localeOf(model)
  const c = model.options.columns
  if (model.shared.length === 0) return ''
  const columnCount = 3 + (c.hours ? 2 : 0) + (c.cost ? 2 : 0)
  // The tasks that need each subtask go below it, across the table, like the descriptions of the breakdown.
  const body = model.shared
    .map(
      (s) => `<tr class="keep has-desc">
  <td class="code">${e(s.code)}</td>
  <td class="title">${e(s.title)}</td>
  <td class="num">${f.number(s.occurrences, 0)}</td>
  ${c.hours ? `<td class="num">${f.hours(s.minutes)}</td>` : ''}
  ${c.cost ? `<td class="num">${money(model, f, s.costCents)}</td>` : ''}
  ${c.hours ? `<td class="num">${f.hours(s.savedMinutes)}</td>` : ''}
  ${c.cost ? `<td class="num">${money(model, f, s.savedCents)}</td>` : ''}
</tr>
<tr class="desc-row"><td></td><td colspan="${columnCount - 1}"><div class="desc"><b>${e(text.columns.neededBy)}:</b> ${s.parents
        .map((p) => `${e(p.code)} ${e(p.title)}`)
        .join(' · ')}</div></td></tr>`
    )
    .join('\n')
  const s = model.summary
  // 'together': it stays on the page only if all of it fits; otherwise it starts on the next one.
  return `
<section class="${flow ? 'flow together' : 'together'}">
  <h2>${e(text.shared.title)}</h2>
  <p class="lead">${e(text.shared.intro)}</p>
  <table>
    <thead><tr>
      <th>${e(text.columns.wbs)}</th><th>${e(text.columns.subtask)}</th><th class="num">${e(text.columns.occurrences)}</th>
      ${c.hours ? `<th class="num">${e(text.columns.hours)}</th>` : ''}
      ${c.cost ? `<th class="num">${e(text.columns.amount)}</th>` : ''}
      ${c.hours ? `<th class="num">${e(text.columns.savedHours)}</th>` : ''}
      ${c.cost ? `<th class="num">${text.columns.savedMoney(e(f.currencySymbol(model.project.currency)))}</th>` : ''}
    </tr></thead>
    <tbody>
${body}
      <tr class="grand"><td colspan="${3 + (c.hours ? 1 : 0) + (c.cost ? 1 : 0)}">${e(text.shared.totalSaved)}</td>
      ${c.hours ? `<td class="num">${f.hours(s.savingsMinutes)}</td>` : ''}
      ${c.cost ? `<td class="num">${money(model, f, s.savingsCents)}</td>` : ''}</tr>
    </tbody>
  </table>
</section>`
}

/**
 * One section of terms with a block per clause, never split between two pages. Like the appendix,
 * the terms only stay on the page if all of them fit; otherwise they start on the next one (and
 * longer ones break between clauses).
 */
function termsBlock(title: string, note: string, paragraphs: readonly string[]): string {
  return `
<section class="flow together">
  <h2>${e(title)}</h2>
  ${note ? `<p class="small muted lead">${e(note)}</p>` : ''}
  ${paragraphs.map((paragraph) => `<p class="pre clause">${e(paragraph)}</p>`).join('\n  ')}
</section>`
}

/** The particular terms of the project and the general terms of its contract model, which they prevail over. */
function termsSections(model: ReportModel): string {
  const { text } = localeOf(model)
  const particular = termsParagraphs(model.project.terms)
  const general = termsParagraphs(model.contract?.generalTerms ?? '')
  if (particular.length > 0 && general.length > 0) {
    return termsBlock(text.terms.particularTitle, text.terms.precedence, particular) + termsBlock(text.terms.generalTitle, '', general)
  }
  const only = particular.length > 0 ? particular : general
  return only.length > 0 ? termsBlock(text.terms.title, '', only) : ''
}

/** A detail of the contract, or a blank line to fill in by hand when it is empty. */
function fill(value: string): string {
  const text = value.trim()
  return text ? `<span class="value">${e(text)}</span>` : '<span class="value blank"></span>'
}

/** Label and value of a party or a signature (labels are texts of the PDF or the issuer's own). */
function contractRows(rows: ReadonlyArray<readonly [label: string, value: string]>): string {
  return rows.map(([label, value]) => `<div class="row"><span class="label">${e(label)}:</span>${fill(value)}</div>`).join('')
}

/**
 * Last page of a quote signed as a contract: who the parties are, what they accept (quote, scope,
 * amount and terms), the law and courts of its contract model, and room for both signatures. Empty
 * details are blank lines, so it can be completed by hand. It is never split between two pages.
 */
function signaturesSection(model: ReportModel): string {
  const { project, issuer, summary, options } = model
  const { f, text } = localeOf(model)
  const t = text.signatures
  const party = project.clientParty
  const parties = [
    { role: t.provider, name: issuer.name, rows: [[issuerTaxIdLabel(model), issuer.taxId], [t.address, issuer.address], [t.email, issuer.email]] as const },
    {
      role: t.client,
      name: party.legalName || project.client,
      rows: [[t.clientTaxId, party.taxId], [t.address, party.address], [t.email, party.email]] as const
    }
  ]
  const signers = [
    {
      role: t.provider,
      rows: [
        [t.signerName, issuer.signerName],
        [t.signerId, issuer.signerId],
        // The issuer signs for themselves unless they set a role.
        ...(issuer.signerRole.trim() ? [[t.signerRole, issuer.signerRole] as const] : []),
        [t.placeAndDate, '']
      ] as const
    },
    {
      role: t.client,
      rows: [[t.signerName, party.signerName], [t.signerId, party.signerId], [t.signerRole, party.signerRole], [t.placeAndDate, '']] as const
    }
  ]
  const acceptance = t.acceptance({
    number: e(project.quoteNumber),
    date: f.dateLong(project.quoteDate),
    project: e(project.name),
    amount: options.columns.cost ? money(model, f, summary.money.totalCents) : null
  })
  const governingLaw = model.contract?.governingLaw.trim() ?? ''
  const courts = model.contract?.courts.trim() ?? ''
  const law = [
    governingLaw ? t.governingLaw(e(governingLaw)) : '',
    courts ? t.courts(e(courts)) : ''
  ]
    .filter(Boolean)
    .join(' ')
  return `
<section class="flow together signatures">
  <h2>${e(t.title)}</h2>
  <div class="parties">
    ${parties.map((p) => `<div class="party"><div class="role">${e(p.role)}</div><div class="name">${fill(p.name)}</div>${contractRows(p.rows)}</div>`).join('\n    ')}
  </div>
  <p class="acceptance">${acceptance}${project.validUntil ? ` ${t.validUntil(f.dateLong(project.validUntil))}` : ''}</p>
  ${law ? `<p class="law">${law}</p>` : ''}
  <div class="signs">
    ${signers.map((s) => `<div class="sign"><div class="role">${e(s.role)}</div><div class="space"></div><div class="caption">${e(t.signature)}</div>${contractRows(s.rows)}</div>`).join('\n    ')}
  </div>
</section>`
}

function progressWithTitles(progress: ReportProgress, title: (raw: string) => string): ReportProgress {
  const lanes = {} as Record<TaskStatus, ReportLaneTask[]>
  for (const s of TASK_STATUSES) lanes[s] = progress.lanes[s].map((task) => ({ ...task, title: title(task.title) }))
  return {
    ...progress,
    lanes,
    sprints: progress.sprints.map((sprint) => ({
      ...sprint,
      changes: sprint.changes.map((c) => ({ ...c, title: title(c.title) }))
    }))
  }
}

/**
 * The model carries raw data: untitled tasks have '' as title, the unassigned group has no name
 * and an empty tax label means the default one. This fills in the localized placeholders.
 */
function withPlaceholders(model: ReportModel): ReportModel {
  const text = REPORT_TEXT[model.options.language]
  const titleOrPlaceholder = (title: string) => title || text.untitled
  return {
    ...model,
    project: { ...model.project, taxLabel: model.project.taxLabel || text.defaultTaxLabel },
    summary: {
      ...model.summary,
      bottleneck: model.summary.bottleneck && {
        ...model.summary.bottleneck,
        name: model.summary.bottleneck.unassigned ? text.unassigned : model.summary.bottleneck.name
      }
    },
    rows: model.rows.map((r) =>
      r.kind === 'task'
        ? { ...r, title: titleOrPlaceholder(r.title), path: r.path.map(titleOrPlaceholder) }
        : { ...r, title: titleOrPlaceholder(r.title) }
    ),
    progress: model.progress && progressWithTitles(model.progress, titleOrPlaceholder),
    workload: model.workload.map((w) => (w.isUnassigned ? { ...w, name: text.unassigned } : w)),
    shared: model.shared.map((s) => ({
      ...s,
      title: titleOrPlaceholder(s.title),
      parents: s.parents.map((p) => ({ ...p, title: titleOrPlaceholder(p.title) }))
    }))
  }
}

/** Complete HTML document of the quote, in the language of the report, ready for printToPDF. */
export function renderReportHtml(raw: ReportModel): string {
  const input = withPlaceholders(raw)
  const cols = input.options.columns
  const model: ReportModel = {
    ...input,
    options: { ...input.options, columns: { ...cols, storyPoints: cols.storyPoints && input.summary.storyPoints > 0 } }
  }
  const { text } = localeOf(model)
  const s = model.options.sections
  const parts: string[] = []
  if (s.cover) parts.push(cover(model))
  if (s.summary) parts.push(summarySection(model, false))
  if (s.breakdown) parts.push(breakdownSection(model))
  if (model.options.descriptions === 'section') parts.push(detailsSection(model))
  parts.push(progressSection(model))
  if (s.workload) parts.push(workloadSection(model, false))
  if (s.shared) parts.push(sharedSection(model, true))
  if (s.terms) parts.push(termsSections(model))
  if (s.signatures) parts.push(signaturesSection(model))
  return `<!doctype html>
<html lang="${model.options.language}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${text.documentTitle(e(model.project.name))}</title>
<style>${reportCss(model.project.color)}</style>
</head>
<body>
${parts.filter(Boolean).join('\n')}
</body>
</html>`
}

/**
 * Page footer for printToPDF (it does not inherit the CSS of the document). Every page names the
 * quote and its number, and when the quote is signed as a contract it has a box for the initials
 * of each party, so no page can be swapped.
 */
export function footerTemplate(model: ReportModel): string {
  const { text } = localeOf(model)
  const { project, options } = model
  const left = [model.issuer.name, project.name, project.quoteNumber && `${text.cover.quoteNumber} ${project.quoteNumber}`]
    .filter(Boolean)
    .map((part) => e(String(part)))
    .join(' · ')
  const box = '<span style="display:inline-block;width:13mm;height:4.5mm;border:0.6px solid #9ca3af;border-radius:1px;margin-left:1.5mm;"></span>'
  const initials =
    options.sections.signatures && options.initials
      ? `<span style="display:flex;align-items:center;">${e(text.signatures.initials)}${box}${box}</span>`
      : ''
  return `<div style="width:100%;font-size:7.5px;color:#6b7280;padding:0 14mm;display:flex;align-items:center;justify-content:space-between;gap:4mm;font-family:'Segoe UI',Arial,sans-serif;">
<span>${left}</span>${initials}<span>${text.pageOf('<span class="pageNumber"></span>', '<span class="totalPages"></span>')}</span></div>`
}
