// Quadro do CRM comercial (Super Admin) no mesmo padrão dos Leads das escolas:
// faixa verde, números clicáveis, colunas coloridas, cartões com ações à vista.
// Só desenho e filtros: os dados e as ações (salvar, mover, excluir) vêm de AdminCRM.
import { useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  Plus, Search, SlidersHorizontal, Phone, MessageCircle, FileText, MapPin, Clock, AlertCircle, Video,
  Building2, Trash2, ChevronDown, TrendingUp, CalendarCheck, Hourglass, Trophy, X, Kanban, List as ListIcon, UserCog, Mail,
} from 'lucide-react'
import PageHeader from '../ui/PageHeader'
import HeaderAction from '../mobile/HeaderAction'
import { useIsMobile } from '../mobile/MobileShell'
import { BRAND } from '../../lib/brand'
import { LEADS_CSS } from '../leads/LeadsAttention'
import { CountUp } from '../leads/LeadsAttention'
import { STAGES, ORIGINS, timeAgo, type Lead, type Stage } from '../shared/LeadModal'

export interface BoardMeeting { lead_id: string; scheduled_at: string }
type Consultant = { id: string; full_name: string; email?: string }
type Quick = 'overdue' | 'meetings' | 'proposals' | 'stale' | null

const ORIGIN_LABEL: Record<string, string> = { raio_x_inep: 'Raio-X', WhatsApp: 'WhatsApp' }
const originLabel = (o?: string) => (o ? ORIGIN_LABEL[o] || o : '')
const stageName = (l: string) => l.replace(/[^\p{L}\s]/gu, '').trim()
const AVATARS = ['#0E9F8A', '#6366F1', '#D97706', '#7C3AED', '#0891B2', '#DB2777', '#16A34A', '#E11D48']
const avatarColor = (s: string) => AVATARS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARS.length]
const initialsOf = (s: string) => s.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
const fmtBRL = (n?: number) => (n ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '')
const isOpen = (l: Lead) => !['fechado', 'cliente'].includes(l.stage)
const overdue = (d?: string) => !!d && new Date(d) < new Date()
const waLink = (phone: string) => {
  let d = String(phone || '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) d = '55' + d
  return `https://wa.me/${d}`
}
const pill = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color, fontSize: 11, fontWeight: 600,
  padding: '2px 9px', borderRadius: 999, maxWidth: '100%',
})
const actBtn = (bg: string, color: string): React.CSSProperties => ({
  flex: 1, minHeight: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, border: 'none',
  borderRadius: 10, background: bg, color, fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit',
})

interface CardProps {
  lead: Lead; stage: (typeof STAGES)[number]; consultant?: Consultant; meetings: number
  onOpen: () => void; onProposal: () => void; onMove: (to: Stage) => void; onDelete: () => void; onOnboard: () => void
  overlay?: boolean; mobile?: boolean
}

