// src/components/management/IntegrationsTab.tsx
//
// Configurações → Integrações (Etapa C). Mesmo fluxo para toda escola, sem
// script nem código por escola. A página pergunta "De onde vêm os dados dos
// alunos?" e abre só o card da fonte escolhida, com estado (ativa / não
// configurada / em breve):
//   * Sistema da escola (Activesoft) — ActivesoftWizard (só admin);
//   * Planilha ou relatório — RosterUploadCard (admin e gestor);
//   * Lançamento manual — ManualAggregateCard (admin e gestor).
// Planilha e Activesoft só com o módulo "Base de alunos" liberado pela Áion.
// Sem WhatsApp nem Meta aqui: o WhatsApp tem a área dele nas Configurações e
// os anúncios da Meta ficam no grupo de Campanha. Um único campo de seleção.
// Toda escrita passa por funções do banco; o navegador não insere direto em
// nenhuma tabela da base.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Database, Save, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useGradeLevels } from '../../hooks/useGradeLevels'
import { canSeeSettingsItem } from '../../lib/settingsAccess'
import { BRAND, GRAD, SHADOW } from '../../lib/brand'
import { Plug as PlugIcon, FileSpreadsheet, PencilLine, SlidersHorizontal } from 'lucide-react'
import HubSettings, { type HubGroup } from './settings/HubSettings'
import { NowNote, WarnNote, Card, Title } from './settings/ui'
import RosterUploadCard from './RosterUploadCard'
import ActivesoftWizard from './ActivesoftWizard'
import { useBaseModuleEnabled } from '../../lib/baseModule'

type Toast = (msg: string, ok?: boolean) => void

const card: CSSProperties = { background: '#fff', borderRadius: 18, border: `1px solid ${BRAND.line}`, padding: 20, boxShadow: SHADOW }
const h3: CSSProperties = { fontSize: 15, fontWeight: 800, color: BRAND.ink, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }
const hint: CSSProperties = { fontSize: 12.5, color: BRAND.muted, margin: '0 0 16px', lineHeight: 1.5 }
const input: CSSProperties = { padding: '9px 12px', borderRadius: 12, border: `1px solid ${BRAND.line}`, fontSize: 14, outline: 'none', color: BRAND.ink, boxSizing: 'border-box', background: '#fff', fontFamily: 'inherit' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }

// Colunas do lançamento manual (desenho §4)
const METRICS = [
  { key: 'enrolled_total',    label: 'Matriculados no ano' },
  { key: 'reenrolled',        label: 'Rematriculados p/ o próximo' },
  { key: 'prematricula',      label: 'Em pré-matrícula' },
  { key: 'new_students',      label: 'Novatos' },
  { key: 'exits_during_year', label: 'Saídas no ano' },
  { key: 'not_renewing',      label: 'Não renovarão' },
  { key: 'graduates',         label: 'Concluintes' },
  { key: 'capacity',          label: 'Vagas' },
] as const
type MetricKey = typeof METRICS[number]['key']
type Row = Partial<Record<MetricKey, string>>

const todayBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(err.message || ''))
}

type SourceKey = 'activesoft' | 'planilha' | 'manual'
type SourceState = 'ativa' | 'nao_configurada' | 'em_breve'
const STATE_BADGE: Record<SourceState, { label: string; color: string; bg: string }> = {
  ativa:           { label: 'ativa',           color: '#047857', bg: '#ECFDF5' },
  nao_configurada: { label: 'não configurada', color: '#92400E', bg: '#FEF3C7' },
  em_breve:        { label: 'em breve',        color: '#64748B', bg: '#F1F5F9' },
}

