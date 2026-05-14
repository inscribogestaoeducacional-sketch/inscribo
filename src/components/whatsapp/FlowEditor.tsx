import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Plus, Save, Trash2, ArrowLeft, Loader2, Check, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
type NodeType = 'start' | 'message' | 'question' | 'menu' | 'transfer'
              | 'condition' | 'action' | 'wait' | 'end'
              | 'media' | 'delay' | 'variable' | 'distribute' | 'lead'

interface MenuOption { id: string; number: number; text: string }

interface FlowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: {
    text?: string
    imageUrl?: string
    mediaUrl?: string
    mediaType?: 'image' | 'video' | 'audio' | 'document'
    variable?: string
    varName?: string
    varValue?: string
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
    distributeMode?: 'round_robin' | 'random' | 'least_busy'
  }
}

interface FlowEdge {
  id: string
  from: string
  fromPort: string
  to: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const NODE_W = 280

const NODE_DEFS: { type: NodeType; emoji: string; label: string; color: string }[] = [
  { type: 'message',    emoji: '💬', label: 'MENSAGEM',   color: '#3b82f6' },
  { type: 'question',   emoji: '❓', label: 'PERGUNTA',   color: '#8b5cf6' },
  { type: 'menu',       emoji: '📋', label: 'MENU',       color: '#f59e0b' },
  { type: 'transfer',   emoji: '👤', label: 'TRANSFERIR', color: '#0d9488' },
  { type: 'media',      emoji: '📷', label: 'MÍDIA',      color: '#06b6d4' },
  { type: 'delay',      emoji: '⏱️', label: 'DELAY',      color: '#94a3b8' },
  { type: 'variable',   emoji: '📝', label: 'VARIÁVEL',   color: '#a78bfa' },
  { type: 'distribute', emoji: '🔀', label: 'DISTRIBUIR', color: '#f97316' },
  { type: 'lead',       emoji: '📊', label: 'LEAD',       color: '#84cc16' },
  { type: 'condition',  emoji: '⚡', label: 'CONDIÇÃO',   color: '#6366f1' },
  { type: 'action',     emoji: '🏷️', label: 'AÇÃO',       color: '#ec4899' },
  { type: 'end',        emoji: '🔴', label: 'FIM',        color: '#374151' },
]
const DEF_MAP = Object.fromEntries(NODE_DEFS.map(d => [d.type, d]))
const START_DEF = { emoji: '🟢', label: 'INÍCIO', color: '#10b981' }

function genId() { return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}` }

// ── Geometry helpers ──────────────────────────────────────────────────────────
function nodeHeight(node: FlowNode): number {
  const base = 88
  if (node.type === 'menu') return base + ((node.data.options?.length ?? 1) * 26) + 8
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

// ── Style helpers (light theme) ───────────────────────────────────────────────
const lInput: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E8F0', color: '#1A2B4A',
  borderRadius: 8, padding: '8px 12px', fontSize: 12, width: '100%',
  outline: 'none', boxSizing: 'border-box',
}
const lLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 5 }
const lTextarea = (rows = 3): React.CSSProperties => ({ ...lInput, resize: 'vertical', minHeight: rows * 22 } as React.CSSProperties)

// ── Minimap ───────────────────────────────────────────────────────────────────
function Minimap({ nodes, pan, zoom }: { nodes: FlowNode[]; pan: { x: number; y: number }; zoom: number }) {
  const W = 180, H = 120
  if (!nodes.length) return null
  const xs = nodes.map(n => n.position.x), ys = nodes.map(n => n.position.y)
  const minX = Math.min(...xs) - 20, maxX = Math.max(...xs) + NODE_W + 20
  const minY = Math.min(...ys) - 20, maxY = Math.max(...ys) + 120 + 20
  const scaleX = W / Math.max(1, maxX - minX)
  const scaleY = H / Math.max(1, maxY - minY)
  const sc = Math.min(scaleX, scaleY, 1)
  return (
    <div style={{ position: 'absolute', bottom: 16, right: 16, width: W, height: H, background: 'rgba(255,255,255,0.95)', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden', pointerEvents: 'none', zIndex: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
      {nodes.map(n => {
        const def = n.type === 'start' ? START_DEF : (DEF_MAP[n.type] || DEF_MAP.message)
        return (
          <div key={n.id} style={{ position: 'absolute', left: (n.position.x - minX) * sc, top: (n.position.y - minY) * sc, width: Math.max(8, NODE_W * sc), height: 5, background: def.color, borderRadius: 2, opacity: 0.75 }} />
        )
      })}
    </div>
  )
}

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
  const def    = node.type === 'start' ? START_DEF : (DEF_MAP[node.type] || DEF_MAP.message)
  const h      = nodeHeight(node)
  const border = selected
    ? `2px solid ${def.color}`
    : isTarget
      ? '2px solid #10b981'
      : '1px solid rgba(0,0,0,0.08)'
  const shadow = selected
    ? `0 0 0 3px ${def.color}25, 0 4px 24px rgba(0,0,0,0.12)`
    : isTarget
      ? '0 0 0 3px rgba(16,185,129,0.25), 0 4px 24px rgba(0,0,0,0.1)'
      : '0 4px 24px rgba(0,0,0,0.08)'

  const portStyle = (color: string, active: boolean, pulse: boolean): React.CSSProperties => ({
    width: 14, height: 14, borderRadius: '50%',
    border: `2px solid ${color}`,
    background: active ? color : '#fff',
    cursor: 'crosshair',
    display: 'inline-block',
    flexShrink: 0,
    transition: 'all 0.15s',
    boxShadow: pulse ? `0 0 0 3px ${color}40` : 'none',
    transform: (active || pulse) ? 'scale(1.2)' : 'scale(1)',
  })

  const summary = (() => {
    const d = node.data
    switch (node.type) {
      case 'start':      return 'Início do fluxo'
      case 'message':    return d.text ? d.text.slice(0, 60) + (d.text.length > 60 ? '…' : '') : '(sem mensagem)'
      case 'question':   return d.text ? `"${d.text.slice(0, 45)}"` : '(sem pergunta)'
      case 'menu':       return `${d.options?.length ?? 0} opções`
      case 'transfer':   return d.assigneeName || '(sem atendente)'
      case 'media':      return d.mediaType ? `[${d.mediaType.toUpperCase()}]` : '(sem mídia)'
      case 'delay':      return `${d.seconds ?? 3}s de delay`
      case 'variable':   return d.varName ? `{{${d.varName}}}` : '(sem variável)'
      case 'distribute': return d.distributeMode === 'round_robin' ? 'Round-robin' : d.distributeMode === 'random' ? 'Aleatório' : 'Menos ocupado'
      case 'lead':       return d.actionType === 'create_lead' ? 'Criar lead' : d.actionType === 'add_tag' ? `Tag: ${d.tag || ''}` : 'Vincular lead'
      case 'condition':  return d.conditionType === 'business_hours' ? 'Horário comercial' : d.conditionType === 'keyword' ? `Palavra: "${d.keyword || ''}"` : 'Primeira mensagem'
      case 'action':     return d.actionType === 'create_lead' ? 'Criar lead' : d.actionType === 'add_tag' ? `Tag: ${d.tag || ''}` : 'Vincular lead'
      case 'wait':       return `${d.seconds ?? 3}s de espera`
      case 'end':        return 'Encerra o fluxo'
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
        borderRadius: 16,
        border,
        boxShadow: shadow,
        userSelect: 'none',
        cursor: isTarget ? 'crosshair' : 'default',
        overflow: 'visible',
      }}
    >
      {/* Colored header strip */}
      <div style={{ height: 44, background: def.color, borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{def.emoji}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', flex: 1, letterSpacing: 0.6 }}>{def.label}</span>
        {node.type !== 'start' && (
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: '#fff', padding: '3px', display: 'flex', borderRadius: 4, lineHeight: 1 }}>
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Input port — sits on top border of header */}
      {hasInput && (
        <div style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)', zIndex: 4 }}
          onClick={e => onPortClick(e, 'input', 'in')}>
          <div style={{ ...portStyle('#fff', isTarget, isTarget), border: `2px solid ${def.color}`, background: isTarget ? def.color : '#fff' }} />
        </div>
      )}

      {/* Body */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{ padding: '10px 14px 6px', fontSize: 12, color: '#64748B', lineHeight: 1.5, cursor: 'grab', borderBottom: hasOutput ? '1px solid #F1F5F9' : 'none' }}
      >
        {summary}
        {node.type === 'menu' && node.data.options && (
          <div style={{ marginTop: 6 }}>
            {node.data.options.map(o => (
              <div key={o.id} style={{ fontSize: 11, color: '#94A3B8', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#F59F00', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{o.number}</span>
                {o.text || '(vazio)'}
              </div>
            ))}
          </div>
        )}
        {node.type === 'condition' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981' }}>✓ Verdadeiro</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>✗ Falso</span>
          </div>
        )}
      </div>

      {/* Output ports */}
      {hasOutput && (
        <div style={{ padding: '6px 14px 10px', display: 'flex', justifyContent: node.type === 'condition' ? 'space-between' : 'center', alignItems: 'center' }}>
          {node.type === 'condition' ? (
            <>
              {(['true', 'false'] as const).map(p => (
                <div key={p} onClick={e => onPortClick(e, p, 'out')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'crosshair' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: p === 'true' ? '#10b981' : '#ef4444' }}>
                    {p === 'true' ? 'SIM' : 'NÃO'}
                  </span>
                  <div style={{ ...portStyle(p === 'true' ? '#10b981' : '#ef4444', connectingFromThisNode, false) }} />
                </div>
              ))}
            </>
          ) : node.type === 'menu' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {(node.data.options || []).map(o => (
                <div key={o.id} onClick={e => onPortClick(e, o.id, 'out')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'crosshair' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{o.number}</span>
                  <div style={{ ...portStyle('#f59e0b', connectingFromThisNode, false) }} />
                </div>
              ))}
            </div>
          ) : (
            <div onClick={e => onPortClick(e, 'output', 'out')} style={{ cursor: 'crosshair' }}>
              <div style={{ ...portStyle(def.color, connectingFromThisNode, false) }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── NodeProperties (light) ────────────────────────────────────────────────────
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ height: 52, background: def.color, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 18 }}>{def.emoji}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{def.label}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>id: …{node.id.slice(-8)}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {node.type === 'start' && (
          <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
            Ponto de entrada fixo. Conecte ao primeiro bloco que o robô deve executar quando um novo contato iniciar conversa.
          </p>
        )}

        {node.type === 'message' && (<>
          <div>
            <label style={lLabel}>Mensagem</label>
            <textarea rows={4} style={lTextarea(4)}
              value={d.text || ''} onChange={e => onChange({ text: e.target.value })}
              placeholder="Olá {{nome}}! Como posso ajudar?" />
          </div>
          <div>
            <label style={lLabel}>URL de imagem (opcional)</label>
            <input style={lInput} value={d.imageUrl || ''} onChange={e => onChange({ imageUrl: e.target.value })} placeholder="https://..." />
          </div>
        </>)}

        {node.type === 'question' && (<>
          <div>
            <label style={lLabel}>Pergunta enviada ao cliente</label>
            <textarea rows={3} style={lTextarea(3)}
              value={d.text || ''} onChange={e => onChange({ text: e.target.value })}
              placeholder="Qual o nome do aluno?" />
          </div>
          <div>
            <label style={lLabel}>Salvar resposta em variável</label>
            <input style={lInput} value={d.variable || ''} onChange={e => onChange({ variable: e.target.value })} placeholder="ex: nome_aluno, serie" />
          </div>
        </>)}

        {node.type === 'menu' && (<>
          <div>
            <label style={lLabel}>Texto do menu</label>
            <textarea rows={3} style={lTextarea(3)}
              value={d.menuText || ''} onChange={e => onChange({ menuText: e.target.value })}
              placeholder={'Escolha uma opção:\n1. Matrículas\n2. Valores'} />
          </div>
          <div>
            <label style={lLabel}>Opções</label>
            {(d.options || []).map((opt, i) => (
              <div key={opt.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', width: 16, flexShrink: 0 }}>{opt.number}</span>
                <input style={{ ...lInput, flex: 1 }}
                  value={opt.text}
                  onChange={e => {
                    const opts = [...(d.options || [])]
                    opts[i] = { ...opts[i], text: e.target.value }
                    onChange({ options: opts })
                  }}
                  placeholder={`Opção ${opt.number}`} />
                {(d.options?.length ?? 0) > 1 && (
                  <button onClick={() => onChange({ options: (d.options || []).filter(o => o.id !== opt.id) })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', flexShrink: 0 }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const next = (d.options?.length ?? 0) + 1
                onChange({ options: [...(d.options || []), { id: genId(), number: next, text: '' }] })
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: '#FFFBEB', border: '1px dashed #f59e0b', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#f59e0b', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
              <Plus size={12} /> Adicionar opção
            </button>
          </div>
        </>)}

        {node.type === 'transfer' && (<>
          <div>
            <label style={lLabel}>Atendente</label>
            <select style={lInput} value={d.assigneeId || ''}
              onChange={e => {
                const u = users.find(u => u.id === e.target.value)
                onChange({ assigneeId: e.target.value, assigneeName: u?.full_name || '' })
              }}>
              <option value="">Sem atendente específico</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label style={lLabel}>Mensagem antes de transferir</label>
            <textarea rows={2} style={lTextarea(2)}
              value={d.transferMessage || ''} onChange={e => onChange({ transferMessage: e.target.value })}
              placeholder="Vou te conectar com um atendente..." />
          </div>
        </>)}

        {node.type === 'media' && (<>
          <div>
            <label style={lLabel}>Tipo de mídia</label>
            <select style={lInput} value={d.mediaType || 'image'}
              onChange={e => onChange({ mediaType: e.target.value as FlowNode['data']['mediaType'] })}>
              <option value="image">Imagem</option>
              <option value="video">Vídeo</option>
              <option value="audio">Áudio</option>
              <option value="document">Documento</option>
            </select>
          </div>
          <div>
            <label style={lLabel}>URL da mídia</label>
            <input style={lInput} value={d.mediaUrl || ''} onChange={e => onChange({ mediaUrl: e.target.value })} placeholder="https://..." />
          </div>
        </>)}

        {node.type === 'delay' && (
          <div>
            <label style={lLabel}>Delay (segundos)</label>
            <input type="number" min={1} max={300} style={lInput}
              value={d.seconds ?? 3} onChange={e => onChange({ seconds: Number(e.target.value) })} />
          </div>
        )}

        {node.type === 'variable' && (<>
          <div>
            <label style={lLabel}>Nome da variável</label>
            <input style={lInput} value={d.varName || ''} onChange={e => onChange({ varName: e.target.value })} placeholder="ex: nome_aluno, serie" />
          </div>
          <div>
            <label style={lLabel}>Valor</label>
            <input style={lInput} value={d.varValue || ''} onChange={e => onChange({ varValue: e.target.value })} placeholder="ex: Fulano, {{resposta}}" />
          </div>
        </>)}

        {node.type === 'distribute' && (
          <div>
            <label style={lLabel}>Modo de distribuição</label>
            <select style={lInput} value={d.distributeMode || 'round_robin'}
              onChange={e => onChange({ distributeMode: e.target.value as FlowNode['data']['distributeMode'] })}>
              <option value="round_robin">Round-robin</option>
              <option value="random">Aleatório</option>
              <option value="least_busy">Menos ocupado</option>
            </select>
          </div>
        )}

        {node.type === 'lead' && (<>
          <div>
            <label style={lLabel}>Ação</label>
            <select style={lInput} value={d.actionType || 'create_lead'}
              onChange={e => onChange({ actionType: e.target.value as FlowNode['data']['actionType'] })}>
              <option value="create_lead">Criar lead</option>
              <option value="add_tag">Adicionar etiqueta</option>
              <option value="link_lead">Vincular lead por telefone</option>
            </select>
          </div>
          {d.actionType === 'add_tag' && (
            <div>
              <label style={lLabel}>Nome da etiqueta</label>
              <input style={lInput} value={d.tag || ''} onChange={e => onChange({ tag: e.target.value })} placeholder="ex: interesse_matricula" />
            </div>
          )}
        </>)}

        {node.type === 'condition' && (<>
          <div>
            <label style={lLabel}>Tipo de condição</label>
            <select style={lInput} value={d.conditionType || 'business_hours'}
              onChange={e => onChange({ conditionType: e.target.value as FlowNode['data']['conditionType'] })}>
              <option value="business_hours">Horário comercial</option>
              <option value="keyword">Palavra-chave na mensagem</option>
              <option value="first_message">Primeira mensagem do contato</option>
            </select>
          </div>
          {d.conditionType === 'keyword' && (
            <div>
              <label style={lLabel}>Palavra-chave</label>
              <input style={lInput} value={d.keyword || ''} onChange={e => onChange({ keyword: e.target.value })} placeholder="ex: preco, matricula" />
            </div>
          )}
          <div style={{ padding: 10, background: '#F0FDF4', borderRadius: 8, fontSize: 11, color: '#16a34a', lineHeight: 1.5, border: '1px solid #BBF7D0' }}>
            ✅ Verdadeiro → porta verde<br />
            ❌ Falso → porta vermelha
          </div>
        </>)}

        {node.type === 'action' && (<>
          <div>
            <label style={lLabel}>Tipo de ação</label>
            <select style={lInput} value={d.actionType || 'create_lead'}
              onChange={e => onChange({ actionType: e.target.value as FlowNode['data']['actionType'] })}>
              <option value="create_lead">Criar lead</option>
              <option value="add_tag">Adicionar etiqueta</option>
              <option value="link_lead">Vincular lead por telefone</option>
            </select>
          </div>
          {d.actionType === 'add_tag' && (
            <div>
              <label style={lLabel}>Nome da etiqueta</label>
              <input style={lInput} value={d.tag || ''} onChange={e => onChange({ tag: e.target.value })} placeholder="ex: interesse_matricula" />
            </div>
          )}
        </>)}

        {node.type === 'wait' && (
          <div>
            <label style={lLabel}>Aguardar (segundos)</label>
            <input type="number" min={1} max={300} style={lInput}
              value={d.seconds ?? 3} onChange={e => onChange({ seconds: Number(e.target.value) })} />
          </div>
        )}

        {node.type === 'end' && (
          <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
            Encerra o fluxo automático. O contato ficará aguardando atendimento humano.
          </p>
        )}

        {node.type !== 'start' && (
          <button onClick={onDelete}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 8 }}>
            <Trash2 size={13} /> Excluir bloco
          </button>
        )}
      </div>
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
    { id: 'start',     type: 'start',   position: { x: 280, y: 140 }, data: {} },
    { id: 'm_default', type: 'message', position: { x: 230, y: 300 }, data: { text: 'Olá! Bem-vindo! Como posso ajudar? 😊' } },
  ])
  const [edges, setEdges]                   = useState<FlowEdge[]>([
    { id: 'e_default', from: 'start', fromPort: 'output', to: 'm_default' },
  ])
  const [selectedId, setSelectedId]         = useState<string | null>(null)
  const [connecting, setConnecting]         = useState<{ nodeId: string; port: string } | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId]   = useState<string | null>(null)
  const [pan, setPan]                       = useState({ x: 0, y: 0 })
  const [zoom, setZoom]                     = useState(1)
  const [showGrid, setShowGrid]             = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [loading, setLoading]               = useState(true)
  const [users, setUsers]                   = useState<{ id: string; full_name: string }[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)

  const dragRef  = useRef<{ nodeId: string; sx: number; sy: number; ox: number; oy: number } | null>(null)
  const panRef   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const canvasEl = useRef<HTMLDivElement>(null)

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
    if (!connecting || connecting.nodeId === nodeId) { setConnecting(null); return }
    setEdges(prev => [
      ...prev.filter(e => !(e.from === connecting.nodeId && e.fromPort === connecting.port)),
      { id: `e_${genId()}`, from: connecting.nodeId, fromPort: connecting.port, to: nodeId },
    ])
    setConnecting(null)
  }, [connecting])

  const addNode = (type: NodeType) => {
    const id  = genId()
    const cx  = (canvasEl.current?.clientWidth  ?? 800) / 2 / zoom - pan.x / zoom - NODE_W / 2
    const cy  = (canvasEl.current?.clientHeight ?? 600) / 2 / zoom - pan.y / zoom - 44
    const node: FlowNode = {
      id, type,
      position: { x: Math.round(cx), y: Math.round(cy) },
      data: type === 'menu'        ? { options: [{ id: genId(), number: 1, text: 'Opção 1' }] }
          : type === 'wait'        ? { seconds: 3 }
          : type === 'delay'       ? { seconds: 3 }
          : type === 'condition'   ? { conditionType: 'business_hours' }
          : type === 'action'      ? { actionType: 'create_lead' }
          : type === 'lead'        ? { actionType: 'create_lead' }
          : type === 'distribute'  ? { distributeMode: 'round_robin' }
          : type === 'media'       ? { mediaType: 'image' }
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

  const validate = (): string | null => {
    if (!nodes.find(n => n.type === 'start')) return 'O fluxo precisa de um bloco INÍCIO.'
    const connected = new Set<string>()
    const visit = (id: string) => { if (connected.has(id)) return; connected.add(id); edges.filter(e => e.from === id).forEach(e => visit(e.to)) }
    visit('start')
    const isolated = nodes.filter(n => n.id !== 'start' && !connected.has(n.id))
    if (isolated.length > 0) return `${isolated.length} bloco(s) isolado(s). Conecte todos os blocos.`
    return null
  }

  const save = async () => {
    const err = validate()
    if (err) { setValidationError(err); setTimeout(() => setValidationError(null), 4000); return }
    setSaving(true)
    try {
      await supabase.from('whatsapp_flows').upsert(
        { institution_id: institutionId, bot_flow: { nodes, edges }, updated_at: new Date().toISOString() },
        { onConflict: 'institution_id' }
      )
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const fitScreen = () => {
    if (!nodes.length || !canvasEl.current) return
    const xs = nodes.map(n => n.position.x), ys = nodes.map(n => n.position.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs) + NODE_W
    const minY = Math.min(...ys), maxY = Math.max(...ys) + 120
    const cw = canvasEl.current.clientWidth  - 80
    const ch = canvasEl.current.clientHeight - 80
    const newZoom = Math.min(1.5, Math.max(0.3, Math.min(cw / (maxX - minX + 1), ch / (maxY - minY + 1))))
    setZoom(newZoom)
    setPan({ x: (cw - (maxX - minX) * newZoom) / 2 - minX * newZoom + 40, y: (ch - (maxY - minY) * newZoom) / 2 - minY * newZoom + 40 })
  }

  const selectedNode = nodes.find(n => n.id === selectedId) ?? null

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <Loader2 size={32} color="#00A896" className="fe-spin" />
      <style>{`.fe-spin{animation:fe-s 1s linear infinite}@keyframes fe-s{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', zIndex: 2000, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <style>{`.fe-spin{animation:fe-s 1s linear infinite}@keyframes fe-s{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', height: 56, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> Voltar
        </button>
        <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Editor de Fluxo de Atendimento</span>
          <span style={{ fontSize: 11, color: '#94A3B8', background: '#F8FAFC', padding: '2px 8px', borderRadius: 999, border: '1px solid #E2E8F0' }}>{nodes.length} blocos · {edges.length} conexões</span>
          {connecting && (
            <span style={{ padding: '3px 10px', background: '#E6F7F5', color: '#00A896', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid #00A896' }}>
              🔗 Clique na entrada do bloco destino
            </span>
          )}
          {validationError && (
            <span style={{ padding: '3px 10px', background: '#FEF2F2', color: '#DC2626', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid #FECACA' }}>
              ⚠️ {validationError}
            </span>
          )}
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: saved ? '#16a34a' : '#00A896', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saved ? <><Check size={12} /> Salvo!</> : saving ? <><Loader2 size={12} className="fe-spin" /> Salvando…</> : <><Save size={12} /> Salvar fluxo</>}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left sidebar */}
        <div style={{ width: 172, background: '#F8FAFC', borderRight: '1px solid #E2E8F0', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px 4px' }}>Blocos</p>
          <div style={{ padding: '7px 10px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
            🟢 INÍCIO <span style={{ fontWeight: 400, color: '#4ade80', fontSize: 10 }}>(fixo)</span>
          </div>
          {NODE_DEFS.map(def => (
            <button key={def.type} onClick={() => addNode(def.type)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: `${def.color}10`, border: `1px solid ${def.color}30`, borderRadius: 8, fontSize: 11, fontWeight: 600, color: def.color, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
              {def.emoji} {def.label}
            </button>
          ))}
          <div style={{ marginTop: 8, padding: 9, background: '#fff', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 10, color: '#94A3B8', lineHeight: 1.5 }}>
            Clique para adicionar ao centro. Arraste pelo cabeçalho. Conecte pelas portas.
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasEl}
          onMouseDown={onCanvasMouseDown}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            background: showGrid
              ? `radial-gradient(circle, #cbd5e1 1px, transparent 1px) 0 0 / 24px 24px, #f8fafc`
              : '#f8fafc',
            cursor: 'default',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
            {/* SVG edges */}
            <svg style={{ position: 'absolute', left: -1000, top: -1000, width: 'calc(100% + 2000px)', height: 'calc(100% + 2000px)', pointerEvents: 'none', overflow: 'visible' }}>
              <defs>
                <marker id="fe-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0,8 3,0 6" fill="#00A896" />
                </marker>
                <marker id="fe-arrow-hov" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0,8 3,0 6" fill="#ef4444" />
                </marker>
              </defs>
              {edges.map(edge => {
                const fn = nodes.find(n => n.id === edge.from)
                const tn = nodes.find(n => n.id === edge.to)
                if (!fn || !tn) return null
                const { x: sx, y: sy } = outPortPos(fn, edge.fromPort)
                const { x: tx, y: ty } = inPortPos(tn)
                const pathD = bezier(sx, sy + 7, tx, ty - 7)
                const mx = (sx + tx) / 2
                const my = (sy + ty) / 2
                const isHovered = hoveredEdgeId === edge.id
                return (
                  <g key={edge.id} style={{ pointerEvents: 'all' }}
                    onMouseEnter={() => setHoveredEdgeId(edge.id)}
                    onMouseLeave={() => setHoveredEdgeId(null)}>
                    {/* invisible hit area */}
                    <path d={pathD} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }} />
                    {/* visible edge */}
                    <path d={pathD} fill="none"
                      stroke={isHovered ? '#ef4444' : '#00A896'}
                      strokeWidth={isHovered ? 2.5 : 2}
                      strokeDasharray={isHovered ? '6 3' : 'none'}
                      markerEnd={isHovered ? 'url(#fe-arrow-hov)' : 'url(#fe-arrow)'}
                      opacity={isHovered ? 1 : 0.7} />
                    {/* delete X button on hover */}
                    {isHovered && (
                      <g transform={`translate(${mx + 1000},${my + 1000})`}
                        onClick={() => { setEdges(prev => prev.filter(e => e.id !== edge.id)); setHoveredEdgeId(null) }}
                        style={{ cursor: 'pointer' }}>
                        <circle r="10" fill="#ef4444" stroke="#fff" strokeWidth="2" />
                        <line x1="-4" y1="-4" x2="4" y2="4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                        <line x1="4" y1="-4" x2="-4" y2="4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                      </g>
                    )}
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

          {/* Canvas controls — bottom left */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 4, zIndex: 10 }}>
            {[
              { icon: <ZoomIn size={13} />,    onClick: () => setZoom(z => Math.min(2,   +(z + 0.1).toFixed(1))), title: 'Zoom in' },
              { icon: <ZoomOut size={13} />,   onClick: () => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1))), title: 'Zoom out' },
              { icon: <Maximize2 size={13} />, onClick: fitScreen, title: 'Ajustar tela' },
              { icon: <span style={{ fontSize: 11 }}>⊞</span>, onClick: () => setShowGrid(g => !g), title: 'Grade', active: showGrid },
            ].map((btn, i) => (
              <button key={i} onClick={btn.onClick} title={btn.title}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (btn as any).active ? '#00A896' : '#fff', border: '1px solid #E2E8F0', borderRadius: 8, color: (btn as any).active ? '#fff' : '#64748B', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {btn.icon}
              </button>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, color: '#64748B', minWidth: 40, justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Minimap */}
          <Minimap nodes={nodes} pan={pan} zoom={zoom} />
        </div>

        {/* Right properties panel */}
        <div style={{ width: 272, background: '#fff', borderLeft: '1px solid #E2E8F0', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
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
              <p style={{ fontSize: 11, color: '#CBD5E1', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                Passe o mouse sobre uma conexão para deletá-la
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
