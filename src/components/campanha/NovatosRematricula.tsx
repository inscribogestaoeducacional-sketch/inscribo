// Abas "Novatos" e "Rematrícula" da Campanha: meta × feito mês a mês, o que falta para chegar lá e atalhos para agir.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { funnelNeeds, monthName, type FunnelRates, type HistYear, type PlanMonth } from '../../lib/campaignPlan'

interface Common {
  goal: number; done: number; months: PlanMonth[]; hist: HistYear | null
}
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: '18px 20px' }
const th: React.CSSProperties = { fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', padding: '8px', textAlign: 'right', fontWeight: 700 }
const td: React.CSSProperties = { padding: '8px', textAlign: 'right', fontSize: 13, borderTop: '1px solid #EEF2F1' }
const btnS: React.CSSProperties = { marginTop: 10, padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#065F52,#00A896)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }
const bar = (p: number, c: string) => <div style={{ height: 12, borderRadius: 99, background: '#EDF1F0', overflow: 'hidden', marginTop: 10 }}><div style={{ width: `${Math.min(100, p * 100)}%`, height: '100%', background: c, borderRadius: 99 }} /></div>
const big = (n: number, of: number, c: string) => <div style={{ fontSize: 32, fontWeight: 800, color: c, lineHeight: 1 }}>{n} <span style={{ fontSize: 15, color: '#94A3B8', fontWeight: 600 }}>de {of}</span></div>
const lab = (t: string) => <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>{t}</div>

const actual = (hist: HistYear | null, m: string, k: 'novos' | 'rematriculas') => hist?.monthly.find(x => x.m === m)?.[k] ?? 0
const status = (feito: number, meta: number, past: boolean) => {
  if (!meta) return null
  const p = feito / meta
  return <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: p >= 1 ? '#DCFCE7' : past ? '#FEE2E2' : '#FEF3C7', color: p >= 1 ? '#15803D' : past ? '#B91C1C' : '#B45309' }}>{Math.round(p * 100)}%</span>
}
const thisMonth = new Date().toISOString().slice(0, 7)

