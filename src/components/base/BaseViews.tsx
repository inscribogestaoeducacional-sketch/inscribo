// Peças da Base de alunos que mudam de desenho entre computador e celular.
// No celular: tudo vira cartão (tabela larga nunca); no computador: as tabelas de sempre.
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { CheckCircle2, ChevronRight, Download, Loader2, MessageCircle, Search, Undo2, User, Users } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { CountUp } from '../leads/LeadsAttention'
import { cardBtn } from '../mobile/StatStrip'
import {
  Badge, MONTHS, ORIGIN_COLOR, ORIGIN_LABEL, SectionTitle, baseCard, baseInput, chipStyle, fmtDate, fmtPhone, stateInfo, waNumber,
  type Counts, type Group, type Head, type PanelRow, type Period, type Row,
} from './baseShared'

const th: CSSProperties = { padding: '9px 10px', color: BRAND.muted, fontWeight: 700, fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '9px 10px', fontSize: 13, color: BRAND.ink, textAlign: 'right' }
const dash = (n: number) => (n ? n : '–')

/* ───────────── números em destaque (tocar leva para a lista) ───────────── */
export type Kpi = { label: string; value: number; sub: string; color: string; icon: ElementType; onClick?: () => void; alert?: boolean }
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className="aion-snap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
      {items.map((it, i) => {
        const Icon = it.icon
        return (
          <button key={it.label} type="button" onClick={it.onClick} className="ld-kpi ld-in"
            style={{ animationDelay: `${i * 60}ms`, position: 'relative', overflow: 'hidden', background: '#fff', borderRadius: 18, padding: '14px 14px 13px', border: `1.5px solid ${it.alert ? '#FCA5A5' : BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 1px 2px rgba(26,43,74,.04)', cursor: it.onClick ? 'pointer' : 'default', textAlign: 'left' }}>
            <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: it.color, opacity: .7 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink, lineHeight: 1.2 }}>{it.label}</span>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: `${it.color}14`, color: it.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} /></span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: it.color, lineHeight: 1, letterSpacing: '-.02em' }}><CountUp value={it.value} /></div>
            <div style={{ fontSize: 11.5, color: BRAND.muted, lineHeight: 1.3 }}>{it.sub}</div>
          </button>
        )
      })}
    </div>
  )
}

/* ───────────── período ───────────── */
export function PeriodBar({ mobile, period, setPeriod, from, to, setFrom, setTo, note }: {
  mobile: boolean; period: Period; setPeriod: (p: Period) => void; from: string; to: string; setFrom: (s: string) => void; setTo: (s: string) => void; note: string
}) {
  const chips: [Period, string][] = [['all', 'Todo o período'], ['month', 'Este mês'], ['last', 'Mês passado'], ['custom', 'Escolher datas']]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className={mobile ? 'aion-hscroll' : undefined} style={mobile ? { display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -12px', padding: '2px 12px' } : { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {chips.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setPeriod(k)} className="aion-tap" style={chipStyle(period === k)}>{label}</button>
        ))}
        {period === 'custom' && !mobile && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...baseInput, fontSize: 13, minHeight: 0, padding: '7px 10px' }} aria-label="De" />
            <span style={{ fontSize: 12, color: BRAND.muted }}>até</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...baseInput, fontSize: 13, minHeight: 0, padding: '7px 10px' }} aria-label="Até" />
          </>
        )}
      </div>
      {period === 'custom' && mobile && (
        <div style={{ ...baseCard, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <label style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: BRAND.muted }}>De
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...baseInput, width: '100%', marginTop: 4 }} aria-label="De" />
          </label>
          <label style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: BRAND.muted }}>Até
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...baseInput, width: '100%', marginTop: 4 }} aria-label="Até" />
          </label>
        </div>
      )}
      {note && period !== 'all' && <span style={{ fontSize: 12, color: BRAND.muted, lineHeight: 1.45 }}>{note}</span>}
    </div>
  )
}

/* ───────────── visão geral ───────────── */
export type ReconcilePart = { label: string; n: number; color: string }

export function Reconcile({ parts, total }: { parts: ReconcilePart[]; total: number }) {
  const sum = parts.reduce((s, p) => s + p.n, 0)
  const denom = Math.max(total, sum, 1)
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', background: '#EEF3F2' }}>
        {parts.map(p => p.n > 0 && <div key={p.label} title={`${p.label}: ${p.n}`} style={{ width: `${(p.n / denom) * 100}%`, background: p.color }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginTop: 12 }}>
        {parts.map(p => (
          <div key={p.label} style={{ fontSize: 13, color: BRAND.text }}>
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 99, background: p.color, marginRight: 6 }} />
            <b style={{ color: BRAND.ink }}>{p.n}</b> {p.label}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, margin: '10px 0 0', color: sum === total ? BRAND.success : BRAND.warn, fontWeight: 600 }}>
        {sum === total ? `A conta fecha: ${sum} de ${total}.` : `Somam ${sum}, a base tem ${total}: ${Math.abs(total - sum)} aluno(s) de diferença (conferir na aba Alunos).`}
      </p>
    </div>
  )
}

export function MonthChart({ months, mobile }: { months: { mat: number; pre: number }[]; mobile: boolean }) {
  const max = Math.max(1, ...months.map(m => m.mat + m.pre))
  const any = months.some(m => m.mat + m.pre > 0)
  if (!any) return <p style={{ fontSize: 13, color: BRAND.muted, margin: 0 }}>Ainda não há matrículas com data para mostrar.</p>
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: mobile ? 3 : 8, height: 150, paddingTop: 8 }}>
        {months.map((m, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
            <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700 }}>{m.mat + m.pre || ''}</div>
            <div style={{ width: '100%', maxWidth: 34, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: `${((m.mat + m.pre) / max) * 100}%`, minHeight: m.mat + m.pre ? 3 : 0 }}>
              {m.pre > 0 && <div style={{ flex: m.pre, background: '#C4B5FD', borderRadius: '5px 5px 0 0' }} />}
              {m.mat > 0 && <div style={{ flex: m.mat, background: '#10B981', borderRadius: m.pre ? 0 : '5px 5px 0 0' }} />}
            </div>
            <div style={{ fontSize: 11, color: BRAND.faint }}>{MONTHS[i]}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: BRAND.muted }}>
        <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: '#10B981', marginRight: 6 }} />Matriculados</span>
        <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: '#C4B5FD', marginRight: 6 }} />Pré-matriculados</span>
      </div>
    </>
  )
}

// Cartão de destaque: quantos já rematricularam e quantos faltam
export function ProgressCard({ year, rem, pre, faltam, base, onFaltam }: { year: number; rem: number; pre: number; faltam: number; base: number; onFaltam: () => void }) {
  const denom = Math.max(base, rem + pre + faltam, 1)
  const pct = Math.min(100, Math.round((rem / denom) * 100))
  return (
    <div className="ld-card" style={{ ...baseCard, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink }}>Rematrícula {year}</span>
        <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: BRAND.soft, color: BRAND.primaryDark }}>{pct}% feito</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 38, fontWeight: 800, color: '#059669', letterSpacing: '-.02em', lineHeight: 1 }}><CountUp value={rem} /></span>
        <span style={{ fontSize: 13.5, color: BRAND.text, lineHeight: 1.3 }}>de {denom} alunos de {year - 1} já rematricularam</span>
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: '#EEF3F2', marginTop: 12 }}>
        <div style={{ width: `${(rem / denom) * 100}%`, background: '#10B981' }} />
        <div style={{ width: `${(pre / denom) * 100}%`, background: '#C4B5FD' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: BRAND.text }}><b style={{ color: '#D97706', fontSize: 16 }}>{faltam}</b> ainda faltam rematricular</span>
        {faltam > 0 && <button type="button" onClick={onFaltam} className="aion-tap" style={cardBtn('primary', { flex: '0 0 auto', minHeight: 40, padding: '8px 14px' })}>Ver quem falta</button>}
      </div>
    </div>
  )
}

export function GeralView({ mobile, year, counts, parts, totalAll, preCounts, canEdit, setPreCounts, months }: {
  mobile: boolean; year: number; counts: Counts; parts: ReconcilePart[]; totalAll: number; preCounts: boolean; canEdit: boolean
  setPreCounts: (on: boolean) => void; months: { mat: number; pre: number }[]
}) {
  const origins = ['rematricula', 'novato', 'ex_aluno'] as const
  const totMat = counts.matOnly.rematricula + counts.matOnly.novato + counts.matOnly.ex_aluno
  const totPre = counts.preOnly.rematricula + counts.preOnly.novato + counts.preOnly.ex_aluno
  return (
    <>
      <div className="ld-card" style={baseCard}>
        <SectionTitle>De onde vêm os alunos de {year}</SectionTitle>
        {mobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {origins.map(o => {
              const tot = counts.matOnly[o] + counts.preOnly[o]
              return (
                <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, background: '#F8FAFC', borderLeft: `4px solid ${ORIGIN_COLOR[o]}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>{ORIGIN_LABEL[o]}</div>
                    <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{counts.matOnly[o] || 0} matriculados · {counts.preOnly[o] || 0} pré-matriculados</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: tot ? ORIGIN_COLOR[o] : BRAND.faint, lineHeight: 1 }}>{tot || '–'}</div>
                </div>
              )
            })}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px 0' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>Total</div>
                <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{totMat} matriculados · {totPre} pré-matriculados</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: BRAND.ink, lineHeight: 1 }}>{counts.mat + counts.pre}</div>
            </div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 640 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ ...th, textAlign: 'left' }}>Origem</th><th style={th}>Matriculados</th><th style={th}>Pré-matriculados</th><th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {origins.map(o => (
                <tr key={o} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>
                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 99, background: ORIGIN_COLOR[o], marginRight: 8 }} />{ORIGIN_LABEL[o]}
                  </td>
                  <td style={td}>{counts.matOnly[o] || '–'}</td>
                  <td style={td}>{counts.preOnly[o] || '–'}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{counts.matOnly[o] + counts.preOnly[o] || '–'}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${BRAND.line}` }}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>Total</td>
                <td style={{ ...td, fontWeight: 800 }}>{totMat}</td>
                <td style={{ ...td, fontWeight: 800 }}>{totPre}</td>
                <td style={{ ...td, fontWeight: 800 }}>{counts.mat + counts.pre}</td>
              </tr>
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 12, color: BRAND.muted, margin: '12px 0 0', lineHeight: 1.55 }}>
          <b>Novato</b> nunca estudou na escola. <b>Ex-aluno que voltou</b> já estudou aqui antes, mas não estava na escola em {year - 1}.
          {counts.estimated > 0 && <> Em {counts.estimated} aluno(s) a data da matrícula é estimada (primeira vez que apareceram no sistema).</>}
        </p>
      </div>

      <div className="ld-card" style={baseCard}>
        <SectionTitle>E os {totalAll} alunos de {year - 1}?</SectionTitle>
        <Reconcile parts={parts} total={totalAll} />
      </div>

      <div className="ld-card" style={baseCard}>
        <SectionTitle>Matrículas por mês</SectionTitle>
        <MonthChart months={months} mobile={mobile} />
      </div>

      <div className="ld-card" style={{ ...baseCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 16px' }}>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>Pré-matrícula conta como matriculado?</div>
          <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2, lineHeight: 1.45 }}>
            Cada escola escolhe. Hoje: {preCounts ? 'Sim, soma nos matriculados.' : 'Não, aparece separada como “pré-matriculado”.'}
          </div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', border: `1.5px solid ${BRAND.line}`, borderRadius: 12, overflow: 'hidden', fontSize: 13 }}>
            {[false, true].map(v => (
              <button key={String(v)} type="button" onClick={() => { if (preCounts !== v) setPreCounts(v) }}
                style={{ padding: '10px 20px', minHeight: 44, border: 0, cursor: 'pointer', fontFamily: 'inherit', background: preCounts === v ? BRAND.primary : '#fff', color: preCounts === v ? '#fff' : BRAND.text, fontWeight: 700 }}>
                {v ? 'Sim' : 'Não'}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/* ───────────── lista de alunos ───────────── */
export const GROUPS: [Group, string][] = [['matriculados', 'Matriculados'], ['pre', 'Pré-matriculados'], ['faltam', 'Ainda faltam'], ['saiu', 'Saíram'], ['concluinte', 'Concluintes'], ['todos', 'Todos']]

export function RowActions({ r, canEdit, busyId, mark, size = 'card' }: { r: Row; canEdit: boolean; busyId: string; mark: (r: Row, on: boolean) => void; size?: 'card' | 'table' }) {
  const busy = busyId === r.student_id
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const tb = size === 'table'
  const wa = r.category === 'a_rematricular' && r.guardian_phone
  const base: CSSProperties = tb ? { fontSize: 12, padding: '6px 10px', borderRadius: 8, minHeight: 0, flex: 'none' } : {}
  return (
    <>
      {wa && (
        <a href={`https://wa.me/${waNumber(r.guardian_phone as string)}`} target="_blank" rel="noreferrer" title="Chamar no WhatsApp" onClick={stop} className="aion-tap"
          style={tb
            ? { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, marginRight: 6, borderRadius: 8, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#15803D' }
            : { ...cardBtn('primary'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none' }}>
          <MessageCircle size={tb ? 15 : 16} />{!tb && ' Chamar no WhatsApp'}
        </a>
      )}
      {r.category === 'a_rematricular' && canEdit && (
        <button type="button" onClick={e => { stop(e); mark(r, true) }} disabled={busy} className="aion-tap"
          style={{ ...cardBtn('ghost'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...(tb ? { ...base, border: `1px solid ${BRAND.softLine}`, background: BRAND.softer, color: BRAND.primaryDark } : {}) }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Marcar rematriculado
        </button>
      )}
      {r.category === 'rematriculado_declarado' && canEdit && (
        <button type="button" onClick={e => { stop(e); mark(r, false) }} disabled={busy} className="aion-tap"
          style={{ ...cardBtn('ghost'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...(tb ? { ...base, color: BRAND.muted } : {}) }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} Desfazer
        </button>
      )}
    </>
  )
}

function StudentCard({ r, canEdit, busyId, mark, onOpen }: { r: Row; canEdit: boolean; busyId: string; mark: (r: Row, on: boolean) => void; onOpen: (r: Row) => void }) {
  const st = stateInfo(r)
  const hasActions = (r.category === 'a_rematricular' && (canEdit || !!r.guardian_phone)) || (r.category === 'rematriculado_declarado' && canEdit)
  return (
    <div className="ld-card" onClick={() => onOpen(r)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onOpen(r) }}
      style={{ ...baseCard, padding: 14, cursor: 'pointer', borderLeft: `4px solid ${st?.color ?? BRAND.line}` }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, lineHeight: 1.25 }}>{r.student_name}</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2 }}>{r.grade_name || '–'} · Matrícula {r.registration_code || '–'}</div>
        </div>
        {st && <Badge color={st.color} style={{ flexShrink: 0 }}>{st.label}</Badge>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
        {r.origin && <Badge color={ORIGIN_COLOR[r.origin]}>{ORIGIN_LABEL[r.origin]}</Badge>}
        {r.enrolled_on && <span style={{ fontSize: 12, color: BRAND.muted }}>Matrícula em {fmtDate(r.enrolled_on)}{r.date_is_estimate && <span title="Data estimada: primeira vez que o aluno apareceu no sistema"> ~</span>}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12.5, color: BRAND.text, minWidth: 0 }}>
        <User size={13} color={BRAND.faint} style={{ flexShrink: 0 }} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.guardian_name || '–'}{r.guardian_phone ? ` · ${fmtPhone(r.guardian_phone)}` : ''}</span>
        <ChevronRight size={16} color={BRAND.faint} style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </div>
      {hasActions && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <RowActions r={r} canEdit={canEdit} busyId={busyId} mark={mark} />
        </div>
      )}
    </div>
  )
}

