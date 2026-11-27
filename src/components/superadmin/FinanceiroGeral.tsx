// src/components/superadmin/FinanceiroGeral.tsx
// Financeiro geral da Áion: UMA tela que junta todas as empresas (Edu, Business e as próximas).
// Regime de CAIXA: o lançamento conta na data em que o dinheiro entrou/saiu.
// "Pendente" = a pagar / a receber: fica fora dos totais até ser marcado como pago.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  ArrowDownCircle, ArrowUpCircle, Scale, Wallet, Clock, Plus, Pencil, Trash2,
  CheckCircle2, X, Settings2, Search, Repeat, Layers, Zap, AlertTriangle,
} from 'lucide-react'
import FinanceiroConfig from './FinanceiroConfig'
import FinanceiroRelatorios from './FinanceiroRelatorios'
import FinanceiroInvestimentos from './FinanceiroInvestimentos'
import FinanceiroAsaas from './FinanceiroAsaas'
import {
  EDU_COMPANY_ID, Company, Account, Category, Recurrence, Entry,
  PAYMENT_METHODS, FREQUENCIES, GROUPS, FOLHA_TIPO,
  brl, todayISO, fmtDate, inRange, addMonths, splitInstallments, inp, lbl, btnPrimary,
} from './financeiroShared'

export { EDU_COMPANY_ID }

type Mode = 'avista' | 'parcelado' | 'recorrente'

