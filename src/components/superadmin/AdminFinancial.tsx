// src/components/superadmin/AdminFinancial.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { normalizeBrazilianInput } from '../../lib/phone'
import { buildSendComponents } from '../../lib/whatsappTemplate'
import { COLLECTION_TEMPLATES, collectionTemplateAsGraphLike, type CollectionTemplateKey } from '../../lib/collectionTemplates'
import SuperAdminLayout from './SuperAdminLayout'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  DollarSign, Building2, AlertTriangle, CheckCircle2, Clock, X, RefreshCw,
  ExternalLink, AlertCircle, Send, Plus, Copy, CreditCard, Ban,
  MessageCircle, Unlock, Lock, Eye, ChevronRight, ChevronLeft,
  Users, Calendar, SlidersHorizontal, Wallet, Briefcase, ArrowUpDown,
  Edit2, Trash2, FileText,
} from 'lucide-react'

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}
function daysLate(dueDate: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate + 'T12:00:00').getTime()) / 86400000))
}
// Igual a daysLate, mas pra timestamps completos (created_at) em vez de
// colunas DATE puras — usado no alerta de nota fiscal pendente há muito tempo.
function daysSince(dateStr: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000))
}
// Quantos dias uma nota fiscal pode ficar 'pending' antes de virar alerta
// visual (mesmo padrão de destaque usado na aba Inadimplência).
const NF_ALERT_DAYS = 3

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
// Quantos meses (inclusive) se passaram entre `a` e `b` — usado só pra
// prorratear platform_costs no saldo acumulado, já que a tabela não tem
// data de início/fim própria (ver nota na aba Custos).
function monthsBetween(a: Date, b: Date) {
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1)
}
// Sentinela "desde sempre" — usado no cálculo do saldo em caixa acumulado,
// que precisa somar TUDO até o fim do período, não só o período em si.
const EPOCH = new Date(2000, 0, 1)
// Data em que o custo passou a existir de fato — effective_from se
// preenchido, senão created_at (registros antigos, cadastrados antes dessa
// coluna existir).
function costEffectiveDate(c: any): Date | null {
  if (c.effective_from) return new Date(c.effective_from + 'T12:00:00')
  if (c.created_at) return new Date(c.created_at)
  return null
}

type Tab = 'overview' | 'revenue' | 'costs' | 'commissions' | 'overdue' | 'invoices'

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

