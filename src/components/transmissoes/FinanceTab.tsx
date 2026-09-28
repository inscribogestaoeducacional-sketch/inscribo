// Aba "Transmissões" em Configurações da escola (SystemSettings) — visão
// financeira do módulo pra escola: saldo de crédito, cobranças de campanha e
// extrato. Só aparece com o módulo liberado (useBroadcastEnabled, mesma regra
// do menu). As cobranças de campanha ficam só aqui — a aba "Pagamentos"
// continua mostrando implantação e mensalidade.
//
// Dados: broadcast_institution_summary (a escola recebe margem/custo da Meta
// vazios — só o Super Admin vê), payments do tipo 'broadcast' pela RLS, e
// broadcast_credit_statement (extrato com saldo após cada lançamento).
import React, { useEffect, useState } from 'react'
import { Wallet, Receipt, Send, History, ExternalLink, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { brl } from '../../lib/broadcasts'
import { KpiCard, cardStyle, hintStyle } from './ui'

const PAYMENT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Aguardando pagamento', color: '#D97706', bg: '#FFFBEB' },
  overdue:   { label: 'Vencida',              color: '#DC2626', bg: '#FEF2F2' },
  paid:      { label: 'Paga',                 color: '#16A34A', bg: '#F0FDF4' },
  cancelled: { label: 'Cancelada',            color: '#9CA3AF', bg: '#F3F4F6' },
  refunded:  { label: 'Estornada',            color: '#7C3AED', bg: '#F5F3FF' },
}

