// Histórico da escola sem integração: digitar os números de cada ano ou ler uma planilha com a IA.
// Grava em campaign_manual_history (usado pela Campanha só quando a escola não tem aluno a aluno).
import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, Loader2, Check, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { aiFetch } from '../../lib/authHeaders'
import { fileToMatrix } from '../../lib/rosterImport'
import { BRAND } from '../../lib/brand'
import { monthName, monthsBetween } from '../../lib/campaignPlan'

type F = { base: string; retained: string; new_students: string; total_students: string; graduates: string; left_during_year: string }
type Mo = Record<string, { novos: string; rematriculas: string }>
interface Row { f: F; mo: Mo }
const EMPTY: F = { base: '', retained: '', new_students: '', total_students: '', graduates: '', left_during_year: '' }
const FIELDS: [keyof F, string][] = [['base', 'Alunos que poderiam voltar'], ['retained', 'Rematricularam'], ['new_students', 'Alunos novos'], ['total_students', 'Total de alunos no ano'], ['graduates', 'Concluintes'], ['left_during_year', 'Saíram no ano']]
const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13.5, fontWeight: 700, boxSizing: 'border-box', color: BRAND.ink, background: '#fff', fontFamily: 'inherit' }
const btn = (off: boolean, alt = false): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 11, border: alt ? '1px solid #E3E8F0' : 'none', cursor: off ? 'default' : 'pointer', fontWeight: 700, fontSize: 13.5, color: alt ? BRAND.ink : '#fff', background: alt ? '#fff' : 'linear-gradient(135deg,#065F52,#00A896)', opacity: off ? 0.55 : 1, fontFamily: 'inherit' })
const num = (s: string) => (s.trim() === '' ? 0 : Math.max(0, Math.round(Number(s) || 0)))
const str = (v: unknown) => (v == null ? '' : String(v))

