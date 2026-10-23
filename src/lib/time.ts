export const SALON_TZ = 'Europe/Sarajevo'

type Parts = { year: number; month: number; day: number; hour: number; minute: number }

function partsIn(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]))
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  }
}

/** Salon-local wall-clock date ('YYYY-MM-DD') + time ('HH:MM') → UTC instant. */
export function localToUtc(date: string, time: string, timeZone = SALON_TZ): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi)
  // Two passes handle the offset changing around DST transitions.
  let guess = wallAsUtc
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(guess), timeZone)
    const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
    guess += wallAsUtc - shownAsUtc
  }
  return new Date(guess)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** UTC instant → salon-local 'YYYY-MM-DD'. */
export function localDate(date: Date, timeZone = SALON_TZ): string {
  const p = partsIn(date, timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** UTC instant → salon-local 'HH:MM'. */
export function localTime(date: Date, timeZone = SALON_TZ): string {
  const p = partsIn(date, timeZone)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** Shift a 'YYYY-MM-DD' string by whole days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

const DAYS = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota']

/** 'YYYY-MM-DD' → e.g. 'petak, 24.10.2026.' */
export function formatDayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DAYS[dow]}, ${d}.${m}.${y}.`
}
