import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import SuperAdminLayout from './SuperAdminLayout'
import AionInboxHub from './AionInboxHub'
import FlowEditor from '../whatsapp/FlowEditor'
import {
  Settings, MessageCircle, GitBranch, QrCode, Megaphone,
  Plus, Trash2, Copy, Check, ToggleLeft, ToggleRight, Save, Loader2,
  TrendingUp, Users, Clock, Edit2, Send, AlertCircle, X,
  Search, Upload, Download, FileText, Radio, ChevronRight, UserX,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AionFlow {
  id: string
  name: string
  is_active: boolean
  bot_enabled: boolean
  bot_flow: { nodes: unknown[]; edges: unknown[] }
  welcome_message: string
  off_hours_message: string
  working_days: string[]
  working_start: string
  working_end: string
  default_assignee_id?: string | null
  satisfaction_enabled?: boolean
  satisfaction_message?: string
}

interface AionKeyword {
  id: string
  keyword: string
  label: string
  description: string | null
  auto_response: string | null
  tag: string | null
  source: string
  create_lead: boolean
  whatsapp_link: string
  is_active: boolean
  created_at: string
}

interface RaioXLead {
  id: string
  name: string
  phone: string
  email: string
  school_name: string
  created_at: string
}

interface ConsultantUser {
  id: string
  full_name: string
  email: string
}

type Tab = 'inbox' | 'flow' | 'qrcodes' | 'contacts' | 'broadcasts' | 'settings'

const DAYS = [
  { key: 'MON', label: 'Seg' },
  { key: 'TUE', label: 'Ter' },
  { key: 'WED', label: 'Qua' },
  { key: 'THU', label: 'Qui' },
  { key: 'FRI', label: 'Sex' },
  { key: 'SAT', label: 'Sáb' },
  { key: 'SUN', label: 'Dom' },
]

// ─── SettingsTab ──────────────────────────────────────────────────────────────

function SettingsTab({ aionPlatformId }: { aionPlatformId: string }) {
  const [flow, setFlow]           = useState<AionFlow | null>(null)
  const [consultants, setConsultants] = useState<ConsultantUser[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('aion_flows')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setFlow(data as AionFlow | null)),
      supabase
        .from('users')
        .select('id, full_name, email')
        .or('role.eq.consultant,role.eq.admin_geral,role.eq.superadmin,user_type.eq.consultant')
        .then(({ data }) => setConsultants((data as ConsultantUser[]) ?? [])),
    ]).then(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!flow) return
    setSaving(true)
    await supabase
      .from('aion_flows')
      .update({
        is_active:              flow.is_active,
        bot_enabled:            flow.bot_enabled,
        welcome_message:        flow.welcome_message,
        off_hours_message:      flow.off_hours_message,
        working_days:           flow.working_days,
        working_start:          flow.working_start,
        working_end:            flow.working_end,
        default_assignee_id:    flow.default_assignee_id ?? null,
        satisfaction_enabled:   flow.satisfaction_enabled ?? false,
        satisfaction_message:   flow.satisfaction_message ?? '',
        updated_at:             new Date().toISOString(),
      })
      .eq('id', flow.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const toggleDay = (key: string) => {
    if (!flow) return
    const days = flow.working_days.includes(key)
      ? flow.working_days.filter(d => d !== key)
      : [...flow.working_days, key]
    setFlow({ ...flow, working_days: days })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Loader2 style={{ width: 28, height: 28, color: '#00A896', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (!flow) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
        Nenhuma configuração encontrada. Execute a migration no Supabase primeiro.
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0',
    borderRadius: 8, fontSize: 14, color: '#1A2B4A', background: '#fff',
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block',
  }
  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '18px 20px', marginBottom: 16,
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px' }}>

      {/* Header toggles */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {([
          { key: 'is_active',   label: 'Fluxo Ativo',      desc: 'Ativa o processamento de fluxo' },
          { key: 'bot_enabled', label: 'Bot Habilitado',    desc: 'Responde mensagens automaticamente' },
        ] as const).map(({ key, label, desc }) => (
          <div key={key}
            style={{ flex: 1, ...cardStyle, marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setFlow({ ...flow, [key]: !flow[key] })}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{label}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{desc}</div>
            </div>
            {flow[key]
              ? <ToggleRight style={{ width: 32, height: 32, color: '#00A896' }} />
              : <ToggleLeft  style={{ width: 32, height: 32, color: '#94A3B8' }} />}
          </div>
        ))}
      </div>

      {/* Mensagem de boas-vindas */}
      <div style={cardStyle}>
        <label style={labelStyle}>Mensagem de Boas-Vindas</label>
        <textarea
          value={flow.welcome_message}
          onChange={e => setFlow({ ...flow, welcome_message: e.target.value })}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
        />
      </div>

      {/* Mensagem fora do horário */}
      <div style={cardStyle}>
        <label style={labelStyle}>Mensagem Fora do Horário</label>
        <textarea
          value={flow.off_hours_message}
          onChange={e => setFlow({ ...flow, off_hours_message: e.target.value })}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
        />
      </div>

      {/* Horário de atendimento */}
      <div style={cardStyle}>
        <label style={labelStyle}>Horário de Atendimento</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {DAYS.map(d => (
            <button key={d.key} onClick={() => toggleDay(d.key)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: '1.5px solid',
                borderColor: flow.working_days.includes(d.key) ? '#00A896' : '#E2E8F0',
                background: flow.working_days.includes(d.key) ? '#E6F7F5' : '#F8FAFC',
                color: flow.working_days.includes(d.key) ? '#00A896' : '#64748B',
                cursor: 'pointer',
              }}>
              {d.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, marginBottom: 4 }}>Início</label>
            <input type="time" value={flow.working_start}
              onChange={e => setFlow({ ...flow, working_start: e.target.value })}
              style={{ ...inputStyle }} />
          </div>
          <div style={{ paddingTop: 20, color: '#94A3B8', fontSize: 18 }}>–</div>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, marginBottom: 4 }}>Fim</label>
            <input type="time" value={flow.working_end}
              onChange={e => setFlow({ ...flow, working_end: e.target.value })}
              style={{ ...inputStyle }} />
          </div>
        </div>
      </div>

      {/* Atendente padrão */}
      <div style={cardStyle}>
        <label style={labelStyle}>Atendente Padrão para Novas Conversas</label>
        <select value={flow.default_assignee_id || ''}
          onChange={e => setFlow({ ...flow, default_assignee_id: e.target.value || null })}
          style={inputStyle}>
          <option value="">— Nenhum (sem atribuição automática) —</option>
          {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      {/* Pesquisa de satisfação */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Pesquisa de Satisfação</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Enviar mensagem ao concluir atendimento</div>
          </div>
          <div onClick={() => setFlow({ ...flow, satisfaction_enabled: !flow.satisfaction_enabled })} style={{ cursor: 'pointer' }}>
            {flow.satisfaction_enabled
              ? <ToggleRight style={{ width: 28, height: 28, color: '#00A896' }} />
              : <ToggleLeft  style={{ width: 28, height: 28, color: '#94A3B8' }} />}
          </div>
        </div>
        {flow.satisfaction_enabled && (
          <textarea
            value={flow.satisfaction_message || ''}
            onChange={e => setFlow({ ...flow, satisfaction_message: e.target.value })}
            rows={3}
            placeholder="Ex: Como foi seu atendimento? Responda de 1 a 5."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
          />
        )}
      </div>

      {/* Respostas Rápidas */}
      <QuickRepliesSection institutionId={aionPlatformId} />

      {/* Salvar */}
      <button onClick={save} disabled={saving}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 24px', background: saved ? '#10B981' : '#00A896',
          color: '#fff', fontSize: 14, fontWeight: 700, borderRadius: 10,
          border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1, transition: 'background 0.2s',
        }}>
        {saving ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
          : saved  ? <Check style={{ width: 16, height: 16 }} />
          : <Save  style={{ width: 16, height: 16 }} />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar Configurações'}
      </button>
    </div>
  )
}

// ─── QuickRepliesSection ─────────────────────────────────────────────────────
// Reaproveita whatsapp_quick_replies (mesma tabela do lado escola —
// WhatsAppHub.tsx / SystemSettings.tsx) usando platform_whatsapp.id como
// pseudo-institution_id, igual o FlowEditor já faz com whatsapp_flows.
// Ver migration 20260802000100_whatsapp_quick_replies_aion_inbox.sql pro
// motivo de precisar de policies de RLS adicionais pra isso funcionar.

interface AionQuickReply {
  id: string
  title: string
  message: string
  shortcut: string | null
  order_index: number
}

const EMPTY_QR = { title: '', message: '', shortcut: '' }

function QuickRepliesSection({ institutionId }: { institutionId: string }) {
  const [items, setItems]         = useState<AionQuickReply[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_QR })
  const [saving, setSaving]       = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('whatsapp_quick_replies')
      .select('id, title, message, shortcut, order_index')
      .eq('institution_id', institutionId)
      .order('order_index', { ascending: true })
    setItems((data as AionQuickReply[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { if (institutionId) load() }, [institutionId])

  const startNew = () => { setEditingId(null); setForm({ ...EMPTY_QR }); setShowForm(true) }
  const startEdit = (item: AionQuickReply) => {
    setEditingId(item.id)
    setForm({ title: item.title, message: item.message, shortcut: item.shortcut || '' })
    setShowForm(true)
  }
  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_QR }) }

  const saveItem = async () => {
    if (!form.title.trim() || !form.message.trim()) return
    setSaving(true)
    const shortcut = form.shortcut.trim()
      ? (form.shortcut.trim().startsWith('/') ? form.shortcut.trim() : `/${form.shortcut.trim()}`)
      : null
    if (editingId) {
      await supabase.from('whatsapp_quick_replies')
        .update({ title: form.title.trim(), message: form.message.trim(), shortcut, updated_at: new Date().toISOString() })
        .eq('id', editingId)
    } else {
      await supabase.from('whatsapp_quick_replies').insert({
        institution_id: institutionId,
        title:          form.title.trim(),
        message:        form.message.trim(),
        shortcut,
        order_index:    items.length,
      })
    }
    cancelForm()
    setSaving(false)
    await load()
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Excluir esta resposta rápida?')) return
    await supabase.from('whatsapp_quick_replies').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0',
    borderRadius: 8, fontSize: 14, color: '#1A2B4A', background: '#fff',
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
  }

  return (
    <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Respostas Rápidas</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Mensagens prontas pra inserir na conversa com um clique</div>
        </div>
        <button onClick={startNew}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <Plus style={{ width: 16, height: 16 }} /> Nova Resposta
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', marginBottom: 16 }}>
            {editingId ? 'Editar Resposta' : 'Nova Resposta'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Título *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Boas-vindas" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Atalho</label>
              <input value={form.shortcut} onChange={e => setForm({ ...form, shortcut: e.target.value })}
                placeholder="/oi" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Mensagem *</label>
            <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
              rows={3} placeholder="Texto que será inserido na conversa"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={saveItem} disabled={saving || !form.title.trim() || !form.message.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: '#00A896', color: '#fff',
                fontSize: 13, fontWeight: 700, borderRadius: 9, border: 'none',
                cursor: (saving || !form.title.trim() || !form.message.trim()) ? 'not-allowed' : 'pointer',
                opacity: (saving || !form.title.trim() || !form.message.trim()) ? 0.6 : 1,
              }}>
              {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Check style={{ width: 14, height: 14 }} />}
              {editingId ? 'Salvar alterações' : 'Salvar'}
            </button>
            <button onClick={cancelForm}
              style={{ padding: '9px 16px', background: '#F1F5F9', color: '#64748B', fontSize: 13, fontWeight: 600, borderRadius: 9, border: 'none', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Loader2 style={{ width: 22, height: 22, color: '#00A896', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : items.length === 0 ? (
        !showForm && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 13 }}>
            Nenhuma resposta rápida cadastrada ainda.
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => (
            <div key={item.id}
              style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{item.title}</span>
                  {item.shortcut && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#00A896', background: '#E6F7F5', padding: '1px 8px', borderRadius: 20 }}>{item.shortcut}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.message}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={() => startEdit(item)} title="Editar"
                  style={{ width: 30, height: 30, border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 style={{ width: 13, height: 13, color: '#64748B' }} />
                </button>
                <button onClick={() => deleteItem(item.id)} title="Excluir"
                  style={{ width: 30, height: 30, border: '1.5px solid #FEE2E2', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 style={{ width: 13, height: 13, color: '#EF4444' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CampaignsTab ───────────────────────────────────────────────────────────────

const EMPTY_KW = { keyword: '', label: '', description: '', auto_response: '', tag: '', source: 'whatsapp', create_lead: true }

// Rastreio de lead por campanha: não existe FK entre crm_leads e aion_keywords —
// o webhook (api/whatsapp/webhook.ts) grava a origem só como texto livre em
// crm_leads.notes ("Veio via QR Code: {label}"). É o único jeito confiável de
// ligar um lead a uma keyword específica hoje (origin repete o mesmo valor de
// keyword.source entre keywords diferentes, e a tag fica só na conversa, não no lead).
const CAMPAIGN_NOTE_PREFIX = 'Veio via QR Code:'

type Period = 'today' | '7d' | '30d' | 'all'
const PERIOD_LABELS: Record<Period, string> = { today: 'Hoje', '7d': '7 dias', '30d': '30 dias', all: 'Tudo' }

function periodCutoffIso(period: Period): string | null {
  if (period === 'all') return null
  const d = new Date()
  if (period === 'today') { d.setHours(0, 0, 0, 0); return d.toISOString() }
  if (period === '7d') { d.setDate(d.getDate() - 7); return d.toISOString() }
  d.setDate(d.getDate() - 30)
  return d.toISOString()
}

function CampaignsTab() {
  const [keywords, setKeywords]   = useState<AionKeyword[]>([])
  const [aionTags, setAionTags]   = useState<{id:string;name:string;color:string}[]>([])
  const [campaignLeads, setCampaignLeads] = useState<{ notes: string; created_at: string }[]>([])
  // Raio-X Estratégico (landing page INEP) é uma origem de lead separada das
  // keywords de QR Code acima — crm_leads.origin='raio_x_inep', sem o prefixo
  // "Veio via QR Code:" em notes, então nunca batia com keywordStats. Contado
  // à parte, no card dedicado abaixo (ver "Raio-X Estratégico"), com lista
  // individual de leads + reenvio manual do fluxo da Fase B.
  const [raioXLeads, setRaioXLeads] = useState<RaioXLead[]>([])
  // ids de crm_leads que já têm conversa registrada (whatsapp_conversations
  // com aion_lead_id = lead.id) — indica quem já foi "atendido" pelo fluxo
  // automático (raio-x-followup) vs. casos antigos de antes da Fase B.
  const [linkedLeadIds, setLinkedLeadIds] = useState<Set<string>>(new Set())
  const [period, setPeriod]       = useState<Period>('30d')
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_KW })
  const [saving, setSaving]       = useState(false)
  const [copiedId, setCopiedId]   = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4500)
  }

  const load = async () => {
    const [{ data: kws }, { data: tags }, { data: leads }, { data: raioX }, { data: linkedConvs }] = await Promise.all([
      supabase.from('aion_keywords').select('*').order('created_at', { ascending: false }),
      supabase.from('aion_tags').select('*').order('name'),
      supabase.from('crm_leads').select('notes, created_at').ilike('notes', `${CAMPAIGN_NOTE_PREFIX}%`),
      supabase.from('crm_leads').select('id, name, phone, email, school_name, created_at').eq('origin', 'raio_x_inep').order('created_at', { ascending: false }),
      supabase.from('whatsapp_conversations').select('aion_lead_id').eq('is_aion_inbox', true).not('aion_lead_id', 'is', null),
    ])
    setKeywords((kws as AionKeyword[]) ?? [])
    setAionTags(tags ?? [])
    setCampaignLeads((leads as { notes: string; created_at: string }[]) ?? [])
    setRaioXLeads((raioX as RaioXLead[]) ?? [])
    setLinkedLeadIds(new Set((linkedConvs ?? []).map((c: any) => c.aion_lead_id as string)))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Contagem/última-vez por keyword — comparação exata contra o texto que o
  // webhook grava (Veio via QR Code: {label}), não substring, pra um label não
  // "vazar" contagem de outro que o contenha como prefixo.
  const keywordStats = keywords.map(kw => {
    const expected = `${CAMPAIGN_NOTE_PREFIX} ${kw.label}`
    const matches  = campaignLeads.filter(l => l.notes === expected)
    const lastUsed = matches.length
      ? matches.reduce((max, l) => (l.created_at > max ? l.created_at : max), matches[0].created_at)
      : null
    return { keyword: kw, count: matches.length, lastUsed }
  })

  const cutoff = periodCutoffIso(period)
  const totalInPeriod = campaignLeads.filter(l => !cutoff || l.created_at >= cutoff).length

  const raioXInPeriod = raioXLeads.filter(l => !cutoff || l.created_at >= cutoff).length
  const raioXLastUsed = raioXLeads.length
    ? raioXLeads.reduce((max, l) => (l.created_at > max ? l.created_at : max), raioXLeads[0].created_at)
    : null

  const copyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const saveKeyword = async () => {
    if (!form.keyword.trim() || !form.label.trim()) return
    setSaving(true)
    await supabase.from('aion_keywords').insert({
      keyword:       form.keyword.trim().toUpperCase(),
      label:         form.label.trim(),
      description:   form.description.trim() || null,
      auto_response: form.auto_response.trim() || null,
      tag:           form.tag.trim() || null,
      source:        form.source || 'whatsapp',
      create_lead:   form.create_lead,
      is_active:     true,
    })
    setForm({ ...EMPTY_KW })
    setShowForm(false)
    setSaving(false)
    await load()
  }

  const toggleActive = async (kw: AionKeyword) => {
    await supabase.from('aion_keywords').update({ is_active: !kw.is_active }).eq('id', kw.id)
    setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, is_active: !k.is_active } : k))
  }

  const deleteKeyword = async (id: string) => {
    if (!confirm('Excluir esta keyword?')) return
    await supabase.from('aion_keywords').delete().eq('id', id)
    setKeywords(prev => prev.filter(k => k.id !== id))
  }

  // Chama a Edge Function raio-x-followup manualmente pra um lead específico
  // — mesmo payload que raio-x-lead/index.ts monta automaticamente ao criar
  // o lead. A function já faz find-or-create em whatsapp_conversations (por
  // remote_jid + is_aion_inbox), então reenviar pra quem já tem conversa só
  // atualiza a conversa existente e insere uma nova mensagem — não duplica.
  const handleResend = async (lead: RaioXLead) => {
    setResendingId(lead.id)
    try {
      const { data, error } = await supabase.functions.invoke('raio-x-followup', {
        body: {
          leadId: lead.id,
          director_name: lead.name,
          phone: lead.phone,
          email: lead.email,
          school_name: lead.school_name,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      showToast(`Reenviado para ${lead.name}!`, true)
      await load()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao reenviar.', false)
    } finally {
      setResendingId(null)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0',
    borderRadius: 8, fontSize: 14, color: '#1A2B4A', background: '#fff',
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
  }

  return (
    <div style={{ padding: '24px 24px' }}>
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
          ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
          <button onClick={() => setToast(null)}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
        </div>
      )}

      {/* Métricas de campanha */}
      <div style={{ marginBottom: 28 }}>
        {/* Resumo geral (QR Code) + seletor de período — sempre visível,
            independente de haver keywords cadastradas (antes ficava dentro do
            "keywords.length === 0" e sumia junto com o card do Raio-X abaixo). */}
        <div style={{
          background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: '20px 22px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, background: '#E6F7F5', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TrendingUp style={{ width: 22, height: 22, color: '#00A896' }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1A2B4A', lineHeight: 1 }}>{totalInPeriod}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                lead{totalInPeriod === 1 ? '' : 's'} captado{totalInPeriod === 1 ? '' : 's'} via QR Code — {PERIOD_LABELS[period]}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 3 }}>
            {(['today', '7d', '30d', 'all'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: period === p ? '#00A896' : 'transparent', color: period === p ? '#fff' : '#64748B',
                }}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Raio-X Estratégico (landing INEP) — origem separada das keywords de
            QR Code, contada direto por crm_leads.origin='raio_x_inep'. */}
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, maxWidth: 260 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', flex: 1 }}>Raio-X Estratégico</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#00A896', background: '#E6F7F5', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>INEP</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Users style={{ width: 13, height: 13, color: '#94A3B8' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{raioXInPeriod}</span>
            <span style={{ fontSize: 12, color: '#64748B' }}>lead{raioXInPeriod === 1 ? '' : 's'} — {PERIOD_LABELS[period]}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: raioXLeads.length ? 14 : 0 }}>
            <Clock style={{ width: 13, height: 13, color: '#94A3B8' }} />
            <span style={{ fontSize: 12, color: '#64748B' }}>
              {raioXLastUsed ? `Última vez: ${new Date(raioXLastUsed).toLocaleDateString('pt-BR')}` : 'Nenhum lead ainda'}
            </span>
          </div>

          {/* Lista de leads — quem já tem conversa em whatsapp_conversations
              (aion_lead_id) foi atendido pelo fluxo automático (raio-x-followup);
              quem não tem é caso antigo, de antes da Fase B existir. */}
          {raioXLeads.length > 0 && (
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    {['Nome', 'Telefone', 'E-mail', 'Escola', 'Cadastro', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {raioXLeads.map(lead => {
                    const attended = linkedLeadIds.has(lead.id)
                    const isResending = resendingId === lead.id
                    return (
                      <tr key={lead.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', color: '#1A2B4A', fontWeight: 600, whiteSpace: 'nowrap' }}>{lead.name}</td>
                        <td style={{ padding: '8px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{lead.phone}</td>
                        <td style={{ padding: '8px 10px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</td>
                        <td style={{ padding: '8px 10px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.school_name}</td>
                        <td style={{ padding: '8px 10px', color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                            background: attended ? '#D1FAE5' : '#FEF3C7', color: attended ? '#059669' : '#B45309',
                          }}>
                            {attended ? 'Atendido' : 'Pendente'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => handleResend(lead)} disabled={isResending}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8,
                              fontSize: 12, fontWeight: 700, border: '1px solid #A7F3D0', cursor: isResending ? 'default' : 'pointer',
                              background: isResending ? '#F1F5F9' : '#E6F7F5', color: isResending ? '#94A3B8' : '#00523C',
                            }}>
                            {isResending
                              ? <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} />
                              : <Send style={{ width: 12, height: 12 }} />}
                            {isResending ? 'Enviando...' : (attended ? 'Reenviar' : 'Enviar')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Por keyword */}
        {keywords.length === 0 ? (
          <div style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', borderRadius: 14, padding: '32px 24px', textAlign: 'center' }}>
            <Megaphone style={{ width: 32, height: 32, color: '#94A3B8', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', marginBottom: 4 }}>Nenhuma keyword de QR Code cadastrada ainda</div>
            <div style={{ fontSize: 13, color: '#64748B', maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
              Cada keyword abaixo vira uma campanha rastreável: gere o link/QR code, divulgue,
              e acompanhe aqui quantos leads ela trouxe e quando foi usada pela última vez.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {keywordStats.map(({ keyword, count, lastUsed }) => (
              <div key={keyword.id} style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {keyword.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#00A896', background: '#E6F7F5', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>
                    {keyword.keyword}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Users style={{ width: 13, height: 13, color: '#94A3B8' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{count}</span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>lead{count === 1 ? '' : 's'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock style={{ width: 13, height: 13, color: '#94A3B8' }} />
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    {lastUsed ? `Última vez: ${new Date(lastUsed).toLocaleDateString('pt-BR')}` : 'Ainda não usada'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>Keywords de Campanha</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Cada keyword gera um link/QR Code para o WhatsApp da Áion</div>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
          <Plus style={{ width: 16, height: 16 }} /> Nova Keyword
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: '20px 22px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', marginBottom: 16 }}>Nova Keyword</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Keyword *</label>
              <input value={form.keyword} onChange={e => setForm({ ...form, keyword: e.target.value.toUpperCase() })}
                placeholder="Ex: CURSO2025" style={inputStyle} />
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                Link: wa.me/5583993444383?text={form.keyword || 'KEYWORD'}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Rótulo *</label>
              <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="Ex: Campanha Curso 2025" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Resposta Automática</label>
              <input value={form.auto_response} onChange={e => setForm({ ...form, auto_response: e.target.value })}
                placeholder="Mensagem enviada ao detectar keyword" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tag</label>
              {aionTags.length > 0 ? (
                <select value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} style={inputStyle}>
                  <option value="">— Nenhuma —</option>
                  {aionTags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              ) : (
                <input value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })}
                  placeholder="Ex: campanha, evento" style={inputStyle} />
              )}
            </div>
            <div>
              <label style={labelStyle}>Fonte</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} style={inputStyle}>
                <option value="whatsapp">WhatsApp</option>
                <option value="qrcode">QR Code</option>
                <option value="link">Link</option>
                <option value="evento">Evento</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
              <input type="checkbox" id="create_lead" checked={form.create_lead}
                onChange={e => setForm({ ...form, create_lead: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: '#00A896' }} />
              <label htmlFor="create_lead" style={{ fontSize: 13, color: '#1A2B4A', cursor: 'pointer' }}>
                Criar lead automaticamente
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={saveKeyword} disabled={saving || !form.keyword.trim() || !form.label.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, borderRadius: 9, border: 'none', cursor: (saving || !form.keyword.trim() || !form.label.trim()) ? 'not-allowed' : 'pointer', opacity: (saving || !form.keyword.trim() || !form.label.trim()) ? 0.6 : 1 }}>
              {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Check style={{ width: 14, height: 14 }} />}
              Salvar
            </button>
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_KW }) }}
              style={{ padding: '9px 16px', background: '#F1F5F9', color: '#64748B', fontSize: 13, fontWeight: 600, borderRadius: 9, border: 'none', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 style={{ width: 28, height: 28, color: '#00A896', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : keywords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: 14 }}>
          Nenhuma keyword cadastrada ainda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {keywords.map(kw => (
            <div key={kw.id}
              style={{ background: '#fff', border: `1.5px solid ${kw.is_active ? '#E2E8F0' : '#F1F5F9'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 16, opacity: kw.is_active ? 1 : 0.55 }}>
              <div style={{ width: 40, height: 40, background: '#E6F7F5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <QrCode style={{ width: 20, height: 20, color: '#00A896' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>{kw.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#00A896', background: '#E6F7F5', padding: '2px 8px', borderRadius: 20 }}>{kw.keyword}</span>
                  {kw.tag && (
                    <span style={{ fontSize: 11, color: '#6366F1', background: '#EEF2FF', padding: '2px 8px', borderRadius: 20 }}>
                      {kw.tag}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20 }}>{kw.source}</span>
                </div>
                {kw.auto_response && (
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                    Resposta: {kw.auto_response}
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                  <span style={{ fontFamily: 'monospace' }}>{kw.whatsapp_link}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={() => copyLink(kw.whatsapp_link, kw.id)} title="Copiar link"
                  style={{ width: 34, height: 34, border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {copiedId === kw.id ? <Check style={{ width: 15, height: 15, color: '#10B981' }} /> : <Copy style={{ width: 15, height: 15, color: '#64748B' }} />}
                </button>
                <button onClick={() => toggleActive(kw)} title={kw.is_active ? 'Desativar' : 'Ativar'}
                  style={{ width: 34, height: 34, border: '1.5px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {kw.is_active ? <ToggleRight style={{ width: 16, height: 16, color: '#00A896' }} /> : <ToggleLeft style={{ width: 16, height: 16, color: '#94A3B8' }} />}
                </button>
                <button onClick={() => deleteKeyword(kw.id)} title="Excluir"
                  style={{ width: 34, height: 34, border: '1.5px solid #FEE2E2', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 style={{ width: 15, height: 15, color: '#EF4444' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ContactsTab ──────────────────────────────────────────────────────────────

interface AionContact {
  id: string
  phone: string
  name: string | null
  email: string | null
  notes: string | null
  tags: string[]
  source: string
  conversation_id: string | null
  aion_lead_id: string | null
  opted_out: boolean
  created_at: string
}

type WaTag = { id: string; name: string; color: string }

// Contatos do Inbox Áion são sempre BR (mesma suposição já feita por
// raio-x-followup/index.ts:toRemoteJid — formulário/CSV normalmente vêm sem o
// 55 na frente). Guarda o telefone já no formato de remote_jid, pra permitir
// join direto com whatsapp_conversations.remote_jid sem coluna separada.
function normalizeContactPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (!digits.startsWith('55')) digits = `55${digits}`
  if (digits.length === 12) digits = digits.slice(0, 4) + '9' + digits.slice(4)
  return digits
}

function formatContactPhone(phone: string): string {
  const d = phone.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

// Vínculo automático — mesmo padrão de busca usado em
// api/whatsapp/webhook.ts:detectAionQueue (crm_leads.phone via ilike, já que
// não há um formato único garantido lá).
async function autoLinkContact(phone: string): Promise<{ conversation_id: string | null; aion_lead_id: string | null }> {
  const localDigits = phone.replace(/^55/, '')
  const [{ data: conv }, { data: lead }] = await Promise.all([
    supabase.from('whatsapp_conversations').select('id').eq('remote_jid', phone).eq('is_aion_inbox', true).maybeSingle(),
    supabase.from('crm_leads').select('id').ilike('phone', `%${localDigits}%`).maybeSingle(),
  ])
  return { conversation_id: (conv as any)?.id || null, aion_lead_id: (lead as any)?.id || null }
}

const CONTACTS_PAGE_SIZE = 50

function ContactsTab({ aionPlatformId }: { aionPlatformId: string }) {
  const { user } = useAuth()

  const [contacts, setContacts]   = useState<AionContact[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterTag, setFilterTag] = useState('all')
  const [availTags, setAvailTags] = useState<WaTag[]>([])

  const [showAddModal, setShowAddModal]       = useState(false)
  const [addForm, setAddForm]                 = useState({ phone: '', name: '', email: '', notes: '' })
  const [addSaving, setAddSaving]              = useState(false)
  const [addError, setAddError]                = useState('')

  const [showImportModal, setShowImportModal] = useState(false)
  const [importRows, setImportRows]           = useState<{ nome: string; telefone: string; email: string }[]>([])
  const [importErrors, setImportErrors]       = useState<string[]>([])
  const [importResult, setImportResult]       = useState<{ imported: number; duplicates: number } | null>(null)
  const [importLoading, setImportLoading]     = useState(false)

  const [editingContact, setEditingContact]   = useState<AionContact | null>(null)
  const [editSaving, setEditSaving]           = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0',
    borderRadius: 8, fontSize: 14, color: '#1A2B4A', background: '#fff',
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block',
  }

  async function loadTags() {
    if (!aionPlatformId) return
    const { data } = await supabase.from('whatsapp_tags').select('id, name, color').eq('institution_id', aionPlatformId).order('name')
    setAvailTags((data as WaTag[]) ?? [])
  }

  async function load() {
    setLoading(true)
    let query = supabase.from('aion_contacts').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(CONTACTS_PAGE_SIZE)
    if (search.trim().length >= 2) {
      query = query.or(`name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`)
    }
    if (filterTag !== 'all') {
      query = (query as any).filter('tags', 'cs', `["${filterTag}"]`)
    }
    const { data, error, count } = await query
    if (error) { console.error('aion_contacts load error:', error); setLoading(false); return }
    setContacts(((data as any[]) ?? []).map(c => ({ ...c, tags: c.tags ?? [] })) as AionContact[])
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => { loadTags() }, [aionPlatformId])
  useEffect(() => { load() }, [filterTag])
  useEffect(() => {
    const t = setTimeout(() => load(), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // ── Adicionar contato manual ──────────────────────────────
  async function handleAddContact() {
    const phone = normalizeContactPhone(addForm.phone)
    if (!phone || phone.length < 12) { setAddError('Telefone inválido.'); return }
    setAddSaving(true)
    setAddError('')
    try {
      const { conversation_id, aion_lead_id } = await autoLinkContact(phone)
      const { error } = await supabase.from('aion_contacts').insert({
        phone,
        name: addForm.name.trim() || null,
        email: addForm.email.trim() || null,
        notes: addForm.notes.trim() || null,
        source: 'manual',
        conversation_id,
        aion_lead_id,
        created_by: user?.id || null,
      })
      if (error) throw error
      setShowAddModal(false)
      setAddForm({ phone: '', name: '', email: '', notes: '' })
      load()
    } catch (e: any) {
      setAddError(e?.code === '23505' ? 'Já existe um contato com esse telefone.' : (e?.message || 'Erro ao adicionar contato.'))
    } finally {
      setAddSaving(false)
    }
  }

  // ── Import CSV — mesmo padrão de ContactsModule.tsx (FileReader +
  // parser manual + preview + dedup por telefone) ──────────
  function downloadTemplate() {
    const csv  = '﻿' + 'nome,telefone,email\nJoão Silva,83999998888,joao@email.com\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'template-contatos-aion.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let cur = ''; let inQ = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
      else if (line[i] === ',' && !inQ) { result.push(cur.trim()); cur = '' }
      else cur += line[i]
    }
    result.push(cur.trim())
    return result
  }

  function parseCSV(text: string): { nome: string; telefone: string; email: string }[] {
    const lines  = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
    if (lines.length < 2) return []
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const idx    = (col: string) => header.indexOf(col)
    const [ni, ti, ei] = [idx('nome'), idx('telefone'), idx('email')]
    return lines.slice(1).map(line => {
      const cols = parseCSVLine(line)
      return {
        nome:     ni >= 0 ? cols[ni] || '' : '',
        telefone: ti >= 0 ? cols[ti] || '' : '',
        email:    ei >= 0 ? cols[ei] || '' : '',
      }
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text    = ev.target?.result as string
      const all     = parseCSV(text)
      const errors: string[] = []
      const valid   = all.filter(r => r.telefone.replace(/\D/g, '').length >= 8)
      const skipped = all.length - valid.length
      if (all.length === 0) errors.push('Nenhuma linha encontrada. Verifique se o arquivo tem a coluna "telefone".')
      if (skipped > 0)      errors.push(`${skipped} linha(s) sem telefone válido serão ignoradas.`)
      setImportRows(valid); setImportErrors(errors); setImportResult(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleImport() {
    if (!importRows.length) return
    setImportLoading(true)
    try {
      const normalized = importRows.map(r => ({ ...r, phone: normalizeContactPhone(r.telefone) }))
      const { data: existing } = await supabase.from('aion_contacts').select('phone')
      const existingPhones = new Set(((existing as any[]) ?? []).map(c => c.phone))
      const seen = new Set<string>()
      let duplicates = 0
      const toInsert: { row: typeof normalized[number] }[] = []
      for (const r of normalized) {
        if (!r.phone || r.phone.length < 12 || seen.has(r.phone) || existingPhones.has(r.phone)) { duplicates++; continue }
        seen.add(r.phone)
        toInsert.push({ row: r })
      }

      let imported = 0
      // Vínculo automático feito por linha (mesmo padrão de handleAddContact) —
      // volume esperado de uma importação manual, não um pipeline de alto volume.
      for (const { row } of toInsert) {
        const { conversation_id, aion_lead_id } = await autoLinkContact(row.phone)
        const { error } = await supabase.from('aion_contacts').insert({
          phone: row.phone,
          name: row.nome || null,
          email: row.email || null,
          source: 'csv_import',
          conversation_id,
          aion_lead_id,
          created_by: user?.id || null,
        })
        if (!error) imported++
        else if (error.code === '23505') duplicates++
      }

      setImportResult({ imported, duplicates })
      if (imported > 0) load()
    } catch (e: any) {
      setImportErrors([e?.message || 'Erro desconhecido'])
    } finally {
      setImportLoading(false)
    }
  }

  // ── Editar contato (tags multi-select + opt-out + exclusão) ──
  async function toggleContactTag(contact: AionContact, tagName: string) {
    const newTags = contact.tags.includes(tagName) ? contact.tags.filter(t => t !== tagName) : [...contact.tags, tagName]
    setEditingContact({ ...contact, tags: newTags })
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, tags: newTags } : c))
    await supabase.from('aion_contacts').update({ tags: newTags }).eq('id', contact.id)
  }

  async function toggleOptedOut(contact: AionContact) {
    const next = !contact.opted_out
    setEditingContact({ ...contact, opted_out: next })
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, opted_out: next } : c))
    await supabase.from('aion_contacts').update({ opted_out: next }).eq('id', contact.id)
  }

  async function deleteContact(contact: AionContact) {
    if (!window.confirm(`Excluir o contato "${contact.name || contact.phone}"?`)) return
    setEditSaving(true)
    await supabase.from('aion_contacts').delete().eq('id', contact.id)
    setEditSaving(false)
    setEditingContact(null)
    load()
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>Contatos do Inbox Áion</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{total} contato{total === 1 ? '' : 's'} cadastrado{total === 1 ? '' : 's'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowImportModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, borderRadius: 10, border: '1.5px solid #E2E8F0', cursor: 'pointer' }}>
            <Upload style={{ width: 15, height: 15 }} /> Importar CSV
          </button>
          <button onClick={() => { setAddForm({ phone: '', name: '', email: '', notes: '' }); setAddError(''); setShowAddModal(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
            <Plus style={{ width: 16, height: 16 }} /> Adicionar contato
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 220 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#94A3B8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..."
            style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ ...inputStyle, width: 200 }}>
          <option value="all">Todas as etiquetas</option>
          {availTags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>

      {/* Lista */}
      <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 style={{ width: 26, height: 26, color: '#00A896', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: 14 }}>
            Nenhum contato encontrado.
          </div>
        ) : (
          <div>
            {contacts.map(c => (
              <div key={c.id} onClick={() => setEditingContact(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', opacity: c.opted_out ? 0.55 : 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#3B82F6', fontWeight: 700, fontSize: 13 }}>
                  {(c.name || c.phone).slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>{c.name || formatContactPhone(c.phone)}</span>
                    {c.opted_out && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '2px 7px', borderRadius: 20 }}>
                        <UserX style={{ width: 10, height: 10 }} /> Opt-out
                      </span>
                    )}
                    {c.aion_lead_id && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: '#EDE9FE', padding: '2px 7px', borderRadius: 20 }}>Lead</span>
                    )}
                    {c.conversation_id && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#00A896', background: '#E6F7F5', padding: '2px 7px', borderRadius: 20 }}>Já conversou</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{formatContactPhone(c.phone)}{c.email ? ` · ${c.email}` : ''}</div>
                  {c.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                      {c.tags.map(tag => {
                        const color = availTags.find(t => t.name === tag)?.color || '#6366f1'
                        return (
                          <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: '#fff', background: color, padding: '2px 7px', borderRadius: 20 }}>{tag}</span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <ChevronRight style={{ width: 16, height: 16, color: '#CBD5E1', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
        {!loading && contacts.length > 0 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid #F1F5F9', fontSize: 12, color: '#94A3B8' }}>
            Mostrando {contacts.length} de {total} {total > CONTACTS_PAGE_SIZE ? '— refine a busca para ver mais' : ''}
          </div>
        )}
      </div>

      {/* Modal: Adicionar contato */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1A2B4A' }}>Adicionar contato</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Telefone *</label>
                <input value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="83999998888" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nome</label>
                <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notas</label>
                <input value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} style={inputStyle} />
              </div>
            </div>
            {addError && (
              <div style={{ marginTop: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#DC2626' }}>{addError}</div>
            )}
            <button onClick={handleAddContact} disabled={addSaving || !addForm.phone.trim()}
              style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', background: '#00A896', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: (addSaving || !addForm.phone.trim()) ? 'not-allowed' : 'pointer', opacity: (addSaving || !addForm.phone.trim()) ? 0.6 : 1 }}>
              {addSaving ? <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : <Check style={{ width: 15, height: 15 }} />}
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Modal: Importar CSV */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowImportModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1A2B4A' }}>Importar contatos</h2>
              <button onClick={() => { setShowImportModal(false); setImportRows([]); setImportErrors([]); setImportResult(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 22, lineHeight: 1 }}>✕</button>
            </div>
            <button onClick={downloadTemplate}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: '1.5px dashed #CBD5E1', background: '#F8FAFC', color: '#475569', fontSize: 13, cursor: 'pointer', marginBottom: 16, width: '100%', boxSizing: 'border-box' }}>
              <FileText style={{ width: 16, height: 16, color: '#3B82F6' }} /> Download template CSV (nome, telefone, email)
            </button>
            <label style={{ display: 'block', marginBottom: 16, cursor: 'pointer' }}>
              <div style={{ border: '2px dashed #CBD5E1', borderRadius: 10, padding: 24, textAlign: 'center', background: '#F8FAFC' }}>
                <Upload style={{ width: 24, height: 24, color: '#94A3B8', display: 'block', margin: '0 auto 8px' }} />
                <p style={{ margin: 0, fontSize: 13, color: '#64748B', fontWeight: 500 }}>Clique para selecionar arquivo CSV</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#CBD5E1' }}>Formato: .csv com cabeçalho na primeira linha</p>
              </div>
              <input type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
            {importErrors.length > 0 && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                {importErrors.map((err, i) => <p key={i} style={{ margin: i > 0 ? '4px 0 0' : 0, fontSize: 12, color: '#DC2626' }}>{err}</p>)}
              </div>
            )}
            {importRows.length > 0 && !importResult && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>{importRows.length} contato(s) válido(s) — pré-visualização:</p>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, maxHeight: 220, overflowY: 'auto', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0 }}>
                        {['Nome', 'Telefone', 'E-mail'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 10).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '7px 12px', color: '#1A2B4A' }}>{r.nome || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                          <td style={{ padding: '7px 12px', color: '#475569' }}>{r.telefone}</td>
                          <td style={{ padding: '7px 12px', color: '#475569' }}>{r.email || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                        </tr>
                      ))}
                      {importRows.length > 10 && (
                        <tr><td colSpan={3} style={{ padding: '8px 12px', color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>...e mais {importRows.length - 10} linha(s)</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button onClick={handleImport} disabled={importLoading}
                  style={{ marginTop: 12, width: '100%', padding: 12, background: '#00A896', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: importLoading ? 'not-allowed' : 'pointer', opacity: importLoading ? 0.7 : 1 }}>
                  {importLoading ? 'Importando...' : `Importar ${importRows.length} contatos`}
                </button>
              </div>
            )}
            {importResult && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 20, textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#065F46' }}>✅ {importResult.imported} importado(s)</p>
                {importResult.duplicates > 0 && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>{importResult.duplicates} duplicata(s) ignorada(s)</p>}
                <button onClick={() => { setShowImportModal(false); setImportRows([]); setImportResult(null) }} style={{ marginTop: 16, padding: '9px 24px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Editar contato */}
      {editingContact && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setEditingContact(null) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1A2B4A' }}>{editingContact.name || formatContactPhone(editingContact.phone)}</h2>
              <button onClick={() => setEditingContact(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>{formatContactPhone(editingContact.phone)}</div>
            {editingContact.email && <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>{editingContact.email}</div>}

            <label style={labelStyle}>Etiquetas</label>
            {availTags.length === 0 ? (
              <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>Nenhuma etiqueta cadastrada. Crie em Configurações → Etiquetas.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                {availTags.map(t => {
                  const active = editingContact.tags.includes(t.name)
                  return (
                    <button key={t.id} onClick={() => toggleContactTag(editingContact, t.name)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', border: active ? 'none' : '1.5px solid #E2E8F0', background: active ? t.color : '#fff', color: active ? '#fff' : '#64748B' }}>
                      {active && <Check style={{ width: 11, height: 11 }} />} {t.name}
                    </button>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>Opt-out (LGPD)</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>Não incluir em transmissões futuras</div>
              </div>
              <button onClick={() => toggleOptedOut(editingContact)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                {editingContact.opted_out
                  ? <ToggleRight style={{ width: 30, height: 30, color: '#DC2626' }} />
                  : <ToggleLeft style={{ width: 30, height: 30, color: '#CBD5E1' }} />}
              </button>
            </div>

            <button onClick={() => deleteContact(editingContact)} disabled={editSaving}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: '#fff', color: '#DC2626', border: '1.5px solid #FEE2E2', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: editSaving ? 'not-allowed' : 'pointer' }}>
              <Trash2 style={{ width: 14, height: 14 }} /> Excluir contato
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BroadcastsTab ────────────────────────────────────────────────────────────

interface AionBroadcast {
  id: string
  name: string
  template_name: string
  template_language: string
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled'
  total_recipients: number
  sent_count: number
  failed_count: number
  created_at: string
  scheduled_at: string | null
  completed_at: string | null
}

interface AionBroadcastRecipient {
  id: string
  remote_jid: string
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  wamid: string | null
  error_message: string | null
  sent_at: string | null
  aion_contacts: { name: string | null } | null
}

interface GraphTemplate { id?: string; name: string; language: string; status?: string; components?: any[] }

// Mesma lógica de buildTemplatePreview() em AionInboxHub.tsx (linha 299) —
// substitui {{n}} pelo valor preenchido, pra gravar em aion_broadcasts.preview_text
// (a Edge Function usa esse texto pronto em whatsapp_messages.content).
function buildBroadcastPreview(tmpl: GraphTemplate | undefined, vars: Record<string, string>): string {
  if (!tmpl) return '[Template]'
  const bodyComp = tmpl.components?.find((c: any) => c.type === 'BODY')
  if (!bodyComp?.text) return `[Template: ${tmpl.name}]`
  let text: string = bodyComp.text
  Object.entries(vars).forEach(([n, val]) => {
    text = text.replace(new RegExp(`\\{\\{${n}\\}\\}`, 'g'), val || `{{${n}}}`)
  })
  return text
}

const BROADCAST_STATUS_CFG: Record<AionBroadcast['status'], { label: string; color: string; bg: string }> = {
  draft:     { label: 'Rascunho',   color: '#64748B', bg: '#F1F5F9' },
  scheduled: { label: 'Agendada',   color: '#1D4ED8', bg: '#DBEAFE' },
  sending:   { label: 'Enviando',   color: '#D97706', bg: '#FEF3C7' },
  completed: { label: 'Concluída',  color: '#065F46', bg: '#D1FAE5' },
  cancelled: { label: 'Cancelada',  color: '#DC2626', bg: '#FEE2E2' },
}

function BroadcastsTab({ aionPlatformId }: { aionPlatformId: string }) {
  const { user } = useAuth()

  const [broadcasts, setBroadcasts] = useState<AionBroadcast[]>([])
  const [loading, setLoading]       = useState(true)

  const [showCreateModal, setShowCreateModal]   = useState(false)
  const [templates, setTemplates]               = useState<GraphTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [campaignName, setCampaignName]         = useState('')
  const [templateName, setTemplateName]         = useState('')
  const [templateVars, setTemplateVars]         = useState<Record<string, string>>({})
  const [audienceTags, setAudienceTags]         = useState<string[]>([]) // vazio = todos os contatos
  const [availTags, setAvailTags]               = useState<WaTag[]>([])
  const [audienceCount, setAudienceCount]       = useState(0)
  const [audienceLoading, setAudienceLoading]   = useState(false)
  // Nome do 1º contato da audiência selecionada — só pra exemplificar no
  // preview como a personalização automática de {{1}} vai ficar.
  const [previewContactName, setPreviewContactName] = useState<string | null>(null)
  const [creating, setCreating]                 = useState(false)
  const [createError, setCreateError]           = useState('')

  const [detailBroadcast, setDetailBroadcast]   = useState<AionBroadcast | null>(null)
  const [recipients, setRecipients]             = useState<AionBroadcastRecipient[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0',
    borderRadius: 8, fontSize: 14, color: '#1A2B4A', background: '#fff',
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block',
  }

  async function loadBroadcasts() {
    const { data } = await supabase.from('aion_broadcasts').select('*').order('created_at', { ascending: false })
    setBroadcasts((data as AionBroadcast[]) ?? [])
    setLoading(false)
  }

  async function loadTags() {
    if (!aionPlatformId) return
    const { data } = await supabase.from('whatsapp_tags').select('id, name, color').eq('institution_id', aionPlatformId).order('name')
    setAvailTags((data as WaTag[]) ?? [])
  }

  useEffect(() => { loadBroadcasts() }, [])
  useEffect(() => { loadTags() }, [aionPlatformId])

  // Enquanto houver campanha em andamento, atualiza o progresso a cada 5s —
  // sent_count/failed_count avançam em background pela Edge Function/cron.
  useEffect(() => {
    const hasActive = broadcasts.some(b => b.status === 'sending' || b.status === 'scheduled')
    if (!hasActive) return
    const t = setInterval(loadBroadcasts, 5000)
    return () => clearInterval(t)
  }, [broadcasts])

  // ── Templates aprovados direto da Graph API — mesmo padrão de
  // AionInboxHub.tsx:loadAionAgendaTemplates() ──
  async function loadTemplatesFromGraph() {
    setLoadingTemplates(true)
    try {
      const { data: waRow } = await supabase.from('platform_whatsapp').select('waba_id').eq('connected', true).maybeSingle()
      const wabaId = (waRow as any)?.waba_id
      if (!wabaId) { setTemplates([]); return }
      const { data: tokenRow } = await supabase.from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
      const token = (tokenRow as any)?.value || ''
      if (!token) { setTemplates([]); return }
      const res = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/message_templates?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const approved = ((data.data || []) as any[]).filter(t => t.status?.toUpperCase() === 'APPROVED')
      setTemplates(approved)
    } catch (e) {
      console.error('[broadcast] erro ao carregar templates:', e)
      setTemplates([])
    } finally {
      setLoadingTemplates(false)
    }
  }

  function openCreateModal() {
    setCampaignName(''); setTemplateName(''); setTemplateVars({}); setAudienceTags([]); setCreateError('')
    setShowCreateModal(true)
    loadTemplatesFromGraph()
  }

  // Aplica o mesmo filtro de audiência (OR de etiquetas) a uma query já
  // filtrada por opted_out=false — usado pra contagem, preview e criação, um
  // único lugar pra manter os três em sincronia.
  function applyAudienceTagFilter<T extends { or: (s: string) => any }>(query: T): T {
    if (audienceTags.length === 0) return query
    return query.or(audienceTags.map(t => `tags.cs.["${t}"]`).join(','))
  }

  // ── Contagem de audiência em tempo real (exclui opted_out) + nome do 1º
  // contato, só pra exemplificar a personalização automática de {{1}} ──
  useEffect(() => {
    if (!showCreateModal) return
    const t = setTimeout(async () => {
      setAudienceLoading(true)
      try {
        const countQuery = applyAudienceTagFilter(
          supabase.from('aion_contacts').select('id', { count: 'exact', head: true }).eq('opted_out', false) as any
        )
        const nameQuery = applyAudienceTagFilter(
          supabase.from('aion_contacts').select('name').eq('opted_out', false) as any
        ).order('created_at', { ascending: true }).limit(1).maybeSingle()

        const [{ count }, { data: firstContact }] = await Promise.all([countQuery, nameQuery])
        setAudienceCount(count || 0)
        setPreviewContactName((firstContact as any)?.name || null)
      } finally {
        setAudienceLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal, audienceTags])

  function toggleAudienceTag(tagName: string) {
    setAudienceTags(prev => prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName])
  }

  const selectedTemplate = templates.find(t => t.name === templateName)
  const templateVarNumbers = (() => {
    const bodyComp = selectedTemplate?.components?.find((c: any) => c.type === 'BODY')
    if (!bodyComp?.text) return [] as string[]
    return [...(bodyComp.text as string).matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1])
  })()

  const FALLBACK_CONTACT_NAME = 'Cliente'

  // {{1}} = nome do contato (fallback "Cliente"), demais posições = valor fixo
  // definido na campanha — mesma ordem de templateVarNumbers pros dois lados
  // (client aqui e Edge Function na hora de reconstruir o preview).
  function resolveRecipientComponents(tmpl: GraphTemplate, contactName: string | null): any[] {
    if (templateVarNumbers.length === 0) {
      return tmpl.components?.some((c: any) => c.type === 'BODY') ? [] : (tmpl.components ?? [])
    }
    return [{
      type: 'body',
      parameters: templateVarNumbers.map(n =>
        n === '1'
          ? { type: 'text', text: contactName?.trim() || FALLBACK_CONTACT_NAME }
          : { type: 'text', text: templateVars[n] || '' }
      ),
    }]
  }

  // ── Cria a campanha: aion_broadcasts (status='scheduled') + insert em lote
  // em aion_broadcast_recipients, resolvendo remote_jid e template_components
  // (personalizado por contato) a partir de aion_contacts. ──
  async function handleCreateBroadcast() {
    if (!campaignName.trim()) { setCreateError('Dê um nome à campanha.'); return }
    const tmpl = templates.find(t => t.name === templateName)
    if (!tmpl) { setCreateError('Selecione um template aprovado.'); return }

    setCreating(true)
    setCreateError('')
    try {
      const bodyComp = tmpl.components?.find((c: any) => c.type === 'BODY')
      const templateBodyText = bodyComp?.text || ''

      // Snapshot só de auditoria em aion_broadcasts — {{1}} fica sem valor de
      // propósito, é resolvido por destinatário (ver resolveRecipientComponents).
      const campaignSnapshotComponents = templateVarNumbers.length > 0
        ? [{ type: 'body', parameters: templateVarNumbers.map(n => ({ type: 'text', text: n === '1' ? '' : (templateVars[n] || '') })) }]
        : (tmpl.components?.some((c: any) => c.type === 'BODY') ? [] : (tmpl.components ?? []))
      const preview = buildBroadcastPreview(tmpl, { ...templateVars, ...(templateVarNumbers.includes('1') ? { '1': previewContactName?.trim() || FALLBACK_CONTACT_NAME } : {}) })

      const audQuery = applyAudienceTagFilter(
        supabase.from('aion_contacts').select('id, phone, name').eq('opted_out', false) as any
      )
      const { data: audience, error: audErr } = await audQuery
      if (audErr) throw audErr
      const list = (audience as { id: string; phone: string; name: string | null }[]) ?? []
      if (list.length === 0) { setCreateError('Nenhum contato na audiência selecionada.'); setCreating(false); return }

      const { data: broadcast, error: bErr } = await supabase.from('aion_broadcasts').insert({
        name:                campaignName.trim(),
        template_name:       tmpl.name,
        template_language:   tmpl.language || 'pt_BR',
        template_components: campaignSnapshotComponents,
        template_body_text:  templateBodyText,
        preview_text:        preview,
        filter_tags:         audienceTags,
        status:              'scheduled',
        total_recipients:    list.length,
        created_by:          user?.id || null,
      }).select('id').single()
      if (bErr) throw bErr

      // Insert em lote, em chunks — evita payload único gigante pra audiências
      // grandes. template_components é resolvido individualmente por contato.
      const CHUNK = 500
      for (let i = 0; i < list.length; i += CHUNK) {
        const chunk = list.slice(i, i + CHUNK).map(c => ({
          broadcast_id:        (broadcast as { id: string }).id,
          contact_id:          c.id,
          remote_jid:          c.phone,
          template_components: resolveRecipientComponents(tmpl, c.name),
        }))
        const { error: recErr } = await supabase.from('aion_broadcast_recipients').insert(chunk)
        if (recErr) throw recErr
      }

      setShowCreateModal(false)
      loadBroadcasts()
    } catch (e: any) {
      setCreateError(e?.message || 'Erro ao criar campanha.')
    } finally {
      setCreating(false)
    }
  }

  async function openDetail(b: AionBroadcast) {
    setDetailBroadcast(b)
    setLoadingRecipients(true)
    const { data } = await supabase
      .from('aion_broadcast_recipients')
      .select('id, remote_jid, status, wamid, error_message, sent_at, aion_contacts(name)')
      .eq('broadcast_id', b.id)
      .order('created_at', { ascending: true })
      .limit(500)
    setRecipients((data as any as AionBroadcastRecipient[]) ?? [])
    setLoadingRecipients(false)
  }

  const RECIPIENT_STATUS_CFG: Record<AionBroadcastRecipient['status'], { label: string; color: string }> = {
    pending: { label: 'Pendente', color: '#94A3B8' },
    sent:    { label: 'Enviado',  color: '#00A896' },
    failed:  { label: 'Falhou',   color: '#DC2626' },
    skipped: { label: 'Ignorado', color: '#D97706' },
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>Listas de Transmissão</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Disparo em massa de templates aprovados para segmentos de contatos</div>
        </div>
        <button onClick={openCreateModal}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
          <Plus style={{ width: 16, height: 16 }} /> Nova transmissão
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 style={{ width: 26, height: 26, color: '#00A896', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : broadcasts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: 14, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12 }}>
          Nenhuma campanha criada ainda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {broadcasts.map(b => {
            const cfg = BROADCAST_STATUS_CFG[b.status]
            const processed = b.sent_count + b.failed_count
            const pct = b.total_recipients > 0 ? Math.round((processed / b.total_recipients) * 100) : 0
            return (
              <div key={b.id} onClick={() => openDetail(b)}
                style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>{b.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 9px', borderRadius: 20 }}>{cfg.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>{new Date(b.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Template: {b.template_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 20, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: b.failed_count > 0 ? '#F59E0B' : '#00A896', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, flexShrink: 0 }}>
                    {processed}/{b.total_recipients} {b.failed_count > 0 ? `(${b.failed_count} falha${b.failed_count === 1 ? '' : 's'})` : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Nova transmissão */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1A2B4A' }}>Nova transmissão</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nome da campanha *</label>
              <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ex: Reativação Agosto/2026" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Template aprovado *</label>
              {loadingTemplates ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                  <Loader2 style={{ width: 18, height: 18, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : (
                <>
                  <select value={templateName} onChange={e => { setTemplateName(e.target.value); setTemplateVars({}) }} style={inputStyle}>
                    <option value="">Selecionar template...</option>
                    {templates.map(t => <option key={t.id || t.name} value={t.name}>{t.name}</option>)}
                  </select>
                  {templates.length === 0 && (
                    <p style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', padding: '9px 12px', borderRadius: 8, marginTop: 8 }}>
                      Nenhum template aprovado encontrado no WhatsApp da Áion.
                    </p>
                  )}
                </>
              )}
            </div>

            {templateVarNumbers.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Variáveis do template</label>
                {templateVarNumbers.includes('1') && (
                  <p style={{ fontSize: 12, color: '#00A896', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 8, padding: '8px 11px', margin: '0 0 8px' }}>
                    Variável <strong>1</strong> é preenchida automaticamente com o nome de cada contato ("{FALLBACK_CONTACT_NAME}" se não houver nome cadastrado).
                  </p>
                )}
                {templateVarNumbers.filter(n => n !== '1').length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {templateVarNumbers.filter(n => n !== '1').map(n => (
                      <input key={n} value={templateVars[n] || ''} onChange={e => setTemplateVars(v => ({ ...v, [n]: e.target.value }))}
                        placeholder={`Variável ${n}`} style={inputStyle} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedTemplate && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}>
                  {buildBroadcastPreview(selectedTemplate, {
                    ...templateVars,
                    ...(templateVarNumbers.includes('1') ? { '1': previewContactName?.trim() || FALLBACK_CONTACT_NAME } : {}),
                  })}
                </div>
                {templateVarNumbers.includes('1') && (
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '6px 0 0' }}>
                    Preview de exemplo usando "{previewContactName?.trim() || FALLBACK_CONTACT_NAME}" (1º contato da audiência) — {'{{1}}'} será substituído automaticamente pelo nome de cada pessoa no envio real.
                  </p>
                )}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Audiência — etiquetas (vazio = todos os contatos)</label>
              {availTags.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94A3B8' }}>Nenhuma etiqueta cadastrada. Crie em Configurações → Etiquetas.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {availTags.map(t => {
                    const active = audienceTags.includes(t.name)
                    return (
                      <button key={t.id} onClick={() => toggleAudienceTag(t.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', border: active ? 'none' : '1.5px solid #E2E8F0', background: active ? t.color : '#fff', color: active ? '#fff' : '#64748B' }}>
                        {active && <Check style={{ width: 11, height: 11 }} />} {t.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#F0FDFA', borderRadius: 9, marginBottom: 18, border: '1px solid #CCFBF1' }}>
              {audienceLoading && <div style={{ width: 12, height: 12, border: '2px solid #00A896', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
              <p style={{ margin: 0, fontSize: 13, color: '#00A896', fontWeight: 600 }}>
                {audienceLoading ? 'Calculando...' : `${audienceCount} contato(s) elegível(is) — opt-out excluído`}
              </p>
            </div>

            {createError && (
              <div style={{ marginBottom: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#DC2626' }}>{createError}</div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateModal(false)}
                style={{ padding: '9px 18px', border: '1px solid #E2E8F0', borderRadius: 9, background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={handleCreateBroadcast} disabled={creating || !campaignName.trim() || !templateName || audienceCount === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', border: 'none', borderRadius: 9, background: '#00A896', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, opacity: (creating || !campaignName.trim() || !templateName || audienceCount === 0) ? 0.5 : 1 }}>
                {creating ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 14, height: 14 }} />}
                {creating ? 'Criando...' : `Criar e enviar para ${audienceCount}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalhe da campanha */}
      {detailBroadcast && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setDetailBroadcast(null) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1A2B4A' }}>{detailBroadcast.name}</h2>
              <button onClick={() => setDetailBroadcast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>
              Template: {detailBroadcast.template_name} · {detailBroadcast.sent_count} enviados, {detailBroadcast.failed_count} falhas, de {detailBroadcast.total_recipients}
            </div>
            {loadingRecipients ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
                <Loader2 style={{ width: 22, height: 22, color: '#00A896', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                {recipients.map(r => {
                  const rc = RECIPIENT_STATUS_CFG[r.status]
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 14px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#1A2B4A', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.aion_contacts?.name || formatContactPhone(r.remote_jid)}
                        </div>
                        {r.error_message && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{r.error_message}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: rc.color, flexShrink: 0 }}>{rc.label}</span>
                    </div>
                  )
                })}
                {recipients.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8', fontSize: 13 }}>Nenhum destinatário.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminAionInbox() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [checking, setChecking]         = useState(true)
  const [isConnected, setIsConnected]   = useState(false)
  const [aionPlatformId, setAionPlatformId] = useState<string>('')
  // Permite deep-link (ex: navigate('/super-admin/aion-inbox?tab=settings')
  // vindo do próprio AionInboxHub quando falta configurar templates/conexão).
  const initialTab = (searchParams.get('tab') as Tab | null)
  const [tab, setTab]                   = useState<Tab>(initialTab && ['inbox','flow','qrcodes','contacts','broadcasts','settings'].includes(initialTab) ? initialTab : 'inbox')

  useEffect(() => {
    supabase
      .from('platform_whatsapp')
      .select('id, phone_number_id')
      .eq('connected', true)
      .maybeSingle()
      .then(({ data }) => {
        setIsConnected(!!data)
        setAionPlatformId(data?.id ?? '')
        setChecking(false)
      })
  }, [])

  if (checking) {
    return (
      <SuperAdminLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent" />
        </div>
      </SuperAdminLayout>
    )
  }

  if (!isConnected) {
    return (
      <SuperAdminLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F0FDFB' }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ width: 80, height: 80, background: '#E6F7F5', border: '2px solid #D1FAE5', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <MessageCircle style={{ width: 40, height: 40, color: '#00A896' }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', marginBottom: 8 }}>WhatsApp Áion não configurado</h2>
            <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 1.6 }}>
              Configure o WhatsApp corporativo da Áion nas Configurações para acessar o inbox.
            </p>
            <button onClick={() => navigate('/super-admin/settings')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#00A896', color: '#fff', fontSize: 14, fontWeight: 600, borderRadius: 10, border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#007A6E')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00A896')}>
              <Settings style={{ width: 16, height: 16 }} />
              Ir para Configurações
            </button>
          </div>
        </div>
      </SuperAdminLayout>
    )
  }

  const tabs: { key: Tab; label: string; Icon: React.ElementType }[] = [
    { key: 'inbox',      label: 'Inbox',          Icon: MessageCircle },
    { key: 'flow',       label: 'Fluxo do Bot',   Icon: GitBranch },
    { key: 'qrcodes',    label: 'Campanhas',      Icon: Megaphone },
    { key: 'contacts',   label: 'Contatos',       Icon: Users },
    { key: 'broadcasts', label: 'Transmissão',    Icon: Radio },
    { key: 'settings',   label: 'Configurações',  Icon: Settings },
  ]

  return (
    <SuperAdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 20px 0', borderBottom: '1px solid #E2E8F0', background: '#fff', flexShrink: 0 }}>
          {tabs.map(({ key, label, Icon }) => {
            const active = tab === key
            return (
              <button key={key} onClick={() => setTab(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 18px', fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? '#00A896' : '#64748B', background: 'transparent',
                  border: 'none', borderBottom: active ? '2.5px solid #00A896' : '2.5px solid transparent',
                  marginBottom: -1, cursor: 'pointer', borderRadius: '6px 6px 0 0', transition: 'color 0.15s',
                }}>
                <Icon style={{ width: 15, height: 15 }} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'hidden', display: tab === 'inbox' || tab === 'flow' ? 'flex' : 'block', flexDirection: 'column' }}>
          {tab === 'inbox' && <AionInboxHub isAionInbox={true} />}
          {tab === 'flow' && (
            aionPlatformId
              ? <FlowEditor institutionId={aionPlatformId} onClose={() => setTab('inbox')} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Loader2 style={{ width: 28, height: 28, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                </div>
          )}
          {tab === 'qrcodes'    && <div style={{ overflowY: 'auto', height: '100%' }}><CampaignsTab /></div>}
          {tab === 'contacts'   && <div style={{ overflowY: 'auto', height: '100%' }}><ContactsTab aionPlatformId={aionPlatformId} /></div>}
          {tab === 'broadcasts' && <div style={{ overflowY: 'auto', height: '100%' }}><BroadcastsTab aionPlatformId={aionPlatformId} /></div>}
          {tab === 'settings'   && <div style={{ overflowY: 'auto', height: '100%' }}><SettingsTab aionPlatformId={aionPlatformId} /></div>}
        </div>
      </div>
    </SuperAdminLayout>
  )
}
