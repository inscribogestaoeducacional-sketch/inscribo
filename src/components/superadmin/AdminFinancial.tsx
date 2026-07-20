// src/components/superadmin/AdminFinancial.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import SuperAdminLayout from './SuperAdminLayout'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  DollarSign, Building2, AlertTriangle, CheckCircle2, Clock, X, RefreshCw,
  ExternalLink, AlertCircle, Send, Plus, Copy, CreditCard, Ban,
  MessageCircle, Unlock, Lock, Eye, ChevronDown, ChevronRight,
  Users, Calendar, ChevronLeft, SlidersHorizontal
} from 'lucide-react'

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}
function daysLate(dueDate: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate + 'T12:00:00').getTime()) / 86400000))
}

type Period = { start: Date; end: Date }

// Compara pelo dia (ignora hora) pra funcionar tanto com colunas DATE puras
// ('2026-07-01') quanto com timestamps completos (paid_at) sem cair no bug de
// fuso horário de "new Date('2026-07-01')" virar o dia anterior dependendo do
// navegador.
function inPeriod(dateStr: string | null | undefined, period: Period) {
  if (!dateStr) return false
  const raw = dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr
  const d = new Date(raw)
  const startDay = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate())
  const endDay   = new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate(), 23, 59, 59, 999)
  return d >= startDay && d <= endDay
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }
function toDateInput(d: Date)  { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0] }
function fromDateInput(s: string) { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

type Tab = 'overview' | 'payments' | 'overdue' | 'costs' | 'entries' | 'commissions'

const STATUS_MAP: Record<string, { l: string; c: string; bg: string }> = {
  pending:   { l: 'Pendente',  c: '#6b7280', bg: '#f3f4f6' },
  paid:      { l: 'Pago',      c: '#16a34a', bg: '#f0fdf4' },
  overdue:   { l: 'Atrasado',  c: '#dc2626', bg: '#fef2f2' },
  cancelled: { l: 'Cancelado', c: '#9ca3af', bg: '#f9fafb' },
  refunded:  { l: 'Estornado', c: '#7c3aed', bg: '#f5f3ff' },
}

const TYPE_MAP: Record<string, string> = {
  implementation:      'Implantação',
  monthly:             'Mensalidade',
  extra_conversations: 'Conversas extras',
}

const ENTRY_CATEGORY_MAP: Record<string, string> = {
  implantacao_avulsa: 'Implantação avulsa',
  consultoria:         'Consultoria',
  patrocinio:          'Patrocínio',
  marketing:           'Marketing',
  infraestrutura:      'Infraestrutura',
  folha:               'Folha',
  outro:                'Outro',
}

const COMMISSION_TYPE_MAP: Record<string, string> = {
  implantacao: 'Implantação',
  mensalidade: 'Mensalidade',
}

const COMMISSION_STATUS_MAP: Record<string, { l: string; c: string; bg: string }> = {
  pendente:  { l: 'Pendente',  c: '#d97706', bg: '#fffbeb' },
  paga:      { l: 'Paga',      c: '#16a34a', bg: '#f0fdf4' },
  cancelada: { l: 'Cancelada', c: '#9ca3af', bg: '#f9fafb' },
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

// ─── Modal Nova Cobrança ──────────────────────────────────────────────────
function NewChargeModal({ institutions, onClose, onSuccess, showToast }: {
  institutions: any[]; onClose: () => void; onSuccess: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const [form, setForm] = useState({
    institution_id: '', amount: '', payment_type: 'monthly',
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    billingType: 'PIX', description: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.institution_id || !form.amount) { showToast('Preencha todos os campos.', false); return }
    setSaving(true)
    try {
      const inst = institutions.find(i => i.id === form.institution_id)

      // Criar cobrança no Asaas
      const { data, error } = await supabase.functions.invoke('asaas-create-charge', {
        body: {
          institution_id: form.institution_id,
          name:           inst?.name,
          email:          inst?.email,
          cpfCnpj:        inst?.cnpj?.replace(/\D/g, '') || '',
          value:          Number(form.amount),
          description:    form.description || `${TYPE_MAP[form.payment_type]} — ${inst?.name}`,
          dueDate:        form.due_date,
          billingType:    form.billingType,
        },
      })
      if (error) throw new Error(error.message)

      showToast('Cobrança gerada no Asaas!')
      onSuccess()
      onClose()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao gerar cobrança.', false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Nova cobrança</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className={lbl}>Escola *</label>
            <select className={inp} value={form.institution_id} onChange={e => set('institution_id', e.target.value)}>
              <option value="">Selecionar...</option>
              {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo</label>
              <select className={inp} value={form.payment_type} onChange={e => set('payment_type', e.target.value)}>
                <option value="monthly">Mensalidade</option>
                <option value="implementation">Implantação</option>
                <option value="extra_conversations">Conversas extras</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Forma de pagamento</label>
              <select className={inp} value={form.billingType} onChange={e => set('billingType', e.target.value)}>
                <option value="PIX">PIX</option>
                <option value="BOLETO">Boleto</option>
                <option value="CREDIT_CARD">Cartão</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Valor (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <input type="number" className={inp + ' pl-9'} value={form.amount} onChange={e => set('amount', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={lbl}>Vencimento</label>
              <input type="date" className={inp} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Descrição (opcional)</label>
            <input className={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: Mensalidade Maio/2025" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Gerando...</> : <><CreditCard className="w-4 h-4" />Gerar cobrança</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Detalhes da Cobrança ────────────────────────────────────────────
function PaymentDetailModal({ payment, onClose, onAction }: {
  payment: any; onClose: () => void; onAction: (action: string, payment: any) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const act = async (action: string) => {
    setLoading(true)
    await onAction(action, payment)
    setLoading(false)
  }

  const copyLink = () => {
    if (payment.asaas_charge_url) {
      navigator.clipboard.writeText(payment.asaas_charge_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const st = STATUS_MAP[payment.status] || STATUS_MAP.pending

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Detalhes da cobrança</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block" style={{ color: st.c, background: st.bg }}>{st.l}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-2 text-sm mb-5">
          {[
            ['Escola',      payment.institutions?.name || '—'],
            ['Tipo',        TYPE_MAP[payment.payment_type] || payment.payment_type || '—'],
            ['Valor',       fmtBRL(payment.amount)],
            ['Vencimento',  payment.due_date ? new Date(payment.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'],
            ['Pago em',     payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('pt-BR') : '—'],
            ['Descrição',   payment.description || '—'],
            ['ID Asaas',    payment.asaas_payment_id || '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-gray-400 font-medium">{k}</span>
              <span className="text-gray-900 font-semibold text-right max-w-[60%] truncate">{v}</span>
            </div>
          ))}
        </div>

        {/* Link de pagamento */}
        {payment.asaas_charge_url && (
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 mb-4">
            <p className="text-xs font-bold text-gray-500 mb-2">Link de pagamento</p>
            <div className="flex items-center gap-2">
              <input readOnly className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate" value={payment.asaas_charge_url} />
              <button onClick={copyLink} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
              </button>
              <a href={payment.asaas_charge_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-cyan-50 border border-cyan-200 rounded-lg">
                <ExternalLink className="w-4 h-4 text-cyan-600" />
              </a>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col gap-2">
          {payment.status === 'pending' && (
            <>
              <button onClick={() => act('mark_paid')} disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 disabled:opacity-60">
                <CheckCircle2 className="w-4 h-4" /> Marcar como pago manualmente
              </button>
              {payment.asaas_charge_url && (
                <button onClick={() => act('resend_email')} disabled={loading}
                  className="flex items-center justify-center gap-2 py-2.5 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 disabled:opacity-60">
                  <Send className="w-4 h-4" /> Reenviar link por e-mail
                </button>
              )}
              <button onClick={() => act('resend_whatsapp')} disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 disabled:opacity-60">
                <MessageCircle className="w-4 h-4" /> Enviar link via WhatsApp
              </button>
              <button onClick={() => act('cancel')} disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-sm hover:bg-red-100 disabled:opacity-60">
                <Ban className="w-4 h-4" /> Cancelar cobrança
              </button>
            </>
          )}
          {payment.status === 'overdue' && (
            <>
              <button onClick={() => act('mark_paid')} disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600">
                <CheckCircle2 className="w-4 h-4" /> Marcar como pago
              </button>
              <button onClick={() => act('resend_email')} disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 bg-blue-500 text-white rounded-xl font-semibold text-sm">
                <Send className="w-4 h-4" /> Reenviar cobrança por e-mail
              </button>
            </>
          )}
          <button onClick={onClose} className="py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Custo ──────────────────────────────────────────────────────────
function CostModal({ cost, onClose, onSuccess, showToast }: {
  cost?: any; onClose: () => void; onSuccess: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const isNew = !cost?.id
  const [form, setForm] = useState({
    name:       cost?.name       || '',
    amount:     String(cost?.amount || ''),
    recurrence: cost?.recurrence || 'monthly',
    category:   cost?.category   || 'infrastructure',
    active:     cost?.active     ?? true,
    notes:      cost?.notes      || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.amount) { showToast('Preencha nome e valor.', false); return }
    setSaving(true)
    const payload = { name: form.name.trim(), amount: Number(form.amount), recurrence: form.recurrence, category: form.category, active: form.active, notes: form.notes || null }
    const { error } = isNew
      ? await supabase.from('platform_costs').insert(payload)
      : await supabase.from('platform_costs').update(payload).eq('id', cost.id)
    if (error) { showToast('Erro ao salvar: ' + error.message, false) }
    else { showToast(isNew ? 'Custo adicionado!' : 'Custo atualizado!'); onSuccess(); onClose() }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Adicionar custo' : 'Editar custo'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className={lbl}>Nome do custo *</label>
            <input className={inp} placeholder="Ex: Hostinger, Brevo, Servidor..." value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Valor (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <input type="number" step="0.01" className={inp + ' pl-9'} value={form.amount} onChange={e => set('amount', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={lbl}>Recorrência</label>
              <select className={inp} value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
                <option value="one_time">Avulso</option>
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Categoria</label>
            <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="infrastructure">Infraestrutura</option>
              <option value="tools">Ferramentas/SaaS</option>
              <option value="services">Serviços</option>
              <option value="other">Outros</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Observações</label>
            <input className={inp} placeholder="Detalhes opcionais..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
            <span className="text-sm font-semibold text-gray-700">Custo ativo</span>
            <button onClick={() => set('active', !form.active)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? 'bg-cyan-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Salvando...</> : <><CheckCircle2 className="w-4 h-4" />Salvar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Lançamento manual ────────────────────────────────────────────────
function FinancialEntryModal({ entry, institutions, userId, onClose, onSuccess, showToast }: {
  entry?: any; institutions: any[]; userId?: string
  onClose: () => void; onSuccess: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const isNew = !entry?.id
  const [form, setForm] = useState({
    type:           entry?.type           || 'entrada',
    amount:         String(entry?.amount || ''),
    description:    entry?.description    || '',
    category:       entry?.category       || 'outro',
    entry_date:     entry?.entry_date     || new Date().toISOString().split('T')[0],
    institution_id: entry?.institution_id || '',
    notes:          entry?.notes          || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.description || !form.amount) { showToast('Preencha descrição e valor.', false); return }
    setSaving(true)
    const payload = {
      type:           form.type,
      amount:         Number(form.amount),
      description:    form.description.trim(),
      category:       form.category,
      entry_date:     form.entry_date,
      institution_id: form.institution_id || null,
      notes:          form.notes || null,
    }
    const { error } = isNew
      ? await supabase.from('financial_entries').insert({ ...payload, source: 'manual', created_by: userId || null })
      : await supabase.from('financial_entries').update(payload).eq('id', entry.id)
    if (error) { showToast('Erro ao salvar: ' + error.message, false) }
    else { showToast(isNew ? 'Lançamento adicionado!' : 'Lançamento atualizado!'); onSuccess(); onClose() }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Novo lançamento' : 'Editar lançamento'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className={lbl}>Tipo *</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => set('type', 'entrada')}
                className={`py-2.5 rounded-lg text-sm font-semibold border ${form.type === 'entrada' ? 'bg-green-50 border-green-400 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                Entrada
              </button>
              <button type="button" onClick={() => set('type', 'saida')}
                className={`py-2.5 rounded-lg text-sm font-semibold border ${form.type === 'saida' ? 'bg-red-50 border-red-400 text-red-700' : 'border-gray-200 text-gray-500'}`}>
                Saída
              </button>
            </div>
          </div>
          <div>
            <label className={lbl}>Descrição *</label>
            <input className={inp} placeholder="Ex: Patrocínio evento X, Consultoria pontual..." value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Valor (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <input type="number" step="0.01" className={inp + ' pl-9'} value={form.amount} onChange={e => set('amount', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={lbl}>Data</label>
              <input type="date" className={inp} value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Categoria</label>
            <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
              {Object.entries(ENTRY_CATEGORY_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Escola (opcional)</label>
            <select className={inp} value={form.institution_id} onChange={e => set('institution_id', e.target.value)}>
              <option value="">Nenhuma / lançamento da plataforma</option>
              {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Observações</label>
            <input className={inp} placeholder="Detalhes opcionais..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Salvando...</> : <><CheckCircle2 className="w-4 h-4" />Salvar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Comissão ──────────────────────────────────────────────────────
function CommissionModal({ commission, consultants, institutions, userId, onClose, onSuccess, showToast }: {
  commission?: any; consultants: any[]; institutions: any[]; userId?: string
  onClose: () => void; onSuccess: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const isNew = !commission?.id
  const [form, setForm] = useState({
    consultant_id:   commission?.consultant_id   || '',
    institution_id:  commission?.institution_id  || '',
    type:             commission?.type             || 'mensalidade',
    reference_month: commission?.reference_month || '',
    basis_amount:    String(commission?.basis_amount ?? ''),
    percentage:       String(commission?.percentage ?? ''),
    amount:           String(commission?.amount ?? ''),
    status:           commission?.status           || 'pendente',
    payment_date:    commission?.payment_date     || '',
    notes:            commission?.notes             || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: any) => setForm(f => {
    const next = { ...f, [k]: v }
    // Ao marcar como paga, preenche payment_date com hoje se ainda estiver vazio (editável depois).
    if (k === 'status' && v === 'paga' && !f.payment_date) {
      next.payment_date = new Date().toISOString().split('T')[0]
    }
    return next
  })

  const handleSave = async () => {
    if (!form.consultant_id || !form.amount) { showToast('Selecione o consultor e informe o valor.', false); return }
    setSaving(true)
    const payload = {
      consultant_id:   form.consultant_id,
      institution_id:  form.institution_id || null,
      type:             form.type,
      reference_month: form.reference_month || null,
      basis_amount:    form.basis_amount ? Number(form.basis_amount) : null,
      percentage:       form.percentage ? Number(form.percentage) : null,
      amount:           Number(form.amount),
      status:           form.status,
      payment_date:    form.payment_date || null,
      notes:            form.notes || null,
    }
    const { error } = isNew
      ? await supabase.from('consultant_commissions').insert({ ...payload, source: 'manual', created_by: userId || null })
      : await supabase.from('consultant_commissions').update(payload).eq('id', commission.id)
    if (error) { showToast('Erro ao salvar: ' + error.message, false) }
    else { showToast(isNew ? 'Comissão adicionada!' : 'Comissão atualizada!'); onSuccess(); onClose() }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Nova comissão' : 'Editar comissão'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className={lbl}>Consultor *</label>
            <select className={inp} value={form.consultant_id} onChange={e => set('consultant_id', e.target.value)}>
              <option value="">Selecionar...</option>
              {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Escola (opcional)</label>
            <select className={inp} value={form.institution_id} onChange={e => set('institution_id', e.target.value)}>
              <option value="">Nenhuma</option>
              {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo *</label>
              <select className={inp} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="implantacao">Implantação</option>
                <option value="mensalidade">Mensalidade</option>
              </select>
            </div>
            {form.type === 'mensalidade' && (
              <div>
                <label className={lbl}>Mês de referência</label>
                <input type="month" className={inp}
                  value={form.reference_month ? form.reference_month.slice(0, 7) : ''}
                  onChange={e => set('reference_month', e.target.value ? `${e.target.value}-01` : '')} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Valor base (R$)</label>
              <input type="number" step="0.01" className={inp} placeholder="Ex: monthly_value do contrato" value={form.basis_amount} onChange={e => set('basis_amount', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Percentual (%)</label>
              <input type="number" step="0.01" className={inp} placeholder="Ex: 10" value={form.percentage} onChange={e => set('percentage', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Valor final (R$) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
              <input type="number" step="0.01" className={inp + ' pl-9'} value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Status</label>
              <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="pendente">Pendente</option>
                <option value="paga">Paga</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Data de pagamento</label>
              <input type="date" className={inp} value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <input className={inp} placeholder="Detalhes opcionais..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Salvando...</> : <><CheckCircle2 className="w-4 h-4" />Salvar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function AdminFinancial() {
  const { user } = useAuth()
  const [institutions, setInstitutions] = useState<any[]>([])
  const [payments,     setPayments]     = useState<any[]>([])
  const [costs,        setCosts]        = useState<any[]>([])
  const [entries,      setEntries]      = useState<any[]>([])
  const [commissions,  setCommissions]  = useState<any[]>([])
  const [consultants,  setConsultants]  = useState<any[]>([])
  const [settings,     setSettings]     = useState<Record<string, string>>({})
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState<Tab>('overview')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterInst,   setFilterInst]   = useState('')
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null)
  const [showNewCharge, setShowNewCharge] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null)
  const [costModal, setCostModal] = useState<any | null | 'new'>(null)
  const [entryModal, setEntryModal] = useState<any | null | 'new'>(null)
  const [commissionModal, setCommissionModal] = useState<any | null | 'new'>(null)

  // ── Período (default: mês corrente, mesmo comportamento de antes) ──────
  const [period, setPeriod] = useState<Period>(() => {
    const now = new Date()
    return { start: startOfMonth(now), end: endOfMonth(now) }
  })
  const [showCustomPeriod, setShowCustomPeriod] = useState(false)
  const isWholeMonth = period.start.getDate() === 1
    && period.end.getTime() === endOfMonth(period.start).getTime()
  const periodLabel = isWholeMonth
    ? period.start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : `${period.start.toLocaleDateString('pt-BR')} – ${period.end.toLocaleDateString('pt-BR')}`
  const shiftMonth = (delta: number) => {
    setPeriod(p => {
      const base = new Date(p.start.getFullYear(), p.start.getMonth() + delta, 1)
      return { start: base, end: endOfMonth(base) }
    })
  }

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    loadData()
    return () => { cancelledRef.current = true }
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [instRes, payRes, cfgRes, costRes, entryRes, commRes, consRes] = await Promise.all([
      supabase.from('institutions').select('id, name, city, plan, plan_status, asaas_customer_id, monthly_value, email, cnpj, phone').order('name'),
      supabase.from('payments').select('*, institutions(name)').order('created_at', { ascending: false }),
      supabase.from('platform_settings').select('key, value'),
      supabase.from('platform_costs').select('*').order('name'),
      supabase.from('financial_entries').select('*, institutions(name)').order('entry_date', { ascending: false }),
      supabase.from('consultant_commissions').select('*, institutions(name)').order('created_at', { ascending: false }),
      supabase.from('users').select('id, full_name').eq('user_type', 'consultant').order('full_name'),
    ])
    if (cancelledRef.current) return
    setInstitutions(instRes.data || [])
    setPayments(payRes.data || [])
    setCosts(costRes.data || [])
    setEntries(entryRes.data || [])
    setCommissions(commRes.data || [])
    setConsultants(consRes.data || [])
    const cfg: Record<string, string> = {}
    for (const s of cfgRes.data || []) cfg[s.key] = s.value
    setSettings(cfg)
    setLoading(false)
  }

  // ── KPIs (todos relativos ao `period` selecionado, default = mês corrente) ──
  const now = new Date()

  // Lançamentos manuais (financial_entries) — somas adicionais aos cálculos
  // existentes de payments/platform_costs, sem substituí-los.
  const manualEntradasPeriod = entries.filter(e => e.type === 'entrada' && inPeriod(e.entry_date, period)).reduce((s, e) => s + (e.amount || 0), 0)
  const manualSaidasPeriod   = entries.filter(e => e.type === 'saida'   && inPeriod(e.entry_date, period)).reduce((s, e) => s + (e.amount || 0), 0)

  // Comissões de consultor no período (payment_date se já paga, senão created_at)
  // — entram como custo, afetam a margem, igual platform_costs/financial_entries.
  const commissionsInPeriod  = commissions.filter(c => c.status !== 'cancelada' && inPeriod(c.payment_date || c.created_at, period))
  const commissionsPending  = commissionsInPeriod.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.amount || 0), 0)
  const commissionsPaid     = commissionsInPeriod.filter(c => c.status === 'paga').reduce((s, c) => s + (c.amount || 0), 0)
  const commissionsTotal    = commissionsPending + commissionsPaid

  const mrr = payments.filter(p => p.status === 'paid' && inPeriod(p.paid_at, period)).reduce((s, p) => s + (p.amount || 0), 0)
    + manualEntradasPeriod
  const mrrProjected = institutions.filter(i => i.plan_status === 'active' && i.plan !== 'gratuito').reduce((s, i) => s + (i.monthly_value || 550), 0)
  const overdueList  = payments.filter(p => p.status === 'overdue')
  const overdueTotal = overdueList.reduce((s, p) => s + (p.amount || 0), 0)
  const pendingTotal = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0)
  const churnCount   = institutions.filter(i => ['cancelled','suspended'].includes(i.plan_status)).length

  const mrrChart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const monthPaid = payments.filter(p => {
      if (p.status !== 'paid' || !p.paid_at) return false
      const pd = new Date(p.paid_at)
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth()
    })
    const monthManualEntradas = entries.filter(e => {
      if (e.type !== 'entrada' || !e.entry_date) return false
      const ed = new Date(e.entry_date + 'T12:00:00')
      return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth()
    })
    return {
      month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      mrr:   monthPaid.reduce((s, p) => s + (p.amount || 0), 0) + monthManualEntradas.reduce((s, e) => s + (e.amount || 0), 0),
    }
  })

  // ── Custos (Financeiro > Custos): platform_costs (recorrente, SEM dimensão
  // temporal — sempre "atual", independente do período) + saídas manuais e
  // comissões do período selecionado.
  const activeCosts  = costs.filter(c => c.active)
  const platformCostsMonthly = activeCosts.reduce((s, c) => {
    if (c.recurrence === 'monthly') return s + (c.amount || 0)
    if (c.recurrence === 'yearly')  return s + (c.amount || 0) / 12
    return s
  }, 0)
  const monthlyTotal = platformCostsMonthly + manualSaidasPeriod + commissionsTotal
  const yearlyTotal  = platformCostsMonthly * 12
  const grossProfit  = mrrProjected - monthlyTotal
  const margin       = mrrProjected > 0 ? Math.round((grossProfit / mrrProjected) * 100) : 0

  const filteredPayments = payments.filter(p => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    const matchInst   = !filterInst || p.institution_id === filterInst
    return matchStatus && matchInst
  })

  // ── Ações sobre pagamento ─────────────────────────────────
  const handlePaymentAction = async (action: string, payment: any) => {
    const inst = institutions.find(i => i.id === payment.institution_id)

    if (action === 'mark_paid') {
      if (!confirm('Marcar como pago manualmente?')) return
      await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payment.id)
      // Se for implantação, ativa a escola
      if (payment.payment_type === 'implementation') {
        await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', payment.institution_id)
      }
      showToast('Pagamento marcado como pago!')
      setSelectedPayment(null)
      loadData()
    }

    if (action === 'cancel') {
      if (!confirm('Cancelar esta cobrança?')) return
      // Cancela no Asaas se tiver ID — só marca como cancelado localmente se
      // o Asaas confirmar (senão a cobrança fica "cancelada" no painel mas
      // continua cobrável de verdade do lado do Asaas).
      if (payment.asaas_payment_id) {
        const { data, error } = await supabase.functions.invoke('asaas-cancel-charge', {
          body: { payment_id: payment.asaas_payment_id }
        })
        if (error || !data?.success) {
          showToast('Erro ao cancelar no Asaas: ' + (error?.message || data?.error || 'falha desconhecida') + '. Cobrança NÃO foi cancelada localmente.', false)
          return
        }
      }
      await supabase.from('payments').update({ status: 'cancelled' }).eq('id', payment.id)
      showToast('Cobrança cancelada.')
      setSelectedPayment(null)
      loadData()
    }

    if (action === 'resend_email') {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'payment_link',
            to: inst?.email,
            data: {
              institution_name: inst?.name,
              value: fmtBRL(payment.amount).replace('R$\u00a0', ''),
              due_date: payment.due_date ? new Date(payment.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
              billing_type: 'PIX/Boleto',
              payment_link: payment.asaas_charge_url,
            }
          }
        })
        showToast('E-mail enviado!')
      } catch (e: any) {
        showToast('Erro ao enviar e-mail: ' + e?.message, false)
      }
    }

    if (action === 'resend_whatsapp') {
      const phone = inst?.phone?.replace(/\D/g, '')
      if (!phone) { showToast('Escola sem telefone cadastrado.', false); return }
      const msg = encodeURIComponent(
        `Olá! Segue o link para pagamento da ${TYPE_MAP[payment.payment_type] || 'cobrança'} no valor de ${fmtBRL(payment.amount)}:\n\n${payment.asaas_charge_url}`
      )
      window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank')
    }
  }

  const handleSuspend = async (inst: any) => {
    if (!confirm(`Suspender acesso de "${inst.name}"?`)) return
    await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', inst.id)
    showToast(`${inst.name} suspenso.`)
    loadData()
  }

  const handleReactivate = async (inst: any) => {
    if (!confirm(`Reativar acesso de "${inst.name}"?`)) return
    await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', inst.id)
    showToast(`${inst.name} reativado!`)
    loadData()
  }

  const overdueByInst = overdueList.reduce((acc, p) => {
    const id = p.institution_id
    if (!acc[id]) acc[id] = { institution: p.institutions, payments: [], total: 0, maxDays: 0 }
    acc[id].payments.push(p)
    acc[id].total += (p.amount || 0)
    const days = daysLate(p.due_date)
    if (days > acc[id].maxDays) acc[id].maxDays = days
    return acc
  }, {} as Record<string, any>)

  const overdueGroups = Object.values(overdueByInst).sort((a: any, b: any) => b.maxDays - a.maxDays)

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && (
          <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
            ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
            <button onClick={() => setToast(null)}><X className="w-4 h-4 opacity-70" /></button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
            <p className="text-sm text-gray-500 mt-1">Receita, cobranças e inadimplência</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowNewCharge(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:from-cyan-600 hover:to-blue-700">
              <Plus className="w-4 h-4" /> Nova cobrança
            </button>
          </div>
        </div>

        {/* Seletor de período */}
        <div className="flex items-center gap-3 flex-wrap bg-white border border-gray-200 rounded-xl px-4 py-2.5">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {!showCustomPeriod ? (
            <div className="flex items-center gap-2">
              <button onClick={() => shiftMonth(-1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-semibold text-gray-800 capitalize min-w-[140px] text-center">{periodLabel}</span>
              <button onClick={() => shiftMonth(1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="date" className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                value={toDateInput(period.start)}
                onChange={e => setPeriod(p => ({ ...p, start: fromDateInput(e.target.value) }))} />
              <span className="text-gray-400 text-sm">até</span>
              <input type="date" className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                value={toDateInput(period.end)}
                onChange={e => setPeriod(p => ({ ...p, end: fromDateInput(e.target.value) }))} />
            </div>
          )}
          <button onClick={() => setShowCustomPeriod(v => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg ml-auto ${showCustomPeriod ? 'bg-cyan-50 text-cyan-700' : 'text-gray-500 hover:bg-gray-100'}`}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> {showCustomPeriod ? 'Usar navegação por mês' : 'Período personalizado'}
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Receita no período', value: fmtBRL(mrr),          sub: `Projeção recorrente: ${fmtBRL(mrrProjected)}`, icon: DollarSign,   grad: 'from-green-500 to-emerald-600' },
            { label: 'Escolas ativas', value: institutions.filter(i => i.plan_status === 'active').length, sub: `${churnCount} churn`, icon: Building2, grad: 'from-cyan-500 to-blue-600' },
            { label: 'Inadimplência',  value: fmtBRL(overdueTotal), sub: `${overdueList.length} cobranças`, icon: AlertTriangle, grad: overdueTotal > 0 ? 'from-red-500 to-rose-600' : 'from-gray-400 to-gray-500' },
            { label: 'A receber',      value: fmtBRL(pendingTotal), sub: 'cobranças pendentes', icon: Clock, grad: 'from-amber-500 to-orange-500' },
            { label: 'Comissões (período)', value: fmtBRL(commissionsTotal), sub: `${fmtBRL(commissionsPending)} pendente · ${fmtBRL(commissionsPaid)} paga`, icon: Users, grad: 'from-purple-500 to-fuchsia-600' },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{k.label}</p>
                    {loading ? <div className="h-7 w-20 bg-gray-100 rounded animate-pulse" />
                      : <p className="text-xl font-bold text-gray-900">{k.value}</p>}
                    {k.sub && !loading && <p className="text-xs text-gray-400 mt-1">{k.sub}</p>}
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.grad} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'overview' as Tab, label: 'Visão geral' },
            { id: 'payments' as Tab, label: `Histórico (${payments.length})` },
            { id: 'overdue'  as Tab, label: `Inadimplência${overdueGroups.length > 0 ? ` (${overdueGroups.length})` : ''}`, alert: overdueGroups.length > 0 },
            { id: 'costs'    as Tab, label: `Custos (${costs.length})` },
            { id: 'entries'  as Tab, label: `Lançamentos (${entries.length})` },
            { id: 'commissions' as Tab, label: `Comissões (${commissions.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
                ${tab === t.id ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t.label}
              {(t as any).alert && <span className="w-2 h-2 rounded-full bg-red-500" />}
            </button>
          ))}
        </div>

        {/* ── TAB: Visão geral ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-bold text-gray-900 mb-5">MRR — últimos 6 meses</h2>
              {loading ? <div className="h-52 bg-gray-50 rounded-xl animate-pulse" />
                : <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={mrrChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => [fmtBRL(Number(v)), 'MRR']} />
                      <Line type="monotone" dataKey="mrr" stroke="#14b8a6" strokeWidth={3} dot={{ fill: '#14b8a6', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
              }
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Escolas por situação financeira</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Escola','Plano','Status','MRR','Asaas','Ações'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? Array(4).fill(0).map((_, i) => (
                      <tr key={i}>{Array(6).fill(0).map((_, j) => <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                    )) : institutions.map(i => {
                      const stMap: Record<string, { l: string; c: string; bg: string }> = {
                        active:           { l: 'Ativo',             c: '#16a34a', bg: '#f0fdf4' },
                        pending_contract: { l: 'Aguard. contrato',  c: '#6366f1', bg: '#eef2ff' },
                        pending_payment:  { l: 'Aguard. pagamento', c: '#d97706', bg: '#fffbeb' },
                        suspended:        { l: 'Suspenso',          c: '#dc2626', bg: '#fef2f2' },
                        cancelled:        { l: 'Cancelado',         c: '#9ca3af', bg: '#f3f4f6' },
                      }
                      const st = stMap[i.plan_status] || { l: i.plan_status, c: '#6b7280', bg: '#f3f4f6' }
                      return (
                        <tr key={i.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-semibold text-gray-900 text-sm">{i.name}</td>
                          <td className="px-5 py-3 text-sm text-gray-500 capitalize">{i.plan || '—'}</td>
                          <td className="px-5 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: st.c, background: st.bg }}>{st.l}</span>
                          </td>
                          <td className="px-5 py-3 text-sm font-semibold text-gray-700">
                            {i.plan === 'gratuito' ? <span className="text-purple-600">Gratuito</span> : fmtBRL(i.monthly_value || 550)}
                          </td>
                          <td className="px-5 py-3 text-xs">
                            {i.asaas_customer_id
                              ? <span className="text-green-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Vinculado</span>
                              : <span className="text-gray-400">Não vinculado</span>}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1">
                              {i.plan_status === 'suspended'
                                ? <button onClick={() => handleReactivate(i)} className="flex items-center gap-1 text-xs px-2 py-1.5 bg-green-50 text-green-700 rounded-lg font-semibold hover:bg-green-100">
                                    <Unlock className="w-3 h-3" /> Reativar
                                  </button>
                                : i.plan_status === 'active'
                                ? <button onClick={() => handleSuspend(i)} className="flex items-center gap-1 text-xs px-2 py-1.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100">
                                    <Lock className="w-3 h-3" /> Suspender
                                  </button>
                                : null
                              }
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Histórico ── */}
        {tab === 'payments' && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">Todos os status</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
              </select>
              <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                value={filterInst} onChange={e => setFilterInst(e.target.value)}>
                <option value="">Todas as escolas</option>
                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {loading ? <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />)}</div>
                : filteredPayments.length === 0
                ? <div className="p-12 text-center text-gray-400">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">Nenhum pagamento encontrado</p>
                  </div>
                : <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {['Escola','Tipo','Valor','Vencimento','Pago em','Status',''].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredPayments.slice(0, 100).map(p => {
                          const st = STATUS_MAP[p.status] || STATUS_MAP.pending
                          return (
                            <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedPayment(p)}>
                              <td className="px-5 py-3 font-medium text-gray-900 text-sm">{(p as any).institutions?.name || '—'}</td>
                              <td className="px-5 py-3 text-xs text-gray-500">{TYPE_MAP[p.payment_type] || p.payment_type || '—'}</td>
                              <td className="px-5 py-3 font-semibold text-gray-700 text-sm">{fmtBRL(p.amount)}</td>
                              <td className="px-5 py-3 text-sm text-gray-500">{p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                              <td className="px-5 py-3 text-sm text-gray-500">{p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : '—'}</td>
                              <td className="px-5 py-3">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: st.c, background: st.bg }}>{st.l}</span>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex gap-1">
                                  {p.asaas_charge_url && (
                                    <a href={p.asaas_charge_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                      className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  <button onClick={e => { e.stopPropagation(); setSelectedPayment(p) }}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          </div>
        )}

        {/* ── TAB: Inadimplência ── */}
        {tab === 'overdue' && (
          <div className="space-y-4">
            {overdueGroups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-green-400" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">Tudo em dia!</h3>
                <p className="text-gray-500">Nenhuma escola com pagamentos em atraso.</p>
              </div>
            ) : (
              <>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-red-800">{overdueGroups.length} escola{overdueGroups.length > 1 ? 's' : ''} inadimplente{overdueGroups.length > 1 ? 's' : ''}</p>
                      <p className="text-sm text-red-600">Total em atraso: <strong>{fmtBRL(overdueTotal)}</strong></p>
                    </div>
                  </div>
                  <div className="text-center px-4 py-2 bg-white rounded-xl border border-red-200">
                    <p className="text-xs text-gray-500">Fluxo automático</p>
                    <p className="text-xs font-bold text-gray-700 mt-0.5">
                      D+{settings.overdue_warning1_days || 3} → D+{settings.overdue_warning2_days || 7} → D+{settings.overdue_warning3_days || 15} → Suspensão D+{settings.overdue_suspend_days || 20}
                    </p>
                  </div>
                </div>

                {overdueGroups.map((group: any, i: number) => {
                  const inst = institutions.find(ii => ii.id === group.payments[0]?.institution_id)
                  const isSuspended = inst?.plan_status === 'suspended'
                  const days = group.maxDays
                  const urgency = days >= (Number(settings.overdue_suspend_days) || 20) ? 'red'
                    : days >= (Number(settings.overdue_warning3_days) || 15) ? 'orange'
                    : days >= (Number(settings.overdue_warning2_days) || 7) ? 'amber' : 'yellow'

                  const uc = {
                    red:    { bg: 'bg-red-50',    border: 'border-red-300',    badge: 'bg-red-500 text-white',     text: 'text-red-700'    },
                    orange: { bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-500 text-white',  text: 'text-orange-700' },
                    amber:  { bg: 'bg-amber-50',  border: 'border-amber-300',  badge: 'bg-amber-500 text-white',   text: 'text-amber-700'  },
                    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-300', badge: 'bg-yellow-400 text-white',  text: 'text-yellow-700' },
                  }[urgency]

                  return (
                    <div key={i} className={`${uc.bg} border ${uc.border} rounded-2xl p-5`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-gray-900 text-sm">{group.institution?.name || inst?.name || '—'}</p>
                            {isSuspended && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded-full">SUSPENSO</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className={`font-bold px-2 py-0.5 rounded-full ${uc.badge}`}>{days}d em atraso</span>
                            <span className={`font-semibold ${uc.text}`}>Total: {fmtBRL(group.total)}</span>
                            <span className="text-gray-500">{group.payments.length} cobrança{group.payments.length > 1 ? 's' : ''}</span>
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => handlePaymentAction('resend_email', group.payments[0])}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50">
                            <Send className="w-3.5 h-3.5" /> E-mail
                          </button>
                          <button onClick={() => handlePaymentAction('resend_whatsapp', group.payments[0])}
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100">
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                          </button>
                          {isSuspended
                            ? <button onClick={() => handleReactivate(inst)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Reativar
                              </button>
                            : <button onClick={() => handleSuspend(inst)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600">
                                <AlertTriangle className="w-3.5 h-3.5" /> Suspender
                              </button>
                          }
                        </div>
                      </div>

                      {/* Linha do tempo */}
                      <div className="mt-4 flex items-center">
                        {[
                          { label: `D+${settings.overdue_warning1_days || 3}`,  desc: '1º aviso',   days: Number(settings.overdue_warning1_days || 3)  },
                          { label: `D+${settings.overdue_warning2_days || 7}`,  desc: '2º aviso',   days: Number(settings.overdue_warning2_days || 7)  },
                          { label: `D+${settings.overdue_warning3_days || 15}`, desc: 'Aviso final', days: Number(settings.overdue_warning3_days || 15) },
                          { label: `D+${settings.overdue_suspend_days || 20}`,  desc: 'Suspensão',  days: Number(settings.overdue_suspend_days || 20)  },
                        ].map((step, idx, arr) => {
                          const passed = days >= step.days
                          return (
                            <div key={idx} className="flex items-center flex-1">
                              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                <div className={`w-3 h-3 rounded-full ${passed ? 'bg-red-500 ring-2 ring-red-200' : 'bg-gray-200'}`} />
                                <p className="text-[9px] font-bold text-gray-600">{step.label}</p>
                                <p className="text-[8px] text-gray-400 whitespace-nowrap">{step.desc}</p>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-1 mb-4 ${days >= arr[idx + 1].days ? 'bg-red-400' : 'bg-gray-200'}`} />
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Cobranças individuais */}
                      <div className="mt-3 space-y-2">
                        {group.payments.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100 text-xs">
                            <span className="text-gray-500">{TYPE_MAP[p.payment_type] || 'Mensalidade'}</span>
                            <span className="font-semibold text-gray-700">{fmtBRL(p.amount)}</span>
                            <span className="text-gray-400">Venceu {p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                            <span className="font-bold text-red-600">{daysLate(p.due_date)}d</span>
                            <button onClick={() => setSelectedPayment(p)} className="text-gray-400 hover:text-gray-600">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* ── TAB: Custos ── */}
        {tab === 'costs' && (() => {
          // activeCosts/monthlyTotal/yearlyTotal/grossProfit/margin já calculados
          // no escopo do componente (monthlyTotal soma platform_costs recorrente +
          // saídas manuais/comissões do período selecionado) — ver bloco de KPIs.
          const CATS: Record<string, string> = { infrastructure: 'Infraestrutura', tools: 'Ferramentas/SaaS', services: 'Serviços', other: 'Outros' }
          const REC:  Record<string, string> = { monthly: 'Mensal', yearly: 'Anual', one_time: 'Avulso' }

          return (
            <div className="space-y-6">
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>"Custos fixos" (tabela abaixo) reflete a configuração <strong>atual</strong> — sem data de início/fim, não varia com o período selecionado. Só as saídas manuais e comissões somadas no KPI "Custos/mês" respeitam o período.</span>
              </div>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Custos/mês',   value: fmtBRL(monthlyTotal), sub: 'fixos + saídas/comissões do período', grad: 'from-red-500 to-rose-600',    icon: DollarSign   },
                  { label: 'Projeção anual', value: fmtBRL(yearlyTotal), sub: 'estimativa 12 meses',    grad: 'from-orange-500 to-red-500',  icon: AlertTriangle },
                  { label: 'Lucro bruto/mês', value: fmtBRL(grossProfit), sub: `MRR - custos`,          grad: grossProfit > 0 ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600', icon: CheckCircle2 },
                  { label: 'Margem bruta',  value: `${margin}%`,          sub: `de ${fmtBRL(mrrProjected)} MRR`, grad: margin > 50 ? 'from-cyan-500 to-blue-600' : 'from-amber-500 to-orange-500', icon: Clock },
                ].map(k => {
                  const Icon = k.icon
                  return (
                    <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{k.label}</p>
                          <p className="text-xl font-bold text-gray-900">{k.value}</p>
                          <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                        </div>
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.grad} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Custos operacionais</h2>
                  <button onClick={() => setCostModal('new')}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                    <Plus className="w-4 h-4" /> Adicionar custo
                  </button>
                </div>
                {costs.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">Nenhum custo cadastrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {['Nome','Valor','Recorrência','Categoria','Status','Ações'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {costs.map(c => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3">
                              <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                              {c.notes && <p className="text-xs text-gray-400 mt-0.5">{c.notes}</p>}
                            </td>
                            <td className="px-5 py-3 font-bold text-gray-800 text-sm">{fmtBRL(c.amount)}</td>
                            <td className="px-5 py-3 text-sm text-gray-500">{REC[c.recurrence] || c.recurrence}</td>
                            <td className="px-5 py-3 text-sm text-gray-500">{CATS[c.category] || c.category}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                {c.active ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex gap-1">
                                <button onClick={() => setCostModal(c)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={async () => {
                                  if (!confirm(`Excluir "${c.name}"?`)) return
                                  await supabase.from('platform_costs').delete().eq('id', c.id)
                                  showToast('Custo excluído.'); loadData()
                                }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── TAB: Lançamentos ── */}
        {tab === 'entries' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Lançamentos manuais</h2>
                <p className="text-xs text-gray-400 mt-0.5">Receitas e despesas avulsas, fora do fluxo automático de mensalidade e custos fixos</p>
              </div>
              <button onClick={() => setEntryModal('new')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                <Plus className="w-4 h-4" /> Novo lançamento
              </button>
            </div>
            {entries.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Nenhum lançamento cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Tipo','Descrição','Valor','Categoria','Data','Escola','Ações'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${e.type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {e.type === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-gray-900 text-sm">{e.description}</p>
                          {e.notes && <p className="text-xs text-gray-400 mt-0.5">{e.notes}</p>}
                        </td>
                        <td className={`px-5 py-3 font-bold text-sm ${e.type === 'entrada' ? 'text-green-700' : 'text-red-600'}`}>
                          {e.type === 'entrada' ? '+' : '−'}{fmtBRL(e.amount)}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-500">{ENTRY_CATEGORY_MAP[e.category] || e.category}</td>
                        <td className="px-5 py-3 text-sm text-gray-500">{e.entry_date ? new Date(e.entry_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                        <td className="px-5 py-3 text-sm text-gray-500">{(e as any).institutions?.name || '—'}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => setEntryModal(e)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={async () => {
                              if (!confirm(`Excluir lançamento "${e.description}"?`)) return
                              await supabase.from('financial_entries').delete().eq('id', e.id)
                              showToast('Lançamento excluído.'); loadData()
                            }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Comissões ── */}
        {tab === 'commissions' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Comissões de consultor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Lançamento manual — entram como custo no cálculo de margem do período</p>
              </div>
              <button onClick={() => setCommissionModal('new')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                <Plus className="w-4 h-4" /> Nova comissão
              </button>
            </div>
            {commissions.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Nenhuma comissão cadastrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Consultor','Escola','Tipo','Valor','Status','Pagamento','Ações'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {commissions.map(c => {
                      const st = COMMISSION_STATUS_MAP[c.status] || COMMISSION_STATUS_MAP.pendente
                      const consultantName = consultants.find(cs => cs.id === c.consultant_id)?.full_name || '—'
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-semibold text-gray-900 text-sm">{consultantName}</td>
                          <td className="px-5 py-3 text-sm text-gray-500">{(c as any).institutions?.name || '—'}</td>
                          <td className="px-5 py-3 text-xs text-gray-500">{COMMISSION_TYPE_MAP[c.type] || c.type}</td>
                          <td className="px-5 py-3 font-bold text-gray-800 text-sm">{fmtBRL(c.amount)}</td>
                          <td className="px-5 py-3">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: st.c, background: st.bg }}>{st.l}</span>
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-500">{c.payment_date ? new Date(c.payment_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => setCommissionModal(c)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={async () => {
                                if (!confirm(`Excluir comissão de "${consultantName}"?`)) return
                                await supabase.from('consultant_commissions').delete().eq('id', c.id)
                                showToast('Comissão excluída.'); loadData()
                              }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {showNewCharge && (
        <NewChargeModal
          institutions={institutions}
          onClose={() => setShowNewCharge(false)}
          onSuccess={loadData}
          showToast={showToast}
        />
      )}

      {selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onAction={handlePaymentAction}
        />
      )}

      {costModal !== null && (
        <CostModal
          cost={costModal === 'new' ? undefined : costModal}
          onClose={() => setCostModal(null)}
          onSuccess={loadData}
          showToast={showToast}
        />
      )}

      {entryModal !== null && (
        <FinancialEntryModal
          entry={entryModal === 'new' ? undefined : entryModal}
          institutions={institutions}
          userId={user?.id}
          onClose={() => setEntryModal(null)}
          onSuccess={loadData}
          showToast={showToast}
        />
      )}

      {commissionModal !== null && (
        <CommissionModal
          commission={commissionModal === 'new' ? undefined : commissionModal}
          consultants={consultants}
          institutions={institutions}
          userId={user?.id}
          onClose={() => setCommissionModal(null)}
          onSuccess={loadData}
          showToast={showToast}
        />
      )}

    </SuperAdminLayout>
  )
}