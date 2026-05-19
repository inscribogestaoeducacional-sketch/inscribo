import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

type NodeType = 'start'|'message'|'question'|'menu'|'transfer'|'condition'|'action'|'wait'|'media'|'distribute'|'lead'|'end'

interface FlowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: Record<string, any>
  width: number
  height: number
}

interface FlowEdge {
  id: string
  fromNodeId: string
  fromPortId: string
  toNodeId: string
  toPortId: string
}

interface ConnectState {
  fromNodeId: string
  fromPortId: string
  fromX: number
  fromY: number
}

const CFG: Record<NodeType, { color: string; label: string; icon: string }> = {
  start:     { color: '#10b981', label: 'Início',     icon: '▶' },
  message:   { color: '#3b82f6', label: 'Mensagem',   icon: '💬' },
  question:  { color: '#8b5cf6', label: 'Pergunta',   icon: '?' },
  menu:      { color: '#f59e0b', label: 'Menu',       icon: '☰' },
  transfer:  { color: '#0d9488', label: 'Transferir', icon: '→' },
  condition: { color: '#ef4444', label: 'Condição',   icon: '⚡' },
  action:    { color: '#ec4899', label: 'Ação',       icon: '★' },
  wait:      { color: '#6b7280', label: 'Aguardar',   icon: '⏱' },
  media:     { color: '#06b6d4', label: 'Mídia',      icon: '📷' },
  distribute:{ color: '#f97316', label: 'Distribuir', icon: '⊕' },
  lead:      { color: '#84cc16', label: 'Lead',       icon: '👤' },
  end:       { color: '#374151', label: 'Fim',        icon: '■' },
}

const SIDEBAR_TYPES: NodeType[] = ['message','question','menu','transfer','condition','action','wait','media','distribute','lead','end']

const NW = 240

function genId() {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function nodeH(node: { type: NodeType; data: Record<string, any> }): number {
  switch (node.type) {
    case 'start':      return 82
    case 'message':    return 136
    case 'question':   return 136
    case 'menu':       return 110 + (node.data.options?.length || 1) * 38
    case 'condition':  return 120
    case 'transfer':   return 144
    case 'wait':       return 82
    case 'media':      return 160
    case 'distribute': return 82
    case 'lead':       return 100
    case 'action':     return 100
    case 'end':        return 82
    default:           return 100
  }
}

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const dy = Math.abs(y2 - y1)
  const c  = Math.max(dy * 0.5, 80)
  return `M ${x1} ${y1} C ${x1} ${y1 + c}, ${x2} ${y2 - c}, ${x2} ${y2}`
}

// Compute port position in canvas (screen) coordinates
function portPos(
  node: FlowNode,
  portId: string,
  zoom: number,
  pan: { x: number; y: number },
): { x: number; y: number } {
  const sx = node.position.x * zoom + pan.x
  const sy = node.position.y * zoom + pan.y
  const h  = nodeH(node)
  if (portId === 'in')  return { x: sx + (NW * zoom) / 2, y: sy }
  if (portId === 'out') return { x: sx + (NW * zoom) / 2, y: sy + h * zoom }
  if (portId === 'yes') return { x: sx + NW * zoom * 0.25, y: sy + h * zoom }
  if (portId === 'no')  return { x: sx + NW * zoom * 0.75, y: sy + h * zoom }
  if (portId.startsWith('opt-')) {
    const i     = parseInt(portId.replace('opt-', ''), 10)
    const total = node.data.options?.length || 1
    return { x: sx + (NW * zoom / (total + 1)) * (i + 1), y: sy + h * zoom }
  }
  return { x: sx, y: sy }
}

