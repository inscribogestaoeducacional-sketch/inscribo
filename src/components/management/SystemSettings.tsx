import React, { useState, useEffect, useRef } from 'react'
import {
  Save, Upload, Building, Mail, Phone, Globe, Palette,
  MessageCircle, Wifi, WifiOff, RefreshCw, Settings,
  Bot, Users, X, Plus, Check, AlertCircle, GraduationCap,
  MapPin, FileText, DollarSign, Loader2, CheckCircle, Clock, GitBranch, ShieldOff, Trash2
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import SchoolSetupModal from '../onboarding/SchoolSetupModal'
import FlowEditor from '../whatsapp/FlowEditor'

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00A896] focus:border-[#00A896] outline-none transition-all'

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}`, borderRadius: 12, padding: '12px 18px', fontSize: 13, color: ok ? '#166534' : '#DC2626', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
      {ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}{msg}
    </div>
  )
}

// ─── Aba: Geral ───────────────────────────────────────────────────────────────
function GeralTab({ institutionId, onToast }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void }) {
  const [data, setData] = useState({
    name: '', email: '', phone: '', city: '', state: '', cnpj: '', plan: '', plan_status: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [])

  const load = async () => {
    setLoading(true)
    const { data: inst } = await supabase
      .from('institutions')
      .select('name, email, phone, city, state, cnpj, plan, plan_status, monthly_value, billing_due_day, trial_ends_at')
      .eq('id', institutionId)
      .single()
    if (mountedRef.current) {
      if (inst) setData(inst as any)
      setLoading(false)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('institutions')
      .update({ name: data.name, email: data.email, phone: data.phone, city: data.city, state: data.state, cnpj: data.cnpj })
      .eq('id', institutionId)
    setSaving(false)
    if (error) onToast('Erro ao salvar: ' + error.message, false)
    else onToast('Configurações salvas com sucesso!')
  }

  const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} color="#00A896" className="animate-spin" />
    </div>
  )

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 700 }}>
      {/* Dados básicos */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Building size={16} color="#64748B" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Dados da Instituição</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Nome da Instituição *</label>
            <input required className={inputCls} value={data.name} onChange={e => setData({ ...data, name: e.target.value })} placeholder="Nome completo da escola" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>E-mail</label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input type="email" className={inputCls} style={{ paddingLeft: 32 }} value={data.email || ''} onChange={e => setData({ ...data, email: e.target.value })} placeholder="contato@escola.com" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Telefone</label>
            <div style={{ position: 'relative' }}>
              <Phone size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input className={inputCls} style={{ paddingLeft: 32 }} value={data.phone || ''} onChange={e => setData({ ...data, phone: e.target.value })} placeholder="(83) 99999-9999" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>CNPJ</label>
            <div style={{ position: 'relative' }}>
              <FileText size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input className={inputCls} style={{ paddingLeft: 32 }} value={data.cnpj || ''} onChange={e => setData({ ...data, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Cidade</label>
            <div style={{ position: 'relative' }}>
              <MapPin size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input className={inputCls} style={{ paddingLeft: 32 }} value={data.city || ''} onChange={e => setData({ ...data, city: e.target.value })} placeholder="Patos" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Estado</label>
            <select className={inputCls} value={data.state || ''} onChange={e => setData({ ...data, state: e.target.value })}>
              <option value="">Selecione...</option>
              {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Plano — somente leitura */}
      <div style={{ background: '#F8FAFC', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <DollarSign size={16} color="#64748B" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Plano e Faturamento</span>
          <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 4 }}>— gerenciado pelo admin</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Plano atual', value: (data as any).plan || 'Básico' },
            { label: 'Status', value: (data as any).plan_status === 'active' ? '✅ Ativo' : (data as any).plan_status === 'trial' ? '🕐 Trial' : (data as any).plan_status || '—' },
            { label: 'Mensalidade', value: (data as any).monthly_value ? `R$ ${Number((data as any).monthly_value).toLocaleString('pt-BR')}` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '12px 16px' }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 4px' }}>{label}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>
        {(data as any).trial_ends_at && (
          <p style={{ fontSize: 12, color: '#F59E0B', marginTop: 10, marginBottom: 0 }}>
            ⚠️ Trial encerra em: {new Date((data as any).trial_ends_at).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : <><Save size={13} />Salvar configurações</>}
        </button>
      </div>
    </form>
  )
}

// ─── Aba: Identidade Visual ───────────────────────────────────────────────────
function IdentidadeTab({ institutionId, onToast }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#00A896')
  const [secondaryColor, setSecondaryColor] = useState('#1A2B4A')
  const [institutionName, setInstitutionName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [])

  const load = async () => {
    const { data } = await supabase.from('institutions').select('name,logo_url,primary_color,secondary_color').eq('id', institutionId).maybeSingle()
    if (mountedRef.current && data) {
      setInstitutionName(data.name ?? '')
      setLogoUrl(data.logo_url ?? null)
      setPrimaryColor(data.primary_color ?? '#00A896')
      setSecondaryColor(data.secondary_color ?? '#1A2B4A')
    }
  }

  const handleLogoUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { onToast('Arquivo muito grande. Máx 2MB', false); return }
    const ext = file.name.split('.').pop()
    setUploading(true)
    const { error } = await supabase.storage.from('institution-logos').upload(`${institutionId}.${ext}`, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('institution-logos').getPublicUrl(`${institutionId}.${ext}`)
      setLogoUrl(urlData.publicUrl + '?t=' + Date.now())
    } else onToast('Erro ao fazer upload', false)
    setUploading(false)
  }

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('institutions').update({ logo_url: logoUrl, primary_color: primaryColor, secondary_color: secondaryColor }).eq('id', institutionId)
    setSaving(false)
    if (error) onToast('Erro ao salvar', false)
    else onToast('Identidade visual salva!')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Logo */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 16px' }}>Logo da escola</h3>
          <div onClick={() => document.getElementById('logo-input')?.click()}
            style={{ border: '2px dashed #CBD5E1', borderRadius: 12, padding: '28px 16px', textAlign: 'center', cursor: 'pointer', background: '#F8FAFC', marginBottom: 12 }}>
            <input id="logo-input" type="file" accept=".png,.jpg,.jpeg,.svg,.webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
            {uploading ? <Loader2 size={28} color="#00A896" className="animate-spin" style={{ margin: '0 auto' }} />
              : logoUrl ? <><img src={logoUrl} alt="logo" style={{ height: 48, objectFit: 'contain', margin: '0 auto 8px', display: 'block' }} /><p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Clique para trocar</p></>
              : <><Upload size={28} color="#CBD5E1" style={{ margin: '0 auto 8px', display: 'block' }} /><p style={{ fontSize: 13, fontWeight: 600, color: '#64748B', margin: '0 0 4px' }}>Clique para selecionar</p><p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>PNG, JPG, SVG — máx 2MB</p></>}
          </div>
        </div>

        {/* Cores */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 16px' }}>Cores da marca</h3>
          {[{ label: 'Cor primária', val: primaryColor, set: setPrimaryColor }, { label: 'Cor secundária', val: secondaryColor, set: setSecondaryColor }].map(({ label, val, set }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>{label}</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="color" value={val} onChange={e => set(e.target.value)} style={{ width: 44, height: 44, borderRadius: 10, border: '2px solid #E2E8F0', cursor: 'pointer', padding: 3 }} />
                <input type="text" value={val} onChange={e => set(e.target.value)} maxLength={7} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, fontFamily: 'monospace', outline: 'none' }} />
                <div style={{ width: 36, height: 36, borderRadius: 8, background: val, border: '1px solid #E2E8F0' }} />
              </div>
            </div>
          ))}
        </div>

        <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10, border: 'none', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', opacity: saving ? 0.7 : 1 }}>
          {saving ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : <><Save size={13} />Salvar identidade visual</>}
        </button>
      </div>

      {/* Preview */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 16px' }}>Preview</h3>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
          <header style={{ backgroundColor: primaryColor, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            {logoUrl ? <img src={logoUrl} alt={institutionName} style={{ height: 32, objectFit: 'contain' }} />
              : <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>{institutionName.charAt(0) || 'E'}</div>}
            <span style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>{institutionName || 'Nome da Escola'}</span>
          </header>
          <div style={{ padding: 16, background: '#F8FAFC' }}>
            <div style={{ background: 'white', borderRadius: 10, padding: 14, border: '1px solid #E2E8F0' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 12px' }}>Como você avalia a escola?</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1,2,3,4,5].map(n => <div key={n} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `2px solid ${n === 5 ? primaryColor : '#E2E8F0'}`, background: n === 5 ? primaryColor : 'white', color: n === 5 ? 'white' : '#374151', textAlign: 'center', fontWeight: 700 }}>{n}</div>)}
              </div>
            </div>
            <div style={{ marginTop: 10, padding: '10px', background: primaryColor, borderRadius: 10, textAlign: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}>Próxima →</div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '10px 0 0', textAlign: 'center' }}>Aparece nas pesquisas de satisfação e transferência</p>
      </div>
    </div>
  )
}

// ─── Aba: WhatsApp ────────────────────────────────────────────────────────────
const GRADE_OPTS = ['Infantil I','Infantil II','Infantil III','Infantil IV','Infantil V','1º ao 5º EF','6º ao 9º EF','Ensino Médio']

function BotConfigModal({ institutionId, onClose }: { institutionId: string; onClose: () => void }) {
  const [cfg, setCfg] = useState({ bot_enabled: true, school_name: '', welcome_message: 'Olá! Seja bem-vindo! 😊 Como posso te ajudar?', bot_tone: 'friendly' as any, grades_offered: [] as string[], monthly_fee_info: '', handoff_keywords: ['atendente','humano','falar com pessoa'], faq_data: {} as Record<string,string> })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newKw, setNewKw] = useState('')
  const [newFaqQ, setNewFaqQ] = useState('')
  const [newFaqA, setNewFaqA] = useState('')

  const botMountedRef = useRef(true)
  useEffect(() => {
    botMountedRef.current = true
    ;(async () => {
      try {
        const { data } = await supabase.from('whatsapp_bot_config').select('*').eq('institution_id', institutionId).single()
        if (botMountedRef.current) { if (data) setCfg(data as any); setLoading(false) }
      } catch {
        if (botMountedRef.current) setLoading(false)
      }
    })()
    return () => { botMountedRef.current = false }
  }, [])

  const save = async () => {
    setSaving(true)
    await supabase.from('whatsapp_bot_config').upsert({ ...cfg, institution_id: institutionId }, { onConflict: 'institution_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 48 }}><Loader2 size={32} color="#00A896" className="animate-spin" /></div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Bot size={18} color="#00A896" /><span style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A' }}>Configurar Bot</span></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <div><div style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A' }}>Bot ativo</div><div style={{ fontSize: 12, color: '#64748B' }}>Responde automaticamente as primeiras mensagens</div></div>
            <button onClick={() => setCfg(c => ({ ...c, bot_enabled: !c.bot_enabled }))} style={{ width: 44, height: 24, borderRadius: 999, background: cfg.bot_enabled ? '#00A896' : '#CBD5E1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 3, left: cfg.bot_enabled ? 22 : 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
            </button>
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nome da escola</label><input value={cfg.school_name} onChange={e => setCfg(c => ({ ...c, school_name: e.target.value }))} className={inputCls} placeholder="Ex: Colégio São João" /></div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Tom do bot</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['friendly','formal','casual'] as const).map(t => (
                <button key={t} onClick={() => setCfg(c => ({ ...c, bot_tone: t }))} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: `2px solid ${cfg.bot_tone === t ? '#00A896' : '#E2E8F0'}`, background: cfg.bot_tone === t ? '#E6F7F5' : '#fff', color: cfg.bot_tone === t ? '#00A896' : '#64748B', cursor: 'pointer' }}>
                  {t === 'friendly' ? '😊 Amigável' : t === 'formal' ? '👔 Formal' : '😎 Descontraído'}
                </button>
              ))}
            </div>
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Mensagem de boas-vindas</label><textarea value={cfg.welcome_message} onChange={e => setCfg(c => ({ ...c, welcome_message: e.target.value }))} rows={3} className={inputCls} style={{ resize: 'vertical' }} /></div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Séries oferecidas</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {GRADE_OPTS.map(g => <button key={g} onClick={() => setCfg(c => ({ ...c, grades_offered: c.grades_offered.includes(g) ? c.grades_offered.filter(x => x !== g) : [...c.grades_offered, g] }))} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: `2px solid ${cfg.grades_offered.includes(g) ? '#00A896' : '#E2E8F0'}`, background: cfg.grades_offered.includes(g) ? '#E6F7F5' : '#fff', color: cfg.grades_offered.includes(g) ? '#00A896' : '#64748B', cursor: 'pointer' }}>{cfg.grades_offered.includes(g) && '✓ '}{g}</button>)}
            </div>
          </div>
          <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Informações de mensalidade</label><textarea value={cfg.monthly_fee_info} onChange={e => setCfg(c => ({ ...c, monthly_fee_info: e.target.value }))} rows={2} className={inputCls} placeholder="Ex: Mensalidade de R$ 800 a R$ 1.200 conforme a série." style={{ resize: 'vertical' }} /></div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Palavras para transferir ao humano</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {cfg.handoff_keywords.map(kw => <span key={kw} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 999, fontSize: 12, color: '#92400E' }}>{kw}<button onClick={() => setCfg(c => ({ ...c, handoff_keywords: c.handoff_keywords.filter(k => k !== kw) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D97706', padding: 0 }}>×</button></span>)}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newKw} onChange={e => setNewKw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newKw.trim()) { setCfg(c => ({ ...c, handoff_keywords: [...c.handoff_keywords, newKw.trim()] })); setNewKw('') }}} className={inputCls} placeholder="Adicionar palavra..." style={{ flex: 1 }} />
              <button onClick={() => { if (newKw.trim()) { setCfg(c => ({ ...c, handoff_keywords: [...c.handoff_keywords, newKw.trim()] })); setNewKw('') }}} style={{ padding: '8px 14px', background: '#00A896', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}><Plus size={14} /></button>
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saved ? '#16a34a' : '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            {saved ? <><Check size={14} />Salvo!</> : saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </div>
    </div>
  )
}

const FLOW_DAYS = [
  { id: 'MON', label: 'Seg' }, { id: 'TUE', label: 'Ter' }, { id: 'WED', label: 'Qua' },
  { id: 'THU', label: 'Qui' }, { id: 'FRI', label: 'Sex' }, { id: 'SAT', label: 'Sáb' }, { id: 'SUN', label: 'Dom' },
]

const WA_SECTIONS = [
  { id: 'conexao',  icon: '📡', label: 'Conexão' },
  { id: 'horario',  icon: '🕐', label: 'Horário' },
  { id: 'respostas',icon: '⚡', label: 'Respostas' },
  { id: 'equipe',   icon: '👥', label: 'Equipe' },
  { id: 'bloqueios',icon: '🚫', label: 'Bloqueios' },
  { id: 'pesquisa', icon: '⭐', label: 'Pesquisa' },
]

function WhatsAppTab({ institutionId }: { institutionId: string }) {
  const [metaConfig, setMetaConfig]       = useState<any>(null)
  const [loading, setLoading]             = useState(true)
  const [showBot, setShowBot]             = useState(false)
  const [usage, setUsage]                 = useState({ count: 0, limit: 1000 })
  const [phoneRecord, setPhoneRecord]     = useState<any>(null)
  const [globalToken, setGlobalToken]     = useState('')
  const [testing, setTesting]             = useState(false)
  const [testResult, setTestResult]       = useState<{ ok: boolean; msg: string } | null>(null)

  // ── Flow config ──
  const [flow, setFlow] = useState({
    is_active:            true,
    working_days:         ['MON','TUE','WED','THU','FRI'] as string[],
    working_start:        '07:00',
    working_end:          '17:00',
    timezone:             'America/Fortaleza',
    welcome_message:      'Olá! Bem-vindo! Como posso ajudar? 😊',
    off_hours_message:    'Olá! Nosso atendimento é de seg a sex das 7h às 17h. Sua mensagem foi registrada e retornaremos em breve! 👋',
    menu_message:         '',
    menu_enabled:         false,
    menu_options:            [] as { id: string; label: string; keyword: string; assignee_id: string; assignee_name: string }[],
    bot_enabled:                 false,
    transfer_after_messages:     5,
    default_assignee_id:         '',
    satisfaction_survey_enabled: false,
    satisfaction_message: 'Como você avalia nosso atendimento hoje? Seu feedback é muito importante para nós! 😊',
  })
  const [flowUsers, setFlowUsers]     = useState<any[]>([])
  const [savingFlow, setSavingFlow]   = useState(false)
  const [flowSaved, setFlowSaved]     = useState(false)
  const [showFlowEditor, setShowFlowEditor] = useState(false)

  // Quick replies
  const [quickReplies, setQuickReplies] = useState<{ id: string; title: string; message: string; order_index: number }[]>([])
  const [newQR, setNewQR]               = useState({ title: '', message: '' })
  const [savingQR, setSavingQR]         = useState(false)
  const [editQRId, setEditQRId]         = useState<string | null>(null)
  const [editQRData, setEditQRData]     = useState({ title: '', message: '' })
  // Attendants
  const [attendants, setAttendants]     = useState<{ id: string; full_name: string; working_hours_start: string; working_hours_end: string; working_days: string[] }[]>([])
  const [savingAtt, setSavingAtt]       = useState<string | null>(null)
  // Real monthly count
  const [monthlyConvCount, setMonthlyConvCount] = useState(0)
  // Blacklist
  const [blacklist, setBlacklist] = useState<{ id: string; phone_number: string; reason: string | null; created_at: string }[]>([])
  const [showAddBlock, setShowAddBlock] = useState(false)
  const [newBlockNum, setNewBlockNum] = useState('')
  const [newBlockReason, setNewBlockReason] = useState('')
  const [savingBlock, setSavingBlock] = useState(false)
  const [waSection, setWaSection] = useState('conexao')

  // Groups
  const [groups, setGroups] = useState<{ id: string; name: string; emoji: string; member_ids: string[] }[]>([])
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<any>(null)
  const [groupForm, setGroupForm] = useState({ name: '', emoji: '👥', member_ids: [] as string[] })

  // Timeout inactivity
  const [timeoutMinutes, setTimeoutMinutes]     = useState(15)
  const [timeoutGroupId, setTimeoutGroupId]     = useState('')
  const [timeoutAssigneeId, setTimeoutAssigneeId] = useState('')
  const [timeoutMessage, setTimeoutMessage]     = useState('Um momento, estou te conectando com um atendente! 👋')

  const waMountedRef = useRef(true)
  useEffect(() => {
    waMountedRef.current = true
    loadConfig()
    return () => { waMountedRef.current = false }
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      // Fetch global WA token from platform_settings
      const { data: tokenRow, error: tokenErr } = await supabase
        .from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
      console.log('[SystemSettings] token query →', { value: tokenRow?.value?.slice(0, 10), error: tokenErr?.message })
      const loadedToken = tokenRow?.value || ''
      if (waMountedRef.current) setGlobalToken(loadedToken)
    } catch (e) { console.error('[SystemSettings] token fetch error:', e) }
    try {
      const { data } = await supabase.from('institutions')
        .select('whatsapp_phone_id,whatsapp_phone_number,whatsapp_display_name,whatsapp_connected')
        .eq('id', institutionId).single()
      if (waMountedRef.current && data?.whatsapp_phone_id) {
        setMetaConfig(data)
        const monthYear = new Date().toISOString().slice(0, 7)
        const { data: u } = await supabase.from('whatsapp_usage')
          .select('conversation_count,monthly_limit')
          .eq('institution_id', institutionId).eq('month_year', monthYear).maybeSingle()
        if (waMountedRef.current && u) setUsage({ count: (u as any).conversation_count || 0, limit: (u as any).monthly_limit || 1000 })
        const { data: pr } = await supabase.from('whatsapp_phone_numbers')
          .select('phone_number,display_name,phone_number_id')
          .eq('institution_id', institutionId)
          .eq('is_active', true)
          .maybeSingle()
        if (waMountedRef.current && pr) setPhoneRecord(pr)
      }
    } catch {}
    try {
      const { data: flowData } = await supabase.from('whatsapp_flows').select('*').eq('institution_id', institutionId).maybeSingle()
      if (waMountedRef.current && flowData) {
        setFlow(f => ({ ...f, ...flowData }))
        if (flowData.timeout_minutes)    setTimeoutMinutes(flowData.timeout_minutes)
        if (flowData.timeout_group_id)   setTimeoutGroupId(flowData.timeout_group_id)
        if (flowData.timeout_assignee_id) setTimeoutAssigneeId(flowData.timeout_assignee_id)
        if (flowData.timeout_message)    setTimeoutMessage(flowData.timeout_message)
      }
    } catch {}
    try {
      const { data: users } = await supabase.from('users').select('id,full_name').eq('institution_id', institutionId)
      if (waMountedRef.current) setFlowUsers(users || [])
    } catch {}
    try {
      const { data: qr } = await supabase.from('whatsapp_quick_replies')
        .select('id,title,message,order_index')
        .eq('institution_id', institutionId)
        .order('order_index', { ascending: true })
      if (waMountedRef.current) setQuickReplies(qr || [])
    } catch {}
    try {
      const { data: atts } = await supabase.from('users')
        .select('id,full_name,working_hours_start,working_hours_end,working_days')
        .eq('institution_id', institutionId)
      if (waMountedRef.current) setAttendants((atts || []).map((a: any) => ({
        id: a.id,
        full_name: a.full_name,
        working_hours_start: a.working_hours_start || '08:00',
        working_hours_end:   a.working_hours_end   || '18:00',
        working_days:        a.working_days        || ['MON','TUE','WED','THU','FRI'],
      })))
    } catch {}
    try {
      const startOfMonth = new Date()
      startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
      const { count } = await supabase.from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .gte('created_at', startOfMonth.toISOString())
      if (waMountedRef.current) setMonthlyConvCount(count || 0)
    } catch {}
    try {
      const { data: bl } = await supabase.from('whatsapp_blacklist')
        .select('id,phone_number,reason,created_at')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
      if (waMountedRef.current) setBlacklist((bl || []) as { id: string; phone_number: string; reason: string | null; created_at: string }[])
    } catch {}
    try {
      const { data: groupsData } = await supabase.from('whatsapp_groups')
        .select('id, name, emoji, member_ids')
        .eq('institution_id', institutionId)
        .order('created_at')
      if (waMountedRef.current) setGroups((groupsData || []) as { id: string; name: string; emoji: string; member_ids: string[] }[])
    } catch {}
    if (waMountedRef.current) setLoading(false)
  }

  const handleAddBlock = async () => {
    if (!newBlockNum.trim()) return
    setSavingBlock(true)
    try {
      const phone = newBlockNum.trim().replace(/\D/g, '')
      const { data, error } = await supabase.from('whatsapp_blacklist').insert({
        institution_id: institutionId,
        phone_number:   phone,
        reason:         newBlockReason.trim() || null,
      }).select('id,phone_number,reason,created_at').single()
      if (!error && data) {
        setBlacklist(prev => [data as { id: string; phone_number: string; reason: string | null; created_at: string }, ...prev])
        setNewBlockNum(''); setNewBlockReason(''); setShowAddBlock(false)
      }
    } catch {}
    setSavingBlock(false)
  }

  const handleRemoveBlock = async (id: string) => {
    if (!confirm('Remover número da blacklist?')) return
    await supabase.from('whatsapp_blacklist').delete().eq('id', id).eq('institution_id', institutionId)
    setBlacklist(prev => prev.filter(b => b.id !== id))
  }

  const handleSaveFlow = async () => {
    setSavingFlow(true)
    try {
      const saveData = {
        institution_id:              institutionId,
        bot_enabled:                 flow.bot_enabled,
        is_active:                   true,
        working_days:                flow.working_days,
        working_start:               flow.working_start,
        working_end:                 flow.working_end,
        lunch_start:                 (flow as any).lunch_start,
        lunch_end:                   (flow as any).lunch_end,
        timezone:                    flow.timezone,
        welcome_message:             flow.welcome_message,
        off_hours_message:           flow.off_hours_message,
        menu_enabled:                flow.menu_enabled,
        menu_message:                flow.menu_message,
        menu_options:                flow.menu_options,
        satisfaction_survey_enabled: flow.satisfaction_survey_enabled,
        satisfaction_message:        flow.satisfaction_message,
        timeout_minutes:             timeoutMinutes,
        timeout_group_id:            timeoutGroupId || null,
        timeout_assignee_id:         timeoutAssigneeId || null,
        timeout_assignee_name:       timeoutAssigneeId
          ? (flowUsers.find(u => u.id === timeoutAssigneeId)?.full_name || null)
          : null,
        timeout_message:             timeoutMessage,
      }

      console.log('[SAVE FLOW] dados:', JSON.stringify(saveData))

      const { error } = await supabase
        .from('whatsapp_flows')
        .upsert(saveData, { onConflict: 'institution_id' })

      if (error) {
        console.error('[SAVE FLOW] erro:', JSON.stringify(error))
        alert('Erro ao salvar: ' + error.message)
        return
      }

      setFlowSaved(true)
      setTimeout(() => setFlowSaved(false), 2500)
    } catch (e) {
      console.error('[SAVE FLOW] exception:', e)
    } finally {
      setSavingFlow(false)
    }
  }

  const handleTestConnection = async () => {
    const phoneId = metaConfig?.whatsapp_phone_id || phoneRecord?.phone_number_id
    const token   = globalToken
    if (!phoneId || !token) { setTestResult({ ok: false, msg: 'Phone ID ou token não configurado.' }); return }
    setTesting(true); setTestResult(null)
    try {
      const res  = await fetch(`https://graph.facebook.com/v19.0/${phoneId}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        setTestResult({ ok: true, msg: `✅ Conectado: ${data.verified_name} (${data.display_phone_number})` })
      } else {
        setTestResult({ ok: false, msg: `❌ ${data.error?.message || 'Token inválido'}` })
      }
    } catch (e) {
      setTestResult({ ok: false, msg: '❌ Erro de rede ao testar conexão.' })
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 6000)
    }
  }

  const handleAddQR = async () => {
    if (!newQR.title || !newQR.message) return
    setSavingQR(true)
    try {
      const { data } = await supabase.from('whatsapp_quick_replies').insert({
        institution_id: institutionId,
        title:       newQR.title.trim(),
        message:     newQR.message.trim(),
        order_index: quickReplies.length,
      }).select().single()
      if (data) setQuickReplies(prev => [...prev, data as any])
      setNewQR({ title: '', message: '' })
    } catch (e) { console.error(e) } finally { setSavingQR(false) }
  }

  const handleDeleteQR = async (id: string) => {
    try {
      await supabase.from('whatsapp_quick_replies').delete().eq('id', id)
      setQuickReplies(prev => prev.filter(q => q.id !== id))
    } catch (e) { console.error(e) }
  }

  const handleUpdateQR = async () => {
    if (!editQRId) return
    try {
      await supabase.from('whatsapp_quick_replies').update({ title: editQRData.title, message: editQRData.message }).eq('id', editQRId)
      setQuickReplies(prev => prev.map(q => q.id === editQRId ? { ...q, ...editQRData } : q))
      setEditQRId(null)
    } catch (e) { console.error(e) }
  }

  const toggleAttendantDay = (id: string, day: string) => {
    setAttendants(prev => prev.map(a => {
      if (a.id !== id) return a
      const days = a.working_days.includes(day)
        ? a.working_days.filter(d => d !== day)
        : [...a.working_days, day]
      return { ...a, working_days: days }
    }))
  }

  const updateAttendant = (id: string, key: string, value: string) => {
    setAttendants(prev => prev.map(a => a.id === id ? { ...a, [key]: value } : a))
  }

  const handleSaveAttendantHours = async (att: typeof attendants[0]) => {
    setSavingAtt(att.id)
    try {
      await supabase.from('users').update({
        working_hours_start: att.working_hours_start,
        working_hours_end:   att.working_hours_end,
        working_days:        att.working_days,
      }).eq('id', att.id)
    } catch (e) { console.error(e) } finally { setSavingAtt(null) }
  }

  const toggleDay = (d: string) => setFlow(f => ({
    ...f, working_days: f.working_days.includes(d) ? f.working_days.filter(x => x !== d) : [...f.working_days, d]
  }))

  const addMenuOption = () => setFlow(f => ({
    ...f, menu_options: [...f.menu_options, { id: String(Date.now()), label: '', keyword: String(f.menu_options.length + 1), assignee_id: '', assignee_name: '' }]
  }))

  const removeMenuOption = (id: string) => setFlow(f => ({ ...f, menu_options: f.menu_options.filter(o => o.id !== id) }))

  const updateMenuOption = (id: string, k: string, v: string) => setFlow(f => ({
    ...f, menu_options: f.menu_options.map(o => o.id === id
      ? { ...o, [k]: v, ...(k === 'assignee_id' ? { assignee_name: flowUsers.find(u => u.id === v)?.full_name || '' } : {}) }
      : o)
  }))

  const usagePct   = Math.min(100, Math.round((monthlyConvCount / (usage.limit || 1000)) * 100))
  const usageColor = usagePct >= 90 ? '#EF4444' : usagePct >= 70 ? '#F59E0B' : '#10B981'

  const dCard  = { background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }
  const dInput = { background: '#fff', border: '1px solid #E2E8F0', color: '#1A2B4A', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' as const }
  const dLabel = { fontSize: 12, fontWeight: 600 as const, color: '#475569', display: 'block' as const, marginBottom: 6 }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} color="#00A896" className="animate-spin" />
    </div>
  )

  if (!metaConfig?.whatsapp_phone_id) return (
    <div style={{ background: '#F8FAFC', borderRadius: 16, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ ...dCard, maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: '#E2E8F0', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <WifiOff size={26} color="#94A3B8" />
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: '0 0 8px' }}>WhatsApp não configurado</h2>
        <p style={{ fontSize: 13, color: '#64748B', margin: 0, lineHeight: 1.6 }}>
          O número de WhatsApp desta escola ainda não foi configurado.<br />
          Entre em contato com o administrador da plataforma para ativar o WhatsApp.
        </p>
      </div>
    </div>
  )

  return (
    <>
      {showFlowEditor && <FlowEditor institutionId={institutionId} onClose={() => setShowFlowEditor(false)} />}
      {showBot && <BotConfigModal institutionId={institutionId} onClose={() => setShowBot(false)} />}
      <div style={{ display: 'flex', background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', minHeight: 520 }}>

        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0, background: '#F8FAFC', borderRight: '1px solid #E2E8F0', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {WA_SECTIONS.map(sec => {
            const active = waSection === sec.id
            return (
              <button key={sec.id} onClick={() => setWaSection(sec.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', background: active ? '#00A896' : 'transparent', color: active ? '#fff' : '#64748B', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left', width: '100%', position: 'relative' }}>
                <span style={{ fontSize: 14 }}>{sec.icon}</span>
                <span style={{ flex: 1 }}>{sec.label}</span>
                {sec.id === 'conexao' && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {waSection === 'conexao' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>📡 Conexão WhatsApp</h3>
              <div style={dCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, background: '#F0FDF4', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wifi size={20} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>WhatsApp conectado</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{metaConfig.whatsapp_display_name}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#16a34a' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />Online
                  </span>
                </div>
                <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                  <div>Número: <strong style={{ color: '#1A2B4A' }}>{phoneRecord?.phone_number || metaConfig.whatsapp_phone_number || '—'}</strong></div>
                  {metaConfig.whatsapp_phone_id && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Phone ID: {metaConfig.whatsapp_phone_id}</div>}
                </div>
                <div style={{ marginBottom: 16 }}>
                  {flow.bot_enabled
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#16a34a' }}>🤖 Robô ativo</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#64748B' }}>👤 Atendimento manual</span>
                  }
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#64748B' }}>Conversas este mês</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: usageColor }}>{monthlyConvCount.toLocaleString('pt-BR')} / {(usage.limit || 1000).toLocaleString('pt-BR')}</span>
                  </div>
                  <div style={{ height: 6, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${usagePct}%`, background: usageColor, borderRadius: 999 }} />
                  </div>
                </div>
                {testResult && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: testResult.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${testResult.ok ? '#BBF7D0' : '#FECACA'}`, color: testResult.ok ? '#16a34a' : '#DC2626' }}>
                    {testResult.msg}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setShowFlowEditor(true)}
                    style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: '#E6F7F5', border: '1px solid #00A896', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#00A896', cursor: 'pointer' }}>
                    <GitBranch size={14} />Editor de Fluxo
                  </button>
                  <button onClick={handleTestConnection} disabled={testing}
                    style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer', opacity: testing ? 0.6 : 1 }}>
                    {testing ? <><Loader2 size={13} className="animate-spin" />Testando...</> : <><RefreshCw size={13} />Testar conexão</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {waSection === 'horario' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>🕐 Horário de Atendimento</h3>
              <div style={dCard}>
                <div style={{ marginBottom: 16 }}>
                  <label style={dLabel}>Dias da semana</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {FLOW_DAYS.map(d => (
                      <button key={d.id} onClick={() => toggleDay(d.id)}
                        style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${flow.working_days.includes(d.id) ? '#00A896' : '#E2E8F0'}`, background: flow.working_days.includes(d.id) ? '#E6F7F5' : '#fff', color: flow.working_days.includes(d.id) ? '#00A896' : '#64748B' }}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={dLabel}>Início</label>
                    <input type="time" style={dInput} value={flow.working_start} onChange={e => setFlow(f => ({ ...f, working_start: e.target.value }))} />
                  </div>
                  <div>
                    <label style={dLabel}>Fim</label>
                    <input type="time" style={dInput} value={flow.working_end} onChange={e => setFlow(f => ({ ...f, working_end: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={dLabel}>Mensagem fora do horário</label>
                  <textarea rows={3} style={{ ...dInput, resize: 'vertical' as const }} value={flow.off_hours_message} onChange={e => setFlow(f => ({ ...f, off_hours_message: e.target.value }))} />
                </div>
                <button onClick={handleSaveFlow} disabled={savingFlow}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', background: flowSaved ? '#16a34a' : '#00A896', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingFlow ? 0.7 : 1 }}>
                  {savingFlow ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : flowSaved ? <><Check size={13} />Salvo!</> : <><Save size={13} />Salvar horário</>}
                </button>
              </div>
            </div>
          )}

          {waSection === 'respostas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>⚡ Respostas Rápidas</h3>
              {quickReplies.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Nenhuma resposta rápida cadastrada.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {quickReplies.map(qr => (
                  <div key={qr.id} style={{ ...dCard, padding: '12px 14px' }}>
                    {editQRId === qr.id ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input style={dInput} value={editQRData.title} onChange={e => setEditQRData(d => ({ ...d, title: e.target.value }))} placeholder="Título" />
                          <textarea rows={2} style={{ ...dInput, resize: 'vertical' as const }} value={editQRData.message} onChange={e => setEditQRData(d => ({ ...d, message: e.target.value }))} placeholder="Mensagem" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button onClick={handleUpdateQR} style={{ padding: '7px 10px', background: '#00A896', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}><Check size={13} /></button>
                          <button onClick={() => setEditQRId(null)} style={{ padding: '7px 10px', background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer' }}><X size={13} /></button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#00A896' }}>/{qr.title}</span>
                          <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0', lineHeight: 1.4 }}>{qr.message}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { setEditQRId(qr.id); setEditQRData({ title: qr.title, message: qr.message }) }}
                            style={{ padding: '5px 8px', background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✏</button>
                          <button onClick={() => handleDeleteQR(qr.id)}
                            style={{ padding: '5px 8px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}><X size={12} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ ...dCard, border: '1px dashed #CBD5E1' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', margin: '0 0 10px', textTransform: 'uppercase' as const }}>Nova resposta rápida</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input style={dInput} value={newQR.title} onChange={e => setNewQR(q => ({ ...q, title: e.target.value }))} placeholder="Título (ex: preco, matricula)" />
                  <textarea rows={2} style={{ ...dInput, resize: 'vertical' as const }} value={newQR.message} onChange={e => setNewQR(q => ({ ...q, message: e.target.value }))} placeholder="Mensagem que será enviada..." />
                  <button onClick={handleAddQR} disabled={!newQR.title || !newQR.message || savingQR}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, border: 'none', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!newQR.title || !newQR.message || savingQR) ? 0.5 : 1 }}>
                    <Plus size={14} />{savingQR ? 'Salvando...' : 'Adicionar resposta rápida'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {waSection === 'equipe' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>👥 Horário por Atendente</h3>
              {attendants.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Nenhum atendente cadastrado.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {attendants.map(att => (
                    <div key={att.id} style={dCard}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 12 }}>{att.full_name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                        {FLOW_DAYS.map(d => (
                          <button key={d.id} onClick={() => toggleAttendantDay(att.id, d.id)}
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `2px solid ${att.working_days.includes(d.id) ? '#00A896' : '#E2E8F0'}`, background: att.working_days.includes(d.id) ? '#E6F7F5' : '#fff', color: att.working_days.includes(d.id) ? '#00A896' : '#64748B' }}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                        <div>
                          <label style={dLabel}>Início</label>
                          <input type="time" style={dInput} value={att.working_hours_start} onChange={e => updateAttendant(att.id, 'working_hours_start', e.target.value)} />
                        </div>
                        <div>
                          <label style={dLabel}>Fim</label>
                          <input type="time" style={dInput} value={att.working_hours_end} onChange={e => updateAttendant(att.id, 'working_hours_end', e.target.value)} />
                        </div>
                        <button onClick={() => handleSaveAttendantHours(att)} disabled={savingAtt === att.id}
                          style={{ padding: '9px 14px', background: '#00A896', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingAtt === att.id ? 0.6 : 1 }}>
                          {savingAtt === att.id ? '...' : <Save size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grupos de Atendimento */}
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Grupos de Atendimento</h4>
                  <button
                    onClick={() => { setGroupForm({ name: '', emoji: '👥', member_ids: [] }); setEditingGroup(null); setShowGroupForm(true) }}
                    style={{ fontSize: 12, fontWeight: 600, color: '#00A896', background: '#E6F7F5', border: '1px solid #B2E8E2', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
                  >+ Novo grupo</button>
                </div>
                {groups.length === 0 && (
                  <p style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Nenhum grupo criado ainda</p>
                )}
                {groups.map(group => (
                  <div key={group.id} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #D1FAE5', background: '#F0FDFB', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{group.emoji} {group.name}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        {group.member_ids.length} membro(s): {group.member_ids.map(id => flowUsers.find(u => u.id === id)?.full_name || id).join(', ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setGroupForm({ name: group.name, emoji: group.emoji, member_ids: group.member_ids }); setEditingGroup(group); setShowGroupForm(true) }}
                        style={{ fontSize: 11, color: '#00A896', background: 'none', border: '1px solid #B2E8E2', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                      >Editar</button>
                      <button
                        onClick={async () => { if (!confirm('Excluir este grupo?')) return; await supabase.from('whatsapp_groups').delete().eq('id', group.id); setGroups(prev => prev.filter(g => g.id !== group.id)) }}
                        style={{ fontSize: 11, color: '#EF4444', background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                      >Excluir</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal criar/editar grupo */}
              {showGroupForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: 'white', borderRadius: 16, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', marginBottom: 16 }}>{editingGroup ? 'Editar grupo' : 'Novo grupo'}</h3>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input value={groupForm.emoji} onChange={e => setGroupForm(f => ({ ...f, emoji: e.target.value }))}
                        style={{ width: 50, padding: 8, fontSize: 20, border: '1px solid #D1FAE5', borderRadius: 8, textAlign: 'center', outline: 'none' }} maxLength={2} />
                      <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nome do grupo (ex: Secretaria)"
                        style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid #D1FAE5', borderRadius: 8, outline: 'none', color: '#1A2B4A' }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 8 }}>Membros do grupo</label>
                      {flowUsers.map(user => (
                        <label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13, color: '#1A2B4A' }}>
                          <input type="checkbox" checked={groupForm.member_ids.includes(user.id)}
                            onChange={e => setGroupForm(f => ({ ...f, member_ids: e.target.checked ? [...f.member_ids, user.id] : f.member_ids.filter(id => id !== user.id) }))} />
                          {user.full_name}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowGroupForm(false)}
                        style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #D1FAE5', borderRadius: 8, background: 'white', cursor: 'pointer', color: '#64748B' }}>
                        Cancelar
                      </button>
                      <button
                        onClick={async () => {
                          if (!groupForm.name.trim()) return
                          if (editingGroup) {
                            const { data } = await supabase.from('whatsapp_groups')
                              .update({ name: groupForm.name, emoji: groupForm.emoji, member_ids: groupForm.member_ids })
                              .eq('id', editingGroup.id).select().single()
                            if (data) setGroups(prev => prev.map(g => g.id === editingGroup.id ? (data as any) : g))
                          } else {
                            const { data } = await supabase.from('whatsapp_groups')
                              .insert({ institution_id: institutionId, name: groupForm.name, emoji: groupForm.emoji, member_ids: groupForm.member_ids })
                              .select().single()
                            if (data) setGroups(prev => [...prev, data as any])
                          }
                          setShowGroupForm(false)
                        }}
                        style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 700, background: '#00A896', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                        {editingGroup ? 'Salvar' : 'Criar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeout de Inatividade */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #E2F5F3' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 16 }}>⏱ Timeout de Inatividade</h4>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Tempo sem resposta:</label>
                  <input type="number" min={5} max={120} value={timeoutMinutes}
                    onChange={e => setTimeoutMinutes(Number(e.target.value))}
                    style={{ width: 70, padding: '7px 10px', fontSize: 13, border: '1px solid #D1FAE5', borderRadius: 8, outline: 'none', textAlign: 'center' }} />
                  <span style={{ fontSize: 13, color: '#64748B' }}>minutos</span>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Transferir para</label>
                  <select
                    value={timeoutGroupId ? `group:${timeoutGroupId}` : timeoutAssigneeId ? `user:${timeoutAssigneeId}` : ''}
                    onChange={e => {
                      const val = e.target.value
                      if (!val) { setTimeoutGroupId(''); setTimeoutAssigneeId('') }
                      else if (val.startsWith('group:')) { setTimeoutGroupId(val.replace('group:', '')); setTimeoutAssigneeId('') }
                      else { setTimeoutAssigneeId(val.replace('user:', '')); setTimeoutGroupId('') }
                    }}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #D1FAE5', borderRadius: 8, background: '#F0FDFB', color: '#1A2B4A', outline: 'none' }}>
                    <option value="">Ninguém (só desativar bot)</option>
                    <optgroup label="Grupos">
                      {groups.map(g => <option key={g.id} value={`group:${g.id}`}>{g.emoji} {g.name}</option>)}
                    </optgroup>
                    <optgroup label="Atendentes">
                      {flowUsers.map(u => <option key={u.id} value={`user:${u.id}`}>{u.full_name}</option>)}
                    </optgroup>
                  </select>
                </div>

                <div style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Mensagem ao transferir</label>
                  <textarea rows={2} value={timeoutMessage} onChange={e => setTimeoutMessage(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #D1FAE5', borderRadius: 8, background: '#F0FDFB', color: '#1A2B4A', resize: 'none' as const, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                </div>
              </div>
            </div>
          )}

          {waSection === 'bloqueios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>🚫 Números Bloqueados</h3>
                <button onClick={() => setShowAddBlock(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#DC2626', cursor: 'pointer' }}>
                  <Plus size={13} /> Bloquear número
                </button>
              </div>
              {showAddBlock && (
                <div style={{ ...dCard, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input value={newBlockNum} onChange={e => setNewBlockNum(e.target.value)} placeholder="Número (ex: 5583999999999)" style={dInput} />
                    <input value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)} placeholder="Motivo (opcional)" style={dInput} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddBlock} disabled={savingBlock || !newBlockNum.trim()}
                        style={{ flex: 1, padding: '8px 0', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!newBlockNum.trim() || savingBlock) ? 0.5 : 1 }}>
                        {savingBlock ? 'Bloqueando...' : 'Confirmar bloqueio'}
                      </button>
                      <button onClick={() => { setShowAddBlock(false); setNewBlockNum(''); setNewBlockReason('') }}
                        style={{ padding: '8px 14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, color: '#64748B', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {blacklist.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Nenhum número bloqueado. Mensagens de números bloqueados são ignoradas automaticamente.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {blacklist.map(b => (
                    <div key={b.id} style={{ ...dCard, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A2B4A', fontFamily: 'monospace' }}>{b.phone_number}</p>
                        {b.reason && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B' }}>{b.reason}</p>}
                      </div>
                      <button onClick={() => handleRemoveBlock(b.id)}
                        style={{ padding: '5px 8px', background: 'transparent', border: '1px solid #FECACA', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#DC2626' }}>
                        <Trash2 size={12} /> Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {waSection === 'pesquisa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>⭐ Pesquisa de Satisfação</h3>
              <div style={dCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A2B4A' }}>Pesquisa automática</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>Envia avaliação de 1 a 5 ao encerrar atendimento</p>
                  </div>
                  <button onClick={() => setFlow(f => ({ ...f, satisfaction_survey_enabled: !f.satisfaction_survey_enabled }))}
                    style={{ width: 44, height: 24, borderRadius: 999, background: flow.satisfaction_survey_enabled ? '#00A896' : '#CBD5E1', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 3, left: flow.satisfaction_survey_enabled ? 22 : 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
                  </button>
                </div>
                {flow.satisfaction_survey_enabled && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
                      Envia botões interativos (😞 Ruim / 😐 Regular / 😊 Ótimo) ao encerrar o atendimento.
                    </p>
                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>Mensagem da pesquisa</label>
                      <textarea
                        rows={3}
                        value={flow.satisfaction_message}
                        onChange={e => setFlow(f => ({ ...f, satisfaction_message: e.target.value }))}
                        placeholder="Como você avalia nosso atendimento hoje?..."
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D1FAE5', background: '#F0FDFB', color: '#1A2B4A', resize: 'none' as const, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 16 }}>
                  <button onClick={handleSaveFlow} disabled={savingFlow}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', background: flowSaved ? '#16a34a' : '#00A896', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingFlow ? 0.7 : 1 }}>
                    {savingFlow ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : flowSaved ? <><Check size={13} />Salvo!</> : <><Save size={13} />Salvar configuração</>}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

// ─── Aba: Pagamentos ──────────────────────────────────────────────────────────
function PagamentosTab({ institutionId }: { institutionId: string }) {
  const [payments, setPayments] = useState<any[]>([])
  const [institution, setInstitution] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generatingLink, setGeneratingLink] = useState<string | null>(null)
  const pagMountedRef = useRef(true)

  useEffect(() => {
    pagMountedRef.current = true
    load()
    return () => { pagMountedRef.current = false }
  }, [])

  const generateLink = async (paymentId: string) => {
    setGeneratingLink(paymentId)
    try {
      const res = await fetch('https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/asaas-generate-monthly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHh1dW14a2hobm9xcnhwb3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NzYwNTMsImV4cCI6MjA1OTQ1MjA1M30.tOCAoMTeAzwHJFmXbzvBbKFIQLNpvFNIwfBRNmhHXP0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHh1dW14a2hobm9xcnhwb3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NzYwNTMsImV4cCI6MjA1OTQ1MjA1M30.tOCAoMTeAzwHJFmXbzvBbKFIQLNpvFNIwfBRNmhHXP0',
        },
        body: JSON.stringify({ payment_id: paymentId })
      })
      const data = await res.json()
      if (data.ok && data.generated > 0) {
        await load()
      } else {
        alert('Erro ao gerar link: ' + (data.error || 'Tente novamente'))
      }
    } catch (e) {
      alert('Erro ao gerar link')
    } finally {
      setGeneratingLink(null)
    }
  }

  const load = async () => {
    setLoading(true)
    const [paymentsRes, instRes] = await Promise.all([
      supabase.from('payments')
        .select('*')
        .eq('institution_id', institutionId)
        .order('due_date', { ascending: true }),
      supabase.from('institutions')
        .select('name, monthly_value, plan_status, plan')
        .eq('id', institutionId)
        .single()
    ])
    if (pagMountedRef.current) {
      setPayments(paymentsRes.data || [])
      setInstitution(instRes.data)
      setLoading(false)
    }
  }

  const fmtBRL = (n: number) => n?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'
  const fmtDate = (s: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

  const implPayment = payments.find(p => p.payment_type === 'implementation')
  const monthlyPayments = payments.filter(p => p.payment_type === 'monthly')
  const paidMonthly = monthlyPayments.filter(p => p.status === 'paid')
  const pendingMonthly = monthlyPayments.filter(p => p.status === 'pending')
  const overdueMonthly = monthlyPayments.filter(p => p.status === 'overdue')

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    paid:      { label: '✅ Pago',      color: '#16A34A', bg: '#F0FDF4' },
    pending:   { label: '⏳ Pendente',  color: '#D97706', bg: '#FFFBEB' },
    overdue:   { label: '🔴 Atrasado',  color: '#DC2626', bg: '#FEF2F2' },
    cancelled: { label: '❌ Cancelado', color: '#9CA3AF', bg: '#F3F4F6' },
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} color="#00A896" className="animate-spin" />
    </div>
  )

  return (
    <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Resumo financeiro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Mensalidade', value: fmtBRL(institution?.monthly_value || 0), color: '#00A896', icon: '💰' },
          { label: 'Pagas', value: paidMonthly.length, color: '#16A34A', icon: '✅' },
          { label: 'Pendentes', value: pendingMonthly.length + overdueMonthly.length, color: overdueMonthly.length > 0 ? '#DC2626' : '#D97706', icon: overdueMonthly.length > 0 ? '🔴' : '⏳' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px' }}>{k.icon} {k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Implantação */}
      {implPayment && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 14px' }}>Taxa de Implantação</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: '0 0 4px' }}>{fmtBRL(implPayment.amount)}</p>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Vencimento: {fmtDate(implPayment.due_date)}</p>
              {implPayment.paid_at && <p style={{ fontSize: 12, color: '#16A34A', margin: '2px 0 0' }}>Pago em: {fmtDate(implPayment.paid_at)}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                color: statusConfig[implPayment.status]?.color || '#6B7280',
                background: statusConfig[implPayment.status]?.bg || '#F3F4F6'
              }}>
                {statusConfig[implPayment.status]?.label || implPayment.status}
              </span>
              {implPayment.asaas_charge_url && implPayment.status !== 'paid' && (
                <a
                  href={implPayment.asaas_charge_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: '8px 20px', borderRadius: 10, background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}
                >
                  💳 Pagar agora
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mensalidades */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Mensalidades</p>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{monthlyPayments.length} parcelas</span>
        </div>

        {monthlyPayments.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <DollarSign size={36} color="#E2E8F0" style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>Nenhuma mensalidade registrada ainda.</p>
            <p style={{ color: '#CBD5E1', fontSize: 12, margin: '4px 0 0' }}>As mensalidades são geradas após a confirmação do pagamento da implantação.</p>
          </div>
        ) : (
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Descrição', 'Valor', 'Vencimento', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyPayments.map((p, i) => {
                  const st = statusConfig[p.status] || statusConfig.pending
                  const isOverdue = p.status === 'overdue' || (p.status === 'pending' && new Date(p.due_date) < new Date())
                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{p.description || 'Mensalidade'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{fmtBRL(p.amount)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: isOverdue ? '#DC2626' : '#64748B', fontWeight: isOverdue ? 700 : 400 }}>
                        {fmtDate(p.due_date)}
                        {isOverdue && p.status !== 'paid' && <span style={{ fontSize: 10, display: 'block', color: '#DC2626' }}>Em atraso</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {p.asaas_charge_url && p.status !== 'paid' && (
                          <a
                            href={p.asaas_charge_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ padding: '6px 14px', borderRadius: 8, background: isOverdue ? '#DC2626' : '#00A896', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' }}
                          >
                            💳 Pagar
                          </a>
                        )}
                        {!p.asaas_charge_url && p.status !== 'paid' && (
                          <button
                            onClick={() => generateLink(p.id)}
                            disabled={generatingLink === p.id}
                            style={{ padding: '6px 14px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {generatingLink === p.id ? '⏳ Gerando...' : '🔗 Gerar link'}
                          </button>
                        )}
                        {p.status === 'paid' && p.paid_at && (
                          <span style={{ fontSize: 11, color: '#16A34A' }}>Pago em {fmtDate(p.paid_at)}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alerta se tem atraso */}
      {overdueMonthly.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', margin: '0 0 4px' }}>
              {overdueMonthly.length} mensalidade{overdueMonthly.length > 1 ? 's' : ''} em atraso
            </p>
            <p style={{ fontSize: 12, color: '#B91C1C', margin: 0 }}>
              Regularize o pagamento para evitar a suspensão do sistema. Em caso de dúvidas, entre em contato com seu consultor.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── SystemSettings Principal ─────────────────────────────────────────────────
const TABS = [
  { id: 'geral',      label: 'Geral',      icon: Building },
  { id: 'pagamentos', label: 'Pagamentos', icon: DollarSign },
  { id: 'escola',     label: 'Escola',     icon: GraduationCap },
  { id: 'identidade', label: 'Identidade', icon: Palette },
  { id: 'whatsapp',   label: 'WhatsApp',   icon: MessageCircle },
]

export default function SystemSettings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('geral')
  const [showSchoolSetup, setShowSchoolSetup] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const institutionId = user?.institution_id || ''

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: isMobile ? 0 : 24, display: 'flex', flexDirection: 'column', gap: isMobile ? 0 : 20, minHeight: '100%', background: '#f8f9fb' }}>
      <style>{`.animate-spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isMobile ? '16px 16px 12px' : 0, background: isMobile ? '#fff' : 'transparent', borderBottom: isMobile ? '1px solid #E2E8F0' : 'none' }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={18} color="#00A896" />
        </div>
        <div>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Configurações</h1>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Gerencie as configurações da instituição</p>
        </div>
      </div>

      {/* Tabs */}
      {isMobile ? (
        <div style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #E2E8F0', scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#00A896' : '#64748B', background: active ? '#E6F7F5' : '#F1F5F9', border: active ? '1.5px solid #00A896' : '1.5px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 36, flexShrink: 0 }}>
                <Icon size={13} />{tab.label}
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 2, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#00A896' : '#64748B', background: active ? '#E6F7F5' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
                <Icon size={14} />{tab.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Conteúdo */}
      <div style={{ padding: isMobile ? '16px 0 96px' : 0 }}>
        {activeTab === 'geral' && <GeralTab institutionId={institutionId} onToast={showToast} />}
        {activeTab === 'identidade' && <IdentidadeTab institutionId={institutionId} onToast={showToast} />}
        {activeTab === 'whatsapp' && <WhatsAppTab institutionId={institutionId} />}
        {activeTab === 'pagamentos' && <PagamentosTab institutionId={institutionId} />}
        {activeTab === 'escola' && (
          <div style={{ background: '#fff', borderRadius: isMobile ? 0 : 16, border: isMobile ? 'none' : '1px solid #E2E8F0', padding: isMobile ? '20px 16px' : 28, maxWidth: isMobile ? '100%' : 500 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', marginBottom: 6 }}>Configurações da Escola</h3>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 1.6 }}>Atualize as informações da sua escola, séries oferecidas e mensalidade média.</p>
            <button onClick={() => setShowSchoolSetup(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 48, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
              <GraduationCap size={15} />Editar configurações da escola
            </button>
          </div>
        )}
      </div>

      {showSchoolSetup && institutionId && (
        <SchoolSetupModal institutionId={institutionId} initialStep={1} editMode={true} onComplete={() => setShowSchoolSetup(false)} />
      )}
    </div>
  )
}
