// Reuniões do CRM no Google Agenda (conta da Áion): cria, atualiza (remarcar) e cancela o evento.
// O Google envia sozinho o e-mail de convite / atualização / cancelamento aos participantes
// (sendUpdates=all), no mesmo formato do Google Agenda e do Meet.
// Só quem é da equipe Áion (admin_geral ou consultor) pode usar.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function getRefreshToken(): Promise<string | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data } = await supabase.from('platform_settings').select('value').eq('key', 'google_oauth_refresh_token').maybeSingle()
  return data?.value || null
}

// Conta pessoal (não Workspace) usa OAuth 2.0: trocamos o refresh_token salvo por um access_token novo a cada chamada.
async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET não configurados nos secrets da function')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'Failed to refresh access token')
  return data.access_token
}

async function isTeam(req: Request): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: u } = await admin.auth.getUser(token)
  if (!u?.user) return false
  const { data: row } = await admin.from('users').select('user_type').eq('id', u.user.id).maybeSingle()
  return row?.user_type === 'admin_geral' || row?.user_type === 'consultant'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!(await isTeam(req))) return json({ meet_link: null, error: 'Sem permissão.' }, 403)

    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID') || 'primary'
    const refreshToken = await getRefreshToken()
    if (!refreshToken) return json({ meet_link: null, error: 'Google Calendar não conectado. Conecte em Configurações → Google Meet.' })

    const body = await req.json()
    const { action = 'create', event_id, title, description, start_datetime, end_datetime, attendees = [], send_updates = true } = body
    const accessToken = await getAccessToken(refreshToken)
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    const sendUpdates = send_updates ? 'all' : 'none'
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

    // Cancelar: o Google avisa os participantes que a reunião foi cancelada.
    if (action === 'cancel') {
      if (!event_id) return json({ error: 'event_id é obrigatório' }, 400)
      const r = await fetch(`${base}/${encodeURIComponent(event_id)}?sendUpdates=${sendUpdates}`, { method: 'DELETE', headers })
      if (!r.ok && r.status !== 404 && r.status !== 410) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error?.message || 'Falha ao cancelar o evento')
      }
      return json({ ok: true })
    }

    if (!start_datetime || !end_datetime) return json({ meet_link: null, error: 'start_datetime e end_datetime são obrigatórios' }, 400)

    const event: Record<string, unknown> = {
      summary: title || 'Reunião Áion Edu',
      description: description || '',
      start: { dateTime: start_datetime, timeZone: 'America/Fortaleza' },
      end: { dateTime: end_datetime, timeZone: 'America/Fortaleza' },
      attendees: (attendees as string[]).map((email) => ({ email })),
      guestsCanModify: false,
    }

    // Remarcar / editar: atualiza o mesmo evento e o Google manda o e-mail de atualização.
    if (action === 'update' && event_id) {
      const r = await fetch(`${base}/${encodeURIComponent(event_id)}?conferenceDataVersion=1&sendUpdates=${sendUpdates}`, { method: 'PATCH', headers, body: JSON.stringify(event) })
      const d = await r.json()
      if (r.ok) return json({ meet_link: d.hangoutLink ?? null, calendar_link: d.htmlLink ?? null, event_id: d.id ?? event_id })
      if (r.status !== 404 && r.status !== 410) throw new Error(d.error?.message || 'Falha ao atualizar o evento')
      // evento não existe mais no Google: cria de novo logo abaixo
    }

    event.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
    const calRes = await fetch(`${base}?conferenceDataVersion=1&sendUpdates=${sendUpdates}`, { method: 'POST', headers, body: JSON.stringify(event) })
    const data = await calRes.json()
    if (!calRes.ok) throw new Error(data.error?.message || 'Failed to create calendar event')
    return json({ meet_link: data.hangoutLink ?? null, calendar_link: data.htmlLink ?? null, event_id: data.id ?? null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[create-google-meet]', message)
    return json({ meet_link: null, error: message }, 500)
  }
})
