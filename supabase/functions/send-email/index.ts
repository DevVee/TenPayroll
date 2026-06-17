// ─── Supabase Edge Function: send-email ───────────────────────────────────────
// Sends transactional emails via Resend. The API key lives ONLY in this
// server-side function — never in the frontend bundle.
//
// Deployment:
//   supabase functions deploy send-email
//   supabase secrets set RESEND_API_KEY=re_25h9Tdmb_HGcVKppQp6fXDSynDxruL4qR
//
// Invoked from the frontend via: supabase.functions.invoke('send-email', { body: payload })
// ─────────────────────────────────────────────────────────────────────────────
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API   = 'https://api.resend.com/emails'
const FROM_ADDRESS = 'TenPayroll <payroll@tenfoundation.ph>'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailPayload {
  to:      string          // recipient email
  subject: string
  html:    string          // full HTML body
  type?:   string          // for logging: 'welcome' | 'leave' | 'ot' | 'payslip'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error('[send-email] RESEND_API_KEY is not set')
      return new Response(JSON.stringify({ ok: false, error: 'Email service not configured.' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const payload: EmailPayload = await req.json()
    if (!payload.to || !payload.subject || !payload.html) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing required fields: to, subject, html.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM_ADDRESS,
        to:      [payload.to],
        subject: payload.subject,
        html:    payload.html,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[send-email] Resend error:', data)
      return new Response(JSON.stringify({ ok: false, error: data.message ?? 'Resend API error' }), {
        status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[send-email] Sent ${payload.type ?? 'email'} to ${payload.to} — id: ${data.id}`)
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[send-email] Unexpected error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
