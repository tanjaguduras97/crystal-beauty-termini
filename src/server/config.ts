export function getConfig() {
  const env = process.env
  const infobipKey = env.INFOBIP_API_KEY?.trim()
  const infobipBaseUrl = env.INFOBIP_BASE_URL?.trim()
  return {
    adminPassword: env.ADMIN_PASSWORD ?? '',
    sessionSecret: env.SESSION_SECRET ?? '',
    salonName: env.SALON_NAME?.trim() || 'Crystal Beauty',
    salonPhone: env.SALON_PHONE?.trim() || undefined,
    smsSender: env.SMS_SENDER?.trim() || 'Crystal',
    infobip: infobipKey && infobipBaseUrl ? { apiKey: infobipKey, baseUrl: infobipBaseUrl } : null,
  }
}

export type SmsMode = 'infobip' | 'test'

export function getSmsMode(): SmsMode {
  return getConfig().infobip ? 'infobip' : 'test'
}
