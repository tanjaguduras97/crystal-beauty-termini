import { describe, expect, it } from 'vitest'
import { normalizePhone, formatPhone } from '../src/lib/phone'
import { localToUtc, localDate, localTime, addDays } from '../src/lib/time'
import { buildReminderText, isDue, toGsm } from '../src/lib/reminders'
import type { Appointment } from '../src/lib/types'

describe('normalizePhone', () => {
  it.each([
    ['065 123 456', '+38765123456'],
    ['065/123-456', '+38765123456'],
    ['066 1234 567', '+387661234567'],
    ['0038765123456', '+38765123456'],
    ['+387 65 123 456', '+38765123456'],
    ['+381 64 123 4567', '+381641234567'],
  ])('%s → %s', (input, out) => expect(normalizePhone(input)).toBe(out))

  it.each(['', 'abc', '65123456', '051 123 456', '065 12'])('rejects %j', (input) =>
    expect(normalizePhone(input)).toBeNull(),
  )

  it('formats for display', () => expect(formatPhone('+38765123456')).toBe('065 123 456'))
})

describe('time zone', () => {
  it('converts winter time (UTC+1)', () =>
    expect(localToUtc('2026-12-10', '14:00').toISOString()).toBe('2026-12-10T13:00:00.000Z'))
  it('converts summer time (UTC+2)', () =>
    expect(localToUtc('2026-07-10', '14:00').toISOString()).toBe('2026-07-10T12:00:00.000Z'))
  it('handles the DST end weekend', () => {
    // Clocks go back on 25 Oct 2026 at 03:00.
    expect(localToUtc('2026-10-24', '10:00').toISOString()).toBe('2026-10-24T08:00:00.000Z')
    expect(localToUtc('2026-10-26', '10:00').toISOString()).toBe('2026-10-26T09:00:00.000Z')
  })
  it('round-trips', () => {
    const d = localToUtc('2026-03-29', '09:30')
    expect(localDate(d)).toBe('2026-03-29')
    expect(localTime(d)).toBe('09:30')
  })
  it('adds days across months', () => expect(addDays('2026-12-31', 1)).toBe('2027-01-01'))
})

const base = (startsAt: string, over: Partial<Appointment> = {}): Appointment => ({
  id: 'x',
  clientName: 'Ana Petrović',
  phone: '+38765123456',
  service: 'manikir',
  startsAt,
  note: '',
  smsConsent: true,
  status: 'scheduled',
  reminder: { state: 'pending', attempts: 0 },
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  ...over,
})

describe('isDue', () => {
  const now = new Date('2026-10-23T10:00:00Z')
  it('is not due more than 24h ahead', () => expect(isDue(base('2026-10-24T10:05:00Z'), now)).toBe(false))
  it('is due exactly 24h ahead', () => expect(isDue(base('2026-10-24T10:00:00Z'), now)).toBe(true))
  it('is due right away when booked less than 24h ahead', () =>
    expect(isDue(base('2026-10-23T15:00:00Z'), now)).toBe(true))
  it('skips past appointments', () => expect(isDue(base('2026-10-23T09:00:00Z'), now)).toBe(false))
  it('skips cancelled or non-consenting clients', () => {
    expect(isDue(base('2026-10-23T15:00:00Z', { status: 'cancelled' }), now)).toBe(false)
    expect(isDue(base('2026-10-23T15:00:00Z', { smsConsent: false }), now)).toBe(false)
  })
  it('does not resend', () =>
    expect(isDue(base('2026-10-23T15:00:00Z', { reminder: { state: 'sent', attempts: 1 } }), now)).toBe(false))
  it('retries failures up to 3 attempts', () => {
    expect(isDue(base('2026-10-23T15:00:00Z', { reminder: { state: 'failed', attempts: 2 } }), now)).toBe(true)
    expect(isDue(base('2026-10-23T15:00:00Z', { reminder: { state: 'failed', attempts: 3 } }), now)).toBe(false)
  })
  it('reclaims a stale in-flight send only after 10 minutes', () => {
    const sending = { state: 'sending' as const, attempts: 0 }
    expect(isDue(base('2026-10-23T15:00:00Z', { reminder: sending, updatedAt: '2026-10-23T09:55:00Z' }), now)).toBe(false)
    expect(isDue(base('2026-10-23T15:00:00Z', { reminder: sending, updatedAt: '2026-10-23T09:45:00Z' }), now)).toBe(true)
  })
})

describe('reminder text', () => {
  const opts = { salonName: 'Crystal Beauty' }
  it('says "sutra" for tomorrow and stays in one GSM SMS', () => {
    const text = buildReminderText(base('2026-10-24T12:00:00Z'), new Date('2026-10-23T12:00:00Z'), opts)
    expect(text).toBe(
      'Ana, podsjecamo vas na termin sutra u 14:00 (manikir) u salonu Crystal Beauty. Vidimo se!',
    )
    expect(text.length).toBeLessThanOrEqual(160)
  })
  it('says "danas" for same-day bookings', () => {
    const text = buildReminderText(base('2026-10-23T16:00:00Z'), new Date('2026-10-23T08:00:00Z'), opts)
    expect(text).toContain('termin danas u 18:00')
  })
  it('strips diacritics', () => expect(toGsm('Đurđa šišanje, čćž')).toBe('Djurdja sisanje, ccz'))
})

describe('slots', async () => {
  const { SLOTS, isBookableTime } = await import('../src/lib/slots')
  it('runs from 08:00 to 20:00 every 15 minutes', () => {
    expect(SLOTS[0]).toBe('08:00')
    expect(SLOTS.at(-1)).toBe('20:00')
    expect(SLOTS).toHaveLength(49)
  })
  it.each([['07:45', false], ['08:00', true], ['13:20', false], ['13:15', true], ['20:00', true], ['20:15', false], ['21:00', false]])(
    '%s bookable: %s',
    (t, ok) => expect(isBookableTime(t)).toBe(ok),
  )
})
