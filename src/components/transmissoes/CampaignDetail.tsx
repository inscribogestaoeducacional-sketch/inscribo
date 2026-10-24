// Detalhe de uma campanha de Transmissões: números, cliques por botão,
// falhas por motivo, cobrança e ações (precificar, pagar, pausar, retomar,
// cancelar). Leitura direto pela RLS; ações via broadcast-campaigns /
// asaas-create-charge.
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, CheckCheck, Eye, MessageCircle, XCircle, Users, Pause, Play, Ban, CreditCard, ExternalLink, RefreshCw, Calculator, CalendarClock, MessageSquare, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  CAMPAIGN_STATUS, PAUSED_REASON, FAILURE_KIND, CATEGORY_LABEL, brl, broadcastAction, chargeCampaign, type Campaign,
} from '../../lib/broadcasts'
import { Btn, ErrorBox, KpiCard, Modal, labelStyle } from './ui'
import SendPlanBuilder, { DEFAULT_PLAN_FORM, type PlanForm } from './SendPlanBuilder'
import { weekdaysFromDb, weekdaysToDb, fmtDay, todayLocal, type Plan } from '../../lib/broadcastPlan'

interface RecipientRow {
  id: string; phone: string; lead_id: string | null; status: string; failure_kind: string | null; error_message: string | null
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
  const navigate = useNavigate()
  const [prog, setProg] = useState<{ pending: number; sent_today: number } | null>(null)
  const [replan, setReplan] = useState(false)
  const [tab, setTab] = useState<'resumo' | 'destinatarios' | 'custo'>('resumo')
  const [planForm, setPlanForm] = useState<PlanForm>(DEFAULT_PLAN_FORM())
  const [plan, setPlan] = useState<Plan | null>(null)
  const [limits, setLimits] = useState<{ hourly: number; daily: number } | null>(null)

