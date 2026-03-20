import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, ChevronRight, ChevronLeft, Upload, Loader2, Check,
  AlertTriangle, TrendingUp, Users, MapPin, BarChart3,
  Sparkles, RefreshCw, Shield
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Tipos ──────────────────────────────────────────────────────
interface Props {
  isOpen: boolean
  onClose: () => void
  onApply: (cycle: CycleData) => void
  existingCycle?: CycleData | null
  institutionId: string
  institutionName: string
}

interface CycleData {
  institution_id: string
  year: number
  label: string
  start_date: string
  end_date: string
  target_new_students: number
  target_reenrollment_rate: number
  base_students: number
  projected_cpa: number
  monthly_targets: MonthlyTarget[]
  market_data: MarketData
  historical_input: HistoricalYear[]
  generation_mode: string
  ai_reasoning: string
  realism_score: string
  applied_at: string
}

interface SchoolData {
  name: string
  city: string
  state: string
  grades: string[]
  avg_monthly_fee: number
  current_students: number
}

interface GrowthTarget {
  type: 'percentage' | 'absolute' | 'students'
  value: number
}

interface HistoricalYear {
  year: number
  total_students: number
  new_enrollments: number
  reenrollments: number
  transfers: number
}

interface MarketData {
  city?: string
  state?: string
  school_age_population?: number
  total_population?: number
  private_school_students?: number
  private_school_rate?: number
  sector_growth_rate?: number
  total_private_schools?: number
  average_students_per_school?: number
  confidence?: string
  data_source?: string
  notes?: string
}

interface MonthlyTarget {
  month: string
  year: number
  registrations: number
  schedules: number
  visits: number
  enrollments: number
  investment_suggested: number
  leads_target: number
  cpa_target: number
}

interface GeneratedPlan {
  summary: {
    total_new_students_target: number
    reenrollment_target: number
    reenrollment_rate_target: number
    total_students_end: number
    growth_rate: number
    realism_score: 'conservative' | 'realistic' | 'aggressive'
    reasoning: string
  }
  monthly_targets: MonthlyTarget[]
  funnel_rates: { registration_to_schedule: number; schedule_to_visit: number; visit_to_enrollment: number }
  total_investment_suggested: number
  total_leads_needed: number
  average_cpa: number
  key_risks: string[]
  key_actions: string[]
  recalibration_note: string
}

// ─── UFs do Brasil ──────────────────────────────────────────────
const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

// ─── Séries ─────────────────────────────────────────────────────
const GRADE_OPTIONS = [
  'Infantil I', 'Infantil II', 'Infantil III', 'Infantil IV', 'Infantil V',
  '1º ao 5º EF', '6º ao 9º EF', 'Ensino Médio'
]

// ─── Helper: tempo relativo ──────────────────────────────────────
const CAMPAIGN_YEAR = new Date().getFullYear()

