// Matriculômetro: rematrícula dos veteranos por segmento, série e turma. Barras empilhadas (matriculados, pré, faltam)
// e, ao clicar numa turma ou série, a lista dos alunos com o responsável e o telefone.
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Printer, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

interface Row { turma: string; serie: string | null; segment: string | null; base: number; matriculados: number; pre: number }
interface Stu { student: string; turma: string; serie: string | null; status: 'matriculado' | 'pre' | 'falta' | 'saiu'; responsavel: string | null; telefone: string | null }
const SEG: [string, string][] = [['infantil', 'Educação Infantil'], ['fund1', 'Fundamental I'], ['fund2', 'Fundamental II'], ['medio', 'Ensino Médio']]
const COL = { matriculado: '#059669', pre: '#8B5CF6', falta: '#CBD5E1' }
const ST: Record<string, string> = { matriculado: 'Matriculados', pre: 'Pré-matriculados', falta: 'Faltam', saiu: 'Saíram' }
const card: React.CSSProperties = { border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff' }

function Stack({ r, withPre }: { r: { base: number; matriculados: number; pre: number }; withPre: boolean }) {
  const b = r.base || 1, m = r.matriculados / b * 100, p = withPre ? r.pre / b * 100 : 0
  return (
    <div style={{ flex: 1, display: 'flex', height: 14, background: COL.falta, borderRadius: 7, overflow: 'hidden' }}>
      <div style={{ width: `${m}%`, background: COL.matriculado }} /><div style={{ width: `${p}%`, background: COL.pre }} />
    </div>
  )
}

export default function Matriculometro({ institutionId, year }: { institutionId: string; year: number }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [withPre, setWithPre] = useState(true)
  const [err, setErr] = useState('')
  const [sel, setSel] = useState<{ turma: string | null; serie: string | null; title: string } | null>(null)

  useEffect(() => {
    let alive = true
    setRows(null); setErr('')
    supabase.rpc('campaign_matriculometro', { p_inst: institutionId, p_year: year }).then(({ data, error }) => {
      if (!alive) return
      if (error) setErr(error.message); else setRows(((data as { turmas: Row[] } | null)?.turmas ?? []))
    })
    return () => { alive = false }
  }, [institutionId, year])

  const series = useMemo(() => {
    const m = new Map<string, { serie: string; segment: string | null; base: number; matriculados: number; pre: number }>()
    for (const r of rows ?? []) {
      const k = r.serie ?? '—'
      const x = m.get(k) ?? { serie: k, segment: r.segment, base: 0, matriculados: 0, pre: 0 }
      x.base += r.base; x.matriculados += r.matriculados; x.pre += r.pre; m.set(k, x)
    }
    return [...m.values()]
  }, [rows])

  if (err) return <div style={{ color: '#B91C1C', fontSize: 13 }}>{err}</div>
  if (!rows) return <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>

  const val = (r: { matriculados: number; pre: number }) => r.matriculados + (withPre ? r.pre : 0)
  const pct = (r: { base: number; matriculados: number; pre: number }) => (r.base ? val(r) / r.base : 0)
  const tot = rows.reduce((a, r) => ({ base: a.base + r.base, matriculados: a.matriculados + r.matriculados, pre: a.pre + r.pre }), { base: 0, matriculados: 0, pre: 0 })
  const today = new Date().toLocaleDateString('pt-BR')
  const link: React.CSSProperties = { all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%', margin: '5px 0', fontSize: 12.5 }

  return (
    <div id="matriculometro">
      <style>{`@media print { body * { visibility: hidden } #matriculometro, #matriculometro * { visibility: visible } #matriculometro { position: absolute; left: 0; top: 0; width: 100% } .no-print { display: none !important } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: BRAND.text, cursor: 'pointer' }}>
          <input type="checkbox" checked={withPre} onChange={e => setWithPre(e.target.checked)} /> Contar pré-matriculados no percentual
        </label>
        <button onClick={() => window.print()} style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center', padding: '8px 14px', borderRadius: 9, border: 'none', background: '#00A896', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Printer size={15} /> Imprimir (A4)
        </button>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: BRAND.ink }}>Matriculômetro {year}</div>
      <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 12 }}>Rematrícula dos veteranos por turma de {year - 1} · atualizado em {today} · clique numa turma ou série para ver os alunos</div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><div style={{ fontSize: 30, fontWeight: 800, color: BRAND.ink, lineHeight: 1 }}>{val(tot)} <span style={{ fontSize: 15, color: '#94A3B8', fontWeight: 600 }}>de {tot.base}</span></div>
            <div style={{ fontSize: 12.5, color: BRAND.muted }}>{tot.base ? Math.round(val(tot) / tot.base * 100) : 0}% dos veteranos garantidos</div></div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12.5, flexWrap: 'wrap' }}>
            {(['matriculado', 'pre', 'falta'] as const).map(k => (
              <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><i style={{ width: 10, height: 10, borderRadius: 3, background: COL[k], display: 'inline-block' }} />
                {ST[k]}: <b>{k === 'matriculado' ? tot.matriculados : k === 'pre' ? tot.pre : tot.base - tot.matriculados - tot.pre}</b></span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12 }}><Stack r={tot} withPre={true} /></div>
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Por série</div>
        {series.map(s => (
          <button key={s.serie} className="no-print-btn" style={link} onClick={() => setSel({ turma: null, serie: s.serie, title: s.serie })}>
            <span style={{ width: 120, color: BRAND.text, flexShrink: 0 }}>{s.serie}</span><Stack r={s} withPre={withPre} />
            <span style={{ width: 96, textAlign: 'right', fontWeight: 700 }}>{val(s)}/{s.base} · {Math.round(pct(s) * 100)}%</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14 }}>
        {SEG.map(([key, title]) => {
          const list = rows.filter(r => r.segment === key)
          if (!list.length) return null
          const b = list.reduce((a, r) => a + r.base, 0), v = list.reduce((a, r) => a + val(r), 0)
          return (
            <div key={key} style={{ ...card, breakInside: 'avoid' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, flex: 1 }}>{title}</div>
                <div style={{ fontSize: 12.5, color: BRAND.muted }}>{v}/{b} · {b ? Math.round(v / b * 100) : 0}%</div>
              </div>
              {[...list].sort((a, c) => pct(c) - pct(a)).map(r => (
                <button key={r.turma + r.serie} style={link} onClick={() => setSel({ turma: r.turma, serie: r.serie, title: `${r.turma}` })}>
                  <span style={{ width: 96, color: BRAND.text, flexShrink: 0 }}>{r.turma}</span><Stack r={r} withPre={withPre} />
                  <span style={{ width: 84, textAlign: 'right', fontWeight: 700 }}>{val(r)}/{r.base} · {Math.round(pct(r) * 100)}%</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      {sel && <Alunos institutionId={institutionId} year={year} sel={sel} onClose={() => setSel(null)} />}
    </div>
  )
}

function Alunos({ institutionId, year, sel, onClose }: { institutionId: string; year: number; sel: { turma: string | null; serie: string | null; title: string }; onClose: () => void }) {
  const [list, setList] = useState<Stu[] | null>(null)
  const [f, setF] = useState<'falta' | 'pre' | 'matriculado' | 'saiu' | 'todos'>('falta')
  useEffect(() => {
    supabase.rpc('campaign_class_students', { p_inst: institutionId, p_year: year, p_turma: sel.turma, p_serie: sel.serie }).then(({ data }) => setList((data ?? []) as Stu[]))
  }, [institutionId, year, sel.turma, sel.serie])
  const count = (k: string) => (list ?? []).filter(x => x.status === k).length
  const shown = (list ?? []).filter(x => f === 'todos' || x.status === f)
  const fone = (t: string | null) => (t ? t.replace(/^55/, '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : '—')
  return (
    <div className="no-print" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,43,74,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: '20px 22px', width: 640, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: BRAND.ink, flex: 1 }}>{sel.title} <span style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 600 }}>· rematrícula {year}</span></div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {(['falta', 'pre', 'matriculado', 'saiu', 'todos'] as const).map(k => (
            <button key={k} onClick={() => setF(k)} style={{ padding: '5px 12px', borderRadius: 99, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: f === k ? '#00A896' : '#EEF3F2', color: f === k ? '#fff' : '#475569' }}>
              {k === 'todos' ? `Todos (${list?.length ?? 0})` : `${ST[k]} (${count(k)})`}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto' }}>
          {!list ? <Loader2 size={16} className="animate-spin" /> : shown.length === 0 ? <div style={{ fontSize: 13, color: BRAND.muted }}>Nenhum aluno nesta situação.</div> : shown.map((x, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderTop: '1px solid #EEF2F1', fontSize: 13 }}>
              <i style={{ width: 9, height: 9, borderRadius: 3, background: COL[x.status as keyof typeof COL] ?? '#F59E0B', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}><b>{x.student}</b><div style={{ fontSize: 12, color: BRAND.muted }}>{sel.turma ? '' : `${x.turma} · `}{x.responsavel ?? 'Sem responsável'} · {fone(x.telefone)}</div></div>
              <span style={{ fontSize: 11.5, color: BRAND.muted }}>{ST[x.status]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
