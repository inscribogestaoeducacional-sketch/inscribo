import React, { useState, useEffect, useRef } from 'react'
import {
  Save, Upload, Building, Mail, Phone, Globe,
  MessageCircle, Wifi, WifiOff, RefreshCw, Settings,
  Users, X, Plus, Check, AlertCircle, GraduationCap,
  MapPin, FileText, DollarSign, Loader2, CheckCircle, Clock, GitBranch, ShieldOff, Trash2,
  ChevronUp, ChevronDown, Pencil, Plug, Zap, Bot, MessageSquareText, Tag, Ban, Star, BarChart3,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import SchoolSetupModal from '../onboarding/SchoolSetupModal'
import FlowEditor from '../whatsapp/FlowEditor'
import EmbeddedSignupButton from '../whatsapp/EmbeddedSignupButton'
import FinanceTab from '../transmissoes/FinanceTab'
import { useBroadcastEnabled } from '../../lib/broadcasts'
import { platformAdmin } from '../../lib/platformAdmin'
import { useGradeLevels, type GradeLevel } from '../../hooks/useGradeLevels'
import LeadUnitFieldEditor from './LeadUnitFieldEditor'
import LeadReminderSettingsEditor from './LeadReminderSettingsEditor'
import IntegrationsTab from './IntegrationsTab'
import { useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom'
import { canSeeSettingsItem, visibleWhatsAppSections } from '../../lib/settingsAccess'
import { resolveSettingsRoute, groupForTab, visibleGroups, SETTINGS_GROUPS, type SettingsGroupId } from '../../lib/settingsMap'
import { BRAND, GRAD } from '../../lib/brand'
import WhatsAppAutomations, { type AutomationsFlow } from '../whatsapp/WhatsAppAutomations'
import WhatsAppUsagePanel from '../whatsapp/WhatsAppUsagePanel'
import { SettingsShell, GroupHub, SectionHeader } from './settings/SettingsPanel'

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

// ─── Aba: WhatsApp ────────────────────────────────────────────────────────────
const FLOW_DAYS = [
  { id: 'MON', label: 'Seg' }, { id: 'TUE', label: 'Ter' }, { id: 'WED', label: 'Qua' },
  { id: 'THU', label: 'Qui' }, { id: 'FRI', label: 'Sex' }, { id: 'SAT', label: 'Sáb' }, { id: 'SUN', label: 'Dom' },
]

// ETAPA 3B-2: mesmo desenho do AION Business — Início do WhatsApp com a faixa
// da conexão e cartões por assunto; cada seção abre com "← WhatsApp".
const WA_SECTIONS = [
  { id: 'conexao',    label: 'Conexão',                  desc: 'Número, situação da conexão e nome do atendente nas mensagens.' },
  { id: 'automacoes', label: 'Automações',               desc: 'Tudo o que o WhatsApp manda sozinho, num lugar só. Cada cartão abre onde se edita.' },
  { id: 'horario',    label: 'Horário de atendimento',   desc: 'Dias e horários da escola, mensagens de fora do horário e almoço, e o tempo de espera do robô.' },
  { id: 'respostas',  label: 'Respostas rápidas',        desc: 'Textos prontos que a equipe usa no chat. O que mudar aqui aparece no WhatsApp na hora.' },
  { id: 'equipe',     label: 'Equipe e distribuição',    desc: 'Grupos que recebem as conversas, horário de cada atendente e o tempo de inatividade.' },
  { id: 'etiquetas',  label: 'Etiquetas',                desc: 'Cores para organizar as conversas e os contatos.' },
  { id: 'bloqueios',  label: 'Números bloqueados',       desc: 'O sistema ignora as mensagens desses números.' },
  { id: 'pesquisa',   label: 'Avaliação do atendimento', desc: 'Ao encerrar, a família avalia o atendimento.' },
  { id: 'uso',        label: 'Uso do mês',               desc: 'Mensagens recebidas e enviadas, dia a dia.' },
]

const WA_ICON: Record<string, typeof Zap> = {
  conexao: Plug, automacoes: Zap, robo: Bot, horario: Clock, respostas: MessageSquareText,
  equipe: Users, etiquetas: Tag, bloqueios: Ban, pesquisa: Star, uso: BarChart3,
}

const WA_HUB_GROUPS: { title: string; items: { id: string; label: string; desc: string; highlight?: boolean }[] }[] = [
  { title: 'Automação', items: [
    { id: 'automacoes', label: 'Automações', desc: 'O que é enviado sozinho e o que está valendo.', highlight: true },
    { id: 'robo',       label: 'Robô de atendimento', desc: 'Boas-vindas, menu e o caminho de cada conversa.', highlight: true },
    { id: 'pesquisa',   label: 'Avaliação do atendimento', desc: 'Nota da família ao encerrar.' },
  ] },
  { title: 'Atendimento', items: [
    { id: 'horario',   label: 'Horário de atendimento', desc: 'Quando a escola atende e o que o robô diz fora dele.' },
    { id: 'equipe',    label: 'Equipe e distribuição', desc: 'Quem recebe cada conversa.' },
    { id: 'respostas', label: 'Respostas rápidas', desc: 'Textos prontos para a equipe.' },
  ] },
  { title: 'Organização', items: [
    { id: 'etiquetas', label: 'Etiquetas', desc: 'Organize as conversas por cor.' },
    { id: 'bloqueios', label: 'Números bloqueados', desc: 'Números que o sistema ignora.' },
    { id: 'uso',       label: 'Uso do mês', desc: 'Mensagens recebidas e enviadas.' },
  ] },
]

// Fase 6.1 — fluxo visual ligado (as 6 escolas hoje): boas-vindas, menu e a
// mensagem genérica de fora do horário ficam sem efeito no webhook.
function hasVisualFlow(flow: unknown): boolean {
  const f = flow as { bot_enabled?: boolean; bot_flow?: { nodes?: unknown[] } | null }
  return !!(f?.bot_enabled && f?.bot_flow?.nodes?.length)
}

// Fase 6.1 — mostra o timeout que o banco aplica de fato
// (process_bot_timeouts: COALESCE(bot_timeout_*, timeout_*)), com os valores salvos.
function EffectiveTimeoutNote({ flow, where }: { flow: Record<string, unknown>; where: 'horario' | 'equipe' }) {
  const botMin = flow.bot_timeout_minutes as number | null | undefined
  const eqMin = flow.timeout_minutes as number | null | undefined
  const botMsg = flow.bot_timeout_message as string | null | undefined
  const eqMsg = flow.timeout_message as string | null | undefined
  const min = botMin || eqMin
  if (!min) return null
  const minFrom = botMin ? 'Horário' : 'Equipe'
  const msgFrom = botMsg ? 'Horário' : eqMsg ? 'Equipe' : null
  const mixed = minFrom !== msgFrom
  return (
    <div style={{ fontSize: 12, color: '#1E3A8A', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '8px 12px', marginBottom: 12, lineHeight: 1.5 }}>
      <strong>Valendo agora:</strong> o robô transfere após <strong>{min} min</strong> (configurado em {minFrom})
      {msgFrom ? <>, com a mensagem configurada em {msgFrom}</> : <>, sem mensagem</>}.
      {where === 'equipe' && botMin ? <> O tempo desta seção só vale se o de Horário → "Transferir após" estiver vazio.</> : null}
      {mixed && msgFrom ? <> Tempo e mensagem vêm de seções diferentes.</> : null}
    </div>
  )
}

// O webhook manda quem chama fora do horário para o grupo do tempo de
// inatividade (whatsapp_flows.timeout_group_id) — regra escondida que esta
// nota mostra nas duas telas que mexem nela.
function OffHoursDestinationNote({ groupId, groups, where }: { groupId?: string | null; groups: { id: string; name: string; emoji: string }[]; where: 'horario' | 'equipe' }) {
  const g = groups.find(x => x.id === groupId)
  return (
    <div style={{ fontSize: 12, color: '#1E3A8A', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '8px 12px', marginBottom: 12, lineHeight: 1.5 }}>
      <strong>Valendo agora:</strong> quem chama fora do horário {g ? <>vai para o grupo <strong>{g.emoji} {g.name}</strong></> : <>fica na fila geral, sem dono</>}.
      {where === 'horario' ? <> Esse grupo é o mesmo do tempo de inatividade, em Equipe e distribuição.</> : <> Trocar o grupo abaixo muda também esse destino.</>}
    </div>
  )
}

const TAG_COLORS = ['#6366f1','#16a34a','#dc2626','#d97706','#0891b2','#ec4899','#64748b','#ea580c']

function WhatsAppTab({ institutionId, role, section, onSectionChange }: {
  institutionId: string
  role: string | null | undefined
  section?: string | null
  onSectionChange?: (sec: string) => void
}) {
  // Fase 6.2: seções filtradas por perfil e ligadas à URL (?sec=)
  const allowedSections = visibleWhatsAppSections(role)
  const [metaConfig, setMetaConfig]       = useState<any>(null)
  const [loading, setLoading]             = useState(true)
  const [usage, setUsage]                 = useState({ count: 0, limit: 1000 })
  const [phoneRecord, setPhoneRecord]     = useState<any>(null)
  const [testing, setTesting]             = useState(false)
  const [testResult, setTestResult]       = useState<{ ok: boolean; msg: string } | null>(null)
  const [showAgentName, setShowAgentName] = useState(false)
  const [savingAgentName, setSavingAgentName] = useState(false)

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
  const [attendants, setAttendants]     = useState<{ id: string; full_name: string; working_hours_start: string; working_hours_end: string; working_days: string[]; lunch_start: string; lunch_end: string; has_lunch_break: boolean }[]>([])
  const [savingAtt, setSavingAtt]       = useState<string | null>(null)
  // Real monthly count
  const [monthlyConvCount, setMonthlyConvCount] = useState(0)
  // Blacklist
  const [blacklist, setBlacklist] = useState<{ id: string; phone_number: string; reason: string | null; created_at: string }[]>([])
  const [showAddBlock, setShowAddBlock] = useState(false)
  const [newBlockNum, setNewBlockNum] = useState('')
  const [newBlockReason, setNewBlockReason] = useState('')
  const [savingBlock, setSavingBlock] = useState(false)
  const [waSection, setWaSectionState] = useState(() => (section && allowedSections.includes(section) ? section : 'inicio'))
  useEffect(() => {
    const target = section && allowedSections.includes(section) ? section : 'inicio'
    if (target !== waSection) setWaSectionState(target)
  }, [section])
  // Situação vista pela conferência automática (whatsapp-health-check, a cada
  // 10 min). Só leitura.
  const [health, setHealth] = useState<{ status: string | null; down_since: string | null } | null>(null)
  useEffect(() => {
    if (!institutionId) return
    let alive = true
    supabase.from('whatsapp_phone_health').select('status, down_since, checked_at').eq('institution_id', institutionId)
      .order('checked_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (alive) setHealth((data?.[0] as { status: string | null; down_since: string | null } | undefined) ?? null) })
    return () => { alive = false }
  }, [institutionId])
  const setWaSection = (sec: string) => { setWaSectionState(sec); onSectionChange?.(sec) }

  // Tags
  const [waTags, setWaTags]       = useState<{ id: string; name: string; color: string }[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [savingTag, setSavingTag] = useState(false)

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

  // Bot timeout (inatividade do bot — transferência automática via pg_cron)
  const [botTimeoutMinutes, setBotTimeoutMinutes]           = useState(10)
  const [botTimeoutMessage, setBotTimeoutMessage]           = useState('')
  const [botTimeoutAssigneeId, setBotTimeoutAssigneeId]     = useState('')
  const [botTimeoutAssigneeType, setBotTimeoutAssigneeType] = useState<'user' | 'group'>('user')

  // Conversa parada (atribuída a um atendente, sem atividade há X horas —
  // volta a ficar visível/resgatável para todos os atendentes via RLS)
  const [staleConversationHours, setStaleConversationHours] = useState(24)

  // Outside hours & lunch messages
  const [outsideHoursMsg, setOutsideHoursMsg] = useState('Olá! Nosso horário de atendimento é de {horario}. Sua mensagem foi registrada e retornaremos em breve! 👋')
  const [lunchMsg, setLunchMsg]               = useState('Olá! No momento nossa equipe está no horário de almoço. Retornaremos em breve! 🍽️')
  const [savingMsgs, setSavingMsgs]           = useState(false)
  const [msgsSaved, setMsgsSaved]             = useState(false)

  const waMountedRef = useRef(true)
  useEffect(() => {
    waMountedRef.current = true
    loadConfig()
    return () => { waMountedRef.current = false }
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('institutions')
        .select('whatsapp_phone_id,whatsapp_phone_number,whatsapp_display_name,whatsapp_connected,show_agent_name_in_messages')
        .eq('id', institutionId).single()
      if (waMountedRef.current) setShowAgentName(!!data?.show_agent_name_in_messages)
      if (waMountedRef.current && data?.whatsapp_phone_id) {
        setMetaConfig(data)
        const monthYear = new Date().toISOString().slice(0, 7)
        const { data: u } = await supabase.from('whatsapp_usage')
          .select('conversation_count,monthly_limit')
          .eq('institution_id', institutionId).eq('month_year', monthYear).maybeSingle()
        if (waMountedRef.current && u) setUsage({ count: (u as any).conversation_count || 0, limit: (u as any).monthly_limit || 1000 })
        const { data: pr } = await supabase.from('whatsapp_phone_numbers')
          .select('phone_number,display_name,phone_number_id,waba_id')
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
        if (flowData.timeout_minutes)      setTimeoutMinutes(flowData.timeout_minutes)
        if (flowData.timeout_group_id)     setTimeoutGroupId(flowData.timeout_group_id)
        if (flowData.timeout_assignee_id)  setTimeoutAssigneeId(flowData.timeout_assignee_id)
        if (flowData.timeout_message)      setTimeoutMessage(flowData.timeout_message)
        if (flowData.outside_hours_message) setOutsideHoursMsg(flowData.outside_hours_message)
        if (flowData.lunch_message)         setLunchMsg(flowData.lunch_message)
        if (flowData.bot_timeout_minutes)       setBotTimeoutMinutes(flowData.bot_timeout_minutes)
        if (flowData.bot_timeout_message)       setBotTimeoutMessage(flowData.bot_timeout_message)
        if (flowData.bot_timeout_assignee_id)   setBotTimeoutAssigneeId(flowData.bot_timeout_assignee_id)
        if (flowData.bot_timeout_assignee_type) setBotTimeoutAssigneeType(flowData.bot_timeout_assignee_type)
        if (flowData.stale_conversation_hours)  setStaleConversationHours(flowData.stale_conversation_hours)
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
        .select('id,full_name,working_hours_start,working_hours_end,working_days,lunch_start,lunch_end')
        .eq('institution_id', institutionId)
      if (waMountedRef.current) setAttendants((atts || []).map((a: any) => ({
        id: a.id,
        full_name: a.full_name,
        working_hours_start: a.working_hours_start || '08:00',
        working_hours_end:   a.working_hours_end   || '18:00',
        working_days:        a.working_days        || ['MON','TUE','WED','THU','FRI'],
        lunch_start:         a.lunch_start         || '12:00',
        lunch_end:           a.lunch_end           || '13:00',
        has_lunch_break:     !!(a.lunch_start && a.lunch_end),
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
    try {
      const { data: tagsData } = await supabase.from('whatsapp_tags')
        .select('id, name, color')
        .eq('institution_id', institutionId)
        .order('name')
      if (waMountedRef.current) setWaTags((tagsData || []) as { id: string; name: string; color: string }[])
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

  // Gravação PARCIAL: cada botão grava só as colunas da própria seção.
  // O banco (trg_whatsapp_flows_guard_columns) só deixa o admin mudar conexão,
  // robô e horário; gravar a linha inteira faria o salvamento do gestor ser
  // recusado se algum campo de horário viesse diferente do banco.
  // ETAPA 3B-2: Horário, tempo do robô e conversa parada também passaram a
  // gravar só as suas colunas (antes: ~25 colunas de uma vez, inclusive
  // boas-vindas e menu, que não têm efeito com o robô ligado).
  const handleSaveFlowPart = async (part: 'horario' | 'robo_timeout' | 'parada' | 'equipe' | 'pesquisa') => {
    setSavingFlow(true)
    try {
      const fields = part === 'horario'
        ? {
            is_active:     true,
            working_days:  flow.working_days,
            working_start: flow.working_start,
            working_end:   flow.working_end,
            // a mensagem genérica só vale sem o robô (fluxo visual)
            ...(hasVisualFlow(flow) ? {} : { off_hours_message: flow.off_hours_message }),
          }
        : part === 'robo_timeout'
        ? {
            bot_timeout_minutes:       botTimeoutMinutes,
            bot_timeout_message:       botTimeoutMessage || null,
            bot_timeout_assignee_id:   botTimeoutAssigneeId || null,
            bot_timeout_assignee_type: botTimeoutAssigneeId ? botTimeoutAssigneeType : null,
          }
        : part === 'parada'
        ? { stale_conversation_hours: staleConversationHours }
        : part === 'equipe'
        ? {
            timeout_minutes:       timeoutMinutes,
            timeout_group_id:      timeoutGroupId || null,
            timeout_assignee_id:   timeoutAssigneeId || null,
            timeout_assignee_name: timeoutAssigneeId ? (flowUsers.find(u => u.id === timeoutAssigneeId)?.full_name || null) : null,
            timeout_message:       timeoutMessage,
          }
        : {
            satisfaction_survey_enabled: flow.satisfaction_survey_enabled,
            satisfaction_message:        flow.satisfaction_message,
          }
      const { error } = await supabase.from('whatsapp_flows')
        .upsert({ institution_id: institutionId, ...fields }, { onConflict: 'institution_id' })
      if (error) { alert('Erro ao salvar: ' + error.message); return }
      setFlowSaved(true)
      setTimeout(() => setFlowSaved(false), 2500)
    } catch (e) {
      console.error('[SAVE FLOW PART] exception:', e)
    } finally {
      setSavingFlow(false)
    }
  }

  const handleToggleAgentName = async (value: boolean) => {
    setSavingAgentName(true)
    setShowAgentName(value)
    const { error } = await supabase.from('institutions')
      .update({ show_agent_name_in_messages: value })
      .eq('id', institutionId)
    if (error) { alert('Erro ao salvar: ' + error.message); setShowAgentName(!value) }
    setSavingAgentName(false)
  }

  const handleTestConnection = async () => {
    const phoneId = metaConfig?.whatsapp_phone_id || phoneRecord?.phone_number_id
    if (!phoneId) { setTestResult({ ok: false, msg: 'Phone ID ou token não configurado.' }); return }
    setTesting(true); setTestResult(null)
    try {
      // Teste roda no servidor (platform-admin): o token global nunca vem pro navegador.
      const data = await platformAdmin<{ ok: boolean; error?: string; verified_name?: string; display_phone_number?: string }>('test_connection', { institution_id: institutionId })
      if (data.ok) {
        setTestResult({ ok: true, msg: `✅ Conectado: ${data.verified_name} (${data.display_phone_number})` })
      } else {
        setTestResult({ ok: false, msg: `❌ ${data.error || 'Token inválido'}` })
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
        lunch_start:         att.has_lunch_break ? att.lunch_start : null,
        lunch_end:           att.has_lunch_break ? att.lunch_end   : null,
      }).eq('id', att.id)
    } catch (e) { console.error(e) } finally { setSavingAtt(null) }
  }

  const toggleAttendantLunch = (id: string) => {
    setAttendants(prev => prev.map(a => a.id === id ? { ...a, has_lunch_break: !a.has_lunch_break } : a))
  }

  const handleSaveMsgs = async () => {
    setSavingMsgs(true)
    try {
      const { error } = await supabase.from('whatsapp_flows').upsert(
        { institution_id: institutionId, outside_hours_message: outsideHoursMsg, lunch_message: lunchMsg },
        { onConflict: 'institution_id' }
      )
      if (error) { alert('Erro: ' + error.message); return }
      setMsgsSaved(true)
      setTimeout(() => setMsgsSaved(false), 2500)
    } catch (e) { console.error(e) } finally { setSavingMsgs(false) }
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

  const dCard  = { background: '#fff', borderRadius: 18, border: `1px solid ${BRAND.line}`, padding: 20, boxShadow: '0 1px 2px rgba(11,27,52,.04)' }
  const dInput = { background: '#fff', border: `1px solid ${BRAND.line}`, color: BRAND.ink, borderRadius: 12, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' as const }
  const dLabel = { fontSize: 12, fontWeight: 600 as const, color: '#475569', display: 'block' as const, marginBottom: 6 }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} color="#2563EB" className="animate-spin" />
    </div>
  )

  if (!metaConfig?.whatsapp_phone_id) return (
    <div style={{ background: '#F8FAFC', borderRadius: 16, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ ...dCard, maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: '#E2E8F0', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <WifiOff size={26} color="#94A3B8" />
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0B1B34', margin: '0 0 8px' }}>WhatsApp não configurado</h2>
        <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px', lineHeight: 1.6 }}>
          Conecte agora mesmo usando sua conta do Meta Business — sem precisar de ajuda da nossa equipe.
        </p>
        <EmbeddedSignupButton institutionId={institutionId} onConnected={loadConfig} />
        <p style={{ fontSize: 12, color: '#94A3B8', margin: '20px 0 0', lineHeight: 1.6 }}>
          Prefere que a gente configure pra você? Entre em contato com o administrador da plataforma.
        </p>
      </div>
    </div>
  )

  const phoneLabel = phoneRecord?.phone_number || metaConfig.whatsapp_phone_number || ''
  const current = WA_SECTIONS.find(x => x.id === waSection)
  const canConexao = allowedSections.includes('conexao')
  const groupsHub = WA_HUB_GROUPS
    .map(g => ({ ...g, items: g.items.filter(it => (it.id === 'robo' ? canConexao : allowedSections.includes(it.id))) }))
    .filter(g => g.items.length)
  // Situação: o teste manual (Verificar) vale por cima da conferência automática
  const live: { st: 'ok' | 'off' | 'checking' | 'unknown'; msg?: string } = testing ? { st: 'checking' }
    : testResult ? (testResult.ok ? { st: 'ok' } : { st: 'off', msg: testResult.msg.replace(/^❌ /, '') })
    : health?.down_since ? { st: 'off', msg: `Fora do ar desde ${new Date(health.down_since).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Use "Reconectar" na Conexão.` }
    : health?.status === 'CONNECTED' ? { st: 'ok' } : { st: 'unknown' }

  return (
    <>
      {showFlowEditor && <FlowEditor institutionId={institutionId} onClose={() => { setShowFlowEditor(false); loadConfig() }} />}
      <style>{`
        @keyframes aionPop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes aionSlide{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
        .aion-pop{animation:aionPop .32s cubic-bezier(.2,.8,.2,1) both}
        .aion-slide{animation:aionSlide .28s cubic-bezier(.2,.8,.2,1) both}
        .aion-tile{transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease}
        .aion-tile:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(11,27,52,.08);border-color:#C3D5F2}
      `}</style>

      {waSection === 'inicio' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Número conectado */}
          <div className="aion-pop" style={{ borderRadius: 20, padding: 22, color: '#fff', background: live.st === 'off' ? 'linear-gradient(130deg, #B91C1C 0%, #DC2626 100%)' : GRAD, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageCircle size={26} />
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontSize: 12, opacity: .85, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>WhatsApp oficial (Meta)</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{phoneLabel || metaConfig.whatsapp_display_name || 'Número conectado'}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.18)', padding: '4px 10px', borderRadius: 999 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: live.st === 'ok' ? '#A3E635' : live.st === 'off' ? '#FECACA' : '#FDE68A' }} />
                  {live.st === 'ok' ? 'Conectado' : live.st === 'off' ? 'Desconectado' : live.st === 'checking' ? 'Verificando…' : 'Status indisponível'}
                </span>
                {canConexao && (
                  <button onClick={handleTestConnection} disabled={testing} title="Verificar de novo" aria-label="Verificar conexão de novo" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.18)', border: 'none', padding: '4px 10px', borderRadius: 999, cursor: 'pointer' }}>
                    <RefreshCw size={12} className={testing ? 'animate-spin' : undefined} /> Verificar
                  </button>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.18)', padding: '4px 10px', borderRadius: 999 }}>
                  {flow.bot_enabled ? 'Robô ligado' : 'Atendimento manual'}
                </span>
              </div>
              {live.st === 'off' && live.msg && <div style={{ fontSize: 12.5, marginTop: 8, opacity: .95 }}>{live.msg}</div>}
            </div>
            {canConexao && (
              <button onClick={() => setWaSection('conexao')}
                style={{ fontSize: 13, fontWeight: 700, color: '#0B1B34', background: '#fff', border: 'none', borderRadius: 12, padding: '11px 16px', cursor: 'pointer' }}>
                {live.st === 'off' ? 'Reconectar agora' : 'Gerenciar conexão'}
              </button>
            )}
          </div>

          {groupsHub.map((g, gi) => (
            <div key={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#5B6B86', letterSpacing: '.06em', textTransform: 'uppercase' }}>{g.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {g.items.map((it, i) => (
                  <button key={it.id} className="aion-pop aion-tile"
                    onClick={() => it.id === 'robo' ? setShowFlowEditor(true) : setWaSection(it.id)}
                    style={{ animationDelay: `${(gi * 4 + i) * 35}ms`, textAlign: 'left', background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: 16, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: 'inherit' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: it.highlight ? GRAD : BRAND.soft, color: it.highlight ? '#fff' : BRAND.primary }}>{(() => { const I = WA_ICON[it.id] || Settings; return <I size={19} /> })()}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0B1B34' }}>{it.label}</span>
                      <span style={{ fontSize: 12.5, color: '#5B6B86', lineHeight: 1.45 }}>{it.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div key={waSection} className="aion-slide" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionHeader backLabel="WhatsApp" onBack={() => setWaSection('inicio')} title={current?.label ?? ''} desc={current?.desc} />

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {waSection === 'automacoes' && (
            <WhatsAppAutomations
              flow={flow as AutomationsFlow}
              outsideHoursMsg={outsideHoursMsg}
              lunchMsg={lunchMsg}
              groups={groups}
              onOpen={setWaSection}
              onOpenFlowEditor={() => setShowFlowEditor(true)}
            />
          )}

          {waSection === 'uso' && <WhatsAppUsagePanel institutionId={institutionId} />}

          {waSection === 'conexao' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={dCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, background: '#F0FDF4', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wifi size={20} color="#3B82F6" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0B1B34' }}>WhatsApp oficial (Meta)</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{metaConfig.whatsapp_display_name}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: live.st === 'ok' ? '#F0FDF4' : live.st === 'off' ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${live.st === 'ok' ? '#BBF7D0' : live.st === 'off' ? '#FECACA' : '#FDE68A'}`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: live.st === 'ok' ? '#15803D' : live.st === 'off' ? '#B91C1C' : '#B45309' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{live.st === 'ok' ? 'Conectado' : live.st === 'off' ? 'Desconectado' : live.st === 'checking' ? 'Verificando…' : 'Status indisponível'}
                  </span>
                </div>
                <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                  <div>Número: <strong style={{ color: '#0B1B34' }}>{phoneRecord?.phone_number || metaConfig.whatsapp_phone_number || '—'}</strong></div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  {flow.bot_enabled
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#16a34a' }}>Robô ativo</span>
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
                    style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: '#EFF6FF', border: '1px solid #2563EB', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#2563EB', cursor: 'pointer' }}>
                    <GitBranch size={14} />Editar robô
                  </button>
                  <button onClick={handleTestConnection} disabled={testing}
                    style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer', opacity: testing ? 0.6 : 1 }}>
                    {testing ? <><Loader2 size={13} className="animate-spin" />Testando...</> : <><RefreshCw size={13} />Testar conexão</>}
                  </button>
                </div>
              </div>

              {/* Reconexão em coexistência — só admin da escola, só escola que já tem número */}
              {role === 'admin' && metaConfig?.whatsapp_phone_id && (
                <div style={{ ...dCard, border: '1px solid #FDE68A', background: '#FFFBEB' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>Reconectar WhatsApp (coexistência)</div>
                  <div style={{ fontSize: 12, color: '#78350F', margin: '4px 0 12px', lineHeight: 1.6 }}>
                    Use só se a Áion parou de enviar e receber mensagens, mas o app WhatsApp Business continua funcionando no celular da escola. Religa a conta atual — não cria número nem conta nova.
                  </div>
                  <EmbeddedSignupButton
                    institutionId={institutionId}
                    onConnected={loadConfig}
                    mode="reconnect"
                    reconnectTarget={{
                      wabaId: phoneRecord?.waba_id ?? null,
                      phoneNumber: phoneRecord?.phone_number || metaConfig.whatsapp_phone_number || null,
                      displayName: phoneRecord?.display_name || metaConfig.whatsapp_display_name || null,
                    }}
                  />
                </div>
              )}

              <div style={dCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0B1B34' }}>Mostrar nome do atendente nas mensagens</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 1.5 }}>
                      Quando ativado, as mensagens enviadas pelos atendentes mostram o nome de quem está respondendo, numa linha antes do texto (ex: <strong>*Maria*:</strong><br />Olá!). Não afeta templates nem mensagens automáticas do bot.
                    </div>
                  </div>
                  <button onClick={() => handleToggleAgentName(!showAgentName)} disabled={savingAgentName}
                    style={{ width: 44, height: 24, borderRadius: 999, background: showAgentName ? '#2563EB' : '#CBD5E1', border: 'none', cursor: savingAgentName ? 'default' : 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, opacity: savingAgentName ? 0.6 : 1 }}>
                    <span style={{ position: 'absolute', top: 3, left: showAgentName ? 22 : 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {waSection === 'horario' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={dCard}>
                <div style={{ marginBottom: 16 }}>
                  <label style={dLabel}>Dias da semana</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {FLOW_DAYS.map(d => (
                      <button key={d.id} onClick={() => toggleDay(d.id)}
                        style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${flow.working_days.includes(d.id) ? '#2563EB' : '#E2E8F0'}`, background: flow.working_days.includes(d.id) ? '#EFF6FF' : '#fff', color: flow.working_days.includes(d.id) ? '#2563EB' : '#64748B' }}>
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
                {!hasVisualFlow(flow) && (
                <div style={{ marginBottom: 16 }}>
                  <label style={dLabel}>Mensagem fora do horário (robô desligado)</label>
                  <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 6px' }}>Com o robô desligado, é esta que a família recebe quando a escola está fechada.</p>
                  <textarea rows={3} style={{ ...dInput, resize: 'vertical' as const }} value={flow.off_hours_message} onChange={e => setFlow(f => ({ ...f, off_hours_message: e.target.value }))} />
                </div>
                )}
                <button onClick={() => handleSaveFlowPart('horario')} disabled={savingFlow}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 12, border: 'none', background: flowSaved ? '#16a34a' : GRAD, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingFlow ? 0.7 : 1 }}>
                  {savingFlow ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : flowSaved ? <><Check size={13} />Salvo!</> : <><Save size={13} />Salvar horário</>}
                </button>
              </div>

              {/* Mensagens automáticas de horário */}
              <div style={dCard}>
                <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Mensagens automáticas</div>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>O robô manda estas mensagens sozinho. Ao salvar, vale na próxima conversa.</p>
                <OffHoursDestinationNote groupId={(flow as Record<string, unknown>).timeout_group_id as string | null} groups={groups} where="horario" />
                <div style={{ marginBottom: 16 }}>
                  <label style={dLabel}>Mensagem fora do horário</label>
                  {hasVisualFlow(flow) && (
                    <p style={{ fontSize: 11, color: '#15803D', margin: '0 0 4px' }}>É esta que o robô manda quando a escola está fechada.</p>
                  )}
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 6px' }}>Use <strong>{'{horario}'}</strong> para inserir os horários configurados automaticamente</p>
                  <textarea rows={3} style={{ ...dInput, resize: 'vertical' as const }} value={outsideHoursMsg} onChange={e => setOutsideHoursMsg(e.target.value)} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={dLabel}>Mensagem de horário de almoço</label>
                  <textarea rows={3} style={{ ...dInput, resize: 'vertical' as const }} value={lunchMsg} onChange={e => setLunchMsg(e.target.value)} />
                </div>
                <button onClick={handleSaveMsgs} disabled={savingMsgs}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 12, border: 'none', background: msgsSaved ? '#16a34a' : GRAD, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingMsgs ? 0.7 : 1 }}>
                  {savingMsgs ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : msgsSaved ? <><Check size={13} />Salvo!</> : <><Save size={13} />Salvar mensagens</>}
                </button>
              </div>

              {/* ─── Bot Timeout ──────────────────────────────────────────── */}
              <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 14 }}>Tempo de espera do robô</div>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
                  Quando o robô está ligado e a família não responde por alguns minutos, o sistema envia uma mensagem e passa a conversa para a equipe.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <EffectiveTimeoutNote flow={flow as Record<string, unknown>} where="horario" />
                  <label style={dLabel}>Transferir após</label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={botTimeoutMinutes}
                    onChange={e => setBotTimeoutMinutes(Math.max(1, Math.min(1440, parseInt(e.target.value) || 1)))}
                    style={{ width: 72, padding: '7px 10px', fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none', textAlign: 'center', color: '#0B1B34' }}
                  />
                  <span style={{ fontSize: 13, color: '#64748B' }}>minutos sem resposta</span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={dLabel}>Mensagem ao transferir para atendimento</label>
                  <textarea
                    rows={3}
                    value={botTimeoutMessage}
                    onChange={e => setBotTimeoutMessage(e.target.value)}
                    placeholder={'Olá! Vou te conectar com um de nossos atendentes. Aguarde um momento. 😊'}
                    style={{ ...dInput, resize: 'vertical' as const }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={dLabel}>Destino ao transferir (opcional)</label>
                  {/* Toggle: Atendente / Equipe */}
                  <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid #E2E8F0', width: 'fit-content' }}>
                    {(['user', 'group'] as const).map((type, i) => (
                      <button
                        key={type}
                        onClick={() => { setBotTimeoutAssigneeType(type); setBotTimeoutAssigneeId('') }}
                        style={{
                          padding: '7px 16px',
                          fontSize: 12,
                          fontWeight: 600,
                          border: 'none',
                          borderRight: i === 0 ? '1px solid #E2E8F0' : 'none',
                          background: botTimeoutAssigneeType === type ? '#2563EB' : '#F8FAFC',
                          color: botTimeoutAssigneeType === type ? '#fff' : '#64748B',
                          cursor: 'pointer',
                        }}>
                        {type === 'user' ? 'Atendente' : 'Equipe'}
                      </button>
                    ))}
                  </div>

                  {botTimeoutAssigneeType === 'user' ? (
                    <select
                      value={botTimeoutAssigneeId}
                      onChange={e => setBotTimeoutAssigneeId(e.target.value)}
                      style={{ ...dInput }}>
                      <option value="">— Fila geral —</option>
                      {flowUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={botTimeoutAssigneeId}
                      onChange={e => setBotTimeoutAssigneeId(e.target.value)}
                      style={{ ...dInput }}>
                      <option value="">— Fila geral —</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <button onClick={() => handleSaveFlowPart('robo_timeout')} disabled={savingFlow}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 12, border: 'none', background: flowSaved ? '#16a34a' : GRAD, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingFlow ? 0.7 : 1 }}>
                  {savingFlow ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : flowSaved ? <><Check size={13} />Salvo!</> : <><Save size={13} />Salvar tempo de espera</>}
                </button>
              </div>

              {/* ─── Conversas Paradas ────────────────────────────────────── */}
              <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 14 }}>Conversas paradas</div>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
                  Se um atendente ficar ausente (férias, folga etc.), as conversas atribuídas a ele voltam a
                  ficar visíveis e resgatáveis por qualquer atendente após ficarem paradas por este período.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <label style={dLabel}>Tempo para considerar parada</label>
                  <select
                    value={staleConversationHours}
                    onChange={e => setStaleConversationHours(parseInt(e.target.value))}
                    style={{ ...dInput, width: 160 }}
                  >
                    <option value={4}>4 horas</option>
                    <option value={8}>8 horas</option>
                    <option value={12}>12 horas</option>
                    <option value={24}>24 horas</option>
                    <option value={48}>48 horas</option>
                  </select>
                </div>
                <button onClick={() => handleSaveFlowPart('parada')} disabled={savingFlow}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 12, border: 'none', background: flowSaved ? '#16a34a' : GRAD, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingFlow ? 0.7 : 1 }}>
                  {savingFlow ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : flowSaved ? <><Check size={13} />Salvo!</> : <><Save size={13} />Salvar</>}
                </button>
              </div>
            </div>
          )}

          {waSection === 'respostas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                          <button onClick={handleUpdateQR} style={{ padding: '7px 10px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}><Check size={13} /></button>
                          <button onClick={() => setEditQRId(null)} style={{ padding: '7px 10px', background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer' }}><X size={13} /></button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#2563EB' }}>/{qr.title}</span>
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
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!newQR.title || !newQR.message || savingQR) ? 0.5 : 1 }}>
                    <Plus size={14} />{savingQR ? 'Salvando...' : 'Adicionar resposta rápida'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {waSection === 'equipe' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Horário de cada atendente</h3>
              {!canSeeSettingsItem('whatsapp.equipe.horarios', role) ? (
                <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Só o administrador altera o horário dos atendentes.</p>
              ) : attendants.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Nenhum atendente cadastrado.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {attendants.map(att => (
                    <div key={att.id} style={dCard}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0B1B34', marginBottom: 12 }}>{att.full_name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                        {FLOW_DAYS.map(d => (
                          <button key={d.id} onClick={() => toggleAttendantDay(att.id, d.id)}
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `2px solid ${att.working_days.includes(d.id) ? '#2563EB' : '#E2E8F0'}`, background: att.working_days.includes(d.id) ? '#EFF6FF' : '#fff', color: att.working_days.includes(d.id) ? '#2563EB' : '#64748B' }}>
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
                          style={{ padding: '9px 14px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingAtt === att.id ? 0.6 : 1 }}>
                          {savingAtt === att.id ? '...' : <Save size={13} />}
                        </button>
                      </div>
                      {/* Lunch break */}
                      <div style={{ marginTop: 12, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: att.has_lunch_break ? 10 : 0 }}>
                          <button onClick={() => toggleAttendantLunch(att.id)}
                            style={{ width: 36, height: 20, borderRadius: 999, background: att.has_lunch_break ? '#2563EB' : '#CBD5E1', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                            <span style={{ position: 'absolute', top: 2, left: att.has_lunch_break ? 18 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
                          </button>
                          <span style={{ fontSize: 12, color: '#64748B' }}>Tem horário de almoço?</span>
                        </div>
                        {att.has_lunch_break && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={dLabel}>Almoço início</label>
                              <input type="time" style={dInput} value={att.lunch_start} onChange={e => updateAttendant(att.id, 'lunch_start', e.target.value)} />
                            </div>
                            <div>
                              <label style={dLabel}>Almoço fim</label>
                              <input type="time" style={dInput} value={att.lunch_end} onChange={e => updateAttendant(att.id, 'lunch_end', e.target.value)} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grupos de Atendimento */}
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0B1B34', margin: 0 }}>Grupos de atendimento</h4>
                  <button
                    onClick={() => { setGroupForm({ name: '', emoji: '👥', member_ids: [] }); setEditingGroup(null); setShowGroupForm(true) }}
                    style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', border: '1px solid #B2E8E2', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
                  >+ Novo grupo</button>
                </div>
                {groups.length === 0 && (
                  <p style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Nenhum grupo criado ainda</p>
                )}
                {groups.map(group => (
                  <div key={group.id} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #E3E8F0', background: '#F6F8FB', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0B1B34' }}>{group.emoji} {group.name}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        {group.member_ids.length} membro(s): {group.member_ids.map(id => flowUsers.find(u => u.id === id)?.full_name || id).join(', ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setGroupForm({ name: group.name, emoji: group.emoji, member_ids: group.member_ids }); setEditingGroup(group); setShowGroupForm(true) }}
                        style={{ fontSize: 11, color: '#2563EB', background: 'none', border: '1px solid #B2E8E2', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
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
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0B1B34', marginBottom: 16 }}>{editingGroup ? 'Editar grupo' : 'Novo grupo'}</h3>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input value={groupForm.emoji} onChange={e => setGroupForm(f => ({ ...f, emoji: e.target.value }))}
                        style={{ width: 50, padding: 8, fontSize: 20, border: '1px solid #E3E8F0', borderRadius: 8, textAlign: 'center', outline: 'none' }} maxLength={2} />
                      <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nome do grupo (ex: Secretaria)"
                        style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid #E3E8F0', borderRadius: 8, outline: 'none', color: '#0B1B34' }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 8 }}>Membros do grupo</label>
                      {flowUsers.map(user => (
                        <label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13, color: '#0B1B34' }}>
                          <input type="checkbox" checked={groupForm.member_ids.includes(user.id)}
                            onChange={e => setGroupForm(f => ({ ...f, member_ids: e.target.checked ? [...f.member_ids, user.id] : f.member_ids.filter(id => id !== user.id) }))} />
                          {user.full_name}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowGroupForm(false)}
                        style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #E3E8F0', borderRadius: 8, background: 'white', cursor: 'pointer', color: '#64748B' }}>
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
                        style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 700, background: '#2563EB', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                        {editingGroup ? 'Salvar' : 'Criar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Fase 6.1: o banco usa COALESCE(bot_timeout_*, timeout_*) — o de
                  Horário vale; este só entra quando aquele está vazio. Mostra o
                  que está valendo agora (valores salvos), sem mudar a regra. */}
              <EffectiveTimeoutNote flow={flow as Record<string, unknown>} where="equipe" />
              {/* Timeout de Inatividade */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #E3E8F0' }}>
                <h4 style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 12 }}>Tempo de inatividade</h4>
                <OffHoursDestinationNote groupId={(flow as Record<string, unknown>).timeout_group_id as string | null} groups={groups} where="equipe" />

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Tempo sem resposta:</label>
                  <input type="number" min={5} max={120} value={timeoutMinutes}
                    onChange={e => setTimeoutMinutes(Number(e.target.value))}
                    style={{ width: 70, padding: '7px 10px', fontSize: 13, border: '1px solid #E3E8F0', borderRadius: 8, outline: 'none', textAlign: 'center' }} />
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
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E3E8F0', borderRadius: 8, background: '#F6F8FB', color: '#0B1B34', outline: 'none' }}>
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
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E3E8F0', borderRadius: 8, background: '#F6F8FB', color: '#0B1B34', resize: 'none' as const, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => handleSaveFlowPart('equipe')} disabled={savingFlow}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 12, border: 'none', background: flowSaved ? '#16a34a' : GRAD, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingFlow ? 0.7 : 1 }}>
                    {savingFlow ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : flowSaved ? <><Check size={13} />Salvo!</> : <><Save size={13} />Salvar tempo de inatividade</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {waSection === 'bloqueios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Mensagens desses números não entram no WhatsApp da escola.</p>
                <button onClick={() => setShowAddBlock(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#DC2626', cursor: 'pointer' }}>
                  <Plus size={13} /> Bloquear número
                </button>
              </div>
              {/* Fase 6.1: lista diferente da de Transmissões → "Não recebem" */}
              <p style={{ fontSize: 12, color: '#475569', margin: '8px 0 0', lineHeight: 1.5 }}>
                Mensagens de número bloqueado aqui são ignoradas: não entram no Hub e o robô não responde. Quem pediu para <strong>não receber disparos</strong> fica em outra lista,
                em <a href="/transmissoes" style={{ color: '#2563EB', fontWeight: 600 }}>Transmissões → Não recebem</a>.
              </p>
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
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0B1B34', fontFamily: 'monospace' }}>{b.phone_number}</p>
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

          {waSection === 'etiquetas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={dCard}>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B' }}>
                  Crie etiquetas para organizar suas conversas e leads no fluxo do robô.
                </p>

                {waTags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                    {waTags.map(tag => (
                      <div key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: tag.color, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                        {tag.name}
                        <button onClick={async () => {
                          await supabase.from('whatsapp_tags').delete().eq('id', tag.id)
                          setWaTags(prev => prev.filter(t => t.id !== tag.id))
                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {waTags.length === 0 && (
                  <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Nenhuma etiqueta criada ainda.</p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Nome da etiqueta</label>
                    <input className={inputCls} value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Ex: VIP, Interessado, Aguardando..." maxLength={30} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>Cor</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {TAG_COLORS.map(c => (
                        <button key={c} onClick={() => setNewTagColor(c)}
                          style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: newTagColor === c ? '3px solid #1A2B4A' : '2px solid transparent', cursor: 'pointer', flexShrink: 0, outline: 'none' }} />
                      ))}
                    </div>
                  </div>
                  <button disabled={savingTag || !newTagName.trim()}
                    onClick={async () => {
                      if (!newTagName.trim()) return
                      setSavingTag(true)
                      const { data, error } = await supabase.from('whatsapp_tags')
                        .insert({ institution_id: institutionId, name: newTagName.trim(), color: newTagColor })
                        .select('id, name, color').single()
                      setSavingTag(false)
                      if (!error && data) {
                        setWaTags(prev => [...prev, data as { id: string; name: string; color: string }].sort((a, b) => a.name.localeCompare(b.name)))
                        setNewTagName(''); setNewTagColor('#6366f1')
                      }
                    }}
                    style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingTag || !newTagName.trim() ? 0.6 : 1 }}>
                    {savingTag ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : <><Plus size={13} />Adicionar etiqueta</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {waSection === 'pesquisa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={dCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0B1B34' }}>Avaliação automática</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>Ao encerrar o atendimento, envia uma avaliação com 3 opções (Ótimo, Regular, Ruim). Não confundir com o módulo Pesquisas, que envia questionários por link.</p>
                  </div>
                  <button onClick={() => setFlow(f => ({ ...f, satisfaction_survey_enabled: !f.satisfaction_survey_enabled }))}
                    style={{ width: 44, height: 24, borderRadius: 999, background: flow.satisfaction_survey_enabled ? '#2563EB' : '#CBD5E1', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
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
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #E3E8F0', background: '#F6F8FB', color: '#0B1B34', resize: 'none' as const, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 16 }}>
                  <button onClick={() => handleSaveFlowPart('pesquisa')} disabled={savingFlow}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 12, border: 'none', background: flowSaved ? '#16a34a' : GRAD, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingFlow ? 0.7 : 1 }}>
                    {savingFlow ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : flowSaved ? <><Check size={13} />Salvo!</> : <><Save size={13} />Salvar configuração</>}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      )}
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

// ─── Item 4b — editor de séries/etapas de ensino (school_grade_levels) ─────────
// Antes hardcoded em ~10 arquivos com nomenclaturas divergentes entre si
// (ver useGradeLevels.ts) — agora configurável por escola, com seed
// automático no cadastro. Editar/reordenar aqui aciona useGradeLevels nos
// outros lugares (create-lead, filtros, etc.) via reload().
function GradeLevelsEditor({ institutionId, onToast }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void }) {
  const { gradeLevels, loading, reload } = useGradeLevels(institutionId)
  const [rows, setRows] = useState<GradeLevel[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setRows(gradeLevels) }, [gradeLevels])

  const persistOrder = async (ordered: GradeLevel[]) => {
    setSaving(true)
    try {
      await Promise.all(ordered.map((g, i) => supabase.from('school_grade_levels').update({ sort_order: i + 1 }).eq('id', g.id)))
      await reload()
    } catch { onToast('Erro ao reordenar séries', false) } finally { setSaving(false) }
  }

  const moveRow = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    setRows(next)
    persistOrder(next)
  }

  const startEdit = (g: GradeLevel) => { setEditingId(g.id); setEditingName(g.name) }

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('school_grade_levels').update({ name: editingName.trim() }).eq('id', editingId)
      if (error) throw error
      setEditingId(null)
      await reload()
      onToast('Série atualizada!')
    } catch { onToast('Erro ao salvar. Nome já existe?', false) } finally { setSaving(false) }
  }

  const removeRow = async (g: GradeLevel) => {
    if (!window.confirm(`Remover "${g.name}"? Leads já cadastrados com essa série não serão afetados.`)) return
    setSaving(true)
    try {
      const { error } = await supabase.from('school_grade_levels').delete().eq('id', g.id)
      if (error) throw error
      await reload()
      onToast('Série removida.')
    } catch { onToast('Erro ao remover série', false) } finally { setSaving(false) }
  }

  const addRow = async () => {
    if (!newName.trim() || !institutionId) return
    setSaving(true)
    try {
      const nextOrder = (rows[rows.length - 1]?.sort_order ?? 0) + 1
      const { error } = await supabase.from('school_grade_levels').insert({ institution_id: institutionId, name: newName.trim(), sort_order: nextOrder })
      if (error) throw error
      setNewName('')
      await reload()
      onToast('Série adicionada!')
    } catch { onToast('Erro ao adicionar. Nome já existe?', false) } finally { setSaving(false) }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24, maxWidth: 560 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', marginBottom: 6 }}>Séries / etapas de ensino</h3>
      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 18, lineHeight: 1.6 }}>Nomenclatura usada nos formulários de lead, filtros e relatórios. Arraste a ordem com as setas.</p>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {rows.map((g, i) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <button disabled={i === 0 || saving} onClick={() => moveRow(i, -1)} style={{ width: 20, height: 16, border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronUp size={13} color="#64748B" /></button>
                <button disabled={i === rows.length - 1 || saving} onClick={() => moveRow(i, 1)} style={{ width: 20, height: 16, border: 'none', background: 'none', cursor: i === rows.length - 1 ? 'default' : 'pointer', opacity: i === rows.length - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronDown size={13} color="#64748B" /></button>
              </div>
              {editingId === g.id ? (
                <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #00A896', fontSize: 13, outline: 'none' }} />
              ) : (
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{g.name}</span>
              )}
              {editingId === g.id ? (
                <button onClick={saveEdit} disabled={saving} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Check size={13} color="#00A896" /></button>
              ) : (
                <button onClick={() => startEdit(g)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Pencil size={13} color="#94A3B8" /></button>
              )}
              <button onClick={() => removeRow(g)} disabled={saving} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={13} color="#EF4444" /></button>
            </div>
          ))}
          {rows.length === 0 && <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: 12 }}>Nenhuma série cadastrada ainda.</p>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRow()} placeholder="Nova série (ex: 1º Ano EF)" className={inputCls} style={{ flex: 1 }} />
        <button onClick={addRow} disabled={saving || !newName.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !newName.trim() ? 0.5 : 1 }}>
          <Plus size={14} />Adicionar
        </button>
      </div>
    </div>
  )
}

// ─── SystemSettings Principal ─────────────────────────────────────────────────
// ETAPA 3B-2: casca do AION Business — cabeçalho, busca e os assuntos em abas
// (lista no celular). /settings abre o primeiro assunto; /settings/<grupo>
// abre o assunto; os links antigos ?tab=…&sec=… abrem a mesma tela de antes,
// dentro do assunto dela, com "← assunto" (WhatsApp: a seção já no desenho novo).
const TAB_TITLE: Record<string, { title: string; desc: string }> = {
  geral:        { title: 'Dados da escola', desc: 'Nome, e-mail, telefone, CNPJ, cidade e estado. Aparecem nas telas e nos contratos.' },
  identidade:   { title: 'Logo e cores', desc: 'Usados nas telas da escola e, quando a Vitrine não tem os próprios, nela também.' },
  escola:       { title: 'Séries, campanha, unidade e lembrete', desc: 'Séries que a escola oferece, dados da campanha, campo de unidade do lead e lembrete de lead sem contato.' },
  integracoes:  { title: 'Base de alunos e Activesoft', desc: 'Relatório de alunos, lançamento manual por série e a ligação com o sistema escolar.' },
  pagamentos:   { title: 'Pagamentos', desc: 'Histórico das cobranças da Áion.' },
  transmissoes: { title: 'Créditos de Transmissões', desc: 'Saldo e extrato dos créditos de campanhas.' },
}

export default function SystemSettings() {
  const { user } = useAuth()
  const role = user?.role
  // Fase 6.2: aba e seção na URL (?tab=whatsapp&sec=horario). ETAPA 3B: + /settings/<grupo>.
  const [searchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const urlSec = searchParams.get('sec')
  const { grupo } = useParams<{ grupo?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [showSchoolSetup, setShowSchoolSetup] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const institutionId = user?.institution_id || ''

  // Créditos de Transmissões só com o módulo liberado pela Áion (mesma regra do menu).
  const broadcastEnabled = useBroadcastEnabled(institutionId)
  const ctx = { role, broadcast: broadcastEnabled }
  const route = resolveSettingsRoute({ grupo, tab: urlTab, sec: urlSec }, ctx)
  const groups = visibleGroups(ctx)
  const redirectTo = route.kind === 'redirect' ? route.to : null

  useEffect(() => {
    if (redirectTo) navigate(redirectTo, { replace: true })
  }, [redirectTo, navigate])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // Assunto em destaque nas abas: o do endereço, ou de onde a pessoa veio.
  const activeGroup: SettingsGroupId | null = route.kind === 'group' ? route.group
    : route.kind === 'home' ? (groups[0]?.id ?? null)
    : route.kind === 'tab' ? ((location.state as { from?: SettingsGroupId } | null)?.from ?? groupForTab(route.tab, route.sec))
    : null
  // Seções do WhatsApp com histórico (o "voltar" do navegador funciona).
  const openWaSection = (sec: string) => navigate(sec === 'inicio' ? '/settings/whatsapp' : `/settings?tab=whatsapp&sec=${sec}`, { state: { from: 'whatsapp' } })
  const activeTab = route.kind === 'tab' ? route.tab : null
  const backGroup = SETTINGS_GROUPS.find(g => g.id === activeGroup)

  return (
    <SettingsShell ctx={ctx} groups={groups} active={activeGroup}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {(route.kind === 'home' || route.kind === 'group') && activeGroup === 'whatsapp' && (
        <WhatsAppTab institutionId={institutionId} role={role} section={null} onSectionChange={openWaSection} />
      )}
      {(route.kind === 'home' || route.kind === 'group') && activeGroup && activeGroup !== 'whatsapp' && (
        <GroupHub group={activeGroup} ctx={ctx} institutionId={institutionId} />
      )}
      {activeTab === 'whatsapp' && (
        <WhatsAppTab institutionId={institutionId} role={role} section={urlSec} onSectionChange={openWaSection} />
      )}

      {activeTab && activeTab !== 'whatsapp' && (
        <div className="aion-pop" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionHeader
            backLabel={backGroup?.title ?? 'Configurações'}
            onBack={() => navigate(backGroup ? `/settings/${backGroup.id}` : '/settings')}
            title={TAB_TITLE[activeTab]?.title ?? 'Configurações'}
            desc={TAB_TITLE[activeTab]?.desc}
          />
          {activeTab === 'geral' && <GeralTab institutionId={institutionId} onToast={showToast} />}
          {activeTab === 'identidade' && <IdentidadeTab institutionId={institutionId} onToast={showToast} />}
          {activeTab === 'pagamentos' && <PagamentosTab institutionId={institutionId} />}
          {activeTab === 'integracoes' && institutionId && <IntegrationsTab institutionId={institutionId} onToast={showToast} />}
          {activeTab === 'transmissoes' && broadcastEnabled && <FinanceTab institutionId={institutionId} />}
          {activeTab === 'escola' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {canSeeSettingsItem('escola.dados', role) && (
              <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${BRAND.line}`, boxShadow: '0 1px 2px rgba(11,27,52,.04)', padding: isMobile ? '20px 16px' : 24, maxWidth: isMobile ? '100%' : 560 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Dados da campanha</h3>
                <p style={{ fontSize: 13, color: BRAND.muted, marginBottom: 20, lineHeight: 1.6 }}>Mensalidade média da escola, alunos atuais, INEP e arquivos do sistema escolar. Usados nas metas e no estudo de mercado.</p>
                <button onClick={() => setShowSchoolSetup(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: GRAD, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 48, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                  <GraduationCap size={15} />Editar dados da campanha
                </button>
              </div>
              )}
              {institutionId && canSeeSettingsItem('escola.series', role) && <GradeLevelsEditor institutionId={institutionId} onToast={showToast} />}
              {institutionId && canSeeSettingsItem('escola.unidade', role) && <LeadUnitFieldEditor institutionId={institutionId} onToast={showToast} />}
              {institutionId && canSeeSettingsItem('escola.lembrete', role) && <LeadReminderSettingsEditor institutionId={institutionId} onToast={showToast} />}
            </div>
          )}
        </div>
      )}

      {showSchoolSetup && institutionId && (
        <SchoolSetupModal institutionId={institutionId} initialStep={1} editMode={true} onComplete={() => setShowSchoolSetup(false)} />
      )}
    </SettingsShell>
  )
}
