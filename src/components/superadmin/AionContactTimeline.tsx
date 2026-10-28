// Aba "Linha do tempo" do painel do contato no WhatsApp da Áion: tudo o que aconteceu com o lead
// do CRM (etapas, e-mails automáticos, propostas, reuniões e contatos registrados), separado por dia.
import { useEffect, useState } from 'react'
import { ArrowRight, Calendar, Clock, Edit2, FileText, Loader2, Mail, MessageCircle, Phone, Plus, StickyNote, Trash2, Video } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { STAGES } from '../shared/LeadModal'

type Item = { id: string; at: string; text: string; sub?: string; icon: any; color: string }
const stageLabel = (id?: string) => (STAGES.find(s => s.id === id)?.label || id || '').replace(/[^\p{L}\s]/gu, '').trim()
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const PROP: Record<string, string> = { draft: 'Rascunho', sent: 'Enviada', viewed: 'Aberta', accepted: 'Aceita', rejected: 'Recusada', expired: 'Vencida' }
const FIELD: Record<string, string> = {
  name: 'Contato', school_name: 'Escola', phone: 'Telefone', email: 'E-mail', city: 'Cidade', state: 'UF', origin: 'Origem',
  monthly_value: 'Mensalidade', implementation_value: 'Implantação', consultant_id: 'Consultor', next_followup: 'Próximo retorno', notes: 'Observações',
}
const INT: Record<string, { l: string; icon: any; color: string }> = {
  call: { l: 'Ligação', icon: Phone, color: '#3B82F6' }, whatsapp: { l: 'WhatsApp', icon: MessageCircle, color: '#10B981' },
  email: { l: 'E-mail', icon: Mail, color: '#8B5CF6' }, meeting: { l: 'Reunião', icon: Calendar, color: '#F59E0B' }, note: { l: 'Anotação', icon: StickyNote, color: '#6B7280' },
}
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
const dayLabel = (key: string) => {
  const today = dayKey(new Date().toISOString()); const y = dayKey(new Date(Date.now() - 86400000).toISOString())
  if (key === today) return 'Hoje'
  if (key === y) return 'Ontem'
  return new Date(key + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' }).replace('.', '')
}

function describe(e: any): { text: string; icon: any; color: string } {
  const d = e.detail || {}
  switch (e.event) {
    case 'created': return { text: `Lead criado${d.origin ? ` (origem: ${d.origin})` : ''}`, icon: Plus, color: '#16A34A' }
    case 'stage': return { text: `Etapa: ${stageLabel(d.from)} → ${stageLabel(d.to)}`, icon: ArrowRight, color: '#6366F1' }
    case 'edited': {
      const ch = d.changes || {}
      const parts = Object.keys(ch).map(k => `${FIELD[k] || k} alterado`)
      return { text: parts.join(' · ') || 'Dados editados', icon: Edit2, color: '#0891B2' }
    }
    case 'meeting_created': return { text: `Reunião agendada: ${d.title}${d.scheduled_at ? ` (${when(d.scheduled_at)})` : ''}`, icon: Video, color: '#2563EB' }
    case 'meeting_deleted': return { text: `Reunião excluída: ${d.title}`, icon: Trash2, color: '#DC2626' }
    case 'meeting_status': return { text: `Reunião "${d.title}": ${d.to === 'completed' ? 'realizada' : d.to === 'cancelled' ? 'cancelada' : 'agendada'}`, icon: Video, color: '#2563EB' }
    case 'meeting_rescheduled': return { text: `Reunião "${d.title}" remarcada${d.to ? ` para ${when(d.to)}` : ''}`, icon: Calendar, color: '#2563EB' }
    case 'email_flow': return { text: `E-mail automático enviado: ${d.label || d.flow}`, icon: Mail, color: '#8B5CF6' }
    case 'proposal_created': return { text: 'Proposta criada', icon: FileText, color: '#D97706' }
    case 'proposal_status': return { text: `Proposta: ${PROP[d.from] || d.from} → ${PROP[d.to] || d.to}`, icon: FileText, color: '#D97706' }
    default: return { text: e.event, icon: Clock, color: '#64748B' }
  }
}

export default function AionContactTimeline({ leadId, reloadKey }: { leadId: string; reloadKey?: number }) {
  const [items, setItems] = useState<Item[] | null>(null)
  useEffect(() => {
    let alive = true
    setItems(null)
    ;(async () => {
      const [ev, ints] = await Promise.all([
        supabase.from('crm_lead_events').select('id,event,detail,actor_name,created_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(80),
        supabase.from('crm_interactions').select('id,type,content,created_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(80),
      ])
      const out: Item[] = [
        ...((ev.data || []) as any[]).map(e => { const d = describe(e); return { id: 'e' + e.id, at: e.created_at, text: d.text, sub: e.actor_name || undefined, icon: d.icon, color: d.color } }),
        ...((ints.data || []) as any[]).map(i => { const t = INT[i.type] || INT.note; return { id: 'i' + i.id, at: i.created_at, text: `${t.l}: ${i.content}`, icon: t.icon, color: t.color } }),
      ].sort((a, b) => +new Date(b.at) - +new Date(a.at))
      if (alive) setItems(out)
    })()
    return () => { alive = false }
  }, [leadId, reloadKey])

  if (!items) return <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Loader2 className="animate-spin" color={BRAND.primary} /></div>
  if (items.length === 0) return <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 24 }}>Nada registrado ainda para este lead.</div>
  const groups: { key: string; rows: Item[] }[] = []
  for (const it of items) { const k = dayKey(it.at); const g = groups[groups.length - 1]; if (g && g.key === k) g.rows.push(it); else groups.push({ key: k, rows: [it] }) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groups.map(g => (
        <div key={g.key}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748B', textTransform: 'capitalize', marginBottom: 8 }}>{dayLabel(g.key)}</div>
          <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: '6px 12px' }}>
            {g.rows.map((r, i) => {
              const Ic = r.icon
              return (
                <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderTop: i ? '1px solid #F1F5F9' : 'none' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 99, background: `${r.color}18`, color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic size={14} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: BRAND.ink, fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{r.text}</div>
                    <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{new Date(r.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' })}{r.sub ? ` · ${r.sub}` : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
