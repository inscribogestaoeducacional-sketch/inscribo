// src/components/superadmin/AdminSchools.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  Building2, Search, Megaphone, Edit2, AlertTriangle,
  CheckCircle2, X, Plus, RefreshCw, Eye, EyeOff,
  MapPin, Mail, User, Shield, ChevronRight, ChevronLeft,
  DollarSign, FileText, Gift, Lock, Unlock, Trash2,
  Clock, Send, Copy, ExternalLink, Filter, Phone,
  AlertCircle, Info, MessageCircle, Wifi, WifiOff
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────
function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

type ToastT = { msg: string; ok: boolean }
function ToastBar({ toast, onClose }: { toast: ToastT; onClose: () => void }) {
  return (
    <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
      ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.msg}
      <button onClick={onClose}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  )
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

const PLANS = [
  { value: 'escola', label: 'Escola Padrão' },
  { value: 'rede', label: 'Rede de Escolas' },
  { value: 'gratuito', label: 'Gratuito / Parceria' },
]

const PLAN_STATUS = [
  { value: 'active', label: 'Ativo' },
  { value: 'pending_contract', label: 'Aguardando contrato' },
  { value: 'pending_payment', label: 'Aguardando pagamento' },
  { value: 'suspended', label: 'Suspenso' },
  { value: 'cancelled', label: 'Cancelado' },
]

