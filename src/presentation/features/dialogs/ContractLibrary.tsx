import { useState } from 'react'
import { Copy, Plus, Star, Trash2 } from 'lucide-react'
import type { ContractModel, SavedText } from '@application'
import { LIBRARY_LIMITS } from '@shared/terms'
import { Button } from '../../components/ui/button'
import { Field, Input, Textarea } from '../../components/ui/input'
import { Badge, Segmented } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/cn'

/** The library being edited in the Settings dialog: saved with the rest of the settings. */
export interface LibraryDraft {
  readonly models: readonly ContractModel[]
  readonly defaultId: string | null
  readonly texts: readonly SavedText[]
}

type View = 'models' | 'texts'

/** First entry without a name, if any: they all need one to be saved. */
export function unnamedEntry(library: LibraryDraft): { readonly view: View; readonly id: string } | null {
  const model = library.models.find((m) => !m.name.trim())
  if (model) return { view: 'models', id: model.id }
  const text = library.texts.find((x) => !x.name.trim())
  return text ? { view: 'texts', id: text.id } : null
}

/** A list of the library: one button per entry (the selected one is pressed) and a button to add. */
function EntryList<T extends { readonly id: string; readonly name: string }>({
  entries,
  selected,
  onSelect,
  badge,
  empty,
  addLabel,
  onAdd
}: {
  entries: readonly T[]
  selected: string | null
  onSelect: (id: string) => void
  badge?: (entry: T) => string | null
  empty: string
  addLabel: string
  onAdd: () => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {entries.map((entry) => {
        const mark = badge?.(entry)
        return (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === selected}
            onClick={() => onSelect(entry.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
              entry.id === selected && 'bg-accent font-medium'
            )}
          >
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            {mark ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3 fill-current" /> {mark}
              </span>
            ) : null}
          </button>
        )
      })}
      {entries.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">{empty}</p> : null}
      <Button variant="outline" size="sm" className="mt-1 self-start" onClick={onAdd}>
        <Plus /> {addLabel}
      </Button>
    </div>
  )
}

/**
 * The library of contracts: models (usually one per country) with their general terms, law and
 * courts, and saved texts to insert into the particular terms of any project.
 */
