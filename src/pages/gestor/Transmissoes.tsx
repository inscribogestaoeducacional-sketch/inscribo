// =============================================================================
// src/pages/gestor/Transmissoes.tsx
//
// Módulo "Transmissões": campanhas de disparo em massa pelo WhatsApp com
// template aprovado pela Meta. Três abas: Campanhas (lista + detalhe +
// assistente de criação), Templates (da escola + padrão da Áion) e "Não
// recebem" (lista de supressão). Toda escrita de campanha passa pela Edge
// Function broadcast-campaigns; aqui só se lê (RLS) e se chama o backend.
// Visual segue CaptacaoInteligente.tsx.
// =============================================================================
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Send, Plus, Wallet, Radio, AlertTriangle, RefreshCw, CheckCheck, Eye, MessageCircle, TrendingUp, TrendingDown, CalendarClock, Pause, CreditCard, ChevronRight } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { LEADS_CSS } from '../../components/leads/LeadsAttention'
import { fmtDay, todayLocal } from '../../lib/broadcastPlan'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { CAMPAIGN_STATUS, PAUSED_REASON, brl, type Campaign } from '../../lib/broadcasts'
import { Badge, Btn, Empty } from '../../components/transmissoes/ui'
import TemplatesPanel from '../../components/transmissoes/TemplatesPanel'
import SuppressionPanel from '../../components/transmissoes/SuppressionPanel'
import CampaignWizard from '../../components/transmissoes/CampaignWizard'
import CampaignDetail from '../../components/transmissoes/CampaignDetail'

type Tab = 'campaigns' | 'templates' | 'suppressions'

const TEAL = '#05907B', TEAL_D = '#00695F', NAVY = '#1e2d6b', LINE = '#E3E8F0'
const fmt = (n: number) => n.toLocaleString('pt-BR')
const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null)
const FILTERS = [
  { k: 'all', l: 'Todas' }, { k: 'live', l: 'Em andamento' }, { k: 'paused', l: 'Pausadas' },
  { k: 'done', l: 'Concluídas' }, { k: 'other', l: 'Rascunho e canceladas' },
] as const
type Filter = typeof FILTERS[number]['k']
const group = (s: string): Filter =>
  ['sending', 'scheduled', 'pending_payment', 'pending_template'].includes(s) ? 'live' : s === 'paused' ? 'paused' : s === 'completed' ? 'done' : 'other'

