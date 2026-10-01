import type { TagColor } from '@domain'

/**
 * Fill and text color of each tag color, the same in the app (both themes) and in the PDF.
 * Vivid fills with text that keeps a contrast of at least 4.5:1 (checked by a unit test).
 */
export const TAG_PALETTE: Readonly<Record<TagColor, { readonly bg: string; readonly fg: string }>> = {
  red: { bg: '#dc2626', fg: '#ffffff' },
  orange: { bg: '#ea580c', fg: '#1c0a00' },
  amber: { bg: '#f59e0b', fg: '#1c1300' },
  lime: { bg: '#65a30d', fg: '#0f1a00' },
  green: { bg: '#15803d', fg: '#ffffff' },
  teal: { bg: '#0f766e', fg: '#ffffff' },
  cyan: { bg: '#06b6d4', fg: '#04252b' },
  blue: { bg: '#2563eb', fg: '#ffffff' },
  indigo: { bg: '#4f46e5', fg: '#ffffff' },
  violet: { bg: '#7c3aed', fg: '#ffffff' },
  fuchsia: { bg: '#c026d3', fg: '#ffffff' },
  pink: { bg: '#db2777', fg: '#ffffff' }
}
