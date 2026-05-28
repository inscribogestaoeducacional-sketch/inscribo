import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import AionInboxHub from './AionInboxHub'
import FlowEditor from '../whatsapp/FlowEditor'
import {
  Settings, MessageCircle, GitBranch, QrCode,
  Plus, Trash2, Copy, Check, ToggleLeft, ToggleRight, Save, Loader2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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

interface ConsultantUser {
  id: string
  full_name: string
  email: string
}

type Tab = 'inbox' | 'flow' | 'qrcodes' | 'settings'

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

function SettingsTab() {
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

// ─── QRCodesTab ───────────────────────────────────────────────────────────────

const EMPTY_KW = { keyword: '', label: '', description: '', auto_response: '', tag: '', source: 'whatsapp', create_lead: true }

function QRCodesTab() {
  const [keywords, setKeywords]   = useState<AionKeyword[]>([])
  const [aionTags, setAionTags]   = useState<{id:string;name:string;color:string}[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_KW })
  const [saving, setSaving]       = useState(false)
  const [copiedId, setCopiedId]   = useState<string | null>(null)

  const load = async () => {
    const [{ data: kws }, { data: tags }] = await Promise.all([
      supabase.from('aion_keywords').select('*').order('created_at', { ascending: false }),
      supabase.from('aion_tags').select('*').order('name'),
    ])
    setKeywords((kws as AionKeyword[]) ?? [])
    setAionTags(tags ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>Keywords / QR Codes</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Cada keyword gera um link QR Code para o WhatsApp da Áion</div>
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

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminAionInbox() {
  const navigate = useNavigate()
  const [checking, setChecking]         = useState(true)
  const [isConnected, setIsConnected]   = useState(false)
  const [aionPlatformId, setAionPlatformId] = useState<string>('')
  const [tab, setTab]                   = useState<Tab>('inbox')

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
    { key: 'inbox',    label: 'Inbox',          Icon: MessageCircle },
    { key: 'flow',     label: 'Fluxo do Bot',   Icon: GitBranch },
    { key: 'qrcodes',  label: 'QR Codes',       Icon: QrCode },
    { key: 'settings', label: 'Configurações',  Icon: Settings },
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
          {tab === 'inbox' && <AionInboxHub />}
          {tab === 'flow' && (
            aionPlatformId
              ? <FlowEditor institutionId={aionPlatformId} onClose={() => setTab('inbox')} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Loader2 style={{ width: 28, height: 28, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                </div>
          )}
          {tab === 'qrcodes'  && <div style={{ overflowY: 'auto', height: '100%' }}><QRCodesTab /></div>}
          {tab === 'settings' && <div style={{ overflowY: 'auto', height: '100%' }}><SettingsTab /></div>}
        </div>
      </div>
    </SuperAdminLayout>
  )
}
