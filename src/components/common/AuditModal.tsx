import React, { useState, useEffect, useCallback } from 'react'
import { X, Pencil, Trash2, Check, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface LogEntry {
  id: string
  action: string
  details?: Record<string, unknown> | null
  // audit_logs fields
  field_changed?: string | null
  old_value?: string | null
  new_value?: string | null
  user_name?: string | null
  user_role?: string | null
  // activity_logs fields
  entity_id?: string | null
  entity_type?: string | null
  user_id?: string | null
  institution_id?: string | null
  created_at: string
}

const ACTION_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  created:        { icon: '➕', color: '#16a34a', bg: '#dcfce7', label: 'criou este registro' },
  updated:        { icon: '✏️', color: '#1d4ed8', bg: '#dbeafe', label: 'atualizou' },
  deleted:        { icon: '🗑️', color: '#dc2626', bg: '#fee2e2', label: 'excluiu este registro' },
  status_changed: { icon: '🔄', color: '#d97706', bg: '#fef3c7', label: 'alterou status' },
}

function actionIcon(action: string) {
  if (action === 'created' || action === 'Lead criado') return '➕'
  if (action === 'deleted') return '🗑️'
  if (action === 'note_added') return '📝'
  if (action.toLowerCase().includes('status') || action.toLowerCase().includes('moveu')) return '🔄'
  return '✏️'
}

interface Props {
  recordId: string
  moduleName: string
  isOpen: boolean
  onClose: () => void
}

