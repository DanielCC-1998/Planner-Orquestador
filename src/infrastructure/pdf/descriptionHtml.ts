/** Safe HTML for the PDF: text escaping and light formatting of descriptions. */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!)
}

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const BOLD = /\*\*(.+?)\*\*/g

/** Escaped text with **bold**. */
function inlineText(text: string): string {
  return escapeHtml(text).replace(BOLD, '<b>$1</b>')
}

/**
 * Task description → safe, readable HTML: paragraphs (blank line), line breaks,
 * lists with “- ”, “* ” or “• ” and numbered lists “1. ”. All the text is escaped.
 */
export function renderDescriptionHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n')
  const out: string[] = []
  let paragraph: string[] = []
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null
  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(inlineText).join('<br>')}</p>`)
    paragraph = []
  }
  const flushList = () => {
    if (list) out.push(`<${list.kind}>${list.items.map((i) => `<li>${inlineText(i)}</li>`).join('')}</${list.kind}>`)
    list = null
  }
  for (const line of lines) {
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    if (bullet || numbered) {
      flushParagraph()
      const kind = bullet ? 'ul' : 'ol'
      if (list && list.kind !== kind) flushList()
      list ??= { kind, items: [] }
      list.items.push((bullet ?? numbered)![1]!.trim())
    } else if (line.trim() === '') {
      flushParagraph()
      flushList()
    } else {
      flushList()
      paragraph.push(line.trim())
    }
  }
  flushParagraph()
  flushList()
  return out.join('')
}
