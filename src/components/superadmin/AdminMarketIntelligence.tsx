import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import SuperAdminLayout from './SuperAdminLayout'

// ─── tipos ────────────────────────────────────────────────────────────────────
interface Stats {
  total_escolas: number
  ultimo_ano: number | null
  total_setores: number
}

interface ImportLog {
  id: string
  tipo: string
  ano_censo: number | null
  total_registros: number | null
  status: string
  erro: string | null
  created_at: string
}

// colunas esperadas no CSV do INEP
const INEP_COL_MAP: Record<string, string> = {
  CO_ENTIDADE: 'co_entidade',
  NO_ENTIDADE: 'no_entidade',
  CO_MUNICIPIO: 'co_municipio',
  NO_MUNICIPIO: 'no_municipio',
  SG_UF: 'sg_uf',
  TP_DEPENDENCIA: 'tp_dependencia',
  TP_SITUACAO_FUNCIONAMENTO: 'tp_situacao_funcionamento',
  QT_MAT_TOTAL: 'qt_mat_total',
  QT_MAT_FUND: 'qt_mat_fund',
  QT_MAT_MED: 'qt_mat_med',
  QT_MAT_INF: 'qt_mat_inf',
  LAT: 'lat',
  LNG: 'lng',
  NU_LATITUDE: 'lat',
  NU_LONGITUDE: 'lng',
}

const ANOS = ['2019', '2020', '2021', '2022', '2023', '2024']

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: '#F59E0B' },
  processing: { label: 'Processando', color: '#3B82F6' },
  completed: { label: 'Concluído', color: '#10B981' },
  error: { label: 'Erro', color: '#EF4444' },
}

