// src/components/superadmin/FinanceiroRelatorios.tsx
// Relatório por empresa ou geral: resultado do período por categoria, com o detalhe de cada lançamento.
// Regime de caixa: só entra o que está pago, na data em que o dinheiro entrou/saiu.
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Company, Category, Entry, GROUPS, brl, fmtDate, inRange } from './financeiroShared'

type Props = { periodStart: string; periodEnd: string; periodLabel: string; showToast: (m: string, ok?: boolean) => void }
type Line = { key: string; name: string; entries: Entry[]; total: number }

export default function FinanceiroRelatorios({ periodStart, periodEnd, periodLabel, showToast }: Props) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<string>('all')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    (async () => {
      const [c, g, e] = await Promise.all([
        supabase.from('fin_companies').select('*').order('sort_order'),
        supabase.from('fin_categories').select('*').order('sort_order'),
        supabase.from('financial_entries')
          .select('id,type,amount,description,category,entry_date,due_date,status,company_id,notes,folha_tipo,source,account_id,category_id,payment_method,installment_no,installment_total,group_id,recurrence_id')
          .eq('status', 'pago').gte('entry_date', periodStart).lte('entry_date', periodEnd).order('entry_date', { ascending: false }).limit(5000),
      ])
      if (c.error || g.error || e.error) showToast('Não foi possível carregar o relatório: ' + (c.error || g.error || e.error)!.message, false)
      setCompanies(((c.data || []) as Company[]).filter(x => x.active))
      setCategories((g.data || []) as Category[])
      setEntries(((e.data || []) as any[]).map(x => ({ ...x, amount: Number(x.amount) })) as Entry[])
      setLoading(false)
    })()
  }, [periodStart, periodEnd])

  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const scoped = useMemo(() => entries.filter(e => inRange(e.entry_date, periodStart, periodEnd) && (scope === 'all' || e.company_id === scope)), [entries, scope, periodStart, periodEnd])

  const totals = (list: Entry[]) => {
    const ent = list.filter(e => e.type === 'entrada').reduce((s, e) => s + e.amount, 0)
    const sai = list.filter(e => e.type === 'saida').reduce((s, e) => s + e.amount, 0)
    return { ent, sai, res: ent - sai }
  }
  const t = totals(scoped)

  // Linhas por categoria dentro de cada grupo (receita/custo/despesa). Sem categoria vai para "Sem categoria".
  const groups = useMemo(() => {
    const out: { grp: 'receita' | 'custo' | 'despesa'; lines: Line[]; total: number }[] = []
    for (const grp of ['receita', 'custo', 'despesa'] as const) {
      const map = new Map<string, Line>()
      for (const e of scoped) {
        const cat = e.category_id ? catById.get(e.category_id) : undefined
        const g = cat ? cat.grp : (e.type === 'entrada' ? 'receita' : 'despesa')
        if (g !== grp) continue
        const key = cat?.id || 'none-' + grp
        const line = map.get(key) || { key, name: cat?.name || 'Sem categoria', entries: [], total: 0 }
        line.entries.push(e); line.total += e.type === 'entrada' ? e.amount : -e.amount
        map.set(key, line)
      }
      const lines = [...map.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      out.push({ grp, lines, total: lines.reduce((s, l) => s + l.total, 0) })
    }
    return out
  }, [scoped, catById])

  const companyRows = useMemo(() => companies.map(c => ({ c, ...totals(entries.filter(e => e.company_id === c.id)) })), [companies, entries])
  const scopeName = scope === 'all' ? 'Todas as empresas' : companies.find(c => c.id === scope)?.name || ''

  const exportCsv = () => {
    const company = new Map(companies.map(c => [c.id, c.name]))
    const rows = [['Data', 'Empresa', 'Tipo', 'Categoria', 'Descrição', 'Valor']]
    for (const e of [...scoped].sort((a, b) => a.entry_date.localeCompare(b.entry_date))) {
      rows.push([e.entry_date, company.get(e.company_id) || '', e.type, (e.category_id && catById.get(e.category_id)?.name) || 'Sem categoria', e.description, (e.type === 'entrada' ? '' : '-') + e.amount.toFixed(2).replace('.', ',')])
    }
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `relatorio-${scopeName.toLowerCase().replace(/\s+/g, '-')}-${periodStart}-${periodEnd}.csv`
    a.click(); URL.revokeObjectURL(a.href)
  }

  if (loading) return <div className="py-16 text-center text-sm text-gray-400">Carregando relatório…</div>

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          {[{ id: 'all', name: 'Geral (todas juntas)', color: '#0891b2' }, ...companies].map(c => (
            <button key={c.id} onClick={() => setScope(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${scope === c.id ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-600 border-gray-200 hover:border-cyan-300'}`}>
              <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: c.color }} />{c.name}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-cyan-700 px-3 py-1.5 rounded-lg border border-gray-200"><Download className="w-3.5 h-3.5" />Planilha (CSV)</button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-cyan-700 px-3 py-1.5 rounded-lg border border-gray-200"><Printer className="w-3.5 h-3.5" />Imprimir</button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900">{scopeName}</h2>
        <p className="text-xs text-gray-400">Relatório de {periodLabel}. Só valores pagos, na data em que o dinheiro entrou ou saiu.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[{ l: 'Entradas', v: t.ent, c: 'text-emerald-600' }, { l: 'Saídas', v: t.sai, c: 'text-rose-600' }, { l: 'Resultado', v: t.res, c: t.res < 0 ? 'text-red-600' : 'text-gray-900' }].map(k => (
          <div key={k.l} className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{k.l}</p>
            <p className={`text-xl sm:text-2xl font-bold ${k.c}`}>{brl(k.v)}</p>
          </div>
        ))}
      </div>

      {scope === 'all' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100"><h3 className="font-bold text-gray-900 text-sm">Empresa por empresa</h3><p className="text-xs text-gray-400">Toque numa linha para abrir o relatório só dela.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[460px]">
              <thead className="text-xs text-gray-500 bg-gray-50"><tr><th className="text-left px-5 py-2">Empresa</th><th className="text-right px-3 py-2">Entradas</th><th className="text-right px-3 py-2">Saídas</th><th className="text-right px-5 py-2">Resultado</th></tr></thead>
              <tbody>
                {companyRows.map(r => (
                  <tr key={r.c.id} onClick={() => setScope(r.c.id)} className="border-t border-gray-100 hover:bg-cyan-50/40 cursor-pointer">
                    <td className="px-5 py-2.5 font-medium text-gray-800"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: r.c.color }} />{r.c.name}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">{brl(r.ent)}</td>
                    <td className="px-3 py-2.5 text-right text-rose-700">{brl(r.sai)}</td>
                    <td className={`px-5 py-2.5 text-right font-semibold ${r.res < 0 ? 'text-red-600' : 'text-gray-900'}`}>{brl(r.res)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="px-5 py-2.5">Total do grupo</td><td className="px-3 py-2.5 text-right">{brl(t.ent)}</td><td className="px-3 py-2.5 text-right">{brl(t.sai)}</td>
                  <td className={`px-5 py-2.5 text-right ${t.res < 0 ? 'text-red-600' : ''}`}>{brl(t.res)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100"><h3 className="font-bold text-gray-900 text-sm">Resultado por categoria</h3><p className="text-xs text-gray-400 print:hidden">Toque numa categoria para ver cada lançamento.</p></div>
        {scoped.length === 0 && <p className="px-5 py-10 text-center text-sm text-gray-400">Nada pago neste período em {scopeName}.</p>}
        {groups.filter(g => g.lines.length > 0).map(g => (
          <div key={g.grp}>
            <div className="flex justify-between px-5 py-2 bg-gray-50 border-t border-gray-100 text-xs font-bold text-gray-600">
              <span>{GROUPS[g.grp]}</span><span className={g.total < 0 ? 'text-red-600' : ''}>{brl(g.total)}</span>
            </div>
            {g.lines.map(l => {
              const k = g.grp + l.key, isOpen = !!open[k]
              return (
                <div key={k} className="border-t border-gray-100">
                  <button onClick={() => setOpen(o => ({ ...o, [k]: !o[k] }))} className="w-full flex items-center gap-2 px-5 py-2.5 text-sm text-left hover:bg-gray-50">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="flex-1 text-gray-800">{l.name} <span className="text-xs text-gray-400">({l.entries.length})</span></span>
                    <span className={`font-semibold ${l.total < 0 ? 'text-red-600' : 'text-gray-900'}`}>{brl(l.total)}</span>
                  </button>
                  {(isOpen || false) && (
                    <ul className="bg-gray-50/60 px-5 pb-2">
                      {l.entries.map(e => (
                        <li key={e.id} className="flex items-center gap-3 py-1.5 text-xs border-t border-gray-100 first:border-0">
                          <span className="w-16 text-gray-400 flex-shrink-0">{fmtDate(e.entry_date).slice(0, 5)}</span>
                          {scope === 'all' && <span className="w-20 text-gray-500 flex-shrink-0 truncate">{companies.find(c => c.id === e.company_id)?.name.replace('Áion ', '')}</span>}
                          <span className="flex-1 text-gray-700 truncate">{e.description}</span>
                          <span className={e.type === 'saida' ? 'text-rose-600' : 'text-emerald-700'}>{e.type === 'saida' ? '-' : ''}{brl(e.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
