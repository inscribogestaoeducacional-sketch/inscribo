// Lista de itens reordenável dentro de um bloco (fotos da galeria hoje;
// depoimentos, perguntas do FAQ, equipe, números e unidades nas próximas
// etapas). Arrastar pela alça (ou teclado), duplicar, remover; cada item
// abre o próprio formulário. Os itens ficam no config do bloco sem campo
// extra: a chave estável de cada um vive só aqui (keysRef), alinhada a cada
// mudança feita pela própria lista.
import React, { useRef, useState } from 'react'
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { DS } from './ui'

let keySeq = 0
const newKey = () => `it-${++keySeq}`
const T = 'all 0.18s cubic-bezier(0.4,0,0.2,1)'

interface Props<T> {
  items: T[]
  onChange: (items: T[]) => void
  itemLabel: (item: T, index: number) => string       // título do item fechado
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode
  thumb?: (item: T) => React.ReactNode                 // miniatura à esquerda (ex.: foto)
  newItem?: () => T                                    // botão "adicionar" padrão
  addSlot?: React.ReactNode                            // ou um "adicionar" próprio (ex.: upload)
  addLabel?: string
  max: number
  noun: string                                         // "foto", "pergunta"...
  collapsible?: boolean                                // itens com formulário que abre
}

export default function ItemListEditor<T>({
  items, onChange, itemLabel, renderItem, thumb, newItem, addSlot, addLabel, max, noun, collapsible = true,
}: Props<T>) {
  // Chaves estáveis alinhadas às posições (recriadas se a lista mudar de
  // tamanho por fora — ex.: recarregar a página).
  const keysRef = useRef<string[]>([])
  if (keysRef.current.length !== items.length) keysRef.current = items.map(() => newKey())
  const keys = keysRef.current
  // Lista com um item só (ex.: bloco recém-criado com a primeira pergunta
  // vazia) já abre o formulário dele.
  const [openKey, setOpenKey] = useState<string | null>(() => (items.length === 1 ? keys[0] : null))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function commit(next: T[], nextKeys: string[]) { keysRef.current = nextKeys; onChange(next) }
  const update = (i: number, patch: Partial<T>) => commit(items.map((x, k) => (k === i ? { ...x, ...patch } : x)), keys)
  const remove = (i: number) => commit(items.filter((_, k) => k !== i), keys.filter((_, k) => k !== i))
  const duplicate = (i: number) => {
    if (items.length >= max) return
    const nk = newKey()
    commit([...items.slice(0, i + 1), JSON.parse(JSON.stringify(items[i])), ...items.slice(i + 1)],
           [...keys.slice(0, i + 1), nk, ...keys.slice(i + 1)])
    setOpenKey(nk)
  }
  const add = () => {
    if (!newItem || items.length >= max) return
    const nk = newKey()
    commit([...items, newItem()], [...keys, nk])
    setOpenKey(nk)
  }
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = keys.indexOf(String(e.active.id)), to = keys.indexOf(String(e.over.id))
    if (from < 0 || to < 0) return
    commit(arrayMove(items, from, to), arrayMove(keys, from, to))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: items.length >= max ? '#B45309' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{items.length}/{max}</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, i) => (
              <Item key={keys[i]} id={keys[i]} label={itemLabel(item, i)} thumb={thumb?.(item)} noun={noun}
                open={!collapsible || openKey === keys[i]} collapsible={collapsible}
                onToggle={() => setOpenKey(o => (o === keys[i] ? null : keys[i]))}
                onRemove={() => remove(i)} onDuplicate={items.length < max ? () => duplicate(i) : undefined}>
                {renderItem(item, patch => update(i, patch), i)}
              </Item>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {items.length < max && (addSlot ?? (newItem && (
        <button type="button" onClick={add}
          style={{ marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: DS.r.md,
            border: '1.5px dashed #94d8cf', background: '#F0FDFA', color: '#0F766E', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: T }}>
          <Plus size={14} /> {addLabel || `Adicionar ${noun}`}
        </button>
      )))}
    </div>
  )
}

function Item({ id, label, thumb, noun, open, collapsible, onToggle, onRemove, onDuplicate, children }: {
  id: string; label: string; thumb?: React.ReactNode; noun: string; open: boolean; collapsible: boolean
  onToggle: () => void; onRemove: () => void; onDuplicate?: () => void; children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const icon: React.CSSProperties = { width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', transition: T }
  return (
    <div role="listitem" ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 5 : undefined,
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: DS.r.md,
      boxShadow: isDragging ? DS.shadowLg : DS.shadowSm,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" aria-label={`Arrastar ${noun}`}
          style={{ ...icon, border: 'none', cursor: 'grab', color: '#94a3b8', touchAction: 'none' }}>
          <GripVertical size={15} />
        </button>
        {thumb}
        {collapsible ? (
          <button type="button" onClick={onToggle} aria-expanded={open}
            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
            <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            <ChevronDown size={15} color="#94a3b8" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: T }} />
          </button>
        ) : <div style={{ flex: 1, minWidth: 0 }}>{children}</div>}
        {onDuplicate && <button type="button" style={icon} onClick={onDuplicate} title="Duplicar" aria-label={`Duplicar ${noun}`}><Copy size={13} /></button>}
        <button type="button" style={{ ...icon, color: '#dc2626' }} onClick={onRemove} title="Remover" aria-label={`Remover ${noun}`}><Trash2 size={13} /></button>
      </div>
      {collapsible && open && <div style={{ padding: '4px 12px 12px', borderTop: '1px solid #F1F5F9', animation: 'slideUp 0.18s ease' }}>{children}</div>}
    </div>
  )
}
