import React, { useState, useRef, useEffect } from 'react'
import ContactDrawer from './ContactDrawer'
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
type ConvOwnerFilter = 'all' | 'mine' | 'unassigned'
type RightPanelTab = 'details' | 'history'
type MainView = 'conversations' | 'contacts'

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
  waiting: { label: 'Aguardando',     badge: 'bg-[#FEF3C7] text-[#D97706]',   dot: 'bg-[#D97706]' },
  open:    { label: 'Em Atendimento', badge: 'bg-[#D1FAE5] text-[#059669]',   dot: 'bg-[#059669]' },
  closed:  { label: 'Concluído',      badge: 'bg-[#E2E8F0] text-[#64748B]',   dot: 'bg-[#94A3B8]' },
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

const FILTER_ACTIVE: Record<string, string> = {
  all:     'bg-[#1A2B4A] text-white',
  unread:  'bg-[#EDE9FE] text-[#7C3AED]',
  waiting: 'bg-[#FEF3C7] text-[#D97706]',
  open:    'bg-[#D1FAE5] text-[#059669]',
  closed:  'bg-[#E2E8F0] text-[#64748B]',
}

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

function getLastMsgPreview(lastMessage: string): { icon?: string; text: string } {
  if (lastMessage === '[Imagem]')    return { icon: '🖼️', text: 'Imagem' }
  if (lastMessage === '[Áudio]')     return { icon: '🎵', text: 'Áudio' }
  if (lastMessage === '[Vídeo]')     return { icon: '🎬', text: 'Vídeo' }
  if (lastMessage === '[Documento]') return { icon: '📄', text: 'Documento' }
  if (lastMessage === '[Figurinha]') return { icon: '🎭', text: 'Figurinha' }
  return { text: lastMessage }
}

// BUG 2: Proxy external media URLs through our backend to bypass CSP
function getProxiedUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('blob:')) return url
  return `/api/evolution/media-proxy?url=${encodeURIComponent(url)}`
}

