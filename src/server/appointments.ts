import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { normalizePhone } from '../lib/phone'
import { localDate, localToUtc } from '../lib/time'
import type { Appointment } from '../lib/types'
import { isLoggedIn, login, logout, requireLogin } from './auth'
import { getConfig, getSmsMode } from './config'
import { sendIfDue } from './send'
import * as db from './store'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

const fieldsSchema = z.object({
  clientName: z.string().trim().min(1, 'Unesite ime klijenta.').max(80),
  phone: z.string().trim().min(1, 'Unesite broj telefona.'),
  service: z.string().trim().max(80),
  date: dateSchema,
  time: timeSchema,
  note: z.string().trim().max(300),
  smsConsent: z.boolean(),
})

export type AppointmentFields = z.infer<typeof fieldsSchema>

function parsePhone(raw: string) {
  const phone = normalizePhone(raw)
  if (!phone) throw new Error('Broj telefona nije ispravan (npr. 065 123 456).')
  return phone
}

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const cfg = getConfig()
  return {
    loggedIn: isLoggedIn(),
    configured: Boolean(cfg.adminPassword && cfg.sessionSecret.length >= 16),
    smsMode: getSmsMode(),
    salonName: cfg.salonName,
  }
})

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ password: z.string().max(200) }))
  .handler(async ({ data }) => ({ ok: await login(data.password) }))

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  logout()
  return { ok: true }
})

export const listDayFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ date: dateSchema }))
  .handler(async ({ data }) => {
    requireLogin()
    return (await db.listDay(data.date)).map((e) => e.appointment)
  })

export const createAppointmentFn = createServerFn({ method: 'POST' })
  .inputValidator(fieldsSchema)
  .handler(async ({ data }) => {
    requireLogin()
    const now = new Date().toISOString()
    const a: Appointment = {
      id: crypto.randomUUID(),
      clientName: data.clientName,
      phone: parsePhone(data.phone),
      service: data.service,
      startsAt: localToUtc(data.date, data.time).toISOString(),
      note: data.note,
      smsConsent: data.smsConsent,
      status: 'scheduled',
      reminder: { state: 'pending', attempts: 0 },
      createdAt: now,
      updatedAt: now,
    }
    await db.create(a)
    return sendNowIfDue(a)
  })

export const updateAppointmentFn = createServerFn({ method: 'POST' })
  .inputValidator(
    fieldsSchema.extend({
      id: z.string().uuid(),
      originalDate: dateSchema,
      status: z.enum(['scheduled', 'cancelled']),
    }),
  )
  .handler(async ({ data }) => {
    requireLogin()
    const entry = await db.findById(data.originalDate, data.id)
    if (!entry) throw new Error('Termin više ne postoji.')
    const prev = entry.appointment
    const startsAt = localToUtc(data.date, data.time).toISOString()
    const phone = parsePhone(data.phone)
    // A new time or number means the client hasn't been told about this
    // booking yet, so it gets a fresh reminder.
    const rescheduled = startsAt !== prev.startsAt || phone !== prev.phone
    const next: Appointment = {
      ...prev,
      clientName: data.clientName,
      phone,
      service: data.service,
      startsAt,
      note: data.note,
      smsConsent: data.smsConsent,
      status: data.status,
      reminder: rescheduled ? { state: 'pending', attempts: 0 } : prev.reminder,
      updatedAt: new Date().toISOString(),
    }
    await db.save(entry.key, next)
    return sendNowIfDue(next)
  })

export const deleteAppointmentFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().uuid(), date: dateSchema }))
  .handler(async ({ data }) => {
    requireLogin()
    await db.remove(`${data.date}/${data.id}`)
    return { ok: true }
  })

/** Bookings made less than 24h ahead get their reminder right away. */
async function sendNowIfDue(a: Appointment): Promise<Appointment> {
  const entry = await db.findById(localDate(new Date(a.startsAt)), a.id)
  return entry ? sendIfDue(entry) : a
}
