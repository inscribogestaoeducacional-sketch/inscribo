// @ts-nocheck
// Sequência para lead sem resposta (v2): quem entra na sequência é colocado pelo atendente/gestor.
// Cron a cada 15 min processa as inscrições ativas e vencidas. Também atende "Enviar agora" da tela
// (corpo { enrollment_id }, com o login do usuário). Regras: máx. 5 mensagens por lead na vida,
// nunca mais de 1 por dia, horário/dias/limite diário da escola, só modelo aprovado, para quando o lead responde.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('APP_SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('APP_SERVICE_ROLE_KEY')!
const GRAPH = 'https://graph.facebook.com/v25.0'
const TZ = 'America/Fortaleza'
const CLOSED = ['enrolled', 'lost']
const PER_RUN = 25
const MAX_ATTEMPTS = 5
const DAY = 86400000
const H = 3600000
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }

const digits = (s: string) => String(s || '').replace(/\D/g, '')
function key(raw: string) {
  const d = digits(raw)
  if (d.startsWith('55') && d.length >= 12) return d.slice(2, 4) + d.slice(-8)
  return d.slice(-10)
}
function toWaNumber(raw: string) {
  let d = digits(raw)
  if (d.length === 10 || d.length === 11) d = '55' + d
  if (d.startsWith('55') && d.length === 12 && d[4] >= '6' && d[4] <= '9') d = d.slice(0, 4) + '9' + d.slice(4)
  return d
}
function localParts(now: Date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]))
  return { hour: parseInt(p.hour) % 24, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), ymd: `${p.year}-${p.month}-${p.day}` }
}
function varKind(label: string) {
  const l = String(label || '').toLowerCase()
  if (/respons|fam[ií]lia|pai|m[aã]e/.test(l)) return 'responsavel'
  if (/institu|escola|col[eé]gio/.test(l)) return 'escola'
  if (/aluno|estudante|filh/.test(l)) return 'aluno'
  if (/atendente/.test(l)) return 'atendente'
  return null
}
const firstName = (s: string) => String(s || '').trim().split(/\s+/)[0] || ''