export default function Transmissoes() {
  const { user } = useAuth()
  const institutionId = user?.institution_id || ''

  const [tab, setTab] = useState<Tab>('campaigns')
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [limits, setLimits] = useState<{ hourly: number; daily: number } | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [prog, setProg] = useState<Record<string, { pending: number; sent_today: number }>>({})
  const [credit, setCredit] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [mobile, setMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 720)
  const location = useLocation()
  const preRelations = (location.state as { relations?: string[] } | null)?.relations
  const [wizardOpen, setWizardOpen] = useState(!!preRelations?.length)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    const f = () => setMobile(window.innerWidth < 720)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  async function load() {
    if (!institutionId) return
    const [setRes, campRes, ledRes, progRes] = await Promise.all([
      supabase.from('broadcast_settings').select('enabled, hourly_limit, daily_limit').eq('institution_id', institutionId).maybeSingle(),
      supabase.from('broadcast_campaigns').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }).limit(200),
      supabase.from('broadcast_credit_ledger').select('amount_brl').eq('institution_id', institutionId),
      supabase.rpc('broadcast_campaign_progress', { p_institution_id: institutionId }),
    ])
    const s = setRes.data as any
    setEnabled(!!s?.enabled)
    setLimits(s ? { hourly: s.hourly_limit, daily: s.daily_limit } : null)
    setCampaigns((campRes.data || []) as Campaign[])
    setCredit(((ledRes.data || []) as any[]).reduce((acc, r) => acc + Number(r.amount_brl), 0))
    const pm: Record<string, { pending: number; sent_today: number }> = {}
    ;((progRes.data || []) as any[]).forEach(r => { pm[r.campaign_id] = { pending: Number(r.pending), sent_today: Number(r.sent_today) } })
    setProg(pm)
    setLoading(false)
  }

  useEffect(() => { load() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Enquanto houver campanha andando, atualiza a lista sozinha.
  const active = campaigns.some(c => ['sending', 'scheduled', 'pending_payment'].includes(c.status))
  useEffect(() => {
    if (!active) return
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendingNow = campaigns.filter(c => c.status === 'sending').length

  // Últimos 30 dias × 30 dias anteriores (pela data de criação da campanha).
  const sums = useMemo(() => {
    const now = Date.now(), d30 = now - 30 * 86400000, d60 = now - 60 * 86400000
    const agg = (from: number, to: number) => campaigns
      .filter(c => { const x = new Date(c.created_at).getTime(); return x >= from && x < to })
      .reduce((a, c) => ({ sent: a.sent + c.sent_count, deliv: a.deliv + c.delivered_count, read: a.read + c.read_count, replied: a.replied + c.replied_count }), { sent: 0, deliv: 0, read: 0, replied: 0 })
    return { cur: agg(d30, now + 1), prev: agg(d60, d30) }
  }, [campaigns])

  const paused = campaigns.filter(c => c.status === 'paused')
  const highFail = campaigns.filter(c => ['sending', 'completed'].includes(c.status) && c.sent_count + c.failed_count >= 20 && c.failed_count / (c.sent_count + c.failed_count) > 0.1)
  const waitingPay = campaigns.filter(c => c.status === 'pending_payment')

  const list = campaigns.filter(c => filter === 'all' || group(c.status) === filter)
  const delta = (c: number, p: number) => (p === 0 ? (c > 0 ? { t: 'novo', up: true } : null) : { t: `${Math.round(((c - p) / p) * 100) > 0 ? '+' : ''}${Math.round(((c - p) / p) * 100)}%`, up: c >= p })

  const kp = [
    { l: 'Crédito disponível', v: brl(credit), h: 'Mensagens pagas que não saíram', icon: Wallet, c: '#047857', bg: '#D1FAE5' },
    { l: 'Enviando agora', v: String(sendingNow), h: limits ? `Limite: ${limits.hourly}/hora · ${limits.daily}/dia` : undefined, icon: Radio, c: '#0284C7', bg: '#E0F2FE' },
    { l: 'Enviadas · 30 dias', v: fmt(sums.cur.sent), d: delta(sums.cur.sent, sums.prev.sent), icon: Send, c: NAVY, bg: '#E0E7FF' },
    { l: 'Entregues', v: rate(sums.cur.deliv, sums.cur.sent) !== null ? `${rate(sums.cur.deliv, sums.cur.sent)}%` : '—', icon: CheckCheck, c: '#0284C7', bg: '#E0F2FE' },
    { l: 'Lidas', v: rate(sums.cur.read, sums.cur.deliv) !== null ? `${rate(sums.cur.read, sums.cur.deliv)}%` : '—', icon: Eye, c: '#7C3AED', bg: '#EDE9FE' },
    { l: 'Responderam', v: rate(sums.cur.replied, sums.cur.deliv) !== null ? `${rate(sums.cur.replied, sums.cur.deliv)}%` : '—', d: delta(sums.cur.replied, sums.prev.replied), icon: MessageCircle, c: '#DB2777', bg: '#FCE7F3' },
  ]

  const chip = (red: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    background: red ? '#FEE2E2' : '#FEF3C7', color: red ? '#991B1B' : '#92400E', border: `1.5px solid ${red ? '#FECACA' : '#FDE68A'}`,
  })
  const seg = (on: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 9, border: 'none', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    background: on ? '#E6F7F5' : 'transparent', color: on ? TEAL_D : '#64748b',
  })
  const segWrap: React.CSSProperties = { display: 'flex', gap: 3, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 3, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }

  return (
    <div style={{ padding: mobile ? 12 : 24, display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%', background: '#f8f9fb' }}>
      <style>{LEADS_CSS}</style>
      <PageHeader
        icon={Send}
        compact={mobile}
        title="Transmissões"
        subtitle="Campanhas pelo WhatsApp para sua base, com template aprovado pela Meta"
        actions={enabled ? <button onClick={() => setWizardOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 11, border: 'none', background: '#fff', color: TEAL_D, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><Plus size={15} /> Nova campanha</button> : undefined}
      />

      {enabled === false && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
            <strong>Transmissões ainda não está liberado pra sua escola.</strong><br />
            Fale com a equipe da Áion pra saber quando estará disponível.
          </div>
        </div>
      )}

      {enabled && <>
        {(paused.length > 0 || highFail.length > 0 || waitingPay.length > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {paused.map(c => (
              <button key={c.id} className="ld-alert" style={chip(true)} onClick={() => setDetailId(c.id)}>
                <Pause size={13} /> “{c.name}” pausada — {c.paused_reason === 'schedule_ended' ? 'agenda terminou, reagende' : (PAUSED_REASON[c.paused_reason || ''] || 'veja o motivo')} <ChevronRight size={12} />
              </button>
            ))}
            {highFail.map(c => (
              <button key={c.id} style={chip(false)} onClick={() => setDetailId(c.id)}>
                <AlertTriangle size={13} /> “{c.name}”: {rate(c.failed_count, c.sent_count + c.failed_count)}% de falhas <ChevronRight size={12} />
              </button>
            ))}
            {waitingPay.map(c => (
              <button key={c.id} style={chip(false)} onClick={() => setDetailId(c.id)}>
                <CreditCard size={13} /> “{c.name}” aguardando pagamento <ChevronRight size={12} />
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {kp.map((k, i) => {
            const Icon = k.icon
            return (
              <div key={k.l} className="ld-in" style={{ background: '#fff', border: `1.5px solid ${LINE}`, borderRadius: 16, padding: '13px 14px', animationDelay: `${i * 40}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} color={k.c} /></span>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{k.l}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, margin: '6px 0 2px' }}>{k.v}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: k.d?.up === false ? '#DC2626' : k.d ? '#059669' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {k.d && (k.d.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}{k.d ? `${k.d.t} vs. 30 dias anteriores` : k.h || ''}
                </div>
              </div>
            )
          })}
        </div>

        <div style={segWrap} role="tablist">
          {([{ k: 'campaigns' as const, l: 'Campanhas' }, { k: 'templates' as const, l: 'Templates' }, { k: 'suppressions' as const, l: 'Não recebem' }]).map(x => (
            <button key={x.k} role="tab" aria-selected={tab === x.k} onClick={() => setTab(x.k)} style={seg(tab === x.k)}>{x.l}</button>
          ))}
        </div>

        {tab === 'campaigns' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={segWrap}>
                {FILTERS.map(f => <button key={f.k} onClick={() => setFilter(f.k)} style={seg(filter === f.k)}>{f.l}</button>)}
              </div>
              <Btn variant="ghost" onClick={load}><RefreshCw size={14} /> Atualizar</Btn>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {[...Array(3)].map((_, i) => <div key={i} className="animate-pulse" style={{ height: 190, borderRadius: 16, background: '#fff', border: `1px solid ${LINE}` }} />)}
              </div>
            ) : campaigns.length === 0 ? (
              <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 18 }}>
                <Empty icon={<Send size={24} color="#0284C7" />} title="Nenhuma campanha ainda"
                  text="Escolha um template aprovado, filtre o público, defina os dias, o horário e o ritmo de envio, veja o custo e envie."
                  action={<Btn onClick={() => setWizardOpen(true)}><Plus size={14} /> Criar primeira campanha</Btn>} />
              </div>
            ) : list.length === 0 ? (
              <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 18, padding: 28, textAlign: 'center', fontSize: 13, color: '#64748b' }}>Nenhuma campanha neste filtro.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 12 }}>
                {list.map((c, idx) => {
                  const st = CAMPAIGN_STATUS[c.status]
                  const done = c.sent_count + c.failed_count
                  const progress = c.total_recipients ? Math.min(100, Math.round((done / c.total_recipients) * 100)) : 0
                  const p = prog[c.id]
                  const dates = c.send_dates || []
                  const today = todayLocal()
                  const dayNo = dates.length ? (dates.includes(today) ? dates.filter(d => d < today).length + 1 : Math.min(dates.filter(d => d < today).length + 1, dates.length)) : 0
                  const last = dates[dates.length - 1]
                  const steps: [string, number, string][] = [
                    ['Enviadas', c.sent_count, '#10B981'], ['Entregues', c.delivered_count, '#0284C7'],
                    ['Lidas', c.read_count, '#7C3AED'], ['Respostas', c.replied_count, '#DB2777'],
                  ]
                  return (
                    <div key={c.id} role="button" tabIndex={0} className="ld-card ld-in" onClick={() => setDetailId(c.id)}
                      onKeyDown={e => { if (e.key === 'Enter') setDetailId(c.id) }}
                      style={{ background: '#fff', border: `1.5px solid ${c.status === 'paused' ? '#FED7AA' : LINE}`, borderRadius: 16, padding: 14, cursor: 'pointer', animationDelay: `${Math.min(idx, 8) * 35}ms` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.template_name}</div>
                        </div>
                        <Badge label={st.label} color={st.color} bg={st.bg} />
                      </div>

                      <div style={{ height: 7, borderRadius: 4, background: '#F1F5F9', margin: '12px 0 4px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: TEAL, transition: 'width .5s ease' }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{fmt(c.sent_count)} de {fmt(c.total_recipients)} enviadas · {progress}%</div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '12px 0 8px' }}>
                        {steps.map(([l, v, col]) => (
                          <div key={l}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>{l}</div>
                            <div style={{ height: 4, borderRadius: 2, background: '#F1F5F9', marginTop: 3 }}>
                              <div style={{ height: '100%', borderRadius: 2, background: col, width: `${Math.min(100, c.total_recipients ? (v / c.total_recipients) * 100 : 0)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {(c.status === 'sending' || c.status === 'scheduled') && dates.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                          <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: '#E0F2FE', color: '#0369A1', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CalendarClock size={11} /> Dia {dayNo} de {dates.length}{c.daily_cap && p ? ` · hoje ${Math.min(p.sent_today, c.daily_cap)} de ${c.daily_cap}` : ''}
                          </span>
                          {last && <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: '#F1F5F9', color: '#475569' }}>Termina {fmtDay(last)}</span>}
                        </div>
                      )}
                      {c.status === 'paused' && (
                        <div style={{ fontSize: 11.5, color: '#9A3412', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 9, padding: '6px 9px', marginBottom: 6 }}>
                          {PAUSED_REASON[c.paused_reason || ''] || 'Pausada'}{p && p.pending > 0 ? ` · faltam ${fmt(p.pending)}` : ''}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b', gap: 6, flexWrap: 'wrap' }}>
                        <span>{c.priced_at ? (Number(c.total_charged_brl) > 0 ? brl(c.total_charged_brl) : 'Crédito') : '—'} · {new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                        <span style={{ color: TEAL_D, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>Detalhes <ChevronRight size={13} /></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'templates' && institutionId && <TemplatesPanel institutionId={institutionId} />}
        {tab === 'suppressions' && institutionId && user && <SuppressionPanel institutionId={institutionId} userId={user.id} />}

        {wizardOpen && (
          <CampaignWizard institutionId={institutionId} initialRelations={preRelations} onClose={() => setWizardOpen(false)}
            onCreated={id => { setWizardOpen(false); load(); setDetailId(id) }} />
        )}
        {detailId && <CampaignDetail campaignId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
      </>}
    </div>
  )
}