// ─── Modal de lançamento ──────────────────────────────────────────────────
function EntryModal({ entry, companies, accounts, categories, defaultCompanyId, userId, onClose, onSaved, showToast }: {
  entry?: Entry; companies: Company[]; accounts: Account[]; categories: Category[]
  defaultCompanyId: string; userId?: string
  onClose: () => void; onSaved: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const isNew = !entry
  const locked = entry?.source === 'asaas' // vem do Asaas: só categoria/conta/observação são editáveis
  const [mode, setMode] = useState<Mode>('avista')
  const [form, setForm] = useState({
    type: entry?.type || 'saida' as 'entrada' | 'saida',
    company_id: entry?.company_id || defaultCompanyId,
    description: entry?.description || '',
    amount: entry ? String(entry.amount) : '',
    category_id: entry?.category_id || '',
    account_id: entry?.account_id || '',
    payment_method: entry?.payment_method || '',
    folha_tipo: entry?.folha_tipo || '',
    status: entry?.status || 'pago' as 'pago' | 'pendente',
    entry_date: entry?.entry_date || todayISO(),
    due_date: entry?.due_date || '',
    notes: entry?.notes || '',
    installments: '3',
    first_paid: false,
    frequency: 'monthly' as 'weekly' | 'monthly' | 'yearly',
    end_date: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const pendente = form.status === 'pendente'

  const companyAccounts = accounts.filter(a => a.company_id === form.company_id && (a.active || a.id === form.account_id))
  const grpFor = form.type === 'entrada' ? ['receita'] : ['custo', 'despesa']
  const cats = categories.filter(c => grpFor.includes(c.grp) && (c.active || c.id === form.category_id))
  const chosenCat = categories.find(c => c.id === form.category_id)
  const isFolha = chosenCat?.legacy_key === 'folha'

  // Troca de empresa/tipo: ajusta conta e categoria para valores válidos.
  const onCompany = (id: string) => setForm(f => {
    const first = accounts.find(a => a.company_id === id && a.active)
    return { ...f, company_id: id, account_id: first?.id || '' }
  })
  const onType = (t: 'entrada' | 'saida') => setForm(f => ({ ...f, type: t, category_id: '' }))

  // Padrão para lançamento novo: primeira conta da empresa.
  useEffect(() => {
    if (isNew && !form.account_id) {
      const first = accounts.find(a => a.company_id === form.company_id && a.active)
      if (first) set('account_id', first.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const n = Math.max(2, Math.min(60, parseInt(form.installments) || 2))
  const total = Number(form.amount) || 0
  const parcelas = mode === 'parcelado' && total > 0 ? splitInstallments(total, n) : []

  const save = async () => {
    if (!form.description.trim() || !(total > 0)) { showToast('Preencha a descrição e um valor maior que zero.', false); return }
    if (!form.category_id) { showToast('Escolha a categoria (o que é este lançamento).', false); return }
    if (!form.account_id) { showToast('Escolha a conta (onde o dinheiro entra ou sai).', false); return }
    const needDue = mode !== 'avista' || pendente
    if (needDue && !form.due_date) { showToast(mode === 'avista' ? 'Para a pagar/a receber, informe o vencimento.' : 'Informe o 1º vencimento.', false); return }
    setSaving(true)
    const cat = categories.find(c => c.id === form.category_id)
    const common = {
      type: form.type, company_id: form.company_id, account_id: form.account_id, category_id: form.category_id,
      category: cat?.legacy_key || 'outro',
      payment_method: form.payment_method || null,
      folha_tipo: cat?.legacy_key === 'folha' ? (form.folha_tipo || null) : null,
      notes: form.notes.trim() || null,
    }
    let error: { message: string } | null = null

    if (!isNew) {
      const patch: any = { ...common, updated_at: new Date().toISOString() }
      if (locked) { delete patch.type; delete patch.company_id; delete patch.payment_method }
      else Object.assign(patch, {
        description: form.description.trim(), amount: total, status: form.status,
        entry_date: pendente ? form.due_date : form.entry_date, due_date: form.due_date || null,
      })
      ;({ error } = await supabase.from('financial_entries').update(patch).eq('id', entry!.id))
    } else if (mode === 'avista') {
      ;({ error } = await supabase.from('financial_entries').insert({
        ...common, description: form.description.trim(), amount: total, status: form.status,
        entry_date: pendente ? form.due_date : form.entry_date, due_date: form.due_date || null,
        source: 'manual', created_by: userId || null,
      }))
    } else if (mode === 'parcelado') {
      const group = crypto.randomUUID()
      const rows = parcelas.map((v, i) => {
        const due = addMonths(form.due_date, i)
        const paid = i === 0 && form.first_paid
        return {
          ...common, description: form.description.trim(), amount: v, status: paid ? 'pago' : 'pendente',
          entry_date: paid ? form.entry_date : due, due_date: due,
          installment_no: i + 1, installment_total: n, group_id: group, source: 'manual', created_by: userId || null,
        }
      })
      ;({ error } = await supabase.from('financial_entries').insert(rows))
    } else {
      const { error: e1 } = await supabase.from('fin_recurrences').insert({
        company_id: form.company_id, type: form.type, description: form.description.trim(), amount: total,
        category_id: form.category_id, account_id: form.account_id, payment_method: form.payment_method || null,
        frequency: form.frequency, next_date: form.due_date, end_date: form.end_date || null,
      })
      if (e1) error = e1
      else { const r = await supabase.rpc('fin_generate_recurrences'); if (r.error) error = r.error }
    }
    setSaving(false)
    if (error) { showToast('Não foi possível salvar: ' + error.message, false); return }
    showToast(!isNew ? 'Lançamento atualizado.'
      : mode === 'parcelado' ? `${n} parcelas criadas.`
      : mode === 'recorrente' ? 'Conta recorrente criada. O primeiro lançamento já está em aberto.'
      : 'Lançamento adicionado.')
    onSaved(); onClose()
  }

  const TONES: Record<string, string> = {
    cyan: 'bg-cyan-50 border-cyan-400 text-cyan-700',
    green: 'bg-green-50 border-green-400 text-green-700',
    red: 'bg-red-50 border-red-400 text-red-700',
    amber: 'bg-amber-50 border-amber-400 text-amber-700',
  }
  const seg = (on: boolean, tone = 'cyan') => `py-2.5 rounded-lg text-sm font-semibold border ${on ? TONES[tone] : 'border-gray-200 text-gray-500'}`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Novo lançamento' : 'Editar lançamento'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {locked && <p className="text-xs bg-cyan-50 text-cyan-800 rounded-lg px-3 py-2 mb-4">Este lançamento veio do Asaas. Valor e situação seguem a cobrança; aqui você ajusta categoria, conta e observação.</p>}
        {!isNew && (entry!.installment_total || entry!.recurrence_id) && !locked && (
          <p className="text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2 mb-4">
            {entry!.installment_total ? `Parcela ${entry!.installment_no} de ${entry!.installment_total}. A alteração vale só para esta parcela.` : 'Vem de uma conta recorrente. A alteração vale só para este mês.'}
          </p>
        )}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={locked} onClick={() => onType('entrada')} className={seg(form.type === 'entrada', 'green')}>Entrada</button>
            <button type="button" disabled={locked} onClick={() => onType('saida')} className={seg(form.type === 'saida', 'red')}>Saída</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Empresa *</label>
              <select className={inp} disabled={locked} value={form.company_id} onChange={e => onCompany(e.target.value)}>
                {companies.filter(c => c.active || c.id === form.company_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Conta *</label>
              <select className={inp} value={form.account_id} onChange={e => set('account_id', e.target.value)}>
                <option value="">Escolher...</option>
                {companyAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Descrição *</label>
            <input className={inp} disabled={locked} placeholder="Ex: Aluguel, Energisa, Hospedagem..." value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>O que é (categoria) *</label>
            <select className={inp} value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">Escolher...</option>
              {grpFor.map(g => (
                <optgroup key={g} label={GROUPS[g]}>
                  {cats.filter(c => c.grp === g).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          {isFolha && (
            <div>
              <label className={lbl}>Tipo (folha)</label>
              <select className={inp} value={form.folha_tipo} onChange={e => set('folha_tipo', e.target.value)}>
                <option value="">Selecionar...</option>
                {Object.entries(FOLHA_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{mode === 'parcelado' ? 'Valor total (R$) *' : 'Valor (R$) *'}</label>
              <input type="number" step="0.01" min="0" className={inp} disabled={locked} value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Forma de pagamento</label>
              <select className={inp} disabled={locked} value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                <option value="">Não informar</option>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {isNew && (
            <div>
              <label className={lbl}>Como é pago</label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setMode('avista')} className={seg(mode === 'avista') + ' text-xs'}>À vista</button>
                <button type="button" onClick={() => setMode('parcelado')} className={seg(mode === 'parcelado') + ' text-xs'}>Parcelado</button>
                <button type="button" onClick={() => setMode('recorrente')} className={seg(mode === 'recorrente') + ' text-xs'}>Recorrente</button>
              </div>
            </div>
          )}

          {mode === 'avista' && !locked && (
            <>
              <div>
                <label className={lbl}>Situação</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => set('status', 'pago')} className={seg(!pendente)}>{form.type === 'entrada' ? 'Já recebido' : 'Já pago'}</button>
                  <button type="button" onClick={() => set('status', 'pendente')} className={seg(pendente, 'amber')}>{form.type === 'entrada' ? 'A receber' : 'A pagar'}</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {!pendente && (
                  <div>
                    <label className={lbl}>{form.type === 'entrada' ? 'Data do recebimento' : 'Data do pagamento'}</label>
                    <input type="date" className={inp} value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
                  </div>
                )}
                <div className={pendente ? 'col-span-2' : ''}>
                  <label className={lbl}>Vencimento{pendente ? ' *' : ' (opcional)'}</label>
                  <input type="date" className={inp} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {mode === 'parcelado' && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Nº de parcelas</label>
                  <input type="number" min="2" max="60" className={inp} value={form.installments} onChange={e => set('installments', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>1º vencimento *</label>
                  <input type="date" className={inp} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.first_paid} onChange={e => set('first_paid', e.target.checked)} />
                A 1ª parcela já foi {form.type === 'entrada' ? 'recebida' : 'paga'}
              </label>
              {form.first_paid && (
                <div>
                  <label className={lbl}>Data da 1ª parcela</label>
                  <input type="date" className={inp} value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
                </div>
              )}
              {parcelas.length > 0 && (
                <p className="text-xs text-gray-600">
                  <b>{n}x de {brl(parcelas[0])}</b>
                  {parcelas[0] !== parcelas[n - 1] && <> (última de {brl(parcelas[n - 1])})</>}
                  {form.due_date && <> · de {fmtDate(form.due_date)} até {fmtDate(addMonths(form.due_date, n - 1))}</>}
                </p>
              )}
            </div>
          )}

          {mode === 'recorrente' && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Repetir</label>
                  <select className={inp} value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                    {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>1º vencimento *</label>
                  <input type="date" className={inp} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={lbl}>Até (opcional)</label>
                <input type="date" className={inp} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </div>
              <p className="text-xs text-gray-600">Todo período o sistema cria o lançamento "a pagar" sozinho. Quando a conta variar (luz, água), é só ajustar o valor ao pagar.</p>
            </div>
          )}

          <div>
            <label className={lbl}>Observações</label>
            <input className={inp} placeholder="Detalhes opcionais..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={save} disabled={saving} className={btnPrimary + ' flex-1'}>
            {saving ? 'Salvando...' : <><CheckCircle2 className="w-4 h-4" />Salvar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Aba ──────────────────────────────────────────────────────────────────
function FinanceiroVisao({ periodStart, periodEnd, periodLabel, userId, showToast }: {
  periodStart: string; periodEnd: string; periodLabel: string; userId?: string
  showToast: (m: string, ok?: boolean) => void
}) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [recurrences, setRecurrences] = useState<Recurrence[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'entrada' | 'saida'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pago' | 'pendente'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Entry | 'new' | null>(null)
  const [config, setConfig] = useState<null | 'contas' | 'recorrentes'>(null)

  const load = async () => {
    // Cria os "a pagar" das contas recorrentes que já chegaram na hora (aluguel, água, luz...).
    await supabase.rpc('fin_generate_recurrences')
    const [cRes, aRes, gRes, rRes, eRes] = await Promise.all([
      supabase.from('fin_companies').select('*').order('sort_order'),
      supabase.from('fin_accounts').select('*').order('sort_order'),
      supabase.from('fin_categories').select('*').order('sort_order'),
      supabase.from('fin_recurrences').select('*').order('next_date'),
      supabase.from('financial_entries')
        .select('id,type,amount,description,category,entry_date,due_date,status,company_id,notes,folha_tipo,source,account_id,category_id,payment_method,installment_no,installment_total,group_id,recurrence_id')
        .order('entry_date', { ascending: false }).limit(5000),
    ])
    const err = cRes.error || aRes.error || gRes.error || rRes.error || eRes.error
    if (err) showToast('Não foi possível carregar o financeiro: ' + err.message, false)
    setCompanies((cRes.data || []) as Company[])
    setAccounts((aRes.data || []) as Account[])
    setCategories((gRes.data || []) as Category[])
    setRecurrences(((rRes.data || []) as any[]).map(r => ({ ...r, amount: Number(r.amount) })) as Recurrence[])
    setEntries(((eRes.data || []) as any[]).map(e => ({ ...e, amount: Number(e.amount) })) as Entry[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const companyById = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies])
  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])
  const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const vencido = (e: Entry) => (e.due_date || e.entry_date) < todayISO()

  // Base: filtros de empresa/tipo/categoria/conta/busca (o período e a situação entram depois).
  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e =>
      (companyFilter === 'all' || e.company_id === companyFilter) &&
      (typeFilter === 'all' || e.type === typeFilter) &&
      (categoryFilter === 'all' || (categoryFilter === 'none' ? !e.category_id : e.category_id === categoryFilter)) &&
      (accountFilter === 'all' || e.account_id === accountFilter) &&
      (!q || e.description.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q)))
  }, [entries, companyFilter, typeFilter, categoryFilter, accountFilter, search])

  const sums = (list: Entry[]) => {
    const paid = list.filter(e => e.status === 'pago')
    const inP = paid.filter(e => inRange(e.entry_date, periodStart, periodEnd))
    const pend = list.filter(e => e.status === 'pendente')
    const entradas = inP.filter(e => e.type === 'entrada').reduce((s, e) => s + e.amount, 0)
    const saidas = inP.filter(e => e.type === 'saida').reduce((s, e) => s + e.amount, 0)
    return {
      entradas, saidas, resultado: entradas - saidas,
      saldo: paid.filter(e => e.entry_date <= periodEnd).reduce((s, e) => s + (e.type === 'entrada' ? e.amount : -e.amount), 0),
      aReceber: pend.filter(e => e.type === 'entrada').reduce((s, e) => s + e.amount, 0),
      aPagar: pend.filter(e => e.type === 'saida').reduce((s, e) => s + e.amount, 0),
      nReceber: pend.filter(e => e.type === 'entrada').length, nPagar: pend.filter(e => e.type === 'saida').length,
      receberAtrasado: pend.filter(e => e.type === 'entrada' && vencido(e)).length,
      pagarAtrasado: pend.filter(e => e.type === 'saida' && vencido(e)).length,
    }
  }
  const k = sums(base)
  const paid = base.filter(e => e.status === 'pago')

  // Visão consolidada: cada empresa lado a lado (não depende dos filtros, só do período).
  const activeCompanies = companies.filter(c => c.active)
  const perCompany = activeCompanies.map(c => ({ c, s: sums(entries.filter(e => e.company_id === c.id)) }))
  const totalAll = sums(entries.filter(e => activeCompanies.some(c => c.id === e.company_id)))

  // Saldo de cada conta até o fim do período.
  const accountBalances = accounts.filter(a => a.active && companyById.get(a.company_id)?.active).map(a => ({
    a, saldo: entries.filter(e => e.account_id === a.id && e.status === 'pago' && e.entry_date <= periodEnd)
      .reduce((s, e) => s + (e.type === 'entrada' ? e.amount : -e.amount), 0),
  }))

  // Para onde foi o dinheiro (saídas pagas no período, por categoria).
  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    base.filter(e => e.status === 'pago' && e.type === 'saida' && inRange(e.entry_date, periodStart, periodEnd))
      .forEach(e => { const n = (e.category_id && categoryById.get(e.category_id)?.name) || 'Sem categoria'; m.set(n, (m.get(n) || 0) + e.amount) })
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7)
  }, [base, categoryById, periodStart, periodEnd])

  const semClassificacao = entries.filter(e => !e.category_id).length

  const rows = base.filter(e => inRange(e.entry_date, periodStart, periodEnd) && (statusFilter === 'all' || e.status === statusFilter))

  const chart = useMemo(() => {
    const end = new Date(periodEnd + 'T12:00:00')
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(end.getFullYear(), end.getMonth() - (5 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const month = paid.filter(e => e.entry_date.startsWith(key))
      return {
        mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
        Entradas: month.filter(e => e.type === 'entrada').reduce((s, e) => s + e.amount, 0),
        Saídas: month.filter(e => e.type === 'saida').reduce((s, e) => s + e.amount, 0),
      }
    })
  }, [paid, periodEnd])

  const markPaid = async (e: Entry) => {
    const { error } = await supabase.from('financial_entries')
      .update({ status: 'pago', entry_date: todayISO(), updated_at: new Date().toISOString() }).eq('id', e.id)
    if (error) { showToast('Não foi possível marcar como pago: ' + error.message, false); return }
    showToast(e.type === 'entrada' ? 'Recebimento registrado hoje.' : 'Pagamento registrado hoje.'); load()
  }
  const remove = async (e: Entry) => {
    if (!confirm(`Excluir o lançamento "${e.description}"?`)) return
    let alsoOpen = false
    if (e.group_id) {
      const others = entries.filter(x => x.group_id === e.group_id && x.id !== e.id && x.status === 'pendente' && x.entry_date >= e.entry_date)
      if (others.length > 0) alsoOpen = confirm(`Esta é uma parcela. Excluir também as ${others.length} parcelas seguintes em aberto?`)
    }
    const q = supabase.from('financial_entries').delete()
    const { error } = alsoOpen
      ? await q.eq('group_id', e.group_id!).eq('status', 'pendente').gte('entry_date', e.entry_date)
      : await q.eq('id', e.id)
    if (error) { showToast('Não foi possível excluir: ' + error.message, false); return }
    showToast(alsoOpen ? 'Parcelas excluídas.' : 'Lançamento excluído.'); load()
  }

  const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${on ? 'bg-cyan-50 border-cyan-400 text-cyan-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`
  const accLabel = (a: Account) => companyFilter === 'all' ? `${a.name} · ${companyById.get(a.company_id)?.name.replace('Áion ', '') || ''}` : a.name
  const visibleAccounts = accounts.filter(a => companyFilter === 'all' || a.company_id === companyFilter)

  const kpis = [
    { label: 'Entradas', value: brl(k.entradas), sub: `recebido em ${periodLabel}`, icon: ArrowUpCircle, grad: 'from-green-500 to-emerald-600' },
    { label: 'Saídas', value: brl(k.saidas), sub: `pago em ${periodLabel}`, icon: ArrowDownCircle, grad: 'from-red-500 to-rose-600' },
    { label: 'Resultado', value: brl(k.resultado), sub: 'entradas menos saídas do período', icon: Scale, grad: k.resultado >= 0 ? 'from-cyan-500 to-blue-600' : 'from-red-500 to-rose-600' },
    { label: 'Saldo em caixa', value: brl(k.saldo), sub: 'acumulado até o fim do período', icon: Wallet, grad: k.saldo >= 0 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600' },
    { label: 'A receber', value: brl(k.aReceber), sub: k.receberAtrasado > 0 ? `${k.receberAtrasado} vencido(s)` : `${k.nReceber} lançamento(s) em aberto`, icon: Clock, grad: k.receberAtrasado > 0 ? 'from-red-500 to-rose-600' : 'from-amber-500 to-orange-500' },
    { label: 'A pagar', value: brl(k.aPagar), sub: k.pagarAtrasado > 0 ? `${k.pagarAtrasado} vencido(s)` : `${k.nPagar} lançamento(s) em aberto`, icon: Clock, grad: k.pagarAtrasado > 0 ? 'from-red-500 to-rose-600' : 'from-amber-500 to-orange-500' },
  ]
  const money = (v: number) => <span className={v < 0 ? 'text-red-600' : 'text-gray-900'}>{brl(v)}</span>

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setCompanyFilter('all')} className={chip(companyFilter === 'all')}>Todas as empresas</button>
          {activeCompanies.map(c => (
            <button key={c.id} onClick={() => { setCompanyFilter(c.id); setAccountFilter('all') }} className={chip(companyFilter === c.id)}>
              <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: c.color }} />{c.name}
            </button>
          ))}
          <button onClick={() => setConfig('contas')} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-cyan-600">
            <Settings2 className="w-3.5 h-3.5" />Configurar
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <select className={inp} value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} aria-label="Tipo">
            <option value="all">Todos os tipos</option><option value="entrada">Só entradas</option><option value="saida">Só saídas</option>
          </select>
          <select className={inp} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} aria-label="Situação">
            <option value="all">Toda situação</option><option value="pago">Só pagos</option><option value="pendente">Só em aberto</option>
          </select>
          <select className={inp} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Categoria">
            <option value="all">Categoria</option>
            <option value="none">Sem categoria</option>
            {(['receita', 'custo', 'despesa'] as const).map(g => (
              <optgroup key={g} label={GROUPS[g]}>{categories.filter(c => c.grp === g).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
            ))}
          </select>
          <select className={inp} value={accountFilter} onChange={e => setAccountFilter(e.target.value)} aria-label="Conta">
            <option value="all">Conta</option>
            {visibleAccounts.map(a => <option key={a.id} value={a.id}>{accLabel(a)}</option>)}
          </select>
          <div className="relative col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input className={inp + ' pl-9'} placeholder="Buscar descrição" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setModal('new')} className={btnPrimary + ' col-span-2 lg:col-span-1 rounded-lg'}>
            <Plus className="w-4 h-4" />Novo lançamento
          </button>
        </div>
        {semClassificacao > 0 && (
          <button onClick={() => setCategoryFilter('none')} className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg px-3 py-2 w-full text-left">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{semClassificacao} lançamento(s) sem categoria. Toque para ver e classificar.
          </button>
        )}
      </div>

      {/* Todas as empresas juntas */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Todas as empresas juntas</h2>
          <p className="text-xs text-gray-400">Entradas e saídas de {periodLabel}. Saldo acumulado até o fim do período. Toque numa empresa para ver só ela.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Empresa', 'Entradas', 'Saídas', 'Resultado', 'Saldo em caixa', 'A receber', 'A pagar'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? <tr><td colSpan={7} className="p-6"><div className="h-12 bg-gray-50 rounded-xl animate-pulse" /></td></tr> : perCompany.map(({ c, s }) => (
                <tr key={c.id} onClick={() => setCompanyFilter(c.id)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: c.color }} />{c.name}</td>
                  <td className="px-4 py-3 text-right text-green-700 font-semibold whitespace-nowrap">{brl(s.entradas)}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-semibold whitespace-nowrap">{brl(s.saidas)}</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{money(s.resultado)}</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{money(s.saldo)}</td>
                  <td className="px-4 py-3 text-right text-amber-700 whitespace-nowrap">{brl(s.aReceber)}</td>
                  <td className="px-4 py-3 text-right text-amber-700 whitespace-nowrap">{brl(s.aPagar)}</td>
                </tr>
              ))}
              {!loading && (
                <tr className="bg-gray-50 font-bold">
                  <td className="px-4 py-3 text-gray-900">Total do grupo</td>
                  <td className="px-4 py-3 text-right text-green-700 whitespace-nowrap">{brl(totalAll.entradas)}</td>
                  <td className="px-4 py-3 text-right text-red-600 whitespace-nowrap">{brl(totalAll.saidas)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{money(totalAll.resultado)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{money(totalAll.saldo)}</td>
                  <td className="px-4 py-3 text-right text-amber-700 whitespace-nowrap">{brl(totalAll.aReceber)}</td>
                  <td className="px-4 py-3 text-right text-amber-700 whitespace-nowrap">{brl(totalAll.aPagar)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Painel do filtro atual */}
      <div className="aion-snap grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(kp => {
          const Icon = kp.icon
          return (
            <div key={kp.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{kp.label}</p>
                  {loading ? <div className="h-7 w-20 bg-gray-100 rounded animate-pulse" /> : <p className="text-xl font-bold text-gray-900">{kp.value}</p>}
                  {!loading && <p className="text-xs text-gray-400 mt-1">{kp.sub}</p>}
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kp.grad} flex items-center justify-center flex-shrink-0`}><Icon className="w-5 h-5 text-white" /></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Contas e categorias */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-1">Saldo por conta</h2>
          <p className="text-xs text-gray-400 mb-3">Onde está o dinheiro, até o fim do período.</p>
          <div className="divide-y divide-gray-50">
            {accountBalances.map(({ a, saldo }) => (
              <button key={a.id} onClick={() => { setCompanyFilter(a.company_id); setAccountFilter(a.id) }} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50 rounded-lg px-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: companyById.get(a.company_id)?.color }} />
                <span className="flex-1 text-sm text-gray-800 min-w-0 truncate">{a.name} <span className="text-gray-400">· {companyById.get(a.company_id)?.name.replace('Áion ', '')}</span></span>
                <span className="text-sm font-bold">{money(saldo)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-1">Para onde foi o dinheiro</h2>
          <p className="text-xs text-gray-400 mb-3">Saídas pagas em {periodLabel}, por categoria.</p>
          {byCategory.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">Nenhuma saída paga neste período.</p> : (
            <div className="space-y-2.5">
              {byCategory.map(([name, v]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm"><span className="text-gray-700">{name}</span><span className="font-semibold text-gray-900">{brl(v)}</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1"><div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.max(4, (v / byCategory[0][1]) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contas recorrentes */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Contas recorrentes</h2>
            <p className="text-xs text-gray-400">Aluguel, água, luz... o sistema cria o "a pagar" sozinho.</p>
          </div>
          <button onClick={() => setConfig('recorrentes')} className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 whitespace-nowrap">Gerenciar</button>
        </div>
        {recurrences.filter(r => r.active).length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma ainda. Em "Novo lançamento", escolha <b>Recorrente</b> para cadastrar uma vez e nunca mais digitar.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {recurrences.filter(r => r.active).map(r => (
              <div key={r.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-3 py-2.5">
                <Repeat className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.description}</p>
                  <p className="text-xs text-gray-400">{FREQUENCIES[r.frequency]} · próximo {fmtDate(r.next_date)}</p>
                </div>
                <span className={`text-sm font-bold ${r.type === 'entrada' ? 'text-green-700' : 'text-red-600'}`}>{brl(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gráfico mensal */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="font-bold text-gray-900 mb-1">Entradas e saídas por mês</h2>
        <p className="text-xs text-gray-400 mb-4">Últimos 6 meses até o fim do período. Só dinheiro que já entrou ou saiu.</p>
        {loading ? <div className="h-64 bg-gray-50 rounded-xl animate-pulse" /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => Number(v).toLocaleString('pt-BR')} width={56} />
              <Tooltip formatter={(v: any) => brl(Number(v))} />
              <Legend />
              <Bar dataKey="Entradas" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Lançamentos */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Lançamentos <span className="text-gray-400 font-medium">({rows.length})</span></h2>
          <p className="text-xs text-gray-400">Pagos aparecem na data do caixa; em aberto, no vencimento.</p>
        </div>
        {loading ? <div className="p-6"><div className="h-24 bg-gray-50 rounded-xl animate-pulse" /></div>
          : rows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-500 mb-3">Nenhum lançamento neste período com esses filtros.</p>
              <button onClick={() => setModal('new')} className="text-sm font-semibold text-cyan-600 hover:text-cyan-700">Adicionar o primeiro lançamento</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Data', 'Empresa', 'Descrição', 'Categoria', 'Conta', 'Situação', 'Valor', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(e => {
                    const c = companyById.get(e.company_id)
                    const acc = e.account_id ? accountById.get(e.account_id) : undefined
                    const cat = e.category_id ? categoryById.get(e.category_id) : undefined
                    const late = e.status === 'pendente' && vencido(e)
                    return (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-gray-700 font-medium">
                            <span className="w-2 h-2 rounded-full" style={{ background: c?.color || '#9ca3af' }} />{c?.name.replace('Áion ', '') || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 min-w-[250px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{e.description}</span>
                            {e.installment_total && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700"><Layers className="w-3 h-3" />{e.installment_no}/{e.installment_total}</span>}
                            {e.recurrence_id && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700"><Repeat className="w-3 h-3" />Fixa</span>}
                            {e.source === 'asaas' && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700"><Zap className="w-3 h-3" />Asaas</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 ">{cat?.name || <span className="text-amber-600 font-semibold">Sem categoria</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {acc?.name || '—'}{e.payment_method && <span className="block text-xs text-gray-400">{PAYMENT_METHODS[e.payment_method]}</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {e.status === 'pago'
                            ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">{e.type === 'entrada' ? 'Recebido' : 'Pago'}</span>
                            : <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${late ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                                {late ? 'Vencido' : e.type === 'entrada' ? 'A receber' : 'A pagar'}
                              </span>}
                        </td>
                        <td className={`px-4 py-3 text-sm font-bold whitespace-nowrap ${e.type === 'entrada' ? 'text-green-700' : 'text-red-600'}`}>
                          {e.type === 'entrada' ? '+' : '−'}{brl(e.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {e.status === 'pendente' && e.source !== 'asaas' && (
                              <button onClick={() => markPaid(e)} className="text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                                {e.type === 'entrada' ? 'Marcar recebido' : 'Marcar pago'}
                              </button>
                            )}
                            <button onClick={() => setModal(e)} aria-label="Editar" className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                            {e.source !== 'asaas' && <button onClick={() => remove(e)} aria-label="Excluir" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {modal !== null && (
        <EntryModal
          entry={modal === 'new' ? undefined : modal}
          companies={companies} accounts={accounts} categories={categories}
          defaultCompanyId={companyFilter !== 'all' ? companyFilter : EDU_COMPANY_ID}
          userId={userId}
          onClose={() => setModal(null)}
          onSaved={load}
          showToast={showToast}
        />
      )}
      {config && (
        <FinanceiroConfig companies={companies} accounts={accounts} categories={categories} recurrences={recurrences}
          initialTab={config} onClose={() => setConfig(null)} onSaved={load} showToast={showToast} />
      )}
    </div>
  )
}

// ─── Casca com as abas do Financeiro geral ─────────────────────────────────

type Props = { periodStart: string; periodEnd: string; periodLabel: string; userId: string; showToast: (m: string, ok?: boolean) => void }
type SubTab = 'visao' | 'relatorios' | 'investimentos' | 'asaas'

export default function FinanceiroGeral(props: Props) {
  const [tab, setTab] = useState<SubTab>('visao')
  const [pending, setPending] = useState(0)
  const refreshPending = async () => {
    const { count } = await supabase.from('fin_asaas_charges').select('id', { count: 'exact', head: true }).is('company_id', null).eq('ignored', false)
    setPending(count || 0)
  }
  useEffect(() => { refreshPending() }, [])
  const tabs: { id: SubTab; label: string }[] = [
    { id: 'visao', label: 'Resumo' }, { id: 'relatorios', label: 'Relatórios' },
    { id: 'investimentos', label: 'Investimentos' }, { id: 'asaas', label: 'Asaas' },
  ]
  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <div className="flex gap-0 sm:gap-1 overflow-x-auto border-b border-gray-200" style={{ flexWrap: "nowrap" }} role="tablist">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`px-2 sm:px-4 py-2.5 text-[13px] sm:text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
            {t.id === 'asaas' && pending > 0 && <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px]">{pending}</span>}
          </button>
        ))}
      </div>
      {tab === 'visao' && <FinanceiroVisao {...props} />}
      {tab === 'relatorios' && <FinanceiroRelatorios {...props} />}
      {tab === 'investimentos' && <FinanceiroInvestimentos {...props} />}
      {tab === 'asaas' && <FinanceiroAsaas {...props} onChanged={refreshPending} />}
    </div>
  )
}