function Card({ lead, stage, consultant, meetings, onOpen, onProposal, onMove, onDelete, onOnboard, overlay, mobile }: CardProps) {
  const [menu, setMenu] = useState(false)
  const late = overdue(lead.next_followup) && isOpen(lead)
  const soon = !!lead.next_followup && !late && new Date(lead.next_followup).getTime() - Date.now() < 48 * 3600000
  const name = lead.school_name || lead.name || '?'
  const bg = avatarColor(name)
  const canOnboard = (lead.stage === 'fechado' || lead.stage === 'cliente') && !lead.converted_institution_id
  return (
    <div className="ld-card ld-in" onClick={onOpen} style={{
      position: 'relative', background: '#fff', borderRadius: 16, border: '1px solid #fff', borderLeft: `4px solid ${late ? '#EF4444' : stage.color}`,
      boxShadow: overlay ? '0 18px 32px -12px rgba(26,43,74,.35)' : '0 1px 2px rgba(26,43,74,.05), 0 6px 16px -10px rgba(26,43,74,.22)',
      cursor: 'pointer', padding: 12, opacity: overlay ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 38, height: 38, borderRadius: 13, flexShrink: 0, background: `linear-gradient(135deg, ${bg}, ${bg}CC)`, color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initialsOf(name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: BRAND.ink, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</h4>
          <p style={{ margin: 0, fontSize: 12, color: BRAND.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</p>
        </div>
        {!overlay && (
          <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
            <button type="button" aria-label="Mais opções" onClick={() => setMenu(m => !m)} style={{ border: 'none', background: menu ? '#F1F5F9' : 'transparent', borderRadius: 8, padding: 5, cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><ChevronDown size={16} /></button>
            {menu && (
              <>
                <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', right: 0, top: 30, zIndex: 41, width: 180, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 12, boxShadow: '0 16px 32px -12px rgba(26,43,74,.3)', padding: '6px 0' }}>
                  <p style={{ margin: 0, padding: '4px 12px', fontSize: 10.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Mover para</p>
                  {STAGES.filter(s => s.id !== lead.stage).map(s => (
                    <button key={s.id} type="button" onClick={() => { setMenu(false); onMove(s.id) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 12px', fontSize: 13, fontWeight: 700, color: s.color, cursor: 'pointer', fontFamily: 'inherit' }}>{stageName(s.label)}</button>
                  ))}
                  <div style={{ borderTop: `1px solid ${BRAND.line}`, margin: '4px 0' }} />
                  <button type="button" onClick={() => { setMenu(false); onDelete() }} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 'none', background: 'transparent', padding: '8px 12px', fontSize: 13, fontWeight: 700, color: '#DC2626', cursor: 'pointer', fontFamily: 'inherit' }}><Trash2 size={13} />Excluir lead</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {lead.origin && <span style={pill('#F1F5F9', '#475569')}>{originLabel(lead.origin)}</span>}
        {(lead.city || lead.state) && <span style={pill('#EEF2FF', '#4338CA')}><MapPin size={10} />{[lead.city, lead.state].filter(Boolean).join('/')}</span>}
        {lead.monthly_value ? <span style={pill('#F0FDF4', '#15803D')}>{fmtBRL(lead.monthly_value)}/mês</span> : null}
        {lead.implementation_value ? <span style={pill('#FFFBEB', '#B45309')}>Implantação {fmtBRL(lead.implementation_value)}</span> : null}
        {meetings > 0 && <span style={pill('#EFF6FF', '#1D4ED8')}><Video size={10} />{meetings} reunião{meetings > 1 ? 'ões' : ''}</span>}
        {lead.has_proposal && <span style={pill('#DCFCE7', '#15803D')}><FileText size={10} />Proposta</span>}
        {lead.converted_institution_id && <span style={pill('#ECFDF5', '#047857')}><Building2 size={10} />Escola criada</span>}
      </div>

      {lead.next_followup && isOpen(lead) && (
        <div style={{ ...pill(late ? '#FEE2E2' : soon ? '#FEF3C7' : '#F1F5F9', late ? '#B91C1C' : soon ? '#B45309' : '#475569'), marginBottom: 8, borderRadius: 9, padding: '4px 9px' }}>
          {late ? <AlertCircle size={11} /> : <Clock size={11} />}
          {late ? 'Retorno vencido ' : 'Retorno '}{new Date(lead.next_followup).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, color: BRAND.faint }}>{timeAgo(lead.updated_at || lead.created_at)}</span>
        {consultant && <span title={`Consultor: ${consultant.full_name}`} style={{ ...pill('#EEF2FF', BRAND.ink), fontSize: 10.5, fontWeight: 700 }}><UserCog size={10} />{initialsOf(consultant.full_name)}</span>}
      </div>

      {!overlay && (
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          {lead.phone && <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" title="WhatsApp" style={actBtn('#DCFCE7', '#15803D')}><MessageCircle size={14} />{mobile ? 'WhatsApp' : ''}</a>}
          {lead.phone && <a href={`tel:${lead.phone.replace(/\D/g, '')}`} title="Ligar" style={actBtn('#DBEAFE', '#1D4ED8')}><Phone size={14} />{mobile ? 'Ligar' : ''}</a>}
          {lead.email && !mobile && <a href={`mailto:${lead.email}`} title="E-mail" style={actBtn('#F3E8FF', '#7C3AED')}><Mail size={14} /></a>}
          <button type="button" title="Gerar proposta" onClick={onProposal} style={actBtn('#FEF3C7', '#B45309')}><FileText size={14} />Proposta</button>
        </div>
      )}

      {!overlay && canOnboard && (
        <button type="button" onClick={e => { e.stopPropagation(); onOnboard() }} style={{ marginTop: 8, width: '100%', minHeight: 34, border: 'none', borderRadius: 10, background: 'var(--aion-grad)', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          Iniciar onboarding
        </button>
      )}
    </div>
  )
}

function DragCard(props: CardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.lead.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ opacity: isDragging ? 0.35 : 1, touchAction: 'manipulation' }}>
      <Card {...props} />
    </div>
  )
}

function Column({ stage, count, value, children, onAdd }: { stage: (typeof STAGES)[number]; count: number; value: number; children: React.ReactNode; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  return (
    <div className="ld-in" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: `${stage.color}22`, borderRadius: '18px 18px 0 0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: stage.color }} />{stageName(stage.label)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {value > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: BRAND.muted }}>{fmtBRL(value)}</span>}
          <span style={{ background: '#fff', color: BRAND.ink, fontSize: 12, fontWeight: 800, padding: '2px 10px', borderRadius: 999, minWidth: 24, textAlign: 'center' }}>{count}</span>
        </span>
      </div>
      <div ref={setNodeRef} style={{
        flex: 1, minHeight: 220, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, borderRadius: '0 0 18px 18px',
        background: isOver ? `${stage.color}26` : `${stage.color}0F`, outline: isOver ? `2px dashed ${stage.color}` : 'none', transition: 'background .15s',
      }}>
        {children}
        {count === 0 && <p style={{ margin: '28px 0', textAlign: 'center', fontSize: 12, color: BRAND.faint }}>Nenhum lead</p>}
        <button type="button" onClick={onAdd} style={{ border: `1.5px dashed ${stage.color}66`, background: 'transparent', borderRadius: 12, padding: '8px 0', fontSize: 12, fontWeight: 700, color: stage.color, cursor: 'pointer', fontFamily: 'inherit' }}>+ Adicionar</button>
      </div>
    </div>
  )
}

export default function CrmBoard({ leads, consultants, meetings, loading, onOpenLead, onNewLead, onProposal, onMove, onDelete, onOnboard }: {
  leads: Lead[]; consultants: Consultant[]; meetings: BoardMeeting[]; loading: boolean
  onOpenLead: (l: Lead) => void; onNewLead: (stage?: Stage) => void; onProposal: (l: Lead) => void
  onMove: (l: Lead, to: Stage) => void; onDelete: (id: string) => void; onOnboard: (l: Lead) => void
}) {
  const mobile = useIsMobile()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState('')
  const [quick, setQuick] = useState<Quick>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [fOrigin, setFOrigin] = useState('')
  const [fConsultant, setFConsultant] = useState('')
  const [fStage, setFStage] = useState<Stage | ''>('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const consultantById = useMemo(() => new Map(consultants.map(c => [c.id, c])), [consultants])
  const meetingsByLead = useMemo(() => {
    const m = new Map<string, number>()
    meetings.forEach(x => m.set(x.lead_id, (m.get(x.lead_id) || 0) + 1))
    return m
  }, [meetings])
  const weekMeetingLeads = useMemo(() => {
    const lim = Date.now() + 7 * 86400000
    return new Set(meetings.filter(m => { const t = new Date(m.scheduled_at).getTime(); return t >= Date.now() - 3600000 && t <= lim }).map(m => m.lead_id))
  }, [meetings])
  const origins = useMemo(() => Array.from(new Set([...ORIGINS, ...leads.map(l => l.origin).filter(Boolean)])), [leads])

  const isStale = (l: Lead) => isOpen(l) && Date.now() - new Date(l.updated_at || l.created_at).getTime() > 7 * 86400000
  const isProposalOpen = (l: Lead) => !!l.has_proposal && ['proposta', 'negociacao'].includes(l.stage)

  const counts = {
    overdue: leads.filter(l => isOpen(l) && overdue(l.next_followup)).length,
    meetings: leads.filter(l => weekMeetingLeads.has(l.id)).length,
    proposals: leads.filter(isProposalOpen).length,
    stale: leads.filter(isStale).length,
  }
  const mrr = leads.filter(l => l.stage === 'cliente' || l.stage === 'fechado').reduce((s, l) => s + (l.monthly_value || 0), 0)
  const clients = leads.filter(l => l.stage === 'cliente').length

  const filtered = leads.filter(l => {
    const q = search.trim().toLowerCase()
    if (q && ![l.school_name, l.name, l.city, l.email, l.phone].some(f => f?.toLowerCase().includes(q))) return false
    if (fOrigin && l.origin !== fOrigin) return false
    if (fConsultant && l.consultant_id !== fConsultant) return false
    if (fStage && l.stage !== fStage) return false
    if (quick === 'overdue' && !(isOpen(l) && overdue(l.next_followup))) return false
    if (quick === 'meetings' && !weekMeetingLeads.has(l.id)) return false
    if (quick === 'proposals' && !isProposalOpen(l)) return false
    if (quick === 'stale' && !isStale(l)) return false
    return true
  })
  const hasFilters = !!(fOrigin || fConsultant || fStage || quick)
  const clear = () => { setFOrigin(''); setFConsultant(''); setFStage(''); setQuick(null) }
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const lead = leads.find(l => l.id === e.active.id)
    const to = e.over?.id as Stage | undefined
    if (lead && to && to !== lead.stage && STAGES.some(s => s.id === to)) onMove(lead, to)
  }

  const cardFor = (lead: Lead) => {
    const stage = STAGES.find(s => s.id === lead.stage) || STAGES[0]
    return {
      lead, stage, consultant: lead.consultant_id ? consultantById.get(lead.consultant_id) : undefined, meetings: meetingsByLead.get(lead.id) || 0,
      onOpen: () => onOpenLead(lead), onProposal: () => onProposal(lead), onMove: (to: Stage) => onMove(lead, to),
      onDelete: () => onDelete(lead.id), onOnboard: () => onOnboard(lead), mobile,
    }
  }

  const kpis: { key: Quick; label: string; value: number; sub: string; color: string; icon: any; alert?: boolean }[] = [
    { key: 'overdue', label: 'Retorno vencido', value: counts.overdue, sub: 'leads esperando contato', color: '#B91C1C', icon: AlertCircle, alert: counts.overdue > 0 },
    { key: 'meetings', label: 'Reuniões da semana', value: counts.meetings, sub: 'nos próximos 7 dias', color: '#6366F1', icon: CalendarCheck },
    { key: 'proposals', label: 'Propostas abertas', value: counts.proposals, sub: 'em proposta ou negociação', color: '#D97706', icon: FileText },
    { key: 'stale', label: 'Parados', value: counts.stale, sub: 'sem mexer há 7 dias ou mais', color: '#5B6B86', icon: Hourglass },
  ]
  const strip = (
    <div className="aion-snap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 12 }}>
      {kpis.map((it, i) => {
        const on = quick === it.key
        const Icon = it.icon
        return (
          <button key={it.label} type="button" className={`ld-kpi ld-in ${it.alert && !on ? 'ld-alert' : ''}`} data-on={on ? '1' : '0'} onClick={() => setQuick(on ? null : it.key)} aria-pressed={on}
            style={{ animationDelay: `${i * 60}ms`, position: 'relative', overflow: 'hidden', background: on ? `${it.color}0D` : '#fff', borderRadius: 18, padding: '14px 14px 13px', border: `1.5px solid ${on ? it.color : it.alert ? '#FCA5A5' : BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: on ? `0 10px 24px -14px ${it.color}` : '0 1px 2px rgba(26,43,74,.04)' }}>
            <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: it.color, opacity: on || it.alert ? 1 : 0.55 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink }}>{it.label}</span>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: `${it.color}14`, color: it.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} /></span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: it.alert ? '#B91C1C' : BRAND.ink, lineHeight: 1, letterSpacing: '-.02em' }}>{loading ? '—' : <CountUp value={it.value} />}</div>
            <div style={{ fontSize: 11.5, color: BRAND.muted }}>{it.sub}</div>
          </button>
        )
      })}
      <div className="ld-in" style={{ position: 'relative', overflow: 'hidden', background: '#fff', borderRadius: 18, padding: '14px 14px 13px', border: `1.5px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 1px 2px rgba(26,43,74,.04)' }}>
        <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: '#00695F', opacity: 0.55 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink }}>Clientes</span>
          <span style={{ width: 30, height: 30, borderRadius: 10, background: '#00695F14', color: '#00695F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trophy size={16} /></span>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: BRAND.ink, lineHeight: 1 }}>{loading ? '—' : <CountUp value={clients} />}</div>
        <div style={{ fontSize: 11.5, color: BRAND.muted }}>{mrr > 0 ? `${fmtBRL(mrr)}/mês fechado` : `de ${leads.length} leads no total`}</div>
      </div>
    </div>
  )

  const filterPanel = showFilters && (
    <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {[
        { label: 'Origem', value: fOrigin, set: setFOrigin, opts: origins.map(o => [o, originLabel(o)]) },
        { label: 'Consultor', value: fConsultant, set: setFConsultant, opts: consultants.map(c => [c.id, c.full_name]) },
        { label: 'Etapa', value: fStage, set: (v: string) => setFStage(v as Stage | ''), opts: STAGES.map(s => [s.id, stageName(s.label)]) },
      ].map(f => (
        <label key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px', fontSize: 12, fontWeight: 700, color: BRAND.muted }}>
          {f.label}
          <select value={f.value} onChange={e => f.set(e.target.value)} style={{ height: 42, border: `1.5px solid ${BRAND.line}`, borderRadius: 12, padding: '0 10px', fontSize: 16, color: BRAND.ink, background: '#fff', fontFamily: 'inherit' }}>
            <option value="">Todos</option>
            {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      ))}
      {hasFilters && <button type="button" onClick={clear} style={{ height: 42, border: 'none', background: 'transparent', color: BRAND.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}><X size={14} />Limpar</button>}
    </div>
  )

  const searchBar = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: mobile ? 0 : 220, maxWidth: mobile ? 'none' : 420 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar escola, contato ou cidade..." autoComplete="off" autoCorrect="off" spellCheck={false}
          style={{ width: '100%', boxSizing: 'border-box', height: 44, paddingLeft: 36, paddingRight: 12, background: '#fff', border: `1.5px solid ${BRAND.line}`, borderRadius: 12, fontSize: 16, color: BRAND.ink, outline: 'none', fontFamily: 'inherit' }} />
      </div>
      {!mobile && ['Indicação', 'raio_x_inep', 'Site'].map(o => (
        <button key={o} type="button" onClick={() => setFOrigin(f => (f === o ? '' : o))} style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${fOrigin === o ? BRAND.primary : BRAND.line}`, background: fOrigin === o ? BRAND.primary : '#fff', color: fOrigin === o ? '#fff' : BRAND.muted }}>{originLabel(o)}</button>
      ))}
      {!mobile && (
        <button type="button" onClick={() => setShowFilters(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${hasFilters || showFilters ? BRAND.primary : BRAND.line}`, background: hasFilters ? BRAND.softer : '#fff', color: hasFilters || showFilters ? BRAND.primary : BRAND.muted }}>
          <SlidersHorizontal size={14} />Filtros{hasFilters && <span style={{ width: 6, height: 6, borderRadius: 99, background: BRAND.primary }} />}
        </button>
      )}
      {!mobile && hasFilters && <button type="button" onClick={clear} style={{ border: 'none', background: 'transparent', color: BRAND.faint, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Limpar</button>}
    </div>
  )

  // ── Celular: faixa com chips de etapa + lista de cartões ─────────────────
  if (mobile) {
    const list = filtered.filter(l => !fStage || l.stage === fStage)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: BRAND.bg }}>
        <style>{LEADS_CSS}</style>
        <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PageHeader compact icon={TrendingUp} title="CRM comercial" subtitle={`${filtered.length} ${filtered.length === 1 ? 'lead' : 'leads'} no funil`}
            actions={<>
              <HeaderAction primary icon={Plus} label="Novo lead" onClick={() => onNewLead()} />
              <HeaderAction icon={SlidersHorizontal} label="Filtros" dot={!!(fOrigin || fConsultant)} active={showFilters} onClick={() => setShowFilters(s => !s)} />
            </>} />
          {strip}
        </div>
        <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>{searchBar}{filterPanel}</div>
        <div className="aion-hscroll" style={{ padding: '10px 12px 0', overflowX: 'auto', display: 'flex', gap: 6, scrollbarWidth: 'none' }}>
          {[{ id: '' as const, label: 'Todos', n: filtered.length }, ...STAGES.map(s => ({ id: s.id, label: stageName(s.label), n: filtered.filter(l => l.stage === s.id).length }))].map(c => (
            <button key={c.id} type="button" onClick={() => setFStage(c.id)} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: fStage === c.id ? BRAND.primary : BRAND.softer, color: fStage === c.id ? '#fff' : BRAND.muted }}>{c.label} · {c.n}</button>
          ))}
        </div>
        <div style={{ padding: '10px 12px 110px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.length === 0 && <p style={{ textAlign: 'center', color: BRAND.faint, fontSize: 13, padding: '40px 0' }}>{loading ? 'Carregando...' : 'Nenhum lead encontrado'}</p>}
          {list.map(l => <Card key={l.id} {...cardFor(l)} />)}
        </div>
      </div>
    )
  }

  // ── Computador ───────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, minHeight: '100%', background: BRAND.bg }}>
      <style>{LEADS_CSS}</style>
      <PageHeader icon={TrendingUp} title="CRM comercial" subtitle={`${filtered.length} ${filtered.length === 1 ? 'lead' : 'leads'} no funil${hasFilters ? ' (com filtros)' : ''}`}
        actions={<>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.16)', borderRadius: 10, padding: 3 }}>
            {([['board', 'Quadro', Kanban], ['list', 'Lista', ListIcon]] as const).map(([k, l, Ic]) => (
              <button key={k} type="button" onClick={() => setView(k)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', background: view === k ? '#fff' : 'transparent', color: view === k ? BRAND.primaryDark : '#fff' }}><Ic size={14} />{l}</button>
            ))}
          </div>
          <button type="button" onClick={() => onNewLead()} style={{ background: '#fff', color: BRAND.primaryDark, border: 'none', padding: '9px 16px', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}><Plus size={16} />Novo lead</button>
        </>} />
      {strip}
      {searchBar}
      {filterPanel}

      {view === 'board' ? (
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 16, minWidth: 'max-content' }}>
              {STAGES.map(stage => {
                const col = filtered.filter(l => l.stage === stage.id)
                return (
                  <Column key={stage.id} stage={stage} count={col.length} value={col.reduce((s, l) => s + (l.monthly_value || 0), 0)} onAdd={() => onNewLead(stage.id)}>
                    {col.map(l => <DragCard key={l.id} {...cardFor(l)} />)}
                  </Column>
                )
              })}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>{activeLead ? <div style={{ width: 260, transform: 'rotate(1deg)' }}><Card {...cardFor(activeLead)} overlay /></div> : null}</DragOverlay>
        </DndContext>
      ) : (
        <div className="ld-in" style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 14, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
            <thead><tr style={{ background: '#F8FAFC', color: BRAND.muted, textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase' }}>
              {['Escola', 'Contato', 'Cidade', 'Etapa', 'Origem', 'Valores', 'Retorno', ''].map(h => <th key={h} style={{ padding: '9px 12px', fontWeight: 700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 28, textAlign: 'center', color: BRAND.faint }}>Nenhum lead encontrado</td></tr>}
              {filtered.map(l => {
                const st = STAGES.find(s => s.id === l.stage) || STAGES[0]
                const late = isOpen(l) && overdue(l.next_followup)
                return (
                  <tr key={l.id} className="ld-row" onClick={() => onOpenLead(l)} style={{ borderTop: '1px solid #EEF2F1', cursor: 'pointer' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: BRAND.ink }}>{l.school_name}</td>
                    <td style={{ padding: '9px 12px', color: BRAND.text }}>{l.name}<div style={{ fontSize: 12, color: BRAND.muted }}>{l.phone}</div></td>
                    <td style={{ padding: '9px 12px', color: BRAND.text }}>{[l.city, l.state].filter(Boolean).join('/')}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: `${st.color}22`, color: st.color }}>{stageName(st.label)}</span></td>
                    <td style={{ padding: '9px 12px', color: BRAND.text }}>{originLabel(l.origin) || '—'}</td>
                    <td style={{ padding: '9px 12px', color: BRAND.text }}>{l.monthly_value ? `${fmtBRL(l.monthly_value)}/mês` : '—'}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: late ? '#B91C1C' : BRAND.muted, whiteSpace: 'nowrap' }}>{l.next_followup ? new Date(l.next_followup).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      {l.phone && <a href={waLink(l.phone)} target="_blank" rel="noreferrer" title="WhatsApp" style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 8, padding: '5px 8px', display: 'inline-flex' }}><MessageCircle size={14} /></a>}{' '}
                      <button type="button" title="Gerar proposta" onClick={() => onProposal(l)} style={{ border: 'none', background: '#FEF3C7', color: '#B45309', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><FileText size={14} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
