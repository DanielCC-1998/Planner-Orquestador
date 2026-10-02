import { useId, useState } from 'react'
import { AlertTriangle, BookmarkPlus, TextQuote } from 'lucide-react'
import {
  chooseContractModel,
  CURRENCIES,
  PALETTE,
  PARTY_FIELD_LIMITS,
  sprintAnchor,
  SPRINT_UNITS,
  type ContractParty,
  type MetaPatch,
  type SprintUnit
} from '@domain'
import { appendClause, LIBRARY_LIMITS, splitClauses } from '@shared/terms'
import { localDateOf, localIsoDate } from '@shared/time'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/menu'
import { Field, Input, NativeSelect, Textarea } from '../../components/ui/input'
import { Segmented, Tooltip } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { errorText } from '../../i18n/errors'
import { cn } from '../../lib/cn'
import { useProject } from '../../stores/project'
import { useSettings } from '../../stores/settings'
import { toast } from '../../stores/toasts'
import { draftFromScale, draftRows, ruleOfThree, scaleFromDraft, type DraftError, type PointScaleDraft } from './pointScaleDraft'
import { currentSprint, draftFromSprints, SPRINT_PRESETS, sprintsFromDraft, type SprintsDraft } from './sprintsDraft'

const WEEKDAYS = [
  { value: 1, key: 'mon' },
  { value: 2, key: 'tue' },
  { value: 3, key: 'wed' },
  { value: 4, key: 'thu' },
  { value: 5, key: 'fri' },
  { value: 6, key: 'sat' },
  { value: 7, key: 'sun' }
] as const

type Tab = 'general' | 'planning' | 'points' | 'sprints' | 'quote' | 'contract'

/** Fields of the client in the contract, in the order of the form ('wide' takes two columns). */
const PARTY_FIELDS: ReadonlyArray<{ readonly key: keyof ContractParty; readonly wide?: boolean }> = [
  { key: 'legalName', wide: true },
  { key: 'taxId' },
  { key: 'address', wide: true },
  { key: 'email' },
  { key: 'signerName' },
  { key: 'signerId' },
  { key: 'signerRole' }
]

