import type { Room, StaffId } from './catalog'

export type ReminderState = 'pending' | 'sending' | 'sent' | 'failed'

export type Appointment = {
  id: string
  /** Whose calendar the booking is in. */
  staffId: StaffId
  /** Catalog id, or 'ostalo' for a free-text service. */
  serviceId: string
  clientName: string
  /** E.164, e.g. +38765123456 */
  phone: string
  /** Service name as shown to the client in the SMS. */
  service: string
  /** UTC ISO timestamp */
  startsAt: string
  durationMin: number
  room: Room
  note: string
  /** Client agreed to receive SMS reminders. */
  smsConsent: boolean
  status: 'scheduled' | 'cancelled'
  reminder: {
    state: ReminderState
    attempts: number
    sentAt?: string
    lastError?: string
  }
  createdAt: string
  updatedAt: string
}

/** Fills fields added after the first release so old test bookings still load. */
export function withDefaults(a: Partial<Appointment> & Omit<Appointment, 'staffId' | 'serviceId' | 'durationMin' | 'room'>): Appointment {
  return {
    ...a,
    staffId: a.staffId ?? 'sanja',
    serviceId: a.serviceId ?? 'ostalo',
    durationMin: a.durationMin ?? 60,
    room: a.room ?? 'nokti',
  }
}
