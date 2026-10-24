import { createFileRoute } from '@tanstack/react-router'
import { checkToken, claimDueMessages } from '@/server/iphone'

// GET /api/iphone/poruke?kljuc=… → [{ broj, tekst, potvrda }]
export const Route = createFileRoute('/api/iphone/poruke')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!checkToken(request)) return new Response('Zabranjeno', { status: 403 })
        const messages = await claimDueMessages(new URL(request.url).origin)
        console.log(`[iphone] handed out ${messages.length}`)
        return Response.json(messages, { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
