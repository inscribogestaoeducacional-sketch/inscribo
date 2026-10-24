// Configurações → WhatsApp (visual do Business, cores do Edu).
//
// Início com faixa de conexão e cartões por assunto; cada assunto abre dentro
// desta aba, com "← WhatsApp" para voltar. As gravações são as mesmas de antes,
// mas agora cada botão grava SÓ os campos da própria seção em whatsapp_flows
// (antes, o botão de horário regravava a linha inteira, inclusive menu,
// boas-vindas e o liga/desliga do robô).
import React, { useEffect, useRef, useState } from 'react'
import {
  Wifi, RefreshCw, Loader2, Check, X, Plus, Trash2, Pencil, Bot, Zap, Clock, Coffee, Timer, Star,
  Users, Tag, Ban, MessageSquareText, MessageCircle, Hourglass, Repeat, Smartphone, WifiOff, History, CalendarDays, BellRing, FileText, Bell,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { platformAdmin } from '../../../lib/platformAdmin'
import FlowEditor from '../../whatsapp/FlowEditor'
import SpecialDatesSettings from './SpecialDatesSettings'
import TemplatesSettings from './TemplatesSettings'
import LeadSequenceSettings from './LeadSequenceSettings'
import AlertsSettings, { ALERTS_DEFAULTS, type AlertsForm } from './AlertsSettings'
import EmbeddedSignupButton from '../../whatsapp/EmbeddedSignupButton'
import { canSeeSettingsItem, visibleWhatsAppSections } from '../../../lib/settingsAccess'
import { BRAND, GRAD } from '../../../lib/brand'
import { Card, Title, Switch, SaveButton, GhostButton, Pill, NowNote, WarnNote, BackHeader, Tile, input, label, hint } from './ui'
import { normalizeBrazilianInput } from '../../../lib/phone'

const FLOW_DAYS = [
  { id: 'MON', label: 'Seg' }, { id: 'TUE', label: 'Ter' }, { id: 'WED', label: 'Qua' },
  { id: 'THU', label: 'Qui' }, { id: 'FRI', label: 'Sex' }, { id: 'SAT', label: 'Sáb' }, { id: 'SUN', label: 'Dom' },
]

// Nome de cada tipo de envio automático (coluna whatsapp_messages.automation).
const AUTO_LABEL: Record<string, string> = {
  robo: 'Robô', fora_horario: 'Fora do horário', almoco: 'Almoço', parou_responder: 'Cliente parou de responder',
  avaliacao: 'Avaliação', avaliacao_lembrete: 'Lembrete da avaliação', conversa_parada: 'Conversa parada', captacao: 'Captação', descadastro: 'Descadastro de campanhas', data_especial: 'Data especial',
}

// Avaliação: padrões (iguais aos do servidor, que usa estes valores quando o campo está vazio).
type SurveyForm = { buttons: [string, string, string]; thanks: string; ask_comment: boolean; comment_question: string; comment_thanks: string; valid_hours: number; other_reply: 'reabrir' | 'repetir'; reminder_enabled: boolean; reminder_hours: number; reminder_message: string }
const SURVEY_DEFAULTS: SurveyForm = {
  buttons: ['😞 Ruim', '😐 Regular', '😊 Ótimo'],
  thanks: 'Obrigado pelo seu feedback! 🙏 Estamos sempre buscando melhorar nosso atendimento.',
  ask_comment: false,
  comment_question: 'O que podemos melhorar no nosso atendimento?',
  comment_thanks: 'Obrigado por contar! Vamos usar o seu comentário para melhorar. 🙏',
  valid_hours: 48,
  other_reply: 'reabrir',
  reminder_enabled: false,
  reminder_hours: 6,
  reminder_message: 'Oi! Sua opinião é muito importante para nós. Como foi o seu atendimento? É só tocar em um dos botões acima. 🙏',
}

// Conversa parada: o atendente respondeu e o cliente sumiu. Desligada até a escola ligar.
type IdleForm = { enabled: boolean; hours: number; message: string }
const IDLE_DEFAULTS: IdleForm = {
  enabled: false,
  hours: 4,
  message: 'Oi! Ainda precisa de ajuda? Se já resolvemos, é só avisar. Estamos por aqui. 😊',
}

const TAG_COLORS = ['#6366f1', '#16a34a', '#dc2626', '#d97706', '#0891b2', '#ec4899', '#64748b', '#ea580c']

export const WA_SECTION_INFO: Record<string, { label: string; desc: string }> = {
  conexao:    { label: 'Conexão', desc: 'Número conectado, reconexão e nome do atendente nas mensagens.' },
  automacoes: { label: 'Painel de automações', desc: 'Liga e desliga tudo que o sistema manda sozinho e mostra o que já foi enviado.' },
  datas:      { label: 'Feriados e datas especiais', desc: 'Mensagens próprias para os dias em que a escola muda o atendimento.' },
  horario:    { label: 'Horário de atendimento', desc: 'Dias e horários, mensagens de fora do horário e almoço, e o tempo do robô.' },
  respostas:  { label: 'Respostas rápidas', desc: 'Textos prontos para a equipe usar com "/" no chat.' },
  equipe:     { label: 'Equipe e distribuição', desc: 'Grupos de atendimento, horário de cada atendente e para onde vai a conversa fora do horário.' },
  etiquetas:  { label: 'Etiquetas', desc: 'Cores para organizar as conversas.' },
  bloqueios:  { label: 'Números bloqueados', desc: 'Números que o sistema ignora.' },
  pesquisa:   { label: 'Avaliação do atendimento', desc: 'Pergunta ao cliente como foi o atendimento, ao encerrar.' },
  parada:     { label: 'Conversa parada', desc: 'Lembra o cliente que sumiu depois de ser atendido.' },
  alertas:    { label: 'Alertas', desc: 'Escolha quais avisos a escola recebe no sininho.' },
  sequencia:  { label: 'Sequência para lead sem resposta', desc: 'Até 5 mensagens automáticas, uma por vez, para o lead que parou de responder.' },
  modelos:    { label: 'Modelos da Meta', desc: 'Os modelos de mensagem da escola e os padrões, com o status de cada um na Meta.' },
}

// Fluxo visual ligado (as 6 escolas hoje): boas-vindas, menu e a mensagem
// genérica de fora do horário ficam sem efeito no webhook.
function hasVisualFlow(flow: unknown): boolean {
  const f = flow as { bot_enabled?: boolean; bot_flow?: { nodes?: unknown[] } | null }
  return !!(f?.bot_enabled && f?.bot_flow?.nodes?.length)
}

type FlowRow = Record<string, unknown>
type Attendant = { id: string; full_name: string; working_hours_start: string; working_hours_end: string; working_days: string[]; lunch_start: string; lunch_end: string; has_lunch_break: boolean }
type Group = { id: string; name: string; emoji: string; member_ids: string[] }

// Tempo e mensagem de inatividade são um só (bot_timeout_*; o banco usa o antigo timeout_* só se aquele estiver vazio).
function TimeoutNow({ flow }: { flow: FlowRow }) {
  const min = (flow.bot_timeout_minutes as number | null | undefined) || (flow.timeout_minutes as number | null | undefined)
  const hasMsg = !!((flow.bot_timeout_message as string | null | undefined) || (flow.timeout_message as string | null | undefined))
  if (!min) return null
  return (
    <NowNote>
      <strong>Valendo agora:</strong> o robô passa a conversa para a equipe após <strong>{min} min</strong> sem resposta{hasMsg ? ', enviando a mensagem abaixo' : ', sem mensagem'}.
    </NowNote>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '6px 13px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${active ? BRAND.primary : BRAND.line}`, background: active ? BRAND.soft : '#fff', color: active ? BRAND.primaryDark : BRAND.muted }}>
      {children}
    </button>
  )
}

export default function WhatsAppSettings({ institutionId, role, section, onSectionChange, isMobile }: {
  institutionId: string
  role: string | null | undefined
  section?: string | null
  onSectionChange?: (sec: string) => void
  isMobile?: boolean
}) {
  const allowed = visibleWhatsAppSections(role)
  const [metaConfig, setMetaConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [phoneRecord, setPhoneRecord] = useState<any>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [live, setLive] = useState<'ok' | 'off' | null>(null)
  const [showAgentName, setShowAgentName] = useState(false)
  const [savingAgentName, setSavingAgentName] = useState(false)
  const [showFlowEditor, setShowFlowEditor] = useState(false)

  const [flow, setFlow] = useState<FlowRow>({
    working_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], working_start: '07:00', working_end: '17:00',
    off_hours_message: 'Olá! Nosso atendimento é de seg a sex das 7h às 17h. Sua mensagem foi registrada e retornaremos em breve! 👋',
    bot_enabled: false, satisfaction_survey_enabled: false,
    satisfaction_message: 'Como você avalia nosso atendimento hoje? Seu feedback é muito importante para nós! 😊',
  })
  const [workingDays, setWorkingDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI'])
  const [workingStart, setWorkingStart] = useState('07:00')
  const [workingEnd, setWorkingEnd] = useState('17:00')
  const [offHoursMsg, setOffHoursMsg] = useState('')
  const [outsideHoursMsg, setOutsideHoursMsg] = useState('Olá! Nosso horário de atendimento é de {horario}. Sua mensagem foi registrada e retornaremos em breve! 👋')
  const [lunchMsg, setLunchMsg] = useState('Olá! No momento nossa equipe está no horário de almoço. Retornaremos em breve! 🍽️')
  const [botTimeoutMinutes, setBotTimeoutMinutes] = useState(10)
  const [botTimeoutMessage, setBotTimeoutMessage] = useState('')
  const [botTimeoutAssigneeId, setBotTimeoutAssigneeId] = useState('')
  const [botTimeoutAssigneeType, setBotTimeoutAssigneeType] = useState<'user' | 'group'>('user')
  const [staleHours, setStaleHours] = useState(24)
  const [timeoutMinutes, setTimeoutMinutes] = useState(15)
  const [timeoutGroupId, setTimeoutGroupId] = useState('')
  const [timeoutAssigneeId, setTimeoutAssigneeId] = useState('')
  const [timeoutMessage, setTimeoutMessage] = useState('Um momento, estou te conectando com um atendente! 👋')
  const [surveyMsg, setSurveyMsg] = useState('Como você avalia nosso atendimento hoje? Seu feedback é muito importante para nós! 😊')
  const [surveyOn, setSurveyOn] = useState(false)
  const [specialCount, setSpecialCount] = useState<number | null>(null)
  const [scheduleMode, setScheduleMode] = useState<'general' | 'individual'>('general')
  const [sv, setSv] = useState<SurveyForm>(SURVEY_DEFAULTS)
  const [idle, setIdle] = useState<IdleForm>(IDLE_DEFAULTS)
  const [alerts, setAlerts] = useState<AlertsForm>(ALERTS_DEFAULTS)
  const [lunchStart, setLunchStart] = useState('')
  const [lunchEnd, setLunchEnd] = useState('')
  const [history, setHistory] = useState<{ id: string; automation: string; remote_jid: string; content: string | null; created_at: string }[]>([])
  const [historyNames, setHistoryNames] = useState<Record<string, string>>({})
  const [historyFilter, setHistoryFilter] = useState('')
  const [historyLimit, setHistoryLimit] = useState(8)
  const [historyLoading, setHistoryLoading] = useState(false)

  const [flowUsers, setFlowUsers] = useState<{ id: string; full_name: string }[]>([])
  const [quickReplies, setQuickReplies] = useState<{ id: string; title: string; message: string; order_index: number }[]>([])
  const [newQR, setNewQR] = useState({ title: '', message: '' })
  const [savingQR, setSavingQR] = useState(false)
  const [editQRId, setEditQRId] = useState<string | null>(null)
  const [editQRData, setEditQRData] = useState({ title: '', message: '' })
  const [attendants, setAttendants] = useState<Attendant[]>([])
  const [savingAtt, setSavingAtt] = useState<string | null>(null)
  const [blacklist, setBlacklist] = useState<{ id: string; phone_number: string; reason: string | null; created_at: string }[]>([])
  const [showAddBlock, setShowAddBlock] = useState(false)
  const [newBlockNum, setNewBlockNum] = useState('')
  const [newBlockReason, setNewBlockReason] = useState('')
  const [savingBlock, setSavingBlock] = useState(false)
  const [waTags, setWaTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [editTagId, setEditTagId] = useState<string | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [tagMsg, setTagMsg] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [savingTag, setSavingTag] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [groupForm, setGroupForm] = useState({ name: '', emoji: '👥', member_ids: [] as string[] })

  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  const [view, setView] = useState<string>(() => (section && allowed.includes(section) ? section : 'inicio'))
  useEffect(() => {
    if (!section) { setView('inicio'); return }
    if (allowed.includes(section) && section !== view) setView(section)
  }, [section])
  const go = (v: string) => { setView(v); onSectionChange?.(v) }
  const goHome = () => { setView('inicio'); onSectionChange?.('') }

  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; loadConfig(); return () => { mounted.current = false } }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('institutions')
        .select('whatsapp_phone_id,whatsapp_phone_number,whatsapp_display_name,whatsapp_connected,show_agent_name_in_messages')
        .eq('id', institutionId).single()
      if (mounted.current) setShowAgentName(!!data?.show_agent_name_in_messages)
      if (mounted.current && data?.whatsapp_phone_id) {
        setMetaConfig(data)
        const { data: pr } = await supabase.from('whatsapp_phone_numbers')
          .select('phone_number,display_name,phone_number_id,waba_id')
          .eq('institution_id', institutionId).eq('is_active', true).maybeSingle()
        if (mounted.current && pr) setPhoneRecord(pr)
      }
    } catch {}
    try {
      const { data: f } = await supabase.from('whatsapp_flows').select('*').eq('institution_id', institutionId).maybeSingle()
      if (mounted.current && f) {
        setFlow(prev => ({ ...prev, ...f }))
        if (f.working_days) setWorkingDays(f.working_days)
        if (f.working_start) setWorkingStart(f.working_start)
        if (f.working_end) setWorkingEnd(f.working_end)
        setOffHoursMsg(f.off_hours_message || '')
        if (f.timeout_minutes) setTimeoutMinutes(f.timeout_minutes)
        if (f.timeout_group_id) setTimeoutGroupId(f.timeout_group_id)
        if (f.timeout_assignee_id) setTimeoutAssigneeId(f.timeout_assignee_id)
        if (f.timeout_message) setTimeoutMessage(f.timeout_message)
        if (f.outside_hours_message) setOutsideHoursMsg(f.outside_hours_message)
        if (f.lunch_message) setLunchMsg(f.lunch_message)
        if (f.schedule_mode === 'individual') setScheduleMode('individual')
        if (f.survey_config && typeof f.survey_config === 'object') {
          const c = f.survey_config as Partial<SurveyForm>
          setSv({ ...SURVEY_DEFAULTS, ...c, buttons: Array.isArray(c.buttons) && c.buttons.length === 3 ? (c.buttons as [string, string, string]) : SURVEY_DEFAULTS.buttons })
        }
        if (f.alerts_config && typeof f.alerts_config === 'object') setAlerts({ ...ALERTS_DEFAULTS, ...(f.alerts_config as Partial<AlertsForm>) })
        if (f.idle_config && typeof f.idle_config === 'object') setIdle({ ...IDLE_DEFAULTS, ...(f.idle_config as Partial<IdleForm>) })
        if (f.lunch_start) setLunchStart(String(f.lunch_start).slice(0, 5))
        if (f.lunch_end) setLunchEnd(String(f.lunch_end).slice(0, 5))
        // tempo e mensagem são um só: o banco já usa o do robô e, se vazio, o antigo da equipe
        if (f.bot_timeout_minutes || f.timeout_minutes) setBotTimeoutMinutes((f.bot_timeout_minutes || f.timeout_minutes) as number)
        if (f.bot_timeout_message || f.timeout_message) setBotTimeoutMessage((f.bot_timeout_message || f.timeout_message) as string)
        if (f.bot_timeout_assignee_id) setBotTimeoutAssigneeId(f.bot_timeout_assignee_id)
        if (f.bot_timeout_assignee_type) setBotTimeoutAssigneeType(f.bot_timeout_assignee_type)
        if (f.stale_conversation_hours) setStaleHours(f.stale_conversation_hours)
        setSurveyOn(!!f.satisfaction_survey_enabled)
        if (f.satisfaction_message) setSurveyMsg(f.satisfaction_message)
      }
    } catch {}
    try {
      const { data: users } = await supabase.from('users').select('id,full_name').eq('institution_id', institutionId)
      if (mounted.current) setFlowUsers(users || [])
    } catch {}
    try {
      const { data: sd } = await supabase.from('whatsapp_special_dates').select('id').eq('institution_id', institutionId).eq('active', true)
      if (mounted.current && sd) setSpecialCount(sd.length)
    } catch {}
    try {
      const { data: qr } = await supabase.from('whatsapp_quick_replies').select('id,title,message,order_index').eq('institution_id', institutionId).order('order_index', { ascending: true })
      if (mounted.current) setQuickReplies(qr || [])
    } catch {}
    try {
      const { data: atts } = await supabase.from('users').select('id,full_name,working_hours_start,working_hours_end,working_days,lunch_start,lunch_end').eq('institution_id', institutionId)
      if (mounted.current) setAttendants((atts || []).map((a: any) => ({
        id: a.id, full_name: a.full_name,
        working_hours_start: a.working_hours_start || '08:00', working_hours_end: a.working_hours_end || '18:00',
        working_days: a.working_days || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        lunch_start: a.lunch_start || '12:00', lunch_end: a.lunch_end || '13:00', has_lunch_break: !!(a.lunch_start && a.lunch_end),
      })))
    } catch {}
    try {
      const { data: bl } = await supabase.from('whatsapp_blacklist').select('id,phone_number,reason,created_at').eq('institution_id', institutionId).order('created_at', { ascending: false })
      if (mounted.current) setBlacklist((bl || []) as any)
    } catch {}
    try {
      const { data: g } = await supabase.from('whatsapp_groups').select('id, name, emoji, member_ids').eq('institution_id', institutionId).order('created_at')
      if (mounted.current) setGroups((g || []) as Group[])
    } catch {}
    try {
      const { data: t } = await supabase.from('whatsapp_tags').select('id, name, color').eq('institution_id', institutionId).order('name')
      if (mounted.current) setWaTags((t || []) as any)
    } catch {}
    if (mounted.current) setLoading(false)
  }

  // Grava SÓ os campos informados (nunca a linha inteira) e atualiza o "Valendo agora".
  const saveFlow = async (key: string, fields: Record<string, unknown>): Promise<boolean> => {
    setSavingKey(key)
    try {
      const { error } = await supabase.from('whatsapp_flows').upsert({ institution_id: institutionId, ...fields }, { onConflict: 'institution_id' })
      if (error) { alert('Erro ao salvar: ' + error.message); return false }
      setFlow(f => ({ ...f, ...fields }))
      setSavedKey(key)
      setTimeout(() => setSavedKey(k => (k === key ? null : k)), 2500)
      return true
    } catch (e) {
      console.error('[saveFlow]', e)
      return false
    } finally {
      setSavingKey(null)
    }
  }

  const toggleBot = async (v: boolean) => { setFlow(f => ({ ...f, bot_enabled: v })); if (!(await saveFlow('bot', { bot_enabled: v }))) setFlow(f => ({ ...f, bot_enabled: !v })) }
  // Liga/desliga de cada automação: chave em whatsapp_flows.automations (ausente = ligada).
  const autoOn = (key: string) => (flow.automations as Record<string, boolean> | undefined)?.[key] !== false
  const toggleAuto = async (key: string, v: boolean) => {
    const prev = (flow.automations as Record<string, boolean> | undefined) || {}
    await saveFlow('auto-' + key, { automations: { ...prev, [key]: v } })
  }
  const toggleReminder = async (v: boolean) => {
    const prev = sv
    setSv({ ...sv, reminder_enabled: v })
    if (!(await saveFlow('reminder-toggle', { survey_config: { ...sv, reminder_enabled: v } }))) setSv(prev)
  }
  const toggleIdle = async (v: boolean) => {
    const prev = idle
    setIdle({ ...idle, enabled: v })
    if (!(await saveFlow('idle-toggle', { idle_config: { ...idle, enabled: v } }))) setIdle(prev)
  }
  const toggleSurvey = async (v: boolean) => { setSurveyOn(v); if (!(await saveFlow('pesquisa-toggle', { satisfaction_survey_enabled: v }))) setSurveyOn(!v) }

  const handleToggleAgentName = async (value: boolean) => {
    setSavingAgentName(true); setShowAgentName(value)
    const { error } = await supabase.from('institutions').update({ show_agent_name_in_messages: value }).eq('id', institutionId)
    if (error) { alert('Erro ao salvar: ' + error.message); setShowAgentName(!value) }
    setSavingAgentName(false)
  }

  const handleTestConnection = async () => {
    const phoneId = metaConfig?.whatsapp_phone_id || phoneRecord?.phone_number_id
    if (!phoneId) { setTestResult({ ok: false, msg: 'Phone ID ou token não configurado.' }); return }
    setTesting(true); setTestResult(null)
    try {
      const data = await platformAdmin<{ ok: boolean; error?: string; verified_name?: string; display_phone_number?: string }>('test_connection', { institution_id: institutionId })
      if (data.ok) { setLive('ok'); setTestResult({ ok: true, msg: `Conectado: ${data.verified_name} (${data.display_phone_number})` }) }
      else { setLive('off'); setTestResult({ ok: false, msg: data.error || 'Token inválido' }) }
    } catch {
      setTestResult({ ok: false, msg: 'Erro de rede ao testar a conexão.' })
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 6000)
    }
  }

  const handleAddBlock = async () => {
    if (!newBlockNum.trim()) return
    setSavingBlock(true)
    try {
      // grava 55 + DDD + 9º dígito: é assim que o webhook compara (digitar sem o 55 funcionava só na aparência)
      const phone = normalizeBrazilianInput(newBlockNum.trim())
      if (blacklist.some(b => b.phone_number === phone)) { setNewBlockNum(''); setSavingBlock(false); return }
      const { data, error } = await supabase.from('whatsapp_blacklist').insert({ institution_id: institutionId, phone_number: phone, reason: newBlockReason.trim() || null }).select('id,phone_number,reason,created_at').single()
      if (!error && data) { setBlacklist(prev => [data as any, ...prev]); setNewBlockNum(''); setNewBlockReason(''); setShowAddBlock(false) }
    } catch {}
    setSavingBlock(false)
  }
  const handleRemoveBlock = async (id: string) => {
    if (!confirm('Remover este número da lista de bloqueados?')) return
    await supabase.from('whatsapp_blacklist').delete().eq('id', id).eq('institution_id', institutionId)
    setBlacklist(prev => prev.filter(b => b.id !== id))
  }

  const handleAddQR = async () => {
    if (!newQR.title || !newQR.message) return
    setSavingQR(true)
    try {
      const { data } = await supabase.from('whatsapp_quick_replies').insert({ institution_id: institutionId, title: newQR.title.trim(), message: newQR.message.trim(), order_index: quickReplies.length }).select().single()
      if (data) setQuickReplies(prev => [...prev, data as any])
      setNewQR({ title: '', message: '' })
    } catch (e) { console.error(e) } finally { setSavingQR(false) }
  }
  const handleDeleteQR = async (id: string) => {
    try { await supabase.from('whatsapp_quick_replies').delete().eq('id', id); setQuickReplies(prev => prev.filter(q => q.id !== id)) } catch (e) { console.error(e) }
  }
  const handleUpdateQR = async () => {
    if (!editQRId) return
    try {
      await supabase.from('whatsapp_quick_replies').update({ title: editQRData.title, message: editQRData.message }).eq('id', editQRId)
      setQuickReplies(prev => prev.map(q => (q.id === editQRId ? { ...q, ...editQRData } : q)))
      setEditQRId(null)
    } catch (e) { console.error(e) }
  }

  const toggleAttendantDay = (id: string, day: string) => setAttendants(prev => prev.map(a => a.id !== id ? a : { ...a, working_days: a.working_days.includes(day) ? a.working_days.filter(d => d !== day) : [...a.working_days, day] }))
  const updateAttendant = (id: string, key: string, value: string) => setAttendants(prev => prev.map(a => (a.id === id ? { ...a, [key]: value } : a)))
  const toggleAttendantLunch = (id: string) => setAttendants(prev => prev.map(a => (a.id === id ? { ...a, has_lunch_break: !a.has_lunch_break } : a)))
  const handleSaveAttendantHours = async (att: Attendant) => {
    setSavingAtt(att.id)
    try {
      await supabase.from('users').update({
        working_hours_start: att.working_hours_start, working_hours_end: att.working_hours_end, working_days: att.working_days,
        lunch_start: att.has_lunch_break ? att.lunch_start : null, lunch_end: att.has_lunch_break ? att.lunch_end : null,
      }).eq('id', att.id)
    } catch (e) { console.error(e) } finally { setSavingAtt(null) }
  }

  useEffect(() => {
    if (section !== 'automacoes') return
    let alive = true
    ;(async () => {
      setHistoryLoading(true)
      try {
        const since = new Date(Date.now() - 7 * 86400000).toISOString()
        const { data } = await supabase.from('whatsapp_messages')
          .select('id, automation, remote_jid, content, created_at')
          .eq('institution_id', institutionId).not('automation', 'is', null).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(1000)
        if (!alive) return
        const rows = (data || []) as any[]
        setHistory(rows)
        const jids = Array.from(new Set(rows.slice(0, 200).map(r => r.remote_jid))).slice(0, 100)
        if (jids.length) {
          const { data: convs } = await supabase.from('whatsapp_conversations').select('remote_jid, contact_name').eq('institution_id', institutionId).in('remote_jid', jids)
          if (alive) setHistoryNames(Object.fromEntries(((convs || []) as any[]).map(c => [c.remote_jid, c.contact_name || ''])))
        }
      } catch (e) { console.error('[historico]', e) } finally { if (alive) setHistoryLoading(false) }
    })()
    return () => { alive = false }
  }, [section, institutionId])

  const visual = hasVisualFlow(flow)
  const isAdmin = role === 'admin'
  const connected = live ? live === 'ok' : metaConfig?.whatsapp_connected !== false
  const phoneLabel = phoneRecord?.phone_number || metaConfig?.whatsapp_phone_number || metaConfig?.whatsapp_display_name || 'Número conectado'
  const dayNames: Record<string, string> = { MON: 'seg', TUE: 'ter', WED: 'qua', THU: 'qui', FRI: 'sex', SAT: 'sáb', SUN: 'dom' }
  const horarioTxt = `${workingDays.map(d => dayNames[d]).join(', ')}, das ${workingStart} às ${workingEnd}`
  const preview = (t?: string | null) => { const s = (t || '').replace(/\{horario\}/g, horarioTxt).replace(/\s+/g, ' ').trim(); return s.length > 120 ? s.slice(0, 120) + '…' : s }
  const timeoutNow = ((flow.bot_timeout_minutes as number) || (flow.timeout_minutes as number) || 0)

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} color={BRAND.primary} className="animate-spin" /></div>

  if (!metaConfig?.whatsapp_phone_id) return (
    <Card style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: 32 }}>
      <div style={{ width: 56, height: 56, background: '#EEF2F7', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><WifiOff size={26} color={BRAND.faint} /></div>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink, margin: '0 0 8px' }}>WhatsApp não configurado</h2>
      <p style={{ fontSize: 13, color: BRAND.muted, margin: '0 0 20px', lineHeight: 1.6 }}>Conecte agora mesmo usando sua conta do Meta Business, sem precisar de ajuda da nossa equipe.</p>
      <EmbeddedSignupButton institutionId={institutionId} onConnected={loadConfig} />
      <p style={{ fontSize: 12, color: BRAND.faint, margin: '20px 0 0', lineHeight: 1.6 }}>Prefere que a gente configure para você? Fale com o administrador da plataforma.</p>
    </Card>
  )

  const info = WA_SECTION_INFO[view]
  const col = { display: 'flex', flexDirection: 'column' as const, gap: 16 }
  const days = (sel: string[], toggle: (d: string) => void) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{FLOW_DAYS.map(d => <Chip key={d.id} active={sel.includes(d.id)} onClick={() => toggle(d.id)}>{d.label}</Chip>)}</div>
  )
  const textarea = (value: string, set: (v: string) => void, rows = 3, placeholder?: string) => (
    <textarea rows={rows} style={{ ...input, resize: 'vertical' }} value={value} placeholder={placeholder} onChange={e => set(e.target.value)} />
  )

  // ───────────────────────────── Início ─────────────────────────────
  const statusBg = connected ? GRAD : 'linear-gradient(130deg, #B91C1C 0%, #DC2626 100%)'
  const hubGroups: { title: string; items: { id: string; Icon: any; title: string; desc: string; hl?: boolean; open: () => void }[] }[] = [
    {
      title: 'Conexão e robô', items: [
        ...(allowed.includes('conexao') ? [{ id: 'robo', Icon: Bot, title: 'Robô de atendimento', desc: 'Monte o menu e o caminho de cada conversa.', hl: true, open: () => setShowFlowEditor(true) }] : []),
      ],
    },
    {
      title: 'Atendimento', items: [
        ...(allowed.includes('equipe') ? [{ id: 'equipe', Icon: Users, title: 'Equipe e distribuição', desc: 'Grupos de atendimento e quem recebe cada conversa.', open: () => go('equipe') }] : []),
        ...(allowed.includes('respostas') ? [{ id: 'respostas', Icon: MessageSquareText, title: 'Respostas rápidas', desc: 'Textos prontos para a equipe usar com "/" no chat.', open: () => go('respostas') }] : []),
        ...(allowed.includes('etiquetas') ? [{ id: 'etiquetas', Icon: Tag, title: 'Etiquetas', desc: 'Organize as conversas por cor.', open: () => go('etiquetas') }] : []),
        ...(allowed.includes('bloqueios') ? [{ id: 'bloqueios', Icon: Ban, title: 'Números bloqueados', desc: 'Números que o sistema ignora.', open: () => go('bloqueios') }] : []),
        ...(allowed.includes('pesquisa') ? [{ id: 'pesquisa', Icon: Star, title: 'Avaliação do atendimento', desc: 'Nota do cliente ao encerrar.', open: () => go('pesquisa') }] : []),
      ],
    },
    {
      title: 'Mensagens automáticas', items: [
        ...(allowed.includes('automacoes') ? [{ id: 'automacoes', Icon: Zap, title: 'Painel de automações', desc: 'Liga e desliga o que o sistema manda sozinho e mostra os envios.', hl: true, open: () => go('automacoes') }] : []),
        ...(allowed.includes('horario') ? [{ id: 'horario', Icon: Clock, title: 'Horário de atendimento', desc: 'Quando a escola atende e o que o robô responde fora do horário.', open: () => go('horario') }] : []),
        ...(allowed.includes('datas') ? [{ id: 'datas', Icon: CalendarDays, title: 'Feriados e datas especiais', desc: 'Avisos nos dias em que a escola não atende ou atende menos.', open: () => go('datas') }] : []),
        ...(allowed.includes('parada') ? [{ id: 'parada', Icon: Hourglass, title: 'Conversa parada', desc: 'Avisa o cliente que sumiu depois de ser atendido.', open: () => go('parada') }] : []),
        ...(allowed.includes('sequencia') ? [{ id: 'sequencia', Icon: Repeat, title: 'Sequência para lead sem resposta', desc: 'Até 5 mensagens automáticas para o lead que parou de responder.', hl: true, open: () => go('sequencia') }] : []),
        ...(allowed.includes('modelos') ? [{ id: 'modelos', Icon: FileText, title: 'Modelos da Meta', desc: 'Modelos de mensagem aprovados pela Meta: os da escola e os padrões.', open: () => go('modelos') }] : []),
      ],
    },
    {
      title: 'Alertas', items: [
        ...(allowed.includes('alertas') ? [{ id: 'alertas', Icon: Bell, title: 'Alertas', desc: 'Escolha quais avisos a escola recebe no sininho.', open: () => go('alertas') }] : []),
      ],
    },
  ].filter(g => g.items.length)

  const home = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ borderRadius: 20, padding: isMobile ? 16 : 22, color: '#fff', background: statusBg, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MessageCircle size={26} /></div>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 12, opacity: .85, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>WhatsApp oficial (Meta)</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{phoneLabel}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.18)', padding: '4px 10px', borderRadius: 999 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#A3E635' : '#FECACA' }} />{testing ? 'Verificando…' : connected ? 'Conectado' : 'Desconectado'}
            </span>
            {isAdmin && (
              <button type="button" onClick={handleTestConnection} disabled={testing} aria-label="Verificar a conexão de novo"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.18)', border: 'none', padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit' }}>
                <RefreshCw size={12} className={testing ? 'animate-spin' : undefined} /> Verificar
              </button>
            )}
            <span style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.18)', padding: '4px 10px', borderRadius: 999 }}>{flow.bot_enabled ? 'Robô ligado' : 'Atendimento manual'}</span>
          </div>
          {testResult && <div style={{ fontSize: 12.5, marginTop: 8, opacity: .95 }}>{testResult.msg}</div>}
        </div>
        {allowed.includes('conexao') && (
          <button type="button" onClick={() => go('conexao')} style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, background: '#fff', border: 'none', borderRadius: 12, padding: '11px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {connected ? 'Gerenciar conexão' : 'Reconectar agora'}
          </button>
        )}
      </div>
      {hubGroups.map(g => (
        <div key={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#5B6B86', letterSpacing: '.06em', textTransform: 'uppercase' }}>{g.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {g.items.map(it => <Tile key={it.id} Icon={it.Icon} title={it.title} desc={it.desc} highlight={it.hl} onClick={it.open} />)}
          </div>
        </div>
      ))}
    </div>
  )

  // ───────────────────────────── Conexão ─────────────────────────────
  const conexao = (
    <div style={col}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 44, height: 44, background: BRAND.soft, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wifi size={20} color={BRAND.primary} /></div>
          <div><div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>WhatsApp oficial (Meta)</div><div style={{ fontSize: 12, color: BRAND.muted }}>{metaConfig.whatsapp_display_name}</div></div>
          <span style={{ marginLeft: 'auto' }}><Pill tone={connected ? 'ok' : 'bad'}>{connected ? 'Conectado' : 'Desconectado'}</Pill></span>
        </div>
        <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: 12, border: `1px solid ${BRAND.line}`, fontSize: 12.5, color: BRAND.muted, marginBottom: 12 }}>
          <div>Número: <strong style={{ color: BRAND.ink }}>{phoneRecord?.phone_number || metaConfig.whatsapp_phone_number || '—'}</strong></div>
        </div>
        <div style={{ marginBottom: 16 }}><Pill tone={flow.bot_enabled ? 'ok' : 'gray'}>{flow.bot_enabled ? 'Robô ligado' : 'Atendimento manual'}</Pill></div>
        {testResult && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, background: testResult.ok ? BRAND.successSoft : BRAND.dangerSoft, border: `1px solid ${testResult.ok ? '#BBF7D0' : '#FECACA'}`, color: testResult.ok ? BRAND.success : BRAND.danger }}>{testResult.msg}</div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <GhostButton onClick={() => setShowFlowEditor(true)}><Bot size={14} /> Editar robô</GhostButton>
          <GhostButton onClick={handleTestConnection} disabled={testing}>{testing ? <><Loader2 size={13} className="animate-spin" /> Testando…</> : <><RefreshCw size={13} /> Testar conexão</>}</GhostButton>
        </div>
      </Card>

      {isAdmin && metaConfig?.whatsapp_phone_id && (
        <Card style={{ background: BRAND.warnSoft, border: '1px solid #FDE68A' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#92400E' }}>Reconectar WhatsApp (coexistência)</div>
          <div style={{ fontSize: 12.5, color: '#78350F', margin: '4px 0 12px', lineHeight: 1.6 }}>
            Use só se a Áion parou de enviar e receber mensagens, mas o app WhatsApp Business continua funcionando no celular da escola. Religa a conta atual, sem criar número nem conta nova.
          </div>
          <EmbeddedSignupButton institutionId={institutionId} onConnected={loadConfig} mode="reconnect"
            reconnectTarget={{ wabaId: phoneRecord?.waba_id ?? null, phoneNumber: phoneRecord?.phone_number || metaConfig.whatsapp_phone_number || null, displayName: phoneRecord?.display_name || metaConfig.whatsapp_display_name || null }} />
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>Mostrar o nome do atendente nas mensagens</div>
            <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2, lineHeight: 1.5 }}>
              As mensagens enviadas pela equipe mostram o nome de quem está respondendo, numa linha antes do texto (ex.: <strong>*Maria*:</strong> Olá!). Não afeta modelos nem mensagens automáticas do robô.
            </div>
          </div>
          <Switch on={showAgentName} onChange={handleToggleAgentName} disabled={savingAgentName} labelText="Mostrar nome do atendente" />
        </div>
      </Card>
    </div>
  )

  // ───────────────────────────── Automações ─────────────────────────────
  const AutoCard = ({ Icon, title, on, status, desc, previewText, now, extra, editLabel, onEdit, toggle, saving }: {
    Icon: any; title: string; on: boolean; status?: string; desc: string; previewText?: string; now?: React.ReactNode; extra?: React.ReactNode
    editLabel: string; onEdit: () => void; toggle?: (v: boolean) => void; saving?: boolean
  }) => (
    <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: on ? GRAD : '#EEF2F7', color: on ? '#fff' : BRAND.muted }}><Icon size={19} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{title}</div>
          <div style={{ fontSize: 12, color: on ? BRAND.primaryDark : BRAND.muted, fontWeight: 600 }}>{status || (on ? 'Ligada' : 'Desligada')}</div>
        </div>
        {toggle && (saving ? <Loader2 size={18} className="animate-spin" color={BRAND.primary} /> : <Switch on={on} onChange={toggle} labelText={title} />)}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>{desc}</p>
      {previewText ? <div style={{ fontSize: 12.5, color: '#334155', background: '#F6FAF9', border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>“{previewText}”</div> : null}
      {extra}
      {now}
      <button type="button" onClick={onEdit} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto', fontSize: 13, fontWeight: 700, color: BRAND.primaryDark, background: 'transparent', border: 'none', padding: '6px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
        <Pencil size={13} /> {editLabel}
      </button>
    </div>
  )

  const sent7 = (k: string) => history.filter(h => h.automation === k).length
  const sentTxt = (k: string, on: boolean) => (on ? `Ligada · ${sent7(k)} envios em 7 dias` : 'Desligada')
  const shownHistory = history.filter(h => !historyFilter || h.automation === historyFilter)
  const fmtWhen = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
  const whoOf = (jid: string) => historyNames[jid] || '+' + jid.split('@')[0]

  const automacoes = (
    <div style={col}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
        <AutoCard Icon={Bot} title="Robô de atendimento" on={!!flow.bot_enabled} status={sentTxt('robo', !!flow.bot_enabled)} saving={savingKey === 'bot'} toggle={toggleBot}
          desc="Atende na hora, mostra o menu e passa a conversa para a pessoa certa." editLabel="Editar robô" onEdit={() => setShowFlowEditor(true)} />
        <AutoCard Icon={Clock} title="Fora do horário" on={autoOn('fora_horario')} status={sentTxt('fora_horario', autoOn('fora_horario'))} saving={savingKey === 'auto-fora_horario'} toggle={v => toggleAuto('fora_horario', v)}
          desc="Responde quando a escola está fechada e deixa a conversa na fila."
          previewText={preview(visual ? outsideHoursMsg : offHoursMsg)} editLabel="Editar mensagem" onEdit={() => go('horario')}
          now={visual ? <NowNote>Com o robô ligado, vale a mensagem das transferências do robô.</NowNote> : undefined} />
        <AutoCard Icon={Coffee} title="Horário de almoço" on={autoOn('almoco')} status={sentTxt('almoco', autoOn('almoco'))} saving={savingKey === 'auto-almoco'} toggle={v => toggleAuto('almoco', v)}
          desc={lunchStart && lunchEnd ? `Almoço da escola das ${lunchStart} às ${lunchEnd}. Avisa o cliente quando a equipe está no almoço.` : 'Avisa o cliente quando a equipe está no almoço (horário de cada atendente em Equipe).'}
          previewText={preview(lunchMsg)} editLabel="Editar mensagem e horário" onEdit={() => go('horario')} />
        <AutoCard Icon={Timer} title="Cliente parou de responder" on={autoOn('parou_responder') && !!timeoutNow} status={timeoutNow ? sentTxt('parou_responder', autoOn('parou_responder')) : 'Sem tempo definido'}
          saving={savingKey === 'auto-parou_responder'} toggle={v => toggleAuto('parou_responder', v)}
          desc={timeoutNow ? `Depois de ${timeoutNow} min sem resposta ao robô, a conversa passa para a equipe.` : 'Passa a conversa para a equipe quando o cliente para de responder ao robô.'}
          previewText={preview((flow.bot_timeout_message as string) || (flow.timeout_message as string))} editLabel="Editar tempo e mensagem" onEdit={() => go('horario')}
          now={!autoOn('parou_responder') ? <WarnNote>Desligada: a conversa fica com o robô e não é passada para a equipe por falta de resposta.</WarnNote> : undefined} />
        <AutoCard Icon={CalendarDays} title="Feriados e datas especiais" on={autoOn('data_especial')} status={sentTxt('data_especial', autoOn('data_especial'))} saving={savingKey === 'auto-data_especial'} toggle={v => toggleAuto('data_especial', v)}
          desc="Mensagem própria nos dias em que a escola não atende ou atende menos."
          extra={specialCount !== null ? <span style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: BRAND.primaryDark, background: BRAND.soft, borderRadius: 999, padding: '4px 12px' }}>{specialCount === 0 ? 'Nenhuma data ativa' : `${specialCount} ${specialCount === 1 ? 'data ativa' : 'datas ativas'}`}</span> : undefined}
          editLabel="Gerenciar datas" onEdit={() => go('datas')} />
        <AutoCard Icon={Star} title="Avaliação do atendimento" on={surveyOn} status={sentTxt('avaliacao', surveyOn)} saving={savingKey === 'pesquisa-toggle'} toggle={toggleSurvey}
          desc="Ao encerrar, pergunta ao cliente como foi o atendimento." previewText={preview(surveyMsg)} editLabel="Editar avaliação" onEdit={() => go('pesquisa')} />
        <AutoCard Icon={BellRing} title="Lembrete da avaliação" on={surveyOn && sv.reminder_enabled} status={!surveyOn ? 'Precisa da avaliação ligada' : sentTxt('avaliacao_lembrete', sv.reminder_enabled)} saving={savingKey === 'reminder-toggle'} toggle={surveyOn ? toggleReminder : undefined}
          desc={`Se o cliente não responder a avaliação, recebe um lembrete depois de ${sv.reminder_hours} horas. Uma vez só.`} previewText={preview(sv.reminder_message)} editLabel="Editar lembrete" onEdit={() => go('pesquisa')}
          now={!surveyOn ? <WarnNote>Ligue a avaliação para usar o lembrete.</WarnNote> : undefined} />
        <AutoCard Icon={Hourglass} title="Conversa parada" on={idle.enabled} status={sentTxt('conversa_parada', idle.enabled)} saving={savingKey === 'idle-toggle'} toggle={toggleIdle}
          desc={`Depois que a equipe responde e o cliente some por ${idle.hours} horas, ele recebe um aviso. Só no horário da escola, uma vez por conversa.`} previewText={preview(idle.message)} editLabel="Editar tempo e mensagem" onEdit={() => go('parada')} />
      </div>

      <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${BRAND.line}`, flexWrap: 'wrap' }}>
          <History size={16} color={BRAND.primary} />
          <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink, flex: 1 }}>Enviados automaticamente (últimos 7 dias)</div>
          <select value={historyFilter} onChange={e => { setHistoryFilter(e.target.value); setHistoryLimit(8) }} style={{ ...input, width: 'auto', padding: '6px 10px', fontSize: 12.5 }} aria-label="Filtrar por automação">
            <option value="">Todas</option>
            {Object.entries(AUTO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {historyLoading ? <div style={{ padding: 24, textAlign: 'center' }}><Loader2 size={18} className="animate-spin" color={BRAND.primary} /></div>
          : shownHistory.length === 0 ? <div style={{ padding: '22px 18px', fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>Ainda não há envios automáticos marcados. Eles aparecem aqui a partir de agora, cada um com o nome da automação que enviou.</div>
          : shownHistory.slice(0, historyLimit).map(h => (
            <div key={h.id} style={{ display: 'flex', gap: 12, padding: '10px 18px', borderTop: '1px solid #F1F4F8', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: BRAND.primaryDark, background: BRAND.soft, borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>{AUTO_LABEL[h.automation] || h.automation}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.ink }}>{whoOf(h.remote_jid)}</div>
                <div style={{ fontSize: 12.5, color: BRAND.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.content}</div>
              </div>
              <span style={{ fontSize: 11.5, color: BRAND.faint, whiteSpace: 'nowrap' }}>{fmtWhen(h.created_at)}</span>
            </div>
          ))}
        {shownHistory.length > historyLimit && (
          <button type="button" onClick={() => setHistoryLimit(n => n + 20)} style={{ width: '100%', padding: 12, border: 'none', borderTop: '1px solid #F1F4F8', background: '#fff', color: BRAND.primaryDark, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Ver mais</button>
        )}
      </div>
    </div>
  )

  // ───────────────────────────── Horário ─────────────────────────────
  const horario = (
    <div style={col}>
      <Card>
        <Title Icon={Users} title="Como a escola atende" help="Cada escola escolhe: um horário único para todos ou o horário de cada atendente." />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip active={scheduleMode === 'general'} onClick={() => { if (scheduleMode !== 'general') { setScheduleMode('general'); saveFlow('mode', { schedule_mode: 'general' }) } }}>Atendimento geral (horário único)</Chip>
          <Chip active={scheduleMode === 'individual'} onClick={() => { if (scheduleMode !== 'individual') { setScheduleMode('individual'); saveFlow('mode', { schedule_mode: 'individual' }) } }}>Por atendente (cada um com seu horário)</Chip>
          {savingKey === 'mode' && <Loader2 size={16} className="animate-spin" color={BRAND.primary} />}
        </div>
        <div style={{ marginTop: 12 }}>
          <NowNote>{scheduleMode === 'general'
            ? 'Valendo agora: a escola abre e fecha num horário só, com um almoço só. As conversas são distribuídas como sempre.'
            : 'Valendo agora: a escola está aberta quando algum atendente está no próprio horário. Quando a conversa é distribuída para um grupo, ela vai só para quem está em horário e fora do almoço. Conversa enviada direto para um atendente fixo não confere o horário dele.'}</NowNote>
        </div>
      </Card>

      {scheduleMode === 'individual' && (
        <Card>
          <Title Icon={Clock} title="Horário de cada atendente" help="Os horários e o almoço de cada pessoa são ajustados em Equipe. Valem na distribuição por grupo. Fora do horário de todos, o robô avisa o cliente." />
          {attendants.filter(a => a.working_hours_start && a.working_hours_end).length === 0
            ? <WarnNote>Nenhum atendente tem horário cadastrado. Enquanto isso vale o horário único da escola. Cadastre em Equipe.</WarnNote>
            : <div style={{ display: 'flex', flexDirection: 'column' }}>
              {attendants.filter(a => a.working_hours_start && a.working_hours_end).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${BRAND.line}`, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px', fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{a.full_name}</div>
                  <div style={{ fontSize: 12.5, color: BRAND.muted }}>{(a.working_days || []).map(d => dayNames[d]).join(', ')} · {String(a.working_hours_start).slice(0, 5)} às {String(a.working_hours_end).slice(0, 5)}</div>
                  <div style={{ fontSize: 12.5, color: BRAND.muted }}>{a.has_lunch_break && a.lunch_start && a.lunch_end ? `Almoço ${String(a.lunch_start).slice(0, 5)}–${String(a.lunch_end).slice(0, 5)}` : 'Sem almoço'}</div>
                </div>
              ))}
            </div>}
          <div style={{ marginTop: 12 }}><GhostButton onClick={() => go('equipe')}><Pencil size={13} /> Editar horários em Equipe</GhostButton></div>
        </Card>
      )}

      {scheduleMode === 'general' && <>
      <Card>
        <Title Icon={Clock} title="Dias e horário" help="Quando a escola atende pelo WhatsApp. Fora desse período, o robô avisa o cliente." />
        <label style={label}>Dias da semana</label>
        {days(workingDays, d => setWorkingDays(w => (w.includes(d) ? w.filter(x => x !== d) : [...w, d])))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0' }}>
          <div><label style={label}>Início</label><input type="time" style={input} value={workingStart} onChange={e => setWorkingStart(e.target.value)} /></div>
          <div><label style={label}>Fim</label><input type="time" style={input} value={workingEnd} onChange={e => setWorkingEnd(e.target.value)} /></div>
        </div>
        <SaveButton text="Salvar horário" saving={savingKey === 'horario'} saved={savedKey === 'horario'}
          onClick={() => saveFlow('horario', { is_active: true, working_days: workingDays, working_start: workingStart, working_end: workingEnd })} />
      </Card>

      <Card>
        <Title Icon={Coffee} title="Horário de almoço da escola" help="Vale para a escola toda: o robô (bloco “Horário de almoço”) e a mensagem de almoço. O almoço de cada atendente continua em Equipe." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div><label style={label}>Almoço começa</label><input type="time" style={input} value={lunchStart} onChange={e => setLunchStart(e.target.value)} /></div>
          <div><label style={label}>Almoço termina</label><input type="time" style={input} value={lunchEnd} onChange={e => setLunchEnd(e.target.value)} /></div>
        </div>
        <p style={{ ...hint, margin: '0 0 14px' }}>Deixe em branco se a escola não para para o almoço. No horário do almoço, a conversa que chega fica na fila e o cliente recebe a mensagem de almoço.</p>
        <SaveButton text="Salvar almoço" saving={savingKey === 'lunch'} saved={savedKey === 'lunch'}
          onClick={() => saveFlow('lunch', { lunch_start: lunchStart || null, lunch_end: lunchEnd || null })} />
      </Card>
      </>}

      <Card>
        <Title Icon={MessageSquareText} title="Mensagens automáticas" help="O que o cliente recebe fora do horário e no almoço. Use {horario} para inserir os horários automaticamente." />
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Mensagem fora do horário</label>
          {visual
            ? <>{textarea(outsideHoursMsg, setOutsideHoursMsg)}<p style={hint}>É esta que o robô usa ao passar a conversa fora do horário.</p></>
            : textarea(offHoursMsg, setOffHoursMsg)}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Mensagem de horário de almoço</label>
          {textarea(lunchMsg, setLunchMsg)}
        </div>
        <SaveButton text="Salvar mensagens" saving={savingKey === 'msgs'} saved={savedKey === 'msgs'}
          onClick={() => saveFlow('msgs', visual ? { outside_hours_message: outsideHoursMsg, lunch_message: lunchMsg } : { off_hours_message: offHoursMsg, outside_hours_message: outsideHoursMsg, lunch_message: lunchMsg })} />
      </Card>

      <Card>
        <Title Icon={Timer} title="Quando o cliente some" help="Se o robô está atendendo e o cliente não responde por este tempo, o sistema envia a mensagem abaixo e passa a conversa para atendimento humano. Tempo, mensagem e destino desta situação ficam todos aqui." />
        <div style={{ marginBottom: 14 }}><TimeoutNow flow={flow} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ ...label, margin: 0 }}>Transferir após</label>
          <input type="number" min={1} max={1440} value={botTimeoutMinutes} onChange={e => setBotTimeoutMinutes(Math.max(1, Math.min(1440, parseInt(e.target.value) || 1)))}
            style={{ ...input, width: 80, textAlign: 'center' }} />
          <span style={{ fontSize: 13, color: BRAND.muted }}>minutos sem resposta</span>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Mensagem ao transferir para atendimento</label>
          {textarea(botTimeoutMessage, setBotTimeoutMessage, 3, 'Olá! Vou te conectar com um de nossos atendentes. Aguarde um momento. 😊')}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Para quem passa quando o cliente some (opcional)</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <Chip active={botTimeoutAssigneeType === 'user'} onClick={() => { setBotTimeoutAssigneeType('user'); setBotTimeoutAssigneeId('') }}>Atendente</Chip>
            <Chip active={botTimeoutAssigneeType === 'group'} onClick={() => { setBotTimeoutAssigneeType('group'); setBotTimeoutAssigneeId('') }}>Grupo</Chip>
          </div>
          <select value={botTimeoutAssigneeId} onChange={e => setBotTimeoutAssigneeId(e.target.value)} style={input}>
            <option value="">Fila geral</option>
            {botTimeoutAssigneeType === 'user' ? flowUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>) : groups.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
          </select>
        </div>
        <SaveButton text="Salvar tempo do robô" saving={savingKey === 'bot-timeout'} saved={savedKey === 'bot-timeout'}
          onClick={() => saveFlow('bot-timeout', {
            bot_timeout_minutes: botTimeoutMinutes, bot_timeout_message: botTimeoutMessage || null,
            ...(botTimeoutMessage.trim() ? { timeout_message: botTimeoutMessage } : {}), // vazio: mantém a mensagem padrão antiga, sem desligar a transferência
            bot_timeout_assignee_id: botTimeoutAssigneeId || null, bot_timeout_assignee_type: botTimeoutAssigneeType, // sempre explícito: "Fila geral" não herda o destino de fora do horário
          })} />
      </Card>

      <Card>
        <Title Icon={Hourglass} title="Conversas paradas" help="Se um atendente ficar ausente (férias, folga), as conversas dele voltam a ficar visíveis para toda a equipe depois deste prazo." />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ ...label, margin: 0 }}>Considerar parada depois de</label>
          <select value={staleHours} onChange={e => setStaleHours(parseInt(e.target.value))} style={{ ...input, width: 160 }}>
            {[4, 8, 12, 24, 48].map(h => <option key={h} value={h}>{h} horas</option>)}
          </select>
        </div>
        <SaveButton text="Salvar prazo" saving={savingKey === 'stale'} saved={savedKey === 'stale'} onClick={() => saveFlow('stale', { stale_conversation_hours: staleHours })} />
      </Card>
    </div>
  )

  // ───────────────────────────── Respostas rápidas ─────────────────────────────
  const respostas = (
    <div style={col}>
      {quickReplies.length === 0 && <Card><p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Nenhuma resposta rápida cadastrada ainda.</p></Card>}
      {quickReplies.map(qr => (
        <Card key={qr.id} style={{ padding: '14px 16px' }}>
          {editQRId === qr.id ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input style={input} value={editQRData.title} onChange={e => setEditQRData(d => ({ ...d, title: e.target.value }))} placeholder="Atalho" />
                <textarea rows={2} style={{ ...input, resize: 'vertical' }} value={editQRData.message} onChange={e => setEditQRData(d => ({ ...d, message: e.target.value }))} placeholder="Mensagem" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <GhostButton onClick={handleUpdateQR}><Check size={14} /> Salvar</GhostButton>
                <GhostButton onClick={() => setEditQRId(null)}>Cancelar</GhostButton>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: BRAND.primaryDark }}>/{qr.title}</span>
                <p style={{ fontSize: 13, color: BRAND.muted, margin: '4px 0 0', lineHeight: 1.45 }}>{qr.message}</p>
              </div>
              <GhostButton onClick={() => { setEditQRId(qr.id); setEditQRData({ title: qr.title, message: qr.message }) }}><Pencil size={13} /></GhostButton>
              <GhostButton danger onClick={() => handleDeleteQR(qr.id)}><X size={13} /></GhostButton>
            </div>
          )}
        </Card>
      ))}
      <Card style={{ border: `1px dashed #CBD5E1`, boxShadow: 'none' }}>
        <Title Icon={Plus} title="Nova resposta rápida" help="O atalho é o que a equipe digita depois da barra, por exemplo /preco." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={input} value={newQR.title} onChange={e => setNewQR(q => ({ ...q, title: e.target.value }))} placeholder="Atalho (ex.: preco, matricula)" />
          <textarea rows={2} style={{ ...input, resize: 'vertical' }} value={newQR.message} onChange={e => setNewQR(q => ({ ...q, message: e.target.value }))} placeholder="Mensagem que será enviada" />
          <div><SaveButton text="Adicionar resposta rápida" saving={savingQR} disabled={!newQR.title || !newQR.message} onClick={handleAddQR} /></div>
        </div>
      </Card>
    </div>
  )

  // ───────────────────────────── Equipe ─────────────────────────────
  const equipe = (
    <div style={col}>
      {canSeeSettingsItem('whatsapp.equipe.horarios', role) && (
        <Card>
          <Title Icon={Clock} title="Horário de cada atendente" help="Dias, horário e almoço de cada pessoa. A distribuição das conversas respeita esses horários." />
          {attendants.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Nenhum atendente cadastrado.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {attendants.map(att => (
                <div key={att.id} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>{att.full_name}</div>
                  <div style={{ marginBottom: 12 }}>{days(att.working_days, d => toggleAttendantDay(att.id, d))}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                    <div><label style={label}>Início</label><input type="time" style={input} value={att.working_hours_start} onChange={e => updateAttendant(att.id, 'working_hours_start', e.target.value)} /></div>
                    <div><label style={label}>Fim</label><input type="time" style={input} value={att.working_hours_end} onChange={e => updateAttendant(att.id, 'working_hours_end', e.target.value)} /></div>
                    <SaveButton text="Salvar" saving={savingAtt === att.id} onClick={() => handleSaveAttendantHours(att)} />
                  </div>
                  <div style={{ marginTop: 12, borderTop: `1px solid ${BRAND.line}`, paddingTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: att.has_lunch_break ? 10 : 0 }}>
                      <Switch on={att.has_lunch_break} onChange={() => toggleAttendantLunch(att.id)} labelText="Tem horário de almoço" />
                      <span style={{ fontSize: 13, color: BRAND.muted }}>Tem horário de almoço</span>
                    </div>
                    {att.has_lunch_break && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div><label style={label}>Almoço: início</label><input type="time" style={input} value={att.lunch_start} onChange={e => updateAttendant(att.id, 'lunch_start', e.target.value)} /></div>
                        <div><label style={label}>Almoço: fim</label><input type="time" style={input} value={att.lunch_end} onChange={e => updateAttendant(att.id, 'lunch_end', e.target.value)} /></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <Title Icon={Users} title="Grupos de atendimento" help="Equipes por assunto (Secretaria, Financeiro…). O robô e as transferências podem mandar a conversa para um grupo." />
          <GhostButton onClick={() => { setGroupForm({ name: '', emoji: '👥', member_ids: [] }); setEditingGroup(null); setShowGroupForm(true) }}><Plus size={14} /> Novo grupo</GhostButton>
        </div>
        {groups.length === 0 && <p style={{ fontSize: 13, color: BRAND.faint, margin: 0 }}>Nenhum grupo criado ainda.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map(group => (
            <div key={group.id} style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${BRAND.softLine}`, background: BRAND.softer, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{group.emoji} {group.name}</div>
                <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{group.member_ids.length} membro(s): {group.member_ids.map(id => flowUsers.find(u => u.id === id)?.full_name || id).join(', ')}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <GhostButton onClick={() => { setGroupForm({ name: group.name, emoji: group.emoji, member_ids: group.member_ids }); setEditingGroup(group); setShowGroupForm(true) }}>Editar</GhostButton>
                <GhostButton danger onClick={async () => { if (!confirm('Excluir este grupo?')) return; await supabase.from('whatsapp_groups').delete().eq('id', group.id); setGroups(prev => prev.filter(g => g.id !== group.id)) }}>Excluir</GhostButton>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Title Icon={Timer} title="Para onde vai a conversa" help="Destino quando o robô passa a conversa para a equipe fora do horário de atendimento. O destino de quando o cliente some fica em Horário de atendimento." />
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Transferir para</label>
          <select style={input}
            value={timeoutGroupId ? `group:${timeoutGroupId}` : timeoutAssigneeId ? `user:${timeoutAssigneeId}` : ''}
            onChange={e => {
              const val = e.target.value
              if (!val) { setTimeoutGroupId(''); setTimeoutAssigneeId('') }
              else if (val.startsWith('group:')) { setTimeoutGroupId(val.replace('group:', '')); setTimeoutAssigneeId('') }
              else { setTimeoutAssigneeId(val.replace('user:', '')); setTimeoutGroupId('') }
            }}>
            <option value="">Ninguém (só desligar o robô)</option>
            <optgroup label="Grupos">{groups.map(g => <option key={g.id} value={`group:${g.id}`}>{g.emoji} {g.name}</option>)}</optgroup>
            <optgroup label="Atendentes">{flowUsers.map(u => <option key={u.id} value={`user:${u.id}`}>{u.full_name}</option>)}</optgroup>
          </select>
        </div>
        <SaveButton text="Salvar transferência" saving={savingKey === 'equipe'} saved={savedKey === 'equipe'}
          onClick={() => saveFlow('equipe', {
            timeout_group_id: timeoutGroupId || null, timeout_assignee_id: timeoutAssigneeId || null,
            timeout_assignee_name: timeoutAssigneeId ? (flowUsers.find(u => u.id === timeoutAssigneeId)?.full_name || null) : null, 
          })} />
      </Card>
    </div>
  )

  // ───────────────────────────── Bloqueios ─────────────────────────────
  const bloqueios = (
    <div style={col}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <Title Icon={Ban} title="Números bloqueados" help="Mensagens de um número bloqueado são ignoradas: não entram no Hub e o robô não responde. Quem pediu para não receber campanhas fica na lista de Transmissões." />
          <GhostButton danger onClick={() => setShowAddBlock(true)}><Plus size={14} /> Bloquear número</GhostButton>
        </div>
        {showAddBlock && (
          <div style={{ background: BRAND.dangerSoft, border: '1px solid #FECACA', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <input value={newBlockNum} onChange={e => setNewBlockNum(e.target.value)} placeholder="Número com DDD (ex.: 83 99999-9999)" style={input} />
            <input value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)} placeholder="Motivo (opcional)" style={input} />
            <div style={{ display: 'flex', gap: 8 }}>
              <GhostButton danger disabled={savingBlock || !newBlockNum.trim()} onClick={handleAddBlock}>{savingBlock ? 'Bloqueando…' : 'Confirmar bloqueio'}</GhostButton>
              <GhostButton onClick={() => { setShowAddBlock(false); setNewBlockNum(''); setNewBlockReason('') }}>Cancelar</GhostButton>
            </div>
          </div>
        )}
        {blacklist.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Nenhum número bloqueado.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {blacklist.map(b => (
              <div key={b.id} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink, fontFamily: 'monospace' }}>{b.phone_number}</div>
                  {b.reason && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{b.reason}</div>}
                </div>
                <GhostButton danger onClick={() => handleRemoveBlock(b.id)}><Trash2 size={13} /> Remover</GhostButton>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )

  // ───────────────────────────── Etiquetas ─────────────────────────────
  const etiquetas = (
    <Card>
      <Title Icon={Tag} title="Etiquetas" help="Crie etiquetas para organizar as conversas e os leads, inclusive no fluxo do robô. Ao renomear, as conversas, os contatos e o fluxo do robô acompanham o novo nome." />
      {waTags.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {waTags.map(tag => (
            <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: tag.color, color: '#fff', fontSize: 12.5, fontWeight: 700 }}>
              {editTagId === tag.id ? (
                <input autoFocus value={editTagName} maxLength={30} onChange={e => setEditTagName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Escape') { setEditTagId(null); return }
                    if (e.key !== 'Enter') return
                    const novo = editTagName.trim()
                    if (!novo || novo === tag.name) { setEditTagId(null); return }
                    const { error } = await supabase.rpc('whatsapp_tag_apply', { p_tag_id: tag.id, p_new_name: novo })
                    if (error) { setTagMsg(error.message); return }
                    setWaTags(prev => prev.map(t => t.id === tag.id ? { ...t, name: novo } : t).sort((a, b) => a.name.localeCompare(b.name)))
                    setEditTagId(null); setTagMsg(null)
                  }}
                  style={{ width: 110, border: 'none', borderRadius: 6, padding: '2px 6px', fontSize: 12.5, fontWeight: 700, color: '#1A2B4A', outline: 'none' }} />
              ) : tag.name}
              <button type="button" aria-label={`Renomear ${tag.name}`} title="Renomear (Enter salva, Esc cancela)" onClick={() => { setEditTagId(tag.id); setEditTagName(tag.name); setTagMsg(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.9)', fontSize: 12, lineHeight: 1, padding: 0 }}>✎</button>
              <button type="button" aria-label={`Excluir ${tag.name}`} onClick={async () => {
                if (!window.confirm(`Excluir a etiqueta "${tag.name}"? Ela sai de todas as conversas e contatos. Fluxos do robô que a citam precisam ser ajustados.`)) return
                const { error } = await supabase.rpc('whatsapp_tag_apply', { p_tag_id: tag.id })
                if (error) { setTagMsg(error.message); return }
                setWaTags(prev => prev.filter(t => t.id !== tag.id)); setTagMsg(null)
              }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.9)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      ) : <p style={{ fontSize: 13, color: BRAND.faint, margin: '0 0 16px' }}>Nenhuma etiqueta criada ainda.</p>}
      {tagMsg && <p style={{ fontSize: 12.5, color: '#DC2626', margin: '-8px 0 12px' }}>{tagMsg}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label style={label}>Nome da etiqueta</label><input style={input} value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Ex.: VIP, Interessado, Aguardando…" maxLength={30} /></div>
        <div>
          <label style={label}>Cor</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {TAG_COLORS.map(c => <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setNewTagColor(c)} style={{ width: 30, height: 30, borderRadius: 10, background: c, border: newTagColor === c ? `3px solid ${BRAND.ink}` : '2px solid transparent', cursor: 'pointer' }} />)}
          </div>
        </div>
        <div>
          <SaveButton text="Adicionar etiqueta" saving={savingTag} disabled={!newTagName.trim()} onClick={async () => {
            if (!newTagName.trim()) return
            setSavingTag(true)
            const { data, error } = await supabase.from('whatsapp_tags').insert({ institution_id: institutionId, name: newTagName.trim(), color: newTagColor }).select('id, name, color').single()
            setSavingTag(false)
            if (!error && data) { setWaTags(prev => [...prev, data as any].sort((a, b) => a.name.localeCompare(b.name))); setNewTagName(''); setNewTagColor('#6366f1') }
          }} />
        </div>
      </div>
    </Card>
  )

  // ───────────────────────────── Avaliação ─────────────────────────────
  const setSvF = <K extends keyof SurveyForm>(k: K, v: SurveyForm[K]) => setSv(prev => ({ ...prev, [k]: v }))
  const saveSurvey = () => saveFlow('pesquisa', { satisfaction_survey_enabled: surveyOn, satisfaction_message: surveyMsg, survey_config: sv })
  const bub = (me: boolean): React.CSSProperties => ({ maxWidth: '88%', borderRadius: 10, padding: '7px 10px', fontSize: 13, color: '#111B21', marginBottom: 8, whiteSpace: 'pre-wrap', boxShadow: '0 1px 1px rgba(0,0,0,.08)', background: me ? '#D9FDD3' : '#fff', marginLeft: me ? 'auto' : 0 })
  const pesquisa = (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Avaliar ao encerrar</div>
              <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2 }}>Quando o atendimento é encerrado, o cliente recebe a pergunta com 3 botões.</div>
            </div>
            <Switch on={surveyOn} onChange={setSurveyOn} labelText="Ligar avaliação" />
          </div>
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: surveyOn ? 1 : 0.6 }}>
          <Card>
            <Title Icon={Star} title="Pergunta e botões" help="O texto que o cliente vê e o nome de cada botão." />
            <label style={label}>Pergunta</label>
            {textarea(surveyMsg, setSurveyMsg, 3, 'Como você avalia nosso atendimento hoje?')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 12 }}>
              {(['Nota ruim', 'Nota regular', 'Nota ótima'] as const).map((l, i) => (
                <div key={l}><label style={label}>{l}</label>
                  <input style={input} maxLength={20} value={sv.buttons[i]} onChange={e => setSvF('buttons', sv.buttons.map((b, j) => (j === i ? e.target.value : b)) as [string, string, string])} /></div>
              ))}
            </div>
            <p style={hint}>Até 20 letras por botão (limite do WhatsApp). O cliente também pode responder 1, 2 ou 3.</p>
            <label style={{ ...label, marginTop: 12 }}>Agradecimento</label>
            {textarea(sv.thanks, v => setSvF('thanks', v), 2)}
          </Card>
          <Card>
            <Title Icon={MessageSquareText} title="Quando a nota é ruim" help="Deixa o cliente contar o que aconteceu. A resposta fica guardada no atendimento." />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Switch on={sv.ask_comment} onChange={v => setSvF('ask_comment', v)} labelText="Perguntar o que melhorar" />
              <span style={{ fontSize: 13.5, color: BRAND.ink }}>Perguntar o que podemos melhorar</span>
            </div>
            {sv.ask_comment && <>
              <label style={{ ...label, marginTop: 12 }}>Pergunta</label>
              <input style={input} value={sv.comment_question} onChange={e => setSvF('comment_question', e.target.value)} />
              <label style={{ ...label, marginTop: 12 }}>Agradecimento depois do comentário</label>
              <input style={input} value={sv.comment_thanks} onChange={e => setSvF('comment_thanks', e.target.value)} />
            </>}
          </Card>
          <Card>
            <Title Icon={BellRing} title="Lembrete se ele não responder" help="Uma única mensagem para quem recebeu a avaliação e não tocou em nenhum botão." />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Switch on={sv.reminder_enabled} onChange={v => setSvF('reminder_enabled', v)} labelText="Enviar lembrete" />
              <span style={{ fontSize: 13.5, color: BRAND.ink }}>Enviar um lembrete</span>
            </div>
            {sv.reminder_enabled && <>
              <label style={{ ...label, marginTop: 12 }}>Enviar depois de</label>
              <select style={{ ...input, width: 180 }} value={sv.reminder_hours} onChange={e => setSvF('reminder_hours', parseInt(e.target.value))}>
                {[2, 4, 6, 12, 23].map(h => <option key={h} value={h}>{h} horas</option>)}
              </select>
              <label style={{ ...label, marginTop: 12 }}>Mensagem</label>
              {textarea(sv.reminder_message, v => setSvF('reminder_message', v), 2)}
              <p style={hint}>Vai só dentro do horário da escola e no máximo 23 horas depois, que é o limite do WhatsApp para texto livre.</p>
            </>}
          </Card>
          <Card>
            <Title Icon={Clock} title="Se o cliente responder depois" help="Por quanto tempo a resposta ainda conta como avaliação e o que fazer quando ele escreve outra coisa." />
            <label style={label}>A resposta vale por</label>
            {(() => {
              const presets = [1, 2, 3, 6, 12, 24, 48, 72, 168, 360, 720]
              const nameOf = (h: number) => h === 168 ? '7 dias' : h === 360 ? '15 dias' : h === 720 ? '30 dias' : h === 1 ? '1 hora' : `${h} horas`
              const isPreset = presets.includes(sv.valid_hours)
              return (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select style={{ ...input, width: 180 }} value={isPreset ? String(sv.valid_hours) : 'outro'}
                    onChange={e => { if (e.target.value !== 'outro') setSvF('valid_hours', parseInt(e.target.value)) }}>
                    {presets.map(h => <option key={h} value={h}>{nameOf(h)}</option>)}
                    {!isPreset && <option value="outro">{sv.valid_hours} horas (personalizado)</option>}
                  </select>
                  <span style={{ fontSize: 13, color: BRAND.muted }}>ou escolha o seu prazo, em horas (1 a 720):</span>
                  <input type="number" min={1} max={720} style={{ ...input, width: 100 }} value={sv.valid_hours}
                    onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) setSvF('valid_hours', Math.min(720, Math.max(1, n))) }} />
                </div>
              )
            })()}
            <label style={{ ...label, marginTop: 14 }}>Se ele escrever outra coisa no lugar da nota</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip active={sv.other_reply === 'reabrir'} onClick={() => setSvF('other_reply', 'reabrir')}>Abrir um novo atendimento</Chip>
              <Chip active={sv.other_reply === 'repetir'} onClick={() => setSvF('other_reply', 'repetir')}>Repetir a pergunta uma vez</Chip>
            </div>
            <p style={hint}>Depois do prazo, qualquer mensagem do cliente abre um novo atendimento.</p>
          </Card>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SaveButton text="Salvar avaliação" saving={savingKey === 'pesquisa'} saved={savedKey === 'pesquisa'} onClick={saveSurvey} />
          <GhostButton onClick={() => setSv(SURVEY_DEFAULTS)}>Voltar ao padrão</GhostButton>
        </div>
      </div>
      <aside style={{ flex: '0 1 340px', minWidth: 250 }}>
        <div style={{ background: '#E7F0E8', borderRadius: 18, padding: 16, border: `1px solid ${BRAND.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#3F5F46', marginBottom: 10 }}><Smartphone size={14} /> Como o cliente vê</div>
          <div style={bub(true)}>{surveyMsg || 'Como você avalia nosso atendimento hoje?'}</div>
          {sv.buttons.map((b, i) => <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '7px 10px', textAlign: 'center', color: '#0B7EC0', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{b}</div>)}
          {sv.reminder_enabled && <div style={{ fontSize: 11, color: '#3F5F46', textAlign: 'center', margin: '6px 0' }}>… {sv.reminder_hours} horas sem resposta</div>}
          {sv.reminder_enabled && <div style={bub(true)}>{sv.reminder_message}</div>}
          <div style={{ ...bub(false), marginTop: 8 }}>{sv.buttons[0]}</div>
          {sv.ask_comment
            ? <><div style={bub(true)}>{sv.comment_question}</div><div style={bub(false)}>Demorou um pouco para responder.</div><div style={bub(true)}>{sv.comment_thanks}</div></>
            : <div style={bub(true)}>{sv.thanks}</div>}
        </div>
      </aside>
    </div>
  )

  const saveIdle = () => saveFlow('parada', { idle_config: idle })
  const parada = (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Avisar quando a conversa para</div>
              <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2 }}>A equipe respondeu e o cliente não escreveu mais. Ele recebe uma mensagem, uma vez só.</div>
            </div>
            <Switch on={idle.enabled} onChange={v => setIdle({ ...idle, enabled: v })} labelText="Ligar conversa parada" />
          </div>
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: idle.enabled ? 1 : 0.6 }}>
          <Card>
            <Title Icon={Hourglass} title="Quando avisar" help="Conta a partir da última resposta da equipe." />
            <label style={label}>Sem resposta do cliente por</label>
            <select style={{ ...input, width: 180 }} value={idle.hours} onChange={e => setIdle({ ...idle, hours: parseInt(e.target.value) })}>
              {[1, 2, 4, 6, 12, 23].map(h => <option key={h} value={h}>{h} {h === 1 ? 'hora' : 'horas'}</option>)}
            </select>
            <p style={hint}>No máximo 23 horas: depois de 24 horas o WhatsApp não deixa mandar texto livre.</p>
          </Card>
          <Card>
            <Title Icon={MessageSquareText} title="Mensagem" help="O texto que o cliente recebe." />
            {textarea(idle.message, v => setIdle({ ...idle, message: v }), 3)}
          </Card>
          <Card>
            <Title Icon={Clock} title="Regras" />
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: BRAND.muted, lineHeight: 1.7 }}>
              <li>Só envia no horário de atendimento da escola. Fora dele, espera abrir.</li>
              <li>Não envia em feriado ou data especial em que a escola está fechada.</li>
              <li>Uma vez por conversa. Se o cliente voltar e a conversa parar de novo, avisa de novo.</li>
              <li>Não fecha a conversa. Só avisa.</li>
            </ul>
          </Card>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SaveButton text="Salvar conversa parada" saving={savingKey === 'parada'} saved={savedKey === 'parada'} onClick={saveIdle} />
          <GhostButton onClick={() => setIdle(IDLE_DEFAULTS)}>Voltar ao padrão</GhostButton>
        </div>
      </div>
      <aside style={{ flex: '0 1 340px', minWidth: 250 }}>
        <div style={{ background: '#E7F0E8', borderRadius: 18, padding: 16, border: `1px solid ${BRAND.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#3F5F46', marginBottom: 10 }}><Smartphone size={14} /> Como o cliente vê</div>
          <div style={bub(false)}>Qual o valor da mensalidade do 5º ano?</div>
          <div style={bub(true)}>Olá! A mensalidade do 5º ano é R$ 780,00. Posso te enviar a proposta?</div>
          <div style={{ fontSize: 11, color: '#3F5F46', textAlign: 'center', margin: '6px 0' }}>… {idle.hours} {idle.hours === 1 ? 'hora' : 'horas'} sem resposta</div>
          <div style={bub(true)}>{idle.message}</div>
        </div>
      </aside>
    </div>
  )

  const datas = <SpecialDatesSettings institutionId={institutionId} horarioTxt={horarioTxt} onChanged={setSpecialCount} />

  const modelos = <TemplatesSettings institutionId={institutionId} />
  const alertas = <AlertsSettings value={alerts} onChange={setAlerts} saving={savingKey === 'alertas'} saved={savedKey === 'alertas'} onSave={() => saveFlow('alertas', { alerts_config: alerts })} />

  const sequencia = <LeadSequenceSettings institutionId={institutionId} />

  const content: Record<string, React.ReactNode> = { sequencia, conexao, automacoes, datas, horario, respostas, equipe, bloqueios, etiquetas, pesquisa, parada, modelos, alertas }

  return (
    <>
      {showFlowEditor && <FlowEditor institutionId={institutionId} onClose={() => { setShowFlowEditor(false); loadConfig() }} />}
      {view === 'inicio' || !info || !content[view] ? home : (
        <div key={view} className="aion-slide" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <BackHeader backLabel="WhatsApp" onBack={goHome} title={info.label} help={info.desc} />
          {content[view]}
        </div>
      )}

      {showGroupForm && (
        <div onClick={() => setShowGroupForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,43,74,.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 22, width: 'min(420px, 100%)', boxShadow: '0 30px 80px rgba(26,43,74,.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink, marginBottom: 14 }}>{editingGroup ? 'Editar grupo' : 'Novo grupo'}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={groupForm.emoji} onChange={e => setGroupForm(f => ({ ...f, emoji: e.target.value }))} style={{ ...input, width: 56, textAlign: 'center', fontSize: 20 }} maxLength={2} />
              <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do grupo (ex.: Secretaria)" style={input} />
            </div>
            <label style={label}>Membros do grupo</label>
            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
              {flowUsers.map(user => (
                <label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13.5, color: BRAND.ink }}>
                  <input type="checkbox" checked={groupForm.member_ids.includes(user.id)}
                    onChange={e => setGroupForm(f => ({ ...f, member_ids: e.target.checked ? [...f.member_ids, user.id] : f.member_ids.filter(id => id !== user.id) }))} />
                  {user.full_name}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhostButton onClick={() => setShowGroupForm(false)}>Cancelar</GhostButton>
              <SaveButton text={editingGroup ? 'Salvar' : 'Criar'} onClick={async () => {
                if (!groupForm.name.trim()) return
                if (editingGroup) {
                  const { data } = await supabase.from('whatsapp_groups').update({ name: groupForm.name, emoji: groupForm.emoji, member_ids: groupForm.member_ids }).eq('id', editingGroup.id).select().single()
                  if (data) setGroups(prev => prev.map(g => (g.id === editingGroup.id ? (data as any) : g)))
                } else {
                  const { data } = await supabase.from('whatsapp_groups').insert({ institution_id: institutionId, name: groupForm.name, emoji: groupForm.emoji, member_ids: groupForm.member_ids }).select().single()
                  if (data) setGroups(prev => [...prev, data as any])
                }
                setShowGroupForm(false)
              }} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
