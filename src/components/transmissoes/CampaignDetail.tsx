// Detalhe de uma campanha de Transmissões: números, cliques por botão,
// falhas por motivo, cobrança e ações (precificar, pagar, pausar, retomar,
// cancelar). Leitura direto pela RLS; ações via broadcast-campaigns /
// asaas-create-charge.
import React, { useEffect, useState } from 'react'
import { Send, CheckCheck, Eye, MessageCircle, XCircle, Users, Pause, Play, Ban, CreditCard, ExternalLink, RefreshCw, Calculator } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  CAMPAIGN_STATUS, PAUSED_REASON, FAILURE_KIND, CATEGORY_LABEL, brl, broadcastAction, chargeCampaign, type Campaign,
} from '../../lib/broadcasts'
import { Badge, Btn, ErrorBox, KpiCard, Modal, labelStyle } from './ui'

interface RecipientRow {
  id: string; phone: string; status: string; failure_kind: string | null; error_message: string | null
  sent_at: string | null; first_reply_at: string | null; clicked_button_index: number | null
  whatsapp_contacts: { name: string | null } | null
}

const RECIPIENT_STATUS: Record<string, string> = {
  pending: 'Na fila', sending: 'Enviando', sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Falhou', skipped: 'Não enviada',
}

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const pct = (n: number, d: number) => d > 0 ? `${Math.round((n / d) * 100)}%` : '—'

