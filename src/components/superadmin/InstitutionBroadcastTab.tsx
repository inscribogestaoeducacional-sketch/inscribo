// =============================================================================
// src/components/superadmin/InstitutionBroadcastTab.tsx
//
// Aba "Transmissões" do InstitutionDetails (Super Admin), pra UMA escola:
//   - resumo (broadcast_institution_summary — com margem e custo da Meta, que
//     só o Super Admin vê);
//   - configuração do módulo (broadcast_settings: liga/desliga — o que mostra
//     ou esconde o menu pra escola —, limites, conta própria, janela), com
//     confirmação do que muda;
//   - ajuste manual de crédito (broadcast_adjust_credit: motivo obrigatório,
//     saldo antes → depois, recusa se o saldo mudou no meio);
//   - extrato (broadcast_credit_statement) e últimas campanhas (detalhe em
//     modo só leitura — as ações de campanha são da escola).
// =============================================================================
import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, Wallet, Settings2, History, Send, AlertTriangle, X, Plus, Minus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { CAMPAIGN_STATUS, type Campaign } from '../../lib/broadcasts'
import CampaignDetail from '../transmissoes/CampaignDetail'

interface Settings { enabled: boolean; meta_own_account: boolean; hourly_limit: number; daily_limit: number; reply_window_hours: number }
const DEFAULT_SETTINGS: Settings = { enabled: false, meta_own_account: false, hourly_limit: 250, daily_limit: 1000, reply_window_hours: 72 }
const SETTING_LABEL: Record<keyof Settings, string> = {
  enabled: 'Módulo liberado', meta_own_account: 'Conta própria na Meta', hourly_limit: 'Limite por hora',
  daily_limit: 'Limite por dia', reply_window_hours: 'Janela de resposta (horas)',
}

interface StatementRow { id: string; created_at: string; kind: string; amount_brl: number; balance_after: number; description: string; created_by_name: string | null; total_count: number }

const brl = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const showSetting = (k: keyof Settings, v: Settings[keyof Settings]) => typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v)

