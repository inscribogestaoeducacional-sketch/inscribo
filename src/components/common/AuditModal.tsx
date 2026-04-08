import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

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
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !recordId) return
    setLoading(true)

    const load = async () => {
      if (moduleName === 'leads') {
        const { data } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('entity_id', recordId)
          .eq('entity_type', 'lead')
          .order('created_at', { ascending: false })
        setLogs((data ?? []) as LogEntry[])
      } else {
        const { data } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('record_id', recordId)
          .order('created_at', { ascending: false })
        setLogs((data ?? []) as LogEntry[])
      }
      setLoading(false)
    }

    load()
  }, [isOpen, recordId, moduleName])

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
        <div style={{ overflowY: 'auto', padding: '16px 24px', maxHeight: 420 }}>
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
                  const actor = details?.changed_by ?? details?.responsible_name ?? details?.user_name ?? 'Sistema'
                  const iconBg = icon === '🔄' ? '#fef3c7' : icon === '➕' ? '#dcfce7' : icon === '🗑️' ? '#fee2e2' : '#dbeafe'
                  return (
                    <div key={log.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: '#f8fafc', border: '1px solid #f1f5f9',
                    }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 8, background: iconBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, flexShrink: 0,
                      }}>
                        {icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 2px', fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600 }}>{actor}</span>
                          {' '}
                          <span style={{ color: isStatusChange ? '#d97706' : '#1d4ed8' }}>
                            {isStatusChange
                              ? `moveu para "${details?.new_status ?? ''}"`
                              : log.action}
                          </span>
                          {isStatusChange && details?.previous_status && (
                            <span style={{ color: '#94a3b8' }}> (de &ldquo;{details.previous_status}&rdquo;)</span>
                          )}
                        </p>
                        {details?.reason && details.reason !== 'Status alterado' && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{details.reason}</p>
                        )}
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
                          {dateStr} {timeStr}
                        </p>
                      </div>
                    </div>
                  )
                }

                // ── audit_logs (outros módulos) ────────────────────────────
                const cfg = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.updated
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
                      {dateStr} {timeStr}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
