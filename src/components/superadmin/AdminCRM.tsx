// src/components/superadmin/AdminCRM.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { useNavigate } from 'react-router-dom'
import { buildContractVars, renderContractHtml } from '../../lib/contractPreview'
import {
  Plus, X, Search, Phone, Mail, MapPin,
  Calendar, Clock, ChevronRight, AlertCircle, CheckCircle2,
  MessageCircle, Edit2, Trash2, Building2, DollarSign,
  RefreshCw, Eye, Star, TrendingUp,
  Bell, ChevronDown, StickyNote, Send, Zap, EyeOff,
  Video, Users, ExternalLink, Link2, FileText,
} from 'lucide-react'
import ProposalGenerator from './ProposalGenerator'
import LeadModal, { type Lead, type Stage, STAGES, ORIGINS, inp, lbl, timeAgo } from '../shared/LeadModal'

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

// ─── Lead Card ────────────────────────────────────────────────────────────
function LeadCard({ lead, stage, consultants, meetingCount, onClick, onMoveStage, onDelete, onGenerateProposal }: {
  lead: Lead; stage: typeof STAGES[0]; consultants: any[]
  meetingCount: number
  onClick: () => void; onMoveStage: (to: Stage) => void; onDelete: () => void
  onGenerateProposal: () => void
}) {
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const overdue = isOverdue(lead.next_followup)
  const soon    = isDueSoon(lead.next_followup)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 cursor-pointer hover:shadow-md transition-all hover:border-gray-200 group" onClick={onClick}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-tight truncate">{lead.school_name}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{lead.name}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={onGenerateProposal} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="Gerar Proposta">
            <FileText size={14} />
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenu(!menu)} className="p-1 hover:bg-gray-100 rounded">
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {menu && (
              <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-44 py-1 overflow-hidden">
                <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Mover para</p>
                {STAGES.filter(s => s.id !== lead.stage).map(s => (
                  <button key={s.id} onClick={() => { onMoveStage(s.id); setMenu(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-semibold" style={{ color: s.color }}>
                    → {s.label}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1" />
                <button onClick={() => { onDelete(); setMenu(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 font-semibold flex items-center gap-1.5">
                  <Trash2 className="w-3 h-3" /> Excluir lead
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(lead.city || lead.state) && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {[lead.city, lead.state].filter(Boolean).join('/')}
        </div>
      )}

      {lead.monthly_value && (
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-2">
          <DollarSign className="w-3 h-3 text-green-500" />
          {fmtBRL(lead.monthly_value)}/mês
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        {lead.origin && (
          <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: stage.bg, color: stage.color, border: `1px solid ${stage.border}` }}>
            {lead.origin}
          </span>
        )}
        {meetingCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-100">
            <Video className="w-3 h-3" />{meetingCount}
          </span>
        )}
        {lead.converted_institution_id && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Building2 className="w-3 h-3" />Escola
          </span>
        )}
        {lead.has_proposal && (
          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Proposta</span>
        )}
      </div>

      {lead.next_followup && (
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mt-1 font-medium
          ${overdue ? 'bg-red-50 text-red-600' : soon ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-500'}`}>
          {overdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {new Date(lead.next_followup).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-400">{timeAgo(lead.updated_at || lead.created_at)}</span>
      </div>

      {(lead.stage === 'fechado' || lead.stage === 'cliente') && !lead.converted_institution_id && (
        <div className="mt-2 w-full py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-lg text-center"
          onClick={e => { e.stopPropagation(); onClick() }}>
          🏫 Iniciar onboarding →
        </div>
      )}

      {lead.converted_institution_id && (
        <div className="mt-2 w-full py-1.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-lg text-center">
          ✓ Escola criada
        </div>
      )}
    </div>
  )
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
      }).select().single()
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
                  {!form.isFree && <p className="text-xs text-cyan-700">✅ Enviar e-mail com link de pagamento ao gestor</p>}
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
  const [leads, setLeads]               = useState<Lead[]>([])
  const [consultants, setConsultants]   = useState<any[]>([])
  const [meetingCounts, setMeetingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterStage, setFilterStage]   = useState<Stage | 'all'>('all')
  const [filterConsultant, setFilterConsultant] = useState('')
  const [filterOrigin, setFilterOrigin] = useState('')
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [view, setView]                 = useState<'kanban' | 'list'>('kanban')
  const [selectedLead, setSelectedLead] = useState<Lead | null | 'new'>(null)
  const [onboardingLead, setOnboardingLead] = useState<Lead | null>(null)
  const [proposalLead, setProposalLead] = useState<Lead | null>(null)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  const cancelledRef = useRef(false)

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
      supabase.from('crm_meetings').select('lead_id').eq('status', 'scheduled'),
    ])
    if (cancelledRef.current) return
    setLeads(leadsRes.data || [])
    setConsultants(consultRes.data || [])

    const counts: Record<string, number> = {}
    for (const m of (meetingsRes.data || [])) {
      counts[m.lead_id] = (counts[m.lead_id] || 0) + 1
    }
    setMeetingCounts(counts)
    setLoading(false)
  }

  const filteredLeads = leads.filter(l => {
    const matchSearch     = !search || [l.school_name, l.name, l.city, l.email, l.phone].some(f => f?.toLowerCase().includes(search.toLowerCase()))
    const matchStage      = filterStage === 'all' || l.stage === filterStage
    const matchConsultant = !filterConsultant || l.consultant_id === filterConsultant
    const matchOrigin     = !filterOrigin || l.origin === filterOrigin
    const matchOverdue    = !showOverdueOnly || isOverdue(l.next_followup)
    return matchSearch && matchStage && matchConsultant && matchOrigin && matchOverdue
  })

  const overdueCount = leads.filter(l => isOverdue(l.next_followup) && !['fechado','cliente'].includes(l.stage)).length

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
    await supabase.from('crm_leads').update({ stage: to, updated_at: new Date().toISOString() }).eq('id', lead.id)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este lead?')) return
    await supabase.from('crm_leads').delete().eq('id', id)
    showToast('Lead excluído.')
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

  const kpis = {
    total:        leads.length,
    active:       leads.filter(l => !['fechado','cliente'].includes(l.stage)).length,
    closed:       leads.filter(l => l.stage === 'fechado').length,
    clients:      leads.filter(l => l.stage === 'cliente').length,
    mrr_pipeline: leads.filter(l => l.monthly_value).reduce((s, l) => s + (l.monthly_value || 0), 0),
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && (
          <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
            ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM Comercial</h1>
            <p className="text-sm text-gray-500 mt-1">Pipeline de prospecção e fechamento</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {overdueCount > 0 && (
              <button onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-all
                  ${showOverdueOnly ? 'bg-red-500 text-white border-red-500' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}>
                <AlertCircle className="w-4 h-4" /> {overdueCount} vencido{overdueCount > 1 ? 's' : ''}
              </button>
            )}
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setView('kanban')} className={`px-3 py-2 text-sm font-semibold transition-colors ${view === 'kanban' ? 'bg-cyan-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Kanban</button>
              <button onClick={() => setView('list')} className={`px-3 py-2 text-sm font-semibold transition-colors ${view === 'list' ? 'bg-cyan-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Lista</button>
            </div>
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => setSelectedLead('new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm">
              <Plus className="w-4 h-4" /> Novo lead
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total leads',  value: kpis.total,   icon: TrendingUp, color: 'text-blue-600',    bg: 'bg-blue-50'    },
            { label: 'Em andamento', value: kpis.active,  icon: Clock,      color: 'text-cyan-600',    bg: 'bg-cyan-50'    },
            { label: 'Fechados',     value: kpis.closed,  icon: Star,       color: 'text-green-600',   bg: 'bg-green-50'   },
            { label: 'Clientes',     value: kpis.clients, icon: Building2,  color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'MRR pipeline', value: kpis.mrr_pipeline > 0 ? kpis.mrr_pipeline.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—', icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                  <div className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${k.color}`} />
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-900">{loading ? '—' : k.value}</p>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
              placeholder="Buscar escola, contato, cidade..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
            value={filterStage} onChange={e => setFilterStage(e.target.value as any)}>
            <option value="all">Todos os estágios</option>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
            value={filterConsultant} onChange={e => setFilterConsultant(e.target.value)}>
            <option value="">Todos os consultores</option>
            {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
            value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}>
            <option value="">Todas as origens</option>
            {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {view === 'kanban' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(stage => {
              const stageLeads = filteredLeads.filter(l => l.stage === stage.id)
              const stageValue = stageLeads.reduce((s, l) => s + (l.monthly_value || 0), 0)
              return (
                <div key={stage.id} className="flex-shrink-0 w-64">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: stage.color }}>{stage.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: stage.bg, color: stage.color }}>{stageLeads.length}</span>
                    </div>
                    {stageValue > 0 && <span className="text-xs text-gray-400 font-semibold">{stageValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                    {stageLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead} stage={stage} consultants={consultants}
                        meetingCount={meetingCounts[lead.id] || 0}
                        onClick={() => setSelectedLead(lead)}
                        onMoveStage={to => handleMoveStage(lead, to)}
                        onDelete={() => handleDelete(lead.id)}
                        onGenerateProposal={() => setProposalLead(lead)}
                      />
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="border-2 border-dashed border-gray-100 rounded-xl py-8 text-center text-gray-300">
                        <p className="text-xs">Sem leads</p>
                      </div>
                    )}
                    <button onClick={() => setSelectedLead({ stage: stage.id } as any)}
                      className="w-full py-2 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-cyan-300 hover:text-cyan-500 transition-colors font-medium">
                      + Adicionar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'list' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Escola','Contato','Localização','Estágio','Valores','Follow-up','Ações'].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLeads.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      <TrendingUp className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">Nenhum lead encontrado</p>
                    </td></tr>
                  ) : filteredLeads.map(lead => {
                    const stage   = STAGES.find(s => s.id === lead.stage) || STAGES[0]
                    const overdue = isOverdue(lead.next_followup)
                    return (
                      <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-gray-900 text-sm">{lead.school_name}</p>
                          {(meetingCounts[lead.id] || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-500 mt-0.5">
                              <Video className="w-3 h-3" />{meetingCounts[lead.id]} reunião
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm text-gray-700">{lead.name}</p>
                          {lead.phone && <p className="text-xs text-gray-400">{lead.phone}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-500">{[lead.city, lead.state].filter(Boolean).join('/')}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: stage.color, background: stage.bg }}>{stage.label}</span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-600">
                          {lead.monthly_value && <p className="font-semibold">{fmtBRL(lead.monthly_value)}/mês</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          {lead.next_followup ? (
                            <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                              {overdue && '⚠️ '}{new Date(lead.next_followup).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setProposalLead(lead)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Gerar Proposta">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            {(lead.stage === 'fechado' || lead.stage === 'cliente') && !lead.converted_institution_id && (
                              <button onClick={() => setOnboardingLead(lead)} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg font-bold hover:bg-green-100">🏫</button>
                            )}
                            <button onClick={() => handleDelete(lead.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
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
          </div>
        )}
      </div>

      {selectedLead !== null && (
        <LeadModal
          lead={selectedLead === 'new' ? null : selectedLead}
          consultants={consultants}
          onClose={() => setSelectedLead(null)}
          onSave={handleSaveLead}
          onStartOnboarding={lead => { setSelectedLead(null); setOnboardingLead(lead) }}
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
        <ProposalGenerator
          lead={proposalLead}
          onClose={() => setProposalLead(null)}
          onSave={() => { setProposalLead(null); loadData() }}
        />
      )}

    </SuperAdminLayout>
  )
}
