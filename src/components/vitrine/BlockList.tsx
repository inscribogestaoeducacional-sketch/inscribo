// Lista reordenável de blocos da Vitrine (@dnd-kit, mesmo padrão do editor de
// perguntas em GestorSurveys). Cada item abre o formulário do seu tipo.
// Visual premium (etapa 3): faixa na cor do tipo, resumo em 2 linhas,
// elevação no hover (classe vit-card, estilos em Vitrine.tsx) e o bloco
// "flutuando" durante o arraste (DragOverlay com o mesmo cabeçalho).
import React, { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, ChevronDown, Eye, EyeOff, Copy, Trash2, Loader2, Check, AlertCircle,
  MessageCircle, GraduationCap, Link2, Type, Images, PlayCircle, MapPin, Clock, Megaphone, RectangleHorizontal, HelpCircle, Quote, Users, BarChart3, FileText, UserPlus, type LucideIcon,
} from 'lucide-react'
import { type BlockType, BLOCK_TYPES, blockSummary, blockDetail } from '../../lib/vitrine'
import BlockForm, { type BlockFormContext } from './BlockForms'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'invalid' | 'error'

export interface EditorBlock {
  key: string                 // chave estável no cliente (id do banco ou temporária)
  id: string | null           // null = ainda não salvo
  type: BlockType
  config: Record<string, any>
  is_visible: boolean
  capture_trigger_id: string | null
  state: SaveState
  error: string | null
}

export const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  whatsapp: MessageCircle, enroll: GraduationCap, link: Link2, text: Type,
  gallery: Images, video: PlayCircle, map: MapPin, hours: Clock, banner: RectangleHorizontal,
  faq: HelpCircle, testimonials: Quote, team: Users, stats: BarChart3, pdf: FileText, contact: UserPlus,
}

interface ListProps {
  blocks: EditorBlock[]
  openKey: string | null
  onToggleOpen: (key: string) => void
  onReorder: (fromKey: string, toKey: string) => void
  onChange: (key: string, patch: Record<string, any>) => void
  onToggleVisible: (key: string) => void
  onDuplicate: (key: string) => void
  onDelete: (key: string) => void
  formCtx: (b: EditorBlock) => BlockFormContext
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {props.blocks.map(b => <BlockItem key={b.key} block={b} open={props.openKey === b.key} {...props} />)}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.4,0,0.2,1)' }}>
        {active && (
          <div style={{ ...cardShell(active), boxShadow: '0 18px 40px rgba(15,23,42,.22), 0 4px 10px rgba(0,168,150,.12)', transform: 'rotate(-1deg)', cursor: 'grabbing' }}>
            <Header b={active} open={false} ghost />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function StateBadge({ b }: { b: EditorBlock }) {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', padding: '3px 8px', borderRadius: 999 }
  if (b.state === 'saving') return <span style={{ ...base, color: '#64748b', background: '#F1F5F9' }}><Loader2 size={12} className="animate-spin" /> Salvando</span>
  if (b.state === 'dirty') return <span style={{ ...base, color: '#94a3b8', background: '#F8FAFC' }}>Editando…</span>
  if (b.state === 'invalid') return <span style={{ ...base, color: '#B45309', background: '#FFFBEB' }}><AlertCircle size={12} /> {b.id ? 'Não salvo' : 'Incompleto'}</span>
  if (b.state === 'error') return <span style={{ ...base, color: '#dc2626', background: '#FEF2F2' }}><AlertCircle size={12} /> Erro ao salvar</span>
  return <span style={{ ...base, color: '#15803D', background: '#F0FDF4' }}><Check size={12} /> Salvo</span>
}

const cardShell = (b: EditorBlock): React.CSSProperties => ({
  background: '#fff', borderRadius: 14, position: 'relative', overflow: 'hidden',
  // Borda em propriedades separadas: o arraste troca estilo/cor sem misturar
  // com o atalho "border" (o React avisa que isso quebra estilo).
  borderWidth: 1, borderStyle: 'solid',
  borderColor: b.state === 'invalid' || b.state === 'error' ? '#FCD34D' : '#E2E8F0',
  opacity: b.is_visible ? 1 : 0.72,
})

// Cabeçalho do cartão (também usado no bloco "flutuante" do arraste).
function Header({ b, open, ghost, dragHandle, onToggleOpen, onToggleVisible }: {
  b: EditorBlock; open: boolean; ghost?: boolean
  dragHandle?: React.ReactNode; onToggleOpen?: () => void; onToggleVisible?: () => void
}) {
  const meta = BLOCK_TYPES[b.type]
  const Icon = BLOCK_ICONS[b.type]
  const tracking = !!b.capture_trigger_id && (b.type === 'enroll'
    ? b.config.mode === 'whatsapp'
    : b.type === 'whatsapp' && b.config.phone_source !== 'custom' && b.config.track_capture !== false)
  const iconBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff',
    cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', transition: T,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px 11px 16px' }}>
      {/* faixa na cor do tipo */}
      <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: meta.color, opacity: b.is_visible ? 1 : 0.4 }} />
      {dragHandle ?? <span style={{ ...iconBtn, border: 'none', color: '#94a3b8' }}><GripVertical size={16} /></span>}
      <button type="button" onClick={onToggleOpen} aria-expanded={open} tabIndex={ghost ? -1 : undefined}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon size={17} color={meta.color} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {meta.label}
            {!b.is_visible && <span style={{ color: '#64748b', textTransform: 'none', letterSpacing: 0 }}>· oculto</span>}
            {tracking && <span title="Gatilho ativo no Captação" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#DB2777', textTransform: 'none', letterSpacing: 0 }}><Megaphone size={11} /> Captação</span>}
          </span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {blockSummary(b.type, b.config)}
          </span>
          <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
            {blockDetail(b.type, b.config)}
          </span>
        </span>
        <StateBadge b={b} />
        <ChevronDown size={16} color="#94a3b8" style={{ flex: 'none', transform: open ? 'rotate(180deg)' : 'none', transition: T }} />
      </button>
      <button type="button" style={iconBtn} onClick={onToggleVisible} tabIndex={ghost ? -1 : undefined}
        title={b.is_visible ? 'Ocultar da página' : 'Mostrar na página'} aria-label={b.is_visible ? 'Ocultar bloco' : 'Mostrar bloco'}>
        {b.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
    </div>
  )
}