// ── Port dot ─────────────────────────────────────────────────────────────────
function PortDot({
  color,
  style,
  onMouseDown,
  onMouseUp,
}: {
  color: string
  style: React.CSSProperties
  onMouseDown?: (e: React.MouseEvent) => void
  onMouseUp?: (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      style={{
        width: 14, height: 14, borderRadius: '50%',
        background: color, border: '2.5px solid white',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        cursor: 'crosshair', position: 'absolute',
        transform: hov ? (style.transform ? style.transform + ' scale(1.4)' : 'scale(1.4)') : (style.transform as string || ''),
        transition: 'transform 0.1s',
        zIndex: 4,
        ...style,
        transformOrigin: 'center',
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    />
  )
}

// ── Output ports ──────────────────────────────────────────────────────────────
function OutputPorts({
  node,
  onPortMouseDown,
}: {
  node: FlowNode
  onPortMouseDown: (portId: string) => void
}) {
  const cfg = CFG[node.type]
  if (node.type === 'end') return null

  const mkDown = (portId: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onPortMouseDown(portId)
  }

  if (node.type === 'condition') {
    return (
      <>
        <PortDot color="#10b981" style={{ bottom: -7, left: '25%', transform: 'translateX(-50%)' }} onMouseDown={mkDown('yes')} />
        <PortDot color="#ef4444" style={{ bottom: -7, left: '75%', transform: 'translateX(-50%)' }} onMouseDown={mkDown('no')} />
      </>
    )
  }
  if (node.type === 'menu') {
    const opts = node.data.options || []
    return (
      <>
        {opts.map((_: any, i: number) => (
          <PortDot
            key={i}
            color={cfg.color}
            style={{ bottom: -7, left: `${((i + 1) / (opts.length + 1)) * 100}%`, transform: 'translateX(-50%)' }}
            onMouseDown={mkDown(`opt-${i}`)}
          />
        ))}
      </>
    )
  }
  return (
    <PortDot
      color={cfg.color}
      style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
      onMouseDown={mkDown('out')}
    />
  )
}

// ── Node body (inline editing) ─────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: 7,
  padding: '6px 8px', fontSize: 12, fontFamily: 'inherit',
  background: 'white', color: '#1e293b', boxSizing: 'border-box',
  outline: 'none',
}

function NodeBody({
  node,
  users,
  onChange,
}: {
  node: FlowNode
  users: { id: string; full_name: string }[]
  onChange: (data: Record<string, any>) => void
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const d = node.data

  switch (node.type) {
    case 'start':
      return <div style={{ padding: 12 }}><p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Início do fluxo</p></div>

    case 'message':
      return (
        <div style={{ padding: 12 }}>
          <textarea rows={3} style={{ ...inputSt, resize: 'none' }}
            value={d.text || ''} placeholder="Digite a mensagem..."
            onChange={e => onChange({ ...d, text: e.target.value })}
            onMouseDown={stop} />
        </div>
      )

    case 'question':
      return (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea rows={2} style={{ ...inputSt, resize: 'none' }}
            value={d.text || ''} placeholder="Qual a sua pergunta?"
            onChange={e => onChange({ ...d, text: e.target.value })}
            onMouseDown={stop} />
          <input style={inputSt}
            value={d.variable || ''} placeholder="Salvar em: nome_aluno"
            onChange={e => onChange({ ...d, variable: e.target.value })}
            onMouseDown={stop} />
        </div>
      )

    case 'menu':
      return (
        <div style={{ padding: 12 }}>
          <textarea rows={2} style={{ ...inputSt, resize: 'none', marginBottom: 8 }}
            value={d.menuText || ''} placeholder="Texto do menu..."
            onChange={e => onChange({ ...d, menuText: e.target.value })}
            onMouseDown={stop} />
          {(d.options || []).map((opt: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 5 }}>
              <span style={{
                background: '#f59e0b', color: 'white', borderRadius: '50%',
                width: 18, height: 18, fontSize: 10, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{i + 1}</span>
              <input style={{ ...inputSt, flex: 1 }}
                value={opt.text || ''} placeholder={`Opção ${i + 1}`}
                onChange={e => {
                  const opts = [...(d.options || [])]
                  opts[i] = { ...opts[i], text: e.target.value }
                  onChange({ ...d, options: opts })
                }}
                onMouseDown={stop} />
              <button onMouseDown={stop}
                onClick={() => onChange({ ...d, options: (d.options || []).filter((_: any, j: number) => j !== i) })}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 15, padding: 0 }}>×</button>
            </div>
          ))}
          <button onMouseDown={stop}
            onClick={() => onChange({ ...d, options: [...(d.options || []), { text: '' }] })}
            style={{
              marginTop: 4, width: '100%', padding: '4px',
              border: '1px dashed #f59e0b', borderRadius: 6,
              background: 'none', color: '#f59e0b', fontSize: 11, cursor: 'pointer',
            }}>+ Adicionar opção</button>
        </div>
      )

    case 'condition':
      return (
        <div style={{ padding: 12 }}>
          <select style={inputSt} value={d.conditionType || 'business_hours'}
            onChange={e => onChange({ ...d, conditionType: e.target.value })}
            onMouseDown={stop}>
            <option value="business_hours">Horário comercial</option>
            <option value="lunch_break">Horário de almoço</option>
            <option value="keyword">Palavra-chave</option>
            <option value="first_message">Primeira mensagem</option>
          </select>
          {d.conditionType === 'keyword' && (
            <input style={{ ...inputSt, marginTop: 6 }}
              value={d.keyword || ''} placeholder="Digite a palavra-chave"
              onChange={e => onChange({ ...d, keyword: e.target.value })}
              onMouseDown={stop} />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: '#64748b' }}>
            <span style={{ color: '#10b981' }}>✓ Sim (esq)</span>
            <span style={{ color: '#ef4444' }}>✗ Não (dir)</span>
          </div>
        </div>
      )

    case 'transfer':
      return (
        <div style={{ padding: 12 }}>
          <select style={inputSt} value={d.assignee_id || ''}
            onChange={e => onChange({ ...d, assignee_id: e.target.value })}
            onMouseDown={stop}>
            <option value="">Selecionar atendente...</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <input style={{ ...inputSt, marginTop: 6 }}
            value={d.message || ''} placeholder="Mensagem antes de transferir (opcional)"
            onChange={e => onChange({ ...d, message: e.target.value })}
            onMouseDown={stop} />
        </div>
      )

    case 'media':
      return (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select style={inputSt} value={d.mediaType || 'image'}
            onChange={e => onChange({ ...d, mediaType: e.target.value })}
            onMouseDown={stop}>
            <option value="image">Imagem</option>
            <option value="video">Vídeo</option>
            <option value="document">Documento</option>
            <option value="audio">Áudio</option>
          </select>
          <input style={inputSt} value={d.mediaUrl || ''} placeholder="URL da mídia"
            onChange={e => onChange({ ...d, mediaUrl: e.target.value })}
            onMouseDown={stop} />
          <input style={inputSt} value={d.caption || ''} placeholder="Legenda (opcional)"
            onChange={e => onChange({ ...d, caption: e.target.value })}
            onMouseDown={stop} />
        </div>
      )

    case 'wait':
      return (
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" min={1} max={300}
              style={{ ...inputSt, width: 70 }}
              value={d.seconds || 5}
              onChange={e => onChange({ ...d, seconds: parseInt(e.target.value) })}
              onMouseDown={stop} />
            <select style={{ ...inputSt, flex: 1 }}
              value={d.unit || 'seconds'}
              onChange={e => onChange({ ...d, unit: e.target.value })}
              onMouseDown={stop}>
              <option value="seconds">Segundos</option>
              <option value="minutes">Minutos</option>
            </select>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 10, color: '#f59e0b', lineHeight: 1.4 }}>
            ⚠️ Em ambiente serverless o atraso é ignorado e o fluxo avança imediatamente.
          </p>
        </div>
      )

    case 'action':
      return (
        <div style={{ padding: 12 }}>
          <select style={inputSt} value={d.actionType || 'create_lead'}
            onChange={e => onChange({ ...d, actionType: e.target.value })}
            onMouseDown={stop}>
            <option value="create_lead">Criar lead</option>
            <option value="add_tag">Adicionar etiqueta</option>
            <option value="link_lead">Vincular lead</option>
            <option value="close_conversation">Encerrar conversa</option>
          </select>
          {d.actionType === 'add_tag' && (
            <input style={{ ...inputSt, marginTop: 6 }}
              value={d.tag || ''} placeholder="Nome da etiqueta"
              onChange={e => onChange({ ...d, tag: e.target.value })}
              onMouseDown={stop} />
          )}
        </div>
      )

    case 'distribute':
      return (
        <div style={{ padding: 12 }}>
          <select style={inputSt} value={d.distributeMode || 'round_robin'}
            onChange={e => onChange({ ...d, distributeMode: e.target.value })}
            onMouseDown={stop}>
            <option value="round_robin">Round-robin</option>
            <option value="random">Aleatório</option>
            <option value="least_busy">Menos ocupado</option>
          </select>
        </div>
      )

    case 'lead':
      return (
        <div style={{ padding: 12 }}>
          <select style={inputSt} value={d.actionType || 'create_lead'}
            onChange={e => onChange({ ...d, actionType: e.target.value })}
            onMouseDown={stop}>
            <option value="create_lead">Criar lead</option>
            <option value="add_tag">Adicionar etiqueta</option>
            <option value="link_lead">Vincular lead</option>
          </select>
        </div>
      )

    case 'end':
      return (
        <div style={{ padding: 12 }}>
          <input style={inputSt}
            value={d.message || ''} placeholder="Mensagem de encerramento (opcional)"
            onChange={e => onChange({ ...d, message: e.target.value })}
            onMouseDown={stop} />
        </div>
      )

    default:
      return <div style={{ padding: 12, fontSize: 11, color: '#94a3b8' }}>Configure este bloco</div>
  }
}