  async function load() {
    const { data } = await supabase.from('broadcast_campaigns').select('*').eq('id', campaignId).maybeSingle()
    const camp = data as Campaign | null
    setC(camp)
    if (!camp) return
    supabase.rpc('broadcast_campaign_progress', { p_institution_id: camp.institution_id }).then(({ data: pr }) => {
      const row = ((pr || []) as any[]).find(x => x.campaign_id === camp.id)
      setProg(row ? { pending: Number(row.pending), sent_today: Number(row.sent_today) } : { pending: 0, sent_today: 0 })
    })
    supabase.from('broadcast_settings').select('hourly_limit, daily_limit').eq('institution_id', camp.institution_id).maybeSingle()
      .then(({ data: s }) => { if (s) setLimits({ hourly: (s as any).hourly_limit, daily: (s as any).daily_limit }) })
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
      .select('id, phone, lead_id, status, failure_kind, error_message, sent_at, first_reply_at, clicked_button_index, whatsapp_contacts(name)')
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
      subtitle={<>
        <span style={{ background: '#fff', color: st.color, fontSize: 11.5, fontWeight: 800, padding: '3px 11px', borderRadius: 999 }}>{st.label}</span>
        {c.status === 'paused' && c.paused_reason && <span>{PAUSED_REASON[c.paused_reason] || c.paused_reason}</span>}
        {c.status === 'scheduled' && <span>Envio em {fmtDate(c.scheduled_at)}</span>}
        <span style={{ opacity: .8 }}>Template {c.template_name} · criada em {fmtDate(c.created_at)}</span>
      </>}
      tabs={([['resumo', 'Resumo'], ['destinatarios', `Destinatários${c.total_recipients ? ` (${c.total_recipients.toLocaleString('pt-BR')})` : ''}`], ['custo', 'Custo e cobrança']] as const).map(([k, l]) => (
        <button key={k} type="button" onClick={() => setTab(k)}
          style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 800, padding: '9px 16px', borderRadius: '12px 12px 0 0', background: tab === k ? '#fff' : 'transparent', color: tab === k ? '#007A6E' : 'rgba(255,255,255,.9)', transition: 'background .15s' }}>{l}</button>
      ))}
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
        <ErrorBox message={error} />

        {tab === 'resumo' && (c.send_dates?.length || c.send_window_start || c.daily_cap) && (() => {
          const dates = c.send_dates || []
          const today = todayLocal()
          const done = dates.filter(d => d < today).length
          const dayNo = dates.includes(today) ? done + 1 : Math.min(done + 1, dates.length)
          const cap = c.daily_cap || 0
          const left = prog?.pending ?? 0
          const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].filter((_, i) => weekdaysFromDb(c.send_weekdays)[i])
          return (
            <div style={{ border: '1.5px solid #99E0D7', background: '#F0FDFA', borderRadius: 12, padding: 14, display: 'grid', gap: 6 }}>
              <label style={{ ...labelStyle, margin: 0, color: '#007A6E' }}><CalendarClock size={12} style={{ verticalAlign: -2 }} /> Plano de envio</label>
              <div style={{ fontSize: 13, color: '#065F52', lineHeight: 1.6 }}>
                {cap > 0 && <><b>{cap} mensagens por dia</b>{c.send_spread ? ' espalhadas no horário' : ''} · </>}
                {c.send_window_start && c.send_window_end && <>das <b>{c.send_window_start.slice(0, 5)}</b> às <b>{c.send_window_end.slice(0, 5)}</b> · </>}
                {c.send_weekdays?.length ? days.join(', ') : ''}
              </div>
              {dates.length > 0 && (
                <div style={{ fontSize: 12, color: '#475569' }}>
                  {fmtDay(dates[0])} → {fmtDay(dates[dates.length - 1])}
                  {c.status === 'sending' || c.status === 'scheduled' ? <> · dia <b>{dayNo}</b> de <b>{dates.length}</b></> : null}
                  {c.status === 'sending' && cap > 0 && prog ? <> · hoje <b>{Math.min(prog.sent_today, cap)} de {cap}</b></> : null}
                  {prog && left > 0 ? <> · faltam <b>{left.toLocaleString('pt-BR')}</b></> : null}
                </div>
              )}
              {!readOnly && c.status === 'paused' && left > 0 && (
                <div><Btn onClick={() => { setPlanForm(f => ({ ...DEFAULT_PLAN_FORM(), cap: c.daily_cap || f.cap, winStart: c.send_window_start?.slice(0, 5) || f.winStart, winEnd: c.send_window_end?.slice(0, 5) || f.winEnd, weekdays: weekdaysFromDb(c.send_weekdays), spread: c.send_spread !== false })); setReplan(true) }}><CalendarClock size={14} /> Reagendar restantes</Btn></div>
              )}
            </div>
          )
        })()}

        {tab === 'resumo' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
          <KpiCard label="Destinatários" value={c.total_recipients.toLocaleString('pt-BR')} icon={<Users size={16} color="#1e2d6b" />} bg="#E0E7FF" />
          <KpiCard label="Enviadas" value={c.sent_count.toLocaleString('pt-BR')} hint={pct(c.sent_count, c.total_recipients)} icon={<Send size={16} color="#047857" />} bg="#D1FAE5" />
          <KpiCard label="Entregues" value={c.delivered_count.toLocaleString('pt-BR')} hint={pct(c.delivered_count, c.sent_count)} icon={<CheckCheck size={16} color="#0284C7" />} bg="#E0F2FE" />
          <KpiCard label="Lidas" value={c.read_count.toLocaleString('pt-BR')} hint={pct(c.read_count, c.delivered_count)} icon={<Eye size={16} color="#7C3AED" />} bg="#EDE9FE" />
          <KpiCard label="Responderam" value={c.replied_count.toLocaleString('pt-BR')} hint={pct(c.replied_count, c.delivered_count)} icon={<MessageCircle size={16} color="#DB2777" />} bg="#FCE7F3" />
          <KpiCard label="Falhas" value={c.failed_count.toLocaleString('pt-BR')} icon={<XCircle size={16} color="#DC2626" />} bg="#FEE2E2" />
        </div>}

        {tab === 'resumo' && c.total_recipients > 0 && (
          <div style={{ border: '1px solid #E3E8F0', borderRadius: 16, padding: '14px 16px', display: 'grid', gap: 9 }}>
            <label style={{ ...labelStyle, margin: 0 }}>Funil da campanha</label>
            {([['Enviadas', c.sent_count, '#00A896'], ['Entregues', c.delivered_count, '#0284C7'], ['Lidas', c.read_count, '#7C3AED'], ['Responderam', c.replied_count, '#DB2777']] as const).map(([l, n, col]) => (
              <div key={l} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 88px', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#475569' }}>
                <span style={{ fontWeight: 700 }}>{l}</span>
                <span style={{ height: 9, borderRadius: 99, background: '#EEF3F2', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.min(100, (n / c.total_recipients) * 100)}%`, background: col, borderRadius: 99, transition: 'width .7s cubic-bezier(.22,1,.36,1)' }} />
                </span>
                <span style={{ textAlign: 'right' }}><b style={{ color: '#1A2B4A' }}>{n.toLocaleString('pt-BR')}</b> · {pct(n, c.total_recipients)}</span>
              </div>
            ))}
          </div>
        )}

        {(tab === 'custo' || tab === 'resumo') && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {tab === 'custo' && <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
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
          </div>}
          {tab === 'resumo' && <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
            <label style={labelStyle}>Cliques por botão</label>
            {buttons.length ? buttons.map(b => (
              <div key={b.index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', padding: '3px 0' }}>
                <span>{b.text}</span><strong style={{ color: '#1e2d6b' }}>{b.clicks}</strong>
              </div>
            )) : <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Template sem botões de resposta rápida.</p>}
          </div>}
          {tab === 'resumo' && failures.length > 0 && (
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
        </div>}

        {tab === 'destinatarios' && <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <label style={{ ...labelStyle, margin: 0 }}>Destinatários</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12 }}>
              <option value="">Todos</option>
              <option value="replied">Responderam</option>
              {Object.entries(RECIPIENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ border: '1px solid #f1f5f9', borderRadius: 12, overflow: 'auto', maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['Contato', 'Status', 'Enviada', 'Resposta', ''].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {recipients.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '7px 12px' }}>{r.whatsapp_contacts?.name || r.phone}<div style={{ color: '#94a3b8', fontSize: 11 }}>{r.phone}</div></td>
                    <td style={{ padding: '7px 12px' }} title={r.error_message || ''}>{RECIPIENT_STATUS[r.status] || r.status}{r.failure_kind ? ` · ${FAILURE_KIND[r.failure_kind] || r.failure_kind}` : ''}</td>
                    <td style={{ padding: '7px 12px', color: '#64748b' }}>{fmtDate(r.sent_at)}</td>
                    <td style={{ padding: '7px 12px', color: '#64748b' }}>{r.first_reply_at ? `${fmtDate(r.first_reply_at)}${r.clicked_button_index !== null ? ` · ${buttons.find(b => b.index === r.clicked_button_index)?.text || 'botão'}` : ''}` : '—'}</td>
                    <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                      {!readOnly && r.first_reply_at && <button type="button" onClick={() => navigate(`/whatsapp?phone=${r.phone}`)} style={{ marginRight: 6, padding: '3px 8px', borderRadius: 7, border: '1px solid #E3E8F0', background: '#fff', color: '#007A6E', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}><MessageSquare size={11} style={{ verticalAlign: -1 }} /> Conversa</button>}
                      {!readOnly && r.lead_id && <button type="button" onClick={() => navigate(`/leads?open=${r.lead_id}`)} style={{ padding: '3px 8px', borderRadius: 7, border: '1px solid #E3E8F0', background: '#fff', color: '#007A6E', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}><UserRound size={11} style={{ verticalAlign: -1 }} /> Ver lead</button>}
                    </td>
                  </tr>
                ))}
                {recipients.length === 0 && <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>Nenhum destinatário neste filtro.</td></tr>}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>Mostrando até 200.</p>
        </div>}
      </div>
      {replan && (
        <Modal wide title="Reagendar as mensagens que faltam" onClose={() => setReplan(false)}
          footer={<>
            <Btn variant="ghost" onClick={() => setReplan(false)}>Voltar</Btn>
            <Btn disabled={!plan?.valid} loading={busy === 'replan'} onClick={() => run('replan', async () => {
              const { error: e } = await supabase.rpc('broadcast_set_plan', {
                p_campaign_id: c.id, p_dates: plan!.days.map(d => d.date), p_start: planForm.winStart, p_end: planForm.winEnd,
                p_daily_cap: plan!.capDay, p_spread: planForm.spread, p_weekdays: weekdaysToDb(planForm.weekdays),
              })
              if (e) throw new Error(e.message)
              await broadcastAction('resume', { campaign_id: c.id })
              setReplan(false)
            })}><Play size={14} /> Salvar e retomar</Btn>
          </>}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569' }}>Faltam <b>{(prog?.pending ?? 0).toLocaleString('pt-BR')}</b> mensagens. Escolha os novos dias e o ritmo.</p>
          <SendPlanBuilder form={planForm} onChange={setPlanForm} total={prog?.pending ?? 0} limits={limits} onPlan={setPlan} />
        </Modal>
      )}
    </Modal>
  )
}