// BUG 4: Compress images larger than 4MB before sending
async function compressImage(file: File, maxMB = 4): Promise<File> {
  if (file.size < maxMB * 1024 * 1024) return file
  return new Promise(resolve => {
    const img = document.createElement('img')
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      const maxDim = 1280
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
        else { width = Math.round(width * maxDim / height); height = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        URL.revokeObjectURL(objUrl)
        resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file)
      }, 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file) }
    img.src = objUrl
  })
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
function AudioPlayer({ duration = 15, mediaUrl, isDark = true }: { duration?: number; from?: 'me' | 'them'; mediaUrl?: string; isDark?: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(1)
  const itvRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => { if (itvRef.current) clearInterval(itvRef.current) }, [])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
  const elapsed = Math.round((progress / 100) * duration)

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const handleToggle = () => {
    if (mediaUrl && audioRef.current) {
      if (playing) { audioRef.current.pause(); setPlaying(false) }
      else { audioRef.current.playbackRate = speed; audioRef.current.play().catch(() => {}); setPlaying(true) }
    } else {
      if (playing) { clearInterval(itvRef.current!); setPlaying(false) }
      else {
        setPlaying(true)
        itvRef.current = setInterval(() => {
          setProgress(p => {
            if (p >= 100) { clearInterval(itvRef.current!); setPlaying(false); return 0 }
            return p + (100 / (duration * 10))
          })
        }, 100)
      }
    }
  }

  const btnCls = `w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
    isDark ? 'bg-white/20 hover:bg-white/30' : 'bg-[#00A896] hover:bg-[#008f81]'
  }`
  const trackCls = `h-[3px] rounded-full overflow-hidden ${isDark ? 'bg-white/30' : 'bg-[#E2E8F0]'}`
  const fillCls  = `h-full rounded-full transition-all duration-100 ${isDark ? 'bg-white' : 'bg-[#00A896]'}`
  const timeCls  = `text-xs ${isDark ? 'text-white/60' : 'text-[#64748B]'}`
  const speedCls = `text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${isDark ? 'text-white/70 hover:text-white' : 'text-[#64748B] hover:text-[#1A2B4A]'}`

  return (
    <div className="flex items-center gap-2 min-w-[210px]">
      {mediaUrl && (
        <audio
          ref={audioRef}
          src={mediaUrl}
          style={{ display: 'none' }}
          onEnded={() => { setPlaying(false); setProgress(0) }}
          onTimeUpdate={() => {
            if (audioRef.current) setProgress((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100)
          }}
        />
      )}
      <button onClick={handleToggle} className={btnCls}>
        {playing
          ? <Pause className="w-3.5 h-3.5 text-white" />
          : <Play  className="w-3.5 h-3.5 text-white" />}
      </button>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className={trackCls}>
          <div className={fillCls} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className={timeCls}>{playing ? fmt(elapsed) : fmt(duration)}</span>
          <button onClick={cycleSpeed} className={speedCls}>{speed}x</button>
        </div>
      </div>
    </div>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, onImageClick }: { msg: Message; onImageClick?: (url: string) => void }) {
  const isMe = msg.from === 'me'

  const bubbleBase = isMe
    ? 'bg-[#1A2B4A] text-white rounded-xl rounded-tr-none'
    : 'bg-white border border-[#E2E8F0] text-[#1A2B4A] rounded-xl rounded-tl-none shadow-sm'

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
        return <AudioPlayer duration={msg.duration} from={msg.from} mediaUrl={getProxiedUrl(msg.media_url)} isDark={isMe} />
      case 'image': {
        const imgSrc = getProxiedUrl(msg.media_url)
        return imgSrc ? (
          <img
            src={imgSrc}
            alt="Imagem"
            className="max-w-[240px] rounded-xl cursor-pointer"
            onClick={() => onImageClick ? onImageClick(imgSrc) : window.open(imgSrc, '_blank')}
          />
        ) : (
          <div className={`w-48 h-32 rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1 ${isMe ? 'bg-white/10' : 'bg-[#F1F5F9]'}`}>
            <Image className={`w-8 h-8 ${isMe ? 'text-white/60' : 'text-[#94A3B8]'}`} />
            <span className={`text-xs ${isMe ? 'text-white/60' : 'text-[#94A3B8]'}`}>Imagem</span>
          </div>
        )
      }
      case 'video':
        return msg.media_url ? (
          <video src={getProxiedUrl(msg.media_url)} controls className="max-w-[240px] rounded-xl" />
        ) : (
          <div className={`w-48 h-32 rounded-xl overflow-hidden flex items-center justify-center relative ${isMe ? 'bg-white/10' : 'bg-[#F1F5F9]'}`}>
            <Video className={`w-6 h-6 ${isMe ? 'text-white/50' : 'text-[#94A3B8]'}`} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isMe ? 'bg-white/20' : 'bg-[#E2E8F0]'}`}>
                <Play className={`w-5 h-5 ${isMe ? 'text-white' : 'text-[#64748B]'}`} />
              </div>
            </div>
          </div>
        )
      case 'document':
        return (
          <div className="flex items-center gap-2 min-w-[180px] px-1 py-0.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-white/20' : 'bg-[#F1F5F9]'}`}>
              <FileText className={`w-5 h-5 ${isMe ? 'text-white' : 'text-[#64748B]'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium truncate ${isMe ? 'text-white' : 'text-[#1A2B4A]'}`}>
                {msg.fileName || msg.content}
              </p>
              {msg.fileSize && (
                <p className={`text-xs ${isMe ? 'text-white/60' : 'text-[#64748B]'}`}>{msg.fileSize}</p>
              )}
            </div>
            {msg.media_url && (
              <a href={getProxiedUrl(msg.media_url)} download target="_blank" rel="noreferrer"
                className={`p-1 rounded-lg flex-shrink-0 transition-colors ${isMe ? 'text-white/70 hover:text-white' : 'text-[#64748B] hover:text-[#1A2B4A]'}`}>
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
          <span className={`text-[10px] ${isMe ? 'text-white/60' : 'text-[#94A3B8]'}`}>{fmtTime(msg.ts)}</span>
          {isMe && (
            msg.status === 'read'      ? <CheckCheck className="w-3 h-3 text-[#00A896]" /> :
            msg.status === 'delivered' ? <CheckCheck className="w-3 h-3 text-white/60" /> :
            <Check className="w-3 h-3 text-white/60" />
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

  // Edit contact inline form
  const [editingContact, setEditingContact] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', contact_type: '', notes: '' })

  // New feature states
  const [mainView, setMainView] = useState<MainView>('conversations')
  const [showMsgSearch, setShowMsgSearch] = useState(false)
  const [msgSearchText, setMsgSearchText] = useState('')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Feature 1: Connection status
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')

  // Feature 4: ContactDrawer
  const [showDrawer, setShowDrawer] = useState(false)

  // Typing indicator
  const [typingConvIds, setTypingConvIds] = useState<Set<string>>(new Set())

  // Feature 5: Contacts filters
  const [contactSearch, setContactSearch] = useState('')
  const [contactTypeFilter, setContactTypeFilter] = useState('')
  const [contactAttendantFilter, setContactAttendantFilter] = useState('')
  const [contactStatusFilter, setContactStatusFilter] = useState('')
  const [contactTagFilter, setContactTagFilter] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importing, setImporting] = useState(false)

  const moreMenuRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startRecording = async () => {
    if (!activeId) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        stream.getTracks().forEach(t => t.stop())
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1]
          try {
            const res = await fetch('/api/evolution/send-media', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instanceName: instance,
                remoteJid: activeId,
                mediatype: 'audio',
                media: base64,
                mimetype: mimeType,
              })
            })
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              console.error('[send-audio] error:', err)
              setSendError('Erro ao enviar áudio.')
            }
          } catch { setSendError('Erro ao enviar áudio.') }
        }
        reader.readAsDataURL(blob)
      }
      recorder.start(200)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setSendError('Permissão de microfone negada. Clique no ícone 🔒 na barra de endereço e permita o microfone.')
      } else {
        setSendError('Erro ao acessar microfone: ' + (err?.message || 'desconhecido'))
      }
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
    // Briefly show typing indicator for incoming messages
    if (!newMsg.from_me) {
      setTypingConvIds(prev => new Set(prev).add(newMsg.remote_jid))
      setTimeout(() => setTypingConvIds(prev => {
        const next = new Set(prev); next.delete(newMsg.remote_jid); return next
      }), 1200)
    }
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

  const prevConnectionStatusRef = useRef<string>('unknown')

  // Feature 1: Connection status polling
  useEffect(() => {
    if (!instance || !isConnected) return
    const CONNECTED_STATES = ['open', 'connected', 'CONNECTED', 'OPEN']
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/evolution/connection-state?instanceName=${encodeURIComponent(instance)}`)
        if (!res.ok) {
          // Don't flip to disconnected on transient HTTP errors — keep previous state
          console.warn('[connection-state] HTTP', res.status)
          return
        }
        const data = await res.json()
        console.log('[connection-state] data:', data)
        const state = data?.instance?.state ?? data?.state ?? data?.status
        const isConn = CONNECTED_STATES.includes(state)
        setConnectionStatus(isConn ? 'connected' : state ? 'disconnected' : 'unknown')
      } catch (err) {
        // Network error — keep previous state, don't flash banner
        console.warn('[connection-state] fetch failed:', err)
      }
    }
    checkStatus()
    const iv = setInterval(checkStatus, 30000)
    return () => clearInterval(iv)
  }, [instance, isConnected])

  // Melhoria: sync recent messages when connection becomes active
  useEffect(() => {
    const prev = prevConnectionStatusRef.current
    prevConnectionStatusRef.current = connectionStatus
    if (connectionStatus === 'connected' && prev !== 'connected' && prev !== 'unknown') {
      // Just reconnected — reload messages to catch up
      loadMessages().catch(() => {})
    }
  }, [connectionStatus])

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
      fetch('/api/evolution/get-profile-picture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: instance, number: conv.phone.replace(/\D/g,'') })
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const pictureUrl = data?.profilePictureUrl || data?.picture
          if (pictureUrl) {
            DatabaseService.updateProfilePicture(user.institution_id!, activeId, pictureUrl)
            setConversations(prev => prev.map(c => c.id === activeId
              ? { ...c, profile_picture_url: pictureUrl }
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
    const matchMainView = !c.isGroup  // always filter out groups
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

    const mediatype = pendingFile.type.startsWith('image/') ? 'image'
      : pendingFile.type.startsWith('video/') ? 'video'
      : pendingFile.type.startsWith('audio/') ? 'audio'
      : 'document'

    // BUG 4: Optimistic update — show immediately with local URL
    const localUrl = URL.createObjectURL(pendingFile)
    const tempId = `temp-file-${Date.now()}`
    const tempMsg: Message = {
      id: tempId,
      type: mediatype as MsgType,
      content: pendingFile.name,
      from: 'me',
      ts: new Date(),
      status: 'sent',
      media_url: localUrl,
      fileName: pendingFile.name,
      fileSize: `${(pendingFile.size / 1024).toFixed(1)} KB`,
    }
    setConversations(prev => prev.map(c =>
      c.id === activeId ? { ...c, messages: [...c.messages, tempMsg], lastMessage: `[${mediatype === 'image' ? 'Imagem' : mediatype === 'video' ? 'Vídeo' : mediatype === 'audio' ? 'Áudio' : 'Documento'}]`, lastTime: tempMsg.ts } : c
    ))

    try {
      // Compress images before upload
      const fileToSend = mediatype === 'image' ? await compressImage(pendingFile) : pendingFile
      const base64 = await toBase64(fileToSend)
      setUploadProgress(60)

      const res = await fetch('/api/evolution/send-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: instance,
          remoteJid: activeId,
          mediatype,
          mimetype: fileToSend.type || pendingFile.type,
          media: base64,
          fileName: pendingFile.name,
          caption: '',
        })
      })
      setUploadProgress(100)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Update status to delivered
      setConversations(prev => prev.map(c =>
        c.id === activeId ? { ...c, messages: c.messages.map(m => m.id === tempId ? { ...m, status: 'delivered' as const } : m) } : c
      ))
      setTimeout(() => { setPendingFile(null); setUploadProgress(0); URL.revokeObjectURL(localUrl) }, 800)
    } catch (err) {
      console.error('[sendPendingFile] error:', err)
      setSendError('Erro ao enviar arquivo.')
      // Remove optimistic message on error
      setConversations(prev => prev.map(c =>
        c.id === activeId ? { ...c, messages: c.messages.filter(m => m.id !== tempId) } : c
      ))
      URL.revokeObjectURL(localUrl)
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
    await supabase.from('whatsapp_conversations').update({ assigned_user_id: null, assigned_user_name: null })
      .eq('institution_id', user.institution_id).eq('remote_jid', activeId)
  }

  const handleAssignFromClosed = async () => {
    if (!activeId || !user?.institution_id || !transferTarget) return
    const targetUser = users.find(u => u.id === transferTarget)
    if (!targetUser) return
    await DatabaseService.assignConversation(user.institution_id, activeId, targetUser.id, targetUser.full_name)
    await DatabaseService.upsertConversationStatus(user.institution_id, activeId, 'open')
    await DatabaseService.logConversationEvent({
      institution_id: user.institution_id,
      remote_jid: activeId,
      event_type: 'assignment',
      description: `Atribuído para ${targetUser.full_name}`,
      user_id: user.id,
      user_name: user.full_name || user.email,
    })
    setConversations(prev => prev.map(c => c.id === activeId
      ? { ...c, assigned_user_id: targetUser.id, assigned_user_name: targetUser.full_name, status: 'open' as ConvStatus }
      : c
    ))
    setTransferring(false)
    setTransferTarget('')
  }

  const handleLeaveConversation = async () => {
    if (!activeId || !user?.institution_id) return
    setConversations(prev => prev.map(c => c.id === activeId
      ? { ...c, status: 'waiting' as ConvStatus, assigned_user_id: undefined, assigned_user_name: undefined }
      : c
    ))
    await DatabaseService.upsertConversationStatus(user.institution_id, activeId, 'waiting')
    await supabase.from('whatsapp_conversations').update({ assigned_user_id: null, assigned_user_name: null })
      .eq('institution_id', user.institution_id).eq('remote_jid', activeId)
    DatabaseService.logConversationEvent({
      institution_id: user.institution_id,
      remote_jid: activeId,
      event_type: 'transfer',
      description: `${user.full_name || user.email} saiu do atendimento`,
      user_id: user.id,
      user_name: user.full_name || user.email,
    }).catch(() => {})
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

  // Feature 5: Export contacts
  const exportContacts = () => {
    const data = filteredContacts
    if (data.length === 0) return
    const rows = data.map(c => ({
      Nome: c.name,
      Telefone: c.phone,
      Tipo: c.contact_type || '—',
      Atendente: c.assigned_user_name || '—',
      Status: safeStatusCfg(c.status).label,
      Etiquetas: (c.tags || []).join('; '),
    }))
    const header = Object.keys(rows[0]).join(',')
    const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'contatos-whatsapp.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
      const rows = lines.slice(1, 6).map(line => {
        const vals = line.split(',').map(v => v.replace(/"/g, '').trim())
        return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || '' }), {} as any)
      })
      setImportPreview(rows)
    }
    reader.readAsText(file, 'utf-8')
  }

  const confirmImport = async () => {
    if (!importFile || !user?.institution_id) return
    setImporting(true)
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const text = ev.target?.result as string
        const lines = text.split('\n').filter(l => l.trim())
        if (lines.length < 2) return
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
        const rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.replace(/"/g, '').trim())
          return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || '' }), {} as any)
        })
        for (const row of rows) {
          const phone = (row['Telefone'] || row['telefone'] || row['phone'] || '').replace(/\D/g, '')
          if (!phone) continue
          const normalized = phone.startsWith('55') ? phone : `55${phone}`
          const jid = `${normalized}@s.whatsapp.net`
          await DatabaseService.upsertConversationStatus(user.institution_id!, jid, 'waiting')
          if (row['Nome'] || row['nome'] || row['name']) {
            await supabase.from('whatsapp_conversations').update({ contact_name: row['Nome'] || row['nome'] || row['name'] })
              .eq('institution_id', user.institution_id).eq('remote_jid', jid)
          }
        }
        setShowImportModal(false)
        setImportFile(null)
        setImportPreview([])
        await loadMessages()
      }
      reader.readAsText(importFile, 'utf-8')
    } catch { } finally {
      setImporting(false)
    }
  }

  // Feature 5: Filtered contacts
  const allTags = Array.from(new Set(conversations.flatMap(c => c.tags || [])))
  const filteredContacts = conversations.filter(c => {
    if (c.isGroup) return false
    if (contactSearch && !c.name.toLowerCase().includes(contactSearch.toLowerCase()) && !c.phone.includes(contactSearch)) return false
    if (contactTypeFilter && c.contact_type !== contactTypeFilter) return false
    if (contactAttendantFilter && c.assigned_user_id !== contactAttendantFilter) return false
    if (contactStatusFilter && c.status !== contactStatusFilter) return false
    if (contactTagFilter && !(c.tags || []).includes(contactTagFilter)) return false
    return true
  })
  const activeContactFilters = [
    contactTypeFilter && { key: 'type', label: contactTypeFilter === 'lead' ? 'Nova Família' : contactTypeFilter === 'client' ? 'Cliente' : contactTypeFilter === 'supplier' ? 'Fornecedor' : 'Outro', clear: () => setContactTypeFilter('') },
    contactAttendantFilter && { key: 'att', label: users.find(u => u.id === contactAttendantFilter)?.full_name || '', clear: () => setContactAttendantFilter('') },
    contactStatusFilter && { key: 'status', label: safeStatusCfg(contactStatusFilter as ConvStatus).label, clear: () => setContactStatusFilter('') },
    contactTagFilter && { key: 'tag', label: contactTagFilter, clear: () => setContactTagFilter('') },
  ].filter(Boolean) as { key: string, label: string, clear: () => void }[]

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
      <div className="flex items-center justify-center bg-[#F8FAFB]" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#00A896] border-t-transparent" />
      </div>
    )
  }

  // ── Not connected ──
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center bg-[#F8FAFB]" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-white border border-[#E2E8F0] rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <MessageCircle className="w-10 h-10 text-[#94A3B8]" />
          </div>
          <h2 className="text-base font-bold text-[#1A2B4A] mb-2">WhatsApp não conectado</h2>
          <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
            Conecte seu WhatsApp nas Configurações para começar a atender.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#00A896] text-white text-sm font-semibold rounded-lg hover:bg-[#008f81] transition-all mx-auto"
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
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl border border-[#E2E8F0]">
            <h3 className="text-sm font-bold text-[#1A2B4A] mb-4">Nova Conversa</h3>
            <input
              autoFocus
              type="tel"
              value={newConvPhone}
              onChange={e => setNewConvPhone(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNewConv() }}
              placeholder="+55 (00) 00000-0000"
              className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowNewConvModal(false); setNewConvPhone('') }}
                className="flex-1 py-2.5 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFB]">
                Cancelar
              </button>
              <button onClick={handleNewConv} disabled={!newConvPhone.trim()}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#00A896] rounded-lg hover:bg-[#008f81] disabled:opacity-40">
                Iniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Modal */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl border border-[#E2E8F0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1A2B4A]">Criar Lead</h3>
              <button onClick={() => setShowLeadModal(false)} className="p-1 text-[#64748B] hover:text-[#1A2B4A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Nome do Responsável *</label>
                <input value={leadForm.responsible_name} onChange={e => setLeadForm(f => ({...f, responsible_name: e.target.value}))}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-1 focus:ring-[#00A896] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Nome do Aluno</label>
                <input value={leadForm.student_name} onChange={e => setLeadForm(f => ({...f, student_name: e.target.value}))}
                  placeholder="Nome do aluno"
                  className="w-full px-3 py-2 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-1 focus:ring-[#00A896] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Telefone</label>
                <input value={leadForm.phone} onChange={e => setLeadForm(f => ({...f, phone: e.target.value}))}
                  placeholder="+55 00 00000-0000"
                  className="w-full px-3 py-2 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-1 focus:ring-[#00A896] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">E-mail</label>
                <input type="email" value={leadForm.email} onChange={e => setLeadForm(f => ({...f, email: e.target.value}))}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-1 focus:ring-[#00A896] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Série de Interesse</label>
                <select value={leadForm.grade_interest} onChange={e => setLeadForm(f => ({...f, grade_interest: e.target.value}))}
                  className="w-full px-3 py-2 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-1 focus:ring-[#00A896] outline-none">
                  <option value="">Selecionar...</option>
                  {['Educação Infantil','1º Ano','2º Ano','3º Ano','4º Ano','5º Ano','6º Ano','7º Ano','8º Ano','9º Ano','1º EM','2º EM','3º EM'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowLeadModal(false)}
                className="flex-1 py-2.5 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFB]">
                Cancelar
              </button>
              <button onClick={handleCreateLead} disabled={!leadForm.responsible_name.trim()}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#00A896] rounded-lg hover:bg-[#008f81] disabled:opacity-40">
                Criar Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Modal (placeholder) */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1A2B4A]">Marcar como Cliente</h3>
              <button onClick={() => setShowClientModal(false)} className="p-1 text-[#64748B] hover:text-[#1A2B4A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#64748B] mb-4">
              Este contato será marcado como cliente existente.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowClientModal(false)}
                className="flex-1 py-2.5 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFB]">
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
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#00A896] rounded-lg hover:bg-[#008f81]">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col overflow-hidden bg-[#F8FAFB]" style={{ height: 'calc(100vh - 56px)' }}>

        {/* Feature 1: Connection warning banner */}
        {connectionStatus === 'disconnected' && (
          <div className="flex-shrink-0 flex items-center gap-3 mx-4 my-2 px-4 py-2.5 rounded-lg" style={{ background: '#FEF3C7', border: '1px solid #F59E0B' }}>
            <span className="text-base">⚠️</span>
            <span className="text-sm text-[#92400E] flex-1">Conexão com WhatsApp instável ou desconectada. Verifique em Configurações → WhatsApp.</span>
            <button onClick={() => navigate('/settings?tab=whatsapp')} className="text-xs font-semibold text-[#D97706] hover:text-[#B45309] underline whitespace-nowrap flex-shrink-0">
              Ir para Configurações
            </button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">

        {/* Hidden file input for attachments */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xlsx,.xls"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* ── Col 1: Conversation List ──────────────────────────────────────────── */}
        <div className="w-[320px] flex-shrink-0 flex flex-col bg-white border-r border-[#E2E8F0]">

          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#00A896]" />
              <span className="text-base font-bold text-[#1A2B4A]">WhatsApp</span>
              {totalUnread > 0 && (
                <span className="bg-[#00A896] text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {totalUnread}
                </span>
              )}
            </div>
            <button
              className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#1A2B4A] transition-colors"
              title="Nova conversa"
              onClick={() => setShowNewConvModal(true)}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 flex-shrink-0 bg-white border-b border-[#E2E8F0]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar nome ou número..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#F1F5F9] rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00A896] border-0"
              />
            </div>
          </div>

          {/* Main view tabs: Conversas | Contatos */}
          <div className="flex-shrink-0 flex border-b border-[#E2E8F0] bg-white">
            {([
              { key: 'conversations', label: 'Conversas' },
              { key: 'contacts',      label: 'Contatos'  },
            ] as { key: MainView; label: string }[]).map(t => (
              <button key={t.key} onClick={() => setMainView(t.key)}
                className={`flex-1 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  mainView === t.key
                    ? 'border-[#00A896] text-[#1A2B4A] font-semibold'
                    : 'border-transparent text-[#64748B] hover:text-[#1A2B4A]'
                }`}
              >{t.label}</button>
            ))}
          </div>

          {/* Owner filter pills */}
          <div className="px-3 pt-2 pb-1 flex gap-1 flex-shrink-0 bg-white">
            {[
              { key: 'all',        label: 'Todos' },
              { key: 'mine',       label: 'Meus' },
              { key: 'unassigned', label: 'Sem atendente' },
            ].map(o => (
              <button key={o.key} onClick={() => setConvOwnerFilter(o.key as ConvOwnerFilter)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  convOwnerFilter === o.key ? 'bg-[#1A2B4A] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
                }`}>{o.label}</button>
            ))}
          </div>

          {/* Filter pills */}
          <div className="px-3 pb-2 flex-shrink-0 flex gap-1 overflow-x-auto scrollbar-hide bg-white border-b border-[#E2E8F0]">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as ConvFilter)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === f.key
                    ? FILTER_ACTIVE[f.key] || 'bg-[#1A2B4A] text-white'
                    : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
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
                <p className="text-xs text-[#64748B]">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              filteredConvs.map(conv => {
                const isActive = conv.id === activeId
                const statusDot = safeStatusCfg(conv.status).dot
                const preview = getLastMsgPreview(conv.lastMessage)
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveId(conv.id)}
                    className={`group relative w-full text-left flex items-center gap-3 transition-all duration-150 border-b border-[#E2E8F0] border-l-[3px] py-3 pr-3 ${
                      isActive
                        ? 'bg-[#E6F7F5] border-l-[#00A896] pl-[9px]'
                        : 'border-l-transparent pl-3 hover:bg-[#F8FAFB]'
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
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#00A896] text-white rounded-full flex items-center justify-center text-[8px] font-bold border border-white">
                          {getInitials(conv.assigned_user_name)}
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-sm font-semibold text-[#1A2B4A] truncate">{conv.name}</span>
                        <span className="text-[11px] text-[#94A3B8] flex-shrink-0 group-hover:hidden">{fmtConvTime(conv.lastTime)}</span>
                        {/* Hover actions */}
                        <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
                          {conv.unreadCount > 0 && (
                            <button
                              onClick={async e => {
                                e.stopPropagation()
                                setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c))
                                if (user?.institution_id) await DatabaseService.resetConversationUnread(user.institution_id, conv.id).catch(() => {})
                              }}
                              title="Marcar como lida"
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-[#E2E8F0] hover:border-[#00A896] hover:text-[#00A896] text-[#64748B] transition-colors shadow-sm"
                            >
                              <CheckCheck className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={async e => {
                              e.stopPropagation()
                              if (!user?.institution_id) return
                              await DatabaseService.closeConversation(user.institution_id, conv.id)
                              setConversations(prev => prev.map(c => c.id === conv.id
                                ? { ...c, status: 'closed' as ConvStatus, assigned_user_id: undefined, assigned_user_name: undefined }
                                : c
                              ))
                            }}
                            title="Concluir conversa"
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-[#E2E8F0] hover:border-red-300 hover:text-red-500 text-[#64748B] transition-colors shadow-sm"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] text-[#64748B] truncate flex items-center gap-1">
                          {preview.icon && <span className="flex-shrink-0 text-[12px]">{preview.icon}</span>}
                          {preview.text}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="flex-shrink-0 bg-[#00A896] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${safeStatusCfg(conv.status).badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                          {safeStatusCfg(conv.status).label}
                        </span>
                        {conv.isGroup && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-[#EDE9FE] text-[#7C3AED]">
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
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#F8FAFB]">

          {/* ── Contacts table view ── */}
          {mainView === 'contacts' && (
            <div className="flex-1 overflow-y-auto bg-[#F8FAFB] p-6">
              <h2 className="text-sm font-bold text-[#1A2B4A] mb-4">Contatos</h2>

              {/* Feature 5: Filter bar */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <input value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                    placeholder="Buscar por nome ou número..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00A896]" />
                </div>
                {/* Type filter */}
                <select value={contactTypeFilter} onChange={e => setContactTypeFilter(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-lg text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#00A896]">
                  <option value="">Tipo</option>
                  <option value="lead">Nova Família</option>
                  <option value="client">Cliente</option>
                  <option value="supplier">Fornecedor</option>
                  <option value="other">Outro</option>
                </select>
                {/* Attendant filter */}
                <select value={contactAttendantFilter} onChange={e => setContactAttendantFilter(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-lg text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#00A896]">
                  <option value="">Atendente</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
                {/* Status filter */}
                <select value={contactStatusFilter} onChange={e => setContactStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-lg text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#00A896]">
                  <option value="">Status</option>
                  <option value="waiting">Aguardando</option>
                  <option value="open">Em Atendimento</option>
                  <option value="closed">Concluído</option>
                </select>
                {/* Tag filter */}
                {allTags.length > 0 && (
                  <select value={contactTagFilter} onChange={e => setContactTagFilter(e.target.value)}
                    className="px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-lg text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#00A896]">
                    <option value="">Etiqueta</option>
                    {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => setShowImportModal(true)}
                    className="px-3 py-2 text-sm border border-[#E2E8F0] text-[#64748B] rounded-lg hover:bg-[#F8FAFB] hover:border-[#00A896] hover:text-[#00A896] transition-colors flex items-center gap-1.5">
                    ↑ Importar
                  </button>
                  <button onClick={exportContacts}
                    className="px-3 py-2 text-sm border border-[#E2E8F0] text-[#64748B] rounded-lg hover:bg-[#F8FAFB] hover:border-[#00A896] hover:text-[#00A896] transition-colors flex items-center gap-1.5">
                    ↓ Exportar
                  </button>
                </div>
              </div>

              {/* Active filter pills */}
              {activeContactFilters.length > 0 && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-xs text-[#94A3B8]">Filtros:</span>
                  {activeContactFilters.map(f => (
                    <span key={f.key} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#E6F7F5] text-[#00A896] font-medium">
                      {f.label}
                      <button onClick={f.clear} className="hover:opacity-70">×</button>
                    </span>
                  ))}
                  <button onClick={() => { setContactTypeFilter(''); setContactAttendantFilter(''); setContactStatusFilter(''); setContactTagFilter(''); setContactSearch('') }}
                    className="text-xs text-[#64748B] hover:text-[#1A2B4A] underline">
                    Limpar filtros
                  </button>
                </div>
              )}

              <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFB]">
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Nome</th>
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Telefone</th>
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Tipo</th>
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Atendente</th>
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Etiquetas</th>
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Última msg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map(c => (
                      <tr key={c.id}
                        onClick={() => { setActiveId(c.id); setShowDrawer(true) }}
                        className="border-b border-[#E2E8F0] hover:bg-[#F8FAFB] cursor-pointer transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full ${c.avatarColor} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                              {c.profile_picture_url
                                ? <img src={c.profile_picture_url} alt={c.name} className="w-full h-full object-cover" />
                                : c.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-[#1A2B4A] truncate max-w-[120px]">{c.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-[#64748B]">{c.phone}</td>
                        <td className="py-2.5 px-4">
                          {c.contact_type
                            ? <span className="px-2 py-0.5 rounded-full bg-[#E6F7F5] text-[#00A896] font-medium">{c.contact_type}</span>
                            : <span className="text-[#94A3B8]">—</span>}
                        </td>
                        <td className="py-2.5 px-4 text-[#64748B]">{c.assigned_user_name || <span className="text-[#94A3B8]">—</span>}</td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(c.tags || []).slice(0, 3).map(tag => (
                              <span key={tag} className={`px-1.5 py-0.5 rounded-full text-white text-[11px] font-medium ${tagColor(tag)}`}>{tag}</span>
                            ))}
                            {(c.tags || []).length > 3 && <span className="text-[#64748B]">+{(c.tags || []).length - 3}</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-[#64748B]">{fmtConvTime(c.lastTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredContacts.length === 0 && (
                  <p className="text-xs text-[#64748B] text-center py-12">Nenhum contato encontrado</p>
                )}
              </div>
            </div>
          )}

          {/* Chat + composer — hidden in contacts view */}
          {mainView !== 'contacts' && activeConv && (
            <div className="flex-shrink-0 relative bg-white border-b border-[#E2E8F0]" style={{ minHeight: '64px' }}>
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3 h-16">
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
                  <p className="text-sm font-bold text-[#1A2B4A]">{activeConv.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-[#64748B]">
                      {activeConv.isGroup ? 'Grupo WhatsApp' : activeConv.phone}
                      {activeConv.online && <span className="ml-1.5 text-[#00A896] font-medium">• online</span>}
                    </p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${safeStatusCfg(activeConv.status).badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${safeStatusCfg(activeConv.status).dot}`} />
                      {safeStatusCfg(activeConv.status).label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setShowMsgSearch(v => !v); if (showMsgSearch) setMsgSearchText('') }}
                    title="Buscar mensagens"
                    className={`p-2 rounded-lg transition-colors ${showMsgSearch ? 'bg-[#E6F7F5] text-[#00A896]' : 'hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#1A2B4A]'}`}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowContactInfo(v => !v)}
                    title="Informações do contato"
                    className={`p-2 rounded-lg transition-colors ${showContactInfo ? 'bg-[#E6F7F5] text-[#00A896]' : 'hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#1A2B4A]'}`}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowMoreMenu(v => !v)}
                    title="Mais opções"
                    className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#1A2B4A] transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message search bar */}
              {showMsgSearch && (
                <div className="flex-shrink-0 px-4 py-2 bg-white border-t border-[#E2E8F0] flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0" />
                  <input autoFocus value={msgSearchText} onChange={e => setMsgSearchText(e.target.value)}
                    placeholder="Buscar nas mensagens..."
                    className="flex-1 text-sm bg-transparent outline-none text-[#1A2B4A] placeholder-[#94A3B8]"
                  />
                  <button onClick={() => { setShowMsgSearch(false); setMsgSearchText('') }}
                    className="text-[#64748B] hover:text-[#1A2B4A]"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {/* More menu dropdown */}
              {showMoreMenu && (
                <div ref={moreMenuRef} className="absolute right-4 top-14 z-30 bg-white rounded-xl shadow-lg border border-[#E2E8F0] py-1 min-w-[160px]">
                  <button onClick={() => { setConversations(prev => prev.map(c => c.id === activeId ? {...c, messages: []} : c)); setShowMoreMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-[#1A2B4A] hover:bg-[#F8FAFB] transition-colors">
                    Limpar conversa
                  </button>
                  <button onClick={() => { setShowMoreMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-[#1A2B4A] hover:bg-[#F8FAFB] transition-colors">
                    Bloquear contato
                  </button>
                  {activeConv?.lead_id && (
                    <button onClick={() => { navigate(`/leads?highlight=${activeConv.lead_id}`); setShowMoreMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-[#1A2B4A] hover:bg-[#F8FAFB] transition-colors">
                      Ver perfil no CRM
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages area + Composer — hidden in contacts view */}
          {mainView !== 'contacts' && <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
            {!activeConv && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-white border border-[#E2E8F0] rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <MessageCircle className="w-8 h-8 text-[#94A3B8] animate-pulse" />
                </div>
                <p className="text-sm font-semibold text-[#1A2B4A] mb-1">Aguardando mensagens</p>
                <p className="text-sm text-[#64748B] leading-relaxed max-w-xs">
                  Seu WhatsApp está conectado. As conversas aparecerão aqui assim que chegarem novas mensagens.
                </p>
              </div>
            )}
            {!activeConv && conversations.length > 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="w-10 h-10 text-[#94A3B8] mb-3" />
                <p className="text-sm text-[#64748B]">Selecione uma conversa</p>
              </div>
            )}
            {msgGroups.map((group, gi) => (
              <div key={gi}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-[#64748B] bg-[#E2E8F0] px-3 py-1 rounded-full shadow-sm">
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
                <MessageCircle className="w-10 h-10 text-[#94A3B8] mb-3" />
                <p className="text-sm text-[#64748B]">Nenhuma mensagem ainda</p>
                <p className="text-xs text-[#94A3B8] mt-1">Envie a primeira mensagem abaixo</p>
              </div>
            )}
            {/* Typing indicator */}
            {activeId && typingConvIds.has(activeId) && (
              <div className="flex justify-start mb-1">
                <div className="bg-white border border-[#E2E8F0] rounded-xl rounded-tl-none px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="flex-shrink-0 bg-white border-t border-[#E2E8F0] px-4 py-3">

            {/* Quick replies panel */}
            {showQuickReplies && (
              <div className="mb-2 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#64748B]">Respostas rápidas</span>
                  <button onClick={() => setShowQuickReplies(false)} className="p-0.5 text-[#64748B] hover:text-[#1A2B4A]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_REPLIES.map(qr => (
                    <button
                      key={qr.id}
                      onClick={() => { setInputText(qr.text); setShowQuickReplies(false) }}
                      className="text-left px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg hover:border-[#00A896] hover:bg-[#E6F7F5] transition-all"
                    >
                      <p className="text-xs font-semibold text-[#1A2B4A]">{qr.label}</p>
                      <p className="text-xs text-[#64748B] truncate mt-0.5">{qr.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Attachment menu */}
            {showAttach && (
              <div className="mb-2 flex gap-2 flex-wrap">
                {[
                  { icon: Image,    label: 'Imagem',    color: 'bg-[#EDE9FE] text-[#7C3AED]' },
                  { icon: Video,    label: 'Vídeo',     color: 'bg-[#DBEAFE] text-[#2563EB]' },
                  { icon: FileText, label: 'Documento', color: 'bg-[#FEF3C7] text-[#D97706]' },
                  { icon: Mic,      label: 'Áudio',     color: 'bg-[#D1FAE5] text-[#059669]' },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => { fileInputRef.current?.click(); setShowAttach(false) }}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${item.color} text-xs font-medium hover:opacity-80 transition-opacity`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {/* File preview area */}
            {pendingFile && (
              <div className="mb-2 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0] p-2 flex items-center gap-2">
                {pendingFile.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(pendingFile)} alt="preview" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-[#64748B]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#1A2B4A] truncate">{pendingFile.name}</p>
                  <p className="text-xs text-[#64748B]">{(pendingFile.size / 1024).toFixed(1)} KB</p>
                  {uploadProgress > 0 && (
                    <div className="mt-1 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#00A896] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={sendPendingFile} className="p-1.5 bg-[#00A896] text-white rounded-lg hover:bg-[#008f81]">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setPendingFile(null)} className="p-1.5 text-[#64748B] hover:text-[#1A2B4A]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div className="mb-2 bg-white rounded-xl border border-[#E2E8F0] p-2 shadow-lg">
                <div className="grid grid-cols-10 gap-1">
                  {COMMON_EMOJIS.map(e => (
                    <button key={e} onClick={() => { setInputText(t => t + e); setShowEmojiPicker(false) }}
                      className="w-7 h-7 text-base hover:bg-[#F1F5F9] rounded flex items-center justify-center transition-colors">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input row */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowAttach(v => !v); setShowQuickReplies(false) }}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${showAttach ? 'bg-[#E6F7F5] text-[#00A896]' : 'text-[#64748B] hover:text-[#00A896] hover:bg-[#F1F5F9]'}`}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setShowQuickReplies(v => !v); setShowAttach(false) }}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${showQuickReplies ? 'bg-[#E6F7F5] text-[#00A896]' : 'text-[#64748B] hover:text-[#00A896] hover:bg-[#F1F5F9]'}`}
                title="Respostas rápidas"
              >
                <Zap className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setShowEmojiPicker(v => !v); setShowAttach(false); setShowQuickReplies(false) }}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${showEmojiPicker ? 'bg-[#E6F7F5] text-[#00A896]' : 'text-[#64748B] hover:text-[#00A896] hover:bg-[#F1F5F9]'}`}
              >
                <Smile className="w-5 h-5" />
              </button>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Digite uma mensagem..."
                rows={1}
                className="flex-1 px-4 py-2.5 text-sm bg-[#F1F5F9] rounded-3xl text-[#1A2B4A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00A896] resize-none transition-all"
                style={{ minHeight: '40px', maxHeight: '96px' }}
              />
              {inputText.trim() ? (
                <button
                  onClick={handleSend}
                  className="w-10 h-10 rounded-full bg-[#00A896] text-white hover:bg-[#008f81] transition-colors flex-shrink-0 flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className={`w-10 h-10 rounded-full transition-colors flex-shrink-0 flex items-center justify-center ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#00A896] text-white hover:bg-[#008f81]'}`}
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
        {showContactInfo && (
          <div className="w-[280px] flex-shrink-0 bg-white border-l border-[#E2E8F0] flex flex-col overflow-hidden">
            {activeConv ? (
            <>
            {/* Tab bar */}
            <div className="flex-shrink-0 flex bg-white border-b border-[#E2E8F0]">
              {([
                { key: 'details', label: 'Detalhes' },
                { key: 'history', label: 'Histórico' },
              ] as { key: RightPanelTab; label: string }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setRightPanelTab(tab.key)}
                  className={`flex-1 py-3 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                    rightPanelTab === tab.key
                      ? 'border-[#00A896] text-[#1A2B4A]'
                      : 'border-transparent text-[#64748B] hover:text-[#1A2B4A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Detalhes tab ── */}
            {rightPanelTab === 'details' && (
              <div className="flex-1 overflow-y-auto">

                {/* Concluir / Sair buttons */}
                {activeConv.status !== 'closed' && (
                  <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFB] flex flex-col gap-2">
                    <button onClick={handleCloseConversation}
                      className="w-full py-2 text-xs font-semibold text-white bg-[#00A896] hover:bg-[#008f81] rounded-lg transition-colors">
                      ✅ Concluir Atendimento
                    </button>
                    {activeConv.assigned_user_id && (
                      <button onClick={handleLeaveConversation}
                        className="w-full py-2 text-xs font-medium text-[#64748B] bg-white hover:bg-[#F8FAFB] rounded-lg border border-[#E2E8F0] transition-colors">
                        🚪 Sair do Atendimento
                      </button>
                    )}
                  </div>
                )}

                {/* Contact header */}
                <div className="flex flex-col items-center px-4 pt-5 pb-4 border-b border-[#E2E8F0] bg-white">
                  <div className={`w-[72px] h-[72px] rounded-full ${activeConv.avatarColor} text-white text-2xl font-bold flex items-center justify-center mb-3 overflow-hidden`}>
                    {activeConv.profile_picture_url ? (
                      <img src={activeConv.profile_picture_url} alt={activeConv.name} className="w-full h-full object-cover" />
                    ) : activeConv.isGroup ? (
                      <Users className="w-8 h-8 text-white/90" />
                    ) : (
                      getInitials(activeConv.name)
                    )}
                  </div>
                  <p className="text-[18px] font-bold text-[#1A2B4A] text-center">{activeConv.name}</p>
                  <p className="text-[13px] text-[#64748B] mt-0.5 text-center">
                    {activeConv.isGroup ? 'Grupo WhatsApp' : activeConv.phone}
                  </p>
                  {activeConv.contact_type && activeConv.contact_type !== 'unknown' && (
                    <span className={`mt-2 text-xs px-3 py-1 rounded-full font-medium ${
                      activeConv.contact_type === 'lead'     ? 'bg-[#E6F7F5] text-[#00A896]' :
                      activeConv.contact_type === 'client'   ? 'bg-[#D1FAE5] text-[#059669]' :
                      activeConv.contact_type === 'supplier' ? 'bg-[#EDE9FE] text-[#7C3AED]' :
                      'bg-[#F1F5F9] text-[#64748B]'
                    }`}>
                      {activeConv.contact_type === 'lead' ? 'Lead' :
                       activeConv.contact_type === 'client' ? 'Cliente' :
                       activeConv.contact_type === 'supplier' ? 'Fornecedor' : activeConv.contact_type}
                    </span>
                  )}
                  {activeConv.isGroup && (
                    <span className="mt-2 text-xs px-3 py-1 rounded-full font-medium bg-[#EDE9FE] text-[#7C3AED]">Grupo</span>
                  )}
                  {activeConv.labels.map(lb => (
                    <span key={lb.text} className={`mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${lb.color}`}>
                      {lb.text}
                    </span>
                  ))}
                  {!activeConv.isGroup && (
                    <button
                      onClick={() => { setShowDrawer(true) }}
                      className="mt-2 text-xs border border-[#00A896] text-[#00A896] hover:bg-[#E6F7F5] px-3 py-1 rounded-lg flex items-center gap-1 font-medium transition-colors"
                    >
                      ✏️ Editar
                    </button>
                  )}
                </div>

                {/* Inline edit form */}
                {editingContact && (
                  <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFB]">
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-[#64748B] mb-1">Nome</label>
                        <input value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))}
                          className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F0] rounded-lg text-[#1A2B4A] focus:ring-1 focus:ring-[#00A896] outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#64748B] mb-1">Tipo</label>
                        <select value={editForm.contact_type} onChange={e => setEditForm(f => ({...f, contact_type: e.target.value}))}
                          className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F0] rounded-lg text-[#1A2B4A] focus:ring-1 focus:ring-[#00A896] outline-none">
                          <option value="">Desconhecido</option>
                          <option value="lead">Lead</option>
                          <option value="client">Cliente</option>
                          <option value="supplier">Fornecedor</option>
                          <option value="other">Outro</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-3">
                      <button onClick={async () => {
                        if (!activeId || !user?.institution_id) return
                        if (editForm.name && editForm.name !== activeConv.name) {
                          setConversations(prev => prev.map(c => c.id === activeId ? {...c, name: editForm.name} : c))
                          await supabase.from('whatsapp_conversations').update({ contact_name: editForm.name })
                            .eq('institution_id', user.institution_id).eq('remote_jid', activeId)
                        }
                        if (editForm.contact_type && editForm.contact_type !== (activeConv.contact_type || '')) {
                          await DatabaseService.setConversationContactType(user.institution_id, activeId, editForm.contact_type)
                          setConversations(prev => prev.map(c => c.id === activeId ? {...c, contact_type: editForm.contact_type} : c))
                        }
                        setEditingContact(false)
                      }}
                        className="flex-1 py-1.5 text-xs font-semibold text-white bg-[#00A896] rounded-lg hover:bg-[#008f81] transition-colors">
                        Salvar
                      </button>
                      <button onClick={() => setEditingContact(false)}
                        className="px-3 py-1.5 text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-white">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Who is this contact? — only for unknown non-group, non-linked contacts */}
                {!activeConv.isGroup && (!activeConv.contact_type || activeConv.contact_type === 'unknown') && !activeConv.lead_id && (
                  <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#FFFBEB]">
                    <p className="text-xs font-semibold text-[#D97706] mb-2">Quem é esse contato?</p>
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => {
                        setLeadForm(prev => ({
                          ...prev,
                          responsible_name: activeConv.name !== formatPhone(activeConv.id) ? activeConv.name : '',
                          phone: activeConv.phone,
                        }))
                        setShowLeadModal(true)
                      }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold bg-[#00A896] text-white rounded-lg hover:bg-[#008f81] transition-colors">
                        🎓 Nova Família (Lead)
                      </button>
                      <button onClick={() => setShowClientModal(true)}
                        className="w-full text-left px-3 py-2 text-xs font-medium bg-white text-[#1A2B4A] rounded-lg hover:bg-[#F8FAFB] transition-colors border border-[#E2E8F0]">
                        ✅ Família da Casa (Cliente)
                      </button>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleContactType('supplier')}
                          className="flex-1 text-xs px-2 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
                          🏢 Fornecedor
                        </button>
                        <button onClick={() => handleContactType('other')}
                          className="flex-1 text-xs px-2 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
                          Outro
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status select */}
                <div className="px-4 py-3 border-b border-[#E2E8F0]">
                  <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">
                    Status do atendimento
                  </label>
                  <select
                    value={activeConv.status}
                    onChange={e => handleStatusChange(e.target.value as ConvStatus)}
                    className="w-full px-3 py-2 text-xs bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-1 focus:ring-[#00A896] outline-none"
                  >
                    <option value="waiting">Aguardando</option>
                    <option value="open">Em Atendimento</option>
                    <option value="closed">Concluído</option>
                  </select>
                </div>

                {/* Attendant section */}
                <div className="px-4 py-3 border-b border-[#E2E8F0]">
                  <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">
                    Atendente
                  </label>
                  {transferring ? (
                    <div className="space-y-2">
                      <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-1 focus:ring-[#00A896] outline-none">
                        <option value="">Selecionar atendente...</option>
                        {users.filter(u => u.id !== activeConv.assigned_user_id).map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                      <div className="flex gap-1.5">
                        <button
                          onClick={activeConv.status === 'closed' ? handleAssignFromClosed : handleTransfer}
                          disabled={!transferTarget}
                          className="flex-1 px-2.5 py-1.5 bg-[#00A896] text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-[#008f81] transition-colors">
                          {activeConv.status === 'closed' ? 'Atribuir' : 'Transferir'}
                        </button>
                        <button onClick={() => { setTransferring(false); setTransferTarget('') }}
                          className="px-2.5 py-1.5 text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFB]">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : activeConv.status === 'closed' ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#94A3B8]">—</span>
                      <button onClick={() => setTransferring(true)}
                        className="text-xs border border-[#00A896] text-[#00A896] hover:bg-[#E6F7F5] px-2 py-0.5 rounded-lg font-medium transition-colors">
                        Atribuir
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#1A2B4A] font-medium">
                        {activeConv.assigned_user_name || <span className="text-[#94A3B8] italic font-normal">Sem atendente</span>}
                      </span>
                      <button onClick={() => setTransferring(true)}
                        className="text-xs text-[#00A896] hover:text-[#008f81] font-medium transition-colors">
                        Transferir
                      </button>
                    </div>
                  )}
                </div>

                {/* Etiquetas */}
                <div className="px-4 py-3 border-b border-[#E2E8F0]">
                  <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">
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
                        className="text-xs px-2 py-0.5 rounded-full border border-dashed border-[#E2E8F0] bg-transparent text-[#1A2B4A] outline-none focus:border-[#00A896] w-28"
                        maxLength={20}
                      />
                    ) : (
                      <button onClick={() => setAddingTag(true)}
                        className="text-xs px-2 py-0.5 rounded-full border border-dashed border-[#E2E8F0] text-[#00A896] hover:border-[#00A896] hover:bg-[#E6F7F5] transition-colors">
                        + Etiqueta
                      </button>
                    )}
                  </div>
                </div>

                {/* Lead linking — only for individual contacts */}
                {!activeConv.isGroup && (
                  <div className="px-4 py-3 border-b border-[#E2E8F0]">
                    {activeConv.lead_id ? (
                      <button
                        onClick={() => navigate(`/leads?highlight=${activeConv.lead_id}`)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#00A896] text-white text-xs font-semibold rounded-lg hover:bg-[#008f81] transition-colors"
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
                          className="w-full px-3 py-2 text-xs bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-1 focus:ring-[#00A896] outline-none"
                        />
                        {leadResults.map(l => (
                          <button key={l.id} onClick={() => handleLinkLead(l.id)}
                            className="w-full text-left px-2.5 py-2 text-xs bg-[#F8FAFB] hover:bg-[#E6F7F5] border border-[#E2E8F0] rounded-lg transition-colors">
                            <p className="font-semibold text-[#1A2B4A]">{l.responsible_name}</p>
                            <p className="text-[#64748B]">{l.student_name} · {l.grade_interest}</p>
                          </button>
                        ))}
                        <button onClick={() => { setLinkingLead(false); setLeadSearch(''); setLeadResults([]) }}
                          className="w-full text-xs text-[#64748B] hover:text-[#1A2B4A] py-1">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setLinkingLead(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-[#E2E8F0] text-[#64748B] text-xs font-medium rounded-lg hover:border-[#00A896] hover:text-[#00A896] hover:bg-[#E6F7F5] transition-colors">
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
                    className="w-full flex items-center justify-between text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide hover:text-[#64748B] transition-colors"
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
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-[#F8FAFB] transition-colors cursor-pointer">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${ev.color}`} />
                          <div>
                            <p className="text-xs font-medium text-[#1A2B4A]">{ev.action}</p>
                            <p className="text-xs text-[#64748B]">{ev.time}</p>
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
              <div className="flex-1 overflow-y-auto px-4 py-3 bg-white">
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">Histórico de eventos</p>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#00A896] border-t-transparent" />
                  </div>
                ) : convHistory.length === 0 ? (
                  <p className="text-xs text-[#64748B] text-center py-8">Nenhum evento registrado</p>
                ) : (
                  <div className="space-y-3">
                    {convHistory.map(ev => (
                      <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-[#F8FAFB] transition-colors">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${eventDotColor(ev.event_type)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#1A2B4A] leading-snug">{ev.description || ev.event_type}</p>
                          {ev.user_name && (
                            <p className="text-xs text-[#64748B] mt-0.5">{ev.user_name}</p>
                          )}
                          <p className="text-xs text-[#94A3B8] mt-0.5">
                            {new Date(ev.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div style={{ fontSize: 40 }}>💬</div>
                <p style={{ color: '#64748B', marginTop: 12, fontSize: 14 }}>
                  Selecione uma conversa para ver os detalhes do contato
                </p>
              </div>
            )}
          </div>
        )}

        {/* Send error toast */}
        {sendError && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="bg-white border border-red-200 text-red-600 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg">
              {sendError}
            </div>
          </div>
        )}
        </div>{/* end flex flex-1 overflow-hidden (3-column row) */}
      </div>{/* end main outer container */}

      {/* Feature 4: ContactDrawer */}
      <ContactDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        conversation={activeConv}
        allConversations={conversations}
        institutionId={user?.institution_id || ''}
        onUpdate={(jid: string, updates: Partial<Conversation>) => setConversations(prev => prev.map(c => c.id === jid ? {...c, ...updates} : c))}
      />

      {/* Feature 5: Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-[500px] shadow-2xl border border-[#E2E8F0] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1A2B4A]">Importar Contatos (CSV)</h3>
              <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]) }}
                className="p-1 text-[#64748B] hover:text-[#1A2B4A]"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-[#64748B] mb-4">
              O arquivo CSV deve conter ao menos a coluna <strong>Telefone</strong>. Colunas opcionais: Nome, Tipo.
            </p>
            <input type="file" accept=".csv,.txt" onChange={handleImportFile}
              className="w-full text-sm text-[#64748B] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#E6F7F5] file:text-[#00A896] file:font-medium hover:file:bg-[#00A896] hover:file:text-white file:transition-colors cursor-pointer mb-4" />
            {importPreview.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">Prévia (primeiras 5 linhas)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0]">
                        {Object.keys(importPreview[0]).map(h => (
                          <th key={h} className="text-left py-1.5 pr-3 text-[#94A3B8] font-semibold uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row, i) => (
                        <tr key={i} className="border-b border-[#E2E8F0]/50">
                          {Object.values(row).map((v: any, j) => (
                            <td key={j} className="py-1.5 pr-3 text-[#1A2B4A]">{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]) }}
                className="flex-1 py-2.5 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFB]">
                Cancelar
              </button>
              <button onClick={confirmImport} disabled={!importFile || importing}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#00A896] rounded-lg hover:bg-[#008f81] disabled:opacity-40">
                {importing ? 'Importando...' : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
