/**
 * Normalizes a Bosnian/Herzegovinian phone number to E.164 (+387…).
 * Accepts '065 123 456', '065/123-456', '0038765123456', '+387 65 123 456'.
 * Numbers that already carry another country code (+381…, 00385…) are kept.
 * Returns null when the input can't be a valid number.
 */
export function normalizePhone(input: string): string | null {
  let s = input.trim().replace(/[\s\-/().]/g, '')
  if (s.startsWith('00')) s = '+' + s.slice(2)
  if (!s.startsWith('+')) {
    if (!s.startsWith('0')) return null
    s = '+387' + s.slice(1)
  }
  if (!/^\+\d{8,15}$/.test(s)) return null
  if (s.startsWith('+387')) {
    // BiH mobile numbers: +387 6x followed by 6–7 digits.
    if (!/^\+3876\d{7,8}$/.test(s)) return null
  }
  return s
}

/** '+38765123456' → '065 123 456' for display. */
export function formatPhone(e164: string): string {
  if (!e164.startsWith('+387')) return e164
  const local = '0' + e164.slice(4)
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}
