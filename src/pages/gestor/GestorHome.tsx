import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Users, TrendingUp, RefreshCw, AlertTriangle, BarChart3,
  Target, Sparkles, ArrowRight, Upload, MessageCircle, Info, Lock
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import CampaignGeneratorModal from '../../components/reports/CampaignGeneratorModal'
import type { FunnelMetrics } from '../../lib/supabase'

// ─── types ────────────────────────────────────────────────────────────────────
interface HistoricalEntry {
  detected_year?: number
  year?: number
  total_students?: number
  total?: number
  new_students?: number
  novatos?: number
  returning_students?: number
  veterans?: number
  avg_monthly_fee?: number
  fee?: number
  error?: boolean
}

interface CampaignCycle {
  id: string
  institution_id: string
  year: number
  label: string
  start_date: string
  end_date: string
  target_new_students: number
  target_reenrollment_rate: number
  base_students: number
  projected_cpa: number | null
  created_at: string
  campaign_start_month?: number | null
  erp_files?: HistoricalEntry[] | null
  historical_data?: HistoricalEntry[] | null
  status?: string | null
  applied_at?: string | null
}

interface StudentTransfer {
  id: string
  student_name: string
  course_grade: string
  transfer_date: string
  reason_category: string | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function calcCampaignTiming(startMonth = 8) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const campaignYear = currentYear + 1
  const campaignDate = new Date(currentYear, startMonth - 1, 1)
  const monthsUntil = Math.max(0,
    (campaignDate.getFullYear() - today.getFullYear()) * 12 +
    campaignDate.getMonth() - today.getMonth()
  )
  const campaignStartMonth = `${MONTH_NAMES_PT[startMonth - 1]}/${currentYear}`
  const totalPrepMonths = startMonth - 1
  const currentMonthIdx = today.getMonth()
  const preCampaignProgress = totalPrepMonths > 0
    ? Math.min(100, Math.max(0, Math.round((currentMonthIdx / totalPrepMonths) * 100)))
    : 100
  return { monthsUntil, campaignStartMonth, preCampaignProgress, campaignYear }
}

function fmt(n: number) { return new Intl.NumberFormat('pt-BR').format(n) }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const REASON_LABELS: Record<string, string> = {
  financial: 'Financeiro', pedagogical: 'Pedagógico', distance: 'Distância',
  competition: 'Outra escola', relocation: 'Mudança de cidade', other: 'Outro'
}

function entryYear(e: HistoricalEntry) { return e.detected_year ?? e.year ?? 0 }
function entryTotal(e: HistoricalEntry) { return e.total_students ?? e.total ?? 0 }
function entryNew(e: HistoricalEntry) { return e.new_students ?? e.novatos ?? 0 }
function entryReturning(e: HistoricalEntry) { return e.returning_students ?? e.veterans ?? 0 }

