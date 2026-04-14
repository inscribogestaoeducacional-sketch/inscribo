import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useWhatsappSend } from '../../hooks/useWhatsappSend'

interface Message {
  id: string
  content: string
  from_me: boolean
  timestamp: string
  status: string
}

interface Props {
  institutionId: string
  remoteJid: string
  contactName: string
}

export default function WhatsappChatBox({ institutionId, remoteJid, contactName }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const { sendMessage, sending } = useWhatsappSend()

  // Carrega mensagens iniciais
  useEffect(() => {
    if (!remoteJid) return
    supabase
      .from('whatsapp_messages')
      .select('id, content, from_me, timestamp, status')
      .eq('institution_id', institutionId)
      .eq('remote_jid', remoteJid)
      .order('timestamp', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) setMessages(data)
      })
  }, [remoteJid, institutionId])

  // Realtime — novas mensagens
  useEffect(() => {
    if (!remoteJid) return
    const channel = supabase
      .channel(`chat-${remoteJid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `remote_jid=eq.${remoteJid}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [remoteJid])

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    await sendMessage({ institutionId, to: remoteJid, text })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#F0F2F5]">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-3 py-2 rounded-xl text-sm shadow-sm ${
                msg.from_me
                  ? 'bg-[#D9FDD3] text-[#1A2B4A] rounded-br-none'
                  : 'bg-white text-[#1A2B4A] rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className="text-[10px] text-[#94A3B8] text-right mt-1">
                {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                  hour: '2-digit', minute: '2-digit'
                })}
                {msg.from_me && (
                  <span className="ml-1">
                    {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                  </span>
                )}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 flex items-end gap-2 px-4 py-3 bg-white border-t border-[#E2E8F0]">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Mensagem para ${contactName}...`}
          rows={1}
          className="flex-1 resize-none px-3 py-2.5 text-sm bg-[#F1F5F9] rounded-xl outline-none focus:ring-2 focus:ring-[#00A896] text-[#1A2B4A] max-h-32"
          style={{ overflowY: 'auto' }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="flex-shrink-0 w-10 h-10 bg-[#00A896] rounded-full flex items-center justify-center text-white hover:bg-[#008f81] disabled:opacity-40 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}