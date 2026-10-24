// Relatório de usuários: quem tem acesso, perfil, último acesso e o que cada um fez no período.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, td, th, useAnalise, usePeriod } from './shared'

interface U { nome: string; perfil: string | null; ativo: boolean; ultimo_acesso: string | null; leads_no_periodo: number; leads_em_aberto: number; conversas: number; mensagens: number; matriculas: number; visitas: number }
interface D { total: number; ativos: number; sem_acesso_30d: number; por_perfil: { perfil: string; n: number }[]; usuarios: U[]; linhas: Record<string, string | number | null>[] }
const PERFIL: Record<string, string> = { admin: 'Administrador', manager: 'Gestor', user: 'Atendente', 'sem perfil': 'Sem perfil' }

export default function UsuariosReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  const ai = useAnalise('usuarios', 'Usuários', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_usuarios', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  const nr = (n: number) => n.toLocaleString('pt-BR')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={() => { if (!d) return; downloadCsv(`usuarios-${per.from}-${per.to}.csv`, d.linhas); logAudit(institutionId, 'usuarios', 'csv', per.from, per.to, d.linhas.length) }} csvDisabled={!d || !d.linhas.length}
          onAi={() => d && ai.run({ usuarios_total: d.total, ativos: d.ativos, ativos_sem_acesso_ha_30_dias: d.sem_acesso_30d, por_perfil: d.por_perfil, atividade_por_usuario: d.usuarios })} aiBusy={ai.busy} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel busy={ai.busy} rep={ai.rep} err={ai.err} title="Usuários" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="USUÁRIOS" value={d.total} color="#6366F1" sub={`${d.ativos} ativos`} />
            <Kpi label="SEM ACESSO HÁ 30 DIAS" value={d.sem_acesso_30d} color={d.sem_acesso_30d ? '#B45309' : '#05907B'} sub="entre os ativos" />
          </KpiGrid>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '2 1 520px', overflowX: 'auto' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Atividade no período</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Usuário</th><th style={th}>Perfil</th><th style={th}>Último acesso</th><th style={{ ...th, textAlign: 'right' }}>Conversas</th><th style={{ ...th, textAlign: 'right' }}>Mensagens</th><th style={{ ...th, textAlign: 'right' }}>Leads novos</th><th style={{ ...th, textAlign: 'right' }}>Leads em aberto</th><th style={{ ...th, textAlign: 'right' }}>Visitas</th><th style={{ ...th, textAlign: 'right' }}>Matrículas</th></tr></thead>
                <tbody>{d.usuarios.map(u => <tr key={u.nome} style={{ opacity: u.ativo ? 1 : 0.5 }}><td style={{ ...td, fontWeight: 700 }}>{u.nome}{!u.ativo && ' (inativo)'}</td><td style={td}>{PERFIL[u.perfil ?? 'sem perfil'] ?? u.perfil}</td><td style={{ ...td, color: '#64748B' }}>{u.ultimo_acesso ?? 'nunca'}</td><td style={{ ...td, textAlign: 'right' }}>{nr(u.conversas)}</td><td style={{ ...td, textAlign: 'right' }}>{nr(u.mensagens)}</td><td style={{ ...td, textAlign: 'right' }}>{u.leads_no_periodo}</td><td style={{ ...td, textAlign: 'right' }}>{u.leads_em_aberto}</td><td style={{ ...td, textAlign: 'right' }}>{u.visitas}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{u.matriculas}</td></tr>)}</tbody></table>
            </div>
            <div style={{ ...card, flex: '1 1 240px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por perfil (ativos)</div><BarList color="#6366F1" rows={d.por_perfil.map(p => ({ label: PERFIL[p.perfil] ?? p.perfil, n: p.n }))} /></div>
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>O CSV traz nome, e-mail, telefone, perfil, situação, último acesso e a atividade de cada pessoa no período. Quem aparece com o nome escrito de duas formas no cadastro tem os números divididos; unifique no cadastro de usuários.</div>
        </>
      )}
    </div>
  )
}