// ─── component ────────────────────────────────────────────────────────────────
export default function GestorHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const institutionId = user?.institution_id!

  const [loading, setLoading] = useState(true)
  const [cycles, setCycles] = useState<CampaignCycle[]>([])
  const [funnelData, setFunnelData] = useState<FunnelMetrics[]>([])
  const [transfers, setTransfers] = useState<StudentTransfer[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showModalAtStep, setShowModalAtStep] = useState<number | undefined>(undefined)
  const [btnTooltip, setBtnTooltip] = useState(false)

  useEffect(() => {
    if (!institutionId) return
    load()
  }, [institutionId])

  async function load() {
    setLoading(true)
    try {
      const [cyclesRes, funnelRes, transferRes] = await Promise.all([
        supabase
          .from('campaign_cycles')
          .select('*')
          .eq('institution_id', institutionId)
          .order('created_at', { ascending: false }),
        supabase
          .from('funnel_metrics')
          .select('*')
          .eq('institution_id', institutionId)
          .order('created_at', { ascending: true }),
        supabase
          .from('student_transfers')
          .select('id, student_name, course_grade, transfer_date, reason_category')
          .eq('institution_id', institutionId)
          .order('transfer_date', { ascending: false })
          .limit(5),
      ])
      setCycles((cyclesRes.data ?? []) as CampaignCycle[])
      setFunnelData(funnelRes.data ?? [])
      setTransfers((transferRes.data ?? []) as StudentTransfer[])
    } finally {
      setLoading(false)
    }
  }

  // ─── derived data ─────────────────────────────────────────────────────────
  const activeCycle = cycles.find(c => c.status === 'active' || !!c.applied_at) ?? null
  const anyCycle = cycles[0] ?? null

  // cascade: prefer historical_data (normalized), fallback to erp_files
  const cycleWithHistory = cycles.find(c =>
    c.historical_data && Array.isArray(c.historical_data) && c.historical_data.length > 0
  )
  const cycleWithErp = cycles.find(c =>
    c.erp_files && Array.isArray(c.erp_files) && (c.erp_files as HistoricalEntry[]).filter(f => !f.error).length > 0
  )
  const historicalSource = (
    cycleWithHistory?.historical_data ??
    (cycleWithErp?.erp_files as HistoricalEntry[] | null | undefined) ??
    []
  ).filter(e => !e.error)

  const sorted = [...historicalSource].sort((a, b) => entryYear(a) - entryYear(b))
  const latest = sorted[sorted.length - 1] ?? null
  const previous = sorted[sorted.length - 2] ?? null

  const totalStudents = latest ? entryTotal(latest) : 0
  const newStudents = latest ? entryNew(latest) : 0
  const returningStudents = latest ? entryReturning(latest) : 0
  const avgFee = latest?.avg_monthly_fee ?? latest?.fee ?? null
  const latestYear = latest ? entryYear(latest) : null

  const totalVariation = previous && entryTotal(previous) > 0
    ? +((totalStudents - entryTotal(previous)) / entryTotal(previous) * 100).toFixed(1)
    : null
  const newVariation = previous && entryNew(previous) > 0
    ? +((newStudents - entryNew(previous)) / entryNew(previous) * 100).toFixed(1)
    : null

  const chartData = sorted.map(d => ({
    year: String(entryYear(d)),
    novatos: entryNew(d),
    veteranos: entryReturning(d),
  }))

  const hasHistory = sorted.length > 0
  const campaignStartMonth = activeCycle?.campaign_start_month ?? anyCycle?.campaign_start_month ?? 8
  const { monthsUntil, campaignStartMonth: campaignStartLabel, preCampaignProgress, campaignYear } =
    calcCampaignTiming(campaignStartMonth)

  // funnel for "Campanha em andamento" section
  const latestFunnel = funnelData[funnelData.length - 1] ?? null
  const funnelHasData = funnelData.some(f => (f.registrations || 0) > 0)

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>
            {greeting()}, {user?.full_name?.split(' ')[0] || 'Gestor'}
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '3px 0 0' }}>
            {user?.institution_name || 'Sua escola'} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Campaign button — disabled until admin unlocks */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => !activeCycle && setBtnTooltip(true)}
          onMouseLeave={() => setBtnTooltip(false)}
        >
          <button
            onClick={() => activeCycle && setShowModal(true)}
            disabled={!activeCycle}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10,
              background: activeCycle ? '#f0fdf4' : '#f1f5f9',
              color: activeCycle ? '#065f46' : '#94a3b8',
              border: activeCycle ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              fontSize: 13, fontWeight: 600,
              cursor: activeCycle ? 'pointer' : 'not-allowed',
            }}>
            {activeCycle ? <Sparkles size={14} /> : <Lock size={14} />}
            {activeCycle ? 'Ajustar campanha' : 'Campanha bloqueada'}
          </button>
          {btnTooltip && !activeCycle && (
            <div style={{
              position: 'absolute', right: 0, top: '110%', zIndex: 999,
              background: '#1e2d6b', color: 'white', fontSize: 12, lineHeight: 1.4,
              padding: '8px 12px', borderRadius: 8, whiteSpace: 'nowrap', maxWidth: 260,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}>
              Seu administrador liberará a configuração<br />da campanha quando chegar o momento certo.
              <div style={{
                position: 'absolute', right: 18, bottom: '100%',
                borderWidth: '5px', borderStyle: 'solid',
                borderColor: 'transparent transparent #1e2d6b transparent',
              }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Empty state: sem histórico ──────────────────────────────────────── */}
      {!loading && !hasHistory && (
        <div style={{
          background: '#fff', borderRadius: 16, border: '2px dashed #cbd5e1',
          padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 14, textAlign: 'center',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={26} color="#8B5CF6" />
          </div>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>
              Bem-vindo ao Inscribo
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', maxWidth: 440, lineHeight: 1.6 }}>
              Para começar, importe os relatórios de matrículas dos últimos anos do seu sistema ERP (SIGA, Totvs ou similar). Isso leva menos de 2 minutos e permite que a IA analise o histórico da sua escola.
            </p>
          </div>
          <button
            onClick={() => { setShowModalAtStep(2); setShowModal(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 22px', borderRadius: 10,
              background: '#8B5CF6', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
            <Upload size={15} /> Importar histórico agora
          </button>
        </div>
      )}

      {/* ── KPI cards ───────────────────────────────────────────────────────── */}
      {!loading && hasHistory && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCard
            label={`Alunos ${latestYear ?? ''}`}
            value={fmt(totalStudents)}
            icon={<Users size={20} color="#00A896" />}
            iconBg="#E6F7F5"
            variation={totalVariation}
          />
          <KpiCard
            label="Novatos"
            value={fmt(newStudents)}
            icon={<TrendingUp size={20} color="#8B5CF6" />}
            iconBg="#EDE9FE"
            variation={newVariation}
            sub={totalStudents > 0 ? `${Math.round((newStudents / totalStudents) * 100)}% do total` : undefined}
          />
          <KpiCard
            label="Veteranos"
            value={fmt(returningStudents)}
            icon={<RefreshCw size={20} color="#0EA5E9" />}
            iconBg="#E0F2FE"
            sub={totalStudents > 0 ? `${Math.round((returningStudents / totalStudents) * 100)}% do total` : undefined}
          />
          <KpiCard
            label="Ticket médio"
            value={avgFee ? `R$ ${fmt(Math.round(avgFee))}/mês` : 'Não informado'}
            icon={<Target size={20} color="#F59E0B" />}
            iconBg="#FEF3C7"
          />
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px', height: 90 }} className="animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Chart + Pre-campaign ────────────────────────────────────────────── */}
      {hasHistory && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

          {/* Histórico anual */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>
              Histórico de alunos por ano
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
                <Tooltip
                  formatter={(val) => fmt(Number(val))}
                  contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="novatos" name="Novatos" stackId="a" fill="#8B5CF6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="veteranos" name="Veteranos" stackId="a" fill="#00A896" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Fase pré-campanha */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>
              Fase pré-campanha
            </h3>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Progresso de preparação</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#00A896' }}>{preCampaignProgress}%</span>
              </div>
              <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${preCampaignProgress}%`, background: 'linear-gradient(90deg, #00A896, #0DD3BF)', borderRadius: 99 }} />
              </div>
            </div>

            <div style={{ background: '#f0fdf9', borderRadius: 10, padding: 14 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                {monthsUntil === 0
                  ? `Campanha iniciando em ${campaignStartLabel}`
                  : `${monthsUntil} ${monthsUntil === 1 ? 'mês' : 'meses'} para a campanha`}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#047857' }}>
                Preparando ano letivo {campaignYear}
              </p>
            </div>

            {!activeCycle && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', gap: 8 }}>
                <Info size={14} color="#64748b" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  O administrador liberará a campanha quando chegar o momento de configurar.
                </p>
              </div>
            )}

            {activeCycle && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#1e40af', fontWeight: 600 }}>{activeCycle.label}</p>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: '#3b82f6' }}>
                  Meta: {fmt(activeCycle.target_new_students)} novos alunos
                </p>
              </div>
            )}

            <button
              onClick={() => navigate('/reports')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 0', borderRadius: 8,
                background: 'none', border: '1px solid #e2e8f0',
                color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
              Ver relatórios completos <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── Campanha em andamento ────────────────────────────────────────────── */}
      {activeCycle && funnelHasData && latestFunnel && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>
                Campanha em andamento
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Período: {latestFunnel.period}</p>
            </div>
            <button
              onClick={() => navigate('/reports')}
              style={{ fontSize: 12, color: '#00A896', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Ver funil completo →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Cadastros', val: latestFunnel.registrations, target: latestFunnel.registrations_target },
              { label: 'Agendas', val: latestFunnel.schedules, target: latestFunnel.schedules_target },
              { label: 'Visitas', val: latestFunnel.visits, target: latestFunnel.visits_target },
              { label: 'Matrículas', val: latestFunnel.enrollments, target: latestFunnel.enrollments_target },
            ].map(({ label, val, target }) => {
              const pct = target > 0 ? Math.round((val / target) * 100) : null
              const color = pct === null ? '#94a3b8' : pct >= 100 ? '#0d9488' : pct >= 75 ? '#f59e0b' : '#dc2626'
              return (
                <div key={label} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                  <p style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700, color: '#1e2d6b' }}>{fmt(val)}</p>
                  {target > 0 && (
                    <p style={{ margin: 0, fontSize: 11, color }}>
                      {pct}% da meta ({fmt(target)})
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Transfers + Quick access ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Transferências recentes */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Transferências recentes</h3>
            <button
              onClick={() => navigate('/reports')}
              style={{ fontSize: 11, color: '#00A896', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Ver todas →
            </button>
          </div>
          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Carregando...</div>
          ) : transfers.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0', color: '#94a3b8' }}>
              <AlertTriangle size={28} strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: 13 }}>Nenhuma transferência registrada</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {transfers.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#fafafa', border: '1px solid #f1f5f9' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#FFE4E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={14} color="#F43F5E" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.student_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
                      {t.course_grade} · {t.reason_category ? REASON_LABELS[t.reason_category] || t.reason_category : 'Sem motivo'}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
                    {new Date(t.transfer_date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acesso rápido */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 14px' }}>Acesso rápido</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Leads', desc: 'Funil de captação', icon: <Users size={18} color="#8B5CF6" />, bg: '#EDE9FE', path: '/leads' },
              { label: 'Visitas', desc: 'Agendar e acompanhar', icon: <BarChart3 size={18} color="#F59E0B" />, bg: '#FEF3C7', path: '/visits' },
              { label: 'WhatsApp', desc: 'Central de mensagens', icon: <MessageCircle size={18} color="#10B981" />, bg: '#D1FAE5', path: '/whatsapp' },
              { label: 'Relatórios', desc: 'Análise completa', icon: <TrendingUp size={18} color="#3B82F6" />, bg: '#DBEAFE', path: '/reports' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '12px 14px', borderRadius: 12, background: item.bg, border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {item.icon}
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Campaign modal */}
      <CampaignGeneratorModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setShowModalAtStep(undefined) }}
        onApply={() => { load(); setShowModal(false) }}
        existingCycle={activeCycle as Parameters<typeof CampaignGeneratorModal>[0]['existingCycle']}
        institutionId={institutionId}
        institutionName={user?.institution_name || 'Escola'}
        openAtStep={showModalAtStep}
      />
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, iconBg, variation, sub }: {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  variation?: number | null
  sub?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1e2d6b', lineHeight: 1.1 }}>{value}</div>
      {variation !== null && variation !== undefined && (
        <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: variation >= 0 ? '#f0fdf4' : '#fef2f2', color: variation >= 0 ? '#16a34a' : '#dc2626' }}>
          {variation >= 0 ? '↑' : '↓'} {Math.abs(variation)}% vs. ano anterior
        </div>
      )}
      {sub && !variation && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>{sub}</p>}
    </div>
  )
}
