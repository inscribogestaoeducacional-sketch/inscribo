// Lista de blocos da Vitrine: uma linha por bloco (clicar abre a edição no
// lugar da lista — ver BlockEditor), reordenável pela alça (@dnd-kit, com o
// bloco "levantando" no DragOverlay) e com "+" entre dois blocos pra inserir
// ali. A situação de cada bloco vira etiqueta (incompleto, oculto, agenda,
// Captação, efeito) em vez de faixa de aviso. Estilos de hover/animação: no
// <style> de Vitrine.tsx (classes vit-*).
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Eye, EyeOff, Loader2, AlertCircle, Plus, Sparkles, EyeOff as Hidden,
  MessageCircle, GraduationCap, Link2, Type, Images, PlayCircle, MapPin, Clock, Megaphone, RectangleHorizontal, CalendarClock, HelpCircle, Quote, Users, BarChart3, FileText, UserPlus, type LucideIcon,
} from 'lucide-react'
import { type BlockType, BLOCK_TYPES, blockSummary, blockDetail, scheduleLabel, scheduleState, EFFECTS } from '../../lib/vitrine'
import { DS } from './ui'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'invalid' | 'error'

export interface EditorBlock {
  key: string                 // chave estável no cliente (id do banco ou temporária)
  id: string | null           // null = ainda não salvo
  type: BlockType
  config: Record<string, any>
  is_visible: boolean
  capture_trigger_id: string | null
  visible_from?: string | null      // agenda (ISO); vazio = sem limite
  visible_until?: string | null
  state: SaveState
  error: string | null
}

export const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  whatsapp: MessageCircle, enroll: GraduationCap, link: Link2, text: Type,
  gallery: Images, video: PlayCircle, map: MapPin, hours: Clock, banner: RectangleHorizontal,
  faq: HelpCircle, testimonials: Quote, team: Users, stats: BarChart3, pdf: FileText, contact: UserPlus,
}

// Etiquetas: cores de estado do painel (âmbar = atenção, vermelho = erro,
// rosa = Captação, teal = recurso ligado, cinza = neutro).
const TAG = {
  warn:  { color: '#D97706', background: '#FEF3C7' },
  error: { color: '#DC2626', background: '#FEF2F2' },
  cap:   { color: '#DB2777', background: '#FCE7F3' },
  on:    { color: '#00A896', background: '#E6F7F5' },
  muted: { color: '#64748B', background: '#F1F5F9' },
}
function Tag({ tone, icon: Icon, children, title }: { tone: keyof typeof TAG; icon: LucideIcon; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} style={{ ...TAG[tone], display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <Icon size={11} /> {children}
    </span>
  )
}

export function blockTags(b: EditorBlock): React.ReactNode[] {
  const out: React.ReactNode[] = []
  if (b.state === 'error') out.push(<Tag key="e" tone="error" icon={AlertCircle} title={b.error || undefined}>Erro ao salvar</Tag>)
  else if (b.state === 'invalid') out.push(<Tag key="i" tone="warn" icon={AlertCircle} title={b.error || undefined}>{b.id ? 'Não salvo' : 'Incompleto'}</Tag>)
  if (!b.is_visible) out.push(<Tag key="h" tone="muted" icon={Hidden}>Oculto</Tag>)
  const sched = scheduleLabel(b.visible_from, b.visible_until)
  if (sched) out.push(<Tag key="s" tone={scheduleState(b.visible_from, b.visible_until) === 'expired' ? 'error' : 'warn'} icon={CalendarClock}>{sched}</Tag>)
  const tracking = !!b.capture_trigger_id && (b.type === 'enroll' ? b.config.mode === 'whatsapp'
    : b.type === 'whatsapp' && b.config.phone_source !== 'custom' && b.config.track_capture !== false)
  if (tracking) out.push(<Tag key="c" tone="cap" icon={Megaphone} title="Gatilho ativo no Captação">Captação</Tag>)
  const fx = EFFECTS.find(e => e.value === b.config.effect && e.value !== 'none')
  if (fx) out.push(<Tag key="f" tone="on" icon={Sparkles}>{fx.label}</Tag>)
  return out
}

interface ListProps {
  blocks: EditorBlock[]
  flashKey: string | null            // bloco que acabou de voltar da edição / entrar
  enterKey: string | null            // bloco recém-adicionado (animação de entrada)
  onSelect: (key: string) => void
  onReorder: (fromKey: string, toKey: string) => void
  onToggleVisible: (key: string) => void
  onInsertAt: (index: number) => void
}

export default function BlockList(props: ListProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragStart = (e: DragStartEvent) => setActiveKey(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveKey(null)
    if (e.over && e.active.id !== e.over.id) props.onReorder(String(e.active.id), String(e.over.id))
  }
  const active = props.blocks.find(b => b.key === activeKey)
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveKey(null)}>
      <SortableContext items={props.blocks.map(b => b.key)} strategy={verticalListSortingStrategy}>
        <div role="list" aria-label="Blocos da página" style={{ display: 'flex', flexDirection: 'column' }}>
          {props.blocks.map((b, i) => (
            <React.Fragment key={b.key}>
              {i > 0 && (
                <div className="vit-gap">
                  <button type="button" onClick={() => props.onInsertAt(i)} aria-label={`Inserir bloco aqui (posição ${i + 1})`} title="Inserir bloco aqui">
                    <Plus size={13} />
                  </button>
                </div>
              )}
              <BlockItem block={b} {...props} />
            </React.Fragment>
          ))}
        </div>
      </SortableContext>
      {/* No body: um ancestral com transform (animação da área) viraria a
          referência do position:fixed do bloco levantado e deslocaria a medida. */}
      {createPortal(<DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.4,0,0.2,1)' }}>
        {active && (
          // O dnd-kit mede o elemento de fora: a inclinação/ampliação fica num
          // filho, senão a medida sai inflada e o bloco "cai" no lugar errado.
          <div>
            <div className="vit-card vit-lifted" style={cardShell(active)}>
              <Row b={active} ghost />
            </div>
          </div>
        )}
      </DragOverlay>, document.body)}
    </DndContext>
  )
}

