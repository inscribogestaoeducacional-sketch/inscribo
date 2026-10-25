import HeaderAction from '../../components/mobile/HeaderAction'
import StatStrip, { cardBtn } from '../../components/mobile/StatStrip'
import { PillTabs } from '../../components/mobile/PillTabs'
import PageHeader from '../../components/ui/PageHeader'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'
import {
  ClipboardList, Plus, Copy, Eye, Brain, Check, AlertTriangle, MoreVertical, Star, Users, TrendingUp, BarChart3,
  StopCircle, ExternalLink, Pencil, Trash2, Sparkles, Gauge, ArrowLeft, ChevronRight, CalendarDays, MessageCircle, Link2, HelpCircle,
} from 'lucide-react'
import { DragEndEvent, } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { aiFetch } from '../../lib/authHeaders'
import { Sheet, ConfirmDialog, ConfirmState, Toggle, StatusBadge, EmptyState } from '../../components/survey/ui'
import { EditorSheet, QuestionSheet } from '../../components/survey/SurveyEditor'
import {
  CustomSurveyReport, FiltersBar, FiltersSummary, FiltersSheet, FilterState, ReenrollmentPills, ResponsesList, AiReportTab,
  CategoryBars, SortColumn,
} from '../../components/survey/SurveyResponses'
import {
  Survey, QuestionRow, SurveyResponse, AiReport, ReenrollBucket,
  fmt, avg, scaleToTen, npsFromScores, respondentOverallScore10, reenrollBucket, reenrollmentBreakdown, defaultDateRange,
  REENROLL_OPTIONS, PIE_COLORS, Segment, inferSegment, effectiveGradeFilter, emptyQuestionForm,
  card, cardCompact, labelStyle, inputStyle, sectionTitle,
} from '../../components/survey/surveyShared'

type ListFilter = 'all' | 'active' | 'draft' | 'closed'

