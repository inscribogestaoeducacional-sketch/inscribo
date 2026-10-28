// Painel da direita do WhatsApp (Detalhes · Família · Linha do tempo), no
// desenho do AION Business com as cores do Edu: cartões brancos, cabeçalho em
// degradê, ações em botões grandes. Não busca nada sozinho no Detalhes: o Hub
// passa os dados e as funções (a lógica de atendimento continua toda no Hub).
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Info, Users, User, Clock, Download, ChevronLeft, Pencil, Check, Calendar, Phone, CalendarClock, BookUser, BadgeCheck,
  MessageCircle, Hourglass, Bot, CheckCircle2, LogOut, ExternalLink, Link2, StickyNote, Send, Edit, Trash2, X, Tag as TagIc, Loader2, Target, GraduationCap, Megaphone, Mail,
} from 'lucide-react'
import { BRAND, GRAD } from '../../lib/brand'
import { supabase } from '../../lib/supabase'
import { normalizeBrazilianInput } from '../../lib/phone'
import LeadSequenceCard from './LeadSequenceCard'
import SchoolRelationCard from '../shared/SchoolRelationCard'

export type PanelTab = 'details' | 'family' | 'history'
type ConvStatus = 'waiting' | 'open' | 'closed'

export interface PanelConv {
  id: string; name: string; phone: string; isGroup: boolean
  profile_picture_url?: string | null; contact_type?: string | null; tags?: string[]
  status: ConvStatus; assigned_user_id?: string | null; assigned_user_name?: string | null
  bot_active?: boolean; lead_id?: string | null; last_customer_message_at?: string | null
}
export interface PanelStage { key: string; label: string; accent: string }
export interface PanelNote { id: string; content: string; author_id: string; author_name: string; created_at: string }
export interface PanelScheduled { id: string; scheduled_for: string; status: string; content?: string | null; label: string; error_message?: string | null }

export interface ContactPanelProps {
  conv: PanelConv
  tab: PanelTab; onTab: (t: PanelTab) => void
  isMobile: boolean; onBack: () => void
  onExport: () => void
  institutionId: string
  currentUserId?: string
  // cabeçalho / contato
  onRename: (name: string) => Promise<boolean>
  onType: (type: string) => void
  tags: { id: string; name: string; color: string }[]
  onAddTag: (t: string) => void; onRemoveTag: (t: string) => void
  // ações rápidas
  canSchedule: boolean
  onScheduleVisit: () => void
  onScheduleMsg: () => void
  onOpenTemplate: () => void
  onFicha: () => void
  // atendimento
  onStatus: (s: ConvStatus) => void
  users: { id: string; full_name: string }[]
  transferring: boolean; setTransferring: (v: boolean) => void
  transferTarget: string; setTransferTarget: (v: string) => void
  onTransfer: () => void
  onBotToggle: () => void
  onConclude: (withSurvey: boolean) => void; onLeave: () => void
  // pesquisa de satisfação: escola usa? janela de 24h do cliente aberta?
  surveyEnabled?: boolean; surveyWindowOpen?: boolean
  // funil
  lead: any | null
  leadInfo: string
  stages: PanelStage[]
  onStage: (k: string) => void
  onEditLead: () => void; onOpenLead: () => void
  onCreateLead: () => void
  linkingLead: boolean; setLinkingLead: (v: boolean) => void
  leadSearch: string; onSearchLeads: (q: string) => void
  leadResults: { id: string; responsible_name?: string | null; student_name?: string | null; phone?: string | null }[]
  onLinkLead: (id: string) => void
  visitsSlot: ReactNode
  summarySlot?: ReactNode
  // notas
  notes: PanelNote[]; notesLoading: boolean; canNote: boolean
  newNote: string; setNewNote: (v: string) => void; savingNote: boolean; onAddNote: () => void
  editingNoteId: string | null; editingNoteText: string; setEditingNoteText: (v: string) => void
  onStartEditNote: (n: PanelNote) => void; onSaveEditNote: () => void; onCancelEditNote: () => void; savingEditNote: boolean
  onDeleteNote: (id: string) => void
  // agendadas
  scheduled: PanelScheduled[]; onCancelScheduled: (id: string) => void
  // abas
  timelineSlot: ReactNode
  familyLoader?: () => Promise<FamilyData>
  // Super Admin (inbox da Áion): mesmo desenho, sem o que é só de escola
  variant?: 'school' | 'aion'
  leadStageKey?: string; leadTitle?: string
  extraActions?: { key: string; label: string; icon: ReactNode; onClick: () => void }[]
}

