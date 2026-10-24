// src/components/management/RosterUploadCard.tsx
//
// Configurações → Integrações → "Enviar relatório de alunos". Mesmo fluxo para
// toda escola: lê o relatório (.csv/.xlsx ou texto colado), mostra a PRÉVIA
// calculada pelo banco (base_import_roster com p_dry_run = true, que não grava
// nada) e só grava depois da confirmação da escola. Reenviar o mesmo relatório
// atualiza pela matrícula, sem duplicar.
// LGPD: nomes só saem do navegador com a opção marcada (depois do aditivo assinado).
import { useEffect, useState, type CSSProperties } from 'react'
import { FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fileToMatrix, parseRoster, textToMatrix, type RosterParse } from '../../lib/rosterImport'

type Toast = (msg: string, ok?: boolean) => void

type Cross = {
  target_year: number; base_ano_anterior: number; rematriculados: number; rematriculados_declarados: number
  a_rematricular: number; concluintes: number; sairam: number; sairam_da_base: number; novatos: number
  retornos: number; faltam_total: number
}
type Summary = {
  linhas_lidas: number; alunos_novos_no_ano: number; atualizados: number; sem_mudanca: number; mudancas_de_situacao: number
  anos: number[]; ignoradas: { linha: number; motivo: string }[]; series_nao_reconhecidas: Record<string, number>
  situacoes_nao_reconhecidas: Record<string, number>; cpf_ignorado_sem_segredo: number; cruzamento: Cross[]; previa: boolean
}

const card: CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }
const h3: CSSProperties = { fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }
const hint: CSSProperties = { fontSize: 13, color: '#64748B', margin: '0 0 16px', lineHeight: 1.6 }
const input: CSSProperties = { padding: '8px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', color: '#1A2B4A', boxSizing: 'border-box' }
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', background: '#05907B', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSec: CSSProperties = { ...btn, background: '#F1F5F9', color: '#1A2B4A' }
const warnBox: CSSProperties = { fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', margin: '10px 0 0', lineHeight: 1.6 }

const thisYear = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 4))

