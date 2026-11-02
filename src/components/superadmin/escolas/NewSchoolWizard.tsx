import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Building2, CheckCircle2, X, Eye, EyeOff, Mail, Shield, ChevronRight, ChevronLeft, DollarSign, Gift, Copy, ExternalLink, Phone, AlertCircle, Info } from 'lucide-react'
import { inp, lbl } from './ui'
import { PLANS } from './constants'

const ONBOARDING_DEFAULT_TASKS: Record<string, { title: string; description: string }[]> = {
  contract: [
    { title: 'Contrato enviado via Autentique',      description: 'Enviar contrato para assinatura digital' },
    { title: 'Contrato assinado pela escola',        description: 'Confirmar assinatura do responsável' },
    { title: 'Pagamento da implantação confirmado',  description: 'Verificar pagamento no Asaas' },
  ],
  implementation: [
    { title: 'Kickoff agendado e realizado',         description: 'Realizar reunião de kickoff com a escola' },
    { title: 'Dados do ERP importados',              description: 'Importar histórico do sistema atual' },
    { title: 'WhatsApp oficial homologado',          description: 'Configurar número via API Oficial Meta' },
    { title: 'Equipe cadastrada no sistema',         description: 'Criar usuários para todos os atendentes' },
    { title: 'Fluxos de atendimento configurados',   description: 'Personalizar bot e fluxos do WhatsApp' },
    { title: 'Formulário de captação publicado',     description: 'Integrar formulário no site da escola' },
  ],
  training: [
    { title: 'Treinamento de CRM realizado',         description: 'Treinar equipe no kanban de leads' },
    { title: 'Treinamento de WhatsApp realizado',    description: 'Treinar equipe no WhatsApp oficial' },
    { title: 'Treinamento de Relatórios realizado',  description: 'Treinar gestor na leitura dos dados' },
    { title: 'Dúvidas da equipe respondidas',        description: 'Sessão de perguntas e respostas' },
  ],
  campaign: [
    { title: 'Campanha configurada pelo gestor',     description: 'Gestor preencheu os dados da campanha' },
    { title: 'IA gerou o plano de campanha',         description: 'Plano com metas mensais gerado' },
    { title: 'Metas revisadas e aprovadas',          description: 'Gestor aprovou as metas sugeridas' },
    { title: 'Campanha liberada pelo admin',         description: 'Admin liberou o acesso à campanha' },
  ],
  monthly: [
    { title: '1ª reunião mensal realizada',          description: 'Primeiro acompanhamento mensal' },
    { title: 'Relatório do mês enviado',             description: 'Relatório de performance enviado' },
  ],
}

// ─── Wizard steps ─────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Dados da escola',   icon: Building2 },
  { n: 2, label: 'Acesso do gestor',  icon: Shield },
  { n: 3, label: 'Financeiro',        icon: DollarSign },
  { n: 4, label: 'Revisão',           icon: CheckCircle2 },
]

type NewForm = {
  // step 1
  name: string; cnpj: string; city: string; state: string; phone: string
  address: string; plan: string; consultantId: string
  // step 2
  email: string; password: string; managerName: string
  managerCpf: string; managerRole: string
  // step 3
  isFree: boolean
  implementationValue: string
  monthlyValue: string
  billingDueDay: string
  sendContractNow: boolean
  signerName: string; signerEmail: string; signerPhone: string
  contractStartDate: string
}

const defaultForm: NewForm = {
  name: '', cnpj: '', city: '', state: '', phone: '', address: '',
  plan: 'escola', consultantId: '',
  email: '', password: '', managerName: '',
  managerCpf: '', managerRole: 'Diretor',
  isFree: false,
  implementationValue: '550',
  monthlyValue: '550',
  billingDueDay: '10',
  sendContractNow: false,
  signerName: '', signerEmail: '', signerPhone: '',
  contractStartDate: '',
}