// readOnly: visão do Super Admin (InstitutionBroadcastTab) — ele lê pela RLS,
// mas as ações (precificar, pagar, pausar…) são da escola (permissão
// 'transmissoes'), então os botões nem aparecem.
export default function CampaignDetail({ campaignId, onClose, onChanged, readOnly = false }: { campaignId: string; onClose: () => void; onChanged: () => void; readOnly?: boolean }) {
  const [c, setC] = useState<Campaign | null>(null)
  const [payment, setPayment] = useState<{ status: string; asaas_charge_url: string | null; amount: number } | null>(null)
  const [buttons, setButtons] = useState<{ index: number; text: string; clicks: number }[]>([])
  const [failures, setFailures] = useState<{ kind: string; count: number }[]>([])
  const [recipients, setRecipients] = useState<RecipientRow[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('broadcast_campaigns').select('*').eq('id', campaignId).maybeSingle()
    const camp = data as Campaign | null
    setC(camp)
    if (!camp) return
    const [payRes, defRes] = await Promise.all([
      camp.payment_id ? supabase.from('payments').select('status, asaas_charge_url, amount').eq('id', camp.payment_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('template_definitions').select('buttons').eq('id', camp.template_definition_id).maybeSingle(),
    ])
    setPayment((payRes as any).data || null)

    const btns = (((defRes as any).data?.buttons || []) as { type: string; text: string }[])
      .map((b, i) => ({ ...b, i })).filter(b => (b.type || '').toUpperCase() === 'QUICK_REPLY')
    const counts = await Promise.all(btns.map(b => supabase.from('broadcast_recipients').select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId).eq('clicked_button_index', b.i)))
    setButtons(btns.map((b, k) => ({ index: b.i, text: b.text, clicks: counts[k].count || 0 })))

    const kinds = Object.keys(FAILURE_KIND)
    const fc = await Promise.all(kinds.map(k => supabase.from('broadcast_recipients').select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId).eq('failure_kind', k)))
    setFailures(kinds.map((k, i) => ({ kind: k, count: fc[i].count || 0 })).filter(f => f.count > 0))
  }

  async function loadRecipients() {
    let q = supabase.from('broadcast_recipients')
      .select('id, phone, status, failure_kind, error_message, sent_at, first_reply_at, clicked_button_index, whatsapp_contacts(name)')
      .eq('campaign_id', campaignId).order('created_at').limit(200)
    if (statusFilter === 'replied') q = q.not('first_reply_at', 'is', null)
    else if (statusFilter) q = q.eq('status', statusFilter)
    const { data } = await q
    setRecipients((data || []) as any)
  }

  useEffect(() => { load() }, [campaignId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadRecipients() }, [campaignId, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label); setError(null)
    try { await fn(); await load(); await loadRecipients(); onChanged() } catch (e: any) { setError(e.message) }
    setBusy(null)
  }

  if (!c) return <Modal title="Campanha" onClose={onClose}><div style={{ height: 160, borderRadius: 12, background: '#f8fafc' }} className="animate-pulse" /></Modal>

  const st = CAMPAIGN_STATUS[c.status]
  const canPay = c.status === 'pending_payment' && !c.paid_at && Number(c.total_charged_brl) > 0
  const payLink = payment && ['pending', 'overdue'].includes(payment.status) ? payment.asaas_charge_url : null

  return (
    <Modal wide title={c.name} onClose={onClose}
      footer={readOnly ? <Btn variant="ghost" onClick={() => run('refresh', async () => {})} loading={busy === 'refresh'}><RefreshCw size={14} /> Atualizar</Btn> : <>
        <Btn variant="ghost" onClick={() => run('refresh', async () => {})} loading={busy === 'refresh'}><RefreshCw size={14} /> Atualizar</Btn>
        {c.status === 'draft' && <Btn loading={busy === 'price'} onClick={() => run('price', () => broadcastAction('price', { campaign_id: c.id }))}><Calculator size={14} /> Calcular valor e liberar</Btn>}
        {canPay && (payLink
          ? <a href={payLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, background: '#00A896', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}><ExternalLink size={14} /> Pagar {brl(c.total_charged_brl)}</a>
          : <Btn loading={busy === 'charge'} onClick={() => run('charge', async () => { const r = await chargeCampaign(c.id); window.open(r.paymentLink, '_blank') })}><CreditCard size={14} /> Gerar cobrança</Btn>)}
        {['scheduled', 'sending'].includes(c.status) && <Btn variant="secondary" loading={busy === 'pause'} onClick={() => run('pause', () => broadcastAction('pause', { campaign_id: c.id }))}><Pause size={14} /> Pausar</Btn>}
        {c.status === 'paused' && <Btn loading={busy === 'resume'} onClick={() => run('resume', () => broadcastAction('resume', { campaign_id: c.id }))}><Play size={14} /> Retomar</Btn>}
        {!['completed', 'cancelled'].includes(c.status) && <Btn variant="danger" loading={busy === 'cancel'} onClick={() => {
          if (!confirm(c.paid_at ? 'Cancelar a campanha? O que ainda não foi enviado vira crédito pra próxima.' : 'Cancelar a campanha? A cobrança em aberto é cancelada.')) return
          run('cancel', () => broadcastAction('cancel', { campaign_id: c.id }))
        }}><Ban size={14} /> Cancelar</Btn>}
      </>}>
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge label={st.label} color={st.color} bg={st.bg} />
          {c.status === 'paused' && c.paused_reason && <span style={{ fontSize: 12, color: '#C2410C' }}>{PAUSED_REASON[c.paused_reason] || c.paused_reason}</span>}
          {c.status === 'scheduled' && <span style={{ fontSize: 12, color: '#1D4ED8' }}>Envio em {fmtDate(c.scheduled_at)}</span>}
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Template {c.template_name} · criada em {fmtDate(c.created_at)}</span>
        </div>
        <ErrorBox message={error} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <KpiCard label="Destinatários" value={c.total_recipients.toLocaleString('pt-BR')} icon={<Users size={16} color="#1e2d6b" />} bg="#E0E7FF" />
          <KpiCard label="Enviadas" value={c.sent_count.toLocaleString('pt-BR')} hint={pct(c.sent_count, c.total_recipients)} icon={<Send size={16} color="#047857" />} bg="#D1FAE5" />
          <KpiCard label="Entregues" value={c.delivered_count.toLocaleString('pt-BR')} hint={pct(c.delivered_count, c.sent_count)} icon={<CheckCheck size={16} color="#0284C7" />} bg="#E0F2FE" />
          <KpiCard label="Lidas" value={c.read_count.toLocaleString('pt-BR')} hint={pct(c.read_count, c.delivered_count)} icon={<Eye size={16} color="#7C3AED" />} bg="#EDE9FE" />
          <KpiCard label="Responderam" value={c.replied_count.toLocaleString('pt-BR')} hint={pct(c.replied_count, c.delivered_count)} icon={<MessageCircle size={16} color="#DB2777" />} bg="#FCE7F3" />
          <KpiCard label="Falhas" value={c.failed_count.toLocaleString('pt-BR')} icon={<XCircle size={16} color="#DC2626" />} bg="#FEE2E2" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
            <label style={labelStyle}>Custo</label>
            {c.priced_at ? (
              <div style={{ display: 'grid', gap: 4, fontSize: 13, color: '#475569' }}>
                <div>{c.priced_recipients} mensagens · {CATEGORY_LABEL[c.priced_category || ''] || c.priced_category} · {brl(Number(c.unit_fee_brl) + (c.priced_own_account ? 0 : Number(c.unit_meta_cost_brl || 0)))}/msg{c.priced_own_account ? ' (conta própria na Meta: só a taxa)' : ''}</div>
                <div>Subtotal {brl(c.subtotal_brl)}{Number(c.credit_applied_brl) > 0 ? ` · crédito usado ${brl(c.credit_applied_brl)}` : ''}</div>
                <div style={{ fontWeight: 700, color: '#1e2d6b' }}>{Number(c.total_charged_brl) > 0 ? `Cobrado: ${brl(c.total_charged_brl)}` : 'Coberta pelo crédito'}</div>
                {payment && <div style={{ fontSize: 12 }}>Cobrança: {({ pending: 'aguardando pagamento', overdue: 'vencida', paid: 'paga', cancelled: 'cancelada', refunded: 'estornada' } as Record<string, string>)[payment.status] || payment.status}</div>}
                {c.paid_at && <div style={{ fontSize: 12, color: '#047857' }}>Liberada em {fmtDate(c.paid_at)}</div>}
              </div>
            ) : <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Ainda não calculado.</p>}
          </div>
          <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
            <label style={labelStyle}>Cliques por botão</label>
            {buttons.length ? buttons.map(b => (
              <div key={b.index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', padding: '3px 0' }}>
                <span>{b.text}</span><strong style={{ color: '#1e2d6b' }}>{b.clicks}</strong>
              </div>
            )) : <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Template sem botões de resposta rápida.</p>}
          </div>
          {failures.length > 0 && (
            <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
              <label style={labelStyle}>Não enviadas / falhas</label>
              {failures.map(f => (
                <div key={f.kind} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', padding: '3px 0' }}>
                  <span>{FAILURE_KIND[f.kind]}</span><strong style={{ color: '#1e2d6b' }}>{f.count}</strong>
                </div>
              ))}
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>Mensagens pagas que não saíram viram crédito pra próxima campanha.</p>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <label style={{ ...labelStyle, margin: 0 }}>Destinatários</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12 }}>
              <option value="">Todos</option>
              <option value="replied">Responderam</option>
              {Object.entries(RECIPIENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ border: '1px solid #f1f5f9', borderRadius: 12, overflow: 'auto', maxHeight: 280 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['Contato', 'Status', 'Enviada', 'Resposta'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {recipients.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '7px 12px' }}>{r.whatsapp_contacts?.name || r.phone}<div style={{ color: '#94a3b8', fontSize: 11 }}>{r.phone}</div></td>
                    <td style={{ padding: '7px 12px' }} title={r.error_message || ''}>{RECIPIENT_STATUS[r.status] || r.status}{r.failure_kind ? ` · ${FAILURE_KIND[r.failure_kind] || r.failure_kind}` : ''}</td>
                    <td style={{ padding: '7px 12px', color: '#64748b' }}>{fmtDate(r.sent_at)}</td>
                    <td style={{ padding: '7px 12px', color: '#64748b' }}>{r.first_reply_at ? `${fmtDate(r.first_reply_at)}${r.clicked_button_index !== null ? ` · ${buttons.find(b => b.index === r.clicked_button_index)?.text || 'botão'}` : ''}` : '—'}</td>
                  </tr>
                ))}
                {recipients.length === 0 && <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>Nenhum destinatário neste filtro.</td></tr>}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>Mostrando até 200.</p>
        </div>
      </div>
    </Modal>
  )
}
