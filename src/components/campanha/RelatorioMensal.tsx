// Relatório do mês da Campanha: foto dos números (meta × realizado × compensação), texto da IA, PDF e e-mail com o link.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles, Printer, Mail, AlertTriangle, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { aiFetch } from '../../lib/authHeaders'
import { BRAND } from '../../lib/brand'
import { funnelNeeds, monthName, type FunnelRates, type HistYear, type PlanMonth } from '../../lib/campaignPlan'
import { compensate, cumulative, thisMonthSP } from '../../lib/campaignCompare'

type Report = { resumo?: string; secoes?: { titulo: string; texto?: string; pontos?: string[] }[]; alertas?: string[] }
type Kind = { meta_mes: number; feito_mes: number; meta_total: number; feito_total: number; esperado_ate_aqui: number; feito_meses_fechados: number; ajustada_proximos: { m: string; meta: number; ajustada: number }[]; anos_anteriores_no_mes: { ano: number; no_mes: number; acumulado: number }[] }
export interface Snapshot {
  mes: string; gerado_em: string; escola?: string
  novos: Kind; rematriculas: Kind
  funil: { etapa: string; meta: number; feito: number }[]
  investimento: { mes: number; acumulado: number; custo_por_lead: number | null; custo_por_visita: number | null; cpa: number | null; por_categoria: { categoria: string; valor: number }[] }
  situacao_atual: { matriculados: number; pre_matriculados: number; sem_rematricula: number; matriculas_sem_lead: number }
}
interface Row { id: string; month: string; report: Report | null; snapshot: Snapshot | null; created_at: string; emailed_at: string | null; emailed_to: string | null }

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: '18px 20px' }
const sel: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13.5, background: '#fff', color: BRAND.ink, fontWeight: 600 }
const btn = (off: boolean, alt = false): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 11, border: alt ? '1px solid #E3E8F0' : 'none', cursor: off ? 'default' : 'pointer', fontWeight: 700, fontSize: 13.5, color: alt ? BRAND.ink : '#fff', background: alt ? '#fff' : 'var(--aion-grad)', opacity: off ? 0.55 : 1, fontFamily: 'inherit' })
const brl = (n: number | null) => n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const lastDay = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}` }
const label = (m: string) => `${monthName(m + '-01')}/${m.slice(0, 4)}`

interface Props {
  institutionId: string; cycleId: string; institutionName: string; userId: string; userEmail: string
  from: string; to: string; year: number; months: PlanMonth[]; rates: FunnelRates; cur: HistYear | null; years: HistYear[]
  prog: { done: number; pre: number; pending: number }; noLead: number; openId?: string | null
}

export default function RelatorioMensal(p: Props) {
  const now = thisMonthSP()
  const opts = useMemo(() => p.months.filter(m => m.m <= now).map(m => m.m).reverse(), [p.months, now])
  const [month, setMonth] = useState(opts[0] ?? now)
  const [rows, setRows] = useState<Row[]>([])
  const [sel_, setSel] = useState<string | null>(p.openId ?? null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [email, setEmail] = useState(p.userEmail)
  const [mailMsg, setMailMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [mailBusy, setMailBusy] = useState(false)
  const [logo, setLogo] = useState<string | null>(null)
  useEffect(() => { supabase.from('institutions').select('logo_url').eq('id', p.institutionId).maybeSingle().then(({ data }) => setLogo((data as { logo_url?: string | null } | null)?.logo_url ?? null)) }, [p.institutionId])

  const load = useCallback(async () => {
    const { data } = await supabase.from('campaign_month_reports').select('id, month, report, snapshot, created_at, emailed_at, emailed_to').eq('cycle_id', p.cycleId).order('month', { ascending: false })
    setRows((data ?? []) as Row[])
  }, [p.cycleId])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (opts.length && !opts.includes(month)) setMonth(opts[0]) }, [opts]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (p.openId) setSel(p.openId) }, [p.openId])
  useEffect(() => { if (!sel_ && rows.length) setSel(rows[0].id) }, [rows, sel_])
  const open = rows.find(r => r.id === sel_) ?? null

  const kindSnap = (kind: 'novos' | 'rematriculas'): Kind => {
    const c = compensate(p.months, p.cur, kind, now), cu = cumulative(p.months, p.cur, p.years, p.year, kind, now)
    const i = p.months.findIndex(m => m.m === month)
    const closedUpTo = p.months.reduce((s, m, k) => s + (m.m <= month ? c.plan[k] : 0), 0)
    const realUpTo = p.months.reduce((s, m, k) => s + (m.m <= month ? (c.real[k] ?? 0) : 0), 0)
    return {
      meta_mes: c.plan[i] ?? 0, feito_mes: c.real[i] ?? 0,
      meta_total: c.plan.reduce((a, b) => a + b, 0), feito_total: realUpTo,
      esperado_ate_aqui: closedUpTo, feito_meses_fechados: realUpTo,
      ajustada_proximos: p.months.map((m, k) => ({ m: m.m, meta: c.plan[k], ajustada: c.adjusted[k] ?? 0 })).filter((x, k) => p.months[k].m > month && c.adjusted[k] != null),
      anos_anteriores_no_mes: cu.prev.map(pr => ({ ano: pr.year, no_mes: (() => { const y = p.years.find(yy => yy.year === pr.year); const shift = p.year - pr.year; return y?.monthly.find(x => `${Number(x.m.slice(0, 4)) + shift}-${x.m.slice(5, 7)}` === month)?.[kind] ?? 0 })(), acumulado: pr.series[i] ?? 0 })),
    }
  }

  const generate = async () => {
    setBusy(true); setErr('')
    try {
      const novos = kindSnap('novos'), rem = kindSnap('rematriculas')
      const [fm, ft, ex, base] = await Promise.all([
        supabase.rpc('campaign_funnel', { p_inst: p.institutionId, p_from: `${month}-01`, p_to: lastDay(month), p_source: null, p_grade: null, p_assigned: null }),
        supabase.rpc('campaign_funnel', { p_inst: p.institutionId, p_from: p.from, p_to: lastDay(month), p_source: null, p_grade: null, p_assigned: null }),
        supabase.from('campaign_expenses').select('category, amount, month').eq('institution_id', p.institutionId).eq('target_year', p.year),
        supabase.rpc('campaign_investment_base', { p_inst: p.institutionId, p_year: p.year, p_from: p.from, p_to: lastDay(month) }),
      ])
      const f = fm.data as { entraram: number; totais: Record<string, { n: number }> } | null
      const mrow = p.months.find(m => m.m === month)
      const need = funnelNeeds(mrow?.novos ?? 0, p.rates)
      const expenses = ((ex.data ?? []) as { category: string; amount: number; month: string }[]).filter(e => e.month <= month)
      const inMonth = expenses.filter(e => e.month === month).reduce((s, e) => s + Number(e.amount), 0)
      const acc = expenses.reduce((s, e) => s + Number(e.amount), 0)
      const cats = new Map<string, number>(); expenses.forEach(e => cats.set(e.category, (cats.get(e.category) ?? 0) + Number(e.amount)))
      const b = base.data as { leads: number; visits: number; novos: number } | null
      const snap: Snapshot = {
        mes: month, gerado_em: new Date().toISOString(), escola: p.institutionName, novos, rematriculas: rem,
        funil: [
          { etapa: 'Leads', meta: need.registrations, feito: f?.entraram ?? 0 }, { etapa: 'Agendamentos', meta: need.schedules, feito: f?.totais.scheduled?.n ?? 0 },
          { etapa: 'Visitas', meta: need.visits, feito: f?.totais.visit?.n ?? 0 }, { etapa: 'Matrículas novas', meta: mrow?.novos ?? 0, feito: f?.totais.enrolled?.n ?? 0 },
        ],
        investimento: { mes: inMonth, acumulado: acc, custo_por_lead: b?.leads ? acc / b.leads : null, custo_por_visita: b?.visits ? acc / b.visits : null, cpa: b?.novos ? acc / b.novos : null, por_categoria: [...cats].map(([categoria, valor]) => ({ categoria, valor })) },
        situacao_atual: { matriculados: p.prog.done, pre_matriculados: p.prog.pre, sem_rematricula: p.prog.pending, matriculas_sem_lead: p.noLead },
      }
      void ft
      const resp = await aiFetch({ method: 'POST', body: JSON.stringify({ action: 'campaign_month_report', payload: { institutionName: p.institutionName, month: label(month), snapshot: snap } }) })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || `Erro ${resp.status}`)
      const { data, error } = await supabase.from('campaign_month_reports').upsert({ institution_id: p.institutionId, cycle_id: p.cycleId, month, report: json.result, snapshot: snap, created_by: p.userId, created_at: new Date().toISOString(), emailed_at: null, emailed_to: null }, { onConflict: 'cycle_id,month' }).select('id').single()
      if (error) throw error
      await load(); setSel(data.id)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Não foi possível gerar o relatório.') } finally { setBusy(false) }
  }

  const sendMail = async () => {
    if (!open || !email.includes('@')) return
    setMailBusy(true); setMailMsg(null)
    try {
      const link = `${window.location.origin}/campanha?relatorio=${open.id}`
      const s = open.snapshot
      const { error } = await supabase.functions.invoke('campaign-report-email', { body: {
        to: email.trim(), school_name: p.institutionName, month_label: label(open.month), link, resumo: open.report?.resumo ?? '',
        novos: s ? `${s.novos.feito_mes} de ${s.novos.meta_mes}` : '', rematriculas: s ? `${s.rematriculas.feito_mes} de ${s.rematriculas.meta_mes}` : '',
      } })
      if (error) throw error
      await supabase.from('campaign_month_reports').update({ emailed_at: new Date().toISOString(), emailed_to: email.trim() }).eq('id', open.id)
      setMailMsg({ ok: true, t: `Link enviado para ${email.trim()}.` }); load()
    } catch (e) { setMailMsg({ ok: false, t: 'Não foi possível enviar: ' + (e instanceof Error ? e.message : 'erro') }) } finally { setMailBusy(false) }
  }

  const s = open?.snapshot, rep = open?.report
  const dev = (a: number, m: number) => m > 0 ? Math.round((a - m) / m * 100) : null
  const devTag = (a: number, m: number) => { const d = dev(a, m); return d == null ? null : <b style={{ color: d >= 0 ? '#15803D' : d > -30 ? '#B45309' : '#B91C1C' }}>{d > 0 ? '+' : ''}{d}%</b> }
  const prog = (a: number, m: number, c: string) => <div style={{ height: 10, borderRadius: 99, background: '#EDF1F0', overflow: 'hidden', marginTop: 8 }}><div style={{ width: `${Math.min(100, m ? a / m * 100 : 0)}%`, height: '100%', background: c, borderRadius: 99 }} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`@page { size: A4; margin: 12mm } @media print { body * { visibility: hidden !important } #rel-print, #rel-print * { visibility: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact } #rel-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 } #rel-print > div { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important } .no-print { display: none !important } .print-only { display: block !important } }`}</style>
      <div style={{ ...card, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }} className="no-print">
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Relatório do mês</div>
          <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 3 }}>Escolha o mês e gere a qualquer momento: placar contra a meta, compensação, funil, investimento e próximos passos. O ideal é gerar no fim do mês e mandar o link por e-mail ao gestor.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', maxWidth: '100%' }}>
          <select style={{ ...sel, maxWidth: '100%' }} value={month} onChange={e => setMonth(e.target.value)}>{opts.map(m => <option key={m} value={m}>{label(m)}{m === now ? ' (em andamento)' : ''}</option>)}</select>
          <button onClick={generate} disabled={busy || !opts.length} style={btn(busy || !opts.length)}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{rows.some(r => r.month === month) ? 'Gerar de novo' : 'Gerar relatório'}</button>
        </div>
      </div>
      {busy && <div style={{ ...card, color: BRAND.muted, fontSize: 13.5 }}>Juntando os números do mês e pedindo a análise à IA. Pode levar até um minuto.</div>}
      {err && <div style={{ ...card, color: BRAND.danger, fontSize: 13.5 }}>{err}</div>}

      {rows.length > 0 && (
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 700 }}>Relatórios gerados:</span>
          {rows.map(r => <button key={r.id} onClick={() => setSel(r.id)} style={{ padding: '6px 13px', borderRadius: 99, border: '1px solid #E3E8F0', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', background: sel_ === r.id ? '#05907B' : '#fff', color: sel_ === r.id ? '#fff' : BRAND.ink }}>{label(r.month)}</button>)}
        </div>
      )}
      {!rows.length && !busy && <div style={{ ...card, color: BRAND.muted, fontSize: 13.5 }}>Nenhum relatório gerado ainda para esta campanha.</div>}

      {open && s && (
        <>
          <div className="no-print" style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => window.print()} style={btn(false, true)}><Printer size={15} /> Imprimir / salvar em PDF</button>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="e-mail do gestor" style={{ ...sel, minWidth: 240 }} />
            <button onClick={sendMail} disabled={mailBusy || !email.includes('@')} style={btn(mailBusy || !email.includes('@'))}>{mailBusy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}Enviar link por e-mail</button>
            {mailMsg && <span style={{ fontSize: 13, fontWeight: 700, color: mailMsg.ok ? BRAND.success : BRAND.danger, display: 'inline-flex', gap: 5, alignItems: 'center' }}>{mailMsg.ok && <Check size={14} />}{mailMsg.t}</span>}
            {open.emailed_at && !mailMsg && <span style={{ fontSize: 12.5, color: BRAND.muted }}>Enviado em {new Date(open.emailed_at).toLocaleDateString('pt-BR')} para {open.emailed_to}</span>}
          </div>
          <div id="rel-print" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card, background: 'var(--aion-grad)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 18 }}>
              {logo && <div style={{ width: 84, height: 84, borderRadius: 18, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, flexShrink: 0, boxSizing: 'border-box' }}><img src={logo} alt={s.escola ?? ''} crossOrigin="anonymous" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, letterSpacing: 0.5 }}>RELATÓRIO MENSAL · CAMPANHA DE MATRÍCULAS {p.year}</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>{label(open.month)}</div>
                <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.95 }}>{s.escola ?? p.institutionName}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Gerado em {new Date(open.created_at).toLocaleString('pt-BR')}</div>
              </div>
            </div>
            {rep?.resumo && <div style={{ ...card, background: BRAND.softer, border: `1px solid ${BRAND.softLine}` }}><div style={{ fontSize: 12, fontWeight: 800, color: BRAND.primaryDark, textTransform: 'uppercase', marginBottom: 6 }}>Em resumo</div><div style={{ fontSize: 14.5, color: BRAND.ink, lineHeight: 1.6 }}>{rep.resumo}</div></div>}
            {(rep?.alertas ?? []).length > 0 && <div style={{ ...card, background: BRAND.warnSoft, border: '1px solid #FCD34D' }}>{(rep?.alertas ?? []).map((a, i) => <div key={i} style={{ fontSize: 13.5, color: BRAND.warn, display: 'flex', gap: 8, marginBottom: 4 }}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />{a}</div>)}</div>}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {([['Alunos novos', s.novos, '#7C3AED'], ['Rematrículas', s.rematriculas, '#059669']] as const).map(([t, k, c]) => (
                <div key={t} style={{ ...card, flex: '1 1 300px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>{t.toUpperCase()}</div>
                  <div style={{ display: 'flex', gap: 22, marginTop: 8, flexWrap: 'wrap' }}>
                    <div><div style={{ fontSize: 28, fontWeight: 800, color: c, lineHeight: 1 }}>{k.feito_mes}<span style={{ fontSize: 14, color: '#94A3B8' }}> / {k.meta_mes}</span></div><div style={{ fontSize: 12, color: '#64748B' }}>no mês {devTag(k.feito_mes, k.meta_mes)}</div></div>
                    <div><div style={{ fontSize: 28, fontWeight: 800, color: c, lineHeight: 1 }}>{k.feito_total}<span style={{ fontSize: 14, color: '#94A3B8' }}> / {k.meta_total}</span></div><div style={{ fontSize: 12, color: '#64748B' }}>na campanha, até aqui</div></div>
                  </div>
                  {prog(k.feito_total, k.meta_total, c)}
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>Esperado até o fim do mês: {k.esperado_ate_aqui} · feito: {k.feito_meses_fechados} ({k.feito_meses_fechados - k.esperado_ate_aqui >= 0 ? '+' : ''}{k.feito_meses_fechados - k.esperado_ate_aqui})</div>
                  {k.ajustada_proximos.length > 0 && <div style={{ fontSize: 12, color: '#B45309', marginTop: 4, fontWeight: 700 }}>Meta ajustada: {k.ajustada_proximos.map(a => `${monthName(a.m + '-01')} ${a.ajustada}`).join(' · ')}</div>}
                  {k.anos_anteriores_no_mes.length > 0 && <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Mesmo mês em {k.anos_anteriores_no_mes.map(a => `${a.ano}: ${a.no_mes}`).join(' · ')}</div>}
                </div>
              ))}
            </div>
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Funil acumulado da campanha: meta do mês × feito</div>
              {s.funil.map(f => (
                <div key={f.etapa} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ fontWeight: 700 }}>{f.etapa}</span><span><b>{f.feito}</b> <span style={{ color: '#94A3B8' }}>de {f.meta}</span> {devTag(f.feito, f.meta)}</span></div>
                  {prog(f.feito, f.meta, '#0EA5E9')}
                </div>
              ))}
              <div style={{ fontSize: 12, color: '#94A3B8' }}>Leads, agendamentos e visitas: a meta é a do mês; os números feitos são do mês. Etapas antigas podem ser estimadas.</div>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ ...card, flex: '1 1 300px' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Investimento</div>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>No mês: <b>{brl(s.investimento.mes)}</b><br />Acumulado: <b>{brl(s.investimento.acumulado)}</b><br />Custo por lead: <b>{brl(s.investimento.custo_por_lead)}</b><br />Custo por visita: <b>{brl(s.investimento.custo_por_visita)}</b><br />Custo por aluno novo (CPA): <b>{brl(s.investimento.cpa)}</b></div>
                {s.investimento.por_categoria.length > 0 && <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>{s.investimento.por_categoria.map(c => `${c.categoria} ${brl(c.valor)}`).join(' · ')}</div>}
              </div>
              <div style={{ ...card, flex: '1 1 300px' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Situação atual</div>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>Matriculados: <b>{s.situacao_atual.matriculados}</b><br />Pré-matriculados: <b>{s.situacao_atual.pre_matriculados}</b><br />Sem rematrícula: <b>{s.situacao_atual.sem_rematricula}</b><br />Matrículas sem lead: <b>{s.situacao_atual.matriculas_sem_lead}</b></div>
              </div>
            </div>
            {(rep?.secoes ?? []).map((sec, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>{sec.titulo}</div>
                {sec.texto && <div style={{ fontSize: 14, color: BRAND.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{sec.texto}</div>}
                {(sec.pontos ?? []).length > 0 && <ul style={{ margin: '10px 0 0', paddingLeft: 20, listStyle: 'disc', color: BRAND.text, fontSize: 14, lineHeight: 1.6 }}>{(sec.pontos ?? []).map((q, j) => <li key={j} style={{ marginBottom: 4 }}>{q}</li>)}</ul>}
              </div>
            ))}
            <div className="print-only" style={{ display: 'none', textAlign: 'center', fontSize: 11, color: '#94A3B8', paddingTop: 6 }}>Relatório gerado pelo Áion Edu · {s.escola ?? p.institutionName}</div>
          </div>
        </>
      )}
    </div>
  )
}
