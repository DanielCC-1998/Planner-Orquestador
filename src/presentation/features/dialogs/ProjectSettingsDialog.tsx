import { useId, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { CURRENCIES, PALETTE, type MetaPatch } from '@domain'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '../../components/ui/input'
import { Segmented, Tooltip } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/cn'
import { useProject } from '../../stores/project'
import { toast } from '../../stores/toasts'

const WEEKDAYS = [
  { value: 1, key: 'mon' },
  { value: 2, key: 'tue' },
  { value: 3, key: 'wed' },
  { value: 4, key: 'thu' },
  { value: 5, key: 'fri' },
  { value: 6, key: 'sat' },
  { value: 7, key: 'sun' }
] as const

type Tab = 'general' | 'planning' | 'quote'

/** Project settings. Everything is saved with a single command (a single undo step). */
export function ProjectSettingsDialog({ onClose }: { onClose: () => void }) {
  const { t, f } = useI18n()
  const meta = useProject((s) => s.state!.meta)
  const dispatch = useProject((s) => s.dispatch)
  const [tab, setTab] = useState<Tab>('general')
  const [name, setName] = useState(meta.name)
  const [client, setClient] = useState(meta.client)
  const [description, setDescription] = useState(meta.description)
  const [color, setColor] = useState(meta.color)
  const [currency, setCurrency] = useState(meta.currency)
  const [archived, setArchived] = useState(meta.archived)
  const [rate, setRate] = useState(() => f.centsToInput(meta.defaultRateCents))
  const [hoursPerDay, setHoursPerDay] = useState(() => f.decimalToInput(meta.defaultHoursPerDay))
  const [startDate, setStartDate] = useState(meta.startDate ?? '')
  const [weekdays, setWeekdays] = useState<number[]>([...meta.workingWeekdays])
  const [contingency, setContingency] = useState(() => f.bpsToInput(meta.contingencyBps))
  const [tax, setTax] = useState(() => f.bpsToInput(meta.taxBps))
  const [taxLabel, setTaxLabel] = useState(meta.taxLabel)
  const [quoteNumber, setQuoteNumber] = useState(meta.quote.number)
  const [quoteDate, setQuoteDate] = useState(meta.quote.date ?? '')
  const [validity, setValidity] = useState(meta.quote.validityDays === null ? '' : String(meta.quote.validityDays))
  const [terms, setTerms] = useState(meta.quote.terms)
  const weekdaysLabelId = useId()

  const rateCents = f.parseMoneyInput(rate)
  const hpd = f.parseDecimalInput(hoursPerDay)
  const hpdValue = typeof hpd === 'number' && hpd > 0 && hpd <= 24 ? hpd : null
  const contingencyBps = f.parsePercentInput(contingency)
  const taxBps = f.parsePercentInput(tax)
  const validityDays = validity.trim() === '' ? null : Number(validity)
  const errors = {
    name: name.trim() ? null : t.projectSettings.nameRequired,
    rate: rateCents === 'invalid' ? t.projectSettings.invalidAmount : null,
    hpd: hpdValue === null ? t.projectSettings.hoursPerDayRange : null,
    weekdays: weekdays.length > 0 ? null : t.projectSettings.noWorkingDays,
    contingency: contingencyBps === 'invalid' ? t.projectSettings.invalidPercent : null,
    tax: taxBps === 'invalid' ? t.projectSettings.invalidPercent : null,
    validity: validityDays === null || (Number.isInteger(validityDays) && validityDays >= 0) ? null : t.projectSettings.validityError
  }
  const hasErrors = Object.values(errors).some(Boolean)

  const save = async () => {
    if (hasErrors || hpdValue === null) {
      toast.error(t.projectSettings.checkFields)
      return
    }
    const patch: MetaPatch = {
      name: name.trim(),
      client: client.trim(),
      description,
      color,
      currency,
      archived,
      defaultRateCents: rateCents === 'invalid' ? null : rateCents,
      defaultHoursPerDay: hpdValue,
      startDate: startDate || null,
      workingWeekdays: weekdays,
      contingencyBps: contingencyBps === 'invalid' ? 0 : contingencyBps,
      taxBps: taxBps === 'invalid' ? 0 : taxBps,
      taxLabel: taxLabel.trim(),
      quote: { number: quoteNumber.trim(), date: quoteDate || null, validityDays, terms }
    }
    const delta = await dispatch({ type: 'project.update', patch })
    if (delta) {
      toast.success(t.projectSettings.saved)
      onClose()
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t.projectSettings.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <Segmented<Tab>
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'general', label: t.projectSettings.tabs.general },
          { value: 'planning', label: t.projectSettings.tabs.planning },
          { value: 'quote', label: t.projectSettings.tabs.quote }
        ]}
      />
      {tab === 'general' ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.projectSettings.name} className="col-span-2" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t.projectSettings.client} className="col-span-2">
            <Input value={client} onChange={(e) => setClient(e.target.value)} />
          </Field>
          <Field label={t.projectSettings.description} className="col-span-2" hint={t.projectSettings.descriptionHint}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-28" />
          </Field>
          <Field label={t.projectSettings.currency} hint={currency !== meta.currency ? undefined : t.projectSettings.currencyHint}>
            <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {[...new Set([meta.currency, ...CURRENCIES])].map((c) => (
                <option key={c} value={c}>
                  {c} ({f.currencySymbol(c)})
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t.projectSettings.color}</span>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={t.projectSettings.colorOption(c)}
                  onClick={() => setColor(c)}
                  className={cn('size-6 rounded-full ring-offset-2 ring-offset-popover', color === c && 'ring-2 ring-foreground')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {currency !== meta.currency ? (
            <div className="col-span-2 flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="size-4 shrink-0" /> {t.projectSettings.currencyWarning(currency)}
            </div>
          ) : null}
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            {t.projectSettings.archived}
          </label>
        </div>
      ) : null}
      {tab === 'planning' ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.projectSettings.defaultRate(f.currencySymbol(currency))} hint={t.projectSettings.defaultRateHint} error={errors.rate}>
            <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder={t.projectSettings.noRate} inputMode="decimal" />
          </Field>
          <Field label={t.projectSettings.hoursPerDay} hint={t.projectSettings.hoursPerDayHint} error={errors.hpd}>
            <Input value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label={t.projectSettings.startDate} hint={t.projectSettings.startDateHint}>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <div className="flex flex-col gap-1" role="group" aria-labelledby={weekdaysLabelId}>
            <span id={weekdaysLabelId} className="text-xs font-medium text-muted-foreground">
              {t.projectSettings.workingDays}
            </span>
            <div className="flex gap-1">
              {WEEKDAYS.map((d) => {
                const day = t.projectSettings.weekdays[d.key]
                return (
                  <Tooltip key={d.value} content={day.long}>
                    <button
                      type="button"
                      aria-label={day.long}
                      aria-pressed={weekdays.includes(d.value)}
                      onClick={() =>
                        setWeekdays((w) => (w.includes(d.value) ? w.filter((x) => x !== d.value) : [...w, d.value].sort((a, b) => a - b)))
                      }
                      className={cn(
                        'h-8 w-8 rounded-md border text-xs font-semibold',
                        weekdays.includes(d.value) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                      )}
                    >
                      {day.short}
                    </button>
                  </Tooltip>
                )
              })}
            </div>
            {errors.weekdays ? <span className="text-xs text-destructive">{errors.weekdays}</span> : null}
          </div>
          <Field label={t.projectSettings.contingency} hint={t.projectSettings.contingencyHint} error={errors.contingency}>
            <Input value={contingency} onChange={(e) => setContingency(e.target.value)} inputMode="decimal" />
          </Field>
          <div className="grid grid-cols-[1fr_96px] gap-2">
            <Field label={t.projectSettings.tax} hint={t.projectSettings.taxHint} error={errors.tax}>
              <Input value={tax} onChange={(e) => setTax(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label={t.projectSettings.taxName}>
              <Input value={taxLabel} onChange={(e) => setTaxLabel(e.target.value)} placeholder={t.common.defaultTaxLabel} />
            </Field>
          </div>
        </div>
      ) : null}
      {tab === 'quote' ? (
        <div className="grid grid-cols-3 gap-4">
          <Field label={t.projectSettings.quoteNumber}>
            <Input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} placeholder={t.projectSettings.quoteNumberPlaceholder} />
          </Field>
          <Field label={t.projectSettings.quoteDate} hint={t.projectSettings.quoteDateHint}>
            <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
          </Field>
          <Field label={t.projectSettings.validity} error={errors.validity}>
            <Input value={validity} onChange={(e) => setValidity(e.target.value)} inputMode="numeric" placeholder="30" />
          </Field>
          <Field label={t.projectSettings.terms} className="col-span-3" hint={t.projectSettings.termsHint}>
            <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} className="min-h-40" />
          </Field>
        </div>
      ) : null}
    </Dialog>
  )
}
