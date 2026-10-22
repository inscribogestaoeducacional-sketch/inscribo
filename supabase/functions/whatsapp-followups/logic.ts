// Envios automáticos que dependem de tempo:
//   • Lembrete da avaliação  — o cliente recebeu a avaliação e não respondeu.
//   • Conversa parada        — a equipe respondeu e o cliente não escreveu mais.
//
// Roda de 5 em 5 minutos (pg_cron → edge function). Regras:
//   - só se a escola ligou (idle_config.enabled / survey_config.reminder_enabled);
//   - só no horário de atendimento da escola (mesma regra do webhook: horário
//     geral ou por atendente, feriados e datas especiais);
//   - uma vez por ciclo (guardado em whatsapp_conversations);
//   - no máximo 23 h depois da última mensagem do cliente (limite de 24 h do
//     WhatsApp para texto livre);
//   - nunca depois que o cliente já escreveu de novo.
//
// Este arquivo não depende do Deno: recebe o cliente do banco e a função de envio,
// para poder ser testado no computador.

export type Sb = any
export type SendArgs = { institutionId: string; to: string; remoteJid: string; text: string; automation: 'avaliacao_lembrete' | 'conversa_parada' }
export type Sender = (a: SendArgs) => Promise<{ ok: boolean; permanent?: boolean }>

export const REMINDER_DEFAULT = 'Oi! Sua opinião é muito importante para nós. Como foi o seu atendimento? É só tocar em um dos botões acima. 🙏'
export const IDLE_DEFAULT = 'Oi! Ainda precisa de ajuda? Se já resolvemos, é só avisar. Estamos por aqui. 😊'

const HOUR = 3600_000
const WINDOW_H = 23
const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const toMin = (t: string | null | undefined) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0) }
const clampHours = (v: unknown, def: number) => { const n = Number(v); return n >= 1 && n <= WINDOW_H ? Math.round(n) : def }
const autoOn = (flow: any, key: string) => flow?.automations?.[key] !== false

type Clock = { day: string; cur: number; today: number; md: number }
function clockIn(tz: string, now: Date): Clock {
  const l = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  return { day: DAY_KEYS[l.getDay()], cur: l.getHours() * 60 + l.getMinutes(), today: l.getFullYear() * 10000 + (l.getMonth() + 1) * 100 + l.getDate(), md: (l.getMonth() + 1) * 100 + l.getDate() }
}

// Mesma regra de scheduleOpen() do webhook (api/whatsapp/webhook.ts).
export async function schoolOpen(sb: Sb, flow: any, institutionId: string, now: Date): Promise<boolean> {
  const tz = flow?.timezone || 'America/Sao_Paulo'
  const c = clockIn(tz, now)
  if (autoOn(flow, 'data_especial')) {
    try {
      const { data } = await sb.from('whatsapp_special_dates').select('*').eq('institution_id', institutionId).eq('active', true)
      const ymd = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return y * 10000 + m * 100 + dd }
      const md = (d: string) => { const [, m, dd] = d.split('-').map(Number); return m * 100 + dd }
      for (const d of (data || [])) {
        const end = d.date_end || d.date_start
        let hit = false
        if (d.repeat_yearly) { const s = md(d.date_start), e = md(end); hit = s <= e ? (c.md >= s && c.md <= e) : (c.md >= s || c.md <= e) }
        else hit = c.today >= ymd(d.date_start) && c.today <= ymd(end)
        if (hit) { if (d.day_type !== 'reduced' || c.cur > toMin(d.reduced_end || '12:00')) return false; break }
      }
    } catch { /* sem a tabela, segue o horário normal */ }
  }
  if (flow?.schedule_mode === 'individual') {
    const { data } = await sb.from('users').select('active, working_days, working_hours_start, working_hours_end').eq('institution_id', institutionId)
    const staff = (data || []).filter((u: any) => u.active !== false && u.working_hours_start && u.working_hours_end && (u.working_days || []).length)
    if (staff.length) return staff.some((u: any) => (u.working_days || []).includes(c.day) && c.cur >= toMin(u.working_hours_start) && c.cur <= toMin(u.working_hours_end))
  }
  return (flow?.working_days || []).includes(c.day) && c.cur >= toMin(flow?.working_start || '08:00') && c.cur <= toMin(flow?.working_end || '18:00')
}

const phoneOf = (jid: string): string | null => {
  const s = String(jid || '')
  if (s.includes('@') && !s.endsWith('@s.whatsapp.net')) return null   // LID/grupo: não dá para mandar pelo número
  const d = s.replace(/@.*/, '').replace(/\D/g, '')
  return d.length >= 8 ? d : null
}

export type Result = { reminder: number; idle: number; skipped: string[] }

