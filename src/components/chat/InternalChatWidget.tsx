// src/components/chat/InternalChatWidget.tsx
//
// Balão flutuante global do Chat Interno — mesmo padrão visual de widget de
// "fale conosco" (círculo fixo no canto inferior direito, badge de não
// lidas, clique expande o painel). Montado UMA VEZ no nível do layout da
// área da escola (App.tsx), igual GestorUpdatePopup — fica visível em
// qualquer tela da escola, não só dentro do WhatsAppHub (que antes tinha um
// drawer próprio, removido em favor deste widget único).
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useInternalChatUnread } from '../../hooks/useInternalChatUnread'
import InternalChat from './InternalChat'
import { MessageSquare, X } from 'lucide-react'

const PANEL_WIDTH = 380
const PANEL_MAX_HEIGHT = 520

export default function InternalChatWidget() {
  const { user } = useAuth()
  const institutionId = user?.institution_id || null
  const [open, setOpen] = useState(false)
  const unreadCount = useInternalChatUnread(institutionId, user?.id || null)

  if (!institutionId) return null

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>

      {open && (
        <div style={{
          width: PANEL_WIDTH, maxWidth: 'calc(100vw - 32px)',
          height: PANEL_MAX_HEIGHT, maxHeight: 'min(70vh, 640px)',
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(15,23,42,0.22)', border: '1px solid #E2E8F0',
          display: 'flex', flexDirection: 'column',
        }}>
          <InternalChat compact onClose={() => setOpen(false)} />
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        title={open ? 'Fechar chat interno' : 'Chat interno com a equipe'}
        style={{
          position: 'relative', width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: open ? '#1A2B4A' : 'linear-gradient(135deg, #00A896, #0DD3BF)',
          border: 'none', cursor: 'pointer', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(0,168,150,0.4)', transition: 'background 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
        {!open && unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, padding: '0 4px',
            borderRadius: 9999, background: '#F43F5E', color: '#fff', fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
