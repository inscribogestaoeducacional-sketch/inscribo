// src/components/chat/InternalChat.tsx
//
// Chat Interno — conversa 1 a 1 entre membros da MESMA escola (atendentes +
// gestor). Sem grupos, sem conversa entre escolas diferentes. Layout de duas
// colunas e realtime seguem o mesmo padrão do WhatsAppHub.tsx (subscription
// via supabase.channel().on('postgres_changes', ...)), adaptado pra
// internal_messages.
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Send, Search, MessageSquare } from 'lucide-react'

interface Colleague {
  id: string
  full_name: string
  role: string
}

interface InternalMessage {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  read_at: string | null
  created_at: string
}

interface ConversationPreview {
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador', manager: 'Gestor', user: 'Atendente',
}

function initialsOf(name: string): string {
  return (name || '?').trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function InternalChat() {
  const { user } = useAuth()
  const institutionId = user?.institution_id || null
  const myId = user?.id || null

  const [colleagues, setColleagues]   = useState<Colleague[]>([])
  const [previews, setPreviews]       = useState<Record<string, ConversationPreview>>({})
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [activeId, setActiveId]       = useState<string | null>(null)
  const [messages, setMessages]       = useState<InternalMessage[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft]             = useState('')
  const [sending, setSending]         = useState(false)

  const activeIdRef = useRef<string | null>(null)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Carrega colegas da mesma escola + prévia/não-lidas de cada um ──────────
  useEffect(() => {
    if (!institutionId || !myId) return
    loadColleaguesAndPreviews()
  }, [institutionId, myId])

  const loadColleaguesAndPreviews = async () => {
    setLoading(true)
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('institution_id', institutionId)
        .eq('active', true)
        .neq('id', myId)
        .order('full_name')
      const list = (usersData || []) as Colleague[]
      setColleagues(list)

      // Janela de histórico recente pra montar prévia + contagem de não lidas
      // por colega, numa única query (evita N+1 por pessoa da lista).
      const { data: msgs } = await supabase
        .from('internal_messages')
        .select('sender_id, recipient_id, content, read_at, created_at')
        .eq('institution_id', institutionId)
        .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
        .order('created_at', { ascending: false })
        .limit(500)

      const map: Record<string, ConversationPreview> = {}
      for (const m of (msgs || []) as InternalMessage[]) {
        const otherId = m.sender_id === myId ? m.recipient_id : m.sender_id
        if (!map[otherId]) map[otherId] = { lastMessage: null, lastMessageAt: null, unreadCount: 0 }
        if (!map[otherId].lastMessageAt) {
          map[otherId].lastMessage = m.content
          map[otherId].lastMessageAt = m.created_at
        }
        if (m.recipient_id === myId && !m.read_at) map[otherId].unreadCount++
      }
      setPreviews(map)
    } catch (e) {
      console.error('[InternalChat] erro ao carregar colegas:', e)
    } finally {
      setLoading(false)
    }
  }

  // ── Realtime — nova mensagem chega na hora (INSERT) ────────────────────────
  useEffect(() => {
    if (!institutionId || !myId) return

    const channel = supabase
      .channel(`internal_chat_${institutionId}_${myId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'internal_messages',
        filter: `institution_id=eq.${institutionId}`,
      }, (payload) => {
        const msg = payload.new as InternalMessage
        if (msg.sender_id !== myId && msg.recipient_id !== myId) return // não é comigo

        const otherId = msg.sender_id === myId ? msg.recipient_id : msg.sender_id
        const isOpenConversation = activeIdRef.current === otherId

        if (isOpenConversation) {
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          // Já estou vendo a conversa — marca como lida na hora (só se foi
          // recebida, não a que eu mesmo acabei de mandar).
          if (msg.recipient_id === myId && !msg.read_at) markThreadRead(otherId)
        }

        setPreviews(prev => ({
          ...prev,
          [otherId]: {
            lastMessage:   msg.content,
            lastMessageAt: msg.created_at,
            unreadCount: msg.recipient_id === myId && !isOpenConversation
              ? (prev[otherId]?.unreadCount || 0) + 1
              : (prev[otherId]?.unreadCount || 0),
          },
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [institutionId, myId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // ── Abre conversa com uma pessoa: carrega histórico + marca como lida ──────
  const openConversation = async (otherId: string) => {
    setActiveId(otherId)
    setLoadingThread(true)
    try {
      const { data } = await supabase
        .from('internal_messages')
        .select('*')
        .eq('institution_id', institutionId)
        .or(`and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`)
        .order('created_at', { ascending: true })
      setMessages((data || []) as InternalMessage[])
      await markThreadRead(otherId)
    } catch (e) {
      console.error('[InternalChat] erro ao carregar conversa:', e)
    } finally {
      setLoadingThread(false)
    }
  }

  const markThreadRead = async (otherId: string) => {
    await supabase
      .from('internal_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', myId)
      .eq('sender_id', otherId)
      .is('read_at', null)
    setPreviews(prev => prev[otherId] ? { ...prev, [otherId]: { ...prev[otherId], unreadCount: 0 } } : prev)
  }

  const handleSend = async () => {
    const content = draft.trim()
    if (!content || !activeId || !myId || !institutionId || sending) return
    setSending(true)
    setDraft('')
    try {
      const { data, error } = await supabase
        .from('internal_messages')
        .insert({ institution_id: institutionId, sender_id: myId, recipient_id: activeId, content })
        .select('*')
        .single()
      if (error) throw error
      const msg = data as InternalMessage
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      setPreviews(prev => ({
        ...prev,
        [activeId]: { lastMessage: content, lastMessageAt: msg.created_at, unreadCount: prev[activeId]?.unreadCount || 0 },
      }))
    } catch (e) {
      console.error('[InternalChat] erro ao enviar:', e)
      setDraft(content) // devolve o texto pro campo se falhar
    } finally {
      setSending(false)
    }
  }

  const filteredColleagues = useMemo(() => {
    const sorted = [...colleagues].sort((a, b) => {
      const ta = previews[a.id]?.lastMessageAt || ''
      const tb = previews[b.id]?.lastMessageAt || ''
      if (ta && tb) return tb.localeCompare(ta)
      if (ta) return -1
      if (tb) return 1
      return a.full_name.localeCompare(b.full_name)
    })
    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter(c => c.full_name.toLowerCase().includes(q))
  }, [colleagues, previews, search])

  const activeColleague = colleagues.find(c => c.id === activeId) || null

  return (
    <div className="flex h-full bg-white">

      {/* Coluna esquerda — lista de colegas */}
      <div className="w-[320px] flex-shrink-0 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-[#1A2B4A] mb-3">Chat Interno</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00A896] outline-none"
              placeholder="Buscar colega..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#00A896] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredColleagues.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10 px-4">
              {search ? 'Nenhum colega encontrado.' : 'Nenhum outro membro da equipe cadastrado ainda.'}
            </p>
          ) : filteredColleagues.map(c => {
            const preview = previews[c.id]
            const active = activeId === c.id
            return (
              <button key={c.id} onClick={() => openConversation(c.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors ${active ? 'bg-[#E6F7F5]' : 'hover:bg-gray-50'}`}>
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #00A896, #0DD3BF)' }}>
                  {initialsOf(c.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${preview?.unreadCount ? 'font-bold text-[#1A2B4A]' : 'font-semibold text-[#1A2B4A]'}`}>
                      {c.full_name}
                    </span>
                    {preview?.lastMessageAt && (
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{formatTime(preview.lastMessageAt)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className={`text-xs truncate ${preview?.unreadCount ? 'text-[#1A2B4A] font-medium' : 'text-gray-400'}`}>
                      {preview?.lastMessage || ROLE_LABEL[c.role] || 'Sem mensagens ainda'}
                    </span>
                    {!!preview?.unreadCount && (
                      <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F43F5E] text-white text-[10px] font-bold flex items-center justify-center">
                        {preview.unreadCount > 9 ? '9+' : preview.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Coluna direita — conversa */}
      <div className="flex-1 min-w-0 flex flex-col bg-[#F8FAFC]">
        {!activeColleague ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
            <MessageSquare size={48} strokeWidth={1.5} />
            <p className="mt-3 text-sm text-gray-400">Selecione um colega pra começar a conversar</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3.5 border-b border-gray-100 bg-white flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #00A896, #0DD3BF)' }}>
                {initialsOf(activeColleague.full_name)}
              </div>
              <div>
                <p className="text-sm font-bold text-[#1A2B4A]">{activeColleague.full_name}</p>
                <p className="text-xs text-gray-400">{ROLE_LABEL[activeColleague.role] || activeColleague.role}</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {loadingThread ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-[#00A896] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Nenhuma mensagem ainda — diga oi 👋</p>
              ) : messages.map(m => {
                const mine = m.sender_id === myId
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                      mine ? 'bg-[#00A896] text-white rounded-br-sm' : 'bg-white border border-gray-200 text-[#1A2B4A] rounded-bl-sm'
                    }`}>
                      {m.content}
                      <div className={`text-[10px] mt-1 text-right ${mine ? 'text-white/70' : 'text-gray-400'}`}>
                        {formatTime(m.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-3 border-t border-gray-100 bg-white flex items-center gap-2 flex-shrink-0">
              <input
                className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00A896] outline-none"
                placeholder="Escreva uma mensagem..."
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              />
              <button onClick={handleSend} disabled={!draft.trim() || sending}
                className="w-10 h-10 rounded-xl bg-[#00A896] text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