export async function runFollowups(sb: Sb, send: Sender, now: Date = new Date(), maxPerSchool = 25): Promise<Result> {
  const out: Result = { reminder: 0, idle: 0, skipped: [] }
  const { data: flowRows } = await sb.from('whatsapp_flows').select('*')
  const byInst = new Map<string, any>()
  for (const f of (flowRows || [])) {
    const cur = byInst.get(f.institution_id)
    if (!cur || String(f.updated_at || '') > String(cur.updated_at || '')) byInst.set(f.institution_id, f)
  }
  const nowIso = now.toISOString()
  const winStart = new Date(now.getTime() - WINDOW_H * HOUR).toISOString()

  for (const [institutionId, flow] of byInst) {
    const sv = (flow.survey_config && typeof flow.survey_config === 'object') ? flow.survey_config : {}
    const idle = (flow.idle_config && typeof flow.idle_config === 'object') ? flow.idle_config : {}
    const reminderOn = flow.satisfaction_survey_enabled === true && sv.reminder_enabled === true
    const idleOn = idle.enabled === true
    if (!reminderOn && !idleOn) continue
    if (!(await schoolOpen(sb, flow, institutionId, now))) { out.skipped.push(`${institutionId}:fechada`); continue }

    // ── Lembrete da avaliação ──
    if (reminderOn) {
      const hours = clampHours(sv.reminder_hours, 6)
      const text = String(sv.reminder_message || '').trim() || REMINDER_DEFAULT
      const { data: convs } = await sb.from('whatsapp_conversations')
        .select('id, remote_jid, survey_sent_at, survey_reminder_sent_at, last_customer_message_at, is_aion_inbox')
        .eq('institution_id', institutionId).not('survey_sent_at', 'is', null)
        .lte('survey_sent_at', new Date(now.getTime() - hours * HOUR).toISOString())
        .gte('survey_sent_at', new Date(now.getTime() - 48 * HOUR).toISOString())
        .is('satisfaction_score', null).limit(200)
      let n = 0
      for (const c of (convs || [])) {
        if (n >= maxPerSchool) break
        if (c.is_aion_inbox) continue
        const sentAt = Date.parse(c.survey_sent_at)
        if (c.survey_reminder_sent_at && Date.parse(c.survey_reminder_sent_at) >= sentAt) continue
        const lastC = c.last_customer_message_at ? Date.parse(c.last_customer_message_at) : 0
        if (lastC > sentAt) continue                                  // o cliente já escreveu depois da avaliação
        if (!lastC || lastC < Date.parse(winStart)) continue           // fora da janela de 24 h do WhatsApp
        const to = phoneOf(c.remote_jid); if (!to) continue
        const r = await send({ institutionId, to, remoteJid: c.remote_jid, text, automation: 'avaliacao_lembrete' })
        if (r.ok || r.permanent) await sb.from('whatsapp_conversations').update({ survey_reminder_sent_at: nowIso }).eq('id', c.id)
        if (r.ok) { n++; out.reminder++ }
      }
    }

    // ── Conversa parada ──
    if (idleOn) {
      const hours = clampHours(idle.hours, 4)
      const text = String(idle.message || '').trim() || IDLE_DEFAULT
      const cutoff = new Date(now.getTime() - hours * HOUR).toISOString()
      const { data: convs } = await sb.from('whatsapp_conversations')
        .select('id, remote_jid, bot_active, idle_notice_sent_at, last_customer_message_at, is_aion_inbox')
        .eq('institution_id', institutionId).eq('status', 'open').not('assigned_user_id', 'is', null)
        .gte('last_customer_message_at', winStart).lte('last_message_at', cutoff).limit(200)
      let n = 0
      for (const c of (convs || [])) {
        if (n >= maxPerSchool) break
        if (c.is_aion_inbox || c.bot_active === true) continue
        const { data: last } = await sb.from('whatsapp_messages').select('timestamp')
          .eq('institution_id', institutionId).eq('remote_jid', c.remote_jid).eq('from_me', true)
          .or('is_bot_message.is.null,is_bot_message.eq.false').is('automation', null)
          .order('timestamp', { ascending: false }).limit(1)
        const staffTs = last?.[0]?.timestamp ? Date.parse(last[0].timestamp) : 0
        if (!staffTs || staffTs > now.getTime() - hours * HOUR) continue          // a equipe falou há pouco
        const lastC = c.last_customer_message_at ? Date.parse(c.last_customer_message_at) : 0
        if (lastC > staffTs) continue                                              // o cliente está esperando a equipe, não o contrário
        if (c.idle_notice_sent_at && Date.parse(c.idle_notice_sent_at) >= staffTs) continue   // já avisou neste silêncio
        const to = phoneOf(c.remote_jid); if (!to) continue
        const r = await send({ institutionId, to, remoteJid: c.remote_jid, text, automation: 'conversa_parada' })
        if (r.ok || r.permanent) await sb.from('whatsapp_conversations').update({ idle_notice_sent_at: nowIso }).eq('id', c.id)
        if (r.ok) { n++; out.idle++ }
      }
    }
  }
  return out
}
