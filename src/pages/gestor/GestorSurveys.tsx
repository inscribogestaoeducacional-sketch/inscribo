import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  ClipboardList, Plus, Copy, Eye, Brain, X, Check, AlertTriangle,
  MoreVertical, Star, Users, TrendingUp, BarChart3,
} from 'lucide-react'

// ─── tipos ──────────────────────────────────────────────────
interface Survey {
  id: string
  institution_id: string
  title: string
  description: string | null
  require_identification: boolean
  status: 'draft' | 'active' | 'closed'
  survey_token: string
  created_by: string | null
  created_at: string
  closed_at: string | null
  response_count: number
}

interface SurveyResponse {
  id: string
  survey_id: string
  institution_id: string
  respondent_name: string | null
  respondent_grade: string | null
  answers: Record<string, number | string>
  ai_analysis: Record<string, unknown> | null
  created_at: string
}

interface AiReport {
  overall_score: number
  summary: string
  strengths: string[]
  weaknesses: string[]
  reenrollment_risk: string
  reenrollment_analysis: string
  priority_actions: string[]
  retention_opportunities: string
}

// ─── utils ──────────────────────────────────────────────────
function fmt(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function avg(nums: number[]) {
  const valid = nums.filter(n => typeof n === 'number' && !isNaN(n))
  return valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : 0
}

function scaleToTen(val: number) {
  return Math.round(((val - 1) / 4) * 10 * 10) / 10
}

const REENROLL_OPTIONS = [
  'Com certeza vou rematricular',
  'Provavelmente sim',
  'Ainda não decidi',
  'Provavelmente não',
  'Não vou rematricular',
]

const PIE_COLORS = ['#10B981', '#6EE7B7', '#FCD34D', '#F97316', '#EF4444']

// ─── estilos ─────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'white', borderRadius: 16, padding: 24,
  border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
}

const btn = (bg: string, color = 'white'): React.CSSProperties => ({
  padding: '9px 18px', borderRadius: 10, border: 'none',
  background: bg, color, fontWeight: 600, fontSize: 13,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
})

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1.5px solid #E2E8F0', fontSize: 14, color: '#1A2B4A',
  outline: 'none', boxSizing: 'border-box', background: 'white',
}