export default function HistoricoManual({ institutionId, targetYear, onSaved }: { institutionId: string; targetYear: number; onSaved: () => void }) {
  const years = [targetYear - 1, targetYear - 2, targetYear - 3]
  const [rows, setRows] = useState<Record<number, Row>>({})
  const [openY, setOpenY] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [fromSheet, setFromSheet] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.rpc('campaign_manual_history_get', { p_inst: institutionId }).then(({ data }) => {
      const out: Record<number, Row> = {}
      for (const y of years) out[y] = { f: { ...EMPTY }, mo: {} }
      for (const r of (data ?? []) as { year: number; base: number; retained: number; new_students: number; total_students: number; graduates: number; left_during_year: number; monthly: { m: string; novos: number; rematriculas: number }[] }[]) {
        if (!out[r.year]) continue
        out[r.year].f = { base: str(r.base || ''), retained: str(r.retained || ''), new_students: str(r.new_students || ''), total_students: str(r.total_students || ''), graduates: str(r.graduates || ''), left_during_year: str(r.left_during_year || '') }
        for (const m of r.monthly ?? []) out[r.year].mo[m.m] = { novos: str(m.novos || ''), rematriculas: str(m.rematriculas || '') }
      }
      setRows(out)
    })
  }, [institutionId, targetYear]) // eslint-disable-line react-hooks/exhaustive-deps

  const setF = (y: number, k: keyof F, v: string) => setRows(p => ({ ...p, [y]: { ...p[y], f: { ...p[y].f, [k]: v } } }))
  const setM = (y: number, m: string, k: 'novos' | 'rematriculas', v: string) => setRows(p => ({ ...p, [y]: { ...p[y], mo: { ...p[y].mo, [m]: { ...(p[y].mo[m] ?? { novos: '', rematriculas: '' }), [k]: v } } } }))

  const readSheet = async (file: File) => {
    setReading(true); setMsg(null); setNotes([])
    try {
      const matrix = await fileToMatrix(file)
      const text = matrix.filter(r => r.some(c => c)).slice(0, 400).map(r => r.join(' | ')).join('\n')
      const resp = await aiFetch({ method: 'POST', body: JSON.stringify({ action: 'history_sheet_read', payload: { targetYear, text } }) })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || `Erro ${resp.status}`)
      const res = json.result as { tipo: string; anos: { ano: number; base: number | null; rematriculados: number | null; novos: number | null; total_alunos: number | null; concluintes: number | null; saidas: number | null; meses?: { mes: string; novos: number | null; rematriculas: number | null }[] }[]; observacoes?: string[] }
      setNotes(res.observacoes ?? [])
      if (res.tipo === 'lista_de_alunos') { setMsg({ ok: false, t: 'Esta planilha é uma lista de alunos. Envie em Configurações → Integrações → "Enviar relatório de alunos", que lê aluno a aluno.' }); return }
      let filled = 0
      setRows(prev => {
        const next = { ...prev }
        for (const a of res.anos ?? []) {
          if (!years.includes(a.ano)) continue
          const cur = next[a.ano] ?? { f: { ...EMPTY }, mo: {} }
          const mo = { ...cur.mo }
          for (const m of a.meses ?? []) mo[m.mes] = { novos: str(m.novos), rematriculas: str(m.rematriculas) }
          next[a.ano] = { f: { base: str(a.base), retained: str(a.rematriculados), new_students: str(a.novos), total_students: str(a.total_alunos), graduates: str(a.concluintes), left_during_year: str(a.saidas) }, mo }
          filled++
        }
        return next
      })
      setFromSheet(true)
      setMsg(filled ? { ok: true, t: `Li ${filled} ano(s). Confira os números abaixo e clique em Salvar histórico.` } : { ok: false, t: 'Não encontrei anos entre ' + years[2] + ' e ' + years[0] + ' na planilha.' })
    } catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : 'Não foi possível ler a planilha.' }) } finally { setReading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      const payload = years.filter(y => rows[y] && Object.values(rows[y].f).some(v => v.trim() !== '')).map(y => {
        const f = rows[y].f
        const monthly = Object.entries(rows[y].mo).map(([m, v]) => ({ m, novos: num(v.novos), rematriculas: num(v.rematriculas) })).filter(m => m.novos || m.rematriculas).sort((a, b) => a.m.localeCompare(b.m))
        const total = num(f.total_students) || num(f.retained) + num(f.new_students)
        return { year: y, base: num(f.base), retained: num(f.retained), new_students: num(f.new_students), total_students: total, graduates: num(f.graduates), left_during_year: num(f.left_during_year), monthly }
      })
      if (!payload.length) { setMsg({ ok: false, t: 'Preencha pelo menos um ano.' }); return }
      const { error } = await supabase.rpc('campaign_manual_history_save', { p_inst: institutionId, p_source: fromSheet ? 'planilha' : 'manual', p_rows: payload })
      if (error) throw error
      setMsg({ ok: true, t: 'Histórico salvo. A meta e o mês a mês foram refeitos com esses números.' }); onSaved()
    } catch (e) { setMsg({ ok: false, t: 'Não foi possível salvar: ' + (e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'erro') }) } finally { setBusy(false) }
  }

  return (
    <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 16, background: '#FAFCFC' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Histórico da escola (sem integração)</div>
      <div style={{ fontSize: 13, color: BRAND.muted, margin: '4px 0 12px', lineHeight: 1.6 }}>
        Sua escola não está ligada a um sistema de gestão. Informe os números dos últimos anos para a meta e o mês a mês saírem do histórico real: digite abaixo ou envie uma planilha-resumo e a IA lê para você conferir.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.ods,.txt" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && readSheet(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} disabled={reading} style={btn(reading, true)}>{reading ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}Ler planilha com IA</button>
      </div>
      {years.map(y => {
        const r = rows[y]; if (!r) return null
        const months = monthsBetween(`${y - 1}-08-01`, `${y}-04-01`)
        return (
          <div key={y} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${BRAND.line}` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Campanha {y} <span style={{ fontWeight: 500, color: BRAND.muted, fontSize: 12.5 }}>(alunos do ano letivo {y - 1} que voltaram em {y})</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {FIELDS.map(([k, l]) => <div key={k}><label style={{ fontSize: 11.5, fontWeight: 700, color: BRAND.muted, display: 'block', marginBottom: 3 }}>{l}</label><input type="number" min={0} style={inp} value={r.f[k]} onChange={e => setF(y, k, e.target.value)} /></div>)}
            </div>
            <button onClick={() => setOpenY(openY === y ? null : y)} style={{ border: 'none', background: 'none', color: BRAND.primaryDark, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: '8px 0 0' }}>{openY === y ? 'Ocultar matrículas por mês' : 'Matrículas por mês (opcional, deixa o mês a mês mais fiel)'}</button>
            {openY === y && (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead><tr><th style={{ textAlign: 'left', padding: '4px 8px', color: BRAND.muted }}>Mês</th>{months.map(m => <th key={m} style={{ padding: '4px 6px', color: BRAND.muted }}>{monthName(m + '-01')}</th>)}</tr></thead>
                  <tbody>
                    {(['novos', 'rematriculas'] as const).map(k => (
                      <tr key={k}><td style={{ padding: '4px 8px', fontWeight: 700 }}>{k === 'novos' ? 'Novos' : 'Rematrículas'}</td>
                        {months.map(m => <td key={m} style={{ padding: 2 }}><input type="number" min={0} style={{ ...inp, width: 64, padding: '5px 6px' }} value={r.mo[m]?.[k] ?? ''} onChange={e => setM(y, m, k, e.target.value)} /></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
      {notes.length > 0 && <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 10 }}>{notes.map((n, i) => <div key={i}>• {n}</div>)}</div>}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={save} disabled={busy} style={btn(busy)}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}Salvar histórico</button>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: msg.ok ? BRAND.success : BRAND.danger, display: 'inline-flex', gap: 6, alignItems: 'center' }}>{!msg.ok && <AlertTriangle size={14} />}{msg.t}</span>}
      </div>
    </div>
  )
}