// ─── Componente principal ────────────────────────────────────────
export default function CampaignGeneratorModal({
  isOpen, onClose, onApply, existingCycle, institutionId, institutionName
}: Props) {
  const [step, setStep] = useState(1)

  // Dados coletados
  const [schoolData, setSchoolData] = useState<SchoolData>({
    name: institutionName,
    city: '', state: '', grades: [], avg_monthly_fee: 0, current_students: 0
  })
  const [growthTarget, setGrowthTarget] = useState<GrowthTarget>({ type: 'percentage', value: 10 })
  const [historicalData, setHistoricalData] = useState<HistoricalYear[]>([])
  const [historyOption, setHistoryOption] = useState<'upload' | 'partial' | 'none' | null>(null)
  const [marketData, setMarketData] = useState<MarketData>({})
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)
  const [adjustedPlan, setAdjustedPlan] = useState<GeneratedPlan | null>(null)
  const [generationMode, setGenerationMode] = useState<string>('benchmark')

  // Loading states
  const [loadingMarket, setLoadingMarket] = useState(false)
  const [loadingGenerate, setLoadingGenerate] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [marketMsgIdx, setMarketMsgIdx] = useState(0)
  const [genMsgIdx, setGenMsgIdx] = useState(0)
  const [genProgress, setGenProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [ambitiousLevel, setAmbitiousLevel] = useState(1) // 0=conservador,1=realista,2=agressivo
  const [regenDebounce, setRegenDebounce] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [regenLoading, setRegenLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const MARKET_MSGS = [
    `Consultando dados demográficos de ${schoolData.city || '...'}...`,
    'Analisando o mercado de ensino privado na região...',
    'Cruzando com dados do Censo Escolar MEC...',
    'Quase lá...'
  ]
  const GEN_MSGS = [
    `Analisando o potencial da sua escola em ${schoolData.city || '...'}...`,
    'Calculando sazonalidade e taxas de conversão...',
    'Definindo metas mensais realistas...',
    'Estimando investimento necessário...',
    'Preparando seu plano completo...'
  ]

  // Pré-preencher se existingCycle
  useEffect(() => {
    if (existingCycle) {
      setSchoolData(s => ({
        ...s,
        current_students: existingCycle.base_students || 0
      }))
      if (existingCycle.market_data && Object.keys(existingCycle.market_data).length) {
        setMarketData(existingCycle.market_data)
      }
      if (existingCycle.historical_input?.length) {
        setHistoricalData(existingCycle.historical_input)
        setHistoryOption('partial')
      }
    }
  }, [existingCycle])

  // Animar mensagens mercado
  useEffect(() => {
    if (!loadingMarket) return
    const interval = setInterval(() => {
      setMarketMsgIdx(i => (i + 1) % MARKET_MSGS.length)
    }, 1500)
    return () => clearInterval(interval)
  }, [loadingMarket])

  // Animar mensagens geração
  useEffect(() => {
    if (!loadingGenerate) return
    const interval = setInterval(() => {
      setGenMsgIdx(i => Math.min(i + 1, GEN_MSGS.length - 1))
      setGenProgress(p => Math.min(p + 18, 92))
    }, 2000)
    return () => clearInterval(interval)
  }, [loadingGenerate])

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setError(null)
      setGeneratedPlan(null)
      setAdjustedPlan(null)
      setMarketMsgIdx(0)
      setGenMsgIdx(0)
      setGenProgress(0)
    }
  }, [isOpen])

  // ── Buscar mercado ────────────────────────────────────────────
  const fetchMarket = useCallback(async () => {
    setLoadingMarket(true)
    setError(null)
    setMarketMsgIdx(0)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch_ibge',
          payload: { city: schoolData.city, state: schoolData.state }
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar dados')
      setMarketData(data.result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingMarket(false)
    }
  }, [schoolData.city, schoolData.state])

  // ── Gerar campanha ────────────────────────────────────────────
  const generateCampaign = useCallback(async (overrideTarget?: GrowthTarget) => {
    setLoadingGenerate(true)
    setGenMsgIdx(0)
    setGenProgress(5)
    setError(null)
    try {
      const target = overrideTarget || growthTarget
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_campaign',
          payload: {
            schoolData: { ...schoolData, name: institutionName },
            historicalData,
            marketData,
            growthTarget: target,
            campaignYear: CAMPAIGN_YEAR
          }
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar campanha')
      setGenerationMode(data.mode || 'benchmark')
      setGeneratedPlan(data.result)
      setAdjustedPlan(JSON.parse(JSON.stringify(data.result)))
      setGenProgress(100)
      setTimeout(() => setStep(5), 400)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingGenerate(false)
    }
  }, [schoolData, historicalData, marketData, growthTarget, institutionName])

  // ── Regerar por nível de ambição ──────────────────────────────
  const handleAmbitiousChange = (level: number) => {
    setAmbitiousLevel(level)
    if (regenDebounce) clearTimeout(regenDebounce)
    const targetMap: GrowthTarget[] = [
      { type: 'percentage', value: Math.max(2, (growthTarget.value || 10) * 0.6) },
      growthTarget,
      { type: 'percentage', value: (growthTarget.value || 10) * 1.5 }
    ]
    setRegenLoading(true)
    const t = setTimeout(async () => {
      await generateCampaign(targetMap[level])
      setRegenLoading(false)
    }, 1000)
    setRegenDebounce(t)
  }

  // ── Upload arquivo histórico ───────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadingFile(true)
    const ext = file.name.split('.').pop()?.toLowerCase() as 'csv' | 'xlsx' | 'pdf'
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const content = (ev.target?.result as string) || ''
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'extract_file',
            payload: { fileContent: content, fileType: ext, fileName: file.name }
          })
        })
        const data = await res.json()
        if (data.result?.historical_funnel?.length) {
          const rows: HistoricalYear[] = data.result.historical_funnel.map((r: { period: string; registrations: number; schedules: number; visits: number; enrollments: number }) => ({
            year: parseInt(r.period?.split('/')[1] || '0'),
            total_students: 0,
            new_enrollments: r.enrollments || 0,
            reenrollments: 0,
            transfers: 0
          })).filter((r: HistoricalYear) => r.year > 2000)
          setHistoricalData(rows)
        }
      } catch {}
      setLoadingFile(false)
    }
    if (ext === 'pdf') reader.readAsDataURL(file)
    else reader.readAsText(file, 'utf-8')
  }

  // ── Aplicar campanha ──────────────────────────────────────────
  const applyCampaign = async () => {
    if (!adjustedPlan) return
    setApplying(true)
    try {
      const cycleData: CycleData = {
        institution_id: institutionId,
        year: CAMPAIGN_YEAR,
        label: `Campanha ${CAMPAIGN_YEAR}`,
        start_date: `${CAMPAIGN_YEAR}-09-01`,
        end_date: `${CAMPAIGN_YEAR + 1}-02-28`,
        target_new_students: adjustedPlan.summary.total_new_students_target,
        target_reenrollment_rate: adjustedPlan.summary.reenrollment_rate_target,
        base_students: schoolData.current_students,
        projected_cpa: adjustedPlan.average_cpa,
        monthly_targets: adjustedPlan.monthly_targets,
        market_data: marketData,
        historical_input: historicalData,
        generation_mode: generationMode,
        ai_reasoning: adjustedPlan.summary.reasoning,
        realism_score: adjustedPlan.summary.realism_score,
        applied_at: new Date().toISOString()
      }

      await supabase.from('campaign_cycles').upsert(cycleData, { onConflict: 'institution_id,year' })

      for (const month of adjustedPlan.monthly_targets) {
        const period = `${month.month}/${month.year}`
        await supabase.from('funnel_metrics').upsert({
          institution_id: institutionId,
          period,
          registrations_target: month.registrations,
          schedules_target: month.schedules,
          visits_target: month.visits,
          enrollments_target: month.enrollments,
          registrations: 0, schedules: 0, visits: 0, enrollments: 0
        }, { onConflict: 'period,institution_id', ignoreDuplicates: false })

        await supabase.from('marketing_campaigns').upsert({
          institution_id: institutionId,
          month_year: `${month.month}-${month.year}`,
          cpa_target: month.cpa_target,
          investment: 0,
          leads_generated: 0
        }, { onConflict: 'month_year,institution_id', ignoreDuplicates: false })
      }

      await supabase.from('system_notifications').insert({
        institution_id: institutionId,
        type: 'milestone',
        severity: 'success',
        title: `Campanha ${CAMPAIGN_YEAR} configurada!`,
        message: `Suas metas estão ativas. O sistema agora acompanha ${adjustedPlan.summary.total_new_students_target} matrículas novas e ${(adjustedPlan.summary.reenrollment_rate_target * 100).toFixed(0)}% de rematrículas como objetivo.`
      })

      onApply(cycleData)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setApplying(false)
      setShowConfirm(false)
    }
  }

  // ── Editar célula da tabela ────────────────────────────────────
  const updateMonthlyCell = (idx: number, field: keyof MonthlyTarget, value: number) => {
    if (!adjustedPlan) return
    const updated = { ...adjustedPlan }
    updated.monthly_targets = updated.monthly_targets.map((m, i) => {
      if (i !== idx) return m
      const newM = { ...m, [field]: value }
      if (field === 'investment_suggested' || field === 'leads_target') {
        newM.cpa_target = newM.leads_target > 0
          ? Math.round(newM.investment_suggested / newM.leads_target)
          : 0
      }
      return newM
    })
    // Recalcular totais
    updated.total_investment_suggested = updated.monthly_targets.reduce((s, m) => s + (m.investment_suggested || 0), 0)
    updated.total_leads_needed = updated.monthly_targets.reduce((s, m) => s + (m.leads_target || 0), 0)
    updated.average_cpa = updated.total_leads_needed > 0
      ? Math.round(updated.total_investment_suggested / updated.total_leads_needed)
      : 0
    setAdjustedPlan(updated)
  }

  if (!isOpen) return null

  const progressPct = (step / 5) * 100

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: step === 5 ? 1100 : 680, maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: '#00A896', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 13, height: 13, borderRadius: '50%', background: 'white', border: '2px solid rgba(255,255,255,0.4)' }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Inscribo</span>
              <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 4 }}>· Gerador de Campanha</span>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={15} color="#64748B" />
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 4, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #00A896, #0DD3BF)', borderRadius: 999, transition: 'width 0.4s ease' }} />
            </div>
            <span style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>Passo {step} de 5</span>
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}>

          {/* ── PASSO 1 ─────────────────────────────────────── */}
          {step === 1 && (
            <StepOne
              schoolData={schoolData}
              setSchoolData={setSchoolData}
              growthTarget={growthTarget}
              setGrowthTarget={setGrowthTarget}
            />
          )}

          {/* ── PASSO 2 ─────────────────────────────────────── */}
          {step === 2 && (
            <StepTwo
              historyOption={historyOption}
              setHistoryOption={setHistoryOption}
              historicalData={historicalData}
              setHistoricalData={setHistoricalData}
              loadingFile={loadingFile}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
            />
          )}

          {/* ── PASSO 3 ─────────────────────────────────────── */}
          {step === 3 && (
            <StepThree
              loading={loadingMarket}
              msgIdx={marketMsgIdx}
              msgs={MARKET_MSGS}
              marketData={marketData}
              city={schoolData.city}
              error={error}
              onRetry={fetchMarket}
            />
          )}

          {/* ── PASSO 4 ─────────────────────────────────────── */}
          {step === 4 && (
            <StepFour
              loading={loadingGenerate}
              msgIdx={genMsgIdx}
              msgs={GEN_MSGS}
              progress={genProgress}
              error={error}
              onRetry={() => generateCampaign()}
            />
          )}

          {/* ── PASSO 5 ─────────────────────────────────────── */}
          {step === 5 && adjustedPlan && (
            <StepFive
              plan={adjustedPlan}
              ambitiousLevel={ambitiousLevel}
              regenLoading={regenLoading}
              onAmbitiousChange={handleAmbitiousChange}
              onUpdateCell={updateMonthlyCell}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 20px', borderTop: '1px solid #E2E8F0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA' }}>
          {/* Esquerda: voltar */}
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
                <ChevronLeft size={14} /> Voltar
              </button>
            )}
          </div>

          {/* Centro: bolinhas */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} style={{ width: s === step ? 18 : 6, height: 6, borderRadius: 999, background: s === step ? '#00A896' : s < step ? '#0DD3BF' : '#E2E8F0', transition: 'all 0.3s' }} />
            ))}
          </div>

          {/* Direita: ações */}
          <div style={{ display: 'flex', gap: 8 }}>
            {step === 5 && (
              <button
                onClick={onClose}
                style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
                Salvar rascunho
              </button>
            )}

            {step < 3 && (
              <button
                onClick={() => {
                  if (step === 1) {
                    if (!schoolData.city || !schoolData.state) return
                    setStep(2)
                  } else if (step === 2) {
                    setStep(3)
                    fetchMarket()
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Continuar <ChevronRight size={14} />
              </button>
            )}

            {step === 3 && !loadingMarket && Object.keys(marketData).length > 0 && (
              <button
                onClick={() => { setStep(4); generateCampaign() }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Sparkles size={14} /> Gerar minha campanha
              </button>
            )}

            {step === 5 && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={applying}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: applying ? 0.7 : 1 }}>
                {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Aplicar metas ao sistema
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de confirmação */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={16} color="#00A896" />
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A' }}>Confirmar aplicação</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 20 }}>
              Ao aplicar, todo o sistema usará estas metas como referência.
              Desvios, notificações e análises da IA serão baseados neste plano.
              <br /><br />
              <strong>Você pode regerar a qualquer momento.</strong>
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConfirm(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748B' }}>
                Cancelar
              </button>
              <button onClick={applyCampaign} disabled={applying} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {applying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Confirmar e aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Passo 1 — Dados da escola ───────────────────────────────────
function StepOne({ schoolData, setSchoolData, growthTarget, setGrowthTarget }: {
  schoolData: SchoolData
  setSchoolData: React.Dispatch<React.SetStateAction<SchoolData>>
  growthTarget: GrowthTarget
  setGrowthTarget: React.Dispatch<React.SetStateAction<GrowthTarget>>
}) {
  return (
    <div style={{ paddingBottom: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 6 }}>Vamos montar sua campanha de matrículas</h2>
      <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>Responda algumas perguntas. Leva menos de 3 minutos.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Cidade <span style={{ color: '#F43F5E' }}>*</span></label>
          <input
            style={inputStyle}
            placeholder="Ex: São Paulo"
            value={schoolData.city}
            onChange={e => setSchoolData(s => ({ ...s, city: e.target.value }))}
          />
        </div>
        <div>
          <label style={labelStyle}>Estado <span style={{ color: '#F43F5E' }}>*</span></label>
          <select
            style={inputStyle}
            value={schoolData.state}
            onChange={e => setSchoolData(s => ({ ...s, state: e.target.value }))}>
            <option value="">Selecione...</option>
            {STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Séries oferecidas</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 6 }}>
          {GRADE_OPTIONS.map(g => {
            const active = schoolData.grades.includes(g)
            return (
              <button key={g} onClick={() => setSchoolData(s => ({
                ...s, grades: active ? s.grades.filter(x => x !== g) : [...s.grades, g]
              }))} style={{
                padding: '7px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer', textAlign: 'center',
                border: active ? '1.5px solid #00A896' : '1px solid #E2E8F0',
                background: active ? '#E6F7F5' : '#F8FAFC',
                color: active ? '#00A896' : '#64748B', fontWeight: active ? 600 : 400
              }}>
                {g}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Mensalidade média</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94A3B8' }}>R$</span>
            <input
              type="number"
              style={{ ...inputStyle, paddingLeft: 36 }}
              placeholder="1500"
              value={schoolData.avg_monthly_fee || ''}
              onChange={e => setSchoolData(s => ({ ...s, avg_monthly_fee: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Total de alunos atualmente</label>
          <input
            type="number"
            style={inputStyle}
            placeholder="350"
            value={schoolData.current_students || ''}
            onChange={e => setSchoolData(s => ({ ...s, current_students: parseInt(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Objetivo de crescimento</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
          {(['percentage', 'absolute', 'students'] as const).map(type => {
            const labels = { percentage: 'Crescer X% no ano', absolute: 'Adicionar X alunos novos', students: 'Atingir X alunos total' }
            const placeholders = { percentage: '10', absolute: '50', students: '400' }
            const active = growthTarget.type === type
            return (
              <div key={type} onClick={() => setGrowthTarget(t => ({ ...t, type }))} style={{
                padding: 14, borderRadius: 12, cursor: 'pointer',
                border: active ? '2px solid #00A896' : '1.5px solid #E2E8F0',
                background: active ? '#E6F7F5' : '#F8FAFC'
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#00A896' : '#475569', marginBottom: 8 }}>{labels[type]}</div>
                <input
                  type="number"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 14, background: '#fff', outline: 'none' }}
                  placeholder={placeholders[type]}
                  value={growthTarget.type === type ? growthTarget.value || '' : ''}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setGrowthTarget({ type, value: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Passo 2 — Histórico ─────────────────────────────────────────
function StepTwo({ historyOption, setHistoryOption, historicalData, setHistoricalData, loadingFile, fileInputRef, onFileChange }: {
  historyOption: 'upload' | 'partial' | 'none' | null
  setHistoryOption: (v: 'upload' | 'partial' | 'none') => void
  historicalData: HistoricalYear[]
  setHistoricalData: React.Dispatch<React.SetStateAction<HistoricalYear[]>>
  loadingFile: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const addYear = () => {
    setHistoricalData(d => [...d, {
      year: new Date().getFullYear() - 1 - d.length,
      total_students: 0, new_enrollments: 0, reenrollments: 0, transfers: 0
    }])
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 6 }}>Você tem dados dos anos anteriores?</h2>
      <p style={{ fontSize: 14, color: '#64748B', marginBottom: 20 }}>Esses dados tornam as metas muito mais precisas.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {([
          { key: 'upload', icon: '📂', label: 'Sim, tenho dados — vou subir agora', sub: 'Aceita CSV, Excel ou PDF do seu sistema' },
          { key: 'partial', icon: '📊', label: 'Tenho dados parciais (1 ano apenas)', sub: 'Preencha manualmente abaixo' },
          { key: 'none', icon: '🆕', label: 'Não tenho / é o primeiro ano no sistema', sub: 'A IA usará benchmarks do setor' }
        ] as const).map(opt => {
          const active = historyOption === opt.key
          return (
            <div key={opt.key} onClick={() => setHistoryOption(opt.key)} style={{
              padding: '14px 18px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
              border: active ? '2px solid #00A896' : '1.5px solid #E2E8F0',
              background: active ? '#E6F7F5' : '#F8FAFC'
            }}>
              <span style={{ fontSize: 22 }}>{opt.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: active ? '#00A896' : '#1A2B4A' }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{opt.sub}</div>
              </div>
              {active && <Check size={16} color="#00A896" style={{ marginLeft: 'auto' }} />}
            </div>
          )
        })}
      </div>

      {(historyOption === 'upload' || historyOption === 'partial') && (
        <>
          {historyOption === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ border: '2px dashed #CBD5E1', borderRadius: 12, padding: 28, textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: '#F8FAFC' }}
              onDragOver={e => e.preventDefault()}>
              {loadingFile ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <Loader2 size={24} color="#00A896" className="animate-spin" />
                  <span style={{ fontSize: 13, color: '#64748B' }}>Lendo seu arquivo...</span>
                </div>
              ) : (
                <>
                  <Upload size={24} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>Arraste o arquivo ou clique para selecionar</p>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>CSV, Excel ou PDF</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.pdf" style={{ display: 'none' }} onChange={onFileChange} />
            </div>
          )}

          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16, marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 14 }}>ou preencha manualmente</div>
            {historicalData.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input type="number" placeholder="Ano" style={smallInput} value={row.year || ''} onChange={e => setHistoricalData(d => d.map((r, ri) => ri === i ? { ...r, year: parseInt(e.target.value) || 0 } : r))} />
                <input type="number" placeholder="Alunos" style={smallInput} value={row.total_students || ''} onChange={e => setHistoricalData(d => d.map((r, ri) => ri === i ? { ...r, total_students: parseInt(e.target.value) || 0 } : r))} />
                <input type="number" placeholder="Novas matrículas" style={smallInput} value={row.new_enrollments || ''} onChange={e => setHistoricalData(d => d.map((r, ri) => ri === i ? { ...r, new_enrollments: parseInt(e.target.value) || 0 } : r))} />
                <input type="number" placeholder="Rematrículas" style={smallInput} value={row.reenrollments || ''} onChange={e => setHistoricalData(d => d.map((r, ri) => ri === i ? { ...r, reenrollments: parseInt(e.target.value) || 0 } : r))} />
                <input type="number" placeholder="Transferências" style={smallInput} value={row.transfers || ''} onChange={e => setHistoricalData(d => d.map((r, ri) => ri === i ? { ...r, transfers: parseInt(e.target.value) || 0 } : r))} />
              </div>
            ))}
            {historicalData.length < 3 && (
              <button onClick={addYear} style={{ fontSize: 13, color: '#00A896', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                + Adicionar ano
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Passo 3 — Dados de mercado ──────────────────────────────────
function StepThree({ loading, msgIdx, msgs, marketData, city, error, onRetry }: {
  loading: boolean
  msgIdx: number
  msgs: string[]
  marketData: MarketData
  city: string
  error: string | null
  onRetry: () => void
}) {
  const hasData = Object.keys(marketData).length > 0

  return (
    <div style={{ paddingBottom: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 6 }}>Analisando seu mercado</h2>
      <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>Consultando dados demográficos e educacionais de {city || 'sua cidade'}.</p>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={26} color="#00A896" className="animate-spin" />
          </div>
          <p style={{ fontSize: 14, color: '#475569', textAlign: 'center', transition: 'opacity 0.3s' }}>{msgs[msgIdx]}</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: 20, background: '#FFF1F2', borderRadius: 12, border: '1px solid #FECDD3', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#BE123C', marginBottom: 12 }}>{error}</p>
          <button onClick={onRetry} style={{ fontSize: 13, color: '#00A896', background: '#E6F7F5', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      )}

      {hasData && !loading && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <StatCard color="#3B82F6" bg="#EFF6FF" icon={<Users size={16} color="#3B82F6" />}
              label={`Crianças em idade escolar em ${city}`}
              value={marketData.school_age_population?.toLocaleString('pt-BR') || 'N/D'} />
            <StatCard color="#10B981" bg="#ECFDF5" icon={<BarChart3 size={16} color="#10B981" />}
              label="Estudam em escola particular"
              value={marketData.private_school_rate ? `${(marketData.private_school_rate * 100).toFixed(1)}%` : 'N/D'} />
            <StatCard color="#00A896" bg="#E6F7F5" icon={<TrendingUp size={16} color="#00A896" />}
              label="Crescimento do setor ao ano"
              value={marketData.sector_growth_rate ? `${(marketData.sector_growth_rate * 100).toFixed(1)}%` : 'N/D'} />
            <StatCard color="#6B7280" bg="#F9FAFB" icon={<MapPin size={16} color="#6B7280" />}
              label="Média de alunos por escola particular"
              value={marketData.average_students_per_school?.toLocaleString('pt-BR') || 'N/D'} />
          </div>

          {marketData.confidence && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: marketData.confidence === 'high' ? '#D1FAE5' : marketData.confidence === 'medium' ? '#FEF3C7' : '#F1F5F9',
                color: marketData.confidence === 'high' ? '#065F46' : marketData.confidence === 'medium' ? '#92400E' : '#475569'
              }}>
                {marketData.confidence === 'high' ? '✓ Alta confiança' : marketData.confidence === 'medium' ? '~ Confiança média' : '? Dados estimados'}
              </span>
            </div>
          )}

          {marketData.notes && (
            <p style={{ fontSize: 12, color: '#64748B', background: '#F8FAFC', padding: '10px 14px', borderRadius: 9, lineHeight: 1.6 }}>
              💡 {marketData.notes}
            </p>
          )}

          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 10 }}>
            Fonte: {marketData.data_source || 'IBGE Censo 2022 / Censo Escolar MEC 2023'}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Passo 4 — Gerando plano ─────────────────────────────────────
function StepFour({ loading, msgIdx, msgs, progress, error, onRetry }: {
  loading: boolean
  msgIdx: number
  msgs: string[]
  progress: number
  error: string | null
  onRetry: () => void
}) {
  return (
    <div style={{ paddingBottom: 24, paddingTop: 16 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 6 }}>Gerando seu plano de campanha</h2>
      <p style={{ fontSize: 14, color: '#64748B', marginBottom: 32 }}>A IA está analisando todos os dados para criar metas realistas.</p>

      {loading && (
        <div>
          <div style={{ height: 6, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden', marginBottom: 28 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #00A896, #0DD3BF)', borderRadius: 999, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={28} color="#00A896" />
            </div>
            <p style={{ fontSize: 15, color: '#475569', textAlign: 'center', minHeight: 22 }}>{msgs[msgIdx]}</p>
            <p style={{ fontSize: 12, color: '#94A3B8' }}>Isso pode levar até 15 segundos...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: 20, background: '#FFF1F2', borderRadius: 12, border: '1px solid #FECDD3' }}>
          <p style={{ fontSize: 13, color: '#BE123C', marginBottom: 12 }}>{error}</p>
          <button onClick={onRetry} style={{ fontSize: 13, color: '#00A896', background: '#E6F7F5', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Passo 5 — Revisão ───────────────────────────────────────────
function StepFive({ plan, ambitiousLevel, regenLoading, onAmbitiousChange, onUpdateCell }: {
  plan: GeneratedPlan
  ambitiousLevel: number
  regenLoading: boolean
  onAmbitiousChange: (level: number) => void
  onUpdateCell: (idx: number, field: keyof MonthlyTarget, value: number) => void
}) {
  const realismMap = {
    conservative: { label: 'Meta Conservadora', bg: '#EFF6FF', color: '#1D4ED8' },
    realistic: { label: 'Meta Realista', bg: '#ECFDF5', color: '#065F46' },
    aggressive: { label: 'Meta Agressiva', bg: '#FFF7ED', color: '#9A3412' }
  }
  const realism = realismMap[plan.summary.realism_score] || realismMap.realistic

  const totals = plan.monthly_targets.reduce((acc, m) => ({
    registrations: acc.registrations + m.registrations,
    schedules: acc.schedules + m.schedules,
    visits: acc.visits + m.visits,
    enrollments: acc.enrollments + m.enrollments,
    investment_suggested: acc.investment_suggested + m.investment_suggested,
    leads_target: acc.leads_target + m.leads_target,
    cpa_target: 0
  }), { registrations: 0, schedules: 0, visits: 0, enrollments: 0, investment_suggested: 0, leads_target: 0, cpa_target: 0 })

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', gap: 20, flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 20 }}>

          {/* Coluna esquerda */}
          <div style={{ width: '38%', flexShrink: 0 }}>
            <div style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: realism.bg, color: realism.color, marginBottom: 14 }}>
              {realism.label}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <KpiCard label="Alunos novos" value={plan.summary.total_new_students_target} unit="alunos" color="#00A896" />
              <KpiCard label="Meta rematrícula" value={Math.round(plan.summary.reenrollment_rate_target * 100)} unit="%" color="#3B82F6" />
              <KpiCard label="Investimento total" value={`R$ ${plan.total_investment_suggested.toLocaleString('pt-BR')}`} unit="" color="#8B5CF6" raw />
              <KpiCard label="CPA médio" value={`R$ ${plan.average_cpa.toLocaleString('pt-BR')}`} unit="" color="#F59E0B" raw />
            </div>

            <div style={{ background: '#EFF6FF', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={14} color="#3B82F6" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>Como a IA chegou nesses números</span>
              </div>
              <p style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.65 }}>{plan.summary.reasoning}</p>
            </div>

            {plan.key_risks?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>Riscos identificados</div>
                {plan.key_risks.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                    <AlertTriangle size={12} color="#F59E0B" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>{r}</span>
                  </div>
                ))}
              </div>
            )}

            {plan.key_actions?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46', marginBottom: 6 }}>Ações prioritárias</div>
                {plan.key_actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                    <Check size={12} color="#00A896" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#047857', lineHeight: 1.5 }}>{a}</span>
                  </div>
                ))}
              </div>
            )}

            {plan.recalibration_note && (
              <p style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.55 }}>📅 {plan.recalibration_note}</p>
            )}
          </div>

          {/* Coluna direita */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', marginBottom: 12 }}>Metas mensais da campanha</div>

            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Mês', 'Cadastros', 'Agendas', 'Visitas', 'Matrículas', 'Investimento R$', 'CPA R$'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Mês' ? 'left' : 'center', fontSize: 11, fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.monthly_targets.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: '#1A2B4A', whiteSpace: 'nowrap' }}>{m.month}/{m.year}</td>
                      {(['registrations', 'schedules', 'visits', 'enrollments', 'investment_suggested', 'leads_target'] as const).map(field => (
                        <td key={field} style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <input
                            type="number"
                            style={{ width: 70, padding: '4px 6px', borderRadius: 6, border: '1px solid #E2E8F0', textAlign: 'center', fontSize: 12, outline: 'none', background: '#F8FAFC' }}
                            value={m[field] || 0}
                            onChange={e => onUpdateCell(i, field, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B', fontWeight: 500 }}>
                        {m.leads_target > 0 ? Math.round((m.investment_suggested || 0) / m.leads_target).toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F0FDFB', borderTop: '2px solid #D1FAE5' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1A2B4A', fontSize: 12 }}>TOTAL</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{totals.registrations}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{totals.schedules}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{totals.visits}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{totals.enrollments}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>R$ {totals.investment_suggested.toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                      {totals.leads_target > 0 ? `R$ ${Math.round(totals.investment_suggested / totals.leads_target).toLocaleString('pt-BR')}` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Slider de ambição */}
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Ajuste o nível de ambição</span>
                {regenLoading && <Loader2 size={13} color="#00A896" className="animate-spin" />}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { level: 0, label: 'Conservador', icon: '🛡️' },
                  { level: 1, label: 'Realista', icon: '🎯' },
                  { level: 2, label: 'Agressivo', icon: '🚀' }
                ].map(opt => (
                  <button key={opt.level} onClick={() => onAmbitiousChange(opt.level)} style={{
                    padding: '9px 8px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    border: ambitiousLevel === opt.level ? '2px solid #00A896' : '1.5px solid #E2E8F0',
                    background: ambitiousLevel === opt.level ? '#E6F7F5' : '#fff',
                    color: ambitiousLevel === opt.level ? '#00A896' : '#64748B'
                  }}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────
function StatCard({ color, bg, icon, label, value }: { color: string; bg: string; icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function KpiCard({ label, value, unit, color, raw }: { label: string; value: number | string; unit: string; color: string; raw?: boolean }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>
        {raw ? value : `${value}${unit}`}
      </div>
    </div>
  )
}

// ─── Estilos compartilhados ──────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px', borderRadius: 9,
  border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1A2B4A',
  background: '#F8FAFC', outline: 'none', boxSizing: 'border-box'
}

const smallInput: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 8px', borderRadius: 7,
  border: '1px solid #E2E8F0', fontSize: 12, color: '#1A2B4A',
  background: '#F8FAFC', outline: 'none', boxSizing: 'border-box'
}
