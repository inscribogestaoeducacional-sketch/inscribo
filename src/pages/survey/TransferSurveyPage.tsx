import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ─── tipos ──────────────────────────────────────────────────
interface TransferRecord {
  id: string
  student_name: string
  course_grade: string
  transfer_date: string
  survey_token: string
  survey_completed_at: string | null
  institution_id: string
}

interface Institution {
  id: string
  name: string
  logo_url?: string
  primary_color: string
}

type SurveyResponses = Record<string, string | string[] | number>

// ─── perguntas ──────────────────────────────────────────────
type QuestionType = 'single' | 'multiple' | 'scale' | 'text'

interface Question {
  id: string
  text: string
  type: QuestionType
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  placeholder?: string
  optional?: boolean
  condition?: (responses: SurveyResponses) => boolean
}

const BASE_QUESTIONS: Question[] = [
  {
    id: 'main_reason',
    text: 'Qual foi o principal motivo da transferência?',
    type: 'single',
    options: [
      { value: 'financial', label: 'Financeiro — dificuldade com o valor da mensalidade' },
      { value: 'pedagogical', label: 'Pedagógico — expectativas não atendidas' },
      { value: 'distance', label: 'Distância — localização da escola' },
      { value: 'competition', label: 'Escolheu outra escola' },
      { value: 'relocation', label: 'Mudança de cidade ou bairro' },
      { value: 'other', label: 'Outro motivo' },
    ],
  },
  {
    id: 'financial_budget',
    text: 'O valor da mensalidade estava acima do seu orçamento?',
    type: 'single',
    options: [
      { value: 'yes_much', label: 'Sim, bem acima' },
      { value: 'yes_little', label: 'Sim, um pouco acima' },
      { value: 'no', label: 'Não, mas o custo total era alto' },
    ],
    condition: r => r.main_reason === 'financial',
  },
  {
    id: 'financial_negotiation',
    text: 'Você chegou a negociar condições com a escola?',
    type: 'single',
    options: [
      { value: 'yes_worked', label: 'Sim, e conseguimos um acordo' },
      { value: 'yes_no_deal', label: 'Sim, mas não chegamos a um acordo' },
      { value: 'no', label: 'Não cheguei a negociar' },
    ],
    condition: r => r.main_reason === 'financial',
  },
  {
    id: 'pedagogical_issues',
    text: 'O que não atendeu suas expectativas pedagógicas?',
    type: 'multiple',
    options: [
      { value: 'teachers', label: 'Qualidade dos professores' },
      { value: 'infrastructure', label: 'Infraestrutura e recursos' },
      { value: 'content', label: 'Conteúdo e metodologia' },
      { value: 'communication', label: 'Comunicação com a família' },
      { value: 'extracurricular', label: 'Atividades extracurriculares' },
    ],
    condition: r => r.main_reason === 'pedagogical',
  },
  {
    id: 'competition_differentials',
    text: 'O que a outra escola ofereceu que nos diferenciou?',
    type: 'text',
    placeholder: 'Descreva livremente o que chamou sua atenção na outra escola...',
    condition: r => r.main_reason === 'competition',
  },
  {
    id: 'distance_only_factor',
    text: 'A distância era o único fator na decisão?',
    type: 'single',
    options: [
      { value: 'yes', label: 'Sim, foi o principal motivo' },
      { value: 'no', label: 'Não, havia outros fatores' },
    ],
    condition: r => r.main_reason === 'distance',
  },
  {
    id: 'recommendation',
    text: 'Em uma escala de 0 a 10, qual a probabilidade de você recomendar nossa escola para outras famílias?',
    type: 'scale',
    min: 0,
    max: 10,
  },
  {
    id: 'improvement',
    text: 'Há algo que poderíamos ter feito diferente para manter seu filho(a) aqui?',
    type: 'text',
    placeholder: 'Sua resposta nos ajuda a melhorar para outras famílias...',
    optional: true,
  },
]

// ─── utilidades ─────────────────────────────────────────────
function getActiveQuestions(responses: SurveyResponses): Question[] {
  return BASE_QUESTIONS.filter(q => !q.condition || q.condition(responses))
}

