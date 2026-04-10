import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, ChevronRight, ChevronLeft, Upload, Loader2, Check,
  AlertTriangle, Sparkles, RefreshCw, Shield, SlidersHorizontal,
  Edit3, FileText, Calendar, Users, DollarSign, TrendingUp
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// ─── Tipos ───────────────────────────────────────────────────────
interface ErpFileEntry {
  name: string; year: number; total: number
  novatos: number; veterans: number; fee?: number; error?: boolean
}
interface Props {
  isOpen: boolean; onClose: () => void; onApply: (cycle: CycleData) => void
  existingCycle?: CycleData | null; institutionId: string; institutionName: string
  preloadedHistoricalData?: HistoricalYear[]; preloadedErpFiles?: ErpFileEntry[]
  openAtStep?: number; isAdjustMode?: boolean; currentUserId?: string; currentUserName?: string
}
interface CycleData {
  institution_id: string; year: number; label: string; start_date: string; end_date: string
  target_new_students: number; target_reenrollment_rate: number; base_students: number
  projected_cpa: number; monthly_targets: MonthlyTarget[]
  market_data: Record<string, unknown>; historical_input: HistoricalYear[]
  generation_mode: string; ai_reasoning: string; realism_score: string; applied_at: string
}
interface SchoolData {
  name: string; city: string; state: string; grades: string[]
  avg_monthly_fee: number; current_students: number
  exits?: Record<string, number>; start_date?: string; end_date?: string
}
interface GrowthTarget { type: 'percentage' | 'absolute' | 'students'; value: number }
interface HistoricalYear {
  year: number; total_students: number; new_enrollments: number; reenrollments: number; transfers: number
}
interface MonthlyTarget {
  month: string | number; year: number
  registrations: number; schedules: number; visits: number; enrollments: number
  enrollments_new?: number; enrollments_returning?: number
  investment_suggested: number; leads_target: number; cpa_target: number
}
interface AIAnalysis {
  summary: string; retention_rate: number
  retention_trend: 'up' | 'down' | 'stable'; novatos_trend: 'up' | 'down' | 'stable'
  suggested_start_date: string; suggested_end_date: string
  suggested_new_students: number; suggested_reenrollment: number
  key_insight: string; risk: string
}
interface GeneratedPlan {
  summary: {
    total_new_students_target: number; reenrollment_target: number
    reenrollment_rate_target: number; total_students_end: number; growth_rate: number
    realism_score: 'conservative' | 'realistic' | 'aggressive'; reasoning: string
  }
  pre_campaign?: { period: string; months_count: number; focus_areas: string[]; key_actions: string[]; reenrollment_projection: { target: number; current_rate: number; actions_needed: string } }
  monthly_targets: MonthlyTarget[]
  funnel_rates: { registration_to_schedule: number; schedule_to_visit: number; visit_to_enrollment: number }
  total_investment_suggested: number; total_leads_needed: number; average_cpa: number
  key_risks: string[]; key_actions: string[]; recalibration_note: string
}

// ─── Estilos ─────────────────────────────────────────────────────
const S = {
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 } as React.CSSProperties,
  input: { width: '100%', height: 40, padding: '0 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1A2B4A', background: '#F8FAFC', outline: 'none', boxSizing: 'border-box' as const },
  smallInput: { width: '100%', height: 34, padding: '0 8px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, color: '#1A2B4A', background: '#F8FAFC', outline: 'none', boxSizing: 'border-box' as const },
}

