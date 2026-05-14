import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Plus, Save, Trash2, ArrowLeft, Loader2, Check,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
type NodeType = 'start' | 'message' | 'question' | 'menu' | 'transfer'
              | 'condition' | 'action' | 'wait' | 'end'

interface MenuOption { id: string; number: number; text: string }

interface FlowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: {
    text?: string
    imageUrl?: string
    variable?: string
    menuText?: string
    options?: MenuOption[]
    assigneeId?: string
    assigneeName?: string
    transferMessage?: string
    conditionType?: 'business_hours' | 'keyword' | 'first_message'
    keyword?: string
    actionType?: 'create_lead' | 'add_tag' | 'link_lead'
    tag?: string
    seconds?: number
  }
}

interface FlowEdge {
  id: string
  from: string
  fromPort: string   // 'output' | 'true' | 'false' | menu-option-id
  to: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const NODE_W = 224

const NODE_DEFS: { type: NodeType; emoji: string; label: string; color: string; bg: string }[] = [
  { type: 'message',   emoji: '💬', label: 'Mensagem',   color: '#3B82F6', bg: '#EFF6FF' },
  { type: 'question',  emoji: '❓', label: 'Pergunta',   color: '#8B5CF6', bg: '#F5F3FF' },
  { type: 'menu',      emoji: '📋', label: 'Menu',       color: '#F59E0B', bg: '#FFFBEB' },
  { type: 'transfer',  emoji: '👤', label: 'Transferir', color: '#10B981', bg: '#ECFDF5' },
  { type: 'condition', emoji: '⏰', label: 'Condição',   color: '#6366F1', bg: '#EEF2FF' },
  { type: 'action',    emoji: '🏷️', label: 'Ação',       color: '#EC4899', bg: '#FDF2F8' },
  { type: 'wait',      emoji: '⏳', label: 'Aguardar',   color: '#94A3B8', bg: '#F8FAFC' },
  { type: 'end',       emoji: '🔴', label: 'Fim',        color: '#EF4444', bg: '#FEF2F2' },
]
const DEF_MAP = Object.fromEntries(NODE_DEFS.map(d => [d.type, d]))
const START_DEF = { emoji: '🟢', label: 'Início', color: '#10B981', bg: '#ECFDF5' }

function genId() { return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}` }

// ── Geometry helpers ──────────────────────────────────────────────────────────
function nodeHeight(node: FlowNode): number {
  const base = 88
  if (node.type === 'menu') return base + ((node.data.options?.length ?? 1) * 24) + 8
  if (node.type === 'condition') return base + 16
  return base
}

function outPortPos(node: FlowNode, port: string): { x: number; y: number } {
  const h  = nodeHeight(node)
  const cx = node.position.x + NODE_W / 2
  const by = node.position.y + h
  if (port === 'true')  return { x: node.position.x + NODE_W * 0.28, y: by }
  if (port === 'false') return { x: node.position.x + NODE_W * 0.72, y: by }
  if (node.type === 'menu') {
    const opts = node.data.options || []
    const idx  = opts.findIndex(o => o.id === port)
    if (idx >= 0) return { x: node.position.x + (NODE_W / (opts.length + 1)) * (idx + 1), y: by }
  }
  return { x: cx, y: by }
}

function inPortPos(node: FlowNode): { x: number; y: number } {
  return { x: node.position.x + NODE_W / 2, y: node.position.y }
}

function bezier(sx: number, sy: number, tx: number, ty: number): string {
  const dy = Math.max(60, Math.abs(ty - sy) * 0.55)
  return `M ${sx} ${sy} C ${sx} ${sy + dy}, ${tx} ${ty - dy}, ${tx} ${ty}`
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00A896] focus:border-[#00A896] outline-none'
const labelSt: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }

// ── FlowNodeCard ──────────────────────────────────────────────────────────────
function FlowNodeCard({
  node, selected, isTarget, connectingFromThisNode,
  onHeaderMouseDown, onPortClick, onBodyClick, onDelete,
}: {
  node: FlowNode
  selected: boolean
  isTarget: boolean
  connectingFromThisNode: boolean
  onHeaderMouseDown: (e: React.MouseEvent) => void
  onPortClick: (e: React.MouseEvent, port: string, dir: 'out' | 'in') => void
  onBodyClick: (e: React.MouseEvent) => void
  onDelete: () => void
}) {
  const def   = node.type === 'start' ? START_DEF : (DEF_MAP[node.type] || DEF_MAP.message)
  const h     = nodeHeight(node)
  const border = selected ? `2px solid ${def.color}` : isTarget ? '2px solid #00A896' : '2px solid #E2E8F0'
  const shadow = selected ? `0 0 0 3px ${def.color}30` : isTarget ? '0 0 0 3px #00A89640' : '0 2px 10px rgba(0,0,0,0.07)'

  const portStyle = (color: string, active: boolean): React.CSSProperties => ({
    width: 14, height: 14, borderRadius: '50%',
    border: `2.5px solid ${color}`,
    background: active ? color : '#fff',
    cursor: 'crosshair',
    display: 'inline-block',
    flexShrink: 0,
    transition: 'background 0.15s, transform 0.1s',
  })

  const summary = (() => {
    const d = node.data
    switch (node.type) {
      case 'start':     return 'Início do fluxo'
      case 'message':   return d.text ? d.text.slice(0, 55) + (d.text.length > 55 ? '…' : '') : '(sem mensagem)'
      case 'question':  return d.text ? `"${d.text.slice(0, 40)}"` : '(sem pergunta)'
      case 'menu':      return `${d.options?.length ?? 0} opções`
      case 'transfer':  return d.assigneeName || '(sem atendente)'
      case 'condition': return d.conditionType === 'business_hours' ? 'Horário comercial' : d.conditionType === 'keyword' ? `Palavra: "${d.keyword || ''}"` : 'Primeira mensagem'
      case 'action':    return d.actionType === 'create_lead' ? 'Criar lead' : d.actionType === 'add_tag' ? `Tag: ${d.tag || ''}` : 'Vincular lead'
      case 'wait':      return `${d.seconds ?? 3}s de espera`
      case 'end':       return 'Encerra o fluxo'
    }
  })()

  const hasInput  = node.type !== 'start'
  const hasOutput = node.type !== 'end'

  return (
    <div
      onClick={onBodyClick}
      data-nodeid={node.id}
      style={{
        position: 'absolute',
        left: node.position.x,
        top:  node.position.y,
        width: NODE_W,
        minHeight: h,
        background: '#fff',
        borderRadius: 12,
        border,
        boxShadow: shadow,
        userSelect: 'none',
        cursor: isTarget ? 'crosshair' : 'default',
        transition: 'border-color 0.12s, box-shadow 0.12s',
      }}
    >
      {/* Input port */}
      {hasInput && (
        <div
          style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}
          onClick={e => onPortClick(e, 'input', 'in')}
        >
          <div style={{ ...portStyle(def.color, isTarget), transform: isTarget ? 'scale(1.35)' : undefined }} />
        </div>
      )}

      {/* Header (drag handle) */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          background: def.bg, borderRadius: '10px 10px 0 0',
          borderBottom: `1px solid ${def.color}25`,
          padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 7,
          cursor: 'grab',
        }}
      >
        <span style={{ fontSize: 16 }}>{def.emoji}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: def.color, flex: 1 }}>{def.label}</span>
        {node.type !== 'start' && (
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 0, display: 'flex' }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '7px 10px', fontSize: 11, color: '#475569', lineHeight: 1.45 }}>
        {summary}
        {node.type === 'menu' && node.data.options && (
          <div style={{ marginTop: 4 }}>
            {node.data.options.map(o => (
              <div key={o.id} style={{ fontSize: 10, color: '#94A3B8', padding: '1px 0' }}>
                {o.number}. {o.text || '(vazio)'}
              </div>
            ))}
          </div>
        )}
        {node.type === 'condition' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981' }}>✓ Verdadeiro</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444' }}>✗ Falso</span>
          </div>
        )}
      </div>

      {/* Output ports */}
      {hasOutput && (
        <div style={{ padding: '2px 10px 8px', display: 'flex', justifyContent: node.type === 'condition' ? 'space-between' : 'center', alignItems: 'center' }}>
          {node.type === 'condition' ? (
            <>
              {(['true', 'false'] as const).map(p => (
                <div key={p} onClick={e => onPortClick(e, p, 'out')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'crosshair' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: p === 'true' ? '#10B981' : '#EF4444' }}>
                    {p === 'true' ? 'VERDADEIRO' : 'FALSO'}
                  </span>
                  <div style={{ ...portStyle(p === 'true' ? '#10B981' : '#EF4444', connectingFromThisNode) }} />
                </div>
              ))}
            </>
          ) : node.type === 'menu' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {(node.data.options || []).map(o => (
                <div key={o.id} onClick={e => onPortClick(e, o.id, 'out')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'crosshair' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B' }}>{o.number}</span>
                  <div style={{ ...portStyle('#F59E0B', connectingFromThisNode) }} />
                </div>
              ))}
            </div>
          ) : (
            <div onClick={e => onPortClick(e, 'output', 'out')} style={{ cursor: 'crosshair' }}>
              <div style={{ ...portStyle(def.color, connectingFromThisNode) }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── NodeProperties ────────────────────────────────────────────────────────────
function NodeProperties({
  node, users, onChange, onDelete,
}: {
  node: FlowNode
  users: { id: string; full_name: string }[]
  onChange: (d: Partial<FlowNode['data']>) => void
  onDelete: () => void
}) {
  const def = node.type === 'start' ? START_DEF : (DEF_MAP[node.type] || DEF_MAP.message)
  const d   = node.data

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: '10px 12px', background: def.bg, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{def.emoji}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: def.color }}>{def.label}</div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>id: …{node.id.slice(-8)}</div>
        </div>
      </div>

      {node.type === 'start' && (
        <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
          Ponto de entrada fixo. Conecte-o ao primeiro bloco que o robô deve executar quando um novo contato iniciar conversa.
        </p>
      )}

      {node.type === 'message' && (<>
        <div>
          <label style={labelSt}>Mensagem</label>
          <textarea rows={4} className={inputCls} style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            value={d.text || ''} onChange={e => onChange({ text: e.target.value })}
            placeholder="Olá {{nome}}! Como posso ajudar?" />
          <span style={{ fontSize: 10, color: '#94A3B8', display: 'block', marginTop: 4 }}>
            Use {'{{'+'variavel'+'}}'}  para inserir dados coletados
          </span>
        </div>
        <div>
          <label style={labelSt}>URL de imagem (opcional)</label>
          <input className={inputCls} style={{ width: '100%', boxSizing: 'border-box' }}
            value={d.imageUrl || ''} onChange={e => onChange({ imageUrl: e.target.value })}
            placeholder="https://..." />
        </div>
      </>)}

      {node.type === 'question' && (<>
        <div>
          <label style={labelSt}>Pergunta enviada ao cliente</label>
          <textarea rows={3} className={inputCls} style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            value={d.text || ''} onChange={e => onChange({ text: e.target.value })}
            placeholder="Qual o nome do aluno?" />
        </div>
        <div>
          <label style={labelSt}>Salvar resposta em variável</label>
          <input className={inputCls} style={{ width: '100%', boxSizing: 'border-box' }}
            value={d.variable || ''} onChange={e => onChange({ variable: e.target.value })}
            placeholder="ex: nome_aluno, serie" />
          <span style={{ fontSize: 10, color: '#94A3B8', display: 'block', marginTop: 4 }}>
            Acesse depois com {'{{'+'nome_aluno'+'}}'}
          </span>
        </div>
      </>)}

      {node.type === 'menu' && (<>
        <div>
          <label style={labelSt}>Texto do menu</label>
          <textarea rows={3} className={inputCls} style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            value={d.menuText || ''} onChange={e => onChange({ menuText: e.target.value })}
            placeholder={'Escolha uma opção:\n1. Matrículas\n2. Valores'} />
        </div>
        <div>
          <label style={labelSt}>Opções</label>
          {(d.options || []).map((opt, i) => (
            <div key={opt.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#F59E0B', width: 18, flexShrink: 0 }}>{opt.number}</span>
              <input className={inputCls} style={{ flex: 1, boxSizing: 'border-box' }}
                value={opt.text}
                onChange={e => {
                  const opts = [...(d.options || [])]
                  opts[i] = { ...opts[i], text: e.target.value }
                  onChange({ options: opts })
                }}
                placeholder={`Opção ${opt.number}`} />
              {(d.options?.length ?? 0) > 1 && (
                <button onClick={() => onChange({ options: (d.options || []).filter(o => o.id !== opt.id) })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', flexShrink: 0 }}>
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => {
              const next = (d.options?.length ?? 0) + 1
              onChange({ options: [...(d.options || []), { id: genId(), number: next, text: '' }] })
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: '#FFFBEB', border: '1px dashed #F59E0B', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#F59E0B', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
            <Plus size={12} /> Adicionar opção
          </button>
        </div>
      </>)}

      {node.type === 'transfer' && (<>
        <div>
          <label style={labelSt}>Atendente</label>
          <select className={inputCls} style={{ width: '100%', boxSizing: 'border-box' }}
            value={d.assigneeId || ''}
            onChange={e => {
              const u = users.find(u => u.id === e.target.value)
              onChange({ assigneeId: e.target.value, assigneeName: u?.full_name || '' })
            }}>
            <option value="">Sem atendente específico</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>Mensagem antes de transferir</label>
          <textarea rows={2} className={inputCls} style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            value={d.transferMessage || ''} onChange={e => onChange({ transferMessage: e.target.value })}
            placeholder="Vou te conectar com um atendente..." />
        </div>
      </>)}

      {node.type === 'condition' && (<>
        <div>
          <label style={labelSt}>Tipo de condição</label>
          <select className={inputCls} style={{ width: '100%', boxSizing: 'border-box' }}
            value={d.conditionType || 'business_hours'}
            onChange={e => onChange({ conditionType: e.target.value as FlowNode['data']['conditionType'] })}>
            <option value="business_hours">Horário comercial</option>
            <option value="keyword">Palavra-chave na mensagem</option>
            <option value="first_message">Primeira mensagem do contato</option>
          </select>
        </div>
        {d.conditionType === 'keyword' && (
          <div>
            <label style={labelSt}>Palavra-chave</label>
            <input className={inputCls} style={{ width: '100%', boxSizing: 'border-box' }}
              value={d.keyword || ''} onChange={e => onChange({ keyword: e.target.value })}
              placeholder="ex: preco, matricula, informacao" />
          </div>
        )}
        <div style={{ padding: 10, background: '#F0FDF4', borderRadius: 8, fontSize: 11, color: '#065F46', lineHeight: 1.5 }}>
          ✅ Se verdadeiro → conecte pela porta verde<br />
          ❌ Se falso → conecte pela porta vermelha
        </div>
      </>)}

      {node.type === 'action' && (<>
        <div>
          <label style={labelSt}>Tipo de ação</label>
          <select className={inputCls} style={{ width: '100%', boxSizing: 'border-box' }}
            value={d.actionType || 'create_lead'}
            onChange={e => onChange({ actionType: e.target.value as FlowNode['data']['actionType'] })}>
            <option value="create_lead">Criar lead</option>
            <option value="add_tag">Adicionar etiqueta</option>
            <option value="link_lead">Vincular lead por telefone</option>
          </select>
        </div>
        {d.actionType === 'add_tag' && (
          <div>
            <label style={labelSt}>Nome da etiqueta</label>
            <input className={inputCls} style={{ width: '100%', boxSizing: 'border-box' }}
              value={d.tag || ''} onChange={e => onChange({ tag: e.target.value })}
              placeholder="ex: interesse_matricula" />
          </div>
        )}
      </>)}

      {node.type === 'wait' && (
        <div>
          <label style={labelSt}>Aguardar (segundos)</label>
          <input type="number" min={1} max={300} className={inputCls} style={{ width: '100%', boxSizing: 'border-box' }}
            value={d.seconds ?? 3} onChange={e => onChange({ seconds: Number(e.target.value) })} />
          <span style={{ fontSize: 10, color: '#94A3B8', display: 'block', marginTop: 4 }}>
            Pausa antes do próximo bloco (máx. 300s)
          </span>
        </div>
      )}

      {node.type === 'end' && (
        <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
          Encerra o fluxo automático. O contato ficará aguardando atendimento humano.
        </p>
      )}

      {node.type !== 'start' && (
        <button onClick={onDelete}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, background: '#FFF1F2', border: '1px solid #FECDD3', color: '#E11D48', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 'auto' }}>
          <Trash2 size={13} /> Excluir bloco
        </button>
      )}
    </div>
  )
}

// ── FlowEditor (main) ─────────────────────────────────────────────────────────
export default function FlowEditor({
  institutionId,
  onClose,
}: {
  institutionId: string
  onClose: () => void
}) {
  const [nodes, setNodes] = useState<FlowNode[]>([
    { id: 'start', type: 'start', position: { x: 280, y: 120 }, data: {} },
  ])
  const [edges, setEdges]             = useState<FlowEdge[]>([])
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [connecting, setConnecting]   = useState<{ nodeId: string; port: string } | null>(null)
  const [pan, setPan]                 = useState({ x: 0, y: 0 })
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [loading, setLoading]         = useState(true)
  const [users, setUsers]             = useState<{ id: string; full_name: string }[]>([])

  const dragRef  = useRef<{ nodeId: string; sx: number; sy: number; ox: number; oy: number } | null>(null)
  const panRef   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const canvasEl = useRef<HTMLDivElement>(null)

  // Load existing flow + users
  useEffect(() => {
    ;(async () => {
      try {
        const [{ data: fl }, { data: us }] = await Promise.all([
          supabase.from('whatsapp_flows').select('bot_flow').eq('institution_id', institutionId).maybeSingle(),
          supabase.from('users').select('id,full_name').eq('institution_id', institutionId),
        ])
        if (us) setUsers(us)
        const bf = fl?.bot_flow as { nodes?: FlowNode[]; edges?: FlowEdge[] } | null
        if (bf?.nodes?.length) { setNodes(bf.nodes); setEdges(bf.edges || []) }
      } catch (e) { console.error(e) }
      setLoading(false)
    })()
  }, [institutionId])

  // Global mouse events for drag + pan
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const { nodeId, sx, sy, ox, oy } = dragRef.current
        setNodes(prev => prev.map(n =>
          n.id === nodeId ? { ...n, position: { x: ox + e.clientX - sx, y: oy + e.clientY - sy } } : n
        ))
      } else if (panRef.current) {
        const { sx, sy, ox, oy } = panRef.current
        setPan({ x: ox + e.clientX - sx, y: oy + e.clientY - sy })
      }
    }
    const onUp = () => { dragRef.current = null; panRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const startNodeDrag = useCallback((e: React.MouseEvent, nodeId: string) => {
    if ((e.target as HTMLElement).closest('[data-port]')) return
    e.stopPropagation()
    const node = nodes.find(n => n.id === nodeId)!
    dragRef.current = { nodeId, sx: e.clientX, sy: e.clientY, ox: node.position.x, oy: node.position.y }
  }, [nodes])

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-nodeid]')) return
    setConnecting(null)
    setSelectedId(null)
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y }
  }, [pan])

  const handlePortClick = useCallback((e: React.MouseEvent, nodeId: string, port: string, dir: 'out' | 'in') => {
    e.stopPropagation()
    if (dir === 'out') {
      setConnecting(prev => (prev?.nodeId === nodeId && prev?.port === port) ? null : { nodeId, port })
      return
    }
    // dir === 'in'
    if (!connecting || connecting.nodeId === nodeId) { setConnecting(null); return }
    const edgeId = `e_${genId()}`
    setEdges(prev => [
      ...prev.filter(e => !(e.from === connecting.nodeId && e.fromPort === connecting.port)),
      { id: edgeId, from: connecting.nodeId, fromPort: connecting.port, to: nodeId },
    ])
    setConnecting(null)
  }, [connecting])

  const addNode = (type: NodeType) => {
    const id  = genId()
    const cx  = (canvasEl.current?.clientWidth  ?? 800) / 2 - pan.x - NODE_W / 2
    const cy  = (canvasEl.current?.clientHeight ?? 600) / 2 - pan.y - 44
    const node: FlowNode = {
      id, type,
      position: { x: cx, y: cy },
      data: type === 'menu'
        ? { options: [{ id: genId(), number: 1, text: 'Opção 1' }] }
        : type === 'wait' ? { seconds: 3 }
        : type === 'condition' ? { conditionType: 'business_hours' }
        : type === 'action' ? { actionType: 'create_lead' }
        : {},
    }
    setNodes(prev => [...prev, node])
    setSelectedId(id)
  }

  const deleteNode = (id: string) => {
    if (id === 'start') return
    setNodes(prev => prev.filter(n => n.id !== id))
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const updateNodeData = (id: string, data: Partial<FlowNode['data']>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n))
  }

  const save = async () => {
    setSaving(true)
    try {
      await supabase.from('whatsapp_flows').upsert(
        { institution_id: institutionId, bot_flow: { nodes, edges }, updated_at: new Date().toISOString() },
        { onConflict: 'institution_id' }
      )
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const selectedNode = nodes.find(n => n.id === selectedId) ?? null

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <Loader2 size={32} color="#00A896" className="animate-spin" />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#F8FAFC', display: 'flex', flexDirection: 'column', zIndex: 2000, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <style>{`
        .flow-spin { animation: fspin 1s linear infinite }
        @keyframes fspin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', height: 54, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#F1F5F9', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1A2B4A' }}>Editor de Fluxo do Robô</span>
          {connecting && (
            <span style={{ padding: '3px 10px', background: '#DBEAFE', color: '#1E40AF', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
              🔗 Clique na porta de entrada do bloco destino
            </span>
          )}
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: saved ? '#16a34a' : 'linear-gradient(135deg,#00A896,#007A6E)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saved ? <><Check size={13} /> Salvo!</> : saving ? <><Loader2 size={13} className="flow-spin" /> Salvando…</> : <><Save size={13} /> Salvar fluxo</>}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left sidebar */}
        <div style={{ width: 172, background: '#fff', borderRight: '1px solid #E2E8F0', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px 2px' }}>Blocos</p>
          <div style={{ padding: '7px 9px', background: '#ECFDF5', border: '1.5px solid #10B981', borderRadius: 9, fontSize: 11, fontWeight: 700, color: '#065F46' }}>
            🟢 Início <span style={{ fontWeight: 400, color: '#6EE7B7', fontSize: 10 }}>(fixo)</span>
          </div>
          {NODE_DEFS.map(def => (
            <button key={def.type} onClick={() => addNode(def.type)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', background: def.bg, border: `1.5px solid ${def.color}30`, borderRadius: 9, fontSize: 11, fontWeight: 600, color: def.color, cursor: 'pointer', textAlign: 'left' }}>
              {def.emoji} {def.label}
            </button>
          ))}
          <div style={{ marginTop: 10, padding: 9, background: '#F8FAFC', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 10, color: '#94A3B8', lineHeight: 1.5 }}>
            Clique para adicionar. Arraste pelo cabeçalho. Clique nas portas para conectar. Clique na aresta para deletar.
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasEl}
          onMouseDown={onCanvasMouseDown}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            cursor: 'default',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px,${pan.y}px)` }}>
            {/* SVG edges */}
            <svg style={{ position: 'absolute', inset: '-1000px', width: 'calc(100% + 2000px)', height: 'calc(100% + 2000px)', pointerEvents: 'none', overflow: 'visible', left: 0, top: 0 }}>
              <defs>
                <marker id="fe-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0,8 3,0 6" fill="#94A3B8" />
                </marker>
              </defs>
              {edges.map(edge => {
                const fn = nodes.find(n => n.id === edge.from)
                const tn = nodes.find(n => n.id === edge.to)
                if (!fn || !tn) return null
                const { x: sx, y: sy } = outPortPos(fn, edge.fromPort)
                const { x: tx, y: ty } = inPortPos(tn)
                const d = bezier(sx, sy + 7, tx, ty - 7)
                return (
                  <g key={edge.id} style={{ pointerEvents: 'all' }}>
                    {/* Wide invisible hit area */}
                    <path d={d} fill="none" stroke="transparent" strokeWidth={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setEdges(prev => prev.filter(e => e.id !== edge.id))} />
                    <path d={d} fill="none" stroke="#94A3B8" strokeWidth={1.8} markerEnd="url(#fe-arrow)" />
                  </g>
                )
              })}
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
              <FlowNodeCard
                key={node.id}
                node={node}
                selected={selectedId === node.id}
                isTarget={!!connecting && connecting.nodeId !== node.id && node.type !== 'start'}
                connectingFromThisNode={connecting?.nodeId === node.id}
                onHeaderMouseDown={e => { setSelectedId(node.id); startNodeDrag(e, node.id) }}
                onPortClick={(e, port, dir) => handlePortClick(e, node.id, port, dir)}
                onBodyClick={e => { e.stopPropagation(); setSelectedId(node.id) }}
                onDelete={() => deleteNode(node.id)}
              />
            ))}
          </div>
        </div>

        {/* Right properties panel */}
        <div style={{ width: 272, background: '#fff', borderLeft: '1px solid #E2E8F0', overflowY: 'auto', flexShrink: 0 }}>
          {selectedNode ? (
            <NodeProperties
              node={selectedNode}
              users={users}
              onChange={data => updateNodeData(selectedNode.id, data)}
              onDelete={() => deleteNode(selectedNode.id)}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
              <span style={{ fontSize: 40 }}>👆</span>
              <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
                Clique em um bloco para editar suas propriedades
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