// ─── WIZARD COMPONENT ─────────────────────────────────────────────────────
export default function NewSchoolWizard({
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
      if (!form.cnpj.trim()) e.cnpj = 'CNPJ obrigatório'
      if (!form.address.trim()) e.address = 'Endereço obrigatório'
      if (!form.city.trim()) e.city = 'Cidade obrigatória'
      if (!form.state.trim()) e.state = 'UF obrigatório'
    }
    if (s === 2) {
      if (!form.managerName.trim()) e.managerName = 'Nome obrigatório'
      if (!form.managerCpf.trim()) e.managerCpf = 'CPF obrigatório'
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
          address: form.address.trim() || null,
          email: form.email.trim().toLowerCase(),
          consultant_id: form.consultantId || null,
          plan: form.plan,
          plan_status: form.isFree ? 'active' : 'pending_contract',
          monthly_value: form.isFree ? 0 : Number(form.monthlyValue),
          implementation_value: form.isFree ? 0 : Number(form.implementationValue),
        })
        .select('id').single()

      if (instErr) throw new Error(instErr.message)

      // 1b. Criar processo de implantação + semear as 19 tarefas padrão —
      // antes exigia um passo manual separado ("iniciar onboarding"); erro
      // aqui não bloqueia a criação da escola (o admin pode iniciar depois
      // manualmente em InstitutionDetails.tsx), só avisa.
      try {
        const { data: proc, error: procErr } = await supabase
          .from('onboarding_processes')
          .insert({ institution_id: institution.id, current_phase: 'contract', status: 'active' })
          .select().single()
        if (procErr) throw procErr
        const allTasks: any[] = []
        let order = 0
        for (const phase of ['contract', 'implementation', 'training', 'campaign', 'monthly']) {
          for (const t of ONBOARDING_DEFAULT_TASKS[phase]) {
            allTasks.push({ process_id: proc.id, phase, title: t.title, description: t.description, done: false, sort_order: order++ })
          }
        }
        const { error: tasksErr } = await supabase.from('onboarding_tasks').insert(allTasks)
        if (tasksErr) throw tasksErr
      } catch (e: any) {
        console.error('[NewSchoolWizard] erro ao criar processo de implantação:', e?.message)
      }

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
      // create-user faz cadastro inteligente: se o e-mail já tinha conta em
      // outra escola/vínculo, não cria de novo — só adiciona o vínculo com
      // esta instituição nova (created: false). Manda um aviso extra sem
      // senha nenhuma (os e-mails de payment_link/new_institution abaixo já
      // não expõem senha, mas nenhum deles avisa que a conta é reaproveitada).
      const wasCreated = fnData.created !== false
      if (!wasCreated) {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'added_to_institution',
              to: form.email.trim().toLowerCase(),
              data: {
                user_name: form.managerName.trim(),
                email: form.email.trim().toLowerCase(),
                school_name: form.name.trim(),
                login_url: `${window.location.origin}/login`,
              },
            },
          })
        } catch {}
      }

      let paymentLink: string | undefined

      if (!form.isFree) {
        // 3. Criar cobrança no Asaas via Edge Function (cria o registro no DB também)
        try {
          const { data: asaasData } = await supabase.functions.invoke('asaas-create-charge', {
            body: {
              institution_id: institution.id,
              name: form.name.trim(),
              email: form.email.trim().toLowerCase(),
              cpfCnpj: form.cnpj.replace(/\D/g, '') || null,
              value: Number(form.implementationValue),
              payment_type: 'implementation',
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
              school_cnpj: form.cnpj.trim(),
              school_address: form.address.trim(),
              school_city: form.city.trim(),
              school_state: form.state.trim(),
              signer_name: form.signerName || form.managerName,
              signer_email: form.signerEmail || form.email,
              signer_phone: form.signerPhone,
              signer_cpf: form.managerCpf,
              signer_role: form.managerRole,
              monthly_value: Number(form.monthlyValue),
              implementation_value: Number(form.implementationValue),
              contract_start_date: form.contractStartDate || new Date().toISOString().split('T')[0],
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

              <div>
                <label className={lbl}>Endereço completo *</label>
                <input className={`${inp} ${errors.address ? 'border-red-400' : ''}`}
                  placeholder="Rua, número, bairro, cidade/UF, CEP"
                  value={form.address}
                  onChange={e => set('address', e.target.value)} />
                {err('address')}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>CPF do representante legal *</label>
                  <input className={`${inp} ${errors.managerCpf ? 'border-red-400' : ''}`}
                    placeholder="000.000.000-00"
                    value={form.managerCpf}
                    onChange={e => set('managerCpf', e.target.value)} />
                  {err('managerCpf')}
                </div>
                <div>
                  <label className={lbl}>Cargo do signatário *</label>
                  <select className={inp} value={form.managerRole} onChange={e => set('managerRole', e.target.value)}>
                    <option value="Diretor">Diretor</option>
                    <option value="Diretor Geral">Diretor Geral</option>
                    <option value="Diretor Pedagógico">Diretor Pedagógico</option>
                    <option value="Coordenador">Coordenador</option>
                    <option value="Proprietário">Proprietário</option>
                    <option value="Responsável Legal">Responsável Legal</option>
                    <option value="Gerente">Gerente</option>
                  </select>
                </div>
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

                  <div>
                    <label className={lbl}>Data de início da vigência do contrato</label>
                    <input type="date" className={inp}
                      value={form.contractStartDate}
                      onChange={e => set('contractStartDate', e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">Data em que o contrato começa a valer.</p>
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
                    ['Endereço', form.address || '—'],
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
                    ['CPF', form.managerCpf || '—'],
                    ['Cargo', form.managerRole || '—'],
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
