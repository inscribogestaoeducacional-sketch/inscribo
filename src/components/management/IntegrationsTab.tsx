// src/components/management/IntegrationsTab.tsx
//
// Fase 2 · marco 1 — Configurações → Integrações. É o MESMO fluxo para todas as
// escolas (piloto incluso), sem script nem código por escola:
//   0. Relatório de alunos por planilha (RosterUploadCard; prévia antes de gravar);
//   1. Lançamento manual por série (funciona já no marco 1);
//   2. Activesoft: guardar o token (vai pro Vault; aqui só aparecem os 4 últimos
//      dígitos). Testar conexão, mapear unidades/cursos/turmas e a primeira
//      carga só contando chegam no marco 2 (adaptador);
//   3. Fonte da base e rematrícula (ano-alvo e abertura).
// Toda escrita passa por funções do banco (base_save_aggregate,
// erp_connection_save_token, erp_connection_remove, base_save_settings);
// o navegador não insere direto em nenhuma tabela da base.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Database, KeyRound, Plug, Save, Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useGradeLevels } from '../../hooks/useGradeLevels'
import { canSeeSettingsItem } from '../../lib/settingsAccess'
import RosterUploadCard from './RosterUploadCard'

type Toast = (msg: string, ok?: boolean) => void

const card: CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }
const h3: CSSProperties = { fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }
const hint: CSSProperties = { fontSize: 13, color: '#64748B', margin: '0 0 16px', lineHeight: 1.6 }
const input: CSSProperties = { padding: '8px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', color: '#1A2B4A', boxSizing: 'border-box' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost: CSSProperties = { ...btn, background: '#F1F5F9', color: '#94A3B8', cursor: 'not-allowed' }

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

export default function IntegrationsTab({ institutionId, onToast }: { institutionId: string; onToast: Toast }) {
  const { user } = useAuth()
  const role = user?.role
  const [installed, setInstalled] = useState<boolean | null>(null)

  // Confere se a migration da base já foi aplicada neste ambiente.
  useEffect(() => {
    let alive = true
    supabase.from('student_base_settings').select('institution_id').eq('institution_id', institutionId).maybeSingle()
      .then(({ error }) => { if (alive) setInstalled(!isMissingTable(error)) })
    return () => { alive = false }
  }, [institutionId])

  if (installed === null) return <div style={card}><Loader2 size={18} className="animate-spin" /></div>
  if (!installed) {
    return (
      <div style={{ ...card, maxWidth: 640 }}>
        <h3 style={h3}><Plug size={16} color="#00A896" /> Integrações</h3>
        <p style={hint}>A base de alunos ainda não foi instalada neste ambiente. Esta tela passa a funcionar depois que a atualização do banco for aplicada.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {canSeeSettingsItem('integracoes.planilha', role) && <RosterUploadCard institutionId={institutionId} onToast={onToast} />}
      {canSeeSettingsItem('integracoes.manual', role) && <ManualAggregateCard institutionId={institutionId} onToast={onToast} />}
      {canSeeSettingsItem('integracoes.activesoft', role) && <ActivesoftCard institutionId={institutionId} onToast={onToast} />}
      {canSeeSettingsItem('integracoes.config', role) && <BaseSettingsCard institutionId={institutionId} onToast={onToast} />}
    </div>
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

// ── 2. Activesoft ───────────────────────────────────────────────────────────
interface ErpConn { status: string; token_last4: string | null; token_expires_at: string | null; last_success_at: string | null; last_error: string | null }

function ActivesoftCard({ institutionId, onToast }: { institutionId: string; onToast: Toast }) {
  const [conn, setConn] = useState<ErpConn | null>(null)
  const [token, setToken] = useState('')
  const [expires, setExpires] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    // Só colunas liberadas ao navegador (o id do segredo nunca vem)
    const { data } = await supabase.from('erp_connections')
      .select('status, token_last4, token_expires_at, last_success_at, last_error')
      .eq('institution_id', institutionId).eq('provider', 'activesoft').maybeSingle()
    setConn((data as ErpConn | null) ?? null)
  }, [institutionId])
  useEffect(() => { load() }, [load])

  const saveToken = async () => {
    if (token.trim().length < 8) { onToast('Cole o token completo gerado no Activesoft.', false); return }
    setSaving(true)
    const { error } = await supabase.rpc('erp_connection_save_token', {
      p_institution_id: institutionId, p_provider: 'activesoft', p_token: token.trim(), p_expires_at: expires || null,
    })
    setSaving(false)
    setToken('')   // o token não fica na tela nem em memória depois de enviado
    if (error) { onToast('Não foi possível guardar o token: ' + error.message, false); return }
    onToast('Token guardado com segurança.')
    load()
  }

  const remove = async () => {
    if (!confirm('Desconectar o Activesoft? O token é apagado. Os dados já carregados ficam congelados.')) return
    const { error } = await supabase.rpc('erp_connection_remove', { p_institution_id: institutionId, p_provider: 'activesoft' })
    if (error) { onToast('Não foi possível desconectar: ' + error.message, false); return }
    onToast('Activesoft desconectado.')
    load()
  }

  const hasToken = !!conn?.token_last4
  const STATUS: Record<string, string> = { ativa: 'Conectada', pausada: 'Token guardado · aguardando teste', token_invalido: 'Token recusado pelo Activesoft', desconectada: 'Desconectada' }

  return (
    <div style={card}>
      <h3 style={h3}><KeyRound size={16} color="#00A896" /> Activesoft (SIGA)</h3>
      <p style={hint}>
        A Áion só <strong>lê</strong> do Activesoft: unidades, cursos, turmas, enturmações, alunos, responsáveis e vínculos.
        Nunca notas, boletim, frequência, ocorrências ou financeiro, e nunca grava nada lá.
      </p>
      <div style={{ fontSize: 13, color: '#1A2B4A', marginBottom: 14 }}>
        Situação: <strong>{STATUS[conn?.status ?? 'desconectada'] ?? conn?.status}</strong>
        {hasToken && <> · token terminado em <strong>{conn!.token_last4}</strong></>}
        {conn?.token_expires_at && <> · vale até {conn.token_expires_at.split('-').reverse().join('/')}</>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, flex: '1 1 260px' }}>{hasToken ? 'Trocar o token' : 'Token de acesso'}<br />
          <input type="password" autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)}
            placeholder="Cole aqui o token gerado no Activesoft" style={{ ...input, width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Validade (opcional)<br />
          <input type="date" value={expires} onChange={e => setExpires(e.target.value)} style={{ ...input, marginTop: 4 }} />
        </label>
        <button onClick={saveToken} disabled={saving || !token} style={saving || !token ? { ...btn, opacity: 0.6 } : btn}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar token
        </button>
        {hasToken && (
          <button onClick={remove} style={{ ...btn, background: '#FEF2F2', color: '#DC2626' }}><Trash2 size={14} /> Desconectar</button>
        )}
      </div>
      <p style={{ fontSize: 11, color: '#94A3B8', margin: '8px 0 16px' }}>
        O token vai direto para o cofre de segredos e não aparece de novo: aqui ficam só os 4 últimos caracteres.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
        {['Testar conexão', 'Mapear unidades, cursos e turmas', 'Primeira carga (só contagem, nada é gravado)'].map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 2}</span>
            <button disabled style={btnGhost} title="Disponível na próxima etapa (adaptador do Activesoft)">{label}</button>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>em breve</span>
          </div>
        ))}
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
      <h3 style={h3}><Database size={16} color="#00A896" /> Fonte da base e rematrícula</h3>
      <p style={hint}>Uma fonte por ano letivo: fontes não se somam (somar contaria o mesmo aluno duas vezes).</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Fonte principal<br />
          <select value={source} onChange={e => setSource(e.target.value)} style={{ ...input, width: '100%', marginTop: 4 }}>
            <option value="nenhuma">Ainda não definida</option>
            <option value="manual">Lançamento manual</option>
            <option value="planilha">Planilha</option>
            <option value="activesoft">Activesoft</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>ERP que a escola usa<br />
          <input value={erp} onChange={e => setErp(e.target.value)} placeholder="Ex.: Activesoft, Sophia…" style={{ ...input, width: '100%', marginTop: 4 }} />
        </label>
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
