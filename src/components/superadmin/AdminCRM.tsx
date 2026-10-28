// src/components/superadmin/AdminCRM.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildContractVars, renderContractHtml } from '../../lib/contractPreview'
import {
  Plus, X, Search, Phone, Mail, MapPin,
  Calendar, Clock, ChevronRight, AlertCircle, CheckCircle2,
  MessageCircle, Edit2, Trash2, Building2, DollarSign,
  RefreshCw, Eye, Star, TrendingUp,
  Bell, ChevronDown, StickyNote, Send, Zap, EyeOff,
  Video, Users, ExternalLink, Link2, FileText,
} from 'lucide-react'
import ProposalForm from './ProposalForm'
import CrmBoard, { type BoardMeeting } from './CrmBoard'
import LeadSheet from './LeadSheet'
import { type Lead, type Stage, STAGES, ORIGINS, inp, lbl, timeAgo } from '../shared/LeadModal'

function fmtBRL(n?: number) {
  if (!n) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function isOverdue(d?: string) { return !!d && new Date(d) < new Date() }
function isDueSoon(d?: string) {
  if (!d) return false
  const ms = new Date(d).getTime() - Date.now()
  return ms > 0 && ms < 48 * 3600000
}

// ─── Onboarding Modal — 3-step wizard ────────────────────────────────────
function maskCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function OnboardingFromLeadModal({ lead, consultants, onClose, onSuccess }: {
  lead: Lead; consultants: any[]; onClose: () => void; onSuccess: (institutionId: string, warning?: string) => void
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name:                lead.school_name || '',
    cnpj:                '',
    address:             '',
    city:                lead.city  || '',
    state:               lead.state || '',
    phone:               lead.phone || '',
    plan:                'escola',
    consultantId:        lead.consultant_id || '',
    isFree:              false,
    implementationValue: String(lead.implementation_value || 550),
    monthlyValue:        String(lead.monthly_value || 550),
    billingDueDay:       '10',
    managerName:         lead.name  || '',
    managerCpf:          '',
    managerRole:         'Diretor',
    signerPhone:         '',
    email:               lead.email || '',
    password:            '',
  })
  const [showPw, setShowPw] = useState(false)
  const [showContractPreview, setShowContractPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const validateStep = (s: number) => {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!form.name.trim())  e.name  = 'Obrigatório'
      if (!form.city.trim())  e.city  = 'Obrigatório'
      if (!form.state.trim()) e.state = 'Obrigatório'
    }
    if (s === 2) {
      if (!form.managerName.trim()) e.managerName = 'Obrigatório'
      if (form.managerCpf.replace(/\D/g, '').length !== 11) e.managerCpf = 'CPF inválido (11 dígitos)'
      if (!form.email.includes('@')) e.email = 'E-mail inválido'
      if (form.password.length < 8) e.password = 'Mínimo 8 caracteres'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const nextStep = () => { if (validateStep(step)) setStep(s => s + 1) }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada.')

      const { data: institution, error: instErr } = await supabase.from('institutions').insert({
        name:                 form.name.trim(),
        cnpj:                 form.cnpj.trim() || null,
        address:              form.address.trim() || null,
        city:                 form.city.trim(),
        state:                form.state.trim().toUpperCase(),
        phone:                form.phone.trim() || null,
        email:                form.email.trim().toLowerCase(),
        consultant_id:        form.consultantId || null,
        plan:                 form.plan,
        plan_status:          form.isFree ? 'active' : 'pending_contract',
        monthly_value:        form.isFree ? 0 : Number(form.monthlyValue),
        implementation_value: form.isFree ? 0 : Number(form.implementationValue),
        billing_due_day:      Number(form.billingDueDay),
      }).select('id').single()
      if (instErr) throw new Error(instErr.message)

      // Cria o processo de implantação + semeia as 19 tarefas padrão — mesmo
      // gap corrigido em AdminSchools.tsx (Nova Escola): sem isso a escola
      // nasceria sem processo, exigindo início manual depois em InstitutionDetails.tsx.
      try {
        const { data: proc, error: procErr } = await supabase
          .from('onboarding_processes')
          .insert({ institution_id: institution.id, current_phase: 'contract', status: 'active' })
          .select().single()
        if (procErr) throw procErr
        const tasksByPhase: Record<string, { title: string; description: string }[]> = {
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
        const allTasks: any[] = []
        let order = 0
        for (const phase of ['contract', 'implementation', 'training', 'campaign', 'monthly']) {
          for (const t of tasksByPhase[phase]) {
            allTasks.push({ process_id: proc.id, phase, title: t.title, description: t.description, done: false, sort_order: order++ })
          }
        }
        const { error: tasksErr } = await supabase.from('onboarding_tasks').insert(allTasks)
        if (tasksErr) throw tasksErr
      } catch (e: any) {
        console.error('[handleCreate] erro ao criar processo de implantação:', e?.message)
      }

      const fnRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password, full_name: form.managerName.trim(), role: 'admin', user_type: 'school_user', institution_id: institution.id }),
      })
      const fnData = await fnRes.json()
      if (!fnRes.ok || fnData?.error) {
        await supabase.from('institutions').delete().eq('id', institution.id)
        throw new Error(fnData?.error || 'Erro ao criar usuário')
      }

      // 3. Enviar contrato (não bloqueia criação se falhar)
      let contractWarning: string | undefined
      if (!form.isFree) {
        try {
          const consultantName = consultants.find(c => c.id === form.consultantId)?.full_name
          await supabase.functions.invoke('autentique', {
            body: {
              institution_id:  institution.id,
              signer_name:     form.managerName.trim(),
              signer_email:    form.email.trim().toLowerCase(),
              signer_cpf:      form.managerCpf.replace(/\D/g, ''),
              signer_phone:    form.signerPhone.trim() || null,
              consultant_id:   form.consultantId || null,
              consultant_name: consultantName || null,
            },
          })
        } catch (e: any) {
          contractWarning = 'Escola criada mas houve erro ao enviar contrato. Acesse a aba Contrato para reenviar.'
          console.error('[handleCreate] autentique error:', e?.message)
        }
      } else {
        // Escola gratuita — sem contrato, envia boas-vindas direto
        try {
          await supabase.functions.invoke('send-email', {
            body: { type: 'new_institution', to: form.email.trim().toLowerCase(), data: { institution_name: form.name.trim(), login_url: 'https://aionedu.com.br/login' } },
          })
        } catch {}
      }

      await supabase.from('crm_leads').update({ stage: 'cliente', converted_institution_id: institution.id, updated_at: new Date().toISOString() }).eq('id', lead.id)
      onSuccess(institution.id, contractWarning)
    } catch (e: any) {
      setErrors({ _global: e?.message || 'Erro ao criar escola.' })
    } finally {
      setSaving(false)
    }
  }

  const inp2 = (err?: string) => `${inp} ${err ? 'border-red-400' : ''}`

  const STEPS = ['Dados da escola', 'Gestor e contrato', 'Plano e pagamento']

  const contractHtml = showContractPreview ? renderContractHtml(buildContractVars({
    institution: { name: form.name, cnpj: form.cnpj, address: form.address, city: form.city, state: form.state, billing_due_day: form.billingDueDay },
    signer: { name: form.managerName, role: form.managerRole, cpf: form.managerCpf, email: form.email, phone: form.signerPhone },
    monthly_value: Number(form.monthlyValue),
    implementation_value: Number(form.implementationValue),
    consultant_name: consultants.find(c => c.id === form.consultantId)?.full_name,
  })) : ''

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">🏫 Onboarding de lead</span>
            <h2 className="text-lg font-bold text-gray-900 mt-1">Criar escola — {lead.school_name}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-4 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors
                ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${step === i + 1 ? 'text-cyan-700' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${step > i + 1 ? 'bg-green-300' : 'bg-gray-100'}`} />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-4">
          {errors._global && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{errors._global}
            </div>
          )}

          {/* ── Step 1: Dados da escola ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={lbl}>Nome da escola *</label>
                <input className={inp2(errors.name)} value={form.name} onChange={e => set('name', e.target.value)} />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className={lbl}>Endereço completo</label>
                <input className={inp} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rua, número, bairro" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>CNPJ</label>
                  <input className={inp} value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <label className={lbl}>Telefone</label>
                  <input className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Cidade *</label>
                  <input className={inp2(errors.city)} value={form.city} onChange={e => set('city', e.target.value)} />
                  {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                </div>
                <div>
                  <label className={lbl}>UF *</label>
                  <input className={inp2(errors.state)} maxLength={2} value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} />
                  {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Gestor e contrato ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dados do gestor / signatário</p>
                <div>
                  <label className={lbl}>Nome do gestor *</label>
                  <input className={inp2(errors.managerName)} value={form.managerName} onChange={e => set('managerName', e.target.value)} />
                  {errors.managerName && <p className="text-xs text-red-500 mt-1">{errors.managerName}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>CPF do gestor *</label>
                    <input className={inp2(errors.managerCpf)} placeholder="000.000.000-00"
                      value={form.managerCpf} onChange={e => set('managerCpf', maskCpf(e.target.value))} />
                    {errors.managerCpf && <p className="text-xs text-red-500 mt-1">{errors.managerCpf}</p>}
                  </div>
                  <div>
                    <label className={lbl}>Cargo</label>
                    <input className={inp} value={form.managerRole} onChange={e => set('managerRole', e.target.value)} placeholder="Diretor" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>E-mail *</label>
                    <input type="email" className={inp2(errors.email)} value={form.email} onChange={e => set('email', e.target.value)} />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className={lbl}>WhatsApp do gestor</label>
                    <input className={inp} placeholder="(83) 99999-9999" value={form.signerPhone} onChange={e => set('signerPhone', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Senha inicial *</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} className={inp2(errors.password) + ' pr-10'}
                      placeholder="Mínimo 8 caracteres" value={form.password} onChange={e => set('password', e.target.value)} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>
              </div>
              <button onClick={() => setShowContractPreview(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-cyan-300 text-cyan-700 rounded-xl font-semibold text-sm hover:bg-cyan-50 transition-colors">
                <Eye className="w-4 h-4" /> Visualizar contrato
              </button>
            </div>
          )}

          {/* ── Step 3: Plano e pagamento ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Plano</label>
                  <select className={inp} value={form.plan} onChange={e => set('plan', e.target.value)}>
                    <option value="escola">Escola Padrão</option>
                    <option value="rede">Rede</option>
                    <option value="gratuito">Gratuito</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Consultor</label>
                  <select className={inp} value={form.consultantId} onChange={e => set('consultantId', e.target.value)}>
                    <option value="">Sem consultor</option>
                    {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Acesso gratuito</p>
                  <p className="text-xs text-gray-400">Sem cobrança de implantação ou mensalidade</p>
                </div>
                <button onClick={() => set('isFree', !form.isFree)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.isFree ? 'bg-purple-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isFree ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {!form.isFree && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>Implantação (R$)</label>
                    <input type="number" className={inp} value={form.implementationValue} onChange={e => set('implementationValue', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Mensalidade (R$)</label>
                    <input type="number" className={inp} value={form.monthlyValue} onChange={e => set('monthlyValue', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Vencimento (dia)</label>
                    <select className={inp} value={form.billingDueDay} onChange={e => set('billingDueDay', e.target.value)}>
                      {['5','10','15','20','25'].map(d => <option key={d} value={d}>Dia {d}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4">
                <p className="text-xs font-bold text-cyan-700 uppercase tracking-wide mb-2">Resumo — o que será feito</p>
                <div className="space-y-1.5">
                  <p className="text-xs text-cyan-700">✅ Criar escola <strong>{form.name}</strong> ({form.city}/{form.state})</p>
                  <p className="text-xs text-cyan-700">✅ Criar usuário gestor para <strong>{form.email}</strong></p>
                  {!form.isFree && <p className="text-xs text-cyan-700">✅ Enviar contrato digital via Autentique para assinatura</p>}
                  {!form.isFree && <p className="text-xs text-cyan-700">✅ Gerar cobrança de implantação no Asaas (R$ {form.implementationValue})</p>}
                  {!form.isFree && <p className="text-xs text-cyan-700">✅ Enviar e-mail com link de pagamento ao gestor assim que o contrato for assinado</p>}
                  {form.isFree && <p className="text-xs text-cyan-700">✅ Enviar e-mail de acesso imediato ao gestor</p>}
                  <p className="text-xs text-cyan-700">✅ Converter lead para cliente no CRM</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={step > 1 ? () => setStep(s => s - 1) : onClose}
            className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">
            {step > 1 ? '← Voltar' : 'Cancelar'}
          </button>
          {step < 3 ? (
            <button onClick={nextStep}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold text-sm">
              Próximo →
            </button>
          ) : (
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm disabled:opacity-60">
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando...</> : <>🏫 Criar escola e iniciar onboarding</>}
            </button>
          )}
        </div>
      </div>

      {/* Contract preview modal */}
      {showContractPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Pré-visualização do contrato</h3>
              <button onClick={() => setShowContractPreview(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div dangerouslySetInnerHTML={{ __html: contractHtml }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function AdminCRM() {
  const navigate = useNavigate()
  const [qs, setQs] = useSearchParams()
  const [initialTab, setInitialTab] = useState<'meetings' | undefined>(undefined)
  const [leads, setLeads]               = useState<Lead[]>([])
  const [consultants, setConsultants]   = useState<any[]>([])
  const [meetings, setMeetings]     = useState<BoardMeeting[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null | 'new'>(null)
  const [onboardingLead, setOnboardingLead] = useState<Lead | null>(null)
  const [proposalLead, setProposalLead] = useState<Lead | null>(null)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  const cancelledRef = useRef(false)

  // vindo da Agenda: ?lead=<id>&tab=meetings abre a ficha direto na aba Reuniões
  useEffect(() => {
    const id = qs.get('lead'); if (!id || !leads.length) return
    const l = leads.find(x => x.id === id)
    if (l) { setInitialTab(qs.get('tab') === 'meetings' ? 'meetings' : undefined); setSelectedLead(l) }
    qs.delete('lead'); qs.delete('tab'); setQs(qs, { replace: true })
  }, [leads, qs, setQs])

  useEffect(() => {
    cancelledRef.current = false
    loadData()
    return () => { cancelledRef.current = true }
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [leadsRes, consultRes, meetingsRes] = await Promise.all([
      supabase.from('crm_leads').select('*').order('updated_at', { ascending: false }),
      supabase.from('users').select('id, full_name, email').eq('user_type', 'consultant'),
      supabase.from('crm_meetings').select('lead_id, scheduled_at').eq('status', 'scheduled'),
    ])
    if (cancelledRef.current) return
    setLeads(leadsRes.data || [])
    setConsultants(consultRes.data || [])

    setMeetings((meetingsRes.data || []) as BoardMeeting[])
    setLoading(false)
  }

  const handleSaveLead = async (form: Partial<Lead>) => {
    try {
      if (form.id) {
        const { error } = await supabase.from('crm_leads').update({ ...form, updated_at: new Date().toISOString() }).eq('id', form.id)
        if (error) throw error
        showToast('Lead atualizado!')
      } else {
        const { error } = await supabase.from('crm_leads').insert({ ...form, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        if (error) throw error
        showToast('Lead criado!')
      }
      setSelectedLead(null)
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    }
  }

  const handleMoveStage = async (lead: Lead, to: Stage) => {
    const before = leads
    setLeads(ls => ls.map(l => (l.id === lead.id ? { ...l, stage: to, updated_at: new Date().toISOString() } : l)))
    const { error } = await supabase.from('crm_leads').update({ stage: to, updated_at: new Date().toISOString() }).eq('id', lead.id)
    if (error) { setLeads(before); showToast(`Não foi possível mover: ${error.message}`, false); return }
    showToast(`Movido para ${STAGES.find(s => s.id === to)?.label.replace(/[^\p{L}\s]/gu, '').trim()}`)
    loadData()
  }

  const handleDelete = async (id: string) => {
    const lead = leads.find(l => l.id === id)
    if (!confirm(`Excluir ${lead?.school_name ? `"${lead.school_name}"` : 'este lead'}? As reuniões, o histórico de contatos e as propostas dele também serão apagados.`)) return
    let msg = ''
    const rpc = await supabase.rpc('crm_delete_lead', { p_id: id })
    if (!rpc.error) {
      const r = rpc.data as { ok?: boolean; error?: string } | null
      if (r && r.ok === false) msg = r.error || 'Não foi possível excluir.'
    } else {
      // função ainda não existe no banco: faz os mesmos passos pelo próprio app
      const com = await supabase.from('consultant_commissions').select('id', { count: 'exact', head: true }).eq('lead_id', id)
      if ((com.count || 0) > 0) msg = 'Este lead tem comissão de consultor registrada. Exclua ou ajuste a comissão antes.'
      else {
        await supabase.from('whatsapp_conversations').update({ aion_lead_id: null }).eq('aion_lead_id', id)
        const { error } = await supabase.from('crm_leads').delete().eq('id', id)
        if (error) msg = error.message
      }
    }
    if (msg) { showToast(msg, false); return }
    showToast('Lead excluído.')
    setSelectedLead(null)
    loadData()
  }

  const handleOnboardingSuccess = (institutionId: string, warning?: string) => {
    setOnboardingLead(null)
    if (warning) {
      showToast(warning, false)
    } else {
      showToast('🎉 Escola criada! Contrato enviado para assinatura.')
    }
    loadData()
    navigate(`/super-admin/schools/${institutionId}`)
  }

  return (
    <SuperAdminLayout>
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
          ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <CrmBoard
        leads={leads}
        consultants={consultants}
        meetings={meetings}
        loading={loading}
        onOpenLead={l => setSelectedLead(l)}
        onNewLead={stage => setSelectedLead(stage ? ({ stage } as any) : 'new')}
        onProposal={l => setProposalLead(l)}
        onMove={handleMoveStage}
        onDelete={handleDelete}
        onOnboard={l => setOnboardingLead(l)}
      />

      {selectedLead !== null && (
        <LeadSheet
          key={selectedLead === 'new' ? 'new' : (selectedLead as Lead).id || 'new-stage'}
          lead={selectedLead === 'new' ? null : selectedLead}
          consultants={consultants}
          initialTab={initialTab}
          onClose={() => { setSelectedLead(null); setInitialTab(undefined) }}
          onSave={handleSaveLead}
          onDelete={handleDelete}
          onProposal={l => { setSelectedLead(null); setProposalLead(l) }}
          onOnboard={lead => { setSelectedLead(null); setOnboardingLead(lead) }}
        />
      )}

      {onboardingLead && (
        <OnboardingFromLeadModal
          lead={onboardingLead}
          consultants={consultants}
          onClose={() => setOnboardingLead(null)}
          onSuccess={handleOnboardingSuccess}
        />
      )}

      {proposalLead && (
        <ProposalForm
          lead={proposalLead}
          onClose={() => setProposalLead(null)}
          onDone={msg => { setProposalLead(null); loadData(); if (msg) showToast(msg, !/erro|não saiu/i.test(msg)) }}
        />
      )}

    </SuperAdminLayout>
  )
}