export interface FamilyData {
  contact: { name: string | null; email: string | null; student: string | null; grade: string | null; relation: string | null; created_at: string | null; last_seen_at: string | null } | null
  origin: { campaign: string | null; at: string | null } | null
  lead: { status: string; created_at: string; source: string | null; grade_interest: string | null } | null
  visits: { id: string; at: string; status: string }[]
  conversations: number
}

const ini = (n: string) => (n || '?').split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()
const card: CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14, boxShadow: '0 1px 2px rgba(26,43,74,.04)', flexShrink: 0 }
const REL: Record<string, string> = { aluno: 'Aluno', pre_matriculado: 'Pré-matriculado', ex_aluno: 'Ex-aluno', transferido: 'Transferido' }
const VIS: Record<string, [string, string, string]> = {
  scheduled: ['Marcada', '#B45309', '#FFFBEB'], confirmed: ['Confirmada', '#00695F', '#F0FDFB'], completed: ['Realizada', '#15803D', '#F0FDF4'],
  cancelled: ['Cancelada', '#64748B', '#F1F5F9'], no_show: ['Faltou', '#B91C1C', '#FEF2F2'],
}
const chip = (on: boolean, color: string = BRAND.primary): CSSProperties => ({ border: `1.5px solid ${on ? color : BRAND.line}`, background: on ? `${color}14` : '#fff', color: on ? color : '#334155', borderRadius: 999, padding: '6px 11px', fontSize: 12.5, fontWeight: 700, cursor: on ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })

function Head({ icon, title, extra }: { icon: ReactNode; title: string; extra?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ width: 28, height: 28, borderRadius: 9, background: BRAND.softer, color: BRAND.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <b style={{ flex: 1, fontSize: 13.5, color: BRAND.ink }}>{title}</b>
      {extra}
    </div>
  )
}