// ─── componente ──────────────────────────────────────────────
export default function GestorSurveys() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!
  const navigate = useNavigate()
  const mountedRef = useRef(true)

  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [listFilter, setListFilter] = useState<ListFilter>('all')

  const [showNewModal, setShowNewModal] = useState(false)
  const [newModalStep, setNewModalStep] = useState<'mode' | 'form'>('mode')
  const [pendingMode, setPendingMode] = useState<'default' | 'custom'>('default')
  const [showLinkModal, setShowLinkModal] = useState<{ survey: Survey; audience: 'families' | 'staff' } | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const [form, setForm] = useState({ title: '', description: '', askId: false, requireId: false })
  const [saving, setSaving] = useState(false)

  // editor de perguntas customizadas
  const [editorSurvey, setEditorSurvey] = useState<Survey | null>(null)
  const [editorQuestions, setEditorQuestions] = useState<QuestionRow[]>([])
  const [loadingEditor, setLoadingEditor] = useState(false)
  const [showQuestionModal, setShowQuestionModal] = useState<QuestionRow | 'new' | null>(null)
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm())
  const [redirectDraft, setRedirectDraft] = useState('')

  const [viewingSurvey, setViewingSurvey] = useState<Survey | null>(null)
  // responses = conjunto agregado (respeita filtro de data/série, até 500
  // linhas) usado pela aba "Visão Geral" e por CustomSurveyReport — não é
  // paginado, é só pra cálculo de médias/gráficos.
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [reportQuestions, setReportQuestions] = useState<QuestionRow[]>([])
  const [loadingResponses, setLoadingResponses] = useState(false)

  const [aiReport, setAiReport] = useState<AiReport | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  // ── painel de respostas: abas, filtros, tabela paginada, ordenação ──
  const [activeTab, setActiveTab] = useState<'overview' | 'responses' | 'ai'>('overview')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterSegment, setFilterSegment] = useState<Segment | ''>('')
  const [filterGrades, setFilterGrades] = useState<string[]>([])
  const [filterName, setFilterName] = useState('')
  const [filterReenrollment, setFilterReenrollment] = useState('')
  const [gradeOptions, setGradeOptions] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const TABLE_PAGE_SIZE = 20
  const [tableResponses, setTableResponses] = useState<SurveyResponse[]>([])
  const [tableTotalCount, setTableTotalCount] = useState(0)
  const [tablePage, setTablePage] = useState(1)
  const [loadingTable, setLoadingTable] = useState(false)

  const [sortColumn, setSortColumn] = useState<SortColumn>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function ask(state: Omit<ConfirmState, 'onConfirm'> & { onConfirm: () => void | Promise<void> }) {
    setConfirmState({ ...state, onConfirm: () => { setConfirmState(null); void state.onConfirm() } })
  }

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('satisfaction_surveys')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
    if (mountedRef.current) {
      setSurveys(data ?? [])
      setLoading(false)
    }
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
        status: pendingMode === 'custom' ? 'draft' : 'active',
        survey_mode: pendingMode,
        created_by: user?.full_name ?? null,
      })
      .select()
      .single()

    setSaving(false)
    if (error || !data) { showToast('Erro ao criar pesquisa.'); return }

    setShowNewModal(false)
    setForm({ title: '', description: '', askId: false, requireId: false })
    await load()

    if (pendingMode === 'custom') openEditor(data)
    else setShowLinkModal({ survey: data, audience: 'families' })
  }

  // Modelo pronto: pesquisa de satisfação dos colaboradores (anônima, perguntas padrão), já ativa e com link para enviar.
  function askCreateStaffSurvey() {
    setShowNewModal(false)
    ask({
      title: 'Criar pesquisa dos colaboradores?',
      message: 'Ela vem pronta, é anônima e já fica ativa para você enviar o link.',
      confirmLabel: 'Criar pesquisa',
      onConfirm: createStaffSurvey,
    })
  }

  async function createStaffSurvey() {
    setSaving(true)
    const { data, error } = await supabase.from('satisfaction_surveys').insert({
      institution_id: institutionId, title: `Satisfação dos colaboradores ${new Date().getFullYear()}`,
      description: 'Queremos ouvir você. Suas respostas são anônimas e vão ajudar a melhorar o dia a dia da escola.',
      require_identification: false, status: 'active', survey_mode: 'custom', created_by: user?.full_name ?? null,
    }).select().single()
    if (error || !data) { setSaving(false); showToast('Erro ao criar a pesquisa.'); return }
    const sc = (title: string, min_label?: string, max_label?: string) => ({ question_type: 'scale', title, required: true, options: { min: 1, max: 5, min_label: min_label ?? 'Nada satisfeito', max_label: max_label ?? 'Muito satisfeito' } })
    const qs = [
      { question_type: 'nps', title: 'De 0 a 10, o quanto você recomendaria a nossa escola como um bom lugar para trabalhar?', required: true, options: { min_label: 'Nada provável', max_label: 'Muito provável' } },
      sc('Como você avalia o ambiente de trabalho (relacionamento com colegas e clima)?'),
      sc('Como você avalia a liderança e o apoio da direção/coordenação?'),
      sc('Como você avalia a comunicação interna (você recebe as informações de que precisa)?'),
      sc('Como você avalia os recursos e a estrutura para fazer o seu trabalho?'),
      sc('Você sente que o seu trabalho é reconhecido e valorizado?'),
      sc('Como você avalia as oportunidades de crescimento e capacitação?'),
      { question_type: 'multiple_choice', title: 'O que mais pesa positivamente no seu dia a dia aqui?', required: false, options: { options: ['Colegas', 'Direção/coordenação', 'Estrutura', 'Alunos e famílias', 'Horários', 'Remuneração e benefícios', 'Outro'] } },
      { question_type: 'multiple_choice', title: 'O que mais precisa melhorar?', required: false, options: { options: ['Comunicação', 'Organização dos processos', 'Estrutura e materiais', 'Carga de trabalho', 'Reconhecimento', 'Remuneração e benefícios', 'Outro'] } },
      { question_type: 'text', title: 'Se pudesse mudar uma coisa na escola amanhã, o que seria?', required: false, options: null },
    ].map((q, i) => ({ ...q, survey_id: data.id, institution_id: institutionId, order_index: i, description: null }))
    const { error: qe } = await supabase.from('satisfaction_questions').insert(qs)
    setSaving(false)
    if (qe) { showToast('A pesquisa foi criada, mas houve erro nas perguntas. Abra "Editar perguntas".'); load(); return }
    await load()
    setShowLinkModal({ survey: data, audience: 'staff' })
  }

  function askCloseSurvey(id: string) {
    ask({
      title: 'Encerrar esta pesquisa?', message: 'Ela não aceitará mais respostas.', confirmLabel: 'Encerrar pesquisa', danger: true,
      onConfirm: async () => {
        await supabase.from('satisfaction_surveys')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', id)
        showToast('Pesquisa encerrada.')
        setViewingSurvey(prev => prev && prev.id === id ? { ...prev, status: 'closed' } : prev)
        load()
      },
    })
  }

  function askDeleteSurvey(id: string, responseCount: number) {
    ask({
      title: 'Excluir esta pesquisa?',
      message: responseCount > 0 ? `${responseCount} resposta(s) será(ão) perdida(s). Esta ação não pode ser desfeita.` : 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir', danger: true,
      onConfirm: async () => {
        const { error } = await supabase.rpc('delete_survey_cascade', { survey_uuid: id })
        if (error) { showToast('Erro ao excluir pesquisa.'); return }
        showToast('Pesquisa excluída.')
        load()
      },
    })
  }

  function openNewModal() {
    setNewModalStep('mode')
    setPendingMode('default')
    setShowNewModal(true)
  }

  function surveyLink(token: string) {
    return `${window.location.origin}/satisfaction/${token}`
  }

  async function copyText(text: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(okMsg)
    } catch {
      showToast('Não foi possível copiar. Selecione o link e copie manualmente.')
    }
  }

  function copyLink(token: string) {
    copyText(surveyLink(token), 'Link copiado para a área de transferência.')
    setOpenMenu(null)
  }

  function openPreview(token: string) {
    window.open(surveyLink(token), '_blank')
  }

  // Datas do filtro vêm de <input type="date"> (yyyy-mm-dd) — "De" cobre o
  // dia inteiro a partir de 00:00, "Até" cobre até 23:59:59 do dia informado.
  function applyDateFilter(q: any, dateFrom: string, dateTo: string) {
    if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999`)
    return q
  }

  function applyGradeFilter(q: any, grades: string[]) {
    if (grades.length > 0) q = q.in('respondent_grade', grades)
    return q
  }

  async function fetchGradeOptions(surveyId: string) {
    const { data } = await supabase
      .from('satisfaction_responses')
      .select('respondent_grade')
      .eq('survey_id', surveyId)
      .not('respondent_grade', 'is', null)
    if (!mountedRef.current) return
    const uniq = Array.from(new Set((data ?? []).map(r => r.respondent_grade).filter((g): g is string => !!g)))
    setGradeOptions(uniq.sort((a, b) => a.localeCompare(b, 'pt-BR')))
  }

  // Conjunto agregado pra Visão Geral — respeita data/série, capado em 500
  // pra não puxar uma pesquisa inteira de uma escola grande de uma vez só;
  // a contagem exata (pro card "Respostas" e pro NPS/% de rematrícula) usa
  // tableTotalCount, que vem de uma query separada com count exato.
  async function fetchOverview(surveyId: string, dateFrom: string, dateTo: string, grades: string[]) {
    setLoadingResponses(true)
    let q = supabase.from('satisfaction_responses').select('*').eq('survey_id', surveyId).order('created_at', { ascending: false }).limit(500)
    q = applyDateFilter(q, dateFrom, dateTo)
    q = applyGradeFilter(q, grades)
    const { data } = await q
    if (mountedRef.current) {
      setResponses(data ?? [])
      setLoadingResponses(false)
    }
  }

  async function fetchTablePage(surveyId: string, dateFrom: string, dateTo: string, grades: string[], page: number) {
    setLoadingTable(true)
    const from = (page - 1) * TABLE_PAGE_SIZE
    const to = from + TABLE_PAGE_SIZE - 1
    let q = supabase.from('satisfaction_responses').select('*', { count: 'exact' }).eq('survey_id', surveyId).order('created_at', { ascending: false }).range(from, to)
    q = applyDateFilter(q, dateFrom, dateTo)
    q = applyGradeFilter(q, grades)
    const { data, count } = await q
    if (mountedRef.current) {
      setTableResponses(data ?? [])
      setTableTotalCount(count ?? 0)
      setLoadingTable(false)
    }
  }

  async function openResponses(survey: Survey, tab: 'overview' | 'responses' | 'ai' = 'overview') {
    setViewingSurvey(survey)
    setActiveTab(tab)
    setSortColumn('date')
    setSortDir('desc')
    setExpandedRowId(null)
    setAiReport(survey.ai_analysis ?? null)
    window.scrollTo?.({ top: 0 })
    document.querySelector('main')?.scrollTo?.({ top: 0 })

    const range = defaultDateRange(survey.created_at)
    setFilterDateFrom(range.from)
    setFilterDateTo(range.to)
    setFilterSegment('')
    setFilterGrades([])
    setFilterName('')
    setFilterReenrollment('')
    setTablePage(1)
    // Os dados em si (overview + tabela) são carregados pelos useEffects
    // logo abaixo, que reagem tanto à troca de pesquisa (viewingSurvey.id)
    // quanto à troca de filtro — os setState acima já disparam isso.

    fetchGradeOptions(survey.id)

    if (survey.survey_mode === 'custom') {
      setLoadingResponses(true)
      const { data } = await supabase.from('satisfaction_questions').select('*').eq('survey_id', survey.id).order('order_index', { ascending: true })
      if (mountedRef.current) setReportQuestions(data ?? [])
    } else {
      setReportQuestions([])
    }
  }

  // Séries visíveis no multi-select — restritas ao segmento escolhido (se houver).
  const segmentGradeOptions = useMemo(
    () => filterSegment ? gradeOptions.filter(g => inferSegment(g) === filterSegment) : gradeOptions,
    [gradeOptions, filterSegment]
  )

  // Séries efetivamente aplicadas na query server-side (ver effectiveGradeFilter).
  const effectiveGrades = useMemo(
    () => effectiveGradeFilter(filterGrades, filterSegment, gradeOptions),
    [filterGrades, filterSegment, gradeOptions]
  )

  // Refetch da Visão Geral quando a pesquisa aberta ou os filtros server-side mudam.
  useEffect(() => {
    if (!viewingSurvey) return
    fetchOverview(viewingSurvey.id, filterDateFrom, filterDateTo, effectiveGrades)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingSurvey?.id, filterDateFrom, filterDateTo, effectiveGrades])

  // Volta pra página 1 sempre que pesquisa/filtro server-side mudam.
  useEffect(() => {
    setTablePage(1)
  }, [viewingSurvey?.id, filterDateFrom, filterDateTo, effectiveGrades])

  // Refetch da tabela paginada quando pesquisa, filtros server-side, ou a página mudam.
  useEffect(() => {
    if (!viewingSurvey) return
    fetchTablePage(viewingSurvey.id, filterDateFrom, filterDateTo, effectiveGrades, tablePage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingSurvey?.id, filterDateFrom, filterDateTo, effectiveGrades, tablePage])

  // Busca por nome e filtro de rematrícula são client-side, aplicados só
  // dentro da página de 20 já carregada.
  const visibleTableResponses = useMemo(() => {
    let list = tableResponses
    if (filterName.trim()) {
      const q = filterName.trim().toLowerCase()
      list = list.filter(r => (r.respondent_name || '').toLowerCase().includes(q))
    }
    if (filterReenrollment) {
      list = list.filter(r => reenrollBucket(r.answers?.reenrollment as string | undefined) === filterReenrollment)
    }
    return list
  }, [tableResponses, filterName, filterReenrollment])

  const sortedTableResponses = useMemo(() => {
    const list = [...visibleTableResponses]
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      switch (sortColumn) {
        case 'name':  return (a.respondent_name || '').localeCompare(b.respondent_name || '') * dir
        case 'grade': return (a.respondent_grade || '').localeCompare(b.respondent_grade || '') * dir
        case 'date':  return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
        case 'score': return (respondentOverallScore10(a) - respondentOverallScore10(b)) * dir
        case 'reenrollment': return String(a.answers?.reenrollment || '').localeCompare(String(b.answers?.reenrollment || '')) * dir
        default: return 0
      }
    })
    return list
  }, [visibleTableResponses, sortColumn, sortDir])

  // Contagem pros pills de rematrícula (aba Respostas).
  const reenrollmentPillCounts = useMemo(() => {
    const base = filterName.trim()
      ? responses.filter(r => (r.respondent_name || '').toLowerCase().includes(filterName.trim().toLowerCase()))
      : responses
    const buckets = { sim: 0, nao: 0, talvez: 0 }
    for (const r of base) {
      const b = reenrollBucket(r.answers?.reenrollment as string | undefined)
      if (b) buckets[b]++
    }
    return { total: base.length, ...buckets }
  }, [responses, filterName])

  const hasReenrollmentField = useMemo(
    () => responses.some(r => r.answers && Object.prototype.hasOwnProperty.call(r.answers, 'reenrollment')),
    [responses]
  )

  async function generateReport(survey: Survey) {
    if (responses.length === 0) { showToast('Sem respostas para gerar relatório.'); return }
    setGeneratingReport(true)
    const { data: inst } = await supabase.from('institutions').select('name').eq('id', institutionId).maybeSingle()
    try {
      const res = await aiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'survey_report',
          payload: {
            responses, surveyTitle: survey.title, institutionName: inst?.name ?? 'Escola',
            surveyMode: survey.survey_mode, questions: survey.survey_mode === 'custom' ? reportQuestions : [],
          },
        }),
      })
      const json = await res.json()
      if (json.result) {
        setAiReport(json.result)
        const generatedAt = new Date().toISOString()
        // Análise agregada da pesquisa inteira, salva em satisfaction_surveys —
        // assim a aba não precisa gerar de novo toda vez que o gestor reabrir a pesquisa.
        await supabase.from('satisfaction_surveys')
          .update({ ai_analysis: json.result, ai_analysis_generated_at: generatedAt })
          .eq('id', survey.id)
        setViewingSurvey(prev => prev && prev.id === survey.id ? { ...prev, ai_analysis: json.result, ai_analysis_generated_at: generatedAt } : prev)
        setSurveys(prev => prev.map(s => s.id === survey.id ? { ...s, ai_analysis: json.result, ai_analysis_generated_at: generatedAt } : s))
      } else {
        showToast('Erro ao gerar relatório.')
      }
    } catch { showToast('Erro ao gerar relatório.') }
    setGeneratingReport(false)
  }

  // ─── editor de perguntas customizadas ──────────────────────
  async function openEditor(survey: Survey) {
    setEditorSurvey(survey)
    setRedirectDraft(survey.redirect_url ?? '')
    setLoadingEditor(true)
    const { data } = await supabase
      .from('satisfaction_questions')
      .select('*')
      .eq('survey_id', survey.id)
      .order('order_index', { ascending: true })
    setEditorQuestions(data ?? [])
    setLoadingEditor(false)
  }

  function closeEditor() {
    setEditorSurvey(null)
    setEditorQuestions([])
    // se o painel de respostas está aberto, atualiza as perguntas do relatório
    if (viewingSurvey && viewingSurvey.survey_mode === 'custom') {
      supabase.from('satisfaction_questions').select('*').eq('survey_id', viewingSurvey.id).order('order_index', { ascending: true })
        .then(({ data }) => { if (mountedRef.current && data) setReportQuestions(data) })
    }
  }

  function openQuestionForm(q: QuestionRow | 'new') {
    if (q === 'new') {
      setQuestionForm(emptyQuestionForm())
    } else {
      const opts = q.options || {}
      setQuestionForm({
        title: q.title, description: q.description || '', question_type: q.question_type,
        required: q.required, min_label: opts.min_label || '', max_label: opts.max_label || '',
        options: opts.options && opts.options.length > 0 ? opts.options : ['', ''],
      })
    }
    setShowQuestionModal(q)
  }

  async function saveQuestion() {
    if (!editorSurvey || !questionForm.title.trim()) return
    const options =
      questionForm.question_type === 'multiple_choice' ? { options: questionForm.options.filter(o => o.trim()) } :
      questionForm.question_type === 'scale' ? { min: 1, max: 5, min_label: questionForm.min_label || undefined, max_label: questionForm.max_label || undefined } :
      questionForm.question_type === 'nps' ? { min_label: questionForm.min_label || undefined, max_label: questionForm.max_label || undefined } :
      null

    if (showQuestionModal === 'new') {
      const { data, error } = await supabase.from('satisfaction_questions').insert({
        survey_id: editorSurvey.id,
        institution_id: institutionId,
        order_index: editorQuestions.length,
        question_type: questionForm.question_type,
        title: questionForm.title.trim(),
        description: questionForm.description.trim() || null,
        required: questionForm.required,
        options,
      }).select().single()
      if (error || !data) { showToast('Erro ao adicionar pergunta.'); return }
      setEditorQuestions(prev => [...prev, data])
    } else if (showQuestionModal) {
      const id = showQuestionModal.id
      const { error } = await supabase.from('satisfaction_questions').update({
        question_type: questionForm.question_type,
        title: questionForm.title.trim(),
        description: questionForm.description.trim() || null,
        required: questionForm.required,
        options,
      }).eq('id', id)
      if (error) { showToast('Erro ao salvar pergunta.'); return }
      setEditorQuestions(prev => prev.map(q => q.id === id
        ? { ...q, question_type: questionForm.question_type, title: questionForm.title.trim(), description: questionForm.description.trim() || null, required: questionForm.required, options }
        : q))
    }
    setShowQuestionModal(null)
  }

  function askDeleteQuestion(q: QuestionRow) {
    ask({
      title: 'Excluir esta pergunta?',
      message: 'As respostas já recebidas para ela serão mantidas, mas ela some do formulário.',
      confirmLabel: 'Excluir pergunta', danger: true,
      onConfirm: async () => {
        const { error } = await supabase.from('satisfaction_questions').delete().eq('id', q.id)
        if (error) { showToast('Erro ao excluir pergunta.'); return }
        setEditorQuestions(prev => prev.filter(x => x.id !== q.id))
      },
    })
  }

  async function persistOrder(reordered: QuestionRow[]) {
    setEditorQuestions(reordered)
    await Promise.all(reordered.map(q => supabase.from('satisfaction_questions').update({ order_index: q.order_index }).eq('id', q.id)))
  }

  async function handleQuestionDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = editorQuestions.findIndex(q => q.id === active.id)
    const newIndex = editorQuestions.findIndex(q => q.id === over.id)
    await persistOrder(arrayMove(editorQuestions, oldIndex, newIndex).map((q, i) => ({ ...q, order_index: i })))
  }

  async function moveQuestion(id: string, dir: -1 | 1) {
    const i = editorQuestions.findIndex(q => q.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= editorQuestions.length) return
    await persistOrder(arrayMove(editorQuestions, i, j).map((q, k) => ({ ...q, order_index: k })))
  }

  async function saveRedirectUrl() {
    if (!editorSurvey) return
    const url = redirectDraft.trim() || null
    await supabase.from('satisfaction_surveys').update({ redirect_url: url }).eq('id', editorSurvey.id)
    setEditorSurvey(prev => prev ? { ...prev, redirect_url: url } : prev)
    showToast('Redirecionamento salvo.')
  }

  async function publishEditorSurvey() {
    if (!editorSurvey) return
    if (editorQuestions.length === 0) { showToast('Adicione ao menos uma pergunta antes de publicar.'); return }
    await supabase.from('satisfaction_surveys').update({ status: 'active' }).eq('id', editorSurvey.id)
    const updated = { ...editorSurvey, status: 'active' as const }
    await load()
    showToast('Pesquisa publicada!')
    setEditorSurvey(null)
    setEditorQuestions([])
    setShowLinkModal({ survey: updated, audience: 'families' })
  }

  const total = surveys.length
  const active = surveys.filter(s => s.status === 'active').length
  const totalResponses = surveys.reduce((sum, s) => sum + (s.response_count ?? 0), 0)
  const avgResponses = total > 0 ? Math.round(totalResponses / total) : 0

  const listStats = [
    { label: 'Total de pesquisas', value: total, sub: 'criadas até hoje', color: '#05907B', icon: ClipboardList },
    { label: 'Pesquisas ativas', value: active, sub: 'recebendo respostas', color: '#10B981', icon: TrendingUp },
    { label: 'Total de respostas', value: totalResponses, sub: 'somando todas', color: '#3B82F6', icon: Users },
    { label: 'Média por pesquisa', value: avgResponses, sub: 'respostas em cada uma', color: '#8B5CF6', icon: BarChart3 },
  ]

  const counts = {
    all: total,
    active,
    draft: surveys.filter(s => s.status === 'draft').length,
    closed: surveys.filter(s => s.status === 'closed').length,
  }
  const filteredSurveys = listFilter === 'all' ? surveys : surveys.filter(s => s.status === listFilter)

  // estado dos filtros do painel de respostas
  const filterState: FilterState = {
    isDefault: viewingSurvey ? viewingSurvey.survey_mode !== 'custom' : true,
    dateFrom: filterDateFrom, setDateFrom: setFilterDateFrom,
    dateTo: filterDateTo, setDateTo: setFilterDateTo,
    segment: filterSegment, setSegment: setFilterSegment,
    grades: filterGrades, setGrades: setFilterGrades,
    gradeOptions: segmentGradeOptions,
    name: filterName, setName: setFilterName,
    reenrollment: filterReenrollment, setReenrollment: setFilterReenrollment,
    onClear: () => {
      if (!viewingSurvey) return
      const range = defaultDateRange(viewingSurvey.created_at)
      setFilterDateFrom(range.from); setFilterDateTo(range.to)
      setFilterSegment(''); setFilterGrades([]); setFilterName(''); setFilterReenrollment('')
    },
  }

  // ─── janelas e avisos (valem para qualquer tela) ───────────
  const overlays = (
    <>
      {toast && (
        <div style={{ position: 'fixed', bottom: isMobile ? 'calc(96px + env(safe-area-inset-bottom))' : 24, left: '50%', transform: 'translateX(-50%)', background: '#1A2B4A', color: 'white', padding: '11px 18px', borderRadius: 14, fontSize: 13.5, fontWeight: 700, zIndex: 10200, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 30px -8px rgba(26,43,74,.5)', maxWidth: 'calc(100vw - 32px)' }}>
          <Check size={15} /> {toast}
        </div>
      )}

      {/* Nova pesquisa */}
      {showNewModal && (
        <Sheet
          onClose={() => setShowNewModal(false)} icon={Plus} maxWidth={600}
          title="Nova pesquisa"
          subtitle={newModalStep === 'mode' ? 'Passo 1 de 2 · escolha o tipo' : 'Passo 2 de 2 · dados da pesquisa'}
          headerActions={newModalStep === 'form' ? <HeaderAction icon={ArrowLeft} label="Trocar tipo" onClick={() => setNewModalStep('mode')} /> : undefined}
          footer={newModalStep === 'form' ? <>
            <button type="button" onClick={() => setShowNewModal(false)} style={cardBtn('ghost')}>Cancelar</button>
            <button type="button" onClick={createSurvey} disabled={!form.title.trim() || saving}
              style={{ ...cardBtn('primary'), opacity: !form.title.trim() || saving ? 0.55 : 1, cursor: !form.title.trim() || saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Criando...' : pendingMode === 'custom' ? 'Criar e montar perguntas' : 'Criar pesquisa'}
            </button>
          </> : undefined}
        >
          {newModalStep === 'mode' ? (
            <>
              <p style={{ margin: 0, fontSize: 14, color: '#5B6B86' }}>Qual tipo de pesquisa você quer usar?</p>
              {([
                { mode: 'default' as const, icon: ClipboardList, color: '#05907B', title: 'Pesquisa padrão do sistema', text: '7 perguntas fixas, prontas para usar agora. A pesquisa já fica ativa.' },
                { mode: 'custom' as const, icon: Sparkles, color: '#8B5CF6', title: 'Criar minha própria pesquisa', text: 'Você escolhe as perguntas e o tipo de resposta de cada uma.' },
              ]).map(o => (
                <button key={o.mode} type="button" className="ld-card aion-tap" onClick={() => { setPendingMode(o.mode); setNewModalStep('form') }}
                  style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                  <span style={{ width: 48, height: 48, borderRadius: 16, background: `${o.color}14`, color: o.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><o.icon size={24} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#1A2B4A' }}>{o.title}</span>
                    <span style={{ display: 'block', fontSize: 13, color: '#5B6B86', marginTop: 3, lineHeight: 1.4 }}>{o.text}</span>
                  </span>
                  <ChevronRight size={18} color="#94A3B8" />
                </button>
              ))}
              <button type="button" className="ld-card aion-tap" onClick={askCreateStaffSurvey}
                style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%', background: '#F0FDFB', borderColor: '#BDEBE4' }}>
                <span style={{ width: 48, height: 48, borderRadius: 16, background: '#fff', color: '#05907B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={24} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#1A2B4A' }}>Pesquisa dos colaboradores</span>
                  <span style={{ display: 'block', fontSize: 13, color: '#5B6B86', marginTop: 3, lineHeight: 1.4 }}>Modelo pronto e anônimo para a equipe da escola. Já fica ativa, com link para enviar.</span>
                </span>
                <ChevronRight size={18} color="#94A3B8" />
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 800, padding: '5px 12px', borderRadius: 999, background: pendingMode === 'custom' ? '#F3E8FF' : '#E6F7F5', color: pendingMode === 'custom' ? '#6D28D9' : '#00695F' }}>
                {pendingMode === 'custom' ? <Sparkles size={14} /> : <ClipboardList size={14} />}
                {pendingMode === 'custom' ? 'Pesquisa personalizada' : 'Pesquisa padrão do sistema'}
              </div>
              <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Título da pesquisa *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Pesquisa de Satisfação 2026" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Descrição (opcional)</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Explique para as famílias o objetivo desta pesquisa..." rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 84, lineHeight: 1.45 }} />
                </div>
              </div>
              <div style={{ ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Pedir nome e série da família</p>
                  <p style={{ fontSize: 12.5, color: '#5B6B86', margin: '2px 0 0', lineHeight: 1.4 }}>O formulário pergunta isso antes das perguntas.</p>
                </div>
                <Toggle on={form.askId} label="Pedir nome e série da família" onChange={() => setForm(f => ({ ...f, askId: !f.askId }))} />
              </div>
              {pendingMode === 'custom' && (
                <p style={{ fontSize: 13, color: '#065F46', margin: 0, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: '10px 14px', lineHeight: 1.45 }}>
                  Depois de criar, você monta as perguntas no editor. A pesquisa fica como rascunho até você publicar.
                </p>
              )}
            </>
          )}
        </Sheet>
      )}

      {/* Editor de perguntas */}
      {editorSurvey && (
        <EditorSheet
          survey={editorSurvey} questions={editorQuestions} loading={loadingEditor}
          redirectDraft={redirectDraft} onRedirectChange={setRedirectDraft} onSaveRedirect={saveRedirectUrl}
          onClose={closeEditor} onPreview={() => openPreview(editorSurvey.survey_token)} onPublish={publishEditorSurvey}
          onAdd={() => openQuestionForm('new')} onEdit={openQuestionForm} onDelete={askDeleteQuestion}
          onMove={moveQuestion} onDragEnd={handleQuestionDragEnd}
        />
      )}

      {/* Adicionar / editar pergunta */}
      {showQuestionModal && (
        <QuestionSheet isNew={showQuestionModal === 'new'} form={questionForm} setForm={setQuestionForm} onClose={() => setShowQuestionModal(null)} onSave={saveQuestion} />
      )}

      {/* Link gerado */}
      {showLinkModal && (() => {
        const link = surveyLink(showLinkModal.survey.survey_token)
        const staff = showLinkModal.audience === 'staff'
        const wa = `https://wa.me/?text=${encodeURIComponent(`${showLinkModal.survey.title}\n${link}`)}`
        return (
          <Sheet onClose={() => setShowLinkModal(null)} icon={Link2} maxWidth={500} z={10050}
            title={staff ? 'Pesquisa dos colaboradores pronta!' : 'Pesquisa criada!'}
            subtitle={showLinkModal.survey.title}
            footer={<>
              <button type="button" onClick={() => setShowLinkModal(null)} style={cardBtn('ghost')}>Fechar</button>
              <button type="button" onClick={() => copyText(link, 'Link copiado!')} style={{ ...cardBtn('primary'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Copy size={15} /> Copiar link
              </button>
            </>}
          >
            <div style={{ textAlign: 'center', padding: '8px 0 0' }}>
              <div style={{ width: 64, height: 64, background: '#F0FDF4', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #BBF7D0' }}>
                <Check size={28} color="#16A34A" />
              </div>
              <p style={{ fontSize: 14.5, color: '#334155', margin: '12px 0 0', lineHeight: 1.5 }}>
                {staff
                  ? 'Envie o link abaixo para os colaboradores (WhatsApp, e-mail ou grupo). As respostas são anônimas.'
                  : 'Compartilhe o link abaixo com as famílias pelo WhatsApp, e-mail ou redes sociais.'}
              </p>
            </div>
            <div style={{ ...card, padding: 14 }}>
              <p style={{ ...labelStyle, margin: '0 0 6px' }}>Link da pesquisa</p>
              <p style={{ fontSize: 13.5, color: '#1A2B4A', wordBreak: 'break-all', lineHeight: 1.45, margin: 0, userSelect: 'all' }}>{link}</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href={wa} target="_blank" rel="noreferrer" style={{ ...cardBtn('ghost'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', boxSizing: 'border-box' }}>
                <MessageCircle size={15} /> Enviar pelo WhatsApp
              </a>
              <button type="button" onClick={() => openPreview(showLinkModal.survey.survey_token)} style={{ ...cardBtn('ghost'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <ExternalLink size={15} /> Abrir pesquisa
              </button>
            </div>
          </Sheet>
        )
      })()}

      {/* Filtros (celular) */}
      {showFilters && isMobile && viewingSurvey && (
        <FiltersSheet f={filterState} total={tableTotalCount} onClose={() => setShowFilters(false)} />
      )}

      {confirmState && <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />}
    </>
  )

  const pageWrap: React.CSSProperties = isMobile
    ? { padding: 12, display: 'flex', flexDirection: 'column', gap: 12, background: '#F5FAF9', minHeight: '100%', boxSizing: 'border-box' }
    : { padding: 24, display: 'flex', flexDirection: 'column', gap: 18, background: '#F5FAF9', minHeight: '100%', boxSizing: 'border-box' }

  // ─── PAINEL DE RESPOSTAS ───────────────────────────────────
  if (viewingSurvey) {
    const isDefault = viewingSurvey.survey_mode !== 'custom'

    const avgGeneral  = avg(responses.map(r => r.answers.general as number))
    const avgTeaching = avg(responses.map(r => r.answers.teaching as number))
    const avgComm     = avg(responses.map(r => r.answers.communication as number))
    const avgInfra    = avg(responses.map(r => r.answers.infrastructure as number))
    const avgCost     = avg(responses.map(r => r.answers.cost_benefit as number))
    const overallAvg  = avg([avgGeneral, avgTeaching, avgComm, avgInfra, avgCost])
    const overallScore10 = scaleToTen(overallAvg)
    const scoreColor = overallScore10 >= 8 ? '#10B981' : overallScore10 >= 6 ? '#F59E0B' : '#EF4444'

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
      r.answers.reenrollment === 'Provavelmente não' || r.answers.reenrollment === 'Não vou rematricular'
    ).length
    const undecided = responses.filter(r => r.answers.reenrollment === 'Ainda não decidi').length

    const reenroll = reenrollmentBreakdown(responses)
    const nps = isDefault ? npsFromScores(responses.map(respondentOverallScore10)) : 0

    const stats = isDefault ? [
      { label: 'Respostas', value: tableTotalCount, sub: 'no período filtrado', color: '#05907B', icon: Users },
      { label: 'Nota geral', value: `${overallScore10.toFixed(1)} / 10`, sub: 'média de todas as categorias', color: scoreColor, icon: Star },
      { label: 'Rematrícula', value: `${reenroll.yesPct}%`, sub: `${reenroll.noPct}% não · ${reenroll.maybePct}% talvez`, color: '#10B981', icon: TrendingUp },
      { label: 'NPS', value: `${nps >= 0 ? '+' : ''}${nps}`, sub: 'promotores menos detratores', color: nps >= 0 ? '#10B981' : '#EF4444', icon: Gauge },
    ] : [
      { label: 'Respostas', value: tableTotalCount, sub: 'no período filtrado', color: '#05907B', icon: Users },
      { label: 'Perguntas', value: reportQuestions.length, sub: 'no formulário', color: '#8B5CF6', icon: HelpCircle },
    ]

    const goBack = () => { setViewingSurvey(null); setShowFilters(false) }

    return (
      <div style={pageWrap}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

        <PageHeader compact={isMobile} icon={ClipboardList} title={viewingSurvey.title}
          subtitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {tableTotalCount} resposta{tableTotalCount !== 1 ? 's' : ''} no período selecionado · {viewingSurvey.status === 'active' ? 'Ativa' : viewingSurvey.status === 'draft' ? 'Rascunho' : 'Encerrada'}
          </span>}
          actions={<>
            <HeaderAction icon={ArrowLeft} label="Voltar" onClick={goBack} />
            {viewingSurvey.survey_mode === 'custom' && <HeaderAction icon={Pencil} label="Editar perguntas" onClick={() => openEditor(viewingSurvey)} />}
            {viewingSurvey.status === 'active' && <HeaderAction icon={StopCircle} label="Encerrar pesquisa" onClick={() => askCloseSurvey(viewingSurvey.id)} />}
          </>} />

        {/* Filtros — valem para as 3 abas */}
        {isMobile
          ? <FiltersSummary f={filterState} total={tableTotalCount} onOpen={() => setShowFilters(true)} />
          : <FiltersBar {...filterState} gradeOptions={segmentGradeOptions} />}

        <PillTabs value={activeTab} onChange={id => setActiveTab(id as 'overview' | 'responses' | 'ai')}
          tabs={[['overview', 'Visão geral', BarChart3 as any], ['responses', 'Respostas', Users as any], ['ai', 'Relatório IA', Brain as any]]} />

        {activeTab === 'overview' && (
          loadingResponses ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8', fontSize: 14 }}>Carregando...</div>
          ) : responses.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nenhuma resposta" hint="Não há respostas no período ou filtro selecionado." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <StatStrip items={stats} />

              {isDefault ? (
                <>
                  {isMobile ? (
                    <div style={cardCompact}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                        <p style={sectionTitle}>Média por categoria (1–5)</p>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1, 2, 3, 4, 5].map(s => <Star key={s} size={15} fill={s <= Math.round(overallAvg) ? scoreColor : 'none'} color={scoreColor} />)}
                        </div>
                      </div>
                      <CategoryBars data={barData} />
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
                      <div style={{ ...cardCompact, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <p style={{ ...sectionTitle, color: '#5B6B86' }}>Nota geral</p>
                        <div style={{ fontSize: 56, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{overallScore10.toFixed(1)}</div>
                        <p style={{ fontSize: 14, color: '#5B6B86', margin: 0 }}>de 10</p>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          {[1, 2, 3, 4, 5].map(s => <Star key={s} size={16} fill={s <= Math.round(overallAvg) ? scoreColor : 'none'} color={scoreColor} />)}
                        </div>
                      </div>
                      <div style={cardCompact}>
                        <p style={{ ...sectionTitle, marginBottom: 16 }}>Média por categoria (1–5)</p>
                        <CategoryBars data={barData} labelWidth={130} />
                      </div>
                    </div>
                  )}

                  {pieData.length > 0 && (
                    <div style={cardCompact}>
                      <p style={{ ...sectionTitle, marginBottom: 10 }}>Probabilidade de rematrícula</p>
                      <div style={{ display: 'flex', gap: isMobile ? 12 : 32, alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                        <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                              </Pie>
                              <RTooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', minWidth: 0 }}>
                          {pieData.map((entry, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                              <div style={{ width: 12, height: 12, borderRadius: 4, background: entry.color, flexShrink: 0 }} />
                              <span style={{ color: '#334155', flex: 1, minWidth: 0 }}>{entry.name}</span>
                              <span style={{ fontWeight: 800, color: '#1A2B4A' }}>{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {(evasionRisk > 0 || undecided > 0) && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {evasionRisk > 0 && (
                        <div style={{ ...card, padding: 14, flex: '1 1 260px', border: '1px solid #FECACA', background: '#FFF5F5', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <AlertTriangle size={24} color="#EF4444" style={{ flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 800, color: '#991B1B', margin: '0 0 2px' }}>
                              {evasionRisk} {evasionRisk === 1 ? 'família indicou' : 'famílias indicaram'} que não vai rematricular
                            </p>
                            <p style={{ fontSize: 12.5, color: '#DC2626', margin: 0 }}>Ação imediata recomendada</p>
                          </div>
                        </div>
                      )}
                      {undecided > 0 && (
                        <div style={{ ...card, padding: 14, flex: '1 1 260px', border: '1px solid #FDE68A', background: '#FFFBEB', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <AlertTriangle size={24} color="#F59E0B" style={{ flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 800, color: '#92400E', margin: '0 0 2px' }}>
                              {undecided} {undecided === 1 ? 'família ainda indecisa' : 'famílias ainda indecisas'}
                            </p>
                            <p style={{ fontSize: 12.5, color: '#B45309', margin: 0 }}>Entre em contato proativamente</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <CustomSurveyReport questions={reportQuestions} responses={responses} isMobile={isMobile} />
              )}
            </div>
          )
        )}

        {activeTab === 'responses' && (
          <>
            {isMobile && (
              <div style={{ position: 'relative' }}>
                <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Buscar por nome..." style={{ ...inputStyle, fontSize: 16 }} />
              </div>
            )}
            {isDefault && hasReenrollmentField && (
              <ReenrollmentPills value={filterReenrollment as '' | ReenrollBucket} counts={reenrollmentPillCounts} onChange={setFilterReenrollment} />
            )}
            <ResponsesList
              isMobile={isMobile} isDefault={isDefault} loading={loadingTable} rows={sortedTableResponses} questions={reportQuestions}
              sortColumn={sortColumn} sortDir={sortDir}
              onSort={col => {
                if (sortColumn === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                else { setSortColumn(col); setSortDir('desc') }
              }}
              onToggleDir={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              expandedRowId={expandedRowId}
              onToggleExpand={id => setExpandedRowId(prev => prev === id ? null : id)}
              onViewContact={name => navigate(`/contacts?search=${encodeURIComponent(name)}`)}
              page={tablePage} pageSize={TABLE_PAGE_SIZE} totalCount={tableTotalCount} onPageChange={setTablePage}
            />
          </>
        )}

        {activeTab === 'ai' && (
          <AiReportTab
            isMobile={isMobile} survey={viewingSurvey} report={aiReport} generating={generatingReport}
            hasResponses={responses.length > 0} onGenerate={() => generateReport(viewingSurvey)}
          />
        )}

        {overlays}
      </div>
    )
  }

  // ─── LISTA DE PESQUISAS ────────────────────────────────────
  const filterTabs: [string, string][] = [
    ['all', `Todas (${counts.all})`], ['active', `Ativas (${counts.active})`],
    ['draft', `Rascunhos (${counts.draft})`], ['closed', `Encerradas (${counts.closed})`],
  ]

  const emptyList = loading ? (
    <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 14 }}>Carregando...</div>
  ) : surveys.length === 0 ? (
    <div style={{ ...card, textAlign: 'center', padding: '36px 20px' }}>
      <span style={{ width: 56, height: 56, borderRadius: 18, background: '#E6F7F5', color: '#05907B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><ClipboardList size={26} /></span>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1A2B4A' }}>Nenhuma pesquisa criada ainda</p>
      <p style={{ margin: '6px 0 14px', fontSize: 13.5, color: '#5B6B86' }}>Crie a primeira para ouvir as famílias e antecipar rematrículas.</p>
      <button type="button" onClick={openNewModal} style={{ ...cardBtn('primary'), flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Criar primeira pesquisa</button>
    </div>
  ) : filteredSurveys.length === 0 ? (
    <EmptyState icon={ClipboardList} title="Nenhuma pesquisa nesta lista" hint="Troque o filtro acima para ver as outras." />
  ) : null

  const Meta = ({ s }: { s: Survey }) => (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: '#5B6B86' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Users size={14} color="#05907B" /><b style={{ color: '#1A2B4A' }}>{s.response_count ?? 0}</b> resposta{(s.response_count ?? 0) !== 1 ? 's' : ''}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CalendarDays size={14} color="#05907B" /> Criada em {fmt(s.created_at)}</span>
      {s.status === 'closed' && s.closed_at && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><StopCircle size={14} color="#3B82F6" /> Encerrada em {fmt(s.closed_at)}</span>}
    </div>
  )

  // ─── MOBILE ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={pageWrap}>
        <PageHeader compact icon={ClipboardList} title="Pesquisas" subtitle={`${active} ativa${active !== 1 ? 's' : ''} · ${total} no total`}
          actions={<>
            <HeaderAction primary icon={Plus} label="Nova pesquisa" onClick={openNewModal} />
            <HeaderAction icon={Users} label="Colaboradores" title="Pesquisa dos colaboradores" onClick={askCreateStaffSurvey} />
          </>} />

        <StatStrip items={listStats} />

        {surveys.length > 0 && <PillTabs tabs={filterTabs} value={listFilter} onChange={id => setListFilter(id as ListFilter)} />}

        {emptyList}

        {filteredSurveys.map(s => (
          <div key={s.id} className="ld-card" style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ fontSize: 15.5, fontWeight: 800, color: '#1A2B4A', margin: 0, flex: 1, lineHeight: 1.3 }}>{s.title}</p>
              <StatusBadge status={s.status} />
            </div>
            {s.description && <p style={{ fontSize: 13, color: '#5B6B86', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description}</p>}
            {s.survey_mode === 'custom' && (
              <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: '#6D28D9', background: '#F3E8FF', padding: '3px 10px', borderRadius: 999 }}>
                <Sparkles size={12} /> Pesquisa personalizada
              </span>
            )}
            <Meta s={s} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => openResponses(s)} className="aion-tap" style={{ ...cardBtn('primary'), flex: '1 1 0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Eye size={15} /> Ver respostas
              </button>
              <button onClick={() => copyLink(s.survey_token)} className="aion-tap" style={{ ...cardBtn('ghost'), flex: '1 1 0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Copy size={15} /> Copiar link
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => openPreview(s.survey_token)} className="aion-tap" style={{ ...cardBtn('ghost', { flex: '1 1 auto', minHeight: 40, fontSize: 12.5 }) }}>Visualizar</button>
              {s.survey_mode === 'custom' && (
                <button onClick={() => openEditor(s)} className="aion-tap" style={{ ...cardBtn('ghost', { flex: '1 1 auto', minHeight: 40, fontSize: 12.5 }) }}>Editar perguntas</button>
              )}
              <button onClick={() => openResponses(s, 'ai')} className="aion-tap" style={{ ...cardBtn('ghost', { flex: '1 1 auto', minHeight: 40, fontSize: 12.5 }) }}>Relatório IA</button>
              {s.status !== 'closed' && (
                <button onClick={() => askCloseSurvey(s.id)} className="aion-tap" style={{ ...cardBtn('ghost', { flex: '1 1 auto', minHeight: 40, fontSize: 12.5 }) }}>Encerrar</button>
              )}
              <button onClick={() => askDeleteSurvey(s.id, s.response_count ?? 0)} className="aion-tap" style={{ ...cardBtn('danger', { flex: '1 1 auto', minHeight: 40, fontSize: 12.5 }) }}>Excluir</button>
            </div>
          </div>
        ))}

        {overlays}
      </div>
    )
  }

  // ─── COMPUTADOR ───────────────────────────────────────────
  return (
    <div style={pageWrap}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <PageHeader icon={ClipboardList} title="Pesquisas de Satisfação" subtitle="Entenda o que as famílias pensam e antecipe rematrículas"
        actions={<>
          <HeaderAction icon={Users} label="Pesquisa dos colaboradores" onClick={askCreateStaffSurvey} />
          <HeaderAction primary icon={Plus} label="Nova pesquisa" onClick={openNewModal} />
        </>} />

      <StatStrip items={listStats} />

      {surveys.length > 0 && <div style={{ maxWidth: 640 }}><PillTabs tabs={filterTabs} value={listFilter} onChange={id => setListFilter(id as ListFilter)} /></div>}

      {emptyList ?? (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: '#F5FAF9' }}>
                {['Título', 'Status', 'Respostas', 'Criada em', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Ações' ? 'right' : 'left', fontWeight: 700, fontSize: 12.5, color: '#5B6B86', borderBottom: '1px solid #E3E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSurveys.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #EEF2F6' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: 14.5, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{s.title}</p>
                    {s.description && <p style={{ fontSize: 12.5, color: '#5B6B86', margin: '2px 0 0' }}>{s.description}</p>}
                    {s.survey_mode === 'custom' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11.5, fontWeight: 800, color: '#6D28D9', background: '#F3E8FF', padding: '2px 9px', borderRadius: 999 }}>
                        <Sparkles size={12} /> Pesquisa personalizada
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}><StatusBadge status={s.status} /></td>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: '#1A2B4A' }}>{s.response_count ?? 0}</td>
                  <td style={{ padding: '14px 16px', color: '#5B6B86', whiteSpace: 'nowrap' }}>{fmt(s.created_at)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ position: 'relative', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button onClick={() => openResponses(s)} className="aion-tap" style={{ ...cardBtn('primary'), flex: '0 0 auto', minHeight: 36, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Eye size={14} /> Ver respostas
                      </button>
                      <button onClick={() => copyLink(s.survey_token)} className="aion-tap" style={{ ...cardBtn('ghost'), flex: '0 0 auto', minHeight: 36, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Copy size={14} /> Copiar link
                      </button>
                      <button onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)} aria-label="Mais ações" className="aion-tap"
                        style={{ width: 36, height: 36, borderRadius: 12, border: '1px solid #E3E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5B6B86' }}>
                        <MoreVertical size={16} />
                      </button>
                      {openMenu === s.id && (
                        <div style={{ position: 'absolute', right: 0, top: 42, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 14, boxShadow: '0 12px 30px -10px rgba(26,43,74,.28)', zIndex: 100, minWidth: 200, overflow: 'hidden', padding: 4 }}>
                          {[
                            { label: 'Visualizar pesquisa', icon: <ExternalLink size={14} />, action: () => { setOpenMenu(null); openPreview(s.survey_token) } },
                            ...(s.survey_mode === 'custom' ? [{ label: 'Editar perguntas', icon: <Pencil size={14} />, action: () => { setOpenMenu(null); openEditor(s) } }] : []),
                            { label: 'Gerar relatório IA', icon: <Brain size={14} />, action: () => { setOpenMenu(null); openResponses(s, 'ai') } },
                            ...(s.status !== 'closed' ? [{ label: 'Encerrar pesquisa', icon: <StopCircle size={14} />, action: () => { setOpenMenu(null); askCloseSurvey(s.id) } }] : []),
                            { label: 'Excluir', icon: <Trash2 size={14} />, action: () => { setOpenMenu(null); askDeleteSurvey(s.id, s.response_count ?? 0) }, danger: true },
                          ].map((item, i) => (
                            <button key={i} onClick={item.action}
                              style={{ width: '100%', padding: '10px 12px', background: 'none', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: (item as any).danger ? '#DC2626' : '#1A2B4A', display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F5FAF9')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
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
        </div>
      )}

      {openMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpenMenu(null)} />}

      {overlays}
    </div>
  )
}
