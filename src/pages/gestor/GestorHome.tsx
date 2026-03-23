import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Users, TrendingUp, RefreshCw, AlertTriangle, BarChart3,
  Target, Sparkles, ArrowRight, Upload, MessageCircle
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import CampaignGeneratorModal from '../../components/reports/CampaignGeneratorModal'

// ─── types ────────────────────────────────────────────────────────────────────
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
  erp_files?: ErpFileEntry[] | null
  status?: string | null
  applied_at?: string | null
}

interface ErpFileEntry {
  name: string
  year: number
  total: number
  novatos: number
  veterans: number
  fee?: number
  error?: boolean
}

interface StudentTransfer {
  id: string
  student_name: string
  course_grade: string
  transfer_date: string
  reason_category: string | null
  ai_diagnosis: string | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function calcCampaignTiming(startMonth = 8) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const executionYear = currentYear
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
  return { monthsUntil, campaignStartMonth, preCampaignProgress, campaignYear, executionYear }
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

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

// ─── component ────────────────────────────────────────────────────────────────
export default function GestorHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const institutionId = user?.institution_id!

  const [loading, setLoading] = useState(true)
  const [cycle, setCycle] = useState<CampaignCycle | null>(null)
  const [transfers, setTransfers] = useState<StudentTransfer[]>([])
  const [showModal, setShowModal] = useState(false)

  // derived ERP metrics from latest cycle
  const erpFiles: ErpFileEntry[] = (cycle?.erp_files as ErpFileEntry[] | null | undefined) ?? []
  const latestErp = erpFiles.filter(f => !f.error).sort((a, b) => b.year - a.year)[0] ?? null

  const currentStudents = latestErp?.total ?? 0
  const currentNovatos = latestErp?.novatos ?? 0
  const currentVeterans = latestErp?.veterans ?? 0
  const avgFee = latestErp?.fee ?? 0

  // historical chart data — all valid ERP entries sorted ascending
  const chartData = erpFiles
    .filter(f => !f.error)
    .sort((a, b) => a.year - b.year)
    .map(f => ({
      ano: String(f.year),
      'Alunos Ativos': f.total,
      'Novatos': f.novatos,
      'Veteranos': f.veterans,
    }))

  const { monthsUntil, campaignStartMonth, preCampaignProgress, campaignYear } =
    calcCampaignTiming(cycle?.campaign_start_month ?? 8)

  useEffect(() => {
    if (!institutionId) return
    load()
  }, [institutionId])

