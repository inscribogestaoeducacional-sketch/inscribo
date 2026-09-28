// =============================================================================
// src/components/superadmin/AdminBroadcastPricing.tsx
//
// Super Admin — "Tabela de preço — Transmissões" (/super-admin/transmissoes/precos).
// Duas abas:
//   - Tabela de preço: versão vigente, histórico imutável (toda versão congela
//     ao entrar em vigor — broadcast_price_version_guard) e criação de versão
//     nova com confirmação comparando vigente × proposta. Grava só por
//     broadcast_create_price_version (exige as 3 categorias BR, numera sem
//     buraco, recusa vigência retroativa).
//   - Visão geral: todas as escolas que usam o módulo, via
//     broadcast_institution_summary(NULL, …) — mesma função do resumo por
//     escola; margem e custo da Meta só aparecem pro Super Admin.
// =============================================================================
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, Plus, History, AlertTriangle, X, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'

type Category = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: 'MARKETING',      label: 'Marketing',    hint: 'Campanhas, divulgação' },
  { key: 'UTILITY',        label: 'Utilidade',    hint: 'Avisos, lembretes' },
  { key: 'AUTHENTICATION', label: 'Autenticação', hint: 'Códigos de acesso' },
]

interface Version { id: string; version_number: number; effective_from: string; notes: string | null; created_at: string; created_by: string | null }
interface Item { version_id: string; category: Category; country_code: string; meta_unit_cost_brl: number; aion_unit_fee_brl: number }
type Draft = Record<Category, { meta: string; fee: string }>

const brl = (n: number | null | undefined, digits = 2) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits })
const unit = (n: number) => brl(n, 4)
const fmtDateTime = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const parseMoney = (s: string) => Number(String(s).replace(',', '.'))
const validMoney = (s: string) => /^\d+([.,]\d{1,4})?$/.test(String(s).trim())

export default function AdminBroadcastPricing() {
  const [tab, setTab] = useState<'prices' | 'overview'>('prices')
  // Toda tela do Super Admin se embrulha no próprio layout (o App.tsx só
  // aponta a rota) — sem isto o menu lateral some ao abrir a tela.
  return (
    <SuperAdminLayout>
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center"><Send className="w-5 h-5 text-sky-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tabela de preço — Transmissões</h1>
            <p className="text-sm text-gray-500">Preço por mensagem das campanhas das escolas e o resultado do módulo</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['prices', 'Tabela de preço'], ['overview', 'Visão geral das escolas']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'prices' ? <PricesTab /> : <OverviewTab />}
    </div>
    </SuperAdminLayout>
  )
}

// ── Aba: tabela de preço ─────────────────────────────────────────────────────

