import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function getRefreshToken(): Promise<string | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'google_oauth_refresh_token')
    .maybeSingle()
  return data?.value || null
}

// Conta pessoal (não Workspace) usa OAuth 2.0 em vez de Service Account: uma
// Service Account não tem calendário próprio e não pode convidar attendees
// de fora do domínio sem Domain-Wide Delegation (exclusivo de Workspace).
// Trocamos o refresh_token salvo por um access_token novo a cada chamada.
async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET não configurados nos secrets da function')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'Failed to refresh access token')
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID') || 'primary'

    const refreshToken = await getRefreshToken()
    if (!refreshToken) {
      return new Response(
        JSON.stringify({ meet_link: null, error: 'Google Calendar não conectado. Conecte em Configurações → Google Meet.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json()
    const { title, description, start_datetime, end_datetime, attendees = [] } = body

    if (!start_datetime || !end_datetime) {
      return new Response(
        JSON.stringify({ meet_link: null, error: 'start_datetime e end_datetime são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const accessToken = await getAccessToken(refreshToken)

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
