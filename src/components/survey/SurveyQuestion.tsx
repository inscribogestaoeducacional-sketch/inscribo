import React from 'react'

export type SurveyQuestionType = 'scale' | 'multiple_choice' | 'text' | 'nps'

export interface SurveyQuestionOptions {
  min?: number
  max?: number
  min_label?: string
  max_label?: string
  options?: string[]
}

export interface SurveyQuestionData {
  id: string
  question_type: SurveyQuestionType
  title: string
  description?: string | null
  required: boolean
  options?: SurveyQuestionOptions | null
  order_index?: number
}

interface Props {
  question: SurveyQuestionData
  value: number | string | undefined
  onChange: (value: number | string) => void
  brandColor: string
}

function npsColor(n: number): string {
  if (n <= 6) return '#EF4444'
  if (n <= 8) return '#F59E0B'
  return '#10B981'
}

// Renderiza apenas o controle de resposta. Título/descrição/contador de
// pergunta ficam no header compartilhado do formulário (SatisfactionPage),
// que já existe tanto para o modo padrão quanto para o custom.
export default function SurveyQuestion({ question, value, onChange, brandColor }: Props) {
  const opts = question.options || {}

  return (
    <div>
      {question.question_type === 'scale' && (() => {
        const min = opts.min ?? 1
        const max = opts.max ?? 5
        const nums = Array.from({ length: max - min + 1 }, (_, i) => i + min)
        return (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${nums.length}, 1fr)`, gap: 8, marginBottom: 12 }}>
              {nums.map(n => {
                const selected = value === n
                return (
                  <button
                    key={n}
                    onClick={() => onChange(n)}
                    style={{
                      padding: '14px 0', borderRadius: 12,
                      border: `2px solid ${selected ? brandColor : '#E2E8F0'}`,
                      background: selected ? brandColor : 'white',
                      color: selected ? 'white' : '#374151',
                      fontWeight: selected ? 700 : 500, fontSize: 18,
                      cursor: 'pointer', transition: 'all 0.15s', touchAction: 'manipulation',
                    }}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
            {(opts.min_label || opts.max_label) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' }}>
                <span>{opts.min_label}</span>
                <span>{opts.max_label}</span>
              </div>
            )}
          </div>
        )
      })()}

      {question.question_type === 'nps' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 4, marginBottom: 12 }}>
            {Array.from({ length: 11 }, (_, n) => n).map(n => {
              const selected = value === n
              const color = npsColor(n)
              return (
                <button
                  key={n}
                  onClick={() => onChange(n)}
                  style={{
                    padding: '10px 0', borderRadius: 8,
                    border: `2px solid ${selected ? color : '#E2E8F0'}`,
                    background: selected ? color : 'white',
                    color: selected ? 'white' : '#374151',
                    fontWeight: selected ? 700 : 500, fontSize: 13,
                    cursor: 'pointer', transition: 'all 0.15s', touchAction: 'manipulation',
                  }}
                >
                  {n}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' }}>
            <span>{opts.min_label || 'Nada provável'}</span>
            <span>{opts.max_label || 'Muito provável'}</span>
          </div>
        </div>
      )}

      {question.question_type === 'multiple_choice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(opts.options || []).map(opt => {
            const selected = value === opt
            return (
              <button
                key={opt}
                onClick={() => onChange(opt)}
                style={{
                  padding: '14px 18px', borderRadius: 12,
                  border: `2px solid ${selected ? brandColor : '#E2E8F0'}`,
                  background: selected ? `${brandColor}15` : 'white',
                  color: selected ? brandColor : '#374151',
                  fontWeight: selected ? 600 : 400, fontSize: 14,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', touchAction: 'manipulation',
                }}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {question.question_type === 'text' && (
        <div>
          <textarea
            value={(value as string) || ''}
            onChange={e => onChange(e.target.value)}
            placeholder='Escreva sua resposta aqui...'
            rows={4}
            maxLength={1000}
            style={{
              width: '100%', padding: '14px 16px', border: '2px solid #E2E8F0', borderRadius: 12,
              fontSize: 14, color: '#374151', resize: 'vertical', outline: 'none',
              fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box', minHeight: 100,
            }}
          />
          <p style={{ fontSize: 11, color: '#CBD5E1', textAlign: 'right', margin: '4px 0 0' }}>
            {((value as string) || '').length}/1000
          </p>
        </div>
      )}
    </div>
  )
}
