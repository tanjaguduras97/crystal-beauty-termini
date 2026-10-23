import { createHmac, timingSafeEqual } from 'node:crypto'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import { getConfig } from './config'

const COOKIE = 'cb_session'
const MAX_AGE_S = 60 * 60 * 24 * 30

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

export async function login(password: string): Promise<boolean> {
  const cfg = requireSecrets()
  if (!safeEqual(password, cfg.adminPassword)) {
    await new Promise((r) => setTimeout(r, 800))
    return false
  }
  const expires = String(Date.now() + MAX_AGE_S * 1000)
  setCookie(COOKIE, `${expires}.${sign(expires, cfg.sessionSecret)}`, {
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

export function isLoggedIn(): boolean {
  const cfg = getConfig()
  if (!cfg.adminPassword || cfg.sessionSecret.length < 16) return false
  const raw = getCookie(COOKIE)
  if (!raw) return false
  const [expires, sig] = raw.split('.')
  if (!expires || !sig || Number(expires) < Date.now()) return false
  return safeEqual(sig, sign(expires, cfg.sessionSecret))
}

export function requireLogin() {
  if (!isLoggedIn()) throw new Error('Niste prijavljeni.')
}
