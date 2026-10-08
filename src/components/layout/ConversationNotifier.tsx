import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// Avisos por pessoa do WhatsApp (tabela user_notifications): conversa
// transferida pra mim, ou conversa minha assumida/transferida por outra
// pessoa. Montado no TopBar, então funciona em qualquer tela do painel.
// O canal Realtime respeita o RLS — cada usuário só recebe os próprios.
//
// Ao chegar: bipe + toast + notificação do navegador (clicar abre a
// conversa no Hub). Também dispara o evento de janela
// 'aion:conversation-notification', que o WhatsAppHub usa pra pôr a conversa
// na lista na hora (ou tirar, se ela deixou de ser visível).

export interface ConversationNotification {
  id: string
  type: 'conversation_transferred' | 'conversation_taken' | string
  title: string
  body: string | null
  remote_jid: string | null
  institution_id: string | null
}

export const CONVERSATION_NOTIFICATION_EVENT = 'aion:conversation-notification'

function beep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin(2 * Math.PI * 880 * i / ctx.sampleRate) * Math.exp(-i / (ctx.sampleRate * 0.05))
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start()
  } catch { /* sem áudio (navegador bloqueou) — o toast ainda aparece */ }
}

export default function ConversationNotifier({ userId }: { userId: string | null }) {
  const navigate = useNavigate()
  const [toast, setToast] = useState<ConversationNotification | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openConversation = (n: ConversationNotification) => {
    if (!n.remote_jid) { navigate('/whatsapp'); return }
    // Mesmo caminho do botão WhatsApp do perfil do contato: o Hub abre a
    // conversa pelo telefone (state.phone), em modo leitura se não for minha.
    navigate('/whatsapp', { state: { phone: n.remote_jid.replace(/@.*/, '') } })
  }
  // Clique na notificação do navegador chega depois, fora do render.
  const openConversationRef = useRef(openConversation)
  openConversationRef.current = openConversation

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`user-notif-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload: { new: unknown }) => {
        const n = payload.new as ConversationNotification
        window.dispatchEvent(new CustomEvent(CONVERSATION_NOTIFICATION_EVENT, { detail: n }))
        beep()
        setToast(n)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 6000)
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const browserNotif = new Notification(n.title, { body: n.body || undefined, icon: '/favicon.ico', tag: `conv-${n.id}` })
            browserNotif.onclick = () => { window.focus(); openConversationRef.current(n); browserNotif.close() }
          } catch { /* notificação do navegador indisponível — fica o toast */ }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  if (!toast) return null
  return (
    <div style={{ position: 'fixed', top: 72, right: 24, zIndex: 1000 }}>
      <button
        onClick={() => { openConversation(toast); setToast(null) }}
        style={{ textAlign: 'left', background: '#FFFFFF', border: '1px solid #6EE7B7', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '10px 16px', cursor: 'pointer', maxWidth: 320 }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>{toast.title}</div>
        {toast.body && <div style={{ fontSize: 12, color: '#1A2B4A', marginTop: 2 }}>{toast.body}</div>}
        <div style={{ fontSize: 11, color: '#00A896', fontWeight: 600, marginTop: 4 }}>Abrir conversa</div>
      </button>
    </div>
  )
}
