import { useState } from 'react'
import { CURRENCIES, PALETTE } from '@domain'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Field, Input, NativeSelect } from '../../components/ui/input'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/cn'
import { useCatalog } from '../../stores/catalog'
import { useUi } from '../../stores/ui'

export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const { t, f } = useI18n()
  const create = useCatalog((s) => s.create)
  const openProject = useUi((s) => s.openProject)
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [rate, setRate] = useState('')
  const [color, setColor] = useState<string>(PALETTE[0])
  const [busy, setBusy] = useState(false)
  const text = t.projects.create

  const parsedRate = f.parseMoneyInput(rate)
  const rateError = parsedRate === 'invalid' ? text.invalidAmount : null
  const canCreate = name.trim() !== '' && !rateError && !busy

  const submit = async () => {
    if (!canCreate) return
    setBusy(true)
    const card = await create({
      name: name.trim(),
      client: client.trim(),
      currency,
      color,
      defaultRateCents: parsedRate === 'invalid' ? null : parsedRate
    })
    setBusy(false)
    if (card) {
      onClose()
      openProject(card.id)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={text.title}
      description={text.description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" disabled={!canCreate} onClick={() => void submit()}>
            {text.submit}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Field label={text.name} className="col-span-2">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={text.namePlaceholder} />
        </Field>
        <Field label={text.client} className="col-span-2">
          <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder={text.clientPlaceholder} />
        </Field>
        <Field label={text.currency} hint={text.currencyHint}>
          <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} ({f.currencySymbol(c)})
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={text.defaultRate(f.currencySymbol(currency))} hint={text.defaultRateHint} error={rateError}>
          <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder={text.ratePlaceholder} inputMode="decimal" />
        </Field>
        <div className="col-span-2 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{text.color}</span>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={text.colorOption(c)}
                onClick={() => setColor(c)}
                className={cn('size-7 rounded-full ring-offset-2 ring-offset-popover transition', color === c && 'ring-2 ring-foreground')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
