import { Check } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/menu'

export interface Swatch<T extends string> {
  readonly value: T
  /** Fill of the swatch. */
  readonly color: string
  /** Color of the check mark on the fill. */
  readonly ink: string
  /** Accessible name of the swatch. */
  readonly label: string
}

/**
 * A round color button that opens a grid of swatches. The swatches are menu items: they are
 * reached with the arrow keys, picked with Enter, the menu closes after a pick and the current
 * color shows a check mark.
 */
export function SwatchPicker<T extends string>({
  value,
  swatches,
  onChange,
  label,
  disabled = false
}: {
  value: T
  swatches: ReadonlyArray<Swatch<T>>
  onChange: (value: T) => void
  label: string
  disabled?: boolean
}) {
  const current = swatches.find((s) => s.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className="size-6 shrink-0 rounded-full ring-2 ring-card disabled:opacity-50"
          style={{ backgroundColor: current?.color ?? value }}
          aria-label={label}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="grid min-w-0 grid-cols-6 gap-1.5 p-2">
        {swatches.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onSelect={() => onChange(s.value)}
            aria-label={s.label}
            className="flex size-6 items-center justify-center rounded-full p-0 data-[highlighted]:ring-2 data-[highlighted]:ring-ring data-[highlighted]:ring-offset-1 [&_svg]:size-3.5 [&_svg]:text-current"
            style={{ backgroundColor: s.color, color: s.ink }}
          >
            {s.value === value ? <Check /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
