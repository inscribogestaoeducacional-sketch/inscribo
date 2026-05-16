// src/components/superadmin/AdminAionInbox.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import SuperAdminLayout from './SuperAdminLayout'
import {
  MessageCircle, Users, Building2, Search,
  Send, Paperclip, Phone, Tag, User,
  CheckCheck, RefreshCw, Settings, X,
  Wifi, WifiOff, ChevronDown,
} from 'lucide-react'

type Queue = 'all' | 'leads' | 'schools' | 'support' | 'general'

interface AionConversation {
  id: string
  remote_jid: string
  queue: string
  status: string
  last_message: string
  last_message_at: string
  assigned_user_id: string | null
  assigned_user_name: string | null
  unread_count: number
  contact_name: string | null
}

interface AionMessage {
  id: string
  content: string
  from_me: boolean
  message_type: string
  media_url: string | null
  timestamp: string
  created_at: string
  status: string
}

const QUEUE_META = [
  { id: 'all',     label: 'Todas',   icon: MessageCircle },
  { id: 'leads',   label: 'Leads',   icon: Users         },
  { id: 'schools', label: 'Escolas', icon: Building2     },
  { id: 'support', label: 'Suporte', icon: Phone         },
  { id: 'general', label: 'Geral',   icon: Tag           },
] as const

const QUEUE_COLORS: Record<string, string> = {
  leads:   'bg-purple-100 text-purple-600',
  schools: 'bg-blue-100 text-blue-600',
  support: 'bg-amber-100 text-amber-600',
  general: 'bg-gray-100 text-gray-500',
}