// ─── componente ───────────────────────────────────────────────────────────────
export default function AdminMarketIntelligence() {
  const { user } = useAuth()

  const [stats, setStats] = useState<Stats>({ total_escolas: 0, ultimo_ano: null, total_setores: 0 })
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [loadingStats, setLoadingStats] = useState(true)

  const [importYear, setImportYear] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadStats()
    loadLogs()
  }, [])

  async function loadStats() {
    setLoadingStats(true)
    try {
      const [escolas, setores] = await Promise.all([
        supabase.from('inep_escolas').select('ano_censo', { count: 'exact' }).limit(1),
        supabase.from('ibge_setores').select('id', { count: 'exact', head: true }),
      ])

      const totalEscolas = escolas.count ?? 0
      const totalSetores = setores.count ?? 0

      // max ano_censo
      const { data: anoData } = await supabase
        .from('inep_escolas')
        .select('ano_censo')
        .order('ano_censo', { ascending: false })
        .limit(1)
        .maybeSingle()

      setStats({
        total_escolas: totalEscolas,
        ultimo_ano: (anoData as { ano_censo: number } | null)?.ano_censo ?? null,
        total_setores: totalSetores,
      })
    } catch { /* tabela pode não existir ainda */ }
    setLoadingStats(false)
  }

  async function loadLogs() {
    try {
      const { data } = await supabase
        .from('inep_import_logs')
        .select('id, tipo, ano_censo, total_registros, status, erro, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      setLogs((data as ImportLog[]) ?? [])
    } catch { /* tabela pode não existir ainda */ }
  }

  function parseCSVLine(line: string, sep: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuote = !inQuote
      } else if (ch === sep && !inQuote) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  async function handleImport() {
    if (!csvFile || !importYear) return
    setImporting(true)
    setProgress(0)
    setProgressMsg('Lendo arquivo...')
    setImportError(null)
    let logId: string | null = null

    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target?.result as string)
        reader.onerror = reject
        reader.readAsText(csvFile, 'latin1')
      })

      const lines = text.split(/\r?\n/)
      if (lines.length < 2) throw new Error('Arquivo vazio ou sem dados')

      // detectar separador (ponto-e-vírgula ou vírgula)
      const sep = lines[0].includes(';') ? ';' : ','
      const headerRaw = parseCSVLine(lines[0], sep)
      const header = headerRaw.map(h => h.replace(/^"|"$/g, '').trim().toUpperCase())

      // mapear índices
      const colIdx: Record<string, number> = {}
      header.forEach((h, i) => {
        const mapped = INEP_COL_MAP[h]
        if (mapped && !(mapped in colIdx)) colIdx[mapped] = i
      })

      if (!('co_entidade' in colIdx)) {
        throw new Error('Coluna CO_ENTIDADE não encontrada. Verifique se o arquivo é do Censo Escolar INEP.')
      }

      const dataLines = lines.slice(1).filter(l => l.trim())
      const total = dataLines.length

      // registrar log de importação
      const { data: logData } = await supabase
        .from('inep_import_logs')
        .insert({
          tipo: 'censo_escolar',
          ano_censo: parseInt(importYear),
          status: 'processing',
          total_registros: total,
          imported_by: user?.id ?? null,
        })
        .select('id')
        .single()
      logId = (logData as { id: string } | null)?.id ?? null

      const BATCH = 500
      let processed = 0

      for (let i = 0; i < dataLines.length; i += BATCH) {
        const batch = dataLines.slice(i, i + BATCH)

        const rows = batch
          .map(line => {
            const cols = parseCSVLine(line, sep)

            const g = (key: string): string | null => {
              const idx = colIdx[key]
              if (idx === undefined) return null
              const v = cols[idx]?.replace(/^"|"$/g, '').trim()
              return v || null
            }

            const toInt = (key: string): number | null => {
              const v = g(key)
              if (!v) return null
              const n = parseInt(v)
              return isNaN(n) ? null : n
            }

            const toFloat = (key: string): number | null => {
              const v = g(key)
              if (!v) return null
              const n = parseFloat(v.replace(',', '.'))
              return isNaN(n) ? null : n
            }

            return {
              co_entidade: g('co_entidade'),
              no_entidade: g('no_entidade'),
              co_municipio: g('co_municipio'),
              no_municipio: g('no_municipio'),
              sg_uf: g('sg_uf'),
              tp_dependencia: toInt('tp_dependencia'),
              tp_situacao_funcionamento: toInt('tp_situacao_funcionamento'),
              qt_mat_total: toInt('qt_mat_total'),
              qt_mat_fund: toInt('qt_mat_fund'),
              qt_mat_med: toInt('qt_mat_med'),
              qt_mat_inf: toInt('qt_mat_inf'),
              lat: toFloat('lat'),
              lng: toFloat('lng'),
              ano_censo: parseInt(importYear),
            }
          })
          .filter(r => r.co_entidade)

        if (rows.length > 0) {
          const { error: upsertErr } = await supabase
            .from('inep_escolas')
            .upsert(rows, { onConflict: 'co_entidade,ano_censo' })

          if (upsertErr) throw new Error(upsertErr.message)
        }

        processed += batch.length
        setProgress(Math.round((processed / total) * 100))
        setProgressMsg(`Processando... ${processed.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} registros`)

        // yield to event loop to keep UI responsive
        await new Promise(r => setTimeout(r, 0))
      }

      if (logId) {
        await supabase
          .from('inep_import_logs')
          .update({ status: 'completed', total_registros: processed })
          .eq('id', logId)
      }

      setProgressMsg(`Importação concluída! ${processed.toLocaleString('pt-BR')} registros processados.`)
      setProgress(100)
      setCsvFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadStats()
      await loadLogs()
    } catch (err) {
      const msg = (err as Error).message
      setImportError(msg)
      setProgressMsg(null)
      if (logId) {
        await supabase
          .from('inep_import_logs')
          .update({ status: 'error', erro: msg })
          .eq('id', logId)
      }
      await loadLogs()
    } finally {
      setImporting(false)
    }
  }

  return (
    <SuperAdminLayout>
      <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Header ───────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #1e2d6b, #2d4494)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-building-bank" style={{ fontSize: 20, color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Inteligência de Mercado</h1>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Gerencie os dados do Censo Escolar INEP e IBGE</p>
            </div>
          </div>
        </div>

        {/* ── Seção 1 — Status ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            {
              icon: 'ti-school',
              label: 'Escolas importadas',
              value: loadingStats ? '—' : stats.total_escolas.toLocaleString('pt-BR'),
              color: '#1e2d6b',
              bg: '#eef2ff',
            },
            {
              icon: 'ti-calendar',
              label: 'Último ano do censo',
              value: loadingStats ? '—' : (stats.ultimo_ano?.toString() ?? 'Nenhum'),
              color: '#059669',
              bg: '#ecfdf5',
            },
            {
              icon: 'ti-map-pin',
              label: 'Setores IBGE',
              value: loadingStats ? '—' : stats.total_setores.toLocaleString('pt-BR'),
              color: '#7c3aed',
              bg: '#f5f3ff',
            },
          ].map(card => (
            <div key={card.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`ti ${card.icon}`} style={{ fontSize: 22, color: card.color }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{card.value}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Seção 2 — Importar INEP ──────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <i className="ti ti-upload" style={{ fontSize: 18, color: '#1e2d6b' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Importar dados INEP — Censo Escolar</h2>
          </div>

          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
            Baixe os microdados em:{' '}
            <a
              href="https://dados.gov.br/dados/conjuntos-dados/microdados-do-censo-escolar-da-educacao-basica"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#1e2d6b', fontWeight: 600 }}
            >
              dados.gov.br/dados/conjuntos-dados/microdados-do-censo-escolar-da-educacao-basica
            </a>
            {' '}— extraia o arquivo de escolas (.csv) e importe abaixo.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Ano do censo
              </label>
              <select
                value={importYear}
                onChange={e => setImportYear(e.target.value)}
                disabled={importing}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13, background: '#fafafa', outline: 'none' }}
              >
                <option value="">Selecione...</option>
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Arquivo CSV
              </label>
              <div
                onClick={() => !importing && fileInputRef.current?.click()}
                style={{
                  padding: '9px 14px', borderRadius: 9, border: '1.5px dashed #cbd5e1',
                  fontSize: 13, cursor: importing ? 'default' : 'pointer',
                  background: '#fafafa', color: csvFile ? '#111827' : '#9ca3af',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <i className="ti ti-paperclip" style={{ fontSize: 14, color: '#6b7280' }} />
                {csvFile ? csvFile.name : 'Clique para selecionar (.csv)'}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <button
              onClick={handleImport}
              disabled={importing || !csvFile || !importYear}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 9, border: 'none', cursor: importing || !csvFile || !importYear ? 'not-allowed' : 'pointer',
                background: importing || !csvFile || !importYear ? '#e5e7eb' : 'linear-gradient(135deg, #1e2d6b, #2d4494)',
                color: importing || !csvFile || !importYear ? '#9ca3af' : '#fff',
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              <i className="ti ti-upload" style={{ fontSize: 14 }} />
              {importing ? 'Importando...' : 'Importar Censo Escolar'}
            </button>
          </div>

          {/* Progress bar */}
          {importing && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 6, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #1e2d6b, #2d4494)', borderRadius: 999, transition: 'width 0.3s ease' }} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{progressMsg} — {progress}%</p>
            </div>
          )}

          {/* Resultado final */}
          {!importing && progressMsg && (
            <div style={{ padding: '10px 14px', borderRadius: 9, background: '#ecfdf5', border: '1px solid #bbf7d0', fontSize: 13, color: '#065f46', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-circle-check" style={{ fontSize: 16, color: '#10b981' }} />
              {progressMsg}
            </div>
          )}

          {importError && (
            <div style={{ padding: '10px 14px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-alert-circle" style={{ fontSize: 16, color: '#ef4444' }} />
              {importError}
            </div>
          )}
        </div>

        {/* ── Seção 3 — Histórico de importações ───────────────── */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 24px', borderBottom: '1px solid #f3f4f6' }}>
            <i className="ti ti-history" style={{ fontSize: 16, color: '#1e2d6b' }} />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Histórico de importações</h2>
          </div>

          {logs.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: '#9ca3af' }}>
              <i className="ti ti-database-off" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 13 }}>Nenhuma importação realizada ainda</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Tipo', 'Ano', 'Total registros', 'Status', 'Data'].map(col => (
                    <th key={col} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const st = STATUS_LABELS[log.status] ?? { label: log.status, color: '#6b7280' }
                  return (
                    <tr key={log.id} style={{ background: i % 2 === 1 ? '#f9fafb' : '#fff', borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 20px', color: '#374151', fontWeight: 500 }}>
                        {log.tipo === 'censo_escolar' ? 'Censo Escolar INEP' : log.tipo}
                      </td>
                      <td style={{ padding: '12px 20px', color: '#374151' }}>{log.ano_censo ?? '—'}</td>
                      <td style={{ padding: '12px 20px', color: '#374151' }}>
                        {log.total_registros != null ? log.total_registros.toLocaleString('pt-BR') : '—'}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: st.color + '18', color: st.color, fontSize: 11, fontWeight: 700 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color, display: 'inline-block' }} />
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', color: '#6b7280', fontSize: 12 }}>
                        {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Seção 4 — IBGE placeholder ───────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <i className="ti ti-map-2" style={{ fontSize: 18, color: '#1e2d6b' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Importar dados IBGE</h2>
            <span style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 999, background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Em desenvolvimento
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0', color: '#9ca3af', textAlign: 'center' }}>
            <i className="ti ti-map-2" style={{ fontSize: 48 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#374151' }}>Importação de setores censitários IBGE</p>
            <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', maxWidth: 400 }}>Em breve — dados de renda e densidade demográfica por bairro para análise de potencial de mercado por região.</p>
          </div>
        </div>

      </div>
    </SuperAdminLayout>
  )
}
