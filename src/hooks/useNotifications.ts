import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface Notification {
  id: string
  institution_id: string
  type: 'weekly_alert' | 'goal_deviation' | 'milestone' | 'suggestion'
  title: string
  message: string
  severity: 'info' | 'warning' | 'danger' | 'success'
  read_at: string | null
  action_url: string | null
  created_at: string
}

export function useNotifications(institutionId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!institutionId) return

    fetchNotifications()

    const channel = supabase
      .channel(`notifications_${institutionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'system_notifications',
        filter: `institution_id=eq.${institutionId}`
      }, (payload) => {
        const newNotif = payload.new as Notification
        setNotifications(prev => [newNotif, ...prev])
        setUnreadCount(prev => prev + 1)

        if (Notification.permission === 'granted') {
          new Notification(newNotif.title, {
            body: newNotif.message,
            icon: '/favicon.ico'
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [institutionId])

  async function fetchNotifications() {
    if (!institutionId) return
    const { data } = await supabase
      .from('system_notifications')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      setNotifications(data as Notification[])
      setUnreadCount(data.filter(n => !n.read_at).length)
    }
  }

  async function markAsRead(id: string) {
    const now = new Date().toISOString()
    await supabase
      .from('system_notifications')
      .update({ read_at: now })
      .eq('id', id)

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read_at: now } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    if (!institutionId) return
    await supabase
      .from('system_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('institution_id', institutionId)
      .is('read_at', null)

    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    )
    setUnreadCount(0)
  }

  async function requestPushPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    return false
  }

  return { notifications, unreadCount, markAsRead, markAllRead, requestPushPermission, refetch: fetchNotifications }
}