// ── FlowNodeCard ──────────────────────────────────────────────────────────────
function FlowNodeCard({
  node, selected, zoom, pan, dragging,
  users,
  onSelect, onDragStart, onPortMouseDown, onPortMouseUp, onChange, onDelete,
}: {
  node: FlowNode
  selected: boolean
  zoom: number
  pan: { x: number; y: number }
  dragging: boolean
  users: { id: string; full_name: string }[]
  onSelect: () => void
  onDragStart: (e: React.MouseEvent) => void
  onPortMouseDown: (portId: string) => void
  onPortMouseUp: (portId: string) => void
  onChange: (data: Record<string, any>) => void
  onDelete: () => void
}) {
  const cfg = CFG[node.type]
  const sx  = node.position.x * zoom + pan.x
  const sy  = node.position.y * zoom + pan.y
  const hasIn = node.type !== 'start'

  return (
    <div
      style={{
        position: 'absolute',
        left: sx,
        top: sy,
        width: NW,
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        zIndex: selected ? 10 : 5,
        cursor: dragging ? 'grabbing' : 'grab',
        borderRadius: 14,
        border: selected ? `2px solid ${cfg.color}` : '1.5px solid rgba(0,0,0,0.09)',
        background: 'white',
        boxShadow: selected
          ? `0 0 0 3px ${cfg.color}30, 0 8px 28px rgba(0,0,0,0.14)`
          : '0 2px 12px rgba(0,0,0,0.08)',
        overflow: 'visible',
        userSelect: 'none',
      }}
      onClick={e => { e.stopPropagation(); onSelect() }}
      onMouseDown={onDragStart}
    >
      {/* Input port */}
      {hasIn && (
        <PortDot
          color="#94a3b8"
          style={{ top: -7, left: '50%', transform: 'translateX(-50%)', background: 'white', border: `2.5px solid ${cfg.color}` }}
          onMouseDown={e => { e.stopPropagation(); e.preventDefault() }}
          onMouseUp={e => { e.stopPropagation(); onPortMouseUp('in') }}
        />
      )}

      {/* Header */}
      <div style={{
        background: cfg.color, padding: '9px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderRadius: '12px 12px 0 0',
      }}>
        <span style={{ fontSize: 15 }}>{cfg.icon}</span>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 12, flex: 1 }}>{cfg.label}</span>
        {(node.type === 'distribute' || node.type === 'lead') && (
          <span style={{ background: 'rgba(255,255,255,0.25)', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, letterSpacing: '0.03em' }}>EM BREVE</span>
        )}
        {node.type !== 'start' && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{ background: 'rgba(255,255,255,0.22)', border: 'none', cursor: 'pointer', color: 'white', borderRadius: 4, padding: '2px 5px', fontSize: 14, lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      {/* Body */}
      <NodeBody node={node} users={users} onChange={onChange} />

      {/* Output ports */}
      <div style={{ position: 'relative', height: 0 }}>
        <OutputPorts node={node} onPortMouseDown={onPortMouseDown} />
      </div>
    </div>
  )
}

