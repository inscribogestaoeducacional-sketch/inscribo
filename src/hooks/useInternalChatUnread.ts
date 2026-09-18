import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Contador de mensagens não lidas do Chat Interno pro badge do menu lateral
// — mesmo padrão de useNotifications.ts (fetch inicial + realtime).
export function useInternalChatUnread(institutionId: string | null, userId: string | null) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!institutionId || !userId) { setUnreadCount(0); return }

    fetchCount()

    const channel = supabase
      .channel(`internal_chat_unread_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'internal_messages',
        filter: `recipient_id=eq.${userId}`,
      }, () => setUnreadCount(c => c + 1))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'internal_messages',
        filter: `recipient_id=eq.${userId}`,
      }, fetchCount)
      .subscribe()

    return () => { supabase.removeChannel(channel) }

    async function fetchCount() {
      const { count } = await supabase
        .from('internal_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null)
      setUnreadCount(count || 0)
    }
  }, [institutionId, userId])

  return unreadCount
}
