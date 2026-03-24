// src/components/superadmin/ConsultantDashboard.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  KanbanSquare, Building2, TrendingUp, Clock,
  ArrowRight, CheckCircle2, AlertTriangle, Calendar,
  Users, Target, Star, AlertCircle, Award
} from 'lucide-react'

// ── Stage / status configs ────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────
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

interface ScoreResult {
  score: number
  label: string
  color: string
  totalStudents: number
  newVar: number
}

function getSchoolScore(school: any, cycles: any[]): ScoreResult {
  const cycle = cycles.find(c => c.institution_id === school.id)
  const historical: any[] = cycle?.historical_data ?? cycle?.erp_files ?? []
  const sorted = [...historical].sort((a, b) => (a.detected_year ?? a.year ?? 0) - (b.detected_year ?? b.year ?? 0))
  const latest = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]

  if (!latest) return { score: 0, label: 'Sem dados', color: '#9ca3af', totalStudents: 0, newVar: 0 }

  let score = 50
  const newVar = (previous?.new_students ?? previous?.novatos ?? 0) > 0
    ? (((latest.new_students ?? latest.novatos ?? 0) - (previous.new_students ?? previous.novatos ?? 0))
       / (previous.new_students ?? previous.novatos ?? 1) * 100)
    : 0

  if (newVar > 5) score += 15
  else if (newVar > 0) score += 8
  else if (newVar > -10) score -= 5
  else score -= 15

  score = Math.min(100, Math.max(0, score))

  const label = score >= 80 ? 'Alto desempenho'
    : score >= 60 ? 'Regular'
    : score >= 40 ? 'Atenção'
    : 'Crítico'
  const color = score >= 80 ? '#0F6E56'
    : score >= 60 ? '#BA7517'
    : score >= 40 ? '#f97316'
    : '#E24B4A'

  const totalStudents = latest.total_students ?? latest.total ?? 0

  return { score, label, color, totalStudents, newVar }
}

function fmt(n: number) { return new Intl.NumberFormat('pt-BR').format(n) }

// ── Skeleton block ───────────────────────────────────────────────
function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

