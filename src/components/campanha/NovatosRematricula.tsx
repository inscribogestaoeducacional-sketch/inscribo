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
const btnS: React.CSSProperties = { marginTop: 10, padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }
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
      {grades.length > 0 && (() => {
        const tot = grades.reduce((x, g) => x + g.new_students, 0), mx = Math.max(...grades.map(g => g.new_students))
        return (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Novatos por série</div>
              <div style={{ fontSize: 12.5, color: BRAND.muted }}>{tot} novatos no total</div>
            </div>
            {grades.map(g => (
              <div key={g.grade_id} title={`${g.name}: ${g.new_students} novatos (${Math.round(g.new_students / tot * 100)}% do total)`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13 }}>
                <span style={{ width: 150, color: BRAND.text, flexShrink: 0 }}>{g.name}</span>
                <div style={{ flex: 1, height: 14, borderRadius: 7, background: '#F3F0FF', overflow: 'hidden' }}><div style={{ width: `${g.new_students / mx * 100}%`, height: '100%', background: 'linear-gradient(90deg,#8B5CF6,#7C3AED)', borderRadius: 7, transition: 'width .9s cubic-bezier(.2,.8,.2,1)' }} /></div>
                <b style={{ width: 28, textAlign: 'right', color: '#6D28D9' }}>{g.new_students}</b>
                <span style={{ width: 40, textAlign: 'right', color: '#94A3B8', fontSize: 12 }}>{Math.round(g.new_students / tot * 100)}%</span>
              </div>
            ))}
          </div>
        )
      })()}
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
        <div style={{ ...card, flex: '1 1 320px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 2 }}>Por série: já voltaram × faltam</div>
          <div style={{ fontSize: 12, color: BRAND.muted, marginBottom: 8 }}>Verde: matriculados ou pré. Cinza: ainda sem resposta.</div>
          {(hist?.by_grade ?? []).filter(g => g.base > 0).map(g => {
            const r = g.retained / g.base, low = r < 0.5
            return (
              <div key={g.grade_id} title={`${g.name}: ${g.retained} de ${g.base} garantidos, faltam ${g.lost}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5 }}>
                <span style={{ width: 118, flexShrink: 0 }}>{g.name}</span>
                <div style={{ flex: 1, height: 12, borderRadius: 6, background: '#E5E7EB', overflow: 'hidden' }}><div style={{ width: `${r * 100}%`, height: '100%', background: low ? '#F59E0B' : '#10B981', transition: 'width .9s cubic-bezier(.2,.8,.2,1)' }} /></div>
                <b style={{ width: 70, textAlign: 'right' }}>{g.retained}/{g.base}</b>
                <span style={{ width: 34, textAlign: 'right', color: low ? '#B45309' : '#15803D', fontWeight: 700 }}>{Math.round(r * 100)}%</span>
              </div>
            )
          })}
          {!(hist?.by_grade ?? []).some(g => g.base > 0) && <div style={{ fontSize: 13, color: BRAND.muted }}>Sem dados por série ainda.</div>}
        </div>
      </div>
    </div>
  )
}
