import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { formatPhone } from '@/lib/phone'
import { MAX_ATTEMPTS, REMINDER_LEAD_MS } from '@/lib/reminders'
import { addDays, formatDayLabel, localDate, localTime } from '@/lib/time'
import type { Appointment } from '@/lib/types'
import {
  createAppointmentFn,
  deleteAppointmentFn,
  getSession,
  listDayFn,
  loginFn,
  logoutFn,
  updateAppointmentFn,
} from '@/server/appointments'

export const Route = createFileRoute('/')({
  loader: () => getSession(),
  component: Home,
})

function Home() {
  const session = Route.useLoaderData()
  if (!session.configured) {
    return (
      <div className="login">
        <h1>Aplikacija nije podešena</h1>
        {session.setupProblems.map((p) => (
          <div className="error" key={p}>
            {p}
          </div>
        ))}
        <p className="info">
          Na Netlify-ju: Site configuration → Environment variables. Nazivi moraju biti tačno ovako
          napisani, velikim slovima, a scope „All scopes“ ili bar „Functions“. Nakon izmjene pokrenite
          Deploys → Trigger deploy → Deploy site.
        </p>
      </div>
    )
  }
  return session.loggedIn ? <Agenda smsMode={session.smsMode} /> : <Login />
}

function Login() {
  const router = useRouter()
  const login = useServerFn(loginFn)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { ok } = await login({ data: { password } })
      if (ok) await router.invalidate()
      else setError('Pogrešna lozinka.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <img src="/icon.svg" alt="" />
      <h1>Crystal Beauty</h1>
      {error && <div className="error">{error}</div>}
      <label className="field">
        <span>Lozinka</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
      </label>
      <button className="btn btn-primary" disabled={busy || !password}>
        {busy ? 'Prijava…' : 'Prijavi se'}
      </button>
    </form>
  )
}

type Editing = { mode: 'new' } | { mode: 'edit'; appointment: Appointment }

