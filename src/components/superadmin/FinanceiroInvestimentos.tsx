// src/components/superadmin/FinanceiroInvestimentos.tsx
// Investimentos gerais: um valor dividido entre as empresas (rateio), pago em parcelas.
// Cada parcela paga vira saída paga em cada empresa e reduz o saldo restante.
import { useEffect, useMemo, useState } from 'react'
import { Plus, X, CheckCircle2, Undo2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Company, brl, fmtDate, todayISO, addMonths, inp, lbl, btnPrimary } from './financeiroShared'

type Props = { showToast: (m: string, ok?: boolean) => void }
type Inv = { id: string; name: string; notes: string | null; total: number; installments: number; first_due: string; status: 'ativo' | 'cancelado' }
type Share = { investment_id: string; company_id: string; pct: number }
type Inst = { id: string; investment_id: string; no: number; due_date: string; amount: number; paid_at: string | null }
type EntryLite = { group_id: string; company_id: string; amount: number; status: string }

function NovoInvestimento({ companies, onClose, onSaved, showToast }: { companies: Company[]; onClose: () => void; onSaved: () => void; showToast: Props['showToast'] }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [total, setTotal] = useState('')
  const [n, setN] = useState('12')
  const [first, setFirst] = useState(addMonths(todayISO(), 1))
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(companies.map(c => [c.id, true])))
  const [pcts, setPcts] = useState<Record<string, string>>({})
  const [equal, setEqual] = useState(true)
  const [saving, setSaving] = useState(false)

  const chosen = companies.filter(c => sel[c.id])
  const pctOf = (id: string) => equal ? 100 / chosen.length : Number(String(pcts[id] || '0').replace(',', '.')) || 0
  const sum = chosen.reduce((s, c) => s + pctOf(c.id), 0)
  const totalNum = Number(String(total).replace(/\./g, '').replace(',', '.')) || 0
  const nNum = Math.max(1, Math.min(120, parseInt(n) || 1))

  const save = async () => {
    if (!name.trim()) return showToast('Dê um nome ao investimento.', false)
    if (totalNum <= 0) return showToast('Informe o valor total.', false)
    if (chosen.length === 0) return showToast('Escolha ao menos uma empresa.', false)
    if (Math.abs(sum - 100) > 0.01) return showToast(`O rateio precisa somar 100% (hoje soma ${sum.toFixed(1)}%).`, false)
    setSaving(true)
    // Divisão igual: a última empresa fecha a conta em 100%.
    let acc = 0
    const shares = chosen.map((c, i) => {
      const p = equal ? (i === chosen.length - 1 ? +(100 - acc).toFixed(3) : +(100 / chosen.length).toFixed(3)) : pctOf(c.id)
      acc += p; return { company_id: c.id, pct: p }
    })
    const { error } = await supabase.rpc('fin_create_investment', { p_name: name.trim(), p_notes: notes.trim() || null, p_total: totalNum, p_installments: nNum, p_first_due: first, p_shares: shares })
    setSaving(false)
    if (error) return showToast('Não foi possível criar: ' + error.message, false)
    showToast('Investimento criado.')
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-gray-900">Novo investimento</h3>
          <button onClick={onClose} aria-label="Fechar"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 pb-28 sm:pb-5 space-y-4">
          <div><label className={lbl}>Nome</label><input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Plataforma, equipamentos, marca" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1"><label className={lbl}>Valor total (R$)</label><input className={inp} inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} placeholder="0,00" /></div>
            <div><label className={lbl}>Parcelas</label><input className={inp} inputMode="numeric" value={n} onChange={e => setN(e.target.value)} /></div>
            <div><label className={lbl}>1º vencimento</label><input type="date" className={inp} value={first} onChange={e => setFirst(e.target.value)} /></div>
          </div>
          {totalNum > 0 && <p className="text-xs text-gray-500 -mt-2">{nNum}x de cerca de {brl(totalNum / nNum)}, uma por mês.</p>}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lbl + ' mb-0'}>Quem paga</label>
              <div className="flex text-xs rounded-lg border border-gray-200 overflow-hidden">
                <button onClick={() => setEqual(true)} className={`px-3 py-1 ${equal ? 'bg-cyan-600 text-white' : 'text-gray-600'}`}>Dividir igual</button>
                <button onClick={() => setEqual(false)} className={`px-3 py-1 ${!equal ? 'bg-cyan-600 text-white' : 'text-gray-600'}`}>Definir %</button>
              </div>
            </div>
            <div className="space-y-2">
              {companies.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 flex-1 text-sm text-gray-800">
                    <input type="checkbox" checked={!!sel[c.id]} onChange={e => setSel(s => ({ ...s, [c.id]: e.target.checked }))} className="rounded" />
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}
                  </label>
                  {sel[c.id] && (equal
                    ? <span className="text-sm text-gray-500 w-24 text-right">{(100 / chosen.length).toFixed(1)}%{totalNum > 0 ? ` · ${brl(totalNum / chosen.length)}` : ''}</span>
                    : <div className="flex items-center gap-1"><input className={inp + ' w-20 text-right'} inputMode="decimal" value={pcts[c.id] || ''} onChange={e => setPcts(p => ({ ...p, [c.id]: e.target.value }))} /><span className="text-sm text-gray-500">%</span></div>)}
                </div>
              ))}
            </div>
            {!equal && <p className={`text-xs mt-2 ${Math.abs(sum - 100) > 0.01 ? 'text-amber-600' : 'text-emerald-600'}`}>Soma: {sum.toFixed(1)}%</p>}
          </div>
          <div><label className={lbl}>Observação (opcional)</label><input className={inp} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <button onClick={save} disabled={saving} className={btnPrimary + ' w-full'}>{saving ? 'Criando…' : 'Criar investimento'}</button>
        </div>
      </div>
    </div>
  )
}

