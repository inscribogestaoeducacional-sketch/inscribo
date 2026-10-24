// Aba "Linha do tempo" do WhatsApp: tudo o que aconteceu com esta família, em
// ordem e separado por dia — atendimento (fila, assumir, transferir, robô,
// concluir), funil (lead criado, mudanças de etapa), visitas e mensagens agendadas.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Loader2, Inbox, UserCheck, ArrowRightLeft, CheckCircle2, RotateCcw, UserPlus, TrendingUp, Calendar, CalendarClock, Megaphone, MessageCircle, Tag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

type Kind = 'atendimento' | 'funil'
interface Item { id: string; at: string; kind: Kind; title: string; sub?: string | null; icon: ReactNode; color: string }
export interface TimelineEvent { id: string; event_type: string; description: string | null; user_name?: string | null; created_at: string }

const STAGE: Record<string, string> = { new: 'Novo', contact: 'Em contato', scheduled: 'Visita agendada', visit: 'Visitou', proposal: 'Proposta', enrolled: 'Matriculado', lost: 'Perdido' }

const evMeta = (type: string, desc: string): { icon: ReactNode; color: string } => {
  const d = desc.toLowerCase()
  if (type === 'transfer') return { icon: <ArrowRightLeft size={14} />, color: '#7C3AED' }
  if (type === 'assignment' || /assum/.test(d)) return { icon: <UserCheck size={14} />, color: '#2563EB' }
  if (type === 'reopened') return { icon: <RotateCcw size={14} />, color: '#B45309' }
  if (type === 'broadcast_reply') return { icon: <Megaphone size={14} />, color: '#DB2777' }
  if (type === 'contact_identified') return { icon: <Tag size={14} />, color: '#00695F' }
  if (/conclu|encerr|fechad/.test(d)) return { icon: <CheckCircle2 size={14} />, color: '#15803D' }
  if (/fila|aguard/.test(d)) return { icon: <Inbox size={14} />, color: '#B45309' }
  if (/rob[oô]/.test(d)) return { icon: <MessageCircle size={14} />, color: BRAND.primary }
  return { icon: <MessageCircle size={14} />, color: '#64748B' }
}
const VISIT_TXT: Record<string, string> = { scheduled: 'Visita marcada', confirmed: 'Visita confirmada', completed: 'Visita realizada', cancelled: 'Visita cancelada', no_show: 'Faltou à visita' }
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
const dayLabel = (key: string) => {
  const t = new Date(); const tk = t.toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
  const y = new Date(t.getTime() - 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
  if (key === tk) return 'Hoje'
  if (key === y) return 'Ontem'
  return new Date(key + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' }).replace('.', '')
}
const hour = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' })

export default function ConversationTimeline({ institutionId, remoteJid, leadId, events, extraLoader }: {
  institutionId: string; remoteJid: string; leadId: string | null; events: TimelineEvent[]
  /** Só para testes de tela: troca a busca no banco por dados prontos. */
  extraLoader?: () => Promise<Item[]>
}) {
  const [extra, setExtra] = useState<Item[] | null>(null)
  const [filter, setFilter] = useState<'tudo' | Kind>('tudo')
  useEffect(() => {
    let alive = true
    setExtra(null)
    ;(async () => {
      if (extraLoader) { const r = await extraLoader(); if (alive) setExtra(r); return }
      const out: Item[] = []
      const [lead, hist, visits, sched] = await Promise.all([
        leadId ? supabase.from('leads').select('created_at, responsible_name, student_name, source').eq('id', leadId).maybeSingle() : Promise.resolve({ data: null }),
        leadId ? supabase.from('lead_status_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
        leadId ? supabase.from('visits').select('id, scheduled_date, status, created_at').eq('lead_id', leadId).order('scheduled_date', { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
        supabase.from('whatsapp_scheduled_messages').select('id, status, sent_at, scheduled_for, template_name')
          .eq('institution_id', institutionId).eq('remote_jid', remoteJid).in('status', ['sent', 'failed']).order('scheduled_for', { ascending: false }).limit(30),
      ])
      const l = (lead as any).data
      if (l) out.push({ id: 'lead', at: l.created_at, kind: 'funil', title: 'Entrou no funil como lead', sub: [l.student_name && `Aluno: ${l.student_name}`, l.source && `Origem: ${l.source}`].filter(Boolean).join(' · ') || null, icon: <UserPlus size={14} />, color: '#00695F' })
      for (const h of ((hist as any).data || []) as any[]) {
        const to = h.to_status ?? h.new_status ?? h.status
        if (!to) continue
        out.push({ id: 'h' + (h.id ?? h.created_at), at: h.created_at ?? h.changed_at, kind: 'funil', title: `Etapa: ${STAGE[to] || to}`, sub: h.user_name || h.changed_by_name || null, icon: <TrendingUp size={14} />, color: '#7C3AED' })
      }
      for (const v of ((visits as any).data || []) as any[]) {
        const when = new Date(v.scheduled_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        out.push({ id: 'v' + v.id, at: v.status === 'scheduled' || v.status === 'confirmed' ? (v.created_at || v.scheduled_date) : v.scheduled_date, kind: 'funil', title: VISIT_TXT[v.status] || 'Visita', sub: `Para ${when}`, icon: <Calendar size={14} />, color: '#F59E0B' })
      }
      for (const m of ((sched as any).data || []) as any[]) out.push({ id: 's' + m.id, at: m.sent_at || m.scheduled_for, kind: 'atendimento', title: m.status === 'sent' ? 'Mensagem agendada enviada' : 'Mensagem agendada falhou', sub: (m.template_name || '').slice(0, 60) || null, icon: <CalendarClock size={14} />, color: m.status === 'sent' ? '#15803D' : '#B91C1C' })
      if (alive) setExtra(out)
    })().catch(() => alive && setExtra([]))
    return () => { alive = false }
  }, [institutionId, remoteJid, leadId, extraLoader])

  const items = useMemo(() => {
    const ev: Item[] = events.map(e => { const m = evMeta(e.event_type, e.description || ''); return { id: 'e' + e.id, at: e.created_at, kind: 'atendimento' as Kind, title: e.description || e.event_type, sub: e.user_name || null, ...m } })
    return [...ev, ...(extra || [])].filter(i => !!i.at && (filter === 'tudo' || i.kind === filter)).sort((a, b) => String(b.at).localeCompare(String(a.at)))
  }, [events, extra, filter])
  const groups = useMemo(() => {
    const g: { key: string; list: Item[] }[] = []
    for (const i of items) { const k = dayKey(i.at); const last = g[g.length - 1]; if (last && last.key === k) last.list.push(i); else g.push({ key: k, list: [i] }) }
    return g
  }, [items])

  const tab = (on: boolean): React.CSSProperties => ({ flex: 1, border: 'none', borderRadius: 9, padding: '7px 4px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? BRAND.primaryDark : '#64748B', boxShadow: on ? '0 1px 3px rgba(26,43,74,.1)' : 'none', fontFamily: 'inherit' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12.5, color: '#5B6B86' }}>O que aconteceu com esta família, do mais novo para o mais antigo.</div>
      <div style={{ display: 'flex', gap: 4, background: '#EAF1F0', borderRadius: 12, padding: 4, flexShrink: 0 }}>
        <button style={tab(filter === 'tudo')} onClick={() => setFilter('tudo')}>Tudo</button>
        <button style={tab(filter === 'atendimento')} onClick={() => setFilter('atendimento')}>Atendimento</button>
        <button style={tab(filter === 'funil')} onClick={() => setFilter('funil')}>Funil e visitas</button>
      </div>
      {extra === null ? <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Loader2 className="animate-spin" color={BRAND.primary} /></div>
        : !groups.length ? <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>Nada registrado ainda.</div>
        : groups.map(g => (
          <div key={g.key} className="ld-in" style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: '12px 14px', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.ink, textTransform: 'capitalize', marginBottom: 6 }}>{dayLabel(g.key)}</div>
            {g.list.map((i, n) => (
              <div key={i.id} style={{ display: 'flex', gap: 10, position: 'relative', paddingBottom: n === g.list.length - 1 ? 0 : 12 }}>
                {n < g.list.length - 1 && <span style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, background: '#EAF1F0' }} />}
                <span style={{ width: 28, height: 28, borderRadius: 9, background: `${i.color}16`, color: i.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>{i.icon}</span>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.ink, lineHeight: 1.35 }}>{i.title}</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 1 }}>{hour(i.at)}{i.sub ? ` · ${i.sub}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  )
}
export type { Item as TimelineItem }
