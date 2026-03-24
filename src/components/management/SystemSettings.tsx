import React, { useState, useEffect } from 'react'
import {
  Save, Upload, Building, Mail, Phone, Globe, Palette,
  MessageCircle, Wifi, WifiOff, RefreshCw, Settings,
  Bot, X, Plus, Check, AlertCircle, GraduationCap
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import SchoolSetupModal from '../onboarding/SchoolSetupModal'

// ─── Shared input style ───────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none transition-all'

// ─── Tab: Geral ───────────────────────────────────────────────────────────────
function GeralTab() {
  const [settings, setSettings] = useState({
    name: '', email: '', phone: '', address: '', website: '',
    logo_url: '', primary_color: '#3B82F6', secondary_color: '#10B981'
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 800))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Erro ao salvar:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setSettings({ ...settings, logo_url: ev.target?.result as string })
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Institution info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Informações da Instituição</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome da Instituição</label>
                <input type="text" value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className={inputCls} placeholder="Nome da sua instituição" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="email" value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className={inputCls + ' pl-9'} placeholder="contato@escola.com" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="tel" value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className={inputCls + ' pl-9'} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Endereço</label>
                <input type="text" value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className={inputCls} placeholder="Endereço completo" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="url" value={settings.website}
                    onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                    className={inputCls + ' pl-9'} placeholder="https://www.escola.com" />
                </div>
              </div>
            </div>
          </div>

          {/* Visual identity */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Identidade Visual</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Cor Primária', key: 'primary_color' },
                { label: 'Cor Secundária', key: 'secondary_color' }
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={(settings as any)[key]}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                      className="h-9 w-14 border border-gray-300 rounded cursor-pointer" />
                    <input type="text" value={(settings as any)[key]}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                      className={inputCls + ' flex-1'} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading}
              className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                saved ? 'bg-green-600 text-white' : 'bg-[#1e2d6b] hover:bg-[#151b4e] text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}>
              <Save className="h-4 w-4" />
              {loading ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      </div>

      {/* Logo Upload */}
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Logo da Instituição</h3>
          <div className="text-center">
            <div className="mb-4">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo"
                  className="mx-auto h-24 w-24 object-cover rounded-lg border border-gray-200" />
              ) : (
                <div className="mx-auto h-24 w-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
              <Upload className="h-4 w-4" />
              Fazer Upload
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
            <p className="text-xs text-gray-400 mt-2">PNG, JPG até 2MB</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Preview</h3>
          <div className="p-3 rounded-lg" style={{ backgroundColor: settings.primary_color + '20' }}>
            <div className="flex items-center gap-3">
              {settings.logo_url
                ? <img src={settings.logo_url} alt="Logo" className="h-8 w-8 object-cover rounded" />
                : <div className="h-8 w-8 bg-gray-300 rounded" />}
              <div>
                <p className="text-sm font-medium" style={{ color: settings.primary_color }}>
                  {settings.name || 'Nome da Instituição'}
                </p>
                <p className="text-xs text-gray-500">Sistema Inscribo</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: WhatsApp (Meta Cloud API) ──────────────────────────────────────────

interface MetaConfig {
  whatsapp_phone_id: string
  whatsapp_token: string
  whatsapp_phone_number: string
  whatsapp_display_name: string
  whatsapp_connected: boolean
}

interface BotConfig {
  bot_enabled: boolean
  school_name: string
  welcome_message: string
  bot_tone: 'friendly' | 'formal' | 'casual'
  grades_offered: string[]
  monthly_fee_info: string
  handoff_keywords: string[]
  faq_data: Record<string, string>
}

const GRADE_OPTS = ['Infantil I','Infantil II','Infantil III','Infantil IV','Infantil V',
  '1º ao 5º EF','6º ao 9º EF','Ensino Médio']

// ── Bot Config Modal ─────────────────────────────────────────────────────────
function BotConfigModal({ institutionId, onClose }: { institutionId: string; onClose: () => void }) {
  const [cfg, setCfg] = useState<BotConfig>({
    bot_enabled: true, school_name: '', welcome_message: 'Olá! Seja bem-vindo! 😊 Como posso te ajudar?',
    bot_tone: 'friendly', grades_offered: [], monthly_fee_info: '',
    handoff_keywords: ['atendente','humano','falar com pessoa'], faq_data: {}
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newFaqQ, setNewFaqQ] = useState('')
  const [newFaqA, setNewFaqA] = useState('')

  useEffect(() => {
    supabase.from('whatsapp_bot_config').select('*').eq('institution_id', institutionId).single()
      .then(({ data }) => {
        if (data) setCfg(data as unknown as BotConfig)
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [institutionId])

  const save = async () => {
    setSaving(true)
    await supabase.from('whatsapp_bot_config').upsert({ ...cfg, institution_id: institutionId }, { onConflict: 'institution_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const toggleGrade = (g: string) => {
    setCfg(c => ({ ...c, grades_offered: c.grades_offered.includes(g) ? c.grades_offered.filter(x => x !== g) : [...c.grades_offered, g] }))
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 48 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #14b8a6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot style={{ width: 20, height: 20, color: '#14b8a6' }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A' }}>Configurar Bot</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X style={{ width: 20, height: 20 }} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A' }}>Bot ativo</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>Quando ativo, responde automaticamente as primeiras mensagens</div>
            </div>
            <button onClick={() => setCfg(c => ({ ...c, bot_enabled: !c.bot_enabled }))}
              style={{ width: 44, height: 24, borderRadius: 999, background: cfg.bot_enabled ? '#14b8a6' : '#CBD5E1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 3, left: cfg.bot_enabled ? 22 : 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
            </button>
          </div>

          {/* Nome da escola */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Nome da escola (como o bot se apresenta)</label>
            <input value={cfg.school_name} onChange={e => setCfg(c => ({ ...c, school_name: e.target.value }))}
              className={inputCls} placeholder="Ex: Colégio São João" />
          </div>

          {/* Tom */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Tom do bot</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['friendly','formal','casual'] as const).map(t => (
                <button key={t} onClick={() => setCfg(c => ({ ...c, bot_tone: t }))}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: `2px solid ${cfg.bot_tone === t ? '#14b8a6' : '#E2E8F0'}`, background: cfg.bot_tone === t ? '#F0FDFA' : '#fff', color: cfg.bot_tone === t ? '#0d9488' : '#64748B', cursor: 'pointer' }}>
                  {t === 'friendly' ? '😊 Amigável' : t === 'formal' ? '👔 Formal' : '😎 Descontraído'}
                </button>
              ))}
            </div>
          </div>

          {/* Mensagem de boas-vindas */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Mensagem de boas-vindas</label>
            <textarea value={cfg.welcome_message} onChange={e => setCfg(c => ({ ...c, welcome_message: e.target.value }))}
              rows={3} className={inputCls} style={{ resize: 'vertical' }} />
          </div>

          {/* Séries */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Séries oferecidas</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {GRADE_OPTS.map(g => (
                <button key={g} onClick={() => toggleGrade(g)}
                  style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: `2px solid ${cfg.grades_offered.includes(g) ? '#14b8a6' : '#E2E8F0'}`, background: cfg.grades_offered.includes(g) ? '#F0FDFA' : '#fff', color: cfg.grades_offered.includes(g) ? '#0d9488' : '#64748B', cursor: 'pointer' }}>
                  {cfg.grades_offered.includes(g) && '✓ '}{g}
                </button>
              ))}
            </div>
          </div>

          {/* Mensalidade */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Informações de mensalidade</label>
            <textarea value={cfg.monthly_fee_info} onChange={e => setCfg(c => ({ ...c, monthly_fee_info: e.target.value }))}
              rows={2} className={inputCls} placeholder="Ex: A mensalidade varia de R$ 800 a R$ 1.200 conforme a série." style={{ resize: 'vertical' }} />
          </div>

          {/* Palavras de handoff */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Palavras para transferir para humano</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {cfg.handoff_keywords.map(kw => (
                <span key={kw} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 999, fontSize: 12, color: '#92400E' }}>
                  {kw}
                  <button onClick={() => setCfg(c => ({ ...c, handoff_keywords: c.handoff_keywords.filter(k => k !== kw) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D97706', lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newKeyword.trim()) { setCfg(c => ({ ...c, handoff_keywords: [...c.handoff_keywords, newKeyword.trim()] })); setNewKeyword('') }}}
                className={inputCls} placeholder="Adicionar palavra..." style={{ flex: 1 }} />
              <button onClick={() => { if (newKeyword.trim()) { setCfg(c => ({ ...c, handoff_keywords: [...c.handoff_keywords, newKeyword.trim()] })); setNewKeyword('') }}}
                style={{ padding: '8px 14px', background: '#14b8a6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                <Plus style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Perguntas frequentes (FAQ)</label>
            {Object.entries(cfg.faq_data).map(([q, a]) => (
              <div key={q} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, marginBottom: 6, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: 2 }}>P: {q}</div>
                <div style={{ color: '#64748B' }}>R: {a}</div>
                <button onClick={() => { const f = { ...cfg.faq_data }; delete f[q]; setCfg(c => ({ ...c, faq_data: f })) }}
                  style={{ fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}>Remover</button>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, background: '#F8FAFC', borderRadius: 10, border: '1px dashed #CBD5E1' }}>
              <input value={newFaqQ} onChange={e => setNewFaqQ(e.target.value)} className={inputCls} placeholder="Pergunta..." />
              <input value={newFaqA} onChange={e => setNewFaqA(e.target.value)} className={inputCls} placeholder="Resposta..." />
              <button onClick={() => { if (newFaqQ.trim() && newFaqA.trim()) { setCfg(c => ({ ...c, faq_data: { ...c.faq_data, [newFaqQ.trim()]: newFaqA.trim() } })); setNewFaqQ(''); setNewFaqA('') }}}
                style={{ padding: '8px', background: '#14b8a6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                + Adicionar pergunta
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saved ? '#10B981' : '#14b8a6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            {saved ? <><Check style={{ width: 14, height: 14 }} /> Salvo!</> : saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── WhatsApp Tab ─────────────────────────────────────────────────────────────
function WhatsAppTab() {
  const { user } = useAuth()
  const institutionId = user?.institution_id

  const [metaConfig, setMetaConfig] = useState<MetaConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBotConfig, setShowBotConfig] = useState(false)
  const [usage, setUsage] = useState({ count: 0, limit: 1000 })

  // Form de setup
  const [form, setForm] = useState({ phone_id: '', token: '', phone_number: '', display_name: '' })
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    if (!institutionId) return
    loadConfig()
  }, [institutionId])

  async function loadConfig() {
    setLoading(true)
    const { data } = await supabase
      .from('institutions')
      .select('whatsapp_phone_id,whatsapp_token,whatsapp_phone_number,whatsapp_display_name,whatsapp_connected')
      .eq('id', institutionId)
      .single()
      .catch(() => ({ data: null }))

    if (data?.whatsapp_phone_id) {
      setMetaConfig(data as unknown as MetaConfig)
      // Buscar uso mensal
      const monthYear = new Date().toISOString().slice(0, 7)
      const { data: usageData } = await supabase
        .from('whatsapp_usage')
        .select('conversation_count, monthly_limit')
        .eq('institution_id', institutionId)
        .eq('month_year', monthYear)
        .single()
        .catch(() => ({ data: null }))
      if (usageData) setUsage({ count: (usageData as any).conversation_count || 0, limit: (usageData as any).monthly_limit || 1000 })
    }
    setLoading(false)
  }

  async function handleConnect() {
    if (!form.phone_id || !form.token) {
      setConnectError('Phone ID e Token são obrigatórios.')
      return
    }
    setConnecting(true)
    setConnectError(null)

    // Testar token chamando a API da Meta
    try {
      const testRes = await fetch(`https://graph.facebook.com/v18.0/${form.phone_id}?fields=display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${form.token}` }
      })
      if (!testRes.ok) {
        const err = await testRes.json().catch(() => ({}))
        throw new Error((err as any)?.error?.message || 'Token ou Phone ID inválido')
      }
      const testData = await testRes.json()
      const verifiedName = (testData as any).verified_name || form.display_name

      // Salvar na instituição
      await supabase.from('institutions').update({
        whatsapp_phone_id:    form.phone_id,
        whatsapp_token:       form.token,
        whatsapp_phone_number: form.phone_number || (testData as any).display_phone_number || '',
        whatsapp_display_name: verifiedName,
        whatsapp_connected:   true,
      }).eq('id', institutionId)

      await loadConfig()
    } catch (e) {
      setConnectError((e as Error).message)
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar o WhatsApp desta escola? O bot deixará de funcionar.')) return
    setDisconnecting(true)
    await supabase.from('institutions').update({
      whatsapp_phone_id: null, whatsapp_token: null,
      whatsapp_phone_number: null, whatsapp_display_name: null,
      whatsapp_connected: false,
    }).eq('id', institutionId).catch(() => {})
    setMetaConfig(null)
    setForm({ phone_id: '', token: '', phone_number: '', display_name: '' })
    setDisconnecting(false)
  }

  const usagePct = Math.min(100, Math.round((usage.count / usage.limit) * 100))
  const usageColor = usagePct >= 90 ? '#EF4444' : usagePct >= 70 ? '#F59E0B' : '#10B981'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #14b8a6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  // ── MODO 2: Conectado ─────────────────────────────────────────
  if (metaConfig?.whatsapp_phone_id) {
    return (
      <>
        {showBotConfig && institutionId && (
          <BotConfigModal institutionId={institutionId} onClose={() => setShowBotConfig(false)} />
        )}

        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status card */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, background: '#ECFDF5', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Wifi style={{ width: 22, height: 22, color: '#10B981' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A' }}>WhatsApp conectado</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>{metaConfig.whatsapp_display_name}</div>
              </div>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#ECFDF5', borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#059669' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
                Online
              </span>
            </div>

            <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, fontSize: 13, color: '#475569', marginBottom: 16 }}>
              Número: <strong>{metaConfig.whatsapp_phone_number || '—'}</strong><br />
              Webhook: <code style={{ fontSize: 11 }}>https://meuinscribo.com.br/api/whatsapp/webhook</code>
            </div>

            {/* Uso mensal */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Conversas este mês</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: usageColor }}>{usage.count} / {usage.limit.toLocaleString('pt-BR')}</span>
              </div>
              <div style={{ height: 8, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${usagePct}%`, background: usageColor, borderRadius: 999, transition: 'width 0.4s' }} />
              </div>
              {usagePct >= 90 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#DC2626' }}>
                  <AlertCircle style={{ width: 14, height: 14 }} />
                  Limite quase atingido. Entre em contato para aumentar.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowBotConfig(true)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#0d9488', cursor: 'pointer' }}>
                <Bot style={{ width: 15, height: 15 }} /> Configurar Bot
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#E11D48', cursor: 'pointer', opacity: disconnecting ? 0.6 : 1 }}>
                <WifiOff style={{ width: 15, height: 15 }} /> {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          </div>

          {/* Instruções webhook */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>⚠️ Configure o webhook no Meta</div>
            <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>
              Em <strong>developers.facebook.com</strong> → seu app → WhatsApp → Configuração:<br />
              URL do webhook: <code style={{ background: '#FEF3C7', padding: '2px 6px', borderRadius: 4 }}>https://meuinscribo.com.br/api/whatsapp/webhook</code><br />
              Token de verificação: <code style={{ background: '#FEF3C7', padding: '2px 6px', borderRadius: 4 }}>inscribo_webhook_2026</code><br />
              Assinar os campos: <strong>messages</strong>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── MODO 1: Não configurado ──────────────────────────────────
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #14b8a6, #1e2d6b)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <MessageCircle style={{ width: 30, height: 30, color: '#fff' }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: '0 0 8px' }}>Conectar WhatsApp Business API</h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 24px', lineHeight: 1.6 }}>
            Use a API Oficial da Meta para atender pais com bot IA e enviar mensagens diretamente pelo Inscribo.
          </p>
        </div>

        {/* Passos */}
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9' }}>
          {[
            { n: 1, label: 'Criar app no Meta', desc: 'developers.facebook.com → Criar app → WhatsApp' },
            { n: 2, label: 'Colar credenciais', desc: 'Phone ID e token de acesso' },
            { n: 3, label: 'Pronto!', desc: 'WhatsApp conectado ao Inscribo' },
          ].map((s, i) => (
            <div key={s.n} style={{ flex: 1, padding: '14px 12px', textAlign: 'center', borderRight: i < 2 ? '1px solid #F1F5F9' : 'none', background: '#FAFAFA' }}>
              <div style={{ width: 28, height: 28, background: '#14b8a6', borderRadius: '50%', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>{s.n}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Formulário */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone ID <span style={{ color: '#EF4444' }}>*</span></label>
            <input value={form.phone_id} onChange={e => setForm(f => ({ ...f, phone_id: e.target.value }))}
              className={inputCls} placeholder="Ex: 1007880222413531" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Token de acesso permanente <span style={{ color: '#EF4444' }}>*</span></label>
            <input value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
              className={inputCls} placeholder="EAAOSNzt..." type="password" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Número de telefone</label>
            <input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
              className={inputCls} placeholder="Ex: +55 83 99999-9999" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Nome de exibição da escola</label>
            <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              className={inputCls} placeholder="Ex: Colégio São João" />
          </div>

          {connectError && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 10, fontSize: 13, color: '#BE123C' }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
              {connectError}
            </div>
          )}

          <button onClick={handleConnect} disabled={connecting || !form.phone_id || !form.token}
            style={{ padding: '13px', background: 'linear-gradient(135deg, #14b8a6, #0d9488)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (connecting || !form.phone_id || !form.token) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {connecting ? <><RefreshCw style={{ width: 16, height: 16, animation: 'spin 0.8s linear infinite' }} /> Verificando credenciais...</> : <><Check style={{ width: 16, height: 16 }} /> Conectar WhatsApp</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Identidade Visual ───────────────────────────────────────────────────
function IdentidadeTab() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!

  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#0F6E56')
  const [secondaryColor, setSecondaryColor] = useState('#1D9E75')
  const [institutionName, setInstitutionName] = useState('')
  const [whiteFilter, setWhiteFilter] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadData() }, []) // eslint-disable-line

  async function loadData() {
    const { data } = await supabase
      .from('institutions')
      .select('name, logo_url, primary_color, secondary_color')
      .eq('id', institutionId)
      .maybeSingle()
    if (data) {
      setInstitutionName(data.name ?? '')
      setLogoUrl(data.logo_url ?? null)
      setPrimaryColor(data.primary_color ?? '#0F6E56')
      setSecondaryColor(data.secondary_color ?? '#1D9E75')
    }
  }

  async function handleLogoUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) { alert('Arquivo muito grande. Máximo 2MB.'); return }
    const ext = file.name.split('.').pop()
    const fileName = `${institutionId}.${ext}`
    setUploading(true)
    const { error } = await supabase.storage
      .from('institution-logos')
      .upload(fileName, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage
        .from('institution-logos')
        .getPublicUrl(fileName)
      setLogoUrl(urlData.publicUrl + '?t=' + Date.now())
    } else {
      alert('Erro ao fazer upload: ' + error.message)
    }
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    await supabase
      .from('institutions')
      .update({ logo_url: logoUrl, primary_color: primaryColor, secondary_color: secondaryColor })
      .eq('id', institutionId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900, alignItems: 'start' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Esquerda: formulário */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Logo */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 16px' }}>Logo da escola</h3>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false)
              const f = e.dataTransfer.files[0]
              if (f) handleLogoUpload(f)
            }}
            onClick={() => document.getElementById('logo-file-input')?.click()}
            style={{
              border: `2px dashed ${dragOver ? primaryColor : '#CBD5E1'}`,
              borderRadius: 12, padding: '28px 16px', textAlign: 'center',
              cursor: 'pointer', background: dragOver ? `${primaryColor}10` : '#F8FAFC',
              transition: 'all 0.2s', marginBottom: 14,
            }}
          >
            <input id="logo-file-input" type="file" accept=".png,.jpg,.jpeg,.svg,.webp"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
            {uploading ? (
              <div>
                <div style={{ width: 28, height: 28, border: `3px solid ${primaryColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Fazendo upload...</p>
              </div>
            ) : logoUrl ? (
              <div>
                <img src={logoUrl} alt="logo" style={{ height: 48, objectFit: 'contain', margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Clique ou arraste para trocar</p>
              </div>
            ) : (
              <div>
                <Upload size={28} color="#CBD5E1" style={{ margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#64748B', margin: '0 0 4px' }}>Arraste ou clique para selecionar</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>PNG, JPG, SVG — máx 2MB</p>
              </div>
            )}
          </div>
          {logoUrl && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={whiteFilter} onChange={e => setWhiteFilter(e.target.checked)} />
              Tornar logo branca sobre fundo colorido (preview)
            </label>
          )}
        </div>

        {/* Cores */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 16px' }}>Cores da marca</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Cor primária', val: primaryColor, set: setPrimaryColor },
              { label: 'Cor secundária', val: secondaryColor, set: setSecondaryColor },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>{label}</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="color" value={val} onChange={e => set(e.target.value)}
                    style={{ width: 44, height: 44, borderRadius: 10, border: '2px solid #E2E8F0', cursor: 'pointer', padding: 3, background: 'white' }} />
                  <input type="text" value={val} onChange={e => set(e.target.value)} maxLength={7}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, color: '#1A2B4A', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: val, border: '1px solid #E2E8F0', flexShrink: 0 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, border: 'none', background: saved ? '#10B981' : '#00A896', color: 'white', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, alignSelf: 'flex-start', transition: 'background 0.2s' }}>
          {saved ? <><Check size={15} /> Salvo!</> : saving ? 'Salvando...' : <><Save size={15} /> Salvar identidade visual</>}
        </button>
      </div>

      {/* Direita: preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 16px' }}>Preview — páginas públicas</h3>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
          {/* Header branded */}
          <header style={{ backgroundColor: primaryColor, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {logoUrl ? (
              <img src={logoUrl} alt={institutionName} style={{ height: 36, objectFit: 'contain', filter: whiteFilter ? 'brightness(0) invert(1)' : 'none' }} />
            ) : (
              <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>
                {institutionName.charAt(0) || 'E'}
              </div>
            )}
            <span style={{ color: 'white', fontWeight: 600, fontSize: 17, letterSpacing: '-0.3px' }}>
              {institutionName || 'Nome da Escola'}
            </span>
          </header>
          {/* Barra de progresso mockada */}
          <div style={{ height: 4, background: '#E2E8F0' }}>
            <div style={{ height: '100%', background: primaryColor, width: '42%' }} />
          </div>
          {/* Conteúdo mockado */}
          <div style={{ padding: 20, background: '#F8FAFC' }}>
            <div style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #E2E8F0', marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 6px', textTransform: 'uppercase', fontWeight: 600 }}>Pergunta 1 de 7</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1E2D6B', margin: '0 0 14px' }}>Como você avalia a escola de forma geral?</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} style={{ padding: '8px 0', borderRadius: 8, border: `2px solid ${n === 5 ? primaryColor : '#E2E8F0'}`, background: n === 5 ? primaryColor : 'white', color: n === 5 ? 'white' : '#374151', textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{n}</div>
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 20px', background: primaryColor, borderRadius: 12, textAlign: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}>
              Próxima pergunta →
            </div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '12px 0 0', textAlign: 'center' }}>
          Aparece assim nas pesquisas de satisfação e de transferência
        </p>
      </div>
    </div>
  )
}

// ─── SystemSettings ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'geral',      label: 'Geral',      icon: Building },
  { id: 'escola',     label: 'Escola',     icon: GraduationCap },
  { id: 'identidade', label: 'Identidade', icon: Palette },
  { id: 'whatsapp',   label: 'WhatsApp',   icon: MessageCircle },
]

export default function SystemSettings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('geral')
  const [showSchoolSetup, setShowSchoolSetup] = useState(false)

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Settings style={{ width: 18, height: 18, color: '#64748B' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Configurações</h1>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Gerencie as configurações da instituição</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? '#FFFFFF' : '#64748B',
                background: active ? '#1A2B4A' : 'transparent',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Icon style={{ width: 14, height: 14 }} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'geral' && <GeralTab />}
      {activeTab === 'identidade' && <IdentidadeTab />}
      {activeTab === 'whatsapp' && <WhatsAppTab />}
      {activeTab === 'escola' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 28, maxWidth: 500 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', marginBottom: 6 }}>Configurações da Escola</h3>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 1.6 }}>
            Atualize as informações da sua escola, séries oferecidas e mensalidade média.
          </p>
          <button
            onClick={() => setShowSchoolSetup(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10,
              background: '#00A896', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
            <GraduationCap size={15} /> Editar configurações da escola
          </button>
        </div>
      )}

      {showSchoolSetup && user?.institution_id && (
        <SchoolSetupModal
          institutionId={user.institution_id}
          initialStep={1}
          editMode={true}
          onComplete={() => setShowSchoolSetup(false)}
        />
      )}
    </div>
  )
}