export default function FinanceiroInvestimentos({ showToast }: Props) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [invs, setInvs] = useState<Inv[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [insts, setInsts] = useState<Inst[]>([])
  const [ents, setEnts] = useState<EntryLite[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const [c, i, s, p] = await Promise.all([
      supabase.from('fin_companies').select('*').order('sort_order'),
      supabase.from('fin_investments').select('*').order('created_at', { ascending: false }),
      supabase.from('fin_investment_shares').select('*'),
      supabase.from('fin_investment_installments').select('*').order('no'),
    ])
    const ids = (i.data || []).map((x: any) => x.id)
    const e = ids.length ? await supabase.from('financial_entries').select('group_id,company_id,amount,status').in('group_id', ids).like('external_ref', 'inv:%') : { data: [], error: null as any }
    const err = c.error || i.error || s.error || p.error || e.error
    if (err) showToast('Não foi possível carregar os investimentos: ' + err.message, false)
    setCompanies(((c.data || []) as Company[]).filter(x => x.active))
    setInvs(((i.data || []) as any[]).map(x => ({ ...x, total: Number(x.total) })))
    setShares(((s.data || []) as any[]).map(x => ({ ...x, pct: Number(x.pct) })))
    setInsts(((p.data || []) as any[]).map(x => ({ ...x, amount: Number(x.amount) })))
    setEnts(((e.data || []) as any[]).map(x => ({ ...x, amount: Number(x.amount) })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const compName = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies])

  const toggle = async (inst: Inst) => {
    setBusy(inst.id)
    const { error } = await supabase.rpc('fin_pay_investment_installment', { p_installment: inst.id, p_date: todayISO(), p_paid: !inst.paid_at })
    setBusy(null)
    if (error) return showToast('Não foi possível atualizar a parcela: ' + error.message, false)
    showToast(inst.paid_at ? 'Pagamento desfeito.' : 'Parcela marcada como paga.')
    load()
  }
  const cancel = async (inv: Inv) => {
    if (!window.confirm(`Cancelar "${inv.name}"? As parcelas em aberto saem do financeiro. O que já foi pago continua registrado.`)) return
    const del = await supabase.from('financial_entries').delete().eq('group_id', inv.id).like('external_ref', 'inv:%').eq('status', 'pendente')
    if (del.error) return showToast('Não foi possível cancelar: ' + del.error.message, false)
    const up = await supabase.from('fin_investments').update({ status: 'cancelado' }).eq('id', inv.id)
    if (up.error) return showToast('Não foi possível cancelar: ' + up.error.message, false)
    showToast('Investimento cancelado.'); load()
  }

  if (loading) return <div className="py-16 text-center text-sm text-gray-400">Carregando investimentos…</div>
  const active = invs.filter(i => i.status === 'ativo'), cancelled = invs.filter(i => i.status === 'cancelado')
  const sumActive = active.reduce((s, i) => s + i.total, 0)
  const paidActive = active.reduce((s, i) => s + insts.filter(x => x.investment_id === i.id && x.paid_at).reduce((a, x) => a + x.amount, 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Investimentos gerais</h2>
          <p className="text-xs text-gray-400">Um valor dividido entre as empresas e pago em parcelas. Cada parcela paga reduz o saldo restante.</p>
        </div>
        <button onClick={() => setModal(true)} className={btnPrimary + ' px-4'}><Plus className="w-4 h-4" />Novo investimento</button>
      </div>

      {active.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[{ l: 'Investido (total)', v: sumActive }, { l: 'Já pago', v: paidActive }, { l: 'Falta pagar', v: sumActive - paidActive }].map(k => (
            <div key={k.l} className="bg-white rounded-2xl border border-gray-200 p-4"><p className="text-xs text-gray-500 mb-1">{k.l}</p><p className="text-xl sm:text-2xl font-bold text-gray-900">{brl(k.v)}</p></div>
          ))}
        </div>
      )}

      {invs.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <p className="font-semibold text-gray-800">Nenhum investimento ainda</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">Cadastre o valor total, escolha as empresas que dividem e em quantas parcelas.</p>
          <button onClick={() => setModal(true)} className={btnPrimary + ' px-5'}><Plus className="w-4 h-4" />Novo investimento</button>
        </div>
      )}

      {[...active, ...cancelled].map(inv => {
        const list = insts.filter(i => i.investment_id === inv.id)
        const paid = list.filter(i => i.paid_at).reduce((s, i) => s + i.amount, 0)
        const pct = inv.total > 0 ? Math.round((paid / inv.total) * 100) : 0
        const sh = shares.filter(s => s.investment_id === inv.id)
        const done = list.filter(i => i.paid_at).length
        return (
          <div key={inv.id} className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${inv.status === 'cancelado' ? 'opacity-60' : ''}`}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">{inv.name}{inv.status === 'cancelado' && <span className="ml-2 text-xs font-semibold text-gray-500 bg-gray-100 rounded px-2 py-0.5">Cancelado</span>}</h3>
                  {inv.notes && <p className="text-xs text-gray-400">{inv.notes}</p>}
                </div>
                {inv.status === 'ativo' && <button onClick={() => cancel(inv)} className="text-gray-300 hover:text-red-500" aria-label="Cancelar investimento"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
                <div><p className="text-xs text-gray-500">Falta pagar</p><p className="text-2xl font-bold text-gray-900">{brl(inv.total - paid)}</p></div>
                <p className="text-xs text-gray-500">{done} de {inv.installments} parcelas pagas · total {brl(inv.total)}</p>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all" style={{ width: pct + '%' }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{pct}% pago</p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sh.map(s => {
                  const mine = ents.filter(e => e.group_id === inv.id && e.company_id === s.company_id)
                  const tot = mine.reduce((a, e) => a + e.amount, 0), pd = mine.filter(e => e.status === 'pago').reduce((a, e) => a + e.amount, 0)
                  const c = compName.get(s.company_id)
                  return (
                    <div key={s.company_id} className="rounded-xl bg-gray-50 px-3 py-2 text-xs">
                      <div className="flex justify-between font-semibold text-gray-800"><span><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: c?.color }} />{c?.name}</span><span>{s.pct.toFixed(1).replace('.0', '')}%</span></div>
                      <div className="flex justify-between text-gray-500 mt-0.5"><span>pago {brl(pd)}</span><span>falta {brl(Math.max(0, tot - pd))}</span></div>
                    </div>
                  )
                })}
              </div>
            </div>
            {inv.status === 'ativo' && (
              <details className="border-t border-gray-100" open={list.length <= 4}>
                <summary className="px-5 py-3 text-sm font-semibold text-gray-700 cursor-pointer select-none">Parcelas</summary>
                <ul className="px-5 pb-3">
                  {list.map(i => {
                    const late = !i.paid_at && i.due_date < todayISO()
                    return (
                      <li key={i.id} className="flex items-center gap-3 py-2 border-t border-gray-100 text-sm">
                        <span className="w-10 text-gray-400 text-xs">{i.no}/{inv.installments}</span>
                        <span className={`flex-1 ${late ? 'text-red-600' : 'text-gray-600'}`}>{fmtDate(i.due_date)}{late && ' · vencida'}{i.paid_at && <span className="text-emerald-600"> · paga em {fmtDate(i.paid_at)}</span>}</span>
                        <span className="font-semibold text-gray-900">{brl(i.amount)}</span>
                        <button disabled={busy === i.id} onClick={() => toggle(i)}
                          className={`flex items-center gap-1 text-xs font-semibold rounded-lg px-2.5 py-1.5 border ${i.paid_at ? 'text-gray-500 border-gray-200 hover:bg-gray-50' : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'}`}>
                          {i.paid_at ? <><Undo2 className="w-3.5 h-3.5" />Desfazer</> : <><CheckCircle2 className="w-3.5 h-3.5" />Marcar paga</>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </details>
            )}
          </div>
        )
      })}
      {modal && <NovoInvestimento companies={companies} onClose={() => setModal(false)} onSaved={load} showToast={showToast} />}
    </div>
  )
}