export default function IntegrationsTab({ institutionId, onToast, section, onSectionChange, isMobile }: { institutionId: string; onToast: Toast; section?: string | null; onSectionChange?: (s: string) => void; isMobile?: boolean }) {
  const { user } = useAuth()
  const role = user?.role
  const [installed, setInstalled] = useState<boolean | null>(null)
  const baseModule = useBaseModuleEnabled(institutionId)
  const [states, setStates] = useState<Record<SourceKey, SourceState> | null>(null)
  const [primary, setPrimary] = useState<string | null>(null)

  // Confere se a migration da base já foi aplicada neste ambiente.
  useEffect(() => {
    let alive = true
    supabase.from('student_base_settings').select('institution_id').eq('institution_id', institutionId).maybeSingle()
      .then(({ error }) => { if (alive) setInstalled(!isMissingTable(error)) })
    return () => { alive = false }
  }, [institutionId])

  // Estado de cada fonte (ativa / não configurada / em breve)
  useEffect(() => {
    if (!installed || baseModule === null) return
    let alive = true
    Promise.all([
      supabase.from('erp_connections').select('status').eq('institution_id', institutionId).eq('provider', 'activesoft').maybeSingle(),
      supabase.from('sync_runs').select('id', { count: 'exact', head: true }).eq('institution_id', institutionId).eq('source', 'planilha').in('status', ['ok', 'ok_com_avisos']),
      supabase.from('class_aggregates').select('id', { count: 'exact', head: true }).eq('institution_id', institutionId),
      supabase.from('student_base_settings').select('primary_source').eq('institution_id', institutionId).maybeSingle(),
    ]).then(([erp, pl, ag, st]) => {
      if (!alive) return
      setStates({
        activesoft: !baseModule ? 'em_breve' : (erp.data as { status?: string } | null)?.status === 'ativa' ? 'ativa' : 'nao_configurada',
        planilha:   !baseModule ? 'em_breve' : (pl.count ?? 0) > 0 ? 'ativa' : 'nao_configurada',
        manual:     (ag.count ?? 0) > 0 ? 'ativa' : 'nao_configurada',
      })
      setPrimary((st.data as { primary_source?: string } | null)?.primary_source ?? null)
    })
    return () => { alive = false }
  }, [installed, baseModule, institutionId])

  if (installed === null) return <div style={card}><Loader2 size={18} className="animate-spin" /></div>
  if (!installed) {
    return (
      <div style={{ ...card, maxWidth: 640 }}>
        <h3 style={h3}><Database size={16} color="#00A896" /> Dados dos alunos</h3>
        <p style={hint}>A base de alunos ainda não foi instalada neste ambiente. Esta tela passa a funcionar depois que a atualização do banco for aplicada.</p>
      </div>
    )
  }

  const STATE_TXT: Record<SourceState, string> = { ativa: 'Ativa', nao_configurada: 'Não configurada', em_breve: 'Em breve' }
  const lead = (k: SourceKey, text: string) => `${states ? STATE_TXT[states[k]] : '…'}${primary === k ? ' · fonte principal' : ''}. ${text}`
  const soon = (k: SourceKey) => states?.[k] === 'em_breve'
  const soonNote = <WarnNote>Esta integração ainda não está liberada para a escola. Fale com a Áion para liberar.</WarnNote>

  const groups: HubGroup[] = [
    {
      title: 'De onde vêm os dados dos alunos', items: [
        { key: 'planilha', label: 'Planilha ou relatório', desc: lead('planilha', 'Envie o relatório de alunos do ano anterior e do ano atual.'), item: 'integracoes.planilha', Icon: FileSpreadsheet,
          render: () => soon('planilha') ? soonNote : <RosterUploadCard institutionId={institutionId} onToast={onToast} /> },
        { key: 'manual', label: 'Lançamento manual', desc: lead('manual', 'Digite os números de cada série, sem precisar de integração.'), item: 'integracoes.manual', Icon: PencilLine,
          render: () => <ManualAggregateCard institutionId={institutionId} onToast={onToast} /> },
        { key: 'activesoft', label: 'Sistema da escola (Activesoft)', desc: lead('activesoft', 'Lê cadastro, turmas e alunos direto do sistema da escola.'), item: 'integracoes.activesoft', Icon: PlugIcon,
          render: () => soon('activesoft') ? soonNote : (
            <Card>
              <Title Icon={PlugIcon} title="Sistema da escola (Activesoft)" help="Só leitura: cadastro, turmas, enturmação e alunos. Notas, frequência, ocorrências e financeiro nunca são lidos." />
              <ActivesoftWizard institutionId={institutionId} onToast={onToast} />
            </Card>
          ) },
      ],
    },
    {
      title: 'Ajustes', items: [
        { key: 'config', label: 'Ajustes da rematrícula', desc: 'Ano que está sendo rematriculado e data de abertura.', item: 'integracoes.config', Icon: SlidersHorizontal,
          render: () => <BaseSettingsCard institutionId={institutionId} onToast={onToast} /> },
      ],
    },
  ]

  return (
    <HubSettings rootLabel="Integrações" groups={groups} role={role} isMobile={isMobile} section={section} onSectionChange={onSectionChange}
      header={<NowNote>Uma fonte por ano letivo: as fontes não se somam (somar contaria o mesmo aluno duas vezes).</NowNote>} />
  )
}

