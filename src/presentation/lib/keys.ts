import { useEffect, useRef } from 'react'

/** Is the focus in a text field? (Then global shortcuts must not act.) */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/** Listens to keys on window with the latest handler (without reinstalling the listener). */
export function useWindowKeydown(handler: (e: KeyboardEvent) => void): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const listener = (e: KeyboardEvent) => ref.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}

export const isMod = (e: KeyboardEvent | React.KeyboardEvent) => e.ctrlKey || e.metaKey
