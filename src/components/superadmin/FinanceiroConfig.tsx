// src/components/superadmin/FinanceiroConfig.tsx
// Configurações do Financeiro geral: empresas, contas, categorias e contas recorrentes.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, Trash2, Pause, Play } from 'lucide-react'
import {
  Company, Account, Category, Recurrence, ACCOUNT_KINDS, FREQUENCIES, GROUPS, brl, fmtDate, inp, lbl, btnPrimary,
} from './financeiroShared'

type Tab = 'empresas' | 'contas' | 'categorias' | 'recorrentes'
type Props = {
  companies: Company[]; accounts: Account[]; categories: Category[]; recurrences: Recurrence[]
  initialTab?: Tab
  onClose: () => void; onSaved: () => void; showToast: (m: string, ok?: boolean) => void
}

export default function FinanceiroConfig({ companies, accounts, categories, recurrences, initialTab = 'contas', onClose, onSaved, showToast }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [busy, setBusy] = useState(false)

  // empresas
  const [cName, setCName] = useState(''); const [cColor, setCColor] = useState('#059669')
  // contas
  const [accCompany, setAccCompany] = useState(companies.find(c => c.active)?.id || '')
  const [accName, setAccName] = useState(''); const [accKind, setAccKind] = useState('banco')
  // categorias
  const [catName, setCatName] = useState(''); const [catGrp, setCatGrp] = useState<'receita' | 'custo' | 'despesa'>('despesa')

  const fail = (m: string, e: { message: string }) => { showToast(m + ': ' + e.message, false); setBusy(false) }

  const addCompany = async () => {
    if (!cName.trim()) { showToast('Digite o nome da empresa.', false); return }
    setBusy(true)
    const { data, error } = await supabase.from('fin_companies').insert({ name: cName.trim(), color: cColor, sort_order: companies.length + 1 }).select('id').single()
    if (error || !data) { fail(error?.message.includes('duplicate') ? 'Já existe uma empresa com esse nome' : 'Não foi possível adicionar', error || { message: '' }); return }
    // Toda empresa nova já nasce com Conta bancária, Asaas e Caixa.
    await supabase.from('fin_accounts').insert([
      { company_id: data.id, name: 'Conta bancária', kind: 'banco', sort_order: 1 },
      { company_id: data.id, name: 'Asaas', kind: 'asaas', sort_order: 2 },
      { company_id: data.id, name: 'Caixa (dinheiro)', kind: 'caixa', sort_order: 3 },
    ])
    setBusy(false); setCName(''); showToast('Empresa adicionada com as contas padrão.'); onSaved()
  }
  const toggleCompany = async (c: Company) => {
    const { error } = await supabase.from('fin_companies').update({ active: !c.active }).eq('id', c.id)
    if (error) return fail('Não foi possível atualizar', error)
    onSaved()
  }

  const addAccount = async () => {
    if (!accName.trim() || !accCompany) { showToast('Escolha a empresa e digite o nome da conta.', false); return }
    setBusy(true)
    const { error } = await supabase.from('fin_accounts').insert({ company_id: accCompany, name: accName.trim(), kind: accKind, sort_order: accounts.filter(a => a.company_id === accCompany).length + 1 })
    if (error) return fail(error.message.includes('duplicate') ? 'Essa empresa já tem uma conta com esse nome' : 'Não foi possível adicionar', error)
    setBusy(false); setAccName(''); showToast('Conta adicionada.'); onSaved()
  }
  const toggleAccount = async (a: Account) => {
    const { error } = await supabase.from('fin_accounts').update({ active: !a.active }).eq('id', a.id)
    if (error) return fail('Não foi possível atualizar', error)
    onSaved()
  }

  const addCategory = async () => {
    if (!catName.trim()) { showToast('Digite o nome da categoria.', false); return }
    setBusy(true)
    const { error } = await supabase.from('fin_categories').insert({ name: catName.trim(), grp: catGrp, legacy_key: 'outro', sort_order: 100 + categories.length })
    if (error) return fail(error.message.includes('duplicate') ? 'Já existe uma categoria com esse nome' : 'Não foi possível adicionar', error)
    setBusy(false); setCatName(''); showToast('Categoria adicionada.'); onSaved()
  }
  const toggleCategory = async (c: Category) => {
    const { error } = await supabase.from('fin_categories').update({ active: !c.active }).eq('id', c.id)
    if (error) return fail('Não foi possível atualizar', error)
    onSaved()
  }

  const updateRec = async (r: Recurrence, patch: Partial<Recurrence>) => {
    const { error } = await supabase.from('fin_recurrences').update(patch).eq('id', r.id)
    if (error) return fail('Não foi possível atualizar', error)
    showToast('Recorrente atualizada.'); onSaved()
  }
  const removeRec = async (r: Recurrence) => {
    if (!confirm(`Parar e remover a recorrente "${r.description}"? Os lançamentos já criados continuam.`)) return
    const { error } = await supabase.from('fin_recurrences').delete().eq('id', r.id)
    if (error) return fail('Não foi possível remover', error)
    showToast('Recorrente removida.'); onSaved()
  }

  const companyById = new Map(companies.map(c => [c.id, c]))
  const tabs: [Tab, string][] = [['contas', 'Contas'], ['categorias', 'Categorias'], ['recorrentes', 'Recorrentes'], ['empresas', 'Empresas']]
  const tabBtn = (on: boolean) => `px-3 py-2 text-sm font-semibold rounded-lg whitespace-nowrap ${on ? 'bg-cyan-50 text-cyan-700' : 'text-gray-500 hover:bg-gray-50'}`
  const row = 'flex items-center gap-3 px-4 py-3'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Configurar financeiro</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {tabs.map(([k, v]) => <button key={k} onClick={() => setTab(k)} className={tabBtn(tab === k)}>{v}</button>)}
        </div>

        {tab === 'empresas' && (
          <>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl mb-4">
              {companies.map(c => (
                <div key={c.id} className={row}>
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className={`flex-1 text-sm font-semibold ${c.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{c.name}</span>
                  <button onClick={() => toggleCompany(c)} className="text-xs font-semibold text-gray-500 hover:text-cyan-600">{c.active ? 'Desativar' : 'Reativar'}</button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mb-2">Empresa nova já nasce com Conta bancária, Asaas e Caixa.</p>
            <div className="flex gap-2">
              <input className={inp} placeholder="Nome da nova empresa" value={cName} onChange={e => setCName(e.target.value)} />
              <input type="color" aria-label="Cor" value={cColor} onChange={e => setCColor(e.target.value)} className="w-12 h-[42px] p-1 border border-gray-200 rounded-lg bg-white flex-shrink-0" />
            </div>
            <button onClick={addCompany} disabled={busy} className={btnPrimary + ' w-full mt-3'}><Plus className="w-4 h-4" />Adicionar empresa</button>
          </>
        )}

        {tab === 'contas' && (
          <>
            <p className="text-xs text-gray-500 mb-3">Contas são os lugares onde o dinheiro entra e sai: banco, Asaas, caixa, cartão.</p>
            {companies.filter(c => c.active).map(c => (
              <div key={c.id} className="mb-3">
                <p className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}</p>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                  {accounts.filter(a => a.company_id === c.id).map(a => (
                    <div key={a.id} className={row}>
                      <span className={`flex-1 text-sm font-semibold ${a.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{a.name}</span>
                      <span className="text-xs text-gray-400">{ACCOUNT_KINDS[a.kind]}</span>
                      <button onClick={() => toggleAccount(a)} className="text-xs font-semibold text-gray-500 hover:text-cyan-600">{a.active ? 'Desativar' : 'Reativar'}</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="col-span-2"><label className={lbl}>Nova conta em</label>
                <select className={inp} value={accCompany} onChange={e => setAccCompany(e.target.value)}>
                  {companies.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <input className={inp} placeholder="Nome (ex.: Sicredi)" value={accName} onChange={e => setAccName(e.target.value)} />
              <select className={inp} value={accKind} onChange={e => setAccKind(e.target.value)} aria-label="Tipo da conta">
                {Object.entries(ACCOUNT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <button onClick={addAccount} disabled={busy} className={btnPrimary + ' w-full mt-3'}><Plus className="w-4 h-4" />Adicionar conta</button>
          </>
        )}

        {tab === 'categorias' && (
          <>
            <p className="text-xs text-gray-500 mb-3">Categorias dizem o que é cada lançamento e valem para todas as empresas.</p>
            {(['receita', 'custo', 'despesa'] as const).map(g => (
              <div key={g} className="mb-3">
                <p className="text-xs font-bold text-gray-700 mb-1.5">{GROUPS[g]}</p>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                  {categories.filter(c => c.grp === g).map(c => (
                    <div key={c.id} className={row}>
                      <span className={`flex-1 text-sm font-semibold ${c.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{c.name}</span>
                      <button onClick={() => toggleCategory(c)} className="text-xs font-semibold text-gray-500 hover:text-cyan-600">{c.active ? 'Desativar' : 'Reativar'}</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <input className={inp} placeholder="Nova categoria" value={catName} onChange={e => setCatName(e.target.value)} />
              <select className={inp} value={catGrp} onChange={e => setCatGrp(e.target.value as any)} aria-label="Grupo">
                {Object.entries(GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <button onClick={addCategory} disabled={busy} className={btnPrimary + ' w-full mt-3'}><Plus className="w-4 h-4" />Adicionar categoria</button>
          </>
        )}

        {tab === 'recorrentes' && (
          <>
            <p className="text-xs text-gray-500 mb-3">Contas fixas como aluguel, água e luz. O sistema cria o lançamento "a pagar" sozinho a cada período. Para criar uma nova, use "Novo lançamento" e escolha Recorrente.</p>
            {recurrences.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8 border border-dashed border-gray-200 rounded-xl">Nenhuma conta recorrente ainda.</p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                {recurrences.map(r => (
                  <div key={r.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: companyById.get(r.company_id)?.color || '#9ca3af' }} />
                      <span className={`flex-1 text-sm font-semibold ${r.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{r.description}</span>
                      <button onClick={() => updateRec(r, { active: !r.active })} aria-label={r.active ? 'Pausar' : 'Reativar'} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                        {r.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => removeRec(r)} aria-label="Remover" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span>{FREQUENCIES[r.frequency]}</span>
                      <span>próximo: {fmtDate(r.next_date)}</span>
                      {r.end_date && <span>até {fmtDate(r.end_date)}</span>}
                      <label className="ml-auto flex items-center gap-1.5">valor
                        <input type="number" step="0.01" min="0" defaultValue={r.amount} aria-label="Valor"
                          onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== r.amount) updateRec(r, { amount: v }) }}
                          className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">Mudar o valor vale para os próximos meses. Para ajustar um mês já criado (ex.: conta de luz), edite o lançamento dele.</p>
            <p className="text-xs text-gray-400 mt-1">Total mensal fixo ativo: {brl(recurrences.filter(r => r.active && r.type === 'saida' && r.frequency === 'monthly').reduce((s, r) => s + r.amount, 0))}</p>
          </>
        )}
      </div>
    </div>
  )
}
