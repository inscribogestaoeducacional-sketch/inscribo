// Matriculômetro: rematrícula dos veteranos por segmento, série e turma. Barras empilhadas (matriculados, pré, faltam)
// e, ao clicar numa turma ou série, a lista dos alunos com o responsável e o telefone.
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Printer, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

interface Row { turma: string; serie: string | null; segment: string | null; base: number; matriculados: number; pre: number; ly_base?: number | null; ly_mesmo_dia?: number | null; ly_final?: number | null }
interface Resumo { ly_final: number; ly_mesmo_dia: number; hoje_matriculados: number; hoje_pre: number; dia_comparado: string }
type Agg = { base: number; matriculados: number; pre: number; ly_base?: number | null; ly_mesmo_dia?: number | null; ly_final?: number | null }
// ritmo do ano passado no mesmo dia: quantos já estariam matriculados hoje se fosse como em %ANO%
const expected = (r: Agg) => (r.ly_base ? Math.round(r.base * (r.ly_mesmo_dia ?? 0) / r.ly_base) : null)
const devOf = (r: Agg) => { const e = expected(r); return e == null ? null : r.matriculados - e }
function Dev({ r, year }: { r: Agg; year: number }) {
  const d = devOf(r)
  if (d == null) return <span style={{ width: 64 }} />
  return <span title={`Hoje: ${r.matriculados} matriculados. No mesmo dia de ${year - 1} a turma estaria com ${expected(r)} (ritmo de ${year - 1}). Diferença: ${d > 0 ? '+' : ''}${d}.`} style={{ width: 64, textAlign: 'center', fontSize: 11.5, fontWeight: 800, padding: '1px 6px', borderRadius: 99, background: d < 0 ? '#FEE2E2' : '#DCFCE7', color: d < 0 ? '#B91C1C' : '#15803D' }}>{d > 0 ? '+' : ''}{d} vs {year - 1}</span>
}
interface Stu { student: string; turma: string; serie: string | null; status: 'matriculado' | 'pre' | 'falta' | 'saiu'; responsavel: string | null; telefone: string | null }
const SEG: [string, string][] = [['infantil', 'Educação Infantil'], ['fund1', 'Fundamental I'], ['fund2', 'Fundamental II'], ['medio', 'Ensino Médio']]
const COL = { matriculado: '#059669', pre: '#8B5CF6', falta: '#CBD5E1' }
const ST: Record<string, string> = { matriculado: 'Matriculados', pre: 'Pré-matriculados', falta: 'Faltam', saiu: 'Saíram' }
const card: React.CSSProperties = { border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', background: '#fff' }

function Stack({ r, withPre }: { r: Agg; withPre: boolean }) {
  const b = r.base || 1, m = r.matriculados / b * 100, p = withPre ? r.pre / b * 100 : 0
  const e = expected(r)
  const falta = r.base - r.matriculados - r.pre
  const tip = `${r.matriculados} matriculados · ${r.pre} pré-matriculados · ${falta} faltam de ${r.base} veteranos${e != null ? ` · ritmo do ano passado no mesmo dia: ${e}` : ''}`
  return (
    <div title={tip} style={{ flex: 1, display: 'flex', height: 14, background: COL.falta, borderRadius: 7, overflow: 'hidden', position: 'relative' }}>
      <div style={{ width: `${m}%`, background: COL.matriculado, transition: 'width .9s cubic-bezier(.2,.8,.2,1)' }} /><div style={{ width: `${p}%`, background: COL.pre, transition: 'width .9s cubic-bezier(.2,.8,.2,1)' }} />
      {e != null && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(99, e / b * 100)}%`, width: 2, background: '#1A2B4A' }} />}
    </div>
  )
}

export default function Matriculometro({ institutionId, year }: { institutionId: string; year: number }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [withPre, setWithPre] = useState(false)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [err, setErr] = useState('')
  const [sel, setSel] = useState<{ turma: string | null; serie: string | null; title: string } | null>(null)

  useEffect(() => {
    let alive = true
    setRows(null); setErr('')
    supabase.rpc('campaign_matriculometro', { p_inst: institutionId, p_year: year }).then(({ data, error }) => {
      if (!alive) return
      if (error) setErr(error.message); else { const d = data as { turmas: Row[]; resumo?: Resumo } | null; setRows(d?.turmas ?? []); setResumo(d?.resumo ?? null) }
    })
    return () => { alive = false }
  }, [institutionId, year])

  const series = useMemo(() => {
    const m = new Map<string, { serie: string; segment: string | null; base: number; matriculados: number; pre: number; ly_base: number; ly_mesmo_dia: number; ly_final: number }>()
    for (const r of rows ?? []) {
      const k = r.serie ?? '—'
      const x = m.get(k) ?? { serie: k, segment: r.segment, base: 0, matriculados: 0, pre: 0, ly_base: 0, ly_mesmo_dia: 0, ly_final: 0 }
      x.base += r.base; x.matriculados += r.matriculados; x.pre += r.pre; x.ly_base += r.ly_base ?? 0; x.ly_mesmo_dia += r.ly_mesmo_dia ?? 0; x.ly_final += r.ly_final ?? 0; m.set(k, x)
    }
    return [...m.values()]
  }, [rows])

  if (err) return <div style={{ color: '#B91C1C', fontSize: 13 }}>{err}</div>
  if (!rows) return <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>

  const val = (r: { matriculados: number; pre: number }) => r.matriculados + (withPre ? r.pre : 0)
  const pct = (r: { base: number; matriculados: number; pre: number }) => (r.base ? val(r) / r.base : 0)
  const sum = (list: Row[]): Agg => list.reduce((a, r) => ({ base: a.base + r.base, matriculados: a.matriculados + r.matriculados, pre: a.pre + r.pre, ly_base: (a.ly_base ?? 0) + (r.ly_base ?? 0), ly_mesmo_dia: (a.ly_mesmo_dia ?? 0) + (r.ly_mesmo_dia ?? 0), ly_final: (a.ly_final ?? 0) + (r.ly_final ?? 0) }), { base: 0, matriculados: 0, pre: 0, ly_base: 0, ly_mesmo_dia: 0, ly_final: 0 })
  const tot = sum(rows)
  const today = new Date().toLocaleDateString('pt-BR')
  const link: React.CSSProperties = { all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%', margin: '5px 0', fontSize: 12.5 }

  return (
    <div id="matriculometro">
      <style>{`@media print { body * { visibility: hidden } #matriculometro, #matriculometro * { visibility: visible } #matriculometro { position: absolute; left: 0; top: 0; width: 100% } .no-print { display: none !important } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: BRAND.text, cursor: 'pointer' }}>
          <input type="checkbox" checked={withPre} onChange={e => setWithPre(e.target.checked)} /> Somar os pré-matriculados nas barras por série e turma (o total do topo conta só matriculados)
        </label>
        <button onClick={() => window.print()} style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center', padding: '8px 14px', borderRadius: 9, border: 'none', background: '#05907B', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Printer size={15} /> Imprimir (A4)
        </button>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: BRAND.ink }}>Matriculômetro {year}</div>
      <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 12 }}>Rematrícula dos veteranos por turma de {year - 1} · atualizado em {today} · clique numa turma ou série para ver os alunos</div>

      {resumo && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Alunos: {year - 1} × {year}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {([
              [`Fechou ${year - 1} com`, resumo.ly_final, 'alunos matriculados', '#1A2B4A'],
              [`No mesmo dia de ${year - 1}`, resumo.ly_mesmo_dia, `já matriculados (${new Date(resumo.dia_comparado + 'T12:00:00').toLocaleDateString('pt-BR')})`, '#64748B'],
              [`Hoje, ${year}`, resumo.hoje_matriculados, 'matriculados', '#059669'],
              [`Hoje, ${year}`, resumo.hoje_pre, 'em pré-matrícula (não contam)', '#8B5CF6'],
            ] as [string, number, string, string][]).map(([t, n, sub, c]) => (
              <div key={t + sub} style={{ borderRadius: 12, background: '#F8FAFC', padding: '10px 12px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: BRAND.muted }}>{t}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1.15 }}>{n}</div>
                <div style={{ fontSize: 11.5, color: BRAND.muted }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 8 }}>A comparação usa a data em que cada matrícula foi feita: {resumo.ly_mesmo_dia} alunos já estavam matriculados em {year - 1} neste mesmo dia; hoje há {resumo.hoje_matriculados} em {year} ({resumo.hoje_matriculados - resumo.ly_mesmo_dia >= 0 ? '+' : ''}{resumo.hoje_matriculados - resumo.ly_mesmo_dia}).</div>
        </div>
      )}

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><div style={{ fontSize: 30, fontWeight: 800, color: BRAND.ink, lineHeight: 1 }}>{tot.matriculados} <span style={{ fontSize: 15, color: '#94A3B8', fontWeight: 600 }}>de {tot.base}</span></div>
            <div style={{ fontSize: 12.5, color: BRAND.muted }}>{tot.base ? Math.round(tot.matriculados / tot.base * 100) : 0}% dos veteranos já matriculados · mais {tot.pre} em pré-matrícula (ainda não contam)</div></div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12.5, flexWrap: 'wrap' }}>
            {(['matriculado', 'pre', 'falta'] as const).map(k => (
              <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><i style={{ width: 10, height: 10, borderRadius: 3, background: COL[k], display: 'inline-block' }} />
                {ST[k]}: <b>{k === 'matriculado' ? tot.matriculados : k === 'pre' ? tot.pre : tot.base - tot.matriculados - tot.pre}</b></span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12 }}><Stack r={tot} withPre={true} /></div>
        {expected(tot) != null && <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 8 }}>A linha escura marca onde a escola estaria no mesmo dia de {year - 1}: <b>{expected(tot)}</b> matriculados. Hoje: <b>{tot.matriculados}</b> (<b style={{ color: (devOf(tot) ?? 0) < 0 ? '#B91C1C' : '#15803D' }}>{(devOf(tot) ?? 0) > 0 ? '+' : ''}{devOf(tot)}</b>). No fim de {year - 1} voltaram {tot.ly_final} de {tot.ly_base} ({tot.ly_base ? Math.round((tot.ly_final ?? 0) / tot.ly_base * 100) : 0}%).</div>}
      </div>

      {(() => {
        const worse = rows.filter(r => devOf(r) != null && (devOf(r) as number) < 0).sort((a, c) => (devOf(a) as number) - (devOf(c) as number)).slice(0, 8)
        if (!worse.length) return null
        return (
          <div style={{ ...card, marginBottom: 14, borderColor: '#FECACA', background: '#FFFBFB' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#B91C1C', marginBottom: 2 }}>Turmas correndo perigo</div>
            <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 8 }}>Comparando com o mesmo dia de {year - 1}: turmas com menos alunos garantidos do que naquela época. Clique para ver quem falta.</div>
            {worse.map(r => (
              <button key={r.turma + r.serie} style={link} onClick={() => setSel({ turma: r.turma, serie: r.serie, title: r.turma })}>
                <span style={{ width: 110, color: BRAND.text, flexShrink: 0, fontWeight: 700 }}>{r.turma}</span><Stack r={r} withPre={withPre} />
                <span style={{ width: 96, textAlign: 'right' }}>{r.matriculados} (era {expected(r)})</span><Dev r={r} year={year} />
              </button>
            ))}
          </div>
        )
      })()}

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Por série</div>
        {series.map(s => (
          <button key={s.serie} className="no-print-btn" style={link} onClick={() => setSel({ turma: null, serie: s.serie, title: s.serie })}>
            <span style={{ width: 120, color: BRAND.text, flexShrink: 0 }}>{s.serie}</span><Stack r={s} withPre={withPre} />
            <span style={{ width: 96, textAlign: 'right', fontWeight: 700 }}>{val(s)}/{s.base} · {Math.round(pct(s) * 100)}%</span><Dev r={s} year={year} />
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
                <div style={{ fontSize: 12.5, color: BRAND.muted }}>{v}/{b} · {b ? Math.round(v / b * 100) : 0}%</div><Dev r={sum(list)} year={year} />
              </div>
              {[...list].sort((a, c) => pct(c) - pct(a)).map(r => (
                <button key={r.turma + r.serie} style={link} onClick={() => setSel({ turma: r.turma, serie: r.serie, title: `${r.turma}` })}>
                  <span style={{ width: 96, color: BRAND.text, flexShrink: 0 }}>{r.turma}</span><Stack r={r} withPre={withPre} />
                  <span style={{ width: 84, textAlign: 'right', fontWeight: 700 }}>{val(r)}/{r.base} · {Math.round(pct(r) * 100)}%</span><Dev r={r} year={year} />
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
              background: f === k ? '#05907B' : '#EEF3F2', color: f === k ? '#fff' : '#475569' }}>
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
