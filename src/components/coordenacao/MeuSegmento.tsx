// Painel da coordenação por segmento. Somente leitura, sem telefone nem contato.
// O filtro por segmento é feito no servidor (coordinator_dashboard, coordinator_saidas, campaign_matriculometro).
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Users, UserCheck, UserMinus, UserPlus, LayoutGrid, RefreshCw, Layers, Flag, LogOut, Percent } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import StatStrip from '../mobile/StatStrip'
import { PillTabs } from '../mobile/PillTabs'
import Matriculometro from '../campanha/Matriculometro'

type Turma = { turma: string; serie: string | null; segment: string | null; base: number; matriculados: number; pre: number }
type Pessoa = { nome: string; turma: string | null; serie: string | null; segment: string | null; pre?: boolean; status?: string }
type Dash = { year: number; segments: string[]; turmas: Turma[]; faltam: Pessoa[]; novos: Pessoa[] }

export const SEG: Record<string, string> = { infantil: 'Infantil', fund1: 'Fundamental I', fund2: 'Fundamental II', medio: 'Médio' }
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const tone = (p: number) => (p >= 80 ? BRAND.success : p >= 50 ? '#B45309' : '#B91C1C')
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, boxShadow: '0 1px 2px rgba(26,43,74,.04)' }

function Grouped({ groups, color, empty, render }: { groups: [string, Pessoa[]][]; color: string; empty: string; render: (p: Pessoa) => React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {groups.length === 0 && <div style={{ padding: 16, color: BRAND.muted, fontSize: 14 }}>{empty}</div>}
      {groups.map(([k, list], i) => (
        <div key={k} style={{ borderTop: i ? `1px solid ${BRAND.line}` : 'none' }}>
          <button onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k} className="aion-tap"
            style={{ width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: BRAND.ink }}>{k}</span>
            <span style={{ fontWeight: 800, fontSize: 13, color, background: `${color}14`, borderRadius: 999, padding: '2px 10px' }}>{list.length}</span>
            <ChevronDown size={18} color={BRAND.muted} style={{ transform: open === k ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {open === k && <ul style={{ margin: 0, padding: '0 16px 12px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>{list.map((p, j) => <li key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5, color: BRAND.text }}>{render(p)}</li>)}</ul>}
        </div>
      ))}
    </div>
  )
}

const Tag = ({ c, children }: { c: string; children: React.ReactNode }) => <span style={{ fontSize: 11.5, fontWeight: 700, color: c, background: `${c}14`, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' }}>{children}</span>

export default function MeuSegmento({ institutionId, year, onTitle }: { institutionId: string; year: number; onTitle?: (s: string) => void }) {
  const [d, setD] = useState<Dash | null>(null)
  const [saidas, setSaidas] = useState<Pessoa[]>([])
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('geral')

  useEffect(() => {
    supabase.rpc('coordinator_dashboard', { p_inst: institutionId, p_year: year }).then(({ data, error }) => {
      if (error) setErr(error.message); else { setD(data as Dash); onTitle?.((data as Dash).segments.length ? (data as Dash).segments.map(s => SEG[s] ?? s).join(' + ') : 'Escola toda') }
    })
    supabase.rpc('coordinator_saidas', { p_inst: institutionId, p_year: year }).then(({ data }) => setSaidas((data ?? []) as Pessoa[]))
  }, [institutionId, year]) // eslint-disable-line react-hooks/exhaustive-deps

  const tot = useMemo(() => {
    const base = d?.turmas.reduce((s, t) => s + t.base, 0) ?? 0
    const mat = d?.turmas.reduce((s, t) => s + t.matriculados, 0) ?? 0
    const pre = d?.turmas.reduce((s, t) => s + t.pre, 0) ?? 0
    return { base, mat, pre, falta: base - mat }
  }, [d])
  const group = (list: Pessoa[], key: (p: Pessoa) => string) => { const m = new Map<string, Pessoa[]>(); list.forEach(p => m.set(key(p), [...(m.get(key(p)) ?? []), p])); return [...m.entries()] }
  const faltam = useMemo(() => group(d?.faltam ?? [], p => `${p.serie ?? 'Sem série'} · ${p.turma ?? ''}`), [d])
  const novos = useMemo(() => group(d?.novos ?? [], p => p.serie ?? 'Sem série'), [d])
  const sai = useMemo(() => group(saidas, p => p.serie ?? 'Sem série'), [saidas])
  const ranking = useMemo(() => [...(d?.turmas ?? [])].filter(t => t.base > 0).sort((a, b) => pct(b.matriculados, b.base) - pct(a.matriculados, a.base)), [d])
  const porSerie = useMemo(() => {
    const m = new Map<string, { serie: string; base: number; mat: number }>()
    d?.turmas.forEach(t => { const k = t.serie ?? 'Sem série'; const o = m.get(k) ?? { serie: k, base: 0, mat: 0 }; o.base += t.base; o.mat += t.matriculados; m.set(k, o) })
    return [...m.values()]
  }, [d])

  if (err) return <div style={{ ...card, padding: 16, color: BRAND.muted, fontSize: 14 }}>Não foi possível abrir o painel: {err}</div>
  if (!d) return <div style={{ color: BRAND.muted, fontSize: 14 }}>Carregando…</div>
  const p = pct(tot.mat, tot.base)

  const bar = (label: string, a: number, b: number, key: string) => {
    const x = pct(a, b)
    return (
      <div key={key} style={{ padding: '10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: BRAND.ink }}>{label}</span>
          <span style={{ color: BRAND.muted }}>{a}/{b} · <b style={{ color: tone(x) }}>{x}%</b></span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: '#EEF2F6', overflow: 'hidden' }}><div style={{ width: `${x}%`, height: '100%', background: tone(x), borderRadius: 999 }} /></div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <StatStrip items={[
        { label: 'Rematriculados', value: tot.mat, color: BRAND.success, icon: UserCheck, sub: `dos ${tot.base} da base de ${year - 1}` },
        { label: 'Ainda faltam', value: tot.falta, color: '#D97706', icon: UserMinus, alert: tot.falta > 0, sub: `${tot.pre} em pré-matrícula` },
        { label: 'Alunos novos', value: d.novos.length, color: '#7C3AED', icon: UserPlus, sub: `em ${year}` },
        { label: 'Rematrícula', value: `${p}%`, color: tone(p), icon: Percent, sub: 'da base já confirmada' },
      ]} />
      <PillTabs value={tab} onChange={setTab} tabs={([
        ['geral', 'Visão geral', LayoutGrid], ['rematricula', 'Rematrícula', RefreshCw], ['novatos', 'Novatos', Users],
        ['serie', 'Séries e turmas', Layers], ['matriculometro', 'Matriculômetro', Flag], ['saidas', 'Saídas', LogOut],
      ] as any)} />

      {tab === 'geral' && (
        <div style={{ ...card, padding: '8px 16px' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: BRAND.ink, padding: '8px 0 0' }}>Rematrícula por série</div>
          {porSerie.length === 0 && <div style={{ padding: '10px 0', color: BRAND.muted, fontSize: 14 }}>Sem séries para mostrar.</div>}
          {porSerie.map(s => bar(s.serie, s.mat, s.base, s.serie))}
        </div>
      )}
      {tab === 'rematricula' && <Grouped groups={faltam} color="#D97706" empty="Todos os alunos da base já estão rematriculados." render={x => (<><span>{x.nome}</span>{x.pre && <Tag c="#7C3AED">pré-matrícula</Tag>}</>)} />}
      {tab === 'novatos' && <Grouped groups={novos} color="#7C3AED" empty="Ainda não há alunos novos neste segmento." render={x => (<><span>{x.nome}{x.turma ? <span style={{ color: BRAND.muted }}> · {x.turma}</span> : null}</span><Tag c={x.status === 'ativo' ? BRAND.success : '#7C3AED'}>{x.status === 'ativo' ? 'matriculado' : 'pré-matrícula'}</Tag></>)} />}
      {tab === 'serie' && (
        <div style={{ ...card, padding: '2px 16px' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: BRAND.ink, padding: '12px 0 0' }}>Ranking de turmas</div>
          {ranking.length === 0 && <div style={{ padding: '10px 0', color: BRAND.muted, fontSize: 14 }}>Sem turmas para mostrar.</div>}
          {ranking.map((t, i) => bar(`${i + 1}º · ${t.turma}`, t.matriculados, t.base, t.turma + i))}
        </div>
      )}
      {tab === 'matriculometro' && <Matriculometro institutionId={institutionId} year={year} />}
      {tab === 'saidas' && <Grouped groups={sai} color="#DC2626" empty="Nenhuma saída registrada neste segmento." render={x => (<><span>{x.nome}{x.turma ? <span style={{ color: BRAND.muted }}> · {x.turma}</span> : null}</span><Tag c="#DC2626">{x.status === 'transferido' ? 'transferido' : x.status === 'cancelado' ? 'cancelado' : 'desistente'}</Tag></>)} />}
    </div>
  )
}
