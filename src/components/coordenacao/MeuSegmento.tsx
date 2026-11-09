// Painel da coordenação por segmento: números, quem falta rematricular, alunos novos e ranking de turmas.
// Somente leitura. Sem telefone nem contato. O filtro por segmento vem do servidor (coordinator_dashboard).
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Users, UserCheck, UserMinus, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

type Turma = { turma: string; serie: string | null; segment: string | null; base: number; matriculados: number; pre: number }
type Pessoa = { nome: string; turma: string | null; serie: string | null; segment: string | null; pre?: boolean; status?: string; data?: string | null }
type Dash = { year: number; segments: string[]; turmas: Turma[]; faltam: Pessoa[]; novos: Pessoa[] }

const SEG: Record<string, string> = { infantil: 'Infantil', fund1: 'Fundamental I', fund2: 'Fundamental II', medio: 'Médio' }
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const tone = (p: number) => (p >= 80 ? BRAND.success : p >= 50 ? '#B45309' : '#B91C1C')

export default function MeuSegmento({ institutionId, year }: { institutionId: string; year: number }) {
  const [d, setD] = useState<Dash | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'faltam' | 'novos' | 'ranking'>('faltam')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('coordinator_dashboard', { p_inst: institutionId, p_year: year }).then(({ data, error }) => {
      if (error) setErr(error.message); else setD(data as Dash)
    })
  }, [institutionId, year])

  const tot = useMemo(() => {
    const base = d?.turmas.reduce((s, t) => s + t.base, 0) ?? 0
    const mat = d?.turmas.reduce((s, t) => s + t.matriculados, 0) ?? 0
    return { base, mat, falta: base - mat }
  }, [d])

  const faltamPorSerie = useMemo(() => {
    const m = new Map<string, Pessoa[]>()
    d?.faltam.forEach(p => { const k = `${p.serie ?? 'Sem série'} · ${p.turma ?? ''}`; m.set(k, [...(m.get(k) ?? []), p]) })
    return [...m.entries()]
  }, [d])

  const novosPorSerie = useMemo(() => {
    const m = new Map<string, Pessoa[]>()
    d?.novos.forEach(p => { const k = p.serie ?? 'Sem série'; m.set(k, [...(m.get(k) ?? []), p]) })
    return [...m.entries()]
  }, [d])

  const ranking = useMemo(() => [...(d?.turmas ?? [])].filter(t => t.base > 0).sort((a, b) => pct(b.matriculados, b.base) - pct(a.matriculados, a.base)), [d])

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16 }
  if (err) return <div style={{ ...card, padding: 16, color: BRAND.muted, fontSize: 14 }}>Não foi possível abrir o painel: {err}</div>
  if (!d) return <div style={{ color: BRAND.muted, fontSize: 14 }}>Carregando…</div>

  const nome = d.segments.length ? d.segments.map(s => SEG[s] ?? s).join(' + ') : 'Escola toda'
  const stats = [
    { Icon: UserCheck, label: 'Rematriculados', v: tot.mat, c: BRAND.success },
    { Icon: UserMinus, label: 'Faltam', v: tot.falta, c: '#B45309' },
    { Icon: UserPlus, label: 'Alunos novos', v: d.novos.length, c: BRAND.primaryDark },
    { Icon: Users, label: 'Rematrícula', v: `${pct(tot.mat, tot.base)}%`, c: tone(pct(tot.mat, tot.base)) },
  ]

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: BRAND.ink }}>Meu segmento</h2>
        <span style={{ fontSize: 13, color: BRAND.muted }}>{nome} · {d.year}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
        {stats.map(({ Icon, ...s }) => (
          <div key={s.label} style={{ ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 12, background: BRAND.soft, color: s.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={18} /></span>
            <span><span style={{ display: 'block', fontSize: 22, fontWeight: 800, color: BRAND.ink, lineHeight: 1.1 }}>{s.v}</span><span style={{ fontSize: 12, color: BRAND.muted }}>{s.label}</span></span>
          </div>
        ))}
      </div>

      <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        {([['faltam', `Quem falta (${tot.falta})`], ['novos', `Alunos novos (${d.novos.length})`], ['ranking', 'Ranking de turmas']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            style={{ whiteSpace: 'nowrap', minHeight: 40, padding: '0 16px', borderRadius: 999, fontFamily: 'inherit', fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
              border: `1px solid ${tab === k ? BRAND.primary : BRAND.line}`, background: tab === k ? BRAND.soft : '#fff', color: tab === k ? BRAND.primaryDark : BRAND.muted }}>{l}</button>
        ))}
      </div>

      {tab === 'faltam' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          {faltamPorSerie.length === 0 && <div style={{ padding: 16, color: BRAND.muted, fontSize: 14 }}>Todos os alunos da base já estão rematriculados.</div>}
          {faltamPorSerie.map(([k, list], i) => (
            <div key={k} style={{ borderTop: i ? `1px solid ${BRAND.line}` : 'none' }}>
              <button onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k}
                style={{ width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: BRAND.ink }}>{k}</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: '#B45309', background: '#FFFBEB', borderRadius: 999, padding: '2px 10px' }}>{list.length}</span>
                <ChevronDown size={18} color={BRAND.muted} style={{ transform: open === k ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {open === k && (
                <ul style={{ margin: 0, padding: '0 16px 12px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {list.map((p, j) => (
                    <li key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5, color: BRAND.text }}>
                      <span>{p.nome}</span>
                      {p.pre && <span style={{ fontSize: 11.5, fontWeight: 700, color: BRAND.primaryDark, background: BRAND.soft, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' }}>pré-matrícula</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'novos' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          {novosPorSerie.length === 0 && <div style={{ padding: 16, color: BRAND.muted, fontSize: 14 }}>Ainda não há alunos novos neste segmento.</div>}
          {novosPorSerie.map(([k, list], i) => (
            <div key={k} style={{ borderTop: i ? `1px solid ${BRAND.line}` : 'none' }}>
              <button onClick={() => setOpen(open === 'n' + k ? null : 'n' + k)} aria-expanded={open === 'n' + k}
                style={{ width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: BRAND.ink }}>{k}</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: BRAND.primaryDark, background: BRAND.soft, borderRadius: 999, padding: '2px 10px' }}>{list.length}</span>
                <ChevronDown size={18} color={BRAND.muted} style={{ transform: open === 'n' + k ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {open === 'n' + k && (
                <ul style={{ margin: 0, padding: '0 16px 12px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {list.map((p, j) => (
                    <li key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5, color: BRAND.text }}>
                      <span>{p.nome}{p.turma ? <span style={{ color: BRAND.muted }}> · {p.turma}</span> : null}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: p.status === 'ativo' ? BRAND.success : BRAND.primaryDark, whiteSpace: 'nowrap' }}>{p.status === 'ativo' ? 'matriculado' : 'pré-matrícula'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'ranking' && (
        <div style={{ ...card, padding: '6px 16px' }}>
          {ranking.length === 0 && <div style={{ padding: '10px 0', color: BRAND.muted, fontSize: 14 }}>Sem turmas para mostrar.</div>}
          {ranking.map((t, i) => {
            const p = pct(t.matriculados, t.base)
            return (
              <div key={t.turma + i} style={{ padding: '10px 0', borderTop: i ? `1px solid ${BRAND.line}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: BRAND.ink }}>{i + 1}º · {t.turma}</span>
                  <span style={{ color: BRAND.muted }}>{t.matriculados}/{t.base} · <b style={{ color: tone(p) }}>{p}%</b></span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#EEF2F6', overflow: 'hidden' }}><div style={{ width: `${p}%`, height: '100%', background: tone(p), borderRadius: 999 }} /></div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
