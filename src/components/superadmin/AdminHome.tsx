// src/components/superadmin/AdminHome.tsx
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'
import {
  DollarSign, Building2, AlertTriangle, TrendingUp,
  Plus, ArrowRight, CheckCircle2, Clock, FileText,
  Activity, Bell, Users, Calendar, Zap, Star,
  RefreshCw, ChevronRight, BookOpen, Target, X
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────
function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}
function isThisMonth(d: string | null) {
  if (!d) return false
  const dt = new Date(d), now = new Date()
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()
}
function isToday(d: string) {
  const dt = new Date(d), now = new Date()
  return dt.getDate() === now.getDate() && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}min atrás`
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function KpiCard({ label, value, sub, icon: Icon, grad, loading, onClick }: {
  label: string; value: string | number; sub?: string
  icon: any; grad: string; loading?: boolean; onClick?: () => void
}) {
  return (
    <div onClick={onClick}
      className={`bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-all
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
          {loading
            ? <div className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse" />
            : <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
          }
          {sub && !loading && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function AdminHome() {
  const navigate = useNavigate()

  // dados
  const [institutions, setInstitutions] = useState<any[]>([])
  const [payments,     setPayments]     = useState<any[]>([])
  const [leads,        setLeads]        = useState<any[]>([])
  const [meetings,     setMeetings]     = useState<any[]>([])
  const [contracts,    setContracts]    = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)

  // notif modal
  const [notifModal,  setNotifModal]  = useState(false)
  const [notifForm,   setNotifForm]   = useState({ title: '', message: '', target: 'all', institutionId: '' })
  const [sendingNotif, setSendingNotif] = useState(false)
  const [notifToast,  setNotifToast]  = useState<string | null>(null)
  const [toast,       setToast]       = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    loadData()
    return () => { cancelledRef.current = true }
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [instRes, payRes, leadRes, meetRes, contRes] = await Promise.all([
      supabase.from('institutions').select('id, name, plan, plan_status, created_at, city, state, monthly_value'),
      supabase.from('payments').select('id, status, amount, paid_at, due_date, institution_id, payment_type').order('created_at', { ascending: false }),
      supabase.from('crm_leads').select('id, school_name, stage, next_followup, monthly_value, updated_at').order('updated_at', { ascending: false }),
      supabase.from('onboarding_meetings').select('id, title, scheduled_at, status, type, institution_id, institutions(name)').eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(10),
      supabase.from('contracts').select('id, status, created_at, institution_id, monthly_value, institutions(name)').order('created_at', { ascending: false }).limit(8),
    ])
    if (cancelledRef.current) return
    setInstitutions(instRes.data || [])
    setPayments(payRes.data || [])
    setLeads(leadRes.data || [])
    setMeetings(meetRes.data || [])
    setContracts(contRes.data || [])
    setLoading(false)
  }

  // ── KPIs ──────────────────────────────────────────────────
  const mrr = payments
    .filter(p => p.status === 'paid' && isThisMonth(p.paid_at))
    .reduce((s, p) => s + (p.amount || 0), 0)

  const mrrProjected = institutions
    .filter(i => i.plan_status === 'active' && i.plan !== 'gratuito')
    .reduce((s, i) => s + (i.monthly_value || 550), 0)

  const activeSchools    = institutions.filter(i => i.plan_status === 'active').length
  const pendingSchools   = institutions.filter(i => ['pending_contract','pending_payment'].includes(i.plan_status)).length
  const overduePayments  = payments.filter(p => p.status === 'overdue')
  const overdueTotal     = overduePayments.reduce((s, p) => s + (p.amount || 0), 0)
  const activeLeads      = leads.filter(l => !['fechado','cliente'].includes(l.stage)).length
  const overdueLeads     = leads.filter(l => l.next_followup && new Date(l.next_followup) < new Date() && !['fechado','cliente'].includes(l.stage))
  const todayMeetings    = meetings.filter(m => isToday(m.scheduled_at))
  const mrrPipelineCRM   = leads.filter(l => l.monthly_value && !['cliente'].includes(l.stage)).reduce((s, l) => s + (l.monthly_value || 0), 0)

  // ── MRR chart últimos 6 meses ─────────────────────────────
  const now = new Date()
  const mrrChart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const monthPaid = payments.filter(p => {
      if (p.status !== 'paid' || !p.paid_at) return false
      const pd = new Date(p.paid_at)
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth()
    })
    return {
      month: d.toLocaleDateString('pt-BR', { month: 'short' }),
      mrr:   monthPaid.reduce((s, p) => s + (p.amount || 0), 0),
    }
  })

  // ── Leads por estágio ─────────────────────────────────────
  const stageChart = [
    { stage: 'Interesse',    n: leads.filter(l => l.stage === 'interesse').length    },
    { stage: 'Qualificação', n: leads.filter(l => l.stage === 'qualificacao').length },
    { stage: 'Proposta',     n: leads.filter(l => l.stage === 'proposta').length     },
    { stage: 'Negociação',   n: leads.filter(l => l.stage === 'negociacao').length   },
    { stage: 'Fechado',      n: leads.filter(l => l.stage === 'fechado').length      },
    { stage: 'Cliente',      n: leads.filter(l => l.stage === 'cliente').length      },
  ].filter(s => s.n > 0)

  // ── Alertas ───────────────────────────────────────────────
  const alerts: { msg: string; type: 'red' | 'amber' | 'blue'; path: string }[] = []
  if (overduePayments.length > 0)
    alerts.push({ msg: `${overduePayments.length} pagamento${overduePayments.length > 1 ? 's' : ''} em atraso (${fmtBRL(overdueTotal)})`, type: 'red', path: '/super-admin/financial' })
  if (overdueLeads.length > 0)
    alerts.push({ msg: `${overdueLeads.length} follow-up${overdueLeads.length > 1 ? 's' : ''} vencido${overdueLeads.length > 1 ? 's' : ''} no CRM`, type: 'amber', path: '/super-admin/crm' })
  if (pendingSchools > 0)
    alerts.push({ msg: `${pendingSchools} escola${pendingSchools > 1 ? 's' : ''} aguardando ativação`, type: 'blue', path: '/super-admin/schools' })
  if (todayMeetings.length > 0)
    alerts.push({ msg: `${todayMeetings.length} reunião${todayMeetings.length > 1 ? 'ões' : ''} hoje`, type: 'blue', path: '/super-admin/onboarding' })

  // ── Enviar notificação ────────────────────────────────────
  const handleSendNotif = async () => {
    if (!notifForm.title || !notifForm.message) return
    setSendingNotif(true)
    try {
      const targets = notifForm.target === 'all'
        ? institutions.map(i => i.id)
        : [notifForm.institutionId]
      for (const institutionId of targets) {
        await supabase.from('system_notifications').insert({
          institution_id: institutionId,
          type: 'suggestion',
          title: notifForm.title.trim(),
          message: notifForm.message.trim(),
          severity: 'info',
          action_url: null,
        })
      }
      setNotifToast(`Notificação enviada para ${targets.length} escola${targets.length > 1 ? 's' : ''}!`)
      setTimeout(() => {
        setNotifToast(null)
        setNotifModal(false)
        setNotifForm({ title: '', message: '', target: 'all', institutionId: '' })
      }, 2000)
    } catch { showToast('Erro ao enviar.') }
    finally { setSendingNotif(false) }
  }

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setNotifModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1A2B4A] text-white rounded-xl font-semibold text-sm shadow-sm hover:bg-[#243B60] transition-colors">
              <Bell className="w-4 h-4" /> Enviar notificação
            </button>
            <Link to="/super-admin/schools"
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:from-cyan-600 hover:to-blue-700">
              <Plus className="w-4 h-4" /> Nova escola
            </Link>
          </div>
        </div>

        {/* Alertas */}
        {!loading && alerts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {alerts.map((a, i) => (
              <button key={i} onClick={() => navigate(a.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all hover:shadow-sm w-full
                  ${a.type === 'red'   ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' :
                    a.type === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' :
                                         'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-semibold flex-1">{a.msg}</span>
                <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-60" />
              </button>
            ))}
          </div>
        )}

        {/* KPIs principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="MRR este mês"      value={fmtBRL(mrr)}        sub={`Projeção: ${fmtBRL(mrrProjected)}`}      icon={DollarSign}  grad="from-green-500 to-emerald-600" loading={loading} onClick={() => navigate('/super-admin/financial')} />
          <KpiCard label="Escolas ativas"    value={activeSchools}      sub={`${pendingSchools} pendente${pendingSchools !== 1 ? 's' : ''}`} icon={Building2}   grad="from-cyan-500 to-blue-600"    loading={loading} onClick={() => navigate('/super-admin/schools')} />
          <KpiCard label="Leads ativos"      value={activeLeads}        sub={`MRR pipeline: ${fmtBRL(mrrPipelineCRM)}`} icon={TrendingUp}  grad="from-indigo-500 to-violet-600" loading={loading} onClick={() => navigate('/super-admin/crm')} />
          <KpiCard label="Inadimplência"     value={fmtBRL(overdueTotal)} sub={`${overduePayments.length} pagamento${overduePayments.length !== 1 ? 's' : ''}`} icon={AlertTriangle} grad={overdueTotal > 0 ? "from-red-500 to-rose-600" : "from-gray-400 to-gray-500"} loading={loading} onClick={() => navigate('/super-admin/financial')} />
        </div>

        {/* KPIs secundários */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total escolas"     value={institutions.length}  icon={Building2}  grad="from-slate-500 to-gray-600"    loading={loading} />
          <KpiCard label="Reuniões hoje"     value={todayMeetings.length} sub={todayMeetings.length > 0 ? todayMeetings[0]?.title : undefined} icon={Calendar}   grad={todayMeetings.length > 0 ? "from-cyan-500 to-teal-500" : "from-gray-400 to-gray-500"} loading={loading} onClick={() => navigate('/super-admin/onboarding')} />
          <KpiCard label="Follow-ups vencidos" value={overdueLeads.length} icon={Clock}     grad={overdueLeads.length > 0 ? "from-amber-500 to-orange-500" : "from-gray-400 to-gray-500"} loading={loading} onClick={() => navigate('/super-admin/crm')} />
          <KpiCard label="Clientes CRM"      value={leads.filter(l => l.stage === 'cliente').length} sub={`${leads.filter(l => l.stage === 'fechado').length} fechados`} icon={Star} grad="from-purple-500 to-violet-600" loading={loading} onClick={() => navigate('/super-admin/crm')} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* MRR linha */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-gray-900">Receita — últimos 6 meses</h2>
                <p className="text-xs text-gray-400 mt-0.5">Pagamentos confirmados</p>
              </div>
              <Link to="/super-admin/financial" className="text-xs text-cyan-600 font-semibold hover:text-cyan-700 flex items-center gap-1">
                Ver financeiro <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {loading
              ? <div className="h-44 bg-gray-50 rounded-xl animate-pulse" />
              : <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={mrrChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => [fmtBRL(Number(v)), 'MRR']} />
                    <Line type="monotone" dataKey="mrr" stroke="#14b8a6" strokeWidth={3} dot={{ fill: '#14b8a6', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
            }
          </div>

          {/* Pipeline CRM */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-gray-900">Pipeline CRM</h2>
                <p className="text-xs text-gray-400 mt-0.5">Leads por estágio</p>
              </div>
              <Link to="/super-admin/crm" className="text-xs text-cyan-600 font-semibold hover:text-cyan-700">
                Ver CRM →
              </Link>
            </div>
            {loading
              ? <div className="h-44 bg-gray-50 rounded-xl animate-pulse" />
              : stageChart.length === 0
              ? <div className="h-44 flex items-center justify-center text-gray-300">
                  <div className="text-center">
                    <TrendingUp className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">Nenhum lead</p>
                  </div>
                </div>
              : <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stageChart} layout="vertical" barSize={14}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 10, fill: '#6b7280' }} width={75} />
                    <Tooltip />
                    <Bar dataKey="n" fill="#14b8a6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
            }
          </div>
        </div>

        {/* Linha 3: reuniões + contratos + ações rápidas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Próximas reuniões */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-500" />
                <h2 className="font-bold text-gray-900 text-sm">Próximas reuniões</h2>
              </div>
              <Link to="/super-admin/onboarding" className="text-xs text-cyan-600 font-semibold hover:text-cyan-700">
                Ver todas →
              </Link>
            </div>
            {loading
              ? <div className="p-5 space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}</div>
              : meetings.length === 0
              ? <div className="p-8 text-center text-gray-400">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">Nenhuma reunião agendada</p>
                </div>
              : <div className="divide-y divide-gray-50">
                  {meetings.slice(0, 5).map(m => {
                    const today = isToday(m.scheduled_at)
                    return (
                      <div key={m.id} className={`px-5 py-3 ${today ? 'bg-cyan-50' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{m.title}</p>
                            <p className="text-xs text-gray-400 truncate">{(m as any).institutions?.name}</p>
                          </div>
                          {today && <span className="text-[10px] font-bold px-2 py-0.5 bg-cyan-500 text-white rounded-full flex-shrink-0">HOJE</span>}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {new Date(m.scheduled_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>

          {/* Últimos contratos */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <h2 className="font-bold text-gray-900 text-sm">Últimos contratos</h2>
              </div>
              <Link to="/super-admin/contracts" className="text-xs text-cyan-600 font-semibold hover:text-cyan-700">
                Ver todos →
              </Link>
            </div>
            {loading
              ? <div className="p-5 space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}</div>
              : contracts.length === 0
              ? <div className="p-8 text-center text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">Nenhum contrato ainda</p>
                </div>
              : <div className="divide-y divide-gray-50">
                  {contracts.slice(0, 5).map(c => {
                    const st: Record<string, { l: string; c: string; bg: string }> = {
                      draft:     { l: 'Rascunho', c: '#6b7280', bg: '#f3f4f6' },
                      sent:      { l: 'Enviado',  c: '#d97706', bg: '#fffbeb' },
                      signed:    { l: 'Assinado', c: '#16a34a', bg: '#f0fdf4' },
                      cancelled: { l: 'Cancelado',c: '#dc2626', bg: '#fef2f2' },
                    }
                    const s = st[c.status] || st.draft
                    return (
                      <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{(c as any).institutions?.name || '—'}</p>
                          <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ color: s.c, background: s.bg }}>{s.l}</span>
                      </div>
                    )
                  })}
                </div>
            }
          </div>

          {/* Ações rápidas */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Ações rápidas
            </h2>
            <div className="space-y-2">
              {[
                { label: 'Nova escola',          icon: Building2,  path: '/super-admin/schools',    grad: 'from-cyan-500 to-blue-600' },
                { label: 'Novo lead CRM',        icon: TrendingUp, path: '/super-admin/crm',        grad: 'from-indigo-500 to-violet-600' },
                { label: 'Agendar reunião',      icon: Calendar,   path: '/super-admin/onboarding', grad: 'from-teal-500 to-cyan-600' },
                { label: 'Novo contrato',        icon: FileText,   path: '/super-admin/contracts',  grad: 'from-purple-500 to-violet-600' },
                { label: 'Ver financeiro',       icon: DollarSign, path: '/super-admin/financial',  grad: 'from-green-500 to-emerald-600' },
                { label: 'Enviar notificação',   icon: Bell,       path: null,                      grad: 'from-amber-500 to-orange-500', onClick: () => setNotifModal(true) },
              ].map(a => (
                a.path
                  ? <Link key={a.label} to={a.path}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${a.grad} flex items-center justify-center flex-shrink-0`}>
                        <a.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{a.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-400" />
                    </Link>
                  : <button key={a.label} onClick={a.onClick}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${a.grad} flex items-center justify-center flex-shrink-0`}>
                        <a.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{a.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-400" />
                    </button>
              ))}
            </div>
          </div>
        </div>

        {/* Últimos leads */}
        {!loading && leads.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                <h2 className="font-bold text-gray-900">Leads recentes</h2>
              </div>
              <Link to="/super-admin/crm" className="text-xs text-cyan-600 font-semibold hover:text-cyan-700 flex items-center gap-1">
                Ver todos no CRM <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Escola','Estágio','MRR proposto','Follow-up','Atualizado'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.slice(0, 6).map(l => {
                    const stageColors: Record<string, { c: string; bg: string }> = {
                      interesse:    { c: '#6366F1', bg: '#EEF2FF' },
                      qualificacao: { c: '#0891B2', bg: '#ECFEFF' },
                      proposta:     { c: '#D97706', bg: '#FFFBEB' },
                      negociacao:   { c: '#7C3AED', bg: '#F5F3FF' },
                      fechado:      { c: '#16A34A', bg: '#F0FDF4' },
                      cliente:      { c: '#00523C', bg: '#ECFDF5' },
                    }
                    const sc = stageColors[l.stage] || { c: '#6b7280', bg: '#f3f4f6' }
                    const overdue = l.next_followup && new Date(l.next_followup) < new Date()
                    return (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate('/super-admin/crm')}>
                        <td className="px-5 py-3 font-semibold text-gray-900 text-sm">{l.school_name}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize"
                            style={{ color: sc.c, background: sc.bg }}>{l.stage}</span>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">
                          {l.monthly_value ? fmtBRL(l.monthly_value) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          {l.next_followup
                            ? <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                                {overdue && '⚠️ '}{new Date(l.next_followup).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
                              </span>
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-400">{timeAgo(l.updated_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ── Modal notificação ── */}
      {notifModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Enviar notificação</h2>
              <button onClick={() => setNotifModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Título *</label>
                <input
                  className={inp}
                  placeholder="Ex: Nova funcionalidade disponível"
                  value={notifForm.title}
                  onChange={e => setNotifForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mensagem *</label>
                <textarea
                  rows={3}
                  className={inp + ' resize-none'}
                  placeholder="Descreva a notificação..."
                  value={notifForm.message}
                  onChange={e => setNotifForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Destinatário</label>
                <div className="flex gap-3 mb-3">
                  <button
                    onClick={() => setNotifForm(f => ({ ...f, target: 'all', institutionId: '' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${notifForm.target === 'all' ? 'border-[#00A896] bg-[#E6F7F5] text-[#00A896]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    Todas as escolas
                  </button>
                  <button
                    onClick={() => setNotifForm(f => ({ ...f, target: 'specific' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${notifForm.target === 'specific' ? 'border-[#00A896] bg-[#E6F7F5] text-[#00A896]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    Escola específica
                  </button>
                </div>
                {notifForm.target === 'specific' && (
                  <select
                    className={inp}
                    value={notifForm.institutionId}
                    onChange={e => setNotifForm(f => ({ ...f, institutionId: e.target.value }))}
                  >
                    <option value="">Selecione a escola...</option>
                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                )}
              </div>
              {notifToast && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 font-medium">
                  {notifToast}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setNotifModal(false)}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                disabled={!notifForm.title.trim() || !notifForm.message.trim() || (notifForm.target === 'specific' && !notifForm.institutionId) || sendingNotif}
                onClick={handleSendNotif}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#00A896] text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors hover:bg-[#008f81]"
              >
                {sendingNotif
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
                  : <><Bell className="w-4 h-4" /> Enviar</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </SuperAdminLayout>
  )
}