import React, { useState, useRef, useEffect } from 'react'
import {
  MessageCircle, Search, Plus, Info, Paperclip, Mic, Smile, Send,
  Play, Pause, FileText, Image, Video, ChevronDown, ChevronRight,
  CheckCheck, Check, Tag, Calendar, Zap, Settings, User,
  X, MoreVertical, Phone
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, WhatsappMessage, supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type MsgType = 'text' | 'audio' | 'image' | 'video' | 'document'
type ConvStatus = 'open' | 'waiting' | 'resolved'
type ConvFilter = 'all' | 'unread' | 'open' | 'waiting' | 'resolved'

interface Message {
  id: string
  type: MsgType
  content: string
  from: 'me' | 'them'
  ts: Date
  status: 'sent' | 'delivered' | 'read'
  duration?: number
  fileName?: string
  fileSize?: string
}

interface Label { text: string; color: string }

interface Conversation {
  id: string
  name: string
  phone: string
  avatarColor: string
  lastMessage: string
  lastTime: Date
  unreadCount: number
  status: ConvStatus
  online: boolean
  labels: Label[]
  messages: Message[]
  leadId?: string
  grade?: string
  source?: string
  responsible?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ConvStatus, { label: string; badge: string; dot: string }> = {
  open:     { label: 'Aberto',     badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400'  },
  waiting:  { label: 'Aguardando', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  resolved: { label: 'Resolvido',  badge: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
}

const QUICK_REPLIES = [
  { id: 'bv',  label: 'Boas-vindas',       text: 'Olá! Seja bem-vindo(a) ao Colégio Inscribo! 🎓 Estou aqui para ajudar. Como posso te auxiliar?' },
  { id: 'cv',  label: 'Confirmar visita',   text: 'Sua visita está confirmada! Estaremos te esperando no horário combinado. Qualquer dúvida, estou aqui. 📅' },
  { id: 'pr',  label: 'Enviar proposta',    text: 'Preparei uma proposta especial para vocês! Vou encaminhar agora. Qualquer dúvida, pode perguntar. 📋' },
  { id: 'vl',  label: 'Valores',            text: 'Sobre os valores: temos planos de pagamento flexíveis e condições especiais para matrícula antecipada. Posso te passar mais detalhes?' },
  { id: 'dc',  label: 'Documentos',         text: 'Para a matrícula, precisamos de: RG e CPF dos pais/responsáveis, certidão de nascimento, histórico escolar e comprovante de residência. 📄' },
  { id: 'enc', label: 'Encerramento',       text: 'Foi um prazer te atender! Se surgir qualquer dúvida, estarei sempre aqui. Tenha um ótimo dia! 😊' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['bg-violet-500','bg-blue-500','bg-rose-500','bg-amber-500','bg-emerald-500','bg-teal-500','bg-pink-500','bg-indigo-500']

function jidToColor(jid: string): string {
  let hash = 0
  for (let i = 0; i < jid.length; i++) hash = jid.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatPhone(jid: string): string {
  const num = jid.replace(/@.*/, '')
  if (num.startsWith('55') && num.length >= 12) {
    const local = num.slice(2)
    if (local.length === 11) return `${local.slice(0,2)} ${local.slice(2,7)}-${local.slice(7)}`
    if (local.length === 10) return `${local.slice(0,2)} ${local.slice(2,6)}-${local.slice(6)}`
  }
  return num
}

function buildConversations(msgs: WhatsappMessage[]): Conversation[] {
  const byJid = new Map<string, WhatsappMessage[]>()
  msgs.forEach(m => {
    if (!byJid.has(m.remote_jid)) byJid.set(m.remote_jid, [])
    byJid.get(m.remote_jid)!.push(m)
  })
  return Array.from(byJid.entries()).map(([jid, jidMsgs]) => {
    const sorted = [...jidMsgs].sort((a, b) => a.timestamp - b.timestamp)
    const last = sorted[sorted.length - 1]
    const name = jidMsgs.find(m => !m.from_me && m.contact_name)?.contact_name || formatPhone(jid)
    return {
      id: jid,
      name,
      phone: formatPhone(jid),
      avatarColor: jidToColor(jid),
      lastMessage: last.content,
      lastTime: new Date(last.timestamp * 1000),
      unreadCount: 0,
      status: 'open' as ConvStatus,
      online: false,
      labels: [],
      messages: sorted.map(m => ({
        id: m.id,
        type: (m.message_type === 'conversation' ? 'text' : m.message_type) as MsgType,
        content: m.content,
        from: m.from_me ? 'me' : 'them' as 'me' | 'them',
        ts: new Date(m.timestamp * 1000),
        status: 'delivered' as const,
      })),
    }
  }).sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtConvTime(d: Date) {
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return fmtTime(d)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtDateSep(d: Date) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (msgDay === today) return 'Hoje'
  if (msgDay === today - 86400000) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

function groupByDate(msgs: Message[]): { label: string; msgs: Message[] }[] {
  const map = new Map<string, Message[]>()
  msgs.forEach(m => {
    const key = m.ts.toDateString()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  })
  return Array.from(map.entries()).map(([, ms]) => ({ label: fmtDateSep(ms[0].ts), msgs: ms }))
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
function AudioPlayer({ duration = 15, from }: { duration?: number; from: 'me' | 'them' }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const itvRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const toggle = () => {
    if (playing) {
      clearInterval(itvRef.current!)
      setPlaying(false)
    } else {
      setPlaying(true)
      itvRef.current = setInterval(() => {
        setProgress(p => {
          if (p >= 100) { clearInterval(itvRef.current!); setPlaying(false); return 0 }
          return p + (100 / (duration * 10))
        })
      }, 100)
    }
  }

  useEffect(() => () => { if (itvRef.current) clearInterval(itvRef.current) }, [])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
  const elapsed = Math.round((progress / 100) * duration)

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <button
        onClick={toggle}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${from === 'me' ? 'bg-white/25 hover:bg-white/35' : 'bg-teal-100 hover:bg-teal-200'} transition-colors`}
      >
        {playing
          ? <Pause className={`w-3.5 h-3.5 ${from === 'me' ? 'text-white' : 'text-teal-700'}`} />
          : <Play  className={`w-3.5 h-3.5 ${from === 'me' ? 'text-white' : 'text-teal-700'}`} />}
      </button>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className={`h-1 rounded-full overflow-hidden ${from === 'me' ? 'bg-white/30' : 'bg-gray-200'}`}>
          <div
            className={`h-full rounded-full transition-all duration-100 ${from === 'me' ? 'bg-white' : 'bg-teal-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`text-xs ${from === 'me' ? 'text-white/70' : 'text-gray-400'}`}>
          {playing ? fmt(elapsed) : fmt(duration)}
        </span>
      </div>
    </div>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isMe = msg.from === 'me'

  const bubbleBase = isMe
    ? 'bg-teal-500 text-white rounded-2xl rounded-tr-sm'
    : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm shadow-sm'

  const renderContent = () => {
    switch (msg.type) {
      case 'audio':
        return <AudioPlayer duration={msg.duration} from={msg.from} />
      case 'image':
        return (
          <div className="w-48 h-32 rounded-xl overflow-hidden bg-gray-200 flex items-center justify-center">
            <Image className={`w-8 h-8 ${isMe ? 'text-white/50' : 'text-gray-400'}`} />
          </div>
        )
      case 'video':
        return (
          <div className="w-48 h-32 rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center relative">
            <Video className="w-6 h-6 text-white/50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Play className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        )
      case 'document':
        return (
          <div className={`flex items-center gap-2 min-w-[180px] px-1 py-0.5`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-white/20' : 'bg-blue-50'}`}>
              <FileText className={`w-5 h-5 ${isMe ? 'text-white' : 'text-blue-500'}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-medium truncate ${isMe ? 'text-white' : 'text-gray-800'}`}>
                {msg.fileName || msg.content}
              </p>
              {msg.fileSize && (
                <p className={`text-xs ${isMe ? 'text-white/60' : 'text-gray-400'}`}>{msg.fileSize}</p>
              )}
            </div>
          </div>
        )
      default:
        return <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
    }
  }

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={`max-w-[72%] px-3 py-2 ${bubbleBase}`}>
        {renderContent()}
        <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <span className={`text-xs ${isMe ? 'text-white/60' : 'text-gray-400'}`}>{fmtTime(msg.ts)}</span>
          {isMe && (
            msg.status === 'read'      ? <CheckCheck className="w-3 h-3 text-white/70" /> :
            msg.status === 'delivered' ? <CheckCheck className="w-3 h-3 text-white/40" /> :
            <Check className="w-3 h-3 text-white/40" />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── WhatsAppHub ──────────────────────────────────────────────────────────────
export default function WhatsAppHub() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const phoneParam = searchParams.get('phone')
  const nameParam  = searchParams.get('name')

  const instance = user?.institution_id ? `inst-${user.institution_id.slice(0, 8)}` : ''

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ConvFilter>('all')
  const [search, setSearch] = useState('')
  const [inputText, setInputText] = useState('')
  const [showAttach, setShowAttach] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [showContactInfo, setShowContactInfo] = useState(true)
  const [collapseQuick, setCollapseQuick] = useState(false)
  const [collapseHistory, setCollapseHistory] = useState(true)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = async () => {
    if (!user?.institution_id) return
    const msgs = await DatabaseService.getWhatsappMessages(user.institution_id)
    const convs = buildConversations(msgs)
    setConversations(convs)
    setActiveId(id => id ?? (convs[0]?.id ?? null))
    setLoading(false)
  }

  // Load on mount + realtime + polling
  useEffect(() => {
    if (!user?.institution_id) { setLoading(false); return }
    loadMessages()
    const channel = supabase
      .channel(`wamsg-${user.institution_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages',
        filter: `institution_id=eq.${user.institution_id}` }, loadMessages)
      .subscribe()
    const interval = setInterval(loadMessages, 10000)
    return () => { supabase.removeChannel(channel); clearInterval(interval) }
  }, [user?.institution_id])

  const activeConv = conversations.find(c => c.id === activeId) ?? null
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)

  // Handle incoming phone param from LeadKanban
  useEffect(() => {
    if (!phoneParam) return
    const digits = phoneParam.replace(/\D/g, '')
    const jid = `55${digits}@s.whatsapp.net`
    const existing = conversations.find(c => c.id === jid || c.phone.replace(/\D/g,'') === digits)
    if (existing) {
      setActiveId(existing.id)
    } else {
      const phone = digits.replace(/(\d{2})(\d{5})(\d{4})/, '$1 $2-$3')
      const name = nameParam ? decodeURIComponent(nameParam) : `+55 ${phone}`
      const newConv: Conversation = {
        id: jid, name, phone,
        avatarColor: jidToColor(jid),
        lastMessage: '', lastTime: new Date(),
        unreadCount: 0, status: 'open', online: false,
        labels: [{ text: 'Novo contato', color: 'bg-blue-100 text-blue-700' }],
        messages: [],
      }
      setConversations(prev => [newConv, ...prev])
      setActiveId(jid)
    }
  }, [phoneParam, nameParam])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeId, conversations])

  useEffect(() => {
    setConversations(prev => prev.map(c =>
      c.id === activeId ? { ...c, unreadCount: 0 } : c
    ))
  }, [activeId])

  // Auto-hide send error
  useEffect(() => {
    if (!sendError) return
    const t = setTimeout(() => setSendError(null), 4000)
    return () => clearTimeout(t)
  }, [sendError])

  const filteredConvs = conversations.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'unread'   ? c.unreadCount > 0 :
      filter === 'open'     ? c.status === 'open' :
      filter === 'waiting'  ? c.status === 'waiting' :
      c.status === 'resolved'
    return matchSearch && matchFilter
  })

  const handleSend = async () => {
    if (!inputText.trim() || !activeId) return
    const text = inputText.trim()
    const tempId = `temp-${Date.now()}`
    const tempMsg: Message = { id: tempId, type: 'text', content: text, from: 'me', ts: new Date(), status: 'sent' }
    setConversations(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, messages: [...c.messages, tempMsg], lastMessage: text, lastTime: tempMsg.ts }
        : c
    ))
    setInputText('')
    setShowQuickReplies(false)
    try {
      const res = await fetch('/api/evolution/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: instance, remoteJid: activeId, message: text, institutionId: user?.institution_id }),
      })
      if (!res.ok) throw new Error()
      setConversations(prev => prev.map(c =>
        c.id === activeId
          ? { ...c, messages: c.messages.map(m => m.id === tempId ? { ...m, status: 'delivered' as const } : m) }
          : c
      ))
    } catch {
      setConversations(prev => prev.map(c =>
        c.id === activeId ? { ...c, messages: c.messages.filter(m => m.id !== tempId) } : c
      ))
      setSendError('Erro ao enviar mensagem. Verifique a conexão do WhatsApp.')
    }
  }

  const handleStatusChange = (status: ConvStatus) => {
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, status } : c))
  }

  const FILTERS: { key: ConvFilter; label: string }[] = [
    { key: 'all',      label: 'Todas'       },
    { key: 'unread',   label: 'Não lidas'   },
    { key: 'open',     label: 'Abertas'     },
    { key: 'waiting',  label: 'Aguardando'  },
    { key: 'resolved', label: 'Resolvidas'  },
  ]

  const msgGroups = activeConv ? groupByDate(activeConv.messages) : []

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center bg-[#f0f2f5]" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#14b8a6] border-t-transparent" />
      </div>
    )
  }

  // ── Empty state ──
  if (!loading && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center bg-[#f0f2f5]" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-10 h-10 text-gray-300" />
          </div>
          <h2 className="text-base font-bold text-gray-700 mb-2">Nenhuma conversa ainda</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Conecte seu WhatsApp nas Configurações e comece a atender!
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#14b8a6] to-[#0d9488] text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all mx-auto"
          >
            <Settings className="w-4 h-4" />
            Ir para Configurações
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex overflow-hidden bg-[#f0f2f5]" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Col 1: Conversation List ──────────────────────────────────────────── */}
      <div className="w-[300px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#14b8a6]" />
            <span className="text-sm font-bold text-[#1e2d6b]">WhatsApp</span>
            {totalUnread > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {totalUnread}
              </span>
            )}
          </div>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Nova conversa">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar nome ou número..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14b8a6] focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Filter pills */}
        <div className="px-3 pb-2 flex-shrink-0 flex gap-1 overflow-x-auto scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-[#14b8a6] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <p className="text-xs text-gray-400">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConvs.map(conv => {
              const isActive = conv.id === activeId
              const statusDot = STATUS_CFG[conv.status].dot
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveId(conv.id)}
                  className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-all border-l-4 ${
                    isActive
                      ? 'bg-teal-50 border-l-teal-500'
                      : 'border-l-transparent hover:bg-gray-50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full ${conv.avatarColor} text-white text-sm font-bold flex items-center justify-center`}>
                      {conv.name.charAt(0).toUpperCase()}
                    </div>
                    {conv.online && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-sm font-semibold text-gray-800 truncate">{conv.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{fmtConvTime(conv.lastTime)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-gray-500 truncate">{conv.lastMessage}</span>
                      {conv.unreadCount > 0 && (
                        <span className="flex-shrink-0 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {/* Labels + status */}
                    {(conv.labels.length > 0 || true) && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${STATUS_CFG[conv.status].badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                          {STATUS_CFG[conv.status].label}
                        </span>
                        {conv.labels.slice(0, 1).map(lb => (
                          <span key={lb.text} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${lb.color}`}>
                            {lb.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Col 2: Chat ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Chat header */}
        {activeConv && (
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full ${activeConv.avatarColor} text-white text-sm font-bold flex items-center justify-center`}>
                {activeConv.name.charAt(0)}
              </div>
              {activeConv.online && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{activeConv.name}</p>
              <p className="text-xs text-gray-500">
                {activeConv.phone}
                {activeConv.online && <span className="ml-1.5 text-green-500 font-medium">• online</span>}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowContactInfo(v => !v)}
                className={`p-2 rounded-lg transition-colors ${showContactInfo ? 'bg-teal-50 text-teal-600' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <Info className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-0.5">
          {msgGroups.map((group, gi) => (
            <div key={gi}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <span className="text-xs text-gray-500 bg-white/80 px-3 py-1 rounded-full shadow-sm border border-gray-100">
                  {group.label}
                </span>
              </div>
              {group.msgs.map(msg => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </div>
          ))}
          {activeConv?.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <MessageCircle className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Nenhuma mensagem ainda</p>
              <p className="text-xs text-gray-300 mt-1">Envie a primeira mensagem abaixo</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">

          {/* Quick replies panel */}
          {showQuickReplies && (
            <div className="mb-2 bg-gray-50 rounded-xl border border-gray-200 p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600">Respostas rápidas</span>
                <button onClick={() => setShowQuickReplies(false)} className="p-0.5 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_REPLIES.map(qr => (
                  <button
                    key={qr.id}
                    onClick={() => { setInputText(qr.text); setShowQuickReplies(false) }}
                    className="text-left px-2.5 py-2 bg-white border border-gray-100 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-all"
                  >
                    <p className="text-xs font-semibold text-[#1e2d6b]">{qr.label}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{qr.text}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attachment menu */}
          {showAttach && (
            <div className="mb-2 flex gap-2">
              {[
                { icon: Image,    label: 'Imagem',    color: 'bg-purple-100 text-purple-600' },
                { icon: Video,    label: 'Vídeo',     color: 'bg-blue-100 text-blue-600'   },
                { icon: FileText, label: 'Documento', color: 'bg-orange-100 text-orange-600' },
                { icon: Mic,      label: 'Áudio',     color: 'bg-green-100 text-green-600' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => setShowAttach(false)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl ${item.color} text-xs font-medium hover:opacity-80 transition-opacity`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            <button
              onClick={() => { setShowAttach(v => !v); setShowQuickReplies(false) }}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${showAttach ? 'bg-teal-100 text-teal-600' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowQuickReplies(v => !v); setShowAttach(false) }}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${showQuickReplies ? 'bg-teal-100 text-teal-600' : 'hover:bg-gray-100 text-gray-500'}`}
              title="Respostas rápidas"
            >
              <Zap className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0">
              <Smile className="w-4 h-4" />
            </button>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Digite uma mensagem..."
              rows={1}
              className="flex-1 px-3 py-2 text-sm bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#14b8a6] focus:bg-white transition-all resize-none"
              style={{ minHeight: '38px', maxHeight: '96px' }}
            />
            {inputText.trim() ? (
              <button
                onClick={handleSend}
                className="p-2 rounded-xl bg-[#14b8a6] text-white hover:bg-[#0d9488] transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0">
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Col 3: Contact Panel ──────────────────────────────────────────────── */}
      {showContactInfo && activeConv && (
        <div className="w-[280px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">

          {/* Contact header */}
          <div className="flex-shrink-0 flex flex-col items-center px-4 pt-6 pb-4 border-b border-gray-100">
            <div className={`w-16 h-16 rounded-full ${activeConv.avatarColor} text-white text-2xl font-bold flex items-center justify-center mb-3`}>
              {activeConv.name.charAt(0)}
            </div>
            <p className="text-sm font-bold text-[#1e2d6b] text-center">{activeConv.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{activeConv.phone}</p>
            {activeConv.labels.map(lb => (
              <span key={lb.text} className={`mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${lb.color}`}>
                {lb.text}
              </span>
            ))}
          </div>

          {/* Status select */}
          <div className="px-4 py-3 border-b border-gray-100">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Status do atendimento
            </label>
            <select
              value={activeConv.status}
              onChange={e => handleStatusChange(e.target.value as ConvStatus)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none"
            >
              <option value="open">Aberto</option>
              <option value="waiting">Aguardando</option>
              <option value="resolved">Resolvido</option>
            </select>
          </div>

          {/* Ver Lead */}
          {activeConv.leadId && (
            <div className="px-4 py-3 border-b border-gray-100">
              <button
                onClick={() => navigate(`/leads?highlight=${activeConv.leadId}`)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1e2d6b] text-white text-xs font-semibold rounded-lg hover:bg-[#151b4e] transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                Ver Lead no CRM
              </button>
            </div>
          )}

          {/* Informações */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Informações</p>
            <div className="space-y-2">
              {activeConv.grade && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Série interesse</span>
                  <span className="text-xs font-medium text-gray-700">{activeConv.grade}</span>
                </div>
              )}
              {activeConv.source && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Origem</span>
                  <span className="text-xs font-medium text-gray-700">{activeConv.source}</span>
                </div>
              )}
              {activeConv.responsible && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Responsável</span>
                  <span className="text-xs font-medium text-gray-700">{activeConv.responsible}</span>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {activeConv.labels.map(lb => (
                <span key={lb.text} className={`text-xs px-2 py-0.5 rounded-full font-medium ${lb.color}`}>
                  {lb.text}
                </span>
              ))}
              <button className="text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-teal-400 hover:text-teal-600 transition-colors">
                <Tag className="w-3 h-3 inline mr-0.5" />+
              </button>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ações Rápidas</p>
            <div className="space-y-1.5">
              <button
                onClick={() => navigate('/calendar')}
                className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                Agendar Visita
              </button>
              <button
                onClick={() => navigate(`/leads${activeConv.leadId ? `?highlight=${activeConv.leadId}` : ''}`)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                Ver no Kanban
              </button>
              <button
                onClick={() => setInputText(QUICK_REPLIES[0].text)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-teal-50 text-teal-700 text-xs font-medium rounded-lg hover:bg-teal-100 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Registrar Contato
              </button>
            </div>
          </div>

          {/* Respostas Rápidas — colapsável */}
          <div className="px-4 py-3 border-b border-gray-100">
            <button
              onClick={() => setCollapseQuick(v => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide"
            >
              <span>Respostas Rápidas</span>
              {collapseQuick ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {!collapseQuick && (
              <div className="mt-2 space-y-1">
                {QUICK_REPLIES.map(qr => (
                  <button
                    key={qr.id}
                    onClick={() => setInputText(qr.text)}
                    className="w-full text-left px-2.5 py-1.5 bg-gray-50 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-700">{qr.label}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Histórico CRM — colapsável */}
          <div className="px-4 py-3">
            <button
              onClick={() => setCollapseHistory(v => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide"
            >
              <span>Histórico CRM</span>
              {collapseHistory ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {!collapseHistory && (
              <div className="mt-2 space-y-2">
                {[
                  { action: 'Lead criado',      time: '2 dias atrás',   color: 'bg-blue-400'   },
                  { action: 'Contato realizado', time: '1 dia atrás',   color: 'bg-teal-400'   },
                  { action: 'Visita agendada',   time: 'Hoje',          color: 'bg-amber-400'  },
                ].map((ev, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${ev.color}`} />
                    <div>
                      <p className="text-xs font-medium text-gray-700">{ev.action}</p>
                      <p className="text-xs text-gray-400">{ev.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send error toast */}
      {sendError && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-red-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg">
            {sendError}
          </div>
        </div>
      )}
    </div>
  )
}