export default function RosterUploadCard({ institutionId, onToast }: { institutionId: string; onToast: Toast }) {
  const [year, setYear] = useState(thisYear)
  const [mode, setMode] = useState<'arquivo' | 'colar'>('arquivo')
  const [file, setFile] = useState<File | null>(null)
  const [pasted, setPasted] = useState('')
  const [includeNames, setIncludeNames] = useState(false)
  // Nomes só com o aditivo LGPD registrado pela Áion (o banco também descarta sem ele)
  const [namesAllowed, setNamesAllowed] = useState(false)
  useEffect(() => {
    supabase.rpc('base_names_allowed', { p_institution_id: institutionId }).then(({ data }) => setNamesAllowed(data === true))
  }, [institutionId])
  const [parsed, setParsed] = useState<RosterParse | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState<'' | 'previa' | 'gravando'>('')
  const [error, setError] = useState('')

  const reset = () => { setParsed(null); setSummary(null); setConfirmed(false); setError('') }

  const call = (rows: RosterParse['rows'], dryRun: boolean) => supabase.rpc('base_import_roster', {
    p_institution_id: institutionId, p_default_year: year, p_rows: rows, p_dry_run: dryRun,
    p_file_name: mode === 'arquivo' ? file?.name ?? null : 'texto colado',
  })

  const preview = async () => {
    reset()
    setBusy('previa')
    try {
      const matrix = mode === 'arquivo'
        ? (file ? await fileToMatrix(file) : [])
        : textToMatrix(pasted)
      const p = parseRoster(matrix, { includeNames: includeNames && namesAllowed })
      if (p.rows.length === 0) {
        setError('Nenhum aluno encontrado. O relatório precisa ter as colunas Matrícula e Situação, e a série (no bloco "Segmento / Série / Ano / Turma" ou numa coluna).')
        return
      }
      setParsed(p)
      const { data, error: err } = await call(p.rows, true)
      if (err) { setError('Não foi possível calcular a prévia: ' + err.message); return }
      setSummary(data as Summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const commit = async () => {
    if (!parsed || !confirmed) return
    setBusy('gravando')
    const { data, error: err } = await call(parsed.rows, false)
    setBusy('')
    if (err) { onToast('Não foi possível gravar: ' + err.message, false); return }
    const s = data as Summary
    onToast(`Relatório gravado: ${s.alunos_novos_no_ano} novos no ano, ${s.atualizados} atualizados, ${s.sem_mudanca} sem mudança.`)
    setSummary({ ...s, previa: false })
    setConfirmed(false)
  }

  const crosses = (summary?.cruzamento ?? []).filter(c => c.base_ano_anterior > 0 || c.novatos > 0 || c.rematriculados > 0)
  const unkGrades = Object.entries(summary?.series_nao_reconhecidas ?? {})
  const unkStatus = Object.entries(summary?.situacoes_nao_reconhecidas ?? {})
  const skipped = (parsed?.skipped.length ?? 0) + (summary?.ignoradas.length ?? 0)

  return (
    <div style={card}>
      <h3 style={h3}><FileSpreadsheet size={16} color="#05907B" /> Enviar relatório de alunos</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 12px' }}>
        {['1 · Escolha o arquivo ou cole o texto', '2 · Confira o resumo', '3 · Grave'].map((t, i) => {
          const on = i === 0 ? !summary : i === 1 ? !!summary?.previa : !!summary && !summary.previa
          return <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
            background: on ? '#E6F7F5' : '#F1F5F9', color: on ? '#05907B' : '#94A3B8' }}>{t}</span>
        })}
      </div>
      <p style={hint}>
        Envie a relação de alunos exportada do sistema da escola (blocos <em>Segmento / Série / Ano / Turma</em> com as colunas
        Nº, Matrícula, Nome do aluno e Situação, ou uma planilha com Matrícula, Série e Situação). Envie o ano anterior e o atual:
        o cruzamento pela matrícula mostra quem já rematriculou, quem falta, quem saiu e os novatos. Antes de gravar aparece um
        resumo para conferir; reenviar o relatório atualiza pela matrícula, sem duplicar.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Ano do relatório<br />
          <select value={year} onChange={e => { setYear(Number(e.target.value)); reset() }} style={{ ...input, marginTop: 4 }}>
            {[thisYear - 2, thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['arquivo', 'colar'] as const).map(m => (
            <button key={m} type="button" onClick={() => { setMode(m); reset() }}
              style={{ ...btnSec, padding: '8px 12px', background: mode === m ? '#E6F7F5' : '#F1F5F9', color: mode === m ? '#05907B' : '#475569' }}>
              {m === 'arquivo' ? 'Arquivo (.csv / .xlsx)' : 'Colar texto'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>Usado quando o relatório não diz o ano.</span>
      </div>

      {mode === 'arquivo' ? (
        <input type="file" accept=".csv,.xlsx,.xls,.txt" onChange={e => { setFile(e.target.files?.[0] ?? null); reset() }}
          style={{ fontSize: 13, marginBottom: 12 }} />
      ) : (
        <textarea value={pasted} onChange={e => { setPasted(e.target.value); reset() }} rows={8}
          placeholder={'Cole aqui o relatório (copiado do Excel ou do PDF), com o cabeçalho.\nEx.:\nSegmento / Série / Ano / Turma\nEnsino Fundamental I / 1º Ano / 2025 / A\nNº\tMatrícula\tNome do aluno\tSituação\n1\t12345\t…\tAprovado'}
          style={{ ...input, width: '100%', fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }} />
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: namesAllowed ? '#475569' : '#94A3B8', marginBottom: 14 }}>
        <input type="checkbox" checked={includeNames && namesAllowed} disabled={!namesAllowed}
          onChange={e => { setIncludeNames(e.target.checked); reset() }} style={{ marginTop: 2 }} />
        <span>
          <strong>Guardar nomes de alunos e responsáveis.</strong> Desmarcado, só matrícula, série e situação saem do seu computador
          (os alunos aparecem como "Matrícula 123").{' '}
          {namesAllowed
            ? 'CPF nunca é guardado: vira um código que não permite voltar ao número.'
            : 'Disponível depois do aditivo de proteção de dados (LGPD) assinado e registrado pela Áion.'}
        </span>
      </label>

      <button onClick={preview} disabled={!!busy || (mode === 'arquivo' ? !file : !pasted.trim())}
        style={busy || (mode === 'arquivo' ? !file : !pasted.trim()) ? { ...btn, opacity: 0.6, cursor: 'not-allowed' } : btn}>
        {busy === 'previa' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Ler e ver resumo
      </button>

      {error && <p style={warnBox}><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {error}</p>}

      {summary && parsed && (
        <div style={{ marginTop: 18, borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
          <p style={{ fontSize: 13, color: '#1A2B4A', margin: '0 0 10px', fontWeight: 600 }}>
            {summary.previa ? 'Prévia (nada gravado ainda)' : 'Gravado'} — {parsed.rows.length} alunos lidos
            {summary.anos.length > 0 && <> · ano(s) {summary.anos.join(', ')}</>}
            {' · '}{summary.alunos_novos_no_ano} novos no ano, {summary.atualizados} atualizados, {summary.sem_mudanca} sem mudança
          </p>

          {crosses.map(c => (
            <div key={c.target_year} style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 8px' }}>
                Rematrícula {c.target_year} {c.base_ano_anterior > 0 && <span style={{ fontWeight: 500 }}>(base {c.target_year - 1}: {c.base_ano_anterior} alunos)</span>}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Stat label="rematriculados" value={c.rematriculados} color="#059669" />
                <Stat label="novatos" value={c.novatos} color="#2563EB" />
                <Stat label="saíram" value={c.sairam} color="#DC2626" />
                <Stat label="a rematricular" value={c.a_rematricular} color="#D97706" />
                <Stat label="concluintes" value={c.concluintes} color="#64748B" />
                {c.retornos > 0 && <Stat label="voltaram" value={c.retornos} color="#7C3AED" />}
              </div>
              {c.base_ano_anterior > 0 && (
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '8px 0 0' }}>
                  Da base {c.target_year - 1}: {c.rematriculados} já em {c.target_year}, faltam {c.faltam_total}
                  {' '}({c.a_rematricular} a rematricular, {c.concluintes} concluintes, {c.sairam_da_base} saíram
                  {c.rematriculados_declarados > 0 && <>, {c.rematriculados_declarados} marcados pela equipe</>}).
                </p>
              )}
            </div>
          ))}

          {(unkGrades.length > 0 || unkStatus.length > 0 || skipped > 0 || summary.cpf_ignorado_sem_segredo > 0) && (
            <div style={warnBox}>
              {unkGrades.length > 0 && <div><strong>Séries não reconhecidas</strong> (essas linhas ficam de fora): {unkGrades.map(([k, n]) => `${k} (${n})`).join(', ')}. Confira os nomes em Configurações → Escola → Séries.</div>}
              {unkStatus.length > 0 && <div><strong>Situações não reconhecidas</strong> (entram como "desconhecida"): {unkStatus.map(([k, n]) => `${k} (${n})`).join(', ')}.</div>}
              {skipped > 0 && <div><strong>{skipped} linha(s) ignorada(s)</strong> por falta de matrícula, série ou situação{parsed.skipped.length > 0 && <> (linhas {parsed.skipped.slice(0, 10).map(s => s.linha).join(', ')}{parsed.skipped.length > 10 ? '…' : ''})</>}.</div>}
              {summary.cpf_ignorado_sem_segredo > 0 && <div>CPF de {summary.cpf_ignorado_sem_segredo} responsável(is) não guardado (proteção do CPF ainda não configurada na plataforma).</div>}
            </div>
          )}

          {summary.previa ? (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#1A2B4A' }}>
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                Conferi o resumo com o sistema da escola e quero gravar.
              </label>
              <div>
                <button onClick={commit} disabled={!confirmed || !!busy}
                  style={!confirmed || busy ? { ...btn, opacity: 0.6, cursor: 'not-allowed' } : btn}>
                  {busy === 'gravando' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Gravar relatório
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#059669', margin: '12px 0 0' }}>
              <CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> Relatório gravado. Acompanhe em{' '}
              <a href="/base-alunos" style={{ color: '#05907B', fontWeight: 600 }}>Base de alunos</a>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 12px', minWidth: 96 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748B' }}>{label}</div>
    </div>
  )
}
