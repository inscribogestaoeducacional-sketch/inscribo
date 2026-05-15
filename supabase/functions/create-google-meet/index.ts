import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function createJWT(serviceAccount: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header  = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')

  const signingInput = `${b64url(header)}.${b64url(payload)}`

  const pem = serviceAccount.private_key
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '')
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${signingInput}.${sigB64}`
}

async function getAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const jwt = await createJWT(serviceAccount)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'Failed to get access token')
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID') || 'primary'

    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ meet_link: null, error: 'Google não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const serviceAccount = JSON.parse(serviceAccountJson)
    const body = await req.json()
    const { title, description, start_datetime, end_datetime, attendees = [] } = body

    if (!start_datetime || !end_datetime) {
      return new Response(
        JSON.stringify({ meet_link: null, error: 'start_datetime e end_datetime são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const accessToken = await getAccessToken(serviceAccount)

    const event = {
      summary: title || 'Reunião Áion Edu',
      description: description || '',
      start: { dateTime: start_datetime, timeZone: 'America/Fortaleza' },
      end: { dateTime: end_datetime, timeZone: 'America/Fortaleza' },
      attendees: (attendees as string[]).map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    )

    const data = await calRes.json()
    if (!calRes.ok) throw new Error(data.error?.message || 'Failed to create calendar event')

    return new Response(
      JSON.stringify({
        meet_link: data.hangoutLink ?? null,
        calendar_link: data.htmlLink ?? null,
        event_id: data.id ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[create-google-meet]', message)
    return new Response(
      JSON.stringify({ meet_link: null, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
