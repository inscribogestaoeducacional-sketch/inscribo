import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SchoolUpdateModal, { SchoolUpdateContent } from './SchoolUpdateModal'

// Popup automático de novidade — mostra a school_update mais recente ainda
// não lida (school_update_reads) assim que o gestor entra no painel. Mesma
// fonte de dados/consulta de GestorUpdates.tsx ("Central de Atualizações"),
// só que dispara sozinho em vez de esperar clique. Montado uma única vez no
// wrapper da área da escola (App.tsx), então roda uma vez por sessão/reload,
// não a cada troca de rota interna.
export default function GestorUpdatePopup({ institutionId }: { institutionId: string }) {
  const [queue, setQueue] = useState<SchoolUpdateContent[]>([])

  useEffect(() => {
    if (!institutionId) return
    let cancelled = false
    ;(async () => {
      const now = new Date().toISOString()
      const [updatesRes, readsRes] = await Promise.all([
        supabase
          .from('school_updates')
          .select('*')
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('school_update_reads')
          .select('update_id')
          .eq('institution_id', institutionId),
      ])
      if (cancelled) return
      const readSet = new Set((readsRes.data ?? []).map((r: { update_id: string }) => r.update_id))
      const unread = (updatesRes.data ?? []).filter((u: SchoolUpdateContent) => !readSet.has(u.id))
      setQueue(unread)
    })()
    return () => { cancelled = true }
  }, [institutionId])

  const current = queue[0] ?? null

  const dismiss = async () => {
    if (!current) return
    setQueue(prev => prev.slice(1))
    await supabase
      .from('school_update_reads')
      .upsert({ update_id: current.id, institution_id: institutionId }, { onConflict: 'update_id,institution_id' })
  }

  if (!current) return null

  return (
    <SchoolUpdateModal
      update={current}
      onClose={dismiss}
      footer={
        <button
          onClick={dismiss}
          style={{ width: '100%', padding: '12px 0', background: '#00A896', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          Ok, entendi
        </button>
      }
    />
  )
}
