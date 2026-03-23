import { useState } from 'react'
import { Sparkles, Upload, Check, ArrowRight, ChevronRight } from 'lucide-react'

interface Props {
  institutionId: string
  institutionName: string
  onComplete: () => void
  onOpenCampaignModal: () => void
}

export default function GestorOnboarding({ institutionName, onComplete, onOpenCampaignModal }: Props) {
  const [step, setStep] = useState(1)

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
              Bem-vindo ao Inscribo, {institutionName}!
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

            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: 14, color: '#374151', fontWeight: 600, margin: '0 0 8px' }}>Como exportar do seu sistema:</p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
                <li><strong>SIGA:</strong> Relatórios → Matrículas Efetivadas → Exportar PDF</li>
                <li><strong>Totvs:</strong> Gestão Escolar → Relatórios → Matrícula por Período</li>
                <li><strong>Outro ERP:</strong> Qualquer relatório com total de alunos por ano</li>
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              <button
                onClick={() => { onOpenCampaignModal(); onComplete() }}
                style={{
                  padding: '14px 20px', borderRadius: 12, background: '#0d9488', color: 'white',
                  border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                <Upload style={{ width: 16, height: 16 }} />
                Abrir o Gerador de Campanha para importar
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  padding: '12px 20px', borderRadius: 12, background: 'white', color: '#6b7280',
                  border: '1px solid #e2e8f0', fontSize: 13, cursor: 'pointer'
                }}>
                Não tenho esses arquivos agora — pular
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
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 28 }}>
              Agora você pode gerar seu plano de campanha com a IA
              e acompanhar seus resultados em tempo real.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { onOpenCampaignModal(); onComplete() }}
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