function Agenda({ smsMode }: { smsMode: 'infobip' | 'test' }) {
  const router = useRouter()
  const listDay = useServerFn(listDayFn)
  const logout = useServerFn(logoutFn)
  const [day, setDay] = useState(() => localDate(new Date()))
  const [items, setItems] = useState<Appointment[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const dateInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setItems(await listDay({ data: { date: day } }))
    } catch (err) {
      setError((err as Error).message)
    }
  }, [day, listDay])

  useEffect(() => {
    setItems(null)
    load()
  }, [load])

  // Keep reminder badges fresh while the app stays open.
  useEffect(() => {
    const t = setInterval(load, 60_000)
    const onFocus = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [load])

  const today = localDate(new Date())

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">Crystal Beauty</span>
        <button
          className="link-btn"
          onClick={async () => {
            await logout()
            await router.invalidate()
          }}
        >
          Odjava
        </button>
      </div>

      {smsMode === 'test' && (
        <div className="banner">
          Test način: SMS poruke se ne šalju stvarno dok se ne poveže SMS provajder.
        </div>
      )}

      <div className="daynav">
        <button className="icon-btn" aria-label="Prethodni dan" onClick={() => setDay(addDays(day, -1))}>
          ‹
        </button>
        <button
          className="label link-btn"
          style={{ color: 'inherit', fontSize: 16 }}
          onClick={() => dateInput.current?.showPicker?.()}
        >
          {day === today ? 'Danas · ' : day === addDays(today, 1) ? 'Sutra · ' : ''}
          {formatDayLabel(day)}
          <input
            ref={dateInput}
            type="date"
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            tabIndex={-1}
            aria-hidden
          />
        </button>
        <button className="icon-btn" aria-label="Sljedeći dan" onClick={() => setDay(addDays(day, 1))}>
          ›
        </button>
      </div>
      {day !== today && (
        <button className="today-btn" onClick={() => setDay(today)}>
          Nazad na danas
        </button>
      )}

      {error && <div className="error">{error}</div>}

      {items === null ? (
        <div className="empty">Učitavanje…</div>
      ) : items.length === 0 ? (
        <div className="empty">Nema termina za ovaj dan.</div>
      ) : (
        <div className="list">
          {items.map((a) => (
            <AppointmentCard key={a.id} a={a} onOpen={() => setEditing({ mode: 'edit', appointment: a })} />
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setEditing({ mode: 'new' })}>
        + Novi termin
      </button>

      {editing && (
        <AppointmentSheet
          editing={editing}
          defaultDate={day}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            if (saved) setDay(localDate(new Date(saved.startsAt)))
            load()
          }}
        />
      )}
    </div>
  )
}

function AppointmentCard({ a, onOpen }: { a: Appointment; onOpen: () => void }) {
  const start = new Date(a.startsAt)
  const badge = reminderBadge(a, new Date())
  return (
    <button className={`card ${a.status === 'cancelled' ? 'cancelled' : ''}`} onClick={onOpen}>
      <div className="time">{localTime(start)}</div>
      <div className="body">
        <div className="name">{a.clientName}</div>
        <div className="meta">
          {[a.service, formatPhone(a.phone)].filter(Boolean).join(' · ')}
        </div>
        {a.note && <div className="meta">{a.note}</div>}
        <span className={`badge ${badge.tone}`} title={a.reminder.lastError}>
          {badge.text}
        </span>
      </div>
    </button>
  )
}

function shortDateTime(d: Date) {
  const [, m, day] = localDate(d).split('-').map(Number)
  return `${day}.${m}. u ${localTime(d)}`
}

function reminderBadge(a: Appointment, now: Date): { text: string; tone: string } {
  if (a.status === 'cancelled') return { text: 'Otkazan', tone: 'off' }
  const r = a.reminder
  if (r.state === 'sent') return { text: `SMS poslat ${shortDateTime(new Date(r.sentAt!))}`, tone: 'ok' }
  if (!a.smsConsent) return { text: 'Bez SMS podsjetnika', tone: 'off' }
  if (r.state === 'sending') return { text: 'SMS se šalje…', tone: 'wait' }
  const start = Date.parse(a.startsAt)
  if (start <= now.getTime()) return { text: 'Podsjetnik nije poslat', tone: 'off' }
  if (r.state === 'failed') {
    return r.attempts < MAX_ATTEMPTS
      ? { text: 'Greška pri slanju – pokušava ponovo', tone: 'warn' }
      : { text: 'SMS nije poslat – nazovite klijenta', tone: 'bad' }
  }
  const sendAt = start - REMINDER_LEAD_MS
  if (sendAt <= now.getTime()) return { text: 'SMS odlazi za par minuta', tone: 'wait' }
  return { text: `SMS ide ${shortDateTime(new Date(sendAt))}`, tone: 'wait' }
}

function AppointmentSheet({
  editing,
  defaultDate,
  onClose,
  onSaved,
}: {
  editing: Editing
  defaultDate: string
  onClose: () => void
  onSaved: (saved: Appointment | null) => void
}) {
  const create = useServerFn(createAppointmentFn)
  const update = useServerFn(updateAppointmentFn)
  const remove = useServerFn(deleteAppointmentFn)
  const existing = editing.mode === 'edit' ? editing.appointment : null
  const originalDate = existing ? localDate(new Date(existing.startsAt)) : defaultDate

  const [form, setForm] = useState({
    clientName: existing?.clientName ?? '',
    phone: existing ? formatPhone(existing.phone) : '',
    service: existing?.service ?? '',
    date: originalDate,
    time: existing ? localTime(new Date(existing.startsAt)) : '',
    note: existing?.note ?? '',
    smsConsent: existing?.smsConsent ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  async function run(action: () => Promise<Appointment | null>) {
    setBusy(true)
    setError('')
    try {
      onSaved(await action())
    } catch (err) {
      setError(readableError(err))
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    run(() =>
      existing
        ? update({ data: { ...form, id: existing.id, originalDate, status: existing.status } })
        : create({ data: form }),
    )
  }

  function setStatus(status: Appointment['status']) {
    if (!existing) return
    run(() => update({ data: { ...form, id: existing.id, originalDate, status } }))
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit}>
        <h2>{existing ? 'Termin' : 'Novi termin'}</h2>
        {error && <div className="error">{error}</div>}

        <label className="field">
          <span>Ime i prezime</span>
          <input value={form.clientName} onChange={(e) => set('clientName', e.target.value)} required autoFocus={!existing} />
        </label>
        <label className="field">
          <span>Telefon</span>
          <input
            type="tel"
            inputMode="tel"
            placeholder="065 123 456"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Usluga</span>
          <input placeholder="npr. manikir" value={form.service} onChange={(e) => set('service', e.target.value)} />
        </label>
        <div className="row">
          <label className="field">
            <span>Datum</span>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </label>
          <label className="field">
            <span>Vrijeme</span>
            <input type="time" step={300} value={form.time} onChange={(e) => set('time', e.target.value)} required />
          </label>
        </div>
        <label className="field">
          <span>Napomena (samo za vas)</span>
          <textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.smsConsent} onChange={(e) => set('smsConsent', e.target.checked)} />
          <span>Klijent je pristao da primi SMS podsjetnik 24 sata prije termina</span>
        </label>

        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Čuvanje…' : 'Sačuvaj'}
        </button>
        {existing && existing.status === 'scheduled' && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setStatus('cancelled')}>
            Otkaži termin
          </button>
        )}
        {existing && existing.status === 'cancelled' && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setStatus('scheduled')}>
            Vrati termin
          </button>
        )}
        {existing && (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              if (confirm('Trajno obrisati ovaj termin?')) {
                run(async () => {
                  await remove({ data: { id: existing.id, date: originalDate } })
                  return null
                })
              }
            }}
          >
            Obriši
          </button>
        )}
        <button type="button" className="btn btn-danger" style={{ color: 'var(--muted)' }} onClick={onClose}>
          Zatvori
        </button>
      </form>
    </div>
  )
}

function readableError(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err)
  // Zod validation errors arrive as a JSON list of issues.
  try {
    const issues = JSON.parse(msg) as { message: string }[]
    if (Array.isArray(issues) && issues[0]?.message) return issues[0].message
  } catch {
    /* plain message */
  }
  return msg
}
