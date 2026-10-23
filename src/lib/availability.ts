import type { Room, StaffId } from './catalog'
import { localTime } from './time'
import type { Appointment } from './types'

export type BusyReason = 'staff' | 'room'
/** Busy span in minutes since salon-local midnight, end exclusive. */
export type Busy = { start: number; end: number; reason: BusyReason }

export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export const fromMinutes = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/**
 * What blocks a new booking for `staffId` in `room`: the staff member's own
 * bookings, plus anyone's bookings in the shared pedicure/massage room.
 */
export function busyFor(
  dayAppointments: Appointment[],
  opts: { staffId: StaffId; room: Room; excludeId?: string },
): Busy[] {
  const busy: Busy[] = []
  for (const a of dayAppointments) {
    if (a.status !== 'scheduled' || a.id === opts.excludeId) continue
    const start = toMinutes(localTime(new Date(a.startsAt)))
    const span = { start, end: start + a.durationMin }
    if (a.staffId === opts.staffId) busy.push({ ...span, reason: 'staff' })
    else if (opts.room === 'soba' && a.room === 'soba') busy.push({ ...span, reason: 'room' })
  }
  return busy
}

/** Why [time, time + duration) can't be booked, or null when it's free. */
export function conflictAt(time: string, durationMin: number, busy: Busy[]): BusyReason | null {
  const start = toMinutes(time)
  const end = start + durationMin
  const hits = busy.filter((b) => start < b.end && b.start < end)
  if (hits.length === 0) return null
  return hits.some((b) => b.reason === 'staff') ? 'staff' : 'room'
}