export function StudentsView({ mobile, year, shown, limit, setLimit, group, setGroup, groupCount, grade, setGrade, panel, q, setQ, canEdit, busyId, mark, onOpen, exportCsv, periodSlot }: {
  periodSlot?: ReactNode; mobile: boolean; year: number; shown: Row[]; limit: number; setLimit: (f: (l: number) => number) => void
  group: Group; setGroup: (g: Group) => void; groupCount: Record<Group, number>; grade: string; setGrade: (s: string) => void; panel: PanelRow[]
  q: string; setQ: (s: string) => void; canEdit: boolean; busyId: string; mark: (r: Row, on: boolean) => void; onOpen: (r: Row) => void; exportCsv: () => void
}) {
  const search = (
    <div style={{ position: 'relative', flex: mobile ? undefined : '0 1 340px' }}>
      <Search size={16} style={{ position: 'absolute', left: 12, top: mobile ? 14 : 10, color: BRAND.faint }} />
      <input id="base-busca" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, responsável ou matrícula"
        style={{ ...baseInput, paddingLeft: 36, width: '100%', ...(mobile ? { borderRadius: 14, minHeight: 46 } : { fontSize: 13, minHeight: 0, padding: '8px 11px 8px 34px' }) }} />
    </div>
  )
  const chips = (
    <div className={mobile ? 'aion-hscroll' : undefined} style={mobile ? { display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -12px', padding: '2px 12px' } : { display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {GROUPS.map(([k, label]) => (
        <button key={k} type="button" onClick={() => setGroup(k)} className="aion-tap" style={chipStyle(group === k)}>{label} ({groupCount[k]})</button>
      ))}
    </div>
  )
  const gradeSelect = (
    <select value={grade} onChange={e => setGrade(e.target.value)} aria-label="Série"
      style={{ ...baseInput, ...(mobile ? { flex: 1, minWidth: 0 } : { fontSize: 13, minHeight: 0, padding: '8px 11px' }) }}>
      <option value="">Todas as séries</option>
      {panel.map(p => <option key={p.grade_level_id} value={p.grade_level_id}>{p.grade_name}</option>)}
    </select>
  )
  const csvBtn = (
    <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="aion-tap"
      style={{ ...cardBtn('ghost'), flex: 'none', minHeight: mobile ? 44 : 0, padding: mobile ? '10px 14px' : '7px 12px', borderRadius: mobile ? 12 : 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: mobile ? 13 : 12.5, opacity: shown.length === 0 ? .5 : 1 }}>
      <Download size={14} /> {mobile ? 'Planilha' : 'Baixar planilha (CSV)'}
    </button>
  )
  const note = group === 'faltam' && (
    <p style={{ fontSize: 12, color: BRAND.muted, margin: 0, lineHeight: 1.55 }}>
      Quem estava na escola em {year - 1} e ainda não aparece em {year}. Se a família já confirmou e o sistema da escola ainda não mostra,
      use “Marcar rematriculado”; a marcação some sozinha quando o sistema trouxer o aluno.
    </p>
  )
  const more = shown.length > limit && (
    <button type="button" onClick={() => setLimit(l => l + 200)} className="aion-tap" style={{ ...cardBtn('ghost'), flex: 'none', width: mobile ? '100%' : undefined, marginTop: mobile ? 0 : 12 }}>
      Mostrar mais ({shown.length - limit} restantes)
    </button>
  )

  if (mobile) {
    return (
      <>
        {search}
        {chips}
        {periodSlot}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {gradeSelect}
          {csvBtn}
        </div>
        <div style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 700 }}>{shown.length} aluno(s)</div>
        {note}
        {shown.length === 0 && (
          <div style={{ ...baseCard, textAlign: 'center', padding: 28, color: BRAND.faint, fontSize: 13.5 }}>
            <Users size={26} style={{ marginBottom: 6 }} /><div>Nenhum aluno nesta lista.</div>
          </div>
        )}
        {shown.slice(0, limit).map(r => <StudentCard key={r.student_id} r={r} canEdit={canEdit} busyId={busyId} mark={mark} onOpen={onOpen} />)}
        {more}
      </>
    )
  }

  return (
    <div style={baseCard}>
      <div style={{ marginBottom: 12 }}>{chips}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {search}
        {gradeSelect}
        <span style={{ fontSize: 12, color: BRAND.faint }}>{shown.length} aluno(s)</span>
        <span style={{ marginLeft: 'auto' }}>{csvBtn}</span>
      </div>
      {note && <div style={{ marginBottom: 10 }}>{note}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['Aluno', 'Responsável', 'Série', 'Origem', 'Situação', 'Matrícula em'].map(h => <th key={h} style={{ ...th, textAlign: 'left' }}>{h}</th>)}
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map(r => {
              const st = stateInfo(r)
              return (
                <tr key={r.student_id} onClick={() => onOpen(r)} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }} title="Abrir a ficha do aluno">
                  <td style={{ ...td, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700 }}>{r.student_name}</div>
                    <div style={{ fontSize: 11.5, color: BRAND.faint }}>Matrícula {r.registration_code || '–'}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'left' }}>
                    {r.guardian_name || '–'}
                    {r.guardian_phone && <div style={{ fontSize: 12, color: BRAND.muted }}>{fmtPhone(r.guardian_phone)}</div>}
                  </td>
                  <td style={{ ...td, textAlign: 'left', fontSize: 12.5 }}>{r.grade_name || '–'}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{r.origin ? <Badge color={ORIGIN_COLOR[r.origin]}>{ORIGIN_LABEL[r.origin]}</Badge> : <span style={{ color: BRAND.faint }}>–</span>}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{st ? <Badge color={st.color}>{st.label}</Badge> : '–'}</td>
                  <td style={{ ...td, textAlign: 'left', fontSize: 12.5 }}>
                    {r.enrolled_on ? <>{fmtDate(r.enrolled_on)}{r.date_is_estimate && <span title="Data estimada: primeira vez que o aluno apareceu no sistema" style={{ color: BRAND.faint }}> ~</span>}</> : '–'}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}><RowActions r={r} canEdit={canEdit} busyId={busyId} mark={mark} size="table" /></td>
                </tr>
              )
            })}
            {shown.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: BRAND.faint, padding: 22 }}>Nenhum aluno nesta lista.</td></tr>}
          </tbody>
        </table>
      </div>
      {more}
    </div>
  )
}

