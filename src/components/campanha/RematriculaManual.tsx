// Lançamento manual das rematrículas na Campanha (escola sem integração).
// A escola escolhe, aqui mesmo, como quer lançar: total ou por série, e o que digita:
// o número do mês ou o acumulado até o mês. Quem tem integração não vê este cartão.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Check, Loader2, Settings2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { useGradeLevels } from '../../hooks/useGradeLevels'
import { monthName, type PlanMonth } from '../../lib/campaignPlan'

export type ManualReenroll = { byMonth: Record<string, number>; total: number; ready: boolean }
type Scope = 'total' | 'serie'
type Basis = 'mes' | 'acumulado'
type Entry = { period: string; grade_key: string; value: number }

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: '18px 20px' }
const inp: React.CSSProperties = { width: 84, height: 38, borderRadius: 10, border: `1px solid ${BRAND.line}`, padding: '0 10px', fontSize: 14, fontFamily: 'inherit', textAlign: 'right', background: '#fff' }
const pill = (on: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${on ? BRAND.primary : BRAND.line}`, background: on ? BRAND.soft : '#fff', color: on ? BRAND.primaryDark : BRAND.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' })

/** Calcula, a partir do que foi digitado, quanto entrou em cada mês e o total do ano. */
export function computeManual(entries: Entry[], basis: Basis, months: string[]): ManualReenroll {
  const keys = [...new Set(entries.map(e => e.grade_key))]
  const byMonth: Record<string, number> = {}
  let total = 0
  for (const k of keys) {
    const val = (m: string) => entries.find(e => e.period === m && e.grade_key === k)?.value
    let prev = 0
    for (const m of months) {
      const v = val(m)
      if (v == null) continue
      const add = basis === 'acumulado' ? Math.max(0, v - prev) : v
      byMonth[m] = (byMonth[m] || 0) + add
      if (basis === 'acumulado') prev = v
      total += add
    }
  }
  return { byMonth, total, ready: entries.length > 0 }
}

export function useManualReenroll(institutionId: string | undefined, year: number, months: string[], enabled: boolean, reloadKey = 0) {
  const [state, setState] = useState<{ scope: Scope; basis: Basis; entries: Entry[]; ok: boolean | null }>({ scope: 'total', basis: 'mes', entries: [], ok: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!institutionId || !enabled) return
    ;(async () => {
      const [s, e] = await Promise.all([
        supabase.from('campaign_reenroll_settings').select('scope, basis').eq('institution_id', institutionId).eq('year', year).maybeSingle(),
        supabase.from('campaign_reenroll_entries').select('period, grade_key, value').eq('institution_id', institutionId).eq('year', year),
      ])
      if (s.error || e.error) { setState(p => ({ ...p, ok: false })); return }
      setState({ scope: (s.data?.scope as Scope) || 'total', basis: (s.data?.basis as Basis) || 'mes', entries: (e.data || []) as Entry[], ok: true })
    })()
  }, [institutionId, year, enabled, tick, reloadKey])
  const computed = useMemo(() => computeManual(state.entries, state.basis, months), [state.entries, state.basis, months])
  return { ...state, computed, reload: () => setTick(t => t + 1) }
}

export default function RematriculaManual({ institutionId, year, months, scope, basis, entries, ok, computed, onSaved }: {
  institutionId: string; year: number; months: PlanMonth[]; scope: Scope; basis: Basis; entries: Entry[]; ok: boolean | null; computed: ManualReenroll; onSaved: () => void
}) {
  const { gradeLevels } = useGradeLevels(institutionId)
  const [editing, setEditing] = useState(false)
  const [cfg, setCfg] = useState(false)
  const [sc, setSc] = useState<Scope>(scope)
  const [ba, setBa] = useState<Basis>(basis)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [month, setMonth] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const ms = useMemo(() => months.map(m => m.m), [months])
  useEffect(() => { setSc(scope); setBa(basis) }, [scope, basis])
  useEffect(() => {
    const now = new Date().toISOString().slice(0, 7)
    setMonth(ms.includes(now) ? now : ms[0] || '')
  }, [ms.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const k = (m: string, g: string) => `${m}|${g}`
  const load = useCallback(() => {
    const o: Record<string, string> = {}
    for (const e of entries) o[k(e.period, e.grade_key)] = String(e.value)
    setVals(o)
  }, [entries])
  useEffect(() => { load() }, [load])

  if (ok === false) return null
  if (ok === null) return null
  const grades = gradeLevels.map(g => ({ key: g.id as string, name: g.name as string }))
  const rows = sc === 'total' ? [{ key: 'total', name: 'Rematrículas' }] : grades
  const cols = sc === 'total' ? ms : [month].filter(Boolean)

  const save = async (nextScope = sc, nextBasis = ba) => {
    if (!institutionId) return
    setSaving(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const up = await supabase.from('campaign_reenroll_settings').upsert({ institution_id: institutionId, year, scope: nextScope, basis: nextBasis, updated_at: new Date().toISOString(), updated_by: user?.id || null }, { onConflict: 'institution_id,year' })
    if (up.error) { setSaving(false); setMsg('Não foi possível salvar: ' + up.error.message); return }
    const list = Object.entries(vals).filter(([, v]) => v !== '' && !Number.isNaN(Number(v))).map(([key, v]) => {
      const [period, grade_key] = key.split('|')
      return { institution_id: institutionId, year, period, grade_key, value: Math.max(0, Math.round(Number(v))), updated_at: new Date().toISOString(), updated_by: user?.id || null }
    }).filter(r => nextScope === 'total' ? r.grade_key === 'total' : r.grade_key !== 'total')
    if (list.length) {
      const r = await supabase.from('campaign_reenroll_entries').upsert(list, { onConflict: 'institution_id,year,period,grade_key' })
      if (r.error) { setSaving(false); setMsg('Não foi possível salvar: ' + r.error.message); return }
    }
    setSaving(false); setEditing(false); setCfg(false); setMsg('Salvo.'); onSaved()
  }

  const monthTotalInput = (m: string) => {
    if (sc === 'total') return Number(vals[k(m, 'total')] || 0)
    return grades.reduce((s, g) => s + Number(vals[k(m, g.key)] || 0), 0)
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Lançar rematrículas</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2, lineHeight: 1.45 }}>
            Sem integração, digite aqui as rematrículas. {ba === 'mes' ? 'Digite quantas aconteceram em cada mês.' : 'Digite o total acumulado até cada mês.'} {sc === 'serie' ? 'Escolha o mês e preencha cada série.' : ''}
          </div>
        </div>
        <button type="button" onClick={() => setCfg(v => !v)} style={{ ...pill(cfg), display: 'inline-flex', alignItems: 'center', gap: 6 }}><Settings2 size={14} /> Como lançar</button>
        {!editing ? <button type="button" onClick={() => setEditing(true)} style={{ ...pill(true), display: 'inline-flex', alignItems: 'center', gap: 6 }}><Pencil size={14} /> Lançar</button>
          : <button type="button" disabled={saving} onClick={() => save()} style={{ ...pill(true), display: 'inline-flex', alignItems: 'center', gap: 6, background: BRAND.primary, color: '#fff', border: 'none' }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar</button>}
      </div>

      {cfg && (
        <div style={{ margin: '10px 0', padding: 12, borderRadius: 14, background: '#F8FAFC', border: `1px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.muted, marginBottom: 6 }}>Como você quer lançar?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={pill(sc === 'total')} onClick={() => setSc('total')}>Só o total do mês</button>
              <button type="button" style={pill(sc === 'serie')} onClick={() => setSc('serie')}>Por série</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.muted, marginBottom: 6 }}>O que você digita?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={pill(ba === 'mes')} onClick={() => setBa('mes')}>O que aconteceu no mês</button>
              <button type="button" style={pill(ba === 'acumulado')} onClick={() => setBa('acumulado')}>O total acumulado até o mês</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: BRAND.muted }}>Os números já digitados são mantidos. Troque o jeito de lançar só se for recomeçar a contagem.</div>
          <div><button type="button" disabled={saving} onClick={() => save(sc, ba)} style={{ ...pill(true), background: BRAND.primary, color: '#fff', border: 'none' }}>Salvar jeito de lançar</button></div>
        </div>
      )}

      {sc === 'serie' && (
        <div className="aion-hscroll" style={{ display: 'flex', gap: 6, margin: '10px 0', overflowX: 'auto' }}>
          {ms.map(m => <button key={m} type="button" style={{ ...pill(m === month), flexShrink: 0 }} onClick={() => setMonth(m)}>{monthName(m + '-01')}</button>)}
        </div>
      )}

      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        {sc === 'total' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', textAlign: 'left', padding: 8 }}>Mês</th>
              <th style={{ fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', textAlign: 'right', padding: 8 }}>{ba === 'mes' ? 'Feitas no mês' : 'Acumulado'}</th>
              {ba === 'acumulado' && <th style={{ fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', textAlign: 'right', padding: 8 }}>Entrou no mês</th>}
            </tr></thead>
            <tbody>{ms.map(m => (
              <tr key={m}>
                <td style={{ padding: 8, borderTop: '1px solid #EEF2F1', fontWeight: 700, fontSize: 13 }}>{monthName(m + '-01')}</td>
                <td style={{ padding: 8, borderTop: '1px solid #EEF2F1', textAlign: 'right' }}>
                  {editing ? <input inputMode="numeric" aria-label={`Rematrículas de ${monthName(m + '-01')}`} style={inp} value={vals[k(m, 'total')] ?? ''} onChange={e => setVals(v => ({ ...v, [k(m, 'total')]: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                    : <b style={{ fontSize: 14 }}>{vals[k(m, 'total')] ?? '–'}</b>}
                </td>
                {ba === 'acumulado' && <td style={{ padding: 8, borderTop: '1px solid #EEF2F1', textAlign: 'right', color: BRAND.muted, fontSize: 13 }}>{computed.byMonth[m] ?? '–'}</td>}
              </tr>))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', textAlign: 'left', padding: 8 }}>Série</th>
              <th style={{ fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', textAlign: 'right', padding: 8 }}>{month ? monthName(month + '-01') : 'Mês'}</th>
            </tr></thead>
            <tbody>
              {rows.map(g => (
                <tr key={g.key}>
                  <td style={{ padding: 8, borderTop: '1px solid #EEF2F1', fontSize: 13 }}>{g.name}</td>
                  <td style={{ padding: 8, borderTop: '1px solid #EEF2F1', textAlign: 'right' }}>
                    {editing ? <input inputMode="numeric" aria-label={`${g.name}, ${month}`} style={inp} value={vals[k(month, g.key)] ?? ''} onChange={e => setVals(v => ({ ...v, [k(month, g.key)]: e.target.value.replace(/\D/g, '').slice(0, 5) }))} />
                      : <b style={{ fontSize: 14 }}>{vals[k(month, g.key)] ?? '–'}</b>}
                  </td>
                </tr>))}
              {cols.length > 0 && <tr><td style={{ padding: 8, borderTop: '2px solid #E3E8F0', fontWeight: 800, fontSize: 13 }}>Total do mês</td><td style={{ padding: 8, borderTop: '2px solid #E3E8F0', textAlign: 'right', fontWeight: 800 }}>{monthTotalInput(month)}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: BRAND.ink }}>Total de rematrículas no ano: <b>{computed.total}</b></div>
      {msg && <div style={{ marginTop: 6, fontSize: 12.5, color: msg === 'Salvo.' ? BRAND.primaryDark : '#B91C1C' }}>{msg}</div>}
    </div>
  )
}
