// Agenda do CRM comercial: reuniões de todos os leads em calendário (computador) e em lista por dia (celular),
// com confirmação do cliente e pendências do checklist. Abre a ficha do lead na aba Reuniões.
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Calendar as CalIcon, ChevronLeft, ChevronRight, Video, Phone, Users, MessageCircle, ExternalLink, CheckCircle2, AlertCircle, Clock, CalendarCheck, ListChecks, UserX,
} from 'lucide-react'
import SuperAdminLayout from './SuperAdminLayout'
import LeadSheet from './LeadSheet'
import PageHeader from '../ui/PageHeader'
import StatStrip from '../mobile/StatStrip'
import { useIsMobile } from '../mobile/MobileShell'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { LEADS_CSS } from '../leads/LeadsAttention'
import type { Lead } from '../shared/LeadModal'
import { MEETING_KINDS, type Meeting } from './MeetingForm'

type Row = Meeting & { crm_leads: { id: string; school_name: string; name: string; phone: string | null; email: string | null; consultant_id: string | null } | null }
type Task = { id: string; meeting_id: string; due_at: string; done_at: string | null }

const key = (d: Date) => d.toLocaleDateString('en-CA')
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const waLink = (phone: string) => { let d = String(phone || '').replace(/\D/g, ''); if (d.length === 10 || d.length === 11) d = '55' + d; return `https://wa.me/${d}` }

