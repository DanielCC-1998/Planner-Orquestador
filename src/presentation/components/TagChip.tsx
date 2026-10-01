import { X } from 'lucide-react'
import type { TagColor } from '@domain'
import { TAG_PALETTE } from '@shared/tagPalette'
import { cn } from '../lib/cn'

/** A removable chip needs a name for its × button. */
type Removal = { onRemove?: undefined; removeLabel?: undefined } | { onRemove: () => void; removeLabel: string }

/** A tag as a colored chip. With `onRemove` it gets a small × button. */
export function TagChip({
  name,
  color,
  size = 'sm',
  onRemove,
  removeLabel,
  className
}: {
  name: string
  color: TagColor
  size?: 'xs' | 'sm'
  className?: string
} & Removal) {
  const c = TAG_PALETTE[color]
  return (
    <span
      data-tag={name}
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-full font-semibold leading-none',
        size === 'xs' ? 'px-1.5 py-[3px] text-[10px]' : 'px-2 py-1 text-[11px]',
        className
      )}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <span className="truncate">{name}</span>
      {onRemove ? (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          aria-label={removeLabel}
          className="-mr-0.5 rounded-full opacity-75 hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  )
}
