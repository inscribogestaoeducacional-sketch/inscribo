import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { supabase } from '../../lib/supabase'
import SchoolUpdateModal, { SchoolUpdateContent } from '../updates/SchoolUpdateModal'
import { useAlertNotifications, type AlertNotification } from '../../hooks/useAlertNotifications'
import { BottomSheet } from '../mobile/MobileShell'
import AlertNotificationList from './AlertNotificationList'

// Atualizações (school_updates) chegam no sino como system_notifications
// broadcast com action_url = "school_update:<id>" (ver AdminUpdates.tsx) —
// esse prefixo identifica que o clique deve abrir o conteúdo completo num
// modal em vez de navegar pra uma rota.
const SCHOOL_UPDATE_PREFIX = 'school_update:'

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

function NotifDropdown({ notifications, unreadCount, markAsRead, markAllRead, navigate, onClose, onOpenUpdate, alerts, onAlertRead }: {
  alerts: AlertNotification[]
  onAlertRead: (ids: string[] | null) => void
  notifications: any[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllRead: () => void
  navigate: (path: string) => void
  onClose: () => void
  onOpenUpdate: (updateId: string) => void
}) {
  const isMobile = window.innerWidth < 768
  const wrapStyle: React.CSSProperties = isMobile ? { background: '#fff' } : {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, maxHeight: 480, borderRadius: 16,
    overflowY: 'auto', background: '#fff', border: '1px solid #E2E8F0', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 999,
  }
  return (
    <div style={wrapStyle}>
      {/* Header */}
      <div style={{ padding: isMobile ? '4px 18px 12px' : '12px 16px', borderBottom: '0.5px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isMobile ? '#fff' : '#F0FDFB' }}>
        <div>
          <span style={{ fontSize: isMobile ? 18 : 14, fontWeight: 800, color: '#1A2B4A' }}>Notificações</span>
          {unreadCount > 0 && (
            <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: '#F43F5E', color: 'white', fontSize: 10, fontWeight: 700 }}>
              {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 11, color: '#05907B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Alertas da Central (queda/silêncio do WhatsApp) */}
      <AlertNotificationList alerts={alerts} onMarkRead={onAlertRead} onNavigate={onClose} />

      {/* Lista */}
      <div>
        {notifications.length === 0 && alerts.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, margin: '0 auto 12px', background: 'linear-gradient(135deg,#E6F7F5,#CFF5EA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" fill="none" stroke="#05907B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 2px' }}>Tudo em dia</p>
            <p style={{ fontSize: 12.5, color: '#94A3B8', margin: 0 }}>Nenhuma notificação por enquanto</p>
          </div>
        ) : notifications.map(n => {
          const cfg = severityConfig[n.severity] || severityConfig.info
          const isUnread = !n.read_at
          return (
            <div
              key={n.id}
              onClick={() => {
                if (isUnread) markAsRead(n.id)
                if (n.action_url?.startsWith(SCHOOL_UPDATE_PREFIX)) {
                  onOpenUpdate(n.action_url.slice(SCHOOL_UPDATE_PREFIX.length))
                  onClose()
                } else if (n.action_url) {
                  navigate(n.action_url)
                  onClose()
                }
              }}
              style={{
                padding: '12px 16px', borderBottom: isMobile ? 'none' : '0.5px solid #F1F5F9',
                ...(isMobile ? { margin: '0 14px 10px', borderRadius: 16, border: isUnread ? '1px solid #BFEDE4' : '1px solid #EEF2F7', boxShadow: '0 2px 10px rgba(26,43,74,.05)' } : {}),
                background: isUnread ? '#F4FFFC' : '#fff',
                cursor: n.action_url ? 'pointer' : 'default',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0FDFB')}
              onMouseLeave={e => (e.currentTarget.style.background = isUnread ? '#FAFFFE' : '#fff')}
            >
              <div style={{ width: isMobile ? 38 : 30, height: isMobile ? 38 : 30, borderRadius: isMobile ? 12 : '50%', flexShrink: 0, background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, marginTop: 1 }}>
                {cfg.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 13.5, fontWeight: isUnread ? 700 : 600, color: '#1A2B4A', flex: 1, minWidth: 0, ...(isMobile ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }) }}>
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
  const { notifications, unreadCount: oldUnread, markAsRead, markAllRead: markAllOld } = useNotifications(institutionId, isSuperAdmin)
  const { alerts, unread: alertsUnread, markRead: markAlertsRead } = useAlertNotifications()
  const unreadCount = oldUnread + alertsUnread
  const markAllRead = () => { void markAllOld(); if (alertsUnread) markAlertsRead(null) }
  const [viewUpdate, setViewUpdate] = useState<SchoolUpdateContent | null>(null)

  const openUpdate = async (updateId: string) => {
    const { data } = await supabase.from('school_updates').select('*').eq('id', updateId).maybeSingle()
    if (data) setViewUpdate(data as SchoolUpdateContent)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (window.innerWidth < 768) return
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
          border: open ? '1.5px solid #05907B' : '0.5px solid #D1FAE5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', transition: 'all 0.15s',
        }}
      >
        <svg width="16" height="16" fill="none" stroke={open ? '#05907B' : '#64748B'} strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <div style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 999, background: '#F43F5E', border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white', padding: '0 3px' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {open && !(window.innerWidth < 768) && (
        <NotifDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          markAsRead={markAsRead}
          markAllRead={markAllRead}
          navigate={navigate}
          onClose={() => setOpen(false)}
          onOpenUpdate={openUpdate}
          alerts={alerts}
          onAlertRead={markAlertsRead}
        />
      )}

      {window.innerWidth < 768 && (
        <BottomSheet open={open} onClose={() => setOpen(false)} label="Notificações" height="82dvh">
          <NotifDropdown
            notifications={notifications}
            unreadCount={unreadCount}
            markAsRead={markAsRead}
            markAllRead={markAllRead}
            navigate={navigate}
            onClose={() => setOpen(false)}
            onOpenUpdate={openUpdate}
            alerts={alerts}
            onAlertRead={markAlertsRead}
          />
        </BottomSheet>
      )}

      {viewUpdate && (
        <SchoolUpdateModal update={viewUpdate} onClose={() => setViewUpdate(null)} />
      )}
    </div>
  )
}
