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

const SIDEBAR_TYPES: NodeType[] = ['message','question','menu','transfer','condition','action','wait','media','end']

const NW = 240

function genId() {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function nodeH(node: { type: NodeType; data: Record<string, any> }): number {
  switch (node.type) {
    case 'start':      return 82
    case 'message': {
      const mt = node.data?.mediaType
      if (mt === 'document') return 160
      if (mt === 'contact')  return 180
      if (mt && mt !== 'text') return 120  // image / video / audio
      return 140
    }
    case 'question':   return 136
    case 'menu':       return 110 + (node.data.options?.length || 1) * 38
    case 'condition': {
      const conds: any[] = node.data?.conditions?.length
        ? node.data.conditions
        : node.data?.conditionType
          ? [{ conditionType: node.data.conditionType }]
          : [{}]
      let h = 60 + 32  // base + add-button
      for (const c of conds) {
        const ct = c.conditionType
        h += (ct === 'keyword' || ct === 'has_tag') ? 80 : 60
      }
      h += Math.max(0, conds.length - 1) * 28  // E/OU badges
      return h
    }
    case 'transfer':   return node.data.transferType === 'group' ? 220 : 180
    case 'wait':       return 82
    case 'media':      return 160
    case 'distribute': return 82
    case 'lead':       return 100
    case 'action': {
      const acts: any[] = node.data?.actions?.length
        ? node.data.actions
        : node.data?.actionType
          ? [{ actionType: node.data.actionType }]
          : [{}]
      let h = 80 + 32  // base + add-button
      for (const a of acts) {
        const at = a.actionType
        if (at === 'upsert_lead') h += 160
        else if (at === 'add_conversation_tag' || at === 'remove_conversation_tag') h += 120
        else h += 80
      }
      return h
    }
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
  groups,
  availableTags,
  onChange,
}: {
  node: FlowNode
  users: { id: string; full_name: string }[]
  groups: { id: string; name: string; emoji: string }[]
  availableTags: { id: string; name: string; color: string }[]
  onChange: (data: Record<string, any>) => void
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const d = node.data

  switch (node.type) {
    case 'start':
      return <div style={{ padding: 12 }}><p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Início do fluxo</p></div>

    case 'message': {
      const activeTab = d.mediaType || 'text'
      const tabs = [
        { key: 'text', label: 'Texto' }, { key: 'image', label: 'Imagem' },
        { key: 'video', label: 'Vídeo' }, { key: 'document', label: 'Doc' },
        { key: 'audio', label: 'Áudio' }, { key: 'contact', label: 'Contato' },
      ]
      const setTab = (key: string) =>
        onChange(key === 'text' ? { ...d, mediaType: undefined } : { ...d, mediaType: key })
      return (
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 2, marginBottom: 8, flexWrap: 'nowrap', overflowX: 'auto' }}>
            {tabs.map(t => (
              <button key={t.key} onMouseDown={stop} onClick={() => setTab(t.key)}
                style={{ padding: '3px 7px', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, fontWeight: 600, flexShrink: 0, background: activeTab === t.key ? '#3b82f6' : '#f1f5f9', color: activeTab === t.key ? 'white' : '#64748b' }}>
                {t.label}
              </button>
            ))}
          </div>
          {activeTab === 'text' && (
            <textarea rows={3} style={{ ...inputSt, resize: 'none' }}
              value={d.text || ''} placeholder="Digite a mensagem..."
              onChange={e => onChange({ ...d, text: e.target.value })}
              onMouseDown={stop} />
          )}
          {activeTab === 'image' && (
            <>
              <input style={inputSt} value={d.mediaUrl || ''} placeholder="URL da imagem"
                onChange={e => onChange({ ...d, mediaUrl: e.target.value })} onMouseDown={stop} />
              <input style={{ ...inputSt, marginTop: 6 }} value={d.caption || ''} placeholder="Legenda (opcional)"
                onChange={e => onChange({ ...d, caption: e.target.value })} onMouseDown={stop} />
            </>
          )}
          {activeTab === 'video' && (
            <>
              <input style={inputSt} value={d.mediaUrl || ''} placeholder="URL do vídeo"
                onChange={e => onChange({ ...d, mediaUrl: e.target.value })} onMouseDown={stop} />
              <input style={{ ...inputSt, marginTop: 6 }} value={d.caption || ''} placeholder="Legenda (opcional)"
                onChange={e => onChange({ ...d, caption: e.target.value })} onMouseDown={stop} />
            </>
          )}
          {activeTab === 'document' && (
            <>
              <input style={inputSt} value={d.mediaUrl || ''} placeholder="URL do documento"
                onChange={e => onChange({ ...d, mediaUrl: e.target.value })} onMouseDown={stop} />
              <input style={{ ...inputSt, marginTop: 6 }} value={d.filename || ''} placeholder="Nome do arquivo (ex: proposta.pdf)"
                onChange={e => onChange({ ...d, filename: e.target.value })} onMouseDown={stop} />
              <input style={{ ...inputSt, marginTop: 6 }} value={d.caption || ''} placeholder="Legenda (opcional)"
                onChange={e => onChange({ ...d, caption: e.target.value })} onMouseDown={stop} />
            </>
          )}
          {activeTab === 'audio' && (
            <input style={inputSt} value={d.mediaUrl || ''} placeholder="URL do áudio"
              onChange={e => onChange({ ...d, mediaUrl: e.target.value })} onMouseDown={stop} />
          )}
          {activeTab === 'contact' && (
            <>
              <input style={inputSt} value={d.contactName || ''} placeholder="Nome do contato *"
                onChange={e => onChange({ ...d, contactName: e.target.value })} onMouseDown={stop} />
              <input style={{ ...inputSt, marginTop: 6 }} value={d.contactPhone || ''} placeholder="Telefone (ex: 5583999999999) *"
                onChange={e => onChange({ ...d, contactPhone: e.target.value })} onMouseDown={stop} />
              <input style={{ ...inputSt, marginTop: 6 }} value={d.contactCompany || ''} placeholder="Empresa (opcional)"
                onChange={e => onChange({ ...d, contactCompany: e.target.value })} onMouseDown={stop} />
            </>
          )}
        </div>
      )
    }

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
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {(d.options || []).map((opt: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 5 }}>
                <span style={{
                  background: '#f59e0b', color: 'white', borderRadius: '50%',
                  width: 18, height: 18, fontSize: 10, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{i + 1}</span>
                <div style={{ flex: 1, position: 'relative' }}>
                  {(() => {
                    const limit = (d.options?.length || 0) <= 3 ? 20 : 24
                    const len = (opt.text || '').length
                    const over = len > limit
                    return (
                      <>
                        <input style={{ ...inputSt, paddingRight: 34, borderColor: over ? '#ef4444' : undefined }}
                          value={opt.text || ''} placeholder={`Opção ${i + 1}`}
                          onChange={e => {
                            const opts = [...(d.options || [])]
                            opts[i] = { ...opts[i], text: e.target.value }
                            onChange({ ...d, options: opts })
                          }}
                          onMouseDown={stop} />
                        <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontWeight: 600, pointerEvents: 'none', color: over ? '#ef4444' : '#94a3b8' }}>
                          {len}/{limit}
                        </span>
                      </>
                    )
                  })()}
                </div>
                <button onMouseDown={stop}
                  onClick={() => onChange({ ...d, options: (d.options || []).filter((_: any, j: number) => j !== i) })}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 15, padding: 0 }}>×</button>
              </div>
            ))}
          </div>
          <button onMouseDown={stop}
            onClick={() => onChange({ ...d, options: [...(d.options || []), { text: '' }] })}
            style={{
              marginTop: 4, width: '100%', padding: '4px',
              border: '1px dashed #f59e0b', borderRadius: 6,
              background: 'none', color: '#f59e0b', fontSize: 11, cursor: 'pointer',
            }}>+ Adicionar opção</button>
          <p style={{ fontSize: 10, color: '#64748b', marginTop: 6, lineHeight: 1.4, marginBottom: 0 }}>
            {(d.options?.length || 0) <= 3 ? '🔘 Botões interativos' : '📋 Lista interativa'}
          </p>
        </div>
      )

    case 'condition': {
      // Normalize legacy single-condition format to array
      const conditions: Array<Record<string, any>> = d.conditions?.length
        ? d.conditions
        : d.conditionType
          ? [{ conditionType: d.conditionType, operator: 'AND', keyword: d.keyword, tag: d.tag, tagScope: d.tagScope }]
          : [{ conditionType: 'business_hours', operator: 'AND' }]

      const updateCond = (i: number, patch: Record<string, any>) => {
        onChange({ ...d, conditions: conditions.map((c, j) => j === i ? { ...c, ...patch } : c) })
      }

      return (
        <div style={{ padding: 12 }}>
          {conditions.map((c, i) => (
            <React.Fragment key={i}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, position: 'relative' }}>
                {conditions.length > 1 && (
                  <button onMouseDown={stop}
                    onClick={() => onChange({ ...d, conditions: conditions.filter((_, j) => j !== i) })}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 5px' }}>
                    ×
                  </button>
                )}
                <select style={{ ...inputSt, paddingRight: conditions.length > 1 ? 28 : undefined }} value={c.conditionType || 'business_hours'}
                  onChange={e => updateCond(i, { conditionType: e.target.value })}
                  onMouseDown={stop}>
                  <option value="business_hours">Horário comercial</option>
                  <option value="lunch_break">Horário de almoço</option>
                  <option value="keyword">Palavra-chave</option>
                  <option value="first_message">Primeira mensagem</option>
                  <option value="has_tag">Tem etiqueta</option>
                </select>
                {c.conditionType === 'keyword' && (
                  <input style={{ ...inputSt, marginTop: 6 }}
                    value={c.keyword || ''} placeholder="Digite a palavra-chave"
                    onChange={e => updateCond(i, { keyword: e.target.value })}
                    onMouseDown={stop} />
                )}
                {c.conditionType === 'has_tag' && (
                  <>
                    {availableTags.length > 0 ? (
                      <select style={{ ...inputSt, marginTop: 6 }}
                        value={c.tag || ''} onChange={e => updateCond(i, { tag: e.target.value })}
                        onMouseDown={stop}>
                        <option value="">— Selecione a etiqueta —</option>
                        {availableTags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                    ) : (
                      <input style={{ ...inputSt, marginTop: 6 }}
                        value={c.tag || ''} placeholder="Nome da etiqueta (crie etiquetas nas configurações)"
                        onChange={e => updateCond(i, { tag: e.target.value })}
                        onMouseDown={stop} />
                    )}
                    <select style={{ ...inputSt, marginTop: 6 }}
                      value={c.tagScope || 'conversation'}
                      onChange={e => updateCond(i, { tagScope: e.target.value })}
                      onMouseDown={stop}>
                      <option value="conversation">Etiqueta da conversa</option>
                      <option value="lead">Etiqueta do lead</option>
                      <option value="both">Conversa ou lead</option>
                    </select>
                  </>
                )}
              </div>
              {i < conditions.length - 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                  <button onMouseDown={stop}
                    onClick={() => updateCond(i, { operator: c.operator === 'OR' ? 'AND' : 'OR' })}
                    style={{ padding: '2px 10px', borderRadius: 99, border: 'none', background: c.operator === 'OR' ? '#f97316' : '#3b82f6', color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    {c.operator === 'OR' ? 'OU' : 'E'}
                  </button>
                </div>
              )}
            </React.Fragment>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <button onMouseDown={stop}
              onClick={() => onChange({ ...d, conditions: [...conditions, { conditionType: 'business_hours', operator: 'AND' }] })}
              style={{ padding: '5px 8px', border: '1px dashed #ef4444', borderRadius: 6, background: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>
              + Adicionar condição
            </button>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#64748b' }}>
              <span style={{ color: '#10b981' }}>✓ Sim</span>
              <span style={{ color: '#ef4444' }}>✗ Não</span>
            </div>
          </div>
        </div>
      )
    }

    case 'transfer': {
      const tType = d.transferType || 'attendant'
      return (
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['attendant', 'group'] as const).map(opt => (
              <button key={opt} onMouseDown={e => e.stopPropagation()}
                onClick={() => onChange({ ...d, transferType: opt, assignee_id: '', assignee_name: '', group_id: '', group_name: '' })}
                style={{ flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: '1px solid', background: tType === opt ? '#0d9488' : 'white', color: tType === opt ? 'white' : '#64748b', borderColor: tType === opt ? '#0d9488' : '#e2e8f0' }}>
                {opt === 'attendant' ? '👤 Atendente' : '👥 Grupo'}
              </button>
            ))}
          </div>
          {tType !== 'group' ? (
            <select style={inputSt} value={d.assignee_id || ''}
              onChange={e => {
                const selected = users.find(u => u.id === e.target.value)
                onChange({ ...d, assignee_id: e.target.value, assignee_name: selected?.full_name || '' })
              }}
              onMouseDown={stop}>
              <option value="">Selecionar atendente...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          ) : (
            <select style={inputSt} value={d.group_id || ''}
              onChange={e => {
                const g = groups.find(g => g.id === e.target.value)
                onChange({ ...d, group_id: e.target.value, group_name: g ? `${g.emoji} ${g.name}` : '' })
              }}
              onMouseDown={stop}>
              <option value="">Selecionar grupo...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
            </select>
          )}
          <input style={{ ...inputSt, marginTop: 6 }}
            value={d.message || ''} placeholder="Mensagem antes de transferir (opcional)"
            onChange={e => onChange({ ...d, message: e.target.value })}
            onMouseDown={stop} />
        </div>
      )
    }

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

    case 'action': {
      // Normalize legacy single-action format to array
      const actions: Array<Record<string, any>> = d.actions?.length
        ? d.actions
        : d.actionType
          ? [{ actionType: d.actionType, tag: d.tag, student_name: d.student_name, email: d.email, status: d.status }]
          : [{ actionType: 'create_lead' }]

      const updateAction = (i: number, patch: Record<string, any>) => {
        onChange({ ...d, actions: actions.map((a, j) => j === i ? { ...a, ...patch } : a) })
      }

      return (
        <div style={{ padding: 12 }}>
          {actions.map((a, i) => (
            <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, marginBottom: 6, position: 'relative' }}>
              {actions.length > 1 && (
                <button onMouseDown={stop}
                  onClick={() => onChange({ ...d, actions: actions.filter((_, j) => j !== i) })}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 5px' }}>
                  ×
                </button>
              )}
              <select style={{ ...inputSt, paddingRight: actions.length > 1 ? 28 : undefined }} value={a.actionType || 'create_lead'}
                onChange={e => updateAction(i, { actionType: e.target.value })}
                onMouseDown={stop}>
                <option value="create_lead">Criar lead</option>
                <option value="upsert_lead">Criar/atualizar lead</option>
                <option value="add_tag">Adicionar etiqueta (conv.)</option>
                <option value="add_conversation_tag">Adicionar etiqueta</option>
                <option value="remove_conversation_tag">Remover etiqueta</option>
                <option value="link_lead">Vincular lead</option>
                <option value="close_conversation">Encerrar conversa</option>
              </select>
              {(a.actionType === 'add_tag' || a.actionType === 'add_conversation_tag' || a.actionType === 'remove_conversation_tag') && (
                availableTags.length > 0 ? (
                  <select style={{ ...inputSt, marginTop: 6 }}
                    value={a.tag || ''} onChange={e => updateAction(i, { tag: e.target.value })}
                    onMouseDown={stop}>
                    <option value="">— Selecione a etiqueta —</option>
                    {availableTags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                ) : (
                  <input style={{ ...inputSt, marginTop: 6 }}
                    value={a.tag || ''} placeholder="Nome da etiqueta (crie em Configurações → Etiquetas)"
                    onChange={e => updateAction(i, { tag: e.target.value })}
                    onMouseDown={stop} />
                )
              )}
              {a.actionType === 'upsert_lead' && (
                <>
                  <input style={{ ...inputSt, marginTop: 6 }}
                    value={a.student_name || ''} placeholder="Nome (ou {{nome_aluno}})"
                    onChange={e => updateAction(i, { student_name: e.target.value })}
                    onMouseDown={stop} />
                  <input style={{ ...inputSt, marginTop: 6 }}
                    value={a.email || ''} placeholder="E-mail (opcional)"
                    onChange={e => updateAction(i, { email: e.target.value })}
                    onMouseDown={stop} />
                  <select style={{ ...inputSt, marginTop: 6 }}
                    value={a.status || 'novo'}
                    onChange={e => updateAction(i, { status: e.target.value })}
                    onMouseDown={stop}>
                    <option value="novo">Novo</option>
                    <option value="contato">Em contato</option>
                    <option value="matriculado">Matriculado</option>
                  </select>
                </>
              )}
            </div>
          ))}
          <button onMouseDown={stop}
            onClick={() => onChange({ ...d, actions: [...actions, { actionType: 'create_lead' }] })}
            style={{ width: '100%', padding: '5px', border: '1px dashed #ec4899', borderRadius: 6, background: 'none', color: '#ec4899', fontSize: 11, cursor: 'pointer', marginTop: 2 }}>
            + Adicionar ação
          </button>
        </div>
      )
    }

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
  users, groups, availableTags,
  onSelect, onDragStart, onPortMouseDown, onPortMouseUp, onChange, onDelete,
}: {
  node: FlowNode
  selected: boolean
  zoom: number
  pan: { x: number; y: number }
  dragging: boolean
  users: { id: string; full_name: string }[]
  groups: { id: string; name: string; emoji: string }[]
  availableTags: { id: string; name: string; color: string }[]
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
        <span style={{ color: 'white', fontWeight: 700, fontSize: 12, flex: 1 }}>
          {node.type === 'message' && node.data?.mediaType
            ? ({'image':'Imagem','video':'Vídeo','document':'Documento','audio':'Áudio','contact':'Contato'} as Record<string,string>)[node.data.mediaType] ?? cfg.label
            : cfg.label}
        </span>
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
      <NodeBody node={node} users={users} groups={groups} availableTags={availableTags} onChange={onChange} />

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
  const isCondEdge = fromNode.type === 'condition' && (edge.fromPortId === 'yes' || edge.fromPortId === 'no')
  const condLabel  = edge.fromPortId === 'yes' ? 'Sim' : 'Não'
  const condColor  = edge.fromPortId === 'yes' ? '#10b981' : '#ef4444'
  const labelX = from.x * 0.7 + to.x * 0.3
  const labelY = from.y * 0.7 + to.y * 0.3
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
      {isCondEdge && !hov && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={labelX - 14} y={labelY - 9} width={28} height={16} rx={4} fill="white" stroke={condColor} strokeWidth={1} />
          <text x={labelX} y={labelY + 4} textAnchor="middle" fill={condColor} fontSize={10} fontWeight="bold">{condLabel}</text>
        </g>
      )}
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
  const [groups, setGroups]         = useState<{ id: string; name: string; emoji: string }[]>([])
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [draftBanner, setDraftBanner] = useState(false)
  const [draftData, setDraftData]     = useState<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null)
  const dirtyRef = useRef(false)

  const canvasRef = useRef<HTMLDivElement>(null)
  const zoomRef   = useRef(zoom)
  const panRef    = useRef(pan)
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { panRef.current = pan }, [pan])

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[FlowEditor] mount — institutionId:', institutionId)
    ;(async () => {
      const [{ data: fl }, { data: us }, { data: grp }, { data: tg }] = await Promise.all([
        supabase.from('whatsapp_flows')
          .select('bot_flow, bot_enabled')
          .eq('institution_id', institutionId)
          .maybeSingle(),
        supabase.from('users')
          .select('id, full_name')
          .eq('institution_id', institutionId),
        supabase.from('whatsapp_groups')
          .select('id, name, emoji')
          .eq('institution_id', institutionId),
        supabase.from('whatsapp_tags')
          .select('id, name, color')
          .eq('institution_id', institutionId)
          .order('name'),
      ])
      if (us) setUsers(us)
      if (grp) setGroups(grp as { id: string; name: string; emoji: string }[])
      if (tg) setAvailableTags(tg as { id: string; name: string; color: string }[])
      if (fl?.bot_enabled != null) setIsActive(fl.bot_enabled)

      const bf = fl?.bot_flow as { nodes?: any[]; edges?: any[] } | null
      console.log('[FlowEditor] nodes loaded:', JSON.stringify(bf?.nodes ?? [], null, 2))
      let nodesToFit: FlowNode[] = []
      if (bf?.nodes?.length) {
        const loadedNodes: FlowNode[] = bf.nodes.map((n: any) => ({
          ...n, width: NW, height: nodeH(n),
        }))
        nodesToFit = loadedNodes
        setNodes(loadedNodes)
        setEdges((bf.edges || []).map(migrateEdge))
      } else {
        const s: FlowNode = { id: 'start-1', type: 'start',  position: { x: 200, y: 80 },  data: {}, width: NW, height: 82 }
        const m: FlowNode = { id: 'msg-1',   type: 'message', position: { x: 200, y: 220 }, data: { text: 'Olá! Bem-vindo. Como posso ajudar?' }, width: NW, height: 136 }
        nodesToFit = [s, m]
        setNodes([s, m])
        setEdges([{ id: 'e-default', fromNodeId: 'start-1', fromPortId: 'out', toNodeId: 'msg-1', toPortId: 'in' }])
      }
      setLoading(false)
      try {
        const dKey = `flow_draft_${institutionId}`
        const raw = localStorage.getItem(dKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Date.now() - (parsed.savedAt || 0) < 30 * 60 * 1000) {
            setDraftData({ nodes: parsed.nodes, edges: parsed.edges })
            setDraftBanner(true)
          } else {
            localStorage.removeItem(dKey)
          }
        }
      } catch {}
      setTimeout(() => {
        const el = canvasRef.current
        if (!nodesToFit.length || !el) return
        const xs = nodesToFit.map(n => n.position.x)
        const ys = nodesToFit.map(n => n.position.y)
        const minX = Math.min(...xs), maxX = Math.max(...xs) + NW
        const minY = Math.min(...ys), maxY = Math.max(...ys) + 160
        const cw = el.clientWidth - 80, ch = el.clientHeight - 80
        const nz = Math.min(1.5, Math.max(0.25, Math.min(cw / (maxX - minX + 1), ch / (maxY - minY + 1))))
        setZoom(nz)
        setPan({ x: (cw - (maxX - minX) * nz) / 2 - minX * nz + 40, y: (ch - (maxY - minY) * nz) / 2 - minY * nz + 40 })
      }, 100)
    })()
  }, [institutionId])

  // ── Wheel zoom (cursor-centered) ──────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect   = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      setZoom(prev => {
        const newZoom = Math.min(2.5, Math.max(0.25, prev * factor))
        setPan(p => ({
          x: mouseX - (mouseX - p.x) * (newZoom / prev),
          y: mouseY - (mouseY - p.y) * (newZoom / prev),
        }))
        return newZoom
      })
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // ── Draft auto-save to localStorage ──────────────────────────────────────
  useEffect(() => {
    if (!dirtyRef.current) return
    try {
      localStorage.setItem(`flow_draft_${institutionId}`, JSON.stringify({ nodes, edges, savedAt: Date.now() }))
    } catch {}
  }, [nodes, edges, institutionId])

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
      window.removeEventListener('touchend',   onUp as EventListener)
      window.removeEventListener('touchcancel', onUp as EventListener)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend',   onUp as EventListener)
    window.addEventListener('touchcancel', onUp as EventListener)
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
    // Only block duplicate connections on non-input ports; 'in' ports accept multiple sources
    const alreadyConnected = toPortId !== 'in' && edges.some(e => e.toNodeId === toNodeId && e.toPortId === toPortId)
    if (alreadyConnected) { setConnecting(null); return }
    setEdges(prev => [...prev, {
      id: `${connecting.fromNodeId}-${connecting.fromPortId}-${toNodeId}-${toPortId}`,
      fromNodeId: connecting.fromNodeId,
      fromPortId: connecting.fromPortId,
      toNodeId,
      toPortId,
    }])
    setConnecting(null)
    dirtyRef.current = true
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
    if (type === 'condition')  defaultData.conditions = [{ conditionType: 'business_hours', operator: 'AND' }]
    if (type === 'wait')       defaultData.seconds = 5
    if (type === 'media')      defaultData.mediaType = 'image'
    if (type === 'distribute') defaultData.distributeMode = 'round_robin'
    if (type === 'action')     defaultData.actions = [{ actionType: 'create_lead' }]
    if (type === 'lead')       defaultData.actionType = 'create_lead'
    const rect = canvasRef.current?.getBoundingClientRect()
    const cx = rect ? Math.round((rect.width  / 2 - pan.x) / zoom) : 300
    const cy = rect ? Math.round((rect.height / 2 - pan.y) / zoom) : 200
    const newNode: FlowNode = {
      id, type,
      position: { x: cx - NW / 2, y: cy - 50 },
      data: defaultData,
      width: NW,
      height: nodeH({ type, data: defaultData }),
    }
    setNodes(prev => [...prev, newNode])
    setSelected(id)
    dirtyRef.current = true
  }

  const deleteNode = (id: string) => {
    if (id === 'start-1' || id === 'start') return
    setNodes(prev => prev.filter(n => n.id !== id))
    setEdges(prev => prev.filter(e => e.fromNodeId !== id && e.toNodeId !== id))
    if (selectedNode === id) setSelected(null)
    dirtyRef.current = true
  }

  const updateNodeData = (id: string, data: Record<string, any>) => {
    setNodes(prev => prev.map(n =>
      n.id === id ? { ...n, data, height: nodeH({ type: n.type, data }) } : n
    ))
    dirtyRef.current = true
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!institutionId) {
      console.error('[FlowEditor] institutionId vazio — não é possível salvar')
      alert('Erro: institution ID não encontrado. Recarregue a página.')
      return
    }
    setSaving(true)
    const botFlow = { nodes, edges }
    console.log('[FlowEditor] salvando para institution_id:', institutionId, 'nodes:', nodes.length, 'edges:', edges.length)
    console.log('[SAVE] nodes:', JSON.stringify(nodes.map(n => ({ type: n.type, data: n.data })), null, 2))

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
      try { localStorage.removeItem(`flow_draft_${institutionId}`) } catch {}
      setDraftBanner(false)
      dirtyRef.current = false
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

      {/* ── Draft recovery banner ── */}
      {draftBanner && draftData && (
        <div style={{
          background: '#fef9c3', borderBottom: '1px solid #fde68a',
          padding: '8px 16px', display: 'flex', alignItems: 'center',
          gap: 12, fontSize: 12, color: '#92400e', flexShrink: 0,
        }}>
          <span>⚠️ Rascunho não salvo encontrado da sessão anterior.</span>
          <button
            onClick={() => { setNodes(draftData.nodes); setEdges(draftData.edges); setDraftBanner(false); setDraftData(null) }}
            style={{ padding: '4px 10px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
            Usar rascunho
          </button>
          <button
            onClick={() => { try { localStorage.removeItem(`flow_draft_${institutionId}`) } catch {} setDraftBanner(false); setDraftData(null) }}
            style={{ padding: '4px 10px', background: 'white', color: '#92400e', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
            Descartar
          </button>
        </div>
      )}

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
                onDelete={() => { setEdges(prev => prev.filter(e => e.id !== edge.id)); dirtyRef.current = true }}
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
              groups={groups}
              availableTags={availableTags}
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