// ── 1. Lançamento manual por série ──────────────────────────────────────────
function ManualAggregateCard({ institutionId, onToast }: { institutionId: string; onToast: Toast }) {
  const { gradeLevels, loading: loadingGrades } = useGradeLevels(institutionId)
  const thisYear = Number(todayBR().slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const [asOf, setAsOf] = useState(todayBR())
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [lastAsOf, setLastAsOf] = useState<string | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('v_base_year_grade_stats')
      .select('grade_level_id, class_id, level, as_of, enrolled_total, reenrolled, prematricula, new_students, exits_during_year, not_renewing, graduates, capacity')
      .eq('institution_id', institutionId).eq('academic_year', year)
    if (error) { console.error('[IntegrationsTab] v_base_year_grade_stats:', error); return }
    const next: Record<string, Row> = {}
    let last: string | null = null
    let lvl: string | null = null
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      lvl = (r.level as string) ?? lvl
      if (r.class_id || !r.grade_level_id) continue          // marco 1: série inteira
      const row: Row = {}
      for (const m of METRICS) row[m.key] = r[m.key] == null ? '' : String(r[m.key])
      next[r.grade_level_id as string] = row
      if (r.as_of && (!last || (r.as_of as string) > last)) last = r.as_of as string
    }
    setRows(next); setLastAsOf(last); setLevel(lvl)
  }, [institutionId, year])

  useEffect(() => { load() }, [load])

  const set = (gradeId: string, key: MetricKey, v: string) =>
    setRows(prev => ({ ...prev, [gradeId]: { ...prev[gradeId], [key]: v.replace(/\D/g, '').slice(0, 5) } }))

  // Checagem do desenho §4: rematriculados + pré + não renovarão + pendentes ≤ base (aviso, não bloqueio)
  const warnings = useMemo(() => gradeLevels.filter(g => {
    const r = rows[g.id] ?? {}
    const base = Number(r.enrolled_total || 0)
    const soma = Number(r.reenrolled || 0) + Number(r.prematricula || 0) + Number(r.not_renewing || 0)
    return base > 0 && soma > base
  }).map(g => g.name), [rows, gradeLevels])

  const save = async () => {
    if (level === 'aluno') { onToast('Este ano já tem base aluno a aluno; o lançamento manual não se soma a ela.', false); return }
    const payload = gradeLevels
      .filter(g => METRICS.some(m => (rows[g.id]?.[m.key] ?? '') !== ''))
      .map(g => {
        const o: Record<string, unknown> = { grade_level_id: g.id }
        for (const m of METRICS) { const v = rows[g.id]?.[m.key]; o[m.key] = v === '' || v == null ? null : Number(v) }
        return o
      })
    if (payload.length === 0) { onToast('Preencha ao menos uma série.', false); return }
    setSaving(true)
    const { error } = await supabase.rpc('base_save_aggregate', {
      p_institution_id: institutionId, p_academic_year: year, p_as_of: asOf, p_rows: payload, p_notes: null,
    })
    setSaving(false)
    if (error) { onToast('Não foi possível salvar: ' + error.message, false); return }
    onToast(`Números salvos (${payload.length} séries, retrato de ${asOf.split('-').reverse().join('/')}).`)
    load()
  }

  return (
    <div style={card}>
      <h3 style={h3}><Database size={16} color="#00A896" /> Lançamento manual por série</h3>
      <p style={hint}>
        Para quem ainda não tem integração: digite os números de cada série. Cada vez que salva, fica guardado um <strong>retrato</strong> com a data
        escolhida; atualizar toda semana já forma a curva de rematrícula. Corrigir um número grava um retrato novo (o anterior fica no histórico).
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Ano letivo<br />
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...input, marginTop: 4 }}>
            {[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Data do retrato<br />
          <input type="date" value={asOf} max={todayBR()} onChange={e => setAsOf(e.target.value)} style={{ ...input, marginTop: 4 }} />
        </label>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>
          {lastAsOf ? `Último retrato deste ano: ${lastAsOf.split('-').reverse().join('/')}` : 'Nenhum número lançado para este ano.'}
        </span>
      </div>
      {level === 'aluno' && (
        <p style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px' }}>
          Este ano já tem base aluno a aluno (integração ou planilha). Fontes não se somam: o lançamento manual fica desligado para ele.
        </p>
      )}
      {loadingGrades ? <Loader2 size={18} className="animate-spin" /> : gradeLevels.length === 0 ? (
        <p style={hint}>Cadastre as séries em <a href="/settings?tab=escola" style={{ color: '#00A896', fontWeight: 600 }}>Configurações → Escola → Séries</a> antes de lançar.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #F1F5F9', borderRadius: 12 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 860, width: '100%' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#475569' }}>Série</th>
                {METRICS.map(m => <th key={m.key} style={{ padding: '8px 6px', color: '#475569', fontWeight: 600, width: 92 }}>{m.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {gradeLevels.map(g => (
                <tr key={g.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 600, color: '#1A2B4A', whiteSpace: 'nowrap' }}>{g.name}</td>
                  {METRICS.map(m => (
                    <td key={m.key} style={{ padding: '4px 6px' }}>
                      <input inputMode="numeric" aria-label={`${g.name} — ${m.label}`} disabled={level === 'aluno'}
                        value={rows[g.id]?.[m.key] ?? ''} onChange={e => set(g.id, m.key, e.target.value)}
                        style={{ ...input, width: 80, textAlign: 'right', padding: '6px 8px' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {warnings.length > 0 && (
        <p style={{ fontSize: 12, color: '#B45309', margin: '10px 0 0', display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertTriangle size={13} /> Rematriculados + pré-matrícula + não renovarão passa dos matriculados em: {warnings.join(', ')}. Confira antes de salvar.
        </p>
      )}
      <div style={{ marginTop: 14 }}>
        <button onClick={save} disabled={saving || level === 'aluno' || gradeLevels.length === 0} style={saving ? { ...btn, opacity: 0.7 } : btn}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar números
        </button>
      </div>
    </div>
  )
}

// ── 3. Fonte da base e rematrícula ──────────────────────────────────────────
function BaseSettingsCard({ institutionId, onToast }: { institutionId: string; onToast: Toast }) {
  const thisYear = Number(todayBR().slice(0, 4))
  const [source, setSource] = useState('nenhuma')
  const [erp, setErp] = useState('')
  const [target, setTarget] = useState<number>(thisYear + 1)
  const [start, setStart] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('student_base_settings')
      .select('primary_source, declared_erp, reenrollment_target_year, reenrollment_window_start')
      .eq('institution_id', institutionId).maybeSingle()
      .then(({ data }) => {
        const d = data as { primary_source?: string; declared_erp?: string | null; reenrollment_target_year?: number | null; reenrollment_window_start?: string | null } | null
        if (!d) return
        setSource(d.primary_source ?? 'nenhuma'); setErp(d.declared_erp ?? '')
        if (d.reenrollment_target_year) setTarget(d.reenrollment_target_year)
        setStart(d.reenrollment_window_start ?? '')
      })
  }, [institutionId])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.rpc('base_save_settings', {
      p_institution_id: institutionId, p_primary_source: source, p_declared_erp: erp,
      p_reenrollment_target_year: target, p_reenrollment_window_start: start || null,
    })
    setSaving(false)
    if (error) { onToast('Não foi possível salvar: ' + error.message, false); return }
    onToast('Configuração da base salva.')
  }

  return (
    <div style={{ ...card, maxWidth: 640 }}>
      <h3 style={h3}><Database size={16} color="#00A896" /> Ajustes da rematrícula</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {/* fonte principal e ERP: escolhidos no campo "De onde vêm os dados dos alunos?" — aqui só se mantêm os valores gravados */}
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Ano sendo rematriculado<br />
          <input type="number" value={target} onChange={e => setTarget(Number(e.target.value))} style={{ ...input, width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Abertura da rematrícula<br />
          <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ ...input, width: '100%', marginTop: 4 }} />
        </label>
      </div>
      <p style={{ fontSize: 11, color: '#94A3B8', margin: '8px 0 14px' }}>A base de rematrícula é quem está ativo na data de abertura (decidido em 12/10).</p>
      <button onClick={save} disabled={saving} style={saving ? { ...btn, opacity: 0.7 } : btn}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
      </button>
    </div>
  )
}