const FOLHA_TIPO_MAP: Record<string, string> = {
  funcionario:  'Funcionário',
  socio_victor: 'Retirada de sócio - Victor',
  socio_fabio:  'Retirada de sócio - Fábio',
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

const NF_STATUS_MAP: Record<string, { l: string; c: string; bg: string }> = {
  not_required: { l: 'Não exigida',  c: '#9ca3af', bg: '#f9fafb' },
  pending:      { l: 'Pendente',     c: '#d97706', bg: '#fffbeb' },
  issued:       { l: 'Emitida',      c: '#0891b2', bg: '#ecfeff' },
  sent:         { l: 'Enviada',      c: '#16a34a', bg: '#f0fdf4' },
  error:        { l: 'Erro no envio', c: '#dc2626', bg: '#fef2f2' },
  cancelled:    { l: 'Cancelada',    c: '#9ca3af', bg: '#f3f4f6' },
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
function PaymentDetailModal({ payment, onClose, onAction, onSendTemplate }: {
  payment: any; onClose: () => void; onAction: (action: string, payment: any) => Promise<void>
  onSendTemplate: (payment: any) => void
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
              {payment.asaas_charge_url && (
                <button onClick={() => onSendTemplate(payment)} disabled={loading}
                  className="flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-60">
                  <MessageCircle className="w-4 h-4" /> Enviar cobrança via WhatsApp (template)
                </button>
              )}
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
              {payment.asaas_charge_url && (
                <button onClick={() => onSendTemplate(payment)} disabled={loading}
                  className="flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-60">
                  <MessageCircle className="w-4 h-4" /> Enviar cobrança via WhatsApp (template)
                </button>
              )}
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

// ─── Modal Enviar cobrança via WhatsApp (template, número da plataforma Áion) ──
// Item 4/5 da feature de cobrança manual: NUNCA usa o número da própria
// escola (institutions.whatsapp_phone_id/whatsapp_token) — sempre o número
// conectado em platform_whatsapp (Inbox Áion). Ação síncrona, sem
// agendamento/cron — o admin clica, espera a confirmação de envio.
function SendCollectionWhatsAppModal({ payment, institution, currentUserId, currentUserName, onClose, onSent, showToast }: {
  payment: any
  institution: any
  currentUserId: string
  currentUserName?: string
  onClose: () => void
  onSent: () => void
  showToast: (m: string, ok?: boolean) => void
}) {
  const isOverdue = payment.status === 'overdue'
  const [template, setTemplate] = useState<CollectionTemplateKey>(isOverdue ? 'cobranca_em_atraso' : 'link_mensalidade')
  const [phone, setPhone] = useState(institution?.phone || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const isDefaultPhone = phone.trim() === (institution?.phone || '').trim()
  const description = payment.description || TYPE_MAP[payment.payment_type] || 'Mensalidade'
  const dueDateFmt = payment.due_date ? new Date(payment.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

  const handleSend = async () => {
    setError('')
    const normalizedPhone = normalizeBrazilianInput(phone)
    if (!normalizedPhone || normalizedPhone.length < 12) {
      setError('Telefone inválido. Digite um número de celular válido (com DDD).')
      return
    }
    if (!payment.asaas_charge_url) {
      setError('Essa cobrança não tem link de pagamento (asaas_charge_url) — não é possível enviar.')
      return
    }

    setSending(true)
    try {
      // 1. Código curto único (retry em caso de colisão — extremamente
      // improvável com 9 chars, mas é uma feature de cobrança, não custa nada).
      // Bug 2 — causa raiz: o alfabeto misturava maiúsculas/minúsculas
      // (ex: "zhXgseYcM"), e o botão de URL dinâmica do template chega
      // normalizado pra minúsculas em algum ponto do caminho até o clique
      // (app/navegador do WhatsApp) — a comparação exata em
      // api/pagar-redirect.ts então nunca batia com o código gravado.
      // Minúsculas só na origem evita a ambiguidade de vez; o lookup no
      // redirect também passou a ser case-insensitive como segunda camada
      // (cobre inclusive os códigos já enviados antes deste fix).
      const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
      const generateCode = () => {
        const bytes = crypto.getRandomValues(new Uint8Array(9))
        return Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
      }

      let codigo = generateCode()
      let insertedId: string | null = null
      let insertError: any = null
      for (let attempt = 0; attempt < 3 && !insertedId; attempt++) {
        if (attempt > 0) codigo = generateCode()
        const { data: inserted, error: err } = await supabase
          .from('manual_collection_sends')
          .insert({
            codigo,
            payment_id: payment.id,
            institution_id: payment.institution_id,
            template_used: template,
            recipient_phone: normalizedPhone,
            recipient_label: isDefaultPhone ? 'Telefone cadastrado da escola' : 'Número digitado manualmente',
            payment_link_real: payment.asaas_charge_url,
            sent_by: currentUserId,
            status: 'sent',
          })
          .select('id')
          .single()
        if (inserted) { insertedId = inserted.id }
        else { insertError = err }
      }
      if (!insertedId) throw new Error(insertError?.message || 'Falha ao gerar código de cobrança.')

      // A partir daqui a linha já existe em manual_collection_sends (status
      // default 'sent') — qualquer falha precisa marcar status='failed' +
      // error_message nela antes de propagar o erro pra UI, senão o registro
      // fica mentindo que o envio deu certo.
      try {
        // 2. Credenciais da plataforma Áion — nunca a da própria escola.
        const { data: waRow } = await supabase.from('platform_whatsapp').select('phone_number_id, waba_id').eq('connected', true).maybeSingle()
        const phoneNumberId = (waRow as any)?.phone_number_id
        const wabaId = (waRow as any)?.waba_id
        if (!phoneNumberId || !wabaId) throw new Error('WhatsApp da plataforma Áion não está conectado (platform_whatsapp).')

        const { data: tokenRow } = await supabase.from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
        const token = (tokenRow as any)?.value || ''
        if (!token) throw new Error('Token de acesso da plataforma Áion não configurado.')

        // 3. Confirma que o template está aprovado antes de tentar enviar —
        // mesmo padrão de AionInboxHub.tsx (reativar_atendimento), pra dar um
        // erro claro em vez do genérico da Meta.
        const checkRes = await fetch(
          `https://graph.facebook.com/v19.0/${wabaId}/message_templates?name=${template}&status=APPROVED`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const checkData = await checkRes.json().catch(() => null)
        if (!checkRes.ok || !checkData?.data?.length) {
          throw new Error('Template ainda não aprovado pela Meta ou nome incorreto.')
        }

        // 4. Monta o payload — body com 3 parâmetros + botão de URL dinâmica
        // com o código (não o link completo).
        const components = buildSendComponents(
          collectionTemplateAsGraphLike(template),
          { '1': institution?.name || '', '2': description, '3': dueDateFmt },
          undefined,
          codigo
        )

        // 5. Envia via /api/whatsapp/send — mesmo endpoint usado pro resto do
        // Inbox Áion (texto/mídia/template), que grava em whatsapp_messages e
        // atualiza whatsapp_conversations.last_message. Enviar direto pra
        // Graph API pulava essa gravação por completo (Bug 1, sessão
        // anterior). A busca-ou-criação da conversa (+ aion_contacts) agora
        // acontece DENTRO do endpoint, com service role — fazer esse INSERT
        // aqui, client-side, batia num 403 de RLS: a policy de INSERT de
        // whatsapp_conversations só libera institution_id =
        // current_user_institution_id(), sem a exceção is_aion_inbox que as
        // policies de SELECT/UPDATE têm (confirmado via pg_policies). Nunca
        // escrever nessa tabela direto do navegador pro caso is_aion_inbox.
        const previewText = COLLECTION_TEMPLATES[template].bodyText
          .replace('{{1}}', institution?.name || '')
          .replace('{{2}}', description)
          .replace('{{3}}', dueDateFmt)

        const sendRes = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isAionSend: true,
            to: normalizedPhone,
            type: 'template',
            templateName: template,
            templateLanguage: 'pt_BR',
            templateComponents: components,
            caption: previewText,
            sender_name: currentUserName,
            sender_user_id: currentUserId,
            newContactName: institution?.name || null,
            contactSource: 'cobranca_manual',
          }),
        })

        if (!sendRes.ok) {
          const errBody = await sendRes.json().catch(() => null)
          const metaMsg = errBody?.error as string | undefined
          const friendly = metaMsg && /template/i.test(metaMsg)
            ? 'Template ainda não aprovado pela Meta ou nome incorreto.'
            : (metaMsg || 'Erro ao enviar mensagem.')
          throw new Error(friendly)
        }
      } catch (sendErr: any) {
        const friendly = sendErr?.message || 'Erro ao enviar cobrança.'
        await supabase.from('manual_collection_sends').update({ status: 'failed', error_message: friendly }).eq('id', insertedId)
        throw sendErr
      }

      showToast(`Cobrança enviada via WhatsApp (${COLLECTION_TEMPLATES[template].label})!`)
      onSent()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Erro ao enviar cobrança.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Enviar cobrança via WhatsApp</h2>
            <p className="text-xs text-gray-400 mt-0.5">Enviado pelo número oficial da plataforma Áion</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Template</label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(COLLECTION_TEMPLATES) as CollectionTemplateKey[]).map(key => {
                const meta = COLLECTION_TEMPLATES[key]
                const disabled = meta.requiresOverdue && !isOverdue
                return (
                  <button key={key} type="button" disabled={disabled} onClick={() => setTemplate(key)}
                    className={`text-left px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                      ${template === key ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-100 text-gray-500'}
                      ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-gray-200'}`}>
                    {meta.label}
                    {disabled && <span className="block text-[11px] font-normal text-gray-400 mt-0.5">Disponível só para parcelas vencidas</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Destinatário</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(83) 99999-9999"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
            <p className="text-[11px] text-gray-400 mt-1">
              {isDefaultPhone ? 'Telefone cadastrado da escola' : 'Número digitado manualmente'} — será normalizado antes do envio.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-1.5 text-xs">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Prévia das variáveis</p>
            <div className="flex justify-between"><span className="text-gray-400">Escola</span><span className="font-semibold text-gray-800">{institution?.name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Referente a</span><span className="font-semibold text-gray-800">{description}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Vencimento</span><span className="font-semibold text-gray-800">{dueDateFmt}</span></div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={handleSend} disabled={sending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {sending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enviando...</> : <><MessageCircle className="w-4 h-4" />Enviar agora</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Marcar Nota Fiscal como gerada ──────────────────────────────────
function InvoiceIssueModal({ invoice, onClose, onSuccess, showToast }: {
  invoice: any; onClose: () => void; onSuccess: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const [form, setForm] = useState({
    invoice_number: invoice.invoice_number || '',
    invoice_series: invoice.invoice_series || '',
    invoice_url_pdf: invoice.invoice_url_pdf || '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleConfirm = async () => {
    if (!form.invoice_number.trim()) { showToast('Informe o número da nota.', false); return }
    setSaving(true)
    try {
      let pdfUrl = form.invoice_url_pdf.trim() || null

      // Upload opcional do PDF — mesmo padrão de bucket público já usado em
      // proposals (ProposalGenerator.tsx): cria o bucket se ainda não existir.
      if (file) {
        const { data: buckets } = await supabase.storage.listBuckets()
        if (!buckets?.some(b => b.name === 'invoices')) {
          await supabase.storage.createBucket('invoices', { public: true })
        }
        const path = `${invoice.institution_id}/${invoice.payment_id}.pdf`
        const { error: upErr } = await supabase.storage.from('invoices').upload(path, file, { contentType: 'application/pdf', upsert: true })
        if (upErr) throw new Error('Erro no upload do PDF: ' + upErr.message)
        const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(path)
        pdfUrl = publicUrl
      }

      const { error: updErr } = await supabase.from('payment_invoices').update({
        status: 'issued',
        invoice_number: form.invoice_number.trim(),
        invoice_series: form.invoice_series.trim() || null,
        invoice_url_pdf: pdfUrl,
        issued_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', invoice.id)
      if (updErr) throw updErr

      // Envio automático pro financeiro da escola (mesmo e-mail já usado nos
      // outros avisos financeiros — não existe campo separado de "e-mail do
      // financeiro" no schema de institutions). Falha aqui não desfaz o que
      // já foi salvo: a nota fica em 'issued' (não avança pra 'sent') e o
      // erro fica registrado em last_error pra nova tentativa manual.
      const email = invoice.institutions?.email
      if (!email) {
        showToast('Nota salva, mas a escola não tem e-mail cadastrado — envio pulado.', false)
      } else {
        try {
          const { error: mailErr } = await supabase.functions.invoke('send-email', {
            body: {
              type: 'nota_fiscal_emitida',
              to: email,
              data: {
                institution_name: invoice.institutions?.name,
                invoice_number: form.invoice_number.trim(),
                invoice_series: form.invoice_series.trim() || null,
                description: invoice.payments?.description || 'Pagamento',
                value: fmtBRL(invoice.payments?.amount || 0).replace('R$ ', ''),
                invoice_url_pdf: pdfUrl,
              },
            },
          })
          if (mailErr) throw new Error(mailErr.message)
          await supabase.from('payment_invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoice.id)
          showToast('Nota gerada e e-mail enviado pro financeiro da escola!')
        } catch (e: any) {
          await supabase.from('payment_invoices').update({ status: 'error', last_error: e?.message || 'Erro ao enviar e-mail' }).eq('id', invoice.id)
          showToast('Nota salva, mas o e-mail não foi enviado: ' + (e?.message || 'erro desconhecido'), false)
        }
      }

      onSuccess()
      onClose()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar nota fiscal.', false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{invoice.status === 'error' ? 'Reenviar nota fiscal' : 'Marcar nota como gerada'}</h2>
            <p className="text-xs text-gray-400 mt-1">{invoice.institutions?.name} · {fmtBRL(invoice.payments?.amount || 0)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Número da nota *</label>
              <input className={inp} value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="Ex: 1234" />
            </div>
            <div>
              <label className={lbl}>Série</label>
              <input className={inp} value={form.invoice_series} onChange={e => set('invoice_series', e.target.value)} placeholder="Ex: 1" />
            </div>
          </div>
          <div>
            <label className={lbl}>PDF da nota (opcional)</label>
            <input type="file" accept="application/pdf" className={inp} onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label className={lbl}>Ou link da nota (opcional)</label>
            <input className={inp} value={form.invoice_url_pdf} onChange={e => set('invoice_url_pdf', e.target.value)} placeholder="https://..." disabled={!!file} />
            <p className="text-xs text-gray-400 mt-1">Anexar um PDF acima tem prioridade sobre o link.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={handleConfirm} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Salvando...</> : <><CheckCircle2 className="w-4 h-4" />Confirmar emissão</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Custo fixo/recorrente (platform_costs) ──────────────────────────
function CostModal({ cost, onClose, onSuccess, showToast }: {
  cost?: any; onClose: () => void; onSuccess: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const isNew = !cost?.id
  const [form, setForm] = useState({
    name:           cost?.name           || '',
    amount:         String(cost?.amount || ''),
    recurrence:     cost?.recurrence     || 'monthly',
    category:       cost?.category       || 'infrastructure',
    active:         cost?.active         ?? true,
    effective_from: cost?.effective_from || (!cost?.id ? new Date().toISOString().split('T')[0] : ''),
    notes:          cost?.notes          || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.amount) { showToast('Preencha nome e valor.', false); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(), amount: Number(form.amount), recurrence: form.recurrence,
      category: form.category, active: form.active, effective_from: form.effective_from || null,
      notes: form.notes || null,
    }
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
          <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Novo custo fixo/recorrente' : 'Editar custo'}</h2>
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
            <label className={lbl}>Custo existe desde (opcional)</label>
            <input type="date" className={inp} value={form.effective_from} onChange={e => set('effective_from', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Usado no saldo em caixa acumulado e na tendência anual — não no cálculo do período atual.</p>
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

// ─── Modal Lançamento manual (financial_entries) ───────────────────────────
function FinancialEntryModal({ entry, defaultType, institutions, userId, onClose, onSuccess, showToast }: {
  entry?: any; defaultType?: 'entrada' | 'saida'; institutions: any[]; userId?: string
  onClose: () => void; onSuccess: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const isNew = !entry?.id
  const [form, setForm] = useState({
    type:           entry?.type           || defaultType || 'entrada',
    amount:         String(entry?.amount || ''),
    description:    entry?.description    || '',
    category:       entry?.category       || 'outro',
    entry_date:     entry?.entry_date     || new Date().toISOString().split('T')[0],
    institution_id: entry?.institution_id || '',
    folha_tipo:     entry?.folha_tipo     || '',
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
      folha_tipo:     form.category === 'folha' ? (form.folha_tipo || null) : null,
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
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
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
          {form.category === 'folha' && (
            <div>
              <label className={lbl}>Tipo (folha) *</label>
              <select className={inp} value={form.folha_tipo} onChange={e => set('folha_tipo', e.target.value)}>
                <option value="">Selecionar...</option>
                {Object.entries(FOLHA_TIPO_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
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

// ─── Drawer: pagamentos de uma escola (editar/excluir individual) ─────────
function SchoolPaymentsDrawer({ institution, onClose, onPaymentAction, showToast, onGlobalRefresh }: {
  institution: any; onClose: () => void
  onPaymentAction: (action: string, payment: any) => Promise<void>
  showToast: (m: string, ok?: boolean) => void
  onGlobalRefresh: () => void
}) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', due_date: '', status: 'pending' })
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('payments').select('*').eq('institution_id', institution.id).order('due_date', { ascending: true })
    setPayments(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [institution.id])

  const startEdit = (p: any) => {
    setEditingId(p.id)
    setEditForm({ amount: String(p.amount ?? ''), due_date: p.due_date || '', status: p.status || 'pending' })
  }

  const saveEdit = async (p: any) => {
    if (!editForm.amount || Number(editForm.amount) <= 0) { showToast('Valor inválido.', false); return }
    setBusyId(p.id)
    const { error } = await supabase.from('payments').update({
      amount: Number(editForm.amount),
      due_date: editForm.due_date || null,
      status: editForm.status,
    }).eq('id', p.id)
    setBusyId(null)
    if (error) { showToast('Erro ao salvar: ' + error.message, false); return }
    showToast('Pagamento atualizado!')
    setEditingId(null)
    load()
    onGlobalRefresh()
  }

  const handleDelete = async (p: any) => {
    // Excluir aqui é DELETE de verdade — não cancela a cobrança do lado do
    // Asaas. Se ainda houver uma cobrança ativa lá, avisa e oferece
    // reaproveitar a mesma ação de "Cancelar" já usada no resto do painel
    // (que só marca cancelado localmente se o Asaas confirmar).
    if (p.asaas_payment_id && p.status !== 'cancelled') {
      const cancelFirst = confirm(
        `Esta cobrança tem um ID Asaas (${p.asaas_payment_id}) e ainda não foi cancelada.\n\n` +
        `Excluir aqui NÃO cancela a cobrança no Asaas — ela continua válida e cobrável do lado de lá.\n\n` +
        `Clique OK para cancelar no Asaas primeiro (recomendado).\nClique Cancelar para excluir mesmo assim, sem cancelar.`
      )
      if (cancelFirst) {
        setBusyId(p.id)
        await onPaymentAction('cancel', p)
        setBusyId(null)
        await load()
        onGlobalRefresh()
        showToast('Cobrança tratada no Asaas — confira o status e clique em excluir de novo se ainda quiser remover o registro.')
        return
      }
    }
    if (!confirm(
      `Tem certeza que deseja EXCLUIR PERMANENTEMENTE este pagamento?\n\n` +
      `${TYPE_MAP[p.payment_type] || p.payment_type} — ${fmtBRL(p.amount)} — venc. ${p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}\n\n` +
      `Esta ação não pode ser desfeita.`
    )) return
    setBusyId(p.id)
    const { error } = await supabase.from('payments').delete().eq('id', p.id)
    setBusyId(null)
    if (error) { showToast('Erro ao excluir: ' + error.message, false); return }
    showToast('Pagamento excluído.')
    load()
    onGlobalRefresh()
  }

  const totalPaid = payments.reduce((s, p) => s + (p.status === 'paid' ? (p.amount || 0) : 0), 0)

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{institution.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{payments.length} pagamento{payments.length !== 1 ? 's' : ''} · {fmtBRL(totalPaid)} pago no total</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 mb-4">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Editar/excluir aqui altera só o registro no Áion Edu. Cobranças com ID Asaas continuam existindo lá até serem canceladas de verdade.</span>
          </div>

          {loading ? (
            <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">Nenhum pagamento cadastrado pra essa escola</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map(p => {
                const isEditing = editingId === p.id
                const st = STATUS_MAP[p.status] || STATUS_MAP.pending
                return (
                  <div key={p.id} className="border border-gray-200 rounded-xl p-4">
                    {!isEditing ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{TYPE_MAP[p.payment_type] || p.payment_type}</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: st.c, background: st.bg }}>{st.l}</span>
                          </div>
                          <p className="text-lg font-bold text-gray-800">{fmtBRL(p.amount)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Venc. {p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                            {p.paid_at && <> · Pago em {new Date(p.paid_at).toLocaleDateString('pt-BR')}</>}
                            {p.asaas_payment_id && <> · Asaas: {p.asaas_payment_id}</>}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => startEdit(p)} disabled={busyId === p.id} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg disabled:opacity-40">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(p)} disabled={busyId === p.id} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-40">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={lbl}>Valor (R$)</label>
                            <input type="number" step="0.01" className={inp} value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                          </div>
                          <div>
                            <label className={lbl}>Vencimento</label>
                            <input type="date" className={inp} value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <label className={lbl}>Status</label>
                          <select className={inp} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingId(null)} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold">Cancelar</button>
                          <button onClick={() => saveEdit(p)} disabled={busyId === p.id}
                            className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                            {busyId === p.id ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
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
  const [invoices,     setInvoices]     = useState<any[]>([])
  const [settings,     setSettings]     = useState<Record<string, string>>({})
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState<Tab>('overview')
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null)
  const [showNewCharge, setShowNewCharge] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null)
  const [templateModalPayment, setTemplateModalPayment] = useState<any | null>(null)
  const [invoiceModal, setInvoiceModal] = useState<any | null>(null)
  const [costModal, setCostModal] = useState<any | null | 'new'>(null)
  const [entryModal, setEntryModal] = useState<any | null | 'new'>(null)
  const [entryModalType, setEntryModalType] = useState<'entrada' | 'saida'>('entrada')
  const [commissionModal, setCommissionModal] = useState<any | null | 'new'>(null)
  const [revenueSortAsc, setRevenueSortAsc] = useState(false)
  const [schoolDrawer, setSchoolDrawer] = useState<any | null>(null)

  // ── Período (default: mês corrente) — compartilhado por Visão Geral,
  // Receitas, Custos e Comissões. Inadimplência nunca é filtrada por ele.
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
    const [instRes, payRes, cfgRes, costRes, entryRes, commRes, consRes, invRes] = await Promise.all([
      supabase.from('institutions').select('id, name, city, plan, plan_status, asaas_customer_id, monthly_value, email, cnpj, phone').order('name'),
      supabase.from('payments').select('*, institutions(name)').order('created_at', { ascending: false }),
      supabase.from('platform_settings').select('key, value'),
      supabase.from('platform_costs').select('*').order('name'),
      supabase.from('financial_entries').select('*, institutions(name)').order('entry_date', { ascending: false }),
      supabase.from('consultant_commissions').select('*, institutions(name)').order('created_at', { ascending: false }),
      supabase.from('users').select('id, full_name').eq('user_type', 'consultant').order('full_name'),
      supabase.from('payment_invoices').select('*, payments(amount, description, payment_type, paid_at, due_date), institutions(name, email)').order('created_at', { ascending: false }),
    ])
    if (cancelledRef.current) return
    setInstitutions(instRes.data || [])
    setPayments(payRes.data || [])
    setCosts(costRes.data || [])
    setEntries(entryRes.data || [])
    setCommissions(commRes.data || [])
    setConsultants(consRes.data || [])
    setInvoices(invRes.data || [])
    const cfg: Record<string, string> = {}
    for (const s of cfgRes.data || []) cfg[s.key] = s.value
    setSettings(cfg)
    setLoading(false)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CÁLCULOS — tudo em cima dos arrays já carregados por inteiro (sem
  // refiltrar no backend), usando `inPeriod` pro período selecionado e um
  // período "desde sempre" (EPOCH) pro saldo acumulado.
  // ═══════════════════════════════════════════════════════════════════════
  const now = new Date()

  const paymentsPaidPeriod = payments.filter(p => p.status === 'paid' && inPeriod(p.paid_at, period))
  const manualEntradasPeriod = entries.filter(e => e.type === 'entrada' && inPeriod(e.entry_date, period))
  const manualSaidasPeriod   = entries.filter(e => e.type === 'saida'   && inPeriod(e.entry_date, period))
  const folhaPeriodo = entries.filter(e => e.type === 'saida' && e.category === 'folha' && inPeriod(e.entry_date, period))
    .reduce((s, e) => s + (e.amount || 0), 0)

  const commissionsInPeriod = commissions.filter(c => c.status !== 'cancelada' && inPeriod(c.payment_date || c.created_at, period))
  const commissionsPending  = commissionsInPeriod.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.amount || 0), 0)
  const commissionsPaid     = commissionsInPeriod.filter(c => c.status === 'paga').reduce((s, c) => s + (c.amount || 0), 0)
  const commissionsTotal    = commissionsPending + commissionsPaid

  const activeCosts = costs.filter(c => c.active)
  const platformCostsMonthly = activeCosts.reduce((s, c) => {
    if (c.recurrence === 'monthly') return s + (c.amount || 0)
    if (c.recurrence === 'yearly')  return s + (c.amount || 0) / 12
    return s
  }, 0)

  const receitaPeriodo = paymentsPaidPeriod.reduce((s, p) => s + (p.amount || 0), 0)
    + manualEntradasPeriod.reduce((s, e) => s + (e.amount || 0), 0)
  const custosPeriodo = platformCostsMonthly
    + manualSaidasPeriod.reduce((s, e) => s + (e.amount || 0), 0)
    + commissionsTotal
  const lucroPeriodo  = receitaPeriodo - custosPeriodo
  const margemPeriodo = receitaPeriodo > 0 ? Math.round((lucroPeriodo / receitaPeriodo) * 100) : 0

  const mrrProjected = institutions.filter(i => i.plan_status === 'active' && i.plan !== 'gratuito').reduce((s, i) => s + (i.monthly_value || 550), 0)
  const overdueList  = payments.filter(p => p.status === 'overdue')
  const overdueTotal = overdueList.reduce((s, p) => s + (p.amount || 0), 0)
  const pendingTotal = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0)
  const churnCount   = institutions.filter(i => ['cancelled', 'suspended'].includes(i.plan_status)).length

  // ── Saldo em caixa acumulado: tudo desde o início até o FIM do período
  // selecionado (não é "do período", é histórico acumulado). platform_costs
  // é prorrateado por effective_from de cada custo (fallback created_at pra
  // registros antigos) até o fim do período — ver campo "Custo existe desde"
  // no modal de custo.
  const sinceStart: Period = { start: EPOCH, end: period.end }
  const receitaAcumulada =
    payments.filter(p => p.status === 'paid' && inPeriod(p.paid_at, sinceStart)).reduce((s, p) => s + (p.amount || 0), 0)
    + entries.filter(e => e.type === 'entrada' && inPeriod(e.entry_date, sinceStart)).reduce((s, e) => s + (e.amount || 0), 0)
  const saidasAcumuladas = entries.filter(e => e.type === 'saida' && inPeriod(e.entry_date, sinceStart)).reduce((s, e) => s + (e.amount || 0), 0)
  const comissoesAcumuladas = commissions.filter(c => c.status !== 'cancelada' && inPeriod(c.payment_date || c.created_at, sinceStart)).reduce((s, c) => s + (c.amount || 0), 0)
  const custosFixosAcumulados = activeCosts.reduce((s, c) => {
    const effective = costEffectiveDate(c)
    if (!effective) return s
    if (effective > period.end) return s
    const months = monthsBetween(effective, period.end)
    if (c.recurrence === 'monthly') return s + (c.amount || 0) * months
    if (c.recurrence === 'yearly')  return s + ((c.amount || 0) / 12) * months
    return s + (c.amount || 0) // one_time: conta uma vez só
  }, 0)
  const saldoCaixa = receitaAcumulada - saidasAcumuladas - comissoesAcumuladas - custosFixosAcumulados

  // ── Tendência anual — SEMPRE últimos 12 meses corridos, independente do
  // `period`. Cada custo fixo só entra a partir do mês do seu effective_from
  // (fallback created_at) — antes disso, é como se ainda não existisse.
  const yearlyTrend = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const monthPeriod: Period = { start: d, end: endOfMonth(d) }
    const receita = payments.filter(p => p.status === 'paid' && inPeriod(p.paid_at, monthPeriod)).reduce((s, p) => s + (p.amount || 0), 0)
      + entries.filter(e => e.type === 'entrada' && inPeriod(e.entry_date, monthPeriod)).reduce((s, e) => s + (e.amount || 0), 0)
    const platformCostsThisMonth = activeCosts.reduce((s, c) => {
      const effective = costEffectiveDate(c)
      if (!effective || effective > monthPeriod.end) return s
      if (c.recurrence === 'monthly') return s + (c.amount || 0)
      if (c.recurrence === 'yearly')  return s + (c.amount || 0) / 12
      return s
    }, 0)
    const custo = platformCostsThisMonth
      + entries.filter(e => e.type === 'saida' && inPeriod(e.entry_date, monthPeriod)).reduce((s, e) => s + (e.amount || 0), 0)
      + commissions.filter(c => c.status !== 'cancelada' && inPeriod(c.payment_date || c.created_at, monthPeriod)).reduce((s, c) => s + (c.amount || 0), 0)
    const margem = receita > 0 ? Math.round(((receita - custo) / receita) * 100) : 0
    return { month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), receita, custo, margem }
  })

  // ── Composição de custos do período selecionado ──
  const platformFixedPeriod    = activeCosts.filter(c => c.nature === 'custo_fixo').reduce((s, c) => s + (c.recurrence === 'monthly' ? (c.amount || 0) : c.recurrence === 'yearly' ? (c.amount || 0) / 12 : 0), 0)
  const platformVariablePeriod = activeCosts.filter(c => c.nature !== 'custo_fixo').reduce((s, c) => s + (c.recurrence === 'monthly' ? (c.amount || 0) : c.recurrence === 'yearly' ? (c.amount || 0) / 12 : 0), 0)
  const entriesFixedPeriod    = manualSaidasPeriod.filter(e => e.category !== 'folha' && e.nature === 'custo_fixo').reduce((s, e) => s + (e.amount || 0), 0)
  const entriesVariablePeriod = manualSaidasPeriod.filter(e => e.category !== 'folha' && e.nature !== 'custo_fixo').reduce((s, e) => s + (e.amount || 0), 0)
  const costComposition = [
    { name: 'Custo fixo',     value: platformFixedPeriod + entriesFixedPeriod,       color: '#0891B2' },
    { name: 'Custo variável', value: platformVariablePeriod + entriesVariablePeriod, color: '#D97706' },
    { name: 'Folha/pessoal',  value: folhaPeriodo,                                    color: '#7C3AED' },
    { name: 'Comissões',      value: commissionsTotal,                                color: '#DC2626' },
  ].filter(c => c.value > 0)

  // ── Receitas: lista unificada payments (pagos) + financial_entries (entrada) ──
  const revenueRows = [
    ...paymentsPaidPeriod.map(p => ({
      id: 'p-' + p.id, source: 'payment' as const, date: p.paid_at,
      description: TYPE_MAP[p.payment_type] || p.payment_type || 'Pagamento',
      amount: p.amount, institutionName: (p as any).institutions?.name, raw: p,
    })),
    ...manualEntradasPeriod.map(e => ({
      id: 'e-' + e.id, source: 'entry' as const, date: e.entry_date,
      description: e.description, amount: e.amount, institutionName: (e as any).institutions?.name, raw: e,
    })),
  ].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
    return revenueSortAsc ? diff : -diff
  })

  // ── Custos: lista unificada platform_costs (todos) + financial_entries (saída, no período) ──
  const costRows = [
    ...costs.map(c => ({
      id: 'c-' + c.id, source: 'platform' as const, name: c.name, amount: c.amount,
      category: c.category, recurrence: c.recurrence, active: c.active, folhaTipo: undefined as string | undefined, raw: c,
    })),
    ...manualSaidasPeriod.map(e => ({
      id: 'e-' + e.id, source: 'entry' as const, name: e.description, amount: e.amount,
      category: e.category, recurrence: undefined as string | undefined, active: undefined as boolean | undefined,
      folhaTipo: e.folha_tipo as string | undefined, raw: e,
    })),
  ]

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
              value: fmtBRL(payment.amount).replace('R$ ', ''),
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

  // ── Nota Fiscal — não filtrado por período (mesma lógica de "situação atual" da Inadimplência) ──
  const nfPending = invoices.filter(i => i.status === 'pending')
  const nfLateCount = nfPending.filter(i => daysSince(i.created_at) >= NF_ALERT_DAYS).length

  const openNewEntry = (type: 'entrada' | 'saida') => { setEntryModalType(type); setEntryModal('new') }

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
            <p className="text-sm text-gray-500 mt-1">Receita, custos, comissões e inadimplência</p>
          </div>
          <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
            <RefreshCw className="w-4 h-4" />
          </button>
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'overview'    as Tab, label: 'Visão Geral' },
            { id: 'revenue'     as Tab, label: `Receitas (${revenueRows.length})` },
            { id: 'costs'       as Tab, label: `Custos (${costRows.length})` },
            { id: 'commissions' as Tab, label: `Comissões (${commissionsInPeriod.length})` },
            { id: 'overdue'     as Tab, label: `Inadimplência${overdueGroups.length > 0 ? ` (${overdueGroups.length})` : ''}`, alert: overdueGroups.length > 0 },
            { id: 'invoices'    as Tab, label: `Nota Fiscal${nfPending.length > 0 ? ` (${nfPending.length})` : ''}`, alert: nfLateCount > 0 },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
                ${tab === t.id ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t.label}
              {(t as any).alert && <span className="w-2 h-2 rounded-full bg-red-500" />}
            </button>
          ))}
        </div>

        {/* ══════════════════════════ TAB: Visão Geral ══════════════════════════ */}
        {tab === 'overview' && (
          <div className="space-y-6">

            {/* Texto dinâmico */}
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-100 rounded-2xl p-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                Em <strong className="capitalize">{periodLabel}</strong>, a Áion faturou <strong>{fmtBRL(receitaPeriodo)}</strong>,
                {' '}teve custos de <strong>{fmtBRL(custosPeriodo)}</strong> (incluindo {fmtBRL(commissionsTotal)} em comissões),
                {' '}resultando em margem de <strong>{margemPeriodo}%</strong>. O saldo em caixa acumulado é{' '}
                <strong className={saldoCaixa >= 0 ? 'text-green-700' : 'text-red-700'}>{fmtBRL(saldoCaixa)}</strong>.
              </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Receita do período', value: fmtBRL(receitaPeriodo), sub: `Projeção recorrente: ${fmtBRL(mrrProjected)}`, icon: DollarSign, grad: 'from-green-500 to-emerald-600' },
                { label: 'Custos do período',   value: fmtBRL(custosPeriodo),  sub: 'fixos + variáveis + comissões',            icon: AlertTriangle, grad: 'from-red-500 to-rose-600' },
                { label: 'Comissões do período', value: fmtBRL(commissionsTotal), sub: `${fmtBRL(commissionsPending)} pendente · ${fmtBRL(commissionsPaid)} paga`, icon: Users, grad: 'from-purple-500 to-fuchsia-600' },
                { label: 'Saldo em caixa acumulado', value: fmtBRL(saldoCaixa), sub: 'histórico até o fim do período', icon: Wallet, grad: saldoCaixa >= 0 ? 'from-cyan-500 to-blue-600' : 'from-red-500 to-rose-600' },
                { label: 'Margem',  value: `${margemPeriodo}%`, sub: `${fmtBRL(lucroPeriodo)} de lucro no período`, icon: CheckCircle2, grad: margemPeriodo >= 0 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600' },
                { label: 'Inadimplência atual', value: fmtBRL(overdueTotal), sub: `${overdueList.length} cobranças em atraso (não filtrado por período)`, icon: AlertCircle, grad: overdueTotal > 0 ? 'from-amber-500 to-orange-500' : 'from-gray-400 to-gray-500' },
                { label: 'Notas fiscais pendentes', value: String(nfPending.length), sub: nfLateCount > 0 ? `${nfLateCount} há mais de ${NF_ALERT_DAYS} dias sem gerar` : nfPending.length > 0 ? 'Dentro do prazo' : 'Nenhuma pendência', icon: FileText, grad: nfLateCount > 0 ? 'from-red-500 to-rose-600' : nfPending.length > 0 ? 'from-amber-500 to-orange-500' : 'from-gray-400 to-gray-500' },
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

            {/* Tendência anual (12 meses corridos, independente do período selecionado) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-bold text-gray-900 mb-1">Tendência — últimos 12 meses</h2>
              <p className="text-xs text-gray-400 mb-5">Receita vs. custo vs. margem — não é afetada pelo período selecionado acima</p>
              {loading ? <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
                : <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={yearlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v, name) => name === 'Margem' ? [`${v}%`, name] : [fmtBRL(Number(v)), name]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line yAxisId="left" type="monotone" dataKey="receita" name="Receita" stroke="#16a34a" strokeWidth={3} dot={{ fill: '#16a34a', r: 3 }} />
                      <Line yAxisId="left" type="monotone" dataKey="custo" name="Custo" stroke="#dc2626" strokeWidth={3} dot={{ fill: '#dc2626', r: 3 }} />
                      <Line yAxisId="right" type="monotone" dataKey="margem" name="Margem" stroke="#0891b2" strokeWidth={2} strokeDasharray="4 3" dot={{ fill: '#0891b2', r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
              }
            </div>

            {/* Composição de custos do período */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-bold text-gray-900 mb-1">Composição de custos</h2>
              <p className="text-xs text-gray-400 mb-5 capitalize">{periodLabel}</p>
              {loading ? <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
                : costComposition.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-sm">Nenhum custo no período selecionado</div>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <ResponsiveContainer width="100%" height={240} className="max-w-[280px]">
                      <PieChart>
                        <Pie data={costComposition} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                          {costComposition.map((c, i) => <Cell key={i} fill={c.color} />)}
                        </Pie>
                        <Tooltip formatter={v => fmtBRL(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 w-full space-y-2">
                      {costComposition.map(c => (
                        <div key={c.name} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                          <span className="flex items-center gap-2 text-gray-600"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />{c.name}</span>
                          <span className="font-semibold text-gray-900">{fmtBRL(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
            </div>

            {/* Escolas por situação financeira */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-gray-900">Escolas por situação financeira</h2>
                <span className="text-xs text-gray-400">{churnCount} churn</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Escola', 'Plano', 'Status', 'MRR', 'Asaas', 'Ações'].map(h => (
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
                        <tr key={i.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSchoolDrawer(i)}>
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
                          <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
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

        {/* ══════════════════════════ TAB: Receitas ══════════════════════════ */}
        {tab === 'revenue' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-gray-500 capitalize">{periodLabel} — {fmtBRL(receitaPeriodo)} no total</p>
              <div className="flex gap-2">
                <button onClick={() => openNewEntry('entrada')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50">
                  <Plus className="w-4 h-4" /> Lançamento manual
                </button>
                <button onClick={() => setShowNewCharge(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                  <CreditCard className="w-4 h-4" /> Nova cobrança
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {loading ? <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />)}</div>
                : revenueRows.length === 0
                ? <div className="p-12 text-center text-gray-400">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">Nenhuma receita no período selecionado</p>
                  </div>
                : <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            <button onClick={() => setRevenueSortAsc(v => !v)} className="flex items-center gap-1 hover:text-gray-700">
                              Data <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </th>
                          {['Descrição', 'Escola', 'Origem', 'Valor', ''].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {revenueRows.map(r => (
                          <tr key={r.id} className={`hover:bg-gray-50 ${r.source === 'payment' ? 'cursor-pointer' : ''}`}
                            onClick={() => r.source === 'payment' && setSelectedPayment(r.raw)}>
                            <td className="px-5 py-3 text-sm text-gray-500">{r.date ? new Date(r.date.length === 10 ? r.date + 'T12:00:00' : r.date).toLocaleDateString('pt-BR') : '—'}</td>
                            <td className="px-5 py-3 font-medium text-gray-900 text-sm">{r.description}</td>
                            <td className="px-5 py-3 text-sm text-gray-500">{r.institutionName || '—'}</td>
                            <td className="px-5 py-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.source === 'payment' ? 'bg-cyan-100 text-cyan-700' : 'bg-purple-100 text-purple-700'}`}>
                                {r.source === 'payment' ? 'Automático - Asaas' : 'Manual'}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-bold text-green-700 text-sm">+{fmtBRL(r.amount)}</td>
                            <td className="px-5 py-3">
                              {r.source === 'entry' && (
                                <div className="flex gap-1">
                                  <button onClick={e => { e.stopPropagation(); setEntryModal(r.raw) }} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={async e => {
                                    e.stopPropagation()
                                    if (!confirm(`Excluir lançamento "${r.description}"?`)) return
                                    await supabase.from('financial_entries').delete().eq('id', r.raw.id)
                                    showToast('Lançamento excluído.'); loadData()
                                  }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          </div>
        )}

        {/* ══════════════════════════ TAB: Custos ══════════════════════════ */}
        {tab === 'costs' && (
          <div className="space-y-6">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Custos fixos/recorrentes (tabela abaixo) refletem a configuração <strong>atual</strong> — sem data de início/fim, não variam com o período selecionado. Só as saídas manuais respeitam o período.</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Custos/mês (recorrente)', value: fmtBRL(platformCostsMonthly), sub: 'custos fixos ativos', grad: 'from-red-500 to-rose-600', icon: DollarSign },
                { label: 'Saídas manuais (período)', value: fmtBRL(manualSaidasPeriod.reduce((s, e) => s + (e.amount || 0), 0)), sub: 'lançamentos avulsos', grad: 'from-orange-500 to-red-500', icon: AlertTriangle },
                { label: 'Custo com pessoal', value: fmtBRL(folhaPeriodo), sub: 'categoria "folha" no período', grad: 'from-purple-500 to-fuchsia-600', icon: Briefcase },
                { label: 'Custos do período (total)', value: fmtBRL(custosPeriodo), sub: 'fixos + variáveis + comissões', grad: 'from-gray-600 to-gray-800', icon: Wallet },
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

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-bold text-gray-900">Custos operacionais</h2>
                <div className="flex gap-2">
                  <button onClick={() => openNewEntry('saida')}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50">
                    <Plus className="w-4 h-4" /> Saída manual
                  </button>
                  <button onClick={() => setCostModal('new')}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                    <Plus className="w-4 h-4" /> Custo fixo
                  </button>
                </div>
              </div>
              {costRows.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">Nenhum custo cadastrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {['Nome', 'Valor', 'Categoria', 'Origem', 'Status', 'Ações'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {costRows.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3">
                            <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                            {c.folhaTipo && <p className="text-xs text-gray-400 mt-0.5">{FOLHA_TIPO_MAP[c.folhaTipo] || c.folhaTipo}</p>}
                          </td>
                          <td className="px-5 py-3 font-bold text-gray-800 text-sm">{fmtBRL(c.amount)}</td>
                          <td className="px-5 py-3 text-sm text-gray-500">{ENTRY_CATEGORY_MAP[c.category] || c.category}</td>
                          <td className="px-5 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.source === 'platform' ? 'bg-cyan-100 text-cyan-700' : 'bg-purple-100 text-purple-700'}`}>
                              {c.source === 'platform' ? (c.recurrence === 'monthly' ? 'Fixo mensal' : c.recurrence === 'yearly' ? 'Fixo anual' : 'Avulso') : 'Manual'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {c.source === 'platform' ? (
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                {c.active ? 'Ativo' : 'Inativo'}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => c.source === 'platform' ? setCostModal(c.raw) : setEntryModal(c.raw)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={async () => {
                                if (!confirm(`Excluir "${c.name}"?`)) return
                                if (c.source === 'platform') await supabase.from('platform_costs').delete().eq('id', c.raw.id)
                                else await supabase.from('financial_entries').delete().eq('id', c.raw.id)
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
        )}

        {/* ══════════════════════════ TAB: Comissões ══════════════════════════ */}
        {tab === 'commissions' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-bold text-gray-900">Comissões de consultor</h2>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{periodLabel} — {fmtBRL(commissionsPending)} pendente · {fmtBRL(commissionsPaid)} paga</p>
              </div>
              <button onClick={() => setCommissionModal('new')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                <Plus className="w-4 h-4" /> Nova comissão
              </button>
            </div>
            {commissionsInPeriod.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Nenhuma comissão no período selecionado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Consultor', 'Escola', 'Tipo', 'Valor', 'Status', 'Pagamento', 'Ações'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {commissionsInPeriod.map(c => {
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

        {/* ══════════════════════════ TAB: Inadimplência ══════════════════════════ */}
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
                            <div className="flex items-center gap-2">
                              {p.asaas_charge_url && (
                                <button onClick={() => setTemplateModalPayment(p)} title="Enviar cobrança via WhatsApp"
                                  className="text-teal-500 hover:text-teal-700">
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => setSelectedPayment(p)} className="text-gray-400 hover:text-gray-600">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

        {/* ══════════════════════════ TAB: Nota Fiscal ══════════════════════════ */}
        {tab === 'invoices' && (
          <div className="space-y-4">
            <div className={`border rounded-2xl p-5 flex items-center gap-3 ${nfLateCount > 0 ? 'bg-red-50 border-red-200' : nfPending.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
              <FileText className={`w-8 h-8 flex-shrink-0 ${nfLateCount > 0 ? 'text-red-500' : nfPending.length > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
              <div>
                <p className={`font-bold ${nfLateCount > 0 ? 'text-red-800' : 'text-gray-900'}`}>
                  {nfPending.length} nota{nfPending.length !== 1 ? 's' : ''} pendente{nfPending.length !== 1 ? 's' : ''} de emissão
                </p>
                <p className={`text-sm ${nfLateCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {nfLateCount > 0
                    ? `${nfLateCount} há mais de ${NF_ALERT_DAYS} dias sem gerar`
                    : nfPending.length > 0 ? 'Todas dentro do prazo' : 'Nenhuma pendência — tudo em dia'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Notas fiscais</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Controle manual (Fase 1) — a linha nasce sozinha quando um pagamento é confirmado (ou, pra escolas que emitem nota antes do pagamento, alguns dias antes do vencimento da cobrança). Número, PDF/link e envio pro financeiro da escola são preenchidos aqui.
                </p>
              </div>
              {loading ? (
                <div className="p-6 space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />)}</div>
              ) : invoices.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">Nenhuma nota fiscal ainda</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {['Escola', 'Referente a', 'Valor', 'Data do pagamento', 'Emissão', 'Status', 'Ações'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {invoices.map(inv => {
                        const st = NF_STATUS_MAP[inv.status] || NF_STATUS_MAP.pending
                        const late = inv.status === 'pending' && daysSince(inv.created_at) >= NF_ALERT_DAYS
                        return (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-semibold text-gray-900 text-sm">{inv.institutions?.name || '—'}</td>
                            <td className="px-5 py-3 text-sm text-gray-500">{inv.payments?.description || TYPE_MAP[inv.payments?.payment_type] || '—'}</td>
                            <td className="px-5 py-3 font-bold text-gray-800 text-sm">{fmtBRL(inv.payments?.amount || 0)}</td>
                            <td className="px-5 py-3 text-sm text-gray-500">{inv.payments?.paid_at ? new Date(inv.payments.paid_at).toLocaleDateString('pt-BR') : '—'}</td>
                            <td className="px-5 py-3 text-xs text-gray-500">{inv.issue_timing === 'before_payment' ? 'Antes do pgto' : 'Depois do pgto'}</td>
                            <td className="px-5 py-3">
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: st.c, background: st.bg }}>{st.l}</span>
                              {late && <span className="ml-2 text-[10px] font-bold text-red-600">{daysSince(inv.created_at)}d</span>}
                            </td>
                            <td className="px-5 py-3">
                              {inv.status === 'pending' ? (
                                <button onClick={() => setInvoiceModal(inv)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-xs font-semibold whitespace-nowrap">
                                  <FileText className="w-3.5 h-3.5" /> Marcar como gerada
                                </button>
                              ) : inv.status === 'error' ? (
                                <button onClick={() => setInvoiceModal(inv)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold whitespace-nowrap">
                                  <Send className="w-3.5 h-3.5" /> Tentar reenviar
                                </button>
                              ) : inv.invoice_url_pdf ? (
                                <a href={inv.invoice_url_pdf} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-cyan-600 text-xs font-semibold whitespace-nowrap">
                                  <ExternalLink className="w-3.5 h-3.5" /> Ver PDF
                                </a>
                              ) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
          onSendTemplate={p => { setSelectedPayment(null); setTemplateModalPayment(p) }}
        />
      )}

      {templateModalPayment && (
        <SendCollectionWhatsAppModal
          payment={templateModalPayment}
          institution={institutions.find(i => i.id === templateModalPayment.institution_id)}
          currentUserId={user!.id}
          currentUserName={user!.full_name}
          onClose={() => setTemplateModalPayment(null)}
          onSent={loadData}
          showToast={showToast}
        />
      )}

      {invoiceModal && (
        <InvoiceIssueModal
          invoice={invoiceModal}
          onClose={() => setInvoiceModal(null)}
          onSuccess={loadData}
          showToast={showToast}
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
          defaultType={entryModalType}
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

      {schoolDrawer && (
        <SchoolPaymentsDrawer
          institution={schoolDrawer}
          onClose={() => setSchoolDrawer(null)}
          onPaymentAction={handlePaymentAction}
          showToast={showToast}
          onGlobalRefresh={loadData}
        />
      )}

    </SuperAdminLayout>
  )
}