  async function load() {
    setLoading(true)
    try {
      const [cycleRes, transferRes] = await Promise.all([
        supabase
          .from('campaign_cycles')
          .select('*')
          .eq('institution_id', institutionId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('student_transfers')
          .select('id, student_name, course_grade, transfer_date, reason_category, ai_diagnosis')
          .eq('institution_id', institutionId)
          .order('transfer_date', { ascending: false })
          .limit(5),
      ])

      if (cycleRes.data) setCycle(cycleRes.data as CampaignCycle)
      if (transferRes.data) setTransfers(transferRes.data as StudentTransfer[])
    } finally {
      setLoading(false)
    }
  }

  const cycleIsActive = !!cycle?.applied_at

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>

      {/* ── A: Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>
            {greeting()}, {user?.full_name?.split(' ')[0] || 'Gestor'}
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '3px 0 0' }}>
            {user?.institution_name || 'Sua escola'} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 10,
            background: cycleIsActive ? '#f0fdf4' : '#00A896',
            color: cycleIsActive ? '#065f46' : '#fff',
            border: cycleIsActive ? '1px solid #bbf7d0' : 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
          <Sparkles size={14} />
          {cycleIsActive ? 'Ajustar campanha' : 'Gerar campanha'}
        </button>
      </div>

      {/* ── B: KPI cards ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard
          label="Alunos ativos"
          value={loading ? '—' : fmt(currentStudents)}
          icon={<Users size={20} color="#00A896" />}
          iconBg="#E6F7F5"
          sub={latestErp ? `Ano letivo ${latestErp.year}` : 'Sem dados ERP'}
        />
        <KpiCard
          label="Novatos"
          value={loading ? '—' : fmt(currentNovatos)}
          icon={<TrendingUp size={20} color="#8B5CF6" />}
          iconBg="#EDE9FE"
          sub={currentStudents > 0 ? `${Math.round((currentNovatos / currentStudents) * 100)}% do total` : ''}
        />
        <KpiCard
          label="Veteranos"
          value={loading ? '—' : fmt(currentVeterans)}
          icon={<RefreshCw size={20} color="#0EA5E9" />}
          iconBg="#E0F2FE"
          sub={currentStudents > 0 ? `${Math.round((currentVeterans / currentStudents) * 100)}% do total` : ''}
        />
        <KpiCard
          label="Ticket médio"
          value={loading ? '—' : avgFee > 0 ? fmtCurrency(avgFee) : 'Sem dados'}
          icon={<Target size={20} color="#F59E0B" />}
          iconBg="#FEF3C7"
          sub="Mensalidade média"
        />
      </div>

      {/* ── C + D: Chart + Pre-campaign ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* Histórico ERP */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>
            Histórico de alunos por ano
          </h3>
          {loading ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
              Carregando...
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#94a3b8' }}>
              <Upload size={32} strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: 13 }}>Importe dados ERP para ver o histórico</p>
              <button
                onClick={() => navigate('/reports')}
                style={{ fontSize: 12, color: '#00A896', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Ir para Relatórios →
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="ano" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
                <Tooltip
                  formatter={(val: number) => fmt(val)}
                  contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Novatos" stackId="a" fill="#8B5CF6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Veteranos" stackId="a" fill="#00A896" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pre-campaign phase */}
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
              <div style={{ height: '100%', width: `${preCampaignProgress}%`, background: 'linear-gradient(90deg, #00A896, #0DD3BF)', borderRadius: 99, transition: 'width 0.5s' }} />
            </div>
          </div>

          <div style={{ background: '#f0fdf9', borderRadius: 10, padding: 14 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#065f46' }}>
              {monthsUntil === 0
                ? `Campanha iniciando em ${campaignStartMonth}`
                : `${monthsUntil} ${monthsUntil === 1 ? 'mês' : 'meses'} para a campanha`}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#047857' }}>
              Preparando ano letivo {campaignYear}
            </p>
          </div>

          {!cycleIsActive && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                Campanha não configurada
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#b45309' }}>
                Gere sua campanha com IA para definir metas e estratégias.
              </p>
            </div>
          )}

          {cycleIsActive && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#1e40af', fontWeight: 600 }}>
                {cycle!.label}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#3b82f6' }}>
                Meta: {fmt(cycle!.target_new_students)} novos alunos
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

      {/* ── E + F: Transfers + Quick access ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Transferências recentes */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>
              Transferências recentes
            </h3>
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
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: '#fafafa', border: '1px solid #f1f5f9',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: '#FFE4E6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <AlertTriangle size={14} color="#F43F5E" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.student_name}
                    </p>
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
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 14px' }}>
            Acesso rápido
          </h3>
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
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 6, padding: '12px 14px', borderRadius: 12,
                  background: item.bg, border: 'none', cursor: 'pointer',
                  textAlign: 'left', transition: 'opacity 0.15s',
                }}
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

      {/* ── G: Campaign modal ──────────────────────────────────────────────── */}
      <CampaignGeneratorModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onApply={() => { load(); setShowModal(false) }}
        existingCycle={cycle as Parameters<typeof CampaignGeneratorModal>[0]['existingCycle']}
        institutionId={institutionId}
        institutionName={user?.institution_name || 'Escola'}
      />
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, iconBg, sub }: {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  sub?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1e2d6b', lineHeight: 1.1 }}>{value}</div>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>{sub}</p>}
    </div>
  )
}