const PERIODS = [
  { key: 'month', label: 'Mês atual' }, { key: '90', label: '3 meses' }, { key: '365', label: '12 meses' }, { key: 'all', label: 'Tudo' },
] as const
function periodStart(k: typeof PERIODS[number]['key']): string | null {
  const now = new Date()
  if (k === 'all') return null
  if (k === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  return new Date(now.getTime() - Number(k) * 86400000).toISOString()
}

const PAGE = 20
const fmtDate = (s: string | null) => s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('pt-BR') : '—'
const thStyle: React.CSSProperties = { padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: '#1e293b' }

interface PaymentRow {
  id: string; amount: number; status: string; due_date: string | null; paid_at: string | null; created_at: string
  asaas_charge_url: string | null; description: string | null
  broadcast_campaigns: { name: string; priced_recipients: number | null } | null
}
interface StatementRow { id: string; created_at: string; amount_brl: number; balance_after: number; description: string; total_count: number }

export default function FinanceTab({ institutionId }: { institutionId: string }) {
  const [period, setPeriod] = useState<typeof PERIODS[number]['key']>('month')
  const [summary, setSummary] = useState<any>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [statement, setStatement] = useState<StatementRow[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingStatement, setLoadingStatement] = useState(false)

  async function loadSummary() {
    const { data } = await supabase.rpc('broadcast_institution_summary', { p_institution_id: institutionId, p_start: periodStart(period), p_end: null })
    setSummary((data as any[])?.[0] || null)
  }
  async function loadStatement(p: number) {
    setLoadingStatement(true)
    const { data } = await supabase.rpc('broadcast_credit_statement', { p_institution_id: institutionId, p_limit: PAGE, p_offset: p * PAGE })
    setStatement((data || []) as StatementRow[])
    setLoadingStatement(false)
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [, { data: pays }] = await Promise.all([
        loadSummary(),
        // Duas ligações entre payments e broadcast_campaigns — o nome da FK
        // desambigua o embed (cobrança → campanha dela).
        supabase.from('payments')
          .select('id, amount, status, due_date, paid_at, created_at, asaas_charge_url, description, broadcast_campaigns!payments_broadcast_campaign_id_fkey(name, priced_recipients)')
          .eq('institution_id', institutionId).eq('payment_type', 'broadcast')
          .order('created_at', { ascending: false }).limit(100),
        loadStatement(0),
      ])
      setPayments((pays || []) as any)
      setLoading(false)
    })()
  }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loading) loadSummary() }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} color="#00A896" className="animate-spin" /></div>

  const s = summary || {}
  const total = Number(statement[0]?.total_count || 0)
  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            padding: '6px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: period === p.key ? '#fff' : 'transparent', color: period === p.key ? '#1e2d6b' : '#64748b',
            boxShadow: period === p.key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
          }}>{p.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <KpiCard label="Saldo de crédito" value={brl(s.credit_balance_brl)} hint="Mensagens pagas que não saíram" icon={<Wallet size={16} color="#047857" />} bg="#D1FAE5" />
        <KpiCard label="Pago no período" value={brl(s.charged_brl)} hint={Number(s.credit_used_brl) > 0 ? `+ ${brl(s.credit_used_brl)} usado de crédito` : undefined} icon={<Receipt size={16} color="#0284C7" />} bg="#E0F2FE" />
        <KpiCard label="Campanhas liberadas" value={String(Number(s.campaigns_released || 0))} hint={Number(s.campaigns_active) > 0 ? `${Number(s.campaigns_active)} em andamento` : undefined} icon={<Send size={16} color="#1e2d6b" />} bg="#E0E7FF" />
        <KpiCard label="Mensagens enviadas" value={Number(s.messages_sent || 0).toLocaleString('pt-BR')} hint={`${Number(s.replies || 0).toLocaleString('pt-BR')} respostas`} icon={<Send size={16} color="#7C3AED" />} bg="#EDE9FE" />
      </div>

      {/* ── Cobranças de campanha ── */}
      <div style={cardStyle}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Cobranças de campanha</h3>
          <p style={{ ...hintStyle, marginTop: 4 }}>A campanha sai sozinha assim que o pagamento é confirmado. Campanha coberta pelo crédito não gera cobrança.</p>
        </div>
        {payments.length === 0 ? (
          <p style={{ padding: '24px 20px', margin: 0, fontSize: 13, color: '#94a3b8' }}>Nenhuma cobrança de campanha ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['Campanha', 'Mensagens', 'Valor', 'Situação', 'Vencimento', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>
                {payments.map(p => {
                  const st = PAYMENT_STATUS[p.status] || { label: p.status, color: '#64748b', bg: '#F1F5F9' }
                  const open = ['pending', 'overdue'].includes(p.status)
                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}>{p.broadcast_campaigns?.name || p.description || 'Campanha'}</td>
                      <td style={tdStyle}>{p.broadcast_campaigns?.priced_recipients?.toLocaleString('pt-BR') ?? '—'}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{brl(p.amount)}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, whiteSpace: 'nowrap' }}>{st.label}</span>
                        {p.paid_at && p.status === 'paid' && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>em {fmtDate(p.paid_at)}</div>}
                      </td>
                      <td style={{ ...tdStyle, color: '#64748b' }}>{fmtDate(p.due_date)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {open && p.asaas_charge_url && (
                          <a href={p.asaas_charge_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, background: '#00A896', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            <ExternalLink size={13} /> Pagar agora
                          </a>
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

      {/* ── Extrato do crédito ── */}
      <div style={cardStyle}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={16} color="#64748b" />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Extrato do crédito</h3>
        </div>
        {statement.length === 0 ? (
          <p style={{ padding: '24px 20px', margin: 0, fontSize: 13, color: '#94a3b8' }}>Nenhum lançamento ainda. Quando uma mensagem paga não for entregue, o valor dela volta pra cá como crédito.</p>
        ) : <>
          <div style={{ overflowX: 'auto', opacity: loadingStatement ? 0.5 : 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['Data', 'Descrição', 'Valor', 'Saldo'].map(h => <th key={h} style={{ ...thStyle, textAlign: h === 'Valor' || h === 'Saldo' ? 'right' : 'left' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {statement.map(l => {
                  const v = Number(l.amount_brl)
                  return (
                    <tr key={l.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ ...tdStyle, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</td>
                      <td style={tdStyle}>{l.description}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: v >= 0 ? '#047857' : '#DC2626', whiteSpace: 'nowrap' }}>{v >= 0 ? '+' : '−'} {brl(Math.abs(v))}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{brl(l.balance_after)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>
              <button disabled={page === 0} onClick={() => { const p = page - 1; setPage(p); loadStatement(p) }} style={{ border: '1px solid #E2E8F0', background: '#fff', borderRadius: 8, padding: 5, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}><ChevronLeft size={14} /></button>
              Página {page + 1} de {pages}
              <button disabled={page + 1 >= pages} onClick={() => { const p = page + 1; setPage(p); loadStatement(p) }} style={{ border: '1px solid #E2E8F0', background: '#fff', borderRadius: 8, padding: 5, cursor: page + 1 >= pages ? 'not-allowed' : 'pointer', opacity: page + 1 >= pages ? 0.4 : 1 }}><ChevronRight size={14} /></button>
            </div>
          )}
        </>}
      </div>
    </div>
  )
}
