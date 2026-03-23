import React, { useState, useEffect, useRef } from 'react'
import {
  X, ChevronRight, ChevronLeft, Upload, Loader2, Check,
  AlertTriangle, Sparkles, FileText, SkipForward
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── tipos ──────────────────────────────────────────────────────
interface ProcessedFile {
  name: string
  detected_year: number
  total_students: number
  new_students: number
  returning_students: number
  avg_monthly_fee: number | null
  error?: boolean
  errorMsg?: string
}

interface SchoolData {
  name: string
  city: string
  state: string
  grades: string[]
  avgFee: number
  currentStudents: number
}

interface Props {
  institutionId: string
  onComplete: () => void
}

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const GRADE_OPTIONS = [
  'Infantil I','Infantil II','Infantil III','Infantil IV','Infantil V',
  '1º ao 5º EF','6º ao 9º EF','Ensino Médio'
]

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em'
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none',
  background: '#FAFAFA', boxSizing: 'border-box'
}

// ─── componente ─────────────────────────────────────────────────
export default function SchoolSetupModal({ institutionId, onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [schoolData, setSchoolData] = useState<SchoolData>({
    name: '', city: '', state: '', grades: [], avgFee: 0, currentStudents: 0
  })
  const [originalCity, setOriginalCity] = useState('')
  const [originalState, setOriginalState] = useState('')

  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [skippedUpload, setSkippedUpload] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [fileProgress, setFileProgress] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Buscar dados da instituição ao montar
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('institutions')
        .select('name, city, state')
        .eq('id', institutionId)
        .single()
      if (!data) return
      const city = (data.city as string) || ''
      const state = (data.state as string) || ''
      setOriginalCity(city)
      setOriginalState(state)
      setSchoolData(s => ({
        ...s,
        name: (data.name as string) || '',
        city,
        state,
      }))
    })()
  }, [institutionId])

  const progressPct = (step / 3) * 100

  // ── upload de arquivos ─────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 5)
    if (!files.length) return
    setLoadingFiles(true)
    setError(null)
    const results: ProcessedFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setFileProgress(`Processando arquivo ${i + 1} de ${files.length}: ${file.name}...`)
      const ext = file.name.split('.').pop()?.toLowerCase() as string
      const isPdf = ext === 'pdf'
      try {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = ev => resolve((ev.target?.result as string) || '')
          reader.onerror = reject
          if (isPdf) reader.readAsDataURL(file)
          else reader.readAsText(file, 'utf-8')
        })
        const fileContent = isPdf ? content.split(',')[1] : content
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'extract_file',
            payload: {
              fileContent,
              fileType: ext,
              fileName: file.name,
              ...(isPdf ? { isPdfImage: true } : {})
            }
          })
        })
        const json = await res.json()
        const r = json.result
        if (!r) throw new Error('Sem resultado')

        const detectedYear = (r.detected_year as number) ||
          parseInt(file.name.match(/\d{4}/)?.[0] || '0')

        results.push({
          name: file.name,
          detected_year: detectedYear,
          total_students: (r.total_students as number) || 0,
          new_students: (r.new_students as number) || 0,
          returning_students: (r.returning_students as number) || 0,
          avg_monthly_fee: (r.avg_monthly_fee as number | null) || null,
        })
      } catch (err) {
        results.push({
          name: file.name,
          detected_year: 0,
          total_students: 0,
          new_students: 0,
          returning_students: 0,
          avg_monthly_fee: null,
          error: true,
          errorMsg: (err as Error).message,
        })
      }
    }

    setProcessedFiles(prev => {
      const combined = [...prev, ...results]
      return combined.filter((f, i) => combined.findIndex(x => x.name === f.name) === i)
    })
    setFileProgress(null)
    setLoadingFiles(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── salvar e fechar ────────────────────────────────────────────
  async function handleFinish() {
    setSaving(true)
    try {
      const successFiles = processedFiles.filter(f => !f.error)
      const cityEdited = schoolData.city !== originalCity
      const stateEdited = schoolData.state !== originalState

      await supabase.from('campaign_cycles').upsert({
        institution_id: institutionId,
        year: new Date().getFullYear(),
        label: `Setup ${new Date().getFullYear()}`,
        start_date: `${new Date().getFullYear()}-01-01`,
        end_date: `${new Date().getFullYear()}-12-31`,
        target_new_students: 0,
        target_reenrollment_rate: 85,
        base_students: schoolData.currentStudents,
        status: 'setup',
        wizard_step: 3,
        school_data: {
          name: schoolData.name,
          city: schoolData.city,
          state: schoolData.state,
          grades: schoolData.grades,
          avg_monthly_fee: schoolData.avgFee,
          current_students: schoolData.currentStudents,
        },
        historical_data: successFiles.map(f => ({
          detected_year: f.detected_year,
          total_students: f.total_students,
          new_students: f.new_students,
          returning_students: f.returning_students,
          avg_monthly_fee: f.avg_monthly_fee,
        })),
        erp_files: successFiles,
      }, { onConflict: 'institution_id,year' })

      if (cityEdited || stateEdited) {
        await supabase.from('institutions')
          .update({ city: schoolData.city, state: schoolData.state })
          .eq('id', institutionId)
      }

      onComplete()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const successFiles = processedFiles.filter(f => !f.error)
  const sortedSuccess = [...successFiles].sort((a, b) => b.detected_year - a.detected_year)
  const latestFile = sortedSuccess[0] ?? null

  const canAdvanceStep1 = !!schoolData.city && !!schoolData.state
  const canAdvanceStep2 = successFiles.length > 0 || skippedUpload

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 620,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.25)'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: '#00A896', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 13, height: 13, borderRadius: '50%', background: 'white', border: '2px solid rgba(255,255,255,0.4)' }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Inscribo</span>
              <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 4 }}>· Configuração inicial</span>
            </div>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Passo {step} de 3</span>
          </div>

          {/* Barra de progresso */}
          <div style={{ height: 4, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #00A896, #0DD3BF)', borderRadius: 999, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}>

          {/* ── Passo 1 — Dados da escola ────────────────────── */}
          {step === 1 && (
            <div style={{ paddingBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 6 }}>
                Configure sua escola
              </h2>
              <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>
                Essas informações nos ajudam a entender melhor o seu contexto.
              </p>

              {/* Nome — readonly */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Nome da escola</label>
                <input
                  style={{ ...inputStyle, background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' }}
                  value={schoolData.name}
                  readOnly
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>
                    Cidade <span style={{ color: '#F43F5E' }}>*</span>
                    {originalCity && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 500, color: '#0369a1', background: '#e0f2fe', borderRadius: 99, padding: '2px 7px' }}>
                        Do cadastro
                      </span>
                    )}
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="Ex: São Paulo"
                    value={schoolData.city}
                    onChange={e => setSchoolData(s => ({ ...s, city: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Estado <span style={{ color: '#F43F5E' }}>*</span>
                    {originalState && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 500, color: '#0369a1', background: '#e0f2fe', borderRadius: 99, padding: '2px 7px' }}>
                        Do cadastro
                      </span>
                    )}
                  </label>
                  <select
                    style={inputStyle}
                    value={schoolData.state}
                    onChange={e => setSchoolData(s => ({ ...s, state: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Séries oferecidas</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 6 }}>
                  {GRADE_OPTIONS.map(g => {
                    const active = schoolData.grades.includes(g)
                    return (
                      <button key={g} onClick={() => setSchoolData(s => ({
                        ...s, grades: active ? s.grades.filter(x => x !== g) : [...s.grades, g]
                      }))} style={{
                        padding: '7px 8px', borderRadius: 8, fontSize: 11, cursor: 'pointer', textAlign: 'center',
                        border: active ? '1.5px solid #00A896' : '1px solid #E2E8F0',
                        background: active ? '#E6F7F5' : '#F8FAFC',
                        color: active ? '#00A896' : '#64748B', fontWeight: active ? 600 : 400
                      }}>
                        {g}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Mensalidade média</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94A3B8' }}>R$</span>
                    <input
                      type="number"
                      style={{ ...inputStyle, paddingLeft: 36 }}
                      placeholder="1500"
                      value={schoolData.avgFee || ''}
                      onChange={e => setSchoolData(s => ({ ...s, avgFee: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Total de alunos atualmente</label>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder="350"
                    value={schoolData.currentStudents || ''}
                    onChange={e => setSchoolData(s => ({ ...s, currentStudents: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {!canAdvanceStep1 && schoolData.city === '' && schoolData.state === '' && (
                <p style={{ margin: '12px 0 0', fontSize: 12, color: '#F43F5E' }}>
                  Cidade e estado são obrigatórios para continuar.
                </p>
              )}
            </div>
          )}

          {/* ── Passo 2 — Importar histórico ─────────────────── */}
          {step === 2 && (
            <div style={{ paddingBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 6 }}>
                Importe seu histórico de matrículas
              </h2>
              <p style={{ fontSize: 14, color: '#64748B', marginBottom: 20, lineHeight: 1.6 }}>
                Exporte o Relatório de Matrículas Efetivadas do seu sistema (SIGA, Totvs ou similar) dos últimos anos e importe aqui. Isso permite análises mais precisas da sua escola.
              </p>

              {/* Área de upload */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xls,.xlsx,.csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div
                onClick={() => !loadingFiles && fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #CBD5E1', borderRadius: 14, padding: '28px 20px',
                  textAlign: 'center', cursor: loadingFiles ? 'default' : 'pointer',
                  background: '#FAFAFA', marginBottom: 16,
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => { if (!loadingFiles) (e.currentTarget as HTMLElement).style.borderColor = '#00A896' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#CBD5E1' }}
              >
                {loadingFiles ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <Loader2 size={28} color="#00A896" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>{fileProgress}</p>
                  </div>
                ) : (
                  <>
                    <Upload size={32} color="#94A3B8" style={{ marginBottom: 10 }} />
                    <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#475569' }}>
                      Clique para selecionar arquivos
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>
                      PDF, XLS, XLSX ou CSV · até 5 arquivos
                    </p>
                  </>
                )}
              </div>

              {/* Cards dos arquivos processados */}
              {processedFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {processedFiles.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12,
                      background: f.error ? '#FFF5F5' : '#F0FDF9',
                      border: `1px solid ${f.error ? '#FECACA' : '#BBF7D0'}`,
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        background: f.error ? '#FFE4E6' : '#D1FAE5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {f.error
                          ? <AlertTriangle size={16} color="#F43F5E" />
                          : <FileText size={16} color="#00A896" />
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.name}
                        </p>
                        {f.error ? (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#DC2626' }}>
                            Erro ao processar — {f.errorMsg || 'tente outro formato'}
                          </p>
                        ) : (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#047857' }}>
                            {f.detected_year > 0 ? `Ano ${f.detected_year} · ` : ''}{f.total_students} alunos ({f.new_students} novatos, {f.returning_students} veteranos)
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setProcessedFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8', flexShrink: 0 }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Botão pular */}
              <button
                onClick={() => { setSkippedUpload(true); setStep(3) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: '#94A3B8', padding: '6px 0',
                }}>
                <SkipForward size={14} /> Não tenho esses arquivos agora
              </button>
            </div>
          )}

          {/* ── Passo 3 — Tudo pronto ────────────────────────── */}
          {step === 3 && (
            <div style={{ paddingBottom: 24, textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20, background: '#D1FAE5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '8px auto 20px',
              }}>
                <Check size={32} color="#00A896" strokeWidth={2.5} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 8 }}>
                Escola configurada!
              </h2>
              <p style={{ fontSize: 14, color: '#64748B', marginBottom: 28, lineHeight: 1.6 }}>
                Seus dados foram salvos. Você já pode começar a usar o Inscribo.
              </p>

              {successFiles.length > 0 && latestFile ? (
                <div style={{ background: '#F0FDF9', border: '1px solid #BBF7D0', borderRadius: 14, padding: '20px 24px', textAlign: 'left', marginBottom: 20 }}>
                  <div style={{ display: 'flex', align: 'center', gap: 8, marginBottom: 14 }}>
                    <Sparkles size={16} color="#00A896" style={{ marginTop: 2 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                      A IA já analisou o padrão da sua escola
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#047857' }}>
                      <strong>{successFiles.length}</strong> {successFiles.length === 1 ? 'ano' : 'anos'} de histórico importados
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: '#047857' }}>
                      Último ciclo: <strong>{latestFile.detected_year}</strong> — {latestFile.total_students} alunos ({latestFile.new_students} novatos)
                    </p>
                    {latestFile.avg_monthly_fee && (
                      <p style={{ margin: 0, fontSize: 13, color: '#047857' }}>
                        Mensalidade média detectada: <strong>R$ {latestFile.avg_monthly_fee.toLocaleString('pt-BR')}</strong>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px', textAlign: 'left', marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
                    Você pode importar o histórico a qualquer momento em <strong>Relatórios → Importar Dados</strong>.
                  </p>
                </div>
              )}

              {error && (
                <p style={{ fontSize: 13, color: '#DC2626', marginBottom: 12 }}>{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px 24px', flexShrink: 0,
          borderTop: '1px solid #F1F5F9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            {step > 1 && step < 3 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, color: '#64748B', cursor: 'pointer', fontWeight: 500 }}>
                <ChevronLeft size={14} /> Voltar
              </button>
            )}
          </div>

          <div>
            {step === 1 && (
              <button
                onClick={() => {
                  if (!canAdvanceStep1) { setError('Preencha cidade e estado para continuar.'); return }
                  setError(null)
                  setStep(2)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 22px', borderRadius: 10, background: canAdvanceStep1 ? '#00A896' : '#CBD5E1', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: canAdvanceStep1 ? 'pointer' : 'not-allowed' }}>
                Continuar <ChevronRight size={14} />
              </button>
            )}

            {step === 2 && (
              <button
                onClick={() => {
                  if (successFiles.length > 0) {
                    setSkippedUpload(false)
                    setStep(3)
                  } else {
                    setSkippedUpload(true)
                    setStep(3)
                  }
                }}
                disabled={loadingFiles}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 22px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: loadingFiles ? 'not-allowed' : 'pointer', opacity: loadingFiles ? 0.6 : 1 }}>
                {successFiles.length > 0 ? 'Continuar' : 'Pular por enquanto'} <ChevronRight size={14} />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleFinish}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 22px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
                  : <>Ir para o painel <ChevronRight size={14} /></>
                }
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