async function notify(sb, users: (string | null)[], title: string, body: string, url: string, tag: string) {
  const ids = users.filter(Boolean)
  if (!ids.length) return
  try { await sb.rpc('push_notify', { p_users: ids, p_title: title, p_body: body, p_url: url, p_tag: tag }) } catch (_) { /* aviso é opcional */ }
}
async function end(sb, e, status: string, reason: string) {
  await sb.from('lead_sequence_enrollments').update({ status, end_reason: reason, ended_at: new Date().toISOString() }).eq('id', e.id)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  const out: any[] = []
  try {
    let body: any = {}
    try { body = await req.json() } catch (_) { /* cron sem corpo */ }
    const forceId: string | null = body?.enrollment_id || null

    const { data: tok } = await sb.from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
    const token = tok?.value || ''
    if (!token) return new Response(JSON.stringify({ error: 'sem token' }), { status: 200, headers: CORS })
    const now = new Date()
    const lp = localParts(now)

    // "Enviar agora": exige login do usuário e que a inscrição seja da escola dele
    let only: any = null
    if (forceId) {
      const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
      const { data: u } = await sb.auth.getUser(jwt)
      const { data: enr } = await sb.from('lead_sequence_enrollments').select('*').eq('id', forceId).maybeSingle()
      if (!u?.user || !enr) return new Response(JSON.stringify({ error: 'não autorizado' }), { status: 403, headers: CORS })
      const { data: me } = await sb.from('users').select('institution_id').eq('id', u.user.id).maybeSingle()
      if (me?.institution_id !== enr.institution_id) return new Response(JSON.stringify({ error: 'não autorizado' }), { status: 403, headers: CORS })
      if (enr.status !== 'active') return new Response(JSON.stringify({ error: 'inscrição não está ativa' }), { status: 200, headers: CORS })
      only = enr
    }

    let enrQuery = sb.from('lead_sequence_enrollments').select('*').eq('status', 'active')
    if (only) enrQuery = enrQuery.eq('id', only.id)
    else enrQuery = enrQuery.lte('next_due_at', now.toISOString()).order('next_due_at').limit(300)
    const { data: enrs } = await enrQuery
    const byInst = new Map<string, any[]>()
    for (const e of (enrs || [])) { if (!byInst.has(e.institution_id)) byInst.set(e.institution_id, []); byInst.get(e.institution_id)!.push(e) }

    for (const [inst, list] of byInst) {
      const res: any = { inst, sent: 0, failed: 0, ended: 0 }
      out.push(res)
      const { data: cfg } = await sb.from('lead_sequence_config').select('*').eq('institution_id', inst).maybeSingle()
      if (!cfg || (!cfg.enabled && !only)) { res.skip = 'sequência desligada'; continue }
      const steps = (Array.isArray(cfg.steps) ? cfg.steps : []).slice(0, MAX_ATTEMPTS).filter(s => s && Number(s.days) >= 1 && s.template)
      if (!steps.length) { res.skip = 'sem passos'; continue }

      const inHours = !(lp.hour < cfg.send_from || lp.hour >= cfg.send_to || !(cfg.weekdays || []).includes(lp.dow))
      const dayStart = new Date(`${lp.ymd}T00:00:00-03:00`)
      const { count: sentToday } = await sb.from('lead_sequence_log').select('id', { count: 'exact', head: true })
        .eq('institution_id', inst).eq('status', 'sent').gte('sent_at', dayStart.toISOString())
      let budget = Math.min(PER_RUN, (cfg.daily_cap || 100) - (sentToday || 0))

      const { data: ph } = await sb.from('whatsapp_phone_numbers').select('phone_number_id').eq('institution_id', inst).eq('is_active', true).limit(1).maybeSingle()
      const { data: instRow } = await sb.from('institutions').select('name').eq('id', inst).maybeSingle()

      const names = [...new Set(steps.map(s => s.template))]
      const { data: defs } = await sb.from('template_definitions').select('id, name, body_text, variable_labels, institution_id')
        .in('name', names).or(`institution_id.eq.${inst},institution_id.is.null`)
      const { data: sts } = await sb.from('template_institution_status').select('template_definition_id, status').eq('institution_id', inst)
      const okIds = new Set((sts || []).filter(s => s.status === 'approved').map(s => s.template_definition_id))
      const tpl: Record<string, any> = {}
      for (const d of (defs || [])) if (okIds.has(d.id) && (!tpl[d.name] || d.institution_id)) tpl[d.name] = d

      const [{ data: convs }, { data: bl }, { data: sup }] = await Promise.all([
        sb.from('whatsapp_conversations').select('id, lead_id, remote_jid, phone_number, assigned_user_id, last_customer_message_at, last_message_at').eq('institution_id', inst).limit(20000),
        sb.from('whatsapp_blacklist').select('phone_number').eq('institution_id', inst),
        sb.from('broadcast_suppressions').select('phone').eq('institution_id', inst).is('lifted_at', null),
      ])
      const blocked = new Set([...(bl || []).map(b => key(b.phone_number)), ...(sup || []).map(b => key(b.phone))])
      const convByKey = new Map<string, any>()
      for (const c of (convs || [])) {
        const k = key(c.phone_number || c.remote_jid || '')
        if (!k) continue
        const prev = convByKey.get(k)
        if (!prev || new Date(c.last_message_at || 0) > new Date(prev.last_message_at || 0)) convByKey.set(k, c)
      }

      for (const e of list) {
        const { data: lead } = await sb.from('leads').select('id, responsible_name, student_name, phone, status, deleted_at').eq('id', e.lead_id).maybeSingle()
        if (!lead || lead.deleted_at || CLOSED.includes(lead.status)) { await end(sb, e, 'stopped', lead?.status === 'enrolled' ? 'lead matriculado' : 'lead encerrado'); res.ended++; continue }
        const k = key(e.phone || lead.phone)
        if (!k || blocked.has(k)) { await end(sb, e, 'stopped', 'número bloqueado ou descadastrado'); res.ended++; continue }
        const conv = convByKey.get(k)

        // o lead respondeu depois do último passo (ou depois da entrada): sai da sequência e avisa quem colocou
        const since = new Date(e.last_sent_at || e.started_at).getTime()
        if (conv?.last_customer_message_at && new Date(conv.last_customer_message_at).getTime() > since) {
          await end(sb, e, 'replied', 'lead respondeu'); res.ended++
          await notify(sb, [e.started_by, conv.assigned_user_id], '💬 Lead respondeu à sequência', `${lead.responsible_name || lead.student_name || 'Lead'} respondeu. A conversa voltou para a equipe.`, '/whatsapp?phone=' + digits(e.phone), 'seq-' + e.id)
          continue
        }

        const { data: sent } = await sb.from('lead_sequence_log').select('sent_at').eq('lead_id', e.lead_id).eq('status', 'sent')
        const sentCount = (sent || []).length
        if (sentCount >= MAX_ATTEMPTS || e.step >= steps.length) { await end(sb, e, 'finished', sentCount >= MAX_ATTEMPTS ? 'limite de 5 mensagens' : 'sequência concluída'); res.ended++; continue }

        if (!only) {
          if (!inHours) continue
          if (budget <= 0) { res.skip = 'limite do dia'; continue }
          // equipe falou nas últimas 24h: adia
          if (conv?.last_message_at && now.getTime() - new Date(conv.last_message_at).getTime() < 24 * H) {
            await sb.from('lead_sequence_enrollments').update({ next_due_at: new Date(now.getTime() + 6 * H).toISOString() }).eq('id', e.id); continue
          }
        } else if (budget <= 0) { res.skip = 'limite do dia'; continue }
        // nunca mais de 1 por dia por lead
        const lastAny = (sent || []).length ? Math.max(...sent.map(l => new Date(l.sent_at).getTime())) : 0
        if (now.getTime() - lastAny < 20 * H) {
          if (only) { res.skip = 'já enviou nas últimas 20 horas'; continue }
          await sb.from('lead_sequence_enrollments').update({ next_due_at: new Date(lastAny + 20 * H).toISOString() }).eq('id', e.id); continue
        }
        if (!ph?.phone_number_id) { res.skip = 'sem número'; continue }

        const step = steps[e.step]
        const t = tpl[step.template]
        if (!t) { res.skip = `modelo ${step.template} não aprovado`; continue }
        const labels = t.variable_labels || {}
        const nums = [...new Set([...String(t.body_text).matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1]))].sort((a, b) => +a - +b)
        const vals: string[] = []
        let ok = true
        for (const n of nums) {
          const kind = varKind(labels[n])
          const v = kind === 'responsavel' ? (firstName(lead.responsible_name) || 'família')
            : kind === 'escola' ? (instRow?.name || 'nossa escola')
            : kind === 'aluno' ? (firstName(lead.student_name) || 'seu filho(a)')
            : kind === 'atendente' ? 'Equipe' : null
          if (v == null) { ok = false; break }
          vals.push(v)
        }
        if (!ok) { res.skip = 'modelo com variável desconhecida'; continue }

        const to = toWaNumber(e.phone || lead.phone)
        const payload: any = { name: step.template, language: { code: 'pt_BR' } }
        if (vals.length) payload.components = [{ type: 'body', parameters: vals.map(v => ({ type: 'text', text: v })) }]
        const resp = await fetch(`${GRAPH}/${ph.phone_number_id}/messages`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template', template: payload }),
        })
        const data = await resp.json().catch(() => ({}))
        budget--
        if (!resp.ok) {
          res.failed++
          await sb.from('lead_sequence_log').insert({ institution_id: inst, enrollment_id: e.id, lead_id: e.lead_id, step: e.step + 1, template_name: step.template, remote_jid: to, status: 'failed', error: String(data?.error?.message || resp.status).slice(0, 300) })
          // tenta de novo em 24h; depois de 3 falhas seguidas, tira da sequência
          const { count: fails } = await sb.from('lead_sequence_log').select('id', { count: 'exact', head: true }).eq('enrollment_id', e.id).eq('status', 'failed')
          if ((fails || 0) >= 3) { await end(sb, e, 'stopped', 'falhas no envio'); res.ended++ }
          else await sb.from('lead_sequence_enrollments').update({ next_due_at: new Date(now.getTime() + 24 * H).toISOString() }).eq('id', e.id)
          continue
        }
        res.sent++
        await sb.from('lead_sequence_log').insert({ institution_id: inst, enrollment_id: e.id, lead_id: e.lead_id, step: e.step + 1, template_name: step.template, remote_jid: to, status: 'sent' })
        const nextStep = e.step + 1
        const finished = nextStep >= steps.length || sentCount + 1 >= MAX_ATTEMPTS
        await sb.from('lead_sequence_enrollments').update(finished
          ? { step: nextStep, last_sent_at: now.toISOString(), status: 'finished', end_reason: 'sequência concluída', ended_at: now.toISOString() }
          : { step: nextStep, last_sent_at: now.toISOString(), next_due_at: new Date(now.getTime() + Number(steps[nextStep].days) * DAY).toISOString() }).eq('id', e.id)
        let preview = String(t.body_text)
        nums.forEach((n, i) => { preview = preview.replaceAll(`{{${n}}}`, vals[i]) })
        await sb.from('whatsapp_messages').insert({
          institution_id: inst, conversation_id: conv?.id || null, remote_jid: conv?.remote_jid || `${to}@s.whatsapp.net`,
          message_id: data.messages?.[0]?.id, instance_name: 'cloud-api', content: preview, message_type: 'template',
          from_me: true, is_bot_message: true, automation: 'lead_sequence', status: 'sent', direction: 'outbound', timestamp: now.toISOString(),
        })
        if (conv?.id) await sb.from('whatsapp_conversations').update({ last_message: preview, last_message_at: now.toISOString() }).eq('id', conv.id)
        await new Promise(r => setTimeout(r, 400))
      }
    }
    return new Response(JSON.stringify({ ok: true, out }), { status: 200, headers: CORS })
  } catch (e) {
    console.error('[lead-sequence]', e)
    return new Response(JSON.stringify({ error: String(e?.message || e), out }), { status: 500, headers: CORS })
  }
})
