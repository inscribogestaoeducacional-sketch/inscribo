import React, { useState, useEffect, useRef } from 'react'
import {
  Save, Upload, Building, Mail, Phone, Globe, Palette,
  MessageCircle, Wifi, WifiOff, RefreshCw, Settings,
  Users, X, Plus, Check, AlertCircle, GraduationCap,
  MapPin, FileText, DollarSign, Loader2, CheckCircle, Clock, GitBranch, ShieldOff, Trash2,
  ChevronUp, ChevronDown, Pencil, Send, Plug,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import SchoolSetupModal from '../onboarding/SchoolSetupModal'
import WhatsAppSettings from './settings/WhatsAppSettings'
import PageHeader from '../ui/PageHeader'
import { SettingsStyles } from './settings/ui'
import { BRAND } from '../../lib/brand'
import FinanceTab from '../transmissoes/FinanceTab'
import { useBroadcastEnabled } from '../../lib/broadcasts'
import EscolaSettings from './settings/EscolaSettings'
import IntegrationsTab from './IntegrationsTab'
import { useSearchParams } from 'react-router-dom'
import { canSeeSettingsItem, canSeeSettingsTab, type SettingsTabId } from '../../lib/settingsAccess'

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
            { label: 'Mensalidade do plano Áion', value: (data as any).monthly_value ? `R$ ${Number((data as any).monthly_value).toLocaleString('pt-BR')}` : '—' },
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
      {/* Fase 6.1: a Vitrine guarda logo e tema próprios (podem ser diferentes de
          propósito); lá há o atalho "usar a logo da escola". */}
      <p style={{ fontSize: 12, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 12px', margin: '0 0 12px', lineHeight: 1.5 }}>
        A página da Vitrine tem logo e cores próprias. Para usar as daqui, abra <a href="/vitrine" style={{ color: '#00A896', fontWeight: 600 }}>Vitrine → Aparência</a> e toque em "usar a logo da escola".
      </p>
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
    // Faltava: cobrança estornada no Asaas aparecia com o status cru "refunded".
    refunded:  { label: '↩️ Estornado', color: '#7C3AED', bg: '#F5F3FF' },
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
          { label: 'Mensalidade do plano Áion', value: fmtBRL(institution?.monthly_value || 0), color: '#00A896', icon: '💰' },
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
  // Fase 2 · marco 1: base de alunos (lançamento manual, Activesoft, fonte)
  { id: 'integracoes', label: 'Integrações', icon: Plug },
]

export default function SystemSettings() {
  const { user } = useAuth()
  const role = user?.role
  // Fase 6.2: aba e seção na URL (?tab=whatsapp&sec=horario). Antes ?tab= era ignorado.
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const urlSec = searchParams.get('sec')
  const [showSchoolSetup, setShowSchoolSetup] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const institutionId = user?.institution_id || ''

  // Aba "Transmissões" só com o módulo liberado pela Áion (mesma regra do menu).
  const broadcastEnabled = useBroadcastEnabled(institutionId)
  const visibleTabs = (broadcastEnabled
    ? [...TABS.slice(0, 2), { id: 'transmissoes', label: 'Transmissões', icon: Send }, ...TABS.slice(2)]
    : TABS
  ).filter(t => canSeeSettingsTab(t.id as SettingsTabId, role))
  // Aba pedida na URL vale só se o perfil vê; senão, a primeira visível.
  const activeTab = visibleTabs.some(t => t.id === urlTab) ? (urlTab as string) : (visibleTabs[0]?.id ?? 'escola')
  const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true })
  const setEscolaSection = (sec: string) => setSearchParams(sec ? { tab: 'escola', sec } : { tab: 'escola' }, { replace: true })
  const setWaSection = (sec: string) => setSearchParams(sec ? { tab: 'whatsapp', sec } : { tab: 'whatsapp' }, { replace: true })

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
    <div style={{ padding: isMobile ? '14px 14px 96px' : '20px 24px 32px', maxWidth: 1200, margin: '0 auto', boxSizing: 'border-box', minHeight: '100%' }}>
      <SettingsStyles />

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <PageHeader icon={Settings} compact={isMobile} title="Configurações" subtitle="O que vale para a escola toda. As configurações de cada módulo ficam dentro dele." />

      <div style={{ height: 18 }} />
      {isMobile ? (
        <select aria-label="Seção das configurações" value={activeTab} onChange={e => setActiveTab(e.target.value)}
          style={{ width: '100%', marginBottom: 16, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '11px 12px', fontSize: 15, fontWeight: 700, color: BRAND.ink, background: '#fff', fontFamily: 'inherit' }}>
          {visibleTabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      ) : (
        <div role="tablist" style={{ display: 'inline-flex', gap: 2, background: '#EEF3F2', borderRadius: 14, padding: 4, marginBottom: 18, flexWrap: 'wrap' }}>
          {visibleTabs.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button key={tab.id} role="tab" aria-selected={active} onClick={() => setActiveTab(tab.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: active ? 800 : 600, color: active ? BRAND.primaryDark : BRAND.muted, background: active ? '#fff' : 'transparent', boxShadow: active ? '0 1px 3px rgba(26,43,74,.1)' : 'none', cursor: 'pointer' }}>
                <Icon size={15} />{tab.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Conteúdo */}
      <div>
        {activeTab === 'geral' && <GeralTab institutionId={institutionId} onToast={showToast} />}
        {activeTab === 'identidade' && <IdentidadeTab institutionId={institutionId} onToast={showToast} />}
        {activeTab === 'whatsapp' && <WhatsAppSettings institutionId={institutionId} role={role} section={urlSec} isMobile={isMobile} onSectionChange={setWaSection} />}
        {activeTab === 'pagamentos' && <PagamentosTab institutionId={institutionId} />}
        {activeTab === 'integracoes' && institutionId && <IntegrationsTab institutionId={institutionId} onToast={showToast} />}
        {activeTab === 'transmissoes' && broadcastEnabled && <FinanceTab institutionId={institutionId} />}
        {activeTab === 'escola' && <EscolaSettings institutionId={institutionId} role={role} isMobile={isMobile} section={urlSec} onSectionChange={setEscolaSection} onToast={showToast} onEditSchool={() => setShowSchoolSetup(true)} />}
      </div>

      {showSchoolSetup && institutionId && (
        <SchoolSetupModal institutionId={institutionId} initialStep={1} editMode={true} onComplete={() => setShowSchoolSetup(false)} />
      )}
    </div>
  )
}
