import { getStore } from '@netlify/blobs'
import { withDefaults } from '../lib/types'
import type { Appointment } from '../lib/types'
import { localDate } from '../lib/time'

// Keys are grouped by salon-local day so a day view (and the reminder job,
// which only looks at today and tomorrow) lists one prefix instead of
// every appointment ever booked.
const store = () => getStore({ name: 'termini', consistency: 'strong' })

export const keyFor = (a: Pick<Appointment, 'id' | 'startsAt'>) =>
  `${localDate(new Date(a.startsAt))}/${a.id}`

export type Stored = { appointment: Appointment; etag: string; key: string }

export async function listDay(date: string): Promise<Stored[]> {
  const s = store()
  const { blobs } = await s.list({ prefix: `${date}/` })
  const items = await Promise.all(blobs.map((b) => read(b.key)))
  return items
    .filter((x): x is Stored => x !== null)
    .sort((a, b) => a.appointment.startsAt.localeCompare(b.appointment.startsAt))
}

export async function read(key: string): Promise<Stored | null> {
  const res = await store().getWithMetadata(key, { type: 'json' })
  if (!res) return null
  return { appointment: withDefaults(res.data as Appointment), etag: res.etag ?? '', key }
}

export async function findById(date: string, id: string): Promise<Stored | null> {
  return read(`${date}/${id}`)
}

export async function create(a: Appointment): Promise<void> {
  await store().setJSON(keyFor(a), a, { onlyIfNew: true })
}

/** Writes `next`; moves the entry when its day changed. */
export async function save(prevKey: string, next: Appointment): Promise<void> {
  const s = store()
  const nextKey = keyFor(next)
  await s.setJSON(nextKey, next)
  if (nextKey !== prevKey) await s.delete(prevKey)
}

/** Conditional write; false when someone else changed the entry first. */
export async function saveIfUnchanged(key: string, etag: string, next: Appointment): Promise<boolean> {
  const { modified } = await store().setJSON(key, next, { onlyIfMatch: etag })
  return modified
}

export async function remove(key: string): Promise<void> {
  await store().delete(key)
}