export default function ContactPanel(p: ContactPanelProps) {
  const { conv } = p
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const isGroup = conv.isGroup
  const aion = p.variant === 'aion'

  const tabs: { key: PanelTab; label: string; icon: ReactNode }[] = [
    { key: 'details', label: 'Detalhes', icon: <Info size={14} /> },
    ...(isGroup || aion ? [] : [{ key: 'family' as PanelTab, label: 'Família', icon: <Users size={14} /> }]),
    ...(aion && !p.timelineSlot ? [] : [{ key: 'history' as PanelTab, label: 'Linha do tempo', icon: <Clock size={14} /> }]),
  ]

  return (
    <div style={p.isMobile
      ? { position: 'fixed', inset: 0, zIndex: 70, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
      : { width: 330, flexShrink: 0, background: '#fff', borderLeft: `1px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {p.isMobile && (
        <button onClick={p.onBack} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 52, padding: '0 12px', border: 'none', borderBottom: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.ink, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <ChevronLeft style={{ width: 22, height: 22 }} /> Voltar à conversa
        </button>
      )}
      <div style={{ flexShrink: 0, display: 'flex', background: '#fff', borderBottom: `1px solid ${BRAND.line}`, alignItems: 'center' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => p.onTab(t.key)} style={{
            flex: '1 1 auto', padding: '12px 4px', fontSize: 12, whiteSpace: 'nowrap', fontWeight: p.tab === t.key ? 700 : 500, fontFamily: 'inherit',
            color: p.tab === t.key ? BRAND.ink : '#64748B', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: p.tab === t.key ? `2px solid ${BRAND.primary}` : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .15s',
          }}>{t.icon}{t.label}</button>
        ))}
        <button onClick={p.onExport} title="Exportar conversa" aria-label="Exportar conversa" style={{ padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', flexShrink: 0 }}><Download size={14} /></button>
      </div>

      {p.tab === 'details' && <Details {...p} editing={editing} setEditing={setEditing} nameDraft={nameDraft} setNameDraft={setNameDraft} addingTag={addingTag} setAddingTag={setAddingTag} />}
      {p.tab === 'family' && !isGroup && (
        <div className="wa-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 12, background: BRAND.bg }}>
          <FamilyTab {...p} />
        </div>
      )}
      {p.tab === 'history' && (
        <div className="wa-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 12, background: BRAND.bg }}>{p.timelineSlot}</div>
      )}
    </div>
  )
}

function Details(p: ContactPanelProps & { editing: boolean; setEditing: (v: boolean) => void; nameDraft: string; setNameDraft: (v: string) => void; addingTag: boolean; setAddingTag: (v: boolean) => void }) {
  const { conv, lead } = p
  const isGroup = conv.isGroup
  const aion = p.variant === 'aion'
  const winMs = conv.last_customer_message_at ? Date.now() - new Date(conv.last_customer_message_at).getTime() : Infinity
  const winOpen = winMs < 24 * 3600000
  const winLeft = Math.max(0, 24 - winMs / 3600000)
  const digits = (conv.phone || '').replace(/\D/g, '')
  const actions: { key: string; label: string; icon: ReactNode; onClick?: () => void; href?: string; tone?: 'warn' }[] = []
  if (!isGroup && p.canSchedule && !aion) actions.push({ key: 'ag', label: 'Agendar visita', icon: <Calendar size={18} />, onClick: p.onScheduleVisit })
  if (!isGroup && digits.length >= 10) actions.push({ key: 'tel', label: 'Ligar', icon: <Phone size={18} />, href: `tel:+${digits.startsWith('55') ? digits : '55' + digits}` })
  if (!isGroup) actions.push({ key: 'msg', label: 'Agendar msg', icon: <CalendarClock size={18} />, onClick: p.onScheduleMsg })
  if (!isGroup && !winOpen) actions.push({ key: 'tpl', label: 'Modelo', icon: <BadgeCheck size={18} />, onClick: p.onOpenTemplate, tone: 'warn' })
  if (!isGroup) actions.push({ key: 'ficha', label: 'Ficha', icon: <BookUser size={18} />, onClick: p.onFicha })
  ;(p.extraActions || []).forEach(a => actions.push({ ...a }))
  const typeOpts: [string, string, string][] = [['lead', aion ? 'Lead' : 'Nova família', '#00695F'], ['client', 'Cliente', '#047857'], ['supplier', 'Fornecedor', '#7C3AED'], ['other', 'Outro', '#64748B']]
  const stageOn = (k: string) => (p.leadStageKey ?? lead?.status) === k

  const saveName = async () => { if (await p.onRename(p.nameDraft)) p.setEditing(false) }

  return (
    <div className="wa-scrollbar" style={{ flex: 1, overflowY: 'auto', background: BRAND.bg, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="ld-in" style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ background: GRAD, padding: '16px 14px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800, color: '#fff', background: conv.profile_picture_url ? '#fff' : 'rgba(255,255,255,.18)', border: '2px solid rgba(255,255,255,.6)' }}>
            {conv.profile_picture_url ? <img src={conv.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : isGroup ? <Users size={22} /> : ini(conv.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
            {p.editing ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input autoFocus value={p.nameDraft} maxLength={80} onChange={e => p.setNameDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') p.setEditing(false) }}
                  style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, padding: '6px 9px', borderRadius: 9, border: 'none', outline: 'none', color: BRAND.ink }} />
                <button aria-label="Salvar nome" onClick={saveName} style={{ border: 'none', borderRadius: 9, background: '#fff', color: BRAND.primaryDark, width: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={16} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.name}</span>
                {!isGroup && <button aria-label="Renomear" title="Renomear" onClick={() => { p.setNameDraft(conv.name); p.setEditing(true) }}
                  style={{ border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', borderRadius: 8, width: 26, height: 26, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={13} /></button>}
              </div>
            )}
            <div style={{ fontSize: 12.5, opacity: .88, marginTop: 2 }}>{isGroup ? 'Grupo do WhatsApp' : conv.phone}</div>
          </div>
        </div>
        {!isGroup && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>Quem é</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {typeOpts.map(([k, l, c]) => <button key={k} type="button" onClick={() => (conv.contact_type || '') !== k && p.onType(k)} style={chip((conv.contact_type || '') === k, c)}>{l}</button>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><TagIc size={12} /> Etiquetas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {(conv.tags || []).map(tag => {
                  const color = p.tags.find(t => t.name === tag)?.color || '#6366f1'
                  return (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, padding: '4px 9px', borderRadius: 999, fontWeight: 700, color: '#fff', background: color }}>
                      {tag}<button aria-label={`Tirar ${tag}`} onClick={() => p.onRemoveTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.85)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                    </span>
                  )
                })}
                {p.tags.length > 0 ? (p.addingTag ? (
                  <select autoFocus defaultValue="" onChange={e => { if (e.target.value) p.onAddTag(e.target.value); p.setAddingTag(false) }} onBlur={() => p.setAddingTag(false)}
                    style={{ fontSize: 12.5, padding: '5px 9px', borderRadius: 999, border: `1.5px dashed ${BRAND.primary}`, background: '#fff', color: BRAND.ink, outline: 'none' }}>
                    <option value="">Escolher etiqueta…</option>
                    {p.tags.filter(t => !(conv.tags || []).includes(t.name)).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                ) : (
                  <button onClick={() => p.setAddingTag(true)} style={{ fontSize: 12.5, padding: '5px 11px', borderRadius: 999, border: `1.5px dashed ${BRAND.primary}`, color: BRAND.primaryDark, background: '#fff', cursor: 'pointer', fontWeight: 700 }}>+ Etiqueta</button>
                )) : (conv.tags || []).length === 0 && <span style={{ fontSize: 12, color: '#94A3B8' }}>Nenhuma etiqueta criada ainda.</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {actions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, flexShrink: 0 }}>
          {actions.map((a, i) => {
            const st: CSSProperties = { animationDelay: `${i * 40}ms`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '11px 4px', borderRadius: 14, border: `1px solid ${a.tone === 'warn' ? '#FECACA' : BRAND.line}`, background: a.tone === 'warn' ? '#FEF2F2' : '#fff', color: a.tone === 'warn' ? '#B91C1C' : BRAND.primaryDark, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(26,43,74,.04)', textAlign: 'center' }
            return a.href
              ? <a key={a.key} className="ld-kpi ld-in" href={a.href} style={st}>{a.icon}{a.label}</a>
              : <button key={a.key} className="ld-kpi ld-in" type="button" onClick={a.onClick} style={st}>{a.icon}{a.label}</button>
          })}
        </div>
      )}

      <div className="ld-in" style={card}>
        <Head icon={<MessageCircle size={15} />} title="Atendimento" />
        {!isGroup && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: winOpen ? '#15803D' : '#B91C1C', marginBottom: 5 }}>
              <Hourglass size={13} /> {winOpen ? `Janela de 24h aberta · fecha em ${Math.floor(Math.round(winLeft * 60) / 60)}h${String(Math.round(winLeft * 60) % 60).padStart(2, '0')}` : 'Janela de 24h fechada · use um modelo'}
            </div>
            <div style={{ height: 6, borderRadius: 6, background: '#F1F5F9', overflow: 'hidden' }}>
              <div style={{ width: `${winOpen ? Math.max(3, (winLeft / 24) * 100) : 100}%`, height: '100%', background: winOpen ? `linear-gradient(90deg, #22C55E, ${BRAND.primary})` : '#FCA5A5', transition: 'width .6s ease' }} />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, background: '#F1F6F5', borderRadius: 12, padding: 4, marginBottom: 12 }}>
          {([['waiting', 'Aguardando'], ['open', 'Atendendo'], ['closed', 'Concluído']] as [ConvStatus, string][]).map(([k, l]) => {
            const on = conv.status === k
            return <button key={k} type="button" onClick={() => !on && p.onStatus(k)} style={{ flex: 1, border: 'none', borderRadius: 9, padding: '8px 4px', fontSize: 12.5, fontWeight: 700, cursor: on ? 'default' : 'pointer', background: on ? '#fff' : 'transparent', color: on ? (k === 'closed' ? '#15803D' : k === 'waiting' ? '#B45309' : BRAND.primaryDark) : '#64748B', boxShadow: on ? '0 1px 3px rgba(26,43,74,.1)' : 'none', fontFamily: 'inherit', transition: 'all .15s' }}>{l}</button>
          })}
        </div>
        {p.transferring ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
            <select value={p.transferTarget} onChange={e => p.setTransferTarget(e.target.value)} style={{ width: '100%', padding: '9px 10px', fontSize: 13, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 10, color: BRAND.ink, outline: 'none' }}>
              <option value="">Passar para…</option>
              {p.users.filter(u => u.id !== conv.assigned_user_id).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={p.onTransfer} disabled={!p.transferTarget} style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 700, color: '#fff', background: GRAD, border: 'none', borderRadius: 10, cursor: 'pointer', opacity: p.transferTarget ? 1 : .4, fontFamily: 'inherit' }}>{conv.status === 'closed' ? 'Atribuir' : 'Transferir'}</button>
              <button onClick={() => { p.setTransferring(false); p.setTransferTarget('') }} style={{ padding: '8px 12px', fontSize: 13, color: '#64748B', border: `1px solid ${BRAND.line}`, borderRadius: 10, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => p.setTransferring(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: `1px solid ${BRAND.line}`, borderRadius: 12, background: '#fff', cursor: 'pointer', marginBottom: 10, textAlign: 'left', fontFamily: 'inherit' }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: conv.assigned_user_id ? GRAD : '#F1F5F9', color: conv.assigned_user_id ? '#fff' : '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
              {conv.assigned_user_id ? ini(conv.assigned_user_name || '') : <User size={14} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>Quem atende</span>
              <span style={{ display: 'block', fontSize: 13.5, color: BRAND.ink, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.assigned_user_name || 'Ninguém ainda'}</span>
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.primaryDark }}>{conv.assigned_user_id ? 'Trocar' : 'Atribuir'}</span>
          </button>
        )}
        <button type="button" onClick={p.onBotToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: `1px solid ${conv.bot_active ? BRAND.softLine : BRAND.line}`, borderRadius: 12, background: conv.bot_active ? BRAND.softer : '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
          <span style={{ width: 30, height: 30, borderRadius: 10, background: conv.bot_active ? BRAND.primary : '#F1F5F9', color: conv.bot_active ? '#fff' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={15} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>Robô {conv.bot_active ? 'ligado' : 'desligado'}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: '#64748B' }}>{conv.bot_active ? 'O robô responde esta conversa' : conv.assigned_user_id ? 'Uma pessoa está atendendo' : 'Ligue para o robô responder'}</span>
          </span>
          <span style={{ width: 38, height: 22, borderRadius: 999, background: conv.bot_active ? BRAND.primary : '#CBD5E1', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
            <span style={{ position: 'absolute', top: 3, left: conv.bot_active ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
          </span>
        </button>
        {conv.status !== 'closed' && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.surveyEnabled && (
              <button onClick={() => p.onConclude(true)} disabled={!p.surveyWindowOpen}
                title={p.surveyWindowOpen ? 'Conclui e manda a pesquisa de satisfação ao cliente' : 'A janela de 24h do cliente fechou: não dá para enviar a pesquisa'}
                style={{ width: '100%', padding: '11px 0', fontSize: 13, fontWeight: 800, color: '#fff', background: p.surveyWindowOpen ? GRAD : '#CBD5E1', border: 'none', borderRadius: 12, cursor: p.surveyWindowOpen ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}><CheckCircle2 size={15} /> Concluir e enviar pesquisa</button>
            )}
            {p.surveyEnabled && !p.surveyWindowOpen && <span style={{ fontSize: 11.5, color: '#64748B', textAlign: 'center' }}>Janela de 24h fechada: não dá para enviar a pesquisa.</span>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => p.onConclude(false)} title="Conclui sem enviar nada. Se o cliente escrever depois, o robô inicia" style={p.surveyEnabled
                ? { flex: 2, padding: '10px 0', fontSize: 13, fontWeight: 800, color: BRAND.primary, background: '#fff', border: `1.5px solid ${BRAND.primary}`, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }
                : { flex: 2, padding: '10px 0', fontSize: 13, fontWeight: 800, color: '#fff', background: GRAD, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}><CheckCircle2 size={15} /> {p.surveyEnabled ? 'Somente concluir' : 'Concluir'}</button>
              {conv.assigned_user_id && <button onClick={p.onLeave} title="Sair do atendimento: a conversa volta para a fila" style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, color: '#92400E', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}><LogOut size={14} /> Sair</button>}
            </div>
          </div>
        )}
      </div>

      {!isGroup && p.summarySlot}

      {!isGroup && !aion && <SchoolRelationCard institutionId={p.institutionId} phone={conv.phone} />}

      {!isGroup && (
        <div className="ld-in" style={card}>
          <Head icon={<Target size={15} />} title={aion ? 'Lead no CRM' : 'No funil'} extra={conv.lead_id && lead ? <button onClick={p.onOpenLead} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: BRAND.primaryDark, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Ver lead <ExternalLink size={12} /></button> : undefined} />
          {conv.lead_id ? (lead ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>{p.leadTitle || lead.responsible_name || '—'}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{p.leadInfo}</div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>Etapa</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.stages.map(s => <button key={s.key} type="button" onClick={() => !stageOn(s.key) && p.onStage(s.key)} style={chip(stageOn(s.key), s.accent)}>{s.label}</button>)}
                </div>
              </div>
              <button onClick={p.onEditLead} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${BRAND.line}`, background: '#fff', borderRadius: 10, padding: '7px 11px', fontSize: 12.5, fontWeight: 700, color: '#334155', cursor: 'pointer', fontFamily: 'inherit' }}><Pencil size={13} /> Editar lead</button>
              {!aion && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>Visitas</div>
                  {p.visitsSlot}
                </div>
              )}
            </div>
          ) : <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}><Loader2 size={18} className="animate-spin" color={BRAND.primary} /></div>)
            : p.linkingLead ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <input autoFocus value={p.leadSearch} onChange={e => p.onSearchLeads(e.target.value)} placeholder="Buscar lead pelo nome ou telefone"
                  style={{ width: '100%', padding: '9px 10px', fontSize: 13, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 10, color: BRAND.ink, outline: 'none', boxSizing: 'border-box' }} />
                {p.leadResults.map(l => (
                  <button key={l.id} onClick={() => p.onLinkLead(l.id)} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12.5, background: BRAND.bg, border: `1px solid ${BRAND.line}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <b style={{ color: BRAND.ink }}>{l.responsible_name || l.student_name}</b><div style={{ color: '#64748B' }}>{[l.student_name, l.phone].filter(Boolean).join(' · ')}</div>
                  </button>
                ))}
                <button onClick={() => { p.setLinkingLead(false); p.onSearchLeads('') }} style={{ fontSize: 12.5, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start', fontFamily: 'inherit' }}>Cancelar</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12.5, color: '#64748B' }}>{aion ? 'Esta conversa ainda não é um lead do CRM.' : 'Esta conversa ainda não está no funil de matrículas.'}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={p.onCreateLead} style={{ flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 800, color: '#fff', background: GRAD, border: 'none', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit' }}>+ Criar lead</button>
                  <button onClick={() => p.setLinkingLead(true)} style={{ flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700, color: BRAND.primaryDark, background: '#fff', border: `1px solid ${BRAND.softLine}`, borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}><Link2 size={14} /> Ligar a um lead</button>
                </div>
              </div>
            )}
        </div>
      )}

      {!isGroup && !aion && conv.lead_id && lead && <LeadSequenceCard institutionId={p.institutionId} leadId={conv.lead_id} phone={conv.phone} leadStatus={lead.status} userId={p.currentUserId} />}

      {!(aion && !p.canNote) && <div className="ld-in" style={card}>
        <Head icon={<StickyNote size={15} />} title="Anotações da equipe" extra={p.notes.length ? <span style={{ fontSize: 12, fontWeight: 800, color: BRAND.primaryDark, background: BRAND.softer, borderRadius: 999, padding: '1px 8px' }}>{p.notes.length}</span> : undefined} />
        {p.canNote && (
          <div style={{ display: 'flex', gap: 6, marginBottom: p.notes.length ? 10 : 0 }}>
            <textarea value={p.newNote} onChange={e => p.setNewNote(e.target.value)} placeholder={aion ? 'Escreva algo sobre este lead — só a equipe vê' : 'Escreva algo sobre esta família — só a equipe vê'} rows={2}
              style={{ flex: 1, padding: '8px 10px', fontSize: 13, background: BRAND.bg, border: `1px solid ${BRAND.line}`, borderRadius: 10, color: BRAND.ink, outline: 'none', resize: 'vertical', fontFamily: 'inherit', minWidth: 0 }} />
            <button onClick={p.onAddNote} disabled={!p.newNote.trim() || p.savingNote} aria-label="Salvar anotação"
              style={{ alignSelf: 'stretch', width: 40, border: 'none', borderRadius: 10, background: GRAD, color: '#fff', cursor: 'pointer', opacity: !p.newNote.trim() || p.savingNote ? .45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={15} /></button>
          </div>
        )}
        {p.notesLoading ? <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Carregando…</div> : p.notes.map(n => {
          const own = !!p.currentUserId && n.author_id === p.currentUserId
          return p.editingNoteId === n.id ? (
            <div key={n.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <textarea value={p.editingNoteText} onChange={e => p.setEditingNoteText(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${BRAND.softLine}`, borderRadius: 10, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={p.onSaveEditNote} disabled={p.savingEditNote || !p.editingNoteText.trim()} style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: BRAND.primary, border: 'none', borderRadius: 9, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>{p.savingEditNote ? 'Salvando…' : 'Salvar'}</button>
                <button onClick={p.onCancelEditNote} style={{ fontSize: 12.5, color: '#64748B', background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 9, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div key={n.id} style={{ borderLeft: `3px solid ${BRAND.primary}`, background: BRAND.softer, borderRadius: '0 10px 10px 0', padding: '8px 10px', marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <p style={{ flex: 1, margin: 0, fontSize: 13, color: BRAND.ink, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{n.content}</p>
                {own && <>
                  <button aria-label="Editar" onClick={() => p.onStartEditNote(n)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}><Edit size={12} /></button>
                  <button aria-label="Apagar" onClick={() => p.onDeleteNote(n.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}><Trash2 size={12} /></button>
                </>}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{n.author_name} · {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          )
        })}
      </div>}

      {!isGroup && (
        <div className="ld-in" style={card}>
          <Head icon={<CalendarClock size={15} />} title="Mensagens agendadas" extra={<button onClick={p.onScheduleMsg} style={{ border: 'none', background: BRAND.softer, color: BRAND.primaryDark, borderRadius: 999, padding: '4px 10px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+ Agendar</button>} />
          {p.scheduled.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#94A3B8' }}>{aion ? 'Nada agendado. Use para lembrar o contato de um retorno ou de uma reunião.' : 'Nada agendado. Use para lembrar a família de um retorno, uma visita ou um prazo.'}</div>
          ) : p.scheduled.map(m => {
            const tone = m.status === 'sent' ? ['#15803D', '#F0FDF4', 'Enviada'] : m.status === 'failed' ? ['#B91C1C', '#FEF2F2', 'Falhou'] : ['#00695F', '#F0FDFB', 'Agendada']
            const d = new Date(m.scheduled_for)
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderTop: '1px solid #F1F5F9' }}>
                <span style={{ width: 34, flexShrink: 0, textAlign: 'center', borderRadius: 9, background: BRAND.bg, padding: '4px 0', lineHeight: 1.1 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: BRAND.ink }}>{d.getDate()}</span>
                  <span style={{ display: 'block', fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.content?.trim() || m.label}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                    <Clock size={11} /> {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    <span style={{ fontWeight: 800, color: tone[0], background: tone[1], borderRadius: 999, padding: '0 7px' }}>{tone[2]}</span>
                  </div>
                  {m.status === 'failed' && m.error_message && <div style={{ fontSize: 11.5, color: '#B91C1C', marginTop: 3 }}>{m.error_message}</div>}
                </div>
                {m.status === 'pending' && <button onClick={() => p.onCancelScheduled(m.id)} aria-label="Cancelar agendamento" title="Cancelar" style={{ border: 'none', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, width: 26, height: 26, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ───────────── Aba "Família": o que a escola sabe sobre este contato ───────────── */
function FamilyTab(p: ContactPanelProps) {
  const [data, setData] = useState<FamilyData | null>(null)
  const [err, setErr] = useState('')
  const phone = p.conv.phone
  const leadId = p.conv.lead_id
  useEffect(() => {
    let alive = true
    setData(null); setErr('')
    const run = async (): Promise<FamilyData> => {
      if (p.familyLoader) return p.familyLoader()
      const norm = normalizeBrazilianInput((phone || '').replace(/@.*/, ''))
      const { data: c } = await supabase.from('whatsapp_contacts')
        .select('name, email, linked_student_name, student_grade, school_relation, created_at, last_seen_at, origin_capture_trigger_id, origin_captured_at')
        .eq('institution_id', p.institutionId).eq('phone', norm).maybeSingle()
      let campaign: string | null = null
      if (c?.origin_capture_trigger_id) {
        const { data: t } = await supabase.from('capture_triggers').select('name').eq('id', c.origin_capture_trigger_id).maybeSingle()
        campaign = (t as any)?.name ?? null
      }
      const [lead, visits, convs] = await Promise.all([
        leadId ? supabase.from('leads').select('status, created_at, source, grade_interest').eq('id', leadId).maybeSingle() : Promise.resolve({ data: null }),
        leadId ? supabase.from('visits').select('id, scheduled_date, status').eq('lead_id', leadId).order('scheduled_date', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
        supabase.from('whatsapp_conversation_events').select('id', { count: 'exact', head: true }).eq('institution_id', p.institutionId).eq('remote_jid', p.conv.id.split('@')[0]).eq('event_type', 'assignment'),
      ])
      return {
        contact: c ? { name: c.name, email: c.email, student: c.linked_student_name, grade: c.student_grade, relation: c.school_relation, created_at: c.created_at, last_seen_at: c.last_seen_at } : null,
        origin: c?.origin_capture_trigger_id ? { campaign, at: c.origin_captured_at } : null,
        lead: (lead as any).data ?? null,
        visits: (((visits as any).data || []) as any[]).map(v => ({ id: v.id, at: v.scheduled_date, status: v.status })),
        conversations: (convs as any).count ?? 0,
      }
    }
    run().then(d => alive && setData(d)).catch(e => alive && setErr(e?.message || 'Não consegui carregar.'))
    return () => { alive = false }
  }, [phone, leadId, p.institutionId, p.familyLoader])

  if (err) return <div style={{ fontSize: 13, color: '#B91C1C' }}>{err}</div>
  if (!data) return <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Loader2 className="animate-spin" color={BRAND.primary} /></div>

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
  const upcoming = data.visits.filter(v => ['scheduled', 'confirmed'].includes(v.status) && new Date(v.at) >= new Date()).sort((a, b) => a.at.localeCompare(b.at))[0]
  const done = data.visits.filter(v => v.status === 'completed').length
  const days = data.contact?.created_at ? Math.max(0, Math.floor((Date.now() - new Date(data.contact.created_at).getTime()) / 86400000)) : null
  const stat = (label: string, value: string) => (
    <div className="ld-in" style={{ flex: 1, minWidth: 0, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
  const row = (label: string, value: ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderTop: '1px solid #F1F5F9', fontSize: 13 }}>
      <span style={{ color: '#64748B' }}>{label}</span><span style={{ color: BRAND.ink, fontWeight: 600, textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12.5, color: '#5B6B86' }}>Tudo o que a escola já sabe sobre <b style={{ color: BRAND.ink }}>{p.conv.name.split(' ')[0]}</b>: família, aluno, origem e visitas.</div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {stat('Há quantos dias', days == null ? '—' : String(days))}
        {stat('Visitas feitas', String(done))}
        {stat('Atendimentos', String(data.conversations))}
      </div>
      {upcoming && (
        <div className="ld-in" style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ background: GRAD, color: '#fff', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={20} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, opacity: .85, fontWeight: 600 }}>Próxima visita</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{new Date(upcoming.at).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>
      )}
      <div className="ld-in" style={card}>
        <Head icon={<GraduationCap size={15} />} title="Família e aluno" />
        {data.contact ? <>
          {row('Responsável', data.contact.name || p.conv.name)}
          {row('Aluno', data.contact.student || '—')}
          {row('Série', data.contact.grade || data.lead?.grade_interest || '—')}
          {row('Relação com a escola', data.contact.relation ? (REL[data.contact.relation] || data.contact.relation) : 'Sem relação')}
          {row('E-mail', data.contact.email ? <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Mail size={12} />{data.contact.email}</span> : '—')}
          {row('Contato desde', fmt(data.contact.created_at))}
          {row('Última mensagem', fmt(data.contact.last_seen_at))}
        </> : <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Este número ainda não está nos Contatos.</div>}
      </div>
      <div className="ld-in" style={card}>
        <Head icon={<Megaphone size={15} />} title="De onde veio" />
        {data.origin ? <>
          {row('Campanha', data.origin.campaign || 'Captação')}
          {row('Chegou em', fmt(data.origin.at))}
        </> : <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Sem origem de captação registrada.</div>}
        {data.lead && <>
          {row('Origem do lead', data.lead.source || '—')}
          {row('Lead criado em', fmt(data.lead.created_at))}
        </>}
      </div>
      <div className="ld-in" style={card}>
        <Head icon={<Calendar size={15} />} title="Visitas" />
        {data.visits.length === 0 ? <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Nenhuma visita marcada ainda.</div> : data.visits.map(v => {
          const s = VIS[v.status] || [v.status, '#64748B', '#F1F5F9']
          return (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #F1F5F9' }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: BRAND.ink }}>{new Date(v.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: s[1], background: s[2], borderRadius: 999, padding: '2px 8px' }}>{s[0]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
