import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ─── tipos ──────────────────────────────────────────────────
interface Survey {
  id: string
  institution_id: string
  title: string
  description: string | null
  require_identification: boolean
  status: 'draft' | 'active' | 'closed'
  survey_token: string
  response_count: number
}

interface Institution {
  id: string
  name: string
  logo_url?: string
  primary_color: string
}

type Answers = Record<string, number | string>

// ─── componente de header branded ───────────────────────────
function BrandedHeader({ institution }: { institution: Institution | null }) {
  const color = institution?.primary_color ?? '#0F6E56'
  const name  = institution?.name ?? 'Pesquisa de Satisfação'
  return (
    <header style={{
      backgroundColor: color,
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flexShrink: 0,
    }}>
      {institution?.logo_url ? (
        <img src={institution.logo_url} alt={name}
          style={{ height: 36, objectFit: 'contain' }} />
      ) : (
        <div style={{
          width: 36, height: 36, background: 'rgba(255,255,255,0.2)',
          borderRadius: 8, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16,
          flexShrink: 0,
        }}>
          {name.charAt(0)}
        </div>
      )}
      <span style={{ color: 'white', fontWeight: 600, fontSize: 17, letterSpacing: '-0.3px' }}>
        {name}
      </span>
    </header>
  )
}

// ─── perguntas ──────────────────────────────────────────────
interface Question {
  id: string
  text: string
  type: 'scale' | 'select' | 'text'
  min?: number
  max?: number
  labels?: string[]
  options?: string[]
  optional?: boolean
}

const QUESTIONS: Question[] = [
  {
    id: 'general',
    text: 'Como você avalia a escola de forma geral?',
    type: 'scale',
    min: 1, max: 5,
    labels: ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'],
  },
  {
    id: 'teaching',
    text: 'Como você avalia a qualidade do ensino?',
    type: 'scale',
    min: 1, max: 5,
    labels: ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'],
  },
  {
    id: 'communication',
    text: 'Como você avalia o atendimento e a comunicação da escola?',
    type: 'scale',
    min: 1, max: 5,
    labels: ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'],
  },
  {
    id: 'infrastructure',
    text: 'Como você avalia a infraestrutura (espaço físico, materiais)?',
    type: 'scale',
    min: 1, max: 5,
    labels: ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'],
  },
  {
    id: 'cost_benefit',
    text: 'Como você avalia o custo-benefício da escola?',
    type: 'scale',
    min: 1, max: 5,
    labels: ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'],
  },
  {
    id: 'reenrollment',
    text: 'Qual a probabilidade de rematricular seu filho no próximo ano?',
    type: 'select',
    options: [
      'Com certeza vou rematricular',
      'Provavelmente sim',
      'Ainda não decidi',
      'Provavelmente não',
      'Não vou rematricular',
    ],
  },
  {
    id: 'comment',
    text: 'Quer deixar algum comentário ou sugestão para a escola?',
    type: 'text',
    optional: true,
  },
]

const GRADES = [
  'Berçário I', 'Berçário II', 'Maternal I', 'Maternal II',
  'Pré I', 'Pré II',
  '1º ano', '2º ano', '3º ano', '4º ano', '5º ano',
  '6º ano', '7º ano', '8º ano', '9º ano',
  '1ª série EM', '2ª série EM', '3ª série EM',
]

