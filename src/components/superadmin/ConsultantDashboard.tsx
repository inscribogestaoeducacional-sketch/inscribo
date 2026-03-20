// src/components/superadmin/ConsultantDashboard.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  KanbanSquare, Building2, TrendingUp, Clock,
  ArrowRight, CheckCircle2, Circle, AlertTriangle, Calendar
} from 'lucide-react'

const stageConfig: Record<string, { label: string; color: string; bg: string }> = {
  prospecting:    { label: 'Prospectando',    color: '#6b7280', bg: '#f3f4f6' },
  contacted:      { label: 'Contato feito',   color: '#3b82f6', bg: '#eff6ff' },
  demo_scheduled: { label: 'Demo agendada',   color: '#f59e0b', bg: '#fffbeb' },
  demo_done:      { label: 'Demo realizada',  color: '#f97316', bg: '#fff7ed' },
  proposal:       { label: 'Proposta',        color: '#8b5cf6', bg: '#f5f3ff' },
  negotiation:    { label: 'Negociação',      color: '#ec4899', bg: '#fdf2f8' },
  won:            { label: 'Fechado',         color: '#22c55e', bg: '#f0fdf4' },
  lost:           { label: 'Perdido',         color: '#ef4444', bg: '#fef2f2' },
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Não iniciado', color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'Em andamento', color: '#3b82f6', bg: '#eff6ff' },
  completed:   { label: 'Concluído',    color: '#22c55e', bg: '#f0fdf4' },
  stuck:       { label: 'Travado',      color: '#ef4444', bg: '#fef2f2' },
}

function relativeDate(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diff < 1) return 'agora'
  if (diff < 60) return `há ${diff} min`
  if (diff < 1440) return `há ${Math.floor(diff / 60)}h`
  return `há ${Math.floor(diff / 1440)} dias`
}

function checklistProgress(imp: Record<string, unknown>) {
  const steps = ['step_onboarding_done','step_whatsapp_connected','step_campaign_configured','step_team_trained','step_first_lead']
  return steps.filter(s => imp[s]).length
}

export default function ConsultantDashboard() {
  const [pipeline, setPipeline] = useState<any[]>([])
  const [implementations, setImplementations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('inscribo-user')
    if (stored) {
      const u = JSON.parse(stored)
      setUserId(u.id)
      loadData(u.id)
    }
  }, [])

  const loadData = async (uid: string) => {
    setLoading(true)
    try {
      const [pRes, iRes] = await Promise.all([
        supabase.from('sales_pipeline').select('*').eq('consultant_id', uid).order('updated_at', { ascending: false }),
        supabase.from('school_implementations').select('*').eq('consultant_id', uid).order('created_at', { ascending: false }),
      ])
      setPipeline(pRes.data || [])
      setImplementations(iRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  // KPIs
  const active = pipeline.filter(p => !['won','lost'].includes(p.stage))
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
  const wonMonth = pipeline.filter(p => p.stage === 'won' && new Date(p.updated_at) >= startOfMonth)
  const convRate = pipeline.length > 0 ? Math.round((pipeline.filter(p => p.stage === 'won').length / pipeline.length) * 100) : 0
  const inProgress = implementations.filter(i => i.status !== 'completed')

  // Próximas ações
  const today = new Date(); today.setHours(0,0,0,0)
  const in3Days = new Date(today); in3Days.setDate(in3Days.getDate() + 3)
  const upcoming = pipeline
    .filter(p => p.next_action_date && !['won','lost'].includes(p.stage))
    .sort((a, b) => new Date(a.next_action_date).getTime() - new Date(b.next_action_date).getTime())
    .slice(0, 6)

  function actionUrgency(date: string) {
    const d = new Date(date); d.setHours(0,0,0,0)
    if (d < today) return 'overdue'
    if (d.getTime() === today.getTime()) return 'today'
    return 'future'
  }

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </SuperAdminLayout>
    )
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meu Dashboard</h1>
          <p className="text-gray-500 mt-1">Visão geral do seu pipeline e escolas</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-6">
          {[
            { label: 'Oportunidades ativas', value: active.length, icon: KanbanSquare, color: 'from-cyan-500 to-blue-600', bg: 'bg-cyan-50' },
            { label: 'Fechamentos no mês', value: wonMonth.length, icon: TrendingUp, color: 'from-green-500 to-emerald-600', bg: 'bg-green-50' },
            { label: 'Taxa de conversão', value: `${convRate}%`, icon: CheckCircle2, color: 'from-purple-500 to-violet-600', bg: 'bg-purple-50' },
            { label: 'Em implantação', value: inProgress.length, icon: Building2, color: 'from-orange-500 to-amber-600', bg: 'bg-orange-50' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center`}>
                  <kpi.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Pipeline resumido */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Pipeline recente</h2>
              <Link to="/super-admin/consultant/pipeline" className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
                Ver tudo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {pipeline.slice(0, 5).length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <KanbanSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Nenhuma oportunidade ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pipeline.slice(0, 5).map(opp => {
                  const cfg = stageConfig[opp.stage] || stageConfig.prospecting
                  return (
                    <div key={opp.id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{opp.school_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{opp.city}{opp.state ? `, ${opp.state}` : ''}</p>
                          {opp.next_action && (
                            <p className="text-xs text-gray-500 mt-1 truncate">→ {opp.next_action}</p>
                          )}
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0" style={{ color: cfg.color, background: cfg.bg }}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Próximas ações */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Próximas ações</h2>
            </div>
            {upcoming.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Sem ações nos próximos dias</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcoming.map(opp => {
                  const urgency = actionUrgency(opp.next_action_date)
                  const dateLabel = urgency === 'overdue' ? 'Atrasado' : urgency === 'today' ? 'Hoje' : new Date(opp.next_action_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                  const badgeColor = urgency === 'overdue' ? 'bg-red-100 text-red-700' : urgency === 'today' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                  return (
                    <div key={opp.id} className="px-6 py-4 flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${urgency === 'overdue' ? 'bg-red-100' : 'bg-gray-100'}`}>
                        {urgency === 'overdue' ? <AlertTriangle className="w-3 h-3 text-red-500" /> : <Clock className="w-3 h-3 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{opp.school_name}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{opp.next_action}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColor}`}>{dateLabel}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Implantações em andamento */}
        {inProgress.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Implantações em andamento</h2>
              <Link to="/super-admin/consultant/schools" className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
                Ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4 p-6">
              {inProgress.map(imp => {
                const done = checklistProgress(imp)
                const pct = Math.round((done / 5) * 100)
                const sCfg = statusConfig[imp.status] || statusConfig.not_started
                const healthColor = imp.health_score >= 71 ? '#22c55e' : imp.health_score >= 41 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={imp.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="font-semibold text-gray-900 text-sm">{imp.school_name}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: sCfg.color, background: sCfg.bg }}>
                        {sCfg.label}
                      </span>
                    </div>
                    {/* Checklist progress */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Checklist</span>
                        <span>{done}/5</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {/* Health score */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Health score</span>
                      <span className="font-bold" style={{ color: healthColor }}>{imp.health_score}%</span>
                    </div>
                    {imp.last_login_at && (
                      <p className="text-xs text-gray-400 mt-1">Último login: {relativeDate(imp.last_login_at)}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}
