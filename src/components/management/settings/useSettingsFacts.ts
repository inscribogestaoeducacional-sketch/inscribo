import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { SettingsGroupId } from '../../../lib/settingsMap'

// ETAPA 3B — "Valendo agora" das telas de grupo. SÓ LEITURA (select); nada
// aqui grava. Se a leitura falhar (RLS, coluna), o item fica sem a linha.

export type Tone = 'ok' | 'warn' | 'off'
export interface Fact { text: string; tone?: Tone }
export type Facts = Record<string, Fact>

const DAY: Record<string, string> = { MON: 'Seg', TUE: 'Ter', WED: 'Qua', THU: 'Qui', FRI: 'Sex', SAT: 'Sáb', SUN: 'Dom' }
const ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const hhmm = (t: unknown) => (typeof t === 'string' ? t.slice(0, 5) : '')

export function formatDays(days: unknown): string {
  const list = (Array.isArray(days) ? days : []).filter((d): d is string => ORDER.includes(d)).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
  if (!list.length) return 'nenhum dia'
  const idx = list.map(d => ORDER.indexOf(d))
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  return contiguous && list.length > 2 ? `${DAY[list[0]]} a ${DAY[list[list.length - 1]]}` : list.map(d => DAY[d]).join(', ')
}

async function count(table: string, institutionId: string): Promise<number | null> {
  const { count: n, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('institution_id', institutionId)
  return error ? null : n ?? 0
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

async function whatsappFacts(inst: string): Promise<Facts> {
  const f: Facts = {}
  const [flowRes, instRes, healthRes, phoneRes, qr, grp, tags, bl] = await Promise.all([
    supabase.from('whatsapp_flows').select('working_days,working_start,working_end,stale_conversation_hours,satisfaction_survey_enabled,bot_enabled,bot_timeout_minutes,timeout_minutes,bot_timeout_message,timeout_message,outside_hours_message,lunch_message').eq('institution_id', inst).maybeSingle(),
    supabase.from('institutions').select('show_agent_name_in_messages').eq('id', inst).maybeSingle(),
    supabase.from('whatsapp_phone_health').select('status,down_since,checked_at').eq('institution_id', inst).order('checked_at', { ascending: false }).limit(1),
    supabase.from('whatsapp_phone_numbers').select('phone_number,display_name').eq('institution_id', inst).eq('is_active', true).limit(1),
    count('whatsapp_quick_replies', inst), count('whatsapp_groups', inst), count('whatsapp_tags', inst), count('whatsapp_blacklist', inst),
  ])
  const phone = phoneRes.data?.[0] as { phone_number?: string; display_name?: string } | undefined
  const health = healthRes.data?.[0] as { status?: string; down_since?: string | null } | undefined
  if (!phone) f['wa-conexao'] = { text: 'Nenhum número conectado', tone: 'off' }
  else if (health?.down_since) f['wa-conexao'] = { text: `Fora do ar desde ${new Date(health.down_since).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${phone.phone_number ?? ''}`, tone: 'off' }
  else f['wa-conexao'] = { text: `${health?.status === 'CONNECTED' ? 'Conectado' : 'Número salvo'} · ${phone.display_name || phone.phone_number || ''}`, tone: health?.status === 'CONNECTED' ? 'ok' : undefined }

  const fl = flowRes.data as Record<string, unknown> | null
  if (fl) {
    f['wa-horario'] = { text: `${formatDays(fl.working_days)}, das ${hhmm(fl.working_start)} às ${hhmm(fl.working_end)}` }
    if (fl.stale_conversation_hours) f['wa-parada'] = { text: `Parada depois de ${fl.stale_conversation_hours} h sem resposta` }
    f['wa-avaliacao'] = fl.satisfaction_survey_enabled ? { text: 'Ligada', tone: 'ok' } : { text: 'Desligada', tone: 'off' }
    f['robo-editor'] = fl.bot_enabled ? { text: 'Robô ligado', tone: 'ok' } : { text: 'Robô desligado', tone: 'off' }
    // mesma regra do banco (process_bot_timeouts): COALESCE(bot_timeout_*, timeout_*)
    const min = (fl.bot_timeout_minutes as number | null) || (fl.timeout_minutes as number | null)
    if (min) f['robo-inatividade'] = { text: `Passa adiante após ${min} min (${fl.bot_timeout_minutes ? 'tempo do robô' : 'tempo da Equipe'})${fl.bot_timeout_message || fl.timeout_message ? ', com mensagem' : ', sem mensagem'}` }
    if (fl.bot_timeout_minutes) f['robo-inatividade-equipe'] = { text: 'Não está valendo: o tempo do robô vence', tone: 'warn' }
    f['robo-fora-horario'] = fl.outside_hours_message ? { text: 'Mensagem definida', tone: 'ok' } : { text: 'Sem mensagem', tone: 'warn' }
    f['robo-almoco'] = fl.lunch_message ? { text: 'Mensagem definida', tone: 'ok' } : { text: 'Sem mensagem', tone: 'warn' }
  }
  const inst0 = instRes.data as { show_agent_name_in_messages?: boolean } | null
  if (inst0) f['wa-nome-atendente'] = inst0.show_agent_name_in_messages ? { text: 'Ligado', tone: 'ok' } : { text: 'Desligado', tone: 'off' }
  if (qr !== null) f['wa-respostas'] = { text: plural(qr, 'resposta pronta', 'respostas prontas') }
  if (grp !== null) f['wa-grupos'] = { text: plural(grp, 'grupo', 'grupos') }
  if (tags !== null) f['wa-etiquetas'] = { text: plural(tags, 'etiqueta', 'etiquetas') }
  if (bl !== null) f['bloq-numeros'] = { text: plural(bl, 'número bloqueado', 'números bloqueados') }
  return f
}

async function escolaFacts(inst: string): Promise<Facts> {
  const f: Facts = {}
  const [instRes, series] = await Promise.all([
    supabase.from('institutions').select('name,city,state,cnpj,logo_url,primary_color').eq('id', inst).maybeSingle(),
    supabase.from('school_grade_levels').select('name').eq('institution_id', inst).order('sort_order'),
  ])
  const i = instRes.data as { name?: string; city?: string; state?: string; cnpj?: string; logo_url?: string; primary_color?: string } | null
  if (i) {
    f['escola-dados'] = { text: `${i.name ?? ''}${i.cnpj ? ' · CNPJ preenchido' : ' · sem CNPJ'}`, tone: i.cnpj ? undefined : 'warn' }
    f['escola-cidade'] = i.city ? { text: `${i.city}${i.state ? ` / ${i.state}` : ''}` } : { text: 'Não preenchida', tone: 'warn' }
    f['escola-logo'] = { text: `${i.logo_url ? 'Logo enviada' : 'Sem logo'}${i.primary_color ? ` · cor ${i.primary_color}` : ''}`, tone: i.logo_url ? 'ok' : 'warn' }
  }
  if (!series.error) {
    const names = (series.data ?? []).map((s: { name: string }) => s.name)
    f['escola-series'] = names.length
      ? { text: `${plural(names.length, 'série', 'séries')}: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}` }
      : { text: 'Nenhuma série cadastrada', tone: 'warn' }
  }
  return f
}

async function equipeFacts(inst: string): Promise<Facts> {
  const f: Facts = {}
  const { data, error } = await supabase.from('users').select('role,active,working_hours_start,can_see_all_conversations').eq('institution_id', inst)
  if (error || !data) return f
  const rows = data as { role: string; active: boolean | null; working_hours_start: string | null; can_see_all_conversations: boolean | null }[]
  const active = rows.filter(r => r.active !== false)
  const by = (r: string) => active.filter(u => u.role === r).length
  f['equipe-usuarios'] = { text: `${plural(active.length, 'pessoa ativa', 'pessoas ativas')}: ${by('admin')} admin, ${by('manager')} gestor, ${by('user')} atendente${by('user') === 1 ? '' : 's'}` }
  const att = active.filter(u => u.role === 'user')
  f['equipe-conversas'] = { text: `${att.filter(u => u.can_see_all_conversations).length} de ${att.length} atendentes veem todas as conversas` }
  f['equipe-horarios'] = { text: `${active.filter(u => u.working_hours_start).length} de ${active.length} com horário próprio` }
  return f
}

const LOADERS: Partial<Record<SettingsGroupId, (inst: string) => Promise<Facts>>> = {
  whatsapp: whatsappFacts,
  robo: whatsappFacts,
  bloqueios: whatsappFacts,
  escola: escolaFacts,
  equipe: equipeFacts,
}

export function useSettingsFacts(institutionId: string | null | undefined, group: SettingsGroupId): Facts {
  const [facts, setFacts] = useState<Facts>({})
  useEffect(() => {
    const load = LOADERS[group]
    setFacts({})
    if (!institutionId || !load) return
    let alive = true
    load(institutionId).then(f => { if (alive) setFacts(f) }).catch(() => {})
    return () => { alive = false }
  }, [institutionId, group])
  return facts
}
