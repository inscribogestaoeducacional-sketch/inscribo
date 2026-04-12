import React, { useState, useEffect } from 'react'
import {
  Save, Upload, Building, Mail, Phone, Globe, Palette,
  MessageCircle, Wifi, WifiOff, RefreshCw, Settings,
  Bot, X, Plus, Check, AlertCircle, GraduationCap,
  MapPin, FileText, DollarSign, Loader2, CheckCircle
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import SchoolSetupModal from '../onboarding/SchoolSetupModal'

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

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: inst } = await supabase
      .from('institutions')
      .select('name, email, phone, city, state, cnpj, plan, plan_status, monthly_value, billing_due_day, trial_ends_at')
      .eq('id', institutionId)
      .single()
    if (inst) setData(inst as any)
    setLoading(false)
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

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await supabase.from('institutions').select('name,logo_url,primary_color,secondary_color').eq('id', institutionId).maybeSingle()
    if (data) {
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

  useEffect(() => {
    supabase.from('whatsapp_bot_config').select('*').eq('institution_id', institutionId).single()
      .then(({ data }) => { if (data) setCfg(data as any); setLoading(false) })
      .catch(() => setLoading(false))
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

function WhatsAppTab({ institutionId }: { institutionId: string }) {
  const [metaConfig, setMetaConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showBot, setShowBot] = useState(false)
  const [usage, setUsage] = useState({ count: 0, limit: 1000 })
  const [form, setForm] = useState({ phone_id: '', token: '', phone_number: '', display_name: '' })
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => { loadConfig() }, [])

  const loadConfig = async () => {
    setLoading(true)
    const { data } = await supabase.from('institutions').select('whatsapp_phone_id,whatsapp_token,whatsapp_phone_number,whatsapp_display_name,whatsapp_connected').eq('id', institutionId).single().catch(() => ({ data: null }))
    if (data?.whatsapp_phone_id) {
      setMetaConfig(data)
      const monthYear = new Date().toISOString().slice(0, 7)
      const { data: u } = await supabase.from('whatsapp_usage').select('conversation_count,monthly_limit').eq('institution_id', institutionId).eq('month_year', monthYear).single().catch(() => ({ data: null }))
      if (u) setUsage({ count: (u as any).conversation_count || 0, limit: (u as any).monthly_limit || 1000 })
    }
    setLoading(false)
  }

  const handleConnect = async () => {
    if (!form.phone_id || !form.token) { setConnectError('Phone ID e Token são obrigatórios.'); return }
    setConnecting(true); setConnectError(null)
    try {
      const testRes = await fetch(`https://graph.facebook.com/v18.0/${form.phone_id}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${form.token}` } })
      if (!testRes.ok) { const err = await testRes.json().catch(() => ({})); throw new Error((err as any)?.error?.message || 'Token ou Phone ID inválido') }
      const testData = await testRes.json()
      await supabase.from('institutions').update({ whatsapp_phone_id: form.phone_id, whatsapp_token: form.token, whatsapp_phone_number: form.phone_number || (testData as any).display_phone_number || '', whatsapp_display_name: (testData as any).verified_name || form.display_name, whatsapp_connected: true }).eq('id', institutionId)
      await loadConfig()
    } catch (e) { setConnectError((e as Error).message) } finally { setConnecting(false) }
  }

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o WhatsApp? O bot deixará de funcionar.')) return
    setDisconnecting(true)
    await supabase.from('institutions').update({ whatsapp_phone_id: null, whatsapp_token: null, whatsapp_phone_number: null, whatsapp_display_name: null, whatsapp_connected: false }).eq('id', institutionId).catch(() => {})
    setMetaConfig(null); setForm({ phone_id: '', token: '', phone_number: '', display_name: '' }); setDisconnecting(false)
  }

  const usagePct = Math.min(100, Math.round((usage.count / usage.limit) * 100))
  const usageColor = usagePct >= 90 ? '#EF4444' : usagePct >= 70 ? '#F59E0B' : '#10B981'

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} color="#00A896" className="animate-spin" /></div>

  if (metaConfig?.whatsapp_phone_id) return (
    <>
      {showBot && <BotConfigModal institutionId={institutionId} onClose={() => setShowBot(false)} />}
      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, background: '#ECFDF5', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wifi size={22} color="#10B981" /></div>
            <div><div style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A' }}>WhatsApp conectado</div><div style={{ fontSize: 13, color: '#64748B' }}>{metaConfig.whatsapp_display_name}</div></div>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#ECFDF5', borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#059669' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />Online</span>
          </div>
          <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, fontSize: 13, color: '#475569', marginBottom: 16 }}>
            Número: <strong>{metaConfig.whatsapp_phone_number || '—'}</strong>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Conversas este mês</span><span style={{ fontSize: 12, fontWeight: 700, color: usageColor }}>{usage.count} / {usage.limit.toLocaleString('pt-BR')}</span></div>
            <div style={{ height: 8, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', width: `${usagePct}%`, background: usageColor, borderRadius: 999 }} /></div>
            {usagePct >= 90 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#DC2626' }}><AlertCircle size={14} />Limite quase atingido.</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowBot(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: '#E6F7F5', border: '1px solid #99F6E4', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#00A896', cursor: 'pointer' }}><Bot size={15} />Configurar Bot</button>
            <button onClick={handleDisconnect} disabled={disconnecting} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#E11D48', cursor: 'pointer', opacity: disconnecting ? 0.6 : 1 }}><WifiOff size={15} />{disconnecting ? 'Desconectando...' : 'Desconectar'}</button>
          </div>
        </div>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>⚠️ Configure o webhook no Meta</div>
          <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>Em <strong>developers.facebook.com</strong> → WhatsApp → Configuração:<br />URL: <code style={{ background: '#FEF3C7', padding: '2px 6px', borderRadius: 4 }}>https://aionedu.com.br/api/whatsapp/webhook</code></div>
        </div>
      </div>
    </>
  )

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,#00A896,#1A2B4A)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><MessageCircle size={30} color="#fff" /></div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: '0 0 8px' }}>Conectar WhatsApp Business API</h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 24px', lineHeight: 1.6 }}>Use a API Oficial da Meta para atender com bot IA e enviar mensagens pelo Áion Edu.</p>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[{ label: 'Phone ID *', key: 'phone_id', placeholder: 'Ex: 1007880222413531', type: 'text' }, { label: 'Token de acesso permanente *', key: 'token', placeholder: 'EAAOSNzt...', type: 'password' }, { label: 'Número de telefone', key: 'phone_number', placeholder: '+55 83 99999-9999', type: 'text' }, { label: 'Nome de exibição', key: 'display_name', placeholder: 'Colégio São João', type: 'text' }].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className={inputCls} placeholder={f.placeholder} />
            </div>
          ))}
          {connectError && <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 10, fontSize: 13, color: '#BE123C' }}><AlertCircle size={16} />{connectError}</div>}
          <button onClick={handleConnect} disabled={connecting || !form.phone_id || !form.token} style={{ padding: '13px', background: 'linear-gradient(135deg,#00A896,#007A6E)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (connecting || !form.phone_id || !form.token) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {connecting ? <><RefreshCw size={16} className="animate-spin" />Verificando...</> : <><Check size={16} />Conectar WhatsApp</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SystemSettings Principal ─────────────────────────────────────────────────
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
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const institutionId = user?.institution_id || ''

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%', background: 'var(--bg-page)' }}>
      <style>{`.animate-spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={20} color="#64748B" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Configurações</h1>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Gerencie as configurações da instituição</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#fff' : '#64748B', background: active ? '#1A2B4A' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
              <Icon size={14} />{tab.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      {activeTab === 'geral' && <GeralTab institutionId={institutionId} onToast={showToast} />}
      {activeTab === 'identidade' && <IdentidadeTab institutionId={institutionId} onToast={showToast} />}
      {activeTab === 'whatsapp' && <WhatsAppTab institutionId={institutionId} />}
      {activeTab === 'escola' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 28, maxWidth: 500 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', marginBottom: 6 }}>Configurações da Escola</h3>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 1.6 }}>Atualize as informações da sua escola, séries oferecidas e mensalidade média.</p>
          <button onClick={() => setShowSchoolSetup(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <GraduationCap size={15} />Editar configurações da escola
          </button>
        </div>
      )}

      {showSchoolSetup && institutionId && (
        <SchoolSetupModal institutionId={institutionId} initialStep={1} editMode={true} onComplete={() => setShowSchoolSetup(false)} />
      )}
    </div>
  )
}