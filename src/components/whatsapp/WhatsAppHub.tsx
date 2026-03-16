import React, { useState, useRef, useEffect } from 'react'
import {
  MessageCircle, Search, Plus, Info, Paperclip, Mic, Smile, Send,
  Play, Pause, FileText, Image, Video, ChevronDown, ChevronRight,
  CheckCheck, Check, Zap, Settings, User, Users,
  X, MoreVertical, Download
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, WhatsappMessage, WhatsappConversation, WhatsappConversationEvent, User as UserType, supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type MsgType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker'
type ConvStatus = 'waiting' | 'open' | 'closed'
type ConvFilter = 'all' | 'unread' | 'waiting' | 'open' | 'closed'
type ConvTypeFilter = 'all' | 'contacts' | 'groups'
type ConvOwnerFilter = 'all' | 'mine' | 'unassigned'
type RightPanelTab = 'details' | 'history'
type MainView = 'conversations' | 'contacts' | 'groups'

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
  media_url?: string
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
  isGroup: boolean
  lead_id?: string
  grade?: string
  source?: string
  responsible?: string
  assigned_user_id?: string
  assigned_user_name?: string
  contact_type?: string
  tags?: string[]
  profile_picture_url?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ConvStatus, { label: string; badge: string; dot: string }> = {
  waiting: { label: 'Aguardando',     badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  open:    { label: 'Em Atendimento', badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400'  },
  closed:  { label: 'Concluído',      badge: 'bg-green-100 text-green-700',  dot: 'bg-green-400' },
}

const QUICK_REPLIES = [
  { id: 'bv',  label: 'Boas-vindas',     text: 'Olá! Seja bem-vindo(a)! 🎓 Estou aqui para ajudar. Como posso te auxiliar?' },
  { id: 'cv',  label: 'Confirmar visita', text: 'Sua visita está confirmada! Estaremos te esperando no horário combinado. 📅' },
  { id: 'pr',  label: 'Enviar proposta',  text: 'Preparei uma proposta especial para vocês! Vou encaminhar agora. 📋' },
  { id: 'vl',  label: 'Valores',          text: 'Sobre os valores: temos planos de pagamento flexíveis e condições especiais. Posso te passar mais detalhes?' },
  { id: 'dc',  label: 'Documentos',       text: 'Para a matrícula precisamos de: RG/CPF dos responsáveis, certidão de nascimento, histórico escolar e comprovante de residência. 📄' },
  { id: 'enc', label: 'Encerramento',     text: 'Foi um prazer te atender! Se surgir qualquer dúvida, estarei sempre aqui. Tenha um ótimo dia! 😊' },
]

const FILTERS = [
  { key: 'all',     label: 'Todas'          },
  { key: 'unread',  label: 'Não lidas'      },
  { key: 'waiting', label: 'Aguardando'     },
  { key: 'open',    label: 'Em Atendimento' },
  { key: 'closed',  label: 'Concluídas'     },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeStatusCfg(status: string) {
  return STATUS_CFG[status as ConvStatus] ?? STATUS_CFG['waiting']
}

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

function mapMsgType(messageType: string): MsgType {
  switch (messageType) {
    case 'imageMessage':        return 'image'
    case 'audioMessage':        return 'audio'
    case 'videoMessage':        return 'video'
    case 'documentMessage':     return 'document'
    case 'stickerMessage':      return 'sticker'
    case 'extendedTextMessage': return 'text'
    default:                    return 'text'
  }
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const TAG_COLORS = ['bg-violet-500','bg-blue-500','bg-rose-500','bg-amber-500','bg-emerald-500','bg-teal-500','bg-pink-500','bg-indigo-500','bg-orange-500','bg-cyan-500']
function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

function buildConversations(msgs: WhatsappMessage[], convMap?: Map<string, WhatsappConversation>): Conversation[] {
  const byJid = new Map<string, WhatsappMessage[]>()
  msgs.forEach(m => {
    if (!byJid.has(m.remote_jid)) byJid.set(m.remote_jid, [])
    byJid.get(m.remote_jid)!.push(m)
  })
  return Array.from(byJid.entries()).map(([jid, jidMsgs]) => {
    const sorted = [...jidMsgs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const last = sorted[sorted.length - 1]
    const isGroup = jid.endsWith('@g.us')
    const convData = convMap?.get(jid)

    let name: string
    if (isGroup) {
      name = jidMsgs.find(m => m.contact_name)?.contact_name || jid.replace(/@g\.us$/, '')
    } else {
      name = jidMsgs.find(m => !m.from_me && m.contact_name)?.contact_name
        || convData?.contact_name
        || formatPhone(jid)
    }

    return {
      id: jid,
      name,
      phone: isGroup ? jid.replace(/@g\.us$/, '') : formatPhone(jid),
      avatarColor: jidToColor(jid),
      lastMessage: last.content,
      lastTime: new Date(last.timestamp),
      unreadCount: convData?.unread_count ?? 0,
      status: ((convData?.status ?? 'waiting') as ConvStatus),
      online: false,
      labels: [],
      isGroup,
      lead_id: convData?.lead_id || jidMsgs.find(m => m.lead_id)?.lead_id,
      assigned_user_id: convData?.assigned_user_id,
      assigned_user_name: convData?.assigned_user_name,
      contact_type: convData?.contact_type,
      tags: convData?.tags || [],
      profile_picture_url: convData?.profile_picture_url,
      messages: sorted.map(m => ({
        id: m.id,
        type: mapMsgType(m.message_type),
        content: m.content,
        from: m.from_me ? 'me' : 'them' as 'me' | 'them',
        ts: new Date(m.timestamp),
        status: 'delivered' as const,
        media_url: m.media_url,
      })),
    }
  }).sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime())
}

// ─── Time helpers ──────────────────────────────────────────────────────────────
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
function AudioPlayer({ duration = 15, from, mediaUrl }: { duration?: number; from: 'me' | 'them'; mediaUrl?: string }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const itvRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => { if (itvRef.current) clearInterval(itvRef.current) }, [])

  if (mediaUrl) {
    return (
      <audio
        ref={audioRef}
        src={mediaUrl}
        controls
        className="max-w-[240px]"
        style={{ height: '36px' }}
      />
    )
  }

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
function MessageBubble({ msg, onImageClick }: { msg: Message; onImageClick?: (url: string) => void }) {
  const isMe = msg.from === 'me'

  const bubbleBase = isMe
    ? 'bg-teal-500 text-white rounded-2xl rounded-tr-sm'
    : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm shadow-sm'

  // Fallback: detect type from content string for legacy messages saved as text
  const effectiveType: MsgType =
    msg.type !== 'text' ? msg.type :
    msg.content === '[Imagem]'    ? 'image'   :
    msg.content === '[Áudio]'     ? 'audio'   :
    msg.content === '[Vídeo]'     ? 'video'   :
    msg.content === '[Figurinha]' ? 'sticker' :
    'text'

  const renderContent = () => {
    switch (effectiveType) {
      case 'audio':
        return <AudioPlayer duration={msg.duration} from={msg.from} mediaUrl={msg.media_url} />
      case 'image':
        return msg.media_url ? (
          <img
            src={msg.media_url}
            alt="Imagem"
            className="max-w-[240px] rounded-xl cursor-pointer"
            onClick={() => onImageClick ? onImageClick(msg.media_url!) : window.open(msg.media_url, '_blank')}
          />
        ) : (
          <div className="w-48 h-32 rounded-xl overflow-hidden bg-gray-200 flex flex-col items-center justify-center gap-1">
            <Image className={`w-8 h-8 ${isMe ? 'text-white/50' : 'text-gray-400'}`} />
            <span className={`text-xs ${isMe ? 'text-white/60' : 'text-gray-400'}`}>Imagem</span>
          </div>
        )
      case 'video':
        return msg.media_url ? (
          <video src={msg.media_url} controls className="max-w-[240px] rounded-xl" />
        ) : (
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
          <div className="flex items-center gap-2 min-w-[180px] px-1 py-0.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-white/20' : 'bg-blue-50'}`}>
              <FileText className={`w-5 h-5 ${isMe ? 'text-white' : 'text-blue-500'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium truncate ${isMe ? 'text-white' : 'text-gray-800'}`}>
                {msg.fileName || msg.content}
              </p>
              {msg.fileSize && (
                <p className={`text-xs ${isMe ? 'text-white/60' : 'text-gray-400'}`}>{msg.fileSize}</p>
              )}
            </div>
            {msg.media_url && (
              <a href={msg.media_url} download target="_blank" rel="noreferrer"
                className={`p-1 rounded-lg flex-shrink-0 ${isMe ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-blue-500'} transition-colors`}>
                <Download className="w-4 h-4" />
              </a>
            )}
          </div>
        )
      case 'sticker':
        return (
          <div className="flex items-center justify-center w-16 h-16">
            <span className="text-4xl" role="img" aria-label="Figurinha">🎭</span>
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

// ─── Event type icon colors ───────────────────────────────────────────────────
function eventDotColor(eventType: string): string {
  switch (eventType) {
    case 'assignment':         return 'bg-blue-400'
    case 'transfer':           return 'bg-purple-400'
    case 'status_change':      return 'bg-amber-400'
    case 'contact_identified': return 'bg-teal-400'
    case 'message_received':   return 'bg-gray-300'
    default:                   return 'bg-gray-300'
  }
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
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ConvFilter>('all')
  // convTypeFilter removed — superseded by mainView tabs
  const [convOwnerFilter, setConvOwnerFilter] = useState<ConvOwnerFilter>('all')
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('details')
  const [convHistory, setConvHistory] = useState<WhatsappConversationEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [users, setUsers] = useState<UserType[]>([])
  const [transferring, setTransferring] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [search, setSearch] = useState('')
  const [inputText, setInputText] = useState('')
  const [showAttach, setShowAttach] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [showContactInfo, setShowContactInfo] = useState(true)
  const [collapseHistory, setCollapseHistory] = useState(true)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [linkingLead, setLinkingLead] = useState(false)
  const [leadSearch, setLeadSearch] = useState('')
  const [leadResults, setLeadResults] = useState<any[]>([])

  // New state variables
  const [showNewConvModal, setShowNewConvModal] = useState(false)
  const [newConvPhone, setNewConvPhone] = useState('')
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [leadForm, setLeadForm] = useState({ responsible_name: '', student_name: '', phone: '', email: '', grade_interest: '', source: 'WhatsApp' })
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [addingTag, setAddingTag] = useState(false)
  const [newTag, setNewTag] = useState('')

  // New feature states
  const [mainView, setMainView] = useState<MainView>('conversations')
  const [showMsgSearch, setShowMsgSearch] = useState(false)
  const [msgSearchText, setMsgSearchText] = useState('')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const moreMenuRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startRecording = async () => {
    if (!activeId) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1]
          try {
            await fetch('/api/evolution/send-media', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instanceName: instance,
                remoteJid: activeId,
                mediatype: 'audio',
                mimetype: mimeType,
                media: base64,
              })
            })
          } catch { setSendError('Erro ao enviar áudio.') }
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start(200)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch {
      setSendError('Permissão de microfone negada.')
    }
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
    setIsRecording(false)
  }

  const handleLinkLead = async (leadId: string) => {
    if (!activeId || !user?.institution_id) return
    await DatabaseService.updateWhatsappMessageLead(activeId, user.institution_id, leadId)
    await DatabaseService.upsertConversationStatus(user.institution_id, activeId, 'open', leadId)
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, lead_id: leadId } : c))
    const found = leadResults.find(l => l.id === leadId)
    if (found) setConversations(prev => prev.map(c =>
      c.id === activeId ? { ...c, name: found.responsible_name || found.student_name || c.name } : c
    ))
    setLinkingLead(false)
    setLeadSearch('')
    setLeadResults([])
  }

  const searchLeads = async (q: string) => {
    setLeadSearch(q)
    if (!user?.institution_id || q.length < 2) { setLeadResults([]); return }
    const results = await DatabaseService.searchLeadsByPhone(user.institution_id, q)
    const allLeads = await DatabaseService.getLeads(user.institution_id)
    const byName = allLeads.filter(l =>
      l.responsible_name?.toLowerCase().includes(q.toLowerCase()) ||
      l.student_name?.toLowerCase().includes(q.toLowerCase())
    )
    const combined = [...results, ...byName.filter(l => !results.find(r => r.id === l.id))].slice(0, 8)
    setLeadResults(combined)
  }

  const addMessageToConversations = (newMsg: WhatsappMessage) => {
    const isGroup = newMsg.remote_jid.endsWith('@g.us')
    const msg: Message = {
      id: newMsg.id,
      type: mapMsgType(newMsg.message_type),
      content: newMsg.content,
      from: newMsg.from_me ? 'me' : 'them',
      ts: new Date(newMsg.timestamp),
      status: 'delivered',
      media_url: newMsg.media_url,
    }
    setConversations(prev => {
      const existing = prev.find(c => c.id === newMsg.remote_jid)
      if (existing) {
        if (existing.messages.some(m => m.id === newMsg.id)) return prev
        return prev.map(c => c.id === newMsg.remote_jid
          ? {
              ...c,
              name: (!c.name || c.name === formatPhone(newMsg.remote_jid)) && newMsg.contact_name ? newMsg.contact_name : c.name,
              messages: [...c.messages, msg],
              lastMessage: newMsg.content,
              lastTime: new Date(newMsg.timestamp),
              unreadCount: c.unreadCount + (newMsg.from_me ? 0 : 1),
            }
          : c
        ).sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime())
      }
      const conv: Conversation = {
        id: newMsg.remote_jid,
        name: newMsg.contact_name || (isGroup ? newMsg.remote_jid.replace(/@g\.us$/, '') : formatPhone(newMsg.remote_jid)),
        phone: isGroup ? newMsg.remote_jid.replace(/@g\.us$/, '') : formatPhone(newMsg.remote_jid),
        avatarColor: jidToColor(newMsg.remote_jid),
        lastMessage: newMsg.content,
        lastTime: new Date(newMsg.timestamp),
        unreadCount: newMsg.from_me ? 0 : 1,
        status: 'waiting', online: false, labels: [],
        isGroup,
        tags: [],
        messages: [msg],
      }
      return [conv, ...prev]
    })
  }

  const loadHistory = async (jid: string) => {
    if (!user?.institution_id || !jid) return
    setHistoryLoading(true)
    const events = await DatabaseService.getConversationEvents(user.institution_id, jid)
    setConvHistory(events)
    setHistoryLoading(false)
  }

  const loadMessages = async () => {
    if (!user?.institution_id) return
    const [msgs, convs] = await Promise.all([
      DatabaseService.getWhatsappMessages(user.institution_id),
      DatabaseService.getWhatsappConversations(user.institution_id),
    ])
    const convMap = new Map(convs.map(c => [c.remote_jid, c]))
    const built = buildConversations(msgs, convMap)
    setConversations(built)
    setActiveId(id => id ?? (built[0]?.id ?? null))
  }

  // Load on mount + check connected + realtime
  useEffect(() => {
    if (!user?.institution_id) { setLoading(false); return }

    const init = async () => {
      const inst = await DatabaseService.getInstitution(user.institution_id!)
      setIsConnected(!!inst?.evolution_instance)
      await loadMessages()
      DatabaseService.getUsers(user.institution_id!).then(setUsers).catch(() => {})
      setLoading(false)
    }
    init()

    const msgChannel = supabase
      .channel(`wamsg-${user.institution_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'whatsapp_messages',
        filter: `institution_id=eq.${user.institution_id}`
      }, (payload) => addMessageToConversations(payload.new as WhatsappMessage))
      .subscribe()

    const convChannel = supabase
      .channel(`waconv-${user.institution_id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'whatsapp_conversations',
        filter: `institution_id=eq.${user.institution_id}`
      }, () => loadMessages())
      .subscribe()

    const interval = setInterval(loadMessages, 10000)
    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(convChannel)
      clearInterval(interval)
    }
  }, [user?.institution_id])

  // Reset unread, auto-assign, auto-link lead, auto-transition waiting→open when opening conversation
  useEffect(() => {
    if (!activeId || !user?.institution_id) return
    // Reset unread
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, unreadCount: 0 } : c))
    DatabaseService.resetConversationUnread(user.institution_id, activeId).catch(() => {})

    const conv = conversations.find(c => c.id === activeId)

    // Auto-transition: waiting → open
    if (conv && conv.status === 'waiting' && user.id) {
      DatabaseService.upsertConversationStatus(user.institution_id, activeId, 'open')
        .then(() => {
          setConversations(prev => prev.map(c => c.id === activeId ? { ...c, status: 'open' as ConvStatus } : c))
          DatabaseService.logConversationEvent({
            institution_id: user.institution_id!,
            remote_jid: activeId,
            event_type: 'status_change',
            description: 'Em atendimento',
            user_id: user.id,
            user_name: user.full_name || user.email,
          }).catch(() => {})
        })
        .catch(() => {})
    }

    // Auto-assign to current user if unassigned
    if (conv && !conv.assigned_user_id && user.id) {
      DatabaseService.assignConversation(user.institution_id, activeId, user.id, user.full_name || user.email)
        .then(() => {
          setConversations(prev => prev.map(c => c.id === activeId
            ? { ...c, assigned_user_id: user.id, assigned_user_name: user.full_name || user.email }
            : c
          ))
          DatabaseService.logConversationEvent({
            institution_id: user.institution_id!,
            remote_jid: activeId,
            event_type: 'assignment',
            description: `Atribuído para ${user.full_name || user.email}`,
            user_id: user.id,
            user_name: user.full_name || user.email,
          }).catch(() => {})
        })
        .catch(() => {})
    }

    // Auto-link lead if not linked
    if (conv && !conv.lead_id && !conv.isGroup && user.institution_id) {
      DatabaseService.searchLeadsByPhone(user.institution_id, conv.phone)
        .then(leads => {
          if (leads.length > 0) {
            const lead = leads[0]
            DatabaseService.updateWhatsappMessageLead(activeId, user.institution_id!, lead.id)
            DatabaseService.upsertConversationStatus(user.institution_id!, activeId, conv.status, lead.id)
            setConversations(prev => prev.map(c => c.id === activeId
              ? { ...c, lead_id: lead.id, name: c.name === formatPhone(activeId) ? (lead.responsible_name || lead.student_name || c.name) : c.name }
              : c
            ))
          }
        })
        .catch(() => {})
    }

    // Fetch profile picture if not loaded yet
    if (conv && !conv.profile_picture_url && !conv.isGroup && instance && user.institution_id) {
      fetch(`/api/evolution/fetch-profile?instanceName=${instance}&number=${conv.phone.replace(/\D/g,'')}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.profilePictureUrl) {
            DatabaseService.updateProfilePicture(user.institution_id!, activeId, data.profilePictureUrl)
            setConversations(prev => prev.map(c => c.id === activeId
              ? { ...c, profile_picture_url: data.profilePictureUrl }
              : c
            ))
          }
        })
        .catch(() => {})
    }
  }, [activeId])

  // Load history when switching to history tab
  useEffect(() => {
    if (rightPanelTab === 'history' && activeId) loadHistory(activeId)
  }, [rightPanelTab, activeId])

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
        labels: [], isGroup: false, tags: [],
        messages: [],
      }
      setConversations(prev => [newConv, ...prev])
      setActiveId(jid)
    }
  }, [phoneParam, nameParam])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeId, conversations])

  // Auto-hide send error
  useEffect(() => {
    if (!sendError) return
    const t = setTimeout(() => setSendError(null), 4000)
    return () => clearTimeout(t)
  }, [sendError])

  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMoreMenu])

  const activeConv = conversations.find(c => c.id === activeId) ?? null
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)

  const filteredConvs = conversations.filter(c => {
    const matchMainView =
      mainView === 'conversations' ? !c.isGroup :
      mainView === 'groups'        ? c.isGroup :
      !c.isGroup  // contacts view also uses non-group but shown as table
    const matchOwner =
      convOwnerFilter === 'all'        ? true :
      convOwnerFilter === 'mine'       ? c.assigned_user_id === user?.id :
      !c.assigned_user_id
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'unread'   ? c.unreadCount > 0 :
      filter === 'open'     ? c.status === 'open' :
      filter === 'waiting'  ? c.status === 'waiting' :
      c.status === 'closed'
    return matchMainView && matchOwner && matchSearch && matchFilter
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

  const handleStatusChange = async (status: ConvStatus) => {
    if (!activeId || !user?.institution_id) return
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, status } : c))
    await DatabaseService.upsertConversationStatus(user.institution_id, activeId, status)
    DatabaseService.logConversationEvent({
      institution_id: user.institution_id,
      remote_jid: activeId,
      event_type: 'status_change',
      description: `Status alterado para: ${safeStatusCfg(status).label}`,
      user_id: user.id,
      user_name: user.full_name || user.email,
    }).catch(() => {})
  }

  const handleTransfer = async () => {
    if (!activeId || !user?.institution_id || !transferTarget) return
    const targetUser = users.find(u => u.id === transferTarget)
    if (!targetUser) return
    const fromName = activeConv?.assigned_user_name || user.full_name || user.email
    await DatabaseService.transferConversation(user.institution_id, activeId, targetUser.id, targetUser.full_name, fromName)
    await DatabaseService.logConversationEvent({
      institution_id: user.institution_id,
      remote_jid: activeId,
      event_type: 'transfer',
      description: `Transferido de ${fromName} para ${targetUser.full_name}`,
      user_id: user.id,
      user_name: user.full_name || user.email,
    })
    setConversations(prev => prev.map(c => c.id === activeId
      ? { ...c, assigned_user_id: targetUser.id, assigned_user_name: targetUser.full_name }
      : c
    ))
    setTransferring(false)
    setTransferTarget('')
  }

  const handleContactType = async (type: string) => {
    if (!activeId || !user?.institution_id) return
    if (type === 'lead') {
      setLeadForm(prev => ({
        ...prev,
        responsible_name: activeConv && activeConv.name !== formatPhone(activeConv.id) ? activeConv.name : '',
        phone: activeConv?.phone || '',
      }))
      setShowLeadModal(true)
      return
    }
    if (type === 'client') {
      setShowClientModal(true)
      return
    }
    await DatabaseService.setConversationContactType(user.institution_id, activeId, type)
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, contact_type: type } : c))
    await DatabaseService.logConversationEvent({
      institution_id: user.institution_id,
      remote_jid: activeId,
      event_type: 'contact_identified',
      description: `Contato identificado como: ${type === 'lead' ? 'Lead' : type === 'client' ? 'Cliente' : 'Outro'}`,
      user_id: user.id,
      user_name: user.full_name || user.email,
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeId) return
    setPendingFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setShowAttach(false)
  }

  const sendPendingFile = async () => {
    if (!pendingFile || !activeId) return
    setUploadProgress(10)
    try {
      const base64 = await toBase64(pendingFile)
      setUploadProgress(60)
      const mediatype = pendingFile.type.startsWith('image/') ? 'image'
        : pendingFile.type.startsWith('video/') ? 'video'
        : pendingFile.type.startsWith('audio/') ? 'audio'
        : 'document'
      const res = await fetch('/api/evolution/send-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: instance,
          remoteJid: activeId,
          mediatype,
          mimetype: pendingFile.type,
          media: base64,
          fileName: pendingFile.name,
          caption: '',
        })
      })
      setUploadProgress(100)
      if (!res.ok) throw new Error()
      setTimeout(() => { setPendingFile(null); setUploadProgress(0) }, 800)
    } catch {
      setSendError('Erro ao enviar arquivo.')
      setPendingFile(null)
      setUploadProgress(0)
    }
  }

  const handleNewConv = () => {
    if (!newConvPhone.trim()) return
    const digits = newConvPhone.replace(/\D/g, '')
    const normalized = digits.startsWith('55') ? digits : `55${digits}`
    const jid = `${normalized}@s.whatsapp.net`
    const existing = conversations.find(c => c.id === jid)
    if (existing) {
      setActiveId(existing.id)
    } else {
      const phone = formatPhone(jid)
      const newConv: Conversation = {
        id: jid, name: phone, phone,
        avatarColor: jidToColor(jid),
        lastMessage: '', lastTime: new Date(),
        unreadCount: 0, status: 'open', online: false,
        labels: [], isGroup: false, tags: [],
        messages: [],
      }
      if (user?.institution_id) {
        DatabaseService.upsertConversationStatus(user.institution_id, jid, 'open').catch(() => {})
      }
      setConversations(prev => [newConv, ...prev])
      setActiveId(jid)
    }
    setShowNewConvModal(false)
    setNewConvPhone('')
  }

  const handleAddTag = async (tag: string) => {
    if (!tag.trim() || !activeId || !user?.institution_id) return
    const currentTags = activeConv?.tags || []
    if (currentTags.includes(tag.trim())) return
    const newTags = [...currentTags, tag.trim()]
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, tags: newTags } : c))
    await DatabaseService.updateConversationTags(user.institution_id, activeId, newTags)
    setAddingTag(false)
    setNewTag('')
  }

  const handleRemoveTag = async (tag: string) => {
    if (!activeId || !user?.institution_id) return
    const newTags = (activeConv?.tags || []).filter(t => t !== tag)
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, tags: newTags } : c))
    await DatabaseService.updateConversationTags(user.institution_id, activeId, newTags)
  }

  const handleCloseConversation = async () => {
    if (!activeId || !user?.institution_id) return
    await DatabaseService.closeConversation(user.institution_id, activeId)
    await DatabaseService.logConversationEvent({
      institution_id: user.institution_id,
      remote_jid: activeId,
      event_type: 'status_change',
      description: 'Conversa concluída',
      user_id: user.id,
      user_name: user.full_name || user.email,
    })
    setConversations(prev => prev.map(c => c.id === activeId
      ? { ...c, status: 'closed' as ConvStatus, assigned_user_id: undefined, assigned_user_name: undefined }
      : c
    ))
  }

  const handleCreateLead = async () => {
    if (!user?.institution_id || !leadForm.responsible_name) return
    try {
      const lead = await DatabaseService.createLead({
        ...leadForm,
        institution_id: user.institution_id,
        status: 'new',
      })
      if (activeId) {
        await DatabaseService.updateWhatsappMessageLead(activeId, user.institution_id, lead.id)
        await DatabaseService.upsertConversationStatus(user.institution_id, activeId, activeConv?.status || 'open', lead.id)
        await DatabaseService.setConversationContactType(user.institution_id, activeId, 'lead')
        setConversations(prev => prev.map(c => c.id === activeId
          ? { ...c, lead_id: lead.id, contact_type: 'lead', name: leadForm.responsible_name || c.name }
          : c
        ))
      }
      setShowLeadModal(false)
      setLeadForm({ responsible_name: '', student_name: '', phone: '', email: '', grade_interest: '', source: 'WhatsApp' })
    } catch { setSendError('Erro ao criar lead.') }
  }

  const filteredMessages = activeConv
    ? (msgSearchText.trim()
        ? activeConv.messages.filter(m => m.content.toLowerCase().includes(msgSearchText.toLowerCase()))
        : activeConv.messages)
    : []
  const msgGroups = filteredMessages.length > 0 || (activeConv && !msgSearchText.trim())
    ? (activeConv ? groupByDate(filteredMessages) : [])
    : []

  const COMMON_EMOJIS = ['😊','😂','❤️','👍','🙏','😍','🎉','😢','😮','👏','🔥','✅','🤔','😅','💪','🙌','😭','🥰','😎','🤩','💯','✨','🎓','📚','👋','🤝','📞','💬','⭐','🏫']

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center bg-[#f0f2f5]" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#14b8a6] border-t-transparent" />
      </div>
    )
  }

  // ── Not connected ──
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center bg-[#f0f2f5]" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-10 h-10 text-gray-300" />
          </div>
          <h2 className="text-base font-bold text-gray-700 mb-2">WhatsApp não conectado</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Conecte seu WhatsApp nas Configurações para começar a atender.
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
    <>
      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxUrl} alt="Imagem" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewConvModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
            <h3 className="text-sm font-bold text-[#1e2d6b] mb-4">Nova Conversa</h3>
            <input
              autoFocus
              type="tel"
              value={newConvPhone}
              onChange={e => setNewConvPhone(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNewConv() }}
              placeholder="+55 (00) 00000-0000"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#14b8a6] outline-none mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowNewConvModal(false); setNewConvPhone('') }}
                className="flex-1 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleNewConv} disabled={!newConvPhone.trim()}
                className="flex-1 py-2 text-xs font-bold text-white bg-[#14b8a6] rounded-xl hover:bg-[#0d9488] disabled:opacity-40">
                Iniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Modal */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1e2d6b]">Criar Lead</h3>
              <button onClick={() => setShowLeadModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Responsável *</label>
                <input value={leadForm.responsible_name} onChange={e => setLeadForm(f => ({...f, responsible_name: e.target.value}))}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Aluno</label>
                <input value={leadForm.student_name} onChange={e => setLeadForm(f => ({...f, student_name: e.target.value}))}
                  placeholder="Nome do aluno"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Telefone</label>
                <input value={leadForm.phone} onChange={e => setLeadForm(f => ({...f, phone: e.target.value}))}
                  placeholder="+55 00 00000-0000"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
                <input type="email" value={leadForm.email} onChange={e => setLeadForm(f => ({...f, email: e.target.value}))}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Série de Interesse</label>
                <select value={leadForm.grade_interest} onChange={e => setLeadForm(f => ({...f, grade_interest: e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] outline-none">
                  <option value="">Selecionar...</option>
                  {['Educação Infantil','1º Ano','2º Ano','3º Ano','4º Ano','5º Ano','6º Ano','7º Ano','8º Ano','9º Ano','1º EM','2º EM','3º EM'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowLeadModal(false)}
                className="flex-1 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleCreateLead} disabled={!leadForm.responsible_name.trim()}
                className="flex-1 py-2 text-xs font-bold text-white bg-[#1e2d6b] rounded-xl hover:bg-[#151b4e] disabled:opacity-40">
                Criar Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Modal (placeholder) */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1e2d6b]">Marcar como Cliente</h3>
              <button onClick={() => setShowClientModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Este contato será marcado como cliente existente.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowClientModal(false)}
                className="flex-1 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={async () => {
                if (!activeId || !user?.institution_id) return
                await DatabaseService.setConversationContactType(user.institution_id, activeId, 'client')
                setConversations(prev => prev.map(c => c.id === activeId ? { ...c, contact_type: 'client' } : c))
                await DatabaseService.logConversationEvent({
                  institution_id: user.institution_id,
                  remote_jid: activeId,
                  event_type: 'contact_identified',
                  description: 'Contato identificado como: Cliente',
                  user_id: user.id,
                  user_name: user.full_name || user.email,
                })
                setShowClientModal(false)
              }}
                className="flex-1 py-2 text-xs font-bold text-white bg-[#1e2d6b] rounded-xl hover:bg-[#151b4e]">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex overflow-hidden bg-[#f0f2f5]" style={{ height: 'calc(100vh - 56px)' }}>

        {/* Hidden file input for attachments */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xlsx,.xls"
          className="hidden"
          onChange={handleFileSelect}
        />

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
            <button
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              title="Nova conversa"
              onClick={() => setShowNewConvModal(true)}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Main view tabs: Conversas | Contatos | Grupos */}
          <div className="flex border-b border-gray-100 flex-shrink-0">
            {([
              { key: 'conversations', label: 'Conversas' },
              { key: 'contacts',      label: 'Contatos'  },
              { key: 'groups',        label: 'Grupos'    },
            ] as { key: MainView; label: string }[]).map(t => (
              <button key={t.key} onClick={() => setMainView(t.key)}
                className={`flex-1 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  mainView === t.key
                    ? 'border-[#14b8a6] text-[#14b8a6]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >{t.label}</button>
            ))}
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

          {/* Owner filter pills */}
          <div className="px-3 py-1.5 flex gap-1 flex-shrink-0 border-b border-gray-100">
            {[
              { key: 'all',        label: 'Todos' },
              { key: 'mine',       label: 'Meus' },
              { key: 'unassigned', label: 'Sem atendente' },
            ].map(o => (
              <button key={o.key} onClick={() => setConvOwnerFilter(o.key as ConvOwnerFilter)}
                className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  convOwnerFilter === o.key ? 'bg-[#1e2d6b] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{o.label}</button>
            ))}
          </div>

          {/* Filter pills */}
          <div className="px-3 py-2 flex-shrink-0 flex gap-1 overflow-x-auto scrollbar-hide">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as ConvFilter)}
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
                const statusDot = safeStatusCfg(conv.status).dot
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
                    {/* Avatar with profile picture support */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full ${conv.avatarColor} text-white text-sm font-bold flex items-center justify-center overflow-hidden`}>
                        {conv.profile_picture_url ? (
                          <img src={conv.profile_picture_url} alt={conv.name} className="w-full h-full object-cover" />
                        ) : conv.isGroup ? (
                          <Users className="w-5 h-5 text-white/90" />
                        ) : (
                          conv.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {conv.online && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                      )}
                      {conv.assigned_user_name && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#1e2d6b] text-white rounded-full flex items-center justify-center text-[8px] font-bold border border-white">
                          {getInitials(conv.assigned_user_name)}
                        </div>
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
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${safeStatusCfg(conv.status).badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                          {safeStatusCfg(conv.status).label}
                        </span>
                        {conv.isGroup && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                            Grupo
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Col 2: Chat ───────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Contacts table view ── */}
          {mainView === 'contacts' && (
            <div className="flex-1 overflow-y-auto bg-white p-6">
              <h2 className="text-sm font-bold text-[#1e2d6b] mb-4">Contatos</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500 uppercase tracking-wide">
                    <th className="text-left py-2 pr-4 font-semibold">Nome</th>
                    <th className="text-left py-2 pr-4 font-semibold">Telefone</th>
                    <th className="text-left py-2 pr-4 font-semibold">Tipo</th>
                    <th className="text-left py-2 pr-4 font-semibold">Atendente</th>
                    <th className="text-left py-2 pr-4 font-semibold">Etiquetas</th>
                    <th className="text-left py-2 font-semibold">Última msg</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.filter(c => !c.isGroup).map(c => (
                    <tr key={c.id}
                      onClick={() => { setMainView('conversations'); setActiveId(c.id) }}
                      className="border-b border-gray-50 hover:bg-teal-50 cursor-pointer transition-colors">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full ${c.avatarColor} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                            {c.profile_picture_url
                              ? <img src={c.profile_picture_url} alt={c.name} className="w-full h-full object-cover" />
                              : c.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800 truncate max-w-[120px]">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500">{c.phone}</td>
                      <td className="py-2.5 pr-4">
                        {c.contact_type
                          ? <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{c.contact_type}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500">{c.assigned_user_name || <span className="text-gray-300">—</span>}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags || []).slice(0, 3).map(tag => (
                            <span key={tag} className={`px-1.5 py-0.5 rounded-full text-white font-medium ${tagColor(tag)}`}>{tag}</span>
                          ))}
                          {(c.tags || []).length > 3 && <span className="text-gray-400">+{(c.tags || []).length - 3}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 text-gray-400">{fmtConvTime(c.lastTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {conversations.filter(c => !c.isGroup).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-12">Nenhum contato encontrado</p>
              )}
            </div>
          )}

          {/* Chat + composer — hidden in contacts view */}
          {mainView !== 'contacts' && activeConv && (
            <div className="relative flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full ${activeConv.avatarColor} text-white text-sm font-bold flex items-center justify-center overflow-hidden`}>
                    {activeConv.profile_picture_url ? (
                      <img src={activeConv.profile_picture_url} alt={activeConv.name} className="w-full h-full object-cover" />
                    ) : activeConv.isGroup ? (
                      <Users className="w-5 h-5 text-white/90" />
                    ) : (
                      activeConv.name.charAt(0)
                    )}
                  </div>
                  {activeConv.online && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{activeConv.name}</p>
                  <p className="text-xs text-gray-500">
                    {activeConv.isGroup ? 'Grupo WhatsApp' : activeConv.phone}
                    {activeConv.online && <span className="ml-1.5 text-green-500 font-medium">• online</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setShowMsgSearch(v => !v); if (showMsgSearch) setMsgSearchText('') }}
                    className={`p-2 rounded-lg transition-colors ${showMsgSearch ? 'bg-teal-50 text-teal-600' : 'hover:bg-gray-100 text-gray-500'}`}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowContactInfo(v => !v)}
                    className={`p-2 rounded-lg transition-colors ${showContactInfo ? 'bg-teal-50 text-teal-600' : 'hover:bg-gray-100 text-gray-500'}`}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowMoreMenu(v => !v)}
                    className={`p-2 rounded-lg transition-colors ${showMoreMenu ? 'bg-gray-100 text-gray-700' : 'hover:bg-gray-100 text-gray-500'}`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message search bar */}
              {showMsgSearch && (
                <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <input autoFocus value={msgSearchText} onChange={e => setMsgSearchText(e.target.value)}
                    placeholder="Buscar nas mensagens..."
                    className="flex-1 text-xs bg-transparent outline-none text-gray-700"
                  />
                  <button onClick={() => { setShowMsgSearch(false); setMsgSearchText('') }}
                    className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {/* More menu dropdown */}
              {showMoreMenu && (
                <div ref={moreMenuRef} className="absolute right-4 top-14 z-30 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[160px]">
                  <button onClick={() => { setConversations(prev => prev.map(c => c.id === activeId ? {...c, messages: []} : c)); setShowMoreMenu(false) }}
                    className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">
                    Limpar conversa
                  </button>
                  <button onClick={() => { setShowMoreMenu(false) }}
                    className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">
                    Bloquear contato
                  </button>
                  {activeConv?.lead_id && (
                    <button onClick={() => { navigate(`/leads?highlight=${activeConv.lead_id}`); setShowMoreMenu(false) }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50">
                      Ver perfil no CRM
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages area + Composer — hidden in contacts view */}
          {mainView !== 'contacts' && <>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-0.5">
            {!activeConv && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-[#14b8a6]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-[#14b8a6] animate-pulse" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Aguardando mensagens</p>
                <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                  Seu WhatsApp está conectado. As conversas aparecerão aqui assim que chegarem novas mensagens.
                </p>
              </div>
            )}
            {!activeConv && conversations.length > 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="w-10 h-10 text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">Selecione uma conversa</p>
              </div>
            )}
            {msgGroups.map((group, gi) => (
              <div key={gi}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-gray-500 bg-white/80 px-3 py-1 rounded-full shadow-sm border border-gray-100">
                    {group.label}
                  </span>
                </div>
                {group.msgs.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} onImageClick={url => setLightboxUrl(url)} />
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
                    onClick={() => { fileInputRef.current?.click(); setShowAttach(false) }}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl ${item.color} text-xs font-medium hover:opacity-80 transition-opacity`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {/* File preview area */}
            {pendingFile && (
              <div className="mb-2 bg-gray-50 rounded-xl border border-gray-200 p-2 flex items-center gap-2">
                {pendingFile.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(pendingFile)} alt="preview" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{pendingFile.name}</p>
                  <p className="text-xs text-gray-400">{(pendingFile.size / 1024).toFixed(1)} KB</p>
                  {uploadProgress > 0 && (
                    <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={sendPendingFile} className="p-1.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setPendingFile(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div className="mb-2 bg-white rounded-xl border border-gray-200 p-2 shadow-lg">
                <div className="grid grid-cols-10 gap-1">
                  {COMMON_EMOJIS.map(e => (
                    <button key={e} onClick={() => { setInputText(t => t + e); setShowEmojiPicker(false) }}
                      className="w-7 h-7 text-base hover:bg-gray-100 rounded flex items-center justify-center transition-colors">
                      {e}
                    </button>
                  ))}
                </div>
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
              <button
                onClick={() => { setShowEmojiPicker(v => !v); setShowAttach(false); setShowQuickReplies(false) }}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${showEmojiPicker ? 'bg-teal-100 text-teal-600' : 'hover:bg-gray-100 text-gray-500'}`}
              >
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
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className={`p-2 rounded-xl transition-colors flex-shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-100 text-gray-500'}`}
                  title="Segurar para gravar áudio"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          </>}
        </div>

        {/* ── Col 3: Contact Panel ──────────────────────────────────────────────── */}
        {showContactInfo && activeConv && (
          <div className="w-[280px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">

            {/* Tab bar */}
            <div className="flex-shrink-0 flex border-b border-gray-200">
              {([
                { key: 'details', label: 'Detalhes' },
                { key: 'history', label: 'Histórico' },
              ] as { key: RightPanelTab; label: string }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setRightPanelTab(tab.key)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    rightPanelTab === tab.key
                      ? 'border-[#14b8a6] text-[#14b8a6]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Detalhes tab ── */}
            {rightPanelTab === 'details' && (
              <div className="flex-1 overflow-y-auto">

                {/* Concluir Conversa button */}
                {activeConv.status !== 'closed' && (
                  <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <button onClick={handleCloseConversation}
                      className="w-full py-2 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors">
                      ✓ Concluir Conversa
                    </button>
                  </div>
                )}

                {/* Contact header */}
                <div className="flex-shrink-0 flex flex-col items-center px-4 pt-6 pb-4 border-b border-gray-100">
                  <div className={`w-16 h-16 rounded-full ${activeConv.avatarColor} text-white text-2xl font-bold flex items-center justify-center mb-3 overflow-hidden`}>
                    {activeConv.profile_picture_url ? (
                      <img src={activeConv.profile_picture_url} alt={activeConv.name} className="w-full h-full object-cover" />
                    ) : activeConv.isGroup ? (
                      <Users className="w-8 h-8 text-white/90" />
                    ) : (
                      activeConv.name.charAt(0)
                    )}
                  </div>
                  <p className="text-sm font-bold text-[#1e2d6b] text-center">{activeConv.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {activeConv.isGroup ? 'Grupo WhatsApp' : activeConv.phone}
                  </p>
                  {activeConv.isGroup && (
                    <span className="mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">Grupo</span>
                  )}
                  {activeConv.labels.map(lb => (
                    <span key={lb.text} className={`mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${lb.color}`}>
                      {lb.text}
                    </span>
                  ))}
                </div>

                {/* Who is this contact? — only for unknown non-group, non-linked contacts */}
                {!activeConv.isGroup && (!activeConv.contact_type || activeConv.contact_type === 'unknown') && !activeConv.lead_id && (
                  <div className="px-4 py-3 border-b border-gray-100 bg-amber-50">
                    <p className="text-xs font-semibold text-amber-700 mb-2">Quem é esse contato?</p>
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => {
                        setLeadForm(prev => ({
                          ...prev,
                          responsible_name: activeConv.name !== formatPhone(activeConv.id) ? activeConv.name : '',
                          phone: activeConv.phone,
                        }))
                        setShowLeadModal(true)
                      }}
                        className="w-full text-left px-3 py-1.5 text-xs font-medium bg-white border border-amber-200 rounded-lg hover:bg-amber-100 hover:border-amber-400 text-amber-800 transition-colors">
                        É um Lead
                      </button>
                      <button onClick={() => setShowClientModal(true)}
                        className="w-full text-left px-3 py-1.5 text-xs font-medium bg-white border border-amber-200 rounded-lg hover:bg-amber-100 hover:border-amber-400 text-amber-800 transition-colors">
                        É um Cliente
                      </button>
                      <button onClick={() => handleContactType('other')}
                        className="w-full text-left px-3 py-1.5 text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                        Ignorar
                      </button>
                    </div>
                  </div>
                )}

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
                    <option value="waiting">Aguardando</option>
                    <option value="open">Em Atendimento</option>
                    <option value="closed">Concluído</option>
                  </select>
                </div>

                {/* Attendant section */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Atendente
                  </label>
                  {transferring ? (
                    <div className="space-y-2">
                      <select
                        value={transferTarget}
                        onChange={e => setTransferTarget(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none"
                      >
                        <option value="">Selecionar atendente...</option>
                        {users.filter(u => u.id !== activeConv.assigned_user_id).map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                      <div className="flex gap-1.5">
                        <button onClick={handleTransfer} disabled={!transferTarget}
                          className="flex-1 px-2.5 py-1.5 bg-[#1e2d6b] text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-[#151b4e] transition-colors">
                          Transferir
                        </button>
                        <button onClick={() => { setTransferring(false); setTransferTarget('') }}
                          className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-700">
                        {activeConv.assigned_user_name || <span className="text-gray-400 italic">Sem atendente</span>}
                      </span>
                      <button onClick={() => setTransferring(true)}
                        className="text-xs text-[#14b8a6] hover:text-[#0d9488] font-medium transition-colors">
                        Transferir
                      </button>
                    </div>
                  )}
                </div>

                {/* Etiquetas */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Etiquetas
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {(activeConv.tags || []).map(tag => (
                      <span key={tag} className={`inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium text-white ${tagColor(tag)}`}>
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="hover:opacity-70 ml-0.5">×</button>
                      </span>
                    ))}
                    {addingTag ? (
                      <input
                        autoFocus
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTag(newTag); if (e.key === 'Escape') { setAddingTag(false); setNewTag('') } }}
                        onBlur={() => { if (newTag.trim()) handleAddTag(newTag); else { setAddingTag(false); setNewTag('') } }}
                        placeholder="Nova etiqueta..."
                        className="text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 outline-none focus:border-teal-400 w-28"
                        maxLength={20}
                      />
                    ) : (
                      <button onClick={() => setAddingTag(true)}
                        className="text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-teal-400 hover:text-teal-600 transition-colors">
                        + Etiqueta
                      </button>
                    )}
                  </div>
                </div>

                {/* Lead linking — only for individual contacts */}
                {!activeConv.isGroup && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    {activeConv.lead_id ? (
                      <button
                        onClick={() => navigate(`/leads?highlight=${activeConv.lead_id}`)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1e2d6b] text-white text-xs font-semibold rounded-lg hover:bg-[#151b4e] transition-colors"
                      >
                        <User className="w-3.5 h-3.5" />
                        Ver Lead no CRM
                      </button>
                    ) : linkingLead ? (
                      <div className="space-y-2">
                        <input
                          autoFocus
                          value={leadSearch}
                          onChange={e => searchLeads(e.target.value)}
                          placeholder="Buscar lead por nome ou tel..."
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] outline-none"
                        />
                        {leadResults.map(l => (
                          <button key={l.id} onClick={() => handleLinkLead(l.id)}
                            className="w-full text-left px-2.5 py-1.5 text-xs bg-gray-50 hover:bg-teal-50 rounded-lg transition-colors">
                            <p className="font-semibold text-gray-700">{l.responsible_name}</p>
                            <p className="text-gray-400">{l.student_name} · {l.grade_interest}</p>
                          </button>
                        ))}
                        <button onClick={() => { setLinkingLead(false); setLeadSearch(''); setLeadResults([]) }}
                          className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setLinkingLead(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 text-gray-500 text-xs font-medium rounded-lg hover:border-teal-400 hover:text-teal-600 transition-colors">
                        <User className="w-3.5 h-3.5" />
                        Vincular a um Lead
                      </button>
                    )}
                  </div>
                )}

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
                        { action: 'Lead criado',      time: '2 dias atrás', color: 'bg-blue-400'  },
                        { action: 'Contato realizado', time: '1 dia atrás',  color: 'bg-teal-400'  },
                        { action: 'Visita agendada',   time: 'Hoje',         color: 'bg-amber-400' },
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

            {/* ── Histórico tab ── */}
            {rightPanelTab === 'history' && (
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Histórico de eventos</p>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#14b8a6] border-t-transparent" />
                  </div>
                ) : convHistory.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Nenhum evento registrado</p>
                ) : (
                  <div className="space-y-3">
                    {convHistory.map(ev => (
                      <div key={ev.id} className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${eventDotColor(ev.event_type)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-700 leading-snug">{ev.description || ev.event_type}</p>
                          {ev.user_name && (
                            <p className="text-xs text-gray-400 mt-0.5">{ev.user_name}</p>
                          )}
                          <p className="text-xs text-gray-300 mt-0.5">
                            {new Date(ev.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
    </>
  )
}