export default function AuditModal({ recordId, moduleName, isOpen, onClose }: Props) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [userNameCache, setUserNameCache] = useState<Record<string, string>>({})

  // Note-adding state
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const resolveUserNames = useCallback(async (logsData: LogEntry[]) => {
    const ids = logsData
      .filter(l => l.user_id && !l.details?.changed_by && !l.details?.responsible_name && !l.details?.user_name)
      .map(l => l.user_id as string)
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return

    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', uniqueIds)

    if (data) {
      setUserNameCache(prev => {
        const next = { ...prev }
        for (const u of data) next[u.id] = u.full_name
        return next
      })
    }
  }, [])

  const loadLogs = useCallback(async () => {
    if (!recordId) return
    setLoading(true)

    if (moduleName === 'leads') {
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('entity_id', recordId)
        .eq('entity_type', 'lead')
        .order('created_at', { ascending: false })
      const logsData = (data ?? []) as LogEntry[]
      setLogs(logsData)
      await resolveUserNames(logsData)
    } else {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })
      setLogs((data ?? []) as LogEntry[])
    }

    setLoading(false)
  }, [recordId, moduleName, resolveUserNames])

  useEffect(() => {
    if (!isOpen || !recordId) return
    loadLogs()
  }, [isOpen, recordId, loadLogs])

  const handleAddNote = async () => {
    const trimmed = newNote.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await supabase.from('activity_logs').insert({
      action: 'note_added',
      entity_type: 'lead',
      entity_id: recordId,
      institution_id: user?.institution_id ?? null,
      user_id: user?.id ?? null,
      details: {
        note: trimmed,
        added_by: user?.full_name ?? 'Sistema',
      },
    })
    setNewNote('')
    setSaving(false)
    await loadLogs()
  }

  const handleDeleteNote = async (id: string) => {
    await supabase.from('activity_logs').delete().eq('id', id)
    await loadLogs()
  }

  const handleSaveEdit = async (log: LogEntry) => {
    const trimmed = editText.trim()
    if (!trimmed) return
    const updatedDetails = { ...(log.details ?? {}), note: trimmed }
    await supabase.from('activity_logs').update({ details: updatedDetails }).eq('id', log.id)
    setEditingId(null)
    setEditText('')
    await loadLogs()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(15,23,42,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        maxHeight: 'calc(100vh - 64px)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>
            Histórico de alterações
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#94a3b8', padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 52, borderRadius: 10, background: '#f8fafc', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, padding: '24px 0', margin: 0 }}>
              Nenhuma alteração registrada ainda.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.map(log => {
                const date = new Date(log.created_at)
                const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

                // ── activity_logs (leads) ──────────────────────────────────
                if (moduleName === 'leads') {
                  const details = log.details
                    ? (typeof log.details === 'string' ? JSON.parse(log.details) : log.details)
                    : {}
                  const icon = actionIcon(log.action)
                  const isStatusChange = log.action.toLowerCase().includes('status') || log.action.toLowerCase().includes('moveu')
                  const isNote = log.action === 'note_added'
                  const isEditing = editingId === log.id

                  // Resolve actor: prefer details fields, then cache, then 'Sistema'
                  const actor = (details?.changed_by as string)
                    ?? (details?.responsible_name as string)
                    ?? (details?.user_name as string)
                    ?? (details?.added_by as string)
                    ?? (log.user_id ? (userNameCache[log.user_id] ?? '...') : 'Sistema')

                  const iconBg = icon === '🔄' ? '#fef3c7'
                    : icon === '➕' ? '#dcfce7'
                    : icon === '🗑️' ? '#fee2e2'
                    : icon === '📝' ? '#f0f9ff'
                    : '#dbeafe'

                  const canEdit = isNote && (log.user_id === user?.id)

                  return (
                    <div key={log.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: isNote ? '#f0f9ff' : '#f8fafc',
                      border: `1px solid ${isNote ? '#bae6fd' : '#f1f5f9'}`,
                    }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 8, background: iconBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, flexShrink: 0,
                      }}>
                        {icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <textarea
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              rows={3}
                              style={{
                                width: '100%', border: '1px solid #93c5fd', borderRadius: 8,
                                padding: '6px 10px', fontSize: 13, resize: 'vertical',
                                outline: 'none', boxSizing: 'border-box',
                              }}
                              autoFocus
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => handleSaveEdit(log)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  background: '#1d4ed8', color: '#fff', border: 'none',
                                  borderRadius: 6, padding: '4px 10px', fontSize: 12,
                                  cursor: 'pointer', fontWeight: 600,
                                }}
                              >
                                <Check size={12} /> Salvar
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditText('') }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  background: '#f1f5f9', color: '#64748b', border: 'none',
                                  borderRadius: 6, padding: '4px 10px', fontSize: 12,
                                  cursor: 'pointer',
                                }}
                              >
                                <XCircle size={12} /> Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p style={{ margin: '0 0 2px', fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 600 }}>{actor}</span>
                              {' '}
                              {isNote ? (
                                <span style={{ color: '#0369a1' }}>adicionou uma observação</span>
                              ) : isStatusChange ? (
                                <>
                                  <span style={{ color: '#d97706' }}>
                                    {`moveu para "${details?.new_status ?? ''}"`}
                                  </span>
                                  {details?.previous_status && (
                                    <span style={{ color: '#94a3b8' }}> (de &ldquo;{details.previous_status as string}&rdquo;)</span>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#1d4ed8' }}>{log.action}</span>
                              )}
                            </p>
                            {isNote && details?.note && (
                              <p style={{
                                margin: '4px 0 2px', fontSize: 13, color: '#334155',
                                background: '#fff', border: '1px solid #e0f2fe',
                                borderRadius: 6, padding: '6px 10px', lineHeight: 1.5,
                              }}>
                                {details.note as string}
                              </p>
                            )}
                            {!isNote && details?.reason && details.reason !== 'Status alterado' && (
                              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{details.reason as string}</p>
                            )}
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
                              {dateStr} {timeStr}
                            </p>
                          </>
                        )}
                      </div>
                      {/* Edit/delete for notes (owner only) */}
                      {canEdit && !isEditing && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => { setEditingId(log.id); setEditText((log.details?.note as string) ?? '') }}
                            title="Editar observação"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#94a3b8', padding: 4, borderRadius: 4,
                              display: 'flex', alignItems: 'center',
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(log.id)}
                            title="Excluir observação"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#fca5a5', padding: 4, borderRadius: 4,
                              display: 'flex', alignItems: 'center',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                      {/* Date for non-note, non-editing entries */}
                      {!isNote && !isEditing && (
                        <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {dateStr} {timeStr}
                        </span>
                      )}
                    </div>
                  )
                }

                // ── audit_logs (outros módulos) ────────────────────────────
                const cfg = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.updated
                const date2 = new Date(log.created_at)
                const dateStr2 = date2.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                const timeStr2 = date2.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={log.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: '#f8fafc', border: '1px solid #f1f5f9',
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8, background: cfg.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, flexShrink: 0,
                    }}>
                      {cfg.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600 }}>{log.user_name || 'Sistema'}</span>
                        {' '}
                        <span style={{ color: cfg.color }}>{cfg.label}</span>
                        {log.field_changed && (
                          <span style={{ color: '#64748b' }}> ({log.field_changed})</span>
                        )}
                      </p>
                      {(log.old_value || log.new_value) && (
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                          {log.old_value && (
                            <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>
                              &ldquo;{log.old_value}&rdquo;
                            </span>
                          )}
                          {log.old_value && log.new_value && ' → '}
                          {log.new_value && (
                            <span style={{ color: '#334155', fontWeight: 500 }}>
                              &ldquo;{log.new_value}&rdquo;
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {dateStr2} {timeStr2}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer — add note (leads only) */}
        {moduleName === 'leads' && (
          <div style={{
            borderTop: '1px solid #f1f5f9', padding: '14px 24px', flexShrink: 0,
          }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#475569' }}>
              Adicionar observação
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Escreva uma observação sobre este lead..."
                rows={2}
                style={{
                  flex: 1, border: '1px solid #e2e8f0', borderRadius: 10,
                  padding: '8px 12px', fontSize: 13, resize: 'none',
                  outline: 'none', color: '#334155',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#93c5fd' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote()
                }}
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || saving}
                style={{
                  background: newNote.trim() ? '#1e2d6b' : '#e2e8f0',
                  color: newNote.trim() ? '#fff' : '#94a3b8',
                  border: 'none', borderRadius: 10, padding: '8px 16px',
                  fontSize: 13, fontWeight: 600, cursor: newNote.trim() ? 'pointer' : 'default',
                  transition: 'background 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {saving ? '...' : 'Salvar'}
              </button>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>
              Ctrl+Enter para salvar rapidamente
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
