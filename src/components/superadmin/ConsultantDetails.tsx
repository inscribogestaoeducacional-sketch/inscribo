// src/components/superadmin/ConsultantDetails.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  ArrowLeft, Building2, KanbanSquare, BookOpen, Lightbulb,
  CheckCircle2, Clock, XCircle, TrendingUp, Users, Star,
  MapPin, Mail, Phone, Calendar, AlertTriangle, ChevronRight,
  Activity
} from 'lucide-react'

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  prospecting:    { label: 'Prospectando',   color: '#6b7280', bg: '#f3f4f6' },
  contacted:      { label: 'Contato',        color: '#3b82f6', bg: '#eff6ff' },
  demo_scheduled: { label: 'Demo agendada',  color: '#f59e0b', bg: '#fffbeb' },
  demo_done:      { label: 'Demo feita',     color: '#f97316', bg: '#fff7ed' },
  proposal:       { label: 'Proposta',       color: '#8b5cf6', bg: '#f5f3ff' },
  negotiation:    { label: 'Negociação',     color: '#ec4899', bg: '#fdf2f8' },
  won:            { label: 'Fechado',        color: '#22c55e', bg: '#f0fdf4' },
  lost:           { label: 'Perdido',        color: '#ef4444', bg: '#fef2f2' },
}

const TRAINING_TYPES: Record<string, string> = {
  initial: '🚀 Inicial', followup: '🔄 Acompanhamento',
  advanced: '⭐ Avançado', custom: '🎯 Personalizado',
}

