import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'

interface Props {
  institutionId: string | null
  isSuperAdmin?: boolean
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days !== 1 ? 's' : ''}`
}

const severityConfig: Record<string, { bg: string; color: string; icon: string; dot: string }> = {
  success: { bg: '#D1FAE5', color: '#065F46', icon: '✓', dot: '#10B981' },
  warning: { bg: '#FEF3C7', color: '#92400E', icon: '!', dot: '#F59E0B' },
  danger:  { bg: '#FFE4E6', color: '#9F1239', icon: '✕', dot: '#F43F5E' },
  info:    { bg: '#DBEAFE', color: '#1E40AF', icon: 'i', dot: '#3B82F6' },
}

function NotifDropdown({ notifications, unreadCount, markAsRead, markAllRead, navigate, onClose }: {
  notifications: any[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllRead: () => void
  navigate: (path: string) => void
  onClose: () => void
}) {
  const isMobile = window.innerWidth < 768
  return (
    <div style={{
      position: isMobile ? 'fixed' : 'absolute',
      top: isMobile ? 56 : 'calc(100% + 8px)',
      left: isMobile ? 0 : 'auto',
      right: isMobile ? 0 : 0,
      width: isMobile ? '100%' : 360,
      maxHeight: isMobile ? 'calc(100vh - 56px)' : 480,
      borderRadius: isMobile ? '0 0 20px 20px' : 16,
      overflowY: 'auto',
      background: '#fff',
      border: '1px solid #E2E8F0',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      zIndex: 999,
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F0FDFB' }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Notificações</span>
          {unreadCount > 0 && (
            <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: '#F43F5E', color: 'white', fontSize: 10, fontWeight: 700 }}>
              {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 11, color: '#00A896', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Lista */}
      <div>
        {notifications.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
            <p style={{ fontSize: 13, color: '#94A3B8' }}>Nenhuma notificação ainda</p>
          </div>
        ) : notifications.map(n => {
          const cfg = severityConfig[n.severity] || severityConfig.info
          const isUnread = !n.read_at
          return (
            <div
              key={n.id}
              onClick={() => { if (isUnread) markAsRead(n.id); if (n.action_url) { navigate(n.action_url); onClose() } }}
              style={{
                padding: '12px 16px', borderBottom: '0.5px solid #F1F5F9',
                background: isUnread ? '#FAFFFE' : '#fff',
                cursor: n.action_url ? 'pointer' : 'default',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0FDFB')}
              onMouseLeave={e => (e.currentTarget.style.background = isUnread ? '#FAFFFE' : '#fff')}
            >
              <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, marginTop: 1 }}>
                {cfg.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: isUnread ? 700 : 500, color: '#1A2B4A', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title}
                  </span>
                  {isUnread && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                  )}
                </div>
                <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, margin: 0 }}>{n.message}</p>
                <span style={{ fontSize: 10, color: '#CBD5E1', marginTop: 4, display: 'block' }}>{timeAgo(n.created_at)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function NotificationBell({ institutionId, isSuperAdmin = false }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications(institutionId, isSuperAdmin)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: 38, height: 38, borderRadius: 12,
          background: open ? '#E6F7F5' : '#F0FDFB',
          border: open ? '1.5px solid #00A896' : '0.5px solid #D1FAE5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', transition: 'all 0.15s',
        }}
      >
        <svg width="16" height="16" fill="none" stroke={open ? '#00A896' : '#64748B'} strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <div style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 999, background: '#F43F5E', border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white', padding: '0 3px' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {open && (
        <NotifDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          markAsRead={markAsRead}
          markAllRead={markAllRead}
          navigate={navigate}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