/* ───────────── por série ───────────── */
export function SerieView({ mobile, year, panel, byGrade, canEdit, capDraft, setCapDraft, saveCap, openGrade }: {
  mobile: boolean; year: number; panel: PanelRow[]; byGrade: Map<string, { mat: number; pre: number; faltam: number }>; canEdit: boolean
  capDraft: Record<string, string>; setCapDraft: (f: (d: Record<string, string>) => Record<string, string>) => void; saveCap: (g: PanelRow) => void; openGrade: (id: string) => void
}) {
  const list = panel.filter(r => r.base_prev_year + r.pending + r.pre_enrolled + r.reenrolled + r.new_students + r.returning_students + r.graduates > 0 || r.capacity != null)
  const capInput = (r: PanelRow, w: number) => (
    <input inputMode="numeric" aria-label={`Vagas ${r.grade_name}`}
      value={capDraft[r.grade_level_id] ?? (r.capacity == null ? '' : String(r.capacity))}
      onChange={e => setCapDraft(d => ({ ...d, [r.grade_level_id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
      onBlur={() => saveCap(r)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      placeholder="–" style={{ ...baseInput, width: w, textAlign: 'right', padding: mobile ? '8px 10px' : '5px 8px', minHeight: mobile ? 44 : 0, fontSize: mobile ? 16 : 13 }} />
  )

  if (mobile) {
    return (
      <>
        {list.map(r => {
          const g = byGrade.get(r.grade_level_id) ?? { mat: 0, pre: 0, faltam: 0 }
          const occ = g.mat + g.pre
          const tot = Math.max(1, g.mat + g.pre + g.faltam)
          const over = r.capacity != null && occ > r.capacity
          const cell = (label: string, v: number, color?: string) => (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: v && color ? color : v ? BRAND.ink : BRAND.faint, lineHeight: 1.1 }}>{dash(v)}</div>
              <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2, lineHeight: 1.25 }}>{label}</div>
            </div>
          )
          return (
            <div key={r.grade_level_id} className="ld-card" style={{ ...baseCard, padding: 14 }}>
              <div onClick={() => openGrade(r.grade_level_id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openGrade(r.grade_level_id) }} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink }}>
                    {r.grade_name}{r.is_terminal && <span style={{ fontSize: 11.5, color: BRAND.faint, fontWeight: 600 }}> · série final</span>}
                  </div>
                  <ChevronRight size={18} color={BRAND.faint} />
                </div>
                <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: '#EEF3F2', margin: '10px 0 12px' }}>
                  <div style={{ width: `${(g.mat / tot) * 100}%`, background: '#10B981' }} />
                  <div style={{ width: `${(g.pre / tot) * 100}%`, background: '#C4B5FD' }} />
                  <div style={{ width: `${(g.faltam / tot) * 100}%`, background: '#F59E0B' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {cell(`Alunos em ${year - 1}`, r.base_prev_year)}
                  {cell('Matriculados', g.mat, '#059669')}
                  {cell('Pré-matric.', g.pre, '#7C3AED')}
                  {cell('Ainda faltam', g.faltam, '#D97706')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 700 }}>Vagas</div>
                  <div style={{ marginTop: 4 }}>{canEdit ? capInput(r, 92) : <b style={{ fontSize: 18, color: BRAND.ink }}>{r.capacity ?? '–'}</b>}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 700 }}>Livres</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: over ? '#DC2626' : r.capacity == null ? BRAND.faint : BRAND.ink }}>{r.capacity == null ? '–' : r.capacity - occ}</div>
                </div>
                <button type="button" onClick={() => openGrade(r.grade_level_id)} className="aion-tap" style={cardBtn('primary', { flex: '0 0 auto', padding: '10px 14px' })}>Ver alunos</button>
              </div>
            </div>
          )
        })}
      </>
    )
  }

  return (
    <div style={{ ...baseCard, padding: 0, overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
        <thead>
          <tr style={{ background: '#F8FAFC' }}>
            <th style={{ ...th, textAlign: 'left', paddingLeft: 18 }}>Série em {year}</th>
            <th style={th}>Alunos em {year - 1}</th><th style={th}>Matriculados</th><th style={th}>Pré-matric.</th><th style={th}>Ainda faltam</th><th style={th}>Vagas</th>
            <th style={{ ...th, paddingRight: 18 }}>Livres</th>
          </tr>
        </thead>
        <tbody>
          {list.map(r => {
            const g = byGrade.get(r.grade_level_id) ?? { mat: 0, pre: 0, faltam: 0 }
            const occ = g.mat + g.pre
            return (
              <tr key={r.grade_level_id} onClick={() => openGrade(r.grade_level_id)} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }} title="Ver os alunos desta série">
                <td style={{ ...td, textAlign: 'left', fontWeight: 700, paddingLeft: 18 }}>
                  {r.grade_name}{r.is_terminal && <span style={{ fontSize: 11, color: BRAND.faint, fontWeight: 500 }}> · série final</span>}
                </td>
                <td style={td}>{r.base_prev_year || '–'}</td>
                <td style={{ ...td, color: '#059669', fontWeight: 700 }}>{g.mat || '–'}</td>
                <td style={{ ...td, color: g.pre ? '#7C3AED' : undefined, fontWeight: g.pre ? 700 : 400 }}>{g.pre || '–'}</td>
                <td style={{ ...td, color: g.faltam ? '#D97706' : undefined, fontWeight: g.faltam ? 800 : 400 }}>{g.faltam || '–'}</td>
                <td style={td} onClick={e => e.stopPropagation()}>{canEdit ? capInput(r, 64) : (r.capacity ?? '–')}</td>
                <td style={{ ...td, paddingRight: 18, color: r.capacity != null && occ > r.capacity ? '#DC2626' : undefined }}>{r.capacity == null ? '–' : r.capacity - occ}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ───────────── conferência ───────────── */
export function ConferenceView({ mobile, head, draft, setDraft, save, canEdit, year }: {
  mobile: boolean; head: Head[]; draft: Record<string, string>; setDraft: (f: (d: Record<string, string>) => Record<string, string>) => void
  save: (h: Head) => void; canEdit: boolean; year: number
}) {
  const rows = head.filter(h => h.studying + h.left_school + h.concluded + h.prev_studying + h.prev_left > 0)
  const totalStudying = rows.reduce((s, h) => s + h.studying, 0)
  const totalLeft = rows.reduce((s, h) => s + h.left_school, 0)
  const totalPrevLeft = rows.reduce((s, h) => s + h.prev_left, 0)
  const totalPrevBase = rows.reduce((s, h) => s + h.prev_studying + h.prev_left, 0)
  const rate = totalStudying + totalLeft ? totalLeft / (totalStudying + totalLeft) : 0
  const prevRate = totalPrevBase ? totalPrevLeft / totalPrevBase : 0
  const low = prevRate > 0.02 && rate < prevRate / 2
  const secInput = (h: Head, w: number) => (
    <input inputMode="numeric" aria-label={`Secretaria ${h.grade_name}`}
      value={draft[h.grade_level_id] ?? (h.secretary_count == null ? '' : String(h.secretary_count))}
      onChange={e => setDraft(d => ({ ...d, [h.grade_level_id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
      onBlur={() => save(h)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      placeholder="–" style={{ ...baseInput, width: w, textAlign: 'right', padding: mobile ? '8px 10px' : '5px 8px', minHeight: mobile ? 44 : 0, fontSize: mobile ? 16 : 13 }} />
  )
  const diffOf = (h: Head) => (h.secretary_count == null ? null : h.studying - h.secretary_count)
  const diffText = (d: number | null) => (d == null ? '–' : d === 0 ? 'bate' : d > 0 ? `+${d} no sistema` : `${d} no sistema`)
  const diffColor = (d: number | null) => (d == null ? BRAND.faint : d === 0 ? BRAND.success : BRAND.warn)

  return (
    <>
      <div className="ld-card" style={baseCard}>
        <SectionTitle>Conferir com a secretaria · {year}</SectionTitle>
        <p style={{ fontSize: 13, color: BRAND.text, margin: '0 0 6px', lineHeight: 1.6 }}>
          O sistema da escola mostra <b>{totalStudying}</b> alunos cursando. Nem sempre isso é o número real: aluno que saiu e ainda não foi baixado continua aparecendo.
          Peça à secretaria quantos alunos há em cada série e digite abaixo; a diferença mostra onde conferir.
        </p>
        {low && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: BRAND.warnSoft, border: '1px solid #FDE68A', color: BRAND.warn, fontSize: 13, lineHeight: 1.5 }}>
            Atenção: neste ano saíram {(rate * 100).toFixed(1)}% dos alunos; no ano passado foram {(prevRate * 100).toFixed(1)}%. Pode haver aluno que já saiu e continua “cursando” no sistema.
          </div>
        )}
      </div>
      {mobile ? rows.map(h => {
        const d = diffOf(h)
        return (
          <div key={h.grade_level_id} className="ld-card" style={{ ...baseCard, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink }}>{h.grade_name}</div>
              <Badge color={d == null ? '#94A3B8' : d === 0 ? '#15803D' : '#B45309'}>{d == null ? 'sem número da secretaria' : d === 0 ? 'bate' : diffText(d)}</Badge>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 700, marginBottom: 4 }}>Cursando no sistema</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: BRAND.ink, minHeight: 44, display: 'flex', alignItems: 'center' }}>{dash(h.studying)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 700, marginBottom: 4 }}>Secretaria diz</div>
                {canEdit ? secInput(h, 110) : <div style={{ fontSize: 24, fontWeight: 800, color: BRAND.ink, minHeight: 44, display: 'flex', alignItems: 'center' }}>{h.secretary_count ?? '–'}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 700 }}>Saíram no ano</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: h.left_school ? '#DC2626' : BRAND.faint }}>{dash(h.left_school)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 700 }}>Saíram no ano passado</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: h.prev_left ? BRAND.ink : BRAND.faint }}>{dash(h.prev_left)}</div>
              </div>
            </div>
          </div>
        )
      }) : (
        <div style={{ ...baseCard, padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ ...th, textAlign: 'left', paddingLeft: 18 }}>Série</th><th style={th}>Cursando no sistema</th><th style={th}>Secretaria diz</th>
                <th style={th}>Diferença</th><th style={th}>Saíram no ano</th><th style={{ ...th, paddingRight: 18 }}>Saíram no ano passado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(h => {
                const d = diffOf(h)
                return (
                  <tr key={h.grade_level_id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700, paddingLeft: 18 }}>{h.grade_name}</td>
                    <td style={td}>{h.studying || '–'}</td>
                    <td style={td}>{canEdit ? secInput(h, 72) : (h.secretary_count ?? '–')}</td>
                    <td style={{ ...td, fontWeight: 800, color: diffColor(d) }}>{diffText(d)}</td>
                    <td style={td}>{h.left_school || '–'}</td>
                    <td style={{ ...td, paddingRight: 18 }}>{h.prev_left || '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