// ─── componente ──────────────────────────────────────────────
export default function SatisfactionPage() {
  const { token } = useParams<{ token: string }>()

  type PageStatus = 'loading' | 'invalid' | 'closed' | 'identify' | 'active' | 'submitting' | 'done'
  const [status, setStatus] = useState<PageStatus>('loading')
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [institution, setInstitution] = useState<Institution | null>(null)

  // identificação
  const [idName, setIdName] = useState('')
  const [idGrade, setIdGrade] = useState('')

  // respostas
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    loadSurvey()
  }, [token]) // eslint-disable-line

  async function loadSurvey() {
    const { data, error } = await supabase
      .from('satisfaction_surveys')
      .select('*')
      .eq('survey_token', token)
      .maybeSingle()

    if (error || !data) { setStatus('invalid'); return }
    if (data.status === 'closed') { setStatus('closed'); return }

    setSurvey(data)

    if (data.institution_id) {
      const { data: inst } = await supabase
        .from('institutions')
        .select('id, name, logo_url, primary_color')
        .eq('id', data.institution_id)
        .maybeSingle()
      if (inst) setInstitution(inst)
    }

    setStatus(data.require_identification ? 'identify' : 'active')
  }

  const brandColor = institution?.primary_color || '#F97316'

  const current = QUESTIONS[currentIndex]
  const isLast = currentIndex === QUESTIONS.length - 1
  const progress = Math.round((currentIndex / QUESTIONS.length) * 100)

  function setAnswer(value: number | string) {
    setAnswers(prev => ({ ...prev, [current.id]: value }))
  }

  function canAdvance() {
    if (current.optional) return true
    const val = answers[current.id]
    return val !== undefined && val !== null && val !== ''
  }

  function advance() {
    if (currentIndex < QUESTIONS.length - 1) {
      setAnimating(true)
      setTimeout(() => {
        setCurrentIndex(i => i + 1)
        setAnimating(false)
      }, 200)
    }
  }

  function back() {
    if (currentIndex > 0) {
      setAnimating(true)
      setTimeout(() => {
        setCurrentIndex(i => i - 1)
        setAnimating(false)
      }, 200)
    }
  }

  async function submit() {
    if (!survey) return
    setStatus('submitting')

    try {
      await supabase.from('satisfaction_responses').insert({
        survey_id: survey.id,
        institution_id: survey.institution_id,
        respondent_name: idName.trim() || null,
        respondent_grade: idGrade || null,
        answers,
      })

      await supabase
        .from('satisfaction_surveys')
        .update({ response_count: (survey.response_count ?? 0) + 1 })
        .eq('id', survey.id)

      setStatus('done')
    } catch {
      setStatus('active')
      alert('Erro ao enviar respostas. Por favor, tente novamente.')
    }
  }

  // ─── telas de estado ────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${brandColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6B7280', fontSize: 14 }}>Carregando pesquisa...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 48, maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 64, height: 64, background: '#FEF2F2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E2D6B', margin: '0 0 8px' }}>Link inválido ou expirado</h2>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Este link de pesquisa não existe. Entre em contato com a escola para mais informações.</p>
        </div>
      </div>
    )
  }

  if (status === 'closed') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 48, maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 64, height: 64, background: '#EFF6FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E2D6B', margin: '0 0 8px' }}>Pesquisa encerrada</h2>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Esta pesquisa foi encerrada e não aceita mais respostas. Obrigado pelo interesse!</p>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 48, maxWidth: 440, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          {institution?.logo_url && (
            <img src={institution.logo_url} alt={institution.name} style={{ height: 48, objectFit: 'contain', margin: '0 auto 24px', display: 'block' }} />
          )}
          <div style={{ width: 72, height: 72, background: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '3px solid #BBF7D0' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1E2D6B', margin: '0 0 12px' }}>Obrigado pela sua resposta!</h2>
          <p style={{ fontSize: 15, color: '#374151', margin: '0 0 8px', lineHeight: 1.6 }}>
            Sua opinião é muito importante para a escola.
          </p>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
            {institution?.name ? `A ${institution.name} agradece o seu tempo e compromisso com a educação.` : 'Seu feedback nos ajuda a melhorar continuamente.'}
          </p>
        </div>
      </div>
    )
  }

  // ─── etapa de identificação ─────────────────────────────
  if (status === 'identify') {
    const canContinue = idName.trim().length > 0
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F8FAFC' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

        {/* Header */}
        <BrandedHeader institution={institution} />

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '32px 28px', maxWidth: 480, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E2D6B', margin: '0 0 8px' }}>{survey?.title}</h2>
            {survey?.description && (
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>{survey.description}</p>
            )}

            <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 20px' }}>
              Antes de começar, nos informe quem você é:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>
                  Nome completo *
                </label>
                <input
                  value={idName}
                  onChange={e => setIdName(e.target.value)}
                  placeholder='Seu nome completo'
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '2px solid #E2E8F0', fontSize: 14, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = brandColor)}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>
                  Série do seu filho (opcional)
                </label>
                <select
                  value={idGrade}
                  onChange={e => setIdGrade(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '2px solid #E2E8F0', fontSize: 14, color: '#374151', outline: 'none', boxSizing: 'border-box', background: 'white', appearance: 'none', cursor: 'pointer' }}
                  onFocus={e => (e.target.style.borderColor = brandColor)}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                >
                  <option value=''>Selecione a série</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Botão fixo no rodapé */}
        <div style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '1px solid #E2E8F0', padding: '16px 24px' }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <button
              onClick={() => setStatus('active')}
              disabled={!canContinue}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: canContinue ? brandColor : '#E2E8F0',
                color: canContinue ? 'white' : '#94A3B8',
                fontSize: 15, fontWeight: 700, cursor: canContinue ? 'pointer' : 'default',
                transition: 'all 0.2s', touchAction: 'manipulation',
              }}
            >
              Começar pesquisa →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── formulário de perguntas ────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F8FAFC' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {institution?.logo_url ? (
          <img src={institution.logo_url} alt={institution.name} style={{ height: 36, objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1E2D6B' }}>{institution?.name || 'Pesquisa de Satisfação'}</span>
        )}
      </div>

      {/* Barra de progresso */}
      <div style={{ width: '100%', height: 4, background: '#E2E8F0', flexShrink: 0 }}>
        <div style={{ height: '100%', background: brandColor, width: `${progress}%`, transition: 'width 0.4s ease' }} />
      </div>

      {/* Conteúdo rolável */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>

          {/* card da pergunta */}
          <div style={{
            background: 'white', borderRadius: 20, padding: '28px 24px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0',
            opacity: animating ? 0 : 1, transform: animating ? 'translateY(8px)' : 'translateY(0)',
            transition: 'opacity 0.2s, transform 0.2s',
          }}>
            <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 12px' }}>
              Pergunta {currentIndex + 1} de {QUESTIONS.length}
            </p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E2D6B', margin: '0 0 28px', lineHeight: 1.4 }}>
              {current.text}
              {current.optional && <span style={{ fontSize: 12, color: '#CBD5E1', fontWeight: 400, marginLeft: 8 }}>(opcional)</span>}
            </h2>

            {/* scale — 5 botões grandes lado a lado */}
            {current.type === 'scale' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
                  {Array.from({ length: (current.max ?? 5) - (current.min ?? 1) + 1 }, (_, i) => i + (current.min ?? 1)).map(n => {
                    const selected = answers[current.id] === n
                    return (
                      <button
                        key={n}
                        onClick={() => setAnswer(n)}
                        style={{
                          padding: '14px 0', borderRadius: 12,
                          border: `2px solid ${selected ? brandColor : '#E2E8F0'}`,
                          background: selected ? brandColor : 'white',
                          color: selected ? 'white' : '#374151',
                          fontWeight: selected ? 700 : 500, fontSize: 20,
                          cursor: 'pointer', transition: 'all 0.15s',
                          touchAction: 'manipulation',
                        }}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
                {/* labels embaixo dos botões */}
                {current.labels && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {current.labels.map((label, i) => (
                      <div key={i} style={{ textAlign: 'center', fontSize: 10, color: '#94A3B8', lineHeight: 1.3, padding: '0 2px' }}>
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* select — opções como botões */}
            {current.type === 'select' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {current.options?.map(opt => {
                  const selected = answers[current.id] === opt
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswer(opt)}
                      style={{
                        padding: '14px 18px', borderRadius: 12,
                        border: `2px solid ${selected ? brandColor : '#E2E8F0'}`,
                        background: selected ? `${brandColor}15` : 'white',
                        color: selected ? brandColor : '#374151',
                        fontWeight: selected ? 600 : 400, fontSize: 14,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        touchAction: 'manipulation',
                      }}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {/* text */}
            {current.type === 'text' && (
              <textarea
                value={(answers[current.id] as string) || ''}
                onChange={e => setAnswer(e.target.value)}
                placeholder='Escreva seu comentário ou sugestão aqui...'
                rows={4}
                style={{
                  width: '100%', padding: '14px 16px', border: '2px solid #E2E8F0', borderRadius: 12,
                  fontSize: 14, color: '#374151', resize: 'vertical', outline: 'none',
                  fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
                  transition: 'border-color 0.15s', minHeight: 100,
                }}
                onFocus={e => (e.target.style.borderColor = brandColor)}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
            )}
          </div>

          {/* botão Anterior */}
          {currentIndex > 0 && (
            <div style={{ marginTop: 16 }}>
              <button
                onClick={back}
                style={{ padding: '10px 20px', borderRadius: 10, border: '2px solid #E2E8F0', background: 'white', cursor: 'pointer', color: '#6B7280', fontSize: 14, transition: 'all 0.15s' }}
              >
                ← Anterior
              </button>
            </div>
          )}

          <div style={{ height: 16 }} />
        </div>
      </div>

      {/* Botão FIXO no rodapé — sempre visível */}
      {(canAdvance() || current.optional) && (
        <div style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '1px solid #E2E8F0', padding: '16px 24px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            {status === 'submitting' ? (
              <button disabled style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: '#E2E8F0', color: '#94A3B8', fontSize: 15, fontWeight: 700, cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div style={{ width: 18, height: 18, border: '2px solid #94A3B8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Enviando...
              </button>
            ) : (
              <button
                onClick={isLast ? submit : advance}
                style={{
                  width: '100%', padding: 16, borderRadius: 14, border: 'none',
                  background: brandColor, color: 'white',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  transition: 'opacity 0.2s', touchAction: 'manipulation',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {isLast ? 'Enviar respostas' : 'Próxima pergunta →'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Botão skip para opcionais sem resposta */}
      {!canAdvance() && current.optional && !isLast && (
        <div style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '1px solid #E2E8F0', padding: '16px 24px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <button
              onClick={advance}
              style={{ width: '100%', padding: 16, borderRadius: 14, border: '2px solid #E2E8F0', background: 'white', color: '#94A3B8', fontSize: 15, fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' }}
            >
              Pular pergunta →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
