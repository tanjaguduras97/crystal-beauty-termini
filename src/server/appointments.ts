import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { busyFor, conflictAt } from '../lib/availability'
import type { Busy } from '../lib/availability'
import { OTHER_SERVICE_ID, STAFF, findService } from '../lib/catalog'
import type { Room, StaffId } from '../lib/catalog'
import { normalizePhone } from '../lib/phone'
import { isBookableTime } from '../lib/slots'
import { localDate, localToUtc } from '../lib/time'
import type { Appointment } from '../lib/types'
import { canView, currentUser, login, logout, requireEdit, requireUser } from './auth'
import { getConfig, getSetupProblems, getSmsMode } from './config'
import { sendIfDue } from './send'
import * as db from './store'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const staffSchema = z.enum(['sanja', 'nina'])
const roomSchema = z.enum(['nokti', 'soba'])

const fieldsSchema = z.object({
  staffId: staffSchema,
  serviceId: z.string().min(1, 'Izaberite uslugu.').max(40),
  /** Only used for 'ostalo'. */
  customService: z.string().trim().max(80),
  customDurationMin: z.number().int().min(15).max(300),
  customRoom: roomSchema,
  clientName: z.string().trim().min(1, 'Unesite ime klijenta.').max(80),
  phone: z.string().trim().min(1, 'Unesite broj telefona.'),
  date: dateSchema,
  time: timeSchema,
  note: z.string().trim().max(300),
  smsConsent: z.boolean(),
})

export type AppointmentFields = z.infer<typeof fieldsSchema>

/** Service name, length and room for a booking, from the catalog or the free-text fields. */
function resolveService(data: AppointmentFields): Pick<Appointment, 'serviceId' | 'service' | 'durationMin' | 'room'> {
  if (data.serviceId === OTHER_SERVICE_ID) {
    if (!data.customService) throw new Error('Upišite naziv usluge.')
    return { serviceId: OTHER_SERVICE_ID, service: data.customService, durationMin: data.customDurationMin, room: data.customRoom }
  }
  const s = findService(data.serviceId)
  if (!s) throw new Error('Nepoznata usluga.')
  if (!s.staff.includes(data.staffId)) throw new Error(`${s.name} nije u listi usluga za ovaj kalendar.`)
  return { serviceId: s.id, service: s.name, durationMin: s.durationMin, room: s.room }
}

async function dayAppointments(date: string) {
  return (await db.listDay(date)).map((e) => e.appointment)
}

async function assertAvailable(
  date: string,
  time: string,
  opts: { staffId: StaffId; room: Room; durationMin: number; excludeId?: string },
) {
  const busy = busyFor(await dayAppointments(date), opts)
  const conflict = conflictAt(time, opts.durationMin, busy)
  if (conflict === 'staff') throw new Error(`U ${time} se preklapa sa drugim terminom. Izaberite drugo vrijeme.`)
  if (conflict === 'room') throw new Error(`Soba za pedikir i masažu je zauzeta u to vrijeme. Izaberite drugo vrijeme.`)
}

function assertWorkingHours(time: string) {
  if (!isBookableTime(time)) throw new Error('Termini se mogu zakazati od 08:00 do 20:00, na svakih 15 minuta.')
}

function parsePhone(raw: string) {
  const phone = normalizePhone(raw)
  if (!phone) throw new Error('Broj telefona nije ispravan (npr. 065 123 456).')
  return phone
}

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const cfg = getConfig()
  const setupProblems = getSetupProblems()
  const user = currentUser()
  return {
    loggedIn: Boolean(user),
    user: user
      ? {
          name: user.name,
          calendars: user.calendars.map((c) => ({
            ...c,
            name: STAFF.find((s) => s.id === c.staffId)!.name,
          })),
        }
      : null,
    configured: setupProblems.length === 0,
    setupProblems,
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
  .inputValidator(z.object({ date: dateSchema, staffId: staffSchema }))
  .handler(async ({ data }) => {
    const user = requireUser()
    if (!canView(user, data.staffId)) throw new Error('Nemate pristup ovom kalendaru.')
    return (await dayAppointments(data.date)).filter((a) => a.staffId === data.staffId)
  })

/**
 * Busy times for the booking form. Only spans and reasons leave the server,
 * so a shared-room clash never reveals the other calendar's clients.
 */
export const availabilityFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({ date: dateSchema, staffId: staffSchema, room: roomSchema, excludeId: z.string().uuid().optional() }),
  )
  .handler(async ({ data }): Promise<Busy[]> => {
    const user = requireUser()
    requireEdit(user, data.staffId)
    return busyFor(await dayAppointments(data.date), data)
  })

export const createAppointmentFn = createServerFn({ method: 'POST' })
  .inputValidator(fieldsSchema)
  .handler(async ({ data }) => {
    const user = requireUser()
    requireEdit(user, data.staffId)
    const service = resolveService(data)
    assertWorkingHours(data.time)
    await assertAvailable(data.date, data.time, { staffId: data.staffId, ...service })
    const now = new Date().toISOString()
    const a: Appointment = {
      id: crypto.randomUUID(),
      staffId: data.staffId,
      ...service,
      clientName: data.clientName,
      phone: parsePhone(data.phone),
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
    const user = requireUser()
    const entry = await db.findById(data.originalDate, data.id)
    if (!entry) throw new Error('Termin više ne postoji.')
    const prev = entry.appointment
    requireEdit(user, prev.staffId)
    // A booking stays in the calendar it was made in.
    const service = resolveService({ ...data, staffId: prev.staffId })
    const startsAt = localToUtc(data.date, data.time).toISOString()
    // Bookings made before the hours rule existed can still be edited as long
    // as their time isn't changed.
    if (startsAt !== prev.startsAt) assertWorkingHours(data.time)
    if (data.status === 'scheduled') {
      await assertAvailable(data.date, data.time, { staffId: prev.staffId, ...service, excludeId: prev.id })
    }
    const phone = parsePhone(data.phone)
    // A new time or number means the client hasn't been told about this
    // booking yet, so it gets a fresh reminder.
    const rescheduled = startsAt !== prev.startsAt || phone !== prev.phone
    const next: Appointment = {
      ...prev,
      ...service,
      clientName: data.clientName,
      phone,
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
    const user = requireUser()
    const entry = await db.findById(data.date, data.id)
    if (!entry) return { ok: true }
    requireEdit(user, entry.appointment.staffId)
    await db.remove(entry.key)
    return { ok: true }
  })

/** Bookings made less than 24h ahead get their reminder right away. */
async function sendNowIfDue(a: Appointment): Promise<Appointment> {
  const entry = await db.findById(localDate(new Date(a.startsAt)), a.id)
  return entry ? sendIfDue(entry) : a
}