export function ContractLibrary({
  library,
  onChange,
  focus
}: {
  library: LibraryDraft
  onChange: (next: LibraryDraft) => void
  /** Entry to show (e.g. one that still needs a name). */
  focus?: { readonly view: View; readonly id: string } | null
}) {
  const { t } = useI18n()
  const [view, setView] = useState<View>(focus?.view ?? 'models')
  const [modelId, setModelId] = useState<string | null>(focus?.view === 'models' ? focus.id : library.defaultId)
  const [textId, setTextId] = useState<string | null>(focus?.view === 'texts' ? focus.id : null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const model = library.models.find((m) => m.id === modelId) ?? library.models[0] ?? null
  const text = library.texts.find((x) => x.id === textId) ?? library.texts[0] ?? null

  const patchModel = (id: string, patch: Partial<ContractModel>) =>
    onChange({ ...library, models: library.models.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const addModel = (from?: ContractModel) => {
    const created: ContractModel = from
      ? { ...from, id: crypto.randomUUID(), name: t.settings.copyName(from.name) }
      : { id: crypto.randomUUID(), name: t.settings.untitledModel, governingLaw: '', courts: '', generalTerms: '' }
    // The first model of the library is the default one.
    onChange({ ...library, models: [...library.models, created], defaultId: library.defaultId ?? created.id })
    setModelId(created.id)
  }
  const deleteModel = (id: string) => {
    const models = library.models.filter((m) => m.id !== id)
    onChange({ ...library, models, defaultId: library.defaultId === id ? null : library.defaultId })
    setDeleting(null)
    setModelId(models[0]?.id ?? null)
  }
  const patchText = (id: string, patch: Partial<SavedText>) =>
    onChange({ ...library, texts: library.texts.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const addText = () => {
    const created: SavedText = { id: crypto.randomUUID(), name: t.settings.untitledText, text: '' }
    onChange({ ...library, texts: [...library.texts, created] })
    setTextId(created.id)
  }
  const deleteText = (id: string) => {
    const texts = library.texts.filter((x) => x.id !== id)
    onChange({ ...library, texts })
    setTextId(texts[0]?.id ?? null)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t.settings.contractHint}</p>
      <Segmented<View>
        value={view}
        onChange={setView}
        options={[
          { value: 'models', label: t.settings.library.models },
          { value: 'texts', label: t.settings.library.texts }
        ]}
      />
      {view === 'models' ? (
        <>
          <p className="text-xs text-muted-foreground">{t.settings.modelsHint}</p>
          <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-4">
            <EntryList
              entries={library.models}
              selected={model?.id ?? null}
              onSelect={setModelId}
              badge={(m) => (m.id === library.defaultId ? t.settings.isDefault : null)}
              empty={t.settings.noModels}
              addLabel={t.settings.newModel}
              onAdd={() => addModel()}
            />
            {model ? (
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex items-end gap-2">
                  <Field label={t.settings.modelName} className="flex-1">
                    <Input
                      value={model.name}
                      maxLength={LIBRARY_LIMITS.name}
                      placeholder={t.settings.modelNamePlaceholder}
                      onChange={(e) => patchModel(model.id, { name: e.target.value })}
                    />
                  </Field>
                  {model.id === library.defaultId ? (
                    <Badge tone="primary" className="mb-1.5">
                      {t.settings.isDefault}
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" className="mb-0.5" onClick={() => onChange({ ...library, defaultId: model.id })}>
                      <Star /> {t.settings.makeDefault}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="mb-0.5" onClick={() => addModel(model)}>
                    <Copy /> {t.settings.duplicate}
                  </Button>
                  <Button variant="ghost" size="icon" className="mb-0.5" aria-label={t.settings.deleteModel} onClick={() => setDeleting(model.id)}>
                    <Trash2 />
                  </Button>
                </div>
                {deleting === model.id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm">
                    <span className="min-w-0 wrap-anywhere">{t.settings.deleteModelConfirm(model.name)}</span>
                    <Button variant="destructive" size="sm" className="ml-auto" onClick={() => deleteModel(model.id)}>
                      {t.common.delete}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
                      {t.common.cancel}
                    </Button>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t.settings.governingLaw}>
                    <Input
                      value={model.governingLaw}
                      maxLength={LIBRARY_LIMITS.place}
                      placeholder={t.settings.governingLawPlaceholder}
                      onChange={(e) => patchModel(model.id, { governingLaw: e.target.value })}
                    />
                  </Field>
                  <Field label={t.settings.courts}>
                    <Input
                      value={model.courts}
                      maxLength={LIBRARY_LIMITS.place}
                      placeholder={t.settings.courtsPlaceholder}
                      onChange={(e) => patchModel(model.id, { courts: e.target.value })}
                    />
                  </Field>
                </div>
                <p className="-mt-1 text-xs text-muted-foreground">{t.settings.jurisdictionHint}</p>
                <Field label={t.settings.generalTerms} hint={t.settings.generalTermsHint}>
                  <Textarea
                    value={model.generalTerms}
                    maxLength={LIBRARY_LIMITS.text}
                    onChange={(e) => patchModel(model.id, { generalTerms: e.target.value })}
                    className="min-h-72"
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t.settings.textsHint}</p>
          <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-4">
            <EntryList
              entries={library.texts}
              selected={text?.id ?? null}
              onSelect={setTextId}
              empty={t.settings.noTexts}
              addLabel={t.settings.newText}
              onAdd={addText}
            />
            {text ? (
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex items-end gap-2">
                  <Field label={t.settings.textName} className="flex-1">
                    <Input value={text.name} maxLength={LIBRARY_LIMITS.name} onChange={(e) => patchText(text.id, { name: e.target.value })} />
                  </Field>
                  <Button variant="ghost" size="icon" className="mb-0.5" aria-label={t.settings.deleteText} onClick={() => deleteText(text.id)}>
                    <Trash2 />
                  </Button>
                </div>
                <Field label={t.settings.textBody}>
                  <Textarea
                    value={text.text}
                    maxLength={LIBRARY_LIMITS.text}
                    onChange={(e) => patchText(text.id, { text: e.target.value })}
                    className="min-h-72"
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
