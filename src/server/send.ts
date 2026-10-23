import { addDays, localDate } from '../lib/time'
import { buildReminderText, isDue } from '../lib/reminders'
import type { Appointment } from '../lib/types'
import { getConfig } from './config'
import { sendSms } from './sms'
import * as db from './store'

/**
 * Sends the reminder for one stored appointment if it is due. The entry is
 * first claimed with a conditional write, so the scheduled job and a
 * just-saved booking can't both text the same client.
 */
export async function sendIfDue(entry: db.Stored, now = new Date()): Promise<Appointment> {
  const a = entry.appointment
  if (!isDue(a, now)) return a

  const claimed: Appointment = {
    ...a,
    reminder: { ...a.reminder, state: 'sending' },
    updatedAt: now.toISOString(),
  }
  if (!(await db.saveIfUnchanged(entry.key, entry.etag, claimed))) return a

  const cfg = getConfig()
  const text = buildReminderText(a, now, { salonName: cfg.salonName, salonPhone: cfg.salonPhone })
  const result = await sendSms(a.phone, text)

  // Re-read so an edit made while the SMS was in flight isn't overwritten.
  // If the booking was deleted, moved to another day, or rescheduled in the
  // meantime, its own reminder state wins.
  const latest = (await db.read(entry.key))?.appointment
  if (!latest) return claimed
  if (latest.startsAt !== a.startsAt || latest.phone !== a.phone) return latest
  const done: Appointment = {
    ...latest,
    reminder: result.ok
      ? { state: 'sent', attempts: a.reminder.attempts + 1, sentAt: new Date().toISOString() }
      : { state: 'failed', attempts: a.reminder.attempts + 1, lastError: result.error },
    updatedAt: new Date().toISOString(),
  }
  await db.save(entry.key, done)
  if (!result.ok) console.error(`[reminder] ${a.id} failed: ${result.error}`)
  return done
}

/** Called by the scheduled function every few minutes. */
export async function sendDueReminders(now = new Date()) {
  // The 24h window never reaches past tomorrow in salon-local days.
  const today = localDate(now)
  const entries = [...(await db.listDay(today)), ...(await db.listDay(addDays(today, 1)))]
  let sent = 0
  let failed = 0
  for (const entry of entries) {
    if (!isDue(entry.appointment, now)) continue
    const after = await sendIfDue(entry, now)
    if (after.reminder.state === 'sent') sent++
    else if (after.reminder.state === 'failed') failed++
  }
  return { checked: entries.length, sent, failed }
}
