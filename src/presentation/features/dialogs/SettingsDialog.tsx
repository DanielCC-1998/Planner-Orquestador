import { useState } from 'react'
import { FolderOpen, ImagePlus, Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import type { Issuer, LanguagePreference, ThemePreference } from '@application'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Field, Input } from '../../components/ui/input'
import { Segmented } from '../../components/ui/misc'
import { useI18n } from '../../i18n'
import { useLanguageOptions } from '../../i18n/useLanguageOptions'
import { call, errorMessage } from '../../lib/api'
import { useSettings } from '../../stores/settings'
import { toast } from '../../stores/toasts'
import { ContractLibrary, unnamedEntry, type LibraryDraft } from './ContractLibrary'

type Tab = 'general' | 'issuer' | 'contract'

/** Until the settings are loaded. */
const NO_ISSUER: Issuer = {
  name: '',
  taxId: '',
  taxIdLabel: '',
  address: '',
  email: '',
  phone: '',
  website: '',
  logoDataUrl: null,
  signerName: '',
  signerId: '',
  signerRole: ''
}

/** App settings: language and theme apply at once; the issuer and the contract library are saved with "Save". */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const settings = useSettings((s) => s.settings)
  const info = useSettings((s) => s.info)
  const update = useSettings((s) => s.update)
  const setTheme = useSettings((s) => s.setTheme)
  const setLanguage = useSettings((s) => s.setLanguage)
  const languageOptions = useLanguageOptions()
  const [tab, setTab] = useState<Tab>('general')
  const [issuer, setIssuer] = useState<Issuer>(settings?.issuer ?? NO_ISSUER)
  const set = (patch: Partial<Issuer>) => setIssuer((i) => ({ ...i, ...patch }))
  const [library, setLibrary] = useState<LibraryDraft>(() => ({
    models: settings?.contractModels ?? [],
    defaultId: settings?.defaultContractModelId ?? null,
    texts: settings?.savedTexts ?? []
  }))
  // Entry of the library to show when "Save" finds one without a name.
  const [focus, setFocus] = useState<ReturnType<typeof unnamedEntry>>(null)

  const pickLogo = async () => {
    try {
      const dataUrl = await call('settings.pickLogo')
      if (dataUrl) set({ logoDataUrl: dataUrl })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const save = async () => {
    const unnamed = unnamedEntry(library)
    if (unnamed) {
      setTab('contract')
      setFocus(unnamed)
      toast.error(t.settings.nameRequired)
      return
    }
    await update({
      issuer,
      contractModels: library.models.map((m) => ({ ...m, name: m.name.trim() })),
      defaultContractModelId: library.defaultId,
      savedTexts: library.texts.map((x) => ({ ...x, name: x.name.trim() }))
    })
    toast.success(t.settings.saved)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={t.settings.title}
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
          { value: 'general', label: t.settings.tabs.general },
          { value: 'issuer', label: t.settings.tabs.issuer },
          { value: 'contract', label: t.settings.tabs.contract }
        ]}
      />
      {tab === 'general' ? (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t.common.language.label}</h3>
            <Segmented<LanguagePreference>
              value={settings?.language ?? 'system'}
              onChange={(l) => void setLanguage(l)}
              options={languageOptions}
            />
            <p className="text-xs text-muted-foreground">{t.settings.languageHint}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t.settings.appearance}</h3>
            <Segmented<ThemePreference>
              value={settings?.theme ?? 'system'}
              onChange={(th) => void setTheme(th)}
              options={[
                { value: 'light', label: <><Sun /> {t.common.theme.light}</> },
                { value: 'dark', label: <><Moon /> {t.common.theme.dark}</> },
                { value: 'system', label: <><Monitor /> {t.common.theme.system}</> }
              ]}
            />
            <p className="text-xs text-muted-foreground">{t.settings.pdfAlwaysLight}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t.settings.data}</h3>
            <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={info?.dataDir}>
                {info?.dataDir}
              </span>
              <Button variant="outline" size="sm" onClick={() => void call('app.openDataDir')}>
                <FolderOpen /> {t.settings.openFolder}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {info?.portable ? t.settings.portableNote : ''}
              {t.settings.dataNote(info?.version ?? '')}
            </p>
          </section>
        </div>
      ) : null}

      {tab === 'issuer' ? (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">{t.settings.issuerTitle}</h3>
              <p className="text-xs text-muted-foreground">{t.settings.issuerHint}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.settings.issuerName} className="col-span-2">
                <Input value={issuer.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field label={t.settings.taxId}>
                <Input value={issuer.taxId} onChange={(e) => set({ taxId: e.target.value })} />
              </Field>
              <Field label={t.settings.taxIdLabel} hint={t.settings.taxIdLabelHint}>
                <Input value={issuer.taxIdLabel} maxLength={30} placeholder={t.settings.taxId} onChange={(e) => set({ taxIdLabel: e.target.value })} />
              </Field>
              <Field label={t.settings.address} className="col-span-2">
                <Input value={issuer.address} onChange={(e) => set({ address: e.target.value })} />
              </Field>
              <Field label={t.settings.email}>
                <Input value={issuer.email} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label={t.settings.phone}>
                <Input value={issuer.phone} onChange={(e) => set({ phone: e.target.value })} />
              </Field>
              <Field label={t.settings.website} className="col-span-2">
                <Input value={issuer.website} onChange={(e) => set({ website: e.target.value })} />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              {issuer.logoDataUrl ? (
                <img
                  src={issuer.logoDataUrl}
                  alt={t.settings.logoAlt}
                  className="h-12 max-w-40 rounded border bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-12 w-24 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                  {t.settings.noLogo}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => void pickLogo()}>
                <ImagePlus /> {issuer.logoDataUrl ? t.settings.changeLogo : t.settings.chooseLogo}
              </Button>
              {issuer.logoDataUrl ? (
                <Button variant="ghost" size="sm" onClick={() => set({ logoDataUrl: null })}>
                  <Trash2 /> {t.common.remove}
                </Button>
              ) : null}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">{t.settings.signerTitle}</h3>
              <p className="text-xs text-muted-foreground">{t.settings.signerHint}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t.settings.signerName}>
                <Input value={issuer.signerName} maxLength={200} onChange={(e) => set({ signerName: e.target.value })} />
              </Field>
              <Field label={t.settings.signerId}>
                <Input value={issuer.signerId} maxLength={50} onChange={(e) => set({ signerId: e.target.value })} />
              </Field>
              <Field label={t.settings.signerRole}>
                <Input value={issuer.signerRole} maxLength={100} onChange={(e) => set({ signerRole: e.target.value })} />
              </Field>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'contract' ? (
        <ContractLibrary key={focus ? `${focus.view}:${focus.id}` : 'library'} library={library} onChange={setLibrary} focus={focus} />
      ) : null}
    </Dialog>
  )
}
