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
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
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
`
}
