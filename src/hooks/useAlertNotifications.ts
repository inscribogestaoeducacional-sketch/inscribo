import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── Avisos da Central de notificações (ETAPA 2) ─────────────────────────────
// Tabela notification_alerts (migration 20261022100000): queda e silêncio do
// WhatsApp. A RLS decide quem vê (Super Admin: todos; gestor: os da própria
// escola; atendente: não vê os de conexão), então aqui não há filtro por
// escola. Mostra os abertos e os resolvidos nas últimas 24 h (para a pessoa
// ver que voltou). Se a migration ainda não foi aplicada, fica vazio em
// silêncio — o sino antigo (system_notifications) continua igual.

export interface AlertNotification {
  id: string
  institution_id: string | null
  type: string
  category: 'conexao' | 'consumo' | 'geral'
  title: string
  body: string | null
  severity: 'info' | 'warning' | 'danger' | 'success'
  link: string | null
  created_at: string
  read_at: string | null
  resolved_at: string | null
  resolved_reason: string | null
}

const COLUMNS = 'id, institution_id, type, category, title, body, severity, link, created_at, read_at, resolved_at, resolved_reason'

export function useAlertNotifications(enabled = true) {
  const [alerts, setAlerts] = useState<AlertNotification[]>([])

  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const { data, error } = await supabase
        .from('notification_alerts')
        .select(COLUMNS)
        .or(`resolved_at.is.null,resolved_at.gte.${since}`)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) return   // tabela ainda não existe (migration não aplicada) ou sem acesso
      setAlerts((data ?? []) as AlertNotification[])
    } catch {
      /* sem a tabela, o sino segue só com os avisos antigos */
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void load()
    // Tempo real: aviso novo ou resolvido (a RLS filtra o que chega).
    const channel = supabase
      .channel(`notification_alerts_bell_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_alerts' }, () => { void load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [enabled, load])

  const markRead = useCallback(async (ids: string[] | null) => {
    const now = new Date().toISOString()
    setAlerts(prev => prev.map(a => (ids === null || ids.includes(a.id)) && !a.read_at ? { ...a, read_at: now } : a))
    try {
      await supabase.rpc('notification_alerts_mark_read', { p_ids: ids })
    } catch {
      /* fica marcado só na tela; recarrega na próxima abertura */
    }
  }, [])

  const unread = alerts.filter(a => !a.read_at && !a.resolved_at).length
  return { alerts, unread, markRead, refetch: load }
}
