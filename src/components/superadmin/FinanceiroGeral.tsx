// src/components/superadmin/FinanceiroGeral.tsx
// Financeiro geral da Áion (Fase 1): todas as empresas no mesmo caixa.
// Regime de CAIXA: o lançamento conta na data em que o dinheiro entrou/saiu.
// "Pendente" = a pagar / a receber: fica fora dos totais até ser marcado como pago.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  ArrowDownCircle, ArrowUpCircle, Scale, Wallet, Clock, Plus, Pencil, Trash2,
  CheckCircle2, X, Building2, Search,
} from 'lucide-react'

export const EDU_COMPANY_ID = '00000000-0000-4000-8000-0000000000e1'

type Company = { id: string; name: string; color: string; active: boolean; sort_order: number }
type Entry = {
  id: string; type: 'entrada' | 'saida'; amount: number; description: string; category: string
  entry_date: string; due_date: string | null; status: 'pago' | 'pendente'; company_id: string
  notes: string | null; folha_tipo: string | null; source: string
}

const CATEGORIES: Record<string, string> = {
  venda:               'Venda / Assinatura',
  implantacao_avulsa:  'Implantação avulsa',
  consultoria:         'Consultoria',
  patrocinio:          'Patrocínio',
  marketing:           'Marketing',
  infraestrutura:      'Infraestrutura',
  software:            'Software e ferramentas',
  imposto:             'Impostos',
  folha:               'Folha',
  outro:               'Outro',
}
const FOLHA_TIPO: Record<string, string> = {
  funcionario:  'Funcionário',
  socio_victor: 'Retirada de sócio - Victor',
  socio_fabio:  'Retirada de sócio - Fábio',
}

const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
const fmtDate = (s: string | null) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const inRange = (d: string, a: string, b: string) => d >= a && d <= b

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

