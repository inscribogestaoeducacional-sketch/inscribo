// Lista reordenável de blocos da Vitrine (@dnd-kit, mesmo padrão do editor de
// perguntas em GestorSurveys). Cada item abre o formulário do seu tipo.
import React from 'react'
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, ChevronDown, Eye, EyeOff, Copy, Trash2, Loader2, Check, AlertCircle,
  MessageCircle, GraduationCap, Link2, Type, Images, PlayCircle, MapPin, Clock, Megaphone, type LucideIcon,
} from 'lucide-react'
import { type BlockType, BLOCK_TYPES, blockSummary } from '../../lib/vitrine'
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
  gallery: Images, video: PlayCircle, map: MapPin, hours: Clock,
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) props.onReorder(String(e.active.id), String(e.over.id))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={props.blocks.map(b => b.key)} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {props.blocks.map(b => <BlockItem key={b.key} block={b} open={props.openKey === b.key} {...props} />)}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function StateBadge({ b }: { b: EditorBlock }) {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }
  if (b.state === 'saving') return <span style={{ ...base, color: '#64748b' }}><Loader2 size={12} className="animate-spin" /> Salvando</span>
  if (b.state === 'dirty') return <span style={{ ...base, color: '#94a3b8' }}>Editando…</span>
  if (b.state === 'invalid') return <span style={{ ...base, color: '#B45309' }}><AlertCircle size={12} /> {b.id ? 'Não salvo' : 'Incompleto'}</span>
  if (b.state === 'error') return <span style={{ ...base, color: '#dc2626' }}><AlertCircle size={12} /> Erro ao salvar</span>
  return <span style={{ ...base, color: '#16A34A' }}><Check size={12} /> Salvo</span>
}

function BlockItem({ block: b, open, onToggleOpen, onChange, onToggleVisible, onDuplicate, onDelete, formCtx }: ListProps & { block: EditorBlock; open: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: b.key })
  const meta = BLOCK_TYPES[b.type]
  const Icon = BLOCK_ICONS[b.type]
  const tracking = !!b.capture_trigger_id && (b.type === 'enroll'
    ? b.config.mode === 'whatsapp'
    : b.type === 'whatsapp' && b.config.phone_source !== 'custom' && b.config.track_capture !== false)

  const iconBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff',
    cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
  }

  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform), transition,
      background: '#fff', borderRadius: 14, position: 'relative', zIndex: isDragging ? 10 : undefined,
      border: `1px solid ${b.state === 'invalid' || b.state === 'error' ? '#FCD34D' : '#e2e8f0'}`,
      boxShadow: isDragging ? '0 12px 28px rgba(15,23,42,.18)' : 'none',
      opacity: b.is_visible ? 1 : 0.7,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label="Arrastar para reordenar"
          style={{ ...iconBtn, border: 'none', cursor: 'grab', color: '#94a3b8', touchAction: 'none' }}>
          <GripVertical size={16} />
        </button>
        <button type="button" onClick={() => onToggleOpen(b.key)} aria-expanded={open}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Icon size={16} color={meta.color} />
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
          </span>
          <StateBadge b={b} />
          <ChevronDown size={16} color="#94a3b8" style={{ flex: 'none', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
        <button type="button" style={iconBtn} onClick={() => onToggleVisible(b.key)}
          title={b.is_visible ? 'Ocultar da página' : 'Mostrar na página'} aria-label={b.is_visible ? 'Ocultar bloco' : 'Mostrar bloco'}>
          {b.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      {open && (
        <div style={{ padding: '4px 16px 16px', borderTop: '1px solid #f1f5f9' }}>
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
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
              <Copy size={13} /> Duplicar
            </button>
            <button type="button" onClick={() => onDelete(b.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#fff', fontSize: 12, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}>
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