export function NovatosTab({ institutionId, from, to, rates, goal, done, months, hist }: Common & { institutionId: string; from: string; to: string; rates: FunnelRates }) {
  const [fun, setFun] = useState<{ months: { m: string; entraram: number; etapas: Record<string, { n: number }> }[] } | null>(null)
  useEffect(() => {
    supabase.rpc('campaign_funnel', { p_inst: institutionId, p_from: from, p_to: to, p_source: null, p_grade: null, p_assigned: null })
      .then(({ data }) => setFun(data as typeof fun))
  }, [institutionId, from, to])
  const totalNeeds = funnelNeeds(Math.max(0, goal - done), rates)
  const leadsIn = (m: string) => fun?.months.find(x => x.m === m)?.entraram ?? 0
  const visits = (m: string) => fun?.months.find(x => x.m === m)?.etapas.visit?.n ?? 0
  const grades = (hist?.by_grade ?? []).filter(g => g.new_students > 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1 1 260px' }}>{lab('META DE NOVATOS')}{big(done, goal, '#7C3AED')}{bar(goal ? done / goal : 0, '#7C3AED')}
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>{goal ? Math.round(done / goal * 100) : 0}% · faltam {Math.max(0, goal - done)}</div></div>
        <div style={{ ...card, flex: '1 1 260px' }}>{lab('PARA FECHAR A META AINDA PRECISAM')}
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{totalNeeds.registrations} <span style={{ fontSize: 15, color: '#94A3B8', fontWeight: 600 }}>leads</span></div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>{totalNeeds.schedules} agendamentos · {totalNeeds.visits} visitas, nas taxas do plano</div></div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>Mês a mês: novatos e o funil necessário</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Mês</th><th style={th}>Meta</th><th style={th}>Feito</th><th style={th} /><th style={th}>Leads necessários</th><th style={th}>Leads reais</th><th style={th}>Visitas necessárias</th><th style={th}>Visitas reais</th></tr></thead>
            <tbody>
              {months.map(r => {
                const f = funnelNeeds(r.novos, rates), feito = actual(hist, r.m, 'novos')
                return (
                  <tr key={r.m}><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{monthName(r.m + '-01')}</td><td style={td}>{r.novos}</td><td style={td}>{feito}</td>
                    <td style={td}>{status(feito, r.novos, r.m < thisMonth)}</td><td style={td}>{f.registrations}</td><td style={td}>{r.m <= thisMonth ? leadsIn(r.m) : '—'}</td>
                    <td style={td}>{f.visits}</td><td style={td}>{r.m <= thisMonth ? visits(r.m) : '—'}</td></tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: BRAND.muted, margin: '10px 0 0' }}>Metas do mês e taxas do funil são editáveis em “Configuração da campanha”. Leads e visitas reais vêm do funil.</p>
      </div>
      {grades.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Novatos por série</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {grades.map(g => <span key={g.grade_id} style={{ background: '#F5F3FF', color: '#6D28D9', borderRadius: 99, padding: '4px 12px', fontSize: 12.5, fontWeight: 700 }}>{g.name}: {g.new_students}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

export function RematriculaTab({ goal, done, months, hist, pre, pending, bySegment }: Common & { pre: number; pending: number; bySegment: { name: string; pending: number }[] }) {
  const navigate = useNavigate()
  const go = (relations: string[]) => navigate('/transmissoes', { state: { relations } })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1 1 260px' }}>{lab('META DE REMATRÍCULA')}{big(done, goal, '#059669')}{bar(goal ? done / goal : 0, '#059669')}
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>{goal ? Math.round(done / goal * 100) : 0}% · faltam {Math.max(0, goal - done)}</div></div>
        <div style={{ ...card, flex: '1 1 220px' }}>{lab('PRÉ-MATRICULADOS')}<div style={{ fontSize: 32, fontWeight: 800, color: '#7C3AED', lineHeight: 1 }}>{pre}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>reservaram a vaga, falta efetivar</div>
          <button style={btnS} onClick={() => go(['pre_matriculado'])}>Levar para Transmissões</button></div>
        <div style={{ ...card, flex: '1 1 220px' }}>{lab('SEM REMATRÍCULA NEM PRÉ')}<div style={{ fontSize: 32, fontWeight: 800, color: '#D97706', lineHeight: 1 }}>{pending}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>alunos que ainda não responderam</div>
          <button style={btnS} onClick={() => go(['pendente'])}>Levar para Transmissões</button></div>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '2 1 420px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>Mês a mês: rematrículas meta × feito</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Mês</th><th style={th}>Meta</th><th style={th}>Feito</th><th style={th} /></tr></thead>
            <tbody>{months.map(r => { const feito = actual(hist, r.m, 'rematriculas'); return (
              <tr key={r.m}><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{monthName(r.m + '-01')}</td><td style={td}>{r.rematriculas}</td><td style={td}>{feito}</td><td style={td}>{status(feito, r.rematriculas, r.m < thisMonth)}</td></tr>) })}</tbody>
          </table>
          <p style={{ fontSize: 12, color: BRAND.muted, margin: '10px 0 0' }}>Entram só os alunos com data de matrícula informada.</p>
        </div>
        <div style={{ ...card, flex: '1 1 260px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>Quem falta, por série</div>
          {bySegment.filter(x => x.pending > 0).map(x => (
            <div key={x.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderTop: '1px solid #EEF2F1' }}><span>{x.name}</span><b>{x.pending}</b></div>
          ))}
          {!bySegment.some(x => x.pending > 0) && <div style={{ fontSize: 13, color: BRAND.muted }}>Ninguém pendente.</div>}
        </div>
      </div>
    </div>
  )
}
