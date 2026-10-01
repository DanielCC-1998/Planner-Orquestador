import { useEffect, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Input, Textarea } from './ui/input'

/**
 * Field with a local draft: it is edited freely and saved on leaving (blur) or with Enter.
 * Esc discards it. If the value changes from outside (undo, another view…), the draft follows.
 * `onCommit` returns an error message to reject the value.
 */
export function DraftInput({
  value,
  onCommit,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onCommit: (value: string) => string | null | undefined | Promise<string | null | undefined>
}) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setDraft(value)
      setError(null)
    }
  }, [value])

  const commit = async () => {
    if (draft === value) {
      setError(null)
      return
    }
    const problem = await onCommit(draft)
    setError(problem ?? null)
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        {...props}
        value={draft}
        aria-invalid={error ? true : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit()
          } else if (e.key === 'Escape') {
            setDraft(value)
            setError(null)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  )
}

export function DraftTextarea({
  value,
  onCommit,
  submitOnEnter,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onCommit: (value: string) => void
  submitOnEnter?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setDraft(value)
    }
  }, [value])
  return (
    <Textarea
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (submitOnEnter && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          ;(e.target as HTMLTextAreaElement).blur()
        } else if (e.key === 'Escape') {
          setDraft(value)
          ;(e.target as HTMLTextAreaElement).blur()
        }
      }}
    />
  )
}