const months = [
  { v: 1, l: 'Jan' }, { v: 2, l: 'Fev' }, { v: 3, l: 'Mar' },
  { v: 4, l: 'Abr' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Jun' },
  { v: 7, l: 'Jul' }, { v: 8, l: 'Ago' }, { v: 9, l: 'Set' },
  { v: 10, l: 'Out' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dez' },
]

// ─── Wizard steps ─────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Dados da escola',   icon: Building2 },
  { n: 2, label: 'Acesso do gestor',  icon: Shield },
  { n: 3, label: 'Financeiro',        icon: DollarSign },
  { n: 4, label: 'Revisão',           icon: CheckCircle2 },
]

type NewForm = {
  // step 1
  name: string; cnpj: string; city: string; state: string; phone: string; plan: string; consultantId: string
  // step 2
  email: string; password: string; managerName: string
  // step 3
  isFree: boolean
  implementationValue: string
  monthlyValue: string
  billingDueDay: string
  sendContractNow: boolean
  signerName: string; signerEmail: string; signerPhone: string
}

const defaultForm: NewForm = {
  name: '', cnpj: '', city: '', state: '', phone: '', plan: 'escola', consultantId: '',
  email: '', password: '', managerName: '',
  isFree: false,
  implementationValue: '550',
  monthlyValue: '550',
  billingDueDay: '10',
  sendContractNow: false,
  signerName: '', signerEmail: '', signerPhone: '',
}

// ─── WIZARD COMPONENT ─────────────────────────────────────────────────────
function NewSchoolWizard({
  consultants,
  onClose,
  onSuccess,
}: {
  consultants: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<NewForm>(defaultForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ institutionId: string; paymentLink?: string } | null>(null)

  const set = (k: keyof NewForm, v: any) => setForm(f => ({ ...f, [k]: v }))
  const err = (k: string) => errors[k] ? <p className="text-xs text-red-500 mt-1">{errors[k]}</p> : null

  function validateStep(s: number) {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!form.name.trim()) e.name = 'Nome obrigatório'
      if (!form.city.trim()) e.city = 'Cidade obrigatória'
      if (!form.state.trim()) e.state = 'UF obrigatório'
    }
    if (s === 2) {
      if (!form.managerName.trim()) e.managerName = 'Nome obrigatório'
      if (!form.email.trim() || !form.email.includes('@')) e.email = 'E-mail inválido'
      if (!form.password || form.password.length < 8) e.password = 'Mínimo 8 caracteres'
    }
    if (s === 3 && !form.isFree) {
      if (!form.implementationValue || isNaN(Number(form.implementationValue))) e.implementationValue = 'Valor inválido'
      if (!form.monthlyValue || isNaN(Number(form.monthlyValue))) e.monthlyValue = 'Valor inválido'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() { if (validateStep(step)) setStep(s => s + 1) }
  function back() { setStep(s => s - 1) }

  async function handleCreate() {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada.')

      // 1. Criar instituição
      const { data: institution, error: instErr } = await supabase
        .from('institutions')
        .insert({
          name: form.name.trim(),
          cnpj: form.cnpj.trim() || null,
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          phone: form.phone.trim() || null,
          email: form.email.trim().toLowerCase(),
          consultant_id: form.consultantId || null,
          plan: form.plan,
          plan_status: form.isFree ? 'active' : 'pending_contract',
          monthly_value: form.isFree ? 0 : Number(form.monthlyValue),
          implementation_value: form.isFree ? 0 : Number(form.implementationValue),
        })
        .select().single()

      if (instErr) throw new Error(instErr.message)

      // 2. Criar usuário gestor
      const fnRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: form.email.trim().toLowerCase(),
            password: form.password,
            full_name: form.managerName.trim(),
            role: 'admin',
            user_type: 'school_user',
            institution_id: institution.id,
          }),
        }
      )
      const fnData = await fnRes.json()
      if (!fnRes.ok || fnData?.error) {
        await supabase.from('institutions').delete().eq('id', institution.id)
        throw new Error(fnData?.error || 'Erro ao criar usuário')
      }

      let paymentLink: string | undefined

      if (!form.isFree) {
        // 3. Criar registro de cobrança de implantação (pendente)
        await supabase.from('payments').insert({
          institution_id: institution.id,
          amount: Number(form.implementationValue),
          status: 'pending',
          payment_type: 'implementation',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          description: `Implantação — ${form.name.trim()}`,
        })

        // 4. Tentar criar cobrança no Asaas via Edge Function (se configurado)
        try {
          const { data: asaasData } = await supabase.functions.invoke('asaas-create-charge', {
            body: {
              institution_id: institution.id,
              name: form.name.trim(),
              email: form.email.trim().toLowerCase(),
              cpfCnpj: form.cnpj.replace(/\D/g, '') || null,
              value: Number(form.implementationValue),
              description: `Taxa de implantação — ${form.name.trim()}`,
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            },
          })
          if (asaasData?.paymentLink) paymentLink = asaasData.paymentLink
        } catch {
          // Asaas não configurado ainda — ignora silenciosamente
        }

        // 5. Enviar e-mail de boas-vindas com link de pagamento
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'payment_link',
              to: form.email.trim().toLowerCase(),
              data: {
                institution_name: form.name.trim(),
                value: Number(form.implementationValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                due_date: new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR'),
                billing_type: 'PIX/Boleto',
                payment_link: paymentLink || '',
              },
            },
          })
        } catch {
          // E-mail falhou — registra mas não bloqueia
        }
      } else {
        // Escola gratuita — envia e-mail de acesso direto
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'new_institution',
              to: form.email.trim().toLowerCase(),
              data: {
                institution_name: form.name.trim(),
                login_url: `${window.location.origin}/login`,
              },
            },
          })
        } catch {}
      }

      // 6. Criar contrato se Autentique configurado
      if (form.sendContractNow && form.signerEmail && form.signerName) {
        try {
          await supabase.functions.invoke('autentique', {
            body: {
              institution_id: institution.id,
              school_name: form.name.trim(),
              signer_name: form.signerName,
              signer_email: form.signerEmail,
              signer_phone: form.signerPhone,
              monthly_value: Number(form.monthlyValue),
              implementation_value: Number(form.implementationValue),
            },
          })
        } catch {}
      }

      setResult({ institutionId: institution.id, paymentLink })
      setStep(5) // success step
    } catch (e: any) {
      setErrors({ _global: e?.message || 'Erro ao criar escola.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[96vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Nova instituição</h2>
            <p className="text-xs text-gray-400 mt-0.5">Preencha os dados para cadastrar e iniciar o fluxo</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl ml-4 flex-shrink-0">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Steps indicator */}
        {step <= 4 && (
          <div className="px-6 py-4 border-b border-gray-50">
            <div className="flex items-center gap-0">
              {STEPS.map((s, i) => {
                const done = step > s.n
                const active = step === s.n
                const Icon = s.icon
                return (
                  <div key={s.n} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                        ${done ? 'bg-green-500 text-white' : active ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className={`text-[10px] font-semibold whitespace-nowrap ${active ? 'text-cyan-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${done ? 'bg-green-400' : 'bg-gray-100'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Global error */}
          {errors._global && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {errors._global}
            </div>
          )}

          {/* ── Step 1: Dados da escola ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={lbl}>Nome da instituição *</label>
                <input className={`${inp} ${errors.name ? 'border-red-400' : ''}`} placeholder="Ex: Colégio São Francisco" value={form.name} onChange={e => set('name', e.target.value)} />
                {err('name')}
              </div>

              <div>
                <label className={lbl}>CNPJ</label>
                <input className={inp} placeholder="00.000.000/0001-00" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={lbl}>Cidade *</label>
                  <input className={`${inp} ${errors.city ? 'border-red-400' : ''}`} placeholder="João Pessoa" value={form.city} onChange={e => set('city', e.target.value)} />
                  {err('city')}
                </div>
                <div>
                  <label className={lbl}>UF *</label>
                  <input className={`${inp} ${errors.state ? 'border-red-400' : ''}`} placeholder="PB" maxLength={2} value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} />
                  {err('state')}
                </div>
              </div>

              <div>
                <label className={lbl}>Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className={inp + ' pl-9'} placeholder="(83) 99999-9999" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Plano</label>
                  <select className={inp} value={form.plan} onChange={e => set('plan', e.target.value)}>
                    {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Consultor responsável</label>
                  <select className={inp} value={form.consultantId} onChange={e => set('consultantId', e.target.value)}>
                    <option value="">Sem consultor</option>
                    {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Acesso do gestor ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2 text-sm text-blue-700">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                O acesso será liberado ao gestor <strong>somente após a assinatura do contrato e confirmação do pagamento da implantação</strong>.
              </div>

              <div>
                <label className={lbl}>Nome do gestor *</label>
                <input className={`${inp} ${errors.managerName ? 'border-red-400' : ''}`} placeholder="Nome completo" value={form.managerName} onChange={e => set('managerName', e.target.value)} />
                {err('managerName')}
              </div>

              <div>
                <label className={lbl}>E-mail de acesso *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" className={`${inp} pl-9 ${errors.email ? 'border-red-400' : ''}`} placeholder="gestor@escola.com.br" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
                {err('email')}
              </div>

              <div>
                <label className={lbl}>Senha inicial *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className={`${inp} pr-10 ${errors.password ? 'border-red-400' : ''}`} placeholder="Mínimo 8 caracteres" value={form.password} onChange={e => set('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {err('password')}
                <p className="text-xs text-gray-400 mt-1">O gestor poderá alterar após o primeiro acesso.</p>
              </div>
            </div>
          )}

          {/* ── Step 3: Financeiro ── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Toggle gratuito */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <Gift className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Acesso gratuito / parceria</p>
                    <p className="text-xs text-gray-400">Escola não paga implantação nem mensalidade</p>
                  </div>
                </div>
                <button
                  onClick={() => set('isFree', !form.isFree)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.isFree ? 'bg-purple-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isFree ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {!form.isFree && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Taxa de implantação (R$) *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">R$</span>
                        <input type="number" className={`${inp} pl-9 ${errors.implementationValue ? 'border-red-400' : ''}`} placeholder="550" value={form.implementationValue} onChange={e => set('implementationValue', e.target.value)} />
                      </div>
                      {err('implementationValue')}
                      <p className="text-xs text-gray-400 mt-1">Cobrado uma única vez na implantação.</p>
                    </div>
                    <div>
                      <label className={lbl}>Mensalidade (R$) *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">R$</span>
                        <input type="number" className={`${inp} pl-9 ${errors.monthlyValue ? 'border-red-400' : ''}`} placeholder="550" value={form.monthlyValue} onChange={e => set('monthlyValue', e.target.value)} />
                      </div>
                      {err('monthlyValue')}
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Dia de vencimento da mensalidade</label>
                    <select className={inp} value={form.billingDueDay} onChange={e => set('billingDueDay', e.target.value)}>
                      {[5, 10, 15, 20, 25].map(d => <option key={d} value={String(d)}>Todo dia {d}</option>)}
                    </select>
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Enviar contrato via Autentique agora?</p>
                        <p className="text-xs text-gray-400">Opcional — pode ser feito depois em Contratos</p>
                      </div>
                      <button
                        onClick={() => set('sendContractNow', !form.sendContractNow)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${form.sendContractNow ? 'bg-cyan-500' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.sendContractNow ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    {form.sendContractNow && (
                      <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div>
                          <label className={lbl}>Nome do signatário</label>
                          <input className={inp} placeholder="Diretor / Responsável" value={form.signerName} onChange={e => set('signerName', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={lbl}>E-mail do signatário</label>
                            <input type="email" className={inp} value={form.signerEmail} onChange={e => set('signerEmail', e.target.value)} />
                          </div>
                          <div>
                            <label className={lbl}>WhatsApp</label>
                            <input className={inp} placeholder="5583999999999" value={form.signerPhone} onChange={e => set('signerPhone', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {form.isFree && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-700">
                  <p className="font-semibold mb-1">Acesso gratuito selecionado</p>
                  <p className="text-xs">O gestor receberá o e-mail de boas-vindas com os dados de acesso assim que a escola for criada. Nenhuma cobrança será gerada.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Revisão ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Escola
                  </p>
                  {[
                    ['Nome', form.name],
                    ['CNPJ', form.cnpj || '—'],
                    ['Cidade/UF', form.city && form.state ? `${form.city}/${form.state}` : '—'],
                    ['Plano', PLANS.find(p => p.value === form.plan)?.label || form.plan],
                    ['Consultor', consultants.find(c => c.id === form.consultantId)?.full_name || 'Sem consultor'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 text-sm">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-semibold text-gray-900 text-right max-w-[60%] truncate">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Gestor
                  </p>
                  {[
                    ['Nome', form.managerName],
                    ['E-mail', form.email],
                    ['Senha', '••••••••'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 text-sm">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-semibold text-gray-900 text-right max-w-[60%] truncate">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> Financeiro
                </p>
                {form.isFree ? (
                  <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm">
                    <Gift className="w-4 h-4" /> Acesso gratuito — sem cobrança
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Implantação</p>
                      <p className="font-bold text-gray-900">R$ {Number(form.implementationValue).toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Mensalidade</p>
                      <p className="font-bold text-gray-900">R$ {Number(form.monthlyValue).toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Vencimento</p>
                      <p className="font-bold text-gray-900">Dia {form.billingDueDay}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* O que vai acontecer */}
              <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4">
                <p className="text-xs font-bold text-cyan-700 uppercase tracking-wide mb-2">O que será feito ao confirmar</p>
                <div className="space-y-1.5">
                  {[
                    '✅ Criar a instituição no sistema',
                    '✅ Criar o usuário gestor',
                    form.isFree ? '✅ Enviar e-mail de acesso imediato' : '✅ Criar cobrança de implantação',
                    !form.isFree ? '✅ Enviar e-mail com link de pagamento' : null,
                    form.sendContractNow && !form.isFree ? '✅ Enviar contrato via Autentique' : null,
                  ].filter(Boolean).map((item, i) => (
                    <p key={i} className="text-xs text-cyan-700">{item}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Sucesso ── */}
          {step === 5 && result && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Escola criada com sucesso!</h3>
              <p className="text-sm text-gray-500 mb-6">
                {form.isFree
                  ? 'O gestor recebeu o e-mail com os dados de acesso.'
                  : 'O gestor recebeu o e-mail com o link de pagamento da implantação. O acesso será liberado após a confirmação do pagamento.'}
              </p>

              {result.paymentLink && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-left">
                  <p className="text-xs font-bold text-gray-500 mb-2">Link de pagamento Asaas</p>
                  <div className="flex items-center gap-2">
                    <input readOnly className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate" value={result.paymentLink} />
                    <button
                      onClick={() => navigator.clipboard.writeText(result.paymentLink!)}
                      className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                    <a href={result.paymentLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100">
                      <ExternalLink className="w-4 h-4 text-cyan-600" />
                    </a>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setStep(1); setForm(defaultForm); setResult(null) }} className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50">
                  Criar outra escola
                </button>
                <button onClick={() => { onSuccess(); onClose() }} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step <= 4 && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            {step > 1 && (
              <button onClick={back} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
            )}
            {step < 4 && (
              <button onClick={next} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 4 && (
              <button onClick={handleCreate} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando...</>
                  : <><CheckCircle2 className="w-4 h-4" /> Confirmar e criar escola</>
                }
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── School Detail Modal (com aba WhatsApp) ────────────────────────────────
function SchoolDetailModal({ inst, consultants, getCycleBadge, onClose, onEdit }: {
  inst: any
  consultants: any[]
  getCycleBadge: (id: string) => { label: string; color: string; bg: string }
  onClose: () => void
  onEdit: () => void
}) {
  const [tab, setTab]         = useState<'info' | 'whatsapp'>('info')
  const [waConfig, setWaConfig] = useState<any>(null)
  const [waLoading, setWaLoading] = useState(false)
  const [waForm, setWaForm]   = useState({ phone_id: '', token: '', phone_number: '', display_name: '' })
  const [waVerifying, setWaVerifying] = useState(false)
  const [waError, setWaError] = useState('')
  const [waSaved, setWaSaved] = useState(false)
  const [usage, setUsage]     = useState({ count: 0, limit: 1000 })

  useEffect(() => { if (tab === 'whatsapp') loadWaConfig() }, [tab])

  const loadWaConfig = async () => {
    setWaLoading(true)
    try {
      const { data } = await supabase.from('institutions')
        .select('whatsapp_phone_id,whatsapp_token,whatsapp_phone_number,whatsapp_display_name,whatsapp_connected')
        .eq('id', inst.id).single()
      if (data) {
        setWaConfig(data)
        if (data.whatsapp_phone_id) {
          setWaForm({ phone_id: data.whatsapp_phone_id, token: data.whatsapp_token || '', phone_number: data.whatsapp_phone_number || '', display_name: data.whatsapp_display_name || '' })
          const monthYear = new Date().toISOString().slice(0, 7)
          const { data: u } = await supabase.from('whatsapp_usage').select('conversation_count,monthly_limit').eq('institution_id', inst.id).eq('month_year', monthYear).single()
          if (u) setUsage({ count: (u as any).conversation_count || 0, limit: (u as any).monthly_limit || 1000 })
        }
      }
    } catch {}
    setWaLoading(false)
  }

  const handleSaveWa = async () => {
    if (!waForm.phone_id || !waForm.token) { setWaError('Phone ID e Token são obrigatórios.'); return }
    setWaVerifying(true); setWaError(''); setWaSaved(false)
    try {
      const testRes = await fetch(`https://graph.facebook.com/v19.0/${waForm.phone_id}?fields=display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${waForm.token}` },
      })
      if (!testRes.ok) { const err = await testRes.json(); throw new Error((err as any)?.error?.message || 'Token ou Phone ID inválido') }
      const testData = await testRes.json()
      const verifiedName  = (testData as any).verified_name || waForm.display_name
      const verifiedPhone = waForm.phone_number || (testData as any).display_phone_number || ''
      await supabase.from('institutions').update({
        whatsapp_phone_id:     waForm.phone_id,
        whatsapp_token:        waForm.token,
        whatsapp_phone_number: verifiedPhone,
        whatsapp_display_name: verifiedName,
        whatsapp_connected:    true,
      }).eq('id', inst.id)
      try {
        await supabase.from('whatsapp_phone_numbers').upsert({
          institution_id:  inst.id,
          phone_number_id: waForm.phone_id,
          phone_number:    verifiedPhone,
          display_name:    verifiedName,
          waba_id:         '1222972209822315',
          is_active:       true,
        }, { onConflict: 'phone_number_id' })
      } catch {}
      setWaSaved(true)
      await loadWaConfig()
    } catch (e) {
      setWaError((e as Error).message)
    } finally {
      setWaVerifying(false)
    }
  }

  const getConsultantName = (id: string) => consultants.find(c => c.id === id)?.full_name || '—'
  const usagePct  = Math.min(100, Math.round((usage.count / usage.limit) * 100))
  const usageColor = usagePct >= 90 ? '#EF4444' : usagePct >= 70 ? '#F59E0B' : '#10B981'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{inst.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{inst.city && inst.state ? `${inst.city}/${inst.state}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-gray-100">
          {[{ id: 'info', label: 'Detalhes' }, { id: 'whatsapp', label: 'WhatsApp' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px
                ${tab === t.id ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Aba Detalhes ── */}
          {tab === 'info' && (
            <div className="space-y-2.5 text-sm">
              {[
                ['Nome',       inst.name],
                ['CNPJ',       inst.cnpj || '—'],
                ['Cidade/UF',  inst.city && inst.state ? `${inst.city}/${inst.state}` : '—'],
                ['E-mail',     inst.email || '—'],
                ['Telefone',   inst.phone || '—'],
                ['Plano',      PLANS.find(p => p.value === inst.plan)?.label || inst.plan || '—'],
                ['Status',     PLAN_STATUS.find(s => s.value === inst.plan_status)?.label || inst.plan_status || '—'],
                ['Mensalidade', inst.monthly_value ? `R$ ${Number(inst.monthly_value).toLocaleString('pt-BR')}` : '—'],
                ['Implantação', inst.implementation_value ? `R$ ${Number(inst.implementation_value).toLocaleString('pt-BR')}` : '—'],
                ['Consultor',  getConsultantName(inst.consultant_id)],
                ['Campanha',   getCycleBadge(inst.id).label],
                ['Criado em',  new Date(inst.created_at).toLocaleDateString('pt-BR')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 py-1.5 border-b border-gray-50">
                  <span className="text-gray-400 font-medium">{k}</span>
                  <span className="text-gray-900 font-semibold text-right">{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Aba WhatsApp ── */}
          {tab === 'whatsapp' && (
            <div className="space-y-4">
              {waLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Status */}
                  <div className={`flex items-center gap-3 p-3 rounded-xl border ${waConfig?.whatsapp_connected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    {waConfig?.whatsapp_connected
                      ? <><Wifi className="w-4 h-4 text-green-600 flex-shrink-0" /><div><p className="text-sm font-bold text-green-700">Conectado</p>{waConfig.whatsapp_phone_number && <p className="text-xs text-green-600">{waConfig.whatsapp_phone_number}</p>}{waConfig.whatsapp_display_name && <p className="text-xs text-green-500">{waConfig.whatsapp_display_name}</p>}</div></>
                      : <><WifiOff className="w-4 h-4 text-gray-400 flex-shrink-0" /><p className="text-sm font-semibold text-gray-500">Não conectado</p></>
                    }
                    {waConfig?.whatsapp_connected && (
                      <div className="ml-auto text-right">
                        <p className="text-xs text-gray-400">Conversas/mês</p>
                        <p className="text-sm font-bold" style={{ color: usageColor }}>{usage.count}/{usage.limit.toLocaleString('pt-BR')}</p>
                      </div>
                    )}
                  </div>

                  {waConfig?.whatsapp_connected && (
                    <div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                        <div className="h-full rounded-full" style={{ width: `${usagePct}%`, background: usageColor }} />
                      </div>
                      <p className="text-xs text-gray-400">Custo estimado: {usage.count > 1000 ? `R$ ${((usage.count - 1000) * 0.005).toFixed(2).replace('.', ',')}` : 'R$ 0,00'}</p>
                    </div>
                  )}

                  {/* Formulário de configuração */}
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Configurar número</p>
                    {[
                      { label: 'Phone Number ID', key: 'phone_id',     type: 'text',     placeholder: '1007880222413531' },
                      { label: 'Token de acesso', key: 'token',        type: 'password', placeholder: 'EAAOSNzt...' },
                      { label: 'Número de telefone', key: 'phone_number', type: 'text', placeholder: '+55 83 99999-9999' },
                      { label: 'Nome de exibição', key: 'display_name', type: 'text',   placeholder: 'Colégio São João' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className={lbl}>{f.label}</label>
                        <input type={f.type} className={inp} placeholder={f.placeholder}
                          value={(waForm as any)[f.key]}
                          onChange={e => setWaForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                      </div>
                    ))}

                    {waError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{waError}
                      </div>
                    )}
                    {waSaved && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />WhatsApp configurado e verificado!
                      </div>
                    )}

                    <button onClick={handleSaveWa} disabled={waVerifying || !waForm.phone_id || !waForm.token}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                      {waVerifying
                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Verificando...</>
                        : <><CheckCircle2 className="w-4 h-4" />Salvar e verificar</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onEdit} className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50">Editar</button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-semibold text-sm">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function AdminSchools() {
  const [institutions, setInstitutions] = useState<any[]>([])
  const [consultants, setConsultants] = useState<any[]>([])
  const [cycles, setCycles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlan, setFilterPlan] = useState('all')
  const [toast, setToast] = useState<ToastT | null>(null)

  const [showWizard, setShowWizard] = useState(false)
  const [editModal, setEditModal] = useState<any | null>(null)
  const [releaseModal, setReleaseModal] = useState<any | null>(null)
  const [detailModal, setDetailModal] = useState<any | null>(null)

  const [startMonth, setStartMonth] = useState(8)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [releasing, setReleasing] = useState(false)

  const [editForm, setEditForm] = useState({
    name: '', cnpj: '', city: '', state: '', phone: '',
    plan: '', plan_status: '', consultant_id: '',
    monthly_value: '', implementation_value: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { loadData() }, [])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4500)
  }

  const loadData = async () => {
    setLoading(true)
    const [instRes, consultRes, cycleRes] = await Promise.all([
      supabase.from('institutions').select('*').order('name'),
      supabase.from('users').select('id, full_name, email').eq('user_type', 'consultant'),
      supabase.from('campaign_cycles')
        .select('institution_id, status, year, id, start_date, end_date, campaign_start_month, label')
        .order('created_at', { ascending: false }),
    ])
    setInstitutions(instRes.data || [])
    setConsultants(consultRes.data || [])
    setCycles(cycleRes.data || [])
    setLoading(false)
  }

  const getConsultantName = (id: string) => consultants.find(c => c.id === id)?.full_name || '—'

  const getCycleBadge = (institutionId: string) => {
    const cycle = cycles.find(c => c.institution_id === institutionId)
    if (!cycle) return { label: 'Sem campanha', color: '#9ca3af', bg: '#f3f4f6' }
    const map: Record<string, { label: string; color: string; bg: string }> = {
      active:    { label: 'Ativa',         color: '#16a34a', bg: '#f0fdf4' },
      released:  { label: 'Liberada',      color: '#0891b2', bg: '#ecfeff' },
      setup:     { label: 'Em setup',      color: '#d97706', bg: '#fffbeb' },
      draft:     { label: 'Rascunho',      color: '#d97706', bg: '#fffbeb' },
      completed: { label: 'Concluída',     color: '#7c3aed', bg: '#f5f3ff' },
    }
    return map[cycle.status] || { label: 'Pré-campanha', color: '#d97706', bg: '#fffbeb' }
  }

  const getPlanBadge = (inst: any) => {
    if (inst.plan === 'gratuito') return { label: 'Gratuito', color: '#7c3aed', bg: '#f5f3ff' }
    if (inst.plan === 'trial')    return { label: 'Trial',    color: '#d97706', bg: '#fffbeb' }
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      active:           { label: 'Ativo',                  color: '#16a34a', bg: '#f0fdf4' },
      pending_contract: { label: 'Aguardando contrato',    color: '#6366f1', bg: '#eef2ff' },
      pending_payment:  { label: 'Aguardando pagamento',   color: '#f59e0b', bg: '#fffbeb' },
      suspended:        { label: 'Suspenso',               color: '#dc2626', bg: '#fef2f2' },
      cancelled:        { label: 'Cancelado',              color: '#9ca3af', bg: '#f3f4f6' },
    }
    return statusMap[inst.plan_status] || { label: inst.plan_status || '—', color: '#6b7280', bg: '#f3f4f6' }
  }

  const filtered = institutions.filter(i => {
    const matchSearch = !search ||
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.city?.toLowerCase().includes(search.toLowerCase()) ||
      i.email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && i.plan_status === 'active') ||
      (filterStatus === 'pending' && (i.plan_status === 'pending_contract' || i.plan_status === 'pending_payment')) ||
      (filterStatus === 'suspended' && i.plan_status === 'suspended') ||
      (filterStatus === 'free' && i.plan === 'gratuito')
    const matchPlan = filterPlan === 'all' || i.plan === filterPlan
    return matchSearch && matchStatus && matchPlan
  })

  const stats = {
    total:     institutions.length,
    active:    institutions.filter(i => i.plan_status === 'active').length,
    pending:   institutions.filter(i => ['pending_contract','pending_payment'].includes(i.plan_status)).length,
    suspended: institutions.filter(i => i.plan_status === 'suspended').length,
    free:      institutions.filter(i => i.plan === 'gratuito').length,
  }

  const openEdit = (inst: any) => {
    setEditForm({
      name: inst.name || '', cnpj: inst.cnpj || '',
      city: inst.city || '', state: inst.state || '', phone: inst.phone || '',
      plan: inst.plan || 'escola', plan_status: inst.plan_status || 'active',
      consultant_id: inst.consultant_id || '',
      monthly_value: String(inst.monthly_value || 550),
      implementation_value: String(inst.implementation_value || 550),
    })
    setEditModal(inst)
  }

  const handleSaveEdit = async () => {
    if (!editModal) return
    setSavingEdit(true)
    try {
      const { error } = await supabase.from('institutions').update({
        name: editForm.name, cnpj: editForm.cnpj || null,
        city: editForm.city, state: editForm.state, phone: editForm.phone || null,
        plan: editForm.plan, plan_status: editForm.plan_status,
        consultant_id: editForm.consultant_id || null,
        monthly_value: Number(editForm.monthly_value),
        implementation_value: Number(editForm.implementation_value),
      }).eq('id', editModal.id)
      if (error) throw error
      showToast('Escola atualizada com sucesso!')
      setEditModal(null)
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    } finally {
      setSavingEdit(false)
    }
  }

  const getBestCycle = (id: string) => {
    const all = cycles.filter(c => c.institution_id === id && !['active','completed','archived'].includes(c.status))
    return all.find(c => c.status === 'setup') ?? all.find(c => c.status === 'draft') ?? all[0] ?? null
  }

  const handleReleaseCampaign = async () => {
    if (!releaseModal) return
    setReleasing(true)
    try {
      const campaignYear = new Date().getFullYear() + 1
      const sd = startDate || `${new Date().getFullYear()}-${String(startMonth).padStart(2,'0')}-01`
      const ed = endDate || `${campaignYear}-02-28`
      const existing = getBestCycle(releaseModal.id)

      if (existing) {
        const { error } = await supabase.from('campaign_cycles').update({
          status: 'released', campaign_start_month: startMonth, start_date: sd, end_date: ed,
        }).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('campaign_cycles').insert({
          institution_id: releaseModal.id, status: 'released',
          campaign_start_month: startMonth, year: campaignYear,
          label: `Campanha ${campaignYear}`, start_date: sd, end_date: ed,
          target_new_students: 0, target_reenrollment_rate: 85,
          base_students: 0, monthly_targets: [], market_data: {},
          historical_input: [], generation_mode: 'benchmark',
          ai_reasoning: '', realism_score: 'realistic',
        })
        if (error) throw error
      }

      await supabase.from('system_notifications').insert({
        institution_id: releaseModal.id,
        title: `Campanha ${campaignYear} liberada! 🎉`,
        message: `Sua campanha de matrículas ${campaignYear} foi liberada. Acesse Relatórios para configurar suas metas.`,
        type: 'info', read: false,
      })

      showToast(`Campanha ${campaignYear} liberada para ${releaseModal.name}!`)
      setReleaseModal(null)
      loadData()
    } catch (e: any) {
      showToast(`Erro ao liberar: ${e?.message}`, false)
    } finally {
      setReleasing(false)
    }
  }

  const handleSuspend = async (inst: any) => {
    if (!confirm(`Suspender acesso de "${inst.name}"?`)) return
    const { error } = await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', inst.id)
    if (error) showToast('Erro ao suspender.', false)
    else { showToast(`${inst.name} suspenso.`); loadData() }
  }

  const handleReactivate = async (inst: any) => {
    if (!confirm(`Reativar acesso de "${inst.name}"?`)) return
    const { error } = await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', inst.id)
    if (error) showToast('Erro ao reativar.', false)
    else { showToast(`${inst.name} reativado!`); loadData() }
  }

  const handleDelete = async (inst: any) => {
    if (!confirm(`⚠️ EXCLUIR "${inst.name}"?\n\nEsta ação é IRREVERSÍVEL.`)) return
    const confirmName = window.prompt(`Para confirmar, digite o nome exato:\n"${inst.name}"`)
    if (confirmName !== inst.name) { showToast('Nome incorreto. Cancelado.', false); return }
    try {
      await supabase.from('campaign_cycles').delete().eq('institution_id', inst.id)
      await supabase.from('system_notifications').delete().eq('institution_id', inst.id)
      await supabase.from('payments').delete().eq('institution_id', inst.id)
      await supabase.from('users').update({ institution_id: null }).eq('institution_id', inst.id)
      const { error } = await supabase.from('institutions').delete().eq('id', inst.id)
      if (error) throw error
      showToast(`"${inst.name}" excluída.`)
      loadData()
    } catch (e: any) {
      showToast(`Erro ao excluir: ${e?.message}`, false)
    }
  }

  const fmtBRL = (n: number) => n?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '—'

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">
        {toast && <ToastBar toast={toast} onClose={() => setToast(null)} />}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Escolas</h1>
            <p className="text-sm text-gray-500 mt-1">{institutions.length} instituição{institutions.length !== 1 ? 'ões' : ''} cadastrada{institutions.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowWizard(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:from-cyan-600 hover:to-blue-700">
              <Plus className="w-4 h-4" /> Nova escola
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total',      value: stats.total,     filter: 'all',       color: 'border-gray-200' },
            { label: 'Ativas',     value: stats.active,    filter: 'active',    color: 'border-green-200' },
            { label: 'Pendentes',  value: stats.pending,   filter: 'pending',   color: 'border-yellow-200' },
            { label: 'Suspensas',  value: stats.suspended, filter: 'suspended', color: 'border-red-200' },
            { label: 'Gratuitas',  value: stats.free,      filter: 'free',      color: 'border-purple-200' },
          ].map(k => (
            <button key={k.filter} onClick={() => setFilterStatus(filterStatus === k.filter ? 'all' : k.filter)}
              className={`bg-white rounded-xl border p-4 text-left transition-all shadow-sm hover:shadow-md
                ${filterStatus === k.filter ? `${k.color} ring-2 ring-offset-0` : 'border-gray-200'}`}>
              <p className="text-xs text-gray-500 font-medium">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : k.value}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
              placeholder="Buscar por nome, cidade ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-white"
            value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
            <option value="all">Todos os planos</option>
            {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Escola','Localização','Consultor','Status / Plano','Campanha','WhatsApp','Financeiro','Ações'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j} className="px-5 py-4"><Skeleton h="h-4" w="w-20" /></td>)}</tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm text-gray-400">{search ? 'Nenhuma escola encontrada' : 'Nenhuma escola cadastrada'}</p>
                      {!search && <button onClick={() => setShowWizard(true)} className="mt-2 text-sm text-cyan-600 font-semibold">+ Criar primeira escola</button>}
                    </td>
                  </tr>
                ) : filtered.map(inst => {
                  const planBadge = getPlanBadge(inst)
                  const cycleBadge = getCycleBadge(inst.id)
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-cyan-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{inst.name}</p>
                            {inst.email && <p className="text-xs text-gray-400">{inst.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <MapPin className="w-3.5 h-3.5" />
                          {inst.city && inst.state ? `${inst.city}, ${inst.state}` : '—'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {getConsultantName(inst.consultant_id)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: planBadge.color, background: planBadge.bg }}>
                          {planBadge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: cycleBadge.color, background: cycleBadge.bg }}>
                          {cycleBadge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {inst.whatsapp_connected
                          ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Conectado
                            </span>
                          : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />Pendente
                            </span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        {inst.plan === 'gratuito' ? (
                          <span className="text-xs text-purple-600 font-semibold">Gratuito</span>
                        ) : (
                          <div className="text-xs text-gray-500">
                            <p className="font-semibold text-gray-700">{fmtBRL(inst.monthly_value)}/mês</p>
                            {inst.implementation_value > 0 && <p className="text-gray-400">Impl.: {fmtBRL(inst.implementation_value)}</p>}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setDetailModal(inst)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg" title="Detalhes">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(inst)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => {
                            const bestCycle = getBestCycle(inst.id)
                            setReleaseModal(inst)
                            setStartMonth(bestCycle?.campaign_start_month || 8)
                            setStartDate(bestCycle?.start_date || `${new Date().getFullYear()}-08-01`)
                            setEndDate(bestCycle?.end_date || `${new Date().getFullYear() + 1}-02-28`)
                          }} className="flex items-center gap-1 text-xs px-2 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 font-medium">
                            <Megaphone className="w-3 h-3" /> Liberar
                          </button>
                          {inst.plan_status === 'suspended' ? (
                            <button onClick={() => handleReactivate(inst)} className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg" title="Reativar">
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button onClick={() => handleSuspend(inst)} className="p-1.5 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg" title="Suspender">
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(inst)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              Mostrando {filtered.length} de {institutions.length} escola{institutions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── WIZARD ─────────────────────────────────────────── */}
      {showWizard && (
        <NewSchoolWizard
          consultants={consultants}
          onClose={() => setShowWizard(false)}
          onSuccess={loadData}
        />
      )}

      {/* ── MODAL: Editar escola ────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Editar escola</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editModal.name}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={lbl}>Nome da escola</label>
                <input className={inp} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>CNPJ</label>
                <input className={inp} value={editForm.cnpj} onChange={e => setEditForm(f => ({ ...f, cnpj: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={lbl}>Cidade</label>
                  <input className={inp} value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>UF</label>
                  <input className={inp} maxLength={2} value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div>
                <label className={lbl}>Telefone</label>
                <input className={inp} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Plano</label>
                  <select className={inp} value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}>
                    {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    <option value="trial">Trial</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select className={inp} value={editForm.plan_status} onChange={e => setEditForm(f => ({ ...f, plan_status: e.target.value }))}>
                    {PLAN_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Implantação (R$)</label>
                  <input type="number" className={inp} value={editForm.implementation_value} onChange={e => setEditForm(f => ({ ...f, implementation_value: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Mensalidade (R$)</label>
                  <input type="number" className={inp} value={editForm.monthly_value} onChange={e => setEditForm(f => ({ ...f, monthly_value: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={lbl}>Consultor responsável</label>
                <select className={inp} value={editForm.consultant_id} onChange={e => setEditForm(f => ({ ...f, consultant_id: e.target.value }))}>
                  <option value="">Sem consultor</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setEditModal(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {savingEdit ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</> : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Liberar campanha ─────────────────────────── */}
      {releaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Liberar campanha</h2>
                <p className="text-sm text-gray-500 mt-0.5">{releaseModal.name}</p>
              </div>
              <button onClick={() => setReleaseModal(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={lbl}>Mês de início das matrículas</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {months.map(m => (
                    <button key={m.v} onClick={() => { setStartMonth(m.v); setStartDate(`${new Date().getFullYear()}-${String(m.v).padStart(2,'0')}-01`) }}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${startMonth === m.v ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Data de início</label>
                  <input type="date" className={inp} value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Data de fim</label>
                  <input type="date" className={inp} value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3 text-sm text-cyan-700">
                <p className="font-semibold">Campanha {new Date().getFullYear() + 1}</p>
                <p className="text-xs mt-1">O gestor será notificado automaticamente no sistema.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setReleaseModal(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
              <button onClick={handleReleaseCampaign} disabled={releasing} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {releasing ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Liberando...</> : <><Megaphone className="w-4 h-4" /> Liberar campanha</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Detalhes ─────────────────────────────────── */}
      {detailModal && (
        <SchoolDetailModal
          inst={detailModal}
          consultants={consultants}
          getCycleBadge={getCycleBadge}
          onClose={() => setDetailModal(null)}
          onEdit={() => { setDetailModal(null); openEdit(detailModal) }}
        />
      )}

    </SuperAdminLayout>
  )
}