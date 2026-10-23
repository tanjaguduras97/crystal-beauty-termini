import { createHmac, timingSafeEqual } from 'node:crypto'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import type { StaffId } from '../lib/catalog'
import { getConfig } from './config'

const COOKIE = 'cb_session'
const MAX_AGE_S = 60 * 60 * 24 * 30

export type UserId = 'admin' | StaffId

export type User = {
  id: UserId
  name: string
  /** Calendars the user may open, and whether they may change them. */
  calendars: { staffId: StaffId; editable: boolean }[]
}

// Sanja manages her own calendar and can look at Nina's; Nina sees only her
// own. The admin login (ADMIN_PASSWORD) is for maintenance and can edit both.
const USERS: Record<UserId, User> = {
  admin: {
    id: 'admin',
    name: 'Admin',
    calendars: [
      { staffId: 'sanja', editable: true },
      { staffId: 'nina', editable: true },
    ],
  },
  sanja: {
    id: 'sanja',
    name: 'Sanja',
    calendars: [
      { staffId: 'sanja', editable: true },
      { staffId: 'nina', editable: false },
    ],
  },
  nina: { id: 'nina', name: 'Nina', calendars: [{ staffId: 'nina', editable: true }] },
}

function passwords(): [UserId, string][] {
  const cfg = getConfig()
  return (
    [
      ['admin', cfg.adminPassword],
      ['sanja', cfg.sanjaPassword],
      ['nina', cfg.ninaPassword],
    ] as [UserId, string][]
  ).filter(([, pw]) => pw)
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

function requireSecrets() {
  const cfg = getConfig()
  if (!cfg.adminPassword || cfg.sessionSecret.length < 16) {
    throw new Error('ADMIN_PASSWORD i SESSION_SECRET (min. 16 znakova) moraju biti postavljeni.')
  }
  return cfg
}

/** Logs in whoever owns the password; returns false for an unknown one. */
export async function login(password: string): Promise<boolean> {
  const cfg = requireSecrets()
  // Check every password so timing doesn't reveal which one matched.
  const matches = passwords().filter(([, pw]) => safeEqual(password, pw))
  if (matches.length === 0) {
    await new Promise((r) => setTimeout(r, 800))
    return false
  }
  const value = `${matches[0][0]}.${Date.now() + MAX_AGE_S * 1000}`
  setCookie(COOKIE, `${value}.${sign(value, cfg.sessionSecret)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_S,
  })
  return true
}

export function logout() {
  deleteCookie(COOKIE, { path: '/' })
}

export function currentUser(): User | null {
  const cfg = getConfig()
  if (!cfg.adminPassword || cfg.sessionSecret.length < 16) return null
  const raw = getCookie(COOKIE)
  if (!raw) return null
  const [userId, expires, sig] = raw.split('.')
  if (!userId || !expires || !sig || Number(expires) < Date.now()) return null
  if (!safeEqual(sig, sign(`${userId}.${expires}`, cfg.sessionSecret))) return null
  const user = USERS[userId as UserId]
  // A login stops working once its password is removed.
  if (!user || !passwords().some(([id]) => id === user.id)) return null
  return user
}

export function requireUser(): User {
  const user = currentUser()
  if (!user) throw new Error('Niste prijavljeni.')
  return user
}

export function canView(user: User, staffId: StaffId) {
  return user.calendars.some((c) => c.staffId === staffId)
}

export function requireEdit(user: User, staffId: StaffId) {
  if (!user.calendars.some((c) => c.staffId === staffId && c.editable)) {
    throw new Error('Nemate dozvolu za izmjene u ovom kalendaru.')
  }
}
