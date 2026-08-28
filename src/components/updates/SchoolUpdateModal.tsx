import React from 'react'

export type UpdateType = 'news' | 'feature' | 'alert' | 'maintenance'

export interface SchoolUpdateContent {
  id: string
  title: string
  content: string
  type: UpdateType
  media_url: string | null
  created_at: string
  expires_at?: string | null
}

export const UPDATE_TYPE_LABELS: Record<UpdateType, { label: string; bg: string; color: string }> = {
  news:        { label: 'Novidade',       bg: '#DBEAFE', color: '#1D4ED8' },
  feature:     { label: 'Funcionalidade', bg: '#D1FAE5', color: '#065F46' },
  alert:       { label: 'Alerta',         bg: '#FEF3C7', color: '#92400E' },
  maintenance: { label: 'Manutenção',     bg: '#F1F5F9', color: '#475569' },
}

// Card de conteúdo completo de uma school_update — mesmo padrão visual usado
// em AdminUpdates.tsx/GestorUpdates.tsx (badge de tipo + título + conteúdo +
// link de mídia), reaproveitado aqui como modal pra dois pontos de entrada:
// clique no sino de notificações e popup automático de novidade não lida.
export default function SchoolUpdateModal({
  update,
  onClose,
  footer,
}: {
  update: SchoolUpdateContent
  onClose: () => void
  footer?: React.ReactNode
}) {
  const cfg = UPDATE_TYPE_LABELS[update.type] || UPDATE_TYPE_LABELS.news
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 540, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
              {cfg.label}
            </span>
            <span style={{ fontSize: 11, color: '#CBD5E1' }}>
              {new Date(update.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: '0 0 12px' }}>{update.title}</h2>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{update.content}</p>
          {update.media_url && (
            <a
              href={update.media_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 14, fontSize: 13, color: '#00A896', fontWeight: 600, textDecoration: 'none' }}
            >
              Ver mídia →
            </a>
          )}
          {update.expires_at && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#F59E0B' }}>
              Disponível até {new Date(update.expires_at).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          {footer ?? (
            <button
              onClick={onClose}
              style={{ width: '100%', padding: '12px 0', background: '#00A896', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Ok, entendi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
