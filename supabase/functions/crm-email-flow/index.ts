// @ts-nocheck
// E-mails automáticos do CRM por fase (Super Admin). Cron a cada 15 min + "enviar teste" da tela de Configurações.
// Regras: só se o lead tem e-mail; 1 e-mail por lead a cada 24 h; só entre 8h e 18h (Fortaleza), de segunda a sábado;
// para se o lead mudou de fase ou se alguém registrou contato depois do gatilho; só vale para leads/eventos
// criados depois que o e-mail foi ligado (active_since); cada e-mail sai uma única vez por lead/gatilho (crm_email_log).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('APP_SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('APP_SERVICE_ROLE_KEY')!
const BREVO_KEY = Deno.env.get('BREVO_API_KEY')
const FROM = { name: 'Aion Edu', email: 'noreply@aionedu.com.br' }
const LOGO = 'https://www.aionedu.com.br/aion-logo-full.png'
const SALES_WA = 'https://wa.me/5583993444383'
const TZ = 'America/Fortaleza'
const DAY = 86400000
const PER_RUN = 30
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
const FONT = `'Helvetica Neue',Helvetica,Arial,sans-serif`

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const digits = (s: string) => String(s || '').replace(/\D/g, '')
const first = (s: string) => String(s || '').trim().split(/\s+/)[0] || ''
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim())
const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: TZ })

function localParts(now: Date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false, weekday: 'short' })
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]))
  return { hour: parseInt(p.hour) % 24, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) }
}

function fill(t: string, v: Record<string, string>) {
  return String(t || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (v[k] ?? ''))
}