function PricesTab() {
  const [versions, setVersions] = useState<Version[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [authors, setAuthors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: it }] = await Promise.all([
      supabase.from('broadcast_price_versions').select('*').order('version_number', { ascending: false }),
      supabase.from('broadcast_price_items').select('version_id, category, country_code, meta_unit_cost_brl, aion_unit_fee_brl'),
    ])
    const vs = (v || []) as Version[]
    setVersions(vs)
    setItems(((it || []) as any[]).map(i => ({ ...i, meta_unit_cost_brl: Number(i.meta_unit_cost_brl), aion_unit_fee_brl: Number(i.aion_unit_fee_brl) })))
    const ids = [...new Set(vs.map(x => x.created_by).filter(Boolean))] as string[]
    if (ids.length) {
      const { data: us } = await supabase.from('users').select('id, full_name').in('id', ids)
      setAuthors(Object.fromEntries(((us || []) as any[]).map(u => [u.id, u.full_name])))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const now = Date.now()
  const current = versions.find(v => new Date(v.effective_from).getTime() <= now) || null
  const scheduled = versions.filter(v => new Date(v.effective_from).getTime() > now)
  const itemsOf = (vid: string) => items.filter(i => i.version_id === vid && i.country_code === 'BR')
  const priceOf = (vid: string | undefined, c: Category) => vid ? itemsOf(vid).find(i => i.category === c) : undefined

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-cyan-600 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {current ? <>Versão vigente: v{current.version_number}</> : 'Nenhuma versão em vigor'}
            </h2>
            {current && <p className="text-xs text-gray-500 mt-0.5">Em vigor desde {fmtDateTime(current.effective_from)}{current.notes ? ` · ${current.notes}` : ''}</p>}
          </div>
          <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700">
            <Plus className="w-4 h-4" /> Nova versão
          </button>
        </div>
        {current ? <PriceTable rows={CATEGORIES.map(c => ({ c, item: priceOf(current.id, c.key) }))} /> : (
          <p className="px-6 py-8 text-sm text-gray-500">Sem versão vigente, nenhuma campanha pode ser precificada. Crie a primeira versão.</p>
        )}
        {scheduled.length > 0 && (
          <div className="mx-6 mb-5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
            {scheduled.map(s => <div key={s.id}>v{s.version_number} agendada pra {fmtDateTime(s.effective_from)}{s.notes ? ` — ${s.notes}` : ''}</div>)}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <History className="w-4 h-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900">Histórico de versões</h2>
          <span className="text-xs text-gray-400">(imutável — toda versão congela ao entrar em vigor)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-xs text-gray-400 uppercase">
              <th className="px-4 py-2 text-left">Versão</th><th className="px-4 py-2 text-left">Vigência</th>
              {CATEGORIES.map(c => <th key={c.key} className="px-4 py-2 text-right">{c.label}</th>)}
              <th className="px-4 py-2 text-left">Observação</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {versions.map(v => {
                const isCur = v.id === current?.id
                const isFut = new Date(v.effective_from).getTime() > now
                return (
                  <tr key={v.id} className={isCur ? 'bg-cyan-50/40' : ''}>
                    <td className="px-4 py-2.5 font-semibold text-gray-900 whitespace-nowrap">
                      v{v.version_number}
                      {isCur && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700">vigente</span>}
                      {isFut && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">agendada</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDateTime(v.effective_from)}</td>
                    {CATEGORIES.map(c => {
                      const it = priceOf(v.id, c.key)
                      return <td key={c.key} className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">
                        {it ? <>{unit(it.meta_unit_cost_brl + it.aion_unit_fee_brl)}<div className="text-[11px] text-gray-400">{unit(it.meta_unit_cost_brl)} + {unit(it.aion_unit_fee_brl)}</div></> : '—'}
                      </td>
                    })}
                    <td className="px-4 py-2.5 text-gray-500 max-w-xs">
                      {v.notes || '—'}
                      <div className="text-[11px] text-gray-400">por {v.created_by ? authors[v.created_by] || '—' : '—'} em {fmtDateTime(v.created_at)}</div>
                    </td>
                  </tr>
                )
              })}
              {versions.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhuma versão criada ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <NewVersionModal current={current} priceOf={c => priceOf(current?.id, c)} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />}
    </div>
  )
}

function PriceTable({ rows }: { rows: { c: typeof CATEGORIES[number]; item?: Item }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50 text-xs text-gray-400 uppercase">
          <th className="px-6 py-2 text-left">Categoria</th><th className="px-6 py-2 text-right">Custo Meta</th>
          <th className="px-6 py-2 text-right">Taxa Áion</th><th className="px-6 py-2 text-right">Total por mensagem</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(({ c, item }) => (
            <tr key={c.key}>
              <td className="px-6 py-3"><div className="font-semibold text-gray-900">{c.label}</div><div className="text-xs text-gray-400">{c.hint}</div></td>
              <td className="px-6 py-3 text-right text-gray-700">{item ? unit(item.meta_unit_cost_brl) : '—'}</td>
              <td className="px-6 py-3 text-right text-gray-700">{item ? unit(item.aion_unit_fee_brl) : '—'}</td>
              <td className="px-6 py-3 text-right font-bold text-gray-900">{item ? unit(item.meta_unit_cost_brl + item.aion_unit_fee_brl) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-6 py-3 text-xs text-gray-400">Escola com conta própria na Meta paga só a taxa da Áion (a Meta cobra ela direto).</p>
    </div>
  )
}

function NewVersionModal({ current, priceOf, onClose, onSaved }: {
  current: Version | null; priceOf: (c: Category) => Item | undefined; onClose: () => void; onSaved: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries(CATEGORIES.map(c => {
    const it = priceOf(c.key)
    return [c.key, { meta: it ? String(it.meta_unit_cost_brl) : '', fee: it ? String(it.aion_unit_fee_brl) : '' }]
  })) as Draft)
  const [notes, setNotes] = useState('')
  const [when, setWhen] = useState<'now' | 'future'>('now')
  const [effectiveAt, setEffectiveAt] = useState('')
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problems = useMemo(() => {
    const p: string[] = []
    CATEGORIES.forEach(c => {
      if (!validMoney(draft[c.key].meta) || !validMoney(draft[c.key].fee)) p.push(`${c.label}: informe custo e taxa (até 4 casas decimais)`)
    })
    if (!notes.trim()) p.push('Escreva uma observação (ex.: "reajuste da Meta de outubro")')
    if (when === 'future' && !(Date.parse(effectiveAt) > Date.now())) p.push('A vigência agendada precisa ser no futuro')
    return p
  }, [draft, notes, when, effectiveAt])

  const unchanged = CATEGORIES.every(c => {
    const it = priceOf(c.key)
    return it && parseMoney(draft[c.key].meta) === it.meta_unit_cost_brl && parseMoney(draft[c.key].fee) === it.aion_unit_fee_brl
  })

  async function save() {
    setSaving(true); setError(null)
    const { error: e } = await supabase.rpc('broadcast_create_price_version', {
      p_effective_from: when === 'now' ? new Date().toISOString() : new Date(effectiveAt).toISOString(),
      p_notes: notes.trim(),
      p_items: CATEGORIES.map(c => ({ category: c.key, country_code: 'BR', meta_unit_cost_brl: parseMoney(draft[c.key].meta), aion_unit_fee_brl: parseMoney(draft[c.key].fee) })),
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    onSaved()
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none'
  const exampleN = 1000

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{step === 'form' ? 'Nova versão da tabela de preço' : 'Confirmar nova versão'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

          {step === 'form' ? <>
            <div className="grid gap-3">
              {CATEGORIES.map(c => (
                <div key={c.key} className="grid grid-cols-[160px_1fr_1fr] gap-3 items-end">
                  <div><div className="text-sm font-semibold text-gray-900">{c.label}</div><div className="text-xs text-gray-400">{c.hint}</div></div>
                  <label className="text-xs font-semibold text-gray-500">Custo Meta (R$/msg)
                    <input className={inp} inputMode="decimal" value={draft[c.key].meta} onChange={e => setDraft(d => ({ ...d, [c.key]: { ...d[c.key], meta: e.target.value } }))} />
                  </label>
                  <label className="text-xs font-semibold text-gray-500">Taxa Áion (R$/msg)
                    <input className={inp} inputMode="decimal" value={draft[c.key].fee} onChange={e => setDraft(d => ({ ...d, [c.key]: { ...d[c.key], fee: e.target.value } }))} />
                  </label>
                </div>
              ))}
            </div>
            <label className="block text-xs font-semibold text-gray-500">Observação
              <input className={inp} maxLength={300} value={notes} placeholder="Ex.: valores reais da Meta (tabela BR de outubro/2026)" onChange={e => setNotes(e.target.value)} />
            </label>
            <div className="flex items-center gap-4 flex-wrap text-sm text-gray-700">
              <label className="flex items-center gap-2"><input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> Entra em vigor agora</label>
              <label className="flex items-center gap-2"><input type="radio" checked={when === 'future'} onChange={() => setWhen('future')} /> Agendar</label>
              {when === 'future' && <input type="datetime-local" className={`${inp} w-auto`} value={effectiveAt} onChange={e => setEffectiveAt(e.target.value)} />}
            </div>
            {problems.length > 0 && <ul className="text-xs text-amber-700 list-disc pl-5 space-y-0.5">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
            {unchanged && problems.length === 0 && <p className="text-xs text-amber-700">Os valores são iguais aos da versão vigente.</p>}
          </> : <>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-xs text-gray-400 uppercase">
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-right">Vigente {current ? `(v${current.version_number})` : ''}</th>
                <th className="px-3 py-2 text-right">Proposta</th>
                <th className="px-3 py-2 text-right">Variação</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {CATEGORIES.map(c => {
                  const it = priceOf(c.key)
                  const oldT = it ? it.meta_unit_cost_brl + it.aion_unit_fee_brl : null
                  const m = parseMoney(draft[c.key].meta), f = parseMoney(draft[c.key].fee)
                  const newT = m + f
                  const diff = oldT === null ? null : newT - oldT
                  const pct = oldT ? (diff! / oldT) * 100 : null
                  return (
                    <tr key={c.key}>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{c.label}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{it ? <>{unit(oldT!)}<div className="text-[11px]">{unit(it.meta_unit_cost_brl)} + {unit(it.aion_unit_fee_brl)}</div></> : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">{unit(newT)}<div className="text-[11px] font-normal text-gray-500">{unit(m)} + {unit(f)}</div></td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {diff === null ? <span className="text-gray-400">nova</span>
                          : Math.abs(diff) < 0.00005 ? <span className="inline-flex items-center gap-1 text-gray-400"><Minus className="w-3 h-3" /> igual</span>
                          : <span className={`inline-flex items-center gap-1 font-semibold ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {diff > 0 ? '+' : '−'}{unit(Math.abs(diff))}{pct !== null && ` (${diff > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1).replace('.', ',')}%)`}
                            </span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(() => {
              const it = priceOf('MARKETING')
              const oldT = it ? (it.meta_unit_cost_brl + it.aion_unit_fee_brl) * exampleN : null
              const newT = (parseMoney(draft.MARKETING.meta) + parseMoney(draft.MARKETING.fee)) * exampleN
              return <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3">
                Exemplo: uma campanha de <strong>{exampleN.toLocaleString('pt-BR')} mensagens de Marketing</strong> {oldT !== null ? <>passaria de <strong>{brl(oldT)}</strong> pra </> : <>custaria </>}<strong>{brl(newT)}</strong>.
              </p>
            })()}
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Vigência:</strong> {when === 'now' ? 'imediata' : fmtDateTime(new Date(effectiveAt).toISOString())}</p>
              <p><strong>Observação:</strong> {notes}</p>
            </div>
            <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Ao entrar em vigor a versão fica <strong>congelada</strong> — não dá pra editar nem apagar; corrigir exige criar outra versão. Campanhas já precificadas mantêm o preço da época.</span>
            </div>
          </>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          {step === 'form' ? <>
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Cancelar</button>
            <button disabled={problems.length > 0} onClick={() => setStep('confirm')} className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700 disabled:opacity-50">Revisar</button>
          </> : <>
            <button onClick={() => setStep('form')} disabled={saving} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Voltar</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700 disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Criar versão
            </button>
          </>}
        </div>
      </div>
    </div>
  )
}

// ── Aba: visão geral de todas as escolas ─────────────────────────────────────

interface SummaryRow {
  institution_id: string; institution_name: string; module_enabled: boolean; own_account: boolean
  credit_balance_brl: number; campaigns_created: number; campaigns_active: number; campaigns_completed: number
  campaigns_released: number; messages_priced: number; messages_billed: number; messages_sent: number
  messages_delivered: number; messages_read: number; replies: number
  charged_brl: number; refunded_brl: number; credit_used_brl: number; aion_margin_brl: number; meta_cost_est_brl: number
}

const PERIODS = [
  { key: 'month', label: 'Mês atual' },
  { key: '90',    label: 'Últimos 90 dias' },
  { key: '365',   label: 'Últimos 12 meses' },
  { key: 'all',   label: 'Tudo' },
] as const

function periodRange(k: typeof PERIODS[number]['key']): { start: string | null; end: string | null } {
  const now = new Date()
  if (k === 'all') return { start: null, end: null }
  if (k === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end: null }
  return { start: new Date(now.getTime() - Number(k) * 86400000).toISOString(), end: null }
}

function OverviewTab() {
  const [period, setPeriod] = useState<typeof PERIODS[number]['key']>('month')
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    const { start, end } = periodRange(period)
    const { data, error: e } = await supabase.rpc('broadcast_institution_summary', { p_institution_id: null, p_start: start, p_end: end })
    if (e) setError(e.message)
    setRows(((data || []) as any[]).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /_brl$|^messages_|^campaigns_|^replies$/.test(k) ? Number(v) : v]))) as any)
    setLoading(false)
  }
  useEffect(() => { load() }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  const t = rows.reduce((a, r) => ({
    charged: a.charged + Number(r.charged_brl), credit: a.credit + Number(r.credit_used_brl), margin: a.margin + Number(r.aion_margin_brl || 0),
    meta: a.meta + Number(r.meta_cost_est_brl || 0), balance: a.balance + Number(r.credit_balance_brl), sent: a.sent + Number(r.messages_sent),
    billed: a.billed + Number(r.messages_billed), refunded: a.refunded + Number(r.refunded_brl),
  }), { charged: 0, credit: 0, margin: 0, meta: 0, balance: 0, sent: 0, billed: 0, refunded: 0 })

  const kpi = (label: string, value: string, hint?: string) => (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{p.label}</button>
          ))}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"><RefreshCw className="w-4 h-4" /> Atualizar</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpi('Cobrado (Asaas)', brl(t.charged), t.refunded > 0 ? `${brl(t.refunded)} estornado` : undefined)}
        {kpi('Coberto por crédito', brl(t.credit))}
        {kpi('Margem da Áion', brl(t.margin), 'taxa × mensagens faturadas + mínimo')}
        {kpi('Custo Meta (estimado)', brl(t.meta), 'pela tabela de preço')}
        {kpi('Crédito em aberto', brl(t.balance), 'saldo somado das escolas')}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-xs text-gray-400 uppercase">
              <th className="px-4 py-2 text-left">Escola</th>
              <th className="px-4 py-2 text-right">Cobrado</th><th className="px-4 py-2 text-right">Crédito usado</th>
              <th className="px-4 py-2 text-right">Margem</th><th className="px-4 py-2 text-right">Custo Meta est.</th>
              <th className="px-4 py-2 text-right">Saldo crédito</th><th className="px-4 py-2 text-right">Campanhas</th>
              <th className="px-4 py-2 text-right">Enviadas</th><th className="px-4 py-2 text-right">Respostas</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center"><Loader2 className="w-6 h-6 text-cyan-600 animate-spin inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Nenhuma escola usando Transmissões ainda.</td></tr>
              ) : rows.map(r => (
                <tr key={r.institution_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link to={`/super-admin/schools/${r.institution_id}`} className="font-semibold text-gray-900 hover:text-cyan-700">{r.institution_name}</Link>
                    <div className="flex gap-1 mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${r.module_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.module_enabled ? 'módulo ligado' : 'módulo desligado'}</span>
                      {r.own_account && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">conta própria Meta</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{brl(r.charged_brl)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{brl(r.credit_used_brl)}</td>
                  <td className="px-4 py-2.5 text-right text-green-700 font-semibold">{brl(r.aion_margin_brl)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{brl(r.meta_cost_est_brl)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{brl(r.credit_balance_brl)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 whitespace-nowrap">{Number(r.campaigns_released)} liberadas{Number(r.campaigns_active) > 0 && <div className="text-[11px] text-gray-400">{Number(r.campaigns_active)} em andamento</div>}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{Number(r.messages_sent).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{Number(r.replies).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
          Período conta as campanhas liberadas (pagas ou cobertas por crédito) no intervalo; saldo de crédito é o atual.
          No período: {t.billed.toLocaleString('pt-BR')} mensagens faturadas (precificadas menos as que voltaram como crédito) · {t.sent.toLocaleString('pt-BR')} já enviadas.
        </p>
      </div>
    </div>
  )
}