// ═══════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function TransferSurveyPage() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<'loading' | 'invalid' | 'completed' | 'active' | 'submitting' | 'done'>('loading')
  const [transfer, setTransfer] = useState<TransferRecord | null>(null)
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState<SurveyResponses>({})
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    loadSurvey()
  }, [token]) // eslint-disable-line

  const loadSurvey = async () => {
    // Busca sem RLS (política pública por token)
    const { data, error } = await supabase
      .from('student_transfers')
      .select('*')
      .eq('survey_token', token)
      .maybeSingle()

    if (error || !data) { setStatus('invalid'); return }
    if (data.survey_completed_at) { setStatus('completed'); return }

    setTransfer(data)

    // buscar dados da instituição (sem RLS)
    if (data.institution_id) {
      const { data: inst } = await supabase
        .from('institutions')
        .select('id, name, logo_url, primary_color')
        .eq('id', data.institution_id)
        .maybeSingle()
      if (inst) setInstitution(inst)
    }

    setStatus('active')
  }

  const activeQuestions = getActiveQuestions(responses)
  const current = activeQuestions[currentIndex]
  const progress = activeQuestions.length > 0 ? Math.round((currentIndex / activeQuestions.length) * 100) : 0
  const isLast = currentIndex === activeQuestions.length - 1

  const setResponse = (value: string | string[] | number) => {
    setResponses(prev => ({ ...prev, [current.id]: value }))
  }

  const toggleMultiple = (value: string) => {
    const prev = (responses[current.id] as string[]) || []
    const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    setResponse(next)
  }

  const canAdvance = () => {
    if (current.optional) return true
    const val = responses[current.id]
    if (current.type === 'single') return !!val
    if (current.type === 'multiple') return Array.isArray(val) && val.length > 0
    if (current.type === 'scale') return val !== undefined && val !== null && val !== ''
    if (current.type === 'text') return current.optional || (typeof val === 'string' && val.trim().length > 0)
    return false
  }

  const advance = () => {
    if (currentIndex < activeQuestions.length - 1) {
      setAnimating(true)
      setTimeout(() => {
        setCurrentIndex(i => i + 1)
        setAnimating(false)
      }, 200)
    }
  }

  const back = () => {
    if (currentIndex > 0) {
      setAnimating(true)
      setTimeout(() => {
        setCurrentIndex(i => i - 1)
        setAnimating(false)
      }, 200)
    }
  }

  const submit = async () => {
    if (!transfer) return
    setStatus('submitting')

    try {
      // Salvar respostas
      const { error } = await supabase
        .from('student_transfers')
        .update({
          survey_responses: responses,
          survey_completed_at: new Date().toISOString(),
        })
        .eq('survey_token', token)

      if (error) throw error

      // Chamar IA para diagnóstico (em background, sem bloquear tela)
      fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer_diagnosis',
          payload: {
            responses,
            studentName: transfer.student_name,
            grade: transfer.course_grade,
          }
        })
      }).then(res => res.json()).then(async data => {
        if (data.result) {
          await supabase.from('student_transfers').update({
            ai_diagnosis: data.result.diagnosis,
            ai_risk_factors: data.result.risk_factors,
          }).eq('survey_token', token)
        }
      }).catch(() => {/* silencioso */})

      setStatus('done')
    } catch {
      setStatus('active') // volta para o formulário em caso de erro
      alert('Erro ao enviar respostas. Por favor, tente novamente.')
    }
  }

  const brandColor = institution?.primary_color || '#0d9488'

  // ─── telas de estado ────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${brandColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280', fontSize: 14 }}>Carregando pesquisa...</p>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 48, maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 64, height: 64, background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e2d6b', margin: '0 0 8px' }}>Link inválido ou expirado</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Este link de pesquisa não existe ou foi expirado. Entre em contato com a escola para mais informações.</p>
        </div>
      </div>
    )
  }

  if (status === 'completed') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 48, maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 64, height: 64, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e2d6b', margin: '0 0 8px' }}>Pesquisa já respondida</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Esta pesquisa já foi respondida anteriormente. Obrigado pela sua participação!</p>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 48, maxWidth: 440, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          {institution?.logo_url && (
            <img src={institution.logo_url} alt={institution.name} style={{ height: 48, objectFit: 'contain', margin: '0 auto 24px', display: 'block' }} />
          )}
          <div style={{ width: 72, height: 72, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '3px solid #bbf7d0' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e2d6b', margin: '0 0 12px' }}>Muito obrigado!</h2>
          <p style={{ fontSize: 15, color: '#374151', margin: '0 0 8px', lineHeight: 1.6 }}>
            Sua resposta é muito importante para nós.
          </p>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
            Seu feedback nos ajuda a melhorar continuamente para outras famílias.
            {institution?.name && ` A ${institution.name} agradece sua confiança.`}
          </p>
        </div>
      </div>
    )
  }

  // ─── formulário ─────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* header */}
      <div style={{ width: '100%', background: 'white', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {institution?.logo_url ? (
          <img src={institution.logo_url} alt={institution.name} style={{ height: 36, objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>{institution?.name || 'Pesquisa de Transferência'}</span>
        )}
      </div>

      {/* barra de progresso */}
      <div style={{ width: '100%', height: 4, background: '#e2e8f0' }}>
        <div style={{ height: '100%', background: brandColor, width: `${progress}%`, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 560, padding: '40px 24px', flex: 1 }}>
        {/* info do aluno */}
        {transfer && (
          <div style={{ background: 'white', borderRadius: 12, padding: '12px 16px', marginBottom: 28, border: '1px solid #e2e8f0', display: 'flex', gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 2px' }}>Aluno</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>{transfer.student_name}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 2px' }}>Série</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>{transfer.course_grade}</p>
            </div>
          </div>
        )}

        {/* card da pergunta */}
        <div style={{
          background: 'white', borderRadius: 20, padding: '32px 28px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
          opacity: animating ? 0 : 1, transform: animating ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.2s, transform 0.2s'
        }}>
          <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 12px' }}>
            Pergunta {currentIndex + 1} de {activeQuestions.length}
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e2d6b', margin: '0 0 24px', lineHeight: 1.4 }}>
            {current?.text}
          </h2>

          {/* single */}
          {current?.type === 'single' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {current.options?.map(opt => {
                const selected = responses[current.id] === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setResponse(opt.value)}
                    style={{
                      padding: '14px 18px', borderRadius: 12, border: `2px solid ${selected ? brandColor : '#e2e8f0'}`,
                      background: selected ? `${brandColor}10` : 'white',
                      cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: selected ? 600 : 400,
                      color: selected ? brandColor : '#374151', transition: 'all 0.15s'
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* multiple */}
          {current?.type === 'multiple' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {current.options?.map(opt => {
                const selected = ((responses[current.id] as string[]) || []).includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleMultiple(opt.value)}
                    style={{
                      padding: '14px 18px', borderRadius: 12, border: `2px solid ${selected ? brandColor : '#e2e8f0'}`,
                      background: selected ? `${brandColor}10` : 'white',
                      cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: selected ? 600 : 400,
                      color: selected ? brandColor : '#374151', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 10
                    }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? brandColor : '#d1d5db'}`, background: selected ? brandColor : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* scale */}
          {current?.type === 'scale' && (
            <div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                {Array.from({ length: (current.max || 10) - (current.min || 0) + 1 }, (_, i) => i + (current.min || 0)).map(n => {
                  const selected = responses[current.id] === n
                  return (
                    <button
                      key={n}
                      onClick={() => setResponse(n)}
                      style={{
                        width: 44, height: 44, borderRadius: 12,
                        border: `2px solid ${selected ? brandColor : '#e2e8f0'}`,
                        background: selected ? brandColor : 'white',
                        color: selected ? 'white' : '#374151',
                        fontWeight: selected ? 700 : 400, fontSize: 15,
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Improvável</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Muito provável</span>
              </div>
            </div>
          )}

          {/* text */}
          {current?.type === 'text' && (
            <textarea
              value={(responses[current.id] as string) || ''}
              onChange={e => setResponse(e.target.value)}
              placeholder={current.placeholder}
              rows={4}
              style={{
                width: '100%', padding: '14px 16px', border: '2px solid #e2e8f0', borderRadius: 12,
                fontSize: 14, color: '#374151', resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
                transition: 'border-color 0.15s'
              }}
              onFocus={e => (e.target.style.borderColor = brandColor)}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
            />
          )}
        </div>

        {/* navegação */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
          <button
            onClick={back}
            disabled={currentIndex === 0}
            style={{
              padding: '12px 20px', borderRadius: 12, border: '2px solid #e2e8f0', background: 'white',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', color: '#6b7280', fontSize: 14,
              opacity: currentIndex === 0 ? 0.4 : 1, transition: 'all 0.15s'
            }}
          >
            ← Anterior
          </button>

          {isLast ? (
            <button
              onClick={submit}
              disabled={!canAdvance() || status === 'submitting'}
              style={{
                padding: '12px 28px', borderRadius: 12, border: 'none',
                background: canAdvance() ? brandColor : '#e2e8f0',
                color: canAdvance() ? 'white' : '#94a3b8',
                cursor: canAdvance() ? 'pointer' : 'not-allowed',
                fontSize: 14, fontWeight: 700, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              {status === 'submitting' ? (
                <>
                  <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Enviando...
                </>
              ) : 'Enviar pesquisa ✓'}
            </button>
          ) : (
            <button
              onClick={advance}
              disabled={!canAdvance()}
              style={{
                padding: '12px 28px', borderRadius: 12, border: 'none',
                background: canAdvance() ? brandColor : '#e2e8f0',
                color: canAdvance() ? 'white' : '#94a3b8',
                cursor: canAdvance() ? 'pointer' : 'not-allowed',
                fontSize: 14, fontWeight: 700, transition: 'all 0.15s'
              }}
            >
              Próxima →
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
