import { useId, useMemo, useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { LANGUAGES, type Language } from '@domain'
import type { DescriptionPlacement, ReportColumns, ReportOptions, ReportSections } from '@application'
import { LANGUAGE_NAMES } from '@shared/i18n/language'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Field, NativeSelect } from '../../components/ui/input'
import { Segmented } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { describeError } from '../../i18n/errors'
import { call } from '../../lib/api'
import { useProject } from '../../stores/project'
import { useSettings } from '../../stores/settings'
import { toast } from '../../stores/toasts'

/** Initial form options (the last ones used in each project are remembered). */
const INITIAL: Omit<ReportOptions, 'language'> = {
  sections: { cover: true, summary: true, breakdown: true, workload: true, shared: true, terms: true },
  columns: { hours: true, cost: true, rate: false, storyPoints: true, assignee: true, status: false },
  maxDepth: null,
  subtotalDepth: 2,
  pageSize: 'A4',
  landscape: false,
  openAfterExport: true,
  descriptions: 'section'
}

const SECTIONS: ReadonlyArray<keyof ReportSections> = ['cover', 'summary', 'breakdown', 'workload', 'shared', 'terms']

const COLUMNS: ReadonlyArray<keyof ReportColumns> = ['hours', 'cost', 'rate', 'storyPoints', 'assignee', 'status']

const DESCRIPTION_PLACEMENTS: readonly DescriptionPlacement[] = ['none', 'inline', 'section']

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--primary)]" />
      {children}
    </label>
  )
}

export function ExportPdfDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { language, t } = useI18n()
  const saved = useSettings((s) => s.settings?.reportOptions[projectId])
  // Saved options are completed with the initial values (options added in later versions).
  const [options, setOptions] = useState<ReportOptions>(() => ({ ...INITIAL, ...saved, language: saved?.language ?? language }))
  const openState = useProject((s) => (s.id === projectId ? s.state : null))
  const described = useMemo(
    () => (openState ? [...openState.tasks.values()].filter((task) => task.description.trim() !== '').length : null),
    [openState]
  )
  const [busy, setBusy] = useState(false)
  const languageLabelId = useId()
  const set = (patch: Partial<ReportOptions>) => setOptions((o) => ({ ...o, ...patch }))

  const exportPdf = async () => {
    setBusy(true)
    try {
      const result = await call('project.exportPdf', { id: projectId, options })
      if (result) {
        toast.success(t.export.saved(result.path))
        void useSettings.getState().load()
        onClose()
      }
    } catch (e) {
      toast.error(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      size="lg"
      title={t.export.title}
      description={t.export.description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={() => void exportPdf()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <FileDown />} {busy ? t.export.generating : t.export.savePdf}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-6">
        <div className="col-span-2 flex items-center gap-3" role="group" aria-labelledby={languageLabelId}>
          <h3 id={languageLabelId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.export.language}
          </h3>
          <Segmented<Language>
            value={options.language}
            onChange={(pdfLanguage) => set({ language: pdfLanguage })}
            options={LANGUAGES.map((l) => ({ value: l, label: <span lang={l}>{LANGUAGE_NAMES[l]}</span> }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.export.sectionsTitle}</h3>
          {SECTIONS.map((k) => (
            <Check key={k} checked={options.sections[k]} onChange={(v) => set({ sections: { ...options.sections, [k]: v } })}>
              {t.export.sections[k]}
            </Check>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.export.columnsTitle}</h3>
          {COLUMNS.map((k) => (
            <Check key={k} checked={options.columns[k]} onChange={(v) => set({ columns: { ...options.columns, [k]: v } })}>
              {t.export.columns[k]}
            </Check>
          ))}
        </div>
        <Field label={t.export.depth} hint={t.export.depthHint}>
          <NativeSelect
            value={options.maxDepth === null ? 'all' : String(options.maxDepth)}
            onChange={(e) => set({ maxDepth: e.target.value === 'all' ? null : Number(e.target.value) })}
          >
            <option value="all">{t.export.allLevels}</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {t.export.upToLevel(n)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t.export.subtotals} hint={t.export.subtotalsHint}>
          <NativeSelect value={String(options.subtotalDepth)} onChange={(e) => set({ subtotalDepth: Number(e.target.value) })}>
            <option value="0">{t.export.noSubtotals}</option>
            <option value="1">{t.export.firstLevelOnly}</option>
            <option value="2">{t.export.upToLevel(2)}</option>
            <option value="3">{t.export.upToLevel(3)}</option>
            <option value="50">{t.export.everyLevel}</option>
          </NativeSelect>
        </Field>
        <Field label={t.export.paper}>
          <NativeSelect value={options.pageSize} onChange={(e) => set({ pageSize: e.target.value as ReportOptions['pageSize'] })}>
            <option value="A4">A4</option>
            <option value="Letter">{t.export.letter}</option>
          </NativeSelect>
        </Field>
        <Field label={t.export.orientation}>
          <NativeSelect value={options.landscape ? 'landscape' : 'portrait'} onChange={(e) => set({ landscape: e.target.value === 'landscape' })}>
            <option value="portrait">{t.export.portrait}</option>
            <option value="landscape">{t.export.landscape}</option>
          </NativeSelect>
        </Field>
        <fieldset className="col-span-2 flex flex-col gap-2 rounded-lg border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.export.descriptionsTitle}</legend>
          {DESCRIPTION_PLACEMENTS.map((placement) => (
            <label key={placement} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="descriptions"
                value={placement}
                checked={options.descriptions === placement}
                onChange={() => set({ descriptions: placement })}
                className="size-4 accent-[var(--primary)]"
              />
              {t.export.descriptions[placement]}
            </label>
          ))}
          {described !== null ? <p className="text-xs text-muted-foreground">{t.export.described(described)}</p> : null}
        </fieldset>
        <div className="col-span-2">
          <Check checked={options.openAfterExport} onChange={(v) => set({ openAfterExport: v })}>
            {t.export.openAfterExport}
          </Check>
        </div>
      </div>
    </Dialog>
  )
}