// ─── Modal de lançamento ──────────────────────────────────────────────────
function EntryModal({ entry, companies, defaultCompanyId, userId, onClose, onSaved, showToast }: {
  entry?: Entry; companies: Company[]; defaultCompanyId: string; userId?: string
  onClose: () => void; onSaved: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const isNew = !entry
  const [form, setForm] = useState({
    type: entry?.type || 'saida' as 'entrada' | 'saida',
    company_id: entry?.company_id || defaultCompanyId,
    description: entry?.description || '',
    amount: entry ? String(entry.amount) : '',
    category: entry?.category || 'outro',
    folha_tipo: entry?.folha_tipo || '',
    status: entry?.status || 'pago' as 'pago' | 'pendente',
    entry_date: entry?.entry_date || todayISO(),
    due_date: entry?.due_date || '',
    notes: entry?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const pendente = form.status === 'pendente'

  const save = async () => {
    if (!form.description.trim() || !(Number(form.amount) > 0)) { showToast('Preencha a descrição e um valor maior que zero.', false); return }
    if (pendente && !form.due_date) { showToast('Para a pagar/a receber, informe o vencimento.', false); return }
    setSaving(true)
    const payload = {
      type: form.type,
      company_id: form.company_id,
      description: form.description.trim(),
      amount: Number(form.amount),
      category: form.category,
      folha_tipo: form.category === 'folha' ? (form.folha_tipo || null) : null,
      status: form.status,
      // Pendente ainda não movimentou o caixa: a data do lançamento acompanha o vencimento.
      entry_date: pendente ? form.due_date : form.entry_date,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    }
    const { error } = isNew
      ? await supabase.from('financial_entries').insert({ ...payload, source: 'manual', created_by: userId || null })
      : await supabase.from('financial_entries').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', entry!.id)
    setSaving(false)
    if (error) { showToast('Não foi possível salvar: ' + error.message, false); return }
    showToast(isNew ? 'Lançamento adicionado.' : 'Lançamento atualizado.')
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Novo lançamento' : 'Editar lançamento'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => set('type', 'entrada')}
              className={`py-2.5 rounded-lg text-sm font-semibold border ${form.type === 'entrada' ? 'bg-green-50 border-green-400 text-green-700' : 'border-gray-200 text-gray-500'}`}>Entrada</button>
            <button type="button" onClick={() => set('type', 'saida')}
              className={`py-2.5 rounded-lg text-sm font-semibold border ${form.type === 'saida' ? 'bg-red-50 border-red-400 text-red-700' : 'border-gray-200 text-gray-500'}`}>Saída</button>
          </div>
          <div>
            <label className={lbl}>Empresa *</label>
            <select className={inp} value={form.company_id} onChange={e => set('company_id', e.target.value)}>
              {companies.filter(c => c.active || c.id === form.company_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Descrição *</label>
            <input className={inp} placeholder="Ex: Hospedagem do mês, Consultoria pontual..." value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Valor (R$) *</label>
              <input type="number" step="0.01" min="0" className={inp} value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Categoria</label>
              <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {form.category === 'folha' && (
            <div>
              <label className={lbl}>Tipo (folha)</label>
              <select className={inp} value={form.folha_tipo} onChange={e => set('folha_tipo', e.target.value)}>
                <option value="">Selecionar...</option>
                {Object.entries(FOLHA_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={lbl}>Situação</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => set('status', 'pago')}
                className={`py-2.5 rounded-lg text-sm font-semibold border ${!pendente ? 'bg-cyan-50 border-cyan-400 text-cyan-700' : 'border-gray-200 text-gray-500'}`}>
                {form.type === 'entrada' ? 'Já recebido' : 'Já pago'}
              </button>
              <button type="button" onClick={() => set('status', 'pendente')}
                className={`py-2.5 rounded-lg text-sm font-semibold border ${pendente ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-gray-200 text-gray-500'}`}>
                {form.type === 'entrada' ? 'A receber' : 'A pagar'}
              </button>
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
          <div>
            <label className={lbl}>Observações</label>
            <input className={inp} placeholder="Detalhes opcionais..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving ? 'Salvando...' : <><CheckCircle2 className="w-4 h-4" />Salvar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de empresas ────────────────────────────────────────────────────
function CompaniesModal({ companies, onClose, onSaved, showToast }: {
  companies: Company[]; onClose: () => void; onSaved: () => void; showToast: (m: string, ok?: boolean) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#059669')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!name.trim()) { showToast('Digite o nome da empresa.', false); return }
    setBusy(true)
    const { error } = await supabase.from('fin_companies').insert({ name: name.trim(), color, sort_order: companies.length + 1 })
    setBusy(false)
    if (error) { showToast(error.message.includes('duplicate') ? 'Já existe uma empresa com esse nome.' : 'Não foi possível adicionar: ' + error.message, false); return }
    setName(''); showToast('Empresa adicionada.'); onSaved()
  }
  const toggle = async (c: Company) => {
    const { error } = await supabase.from('fin_companies').update({ active: !c.active }).eq('id', c.id)
    if (error) { showToast('Não foi possível atualizar: ' + error.message, false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Empresas</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl mb-4">
          {companies.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className={`flex-1 text-sm font-semibold ${c.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{c.name}</span>
              <button onClick={() => toggle(c)} className="text-xs font-semibold text-gray-500 hover:text-cyan-600">{c.active ? 'Desativar' : 'Reativar'}</button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mb-2">Empresa nova começa vazia. Os lançamentos antigos continuam na Áion Edu.</p>
        <div className="flex gap-2">
          <input className={inp} placeholder="Nome da nova empresa" value={name} onChange={e => setName(e.target.value)} />
          <input type="color" aria-label="Cor" value={color} onChange={e => setColor(e.target.value)} className="w-12 h-[42px] p-1 border border-gray-200 rounded-lg bg-white flex-shrink-0" />
        </div>
        <button onClick={add} disabled={busy}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
          <Plus className="w-4 h-4" />Adicionar empresa
        </button>
      </div>
    </div>
  )
}

// ─── Aba ──────────────────────────────────────────────────────────────────
export default function FinanceiroGeral({ periodStart, periodEnd, periodLabel, userId, showToast }: {
  periodStart: string; periodEnd: string; periodLabel: string; userId?: string
  showToast: (m: string, ok?: boolean) => void
}) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'entrada' | 'saida'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pago' | 'pendente'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Entry | 'new' | null>(null)
  const [showCompanies, setShowCompanies] = useState(false)

  const load = async () => {
    const [cRes, eRes] = await Promise.all([
      supabase.from('fin_companies').select('*').order('sort_order'),
      supabase.from('financial_entries')
        .select('id,type,amount,description,category,entry_date,due_date,status,company_id,notes,folha_tipo,source')
        .order('entry_date', { ascending: false }).limit(5000),
    ])
    if (cRes.error || eRes.error) showToast('Não foi possível carregar o financeiro: ' + (cRes.error || eRes.error)!.message, false)
    setCompanies((cRes.data || []) as Company[])
    setEntries(((eRes.data || []) as any[]).map(e => ({ ...e, amount: Number(e.amount) })) as Entry[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const companyById = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies])

  // Base: filtros de empresa/tipo/categoria/busca (o período e a situação entram depois).
  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e =>
      (companyFilter === 'all' || e.company_id === companyFilter) &&
      (typeFilter === 'all' || e.type === typeFilter) &&
      (categoryFilter === 'all' || e.category === categoryFilter) &&
      (!q || e.description.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q)))
  }, [entries, companyFilter, typeFilter, categoryFilter, search])

  const paid = base.filter(e => e.status === 'pago')
  const paidInPeriod = paid.filter(e => inRange(e.entry_date, periodStart, periodEnd))
  const entradas = paidInPeriod.filter(e => e.type === 'entrada').reduce((s, e) => s + e.amount, 0)
  const saidas = paidInPeriod.filter(e => e.type === 'saida').reduce((s, e) => s + e.amount, 0)
  const saldo = paid.filter(e => e.entry_date <= periodEnd).reduce((s, e) => s + (e.type === 'entrada' ? e.amount : -e.amount), 0)
  const pend = base.filter(e => e.status === 'pendente')
  const aReceber = pend.filter(e => e.type === 'entrada').reduce((s, e) => s + e.amount, 0)
  const aPagar = pend.filter(e => e.type === 'saida').reduce((s, e) => s + e.amount, 0)
  const vencido = (e: Entry) => (e.due_date || e.entry_date) < todayISO()
  const receberAtrasado = pend.filter(e => e.type === 'entrada' && vencido(e)).length
  const pagarAtrasado = pend.filter(e => e.type === 'saida' && vencido(e)).length

  // Lista: período (pagos pela data do caixa; pendentes pelo vencimento) + situação.
  const rows = base.filter(e => inRange(e.entry_date, periodStart, periodEnd) && (statusFilter === 'all' || e.status === statusFilter))

  // Gráfico: 6 meses terminando no mês do fim do período (só caixa realizado).
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
    const { error } = await supabase.from('financial_entries').delete().eq('id', e.id)
    if (error) { showToast('Não foi possível excluir: ' + error.message, false); return }
    showToast('Lançamento excluído.'); load()
  }

  const activeCompanies = companies.filter(c => c.active)
  const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${on ? 'bg-cyan-50 border-cyan-400 text-cyan-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`

  const kpis = [
    { label: 'Entradas', value: brl(entradas), sub: `recebido em ${periodLabel}`, icon: ArrowUpCircle, grad: 'from-green-500 to-emerald-600' },
    { label: 'Saídas', value: brl(saidas), sub: `pago em ${periodLabel}`, icon: ArrowDownCircle, grad: 'from-red-500 to-rose-600' },
    { label: 'Resultado', value: brl(entradas - saidas), sub: 'entradas menos saídas do período', icon: Scale, grad: entradas - saidas >= 0 ? 'from-cyan-500 to-blue-600' : 'from-red-500 to-rose-600' },
    { label: 'Saldo em caixa', value: brl(saldo), sub: 'acumulado até o fim do período', icon: Wallet, grad: saldo >= 0 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600' },
    { label: 'A receber', value: brl(aReceber), sub: receberAtrasado > 0 ? `${receberAtrasado} vencido(s)` : `${pend.filter(e => e.type === 'entrada').length} lançamento(s) em aberto`, icon: Clock, grad: receberAtrasado > 0 ? 'from-red-500 to-rose-600' : 'from-amber-500 to-orange-500' },
    { label: 'A pagar', value: brl(aPagar), sub: pagarAtrasado > 0 ? `${pagarAtrasado} vencido(s)` : `${pend.filter(e => e.type === 'saida').length} lançamento(s) em aberto`, icon: Clock, grad: pagarAtrasado > 0 ? 'from-red-500 to-rose-600' : 'from-amber-500 to-orange-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setCompanyFilter('all')} className={chip(companyFilter === 'all')}>Todas as empresas</button>
          {activeCompanies.map(c => (
            <button key={c.id} onClick={() => setCompanyFilter(c.id)} className={chip(companyFilter === c.id)}>
              <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: c.color }} />{c.name}
            </button>
          ))}
          <button onClick={() => setShowCompanies(true)} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-cyan-600">
            <Building2 className="w-3.5 h-3.5" />Gerenciar empresas
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <select className={inp} value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} aria-label="Tipo">
            <option value="all">Todos os tipos</option><option value="entrada">Só entradas</option><option value="saida">Só saídas</option>
          </select>
          <select className={inp} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} aria-label="Situação">
            <option value="all">Toda situação</option><option value="pago">Só pagos</option><option value="pendente">Só em aberto</option>
          </select>
          <select className={inp} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Categoria">
            <option value="all">Categoria</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="relative col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input className={inp + ' pl-9'} placeholder="Buscar descrição" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setModal('new')}
            className="col-span-2 lg:col-span-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold text-sm">
            <Plus className="w-4 h-4" />Novo lançamento
          </button>
        </div>
      </div>

      {/* Painel */}
      <div className="aion-snap grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{k.label}</p>
                  {loading ? <div className="h-7 w-20 bg-gray-100 rounded animate-pulse" /> : <p className="text-xl font-bold text-gray-900">{k.value}</p>}
                  {!loading && <p className="text-xs text-gray-400 mt-1">{k.sub}</p>}
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.grad} flex items-center justify-center flex-shrink-0`}><Icon className="w-5 h-5 text-white" /></div>
              </div>
            </div>
          )
        })}
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
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Data', 'Empresa', 'Descrição', 'Categoria', 'Situação', 'Valor', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(e => {
                    const c = companyById.get(e.company_id)
                    const late = e.status === 'pendente' && vencido(e)
                    return (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-gray-700 font-medium">
                            <span className="w-2 h-2 rounded-full" style={{ background: c?.color || '#9ca3af' }} />{c?.name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{e.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{CATEGORIES[e.category] || e.category}</td>
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
                            {e.status === 'pendente' && (
                              <button onClick={() => markPaid(e)} className="text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                                {e.type === 'entrada' ? 'Marcar recebido' : 'Marcar pago'}
                              </button>
                            )}
                            <button onClick={() => setModal(e)} aria-label="Editar" className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => remove(e)} aria-label="Excluir" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
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
          companies={companies}
          defaultCompanyId={companyFilter !== 'all' ? companyFilter : EDU_COMPANY_ID}
          userId={userId}
          onClose={() => setModal(null)}
          onSaved={load}
          showToast={showToast}
        />
      )}
      {showCompanies && <CompaniesModal companies={companies} onClose={() => setShowCompanies(false)} onSaved={load} showToast={showToast} />}
    </div>
  )
}