// ── EdgePath ──────────────────────────────────────────────────────────────────
function EdgePath({
  edge, nodes, zoom, pan, onDelete,
}: {
  edge: FlowEdge
  nodes: FlowNode[]
  zoom: number
  pan: { x: number; y: number }
  onDelete: () => void
}) {
  const [hov, setHov] = useState(false)
  const fromNode = nodes.find(n => n.id === edge.fromNodeId)
  const toNode   = nodes.find(n => n.id === edge.toNodeId)
  if (!fromNode || !toNode) return null
  const from = portPos(fromNode, edge.fromPortId, zoom, pan)
  const to   = portPos(toNode,   edge.toPortId,   zoom, pan)
  const d    = bezier(from.x, from.y, to.x, to.y)
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  return (
    <g>
      <path d={d} stroke="transparent" strokeWidth={14} fill="none"
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)} />
      <path d={d}
        stroke={hov ? '#ef4444' : '#0d9488'}
        strokeWidth={hov ? 2.5 : 2}
        fill="none"
        strokeDasharray={hov ? '6 3' : undefined}
        style={{ pointerEvents: 'none' }} />
      {hov && (
        <g style={{ pointerEvents: 'all', cursor: 'pointer' }}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          onClick={onDelete}>
          <circle cx={midX} cy={midY} r={10} fill="#ef4444" />
          <text x={midX} y={midY + 4.5} textAnchor="middle"
            fill="white" fontSize={14} fontWeight="bold" style={{ pointerEvents: 'none' }}>×</text>
        </g>
      )}
    </g>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function migrateEdge(e: any): FlowEdge {
  if (e.fromNodeId) return e as FlowEdge
  const portMap: Record<string, string> = {
    output: 'out', input: 'in', true: 'yes', false: 'no',
  }
  return {
    id:         e.id || genId(),
    fromNodeId: e.from,
    fromPortId: portMap[e.fromPort] ?? e.fromPort ?? 'out',
    toNodeId:   e.to,
    toPortId:   'in',
  }
}

