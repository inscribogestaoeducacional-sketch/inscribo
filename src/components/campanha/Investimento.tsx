// Aba Investimento: gastos da campanha por categoria e mês, meta de gasto e custo por aquisição (lead, visita, matrícula nova).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { monthName, monthsBetween } from '../../lib/campaignPlan'

interface Exp { id: string; category: string; description: string | null; channel: string | null; is_paid_traffic: boolean; amount: number; month: string }
interface Base {
  leads: number; visits: number; novos: number; monthly: { m: string; novos: number }[]; leads_by_month: Record<string, number>
  by_origin: { source: string; leads: number; matriculas: number }[]
}
const CATS = ['Tráfego pago', 'Outdoor', 'Camisas', 'Brindes', 'Eventos', 'Material gráfico', 'Outros']
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brl2 = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: '18px 20px' }
const th: React.CSSProperties = { fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', padding: '8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px', textAlign: 'right', fontSize: 13, borderTop: '1px solid #EEF2F1' }
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13.5, width: '100%', boxSizing: 'border-box', color: BRAND.ink, background: '#fff', fontFamily: 'inherit' }
const lbl: React.CSSProperties = { fontSize: 11.5, color: '#64748B', fontWeight: 700, margin: '8px 0 3px' }
const per = (a: number, b: number) => (b > 0 ? brl(a / b) : '—')

