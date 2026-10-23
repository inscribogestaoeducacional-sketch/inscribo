// Matriculômetro: rematrículas turma a turma (veteranos), por segmento, com a linha dos 90% (bonificação).
// Cada turma é a do ano anterior: base = alunos da turma que podem rematricular; barra = matriculados no ano da campanha.
import { useEffect, useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

interface Row { turma: string; serie: string | null; segment: string | null; base: number; matriculados: number; pre: number }
const SEG: [string, string][] = [['infantil', 'Educação Infantil'], ['fund1', 'Fundamental I'], ['fund2', 'Fundamental II'], ['medio', 'Ensino Médio']]
const GOAL = 0.9

export default function Matriculometro({ institutionId, year }: { institutionId: string; year: number }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [withPre, setWithPre] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    setRows(null); setErr('')
    supabase.rpc('campaign_matriculometro', { p_inst: institutionId, p_year: year }).then(({ data, error }) => {
      if (!alive) return
      if (error) setErr(error.message); else setRows(((data as { turmas: Row[] } | null)?.turmas ?? []))
    })
    return () => { alive = false }
  }, [institutionId, year])

  if (err) return <div style={{ color: '#B91C1C', fontSize: 13 }}>{err}</div>
  if (!rows) return <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>

  const val = (r: Row) => r.matriculados + (withPre ? r.pre : 0)
  const pct = (r: Row) => (r.base ? val(r) / r.base : 0)
  const today = new Date().toLocaleDateString('pt-BR')

  return (
    <div id="matriculometro">
      <style>{`@media print { body * { visibility: hidden } #matriculometro, #matriculometro * { visibility: visible } #matriculometro { position: absolute; left: 0; top: 0; width: 100% } .no-print { display: none !important } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: BRAND.text, cursor: 'pointer' }}>
          <input type="checkbox" checked={withPre} onChange={e => setWithPre(e.target.checked)} /> Contar pré-matriculados
        </label>
        <button onClick={() => window.print()} style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center', padding: '8px 14px', borderRadius: 9, border: 'none', background: '#00A896', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Printer size={15} /> Imprimir (A4)
        </button>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: BRAND.ink }}>Matriculômetro {year}</div>
      <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 14 }}>
        Rematrículas por turma de {year - 1} (só veteranos) · atualizado em {today} · a turma que chega a {GOAL * 100}% rende bonificação
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
        {SEG.map(([key, title]) => {
          const list = rows.filter(r => r.segment === key)
          if (!list.length) return null
          const b = list.reduce((a, r) => a + r.base, 0), v = list.reduce((a, r) => a + val(r), 0)
          return (
            <div key={key} style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff', breakInside: 'avoid' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, flex: 1 }}>{title}</div>
                <div style={{ fontSize: 12.5, color: BRAND.muted }}>{v}/{b} · {b ? Math.round(v / b * 100) : 0}%</div>
              </div>
              {[...list].sort((a, c) => pct(c) - pct(a)).map(r => {
                const p = pct(r), hit = p >= GOAL
                return (
                  <div key={r.turma + r.serie} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0', fontSize: 12.5 }}>
                    <div style={{ width: 96, color: BRAND.text, flexShrink: 0 }}>{r.turma}</div>
                    <div style={{ flex: 1, position: 'relative', height: 14, background: '#EEF3F2', borderRadius: 7 }}>
                      <div style={{ width: `${Math.min(100, p * 100)}%`, height: '100%', borderRadius: 7, background: hit ? '#059669' : '#00A896' }} />
                      <div style={{ position: 'absolute', left: `${GOAL * 100}%`, top: -2, bottom: -2, width: 2, background: '#F59E0B' }} />
                    </div>
                    <div style={{ width: 74, textAlign: 'right', color: hit ? '#059669' : BRAND.text, fontWeight: hit ? 800 : 500 }}>{val(r)}/{r.base} · {Math.round(p * 100)}%</div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