const T = 'all 0.18s cubic-bezier(0.4,0,0.2,1)'

function BlockItem({ block: b, open, onToggleOpen, onChange, onToggleVisible, onDuplicate, onDelete, formCtx }: ListProps & { block: EditorBlock; open: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: b.key })

  return (
    <div ref={setNodeRef} className="vit-card" style={{
      ...cardShell(b),
      transform: CSS.Transform.toString(transform), transition,
      // Lugar de origem enquanto o bloco "flutua" (DragOverlay).
      ...(isDragging ? { opacity: 0.35, borderStyle: 'dashed', borderColor: '#94d8cf', background: '#F0FDFA' } : {}),
    }}>
      <Header b={b} open={open}
        onToggleOpen={() => onToggleOpen(b.key)} onToggleVisible={() => onToggleVisible(b.key)}
        dragHandle={
          <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" aria-label="Arrastar para reordenar"
            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'grab', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', touchAction: 'none' }}>
            <GripVertical size={16} />
          </button>
        } />

      {open && (
        <div style={{ padding: '4px 16px 16px 20px', borderTop: '1px solid #F1F5F9', animation: 'slideUp 0.2s ease' }}>
          <div style={{ paddingTop: 14 }}>
            <BlockForm type={b.type} config={b.config} ctx={formCtx(b)} onChange={patch => onChange(b.key, patch)} />
          </div>
          {b.error && (
            <p role="alert" style={{ margin: '12px 0 0', fontSize: 12, color: b.state === 'error' ? '#dc2626' : '#B45309', display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flex: 'none', marginTop: 1 }} /> {b.error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => onDuplicate(b.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer', transition: T }}>
              <Copy size={13} /> Duplicar
            </button>
            <button type="button" onClick={() => onDelete(b.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#fff', fontSize: 12, fontWeight: 600, color: '#dc2626', cursor: 'pointer', transition: T }}>
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
