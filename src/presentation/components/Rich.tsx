import { Fragment } from 'react'

/**
 * Shows a catalog text where `**…**` marks bold parts. Translations can then put the emphasis
 * wherever the sentence needs it, without splitting the sentence into pieces.
 */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </>
  )
}
