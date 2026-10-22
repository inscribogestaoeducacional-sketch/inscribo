import { useNavigate } from 'react-router-dom'
import type { AlertNotification } from '../../hooks/useAlertNotifications'

// Lista dos avisos da Central (queda/silêncio do WhatsApp), usada no sino da
// escola (NotificationBell) e no do Super Admin (SuperAdminLayout). Clique:
// marca como lida e vai para a escola (o link vem do banco).

const SEVERITY: Record<string, { dot: string; bg: string; text: string }> = {
  danger:  { dot: '#F43F5E', bg: '#FFF1F2', text: '#9F1239' },
  warning: { dot: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  success: { dot: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  info:    { dot: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
}

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days !== 1 ? 's' : ''}`
}

export default function AlertNotificationList({ alerts, onMarkRead, onNavigate }: {
  alerts: AlertNotification[]
  onMarkRead: (ids: string[] | null) => void
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  if (!alerts.length) return null
  return (
    <div style={{ borderBottom: '1px solid #E2E8F0' }}>
      <div style={{ padding: '8px 16px', fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: '#64748B', background: '#F8FAFC' }}>
        Alertas do WhatsApp
      </div>
      {alerts.map(a => {
        const s = SEVERITY[a.resolved_at ? 'success' : a.severity] || SEVERITY.info
        const unread = !a.read_at && !a.resolved_at
        return (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!a.read_at) onMarkRead([a.id])
              if (a.link) { navigate(a.link); onNavigate?.() }
            }}
            onKeyDown={e => { if (e.key === 'Enter' && a.link) { if (!a.read_at) onMarkRead([a.id]); navigate(a.link); onNavigate?.() } }}
            style={{
              padding: '10px 16px', borderBottom: '0.5px solid #F1F5F9', display: 'flex', gap: 10, alignItems: 'flex-start',
              background: unread ? s.bg : '#fff', cursor: a.link ? 'pointer' : 'default',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: 6 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: unread ? 700 : 500, color: '#1A2B4A', flex: 1, minWidth: 0 }}>{a.title}</span>
                {a.resolved_at && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: s.text, background: s.bg, borderRadius: 999, padding: '1px 6px', flexShrink: 0 }}>
                    resolvido
                  </span>
                )}
              </div>
              {a.body && <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, margin: '2px 0 0' }}>{a.body}</p>}
              <span style={{ fontSize: 10, color: '#94A3B8', marginTop: 3, display: 'block' }}>
                {timeAgo(a.created_at)}
                {a.resolved_at ? ` · ${a.resolved_reason || 'resolvido'} ${timeAgo(a.resolved_at)}` : ''}
                {a.link ? ' · abrir →' : ''}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
