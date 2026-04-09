// src/components/superadmin/AdminCRM.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { useNavigate } from 'react-router-dom'
import {
  Plus, X, Search, Filter, Phone, Mail, MapPin, User,
  Calendar, Clock, ChevronRight, AlertCircle, CheckCircle2,
  MessageCircle, Edit2, Trash2, Building2, DollarSign,
  ArrowRight, Tag, RefreshCw, Eye, Star, TrendingUp,
  Bell, ChevronDown, ExternalLink, StickyNote, Send
} from 'lucide-react'

// ─── tipos ────────────────────────────────────────────────────────────────
type Stage = 'interesse' | 'qualificacao' | 'proposta' | 'negociacao' | 'fechado' | 'cliente'
type Lead = {
  id: string
  name: string
  school_name: string
  city: string
  state: string
  phone: string
  email: string
  stage: Stage
  origin: string
  monthly_value?: number
  implementation_value?: number
  consultant_id?: string
  notes?: string
  next_followup?: string
  created_at: string
  updated_at: string
  interactions?: Interaction[]
}
type Interaction = {
  id: string
  lead_id: string
  type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'note'
  content: string
  created_at: string
  created_by?: string
}

// ─── helpers ──────────────────────────────────────────────────────────────
const STAGES: { id: Stage; label: string; color: string; bg: string; border: string }[] = [
  { id: 'interesse',    label: 'Interesse',    color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
  { id: 'qualificacao', label: 'Qualificação', color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  { id: 'proposta',     label: 'Proposta',     color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'negociacao',   label: 'Negociação',   color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { id: 'fechado',      label: 'Fechado ✓',   color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { id: 'cliente',      label: 'Cliente 🏫',  color: '#00523C', bg: '#ECFDF5', border: '#6EE7B7' },
]

const ORIGINS = ['Indicação', 'Google', 'Instagram', 'Facebook', 'Evento', 'LinkedIn', 'Site', 'Outro']
const INTERACTION_TYPES: { v: Interaction['type']; l: string; icon: any; color: string }[] = [
  { v: 'call',     l: 'Ligação',  icon: Phone,          color: '#3B82F6' },
  { v: 'whatsapp', l: 'WhatsApp', icon: MessageCircle,  color: '#10B981' },
  { v: 'email',    l: 'E-mail',   icon: Mail,           color: '#8B5CF6' },
  { v: 'meeting',  l: 'Reunião',  icon: Calendar,       color: '#F59E0B' },
  { v: 'note',     l: 'Nota',     icon: StickyNote,     color: '#6B7280' },
]

const inp  = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl  = 'block text-xs font-semibold text-gray-600 mb-1.5'

function fmtBRL(n?: number) {
  if (!n) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  return `${days}d atrás`
}

function isOverdue(dateStr?: string) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function isDueSoon(dateStr?: string) {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - Date.now()
  return diff > 0 && diff < 48 * 60 * 60 * 1000
}

// ─── Lead Card ────────────────────────────────────────────────────────────
function LeadCard({
  lead, stage, consultants,
  onClick, onMoveStage, onDelete,
}: {
  lead: Lead; stage: typeof STAGES[0]; consultants: any[]
  onClick: () => void; onMoveStage: (to: Stage) => void; onDelete: () => void
}) {
  const [menu, setMenu] = useState(false)
  const overdue  = isOverdue(lead.next_followup)
  const dueSoon  = isDueSoon(lead.next_followup)
  const consultant = consultants.find(c => c.id === lead.consultant_id)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 cursor-pointer hover:shadow-md transition-all hover:border-gray-200 group"
      onClick={onClick}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-tight truncate">{lead.school_name}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{lead.name}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="p-1 hover:bg-gray-100 rounded">
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {menu && (
              <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-40 py-1">
                {STAGES.filter(s => s.id !== lead.stage).map(s => (
                  <button key={s.id} onClick={() => { onMoveStage(s.id); setMenu(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-medium"
                    style={{ color: s.color }}>
                    → {s.label}
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { onDelete(); setMenu(false) }} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 font-medium flex items-center gap-1.5">
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Location */}
      {(lead.city || lead.state) && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {[lead.city, lead.state].filter(Boolean).join('/')}
        </div>
      )}

      {/* Value */}
      {lead.monthly_value && (
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-2">
          <DollarSign className="w-3 h-3 text-green-500" />
          {fmtBRL(lead.monthly_value)}/mês
        </div>
      )}

      {/* Origin badge */}
      {lead.origin && (
        <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2"
          style={{ background: stage.bg, color: stage.color, border: `1px solid ${stage.border}` }}>
          {lead.origin}
        </span>
      )}

      {/* Follow-up */}
      {lead.next_followup && (
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mt-1 font-medium
          ${overdue ? 'bg-red-50 text-red-600' : dueSoon ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-500'}`}>
          {overdue ? <AlertCircle className="w-3 h-3 flex-shrink-0" /> : <Clock className="w-3 h-3 flex-shrink-0" />}
          {overdue ? 'Follow-up vencido: ' : dueSoon ? 'Vence em breve: ' : ''}
          {new Date(lead.next_followup).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Bottom */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-400">{timeAgo(lead.updated_at || lead.created_at)}</span>
        {consultant && (
          <span className="text-xs text-gray-400 truncate max-w-[100px]">{consultant.full_name.split(' ')[0]}</span>
        )}
      </div>

      {/* Cliente CTA */}
      {lead.stage === 'fechado' && (
        <div className="mt-2 w-full py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-lg text-center"
          onClick={e => { e.stopPropagation(); onClick() }}>
          🏫 Iniciar onboarding →
        </div>
      )}
    </div>
  )
}

// ─── Lead Modal ───────────────────────────────────────────────────────────
function LeadModal({
  lead: initialLead,
  consultants,
  onClose,
  onSave,
  onStartOnboarding,
}: {
  lead: Lead | null
  consultants: any[]
  onClose: () => void
  onSave: (lead: Partial<Lead>) => Promise<void>
  onStartOnboarding: (lead: Lead) => void
}) {
  const isNew = !initialLead?.id
  const [form, setForm] = useState<Partial<Lead>>(initialLead || {
    stage: 'interesse', origin: 'Indicação',
  })
  const [interactions, setInteractions] = useState<Interaction[]>(initialLead?.interactions || [])
  const [newInteraction, setNewInteraction] = useState({ type: 'note' as Interaction['type'], content: '' })
  const [saving, setSaving] = useState(false)
  const [addingInteraction, setAddingInteraction] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info')

  const set = (k: keyof Lead, v: any) => setForm(f => ({ ...f, [k]: v }))

  const loadInteractions = async () => {
    if (!initialLead?.id) return
    const { data } = await supabase.from('crm_interactions')
      .select('*').eq('lead_id', initialLead.id).order('created_at', { ascending: false })
    setInteractions(data || [])
  }

  useEffect(() => { loadInteractions() }, [initialLead?.id])

  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const handleAddInteraction = async () => {
    if (!initialLead?.id || !newInteraction.content.trim()) return
    setAddingInteraction(true)
    await supabase.from('crm_interactions').insert({
      lead_id: initialLead.id,
      type: newInteraction.type,
      content: newInteraction.content.trim(),
    })
    setNewInteraction(n => ({ ...n, content: '' }))
    await loadInteractions()
    setAddingInteraction(false)
  }

  const stage = STAGES.find(s => s.id === form.stage) || STAGES[0]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[94vh]">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: stage.color, background: stage.bg, border: `1px solid ${stage.border}` }}>
                {stage.label}
              </span>
              {form.origin && <span className="text-xs text-gray-400">{form.origin}</span>}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Novo lead' : (form.school_name || 'Lead')}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        {!isNew && (
          <div className="flex border-b border-gray-100 px-6">
            {[
              { id: 'info' as const, label: 'Dados' },
              { id: 'history' as const, label: `Histórico (${interactions.length})` },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors
                  ${activeTab === tab.id ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Tab: Dados ── */}
          {(isNew || activeTab === 'info') && (
            <div className="space-y-4">

              {/* Estágio */}
              <div>
                <label className={lbl}>Estágio no funil</label>
                <div className="grid grid-cols-3 gap-2">
                  {STAGES.map(s => (
                    <button key={s.id} onClick={() => set('stage', s.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all
                        ${form.stage === s.id ? 'border-current' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'}`}
                      style={form.stage === s.id ? { color: s.color, background: s.bg, borderColor: s.border } : {}}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Nome da escola *</label>
                  <input className={inp} placeholder="Colégio..." value={form.school_name || ''} onChange={e => set('school_name', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Nome do contato *</label>
                  <input className={inp} placeholder="Nome do diretor..." value={form.name || ''} onChange={e => set('name', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={lbl}>Cidade</label>
                  <input className={inp} placeholder="João Pessoa" value={form.city || ''} onChange={e => set('city', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>UF</label>
                  <input className={inp} placeholder="PB" maxLength={2} value={form.state || ''} onChange={e => set('state', e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Telefone / WhatsApp</label>
                  <input className={inp} placeholder="(83) 99999-9999" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>E-mail</label>
                  <input type="email" className={inp} placeholder="contato@escola.com" value={form.email || ''} onChange={e => set('email', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Origem do lead</label>
                  <select className={inp} value={form.origin || 'Indicação'} onChange={e => set('origin', e.target.value)}>
                    {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Consultor responsável</label>
                  <select className={inp} value={form.consultant_id || ''} onChange={e => set('consultant_id', e.target.value)}>
                    <option value="">Sem consultor</option>
                    {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Valor proposto — mensalidade (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input type="number" className={inp + ' pl-9'} placeholder="550" value={form.monthly_value || ''} onChange={e => set('monthly_value', Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Valor proposto — implantação (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input type="number" className={inp + ' pl-9'} placeholder="550" value={form.implementation_value || ''} onChange={e => set('implementation_value', Number(e.target.value))} />
                  </div>
                </div>
              </div>

              <div>
                <label className={lbl}>Próximo follow-up</label>
                <input type="datetime-local" className={inp} value={form.next_followup?.slice(0, 16) || ''}
                  onChange={e => set('next_followup', e.target.value)} />
                {isOverdue(form.next_followup) && <p className="text-xs text-red-500 mt-1 font-medium">⚠️ Follow-up vencido!</p>}
              </div>

              <div>
                <label className={lbl}>Observações gerais</label>
                <textarea rows={3} className={inp + ' resize-none'} placeholder="Notas sobre este lead..."
                  value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Tab: Histórico ── */}
          {!isNew && activeTab === 'history' && (
            <div className="space-y-4">
              {/* Adicionar interação */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-bold text-gray-500 mb-3">Registrar interação</p>
                <div className="flex gap-2 mb-3">
                  {INTERACTION_TYPES.map(t => {
                    const Icon = t.icon
                    return (
                      <button key={t.v} onClick={() => setNewInteraction(n => ({ ...n, type: t.v }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                          ${newInteraction.type === t.v ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        style={newInteraction.type === t.v ? { background: t.color, borderColor: t.color } : {}}>
                        <Icon className="w-3.5 h-3.5" /> {t.l}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <textarea rows={2} className={inp + ' flex-1 resize-none text-xs'} placeholder="Descreva o contato, resultado, próximos passos..."
                    value={newInteraction.content} onChange={e => setNewInteraction(n => ({ ...n, content: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddInteraction() }} />
                  <button onClick={handleAddInteraction} disabled={addingInteraction || !newInteraction.content.trim()}
                    className="px-4 bg-cyan-500 text-white rounded-xl text-xs font-bold hover:bg-cyan-600 disabled:opacity-50 flex items-center gap-1.5 self-end py-2.5">
                    {addingInteraction ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Salvar
                  </button>
                </div>
              </div>

              {/* Timeline */}
              {interactions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <StickyNote className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">Nenhuma interação registrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {interactions.map(int => {
                    const tType = INTERACTION_TYPES.find(t => t.v === int.type) || INTERACTION_TYPES[4]
                    const Icon = tType.icon
                    return (
                      <div key={int.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5" style={{ background: `${tType.color}15` }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: tType.color }} />
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold" style={{ color: tType.color }}>{tType.l}</span>
                            <span className="text-xs text-gray-400">{timeAgo(int.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{int.content}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          {form.stage === 'fechado' && !isNew && (
            <button onClick={() => { onStartOnboarding(form as Lead); onClose() }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm shadow-sm">
              🏫 Iniciar onboarding
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">
            {isNew ? 'Cancelar' : 'Fechar'}
          </button>
          <button onClick={handleSave} disabled={saving || !form.school_name || !form.name}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
              : <><CheckCircle2 className="w-4 h-4" /> {isNew ? 'Criar lead' : 'Salvar alterações'}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function AdminCRM() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [consultants, setConsultants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState<Stage | 'all'>('all')
  const [filterConsultant, setFilterConsultant] = useState('')
  const [filterOrigin, setFilterOrigin] = useState('')
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')

  const [selectedLead, setSelectedLead] = useState<Lead | null | 'new'>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [leadsRes, consultRes] = await Promise.all([
      supabase.from('crm_leads').select('*').order('updated_at', { ascending: false }),
      supabase.from('users').select('id, full_name').eq('user_type', 'consultant'),
    ])
    setLeads(leadsRes.data || [])
    setConsultants(consultRes.data || [])
    setLoading(false)
  }

  const filteredLeads = leads.filter(l => {
    const matchSearch = !search || [l.school_name, l.name, l.city, l.email, l.phone].some(f => f?.toLowerCase().includes(search.toLowerCase()))
    const matchStage = filterStage === 'all' || l.stage === filterStage
    const matchConsultant = !filterConsultant || l.consultant_id === filterConsultant
    const matchOrigin = !filterOrigin || l.origin === filterOrigin
    const matchOverdue = !showOverdueOnly || isOverdue(l.next_followup)
    return matchSearch && matchStage && matchConsultant && matchOrigin && matchOverdue
  })

  const overdueCount = leads.filter(l => isOverdue(l.next_followup)).length

  const handleSaveLead = async (form: Partial<Lead>) => {
    try {
      if (form.id) {
        const { error } = await supabase.from('crm_leads').update({
          ...form, updated_at: new Date().toISOString(),
        }).eq('id', form.id)
        if (error) throw error
        showToast('Lead atualizado!')
      } else {
        const { error } = await supabase.from('crm_leads').insert({
          ...form,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        if (error) throw error
        showToast('Lead criado!')
      }
      setSelectedLead(null)
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    }
  }

  const handleMoveStage = async (lead: Lead, to: Stage) => {
    await supabase.from('crm_leads').update({ stage: to, updated_at: new Date().toISOString() }).eq('id', lead.id)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este lead?')) return
    await supabase.from('crm_leads').delete().eq('id', id)
    showToast('Lead excluído.')
    loadData()
  }

  const handleStartOnboarding = (lead: Lead) => {
    // Redireciona para schools com os dados do lead preenchidos
    navigate('/super-admin/schools', { state: { prefillFromLead: lead } })
  }

  // KPIs
  const kpis = {
    total:       leads.length,
    active:      leads.filter(l => !['fechado','cliente'].includes(l.stage)).length,
    closed:      leads.filter(l => l.stage === 'fechado').length,
    clients:     leads.filter(l => l.stage === 'cliente').length,
    mrr_pipeline: leads.filter(l => l.monthly_value).reduce((s, l) => s + (l.monthly_value || 0), 0),
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && (
          <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
            ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM Comercial</h1>
            <p className="text-sm text-gray-500 mt-1">Pipeline de prospecção e fechamento de novas escolas</p>
          </div>
          <div className="flex items-center gap-3">
            {overdueCount > 0 && (
              <button onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-all
                  ${showOverdueOnly ? 'bg-red-500 text-white border-red-500' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}>
                <AlertCircle className="w-4 h-4" /> {overdueCount} vencido{overdueCount > 1 ? 's' : ''}
              </button>
            )}
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setView('kanban')} className={`px-3 py-2 text-sm font-semibold transition-colors ${view === 'kanban' ? 'bg-cyan-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                Kanban
              </button>
              <button onClick={() => setView('list')} className={`px-3 py-2 text-sm font-semibold transition-colors ${view === 'list' ? 'bg-cyan-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                Lista
              </button>
            </div>
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setSelectedLead('new')} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:from-cyan-600 hover:to-blue-700">
              <Plus className="w-4 h-4" /> Novo lead
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total leads',    value: kpis.total,    icon: TrendingUp,  color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: 'Em andamento',   value: kpis.active,   icon: Clock,       color: 'text-cyan-600',   bg: 'bg-cyan-50' },
            { label: 'Fechados',       value: kpis.closed,   icon: Star,        color: 'text-green-600',  bg: 'bg-green-50' },
            { label: 'Clientes',       value: kpis.clients,  icon: Building2,   color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'MRR no pipeline', value: kpis.mrr_pipeline.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                  <div className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${k.color}`} />
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-900">{loading ? '—' : k.value}</p>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
              placeholder="Buscar escola, contato, cidade..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
            value={filterStage} onChange={e => setFilterStage(e.target.value as any)}>
            <option value="all">Todos os estágios</option>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
            value={filterConsultant} onChange={e => setFilterConsultant(e.target.value)}>
            <option value="">Todos os consultores</option>
            {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
            value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}>
            <option value="">Todas as origens</option>
            {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* ── KANBAN VIEW ── */}
        {view === 'kanban' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(stage => {
              const stageLeads = filteredLeads.filter(l => l.stage === stage.id)
              const stageValue = stageLeads.reduce((s, l) => s + (l.monthly_value || 0), 0)
              return (
                <div key={stage.id} className="flex-shrink-0 w-72">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: stage.color }}>{stage.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: stage.bg, color: stage.color }}>
                        {stageLeads.length}
                      </span>
                    </div>
                    {stageValue > 0 && (
                      <span className="text-xs text-gray-400 font-semibold">
                        {stageValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </div>

                  {/* Column body */}
                  <div className="space-y-3 min-h-[200px]">
                    {stageLeads.map(lead => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        stage={stage}
                        consultants={consultants}
                        onClick={() => setSelectedLead(lead)}
                        onMoveStage={to => handleMoveStage(lead, to)}
                        onDelete={() => handleDelete(lead.id)}
                      />
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="border-2 border-dashed border-gray-100 rounded-xl py-8 text-center text-gray-300">
                        <p className="text-xs">Sem leads</p>
                      </div>
                    )}
                    <button onClick={() => setSelectedLead({ stage: stage.id } as any)}
                      className="w-full py-2 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-cyan-300 hover:text-cyan-500 transition-colors font-medium">
                      + Adicionar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === 'list' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Escola','Contato','Localização','Estágio','Valores','Follow-up','Origem','Ações'].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        <TrendingUp className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                        <p className="text-sm">Nenhum lead encontrado</p>
                      </td>
                    </tr>
                  ) : filteredLeads.map(lead => {
                    const stage = STAGES.find(s => s.id === lead.stage) || STAGES[0]
                    const overdue = isOverdue(lead.next_followup)
                    const soon = isDueSoon(lead.next_followup)
                    return (
                      <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-gray-900 text-sm">{lead.school_name}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm text-gray-700">{lead.name}</p>
                          {lead.phone && <p className="text-xs text-gray-400">{lead.phone}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-500">
                          {[lead.city, lead.state].filter(Boolean).join('/')}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: stage.color, background: stage.bg }}>
                            {stage.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-600">
                          {lead.monthly_value && <p className="font-semibold">{fmtBRL(lead.monthly_value)}/mês</p>}
                          {lead.implementation_value && <p className="text-gray-400">Impl.: {fmtBRL(lead.implementation_value)}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          {lead.next_followup ? (
                            <span className={`text-xs font-medium ${overdue ? 'text-red-600' : soon ? 'text-amber-600' : 'text-gray-500'}`}>
                              {overdue && '⚠️ '}
                              {new Date(lead.next_followup).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-gray-500">{lead.origin || '—'}</span>
                        </td>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelectedLead(lead)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(lead.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Lead Modal ── */}
      {selectedLead !== null && (
        <LeadModal
          lead={selectedLead === 'new' ? null : selectedLead}
          consultants={consultants}
          onClose={() => setSelectedLead(null)}
          onSave={handleSaveLead}
          onStartOnboarding={handleStartOnboarding}
        />
      )}
    </SuperAdminLayout>
  )
}