// ─── componente ──────────────────────────────────────────────
export default function GestorSurveys() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!

  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // modais
  const [showNewModal, setShowNewModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState<{ survey: Survey } | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // form nova pesquisa
  const [form, setForm] = useState({ title: '', description: '', askId: false, requireId: false })
  const [saving, setSaving] = useState(false)

  // painel de respostas
  const [viewingSurvey, setViewingSurvey] = useState<Survey | null>(null)
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loadingResponses, setLoadingResponses] = useState(false)

  // relatório IA
  const [aiReport, setAiReport] = useState<AiReport | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('satisfaction_surveys')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
    setSurveys(data ?? [])
    setLoading(false)
  }

  async function createSurvey() {
    if (!form.title.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('satisfaction_surveys')
      .insert({
        institution_id: institutionId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        require_identification: form.askId,
        status: 'active',
        created_by: user?.full_name ?? null,
      })
      .select()
      .single()

    setSaving(false)
    if (error || !data) { showToast('Erro ao criar pesquisa.'); return }

    setShowNewModal(false)
    setForm({ title: '', description: '', askId: false, requireId: false })
    await load()
    setShowLinkModal({ survey: data })
  }

  async function closeSurvey(id: string) {
    await supabase.from('satisfaction_surveys').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id)
    showToast('Pesquisa encerrada.')
    load()
  }

  async function deleteSurvey(id: string, responseCount: number) {
    if (!confirm(`Tem certeza? ${responseCount > 0 ? `${responseCount} resposta(s) será(ão) perdida(s).` : 'Esta ação não pode ser desfeita.'}`)) return
    await supabase.from('satisfaction_responses').delete().eq('survey_id', id)
    await supabase.from('satisfaction_surveys').delete().eq('id', id)
    showToast('Pesquisa excluída.')
    load()
  }

  function surveyLink(token: string) {
    return `${window.location.origin}/satisfaction/${token}`
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(surveyLink(token))
    showToast('Link copiado para a área de transferência.')
    setOpenMenu(null)
  }

  async function openResponses(survey: Survey) {
    setViewingSurvey(survey)
    setLoadingResponses(true)
    const { data } = await supabase
      .from('satisfaction_responses')
      .select('*')
      .eq('survey_id', survey.id)
      .order('created_at', { ascending: false })
    setResponses(data ?? [])
    setLoadingResponses(false)
  }

  async function generateReport(survey: Survey) {
    if (responses.length === 0) { showToast('Sem respostas para gerar relatório.'); return }
    setGeneratingReport(true)
    setShowReportModal(true)

    const { data: inst } = await supabase
      .from('institutions').select('name').eq('id', institutionId).maybeSingle()

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'survey_report',
          payload: {
            responses,
            surveyTitle: survey.title,
            institutionName: inst?.name ?? 'Escola',
          },
        }),
      })
      const json = await res.json()
      if (json.result) setAiReport(json.result)
      else showToast('Erro ao gerar relatório.')
    } catch {
      showToast('Erro ao gerar relatório.')
    }
    setGeneratingReport(false)
  }

  // ─── KPIs ─────────────────────────────────────────────────
  const total = surveys.length
  const active = surveys.filter(s => s.status === 'active').length
  const totalResponses = surveys.reduce((sum, s) => sum + (s.response_count ?? 0), 0)
  const avgResponses = total > 0 ? Math.round(totalResponses / total) : 0

  const kpis = [
    { label: 'Total de pesquisas', value: total, Icon: ClipboardList, color: '#F97316', bg: '#FFF7ED' },
    { label: 'Pesquisas ativas',   value: active, Icon: TrendingUp,   color: '#10B981', bg: '#F0FDF4' },
    { label: 'Total de respostas', value: totalResponses, Icon: Users, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Média por pesquisa', value: avgResponses, Icon: BarChart3, color: '#8B5CF6', bg: '#EDE9FE' },
  ]

  function StatusBadge({ status }: { status: Survey['status'] }) {
    const cfg = {
      draft:  { label: 'Rascunho', bg: '#F1F5F9', color: '#64748B' },
      active: { label: 'Ativa',    bg: '#D1FAE5', color: '#065F46' },
      closed: { label: 'Encerrada', bg: '#DBEAFE', color: '#1E40AF' },
    }[status]
    return (
      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
        {cfg.label}
      </span>
    )
  }

  // ─── PAINEL DE RESPOSTAS ───────────────────────────────────
  if (viewingSurvey) {
    const avgGeneral       = avg(responses.map(r => r.answers.general as number))
    const avgTeaching      = avg(responses.map(r => r.answers.teaching as number))
    const avgComm          = avg(responses.map(r => r.answers.communication as number))
    const avgInfra         = avg(responses.map(r => r.answers.infrastructure as number))
    const avgCost          = avg(responses.map(r => r.answers.cost_benefit as number))
    const overallAvg       = avg([avgGeneral, avgTeaching, avgComm, avgInfra, avgCost])
    const overallScore10   = scaleToTen(overallAvg)

    const barData = [
      { name: 'Satisfação geral', value: avgGeneral },
      { name: 'Ensino',           value: avgTeaching },
      { name: 'Atendimento',      value: avgComm },
      { name: 'Infraestrutura',   value: avgInfra },
      { name: 'Custo-benefício',  value: avgCost },
    ]

    const pieData = REENROLL_OPTIONS.map((opt, i) => ({
      name: opt,
      value: responses.filter(r => r.answers.reenrollment === opt).length,
      color: PIE_COLORS[i],
    })).filter(d => d.value > 0)

    const evasionRisk = responses.filter(r =>
      r.answers.reenrollment === 'Provavelmente não' ||
      r.answers.reenrollment === 'Não vou rematricular'
    ).length

    const undecided = responses.filter(r => r.answers.reenrollment === 'Ainda não decidi').length

    const scoreColor = overallScore10 >= 8 ? '#10B981' : overallScore10 >= 6 ? '#F59E0B' : '#EF4444'

    return (
      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button
            onClick={() => setViewingSurvey(null)}
            style={{ ...btn('#F1F5F9', '#374151'), padding: '8px 14px' }}
          >
            ← Voltar
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{viewingSurvey.title}</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>
              {responses.length} resposta{responses.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => generateReport(viewingSurvey)}
            style={btn('#8B5CF6')}
          >
            <Brain size={15} /> Gerar relatório IA
          </button>
        </div>

        {loadingResponses ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#94A3B8' }}>Carregando respostas...</div>
        ) : responses.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 64 }}>
            <ClipboardList size={40} color="#CBD5E1" style={{ margin: '0 auto 16px', display: 'block' }} />
            <p style={{ color: '#94A3B8', fontSize: 15 }}>Nenhuma resposta ainda.</p>
            <p style={{ color: '#CBD5E1', fontSize: 13, marginTop: 4 }}>Compartilhe o link da pesquisa com as famílias.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Seção A — Resumo visual */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
              {/* nota geral */}
              <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: 0 }}>Nota geral</p>
                <div style={{ fontSize: 56, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
                  {overallScore10.toFixed(1)}
                </div>
                <p style={{ fontSize: 14, color: '#94A3B8', margin: 0 }}>de 10</p>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={16} fill={s <= Math.round(overallAvg) ? scoreColor : 'none'} color={scoreColor} />
                  ))}
                </div>
              </div>

              {/* barras por categoria */}
              <div style={card}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 16, marginTop: 0 }}>Média por categoria (1–5)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                    <RTooltip formatter={(v) => typeof v === 'number' ? v.toFixed(1) : v} />
                    <Bar dataKey="value" fill="#F97316" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* pizza rematrícula */}
            {pieData.length > 0 && (
              <div style={card}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 16, marginTop: 0 }}>Distribuição — probabilidade de rematrícula</p>
                <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pieData.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: entry.color, flexShrink: 0 }} />
                        <span style={{ color: '#374151' }}>{entry.name}</span>
                        <span style={{ fontWeight: 700, color: '#1A2B4A' }}>{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Seção B — Risco de evasão */}
            {(evasionRisk > 0 || undecided > 0) && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {evasionRisk > 0 && (
                  <div style={{ ...card, flex: 1, minWidth: 240, border: '1px solid #FECACA', background: '#FFF5F5', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <AlertTriangle size={24} color="#EF4444" />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#991B1B', margin: '0 0 2px' }}>
                        {evasionRisk} {evasionRisk === 1 ? 'família indicou' : 'famílias indicaram'} que não vai rematricular
                      </p>
                      <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>Ação imediata recomendada</p>
                    </div>
                  </div>
                )}
                {undecided > 0 && (
                  <div style={{ ...card, flex: 1, minWidth: 240, border: '1px solid #FDE68A', background: '#FFFBEB', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <AlertTriangle size={24} color="#F59E0B" />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#92400E', margin: '0 0 2px' }}>
                        {undecided} {undecided === 1 ? 'família ainda indecisa' : 'famílias ainda indecisos'} — oportunidade de retenção
                      </p>
                      <p style={{ fontSize: 12, color: '#F59E0B', margin: 0 }}>Entre em contato proativamente</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Seção C — Lista de respostas */}
            <div style={card}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 16, marginTop: 0 }}>
                Respostas individuais ({responses.length})
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Nome', 'Série', 'Nota geral', 'Rematrícula', 'Data'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map(r => {
                      const noteAvg = avg([
                        r.answers.general as number,
                        r.answers.teaching as number,
                        r.answers.communication as number,
                        r.answers.infrastructure as number,
                        r.answers.cost_benefit as number,
                      ])
                      const note10 = scaleToTen(noteAvg)
                      const nc = note10 >= 8 ? '#10B981' : note10 >= 6 ? '#F59E0B' : '#EF4444'
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 14px', color: '#1A2B4A', fontWeight: 500 }}>
                            {r.respondent_name || <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>Anônimo</span>}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748B' }}>{r.respondent_grade || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontWeight: 700, color: nc }}>{note10.toFixed(1)}</span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {(r.answers.reenrollment as string) || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal relatório IA */}
        {showReportModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Relatório IA</h2>
                <button onClick={() => { setShowReportModal(false); setAiReport(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
              </div>

              {generatingReport ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ width: 40, height: 40, border: '3px solid #8B5CF6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ color: '#8B5CF6', fontWeight: 600 }}>Analisando respostas com IA...</p>
                </div>
              ) : aiReport ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Nota */}
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    {(() => {
                      const sc = aiReport.overall_score
                      const c = sc >= 8 ? '#10B981' : sc >= 6 ? '#F59E0B' : '#EF4444'
                      const riskCfg = { baixo: { bg: '#D1FAE5', color: '#065F46' }, médio: { bg: '#FEF3C7', color: '#92400E' }, alto: { bg: '#FEE2E2', color: '#991B1B' } }
                      const rc = riskCfg[aiReport.reenrollment_risk as keyof typeof riskCfg] ?? riskCfg.médio
                      return (
                        <>
                          <div style={{ fontSize: 64, fontWeight: 900, color: c, lineHeight: 1 }}>{Number(sc).toFixed(1)}</div>
                          <p style={{ color: '#94A3B8', marginTop: 4, marginBottom: 12 }}>/ 10</p>
                          <span style={{ padding: '4px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: rc.bg, color: rc.color }}>
                            Risco de rematrícula: {aiReport.reenrollment_risk}
                          </span>
                        </>
                      )
                    })()}
                  </div>

                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 8px' }}>Resumo executivo</p>
                    <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6 }}>{aiReport.summary}</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', margin: '0 0 10px' }}>Pontos fortes</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {aiReport.strengths.map((s, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151' }}>
                            <Check size={14} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} /> {s}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', margin: '0 0 10px' }}>Pontos fracos</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {aiReport.weaknesses.map((w, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151' }}>
                            <X size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} /> {w}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 8px' }}>Análise de rematrícula</p>
                    <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6 }}>{aiReport.reenrollment_analysis}</p>
                  </div>

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', margin: '0 0 10px' }}>Ações prioritárias</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {aiReport.priority_actions.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#374151' }}>
                          <span style={{ fontWeight: 700, color: '#3B82F6', flexShrink: 0 }}>{i + 1}.</span> {a}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: '#EFF6FF', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', margin: '0 0 6px' }}>Oportunidade de retenção</p>
                    <p style={{ fontSize: 14, color: '#1E40AF', margin: 0 }}>{aiReport.retention_opportunities}</p>
                  </div>

                  <button onClick={() => window.print()} style={{ ...btn('#1A2B4A'), alignSelf: 'center', marginTop: 8 }}>
                    Exportar relatório
                  </button>
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#EF4444' }}>Erro ao gerar relatório. Tente novamente.</p>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── LISTA ────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1A2B4A', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <Check size={14} /> {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Pesquisas de Satisfação</h1>
          <p style={{ fontSize: 14, color: '#94A3B8', margin: '4px 0 0' }}>Entenda o que as famílias pensam e antecipe rematrículas</p>
        </div>
        <button onClick={() => setShowNewModal(true)} style={btn('#F97316')}>
          <Plus size={16} /> Nova pesquisa
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {kpis.map(k => (
          <div key={k.label} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <k.Icon size={18} color={k.color} />
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', margin: 0, lineHeight: 1 }}>{k.value}</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 0' }}>{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={card}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Carregando...
          </div>
        ) : surveys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <ClipboardList size={48} color="#CBD5E1" style={{ margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: '#94A3B8', margin: '0 0 8px' }}>Nenhuma pesquisa criada ainda</p>
            <p style={{ fontSize: 13, color: '#CBD5E1', margin: '0 0 20px' }}>Crie sua primeira pesquisa de satisfação e compartilhe com as famílias.</p>
            <button onClick={() => setShowNewModal(true)} style={btn('#F97316')}>
              <Plus size={15} /> Criar primeira pesquisa
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Título', 'Status', 'Respostas', 'Criada em', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {surveys.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{s.title}</p>
                    {s.description && <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{s.description}</p>}
                  </td>
                  <td style={{ padding: '14px 16px' }}><StatusBadge status={s.status} /></td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1A2B4A' }}>{s.response_count ?? 0}</td>
                  <td style={{ padding: '14px 16px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmt(s.created_at)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)}
                        style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#64748B' }}
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenu === s.id && (
                        <div style={{ position: 'absolute', right: 0, top: 36, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 180, overflow: 'hidden' }}>
                          {[
                            { label: 'Copiar link', icon: <Copy size={13} />, action: () => copyLink(s.survey_token) },
                            { label: 'Ver respostas', icon: <Eye size={13} />, action: () => { setOpenMenu(null); openResponses(s) } },
                            { label: 'Gerar relatório IA', icon: <Brain size={13} />, action: () => { setOpenMenu(null); openResponses(s).then(() => generateReport(s)) } },
                            ...(s.status !== 'closed' ? [{ label: 'Encerrar pesquisa', icon: <X size={13} />, action: () => { setOpenMenu(null); closeSurvey(s.id) } }] : []),
                            { label: 'Excluir', icon: <X size={13} />, action: () => { setOpenMenu(null); deleteSurvey(s.id, s.response_count ?? 0) }, danger: true },
                          ].map((item, i) => (
                            <button
                              key={i}
                              onClick={item.action}
                              style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, color: (item as { danger?: boolean }).danger ? '#EF4444' : '#374151', display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              {item.icon} {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Overlay fecha dropdown */}
      {openMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpenMenu(null)} />
      )}

      {/* Modal nova pesquisa */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 520, padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Nova pesquisa</h2>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={labelStyle}>Título da pesquisa *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder='Ex: Pesquisa de Satisfação 2026'
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Descrição (opcional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder='Informe às famílias o objetivo desta pesquisa...'
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                />
              </div>

              {/* Toggle identificação */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8FAFC', borderRadius: 12 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 2px' }}>Solicitar identificação da família</p>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Formulário pedirá nome e série antes das perguntas</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, askId: !f.askId, requireId: !f.askId ? f.requireId : false }))}
                  style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: form.askId ? '#F97316' : '#CBD5E1', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: form.askId ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </button>
              </div>

              {form.askId && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#FFF7ED', borderRadius: 12, marginTop: -8 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 2px' }}>Identificação obrigatória</p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Família não pode pular o campo de identificação</p>
                  </div>
                  <button
                    onClick={() => setForm(f => ({ ...f, requireId: !f.requireId }))}
                    style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: form.requireId ? '#F97316' : '#CBD5E1', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}
                  >
                    <div style={{ position: 'absolute', top: 3, left: form.requireId ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setShowNewModal(false)} style={btn('#F1F5F9', '#374151')}>Cancelar</button>
                <button onClick={createSurvey} disabled={!form.title.trim() || saving} style={{ ...btn('#F97316'), opacity: !form.title.trim() || saving ? 0.6 : 1 }}>
                  {saving ? 'Criando...' : 'Criar pesquisa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal link gerado */}
      {showLinkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 480, padding: 32, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '3px solid #BBF7D0' }}>
              <Check size={28} color="#16A34A" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: '0 0 8px' }}>Pesquisa criada!</h2>
            <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 24px' }}>Compartilhe o link abaixo com as famílias via WhatsApp, e-mail ou redes sociais.</p>

            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: '#64748B', flex: 1, textAlign: 'left', wordBreak: 'break-all', lineHeight: 1.4 }}>
                {surveyLink(showLinkModal.survey.survey_token)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(surveyLink(showLinkModal.survey.survey_token))
                  showToast('Link copiado!')
                }}
                style={btn('#F97316')}
              >
                <Copy size={15} /> Copiar link
              </button>
              <button onClick={() => setShowLinkModal(null)} style={btn('#F1F5F9', '#374151')}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