export default function Investimento({ institutionId, year, from, to }: { institutionId: string; year: number; from: string; to: string }) {
  const [exps, setExps] = useState<Exp[]>([])
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [base, setBase] = useState<Base | null>(null)
  const [err, setErr] = useState('')
  const months = useMemo(() => monthsBetween(from, to), [from, to])
  const [cat, setCat] = useState(CATS[0]); const [customCat, setCustomCat] = useState('')
  const [desc, setDesc] = useState(''); const [channel, setChannel] = useState(''); const [paid, setPaid] = useState(false)
  const [amount, setAmount] = useState(''); const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [e, b, d] = await Promise.all([
      supabase.from('campaign_expenses').select('id, category, description, channel, is_paid_traffic, amount, month').eq('institution_id', institutionId).eq('target_year', year).order('month'),
      supabase.from('campaign_expense_budgets').select('category, budget').eq('institution_id', institutionId).eq('target_year', year),
      supabase.rpc('campaign_investment_base', { p_inst: institutionId, p_year: year, p_from: from, p_to: to }),
    ])
    if (e.error || d.error) { setErr((e.error ?? d.error)!.message); return }
    setExps(((e.data ?? []) as Exp[]).map(x => ({ ...x, amount: Number(x.amount) })))
    setBudgets(Object.fromEntries(((b.data ?? []) as { category: string; budget: number }[]).map(x => [x.category, Number(x.budget)])))
    setBase(d.data as Base)
  }, [institutionId, year, from, to])
  useEffect(() => { load() }, [load])

  const categories = useMemo(() => [...new Set([...CATS.filter(c => exps.some(x => x.category === c) || c in budgets), ...exps.map(x => x.category), ...Object.keys(budgets)])], [exps, budgets])
  const total = exps.reduce((a, x) => a + x.amount, 0)
  const budgetTotal = Object.values(budgets).reduce((a, b) => a + b, 0)
  const spent = (c: string, m?: string) => exps.filter(x => x.category === c && (!m || x.month === m)).reduce((a, x) => a + x.amount, 0)
  const spentMonth = (m: string) => exps.filter(x => x.month === m).reduce((a, x) => a + x.amount, 0)

  const add = async () => {
    const category = (cat === '__novo' ? customCat : cat).trim()
    const value = Number(amount.replace(/\./g, '').replace(',', '.'))
    if (!category || !(value >= 0) || !amount) { setErr('Informe a categoria e o valor.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('campaign_expenses').insert({ institution_id: institutionId, target_year: year, category, description: desc.trim() || null, channel: channel || null, is_paid_traffic: paid, amount: value, month })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setDesc(''); setAmount(''); setCustomCat(''); load()
  }
  const remove = async (id: string) => { await supabase.from('campaign_expenses').delete().eq('id', id); load() }
  const setBudget = async (category: string, v: string) => {
    const budget = Number(v.replace(/\./g, '').replace(',', '.')) || 0
    await supabase.from('campaign_expense_budgets').upsert({ institution_id: institutionId, target_year: year, category, budget })
    load()
  }

  if (!base) return err ? <div style={{ color: '#B91C1C', fontSize: 13 }}>{err}</div> : <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>

  // por canal: gasto que o gestor ligou a uma origem × leads e matrículas da origem
  const channels = base.by_origin.map(o => {
    const rows = exps.filter(x => x.channel === o.source)
    const g = rows.reduce((a, x) => a + x.amount, 0)
    return { ...o, gasto: g, pago: rows.some(x => x.is_paid_traffic) }
  })
  const novosMes = (m: string) => base.monthly.find(x => x.m === m)?.novos ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1 1 220px' }}><div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B' }}>INVESTIMENTO TOTAL</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: BRAND.ink }}>{brl(total)}</div>
          {budgetTotal > 0 && <><div style={{ height: 10, borderRadius: 99, background: '#EDF1F0', marginTop: 8, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, total / budgetTotal * 100)}%`, height: '100%', background: total > budgetTotal ? '#DC2626' : '#00A896' }} /></div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{Math.round(total / budgetTotal * 100)}% da meta de {brl(budgetTotal)}</div></>}</div>
        <div style={{ ...card, flex: '1 1 160px' }}><div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B' }}>CUSTO POR LEAD</div><div style={{ fontSize: 28, fontWeight: 800 }}>{per(total, base.leads)}</div><div style={{ fontSize: 12, color: '#94A3B8' }}>{base.leads} leads</div></div>
        <div style={{ ...card, flex: '1 1 160px' }}><div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B' }}>CUSTO POR VISITA</div><div style={{ fontSize: 28, fontWeight: 800 }}>{per(total, base.visits)}</div><div style={{ fontSize: 12, color: '#94A3B8' }}>{base.visits} visitas</div></div>
        <div style={{ ...card, flex: '1 1 200px' }}><div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B' }}>CPA: CUSTO POR ALUNO NOVO</div><div style={{ fontSize: 28, fontWeight: 800, color: '#7C3AED' }}>{per(total, base.novos)}</div><div style={{ fontSize: 12, color: '#94A3B8' }}>{base.novos} novatos matriculados</div></div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '2 1 480px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Investimento por categoria e mês</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Categoria</th>{months.map(m => <th key={m} style={th}>{monthName(m + '-01').slice(0, 3)}</th>)}<th style={th}>Total</th><th style={th}>Meta</th></tr></thead>
              <tbody>
                {categories.map(c => (
                  <tr key={c}><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{c}</td>{months.map(m => <td key={m} style={td}>{spent(c, m) ? spent(c, m).toLocaleString('pt-BR') : '—'}</td>)}
                    <td style={{ ...td, fontWeight: 800 }}>{spent(c).toLocaleString('pt-BR')}</td>
                    <td style={td}><input defaultValue={budgets[c] ? String(budgets[c]) : ''} placeholder="—" onBlur={e => setBudget(c, e.target.value)} style={{ ...inp, width: 90, textAlign: 'right', padding: '4px 8px' }} /></td></tr>
                ))}
                <tr style={{ background: '#F8FAFC' }}><td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>Total</td>{months.map(m => <td key={m} style={{ ...td, fontWeight: 700 }}>{spentMonth(m) ? spentMonth(m).toLocaleString('pt-BR') : '—'}</td>)}
                  <td style={{ ...td, fontWeight: 800 }}>{total.toLocaleString('pt-BR')}</td><td style={td}>{budgetTotal ? budgetTotal.toLocaleString('pt-BR') : '—'}</td></tr>
                <tr><td style={{ ...td, textAlign: 'left', fontWeight: 700, color: '#7C3AED' }}>CPA do mês</td>{months.map(m => <td key={m} style={{ ...td, color: '#7C3AED' }}>{spentMonth(m) && novosMes(m) ? brl(spentMonth(m) / novosMes(m)) : '—'}</td>)}<td style={{ ...td, fontWeight: 800, color: '#7C3AED' }}>{per(total, base.novos)}</td><td style={td} /></tr>
                <tr><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>Custo por lead</td>{months.map(m => <td key={m} style={td}>{spentMonth(m) && base.leads_by_month[m] ? brl(spentMonth(m) / base.leads_by_month[m]) : '—'}</td>)}<td style={{ ...td, fontWeight: 800 }}>{per(total, base.leads)}</td><td style={td} /></tr>
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: BRAND.muted, margin: '8px 0 0' }}>Valores em reais. A meta de cada categoria é editável na própria célula.</p>
        </div>
        <div style={{ ...card, flex: '1 1 300px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Lançar gasto</div>
          <div style={lbl}>Categoria</div>
          <select value={cat} onChange={e => setCat(e.target.value)} style={inp}>{CATS.map(c => <option key={c}>{c}</option>)}<option value="__novo">Outra (digitar)…</option></select>
          {cat === '__novo' && <input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="Nome da categoria" style={{ ...inp, marginTop: 6 }} />}
          <div style={lbl}>O que foi (opcional)</div>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: sacolinhas, copo para a professora" style={inp} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><div style={lbl}>Valor (R$)</div><input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" style={inp} /></div>
            <div style={{ flex: 1 }}><div style={lbl}>Mês</div><select value={month} onChange={e => setMonth(e.target.value)} style={inp}>{months.map(m => <option key={m} value={m}>{monthName(m + '-01')}</option>)}</select></div>
          </div>
          <div style={lbl}>Canal de origem (opcional)</div>
          <select value={channel} onChange={e => setChannel(e.target.value)} style={inp}><option value="">Sem canal específico</option>{base.by_origin.map(o => <option key={o.source}>{o.source}</option>)}</select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, margin: '10px 0', cursor: 'pointer' }}><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> Tráfego pago (anúncio)</label>
          {err && <div style={{ color: '#B91C1C', fontSize: 12.5, marginBottom: 6 }}>{err}</div>}
          <button onClick={add} disabled={saving} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#065F52,#00A896)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>Salvar gasto</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Por canal de origem: quanto custa cada aluno</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ ...th, textAlign: 'left' }}>Origem</th><th style={th}>Leads</th><th style={th}>Matrículas</th><th style={th}>Gasto ligado</th><th style={th}>Custo/lead</th><th style={th}>Custo/matrícula</th></tr></thead>
          <tbody>{channels.map(c => (
            <tr key={c.source}><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{c.source} {c.pago && <span style={{ background: '#DBEAFE', color: '#2563EB', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>pago</span>}</td>
              <td style={td}>{c.leads}</td><td style={td}>{c.matriculas}</td><td style={td}>{c.gasto ? brl(c.gasto) : '—'}</td><td style={td}>{c.gasto ? per(c.gasto, c.leads) : '—'}</td><td style={td}>{c.gasto && c.matriculas ? per(c.gasto, c.matriculas) : '—'}</td></tr>
          ))}</tbody>
        </table>
        <p style={{ fontSize: 12, color: BRAND.muted, margin: '8px 0 0' }}>Só entram aqui os gastos em que você escolheu o canal. Os demais contam no total e no CPA geral.</p>
      </div>

      {exps.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Gastos lançados</div>
          {[...exps].reverse().map(x => (
            <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid #EEF2F1', fontSize: 13 }}>
              <span style={{ width: 90, color: BRAND.muted }}>{monthName(x.month + '-01')}</span>
              <span style={{ flex: 1 }}><b>{x.category}</b>{x.description ? ` · ${x.description}` : ''}{x.channel ? ` · ${x.channel}` : ''}{x.is_paid_traffic ? ' · pago' : ''}</span>
              <b>{brl2(x.amount)}</b>
              <button onClick={() => remove(x.id)} title="Apagar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
