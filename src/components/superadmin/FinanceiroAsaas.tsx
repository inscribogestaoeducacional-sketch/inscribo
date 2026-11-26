// src/components/superadmin/FinanceiroAsaas.tsx
// Entradas do Asaas de todas as empresas. Cobranças sem empresa definida são classificadas aqui
// uma vez; o cliente fica lembrado e as próximas entram sozinhas.
import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, EyeOff, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Company, Category, brl, fmtDate, inp, btnPrimary } from './financeiroShared'

type Props = { showToast: (m: string, ok?: boolean) => void; onChanged: () => void }
type Charge = { id: string; asaas_id: string; customer_id: string | null; customer_name: string | null; description: string | null; value: number; billing_type: string | null; status: string; due_date: string | null; paid_date: string | null }
type Rule = { id: string; match_value: string; label: string | null; company_id: string; category_id: string | null }

const STATUS: Record<string, string> = { RECEIVED: 'Recebida', CONFIRMED: 'Confirmada', RECEIVED_IN_CASH: 'Recebida em dinheiro', PENDING: 'Aguardando', OVERDUE: 'Vencida', AWAITING_RISK_ANALYSIS: 'Em análise' }
const TYPE: Record<string, string> = { PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', DEBIT_CARD: 'Débito', TRANSFER: 'Transferência', UNDEFINED: 'A definir' }

export default function FinanceiroAsaas({ showToast, onChanged }: Props) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const [company, setCompany] = useState('')
  const [category, setCategory] = useState('')
  const [remember, setRemember] = useState(true)
  const [working, setWorking] = useState(false)

  const load = async () => {
    const [c, g, ch, r] = await Promise.all([
      supabase.from('fin_companies').select('*').order('sort_order'),
      supabase.from('fin_categories').select('*').eq('grp', 'receita').order('sort_order'),
      supabase.from('fin_asaas_charges').select('id,asaas_id,customer_id,customer_name,description,value,billing_type,status,due_date,paid_date').is('company_id', null).eq('ignored', false).order('due_date', { ascending: false }).limit(300),
      supabase.from('fin_asaas_rules').select('id,match_value,label,company_id,category_id').order('created_at', { ascending: false }),
    ])
    const err = c.error || g.error || ch.error || r.error
    if (err) showToast('Não foi possível carregar o Asaas: ' + err.message, false)
    setCompanies(((c.data || []) as Company[]).filter(x => x.active))
    setCategories((g.data || []) as Category[])
    setCharges(((ch.data || []) as any[]).map(x => ({ ...x, value: Number(x.value) })))
    setRules((r.data || []) as Rule[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const chosen = useMemo(() => charges.filter(c => sel[c.id]), [charges, sel])
  const compById = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies])
  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const sync = async () => {
    setSyncing(true)
    const { data, error } = await supabase.functions.invoke('fin-asaas-sync', { body: {} })
    setSyncing(false)
    if (error || (data as any)?.error) return showToast('Não foi possível atualizar do Asaas: ' + ((data as any)?.error || error?.message), false)
    const d = data as any
    showToast(`Asaas atualizado: ${d.cobrancas_lidas} cobranças lidas, ${d.novos} novas entradas, ${d.sem_classificacao} para classificar.`)
    await load(); onChanged()
  }
  const classify = async () => {
    if (!company) return showToast('Escolha a empresa.', false)
    if (!category) return showToast('Escolha a categoria.', false)
    setWorking(true)
    const { error } = await supabase.rpc('fin_asaas_classify', { p_charge_ids: chosen.map(c => c.id), p_company: company, p_category: category, p_remember: remember })
    setWorking(false)
    if (error) return showToast('Não foi possível classificar: ' + error.message, false)
    showToast(`${chosen.length} cobrança(s) classificada(s) em ${compById.get(company)?.name}.`)
    setSel({}); await load(); onChanged()
  }
  const ignore = async () => {
    if (!window.confirm(`Ignorar ${chosen.length} cobrança(s)? Elas não entram no financeiro.`)) return
    const { error } = await supabase.rpc('fin_asaas_ignore', { p_charge_ids: chosen.map(c => c.id) })
    if (error) return showToast('Não foi possível ignorar: ' + error.message, false)
    setSel({}); await load(); onChanged()
  }
  const removeRule = async (id: string) => {
    const { error } = await supabase.from('fin_asaas_rules').delete().eq('id', id)
    if (error) return showToast('Não foi possível remover: ' + error.message, false)
    load()
  }

  if (loading) return <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
  const allSelected = charges.length > 0 && chosen.length === charges.length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Entradas do Asaas</h2>
          <p className="text-xs text-gray-400 max-w-xl">Traz as cobranças do Asaas de todas as empresas. As do Áion Edu entram sozinhas. As demais ficam abaixo até você dizer de qual empresa são, e o cliente fica lembrado.</p>
        </div>
        <button onClick={sync} disabled={syncing} className={btnPrimary + ' px-4'}>
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Atualizando…' : 'Atualizar do Asaas'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Sem classificação <span className="text-gray-400 font-normal">({charges.length})</span></h3>
          {charges.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={allSelected} onChange={e => setSel(e.target.checked ? Object.fromEntries(charges.map(c => [c.id, true])) : {})} className="rounded" />Selecionar todas</label>
          )}
        </div>
        {charges.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">Tudo classificado. Toque em <b>Atualizar do Asaas</b> para buscar as cobranças mais recentes.</p>
        ) : (
          <ul>
            {charges.map(c => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 first:border-0">
                <input type="checkbox" checked={!!sel[c.id]} onChange={e => setSel(s => ({ ...s, [c.id]: e.target.checked }))} className="rounded flex-shrink-0" aria-label={'Selecionar ' + (c.customer_name || c.asaas_id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.customer_name || 'Cliente sem nome'}</p>
                  <p className="text-xs text-gray-400 truncate">{c.description || '—'} · {TYPE[c.billing_type || ''] || c.billing_type} · {fmtDate(c.paid_date || c.due_date)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{brl(c.value)}</p>
                  <p className="text-[11px] text-gray-400">{STATUS[c.status] || c.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {chosen.length > 0 && (
          <div className="sm:sticky sm:bottom-0 border-t border-gray-200 bg-cyan-50/80 backdrop-blur px-5 py-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">{chosen.length} selecionada(s) · {brl(chosen.reduce((s, c) => s + c.value, 0))}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select className={inp} value={company} onChange={e => setCompany(e.target.value)} aria-label="Empresa">
                <option value="">De qual empresa?</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={inp} value={category} onChange={e => setCategory(e.target.value)} aria-label="Categoria">
                <option value="">Categoria da receita</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={classify} disabled={working} className={btnPrimary + ' rounded-lg'}>{working ? 'Salvando…' : 'Classificar'}</button>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="rounded" />Lembrar para estes clientes (as próximas entram sozinhas)</label>
              <button onClick={ignore} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"><EyeOff className="w-3.5 h-3.5" />Ignorar</button>
            </div>
          </div>
        )}
      </div>

      {rules.length > 0 && (
        <details className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <summary className="px-5 py-3 text-sm font-semibold text-gray-700 cursor-pointer select-none">Clientes lembrados ({rules.length})</summary>
          <ul className="px-5 pb-3">
            {rules.map(r => (
              <li key={r.id} className="flex items-center gap-3 py-2 border-t border-gray-100 text-sm">
                <span className="flex-1 min-w-0 truncate text-gray-800">{r.label || r.match_value}</span>
                <span className="text-xs text-gray-500">{compById.get(r.company_id)?.name} · {(r.category_id && catById.get(r.category_id)?.name) || 'sem categoria'}</span>
                <button onClick={() => removeRule(r.id)} className="text-gray-300 hover:text-red-500" aria-label="Esquecer cliente"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
