// @ts-nocheck
// Sequência para lead sem resposta: manda, em passos, um modelo aprovado da Meta para o lead
// que parou de responder. Chamada a cada 15 minutos pelo pg_cron (ver migration lead_sequence).
// Regras: no máximo 5 tentativas por lead (a vida toda), um passo por vez, horário e dias da escola,
// limite diário por escola, nunca para número bloqueado/descadastrado, para quando o lead responde.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('APP_SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('APP_SERVICE_ROLE_KEY')!
const GRAPH = 'https://graph.facebook.com/v25.0'
const TZ = 'America/Fortaleza'
const OPEN_STATUSES = ['new', 'contact', 'visit', 'scheduled', 'proposal']
const PER_RUN = 20
const MAX_ATTEMPTS = 5

const digits = (s: string) => String(s || '').replace(/\D/g, '')
// Mesma pessoa mesmo com/sem o 9º dígito: DDD + últimos 8 números.
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
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  return { hour: parseInt(p.hour) % 24, dow, ymd: `${p.year}-${p.month}-${p.day}` }
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

serve(async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  const out: any[] = []
  try {
    const { data: tok } = await sb.from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
    const token = tok?.value || ''
    if (!token) return new Response(JSON.stringify({ error: 'sem token' }), { status: 200 })
    const now = new Date()
    const lp = localParts(now)

    const { data: cfgs } = await sb.from('lead_sequence_config').select('*').eq('enabled', true)
    for (const cfg of (cfgs || [])) {
      const inst = cfg.institution_id
      const res: any = { inst, sent: 0, failed: 0 }
      out.push(res)
      if (lp.hour < cfg.send_from || lp.hour >= cfg.send_to || !(cfg.weekdays || []).includes(lp.dow)) { res.skip = 'fora do horário'; continue }

      // limite do dia (conta pelo dia de Fortaleza)
      const dayStart = new Date(`${lp.ymd}T00:00:00-03:00`)
      const { count: sentToday } = await sb.from('lead_sequence_log').select('id', { count: 'exact', head: true })
        .eq('institution_id', inst).eq('status', 'sent').gte('sent_at', dayStart.toISOString())
      let budget = Math.min(PER_RUN, (cfg.daily_cap || 100) - (sentToday || 0))
      if (budget <= 0) { res.skip = 'limite do dia'; continue }

      const { data: ph } = await sb.from('whatsapp_phone_numbers').select('phone_number_id').eq('institution_id', inst).eq('is_active', true).limit(1).maybeSingle()
      if (!ph?.phone_number_id) { res.skip = 'sem número'; continue }
      const { data: instRow } = await sb.from('institutions').select('name').eq('id', inst).maybeSingle()

      const maxAttempts = Math.min(MAX_ATTEMPTS, cfg.max_attempts || MAX_ATTEMPTS)
      const steps = (Array.isArray(cfg.steps) ? cfg.steps : []).slice(0, maxAttempts)
        .filter(s => s && Number(s.days) >= 1 && s.template)
      if (!steps.length) { res.skip = 'sem passos'; continue }

      // modelos aprovados desta escola
      const names = [...new Set(steps.map(s => s.template))]
      const { data: defs } = await sb.from('template_definitions').select('id, name, body_text, variable_labels, institution_id')
        .in('name', names).or(`institution_id.eq.${inst},institution_id.is.null`)
      const { data: sts } = await sb.from('template_institution_status').select('template_definition_id, status').eq('institution_id', inst)
      const okIds = new Set((sts || []).filter(s => s.status === 'approved').map(s => s.template_definition_id))
      const tpl: Record<string, any> = {}
      for (const d of (defs || [])) if (okIds.has(d.id) && (!tpl[d.name] || d.institution_id)) tpl[d.name] = d

      const minDays = Math.min(...steps.map(s => Number(s.days)))
      const cutoff = new Date(now.getTime() - minDays * 86400000).toISOString()
      const { data: leads } = await sb.from('leads').select('id, responsible_name, student_name, phone, created_at, status')
        .eq('institution_id', inst).is('deleted_at', null).in('status', OPEN_STATUSES).not('phone', 'is', null)
        .lt('created_at', cutoff).order('created_at', { ascending: false }).limit(1500)
      if (!leads?.length) continue

      const [{ data: convs }, { data: logs }, { data: bl }, { data: sup }] = await Promise.all([
        sb.from('whatsapp_conversations').select('id, lead_id, remote_jid, phone_number, last_customer_message_at, last_message_at').eq('institution_id', inst).limit(20000),
        sb.from('lead_sequence_log').select('lead_id, status, step, sent_at').eq('institution_id', inst),
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
      const logsBy = new Map<string, any[]>()
      for (const l of (logs || [])) { if (!logsBy.has(l.lead_id)) logsBy.set(l.lead_id, []); logsBy.get(l.lead_id)!.push(l) }

      for (const lead of leads) {
        if (budget <= 0) break
        const k = key(lead.phone)
        if (!k || blocked.has(k)) continue
        const conv = convByKey.get(k)
        const t0 = new Date(conv?.last_customer_message_at || lead.created_at)
        // lead muito antigo (frio demais): fora da sequência
        if (now.getTime() - t0.getTime() > (cfg.max_age_days || 30) * 86400000) continue
        // conversa viva: a equipe falou há menos de 24h, deixa o atendente cuidar
        if (conv?.last_message_at && now.getTime() - new Date(conv.last_message_at).getTime() < 24 * 3600000) continue

        const mine = logsBy.get(lead.id) || []
        const sentAll = mine.filter(l => l.status === 'sent')
        if (sentAll.length >= maxAttempts) continue
        const sentSince = sentAll.filter(l => new Date(l.sent_at) > t0)
        const idx = sentSince.length
        if (idx >= steps.length) continue
        const step = steps[idx]
        if (now.getTime() - t0.getTime() < Number(step.days) * 86400000) continue
        const lastSentAt = sentAll.length ? Math.max(...sentAll.map(l => new Date(l.sent_at).getTime())) : 0
        if (now.getTime() - lastSentAt < 20 * 3600000) continue
        // falhou 3 vezes seguidas: para de tentar neste lead
        if (mine.filter(l => l.status === 'failed').length >= 3) continue
        const failedRecent = mine.some(l => l.status === 'failed' && now.getTime() - new Date(l.sent_at).getTime() < 24 * 3600000)
        if (failedRecent) continue

        const t = tpl[step.template]
        if (!t) continue
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
        if (!ok) continue

        const to = toWaNumber(lead.phone)
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
          await sb.from('lead_sequence_log').insert({ institution_id: inst, lead_id: lead.id, step: idx + 1, template_name: step.template, remote_jid: to, status: 'failed', error: String(data?.error?.message || resp.status).slice(0, 300) })
          continue
        }
        res.sent++
        await sb.from('lead_sequence_log').insert({ institution_id: inst, lead_id: lead.id, step: idx + 1, template_name: step.template, remote_jid: to, status: 'sent' })
        let preview = String(t.body_text)
        nums.forEach((n, i) => { preview = preview.replaceAll(`{{${n}}}`, vals[i]) })
        await sb.from('whatsapp_messages').insert({
          institution_id: inst, conversation_id: conv?.id || null, remote_jid: conv?.remote_jid || `${to}@s.whatsapp.net`,
          message_id: data.messages?.[0]?.id, instance_name: 'cloud-api', content: preview, message_type: 'template',
          from_me: true, is_bot_message: true, automation: 'lead_sequence', status: 'sent', direction: 'outbound', timestamp: new Date().toISOString(),
        })
        if (conv?.id) await sb.from('whatsapp_conversations').update({ last_message: preview, last_message_at: new Date().toISOString() }).eq('id', conv.id)
        await new Promise(r => setTimeout(r, 400))
      }
    }
    return new Response(JSON.stringify({ ok: true, out }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[lead-sequence]', e)
    return new Response(JSON.stringify({ error: String(e?.message || e), out }), { status: 500 })
  }
})