const cardShell = (b: EditorBlock): React.CSSProperties => ({
  background: '#fff', borderRadius: DS.r.lg, position: 'relative',
  // Borda em propriedades separadas: o arraste troca estilo/cor sem misturar
  // com o atalho "border" (o React avisa que isso quebra estilo).
  borderWidth: 1, borderStyle: 'solid',
  borderColor: b.state === 'invalid' ? '#FDE68A' : b.state === 'error' ? '#FECACA' : '#E2E8F0',
})

// Conteúdo da linha (também usado no bloco "levantado" do arraste).
function Row({ b, ghost, dragHandle, onToggleVisible }: {
  b: EditorBlock; ghost?: boolean; dragHandle?: React.ReactNode; onToggleVisible?: () => void
}) {
  const meta = BLOCK_TYPES[b.type]
  const Icon = BLOCK_ICONS[b.type]
  const tags = blockTags(b)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 6px', opacity: b.is_visible ? 1 : 0.62, transition: DS.ease }}>
      {dragHandle ?? <span className="vit-grip" style={{ width: 24, display: 'flex', justifyContent: 'center', color: '#94A3B8' }}><GripVertical size={16} /></span>}
      <span style={{ width: 40, height: 40, borderRadius: DS.r.md, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon size={18} color={meta.color} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: '#1e2d6b', letterSpacing: '-0.01em', lineHeight: 1.35 }}>
          <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{blockSummary(b.type, b.config)}</span>
          {b.state === 'saving' && <Loader2 size={13} color="#94A3B8" className="animate-spin" aria-label="Salvando" />}
        </span>
        <span style={{ display: 'block', fontSize: 12.5, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
          {meta.label} · {blockDetail(b.type, b.config)}
        </span>
      </span>
      {tags.length > 0 && <span className="vit-tags" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '46%' }}>{tags}</span>}
      <button type="button" className="vit-icon" onClick={e => { e.stopPropagation(); onToggleVisible?.() }} tabIndex={ghost ? -1 : undefined}
        title={b.is_visible ? 'Ocultar da página' : 'Mostrar na página'} aria-label={b.is_visible ? 'Ocultar bloco' : 'Mostrar bloco'}
        style={{ width: 32, height: 32, borderRadius: DS.r.sm, border: 'none', background: 'transparent', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', cursor: 'pointer' }}>
        {b.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </div>
  )
}

function BlockItem({ block: b, flashKey, enterKey, onSelect, onToggleVisible }: ListProps & { block: EditorBlock }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: b.key })
  const cls = ['vit-card', flashKey === b.key ? 'vit-flash' : '', enterKey === b.key ? 'vit-enter' : ''].filter(Boolean).join(' ')
  return (
    <div ref={setNodeRef} role="listitem" className={cls} style={{
      ...cardShell(b), cursor: 'pointer',
      transform: CSS.Transform.toString(transform), transition,
      // Lugar de origem enquanto o bloco "flutua" (DragOverlay).
      ...(isDragging ? { opacity: 0.4, borderStyle: 'dashed', borderColor: '#94A3B8', background: '#F8FAFC', boxShadow: 'none' } : {}),
    }}
      onClick={() => onSelect(b.key)}>
      <div role="button" tabIndex={0} aria-label={`Editar ${BLOCK_TYPES[b.type].label}: ${blockSummary(b.type, b.config)}`}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.key) } }}
        style={{ outline: 'none', borderRadius: DS.r.lg }} className="vit-card-focus">
        <Row b={b} onToggleVisible={() => onToggleVisible(b.key)}
          dragHandle={
            <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" aria-label="Arrastar para reordenar" className="vit-grip"
              onClick={e => e.stopPropagation()}
              style={{ width: 24, height: 36, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'grab', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', touchAction: 'none' }}>
              <GripVertical size={16} />
            </button>
          } />
      </div>
    </div>
  )
}
