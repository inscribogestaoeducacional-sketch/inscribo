import { useState } from 'react'

interface SendMessageParams {
  institutionId: string
  to: string
  text: string
}

export function useWhatsappSend() {
  const [sending, setSending] = useState(false)

  const sendMessage = async ({ institutionId, to, text }: SendMessageParams) => {
    if (!text.trim()) return { success: false }
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: institutionId,
          to,
          text,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return { success: true, wamid: data.wamid }
    } catch (err: any) {
      console.error('Erro ao enviar:', err)
      return { success: false, error: err.message }
    } finally {
      setSending(false)
    }
  }

  return { sendMessage, sending }
}