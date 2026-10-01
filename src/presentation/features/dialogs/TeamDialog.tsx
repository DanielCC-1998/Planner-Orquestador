import { useMemo, useRef, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { PALETTE, type Member, type MemberPatch } from '@domain'
import { DraftInput } from '../../components/DraftField'
import { Rich } from '../../components/Rich'
import { SwatchPicker, type Swatch } from '../../components/SwatchPicker'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input, NativeSelect } from '../../components/ui/input'
import { useI18n } from '../../i18n'
import { describeError } from '../../i18n/errors'
import { call } from '../../lib/api'
import { useCatalog } from '../../stores/catalog'
import { useProject } from '../../stores/project'
import { toast } from '../../stores/toasts'

/** Same columns for the header, each person and the new-person row. */
const TEAM_GRID = 'grid grid-cols-[28px_1.4fr_1fr_110px_90px_96px] gap-2'

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const { t } = useI18n()
  const swatches = PALETTE.map((c): Swatch<string> => ({ value: c, color: c, ink: '#ffffff', label: t.projects.create.colorOption(c) }))
  return <SwatchPicker value={color} swatches={swatches} onChange={onChange} label={t.team.color} />
}

function MemberRow({ member, others }: { member: Member; others: Member[] }) {
  const { t, f } = useI18n()
  const state = useProject((s) => s.state!)
  const dispatch = useProject((s) => s.dispatch)
  const [removing, setRemoving] = useState(false)
  const [reassign, setReassign] = useState('')
  const assigned = [...state.tasks.values()].filter((task) => task.assigneeId === member.id).length
  const update = (patch: MemberPatch) => dispatch({ type: 'member.update', id: member.id, patch })

  return (
    <div className={`${TEAM_GRID} items-start border-b py-2 last:border-b-0`}>
      <div className="pt-1">
        <ColorPicker color={member.color} onChange={(color) => void update({ color })} />
      </div>
      <DraftInput value={member.name} onCommit={(name) => (name.trim() ? void update({ name }) : t.team.required)} />
      <DraftInput value={member.role} placeholder={t.team.role} onCommit={(role) => void update({ role })} />
      <DraftInput
        value={f.centsToInput(member.rateCents)}
        placeholder={t.team.rate}
        inputMode="decimal"
        onCommit={(text) => {
          const cents = f.parseMoneyInput(text)
          if (cents === 'invalid') return t.team.invalid
          void update({ rateCents: cents })
          return null
        }}
      />
      <DraftInput
        value={f.decimalToInput(member.hoursPerDay)}
        inputMode="decimal"
        onCommit={(text) => {
          const h = f.parseDecimalInput(text)
          if (typeof h !== 'number' || h <= 0 || h > 24) return '0–24'
          void update({ hoursPerDay: h })
          return null
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="justify-self-center"
        onClick={() => setRemoving(!removing)}
        aria-label={t.team.removeMember(member.name)}
      >
        <Trash2 />
      </Button>
      {removing ? (
        <div className="col-span-6 flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm">
          <span>
            <Rich text={t.team.removeConfirm(member.name, assigned)} />
          </span>
          {assigned > 0 ? (
            <NativeSelect value={reassign} onChange={(e) => setReassign(e.target.value)} className="w-48">
              <option value="">{t.common.unassigned}</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto"
            onClick={() => void dispatch({ type: 'member.remove', id: member.id, reassignTo: reassign || null })}
          >
            {t.common.remove}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRemoving(false)}>
            {t.common.cancel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ImportMembers({ currency }: { currency: string }) {
  const { t, f } = useI18n()
  const projectId = useProject((s) => s.id)
  const current = useProject((s) => s.state!.members)
  const dispatch = useProject((s) => s.dispatch)
  const cards = useCatalog((s) => s.cards)
  const [source, setSource] = useState('')
  const [candidates, setCandidates] = useState<Member[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const others = cards.filter((c) => c.id !== projectId && c.members.length > 0)

  const load = async (id: string) => {
    setSource(id)
    setCandidates(null)
    if (!id) return
    try {
      const list = await call('projects.members', { id })
      const names = new Set([...current.values()].map((m) => m.name.toLowerCase()))
      setCandidates(list)
      setChosen(new Set(list.filter((m) => !names.has(m.name.toLowerCase())).map((m) => m.id)))
    } catch (e) {
      toast.error(describeError(e))
    }
  }

  const doImport = async () => {
    if (!candidates) return
    const members = candidates
      .filter((m) => chosen.has(m.id))
      .map((m) => ({ name: m.name, role: m.role, initials: m.initials, color: m.color, rateCents: m.rateCents, hoursPerDay: m.hoursPerDay }))
    if (members.length === 0) return
    const delta = await dispatch({ type: 'member.addMany', members })
    if (delta) {
      toast.success(t.team.imported(members.length))
      setSource('')
      setCandidates(null)
    }
  }

  if (others.length === 0) return null
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center gap-2 text-sm">
        <Download className="size-4 text-muted-foreground" />
        {t.team.importTitle}
        <NativeSelect value={source} onChange={(e) => void load(e.target.value)} className="ml-auto w-64">
          <option value="">{t.team.chooseProject}</option>
          {others.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.members.length})
            </option>
          ))}
        </NativeSelect>
      </div>
      {candidates ? (
        <>
          <div className="flex flex-wrap gap-2">
            {candidates.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.has(m.id)}
                  onChange={() =>
                    setChosen((s) => {
                      const next = new Set(s)
                      if (next.has(m.id)) next.delete(m.id)
                      else next.add(m.id)
                      return next
                    })
                  }
                />
                {m.name}
                {m.rateCents !== null ? <span className="text-xs text-muted-foreground">{f.money(m.rateCents, currency)}/h</span> : null}
              </label>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">{t.team.ratesCopied(currency)}</div>
          <Button size="sm" variant="outline" className="self-start" onClick={() => void doImport()} disabled={chosen.size === 0}>
            {t.team.importCount(chosen.size)}
          </Button>
        </>
      ) : null}
    </div>
  )
}

export function TeamDialog({ onClose }: { onClose: () => void }) {
  const { t, f } = useI18n()
  // Select the Map (stable reference) and derive the list from it.
  const membersMap = useProject((s) => s.state!.members)
  const members = useMemo(() => [...membersMap.values()], [membersMap])
  const currency = useProject((s) => s.state!.meta.currency)
  const dispatch = useProject((s) => s.dispatch)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [rate, setRate] = useState('')
  const [hours, setHours] = useState('8')
  const nameRef = useRef<HTMLInputElement>(null)
  const closing = useRef(false)

  /** Adds the person typed in the new-person row. Returns false if data is missing or invalid. */
  const add = async (): Promise<boolean> => {
    const trimmed = name.trim()
    const cents = f.parseMoneyInput(rate)
    const h = f.parseDecimalInput(hours)
    if (!trimmed) {
      toast.error(t.team.nameMissing)
      nameRef.current?.focus()
      return false
    }
    if (cents === 'invalid') {
      toast.error(t.team.invalidRate)
      return false
    }
    if (typeof h !== 'number' || h <= 0 || h > 24) {
      toast.error(t.team.hoursRange)
      return false
    }
    const delta = await dispatch({
      type: 'member.add',
      fields: { name: trimmed, role: role.trim(), rateCents: cents, hoursPerDay: h }
    })
    if (!delta) return false
    toast.success(t.team.added(trimmed))
    setName('')
    setRole('')
    setRate('')
    nameRef.current?.focus()
    return true
  }

  /** Closing never discards someone typed in the new-person row: if there is a name, it is added first. */
  const close = async () => {
    if (closing.current) return
    closing.current = true
    try {
      if (name.trim() && !(await add())) return
      onClose()
    } finally {
      closing.current = false
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && void close()}
      size="lg"
      title={t.team.title}
      description={t.team.description(t.common.keys.enter, t.common.add, t.common.done)}
      footer={
        <Button variant="primary" onClick={() => void close()}>
          {t.common.done}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className={`${TEAM_GRID} pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`}>
            <span />
            <span>{t.team.name}</span>
            <span>{t.team.role}</span>
            <span>{t.team.ratePerHour(f.currencySymbol(currency))}</span>
            <span>{t.team.hoursPerDay}</span>
            <span />
          </div>
          {members.length === 0 ? <div className="py-4 text-center text-sm text-muted-foreground">{t.team.empty}</div> : null}
          {members.map((m) => (
            <MemberRow key={m.id} member={m} others={members.filter((o) => o.id !== m.id)} />
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <form
            className={`${TEAM_GRID} items-center rounded-lg bg-muted/60 p-2`}
            onSubmit={(e) => {
              e.preventDefault()
              void add()
            }}
          >
            <Plus className="mx-auto size-4 text-muted-foreground" />
            <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.team.newName} aria-label={t.team.newNameLabel} />
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t.team.newRole} aria-label={t.team.newRoleLabel} />
            <Input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={t.team.rate}
              inputMode="decimal"
              aria-label={t.team.newRateLabel}
            />
            <Input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" aria-label={t.team.newHoursLabel} />
            <Button type="submit" variant="primary">
              <Plus /> {t.common.add}
            </Button>
          </form>
          <p className="px-1 text-xs text-muted-foreground">{t.team.addHint(t.common.keys.enter, t.common.add)}</p>
        </div>
        <ImportMembers currency={currency} />
      </div>
    </Dialog>
  )
}