const QUEUE_LABELS: Record<string, string> = {
  leads: 'Lead', schools: 'Escola', support: 'Suporte', general: 'Geral',
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-14 h-14 text-lg' }
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-medium flex-shrink-0`}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

export default function AdminAionInbox() {
  const { user } = useAuth()
  const [connected, setConnected]         = useState(false)
  const [waNumber, setWaNumber]           = useState('')
  const [conversations, setConversations] = useState<AionConversation[]>([])
  const [selected, setSelected]           = useState<AionConversation | null>(null)
  const [messages, setMessages]           = useState<AionMessage[]>([])
  const [input, setInput]                 = useState('')
  const [activeQueue, setActiveQueue]     = useState<Queue>('all')
  const [search, setSearch]               = useState('')
  const [loading, setLoading]             = useState(true)
  const [sending, setSending]             = useState(false)
  const [showDetails, setShowDetails]     = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadStatus()
    loadConversations()
  }, [activeQueue])

  // ── realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('aion-inbox')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'whatsapp_conversations',
        filter: 'is_aion_inbox=eq.true',
      }, () => loadConversations())
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'whatsapp_messages',
        filter: 'is_aion_inbox=eq.true',
      }, (payload) => {
        const msg = payload.new as AionMessage & { conversation_id?: string }
        if (selected && msg.conversation_id === selected.id) {
          setMessages(prev => [...prev, msg])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
        }
        loadConversations()
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [selected])

  // ── data loading ──────────────────────────────────────────────────────────
  const loadStatus = async () => {
    const { data } = await supabase
      .from('platform_whatsapp')
      .select('connected, phone_number, display_name')
      .single()
    setConnected(!!data?.connected)
    setWaNumber(data?.phone_number || data?.display_name || '')
  }

  const loadConversations = async () => {
    let q = supabase
      .from('whatsapp_conversations')
      .select('id, remote_jid, queue, status, last_message, last_message_at, assigned_user_id, assigned_user_name, unread_count, contact_name')
      .eq('is_aion_inbox', true)
      .order('last_message_at', { ascending: false })

    if (activeQueue !== 'all') q = q.eq('queue', activeQueue)

    const { data } = await q
    setConversations((data || []) as AionConversation[])
    setLoading(false)
  }

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('id, content, from_me, message_type, media_url, timestamp, created_at, status')
      .eq('conversation_id', convId)
      .order('timestamp', { ascending: true })
    setMessages((data || []) as AionMessage[])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }

  const selectConv = (conv: AionConversation) => {
    setSelected(conv)
    loadMessages(conv.id)
    if (conv.unread_count > 0) {
      supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', conv.id)
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c))
    }
  }

  // ── actions ───────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !selected || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAionSend: true,
          institution_id: null,
          to: selected.remote_jid,
          type: 'text',
          message: text,
          conversation_id: selected.id,
          sender_name: user?.full_name || '',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('[aion-send] erro:', err)
      }
    } finally {
      setSending(false)
    }
  }

  const assignToMe = async (convId: string) => {
    await supabase.from('whatsapp_conversations')
      .update({ assigned_user_id: user?.id, assigned_user_name: user?.full_name || null })
      .eq('id', convId)
    loadConversations()
    if (selected?.id === convId) setSelected(s => s ? { ...s, assigned_user_id: user?.id || null, assigned_user_name: user?.full_name || null } : s)
  }

  const changeQueue = async (convId: string, queue: string) => {
    await supabase.from('whatsapp_conversations').update({ queue }).eq('id', convId)
    loadConversations()
    if (selected?.id === convId) setSelected(s => s ? { ...s, queue } : s)
  }

  const closeConv = async (convId: string) => {
    await supabase.from('whatsapp_conversations').update({ status: 'closed' }).eq('id', convId)
    if (selected?.id === convId) setSelected(null)
    loadConversations()
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const filtered = conversations.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (c.contact_name || '').toLowerCase().includes(q) ||
      (c.remote_jid || '').includes(q) ||
      (c.last_message || '').toLowerCase().includes(q)
    )
  })

  const queueCounts = conversations.reduce<Record<string, number>>((acc, c) => {
    acc[c.queue] = (acc[c.queue] || 0) + 1
    return acc
  }, {})

  const displayName = (conv: AionConversation) =>
    conv.contact_name || conv.remote_jid?.replace(/@.*/, '') || 'Desconhecido'

  const fmtTime = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <SuperAdminLayout>
      <div className="flex h-full overflow-hidden">

        {/* ── SIDEBAR: conversas ─────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">

          {/* header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm font-semibold text-gray-900">Inbox Áion</span>
                {waNumber && <span className="text-xs text-gray-400">{waNumber}</span>}
              </div>
              <button onClick={loadConversations} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <RefreshCw size={13} />
              </button>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* filas */}
          <div className="flex gap-1 p-2 border-b border-gray-100 overflow-x-auto scrollbar-none">
            {QUEUE_META.map(q => {
              const Icon  = q.icon
              const count = q.id === 'all' ? conversations.length : (queueCounts[q.id] || 0)
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQueue(q.id as Queue)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    activeQueue === q.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={11} />
                  {q.label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeQueue === q.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* lista */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border-b border-gray-50">
                  <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                    <div className="h-2.5 bg-gray-100 rounded animate-pulse w-full" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <MessageCircle size={28} className="mb-2 opacity-30" />
                <p className="text-sm">{search ? 'Nenhum resultado' : 'Nenhuma conversa'}</p>
              </div>
            ) : filtered.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConv(conv)}
                className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  selected?.id === conv.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Avatar name={displayName(conv)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-gray-900 truncate">{displayName(conv)}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{fmtTime(conv.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs text-gray-500 truncate">{conv.last_message || '...'}</p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {conv.unread_count > 0 && (
                          <span className="bg-green-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                            {conv.unread_count > 9 ? '9+' : conv.unread_count}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${QUEUE_COLORS[conv.queue] || QUEUE_COLORS.general}`}>
                          {QUEUE_LABELS[conv.queue] || 'Geral'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── ÁREA PRINCIPAL ─────────────────────────────────────────────── */}
        {selected ? (
          <>
            <div className="flex-1 flex flex-col min-w-0">

              {/* header do chat */}
              <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar name={displayName(selected)} size="sm" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{displayName(selected)}</p>
                    <p className="text-xs text-gray-400">
                      {selected.assigned_user_name
                        ? `Atendente: ${selected.assigned_user_name}`
                        : 'Sem atendente'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selected.queue}
                    onChange={e => changeQueue(selected.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none"
                  >
                    <option value="general">Geral</option>
                    <option value="leads">Lead</option>
                    <option value="schools">Escola</option>
                    <option value="support">Suporte</option>
                  </select>
                  {!selected.assigned_user_id && (
                    <button
                      onClick={() => assignToMe(selected.id)}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-colors"
                    >
                      <User size={11} />
                      Assumir
                    </button>
                  )}
                  <button
                    onClick={() => setShowDetails(v => !v)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Detalhes"
                  >
                    <Settings size={15} />
                  </button>
                </div>
              </div>

              {/* mensagens */}
              <div className="flex-1 overflow-y-auto p-5 space-y-2 bg-[#F0F2F5]">
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <p className="text-sm">Nenhuma mensagem ainda</p>
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm ${
                      msg.from_me
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                    }`}>
                      {msg.message_type === 'image' && msg.media_url && (
                        <img src={msg.media_url} alt="" className="rounded-lg max-w-full mb-1.5" />
                      )}
                      {msg.message_type === 'document' && msg.media_url && (
                        <a href={msg.media_url} target="_blank" rel="noreferrer"
                          className={`flex items-center gap-2 text-xs mb-1 ${msg.from_me ? 'text-blue-100' : 'text-blue-600'}`}>
                          <Paperclip size={12} />
                          Documento
                        </a>
                      )}
                      {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                      <div className={`flex items-center gap-1 mt-1 ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[10px] ${msg.from_me ? 'text-blue-200' : 'text-gray-400'}`}>
                          {fmtTime(msg.timestamp || msg.created_at)}
                        </span>
                        {msg.from_me && (
                          <CheckCheck size={11} className={msg.status === 'read' ? 'text-blue-300' : 'text-blue-200'} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* input */}
              <div className="bg-white border-t border-gray-200 p-3 flex-shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Digite uma mensagem..."
                    rows={1}
                    className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
                    style={{ maxHeight: 120, overflowY: 'auto' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    {sending
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Send size={15} />
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* ── SIDEBAR DIREITA: detalhes ─────────────────────────────── */}
            {showDetails && (
              <div className="w-64 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">Detalhes</span>
                  <button onClick={() => setShowDetails(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>

                <div className="p-4 flex flex-col items-center border-b border-gray-100">
                  <Avatar name={displayName(selected)} size="lg" />
                  <p className="mt-2 font-medium text-gray-900 text-sm text-center">{displayName(selected)}</p>
                  <p className="text-xs text-gray-400">{selected.remote_jid?.replace(/@.*/, '')}</p>
                </div>

                <div className="p-4 space-y-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5 font-medium">Fila</p>
                    <select
                      value={selected.queue}
                      onChange={e => changeQueue(selected.id, e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="general">Geral</option>
                      <option value="leads">Lead</option>
                      <option value="schools">Escola</option>
                      <option value="support">Suporte</option>
                    </select>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-1.5 font-medium">Status</p>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      selected.status === 'open' || selected.status === 'waiting'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {selected.status === 'open' ? 'Aberta'
                        : selected.status === 'waiting' ? 'Aguardando'
                        : 'Fechada'}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-1.5 font-medium">Atendente</p>
                    <p className="text-gray-700 text-sm">{selected.assigned_user_name || 'Sem atendente'}</p>
                  </div>
                </div>

                <div className="p-4 space-y-2 border-t border-gray-100 mt-auto">
                  <button
                    onClick={() => assignToMe(selected.id)}
                    className="w-full text-sm bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    <User size={13} />
                    Assumir atendimento
                  </button>
                  <button
                    onClick={() => closeConv(selected.id)}
                    className="w-full text-sm border border-gray-200 text-gray-600 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Encerrar conversa
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <MessageCircle size={52} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500">Selecione uma conversa</p>
              <p className="text-xs mt-1 text-gray-400">Escolha da lista ao lado para começar</p>
              {!connected && (
                <p className="text-xs mt-3 text-amber-600 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                  WhatsApp não configurado. Configure em Configurações.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}
