import type { Appointment } from './types'
import { localDate, localTime, addDays, SALON_TZ } from './time'

export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000
export const MAX_ATTEMPTS = 3
/** A 'sending' claim older than this is treated as abandoned (crashed run). */
export const STALE_SENDING_MS = 10 * 60 * 1000

/**
 * An appointment is due once it starts within the next 24h. Appointments booked
 * less than 24h ahead therefore become due immediately.
 */
export function isDue(a: Appointment, now: Date): boolean {
  if (a.status !== 'scheduled' || !a.smsConsent) return false
  const start = Date.parse(a.startsAt)
  if (start <= now.getTime()) return false
  if (start - now.getTime() > REMINDER_LEAD_MS) return false
  const r = a.reminder
  if (r.state === 'pending') return true
  if (r.state === 'failed') return r.attempts < MAX_ATTEMPTS
  if (r.state === 'sending') return now.getTime() - Date.parse(a.updatedAt) > STALE_SENDING_MS
  return false
}

/**
 * Keeps texts within the GSM-7 alphabet so one SMS holds 160 characters
 * instead of 70 (č/ć/š/ž/đ and Cyrillic would force UCS-2).
 */
export function toGsm(text: string): string {
  return text
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'dj' : 'Dj'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')
}

function dayWord(start: Date, now: Date, timeZone: string): string {
  const startDay = localDate(start, timeZone)
  const today = localDate(now, timeZone)
  if (startDay === today) return 'danas'
  if (startDay === addDays(today, 1)) return 'sutra'
  const [y, m, d] = startDay.split('-').map(Number)
  return `${d}.${m}.${y}.`
}

export function buildReminderText(
  a: Pick<Appointment, 'clientName' | 'service' | 'startsAt'>,
  now: Date,
  opts: { salonName: string; timeZone?: string },
): string {
  const tz = opts.timeZone ?? SALON_TZ
  const start = new Date(a.startsAt)
  const firstName = a.clientName.trim().split(/\s+/)[0]
  const service = a.service.trim() ? ` (${a.service.trim()})` : ''
  const text =
    `${firstName}, podsjecamo vas na termin ${dayWord(start, now, tz)} ` +
    `u ${localTime(start, tz)}${service} u salonu ${opts.salonName}. Vidimo se!`
  return toGsm(text)
}
