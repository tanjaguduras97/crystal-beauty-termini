import { timingSafeEqual } from 'node:crypto'
import { MAX_ATTEMPTS, buildReminderText, isDue } from '../lib/reminders'
import { addDays, localDate, localTime } from '../lib/time'
import type { Appointment } from '../lib/types'
import { getConfig, getSmsMode } from './config'
import * as db from './store'

// The iPhone Shortcut runs on a schedule, fetches the texts that are due,
// sends each from the phone and opens the item's confirm URL afterwards.

/** Texts are handed out only during the day so a stray run can't wake clients. */
const SEND_FROM = '08:00'
const SEND_UNTIL = '21:00'

export function checkToken(request: Request): boolean {
  const expected = getConfig().iphoneToken
  const given = new URL(request.url).searchParams.get('kljuc') ?? ''
  if (getSmsMode() !== 'iphone' || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export type PhoneMessage = { broj: string; tekst: string; potvrda: string }

/**
 * Claims every due reminder and returns it for the phone to send. A claim the
 * phone never confirms is handed out again after 10 minutes, at most
 * MAX_ATTEMPTS times in total, then marked failed so nobody gets texted hourly.
 */
export async function claimDueMessages(origin: string, now = new Date()): Promise<PhoneMessage[]> {
  const time = localTime(now)
  if (time < SEND_FROM || time > SEND_UNTIL) return []

  const cfg = getConfig()
  const today = localDate(now)
  const entries = [...(await db.listDay(today)), ...(await db.listDay(addDays(today, 1)))]
  const out: PhoneMessage[] = []
  for (const entry of entries) {
    const a = entry.appointment
    if (!isDue(a, now)) continue
    if (a.reminder.attempts >= MAX_ATTEMPTS) {
      await db.saveIfUnchanged(entry.key, entry.etag, {
        ...a,
        reminder: { ...a.reminder, state: 'failed', lastError: 'iPhone nije potvrdio slanje.' },
        updatedAt: now.toISOString(),
      })
      continue
    }
    const claimed: Appointment = {
      ...a,
      reminder: { ...a.reminder, state: 'sending', attempts: a.reminder.attempts + 1 },
      updatedAt: now.toISOString(),
    }
    if (!(await db.saveIfUnchanged(entry.key, entry.etag, claimed))) continue
    const confirm = new URL('/api/iphone/poslato', origin)
    confirm.searchParams.set('kljuc', cfg.iphoneToken)
    confirm.searchParams.set('dan', localDate(new Date(a.startsAt)))
    confirm.searchParams.set('id', a.id)
    out.push({
      broj: a.phone,
      tekst: buildReminderText(a, now, { salonName: cfg.salonName }),
      potvrda: confirm.toString(),
    })
  }
  return out
}

/** Marks a handed-out reminder as sent once the phone reports back. */
export async function confirmSent(date: string, id: string, now = new Date()): Promise<boolean> {
  const entry = await db.findById(date, id)
  if (!entry || entry.appointment.reminder.state !== 'sending') return false
  const a = entry.appointment
  await db.save(entry.key, {
    ...a,
    reminder: { state: 'sent', attempts: a.reminder.attempts, sentAt: now.toISOString() },
    updatedAt: now.toISOString(),
  })
  return true
}
