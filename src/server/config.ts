type NetlifyGlobal = { env?: { get(name: string): string | undefined } }

// Netlify's runtime exposes variables through `Netlify.env`; process.env is
// the fallback for local dev and older runtimes.
const env = new Proxy({} as Record<string, string | undefined>, {
  get: (_, name: string) =>
    (globalThis as { Netlify?: NetlifyGlobal }).Netlify?.env?.get(name) ?? process.env[name],
})

export function getConfig() {
  const infobipKey = env.INFOBIP_API_KEY?.trim()
  const infobipBaseUrl = env.INFOBIP_BASE_URL?.trim()
  return {
    adminPassword: env.ADMIN_PASSWORD ?? '',
    sanjaPassword: env.PASSWORD_SANJA ?? '',
    ninaPassword: env.PASSWORD_NINA ?? '',
    sessionSecret: env.SESSION_SECRET ?? '',
    salonName: env.SALON_NAME?.trim() || 'Crystal Beauty',
    smsSender: env.SMS_SENDER?.trim() || 'Crystal',
    infobip: infobipKey && infobipBaseUrl ? { apiKey: infobipKey, baseUrl: infobipBaseUrl } : null,
    /** Secret in the iPhone Shortcut's URLs; enables sending from the iPhone. */
    iphoneToken: env.IPHONE_TOKEN?.trim() ?? '',
  }
}

/**
 * infobip: the server sends each SMS itself.
 * iphone: an iPhone Shortcut fetches due texts and sends them from the phone.
 * test: nothing is sent; texts are only logged.
 */
export type SmsMode = 'infobip' | 'iphone' | 'test'

export function getSmsMode(): SmsMode {
  const cfg = getConfig()
  if (cfg.infobip) return 'infobip'
  if (cfg.iphoneToken.length >= 16) return 'iphone'
  return 'test'
}

/** Which required settings are missing, without revealing their values. */
export function getSetupProblems(): string[] {
  const cfg = getConfig()
  const problems: string[] = []
  if (!cfg.adminPassword) problems.push('ADMIN_PASSWORD nije pronađen.')
  if (!cfg.sessionSecret) problems.push('SESSION_SECRET nije pronađen.')
  else if (cfg.sessionSecret.length < 16)
    problems.push(`SESSION_SECRET ima ${cfg.sessionSecret.length} znakova, a treba najmanje 16.`)
  if (cfg.iphoneToken && cfg.iphoneToken.length < 16)
    problems.push(`IPHONE_TOKEN ima ${cfg.iphoneToken.length} znakova, a treba najmanje 16.`)
  return problems
}
