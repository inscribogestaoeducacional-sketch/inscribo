import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

type UpdateType = 'news' | 'feature' | 'alert' | 'maintenance'

interface SchoolUpdate {
  id: string
  title: string
  content: string
  type: UpdateType
  media_url: string | null
  created_at: string
  expires_at: string | null
  read: boolean
}

const TYPE_LABELS: Record<UpdateType, { label: string; bg: string; color: string }> = {
  news:        { label: 'Novidade',       bg: '#DBEAFE', color: '#1D4ED8' },
  feature:     { label: 'Funcionalidade', bg: '#D1FAE5', color: '#065F46' },
  alert:       { label: 'Alerta',         bg: '#FEF3C7', color: '#92400E' },
  maintenance: { label: 'Manutenção',     bg: '#F1F5F9', color: '#475569' },
}

export default function GestorUpdates() {
  const { user } = useAuth()
  const institutionId = user?.institution_id || ''
  const [updates, setUpdates] = useState<SchoolUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)

  useEffect(() => {
    if (!institutionId) return
    load()
  }, [institutionId])

  async function load() {
    setLoading(true)
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
    const readSet = new Set((readsRes.data ?? []).map((r: { update_id: string }) => r.update_id))
    setUpdates(
      (updatesRes.data ?? []).map((u: Omit<SchoolUpdate, 'read'>) => ({
        ...u,
        read: readSet.has(u.id),
      }))
    )
    setLoading(false)
  }

  async function markAsRead(updateId: string) {
    setMarkingId(updateId)
    await supabase
      .from('school_update_reads')
      .upsert({ update_id: updateId, institution_id: institutionId }, { onConflict: 'update_id,institution_id' })
    setUpdates(prev => prev.map(u => u.id === updateId ? { ...u, read: true } : u))
    setMarkingId(null)
  }

  const unread = updates.filter(u => !u.read).length

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Central de Atualizações</h1>
            {unread > 0 && (
              <span style={{ padding: '3px 10px', background: '#F43F5E', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                {unread} nova{unread !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            Novidades e comunicados da Áion Edu para sua escola.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>Carregando...</div>
      ) : updates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 14, color: '#94A3B8' }}>Nenhuma atualização disponível no momento.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {updates.map(u => {
            const cfg = TYPE_LABELS[u.type as UpdateType] || TYPE_LABELS.news
            return (
              <div
                key={u.id}
                style={{
                  background: u.read ? '#fff' : '#FAFFFE',
                  border: u.read ? '1px solid #E2E8F0' : '1.5px solid #A7F3D0',
                  borderRadius: 16,
                  padding: '20px 22px',
                  transition: 'box-shadow 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  {/* Badge */}
                  <span style={{ padding: '3px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                    {cfg.label}
                  </span>
                  {!u.read && (
                    <span style={{ padding: '3px 10px', borderRadius: 999, background: '#FEE2E2', color: '#DC2626', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                      Não lida
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#CBD5E1', flexShrink: 0, marginTop: 4 }}>
                    {new Date(u.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: '12px 0 8px' }}>{u.title}</h2>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{u.content}</p>

                {u.media_url && (
                  <a
                    href={u.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: '#00A896', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Ver mais →
                  </a>
                )}

                {u.expires_at && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#F59E0B' }}>
                    Disponível até {new Date(u.expires_at).toLocaleDateString('pt-BR')}
                  </div>
                )}

                {!u.read && (
                  <div style={{ marginTop: 14 }}>
                    <button
                      onClick={() => markAsRead(u.id)}
                      disabled={markingId === u.id}
                      style={{
                        padding: '8px 18px', background: '#F0FDFB', color: '#00A896',
                        border: '1px solid #A7F3D0', borderRadius: 10,
                        fontSize: 12, fontWeight: 700, cursor: markingId === u.id ? 'not-allowed' : 'pointer',
                        opacity: markingId === u.id ? 0.6 : 1,
                      }}
                    >
                      {markingId === u.id ? 'Marcando...' : '✓ Marcar como lida'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
