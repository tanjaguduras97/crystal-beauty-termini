import { getConfig } from './config'

export type SmsResult = { ok: true; providerId?: string } | { ok: false; error: string }

/**
 * Sends one SMS. Without Infobip credentials the message is only logged
 * (test mode), so the app can be tried out before an SMS contract exists.
 */
export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const cfg = getConfig()
  if (!cfg.infobip) {
    console.log(`[sms:test] to=${to} from=${cfg.smsSender} text=${JSON.stringify(text)}`)
    return { ok: true, providerId: 'test' }
  }

  const base = cfg.infobip.baseUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  try {
    const res = await fetch(`https://${base}/sms/2/text/advanced`, {
      method: 'POST',
      headers: {
        Authorization: `App ${cfg.infobip.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: [{ from: cfg.smsSender, destinations: [{ to: to.replace(/^\+/, '') }], text }],
      }),
    })
    const body = (await res.json().catch(() => null)) as {
      messages?: { messageId?: string; status?: { groupName?: string; description?: string } }[]
      requestError?: { serviceException?: { text?: string } }
    } | null
    if (!res.ok) {
      const reason = body?.requestError?.serviceException?.text ?? res.statusText
      return { ok: false, error: `Infobip ${res.status}: ${reason}` }
    }
    const msg = body?.messages?.[0]
    if (!msg || msg.status?.groupName === 'REJECTED') {
      return { ok: false, error: `Odbijeno: ${msg?.status?.description ?? 'nepoznat razlog'}` }
    }
    return { ok: true, providerId: msg.messageId }
  } catch (e) {
    return { ok: false, error: `Mreža: ${(e as Error).message}` }
  }
}