// ── FlowEditor ────────────────────────────────────────────────────────────────
export default function FlowEditor({
  institutionId,
  onClose,
}: {
  institutionId: string
  onClose: () => void
}) {
  const [nodes, setNodes]           = useState<FlowNode[]>([])
  const [edges, setEdges]           = useState<FlowEdge[]>([])
  const [selectedNode, setSelected] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<ConnectState | null>(null)
  const [mousePos, setMousePos]     = useState({ x: 0, y: 0 })
  const [pan, setPan]               = useState({ x: 0, y: 0 })
  const [zoom, setZoom]             = useState(1)
  const [dragNodeId, setDragNodeId] = useState<string | null>(null)
  const [isActive, setIsActive]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [users, setUsers]           = useState<{ id: string; full_name: string }[]>([])

  const canvasRef = useRef<HTMLDivElement>(null)
  const zoomRef   = useRef(zoom)
  const panRef    = useRef(pan)
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { panRef.current = pan }, [pan])

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[FlowEditor] mount — institutionId:', institutionId)
    ;(async () => {
      const [{ data: fl }, { data: us }] = await Promise.all([
        supabase.from('whatsapp_flows')
          .select('bot_flow, bot_enabled')
          .eq('institution_id', institutionId)
          .maybeSingle(),
        supabase.from('users')
          .select('id, full_name')
          .eq('institution_id', institutionId),
      ])
      if (us) setUsers(us)
      if (fl?.bot_enabled != null) setIsActive(fl.bot_enabled)

      const bf = fl?.bot_flow as { nodes?: any[]; edges?: any[] } | null
      if (bf?.nodes?.length) {
        const loadedNodes: FlowNode[] = bf.nodes.map((n: any) => ({
          ...n, width: NW, height: nodeH(n),
        }))
        setNodes(loadedNodes)
        setEdges((bf.edges || []).map(migrateEdge))
      } else {
        const s: FlowNode = { id: 'start-1', type: 'start',  position: { x: 200, y: 80 },  data: {}, width: NW, height: 82 }
        const m: FlowNode = { id: 'msg-1',   type: 'message', position: { x: 200, y: 220 }, data: { text: 'Olá! Bem-vindo. Como posso ajudar?' }, width: NW, height: 136 }
        setNodes([s, m])
        setEdges([{ id: 'e-default', fromNodeId: 'start-1', fromPortId: 'out', toNodeId: 'msg-1', toPortId: 'in' }])
      }
      setLoading(false)
    })()
  }, [institutionId])

  // ── Wheel zoom (cursor-centered) ──────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect   = el.getBoundingClientRect()
      const mx     = e.clientX - rect.left
      const my     = e.clientY - rect.top
      const oldZ   = zoomRef.current
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const newZ   = Math.min(Math.max(oldZ * factor, 0.25), 2.5)
      const oldP   = panRef.current
      setPan({
        x: mx - (mx - oldP.x) * (newZ / oldZ),
        y: my - (my - oldP.y) * (newZ / oldZ),
      })
      setZoom(newZ)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ── Node drag ─────────────────────────────────────────────────────────────
  const startDragNode = (e: React.MouseEvent, nodeId: string) => {
    if ((e.target as HTMLElement).closest('[data-port]')) return
    e.stopPropagation()
    if (connecting) return
    setDragNodeId(nodeId)
    setSelected(nodeId)
    const node = nodes.find(n => n.id === nodeId)!
    const startX = e.clientX, startY = e.clientY
    const startPos = { ...node.position }
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoomRef.current
      const dy = (ev.clientY - startY) / zoomRef.current
      setNodes(prev => prev.map(n =>
        n.id === nodeId ? { ...n, position: { x: startPos.x + dx, y: startPos.y + dy } } : n
      ))
    }
    const onUp = () => {
      setDragNodeId(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Canvas pan ────────────────────────────────────────────────────────────
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement) !== canvasRef.current) return
    if (connecting) { setConnecting(null); return }
    setSelected(null)
    const startX = e.clientX - pan.x
    const startY = e.clientY - pan.y
    const onMove = (ev: MouseEvent) => setPan({ x: ev.clientX - startX, y: ev.clientY - startY })
    const onUp   = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Connection ────────────────────────────────────────────────────────────
  const handlePortMouseDown = (nodeId: string, portId: string) => {
    const node = nodes.find(n => n.id === nodeId)!
    const pos  = portPos(node, portId, zoom, pan)
    setConnecting({ fromNodeId: nodeId, fromPortId: portId, fromX: pos.x, fromY: pos.y })
    setMousePos(pos)
  }

  const handlePortMouseUp = (toNodeId: string, toPortId: string) => {
    if (!connecting || connecting.fromNodeId === toNodeId) { setConnecting(null); return }
    const alreadyConnected = edges.some(e => e.toNodeId === toNodeId && e.toPortId === toPortId)
    if (alreadyConnected) { setConnecting(null); return }
    setEdges(prev => [...prev, {
      id: `${connecting.fromNodeId}-${connecting.fromPortId}-${toNodeId}-${toPortId}`,
      fromNodeId: connecting.fromNodeId,
      fromPortId: connecting.fromPortId,
      toNodeId,
      toPortId,
    }])
    setConnecting(null)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!connecting) return
    const rect = canvasRef.current!.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  // ── Nodes CRUD ────────────────────────────────────────────────────────────
  const addNode = (type: NodeType) => {
    const id = genId()
    const defaultData: Record<string, any> = {}
    if (type === 'menu')       defaultData.options = [{ text: 'Opção 1' }]
    if (type === 'condition')  defaultData.conditionType = 'business_hours'
    if (type === 'wait')       defaultData.seconds = 5
    if (type === 'media')      defaultData.mediaType = 'image'
    if (type === 'distribute') defaultData.distributeMode = 'round_robin'
    if (type === 'action')     defaultData.actionType = 'create_lead'
    if (type === 'lead')       defaultData.actionType = 'create_lead'
    const newNode: FlowNode = {
      id, type,
      position: {
        x: Math.round((-pan.x + (canvasRef.current?.clientWidth  || 800) / 2) / zoom - NW / 2),
        y: Math.round((-pan.y + (canvasRef.current?.clientHeight || 600) / 2) / zoom - 50),
      },
      data: defaultData,
      width: NW,
      height: nodeH({ type, data: defaultData }),
    }
    setNodes(prev => [...prev, newNode])
    setSelected(id)
  }

  const deleteNode = (id: string) => {
    if (id === 'start-1' || id === 'start') return
    setNodes(prev => prev.filter(n => n.id !== id))
    setEdges(prev => prev.filter(e => e.fromNodeId !== id && e.toNodeId !== id))
    if (selectedNode === id) setSelected(null)
  }

  const updateNodeData = (id: string, data: Record<string, any>) => {
    setNodes(prev => prev.map(n =>
      n.id === id ? { ...n, data, height: nodeH({ type: n.type, data }) } : n
    ))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!institutionId) {
      console.error('[FlowEditor] institutionId vazio — não é possível salvar')
      return
    }
    setSaving(true)
    const botFlow = { nodes, edges }
    console.log('[FlowEditor] salvando para institution_id:', institutionId, 'nodes:', nodes.length, 'edges:', edges.length)

    // Verifica se já existe registro para usar UPDATE em vez de INSERT
    const { data: existing, error: selectErr } = await supabase
      .from('whatsapp_flows')
      .select('id')
      .eq('institution_id', institutionId)
      .maybeSingle()

    if (selectErr) {
      console.error('[FlowEditor] erro ao verificar registro existente:', selectErr)
      setSaving(false)
      return
    }

    let saveError: any = null
    if (existing) {
      const { error } = await supabase
        .from('whatsapp_flows')
        .update({ bot_flow: botFlow, bot_enabled: isActive })
        .eq('institution_id', institutionId)
      saveError = error
    } else {
      const { error } = await supabase
        .from('whatsapp_flows')
        .insert({ institution_id: institutionId, bot_flow: botFlow, bot_enabled: isActive, is_active: true })
      saveError = error
    }

    if (saveError) {
      console.error('[FlowEditor] erro ao salvar:', saveError.message, saveError.details, saveError.hint)
      alert(`Erro ao salvar fluxo: ${saveError.message}`)
    } else {
      console.log('[FlowEditor] salvo com sucesso')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  // ── Fit screen ────────────────────────────────────────────────────────────
  const fitScreen = () => {
    if (!nodes.length || !canvasRef.current) return
    const xs   = nodes.map(n => n.position.x)
    const ys   = nodes.map(n => n.position.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs) + NW
    const minY = Math.min(...ys), maxY = Math.max(...ys) + 160
    const cw   = canvasRef.current.clientWidth  - 80
    const ch   = canvasRef.current.clientHeight - 80
    const nz   = Math.min(1.5, Math.max(0.25, Math.min(cw / (maxX - minX + 1), ch / (maxY - minY + 1))))
    setZoom(nz)
    setPan({
      x: (cw - (maxX - minX) * nz) / 2 - minX * nz + 40,
      y: (ch - (maxY - minY) * nz) / 2 - minY * nz + 40,
    })
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ fontSize: 14, color: '#0d9488' }}>Carregando fluxo...</div>
    </div>
  )

  const btnBase: React.CSSProperties = {
    padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex',
    alignItems: 'center', gap: 5,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#fff',
      display: 'flex', flexDirection: 'column', zIndex: 2000,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* ── Toolbar ── */}
      <div style={{
        height: 52, borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 16px',
        background: 'white', flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ ...btnBase, background: '#f8fafc', color: '#475569' }}>
            ← Voltar
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a2b4a' }}>Editor de Fluxo</span>
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 99,
            background: isActive ? '#dcfce7' : '#f1f5f9',
            color: isActive ? '#16a34a' : '#64748b',
            border: `1px solid ${isActive ? '#bbf7d0' : '#e2e8f0'}`,
            cursor: 'pointer', fontWeight: 600,
          }} onClick={() => setIsActive(a => !a)}>
            {isActive ? '🤖 Robô ativo' : '👤 Robô inativo'}
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {nodes.length} blocos · {edges.length} conexões
          </span>
          {connecting && (
            <span style={{ fontSize: 11, color: '#0d9488', fontWeight: 600 }}>
              🔗 Conecte a uma porta de entrada
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fitScreen} style={{ ...btnBase, background: '#f8fafc', color: '#475569' }}>⊡ Ajustar</button>
          <button onClick={handleSave} disabled={saving} style={{
            ...btnBase, background: saved ? '#16a34a' : '#0d9488',
            color: 'white', border: 'none', opacity: saving ? 0.7 : 1,
          }}>
            {saved ? '✓ Salvo!' : saving ? 'Salvando...' : '↑ Salvar fluxo'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Left sidebar ── */}
        <div style={{
          width: 156, borderRight: '1px solid #e2e8f0',
          background: '#f8fafc', overflowY: 'auto', flexShrink: 0, padding: '10px 6px',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px 4px' }}>Blocos</p>
          <div style={{
            padding: '7px 10px', marginBottom: 3,
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
            fontSize: 11, fontWeight: 700, color: '#16a34a',
          }}>
            ▶ INÍCIO <span style={{ fontWeight: 400, color: '#4ade80', fontSize: 10 }}>(fixo)</span>
          </div>
          {SIDEBAR_TYPES.map(type => {
            const c = CFG[type]
            return (
              <button key={type} onClick={() => addNode(type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 10px', width: '100%', textAlign: 'left',
                  background: `${c.color}12`, border: `1px solid ${c.color}30`,
                  borderRadius: 8, fontSize: 11, fontWeight: 600,
                  color: c.color, cursor: 'pointer', marginBottom: 3,
                }}>
                <span>{c.icon}</span> {c.label}
              </button>
            )
          })}
          <div style={{ marginTop: 10, padding: 9, background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 10, color: '#94a3b8', lineHeight: 1.55 }}>
            Clique para adicionar. Arraste pelo cabeçalho. Conecte as portas.
          </div>
        </div>

        {/* ── Canvas ── */}
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={() => connecting && setConnecting(null)}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            background: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px) 0 0 / 24px 24px, #f8fafc',
            cursor: connecting ? 'crosshair' : 'default',
          }}
        >
          {/* SVG overlay — screen-space coordinates */}
          <svg style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 1, overflow: 'visible',
          }}>
            {edges.map(edge => (
              <EdgePath
                key={edge.id}
                edge={edge}
                nodes={nodes}
                zoom={zoom}
                pan={pan}
                onDelete={() => setEdges(prev => prev.filter(e => e.id !== edge.id))}
              />
            ))}
            {/* Temporary connection line */}
            {connecting && (
              <path
                d={bezier(connecting.fromX, connecting.fromY, mousePos.x, mousePos.y)}
                stroke="#0d9488" strokeWidth={2} strokeDasharray="6 3"
                fill="none" opacity={0.75}
              />
            )}
          </svg>

          {/* Nodes — screen-space positioning */}
          {nodes.map(node => (
            <FlowNodeCard
              key={node.id}
              node={node}
              selected={selectedNode === node.id}
              zoom={zoom}
              pan={pan}
              dragging={dragNodeId === node.id}
              users={users}
              onSelect={() => setSelected(node.id)}
              onDragStart={e => startDragNode(e, node.id)}
              onPortMouseDown={portId => handlePortMouseDown(node.id, portId)}
              onPortMouseUp={portId => handlePortMouseUp(node.id, portId)}
              onChange={data => updateNodeData(node.id, data)}
              onDelete={() => deleteNode(node.id)}
            />
          ))}

          {/* Zoom controls */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
            {[
              { label: '+', action: () => setZoom(z => Math.min(z * 1.2, 2.5)) },
              { label: '⊡', action: fitScreen },
              { label: '−', action: () => setZoom(z => Math.max(z * 0.8, 0.25)) },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action}
                style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
                  color: '#64748b', cursor: 'pointer', fontSize: 14,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                {btn.label}
              </button>
            ))}
            <div style={{
              textAlign: 'center', fontSize: 10, color: '#64748b',
              background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '4px 0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              {Math.round(zoom * 100)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
