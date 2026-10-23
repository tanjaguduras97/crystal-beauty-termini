import type { Config } from '@netlify/functions'
import { sendDueReminders } from '../../src/server/send'

export default async () => {
  const result = await sendDueReminders()
  console.log(`[reminders] ${JSON.stringify(result)}`)
}

// Every 5 minutes, so each reminder goes out at most ~5 min after the
// 24h mark (bookings made less than 24h ahead are sent on save).
export const config: Config = {
  schedule: '*/5 * * * *',
}
