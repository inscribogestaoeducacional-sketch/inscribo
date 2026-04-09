// src/components/superadmin/AdminSettings.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  Settings, Save, Eye, EyeOff, CheckCircle2, AlertTriangle,
  DollarSign, FileText, Mail, MessageCircle, Building2,
  Bell, Shield, ChevronDown, ChevronRight, Copy, ExternalLink,
  Zap, AlertCircle, Info, RefreshCw, Plus, Trash2, X
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'
const hint = 'text-xs text-gray-400 mt-1'

function SecretInput({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} className={inp + ' pr-10 font-mono'} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function CopyInput({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className="flex items-center gap-2">
      <input readOnly className={inp + ' font-mono text-xs flex-1 bg-gray-50 text-gray-600'} value={value} />
      <button onClick={copy} className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 flex-shrink-0">
        {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
      </button>
    </div>
  )
}

function Section({ icon: Icon, title, subtitle, color = 'cyan', children, defaultOpen = false }:
  { icon: any; title: string; subtitle: string; color?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const colorMap: Record<string, string> = {
    cyan:   'from-cyan-500 to-blue-600',
    green:  'from-green-500 to-emerald-600',
    purple: 'from-purple-500 to-violet-600',
    amber:  'from-amber-500 to-orange-500',
    rose:   'from-rose-500 to-red-600',
    indigo: 'from-indigo-500 to-blue-700',
    teal:   'from-teal-500 to-cyan-600',
    gray:   'from-gray-500 to-slate-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50 transition-colors">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">{children}</div>}
    </div>
  )
}

// ─── Template editor com variáveis ────────────────────────────────────────
const CONTRACT_VARS = [
  { key: '{{escola}}',          desc: 'Nome da escola' },
  { key: '{{cnpj}}',            desc: 'CNPJ da escola' },
  { key: '{{cidade_uf}}',       desc: 'Cidade/UF' },
  { key: '{{gestor}}',          desc: 'Nome do gestor' },
  { key: '{{email_gestor}}',    desc: 'E-mail do gestor' },
  { key: '{{valor_implantacao}}', desc: 'Taxa de implantação' },
  { key: '{{valor_mensal}}',    desc: 'Mensalidade' },
  { key: '{{dia_vencimento}}',  desc: 'Dia de vencimento' },
  { key: '{{data_inicio}}',     desc: 'Data de início' },
  { key: '{{consultor}}',       desc: 'Consultor responsável' },
  { key: '{{data_hoje}}',       desc: 'Data atual' },
]

const EMAIL_VARS = [
  { key: '{{gestor}}',          desc: 'Nome do gestor' },
  { key: '{{escola}}',          desc: 'Nome da escola' },
  { key: '{{valor_implantacao}}', desc: 'Taxa de implantação' },
  { key: '{{valor_mensal}}',    desc: 'Mensalidade' },
  { key: '{{link_pagamento}}',  desc: 'Link de pagamento' },
  { key: '{{link_acesso}}',     desc: 'Link de acesso' },
  { key: '{{email_acesso}}',    desc: 'E-mail de acesso' },
  { key: '{{consultor}}',       desc: 'Consultor responsável' },
  { key: '{{dias_atraso}}',     desc: 'Dias em atraso' },
  { key: '{{data_suspensao}}',  desc: 'Data de suspensão' },
]

function TemplateEditor({ value, onChange, vars, rows = 10, placeholder }:
  { value: string; onChange: (v: string) => void; vars: typeof CONTRACT_VARS; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const insertVar = (v: string) => {
    const ta = ref.current
    if (!ta) { onChange(value + v); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const newVal = value.substring(0, start) + v + value.substring(end)
    onChange(newVal)
    setTimeout(() => { ta.setSelectionRange(start + v.length, start + v.length); ta.focus() }, 0)
  }
  return (
    <div className="space-y-2">
      {/* Variáveis disponíveis */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">Variáveis disponíveis — clique para inserir</p>
        <div className="flex flex-wrap gap-1.5">
          {vars.map(v => (
            <button key={v.key} onClick={() => insertVar(v.key)} title={v.desc}
              className="text-xs px-2 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-md hover:bg-cyan-100 font-mono transition-colors">
              {v.key}
            </button>
          ))}
        </div>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        className={inp + ' font-mono text-xs resize-y'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <p className={hint}>Escreva em HTML para e-mails. Para o contrato, texto simples ou HTML são aceitos.</p>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
type Settings = Record<string, string>

const DEFAULTS: Settings = {
  // Financeiro
  default_implementation_value: '550',
  default_monthly_value: '550',
  billing_due_day: '10',
  whatsapp_conversation_limit: '1000',
  whatsapp_extra_conversation_price: '0.50',
  // Asaas
  asaas_api_key: '',
  asaas_environment: 'sandbox',
  // ZapSign
  zapsign_api_token: '',
  contract_template_url: '',
  // Resend
  resend_api_key: '',
  resend_from_email: 'noreply@aionedu.com.br',
  resend_from_name: 'Áion Edu',
  // Inadimplência
  overdue_warning1_days: '3',
  overdue_warning2_days: '7',
  overdue_warning3_days: '15',
  overdue_suspend_days: '20',
  // Plataforma
  platform_name: 'Áion Edu',
  platform_cnpj: '65.835.064/0001-58',
  platform_address: 'R. Francisco Vicente de Araújo, 48 · Bela Vista · Patos/PB',
  platform_whatsapp: '5583985556393',
  platform_email: 'contato@aionedu.com.br',
  platform_site: 'https://aionedu.com.br',
  // Templates de e-mail
  email_template_welcome_pending: '',
  email_template_welcome_free: '',
  email_template_payment_confirmed: '',
  email_template_overdue_1: '',
  email_template_overdue_2: '',
  email_template_overdue_3: '',
  email_template_suspended: '',
  email_template_reactivated: '',
  // Template do contrato
  contract_template_text: '',
}

const DEFAULT_EMAIL_WELCOME_PENDING = `<h2>Olá, {{gestor}}! 👋</h2>
<p>Seja muito bem-vindo(a) à <strong>Áion Edu</strong>!</p>
<p>Sua escola <strong>{{escola}}</strong> foi cadastrada em nossa plataforma. Para liberar o acesso completo, siga os passos abaixo:</p>
<ol>
  <li><strong>Assine o contrato</strong> — você receberá o link em breve</li>
  <li><strong>Realize o pagamento da implantação</strong> de {{valor_implantacao}}</li>
</ol>
{{#if link_pagamento}}
<p><a href="{{link_pagamento}}" style="background:#00A896;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Pagar agora</a></p>
{{/if}}
<p>Após a confirmação, você receberá os dados de acesso ao sistema.</p>
<p>Dúvidas? Fale com seu consultor: <strong>{{consultor}}</strong></p>
<p>Equipe Áion Edu</p>`

const DEFAULT_EMAIL_PAYMENT_CONFIRMED = `<h2>Pagamento confirmado! 🎉</h2>
<p>Olá, <strong>{{gestor}}</strong>!</p>
<p>Recebemos o pagamento da implantação da escola <strong>{{escola}}</strong>. Seu acesso está liberado!</p>
<p><strong>Dados de acesso:</strong></p>
<ul>
  <li>E-mail: {{email_acesso}}</li>
  <li>Link: <a href="{{link_acesso}}">{{link_acesso}}</a></li>
</ul>
<p>Seu consultor <strong>{{consultor}}</strong> entrará em contato para agendar o kickoff de implantação.</p>
<p>Equipe Áion Edu</p>`

const DEFAULT_EMAIL_OVERDUE_1 = `<h2>Lembrete de pagamento</h2>
<p>Olá, <strong>{{gestor}}</strong>!</p>
<p>Identificamos que a mensalidade da escola <strong>{{escola}}</strong> está com {{dias_atraso}} dias de atraso.</p>
<p>Para evitar a suspensão do sistema, realize o pagamento o quanto antes.</p>
{{#if link_pagamento}}<p><a href="{{link_pagamento}}">Clique aqui para pagar</a></p>{{/if}}
<p>Equipe Áion Edu</p>`

const DEFAULT_EMAIL_SUSPENDED = `<h2>Sistema suspenso ⚠️</h2>
<p>Olá, <strong>{{gestor}}</strong>!</p>
<p>O acesso da escola <strong>{{escola}}</strong> foi suspenso por falta de pagamento ({{dias_atraso}} dias em atraso).</p>
<p>Para reativar, regularize o pagamento pendente:</p>
{{#if link_pagamento}}<p><a href="{{link_pagamento}}" style="background:#EF4444;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Regularizar agora</a></p>{{/if}}
<p>Equipe Áion Edu</p>`

const DEFAULT_CONTRACT = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

Contratante: {{escola}}
CNPJ: {{cnpj}}
Endereço: {{cidade_uf}}
Representante: {{gestor}}
E-mail: {{email_gestor}}

Contratada: Áion Soluções Tecnológicas LTDA
CNPJ: 65.835.064/0001-58

OBJETO
Licença de uso da plataforma Áion Edu, software de gestão de matrículas.

VALORES
Taxa de implantação (única): {{valor_implantacao}}
Mensalidade: {{valor_mensal}}
Vencimento: Todo dia {{dia_vencimento}}
Início de vigência: {{data_inicio}}

CONSULTOR RESPONSÁVEL
{{consultor}}

[Completar com demais cláusulas conforme orientação jurídica]

Data: {{data_hoje}}

___________________________        ___________________________
Contratante                        Contratada — Áion Edu`

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => { loadSettings() }, [])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const loadSettings = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('platform_settings').select('key, value')
      if (data) {
        const map: Settings = {}
        data.forEach((r: any) => { map[r.key] = r.value })
        setSettings(prev => ({ ...prev, ...map }))
      }
    } catch {
      // table may not exist yet
    }
    setLoading(false)
  }

  const set = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }))

  const saveSection = async (keys: string[], sectionId: string) => {
    setSaving(sectionId)
    try {
      const entries = keys.map(k => ({ key: k, value: settings[k] || '' }))
      const { error } = await supabase.from('platform_settings').upsert(entries, { onConflict: 'key' })
      if (error) throw error
      setSaved(sectionId)
      setTimeout(() => setSaved(null), 2500)
      showToast('Seção salva com sucesso!')
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    } finally {
      setSaving(null)
    }
  }

  function SaveBtn({ keys, id }: { keys: string[]; id: string }) {
    const isSaving = saving === id
    const wasSaved = saved === id
    return (
      <button onClick={() => saveSection(keys, id)} disabled={!!saving}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-60
          ${wasSaved ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'}`}>
        {isSaving
          ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
          : wasSaved
          ? <><CheckCircle2 className="w-3.5 h-3.5" /> Salvo!</>
          : <><Save className="w-3.5 h-3.5" /> Salvar seção</>
        }
      </button>
    )
  }

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || 'https://SEU-PROJETO.supabase.co'}/functions/v1/asaas-webhook`

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="p-8 space-y-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-16 animate-pulse" />
          ))}
        </div>
      </SuperAdminLayout>
    )
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-5 max-w-3xl">

        {toast && (
          <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
            ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
            <p className="text-sm text-gray-500 mt-1">Parâmetros globais da plataforma Áion Edu</p>
          </div>
          <button onClick={loadSettings} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* ── 1. Plataforma ── */}
        <Section icon={Building2} title="Dados da plataforma" subtitle="Nome, CNPJ, endereço e contato da Áion Edu" color="gray" defaultOpen>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Nome da plataforma</label>
              <input className={inp} value={settings.platform_name} onChange={e => set('platform_name', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>CNPJ</label>
              <input className={inp} value={settings.platform_cnpj} onChange={e => set('platform_cnpj', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Endereço completo</label>
            <input className={inp} value={settings.platform_address} onChange={e => set('platform_address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>WhatsApp de suporte</label>
              <input className={inp} placeholder="5583999999999" value={settings.platform_whatsapp} onChange={e => set('platform_whatsapp', e.target.value)} />
              <p className={hint}>Formato: código país + DDD + número</p>
            </div>
            <div>
              <label className={lbl}>E-mail de contato</label>
              <input type="email" className={inp} value={settings.platform_email} onChange={e => set('platform_email', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Site</label>
            <input className={inp} value={settings.platform_site} onChange={e => set('platform_site', e.target.value)} />
          </div>
          <div className="flex justify-end pt-2">
            <SaveBtn keys={['platform_name','platform_cnpj','platform_address','platform_whatsapp','platform_email','platform_site']} id="platform" />
          </div>
        </Section>

        {/* ── 2. Financeiro ── */}
        <Section icon={DollarSign} title="Financeiro" subtitle="Valores padrão, vencimento e limites WhatsApp" color="green">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Valor padrão de implantação (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <input type="number" className={inp + ' pl-9'} value={settings.default_implementation_value} onChange={e => set('default_implementation_value', e.target.value)} />
              </div>
              <p className={hint}>Sugerido ao criar nova escola — pode ser alterado por escola.</p>
            </div>
            <div>
              <label className={lbl}>Mensalidade padrão (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <input type="number" className={inp + ' pl-9'} value={settings.default_monthly_value} onChange={e => set('default_monthly_value', e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <label className={lbl}>Dia padrão de vencimento</label>
            <select className={inp} value={settings.billing_due_day} onChange={e => set('billing_due_day', e.target.value)}>
              {[5,10,15,20,25].map(d => <option key={d} value={String(d)}>Todo dia {d}</option>)}
            </select>
          </div>
          <div className="border-t border-dashed border-gray-200 pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">WhatsApp — limites e cobranças</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Limite de conversas gratuitas/mês</label>
                <input type="number" className={inp} value={settings.whatsapp_conversation_limit} onChange={e => set('whatsapp_conversation_limit', e.target.value)} />
                <p className={hint}>Padrão Meta: 1.000 conversas/mês por número.</p>
              </div>
              <div>
                <label className={lbl}>Valor por conversa extra (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" step="0.01" className={inp + ' pl-9'} value={settings.whatsapp_extra_conversation_price} onChange={e => set('whatsapp_extra_conversation_price', e.target.value)} />
                </div>
                <p className={hint}>Cobrado por conversa acima do limite.</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <SaveBtn keys={['default_implementation_value','default_monthly_value','billing_due_day','whatsapp_conversation_limit','whatsapp_extra_conversation_price']} id="financial" />
          </div>
        </Section>

        {/* ── 3. Inadimplência ── */}
        <Section icon={AlertTriangle} title="Fluxo de inadimplência" subtitle="Dias para avisos automáticos e suspensão" color="rose">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm text-amber-800 mb-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Fluxo automático via webhook Asaas</p>
              <p className="text-xs mt-1">Ao confirmar não-pagamento, o sistema dispara e-mails e suspende automaticamente conforme os dias abaixo.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { k: 'overdue_warning1_days', label: '1º aviso — e-mail lembrete', desc: 'E-mail de aviso amigável' },
              { k: 'overdue_warning2_days', label: '2º aviso — e-mail + notificação', desc: 'Aviso mais urgente + alerta no sistema' },
              { k: 'overdue_warning3_days', label: '3º aviso — aviso de suspensão', desc: 'Informa data de suspensão' },
              { k: 'overdue_suspend_days', label: 'Suspensão automática', desc: 'Sistema bloqueado automaticamente' },
            ].map(item => (
              <div key={item.k} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <label className={lbl}>{item.label}</label>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400">Dia</p>
                  <input type="number" className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-center font-bold"
                    value={settings[item.k]} onChange={e => set(item.k, e.target.value)} />
                  <p className="text-xs text-gray-400">após vencimento</p>
                </div>
                <p className={hint}>{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-xs font-bold text-gray-500 mb-2">Linha do tempo configurada</p>
            <div className="flex items-center gap-0">
              {[
                { day: settings.overdue_warning1_days, label: '1º aviso', color: 'bg-amber-400' },
                { day: settings.overdue_warning2_days, label: '2º aviso', color: 'bg-orange-500' },
                { day: settings.overdue_warning3_days, label: 'Aviso final', color: 'bg-red-500' },
                { day: settings.overdue_suspend_days,  label: 'Suspensão', color: 'bg-red-700' },
              ].map((item, i, arr) => (
                <div key={i} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <p className="text-[9px] font-bold text-gray-600 whitespace-nowrap">D+{item.day}</p>
                    <p className="text-[9px] text-gray-400 whitespace-nowrap">{item.label}</p>
                  </div>
                  {i < arr.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-1 mb-4" />}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <SaveBtn keys={['overdue_warning1_days','overdue_warning2_days','overdue_warning3_days','overdue_suspend_days']} id="overdue" />
          </div>
        </Section>

        {/* ── 4. Asaas ── */}
        <Section icon={DollarSign} title="Asaas — Cobranças automáticas" subtitle="Chave API e configurações de gateway" color="amber">
          <div>
            <label className={lbl}>Ambiente</label>
            <div className="flex gap-3">
              {[
                { v: 'sandbox', l: 'Sandbox (testes)', desc: 'api-sandbox.asaas.com' },
                { v: 'production', l: 'Produção', desc: 'api.asaas.com' },
              ].map(opt => (
                <button key={opt.v} onClick={() => set('asaas_environment', opt.v)}
                  className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${settings.asaas_environment === opt.v ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className={`text-sm font-bold ${settings.asaas_environment === opt.v ? 'text-amber-700' : 'text-gray-700'}`}>{opt.l}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>Chave API Asaas</label>
            <SecretInput value={settings.asaas_api_key} onChange={v => set('asaas_api_key', v)} placeholder="$aact_..." id="asaas_key" />
            <p className={hint}>Obtida em <span className="font-medium">asaas.com → Integrações → Chaves API</span></p>
          </div>
          <div>
            <label className={lbl}>URL do Webhook (configure no Asaas)</label>
            <CopyInput value={webhookUrl} />
            <p className={hint}>Cole esta URL em <span className="font-medium">Asaas → Integrações → Webhook</span> para receber atualizações de pagamento.</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Eventos de webhook necessários no Asaas:</p>
            <p>• <code className="bg-amber-100 px-1 rounded">PAYMENT_CONFIRMED</code> — ativa a escola e envia e-mail de boas-vindas</p>
            <p>• <code className="bg-amber-100 px-1 rounded">PAYMENT_OVERDUE</code> — inicia fluxo de inadimplência</p>
            <p>• <code className="bg-amber-100 px-1 rounded">PAYMENT_RECEIVED</code> — reativa escola e envia e-mail de confirmação</p>
          </div>
          <div className="flex justify-end pt-2">
            <SaveBtn keys={['asaas_api_key','asaas_environment']} id="asaas" />
          </div>
        </Section>

        {/* ── 5. ZapSign ── */}
        <Section icon={FileText} title="ZapSign — Assinatura digital" subtitle="Token de API e template de contrato" color="indigo">
          <div>
            <label className={lbl}>Token de API ZapSign</label>
            <SecretInput value={settings.zapsign_api_token} onChange={v => set('zapsign_api_token', v)} placeholder="Bearer token da API ZapSign" />
            <p className={hint}>Obtido em <span className="font-medium">app.zapsign.com.br → Conta → API → Token</span></p>
          </div>
          <div>
            <label className={lbl}>URL do template PDF base (opcional)</label>
            <input className={inp} type="url" value={settings.contract_template_url} onChange={e => set('contract_template_url', e.target.value)} placeholder="https://..." />
            <p className={hint}>URL pública de um PDF que será usado como base para o contrato. Deixe em branco para usar o template de texto abaixo.</p>
          </div>
          <div className="flex justify-end pt-2">
            <SaveBtn keys={['zapsign_api_token','contract_template_url']} id="zapsign" />
          </div>
        </Section>

        {/* ── 6. Template do contrato ── */}
        <Section icon={FileText} title="Template do contrato" subtitle="Texto base com variáveis dinâmicas — edite com seu jurídico" color="purple">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Como usar</p>
              <p className="text-xs mt-1">Edite o template abaixo com seu texto jurídico. Use as variáveis para inserir dados dinâmicos de cada escola. O sistema substituirá automaticamente ao gerar cada contrato.</p>
            </div>
          </div>
          <TemplateEditor
            value={settings.contract_template_text || DEFAULT_CONTRACT}
            onChange={v => set('contract_template_text', v)}
            vars={CONTRACT_VARS}
            rows={18}
            placeholder="Cole aqui o texto do contrato com as variáveis..."
          />
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => set('contract_template_text', DEFAULT_CONTRACT)}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium">
              Restaurar template padrão
            </button>
            <SaveBtn keys={['contract_template_text']} id="contract_template" />
          </div>
        </Section>

        {/* ── 7. Resend ── */}
        <Section icon={Mail} title="Resend — E-mails automáticos" subtitle="Chave API e configurações de envio" color="teal">
          <div>
            <label className={lbl}>Chave API Resend</label>
            <SecretInput value={settings.resend_api_key} onChange={v => set('resend_api_key', v)} placeholder="re_..." />
            <p className={hint}>Obtida em <span className="font-medium">resend.com → API Keys</span></p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>E-mail remetente</label>
              <input type="email" className={inp} value={settings.resend_from_email} onChange={e => set('resend_from_email', e.target.value)} placeholder="noreply@aionedu.com.br" />
            </div>
            <div>
              <label className={lbl}>Nome remetente</label>
              <input className={inp} value={settings.resend_from_name} onChange={e => set('resend_from_name', e.target.value)} placeholder="Áion Edu" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <SaveBtn keys={['resend_api_key','resend_from_email','resend_from_name']} id="resend" />
          </div>
        </Section>

        {/* ── 8. Templates de e-mail ── */}
        <Section icon={Mail} title="Templates de e-mail" subtitle="Personalize cada e-mail automático enviado pelo sistema" color="cyan">
          {[
            {
              id: 'email_template_welcome_pending',
              label: '🎉 Boas-vindas — aguardando pagamento',
              desc: 'Enviado ao gestor quando a escola é criada (plano pago)',
              default: DEFAULT_EMAIL_WELCOME_PENDING,
            },
            {
              id: 'email_template_welcome_free',
              label: '🎁 Boas-vindas — acesso gratuito',
              desc: 'Enviado ao gestor de escola gratuita com dados de acesso',
              default: `<h2>Bem-vindo(a) à Áion Edu! 🎉</h2>
<p>Olá, <strong>{{gestor}}</strong>!</p>
<p>Sua escola <strong>{{escola}}</strong> tem acesso gratuito à plataforma Áion Edu.</p>
<p><strong>Dados de acesso:</strong></p>
<ul><li>E-mail: {{email_acesso}}</li><li>Link: <a href="{{link_acesso}}">{{link_acesso}}</a></li></ul>
<p>Equipe Áion Edu</p>`,
            },
            {
              id: 'email_template_payment_confirmed',
              label: '✅ Pagamento confirmado — acesso liberado',
              desc: 'Enviado após confirmação do pagamento da implantação',
              default: DEFAULT_EMAIL_PAYMENT_CONFIRMED,
            },
            {
              id: 'email_template_overdue_1',
              label: '⚠️ Inadimplência — 1º aviso',
              desc: `Enviado em D+${settings.overdue_warning1_days} após vencimento`,
              default: DEFAULT_EMAIL_OVERDUE_1,
            },
            {
              id: 'email_template_overdue_2',
              label: '🔴 Inadimplência — 2º aviso',
              desc: `Enviado em D+${settings.overdue_warning2_days} após vencimento`,
              default: DEFAULT_EMAIL_OVERDUE_1.replace('lembrete', '2º aviso urgente'),
            },
            {
              id: 'email_template_overdue_3',
              label: '🚨 Inadimplência — aviso de suspensão',
              desc: `Enviado em D+${settings.overdue_warning3_days} — avisa a data de suspensão`,
              default: `<h2>Aviso de suspensão 🚨</h2>
<p>Olá, <strong>{{gestor}}</strong>!</p>
<p>Sua conta será suspensa em <strong>{{data_suspensao}}</strong> por falta de pagamento.</p>
<p>Regularize agora para evitar a suspensão:</p>
{{#if link_pagamento}}<p><a href="{{link_pagamento}}">Pagar agora</a></p>{{/if}}
<p>Equipe Áion Edu</p>`,
            },
            {
              id: 'email_template_suspended',
              label: '🔒 Sistema suspenso',
              desc: 'Enviado quando o sistema é suspenso por inadimplência',
              default: DEFAULT_EMAIL_SUSPENDED,
            },
            {
              id: 'email_template_reactivated',
              label: '✅ Sistema reativado',
              desc: 'Enviado quando o pagamento é regularizado e o acesso restaurado',
              default: `<h2>Sistema reativado! ✅</h2>
<p>Olá, <strong>{{gestor}}</strong>!</p>
<p>Seu pagamento foi confirmado e o acesso da escola <strong>{{escola}}</strong> foi reativado.</p>
<p>Acesse agora: <a href="{{link_acesso}}">{{link_acesso}}</a></p>
<p>Equipe Áion Edu</p>`,
            },
          ].map(tpl => (
            <div key={tpl.id} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800">{tpl.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{tpl.desc}</p>
              </div>
              <div className="p-4">
                <TemplateEditor
                  value={settings[tpl.id] || tpl.default}
                  onChange={v => set(tpl.id, v)}
                  vars={EMAIL_VARS}
                  rows={8}
                />
                <div className="flex items-center justify-between mt-3">
                  <button onClick={() => set(tpl.id, tpl.default)} className="text-xs text-gray-400 hover:text-gray-600 font-medium">
                    Restaurar padrão
                  </button>
                  <SaveBtn keys={[tpl.id]} id={tpl.id} />
                </div>
              </div>
            </div>
          ))}
        </Section>

      </div>
    </SuperAdminLayout>
  )
}