function Skeleton({ h = 'h-4', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} bg-gray-200 rounded animate-pulse`} />
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ConsultantDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [consultant, setConsultant] = useState<any>(null)
  const [pipeline, setPipeline] = useState<any[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [implementations, setImplementations] = useState<any[]>([])
  const [trainings, setTrainings] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'timeline' | 'pipeline' | 'schools' | 'trainings'>('timeline')

  useEffect(() => {
    if (id) loadData(id)
  }, [id])

  const loadData = async (consultantId: string) => {
    setLoading(true)
    const [cRes, pRes, sRes, iRes, tRes, sugRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', consultantId).single(),
      supabase.from('sales_pipeline').select('*').eq('consultant_id', consultantId).order('updated_at', { ascending: false }),
      supabase.from('institutions').select('*').eq('consultant_id', consultantId).order('name'),
      supabase.from('school_implementations').select('*').eq('consultant_id', consultantId).order('created_at', { ascending: false }),
      supabase.from('trainings').select('*, institutions(name)').eq('consultant_id', consultantId).order('scheduled_at', { ascending: false }),
      supabase.from('school_suggestions').select('*').eq('consultant_id', consultantId).order('created_at', { ascending: false }),
    ])
    setConsultant(cRes.data)
    setPipeline(pRes.data || [])
    setSchools(sRes.data || [])
    setImplementations(iRes.data || [])
    setTrainings(tRes.data || [])
    setSuggestions(sugRes.data || [])
    setLoading(false)
  }

  // ── KPIs ──────────────────────────────────────────────────────
  const activeOpps = pipeline.filter(p => !['won', 'lost'].includes(p.stage))
  const wonOpps = pipeline.filter(p => p.stage === 'won')
  const convRate = pipeline.length > 0 ? Math.round((wonOpps.length / pipeline.length) * 100) : 0
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
  const wonMonth = wonOpps.filter(p => new Date(p.updated_at) >= startOfMonth)
  const upcomingTrainings = trainings.filter(t => t.status === 'scheduled')
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')

  // ── Timeline ──────────────────────────────────────────────────
  const timelineItems: { date: string; type: string; title: string; subtitle: string; color: string; icon: any }[] = []

  pipeline.forEach(p => {
    timelineItems.push({
      date: p.updated_at || p.created_at,
      type: 'pipeline',
      title: p.stage === 'won' ? `Fechamento: ${p.school_name}` : `Pipeline: ${p.school_name}`,
      subtitle: STAGE_CONFIG[p.stage]?.label || p.stage,
      color: STAGE_CONFIG[p.stage]?.color || '#6b7280',
      icon: KanbanSquare,
    })
  })

  schools.forEach(s => {
    timelineItems.push({
      date: s.created_at,
      type: 'school',
      title: `Escola vinculada: ${s.name}`,
      subtitle: s.city ? `${s.city}${s.state ? `, ${s.state}` : ''}` : 'Sem localização',
      color: '#0891b2',
      icon: Building2,
    })
  })

  trainings.forEach(t => {
    timelineItems.push({
      date: t.scheduled_at || t.created_at,
      type: 'training',
      title: `${TRAINING_TYPES[t.type] || '📚'}: ${t.title}`,
      subtitle: `${t.institutions?.name || '—'} • ${t.status === 'done' ? 'Realizado' : t.status === 'cancelled' ? 'Cancelado' : 'Agendado'}`,
      color: t.status === 'done' ? '#22c55e' : t.status === 'cancelled' ? '#9ca3af' : '#3b82f6',
      icon: BookOpen,
    })
  })

  suggestions.forEach(s => {
    timelineItems.push({
      date: s.created_at,
      type: 'suggestion',
      title: `Sugestão de escola: ${s.name}`,
      subtitle: s.status === 'approved' ? 'Aprovada' : s.status === 'rejected' ? 'Rejeitada' : 'Aguardando aprovação',
      color: s.status === 'approved' ? '#22c55e' : s.status === 'rejected' ? '#ef4444' : '#d97706',
      icon: Lightbulb,
    })
  })

  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="p-8 space-y-6">
          <Skeleton h="h-8" w="w-64" />
          <div className="grid grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} h="h-24" />)}
          </div>
          <Skeleton h="h-96" />
        </div>
      </SuperAdminLayout>
    )
  }

  if (!consultant) {
    return (
      <SuperAdminLayout>
        <div className="p-8 text-center">
          <p className="text-gray-500">Consultor não encontrado.</p>
          <button onClick={() => navigate('/super-admin/consultants')} className="mt-4 text-cyan-600 font-semibold">
            Voltar
          </button>
        </div>
      </SuperAdminLayout>
    )
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/super-admin/consultants')}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 mt-1 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                {consultant.full_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{consultant.full_name}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{consultant.email}</span>
                  {consultant.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{consultant.phone}</span>}
                  {consultant.region && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{consultant.region}</span>}
                </div>
              </div>
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 ${consultant.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {consultant.active ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Escolas', value: schools.length, icon: Building2, color: 'from-cyan-500 to-blue-600' },
            { label: 'Pipeline ativo', value: activeOpps.length, icon: KanbanSquare, color: 'from-purple-500 to-violet-600' },
            { label: 'Fechamentos/mês', value: wonMonth.length, icon: TrendingUp, color: 'from-green-500 to-emerald-600' },
            { label: 'Conversão', value: `${convRate}%`, icon: Star, color: 'from-amber-500 to-orange-500' },
            { label: 'Treinamentos', value: upcomingTrainings.length, icon: BookOpen, color: 'from-blue-500 to-indigo-600' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{k.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center flex-shrink-0`}>
                  <k.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Alertas rápidos */}
        {(pendingSuggestions.length > 0 || upcomingTrainings.filter(t => new Date(t.scheduled_at) < new Date()).length > 0) && (
          <div className="flex flex-wrap gap-3">
            {pendingSuggestions.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium">
                <AlertTriangle className="w-4 h-4" />
                {pendingSuggestions.length} sugestão{pendingSuggestions.length > 1 ? 'ões' : ''} aguardando aprovação
              </div>
            )}
            {upcomingTrainings.filter(t => new Date(t.scheduled_at) < new Date()).length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                <Clock className="w-4 h-4" />
                {upcomingTrainings.filter(t => new Date(t.scheduled_at) < new Date()).length} treinamento{upcomingTrainings.filter(t => new Date(t.scheduled_at) < new Date()).length > 1 ? 's' : ''} atrasado{upcomingTrainings.filter(t => new Date(t.scheduled_at) < new Date()).length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'timeline', label: 'Timeline', icon: Activity },
            { key: 'pipeline', label: `Pipeline (${pipeline.length})`, icon: KanbanSquare },
            { key: 'schools', label: `Escolas (${schools.length})`, icon: Building2 },
            { key: 'trainings', label: `Treinamentos (${trainings.length})`, icon: BookOpen },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2
                ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Timeline ── */}
        {activeTab === 'timeline' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-6">Timeline de atividades</h2>
            {timelineItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Activity className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Nenhuma atividade ainda</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-6">
                  {timelineItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0 z-10"
                        style={{ background: item.color + '20', border: `2px solid ${item.color}` }}>
                        <item.icon className="w-4 h-4" style={{ color: item.color }} />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                            <p className="text-xs mt-0.5" style={{ color: item.color }}>{item.subtitle}</p>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(item.date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Pipeline ── */}
        {activeTab === 'pipeline' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Escola</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cidade</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stage</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor est.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Próxima ação</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pipeline.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">Sem oportunidades</td></tr>
                ) : pipeline.map(p => {
                  const cfg = STAGE_CONFIG[p.stage] || STAGE_CONFIG.prospecting
                  const isOverdue = p.next_action_date && new Date(p.next_action_date) < new Date() && !['won', 'lost'].includes(p.stage)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900 text-sm">{p.school_name}</p>
                        {p.contact_name && <p className="text-xs text-gray-400">{p.contact_name}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.city}{p.state ? `, ${p.state}` : ''}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {p.estimated_value ? `R$ ${p.estimated_value.toLocaleString('pt-BR')}` : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {p.next_action ? (
                          <div>
                            <p className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>{p.next_action}</p>
                            {p.next_action_date && (
                              <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                                {isOverdue && '⚠ '}{new Date(p.next_action_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">{fmtDate(p.updated_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab: Escolas ── */}
        {activeTab === 'schools' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {schools.length === 0 ? (
              <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">Nenhuma escola vinculada</p>
              </div>
            ) : schools.map(s => {
              const impl = implementations.find(i => i.institution_id === s.id)
              const planMap: Record<string, { label: string; color: string; bg: string }> = {
                trial:   { label: 'Trial',  color: '#d97706', bg: '#fffbeb' },
                escola:  { label: 'Escola', color: '#0891b2', bg: '#ecfeff' },
                rede:    { label: 'Rede',   color: '#7c3aed', bg: '#f5f3ff' },
              }
              const plan = planMap[s.plan] || planMap.trial
              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{s.name}</p>
                      {s.city && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{s.city}{s.state ? `, ${s.state}` : ''}</p>}
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: plan.color, background: plan.bg }}>
                      {plan.label}
                    </span>
                  </div>
                  {impl && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Implantação</span>
                        <span>{['step_onboarding_done', 'step_whatsapp_connected', 'step_campaign_configured', 'step_team_trained', 'step_first_lead'].filter(k => impl[k]).length}/5</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                          style={{ width: `${(['step_onboarding_done', 'step_whatsapp_connected', 'step_campaign_configured', 'step_team_trained', 'step_first_lead'].filter(k => impl[k]).length / 5) * 100}%` }} />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-3">Cadastrada em {fmtDate(s.created_at)}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Tab: Treinamentos ── */}
        {activeTab === 'trainings' && (
          <div className="space-y-3">
            {trainings.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">Nenhum treinamento registrado</p>
              </div>
            ) : trainings.map(t => {
              const statusMap: Record<string, { label: string; color: string; bg: string; icon: any }> = {
                scheduled: { label: 'Agendado',  color: '#3b82f6', bg: '#eff6ff', icon: Clock },
                done:       { label: 'Realizado', color: '#22c55e', bg: '#f0fdf4', icon: CheckCircle2 },
                cancelled:  { label: 'Cancelado', color: '#9ca3af', bg: '#f3f4f6', icon: XCircle },
              }
              const st = statusMap[t.status] || statusMap.scheduled
              const isOverdue = t.status === 'scheduled' && new Date(t.scheduled_at) < new Date()
              return (
                <div key={t.id} className={`bg-white rounded-xl border shadow-sm p-5 flex items-center gap-4 ${isOverdue ? 'border-amber-200' : 'border-gray-200'}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-gray-50">
                    {TRAINING_TYPES[t.type]?.split(' ')[0] || '📚'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{t.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.institutions?.name || '—'}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {t.scheduled_at ? fmtDateTime(t.scheduled_at) : '—'}
                      </span>
                      {isOverdue && <span className="text-xs text-amber-600 font-semibold">⚠ Atrasado</span>}
                    </div>
                    {t.notes && <p className="text-xs text-gray-400 mt-1 italic truncate">"{t.notes}"</p>}
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1"
                    style={{ color: st.color, background: st.bg }}>
                    <st.icon className="w-3 h-3" />
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </SuperAdminLayout>
  )
}