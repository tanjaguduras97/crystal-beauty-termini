import { createFileRoute } from '@tanstack/react-router'
import { checkToken, confirmSent } from '@/server/iphone'

// GET /api/iphone/poslato?kljuc=…&dan=YYYY-MM-DD&id=… — the Shortcut opens this
// after sending a text. GET keeps the Shortcut to a single plain URL action.
export const Route = createFileRoute('/api/iphone/poslato')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!checkToken(request)) return new Response('Zabranjeno', { status: 403 })
        const url = new URL(request.url)
        const date = url.searchParams.get('dan') ?? ''
        const id = url.searchParams.get('id') ?? ''
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[0-9a-f-]{36}$/.test(id)) {
          return new Response('Neispravan zahtjev', { status: 400 })
        }
        const ok = await confirmSent(date, id)
        return Response.json({ ok }, { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
