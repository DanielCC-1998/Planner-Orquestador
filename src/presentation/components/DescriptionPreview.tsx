import { Fragment, type ReactNode } from 'react'
import { cn } from '../lib/cn'

const BOLD = /\*\*(.+?)\*\*/g
const BULLET = /^[-*•]\s+/

function inline(line: string): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(BOLD)) {
    if (m.index > last) parts.push(line.slice(last, m.index))
    parts.push(<b key={m.index} className="font-semibold text-foreground/80">{m[1]}</b>)
    last = m.index + m[0].length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

/**
 * Compact preview of a description (tree and board): no blank lines, "•" bullets and
 * **bold**, clamped to `lines` lines. The full text is in the detail panel.
 */
export function DescriptionPreview({ text, lines = 3, className }: { text: string; lines?: 2 | 3; className?: string }) {
  const rows = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(BULLET, '• '))
  return (
    <div className={cn(lines === 2 ? 'line-clamp-2' : 'line-clamp-3', className)}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {inline(row)}
        </Fragment>
      ))}
    </div>
  )
}
