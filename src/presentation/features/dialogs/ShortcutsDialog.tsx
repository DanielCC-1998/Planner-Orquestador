import { Dialog } from '../../components/ui/dialog'
import { Kbd } from '../../components/ui/misc'
import { useI18n } from '../../i18n'

interface ShortcutGroup {
  readonly title: string
  readonly items: ReadonlyArray<readonly [keys: readonly string[], text: string]>
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const { ctrl, shift, alt, del, space, enter, esc, tab } = t.common.keys
  const groups: ShortcutGroup[] = [
    {
      title: t.shortcuts.createAndEdit,
      items: [
        [[enter], t.shortcuts.newTaskBelow],
        [[ctrl, enter], t.shortcuts.newSubtask],
        [['F2'], t.shortcuts.rename],
        [[esc], t.shortcuts.cancelEdit],
        [[del], t.shortcuts.delete],
        [[ctrl, 'D'], t.shortcuts.duplicate]
      ]
    },
    {
      title: t.shortcuts.structure,
      items: [
        [[tab], t.shortcuts.indent],
        [[shift, tab], t.shortcuts.outdent],
        [[alt, '↑ / ↓'], t.shortcuts.moveUpDown],
        [[ctrl, shift, 'C'], t.shortcuts.copyToShare],
        [[ctrl, shift, 'V'], t.shortcuts.pasteAsShared]
      ]
    },
    {
      title: t.shortcuts.navigate,
      items: [
        [['↑ / ↓'], t.shortcuts.moveBetweenTasks(shift)],
        [['← / →'], t.shortcuts.collapseExpand],
        [[alt, '→'], t.shortcuts.focus],
        [[alt, '←'], t.shortcuts.exitFocus],
        [[space], t.shortcuts.toggleDetail],
        [[alt, 'D'], t.shortcuts.toggleDescriptions],
        [[ctrl, 'K'], t.shortcuts.goToTask],
        [[ctrl, 'Z / Y'], t.shortcuts.undoRedo],
        [[ctrl, '+ / −'], t.shortcuts.zoom]
      ]
    }
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" title={t.shortcuts.title}>
      <div className="grid grid-cols-2 gap-6">
        {groups.map((g) => (
          <section key={g.title} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
            {g.items.map(([keys, text]) => (
              <div key={text} className="flex items-start justify-between gap-3 text-sm">
                <span>{text}</span>
                <span className="flex shrink-0 gap-1">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Dialog>
  )
}
