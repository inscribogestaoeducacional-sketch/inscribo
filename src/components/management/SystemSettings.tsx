import React, { useState, useEffect, useRef } from 'react'
import {
  Save, Upload, Building, Mail, Phone, Globe, Palette,
  MessageCircle, Wifi, WifiOff, RefreshCw, Settings,
  Users, X, Plus, Check, AlertCircle, GraduationCap,
  MapPin, FileText, DollarSign, Loader2, CheckCircle, Clock, GitBranch, ShieldOff, Trash2,
  ChevronUp, ChevronDown, Pencil, Send, Plug, Filter, Layers, Tag, ThumbsDown, Bell, Eye, Workflow,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import SchoolSetupModal from '../onboarding/SchoolSetupModal'
import WhatsAppSettings from './settings/WhatsAppSettings'
import PageHeader from '../ui/PageHeader'
import { SettingsStyles, Card, GhostButton, Title, SaveButton, NowNote, WarnNote, Pill, input, label } from './settings/ui'
import { BRAND, GRAD } from '../../lib/brand'
import FinanceTab from '../transmissoes/FinanceTab'
import { useBroadcastEnabled } from '../../lib/broadcasts'
import HubSettings, { type HubGroup } from './settings/HubSettings'
import GradeLevelsEditor from './GradeLevelsEditor'
import LeadUnitFieldEditor from './LeadUnitFieldEditor'
import LeadReminderSettingsEditor from './LeadReminderSettingsEditor'
import LeadSourcesEditor from './LeadSourcesEditor'
import LostReasonsEditor from './LostReasonsEditor'
import StageLabelsEditor from './StageLabelsEditor'
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
function GeralTab({ institutionId, onToast, part }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void; part: 'dados' | 'plano' }) {
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

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!data.name.trim()) { onToast('Informe o nome da escola', false); return }
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

  const set = (k: string, v: string) => setData({ ...data, [k]: v })
  const field = (lbl: string, key: string, opts: { placeholder?: string; type?: string; Icon?: any; full?: boolean } = {}) => (
    <div style={{ gridColumn: opts.full ? '1 / -1' : undefined }}>
      <label style={label}>{lbl}</label>
      <div style={{ position: 'relative' }}>
        {opts.Icon && <opts.Icon size={15} color={BRAND.faint} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />}
        <input type={opts.type || 'text'} style={{ ...input, paddingLeft: opts.Icon ? 36 : 12 }} value={(data as any)[key] || ''} placeholder={opts.placeholder} onChange={e => set(key, e.target.value)} />
      </div>
    </div>
  )
  const stat = (lbl: string, value: string) => (
    <div style={{ background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, borderRadius: 14, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{lbl}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink }}>{value}</div>
    </div>
  )
  const planStatus = (data as any).plan_status === 'active' ? 'Ativo' : (data as any).plan_status === 'trial' ? 'Período de teste' : (data as any).plan_status || '—'

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {part === 'dados' && (
        <Card>
          <Title Icon={Building} title="Dados da escola" help="Aparecem em documentos, mensagens e relatórios." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {field('Nome da escola *', 'name', { placeholder: 'Nome completo da escola', full: true })}
            {field('E-mail', 'email', { placeholder: 'contato@escola.com', type: 'email', Icon: Mail })}
            {field('Telefone', 'phone', { placeholder: '(83) 99999-9999', Icon: Phone })}
            {field('CNPJ', 'cnpj', { placeholder: '00.000.000/0001-00', Icon: FileText })}
            {field('Cidade', 'city', { placeholder: 'Patos', Icon: MapPin })}
            <div>
              <label style={label}>Estado</label>
              <select style={input} value={data.state || ''} onChange={e => set('state', e.target.value)}>
                <option value="">Selecione…</option>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </Card>
      )}

      {part === 'plano' && (
        <Card>
          <Title Icon={DollarSign} title="Plano e faturamento" help="Quem altera o plano é a equipe da Áion." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {stat('Plano atual', (data as any).plan || 'Básico')}
            {stat('Situação', planStatus)}
            {stat('Mensalidade do plano Áion', (data as any).monthly_value ? `R$ ${Number((data as any).monthly_value).toLocaleString('pt-BR')}` : '—')}
          </div>
          {(data as any).trial_ends_at && (
            <div style={{ marginTop: 12 }}><WarnNote>O período de teste termina em {new Date((data as any).trial_ends_at).toLocaleDateString('pt-BR')}.</WarnNote></div>
          )}
        </Card>
      )}

      {part === 'dados' && <div><SaveButton onClick={() => save()} saving={saving} text="Salvar dados da escola" /></div>}
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

  const colorRow = (lbl: string, val: string, setVal: (v: string) => void) => (
    <div key={lbl}>
      <label style={label}>{lbl}</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="color" aria-label={lbl} value={val} onChange={e => setVal(e.target.value)} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${BRAND.line}`, cursor: 'pointer', padding: 3, background: '#fff' }} />
        <input type="text" value={val} onChange={e => setVal(e.target.value)} maxLength={7} style={{ ...input, flex: 1, fontFamily: 'ui-monospace, monospace' }} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 980 }}>
      {/* Fase 6.1: a Vitrine guarda logo e tema próprios (podem ser diferentes de
          propósito); lá há o atalho "usar a logo da escola". */}
      <NowNote>A página da Vitrine tem logo e cores próprias. Para usar as daqui, abra <a href="/vitrine" style={{ color: BRAND.primaryDark, fontWeight: 700 }}>Vitrine → Aparência</a> e toque em "usar a logo da escola".</NowNote>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <Title Icon={Upload} title="Logo da escola" help="PNG, JPG, SVG ou WebP, até 2 MB." />
            <div onClick={() => document.getElementById('logo-input')?.click()} role="button" tabIndex={0}
              style={{ border: `2px dashed ${BRAND.line}`, borderRadius: 14, padding: '26px 16px', textAlign: 'center', cursor: 'pointer', background: BRAND.softer }}>
              <input id="logo-input" type="file" accept=".png,.jpg,.jpeg,.svg,.webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
              {uploading ? <Loader2 size={26} color={BRAND.primary} className="animate-spin" style={{ margin: '0 auto' }} />
                : logoUrl ? <><img src={logoUrl} alt="logo" style={{ height: 56, objectFit: 'contain', margin: '0 auto 8px', display: 'block' }} /><div style={{ fontSize: 12.5, color: BRAND.muted }}>Toque para trocar a logo</div></>
                : <><Upload size={26} color={BRAND.faint} style={{ margin: '0 auto 8px', display: 'block' }} /><div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>Toque para escolher a logo</div></>}
            </div>
          </Card>
          <Card>
            <Title Icon={Palette} title="Cores da marca" help="Usadas nas pesquisas de satisfação e nas telas do cliente." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {colorRow('Cor primária', primaryColor, setPrimaryColor)}
              {colorRow('Cor secundária', secondaryColor, setSecondaryColor)}
            </div>
          </Card>
          <div><SaveButton onClick={save} saving={saving} text="Salvar logo e cores" /></div>
        </div>

        <Card>
          <Title Icon={Eye} title="Como o cliente vê" help="Prévia da pesquisa de satisfação com a logo e as cores acima." />
          <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${BRAND.line}` }}>
            <header style={{ backgroundColor: primaryColor, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {logoUrl ? <img src={logoUrl} alt={institutionName} style={{ height: 32, objectFit: 'contain' }} />
                : <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>{institutionName?.[0] || 'E'}</div>}
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{institutionName || 'Nome da escola'}</span>
            </header>
            <div style={{ padding: 16, background: BRAND.softer }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: `1px solid ${BRAND.line}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, margin: '0 0 12px' }}>Como você avalia a escola?</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => <div key={n} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `2px solid ${n === 5 ? primaryColor : BRAND.line}`, background: n === 5 ? primaryColor : '#fff', color: n === 5 ? '#fff' : BRAND.muted, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{n}</div>)}
                </div>
              </div>
              <div style={{ marginTop: 10, padding: 10, background: primaryColor, borderRadius: 12, textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>Próxima →</div>
            </div>
          </div>
        </Card>
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

  const statusConfig: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'gray' | 'brand' }> = {
    paid:      { label: 'Pago',      tone: 'ok' },
    pending:   { label: 'Pendente',  tone: 'warn' },
    overdue:   { label: 'Atrasado',  tone: 'bad' },
    cancelled: { label: 'Cancelado', tone: 'gray' },
    // Faltava: cobrança estornada no Asaas aparecia com o status cru "refunded".
    refunded:  { label: 'Estornado', tone: 'brand' },
  }
  const payLink: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 11, color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap' }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} color="#00A896" className="animate-spin" />
    </div>
  )

  const kpi = (lbl: string, value: string | number, color: string) => (
    <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: '14px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{lbl}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  )
  const late = overdueMonthly.length > 0

  return (
    <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        {kpi('Mensalidade do plano Áion', fmtBRL(institution?.monthly_value || 0), BRAND.primaryDark)}
        {kpi('Pagas', paidMonthly.length, BRAND.success)}
        {kpi(late ? 'Pendentes (com atraso)' : 'Pendentes', pendingMonthly.length + overdueMonthly.length, late ? '#B91C1C' : BRAND.warn)}
      </div>

      {implPayment && (
        <Card>
          <Title Icon={FileText} title="Taxa de implantação" help="Cobrança única do início do contrato." />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: BRAND.ink }}>{fmtBRL(implPayment.amount)}</div>
              <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2 }}>Vencimento: {fmtDate(implPayment.due_date)}</div>
              {implPayment.paid_at && <div style={{ fontSize: 12.5, color: BRAND.success, marginTop: 2 }}>Pago em {fmtDate(implPayment.paid_at)}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Pill tone={statusConfig[implPayment.status]?.tone || 'gray'}>{statusConfig[implPayment.status]?.label || implPayment.status}</Pill>
              {implPayment.asaas_charge_url && implPayment.status !== 'paid' && (
                <a href={implPayment.asaas_charge_url} target="_blank" rel="noopener noreferrer" style={{ ...payLink, background: GRAD }}>Pagar agora</a>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Mensalidades</div>
          <span style={{ fontSize: 12.5, color: BRAND.muted }}>{monthlyPayments.length} parcelas</span>
        </div>
        {monthlyPayments.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center' }}>
            <DollarSign size={32} color={BRAND.faint} style={{ margin: '0 auto 10px', display: 'block' }} />
            <div style={{ color: BRAND.ink, fontSize: 14, fontWeight: 700 }}>Nenhuma mensalidade registrada ainda.</div>
            <div style={{ color: BRAND.muted, fontSize: 12.5, marginTop: 4 }}>As mensalidades são geradas após a confirmação do pagamento da implantação.</div>
          </div>
        ) : (
          <div style={{ maxHeight: 480, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ background: BRAND.softer }}>
                  {['Descrição', 'Valor', 'Vencimento', 'Situação', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyPayments.map(p => {
                  const st = statusConfig[p.status] || statusConfig.pending
                  const isOverdue = p.status === 'overdue' || (p.status === 'pending' && new Date(p.due_date) < new Date())
                  return (
                    <tr key={p.id} style={{ borderTop: `1px solid ${BRAND.line}` }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{p.description || 'Mensalidade'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 800, color: BRAND.ink }}>{fmtBRL(p.amount)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: isOverdue ? '#B91C1C' : BRAND.muted, fontWeight: isOverdue ? 800 : 500 }}>
                        {fmtDate(p.due_date)}
                        {isOverdue && p.status !== 'paid' && <span style={{ fontSize: 11, display: 'block' }}>Em atraso</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}><Pill tone={st.tone}>{st.label}</Pill></td>
                      <td style={{ padding: '12px 16px' }}>
                        {p.asaas_charge_url && p.status !== 'paid' && (
                          <a href={p.asaas_charge_url} target="_blank" rel="noopener noreferrer" style={{ ...payLink, background: isOverdue ? '#DC2626' : GRAD }}>Pagar</a>
                        )}
                        {!p.asaas_charge_url && p.status !== 'paid' && (
                          <GhostButton onClick={() => generateLink(p.id)} disabled={generatingLink === p.id}>{generatingLink === p.id ? 'Gerando…' : 'Gerar link'}</GhostButton>
                        )}
                        {p.status === 'paid' && p.paid_at && <span style={{ fontSize: 12, color: BRAND.success }}>Pago em {fmtDate(p.paid_at)}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

const TABS = [
  { id: 'escola',      label: 'Escola',               icon: GraduationCap },
  { id: 'plano',       label: 'Plano e pagamentos',   icon: DollarSign },
  { id: 'funil',       label: 'Funil e leads',        icon: Filter },
  { id: 'whatsapp',    label: 'WhatsApp',             icon: MessageCircle },
  { id: 'integracoes', label: 'Integrações',          icon: Plug },
]

// Links antigos (?tab=geral, identidade, pagamentos, transmissoes e as seções que
// mudaram de aba) levam ao lugar novo, sem quebrar favoritos nem botões internos.
function normalizeTarget(tab: string | null, sec: string | null): { tab: string | null; sec: string | null } {
  if (tab === 'geral') return { tab: 'escola', sec: 'dados' }
  if (tab === 'identidade') return { tab: 'escola', sec: 'identidade' }
  if (tab === 'pagamentos') return { tab: 'plano', sec: 'pagamentos' }
  if (tab === 'transmissoes') return { tab: 'plano', sec: 'creditos' }
  if (tab === 'escola' && (sec === 'unidade' || sec === 'lembrete')) return { tab: 'funil', sec }
  return { tab, sec }
}

export default function SystemSettings() {
  const { user } = useAuth()
  const role = user?.role
  // Fase 6.2: aba e seção na URL (?tab=whatsapp&sec=horario). Antes ?tab= era ignorado.
  const [searchParams, setSearchParams] = useSearchParams()
  const { tab: urlTab, sec: urlSec } = normalizeTarget(searchParams.get('tab'), searchParams.get('sec'))
  const [showSchoolSetup, setShowSchoolSetup] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const institutionId = user?.institution_id || ''

  // Créditos de Transmissões só aparecem com o módulo liberado pela Áion (mesma regra do menu).
  const broadcastEnabled = useBroadcastEnabled(institutionId)
  const visibleTabs = TABS.filter(t => canSeeSettingsTab(t.id as SettingsTabId, role))
  // Aba pedida na URL vale só se o perfil vê; senão, a primeira visível.
  const activeTab = visibleTabs.some(t => t.id === urlTab) ? (urlTab as string) : (visibleTabs[0]?.id ?? 'escola')
  const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true })
  const sectionSetter = (tab: string) => (sec: string) => setSearchParams(sec ? { tab, sec } : { tab }, { replace: true })
  const setWaSection = sectionSetter('whatsapp')

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const escolaGroups: HubGroup[] = [{
    title: 'Sobre a escola', items: [
      { key: 'dados', label: 'Dados da escola', desc: 'Nome, contato, CNPJ e cidade da escola.', item: 'escola.dados', Icon: Building, render: () => <GeralTab institutionId={institutionId} onToast={showToast} part="dados" /> },
      { key: 'identidade', label: 'Logo e cores', desc: 'A logo e as cores da escola nas telas e mensagens.', item: 'escola.identidade', Icon: Palette, render: () => <IdentidadeTab institutionId={institutionId} onToast={showToast} /> },
      { key: 'series', label: 'Séries', desc: 'As séries e etapas de ensino da escola, na ordem em que aparecem em todo o sistema.', item: 'escola.series', Icon: Layers, render: () => <GradeLevelsEditor institutionId={institutionId} onToast={showToast} /> },
      { key: 'campanha', label: 'Dados da campanha', desc: 'As informações que o assistente usa para falar da escola: séries oferecidas, mensalidade média e dados da campanha.', item: 'escola.campanha', Icon: GraduationCap, render: () => (
        <Card style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Dados da campanha</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, margin: '4px 0 14px', lineHeight: 1.5 }}>Abre o passo a passo com as informações da escola, as séries oferecidas e a mensalidade média.</div>
          <GhostButton onClick={() => setShowSchoolSetup(true)}><GraduationCap size={15} /> Editar dados da campanha</GhostButton>
        </Card>
      ) },
    ],
  }]
  const planoGroups: HubGroup[] = [{
    title: 'Plano e cobrança', items: [
      { key: 'plano', label: 'Plano e faturamento', desc: 'Seu plano na Áion, status e mensalidade.', item: 'plano.plano', Icon: FileText, render: () => <GeralTab institutionId={institutionId} onToast={showToast} part="plano" /> },
      { key: 'pagamentos', label: 'Pagamentos', desc: 'Cobranças da mensalidade e links de pagamento.', item: 'plano.pagamentos', Icon: DollarSign, render: () => <PagamentosTab institutionId={institutionId} /> },
      { key: 'creditos', label: 'Créditos de Transmissões', desc: 'Saldo e recargas para os disparos em massa.', item: 'plano.creditos', Icon: Send, hidden: !broadcastEnabled, render: () => <FinanceTab institutionId={institutionId} /> },
    ],
  }]
  const funilGroups: HubGroup[] = [{
    title: 'Funil e leads', items: [
      { key: 'origens', label: 'Origens do lead', desc: 'De onde os contatos chegam: escolha as que a escola usa e acrescente as suas.', item: 'funil.origens', Icon: Tag, render: () => <LeadSourcesEditor institutionId={institutionId} onToast={showToast} /> },
      { key: 'motivos', label: 'Motivos de perda', desc: 'Por que um lead foi perdido: a lista usada ao marcar como perdido e nos relatórios de recusa.', item: 'funil.motivos', Icon: ThumbsDown, render: () => <LostReasonsEditor institutionId={institutionId} onToast={showToast} /> },
      { key: 'etapas', label: 'Nomes das etapas', desc: 'Renomeie as etapas do funil (Novo, Em contato, Visita…). Só o nome muda.', item: 'funil.etapas', Icon: Workflow, render: () => <StageLabelsEditor institutionId={institutionId} onToast={showToast} /> },
      { key: 'unidade', label: 'Campo de unidade do lead', desc: 'Para escolas com mais de uma unidade: liga o campo e cadastra as opções (Unidade, Campus, Polo…).', item: 'funil.unidade', Icon: MapPin, render: () => <LeadUnitFieldEditor institutionId={institutionId} onToast={showToast} /> },
      { key: 'lembrete', label: 'Lead sem contato', desc: 'Depois de quantos dias sem conversa o lead aparece como "Sem contato".', item: 'funil.lembrete', Icon: Bell, render: () => <LeadReminderSettingsEditor institutionId={institutionId} onToast={showToast} /> },
    ],
  }]

  // Link antigo: troca a URL pelo endereço novo (sem criar histórico).
  useEffect(() => {
    const t = searchParams.get('tab'); const sc = searchParams.get('sec')
    if (t !== urlTab || sc !== urlSec) setSearchParams(urlSec ? { tab: urlTab as string, sec: urlSec } : { tab: urlTab as string }, { replace: true })
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

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
        {activeTab === 'escola' && <HubSettings rootLabel="Escola" groups={escolaGroups} role={role} isMobile={isMobile} section={urlSec} onSectionChange={sectionSetter('escola')} />}
        {activeTab === 'plano' && <HubSettings rootLabel="Plano e pagamentos" groups={planoGroups} role={role} isMobile={isMobile} section={urlSec} onSectionChange={sectionSetter('plano')} />}
        {activeTab === 'funil' && <HubSettings rootLabel="Funil e leads" groups={funilGroups} role={role} isMobile={isMobile} section={urlSec} onSectionChange={sectionSetter('funil')} />}
        {activeTab === 'whatsapp' && <WhatsAppSettings institutionId={institutionId} role={role} section={urlSec} isMobile={isMobile} onSectionChange={setWaSection} />}
        {activeTab === 'integracoes' && institutionId && <IntegrationsTab institutionId={institutionId} onToast={showToast} section={urlSec} onSectionChange={sectionSetter('integracoes')} isMobile={isMobile} />}
      </div>

      {showSchoolSetup && institutionId && (
        <SchoolSetupModal institutionId={institutionId} initialStep={1} editMode={true} onComplete={() => setShowSchoolSetup(false)} />
      )}
    </div>
  )
}
