export type ReminderState = 'pending' | 'sending' | 'sent' | 'failed'

export type Appointment = {
  id: string
  clientName: string
  /** E.164, e.g. +38765123456 */
  phone: string
  service: string
  /** UTC ISO timestamp */
  startsAt: string
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