function html(body: string, buttonLabel: string | null, buttonUrl: string | null, signName: string, preheader: string) {
  const paras = body.split(/\n\s*\n/).map(p => `<p style="font-family:${FONT};color:#475569;font-size:15px;line-height:1.7;margin:0 0 18px;">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('')
  const btn = buttonLabel && buttonUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto;"><tr><td style="background-color:#00A896;border-radius:10px;"><a href="${esc(buttonUrl)}" style="display:inline-block;font-family:${FONT};padding:14px 34px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">${esc(buttonLabel)}</a></td></tr></table>` : ''
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Aion Edu</title></head>
<body style="margin:0;padding:0;background-color:#F0F4F8;font-family:${FONT};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F4F8;padding:32px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#00523C 0%,#00A896 100%);border-radius:16px 16px 0 0;padding:28px 40px;text-align:center;"><img src="${LOGO}" alt="Aion Edu" height="40" style="display:block;margin:0 auto;border:0;filter:brightness(0) invert(1);" /></td></tr>
<tr><td style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">${paras}${btn}<p style="font-family:${FONT};color:#475569;font-size:15px;line-height:1.6;margin:8px 0 0;">Um abraço,<br><strong>${esc(signName)}</strong><br>Aion Edu</p></td></tr>
<tr><td style="background-color:#1A2B4A;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;"><p style="font-family:${FONT};color:rgba(255,255,255,0.9);font-size:13px;margin:0 0 4px;font-weight:600;">Aion Soluções Tecnológicas LTDA</p><p style="font-family:${FONT};color:rgba(255,255,255,0.55);font-size:12px;margin:0;">CNPJ: 65.835.064/0001-58 · Patos/PB · aionedu.com.br</p></td></tr>
</table></td></tr></table></body></html>`
}

async function brevo(to: string, subject: string, htmlContent: string, tag: string) {
  if (!BREVO_KEY) throw new Error('BREVO_API_KEY nao configurada')
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
    body: JSON.stringify({ sender: FROM, to: [{ email: to }], subject, htmlContent, tags: ['crm-flow', tag] }),
  })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b?.message || `Brevo ${r.status}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    const body = await req.json().catch(() => ({}))

    // ── Teste: admin_geral manda o e-mail como está na tela (mesmo sem salvar) ──
    if (body.test) {
      const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
      let me: any = null
      let isService = token === SERVICE_KEY
      try { isService = isService || JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role' } catch (_) { /* não é JWT */ }
      if (isService) me = { full_name: body.sign_name || 'Equipe Áion Edu', phone: body.sign_phone || null, user_type: 'admin_geral' }
      else {
        const { data: au } = await sb.auth.getUser(token)
        if (!au?.user) return new Response(JSON.stringify({ error: 'Sem login' }), { status: 401, headers: CORS })
        const r = await sb.from('users').select('full_name, phone, user_type').eq('id', au.user.id).maybeSingle()
        me = r.data
      }
      if (me?.user_type !== 'admin_geral') return new Response(JSON.stringify({ error: 'Só o Super Admin pode enviar teste' }), { status: 403, headers: CORS })
      if (!emailOk(body.to)) return new Response(JSON.stringify({ error: 'E-mail de destino inválido' }), { status: 400, headers: CORS })
      const v = { nome: 'Maria', escola: 'Colégio Exemplo', consultor: me?.full_name || 'Equipe Áion Edu', valido_ate: fmtDate(new Date(Date.now() + 7 * DAY)) }
      const wa = me?.phone ? `https://wa.me/55${digits(me.phone).replace(/^55/, '')}` : SALES_WA
      const label = body.button_label ? fill(body.button_label, v) : null
      const url = body.button_kind === 'whatsapp' ? wa : body.button_kind === 'proposal' ? 'https://aionedu.com.br' : null
      const subject = '[TESTE] ' + fill(body.subject, v)
      await brevo(body.to.trim(), subject, html(fill(body.body, v), label, url, v.consultor, subject), 'teste')
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    }

    // ── Cron ──
    const now = new Date()
    const { hour, dow } = localParts(now)
    if (!body.force && (hour < 8 || hour >= 18 || dow === 0)) return new Response(JSON.stringify({ skipped: 'fora do horário' }), { headers: CORS })

    const { data: flows } = await sb.from('crm_email_flows').select('*').eq('enabled', true).eq('builtin', false)
    if (!flows?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: CORS })

    const since60 = new Date(now.getTime() - 60 * DAY).toISOString()
    const [leadsR, intR, logR, usersR] = await Promise.all([
      sb.from('crm_leads').select('id,name,school_name,email,stage,consultant_id,created_at,updated_at').not('email', 'is', null),
      sb.from('crm_interactions').select('lead_id,created_at').gte('created_at', since60),
      sb.from('crm_email_log').select('lead_id,created_at,status').gte('created_at', new Date(now.getTime() - DAY).toISOString()),
      sb.from('users').select('id,full_name,phone').in('user_type', ['admin_geral', 'consultant', 'consultant_externo', 'consultant_interno']),
    ])
    const leads = (leadsR.data || []).filter(l => emailOk(l.email))
    const byId = new Map(leads.map(l => [l.id, l]))
    const usersById = new Map((usersR.data || []).map(u => [u.id, u]))
    const lastInter = new Map<string, number>()
    for (const i of intR.data || []) lastInter.set(i.lead_id, Math.max(lastInter.get(i.lead_id) || 0, new Date(i.created_at).getTime()))
    const sentToday = new Set((logR.data || []).filter(r => r.status !== 'error').map(r => r.lead_id))

    const wantsMeetings = flows.some(f => ['meeting_created', 'meeting_done'].includes(f.trigger_kind))
    const wantsProposals = flows.some(f => ['proposal_followup', 'proposal_expiring'].includes(f.trigger_kind))
    const wantsEvents = flows.some(f => f.trigger_kind === 'stage_fechado')
    const [meetR, propR, evR] = await Promise.all([
      wantsMeetings ? sb.from('crm_meetings').select('id,lead_id,status,scheduled_at,created_at').in('status', ['scheduled', 'completed']).gte('created_at', since60) : { data: [] },
      wantsProposals ? sb.from('proposals').select('id,lead_id,status,sent_at,pdf_url,client_email,special_deadline,proposal_date,validity_days').not('sent_at', 'is', null).in('status', ['sent', 'viewed']).gte('sent_at', since60) : { data: [] },
      wantsEvents ? sb.from('crm_lead_events').select('id,lead_id,created_at,detail').eq('event', 'stage').gte('created_at', since60) : { data: [] },
    ])

    type Cand = { flow: any; lead: any; ref: string; to: string; vars?: any; pdf?: string }
    const cands: Cand[] = []
    const CLOSED = ['fechado', 'cliente']
    const ok = (f: any, lead: any, base: number, opts: { due?: boolean } = {}) => {
      if (!lead) return false
      const since = f.active_since ? new Date(f.active_since).getTime() : Infinity
      if (base < since) return false
      if (opts.due !== undefined) return opts.due
      const dueAt = base + Number(f.delay_days) * DAY
      if (now.getTime() < dueAt || now.getTime() - dueAt > 14 * DAY) return false
      if (Number(f.delay_days) > 0 && (lastInter.get(lead.id) || 0) > base) return false
      return true
    }

    for (const f of flows) {
      if (f.trigger_kind === 'lead_created') {
        for (const l of leads) if (l.stage === 'interesse' && ok(f, l, new Date(l.created_at).getTime())) cands.push({ flow: f, lead: l, ref: 'created', to: l.email })
      } else if (f.trigger_kind === 'stage_idle') {
        for (const l of leads) if (l.stage === f.stage && ok(f, l, new Date(l.updated_at).getTime())) cands.push({ flow: f, lead: l, ref: String(l.updated_at), to: l.email })
      } else if (f.trigger_kind === 'meeting_created') {
        for (const m of meetR.data || []) {
          const l = byId.get(m.lead_id)
          if (l && !CLOSED.includes(l.stage) && m.status === 'scheduled' && new Date(m.scheduled_at).getTime() > now.getTime() && ok(f, l, new Date(m.created_at).getTime())) cands.push({ flow: f, lead: l, ref: m.id, to: l.email })
        }
      } else if (f.trigger_kind === 'meeting_done') {
        for (const m of meetR.data || []) {
          const l = byId.get(m.lead_id)
          if (l && !CLOSED.includes(l.stage) && ok(f, l, new Date(m.scheduled_at).getTime())) cands.push({ flow: f, lead: l, ref: m.id, to: l.email })
        }
      } else if (f.trigger_kind === 'proposal_followup') {
        for (const p of propR.data || []) {
          const l = byId.get(p.lead_id)
          if (l && !CLOSED.includes(l.stage) && ok(f, l, new Date(p.sent_at).getTime())) cands.push({ flow: f, lead: l, ref: p.id, to: emailOk(p.client_email) ? p.client_email : l.email, pdf: p.pdf_url })
        }
      } else if (f.trigger_kind === 'proposal_expiring') {
        for (const p of propR.data || []) {
          const l = byId.get(p.lead_id)
          if (!l || CLOSED.includes(l.stage)) continue
          const end = p.special_deadline ? new Date(p.special_deadline + 'T23:59:59-03:00') : new Date(new Date((p.proposal_date || p.sent_at.slice(0, 10)) + 'T23:59:59-03:00').getTime() + Number(p.validity_days || 0) * DAY)
          const due = now.getTime() >= end.getTime() - Number(f.delay_days) * DAY && now.getTime() <= end.getTime()
          if (ok(f, l, new Date(p.sent_at).getTime(), { due })) cands.push({ flow: f, lead: l, ref: p.id, to: emailOk(p.client_email) ? p.client_email : l.email, pdf: p.pdf_url, vars: { valido_ate: fmtDate(end) } })
        }
      } else if (f.trigger_kind === 'stage_fechado') {
        for (const e of evR.data || []) {
          const l = byId.get(e.lead_id)
          if (l && e.detail?.to === 'fechado' && CLOSED.includes(l.stage) && ok(f, l, new Date(e.created_at).getTime())) cands.push({ flow: f, lead: l, ref: e.id, to: l.email })
        }
      }
    }

    let sent = 0; const errors: string[] = []
    for (const c of cands) {
      if (sent >= PER_RUN) break
      if (sentToday.has(c.lead.id)) continue
      // trava: grava antes de enviar; se já existe, não envia de novo
      const ins = await sb.from('crm_email_log').insert({ lead_id: c.lead.id, flow_key: c.flow.key, ref_id: c.ref, to_email: c.to, status: 'sending' }).select('id').maybeSingle()
      if (ins.error || !ins.data) continue
      const cons = usersById.get(c.lead.consultant_id)
      const consultor = cons?.full_name || 'Equipe Áion Edu'
      const v = { nome: first(c.lead.name) || 'tudo bem', escola: c.lead.school_name || 'sua escola', consultor, valido_ate: '', ...(c.vars || {}) }
      const wa = cons?.phone ? `https://wa.me/55${digits(cons.phone).replace(/^55/, '')}` : SALES_WA
      const kind = c.flow.button_kind
      const url = kind === 'whatsapp' ? wa : kind === 'proposal' ? (c.pdf || null) : null
      try {
        const subject = fill(c.flow.subject, v)
        await brevo(c.to, subject, html(fill(c.flow.body, v), c.flow.button_label ? fill(c.flow.button_label, v) : null, url, consultor, subject), c.flow.key)
        await sb.from('crm_email_log').update({ status: 'sent' }).eq('id', ins.data.id)
        try { await sb.rpc('crm_log_event', { p_lead: c.lead.id, p_name: c.lead.school_name, p_event: 'email_flow', p_detail: { flow: c.flow.key, label: c.flow.label } }) } catch (_) { /* histórico é opcional */ }
        sentToday.add(c.lead.id); sent++
      } catch (e) {
        await sb.from('crm_email_log').update({ status: 'error', error: String(e).slice(0, 300) }).eq('id', ins.data.id)
        errors.push(`${c.flow.key}: ${String(e).slice(0, 120)}`)
      }
    }
    return new Response(JSON.stringify({ candidates: cands.length, sent, errors }), { headers: CORS })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
