import React from 'react'
import {
  Plus, Eye, Send, Pencil, Trash2, GripVertical, ArrowUp, ArrowDown, X, ClipboardList, Star, HelpCircle, Link2,
} from 'lucide-react'
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import HeaderAction from '../mobile/HeaderAction'
import { cardBtn } from '../mobile/StatStrip'
import { Sheet, Toggle, IconBtn, StatusBadge } from './ui'
import {
  Survey, QuestionRow, QUESTION_TYPES, labelStyle, inputStyle, card, emptyQuestionForm,
} from './surveyShared'

export type QuestionForm = ReturnType<typeof emptyQuestionForm>

// ─── cartão de uma pergunta (arrastável) ───────────────────────────────────
function QuestionCard({ question, index, total, onEdit, onDelete, onMove }: {
  question: QuestionRow; index: number; total: number
  onEdit: () => void; onDelete: () => void; onMove: (dir: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })
  const t = QUESTION_TYPES.find(x => x.type === question.question_type)
  const QIcon = t?.icon || Star
  const opts = question.options || {}
  return (
    <div ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        background: isDragging ? '#F0FDFB' : '#fff', border: `1px solid ${isDragging ? '#05907B' : '#E3E8F0'}`, borderRadius: 18,
        padding: 14, display: 'flex', flexDirection: 'column', gap: 10, opacity: isDragging ? 0.75 : 1,
        boxShadow: isDragging ? '0 12px 30px -12px rgba(26,43,74,.35)' : '0 1px 2px rgba(26,43,74,.04)',
        position: 'relative', zIndex: isDragging ? 2 : 1,
      }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span {...attributes} {...listeners} aria-label="Arrastar para reordenar" title="Arrastar para reordenar"
          style={{ cursor: 'grab', touchAction: 'none', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 40, flexShrink: 0, margin: '-2px 0 0 -6px' }}>
          <GripVertical size={18} />
        </span>
        <span style={{ width: 28, height: 28, borderRadius: 10, background: '#E6F7F5', color: '#00695F', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1A2B4A', lineHeight: 1.35, wordBreak: 'break-word' }}>{question.title}</p>
          {question.description && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#5B6B86', lineHeight: 1.4 }}>{question.description}</p>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#475569', background: '#F1F5F9', padding: '3px 9px', borderRadius: 999 }}>
          <QIcon size={12} /> {t?.label}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: question.required ? '#FEF2F2' : '#F1F5F9', color: question.required ? '#B91C1C' : '#64748B' }}>
          {question.required ? 'Obrigatória' : 'Opcional'}
        </span>
        {(question.question_type === 'scale' || question.question_type === 'nps') && (opts.min_label || opts.max_label) && (
          <span style={{ fontSize: 11.5, color: '#5B6B86', padding: '3px 0' }}>
            {opts.min_label || '—'} → {opts.max_label || '—'}
          </span>
        )}
      </div>

      {question.question_type === 'multiple_choice' && (opts.options?.length ?? 0) > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {opts.options!.map((o, i) => (
            <span key={i} style={{ fontSize: 12, color: '#1E40AF', background: '#EFF6FF', padding: '3px 10px', borderRadius: 999 }}>{o}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={onEdit} className="aion-tap" style={{ ...cardBtn('ghost'), flex: 1, minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Pencil size={14} /> Editar
        </button>
        <IconBtn label="Subir pergunta" onClick={() => onMove(-1)} disabled={index === 0}><ArrowUp size={16} /></IconBtn>
        <IconBtn label="Descer pergunta" onClick={() => onMove(1)} disabled={index === total - 1}><ArrowDown size={16} /></IconBtn>
        <IconBtn label="Excluir pergunta" onClick={onDelete} danger><Trash2 size={16} /></IconBtn>
      </div>
    </div>
  )
}

// ─── editor de perguntas ───────────────────────────────────────────────────
export function EditorSheet({ survey, questions, loading, redirectDraft, onRedirectChange, onSaveRedirect, onClose, onPreview, onPublish, onAdd, onEdit, onDelete, onMove, onDragEnd }: {
  survey: Survey
  questions: QuestionRow[]
  loading: boolean
  redirectDraft: string
  onRedirectChange: (v: string) => void
  onSaveRedirect: () => void
  onClose: () => void
  onPreview: () => void
  onPublish: () => void
  onAdd: () => void
  onEdit: (q: QuestionRow) => void
  onDelete: (q: QuestionRow) => void
  onMove: (id: string, dir: -1 | 1) => void
  onDragEnd: (e: DragEndEvent) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  )
  const isDraft = survey.status === 'draft'
  return (
    <Sheet
      onClose={onClose} maxWidth={640} icon={ClipboardList}
      title={survey.title}
      subtitle={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {isDraft ? 'Rascunho — publique quando as perguntas estiverem prontas' : survey.status === 'active' ? 'Pesquisa ativa' : 'Pesquisa encerrada'}
      </span>}
      headerActions={<>
        <HeaderAction primary icon={Plus} label="Adicionar pergunta" onClick={onAdd} />
        <HeaderAction icon={Eye} label="Visualizar" title="Visualizar pesquisa" onClick={onPreview} />
      </>}
      footer={<>
        <button type="button" onClick={onClose} style={cardBtn('ghost')}>{isDraft ? 'Salvar e fechar' : 'Fechar'}</button>
        {isDraft && (
          <button type="button" onClick={onPublish} style={{ ...cardBtn('primary'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Send size={15} /> Publicar pesquisa
          </button>
        )}
      </>}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#1A2B4A' }}>
          {loading ? 'Carregando perguntas...' : `${questions.length} pergunta${questions.length !== 1 ? 's' : ''}`}
        </p>
        <StatusBadge status={survey.status} />
      </div>

      {!loading && (
        <>
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {questions.map((q, i) => (
                  <QuestionCard key={q.id} question={q} index={i} total={questions.length}
                    onEdit={() => onEdit(q)} onDelete={() => onDelete(q)} onMove={dir => onMove(q.id, dir)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {questions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 16px', background: '#fff', borderRadius: 18, border: '1.5px dashed #BDEBE4' }}>
              <span style={{ width: 48, height: 48, borderRadius: 16, background: '#E6F7F5', color: '#05907B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><HelpCircle size={22} /></span>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1A2B4A' }}>Nenhuma pergunta ainda</p>
              <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#5B6B86' }}>Adicione ao menos uma pergunta para poder publicar.</p>
              <button type="button" onClick={onAdd} style={{ ...cardBtn('primary'), flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Adicionar pergunta</button>
            </div>
          )}

          {questions.length > 0 && (
            <button type="button" onClick={onAdd} className="aion-tap"
              style={{ ...cardBtn('ghost'), flex: '0 0 auto', width: '100%', border: '1.5px dashed #BDEBE4', color: '#00695F', background: '#F0FDFB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Plus size={16} /> Adicionar pergunta
            </button>
          )}

          <div style={{ ...card, padding: 14 }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}><Link2 size={13} /> Para onde levar quem terminar (opcional)</label>
            <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#5B6B86', lineHeight: 1.4 }}>Endereço da página que abre depois que a pessoa envia a resposta.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={redirectDraft} onChange={e => onRedirectChange(e.target.value)} placeholder="https://..." inputMode="url" style={{ ...inputStyle, flex: 1 }} />
              <button type="button" onClick={onSaveRedirect} style={{ ...cardBtn('ghost'), flex: '0 0 auto', minWidth: 84 }}>Salvar</button>
            </div>
          </div>
        </>
      )}
    </Sheet>
  )
}

// ─── adicionar / editar uma pergunta ───────────────────────────────────────
export function QuestionSheet({ isNew, form, setForm, onClose, onSave }: {
  isNew: boolean
  form: QuestionForm
  setForm: React.Dispatch<React.SetStateAction<QuestionForm>>
  onClose: () => void
  onSave: () => void
}) {
  const filledOptions = form.options.filter(o => o.trim()).length
  const needsOptions = form.question_type === 'multiple_choice' && filledOptions < 2
  const canSave = !!form.title.trim() && !needsOptions
  return (
    <Sheet
      z={10000} maxWidth={520} onClose={onClose} icon={HelpCircle}
      title={isNew ? 'Nova pergunta' : 'Editar pergunta'}
      subtitle="Escolha o tipo de resposta e escreva a pergunta"
      footer={<>
        <button type="button" onClick={onClose} style={cardBtn('ghost')}>Cancelar</button>
        <button type="button" onClick={onSave} disabled={!canSave} style={{ ...cardBtn('primary'), opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}>
          {isNew ? 'Adicionar pergunta' : 'Salvar pergunta'}
        </button>
      </>}
    >
      <div style={{ ...card, padding: 14 }}>
        <label style={labelStyle}>Como a pessoa vai responder?</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {QUESTION_TYPES.map(t => {
            const Icon = t.icon
            const active = form.question_type === t.type
            return (
              <button key={t.type} type="button" onClick={() => setForm(q => ({ ...q, question_type: t.type }))} className="aion-tap"
                style={{ flex: '1 1 150px', minHeight: 46, padding: '10px 12px', borderRadius: 14, border: `2px solid ${active ? '#05907B' : '#E3E8F0'}`, background: active ? '#E6F7F5' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', color: active ? '#00695F' : '#5B6B86', textAlign: 'left' }}>
                <Icon size={16} /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>Pergunta *</label>
          <textarea value={form.title} onChange={e => setForm(q => ({ ...q, title: e.target.value }))} rows={3}
            placeholder="Ex: Como você avalia a comunicação da escola?" style={{ ...inputStyle, resize: 'vertical', minHeight: 84, lineHeight: 1.4 }} />
        </div>
        <div>
          <label style={labelStyle}>Explicação (opcional)</label>
          <input value={form.description} onChange={e => setForm(q => ({ ...q, description: e.target.value }))} placeholder="Uma dica para ajudar quem vai responder" style={inputStyle} />
        </div>

        {(form.question_type === 'scale' || form.question_type === 'nps') && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ flex: '1 1 150px' }}>
              <label style={labelStyle}>Texto da nota mais baixa</label>
              <input value={form.min_label} onChange={e => setForm(q => ({ ...q, min_label: e.target.value }))} placeholder={form.question_type === 'nps' ? 'Nada provável' : 'Péssimo'} style={inputStyle} />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label style={labelStyle}>Texto da nota mais alta</label>
              <input value={form.max_label} onChange={e => setForm(q => ({ ...q, max_label: e.target.value }))} placeholder={form.question_type === 'nps' ? 'Muito provável' : 'Ótimo'} style={inputStyle} />
            </div>
          </div>
        )}

        {form.question_type === 'multiple_choice' && (
          <div>
            <label style={labelStyle}>Opções de resposta (mínimo 2)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={opt} onChange={e => { const opts = [...form.options]; opts[i] = e.target.value; setForm(q => ({ ...q, options: opts })) }} placeholder={`Opção ${i + 1}`} style={{ ...inputStyle, flex: 1 }} />
                  {form.options.length > 2 && (
                    <IconBtn label={`Remover opção ${i + 1}`} danger onClick={() => setForm(q => ({ ...q, options: q.options.filter((_, fi) => fi !== i) }))}><X size={16} /></IconBtn>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setForm(q => ({ ...q, options: [...q.options, ''] }))} className="aion-tap"
                style={{ ...cardBtn('ghost'), flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#00695F' }}>
                <Plus size={15} /> Adicionar opção
              </button>
              {needsOptions && <p style={{ margin: 0, fontSize: 12, color: '#B45309' }}>Preencha pelo menos 2 opções para salvar.</p>}
            </div>
          </div>
        )}
      </div>

      <div style={{ ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Resposta obrigatória</p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#5B6B86' }}>{form.required ? 'A pessoa precisa responder para enviar.' : 'Pode deixar em branco.'}</p>
        </div>
        <Toggle on={form.required} label="Resposta obrigatória" onChange={() => setForm(q => ({ ...q, required: !q.required }))} />
      </div>
    </Sheet>
  )
}
