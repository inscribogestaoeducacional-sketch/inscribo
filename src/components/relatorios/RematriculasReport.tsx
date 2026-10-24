// Relatório de rematrículas por ano letivo e série (mesmos números da Campanha de Matrículas).
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, Kpi, KpiGrid, card, downloadCsv, logAudit, td, th, useAnalise, usePeriod } from './shared'

interface G { grade_name: string; sort_order: number; is_terminal: boolean; base_prev_year: number; reenrolled: number; pending: number; left_school: number; new_students: number; graduates: number; capacity: number | null; pre_enrolled: number }

export default function RematriculasReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const y0 = new Date().getFullYear()
  const [year, setYear] = useState(y0 + 1)
  const [rows, setRows] = useState<G[] | null>(null); const [err, setErr] = useState('')
  const ai = useAnalise('rematriculas', 'Rematrículas', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setRows(null); setErr('')
    supabase.rpc('base_reenrollment_panel', { p_institution_id: institutionId, p_target_year: year }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setRows((data ?? []) as G[]) })
    return () => { alive = false }
  }, [institutionId, year])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err.includes('módulo') || err.includes('module') ? 'A Base de alunos não está ativa nesta escola, por isso não há dados de rematrícula.' : err}</div>
  const sum = (f: (g: G) => number) => (rows ?? []).reduce((a, g) => a + f(g), 0)
  const base = sum(g => g.base_prev_year), grad = sum(g => g.graduates), rema = sum(g => g.reenrolled), pend = sum(g => g.pending), pre = sum(g => g.pre_enrolled), saiu = sum(g => g.left_school), novos = sum(g => g.new_students)
  const elegiveis = Math.max(0, base - grad)
  const pct = (a: number, b: number) => b ? `${Math.round(a / b * 100)}%` : '—'
  const linhas = (rows ?? []).map(g => ({ 'Ano letivo': year, 'Série': g.grade_name, 'Alunos no ano anterior': g.base_prev_year, 'Concluintes': g.graduates, 'Rematriculados': g.reenrolled, 'Pré-matriculados': g.pre_enrolled, 'A rematricular': g.pending, 'Saíram': g.left_school, 'Alunos novos': g.new_students, 'Capacidade': g.capacity, 'Taxa de rematrícula (%)': g.base_prev_year - g.graduates > 0 ? Math.round(g.reenrolled / (g.base_prev_year - g.graduates) * 100) : null }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 700 }}>Ano letivo <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ marginLeft: 4, padding: '7px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontFamily: 'inherit', fontWeight: 700 }}>{[y0 - 1, y0, y0 + 1, y0 + 2].map(y => <option key={y} value={y}>{y}</option>)}</select></label>
        <ActionBar onCsv={() => { downloadCsv(`rematriculas-${year}.csv`, linhas); logAudit(institutionId, 'rematriculas', 'csv', `${year}-01-01`, `${year}-12-31`, linhas.length) }} csvDisabled={!rows || !rows.length}
          onAi={() => rows && ai.run({ ano_letivo: year, alunos_no_ano_anterior: base, concluintes: grad, elegiveis_para_rematricular: elegiveis, rematriculados: rema, pre_matriculados: pre, a_rematricular: pend, saiu: saiu, alunos_novos: novos, taxa_rematricula_pct: elegiveis ? Math.round(rema / elegiveis * 100) : null, por_serie: linhas })} aiBusy={ai.busy} />
      </div>
      {!rows ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel busy={ai.busy} rep={ai.rep} err={ai.err} title="Rematrículas" periodLabel={`Ano letivo ${year}`} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="ALUNOS A REMATRICULAR" value={elegiveis} color="#6366F1" sub={`${base} no ano anterior, ${grad} concluintes`} />
            <Kpi label="REMATRICULADOS" value={rema} color="#05907B" sub={`${pct(rema, elegiveis)} dos elegíveis`} />
            <Kpi label="PRÉ-MATRICULADOS" value={pre} color="#0EA5E9" sub="aguardando confirmação" />
            <Kpi label="A REMATRICULAR" value={pend} color="#F59E0B" sub="ainda sem resposta" />
            <Kpi label="SAÍRAM" value={saiu} color="#EF4444" sub={`${novos} alunos novos`} />
          </KpiGrid>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '2 1 520px', overflowX: 'auto' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por série</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Série</th><th style={{ ...th, textAlign: 'right' }}>Ano anterior</th><th style={{ ...th, textAlign: 'right' }}>Rematriculados</th><th style={{ ...th, textAlign: 'right' }}>Pré-matr.</th><th style={{ ...th, textAlign: 'right' }}>A rematricular</th><th style={{ ...th, textAlign: 'right' }}>Saíram</th><th style={{ ...th, textAlign: 'right' }}>Novos</th><th style={{ ...th, textAlign: 'right' }}>Taxa</th></tr></thead>
                <tbody>{(rows ?? []).map(g => { const el = g.base_prev_year - g.graduates; return <tr key={g.grade_name}><td style={{ ...td, fontWeight: 700 }}>{g.grade_name}</td><td style={{ ...td, textAlign: 'right' }}>{g.base_prev_year}</td><td style={{ ...td, textAlign: 'right' }}>{g.reenrolled}</td><td style={{ ...td, textAlign: 'right' }}>{g.pre_enrolled}</td><td style={{ ...td, textAlign: 'right' }}>{g.pending}</td><td style={{ ...td, textAlign: 'right' }}>{g.left_school}</td><td style={{ ...td, textAlign: 'right' }}>{g.new_students}</td><td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{el > 0 ? `${Math.round(g.reenrolled / el * 100)}%` : '—'}</td></tr> })}</tbody></table>
            </div>
            <div style={{ ...card, flex: '1 1 280px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Rematriculados por série</div><BarList color="#05907B" rows={(rows ?? []).filter(g => g.reenrolled > 0).map(g => ({ label: g.grade_name, n: g.reenrolled }))} /></div>
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>Mesmos números do painel de rematrícula da Campanha de Matrículas, vindos da Base de alunos. Taxa = rematriculados ÷ (alunos do ano anterior − concluintes). Este módulo não usa o filtro de período: ele é por ano letivo.</div>
        </>
      )}
    </div>
  )
}