/** Project settings. Everything is saved with a single command (a single undo step). */
export function ProjectSettingsDialog({ onClose }: { onClose: () => void }) {
  const { t, f } = useI18n()
  const meta = useProject((s) => s.state!.meta)
  const dispatch = useProject((s) => s.dispatch)
  const readOnly = useProject((s) => s.readOnly)
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
  const [clientParty, setClientParty] = useState<ContractParty>(meta.quote.client)
  const [contractModelId, setContractModelId] = useState<string | null>(meta.quote.contractModelId)
  // The library of contracts lives in the settings: models (general terms, law and courts) and saved texts.
  const settings = useSettings((s) => s.settings)
  const updateSettings = useSettings((s) => s.update)
  const models = settings?.contractModels ?? []
  const savedTexts = settings?.savedTexts ?? []
  const defaultModel = models.find((m) => m.id === settings?.defaultContractModelId) ?? null
  const chosenModelExists = contractModelId !== null && models.some((m) => m.id === contractModelId)
  // A model deleted from the library: the project uses the default one (known once the settings are loaded).
  const modelMissing = settings !== null && contractModelId !== null && !chosenModelExists
  const effectiveModel = chooseContractModel(models, settings?.defaultContractModelId ?? null, contractModelId)

  /** Adds texts to the library of the settings right away (it is shared by every project), skipping repeated ones. */
  const saveToLibrary = async (entries: ReadonlyArray<{ readonly name: string; readonly text: string }>) => {
    const current = useSettings.getState().settings?.savedTexts ?? []
    const known = new Set(current.map((saved) => saved.text.trim()))
    const fresh = entries.filter((entry) => {
      const text = entry.text.trim()
      if (!text || known.has(text)) return false
      known.add(text)
      return true
    })
    if (fresh.length === 0) {
      toast.success(t.projectSettings.contract.nothingNew)
      return
    }
    if (current.length + fresh.length > LIBRARY_LIMITS.texts) {
      toast.error(t.projectSettings.contract.libraryFull)
      return
    }
    const added = fresh.map((entry) => ({ id: crypto.randomUUID(), name: entry.name.slice(0, LIBRARY_LIMITS.name), text: entry.text.trim() }))
    await updateSettings({ savedTexts: [...current, ...added] })
    toast.success(t.projectSettings.contract.saved(added.length))
  }
  const [pointDraft, setPointDraft] = useState<PointScaleDraft>(() => draftFromScale(meta.pointScale))
  const [sprintDraft, setSprintDraft] = useState<SprintsDraft>(() => draftFromSprints(meta.sprints))
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
  // "1d" in the scale means one working day of the hours per day being edited here.
  const scaleHoursPerDay = hpdValue ?? meta.defaultHoursPerDay
  const scale = scaleFromDraft(pointDraft, scaleHoursPerDay)
  const draftErrorText = (e: DraftError | undefined | null) =>
    !e ? null : e.kind === 'zero' ? t.projectSettings.points.mustBePositive : errorText(t, e.error)
  const setOverride = (key: string, text: string) =>
    setPointDraft((d) => ({ ...d, overrides: { ...d.overrides, [key]: text } }))
  const sprints = sprintsFromDraft(sprintDraft)
  // Sprint 1 starts on the start date being edited here or, without one, on the day the project was created.
  const firstSprintDay = sprintAnchor({ startDate: startDate || null, createdAt: meta.createdAt }, localDateOf)
  const sprintNow = sprints.settings ? currentSprint(firstSprintDay, sprints.settings, localIsoDate(new Date())) : null
  const hasErrors = Object.values(errors).some(Boolean) || !scale.valid || sprints.error !== null

  /** First tab with a wrong field, so the error is visible after "Save". */
  const tabWithError = (): Tab | null => {
    if (errors.name) return 'general'
    if (errors.rate || errors.hpd || errors.weekdays || errors.contingency || errors.tax) return 'planning'
    if (!scale.valid) return 'points'
    if (sprints.error !== null) return 'sprints'
    if (errors.validity) return 'quote'
    return null
  }

  const save = async () => {
    if (hasErrors || hpdValue === null) {
      const wrong = tabWithError()
      if (wrong) setTab(wrong)
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
      pointScale: scale.scale,
      sprints: sprints.settings,
      quote: {
        number: quoteNumber.trim(),
        date: quoteDate || null,
        validityDays,
        terms,
        client: clientParty,
        // A model deleted from the library is forgotten: the project goes back to the default one.
        contractModelId: modelMissing ? null : contractModelId
      }
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
          <Button variant="primary" disabled={readOnly} onClick={() => void save()}>
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
          { value: 'points', label: t.projectSettings.tabs.points },
          { value: 'sprints', label: t.projectSettings.tabs.sprints },
          { value: 'quote', label: t.projectSettings.tabs.quote },
          { value: 'contract', label: t.projectSettings.tabs.contract }
        ]}
      />
      {/* A read-only project (from a newer version of the app) can be looked at, not changed. */}
      <fieldset disabled={readOnly} className="contents">
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
        {tab === 'points' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t.projectSettings.points.intro}</p>
            <table className="w-full max-w-xl text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">{t.projectSettings.points.pointsColumn}</th>
                  <th className="py-1 pr-3 font-medium">{t.projectSettings.points.hoursColumn}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 pr-3 font-medium tabular-nums">{t.projectSettings.points.points(f.storyPoints(1))}</td>
                  <td className="w-40 py-1 pr-3">
                    <Input
                      value={pointDraft.base}
                      onChange={(e) => setPointDraft((d) => ({ ...d, base: e.target.value }))}
                      placeholder={t.projectSettings.points.basePlaceholder}
                      aria-label={t.projectSettings.points.hoursFor(f.storyPoints(1))}
                      aria-invalid={scale.baseError ? true : undefined}
                    />
                  </td>
                  <td className="text-xs">
                    {scale.baseError ? (
                      <span className="text-destructive">{draftErrorText(scale.baseError)}</span>
                    ) : (
                      <span className="text-muted-foreground">{t.projectSettings.points.baseHint}</span>
                    )}
                  </td>
                </tr>
                {draftRows(pointDraft).map((points) => {
                  const key = String(points)
                  const text = pointDraft.overrides[key] ?? ''
                  const rule = ruleOfThree(pointDraft, points, scaleHoursPerDay)
                  const error = draftErrorText(scale.overrideErrors[key])
                  return (
                    <tr key={key}>
                      <td className="py-1 pr-3 font-medium tabular-nums">{t.projectSettings.points.points(f.storyPoints(points))}</td>
                      <td className="w-40 py-1 pr-3">
                        <Input
                          value={text}
                          disabled={rule === null}
                          onChange={(e) => setOverride(key, e.target.value)}
                          placeholder={rule === null ? '—' : f.hours(rule)}
                          aria-label={t.projectSettings.points.hoursFor(f.storyPoints(points))}
                          aria-invalid={error ? true : undefined}
                        />
                      </td>
                      <td className="text-xs">
                        {error ? (
                          <span className="text-destructive">{error}</span>
                        ) : text.trim() && rule !== null ? (
                          <Button variant="ghost" size="sm" onClick={() => setOverride(key, '')}>
                            {t.projectSettings.points.useRule}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">{t.projectSettings.points.byRule}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground">{t.projectSettings.points.otherValues}</p>
            <p className="text-xs text-muted-foreground">{t.projectSettings.points.offHint}</p>
          </div>
        ) : null}
        {tab === 'sprints' ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t.projectSettings.sprints.intro}</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sprintDraft.enabled}
                onChange={(e) => setSprintDraft((d) => ({ ...d, enabled: e.target.checked }))}
                className="size-4 accent-[var(--primary)]"
              />
              {t.projectSettings.sprints.enabled}
            </label>
            {sprintDraft.enabled ? (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <Field
                    label={t.projectSettings.sprints.length}
                    error={sprints.error !== null ? t.projectSettings.sprints.invalidLength(sprints.error.max) : null}
                  >
                    <div className="flex gap-2">
                      <Input
                        className="w-20"
                        value={sprintDraft.length}
                        inputMode="numeric"
                        onChange={(e) => setSprintDraft((d) => ({ ...d, length: e.target.value }))}
                        aria-invalid={sprints.error !== null ? true : undefined}
                      />
                      <NativeSelect
                        className="w-36"
                        value={sprintDraft.unit}
                        aria-label={t.projectSettings.sprints.unit}
                        onChange={(e) => setSprintDraft((d) => ({ ...d, unit: e.target.value as SprintUnit }))}
                      >
                        {SPRINT_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {t.projectSettings.sprints.units[unit]}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </Field>
                  <div className="flex gap-1.5 pb-0.5">
                    {SPRINT_PRESETS.map((preset) => (
                      <Button
                        key={`${preset.length}-${preset.unit}`}
                        variant="outline"
                        size="sm"
                        onClick={() => setSprintDraft({ enabled: true, length: String(preset.length), unit: preset.unit })}
                      >
                        {f.period(preset.length, preset.unit)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3 text-sm">
                  <span>
                    {startDate
                      ? t.projectSettings.sprints.startsOnStart(f.dateLong(firstSprintDay))
                      : t.projectSettings.sprints.startsOnCreation(f.dateLong(firstSprintDay))}
                  </span>
                  {sprints.settings ? (
                    <span className="font-medium">
                      {sprintNow
                        ? t.projectSettings.sprints.current(sprintNow.number, f.dateRange(sprintNow.start, sprintNow.end))
                        : t.projectSettings.sprints.notStarted(f.dateLong(firstSprintDay))}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t.projectSettings.sprints.offHint}</p>
            )}
            <p className="text-xs text-muted-foreground">{t.projectSettings.sprints.historyHint}</p>
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
          </div>
        ) : null}
        {tab === 'contract' ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3 flex flex-col gap-1">
              <Field label={t.projectSettings.contract.model} hint={t.projectSettings.contract.modelHint}>
                <NativeSelect value={chosenModelExists ? contractModelId! : ''} onChange={(e) => setContractModelId(e.target.value || null)}>
                  <option value="">{t.projectSettings.contract.defaultModel(defaultModel?.name ?? null)}</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <p className="text-xs text-muted-foreground">
                {effectiveModel
                  ? [
                      effectiveModel.governingLaw.trim() && `${t.projectSettings.contract.law}: ${effectiveModel.governingLaw.trim()}`,
                      effectiveModel.courts.trim() && `${t.projectSettings.contract.courts}: ${effectiveModel.courts.trim()}`
                    ]
                      .filter(Boolean)
                      .join(' · ') || t.projectSettings.contract.noLaw
                  : t.projectSettings.contract.noModel}
              </p>
              {modelMissing ? <p className="text-xs text-warning">{t.projectSettings.contract.missingModel}</p> : null}
            </div>
            <fieldset className="col-span-3 grid grid-cols-3 gap-3 rounded-lg border p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.projectSettings.contract.title}</legend>
              <p className="col-span-3 text-xs text-muted-foreground">{t.projectSettings.contract.hint}</p>
              {PARTY_FIELDS.map(({ key, wide }) => (
                <Field key={key} label={t.projectSettings.contract.fields[key]} className={wide ? 'col-span-2' : undefined}>
                  <Input
                    value={clientParty[key]}
                    maxLength={PARTY_FIELD_LIMITS[key]}
                    // Without a company name, the PDF uses the client of the General tab.
                    placeholder={key === 'legalName' ? client.trim() : undefined}
                    onChange={(e) => setClientParty((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </Field>
              ))}
            </fieldset>
            <div className="col-span-3 flex flex-col gap-1">
              <div className="flex items-end justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{t.projectSettings.terms}</span>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <TextQuote /> {t.projectSettings.contract.insert}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                      {savedTexts.length === 0 ? (
                        <DropdownMenuItem disabled>{t.projectSettings.contract.noTexts}</DropdownMenuItem>
                      ) : (
                        savedTexts.map((saved) => (
                          <DropdownMenuItem key={saved.id} onSelect={() => setTerms((current) => appendClause(current, saved.text))}>
                            {saved.name}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={!terms.trim()}>
                        <BookmarkPlus /> {t.projectSettings.contract.saveToLibrary}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => void saveToLibrary([{ name: t.projectSettings.contract.wholeName(name.trim() || meta.name), text: terms.trim() }])}
                      >
                        {t.projectSettings.contract.saveWhole}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void saveToLibrary(splitClauses(terms))}>{t.projectSettings.contract.saveClauses}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <Textarea aria-label={t.projectSettings.terms} value={terms} onChange={(e) => setTerms(e.target.value)} className="min-h-48" />
              <span className="text-xs text-muted-foreground">{t.projectSettings.termsHint}</span>
            </div>
          </div>
        ) : null}
      </fieldset>
    </Dialog>
  )
}
