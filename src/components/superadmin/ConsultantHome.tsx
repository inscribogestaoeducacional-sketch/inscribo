// src/components/superadmin/ConsultantHome.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  Building2, Users, TrendingUp, Calendar,
  ArrowRight, Clock, CheckCircle2, AlertCircle, DollarSign
} from 'lucide-react'

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

const COMMISSION_TYPE_MAP: Record<string, string> = { implantacao: 'Implantação', mensalidade: 'Mensalidade' }
const COMMISSION_STATUS_MAP: Record<string, { l: string; c: string; bg: string }> = {
  pendente:  { l: 'Pendente',  c: '#d97706', bg: '#fffbeb' },
  paga:      { l: 'Paga',      c: '#16a34a', bg: '#f0fdf4' },
  cancelada: { l: 'Cancelada', c: '#9ca3af', bg: '#f9fafb' },
}

export default function ConsultantHome() {
  const { user } = useAuth()
  const [schools, setSchools]         = useState<any[]>([])
  const [leads, setLeads]             = useState<any[]>([])
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [schRes, leadRes, commRes] = await Promise.all([
        supabase.from('institutions')
          .select('id, name, city, state, plan_status, created_at')
          .eq('consultant_id', user?.id || '')
          .order('name'),
        supabase.from('crm_leads')
          .select('id, school_name, stage, next_followup, updated_at')
          .eq('consultant_id', user?.id || '')
          .not('stage', 'in', '(cliente)')
          .order('updated_at', { ascending: false })
          .limit(10),
        supabase.from('consultant_commissions')
          .select('*, institutions(name)')
          .eq('consultant_id', user?.id || '')
          .order('created_at', { ascending: false }),
      ])
      setSchools(schRes.data || [])
      setLeads(leadRes.data  || [])
      setCommissions(commRes.data || [])
      setLoading(false)
    }
    if (user?.id) load()
  }, [user?.id])

  const commissionsPending = commissions.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.amount || 0), 0)
  const commissionsPaid    = commissions.filter(c => c.status === 'paga').reduce((s, c) => s + (c.amount || 0), 0)

  const overdueLeads = leads.filter(l =>
    l.next_followup && new Date(l.next_followup) < new Date()
  )

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Minhas escolas',    value: schools.length,       icon: Building2,   color: 'text-cyan-600',   bg: 'bg-cyan-50'   },
            { label: 'Leads ativos',      value: leads.length,         icon: TrendingUp,  color: 'text-blue-600',   bg: 'bg-blue-50'   },
            { label: 'Follow-ups vencidos', value: overdueLeads.length, icon: AlertCircle, color: overdueLeads.length > 0 ? 'text-red-600' : 'text-gray-400', bg: overdueLeads.length > 0 ? 'bg-red-50' : 'bg-gray-50' },
            { label: 'Escolas ativas',    value: schools.filter(s => s.plan_status === 'active').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
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
                <p className="text-2xl font-bold text-gray-900">{loading ? '—' : k.value}</p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Minhas escolas */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Minhas escolas</h2>
              <Link to="/super-admin/consultant/schools"
                className="text-xs text-cyan-600 font-semibold hover:text-cyan-700 flex items-center gap-1">
                Ver todas <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {Array(3).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : schools.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Nenhuma escola vinculada</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {schools.slice(0, 6).map(s => {
                  const active = s.plan_status === 'active'
                  return (
                    <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-cyan-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.city}{s.state ? `/${s.state}` : ''}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0
                        ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {active ? 'Ativa' : s.plan_status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Leads recentes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Leads no pipeline</h2>
              <Link to="/super-admin/crm"
                className="text-xs text-cyan-600 font-semibold hover:text-cyan-700 flex items-center gap-1">
                Ver CRM <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {Array(3).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : leads.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Nenhum lead ativo</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {leads.map(l => {
                  const overdue = l.next_followup && new Date(l.next_followup) < new Date()
                  return (
                    <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{l.school_name}</p>
                        {l.next_followup && (
                          <p className={`text-xs flex items-center gap-1 mt-0.5
                            ${overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                            <Clock className="w-3 h-3" />
                            {overdue ? 'Vencido: ' : 'Follow-up: '}
                            {fmtDate(l.next_followup)}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 flex-shrink-0 capitalize">
                        {l.stage}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        {/* Minhas comissões — somente leitura */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-gray-900">Minhas comissões</h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-amber-600 font-semibold">{fmtBRL(commissionsPending)} pendente</span>
              <span className="text-green-600 font-semibold">{fmtBRL(commissionsPaid)} paga</span>
            </div>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array(3).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : commissions.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">Nenhuma comissão lançada ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {commissions.map(c => {
                const st = COMMISSION_STATUS_MAP[c.status] || COMMISSION_STATUS_MAP.pendente
                return (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {COMMISSION_TYPE_MAP[c.type] || c.type} {(c as any).institutions?.name ? `— ${(c as any).institutions.name}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.payment_date ? `Pago em ${fmtDate(c.payment_date)}` : 'Ainda não paga'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-gray-700">{fmtBRL(c.amount)}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: st.c, background: st.bg }}>{st.l}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  )
}