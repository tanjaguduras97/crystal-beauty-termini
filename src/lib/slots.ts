/** Bookable start times: every 15 minutes from 08:00 to 20:00 (last start). */
export const OPEN_MIN = 8 * 60
export const CLOSE_MIN = 20 * 60
export const SLOT_STEP_MIN = 15

const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export const SLOTS: string[] = Array.from(
  { length: (CLOSE_MIN - OPEN_MIN) / SLOT_STEP_MIN + 1 },
  (_, i) => toTime(OPEN_MIN + i * SLOT_STEP_MIN),
)

export const isBookableTime = (time: string) => SLOTS.includes(time)