// ── Main component ───────────────────────────────────────────────
export default function ConsultantDashboard() {
  const [pipeline, setPipeline]           = useState<any[]>([])
  const [implementations, setImplementations] = useState<any[]>([])
  const [schools, setSchools]             = useState<any[]>([])
  const [cycles, setCycles]               = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [userId, setUserId]               = useState<string | null>(null)
  const [userName, setUserName]           = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('inscribo-user')
    if (stored) {
      const u = JSON.parse(stored)
      setUserId(u.id)
      setUserName(u.full_name || '')
      loadData(u.id)
    }
  }, [])

  const loadData = async (uid: string) => {
    setLoading(true)
    try {
      const [pRes, iRes, sRes] = await Promise.all([
        supabase.from('sales_pipeline').select('*').eq('consultant_id', uid).order('updated_at', { ascending: false }),
        supabase.from('school_implementations').select('*').eq('consultant_id', uid).order('created_at', { ascending: false }),
        supabase.from('institutions').select('*').eq('consultant_id', uid),
      ])

      const schoolList = sRes.data || []
      setPipeline(pRes.data || [])
      setImplementations(iRes.data || [])
      setSchools(schoolList)

      if (schoolList.length > 0) {
        const schoolIds = schoolList.map((s: any) => s.id)
        const { data: cycleData } = await supabase
          .from('campaign_cycles')
          .select('*')
          .in('institution_id', schoolIds)
          .order('created_at', { ascending: false })
        setCycles(cycleData || [])
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Computed KPIs ────────────────────────────────────────────
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
  const today = new Date(); today.setHours(0,0,0,0)

  const active    = pipeline.filter(p => !['won','lost'].includes(p.stage))
  const wonMonth  = pipeline.filter(p => p.stage === 'won' && new Date(p.updated_at) >= startOfMonth)
  const convRate  = pipeline.length > 0 ? ((pipeline.filter(p => p.stage === 'won').length / pipeline.length) * 100).toFixed(1) : '0'
  const inProgress = implementations.filter(i => i.status !== 'completed')

  const upcoming = pipeline
    .filter(p => p.next_action_date && !['won','lost'].includes(p.stage))
    .sort((a, b) => new Date(a.next_action_date).getTime() - new Date(b.next_action_date).getTime())
    .slice(0, 6)

  function actionUrgency(date: string) {
    const d = new Date(date + 'T12:00:00'); d.setHours(0,0,0,0)
    if (d < today) return 'overdue'
    if (d.getTime() === today.getTime()) return 'today'
    return 'future'
  }

  // Consolidated KPIs from linked schools
  const schoolScores = schools.map(s => getSchoolScore(s, cycles))
  const totalStudents    = schoolScores.reduce((sum, s) => sum + s.totalStudents, 0)
  const avgScore         = schoolScores.length > 0
    ? Math.round(schoolScores.reduce((sum, s) => sum + s.score, 0) / schoolScores.length) : 0
  const activeCampaigns  = cycles.filter(c => c.status === 'active').length
  const needsAttention   = schoolScores.filter(s => s.score < 50).length

  // ── Alerts ──────────────────────────────────────────────────
  const alerts: { school: string; type: 'score' | 'setup' | 'pipeline'; msg: string }[] = []
  schools.forEach(school => {
    const info = getSchoolScore(school, cycles)
    const hasCycle = cycles.some(c => c.institution_id === school.id)
    if (info.score < 50 && hasCycle)
      alerts.push({ school: school.name, type: 'score', msg: `Score crítico: ${info.score}` })
    if (!hasCycle)
      alerts.push({ school: school.name, type: 'setup', msg: 'Escola sem configuração' })
  })

  // ── Render ───────────────────────────────────────────────────
  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting()}{userName ? `, ${userName.split(' ')[0]}` : ''}
            </h1>
            <p className="text-gray-500 mt-1">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" />
            Consultor Áion Edu
          </span>
        </div>

        {/* ── Section B — KPIs consolidados ── */}
        {loading ? (
          <div className="grid grid-cols-4 gap-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                <Skeleton h="h-3" w="w-24" />
                <Skeleton h="h-8" w="w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Alunos gerenciados',  value: fmt(totalStudents), icon: Users,         grad: 'from-cyan-500 to-blue-600'    },
              { label: 'Campanhas ativas',    value: activeCampaigns,    icon: Target,        grad: 'from-green-500 to-emerald-600' },
              { label: 'Score médio',         value: `${avgScore}`,      icon: Star,          grad: 'from-purple-500 to-violet-600' },
              { label: 'Precisam atenção',    value: needsAttention,     icon: AlertTriangle, grad: needsAttention > 0 ? 'from-red-500 to-rose-600' : 'from-gray-400 to-gray-500' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${kpi.grad} flex items-center justify-center flex-shrink-0`}>
                    <kpi.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Section A — Escolas vinculadas com score ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Escolas vinculadas</h2>
            <Link to="/super-admin/consultant/schools" className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
              Ver detalhes <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <Skeleton h="h-4" w="w-3/4" />
                  <Skeleton h="h-3" w="w-1/2" />
                  <Skeleton h="h-6" w="w-full" />
                </div>
              ))}
            </div>
          ) : schools.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-600">Nenhuma escola vinculada ainda</p>
              <p className="text-sm mt-1">O administrador pode vincular escolas ao seu perfil.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {schools.map(school => {
                const info = getSchoolScore(school, cycles)
                const activeCycle = cycles.find(c => c.institution_id === school.id && c.status === 'active')
                const hasCycle    = cycles.some(c => c.institution_id === school.id)
                const statusLabel = activeCycle ? 'Ativa' : hasCycle ? 'Pré-campanha' : 'Sem setup'
                const statusColor = activeCycle ? '#0F6E56' : hasCycle ? '#BA7517' : '#9ca3af'
                const statusBg    = activeCycle ? '#f0fdf4' : hasCycle ? '#fefce8' : '#f3f4f6'
                const variacao    = info.newVar !== 0 ? `${info.newVar > 0 ? '+' : ''}${info.newVar.toFixed(1)}%` : null

                return (
                  <div key={school.id} className="border border-gray-200 rounded-xl p-4 hover:border-cyan-300 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{school.name}</p>
                        {school.city && (
                          <p className="text-xs text-gray-400 mt-0.5">{school.city}{school.state ? `, ${school.state}` : ''}</p>
                        )}
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ color: statusColor, background: statusBg }}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Score gauge */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Score</span>
                          <span className="font-bold" style={{ color: info.color }}>{info.score}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${info.score}%`, backgroundColor: info.color }} />
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ color: info.color, background: info.color + '18' }}>
                        {info.label}
                      </span>
                    </div>

                    {/* Students */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{info.totalStudents > 0 ? `${fmt(info.totalStudents)} alunos` : 'Sem dados históricos'}</span>
                      {variacao && (
                        <span className="font-semibold" style={{ color: info.newVar >= 0 ? '#0F6E56' : '#E24B4A' }}>
                          {variacao} novatos
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Alerts + Goals side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Section E — Alertas */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Alertas das escolas</h2>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} h="h-10" />)}
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-400" />
                <p className="text-sm font-medium text-gray-600">Tudo em ordem</p>
                <p className="text-xs mt-1">Nenhum alerta nas suas escolas</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {alerts.map((a, i) => {
                  const icon = a.type === 'score'
                    ? <AlertTriangle className="w-4 h-4 text-red-500" />
                    : a.type === 'setup'
                    ? <AlertCircle className="w-4 h-4 text-gray-400" />
                    : <TrendingUp className="w-4 h-4 text-amber-500" />
                  const bg = a.type === 'score' ? 'bg-red-50'
                    : a.type === 'setup' ? 'bg-gray-50'
                    : 'bg-amber-50'
                  return (
                    <div key={i} className="px-6 py-4 flex items-start gap-3">
                      <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.school}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{a.msg}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section D — Metas do mês */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Metas do mês</h2>
            </div>
            {loading ? (
              <div className="p-6 space-y-4">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Fechamentos */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Fechamentos este mês</span>
                    <span className="text-sm font-bold text-gray-900">{wonMonth.length} <span className="text-gray-400 font-normal">/ meta 3</span></span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all"
                         style={{ width: `${Math.min(100, (wonMonth.length / 3) * 100)}%` }} />
                  </div>
                </div>

                {/* Taxa de conversão */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Taxa de conversão geral</span>
                  <span className="text-lg font-bold text-gray-900">{convRate}%</span>
                </div>

                {/* Oportunidades ativas */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Oportunidades ativas</span>
                  <span className="text-lg font-bold text-gray-900">{active.length}</span>
                </div>

                {/* Valor estimado em negociação */}
                {pipeline.some(p => p.estimated_value) && (
                  <div className="flex items-center justify-between p-3 bg-cyan-50 rounded-lg">
                    <span className="text-sm text-gray-600">Valor estimado em jogo</span>
                    <span className="text-base font-bold text-cyan-700">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        pipeline.filter(p => !['won','lost'].includes(p.stage)).reduce((s, p) => s + (p.estimated_value || 0), 0)
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Section C — Pipeline resumido ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Pipeline recente</h2>
              <Link to="/super-admin/consultant/pipeline" className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
                Ver tudo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">
                {Array(4).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
              </div>
            ) : pipeline.length === 0 ? (
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
                        <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0"
                              style={{ color: cfg.color, background: cfg.bg }}>
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
            {loading ? (
              <div className="p-6 space-y-3">
                {Array(4).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Sem ações nos próximos dias</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcoming.map(opp => {
                  const urgency = actionUrgency(opp.next_action_date)
                  const dateLabel = urgency === 'overdue' ? 'Atrasado'
                    : urgency === 'today' ? 'Hoje'
                    : new Date(opp.next_action_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                  const badgeColor = urgency === 'overdue' ? 'bg-red-100 text-red-700'
                    : urgency === 'today' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
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

        {/* ── Implantações em andamento ── */}
        {!loading && inProgress.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Implantações em andamento</h2>
              <Link to="/super-admin/consultant/schools" className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
                Ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {inProgress.map(imp => {
                const done = checklistProgress(imp)
                const pct = Math.round((done / 5) * 100)
                const sCfg = statusConfig[imp.status] || statusConfig.not_started
                const healthColor = imp.health_score >= 71 ? '#22c55e' : imp.health_score >= 41 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={imp.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="font-semibold text-gray-900 text-sm">{imp.school_name}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ color: sCfg.color, background: sCfg.bg }}>
                        {sCfg.label}
                      </span>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Checklist</span><span>{done}/5</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Health score</span>
                      <span className="font-bold" style={{ color: healthColor }}>{imp.health_score ?? '—'}%</span>
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
