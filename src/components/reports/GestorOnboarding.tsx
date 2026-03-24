import { useState, useRef } from 'react'
import { Sparkles, Upload, Check, ArrowRight, ChevronRight, Loader2, AlertTriangle, FileText, X } from 'lucide-react'

interface ErpFileEntry {
  name: string; year: number; total: number
  novatos: number; veterans: number; fee?: number; error?: boolean
}

interface HistoricalYear {
  year: number
  total_students: number
  new_enrollments: number
  reenrollments: number
  transfers: number
}

interface Props {
  institutionId: string
  institutionName: string
  onComplete: () => void
  onOpenCampaignModal: (preload?: { historicalData: HistoricalYear[]; erpFiles: ErpFileEntry[] }) => void
}

export default function GestorOnboarding({ institutionName, onComplete, onOpenCampaignModal }: Props) {
  const [step, setStep] = useState(1)
  const [erpFiles, setErpFiles] = useState<ErpFileEntry[]>([])
  const [historicalData, setHistoricalData] = useState<HistoricalYear[]>([])
  const [loadingFiles, setLoadingFiles] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      setLoadingFiles(prev => [...prev, file.name])
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
        const isPdf = ext === 'pdf'
        const raw = await new Promise<string>((res, rej) => {
          const reader = new FileReader()
          reader.onload = ev => res((ev.target?.result as string) || '')
          reader.onerror = rej
          if (isPdf) reader.readAsDataURL(file)
          else reader.readAsText(file, 'utf-8')
        })
        const fileContent = isPdf ? raw.split(',')[1] : raw
        const resp = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'extract_file', payload: { fileContent, fileType: ext, fileName: file.name, ...(isPdf ? { isPdfImage: true } : {}) } })
        })
        const json = await resp.json()
        const d = json.result || json

        if (d.error || !d.detected_year) {
          setErpFiles(prev => [...prev, { name: file.name, year: 0, total: 0, novatos: 0, veterans: 0, error: true }])
        } else {
          const entry: ErpFileEntry = {
            name: file.name,
            year: d.detected_year,
            total: d.total_students ?? 0,
            novatos: d.new_students ?? 0,
            veterans: d.returning_students ?? 0,
            fee: d.avg_monthly_fee ?? undefined,
          }
          setErpFiles(prev => {
            const filtered = prev.filter(e => e.year !== entry.year)
            return [...filtered, entry]
          })
          const hyEntry: HistoricalYear = {
            year: d.detected_year,
            total_students: d.total_students ?? 0,
            new_enrollments: d.new_students ?? 0,
            reenrollments: d.returning_students ?? 0,
            transfers: d.transfers ?? 0,
          }
          setHistoricalData(prev => {
            const filtered = prev.filter(h => h.year !== hyEntry.year)
            return [...filtered, hyEntry].sort((a, b) => a.year - b.year)
          })
        }
      } catch {
        setErpFiles(prev => [...prev, { name: file.name, year: 0, total: 0, novatos: 0, veterans: 0, error: true }])
      } finally {
        setLoadingFiles(prev => prev.filter(n => n !== file.name))
      }
    }
    if (erpFiles.length === 0) setStep(3)
  }

  const removeFile = (name: string) => {
    const entry = erpFiles.find(e => e.name === name)
    setErpFiles(prev => prev.filter(e => e.name !== name))
    if (entry && !entry.error) {
      setHistoricalData(prev => prev.filter(h => h.year !== entry.year))
    }
  }

  const hasSuccessFiles = erpFiles.some(e => !e.error)

  return (
    <div style={{
      minHeight: '100%', background: 'linear-gradient(135deg, #f0fdfa 0%, #eff6ff 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: 40, maxWidth: 560, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0'
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, justifyContent: 'center' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              width: s === step ? 24 : 8, height: 8, borderRadius: 999,
              background: s === step ? '#0d9488' : s < step ? '#99f6e4' : '#e2e8f0',
              transition: 'all 0.3s'
            }} />
          ))}
        </div>

        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #0d9488, #1e40af)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px'
            }}>
              <Sparkles style={{ width: 32, height: 32, color: 'white' }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e2d6b', margin: '0 0 12px' }}>
              Bem-vindo ao Áion Edu, {institutionName}!
            </h1>
            <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.6, marginBottom: 32 }}>
              Vamos preparar sua escola para a campanha de matrículas.<br />
              <strong style={{ color: '#374151' }}>Leva menos de 5 minutos para configurar.</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32, textAlign: 'left' }}>
              {[
                { icon: '📂', text: 'Importe o histórico de matrículas do seu ERP' },
                { icon: '🎯', text: 'Defina suas metas para a próxima campanha' },
                { icon: '📊', text: 'Acompanhe o funil em tempo real' },
              ].map(item => (
                <div key={item.text} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 12 }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span style={{ fontSize: 14, color: '#374151' }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              style={{
                width: '100%', padding: '14px 24px', borderRadius: 12, background: '#0d9488',
                color: 'white', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}>
              Começar <ArrowRight style={{ width: 18, height: 18 }} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload style={{ width: 20, height: 20, color: '#1d4ed8' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d6b', margin: 0 }}>Importe seu histórico</h2>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Dados dos anos anteriores tornam as metas muito mais precisas</p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: 13, color: '#374151', fontWeight: 600, margin: '0 0 6px' }}>Como exportar do seu sistema:</p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#6b7280', lineHeight: 2 }}>
                <li><strong>SIGA:</strong> Relatórios → Matrículas Efetivadas → Exportar PDF</li>
                <li><strong>Totvs:</strong> Gestão Escolar → Relatórios → Matrícula por Período</li>
                <li><strong>Outro ERP:</strong> Qualquer relatório com total de alunos por ano</li>
              </ul>
            </div>

            {/* File cards */}
            {erpFiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {erpFiles.map(f => (
                  <div key={f.name} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    background: f.error ? '#fef2f2' : '#f0fdf4', borderRadius: 10,
                    border: `1px solid ${f.error ? '#fecaca' : '#86efac'}`
                  }}>
                    {f.error
                      ? <AlertTriangle style={{ width: 16, height: 16, color: '#ef4444', flexShrink: 0 }} />
                      : <FileText style={{ width: 16, height: 16, color: '#16a34a', flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: f.error ? '#b91c1c' : '#15803d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.error ? 'Não foi possível ler o arquivo' : `${f.year} — ${f.total.toLocaleString('pt-BR')} alunos`}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{f.name}</p>
                    </div>
                    <button onClick={() => removeFile(f.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af' }}>
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Loading indicators */}
            {loadingFiles.map(name => (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 8
              }}>
                <Loader2 style={{ width: 16, height: 16, color: '#3b82f6', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 13, color: '#1d4ed8' }}>Lendo {name}…</p>
              </div>
            ))}

            {/* Upload area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #cbd5e1', borderRadius: 12, padding: '20px 16px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 16,
                background: '#f8fafc', transition: 'border-color 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#0d9488')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
            >
              <Upload style={{ width: 24, height: 24, color: '#94a3b8', margin: '0 auto 8px', display: 'block' }} />
              <p style={{ margin: 0, fontSize: 13, color: '#374151', fontWeight: 600 }}>
                {erpFiles.length > 0 ? 'Adicionar mais arquivos' : 'Selecionar arquivos do ERP'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>PDF, Excel ou CSV — múltiplos arquivos aceitos</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              multiple
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hasSuccessFiles && (
                <button
                  onClick={() => setStep(3)}
                  style={{
                    padding: '13px 20px', borderRadius: 12, background: '#0d9488', color: 'white',
                    border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}>
                  <Check style={{ width: 16, height: 16 }} />
                  Continuar com {erpFiles.filter(e => !e.error).length} arquivo{erpFiles.filter(e => !e.error).length !== 1 ? 's' : ''} importado{erpFiles.filter(e => !e.error).length !== 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={() => setStep(3)}
                style={{
                  padding: '12px 20px', borderRadius: 12, background: 'white', color: '#6b7280',
                  border: '1px solid #e2e8f0', fontSize: 13, cursor: 'pointer'
                }}>
                {hasSuccessFiles ? 'Pular e ir sem mais arquivos' : 'Não tenho esses arquivos agora — pular'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, background: '#f0fdf4',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
              border: '2px solid #86efac'
            }}>
              <Check style={{ width: 36, height: 36, color: '#16a34a' }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e2d6b', margin: '0 0 12px' }}>
              Tudo pronto para começar!
            </h2>
            {hasSuccessFiles && (
              <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 16px', marginBottom: 16, border: '1px solid #86efac', textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                  ✓ {erpFiles.filter(e => !e.error).length} arquivo{erpFiles.filter(e => !e.error).length !== 1 ? 's' : ''} importado{erpFiles.filter(e => !e.error).length !== 1 ? 's' : ''} com sucesso
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#16a34a' }}>
                  Anos: {erpFiles.filter(e => !e.error).map(e => e.year).sort().join(', ')}
                </p>
              </div>
            )}
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 28 }}>
              {hasSuccessFiles
                ? 'Os dados já foram carregados. Clique abaixo para gerar seu plano de campanha com a IA — os dados importados serão usados automaticamente.'
                : 'Agora você pode gerar seu plano de campanha com a IA e acompanhar seus resultados em tempo real.'
              }
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  onOpenCampaignModal(hasSuccessFiles ? { historicalData, erpFiles } : undefined)
                  onComplete()
                }}
                style={{
                  width: '100%', padding: '14px 24px', borderRadius: 12, background: '#0d9488',
                  color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                <Sparkles style={{ width: 16, height: 16 }} />
                Gerar meu plano de campanha
                <ChevronRight style={{ width: 16, height: 16 }} />
              </button>
              <button
                onClick={onComplete}
                style={{
                  width: '100%', padding: '12px 24px', borderRadius: 12, background: 'white',
                  color: '#6b7280', border: '1px solid #e2e8f0', fontSize: 13, cursor: 'pointer'
                }}>
                Ver o painel sem campanha configurada
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
