/**
 * Fonts of the PDF: Segoe UI on Windows; on Linux, Liberation Sans (with the measures of Arial),
 * Noto Sans or DejaVu Sans, whichever is installed.
 */
export const PDF_FONTS = "'Segoe UI', 'Helvetica Neue', Arial, 'Liberation Sans', 'Noto Sans', 'DejaVu Sans', sans-serif"

/** Styles of the quote. Always light: the PDF does not depend on the app theme. */
export function reportCss(accent: string): string {
  return `
:root {
  color-scheme: light;
  --accent: ${accent};
  --ink: #111827;
  --ink-2: #374151;
  --muted: #6b7280;
  --line: #e5e7eb;
  --soft: #f5f6f8;
  --shared: #b45309;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  font-family: ${PDF_FONTS};
  font-size: 9.2pt;
  line-height: 1.45;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
section { break-before: page; }
section.flow { break-before: auto; margin-top: 18pt; }
section:first-of-type { break-before: auto; }
/* Stays after the previous section only if all of it fits there; otherwise it starts on a new page. */
section.together { break-inside: avoid; }
h2 {
  font-size: 13.5pt;
  font-weight: 650;
  margin: 0 0 9pt;
  padding-bottom: 4pt;
  border-bottom: 2px solid var(--accent);
  break-after: avoid;
}
h3 { font-size: 10.5pt; margin: 14pt 0 6pt; break-after: avoid; }
p { margin: 0 0 6pt; }
/* Introductions stay with what they introduce: a page never ends with a title or its intro alone. */
.lead { break-after: avoid; }
.muted { color: var(--muted); }
.small { font-size: 8pt; }
.note {
  border-left: 3px solid var(--accent);
  background: var(--soft);
  padding: 6pt 9pt;
  margin: 8pt 0;
  border-radius: 0 4pt 4pt 0;
  break-inside: avoid;
}
.note.shared { border-left-color: var(--shared); }
.pre { white-space: pre-wrap; }
.clause { margin-bottom: 9pt; break-inside: avoid; }

/* Cover */
.cover { display: flex; flex-direction: column; min-height: var(--cover-height); }
.cover .band { height: 7mm; background: var(--accent); border-radius: 3pt; margin-bottom: 26mm; }
.cover .kicker { letter-spacing: .18em; text-transform: uppercase; font-size: 8.5pt; color: var(--muted); font-weight: 600; }
.cover h1 { font-size: 27pt; line-height: 1.15; margin: 6pt 0 8pt; font-weight: 700; }
.cover .client { font-size: 13pt; color: var(--ink-2); }
.cover .quote { display: flex; gap: 22pt; margin-top: 22pt; }
.cover .quote div { display: flex; flex-direction: column; }
.cover .quote .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.cover .quote .value { font-size: 10.5pt; font-weight: 600; }
.cover .hero { display: flex; gap: 10pt; margin-top: 26pt; }
.cover .hero .kpi { flex: 1; }
.cover .spacer { flex: 1; }
.issuer { display: flex; gap: 14pt; align-items: center; border-top: 1px solid var(--line); padding-top: 12pt; }
.issuer img { max-height: 42pt; max-width: 120pt; object-fit: contain; }
.issuer .name { font-weight: 650; font-size: 10.5pt; }
.issuer .lines { color: var(--ink-2); font-size: 8.5pt; }

/* KPIs */
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; margin-bottom: 10pt; }
.kpi { border: 1px solid var(--line); border-radius: 6pt; padding: 8pt 10pt; break-inside: avoid; }
.kpi .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.kpi .value { font-size: 14pt; font-weight: 650; margin-top: 2pt; }
.kpi .sub { font-size: 7.8pt; color: var(--muted); }
.kpi.accent { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 7%, white); }

/* Tables */
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
/* A page never ends with a task without its description, or a parent without its first subtask;
   subtotals and the total never open a page without the rows they add up. */
tr.keep { break-after: avoid; }
tr.subtotal, tr.grand { break-before: avoid; }
th {
  text-align: left;
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--muted);
  font-weight: 600;
  padding: 5pt 6pt;
  border-bottom: 1.5px solid var(--ink-2);
}
td { padding: 3.6pt 6pt; border-bottom: 1px solid var(--line); vertical-align: top; }
.num { text-align: right; white-space: nowrap; }
.code { color: var(--muted); white-space: nowrap; width: 1%; font-size: 8.2pt; }
.budget { width: 62%; margin-top: 4pt; }
.budget td { padding: 5pt 8pt; }
.budget tr.total td { font-weight: 700; font-size: 11pt; border-top: 2px solid var(--ink); border-bottom: none; }

tr.level-1 td { background: var(--soft); font-weight: 650; }
tr.parent td.title { font-weight: 600; }
tr.ref td { color: var(--muted); font-style: italic; }
tr.ref .tag { color: var(--shared); font-style: normal; font-weight: 600; }
tr.subtotal td { font-weight: 650; border-top: 1px solid var(--ink-2); border-bottom: 1px solid var(--line); background: #fff; }
tr.subtotal td.label { text-align: right; color: var(--ink-2); }
tr.grand td { font-weight: 750; font-size: 10.5pt; border-top: 2px solid var(--ink); border-bottom: none; padding-top: 6pt; }
.collapsed { color: var(--muted); font-size: 7.8pt; font-weight: 400; }
.status { font-size: 7.6pt; color: var(--ink-2); white-space: nowrap; }

.bar { height: 7pt; background: var(--soft); border-radius: 4pt; overflow: hidden; min-width: 60pt; }
.bar > i { display: block; height: 100%; background: var(--accent); border-radius: 4pt; }
tr.bottleneck td { font-weight: 650; }
.star { color: var(--accent); }

/* Task descriptions */
.desc { font-size: 8.4pt; line-height: 1.5; color: var(--ink-2); }
.desc p { margin: 0 0 3pt; }
.desc ul, .desc ol { margin: 0 0 3pt; padding-left: 14pt; }
.desc li { margin: 1pt 0; }
.desc > :last-child { margin-bottom: 0; }
tr.has-desc td { border-bottom: none; }
tr.desc-row td { padding-top: 0; padding-bottom: 6pt; font-weight: 400; }
tr.desc-row .desc { color: var(--muted); max-width: 160mm; }
tr.desc-row.level-1 td { background: var(--soft); }

/* Task details */
.details article {
  border: 1px solid var(--line);
  border-left: 3px solid var(--line);
  border-radius: 5pt;
  padding: 7pt 10pt;
  margin: 0 0 7pt;
  break-inside: avoid;
}
.details article.level-1 { border-left-color: var(--accent); }
.details header { display: flex; align-items: baseline; gap: 7pt; }
.details header .dcode { flex: none; color: var(--muted); font-size: 8.2pt; white-space: nowrap; }
.details header .dtitle { font-weight: 650; font-size: 10pt; }
.details header .meta { margin-left: auto; padding-left: 10pt; font-size: 8pt; color: var(--muted); white-space: nowrap; }
.details .path { font-size: 7.8pt; color: var(--muted); margin: 1pt 0 0; }
.details .desc { margin-top: 4pt; }
.details .chips { margin: 2pt 0 0 -3pt; }

/* Long titles without spaces must wrap instead of pushing the table off the page. */
td.title, .details header .dtitle, .lane .item { overflow-wrap: anywhere; }

/* Tag chips (colors inline, from the shared palette) */
.chip {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 6.8pt;
  font-weight: 650;
  line-height: 1.35;
  padding: 0 4pt;
  margin-left: 3pt;
  border-radius: 6pt;
  white-space: nowrap;
  vertical-align: 1px;
  font-style: normal;
}

/* Task status: colors of the PDF (it does not use the app theme) */
.pill { display: inline-block; font-size: 7.2pt; font-weight: 650; padding: 0.5pt 5pt; border-radius: 7pt; white-space: nowrap; }
.pill.todo, .lane.todo .lane-head { background: #eef0f3; color: #374151; }
.pill.in_progress, .lane.in_progress .lane-head { background: #dbeafe; color: #1d4ed8; }
.pill.review, .lane.review .lane-head { background: #f3e8ff; color: #7e22ce; }
.pill.done, .lane.done .lane-head { background: #dcfce7; color: #15803d; }
.dot { display: inline-block; width: 7pt; height: 7pt; border-radius: 50%; margin-right: 4pt; vertical-align: -0.5pt; }
.dot.todo, .stack i.todo { background: #9ca3af; }
.dot.in_progress, .stack i.in_progress { background: #2563eb; }
.dot.review, .stack i.review { background: #9333ea; }
.dot.done, .stack i.done { background: #16a34a; }
.stack { display: flex; height: 9pt; border-radius: 5pt; overflow: hidden; background: var(--soft); margin: 6pt 0 5pt; break-after: avoid; }
.stack i { display: block; height: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: 3pt 14pt; font-size: 8pt; color: var(--ink-2); margin-bottom: 4pt; break-after: avoid; }
/* Each lane is a table whose head repeats on every page the list continues on. */
table.lane { margin-top: 10pt; }
table.lane th { padding: 0 0 4pt; border: none; }
table.lane td { padding: 0; border: none; }
table.lane tr { break-inside: auto; }
.lane-head {
  display: flex;
  align-items: center;
  font-size: 8.4pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  padding: 3pt 7pt;
  border-radius: 4pt;
}
.lane ul { list-style: none; margin: 0; padding: 0 2pt; column-count: 3; column-gap: 14pt; }
/* One item per top-level task with its subtasks: a group never splits between columns or pages. */
.lane li { break-inside: avoid; }
.lane .item { font-size: 8.2pt; line-height: 1.35; padding: 1.5pt 0; }
.lane .item .lcode { color: var(--muted); font-size: 7.6pt; margin-right: 4pt; }
.lane .item.parent .ltitle { font-weight: 650; }
.lane .empty { font-size: 8pt; color: var(--muted); font-style: italic; padding: 0 2pt; margin: 0; }

/* Progress by sprint */
table.sprint { margin-top: 10pt; }
table.sprint tr.sprint-head th {
  text-transform: none;
  letter-spacing: 0;
  font-size: 9.4pt;
  color: var(--ink);
  font-weight: 400;
  padding: 6pt 6pt 4pt;
}
table.sprint .sh { display: flex; align-items: baseline; gap: 10pt; }
table.sprint .sh .when { color: var(--muted); margin-left: 7pt; }
table.sprint .sh .current { color: var(--accent); font-weight: 650; margin-left: 7pt; }
table.sprint .sh .counts { margin-left: auto; font-size: 8pt; color: var(--ink-2); }
table.sprint td.change { white-space: nowrap; text-align: right; width: 1%; }
.dir { font-size: 7pt; margin-right: 5pt; }
.dir.forward, .arrow.forward { color: #16a34a; }
.dir.backward, .arrow.backward { color: #dc2626; }
.arrow { font-weight: 700; margin: 0 4pt; }
.back { font-size: 7pt; font-weight: 700; color: #b91c1c; background: #fee2e2; border-radius: 6pt; padding: 0.5pt 5pt; margin-left: 5pt; }
.quiet { font-size: 8.4pt; color: var(--muted); margin: 8pt 0 0; padding: 4pt 6pt; border-bottom: 1px solid var(--line); }
.quiet b { color: var(--ink-2); }

/* Acceptance and signatures: the parties, what they accept and room to sign; empty details are lines */
.parties, .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; }
.parties { margin: 4pt 0 12pt; }
.party { border: 1px solid var(--line); border-radius: 6pt; padding: 8pt 10pt; }
.signatures .role { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-weight: 600; margin-bottom: 4pt; }
.party .name { display: flex; font-weight: 650; font-size: 10.5pt; margin-bottom: 3pt; }
/* Baseline: a long value wraps under its label's line, and an empty one is a line on that baseline. */
.signatures .row { display: flex; align-items: baseline; gap: 4pt; font-size: 8.6pt; margin-top: 4pt; }
.signatures .row .label { flex: none; color: var(--muted); }
.signatures .value { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.signatures .value.blank { min-height: 12pt; border-bottom: 0.75pt solid #9ca3af; }
.acceptance, .law { margin: 0 0 8pt; }
.signs { margin-top: 16pt; }
.sign .space { height: 24mm; border-bottom: 1pt solid var(--ink); }
.sign .caption { font-size: 7.5pt; color: var(--muted); margin: 2pt 0 4pt; }
`
}