export default function AdminAgenda() {
  const mobile = useIsMobile()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<Row[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [consultants, setConsultants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(() => key(new Date()))
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [sheetLead, setSheetLead] = useState<Lead | null>(null)

  const load = useCallback(async () => {
    const from = new Date(Date.now() - 90 * 86400000).toISOString()
    const [m, t, c] = await Promise.all([
      supabase.from('crm_meetings').select('*, crm_leads(id, school_name, name, phone, email, consultant_id)').gte('scheduled_at', from).order('scheduled_at'),
      supabase.from('crm_meeting_tasks').select('id, meeting_id, due_at, done_at').eq('superseded', false),
      supabase.from('users').select('id, full_name, email').eq('user_type', 'consultant'),
    ])
    setRows((m.data || []) as Row[]); setTasks((t.data || []) as Task[]); setConsultants(c.data || []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const openLead = useCallback(async (leadId: string) => {
    const { data } = await supabase.from('crm_leads').select('*').eq('id', leadId).maybeSingle()
    if (data) setSheetLead(data as Lead)
  }, [])

  // vindo do aviso (?m=id da reunião): vai para o dia e abre a ficha
  useEffect(() => {
    const mid = params.get('m')
    if (!mid || !rows.length) return
    const r = rows.find(x => x.id === mid)
    if (r) { const d = new Date(r.scheduled_at); setSel(key(d)); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); if (r.crm_leads?.id) openLead(r.crm_leads.id) }
    params.delete('m'); setParams(params, { replace: true })
  }, [rows, params, setParams, openLead])

  const byDay = useMemo(() => {
    const m = new Map<string, Row[]>()
    rows.forEach(r => { const k = key(new Date(r.scheduled_at)); m.set(k, [...(m.get(k) || []), r]) })
    return m
  }, [rows])

  const today = key(new Date())
  const weekEnd = Date.now() + 7 * 86400000
  const open = rows.filter(r => r.status === 'scheduled')
  const upcoming = open.filter(r => new Date(r.scheduled_at).getTime() >= Date.now() - 3600000)
  const stats = {
    today: open.filter(r => key(new Date(r.scheduled_at)) === today).length,
    week: upcoming.filter(r => new Date(r.scheduled_at).getTime() <= weekEnd).length,
    noConf: upcoming.filter(r => new Date(r.scheduled_at).getTime() <= weekEnd && r.confirmation !== 'confirmed').length,
    todo: tasks.filter(t => !t.done_at && new Date(t.due_at) <= new Date() && open.some(r => r.id === t.meeting_id)).length,
  }

  const dayList = (byDay.get(sel) || []).slice().sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))

  const setConfirmation = async (r: Row, c: 'confirmed' | 'no_answer') => {
    await supabase.from('crm_meetings').update({ confirmation: c, confirmed_at: c === 'confirmed' ? new Date().toISOString() : null }).eq('id', r.id)
    if (c === 'confirmed') await supabase.from('crm_meeting_tasks').update({ done_at: new Date().toISOString() }).eq('meeting_id', r.id).is('done_at', null).eq('superseded', false)
    load()
  }

  const saveLead = async (form: Partial<Lead>) => {
    if (!form.id) return
    await supabase.from('crm_leads').update({ ...form, updated_at: new Date().toISOString() }).eq('id', form.id)
    setSheetLead(null); load()
  }

  // ── cartões ──
  const MeetingCard = ({ r }: { r: Row }) => {
    const Ic = r.type === 'phone' ? Phone : r.type === 'presential' ? Users : Video
    const past = new Date(r.scheduled_at).getTime() < Date.now() - 3600000
    const conf = r.confirmation === 'confirmed' ? ['Cliente confirmou', '#DCFCE7', '#15803D'] : r.confirmation === 'no_answer' ? ['Sem resposta', '#FEF3C7', '#B45309'] : r.confirmation === 'reschedule' ? ['Precisa remarcar', '#FEE2E2', '#B91C1C'] : ['Aguardando confirmação', '#F1F5F9', '#475569']
    const st = r.status === 'completed' ? ['Realizada', '#DCFCE7', '#15803D'] : r.status === 'cancelled' ? ['Cancelada', '#FEE2E2', '#B91C1C'] : null
    const pend = tasks.filter(t => t.meeting_id === r.id && !t.done_at && new Date(t.due_at) <= new Date()).length
    const kind = MEETING_KINDS.find(k => k.v === r.kind)?.l
    const lead = r.crm_leads
    const pillBtn = (bg: string, color: string): React.CSSProperties => ({ minHeight: 36, padding: '0 12px', borderRadius: 10, border: 'none', background: bg, color, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontFamily: 'inherit' })
    return (
      <div className="ld-card ld-in" style={{ background: '#fff', borderRadius: 16, border: '1px solid #fff', borderLeft: `4px solid ${st ? st[2] : pend ? '#EF4444' : BRAND.primary}`, boxShadow: '0 1px 2px rgba(26,43,74,.05), 0 6px 16px -10px rgba(26,43,74,.22)', padding: 12, opacity: past && !st ? 0.85 : 1 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 56, textAlign: 'center', background: BRAND.softer, borderRadius: 12, padding: '6px 4px' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: BRAND.primaryDark, lineHeight: 1.1 }}>{hhmm(r.scheduled_at)}</div>
            <div style={{ fontSize: 11, color: BRAND.muted }}>{r.duration_min} min</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: BRAND.ink, overflowWrap: 'anywhere' }}>{lead?.school_name || r.title}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: BRAND.muted, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}><Ic size={13} />{kind || 'Reunião'}{lead?.name ? ` · ${lead.name}` : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {st ? <span style={{ background: st[1], color: st[2], fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99 }}>{st[0]}</span>
            : <span style={{ background: conf[1], color: conf[2], fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99 }}>{conf[0]}</span>}
          {pend > 0 && !st && <span style={{ background: '#FEE2E2', color: '#B91C1C', fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertCircle size={11} />{pend} no checklist</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {r.meet_link && /^https?:/.test(r.meet_link) && r.status === 'scheduled' && <a href={r.meet_link} target="_blank" rel="noreferrer" style={pillBtn(BRAND.primary, '#fff')}><ExternalLink size={13} />Entrar no Meet</a>}
          {lead?.phone && <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" style={pillBtn('#DCFCE7', '#15803D')}><MessageCircle size={13} />WhatsApp</a>}
          {r.status === 'scheduled' && r.confirmation !== 'confirmed' && <button type="button" onClick={() => setConfirmation(r, 'confirmed')} style={pillBtn('#F0FDF4', '#15803D')}><CheckCircle2 size={13} />Confirmou</button>}
          {r.status === 'scheduled' && r.confirmation === 'pending' && <button type="button" onClick={() => setConfirmation(r, 'no_answer')} style={pillBtn('#FEF3C7', '#B45309')}><UserX size={13} />Não respondeu</button>}
          {lead && <button type="button" onClick={() => openLead(lead.id)} style={pillBtn('#F1F5F9', BRAND.ink)}>Abrir lead</button>}
        </div>
      </div>
    )
  }

  // ── calendário do mês ──
  const first = month.getDay()
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]
  while (cells.length % 7) cells.push(null)

  const calendar = (
    <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ border: `1px solid ${BRAND.line}`, background: '#fff', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={16} /></button>
        <b style={{ fontSize: 16, color: BRAND.ink }}>{MONTHS[month.getMonth()][0].toUpperCase() + MONTHS[month.getMonth()].slice(1)} de {month.getFullYear()}</b>
        <button type="button" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={{ border: `1px solid ${BRAND.line}`, background: '#fff', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
        {WEEK.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: BRAND.faint, textTransform: 'uppercase' }}>{w}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const k = key(d); const list = byDay.get(k) || []; const on = k === sel; const isToday = k === today
          const hasPending = list.some(r => r.status === 'scheduled' && r.confirmation !== 'confirmed')
          return (
            <button key={i} type="button" onClick={() => setSel(k)} style={{ minHeight: mobile ? 46 : 64, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, border: `1.5px solid ${on ? BRAND.primary : isToday ? BRAND.softLine : 'transparent'}`, background: on ? BRAND.softer : '#fff' }}>
              <span style={{ fontSize: 14, fontWeight: isToday || on ? 800 : 600, color: isToday ? BRAND.primary : BRAND.ink }}>{d.getDate()}</span>
              {list.length > 0 && <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 99, background: hasPending ? '#FEF3C7' : '#DCFCE7', color: hasPending ? '#B45309' : '#15803D' }}>{list.length}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )

  const selDate = new Date(sel + 'T12:00:00')
  const listPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <b style={{ fontSize: 15, color: BRAND.ink }}>{cap(selDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}{sel === today ? ' (hoje)' : ''}</b>
      {dayList.length === 0 && <p style={{ margin: '24px 0', textAlign: 'center', color: BRAND.faint, fontSize: 13 }}>{loading ? 'Carregando...' : 'Nenhuma reunião neste dia'}</p>}
      {dayList.map(r => <MeetingCard key={r.id} r={r} />)}
    </div>
  )

  const strip = (
    <StatStrip items={[
      { label: 'Hoje', value: stats.today, sub: stats.today ? 'reuniões para hoje' : 'nenhuma reunião hoje', color: '#6366F1', icon: CalendarCheck },
      { label: 'Esta semana', value: stats.week, sub: 'nos próximos 7 dias', color: '#00695F', icon: Clock },
      { label: 'Sem confirmação', value: stats.noConf, sub: 'cliente ainda não confirmou', color: '#B45309', icon: UserX, alert: stats.noConf > 0 },
      { label: 'Checklist', value: stats.todo, sub: 'contatos para fazer agora', color: '#B91C1C', icon: ListChecks, alert: stats.todo > 0 },
    ]} />
  )

  return (
    <SuperAdminLayout>
      <div style={{ padding: mobile ? '12px 12px 110px' : 24, display: 'flex', flexDirection: 'column', gap: 14, minHeight: '100%', background: BRAND.bg }}>
        <style>{LEADS_CSS}</style>
        <PageHeader compact={mobile} icon={CalIcon} title="Agenda" subtitle="Reuniões dos leads, com confirmação do cliente e lembretes"
          actions={<button type="button" onClick={() => navigate('/super-admin/crm')} style={{ background: '#fff', color: BRAND.primaryDark, border: 'none', padding: '9px 16px', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Agendar pelo lead</button>} />
        {strip}
        {mobile ? (<>{calendar}{listPanel}</>) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px,1fr) minmax(340px,1fr)', gap: 16, alignItems: 'start' }}>{calendar}{listPanel}</div>
        )}
      </div>
      {sheetLead && (
        <LeadSheet key={sheetLead.id} lead={sheetLead} initialTab="meetings" consultants={consultants}
          onClose={() => { setSheetLead(null); load() }} onSave={saveLead}
          onDelete={() => navigate('/super-admin/crm')} onProposal={() => navigate('/super-admin/crm')} onOnboard={() => navigate('/super-admin/crm')} />
      )}
    </SuperAdminLayout>
  )
}