// ─── Helpers ─────────────────────────────────────────────────────
function getCampaignMonths(startDate: string, endDate: string) {
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const months: { label: string; month: number; year: number; period: string }[] = []
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const cur = new Date(start)
  while (cur <= end && months.length < 24) {
    months.push({ label: `${names[cur.getMonth()]}/${cur.getFullYear()}`, month: cur.getMonth() + 1, year: cur.getFullYear(), period: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}` })
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

function scalePlan(plan: GeneratedPlan, factor: number): GeneratedPlan {
  const s = JSON.parse(JSON.stringify(plan)) as GeneratedPlan
  s.monthly_targets = s.monthly_targets.map(m => {
    const ne = Math.round((m.enrollments_new ?? 0) * factor)
    const re = Math.round((m.enrollments_returning ?? 0) * factor)
    const te = ne + re
    const inv = Math.round((m.investment_suggested || 0) * factor)
    return { ...m, registrations: Math.round((m.registrations||0)*factor), schedules: Math.round((m.schedules||0)*factor), visits: Math.round((m.visits||0)*factor), enrollments_new: ne, enrollments_returning: re, enrollments: te, investment_suggested: inv, leads_target: Math.round((m.registrations||0)*factor), cpa_target: te > 0 ? Math.round(inv/te) : 0 }
  })
  s.summary.total_new_students_target = Math.round(plan.summary.total_new_students_target * factor)
  s.summary.reenrollment_target = Math.round(plan.summary.reenrollment_target * factor)
  s.total_investment_suggested = s.monthly_targets.reduce((a,m) => a + m.investment_suggested, 0)
  s.total_leads_needed = s.monthly_targets.reduce((a,m) => a + m.registrations, 0)
  const te = s.monthly_targets.reduce((a,m) => a + m.enrollments, 0)
  s.average_cpa = te > 0 ? Math.round(s.total_investment_suggested / te) : 0
  s.summary.realism_score = factor < 0.85 ? 'conservative' : factor > 1.15 ? 'aggressive' : 'realistic'
  return s
}

function redistributePlan(plan: GeneratedPlan, newTotal: number, reenrollTotal: number): GeneratedPlan {
  const u = JSON.parse(JSON.stringify(plan)) as GeneratedPlan
  const n = u.monthly_targets.length
  if (!n) return u
  const curNew = u.monthly_targets.reduce((s,m) => s + (m.enrollments_new??0), 0)
  const reenDist: Record<number,number> = {8:0,9:0.05,10:0.25,11:0.30,12:0.20,1:0.15,2:0.05}
  const cpa = u.average_cpa || 150
  u.monthly_targets = u.monthly_targets.map((m, idx) => {
    const w = curNew > 0 ? (m.enrollments_new??0)/curNew : 1/n
    const ne = Math.round(newTotal * w)
    const mn = typeof m.month === 'number' ? m.month : parseInt(String(m.month)) || (idx + 9)
    const re = Math.round(reenrollTotal * (reenDist[mn] ?? 0.03))
    const te = ne + re
    const vis = ne > 0 ? Math.ceil(ne/0.40) : 0
    const sch = vis > 0 ? Math.ceil(vis/0.63) : 0
    const reg = sch > 0 ? Math.ceil(sch/0.76) : 0
    const inv = Math.round(ne * cpa)
    return { ...m, enrollments_new: ne, enrollments_returning: re, enrollments: te, visits: vis, schedules: sch, registrations: reg, leads_target: reg, investment_suggested: inv, cpa_target: te > 0 ? Math.round(inv/te) : 0 }
  })
  u.summary.total_new_students_target = newTotal
  u.summary.reenrollment_target = reenrollTotal
  u.summary.total_students_end = newTotal + reenrollTotal
  u.total_investment_suggested = u.monthly_targets.reduce((s,m) => s+m.investment_suggested, 0)
  u.total_leads_needed = u.monthly_targets.reduce((s,m) => s+m.registrations, 0)
  const te2 = u.monthly_targets.reduce((s,m) => s+m.enrollments, 0)
  u.average_cpa = te2 > 0 ? Math.round(u.total_investment_suggested/te2) : 0
  return u
}

const GRADE_OPTIONS = ['Infantil I','Infantil II','Infantil III','Infantil IV','Infantil V','1º ao 5º EF','6º ao 9º EF','Ensino Médio']
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const GEN_MSGS = ['Analisando histórico e sazonalidade...','Calculando taxas de conversão...','Definindo metas mensais...','Estimando investimento...','Preparando plano completo...']
const STEP_LABELS = ['Upload','Diagnóstico','Configurar','Gerando','Revisar']

// ─── Componente principal ─────────────────────────────────────────
export default function CampaignGeneratorModal({
  isOpen, onClose, onApply, existingCycle, institutionId, institutionName,
  preloadedHistoricalData, preloadedErpFiles, openAtStep,
  isAdjustMode, currentUserId, currentUserName
}: Props) {
  const [step, setStep] = useState(1)
  const [erpFiles, setErpFiles] = useState<ErpFileEntry[]>([])
  const [historicalData, setHistoricalData] = useState<HistoricalYear[]>([])
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [loadingGenerate, setLoadingGenerate] = useState(false)
  const [multiFileProgress, setMultiFileProgress] = useState<string | null>(null)
  const [genProgress, setGenProgress] = useState(0)
  const [genMsgIdx, setGenMsgIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)
  const [adjustedPlan, setAdjustedPlan] = useState<GeneratedPlan | null>(null)
  const [generationMode, setGenerationMode] = useState('benchmark')
  const [ambitiousLevel, setAmbitiousLevel] = useState(1)
  const [applying, setApplying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [draftToast, setDraftToast] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [schoolData, setSchoolData] = useState<SchoolData>({
    name: institutionName, city: '', state: '', grades: [],
    avg_monthly_fee: 0, current_students: 0,
    start_date: `${new Date().getFullYear()}-09-01`,
    end_date: `${new Date().getFullYear() + 1}-02-28`
  })
  const [growthTarget, setGrowthTarget] = useState<GrowthTarget>({ type: 'percentage', value: 10 })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isMounted = useRef(true)
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false } }, [])

  const _sd = new Date((schoolData.start_date || `${new Date().getFullYear()}-09-01`) + 'T12:00:00')
  const executionYear = _sd.getFullYear()
  const campaignYear = executionYear + 1
  const campaignStartMonthNum = _sd.getMonth() + 1
  const campaignStartMonth = `${MONTH_NAMES[_sd.getMonth()]}/${executionYear}`
  const monthsUntil = Math.max(0, (executionYear - new Date().getFullYear()) * 12 + _sd.getMonth() - new Date().getMonth())
  const totalExits = Object.values(schoolData.exits ?? {}).reduce((s,v) => s + (Number(v)||0), 0)

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) { setStep(1); setError(null); setGeneratedPlan(null); setAdjustedPlan(null); setAiAnalysis(null); setGenProgress(0); setGenMsgIdx(0); setErpFiles([]); setHistoricalData([]) }
  }, [isOpen])

  // Pré-preencher cidade/estado
  useEffect(() => {
    if (!isOpen || !institutionId) return
    ;(async () => {
      const { data } = await supabase.from('institutions').select('city,state,name').eq('id', institutionId).single()
      if (data) setSchoolData(s => ({ ...s, city: (data.city as string)||s.city, state: (data.state as string)||s.state, name: (data.name as string)||s.name }))
    })()
  }, [isOpen, institutionId])

  // Pré-preencher existingCycle — em modo ajuste pula para Passo 3
  useEffect(() => {
    if (!isOpen || !existingCycle) return
    const sd = (existingCycle as any).school_data
    setSchoolData(s => ({
      ...s,
      current_students: existingCycle.base_students || 0,
      ...(existingCycle.start_date ? { start_date: existingCycle.start_date } : {}),
      ...(existingCycle.end_date ? { end_date: existingCycle.end_date } : {}),
      ...(sd?.city ? { city: sd.city } : {}),
      ...(sd?.state ? { state: sd.state } : {}),
      ...(sd?.grades?.length ? { grades: sd.grades } : {}),
      ...(sd?.avg_monthly_fee ? { avg_monthly_fee: sd.avg_monthly_fee } : {}),
      ...(sd?.exits ? { exits: sd.exits } : {}),
    }))
    if (existingCycle.historical_input?.length) {
      setHistoricalData(existingCycle.historical_input)
    }
    if (isAdjustMode && existingCycle.historical_input?.length) {
      setAiAnalysis({
        summary: "Ajuste de campanha — dados históricos carregados do ciclo anterior.",
        retention_rate: existingCycle.target_reenrollment_rate || 0.85,
        retention_trend: 'stable', novatos_trend: 'stable',
        suggested_start_date: existingCycle.start_date || new Date().getFullYear() + '-09-01',
        suggested_end_date: existingCycle.end_date || (new Date().getFullYear()+1) + '-02-28',
        suggested_new_students: existingCycle.target_new_students || 50,
        suggested_reenrollment: Math.round((existingCycle.base_students || 0) * (existingCycle.target_reenrollment_rate || 0.85)),
        key_insight: 'Campanha em andamento — ajuste as metas conforme o andamento real.',
        risk: 'Verifique se as metas estão alinhadas com o resultado atual da campanha.'
      })
      setStep(3)
    }
  }, [isOpen, existingCycle])

  useEffect(() => {
    if (!isOpen) return
    if (preloadedHistoricalData?.length) setHistoricalData(preloadedHistoricalData)
    if (preloadedErpFiles?.length) setErpFiles(preloadedErpFiles)
    if (openAtStep && openAtStep > 1) setStep(openAtStep)
  }, [isOpen])

  // Progress bar geração
  useEffect(() => {
    if (!loadingGenerate) return
    const i = setInterval(() => { setGenMsgIdx(x => Math.min(x+1,GEN_MSGS.length-1)); setGenProgress(p => Math.min(p+18,92)) }, 2000)
    return () => clearInterval(i)
  }, [loadingGenerate])

  // ── Upload ───────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setLoadingFile(true); setError(null)
    const newErpFiles: ErpFileEntry[] = []
    const newHistData: HistoricalYear[] = []
    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi]
      setMultiFileProgress(`Lendo ${fi+1} de ${files.length}: ${file.name}...`)
      const ext = file.name.split('.').pop()?.toLowerCase() as 'csv'|'xlsx'|'pdf'
      const isPdf = ext === 'pdf'
      try {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = ev => resolve((ev.target?.result as string)||'')
          reader.onerror = reject
          if (isPdf) reader.readAsDataURL(file); else reader.readAsText(file,'utf-8')
        })
        const fileContent = isPdf ? content.split(',')[1] : content
        const res = await fetch('/api/ai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'extract_file', payload:{ fileContent, fileType:ext, fileName:file.name, ...(isPdf?{isPdfImage:true}:{}) } }) })
        const data = await res.json()
        const result = data.result
        if (!result) throw new Error('sem resultado')
        const detectedYear = (result.detected_year as number) || parseInt(file.name.match(/\d{4}/)?.[0]||'0')
        const total = (result.total_students as number)||0
        const novatos = (result.new_students as number)||0
        const veterans = (result.returning_students as number)||0
        const fee = (result.avg_monthly_fee as number|null)||null
        newErpFiles.push({ name:file.name, year:detectedYear, total, novatos, veterans, fee:fee||undefined })
        if (detectedYear > 2000) {
          // ✅ SIGA: returning_students (veteranos) = reenrollments
          newHistData.push({ year:detectedYear, total_students:total||0, new_enrollments:novatos||0, reenrollments:(result.reenrollments as number)||veterans||0, transfers:(result.transfers as number)||0 })
        }
      } catch { newErpFiles.push({ name:file.name, year:0, total:0, novatos:0, veterans:0, error:true }) }
    }
    setErpFiles(prev => [...prev, ...newErpFiles].filter((f,i,arr) => arr.findIndex(x=>x.name===f.name)===i))
    if (newHistData.length) {
      setHistoricalData(prev => [...prev,...newHistData].reduce<HistoricalYear[]>((acc,r) => { if(!acc.find(x=>x.year===r.year)) acc.push(r); return acc },[]).sort((a,b)=>a.year-b.year))
      const mostRecent = newErpFiles.filter(f=>!f.error&&f.year>2000).sort((a,b)=>b.year-a.year)[0]
      if (mostRecent) setSchoolData(s => ({ ...s, current_students:mostRecent.total||s.current_students, ...(mostRecent.fee?{avg_monthly_fee:mostRecent.fee}:{}) }))
    }
    setMultiFileProgress(null); setLoadingFile(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Análise IA local (sem gastar créditos) ───────────────────────
  const analyzeWithAI = useCallback(async () => {
    setLoadingAnalysis(true); setError(null)
    try {
      const validFiles = erpFiles.filter(f=>!f.error&&f.year>0).sort((a,b)=>a.year-b.year)
      const last = validFiles[validFiles.length-1]
      const prev = validFiles[validFiles.length-2]
      const hd = historicalData.filter(d=>d.total_students>0)
      const retRates = hd.map(d => d.total_students>0 ? d.reenrollments/d.total_students : 0)
      const avgRet = retRates.length>0 ? retRates.reduce((s,r)=>s+r,0)/retRates.length : 0.85
      const novatosTrend = validFiles.length>=2 ? validFiles[validFiles.length-1].novatos>validFiles[0].novatos?'up':validFiles[validFiles.length-1].novatos<validFiles[0].novatos?'down':'stable' : 'stable'
      const retTrend = retRates.length>=2 ? retRates[retRates.length-1]>retRates[0]?'up':retRates[retRates.length-1]<retRates[0]?'down':'stable' : 'stable'
      const currentStudents = last?.total || hd[hd.length-1]?.total_students || 0
      const suggestedNew = last ? Math.round(last.novatos * 1.05) : 50
      const reenrollTarget = Math.round((currentStudents - (last?.novatos||0)) * avgRet)
      const novPctChange = prev && prev.novatos>0 ? Math.round((last.novatos-prev.novatos)/prev.novatos*100) : null
      const analysis: AIAnalysis = {
        summary: `A escola apresenta taxa de retenção média de ${(avgRet*100).toFixed(1)}% ${retTrend==='up'?'com tendência de melhora':retTrend==='down'?'em queda':'estável'}. ${last?`Em ${last.year}: ${last.total.toLocaleString('pt-BR')} alunos (${last.novatos} novatos + ${last.veterans} veteranos).`:''} ${novatosTrend==='down'?`Novatos caíram ${novPctChange!==null?Math.abs(novPctChange)+'%':'consistentemente'} — captação é a prioridade máxima.`:'A base está sólida — foque em manter a retenção e crescer incrementalmente.'}`,
        retention_rate: avgRet,
        retention_trend: retTrend as 'up'|'down'|'stable',
        novatos_trend: novatosTrend as 'up'|'down'|'stable',
        suggested_start_date: `${new Date().getFullYear()}-09-01`,
        suggested_end_date: `${new Date().getFullYear()+1}-02-28`,
        suggested_new_students: suggestedNew,
        suggested_reenrollment: reenrollTarget,
        key_insight: novatosTrend==='down' ? `Novatos caíram ${novPctChange!==null?Math.abs(novPctChange)+'%':''}  — sem ação, a escola perde base continuamente` : `Retenção de ${(avgRet*100).toFixed(1)}% é ${avgRet>=0.85?'excelente — foco total em captação':avgRet>=0.75?'boa — há espaço para melhorar':'abaixo do ideal — programa de retenção urgente'}`,
        risk: avgRet<0.80 ? 'Retenção abaixo de 80% — escola perde mais alunos do que deveria' : novatosTrend==='down' ? 'Queda consistente em novatos pode comprometer o volume nos próximos anos' : 'Manter investimento em captação para compensar saídas naturais'
      }
      setAiAnalysis(analysis)
      setSchoolData(s => ({ ...s, start_date:analysis.suggested_start_date, end_date:analysis.suggested_end_date, current_students:s.current_students||currentStudents }))
    } catch (e) { setError((e as Error).message) } finally { setLoadingAnalysis(false) }
  }, [historicalData, erpFiles])

  useEffect(() => {
    if (step===2 && historicalData.length>0 && !aiAnalysis && !loadingAnalysis) analyzeWithAI()
  }, [step])

  // ── Gerar campanha ───────────────────────────────────────────────
  const generateCampaign = useCallback(async () => {
    setLoadingGenerate(true); setGenMsgIdx(0); setGenProgress(5); setError(null)
    try {
      const res = await fetch('/api/ai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'generate_campaign', payload:{ schoolData:{...schoolData,name:institutionName}, historicalData, marketData:{}, growthTarget, executionYear, campaignYear, start_date:schoolData.start_date, end_date:schoolData.end_date, current_date:new Date().toLocaleDateString('pt-BR'), campaign_start_month:campaignStartMonth, months_until_campaign:monthsUntil, total_exits:totalExits } }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error||'Erro ao gerar campanha')
      setGenerationMode(data.mode||'benchmark')
      setGeneratedPlan(data.result)
      setAdjustedPlan(JSON.parse(JSON.stringify(data.result)))
      setAmbitiousLevel(1); setGenProgress(100)
      setTimeout(() => setStep(5), 400)
    } catch (e) { setError((e as Error).message) } finally { setLoadingGenerate(false) }
  }, [schoolData, historicalData, growthTarget, institutionName])

  const handleAmbitiousChange = (level: number) => {
    if (!generatedPlan) return
    setAmbitiousLevel(level)
    setAdjustedPlan(scalePlan(generatedPlan, [0.75,1.0,1.3][level]))
  }

  const handleManualTargets = (newS: number, reen: number) => {
    if (!generatedPlan) return
    setAdjustedPlan(redistributePlan(generatedPlan, newS, reen))
    setAmbitiousLevel(-1)
  }

  const updateMonthlyCell = (idx: number, field: keyof MonthlyTarget, value: number) => {
    if (!adjustedPlan) return
    const u = JSON.parse(JSON.stringify(adjustedPlan)) as GeneratedPlan
    u.monthly_targets = u.monthly_targets.map((m,i) => {
      if (i!==idx) return m
      const nm = { ...m, [field]:value }
      if (field==='enrollments_new'||field==='enrollments_returning') nm.enrollments=(nm.enrollments_new??0)+(nm.enrollments_returning??0)
      if (['investment_suggested','enrollments_new','enrollments_returning','enrollments'].includes(field)) nm.cpa_target=nm.enrollments>0?Math.round(nm.investment_suggested/nm.enrollments):0
      return nm
    })
    u.total_investment_suggested=u.monthly_targets.reduce((s,m)=>s+(m.investment_suggested||0),0)
    const te=u.monthly_targets.reduce((s,m)=>s+(m.enrollments||0),0)
    u.average_cpa=te>0?Math.round(u.total_investment_suggested/te):0
    setAdjustedPlan(u)
  }

  // ── Aplicar ──────────────────────────────────────────────────────
  const applyCampaign = async () => {
    if (!adjustedPlan) return
    setApplying(true)
    try {
      const sd = schoolData.start_date||`${executionYear}-09-01`
      const ed = schoolData.end_date||`${executionYear+1}-02-28`
      const cycleData: CycleData = { institution_id:institutionId, year:executionYear, label:`Campanha ${executionYear}`, start_date:sd, end_date:ed, target_new_students:adjustedPlan.summary.total_new_students_target, target_reenrollment_rate:adjustedPlan.summary.reenrollment_rate_target, base_students:schoolData.current_students, projected_cpa:adjustedPlan.average_cpa, monthly_targets:adjustedPlan.monthly_targets, market_data:{}, historical_input:historicalData, generation_mode:generationMode, ai_reasoning:adjustedPlan.summary.reasoning, realism_score:adjustedPlan.summary.realism_score, applied_at:new Date().toISOString() }
      if (isAdjustMode) {
        const { data: ac } = await supabase.from('campaign_cycles').select('id').eq('institution_id',institutionId).eq('status','active').maybeSingle()
        await supabase.from('campaign_change_requests').insert({ institution_id:institutionId, cycle_id:ac?.id??null, requested_by:currentUserId??null, requested_by_name:currentUserName??null, changes:cycleData, status:'pending', created_at:new Date().toISOString() })
        if (isMounted.current) { setDraftToast('📋 Solicitação enviada. Aguardando aprovação.'); setTimeout(()=>{if(isMounted.current){setDraftToast(null);onClose()}},2500) } else onClose()
        return
      }
      await supabase.from('campaign_cycles').upsert({ ...cycleData, status:'active', campaign_start_month:campaignStartMonthNum, school_data:{...schoolData,exits:schoolData.exits??{},total_exits:totalExits}, erp_files:erpFiles }, { onConflict:'institution_id,year' })
      const campaignMonths = getCampaignMonths(sd,ed)
      for (let mi=0;mi<adjustedPlan.monthly_targets.length;mi++) {
        const month=adjustedPlan.monthly_targets[mi]; const cm=campaignMonths[mi]
        const period=cm?cm.period:`${month.year}-${String(month.month).padStart(2,'0')}`
        await supabase.from('funnel_metrics').upsert({ institution_id:institutionId,period,registrations_target:month.registrations,schedules_target:month.schedules,visits_target:month.visits,enrollments_target:month.enrollments,registrations:0,schedules:0,visits:0,enrollments:0 },{onConflict:'period,institution_id',ignoreDuplicates:false})
        if ((month.enrollments_returning??0)>0) await supabase.from('monthly_reenrollments').upsert({institution_id:institutionId,period,target:month.enrollments_returning??0,confirmed:0,base_total:schoolData.current_students},{onConflict:'institution_id,period',ignoreDuplicates:false})
        await supabase.from('marketing_campaigns').upsert({institution_id:institutionId,month_year:cm?`${cm.month}-${cm.year}`:`${month.month}-${month.year}`,cpa_target:month.cpa_target,investment:0,leads_generated:0},{onConflict:'month_year,institution_id',ignoreDuplicates:false})
      }
      await supabase.from('system_notifications').insert({institution_id:institutionId,type:'milestone',severity:'success',title:`Campanha ${executionYear} configurada!`,message:`Metas ativas: ${adjustedPlan.summary.total_new_students_target} novatos e ${adjustedPlan.summary.reenrollment_target} rematrículas.`})
      onApply(cycleData)
      if (isMounted.current){setDraftToast('✅ Campanha aplicada!');setTimeout(()=>{if(isMounted.current){setDraftToast(null);onClose()}},1500)} else onClose()
    } catch(e){if(isMounted.current)setError((e as Error).message)} finally{if(isMounted.current){setApplying(false);setShowConfirm(false)}}
  }

  if (!isOpen) return null

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(15,23,42,0.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:step===5?1160:700,maxHeight:'95vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.3)'}}>

        {/* ── Header ── */}
        <div style={{padding:'20px 28px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:32,height:32,borderRadius:9,background:'#00A896',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:13,height:13,borderRadius:'50%',background:'white',border:'2px solid rgba(255,255,255,0.4)'}}/></div>
              <span style={{fontSize:14,fontWeight:700,color:'#1A2B4A'}}>Áion Edu</span>
              <span style={{fontSize:12,color:'#94A3B8',marginLeft:4}}>· Gerador de Campanha</span>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:'1px solid #E2E8F0',background:'#F8FAFC',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><X size={15} color="#64748B"/></button>
          </div>
          {/* Steps indicator */}
          <div style={{display:'flex',alignItems:'center',marginBottom:20}}>
            {STEP_LABELS.map((label,i) => {
              const num=i+1; const isActive=num===step; const isDone=num<step
              return (
                <React.Fragment key={label}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,background:isDone?'#00A896':isActive?'#1A2B4A':'#E2E8F0',color:isDone||isActive?'#fff':'#94A3B8',transition:'all 0.3s'}}>
                      {isDone?<Check size={12}/>:num}
                    </div>
                    <span style={{fontSize:9,fontWeight:600,color:isActive?'#1A2B4A':'#94A3B8',textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap'}}>{label}</span>
                  </div>
                  {i<STEP_LABELS.length-1&&<div style={{flex:1,height:2,background:num<step?'#00A896':'#E2E8F0',margin:'0 4px 14px',transition:'all 0.3s'}}/>}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* ── Conteúdo ── */}
        <div style={{flex:1,overflowY:'auto',padding:'0 28px'}}>
          {draftToast&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'10px 16px',marginBottom:12,fontSize:13,color:'#166534',display:'flex',alignItems:'center',gap:8}}><Check size={14} color="#16a34a"/>{draftToast}</div>}
          {step===1&&<Step1Upload erpFiles={erpFiles} setErpFiles={setErpFiles} loadingFile={loadingFile} multiFileProgress={multiFileProgress} fileInputRef={fileInputRef} onFileChange={handleFileChange} historicalData={historicalData} setHistoricalData={setHistoricalData}/>}
          {step===2&&<Step2Analysis erpFiles={erpFiles} aiAnalysis={aiAnalysis} loading={loadingAnalysis} error={error} onRetry={analyzeWithAI}/>}
          {step===3&&<Step3Config schoolData={schoolData} setSchoolData={setSchoolData} growthTarget={growthTarget} setGrowthTarget={setGrowthTarget} aiAnalysis={aiAnalysis} totalExits={totalExits}/>}
          {step===4&&<Step4Generating loading={loadingGenerate} progress={genProgress} msgIdx={genMsgIdx} msgs={GEN_MSGS} error={error} onRetry={generateCampaign}/>}
          {step===5&&adjustedPlan&&<Step5Review plan={adjustedPlan} basePlan={generatedPlan!} ambitiousLevel={ambitiousLevel} campaignYear={campaignYear} startDate={schoolData.start_date||`${executionYear}-09-01`} endDate={schoolData.end_date||`${executionYear+1}-02-28`} erpFiles={erpFiles} totalExits={totalExits} currentStudents={schoolData.current_students} monthsUntilCampaign={monthsUntil} campaignStartMonth={campaignStartMonth} onAmbitiousChange={handleAmbitiousChange} onManualTargets={handleManualTargets} onUpdateCell={updateMonthlyCell} onRegenerate={()=>{setStep(4);generateCampaign()}}/>}
        </div>

        {/* ── Footer ── */}
        <div style={{padding:'14px 28px 18px',borderTop:'1px solid #E2E8F0',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',background:'#FAFAFA'}}>
          <div>
            {step>1&&step!==4&&<button onClick={()=>setStep(s=>s-1)} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:10,border:'1px solid #E2E8F0',background:'#fff',fontSize:13,color:'#64748B',cursor:'pointer'}}><ChevronLeft size={14}/>Voltar</button>}
          </div>
          <div style={{display:'flex',gap:8}}>
            {step===5&&<button onClick={()=>{setDraftSaved(true);setTimeout(()=>setDraftSaved(false),2000)}} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:10,border:`1px solid ${draftSaved?'#bbf7d0':'#E2E8F0'}`,background:draftSaved?'#f0fdf4':'#fff',fontSize:13,color:draftSaved?'#16a34a':'#64748B',cursor:'pointer'}}>{draftSaved&&<Check size={13}/>}{draftSaved?'Salvo!':'Salvar rascunho'}</button>}
            {step===1&&<button onClick={()=>setStep(2)} disabled={erpFiles.filter(f=>!f.error).length===0&&historicalData.length===0} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 20px',borderRadius:10,background:(erpFiles.filter(f=>!f.error).length>0||historicalData.length>0)?'#00A896':'#E2E8F0',color:(erpFiles.filter(f=>!f.error).length>0||historicalData.length>0)?'#fff':'#94A3B8',border:'none',fontSize:13,fontWeight:600,cursor:(erpFiles.filter(f=>!f.error).length>0||historicalData.length>0)?'pointer':'not-allowed'}}>Analisar dados<ChevronRight size={14}/></button>}
            {step===2&&!loadingAnalysis&&aiAnalysis&&<button onClick={()=>setStep(3)} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 20px',borderRadius:10,background:'#00A896',color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer'}}>Configurar campanha<ChevronRight size={14}/></button>}
            {step===3&&<button onClick={()=>{setStep(4);setTimeout(generateCampaign,100)}} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 20px',borderRadius:10,background:'#00A896',color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer'}}><Sparkles size={14}/>Gerar plano com IA</button>}
            {step===5&&<button onClick={()=>setShowConfirm(true)} disabled={applying} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 20px',borderRadius:10,background:'#00A896',color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer',opacity:applying?0.7:1}}>{applying?<Loader2 size={14} className="animate-spin"/>:<Check size={14}/>}Aplicar ao sistema</button>}
          </div>
        </div>
      </div>

      {showConfirm&&(
        <div style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(15,23,42,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:28,maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><div style={{width:36,height:36,borderRadius:10,background:'#D1FAE5',display:'flex',alignItems:'center',justifyContent:'center'}}><Shield size={16} color="#00A896"/></div><span style={{fontSize:16,fontWeight:700,color:'#1A2B4A'}}>Confirmar aplicação</span></div>
            <p style={{fontSize:13,color:'#475569',lineHeight:1.6,marginBottom:20}}>{isAdjustMode?<>Solicitação enviada ao administrador.<br/><br/><strong>Você será notificado quando aprovado.</strong></>:<>Todo o sistema usará estas metas como referência.<br/><br/><strong>Você pode regerar a qualquer momento.</strong></>}</p>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowConfirm(false)} style={{padding:'9px 18px',borderRadius:9,border:'1px solid #E2E8F0',background:'#fff',fontSize:13,cursor:'pointer',color:'#64748B'}}>Cancelar</button>
              <button onClick={applyCampaign} disabled={applying} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 18px',borderRadius:9,background:'#00A896',color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer'}}>{applying?<Loader2 size={13} className="animate-spin"/>:<Check size={13}/>}Confirmar e aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Passo 1 — Upload ────────────────────────────────────────────
function Step1Upload({ erpFiles, setErpFiles, loadingFile, multiFileProgress, fileInputRef, onFileChange, historicalData, setHistoricalData }: { erpFiles:ErpFileEntry[]; setErpFiles:React.Dispatch<React.SetStateAction<ErpFileEntry[]>>; loadingFile:boolean; multiFileProgress:string|null; fileInputRef:React.RefObject<HTMLInputElement>; onFileChange:(e:React.ChangeEvent<HTMLInputElement>)=>void; historicalData:HistoricalYear[]; setHistoricalData:React.Dispatch<React.SetStateAction<HistoricalYear[]>> }) {
  const validFiles = erpFiles.filter(f=>!f.error&&f.year>0)
  return (
    <div style={{paddingBottom:24}}>
      <h2 style={{fontSize:22,fontWeight:800,color:'#1A2B4A',marginBottom:6}}>Suba os relatórios do ERP</h2>
      <p style={{fontSize:14,color:'#64748B',marginBottom:24,lineHeight:1.6}}>A IA lê e extrai os dados automaticamente. Aceita <strong>SIGA</strong>, Totvs e outros ERPs em PDF, Excel ou CSV.</p>
      <div onClick={()=>!loadingFile&&fileInputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!loadingFile){const dt=new DataTransfer();Array.from(e.dataTransfer.files).forEach(f=>dt.items.add(f));if(fileInputRef.current){fileInputRef.current.files=dt.files;onFileChange({target:fileInputRef.current} as React.ChangeEvent<HTMLInputElement>)}}}} style={{border:'2px dashed #CBD5E1',borderRadius:16,padding:'36px 24px',textAlign:'center',cursor:loadingFile?'default':'pointer',background:'#F8FAFC',marginBottom:16}}>
        {loadingFile?<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}><div style={{width:48,height:48,borderRadius:'50%',background:'#E6F7F5',display:'flex',alignItems:'center',justifyContent:'center'}}><Loader2 size={24} color="#00A896" className="animate-spin"/></div><span style={{fontSize:13,color:'#64748B'}}>{multiFileProgress||'Processando...'}</span></div>:<><div style={{width:56,height:56,borderRadius:16,background:'#E6F7F5',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}><Upload size={24} color="#00A896"/></div><p style={{fontSize:15,color:'#1A2B4A',fontWeight:600,margin:'0 0 6px'}}>{erpFiles.length>0?'Adicionar mais arquivos':'Arraste ou clique para selecionar'}</p><p style={{fontSize:12,color:'#94A3B8',margin:0}}>PDF, Excel ou CSV · SIGA, Totvs e outros · Até 5 arquivos</p></>}
      </div>
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.pdf" multiple style={{display:'none'}} onChange={onFileChange}/>
      {erpFiles.length>0&&<div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>{erpFiles.map((f,i)=>(<div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:12,background:f.error?'#fef2f2':'#f0fdf4',border:`1px solid ${f.error?'#fca5a5':'#bbf7d0'}`}}><div style={{width:36,height:36,borderRadius:10,background:f.error?'#fee2e2':'#d1fae5',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{f.error?<AlertTriangle size={16} color="#dc2626"/>:<FileText size={16} color="#16a34a"/>}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:f.error?'#991b1b':'#166534',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div>{!f.error&&f.year>0&&<div style={{fontSize:11,color:'#6b7280',marginTop:2}}>{f.year} · {f.total.toLocaleString('pt-BR')} alunos · {f.novatos} novatos · {f.veterans} veteranos · {f.total>0?((f.veterans/f.total)*100).toFixed(1):'?'}% retenção</div>}{f.error&&<div style={{fontSize:11,color:'#991b1b',marginTop:2}}>Não foi possível ler — verifique o formato</div>}</div><button onClick={()=>setErpFiles(prev=>prev.filter((_,fi)=>fi!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',padding:4}}>✕</button></div>))}</div>}
      <div style={{background:'#F8FAFC',borderRadius:12,padding:16,border:'1px solid #E2E8F0'}}>
        <p style={{fontSize:12,color:'#94A3B8',margin:'0 0 12px',textAlign:'center'}}>ou preencha manualmente</p>
        <div style={{display:'grid',gridTemplateColumns:'70px 1fr 1fr 1fr 1fr',gap:8,marginBottom:6}}>{['Ano','Total','Novatos','Remat.','Transfer.'].map(h=><span key={h} style={{fontSize:10,color:'#94A3B8',fontWeight:600,textAlign:'center'}}>{h}</span>)}</div>
        {historicalData.map((row,i)=>(<div key={i} style={{display:'grid',gridTemplateColumns:'70px 1fr 1fr 1fr 1fr',gap:8,marginBottom:8}}>
          <input type="number" placeholder="2026" style={S.smallInput} value={row.year||''} onChange={e=>setHistoricalData(d=>d.map((r,ri)=>ri===i?{...r,year:parseInt(e.target.value)||0}:r))}/>
          <input type="number" placeholder="956" style={S.smallInput} value={row.total_students||''} onChange={e=>setHistoricalData(d=>d.map((r,ri)=>ri===i?{...r,total_students:parseInt(e.target.value)||0}:r))}/>
          <input type="number" placeholder="116" style={S.smallInput} value={row.new_enrollments||''} onChange={e=>setHistoricalData(d=>d.map((r,ri)=>ri===i?{...r,new_enrollments:parseInt(e.target.value)||0}:r))}/>
          <input type="number" placeholder="840" style={S.smallInput} value={row.reenrollments||''} onChange={e=>setHistoricalData(d=>d.map((r,ri)=>ri===i?{...r,reenrollments:parseInt(e.target.value)||0}:r))}/>
          <input type="number" placeholder="0" style={S.smallInput} value={row.transfers||''} onChange={e=>setHistoricalData(d=>d.map((r,ri)=>ri===i?{...r,transfers:parseInt(e.target.value)||0}:r))}/>
        </div>))}
        <button onClick={()=>setHistoricalData(d=>[...d,{year:new Date().getFullYear()-1-d.length,total_students:0,new_enrollments:0,reenrollments:0,transfers:0}])} style={{fontSize:12,color:'#00A896',background:'none',border:'none',cursor:'pointer',padding:'4px 0'}}>+ Adicionar ano</button>
      </div>
      {validFiles.length>0&&<div style={{marginTop:12,padding:'12px 16px',background:'#E6F7F5',borderRadius:10,display:'flex',alignItems:'center',gap:10}}><Check size={16} color="#00A896"/><span style={{fontSize:13,color:'#065F46',fontWeight:600}}>{validFiles.length} arquivo{validFiles.length>1?'s':''} lido{validFiles.length>1?'s':''} — clique em "Analisar dados" para continuar</span></div>}
    </div>
  )
}

// ─── Passo 2 — Diagnóstico ────────────────────────────────────────
function Step2Analysis({ erpFiles, aiAnalysis, loading, error, onRetry }: { erpFiles:ErpFileEntry[]; aiAnalysis:AIAnalysis|null; loading:boolean; error:string|null; onRetry:()=>void }) {
  const validFiles = erpFiles.filter(f=>!f.error&&f.year>0).sort((a,b)=>a.year-b.year)
  const chartData = validFiles.map(f=>({ year:String(f.year), novatos:f.novatos, veteranos:f.veterans, retencao:f.total>0?+((f.veterans/f.total)*100).toFixed(1):0 }))
  return (
    <div style={{paddingBottom:24}}>
      <h2 style={{fontSize:22,fontWeight:800,color:'#1A2B4A',marginBottom:6}}>Diagnóstico da sua escola</h2>
      <p style={{fontSize:14,color:'#64748B',marginBottom:20}}>Análise baseada em {validFiles.length} ano{validFiles.length!==1?'s':''} de histórico.</p>
      {loading&&<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,padding:'40px 0'}}><div style={{width:56,height:56,borderRadius:'50%',background:'#E6F7F5',display:'flex',alignItems:'center',justifyContent:'center'}}><Sparkles size={24} color="#00A896"/></div><p style={{fontSize:14,color:'#475569'}}>Analisando histórico...</p></div>}
      {error&&!loading&&<div style={{padding:16,background:'#FFF1F2',borderRadius:12,border:'1px solid #FECDD3',marginBottom:16}}><p style={{fontSize:13,color:'#BE123C',marginBottom:10}}>{error}</p><button onClick={onRetry} style={{fontSize:12,color:'#00A896',background:'#E6F7F5',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer'}}>Tentar novamente</button></div>}
      {aiAnalysis&&!loading&&(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
            {[
              {label:'Alunos atuais',value:validFiles[validFiles.length-1]?.total.toLocaleString('pt-BR')||'—',sub:`Ano ${validFiles[validFiles.length-1]?.year||''}`,color:'#1A2B4A',bg:'#F8FAFC'},
              {label:'Retenção média',value:`${(aiAnalysis.retention_rate*100).toFixed(1)}%`,sub:aiAnalysis.retention_trend==='up'?'↗ Melhorando':aiAnalysis.retention_trend==='down'?'↘ Caindo':'→ Estável',color:aiAnalysis.retention_rate>=0.85?'#16a34a':aiAnalysis.retention_rate>=0.75?'#d97706':'#dc2626',bg:aiAnalysis.retention_rate>=0.85?'#f0fdf4':aiAnalysis.retention_rate>=0.75?'#fffbeb':'#fef2f2'},
              {label:'Novatos (último ano)',value:validFiles[validFiles.length-1]?.novatos.toLocaleString('pt-BR')||'—',sub:aiAnalysis.novatos_trend==='up'?'↗ Crescendo':aiAnalysis.novatos_trend==='down'?'↘ Caindo':'→ Estável',color:aiAnalysis.novatos_trend==='up'?'#16a34a':aiAnalysis.novatos_trend==='down'?'#dc2626':'#d97706',bg:aiAnalysis.novatos_trend==='up'?'#f0fdf4':aiAnalysis.novatos_trend==='down'?'#fef2f2':'#fffbeb'},
              {label:'Rematrícula sugerida',value:aiAnalysis.suggested_reenrollment.toLocaleString('pt-BR'),sub:`${(aiAnalysis.retention_rate*100).toFixed(0)}% dos elegíveis`,color:'#3B82F6',bg:'#EFF6FF'},
            ].map((card,i)=>(<div key={i} style={{background:card.bg,borderRadius:12,padding:'14px 16px',border:'1px solid #E2E8F0'}}><p style={{margin:'0 0 8px',fontSize:10,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.05em'}}>{card.label}</p><p style={{margin:'0 0 4px',fontSize:22,fontWeight:800,color:card.color,lineHeight:1}}>{card.value}</p><p style={{margin:0,fontSize:11,color:'#64748B'}}>{card.sub}</p></div>))}
          </div>
          <div style={{background:'linear-gradient(135deg,#1A2B4A,#2d4494)',borderRadius:14,padding:20}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><Sparkles size={16} color="#fff"/><span style={{fontSize:13,fontWeight:700,color:'#fff'}}>Análise</span></div>
            <p style={{margin:'0 0 14px',fontSize:13,color:'rgba(255,255,255,0.9)',lineHeight:1.7}}>{aiAnalysis.summary}</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{background:'rgba(0,168,150,0.2)',borderRadius:10,padding:'10px 14px'}}><p style={{margin:'0 0 4px',fontSize:10,fontWeight:700,color:'#5eead4',textTransform:'uppercase'}}>💡 Insight</p><p style={{margin:0,fontSize:12,color:'#ccfbf1',lineHeight:1.5}}>{aiAnalysis.key_insight}</p></div>
              <div style={{background:'rgba(239,68,68,0.15)',borderRadius:10,padding:'10px 14px'}}><p style={{margin:'0 0 4px',fontSize:10,fontWeight:700,color:'#fca5a5',textTransform:'uppercase'}}>⚠️ Risco</p><p style={{margin:0,fontSize:12,color:'#fee2e2',lineHeight:1.5}}>{aiAnalysis.risk}</p></div>
            </div>
          </div>
          {chartData.length>=2&&(
            <div style={{background:'#fff',borderRadius:14,border:'1px solid #E2E8F0',padding:20}}>
              <h3 style={{margin:'0 0 16px',fontSize:13,fontWeight:700,color:'#1A2B4A'}}>Tendência histórica</h3>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis dataKey="year" tick={{fontSize:11,fill:'#94A3B8'}}/>
                  <YAxis yAxisId="vol" tick={{fontSize:11,fill:'#94A3B8'}} width={40}/>
                  <YAxis yAxisId="pct" orientation="right" tick={{fontSize:11,fill:'#94A3B8'}} width={36} tickFormatter={v=>`${v}%`}/>
                  <Tooltip contentStyle={{borderRadius:10,fontSize:12}}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  <Bar yAxisId="vol" dataKey="novatos" name="Novatos" fill="#00A896" radius={[4,4,0,0]}/>
                  <Bar yAxisId="vol" dataKey="veteranos" name="Veteranos" fill="#BFDBFE" radius={[4,4,0,0]}/>
                  <Line yAxisId="pct" type="monotone" dataKey="retencao" name="Retenção %" stroke="#F59E0B" strokeWidth={2.5} dot={{r:4}}/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{background:'#F0FDF4',borderRadius:12,padding:'14px 16px',border:'1px solid #BBF7D0',display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:36,height:36,borderRadius:10,background:'#D1FAE5',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Calendar size={16} color="#16a34a"/></div>
            <div><p style={{margin:0,fontSize:13,fontWeight:700,color:'#166534'}}>Período sugerido</p><p style={{margin:'2px 0 0',fontSize:12,color:'#16a34a'}}>{new Date(aiAnalysis.suggested_start_date+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})} → {new Date(aiAnalysis.suggested_end_date+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p></div>
            <div style={{marginLeft:'auto',textAlign:'right'}}><p style={{margin:0,fontSize:11,color:'#94A3B8'}}>Novatos sugeridos</p><p style={{margin:'2px 0 0',fontSize:20,fontWeight:800,color:'#00A896'}}>{aiAnalysis.suggested_new_students}</p></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Passo 3 — Configurar ────────────────────────────────────────
function Step3Config({ schoolData, setSchoolData, growthTarget, setGrowthTarget, aiAnalysis, totalExits }: { schoolData:SchoolData; setSchoolData:React.Dispatch<React.SetStateAction<SchoolData>>; growthTarget:GrowthTarget; setGrowthTarget:React.Dispatch<React.SetStateAction<GrowthTarget>>; aiAnalysis:AIAnalysis|null; totalExits:number }) {
  return (
    <div style={{paddingBottom:24}}>
      <h2 style={{fontSize:22,fontWeight:800,color:'#1A2B4A',marginBottom:6}}>Configure a campanha</h2>
      <p style={{fontSize:14,color:'#64748B',marginBottom:20}}>Confirme os dados e ajuste o objetivo antes de gerar o plano.</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
        <div><label style={S.label}>Mensalidade média</label><div style={{position:'relative'}}><span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'#94A3B8'}}>R$</span><input type="number" style={{...S.input,paddingLeft:36}} placeholder="1500" value={schoolData.avg_monthly_fee||''} onChange={e=>setSchoolData(s=>({...s,avg_monthly_fee:parseFloat(e.target.value)||0}))}/></div></div>
        <div><label style={S.label}>Total de alunos atualmente</label><input type="number" style={S.input} placeholder="956" value={schoolData.current_students||''} onChange={e=>setSchoolData(s=>({...s,current_students:parseInt(e.target.value)||0}))}/>{schoolData.current_students>0&&<span style={{fontSize:11,color:'#16a34a',marginTop:3,display:'block'}}>✓ Preenchido do arquivo ERP</span>}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
        <div><label style={S.label}>Início{aiAnalysis&&<span style={{marginLeft:8,fontSize:10,color:'#16a34a',fontWeight:600}}>IA sugeriu: {new Date(aiAnalysis.suggested_start_date+'T12:00:00').toLocaleDateString('pt-BR',{month:'short',year:'numeric'})}</span>}</label><input type="date" style={S.input} value={schoolData.start_date||''} onChange={e=>setSchoolData(s=>({...s,start_date:e.target.value}))}/></div>
        <div><label style={S.label}>Fim da campanha</label><input type="date" style={S.input} value={schoolData.end_date||''} onChange={e=>setSchoolData(s=>({...s,end_date:e.target.value}))}/></div>
      </div>
      <div style={{marginBottom:16}}><label style={S.label}>Séries</label><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:6}}>{GRADE_OPTIONS.map(g=>{const active=schoolData.grades.includes(g);return<button key={g} onClick={()=>setSchoolData(s=>({...s,grades:active?s.grades.filter(x=>x!==g):[...s.grades,g]}))} style={{padding:'7px 8px',borderRadius:8,fontSize:12,cursor:'pointer',border:active?'1.5px solid #00A896':'1px solid #E2E8F0',background:active?'#E6F7F5':'#F8FAFC',color:active?'#00A896':'#64748B',fontWeight:active?600:400}}>{g}</button>})}</div></div>
      {schoolData.grades.length>0&&<div style={{marginBottom:16,padding:16,background:'#F8FAFC',borderRadius:12,border:'1px solid #E2E8F0'}}><label style={{...S.label,marginBottom:10}}>Formandos por série</label><div style={{display:'flex',flexDirection:'column',gap:8}}>{schoolData.grades.map(grade=>(<div key={grade} style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:13,color:'#475569',width:130,flexShrink:0}}>{grade}</span><input type="number" min={0} placeholder="0" value={schoolData.exits?.[grade]??''} onChange={e=>setSchoolData(prev=>({...prev,exits:{...prev.exits,[grade]:parseInt(e.target.value)||0}}))} style={{width:70,height:32,padding:'0 8px',borderRadius:7,border:'1px solid #E2E8F0',fontSize:12,background:'#fff',outline:'none'}}/><span style={{fontSize:11,color:'#94A3B8'}}>alunos</span></div>))}</div>{totalExits>0&&<p style={{fontSize:12,color:'#64748B',marginTop:10,marginBottom:0}}>Total saídas: <strong>{totalExits}</strong></p>}</div>}
      <div><label style={S.label}>Objetivo<span style={{marginLeft:8,fontSize:11,color:'#94A3B8',fontWeight:400}}>— a IA analisa criticamente</span></label>{aiAnalysis&&<div style={{marginBottom:10,padding:'10px 14px',background:'#E6F7F5',borderRadius:9,display:'flex',alignItems:'center',gap:8}}><Sparkles size={12} color="#00A896"/><span style={{fontSize:12,color:'#065F46'}}>IA sugere: <strong>{aiAnalysis.suggested_new_students} novatos</strong> + <strong>{aiAnalysis.suggested_reenrollment} rematrículas</strong></span></div>}<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>{(['percentage','absolute','students'] as const).map(type=>{const labels={percentage:'Crescer X%',absolute:'Adicionar X novatos',students:'Atingir X alunos total'};const placeholders={percentage:'10',absolute:'50',students:'1000'};const active=growthTarget.type===type;return(<div key={type} onClick={()=>setGrowthTarget(t=>({...t,type}))} style={{padding:14,borderRadius:12,cursor:'pointer',border:active?'2px solid #00A896':'1.5px solid #E2E8F0',background:active?'#E6F7F5':'#F8FAFC'}}><div style={{fontSize:12,fontWeight:600,color:active?'#00A896':'#475569',marginBottom:8}}>{labels[type]}</div><input type="number" style={{width:'100%',padding:'6px 10px',borderRadius:7,border:'1px solid #E2E8F0',fontSize:14,background:'#fff',outline:'none'}} placeholder={placeholders[type]} value={growthTarget.type===type?growthTarget.value||'':''} onClick={e=>e.stopPropagation()} onChange={e=>setGrowthTarget({type,value:parseFloat(e.target.value)||0})}/></div>)})}</div></div>
    </div>
  )
}

// ─── Passo 4 — Gerando ───────────────────────────────────────────
function Step4Generating({ loading, progress, msgIdx, msgs, error, onRetry }: { loading:boolean; progress:number; msgIdx:number; msgs:string[]; error:string|null; onRetry:()=>void }) {
  return (
    <div style={{paddingBottom:24,paddingTop:16}}>
      <h2 style={{fontSize:22,fontWeight:800,color:'#1A2B4A',marginBottom:6}}>Gerando seu plano</h2>
      <p style={{fontSize:14,color:'#64748B',marginBottom:32}}>A IA está montando as metas com base no histórico e sazonalidade real.</p>
      {loading&&<div><div style={{height:6,background:'#E2E8F0',borderRadius:999,overflow:'hidden',marginBottom:28}}><div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,#00A896,#0DD3BF)',borderRadius:999,transition:'width 0.8s ease'}}/></div><div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}><div style={{width:64,height:64,borderRadius:'50%',background:'#E6F7F5',display:'flex',alignItems:'center',justifyContent:'center'}}><Sparkles size={28} color="#00A896"/></div><p style={{fontSize:15,color:'#475569',textAlign:'center',minHeight:22}}>{msgs[msgIdx]}</p><p style={{fontSize:12,color:'#94A3B8'}}>Pode levar até 20 segundos...</p></div></div>}
      {error&&!loading&&<div style={{padding:20,background:'#FFF1F2',borderRadius:12,border:'1px solid #FECDD3'}}><p style={{fontSize:13,color:'#BE123C',marginBottom:12}}>{error}</p><button onClick={onRetry} style={{fontSize:12,color:'#00A896',background:'#E6F7F5',border:'none',borderRadius:8,padding:'7px 14px',cursor:'pointer'}}>Tentar novamente</button></div>}
    </div>
  )
}

// ─── Passo 5 — Revisão ───────────────────────────────────────────
function Step5Review({ plan, basePlan, ambitiousLevel, campaignYear, startDate, endDate, erpFiles, totalExits, currentStudents, monthsUntilCampaign, campaignStartMonth, onAmbitiousChange, onManualTargets, onUpdateCell, onRegenerate }: {
  plan:GeneratedPlan; basePlan:GeneratedPlan; ambitiousLevel:number
  campaignYear:number; startDate:string; endDate:string
  erpFiles:ErpFileEntry[]; totalExits:number; currentStudents:number
  monthsUntilCampaign:number; campaignStartMonth:string
  onAmbitiousChange:(l:number)=>void; onManualTargets:(n:number,r:number)=>void
  onUpdateCell:(i:number,f:keyof MonthlyTarget,v:number)=>void; onRegenerate?:()=>void
}) {
  const [manualNew, setManualNew] = useState(plan.summary.total_new_students_target)
  const [manualReen, setManualReen] = useState(plan.summary.reenrollment_target)
  const [showManual, setShowManual] = useState(false)

  useEffect(() => { setManualNew(plan.summary.total_new_students_target); setManualReen(plan.summary.reenrollment_target) }, [plan.summary.total_new_students_target, plan.summary.reenrollment_target])

  const campaignMonths = getCampaignMonths(startDate, endDate)
  const reenrollTarget = plan.summary.reenrollment_target || 0
  const eligibleBase = Math.max(1, currentStudents - totalExits)
  const totals = plan.monthly_targets.reduce((acc,m) => ({ reg:acc.reg+m.registrations, sch:acc.sch+m.schedules, vis:acc.vis+m.visits, enr:acc.enr+m.enrollments, inv:acc.inv+m.investment_suggested, ne:acc.ne+(m.enrollments_new??0), re:acc.re+(m.enrollments_returning??0) }), {reg:0,sch:0,vis:0,enr:0,inv:0,ne:0,re:0})
  let accReen=0
  const reenRows = plan.monthly_targets.map((m,i) => { const mr=m.enrollments_returning??0; accReen+=mr; return { label:campaignMonths[i]?.label??`${m.month}/${m.year}`, monthNum:campaignMonths[i]?.month??0, mr, accReen, pct:reenrollTarget>0?(accReen/reenrollTarget)*100:0 } })
  const realismMap = { conservative:{label:'Conservadora',bg:'#EFF6FF',color:'#1D4ED8'}, realistic:{label:'Realista',bg:'#ECFDF5',color:'#065F46'}, aggressive:{label:'Agressiva',bg:'#FFF7ED',color:'#9A3412'} }
  const realism = realismMap[plan.summary.realism_score]||realismMap.realistic
  const criticalTotal = reenRows.filter(r=>[10,11].includes(r.monthNum)).reduce((s,r)=>s+r.mr,0)
  const criticalPct = reenrollTarget>0?Math.round(criticalTotal/reenrollTarget*100):0

  return (
    <div style={{paddingBottom:24}}>

      {/* ZONA 1 — Resumo */}
      <div style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <h3 style={{margin:0,fontSize:16,fontWeight:800,color:'#1A2B4A'}}>Plano — Ano letivo {campaignYear}</h3>
            <span style={{padding:'4px 12px',borderRadius:999,fontSize:11,fontWeight:700,background:realism.bg,color:realism.color}}>Meta {realism.label}</span>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setShowManual(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:9,border:`1px solid ${showManual?'#BBF7D0':'#E2E8F0'}`,background:showManual?'#f0fdf4':'#fff',fontSize:12,color:showManual?'#16a34a':'#64748B',cursor:'pointer',fontWeight:600}}><Edit3 size={12}/> Ajustar metas</button>
            {onRegenerate&&<button onClick={onRegenerate} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:9,background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe',fontSize:12,fontWeight:600,cursor:'pointer'}}><RefreshCw size={12}/> Recalcular com IA</button>}
          </div>
        </div>

        {/* 4 KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:14}}>
          {[
            {label:'Total projetado',value:(plan.summary.total_new_students_target+reenrollTarget).toLocaleString('pt-BR'),sub:'alunos no final',color:'#1A2B4A',bg:'#F8FAFC',icon:<Users size={18} color="#1A2B4A"/>},
            {label:'Novatos (meta)',value:plan.summary.total_new_students_target.toLocaleString('pt-BR'),sub:'novas matrículas',color:'#00A896',bg:'#E6F7F5',icon:<TrendingUp size={18} color="#00A896"/>},
            {label:'Rematrículas (meta)',value:reenrollTarget.toLocaleString('pt-BR'),sub:`${eligibleBase} elegíveis`,color:'#3B82F6',bg:'#EFF6FF',icon:<RefreshCw size={18} color="#3B82F6"/>},
            {label:'Investimento total',value:`R$ ${plan.total_investment_suggested.toLocaleString('pt-BR')}`,sub:`CPA médio R$ ${plan.average_cpa}`,color:'#8B5CF6',bg:'#F5F3FF',icon:<DollarSign size={18} color="#8B5CF6"/>},
          ].map((k,i)=>(<div key={i} style={{background:k.bg,borderRadius:14,padding:'16px 18px',border:'1px solid #E2E8F0'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:10,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.05em'}}>{k.label}</span>{k.icon}</div><p style={{margin:0,fontSize:22,fontWeight:800,color:k.color,lineHeight:1}}>{k.value}</p><p style={{margin:'4px 0 0',fontSize:11,color:'#94A3B8'}}>{k.sub}</p></div>))}
        </div>

        {/* Análise IA + Slider */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 220px',gap:12,marginBottom:showManual?12:0}}>
          <div style={{background:'#EFF6FF',borderRadius:12,padding:'12px 16px'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><Sparkles size={13} color="#3B82F6"/><span style={{fontSize:11,fontWeight:700,color:'#1D4ED8'}}>Análise da IA</span></div><p style={{margin:0,fontSize:12,color:'#1E40AF',lineHeight:1.65}}>{plan.summary.reasoning}</p></div>
          <div style={{background:'#F8FAFC',borderRadius:12,padding:'12px 14px',border:'1px solid #E2E8F0'}}><p style={{margin:'0 0 8px',fontSize:11,fontWeight:600,color:'#475569',display:'flex',alignItems:'center',gap:6}}><SlidersHorizontal size={12}/> Nível de ambição</p><div style={{display:'flex',gap:6}}>{[{l:0,i:'🛡️',t:'Conserv.'},{l:1,i:'🎯',t:'Realista'},{l:2,i:'🚀',t:'Agressivo'}].map(o=>(<button key={o.l} onClick={()=>onAmbitiousChange(o.l)} style={{flex:1,padding:'7px 3px',borderRadius:8,cursor:'pointer',fontSize:10,fontWeight:600,border:ambitiousLevel===o.l?'2px solid #00A896':'1px solid #E2E8F0',background:ambitiousLevel===o.l?'#E6F7F5':'#fff',color:ambitiousLevel===o.l?'#00A896':'#64748B',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}><span style={{fontSize:14}}>{o.i}</span><span>{o.t}</span></button>))}</div><p style={{margin:'6px 0 0',fontSize:9,color:'#94A3B8',textAlign:'center'}}>Escala proporcional sem chamar a IA</p></div>
        </div>

        {/* Ajuste manual */}
        {showManual&&(
          <div style={{background:'#F0FDF4',borderRadius:12,padding:16,border:'1px solid #BBF7D0'}}>
            <p style={{margin:'0 0 12px',fontSize:12,fontWeight:700,color:'#065F46'}}>Definir totais — redistribuído automaticamente pelos meses</p>
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              {basePlan&&[
                {label:'🛡️ Conservador',n:Math.round(basePlan.summary.total_new_students_target*0.75),r:Math.round(basePlan.summary.reenrollment_target*0.75)},
                {label:'🎯 Realista',n:basePlan.summary.total_new_students_target,r:basePlan.summary.reenrollment_target},
                {label:'🚀 Agressivo',n:Math.round(basePlan.summary.total_new_students_target*1.3),r:Math.round(basePlan.summary.reenrollment_target*1.3)},
              ].map(s=>(<button key={s.label} onClick={()=>{setManualNew(s.n);setManualReen(s.r);onManualTargets(s.n,s.r)}} style={{flex:1,padding:'8px 6px',borderRadius:8,border:'1px solid #BBF7D0',background:'#fff',cursor:'pointer',fontSize:11,fontWeight:600,color:'#065F46',textAlign:'center'}}>{s.label}<br/><span style={{fontSize:10,color:'#94A3B8',fontWeight:400}}>{s.n} novos · {s.r} remat.</span></button>))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,alignItems:'end'}}>
              <div><label style={{...S.label,color:'#065F46'}}>Novatos (total)</label><input type="number" min={0} value={manualNew} onChange={e=>setManualNew(parseInt(e.target.value)||0)} style={{...S.input,border:'1.5px solid #00A896',fontWeight:700,color:'#00A896'}}/></div>
              <div><label style={{...S.label,color:'#065F46'}}>Rematrículas (total)</label><input type="number" min={0} value={manualReen} onChange={e=>setManualReen(parseInt(e.target.value)||0)} style={{...S.input,border:'1.5px solid #3B82F6',fontWeight:700,color:'#3B82F6'}}/></div>
              <button onClick={()=>onManualTargets(manualNew,manualReen)} style={{height:40,padding:'0 18px',borderRadius:9,background:'#00A896',color:'#fff',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}><RefreshCw size={12}/> Redistribuir</button>
            </div>
          </div>
        )}
      </div>

      {/* ZONA 2 — Tabela unificada */}
      <div style={{marginBottom:20}}>
        <div style={{overflowX:'auto',borderRadius:14,border:'1px solid #E2E8F0'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'#F8FAFC'}}>
                <th style={{padding:'10px 12px',textAlign:'left',fontSize:10,fontWeight:700,color:'#64748B',borderBottom:'1px solid #E2E8F0',whiteSpace:'nowrap'}}>Mês</th>
                {['Cadastros','Agendas','Visitas'].map(h=><th key={h} style={{padding:'10px 8px',textAlign:'center',fontSize:10,fontWeight:700,color:'#1D4ED8',borderBottom:'1px solid #E2E8F0',background:'#F0F7FF',whiteSpace:'nowrap'}}>{h}</th>)}
                <th style={{padding:'10px 8px',textAlign:'center',fontSize:10,fontWeight:700,color:'#0d9488',borderBottom:'1px solid #E2E8F0',background:'#F0FDFB',whiteSpace:'nowrap'}}>Novatos</th>
                <th style={{padding:'10px 8px',textAlign:'center',fontSize:10,fontWeight:700,color:'#16a34a',borderBottom:'1px solid #E2E8F0',background:'#F0FDFB',whiteSpace:'nowrap'}}>Remat.</th>
                <th style={{padding:'10px 8px',textAlign:'center',fontSize:10,fontWeight:700,color:'#065F46',borderBottom:'1px solid #E2E8F0',background:'#F0FDFB',whiteSpace:'nowrap'}}>Total</th>
                {['Invest. R$','CPA R$'].map(h=><th key={h} style={{padding:'10px 8px',textAlign:'center',fontSize:10,fontWeight:700,color:'#7C3AED',borderBottom:'1px solid #E2E8F0',background:'#F9F5FF',whiteSpace:'nowrap'}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {plan.monthly_targets.map((m,i)=>{
                const label=campaignMonths[i]?.label??`${m.month}/${m.year}`
                const ne=m.enrollments_new??0; const re=m.enrollments_returning??0
                const te=ne+re||m.enrollments||0
                const cpa=te>0?Math.round((m.investment_suggested||0)/te):0
                const isKey=[10,11].includes(campaignMonths[i]?.month??0)
                return (
                  <tr key={i} style={{borderBottom:'1px solid #F8FAFC',background:isKey?'#FFFBEB':i%2===0?'#fff':'#FAFAFA'}}>
                    <td style={{padding:'6px 12px',fontWeight:600,color:'#1A2B4A',whiteSpace:'nowrap',fontSize:11}}>{label}{isKey&&<span style={{marginLeft:4,fontSize:9,color:'#f59e0b',fontWeight:700}}>★</span>}</td>
                    {(['registrations','schedules','visits'] as const).map(field=>(<td key={field} style={{padding:'3px 4px',textAlign:'center',background:'#F8FAFF'}}><input type="number" style={{width:54,padding:'3px 4px',borderRadius:5,border:'1px solid #BFDBFE',textAlign:'center',fontSize:11,outline:'none',background:'#fff'}} value={m[field]||0} onChange={e=>onUpdateCell(i,field,parseFloat(e.target.value)||0)}/></td>))}
                    <td style={{padding:'3px 4px',textAlign:'center',background:'#F0FDFB'}}><input type="number" style={{width:54,padding:'3px 4px',borderRadius:5,border:'1px solid #99F6E4',textAlign:'center',fontSize:11,outline:'none',background:'#fff',fontWeight:600,color:'#0d9488'}} value={ne} onChange={e=>onUpdateCell(i,'enrollments_new',parseFloat(e.target.value)||0)}/></td>
                    <td style={{padding:'3px 4px',textAlign:'center',background:'#F0FDFB'}}><input type="number" style={{width:54,padding:'3px 4px',borderRadius:5,border:'1px solid #BBF7D0',textAlign:'center',fontSize:11,outline:'none',background:'#fff',fontWeight:600,color:'#16a34a'}} value={re} onChange={e=>onUpdateCell(i,'enrollments_returning',parseFloat(e.target.value)||0)}/></td>
                    <td style={{padding:'6px 8px',textAlign:'center',fontWeight:800,color:'#065F46',fontSize:12,background:'#F0FDFB'}}>{te}</td>
                    <td style={{padding:'3px 4px',textAlign:'center',background:'#FAF5FF'}}><input type="number" style={{width:64,padding:'3px 4px',borderRadius:5,border:'1px solid #DDD6FE',textAlign:'center',fontSize:11,outline:'none',background:'#fff'}} value={m.investment_suggested||0} onChange={e=>onUpdateCell(i,'investment_suggested',parseFloat(e.target.value)||0)}/></td>
                    <td style={{padding:'6px 8px',textAlign:'center',color:'#7C3AED',fontSize:11,background:'#FAF5FF'}}>{cpa>0?cpa.toLocaleString('pt-BR'):'—'}</td>
                  </tr>
                )
              })}
              <tr style={{background:'#F0FDFB',borderTop:'2px solid #00A896'}}>
                <td style={{padding:'9px 12px',fontWeight:800,color:'#1A2B4A',fontSize:12}}>TOTAL</td>
                <td style={{padding:'9px 8px',textAlign:'center',fontWeight:700,fontSize:11,color:'#1D4ED8'}}>{totals.reg}</td>
                <td style={{padding:'9px 8px',textAlign:'center',fontWeight:700,fontSize:11,color:'#1D4ED8'}}>{totals.sch}</td>
                <td style={{padding:'9px 8px',textAlign:'center',fontWeight:700,fontSize:11,color:'#1D4ED8'}}>{totals.vis}</td>
                <td style={{padding:'9px 8px',textAlign:'center',fontWeight:800,fontSize:12,color:'#0d9488'}}>{totals.ne}</td>
                <td style={{padding:'9px 8px',textAlign:'center',fontWeight:800,fontSize:12,color:'#16a34a'}}>{totals.re}</td>
                <td style={{padding:'9px 8px',textAlign:'center',fontWeight:800,fontSize:13,color:'#065F46'}}>{totals.enr}</td>
                <td style={{padding:'9px 8px',textAlign:'center',fontWeight:700,fontSize:11,color:'#7C3AED'}}>R$ {totals.inv.toLocaleString('pt-BR')}</td>
                <td style={{padding:'9px 8px',textAlign:'center',fontWeight:700,fontSize:11,color:'#7C3AED'}}>{totals.enr>0?`R$ ${Math.round(totals.inv/totals.enr).toLocaleString('pt-BR')}`:'—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{margin:'8px 0 0',fontSize:11,color:'#94A3B8'}}>★ Meses críticos · Azul = captação · Verde = matrículas · Roxo = financeiro · Células editáveis</p>
      </div>

      {/* ZONA 3 — Insights */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        {/* Rematrícula acumulada */}
        <div style={{background:'#fff',borderRadius:14,border:'1px solid #E2E8F0',padding:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><RefreshCw size={14} color="#3B82F6"/><span style={{fontSize:12,fontWeight:700,color:'#1A2B4A'}}>Rematrícula acumulada</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {reenRows.filter(r=>r.mr>0).map((r,i)=>{
              const pc=r.pct>=80?'#16a34a':r.pct>=40?'#f59e0b':'#3b82f6'
              return (<div key={i}><div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:11,color:'#475569',fontWeight:600}}>{r.label}</span><span style={{fontSize:11,fontWeight:700,color:pc}}>{r.pct.toFixed(0)}% · {r.accReen}</span></div><div style={{height:5,background:'#E2E8F0',borderRadius:999,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,r.pct)}%`,background:pc,borderRadius:999,transition:'width 0.4s'}}/></div></div>)
            })}
            {reenRows.every(r=>r.mr===0)&&<p style={{fontSize:12,color:'#94A3B8',textAlign:'center',margin:'8px 0'}}>Sem metas de rematrícula</p>}
          </div>
          <div style={{marginTop:12,paddingTop:10,borderTop:'1px solid #E2E8F0',display:'flex',justifyContent:'space-between',fontSize:11}}><span style={{color:'#64748B'}}>Meta total:</span><span style={{fontWeight:700,color:'#3B82F6'}}>{reenrollTarget} alunos</span></div>
        </div>

        {/* Riscos */}
        <div style={{background:'#fff',borderRadius:14,border:'1px solid #E2E8F0',padding:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><AlertTriangle size={14} color="#F59E0B"/><span style={{fontSize:12,fontWeight:700,color:'#1A2B4A'}}>Riscos</span></div>
          {plan.key_risks?.length>0?plan.key_risks.map((r,i)=>(<div key={i} style={{display:'flex',gap:8,marginBottom:10,alignItems:'flex-start'}}><div style={{width:18,height:18,borderRadius:'50%',background:'#FEF3C7',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}><span style={{fontSize:9,fontWeight:800,color:'#D97706'}}>{i+1}</span></div><span style={{fontSize:11,color:'#78350F',lineHeight:1.55}}>{r}</span></div>)):<p style={{fontSize:12,color:'#94A3B8',textAlign:'center',margin:'16px 0'}}>Nenhum risco crítico</p>}
          {criticalTotal>0&&<div style={{marginTop:8,paddingTop:10,borderTop:'1px solid #E2E8F0',background:'#FFFBEB',borderRadius:8,padding:10}}><p style={{margin:0,fontSize:11,color:'#92400E',fontWeight:600}}>★ Out/Nov são críticos</p><p style={{margin:'2px 0 0',fontSize:11,color:'#78350F'}}>{criticalTotal} rematrículas ({criticalPct}% do total)</p></div>}
        </div>

        {/* Ações */}
        <div style={{background:'#fff',borderRadius:14,border:'1px solid #E2E8F0',padding:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><Check size={14} color="#00A896"/><span style={{fontSize:12,fontWeight:700,color:'#1A2B4A'}}>Ações prioritárias</span></div>
          {plan.key_actions?.length>0?plan.key_actions.map((a,i)=>(<div key={i} style={{display:'flex',gap:8,marginBottom:10,alignItems:'flex-start'}}><div style={{width:18,height:18,borderRadius:'50%',background:'#D1FAE5',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}><Check size={10} color="#16a34a"/></div><span style={{fontSize:11,color:'#047857',lineHeight:1.55}}>{a}</span></div>)):<p style={{fontSize:12,color:'#94A3B8',textAlign:'center',margin:'16px 0'}}>Nenhuma ação registrada</p>}
          {plan.pre_campaign&&monthsUntilCampaign>0&&<div style={{marginTop:8,paddingTop:10,borderTop:'1px solid #E2E8F0',background:'#FFFBEB',borderRadius:8,padding:10}}><p style={{margin:0,fontSize:11,color:'#92400E',fontWeight:600}}>Antes de {campaignStartMonth}</p>{plan.pre_campaign.key_actions.slice(0,2).map((a,i)=><p key={i} style={{margin:'4px 0 0',fontSize:10,color:'#78350F'}}>• {a}</p>)}</div>}
          {plan.recalibration_note&&<p style={{margin:'10px 0 0',fontSize:10,color:'#94A3B8',lineHeight:1.5}}>📅 {plan.recalibration_note}</p>}
        </div>
      </div>
    </div>
  )
}