const PERIODS = [
  { key: 'month', label: 'Mês atual' }, { key: '90', label: '90 dias' }, { key: '365', label: '12 meses' }, { key: 'all', label: 'Tudo' },
] as const
function periodStart(k: typeof PERIODS[number]['key']): string | null {
  const now = new Date()
  if (k === 'all') return null
  if (k === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  return new Date(now.getTime() - Number(k) * 86400000).toISOString()
}

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none'

export default function InstitutionBroadcastTab({ institutionId }: { institutionId: string }) {
  const [period, setPeriod] = useState<typeof PERIODS[number]['key']>('all')
  const [summary, setSummary] = useState<any>(null)
  const [saved, setSaved] = useState<Settings | null>(null)
  const [hasRow, setHasRow] = useState(false)
  const [form, setForm] = useState<Settings>(DEFAULT_SETTINGS)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [statement, setStatement] = useState<StatementRow[]>([])
  const [statementTotal, setStatementTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmSettings, setConfirmSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [adjust, setAdjust] = useState<{ type: 'credit' | 'debit'; amount: string; reason: string } | null>(null)
  const [adjustStep, setAdjustStep] = useState<'form' | 'confirm'>('form')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function loadSummary() {
    const { data, error: e } = await supabase.rpc('broadcast_institution_summary', { p_institution_id: institutionId, p_start: periodStart(period), p_end: null })
    if (e) setError(e.message)
    setSummary((data as any[])?.[0] || null)
  }
  async function loadStatement(limit = 10) {
    const { data } = await supabase.rpc('broadcast_credit_statement', { p_institution_id: institutionId, p_limit: limit, p_offset: 0 })
    const rows = (data || []) as StatementRow[]
    setStatement(rows)
    setStatementTotal(Number(rows[0]?.total_count || 0))
  }
  async function loadAll() {
    setLoading(true); setError(null)
    const [{ data: s }, { data: camps }] = await Promise.all([
      supabase.from('broadcast_settings').select('enabled, meta_own_account, hourly_limit, daily_limit, reply_window_hours').eq('institution_id', institutionId).maybeSingle(),
      supabase.from('broadcast_campaigns').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }).limit(10),
    ])
    const st = (s as Settings | null) || null
    setHasRow(!!st); setSaved(st || DEFAULT_SETTINGS); setForm(st || DEFAULT_SETTINGS)
    setCampaigns((camps || []) as Campaign[])
    await Promise.all([loadSummary(), loadStatement()])
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loading) loadSummary() }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Configuração ──
  const changes = saved ? (Object.keys(SETTING_LABEL) as (keyof Settings)[]).filter(k => form[k] !== saved[k]) : []
  const settingsProblem = (() => {
    if (!Number.isInteger(form.hourly_limit) || form.hourly_limit < 1) return 'Limite por hora precisa ser um número inteiro maior que zero'
    if (!Number.isInteger(form.daily_limit) || form.daily_limit < form.hourly_limit) return 'Limite por dia precisa ser maior ou igual ao limite por hora'
    if (!Number.isInteger(form.reply_window_hours) || form.reply_window_hours < 1 || form.reply_window_hours > 720) return 'Janela de resposta entre 1 e 720 horas'
    return null
  })()

  async function saveSettings() {
    setSavingSettings(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: e } = await supabase.from('broadcast_settings').upsert({ institution_id: institutionId, ...form, updated_by: user?.id || null }, { onConflict: 'institution_id' })
    setSavingSettings(false); setConfirmSettings(false)
    if (e) { setError(`Não foi possível salvar: ${e.message}`); return }
    setNotice('Configuração salva.')
    loadAll()
  }

  // ── Ajuste de crédito ──
  const balance = Number(summary?.credit_balance_brl || 0)
  const adjAmount = adjust ? Math.round(Number(String(adjust.amount).replace(',', '.')) * 100) / 100 : 0
  const signed = adjust?.type === 'debit' ? -adjAmount : adjAmount
  const adjustProblem = (() => {
    if (!adjust) return null
    if (!/^\d+([.,]\d{1,2})?$/.test(adjust.amount.trim()) || adjAmount <= 0) return 'Informe um valor maior que zero (até 2 casas decimais)'
    if (adjust.reason.trim().length < 3) return 'O motivo é obrigatório'
    if (adjust.type === 'debit' && adjAmount > balance) return `Débito maior que o saldo (${brl(balance)})`
    return null
  })()

  async function confirmAdjust() {
    setAdjusting(true); setAdjustError(null)
    const { data, error: e } = await supabase.rpc('broadcast_adjust_credit', {
      p_institution_id: institutionId, p_amount: signed, p_reason: adjust!.reason.trim(), p_expected_balance: balance,
    })
    setAdjusting(false)
    if (e) {
      setAdjustError(e.message)
      if (/saldo mudou/i.test(e.message)) { await loadSummary(); setAdjustStep('form') }
      return
    }
    const r = data as any
    setAdjust(null); setAdjustStep('form')
    setNotice(`Ajuste lançado: ${brl(r.balance_before_brl)} → ${brl(r.balance_after_brl)}.`)
    await Promise.all([loadSummary(), loadStatement()])
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan-600 animate-spin" /></div>

  const s = summary || {}
  const kpi = (label: string, value: string, hint?: string, tone = 'text-gray-900') => (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${tone}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex justify-between">{error}<button onClick={() => setError(null)}><X className="w-4 h-4" /></button></div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex justify-between">{notice}<button onClick={() => setNotice(null)}><X className="w-4 h-4" /></button></div>}

      {/* ── Resumo ── */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Send className="w-4 h-4 text-sky-600" /> Resumo de Transmissões</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)} className={`px-2.5 py-1 text-xs font-semibold rounded-md ${period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{p.label}</button>
              ))}
            </div>
            <button onClick={loadAll} className="p-1.5 text-gray-400 hover:text-gray-700" title="Atualizar"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpi('Cobrado (Asaas)', brl(s.charged_brl), Number(s.refunded_brl) > 0 ? `${brl(s.refunded_brl)} estornado` : undefined)}
          {kpi('Coberto por crédito', brl(s.credit_used_brl))}
          {kpi('Margem da Áion', brl(s.aion_margin_brl), `${Number(s.messages_billed || 0).toLocaleString('pt-BR')} msgs faturadas`, 'text-green-700')}
          {kpi('Custo Meta (estimado)', brl(s.meta_cost_est_brl), s.own_account ? 'conta própria: zero' : undefined)}
          {kpi('Saldo de crédito', brl(s.credit_balance_brl), 'atual')}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          {kpi('Campanhas liberadas', String(Number(s.campaigns_released || 0)), `${Number(s.campaigns_active || 0)} em andamento`)}
          {kpi('Enviadas', Number(s.messages_sent || 0).toLocaleString('pt-BR'))}
          {kpi('Entregues', Number(s.messages_delivered || 0).toLocaleString('pt-BR'))}
          {kpi('Lidas', Number(s.messages_read || 0).toLocaleString('pt-BR'))}
          {kpi('Respostas', Number(s.replies || 0).toLocaleString('pt-BR'))}
        </div>
      </section>

      {/* ── Configuração ── */}
      <section className="border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4"><Settings2 className="w-4 h-4 text-gray-500" /> Configuração do módulo {!hasRow && <span className="text-xs font-normal text-gray-400">(ainda não configurado — valores padrão)</span>}</p>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
            <span><span className="text-sm font-semibold text-gray-900">Módulo liberado</span><span className="block text-xs text-gray-500">Mostra o menu "Transmissões" pra escola e permite criar templates e campanhas.</span></span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={form.meta_own_account} onChange={e => setForm(f => ({ ...f, meta_own_account: e.target.checked }))} />
            <span><span className="text-sm font-semibold text-gray-900">Conta própria na Meta</span><span className="block text-xs text-gray-500">A Meta cobra a escola direto — a Áion cobra só a taxa por mensagem.</span></span>
          </label>
          <label className="text-xs font-semibold text-gray-500">Limite por hora
            <input type="number" min={1} className={inp} value={form.hourly_limit} onChange={e => setForm(f => ({ ...f, hourly_limit: Number(e.target.value) }))} />
            <span className="font-normal text-gray-400">Envio espalhado: ~{Math.max(1, Math.ceil((form.hourly_limit || 0) / 60))} mensagem(ns) por minuto.</span>
          </label>
          <label className="text-xs font-semibold text-gray-500">Limite por dia
            <input type="number" min={1} className={inp} value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: Number(e.target.value) }))} />
          </label>
          <label className="text-xs font-semibold text-gray-500">Janela de resposta (horas)
            <input type="number" min={1} max={720} className={inp} value={form.reply_window_hours} onChange={e => setForm(f => ({ ...f, reply_window_hours: Number(e.target.value) }))} />
            <span className="font-normal text-gray-400">Resposta sem citar a mensagem conta pra campanha dentro desse prazo.</span>
          </label>
        </div>
        {settingsProblem && <p className="text-xs text-amber-700 mt-3">{settingsProblem}</p>}
        <div className="flex justify-end gap-2 mt-4">
          {changes.length > 0 && <button onClick={() => saved && setForm(saved)} className="px-4 py-2 text-sm font-semibold text-gray-500">Descartar</button>}
          <button disabled={changes.length === 0 || !!settingsProblem} onClick={() => setConfirmSettings(true)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700 disabled:opacity-50">Salvar</button>
        </div>
      </section>

      {/* ── Crédito ── */}
      <section className="border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Wallet className="w-4 h-4 text-green-600" /> Crédito — saldo {brl(balance)}</p>
          <div className="flex gap-2">
            <button onClick={() => { setAdjust({ type: 'credit', amount: '', reason: '' }); setAdjustStep('form'); setAdjustError(null) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Lançar crédito</button>
            <button onClick={() => { setAdjust({ type: 'debit', amount: '', reason: '' }); setAdjustStep('form'); setAdjustError(null) }} disabled={balance <= 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold disabled:opacity-40"><Minus className="w-3.5 h-3.5" /> Debitar</button>
          </div>
        </div>
        <p className="text-xs text-gray-400 flex items-center gap-1.5 mb-2"><History className="w-3.5 h-3.5" /> Extrato{statementTotal > statement.length ? ` (${statement.length} de ${statementTotal})` : ''}</p>
        {statement.length === 0 ? <p className="text-sm text-gray-400">Nenhum lançamento.</p> : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50">
              {statement.map(l => (
                <tr key={l.id}>
                  <td className="py-2 pr-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(l.created_at)}</td>
                  <td className="py-2 pr-3 text-gray-700">{l.description}{l.created_by_name && <span className="text-xs text-gray-400"> · por {l.created_by_name}</span>}</td>
                  <td className={`py-2 pr-3 text-right font-semibold whitespace-nowrap ${Number(l.amount_brl) >= 0 ? 'text-green-700' : 'text-red-600'}`}>{Number(l.amount_brl) >= 0 ? '+' : '−'}{brl(Math.abs(Number(l.amount_brl)))}</td>
                  <td className="py-2 text-right text-gray-500 whitespace-nowrap">{brl(l.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {statementTotal > statement.length && <button onClick={() => loadStatement(200)} className="mt-2 text-xs font-semibold text-cyan-700">Ver extrato completo</button>}
      </section>

      {/* ── Campanhas ── */}
      <section className="border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Últimas campanhas</p>
        {campaigns.length === 0 ? <p className="text-sm text-gray-400">Nenhuma campanha.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-400 uppercase"><th className="text-left py-1">Campanha</th><th className="text-left py-1">Status</th><th className="text-right py-1">Enviadas</th><th className="text-right py-1">Cobrado</th><th className="text-right py-1">Criada</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map(c => {
                const st = CAMPAIGN_STATUS[c.status]
                return (
                  <tr key={c.id} onClick={() => setDetailId(c.id)} className="cursor-pointer hover:bg-gray-50">
                    <td className="py-2 pr-3"><div className="font-semibold text-gray-900">{c.name}</div><div className="text-xs text-gray-400">{c.template_name}</div></td>
                    <td className="py-2 pr-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span></td>
                    <td className="py-2 pr-3 text-right text-gray-700">{c.sent_count} / {c.total_recipients}</td>
                    <td className="py-2 pr-3 text-right text-gray-700">{c.priced_at ? (Number(c.total_charged_brl) > 0 ? brl(c.total_charged_brl) : 'Crédito') : '—'}</td>
                    <td className="py-2 text-right text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Confirmação da configuração ── */}
      {confirmSettings && saved && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Confirmar configuração</h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {changes.map(k => (
                  <tr key={k}><td className="py-2 text-gray-500">{SETTING_LABEL[k]}</td><td className="py-2 text-right text-gray-400 line-through">{showSetting(k, saved[k])}</td><td className="py-2 pl-3 text-right font-semibold text-gray-900">{showSetting(k, form[k])}</td></tr>
                ))}
              </tbody>
            </table>
            {changes.includes('enabled') && (
              <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 flex gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {form.enabled ? 'A escola passa a ver o menu Transmissões (admins/gestores e quem tiver a permissão).' : 'O menu some pra escola; campanhas em andamento param de enviar até o módulo voltar.'}</p>
            )}
            {changes.includes('meta_own_account') && (
              <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 flex gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Vale pras próximas campanhas precificadas; as já precificadas mantêm o preço da época.</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmSettings(false)} className="px-4 py-2 text-sm font-semibold text-gray-500">Voltar</button>
              <button onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">{savingSettings && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ajuste de crédito ── */}
      {adjust && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{adjust.type === 'credit' ? 'Lançar crédito' : 'Debitar crédito'}</h3>
              <button onClick={() => setAdjust(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            {adjustError && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">{adjustError}</p>}
            {adjustStep === 'form' ? <>
              <label className="block text-xs font-semibold text-gray-500">Valor (R$)
                <input className={inp} inputMode="decimal" value={adjust.amount} onChange={e => setAdjust(a => a && ({ ...a, amount: e.target.value }))} placeholder="0,00" />
              </label>
              <label className="block text-xs font-semibold text-gray-500">Motivo (obrigatório — a escola vê no extrato)
                <textarea className={`${inp} min-h-[70px]`} maxLength={500} value={adjust.reason} onChange={e => setAdjust(a => a && ({ ...a, reason: e.target.value }))} placeholder="Ex.: cortesia pela falha de entrega do dia 12/10" />
              </label>
              {adjustProblem && <p className="text-xs text-amber-700">{adjustProblem}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setAdjust(null)} className="px-4 py-2 text-sm font-semibold text-gray-500">Cancelar</button>
                <button disabled={!!adjustProblem} onClick={() => { setAdjustError(null); setAdjustStep('confirm') }} className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">Revisar</button>
              </div>
            </> : <>
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">Saldo atual</span><span className="font-semibold">{brl(balance)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">{adjust.type === 'credit' ? 'Crédito' : 'Débito'}</span><span className={`font-semibold ${signed >= 0 ? 'text-green-700' : 'text-red-600'}`}>{signed >= 0 ? '+' : '−'}{brl(Math.abs(signed))}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-1.5"><span className="text-gray-700 font-semibold">Saldo depois</span><span className="font-bold text-gray-900">{brl(balance + signed)}</span></div>
                <p className="text-xs text-gray-500 pt-1">Motivo: {adjust.reason.trim()}</p>
              </div>
              <p className="text-xs text-gray-400">O extrato não pode ser editado — pra desfazer, lance um ajuste contrário.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAdjustStep('form')} disabled={adjusting} className="px-4 py-2 text-sm font-semibold text-gray-500">Voltar</button>
                <button onClick={confirmAdjust} disabled={adjusting} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">{adjusting && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar ajuste</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {detailId && <CampaignDetail campaignId={detailId} readOnly onClose={() => setDetailId(null)} onChanged={loadAll} />}
    </div>
  )
}
