import React, { useState, useRef, useEffect } from 'react'
import ContactCard from '../contacts/ContactCard'
import {
  MessageCircle, Search, Plus, Info, Paperclip, Mic, Smile, Send,
  Play, Pause, FileText, Image, Video, ChevronDown, ChevronRight,
  CheckCheck, Check, Zap, Settings, User, Users,
  X, MoreVertical
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, WhatsappMessage, WhatsappConversation, WhatsappConversationEvent, User as UserType, supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type MsgType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker'
type ConvStatus = 'waiting' | 'open' | 'closed'
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

const AVATAR_BG_COLORS = [
  'linear-gradient(135deg, #00A896, #0DD3BF)',
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #fd7b42, #fd5c63)',
  'linear-gradient(135deg, #1A2B4A, #2D4A7A)',
]
function getAvatarBgColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length]
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
    // Normaliza JIDs da Cloud API (número puro) para o formato padrão
    const normalizedJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
    const isGroup = normalizedJid.endsWith('@g.us')
    const convData = convMap?.get(normalizedJid) || convMap?.get(jid)

    let name: string
    if (isGroup) {
      name = jidMsgs.find(m => m.contact_name)?.contact_name || normalizedJid.replace(/@g\.us$/, '')
    } else {
      name = jidMsgs.find(m => !m.from_me && m.contact_name)?.contact_name
        || convData?.contact_name
        || formatPhone(normalizedJid)
    }

    return {
      id: normalizedJid,
      name,
      phone: isGroup ? normalizedJid.replace(/@g\.us$/, '') : formatPhone(normalizedJid),
      avatarColor: jidToColor(normalizedJid),
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
      messages: sorted
        .filter((m, idx, self) => idx === self.findIndex(t => (t.message_id && t.message_id === m.message_id) || t.id === m.id))
        .map(m => ({
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

// Compress images larger than 4MB before sending (uses FileReader data: URL — no blob: CSP issue)
async function compressImage(file: File, maxMB = 4): Promise<File> {
  if (file.size < maxMB * 1024 * 1024) return file
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      const img = document.createElement('img')
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
          resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file)
        }, 'image/jpeg', 0.85)
      }
      img.onerror = () => resolve(file)
      img.src = dataUrl
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
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

// ─── getMediaUrl ──────────────────────────────────────────────────────────────
function getMediaUrl(message: any, instanceName?: string): string | null {
  const raw =
    message.media_url ||
    message.mediaUrl ||
    message.url ||
    message.message?.imageMessage?.url ||
    message.message?.videoMessage?.url ||
    message.message?.audioMessage?.url ||
    message.message?.documentMessage?.url ||
    message.message?.stickerMessage?.url ||
    null
  if (!raw) return null
  if (raw.startsWith('data:') || raw.startsWith('/api/')) return raw
  const msgId = message.key?.id || message.message_id || message.id || ''
  const idParam = msgId ? `&messageId=${encodeURIComponent(msgId)}` : ''
  const instParam = instanceName ? `&instanceName=${encodeURIComponent(instanceName)}` : ''
  return `/api/evolution/media-proxy?url=${encodeURIComponent(raw)}${idParam}${instParam}`
}

// ─── RenderMessageContent ─────────────────────────────────────────────────────
function RenderMessageContent({ message, fromMe, instanceName }: { message: any; fromMe: boolean; instanceName?: string }) {
  const msgType = (
    message.type ||
    message.messageType ||
    (message.message?.imageMessage    ? 'image'    : '') ||
    (message.message?.videoMessage    ? 'video'    : '') ||
    (message.message?.audioMessage    ? 'audio'    : '') ||
    (message.message?.ptvMessage      ? 'audio'    : '') ||
    (message.message?.documentMessage ? 'document' : '') ||
    'text'
  ).toLowerCase().replace('message', '')

  const mediaUrl = getMediaUrl(message, instanceName)
  const caption  = message.caption || message.message?.imageMessage?.caption || ''
  const body     = message.body || message.content || message.conversation ||
                   message.message?.conversation || ''

  if (msgType === 'image' && mediaUrl) {
    return (
      <div>
        <img
          src={mediaUrl}
          alt="imagem"
          style={{ maxWidth: 260, maxHeight: 320, width: '100%', borderRadius: 10, display: 'block', cursor: 'pointer', objectFit: 'cover' }}
          onClick={() => window.open(mediaUrl, '_blank')}
          onError={(e) => {
            const t = e.currentTarget
            t.style.display = 'none'
            const fb = document.createElement('div')
            fb.style.cssText = 'padding:10px 14px;background:#F1F5F9;border-radius:10px;cursor:pointer;color:#64748B;font-size:13px;display:flex;gap:8px;align-items:center'
            fb.innerHTML = '🖼️ Imagem (clique para abrir)'
            fb.onclick = () => window.open(mediaUrl, '_blank')
            t.parentElement?.appendChild(fb)
          }}
        />
        {caption && <p style={{ fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.85)' : '#64748B', marginTop: 6 }}>{caption}</p>}
      </div>
    )
  }

  if (msgType === 'video' && mediaUrl) {
    return (
      <div style={{ maxWidth: 260, borderRadius: 10, overflow: 'hidden' }}>
        <video
          controls preload="metadata"
          style={{ width: '100%', maxHeight: 200, display: 'block', background: '#000', borderRadius: 10 }}
          onError={(e) => {
            const t = e.currentTarget
            t.style.display = 'none'
            const fb = document.createElement('div')
            fb.style.cssText = 'padding:10px 14px;background:#F1F5F9;border-radius:10px;cursor:pointer;color:#64748B;font-size:13px;display:flex;gap:8px;align-items:center'
            fb.innerHTML = '🎬 Vídeo (clique para abrir)'
            fb.onclick = () => window.open(mediaUrl, '_blank')
            t.parentElement?.appendChild(fb)
          }}
        >
          <source src={mediaUrl} type="video/mp4" />
          <source src={mediaUrl} type="video/webm" />
        </video>
      </div>
    )
  }

  if ((msgType === 'audio' || msgType === 'ptt') && mediaUrl) {
    return (
      <AudioPlayer duration={message.duration} from={fromMe ? 'me' : 'them'} mediaUrl={mediaUrl} isDark={fromMe} />
    )
  }

  if (msgType === 'document' && mediaUrl) {
    const filename = message.fileName || message.message?.documentMessage?.fileName || 'Documento'
    return (
      <div
        onClick={() => window.open(mediaUrl, '_blank')}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderRadius: 10, cursor: 'pointer',
          background: fromMe ? 'rgba(255,255,255,0.1)' : '#F8FAFB',
          border: '1px solid ' + (fromMe ? 'rgba(255,255,255,0.15)' : '#E2E8F0'),
        }}
      >
        <span style={{ fontSize: 22 }}>📄</span>
        <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: fromMe ? '#fff' : '#1A2B4A' }}>{filename}</span>
        <span style={{ fontSize: 18, color: '#00A896' }}>↓</span>
      </div>
    )
  }

  if (msgType === 'sticker' && mediaUrl) {
    return <img src={mediaUrl} alt="sticker" style={{ width: 100, height: 100, objectFit: 'contain' }} />
  }

  if (!body && !mediaUrl) {
    return <span style={{ color: fromMe ? 'rgba(255,255,255,0.5)' : '#94A3B8', fontStyle: 'italic', fontSize: 13 }}>...</span>
  }
  return <span style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</span>
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, onImageClick, instanceName }: { msg: Message; onImageClick?: (url: string) => void; instanceName?: string }) {
  const isMe = msg.from === 'me'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isMe ? 'flex-end' : 'flex-start',
      marginBottom: 3,
      paddingLeft: isMe ? '15%' : 0,
      paddingRight: isMe ? 0 : '15%',
    }}>
      <div style={{
        maxWidth: '100%',
        padding: '9px 13px',
        background: isMe
          ? 'linear-gradient(135deg, #1A2B4A 0%, #243B60 100%)'
          : '#FFFFFF',
        color: isMe ? '#fff' : '#1A2B4A',
        borderRadius: isMe ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
        border: isMe ? 'none' : '1px solid #E6F7F5',
        boxShadow: isMe
          ? '0 2px 8px rgba(26,43,74,0.25)'
          : '0 1px 4px rgba(0,168,150,0.08)',
        position: 'relative',
      }}>
        <RenderMessageContent message={msg} fromMe={isMe} instanceName={instanceName} />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 5,
          justifyContent: 'flex-end',
        }}>
          <span style={{
            fontSize: 10,
            color: isMe ? 'rgba(255,255,255,0.5)' : '#94A3B8',
          }}>
            {fmtTime(msg.ts)}
          </span>
          {isMe && (
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
              <path d="M1 5.5L5 9.5L15 1.5"
                stroke={msg.status === 'read' ? '#0DD3BF' : 'rgba(255,255,255,0.4)'}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 5.5L9 9.5"
                stroke={msg.status === 'read' ? '#0DD3BF' : 'rgba(255,255,255,0.4)'}
                strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
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
  const [tabFilter, setTabFilter] = useState<'iniciada' | 'encerrada' | 'automatico'>('iniciada')
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all')
  const [assignFilter, setAssignFilter] = useState<'all' | 'mine' | 'none'>('all')
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
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null)
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

  // Meta API state
  const [useMetaApi, setUseMetaApi] = useState(false)
  const [metaConfig, setMetaConfig] = useState<{ phone_id: string; token: string } | null>(null)

  // Sync state
  const [syncing, setSyncing] = useState(false)

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

    if (!navigator.mediaDevices?.getUserMedia) {
      setSendError('Seu browser não suporta gravação de áudio.')
      return
    }

    try {
      // Check for audio input device first
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[])
      const hasAudio = devices.some(d => d.kind === 'audioinput')
      if (devices.length > 0 && !hasAudio) {
        setSendError('Nenhum microfone encontrado neste dispositivo.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
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
        setSendError('Permissão negada. Clique no 🔒 na barra de endereço e permita o microfone.')
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setSendError('Microfone não encontrado. Verifique se há um microfone conectado.')
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        setSendError('Microfone em uso por outro aplicativo. Feche-o e tente novamente.')
      } else {
        setSendError('Erro ao gravar: ' + (err?.message || 'desconhecido'))
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
      const { data: phoneRecord } = await supabase
        .from('whatsapp_phone_numbers')
        .select('id')
        .eq('institution_id', user.institution_id!)
        .eq('is_active', true)
        .maybeSingle()

      if (phoneRecord) {
        setUseMetaApi(true)
        setConnectionStatus('connected')
        setIsConnected(true)
      } else {
        const inst = await DatabaseService.getInstitution(user.institution_id!)
        setIsConnected(!!inst?.evolution_instance)
      }

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

  // Feature 1: Connection status polling (só Evolution — Meta API não precisa de polling)
  useEffect(() => {
    if (!user?.institution_id || useMetaApi) return
    const CONNECTED_STATES = ['open', 'connected', 'CONNECTED', 'OPEN']
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/evolution/connection-state?institutionId=${user.institution_id}`, {
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) {
          console.warn('[connection-state] HTTP', res.status)
          return
        }
        const data = await res.json()
        const state = data?.instance?.state ?? data?.state ?? data?.status
        const isConn = CONNECTED_STATES.includes(state)
        setConnectionStatus(isConn ? 'connected' : state ? 'disconnected' : 'unknown')
      } catch (err) {
        console.warn('[connection-state] fetch failed:', err)
      }
    }
    checkStatus()
    const iv = setInterval(checkStatus, 30000)
    return () => clearInterval(iv)
  }, [user?.institution_id, useMetaApi])

  // Sync 48h messages from Evolution API (não aplicável à Meta API — mensagens chegam via webhook)
  const syncMessages = async () => {
    if (!user?.institution_id || !instance || syncing || useMetaApi) return
    try {
      setSyncing(true)
      const res = await fetch('/api/evolution/sync-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institution_id, instanceName: instance }),
      })
      const data = await res.json()
      if (data.success) {
        console.log(`[sync] ${data.synced} mensagens sincronizadas de ${data.chats} conversas`)
        await loadMessages()
      }
    } catch (err) {
      console.warn('[sync] erro:', err)
    } finally {
      setSyncing(false)
    }
  }

  // Sync when connection becomes active (reconnect) or on first connect
  useEffect(() => {
    const prev = prevConnectionStatusRef.current
    prevConnectionStatusRef.current = connectionStatus
    if (connectionStatus === 'connected' && prev !== 'connected') {
      syncMessages()
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

  const activeConvMsgCount = conversations.find(c => c.id === activeId)?.messages.length ?? 0

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeId, activeConvMsgCount])

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

  const iniciadas  = conversations.filter(c => !c.isGroup && c.status !== 'closed').length
  const encerradas = conversations.filter(c => !c.isGroup && c.status === 'closed').length
  const naoLidas   = conversations.filter(c => !c.isGroup && (c.unreadCount || 0) > 0).length

  const filteredConvs = conversations.filter(c => {
    if (c.isGroup) return false
    if (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)) {
      // tab filter
      if (tabFilter === 'iniciada'  && c.status === 'closed') return false
      if (tabFilter === 'encerrada' && c.status !== 'closed') return false
      // read filter
      if (readFilter === 'read'   && (c.unreadCount || 0) > 0) return false
      if (readFilter === 'unread' && (c.unreadCount || 0) === 0) return false
      // assign filter
      if (assignFilter === 'mine' && c.assigned_user_id !== user?.id) return false
      if (assignFilter === 'none' && c.assigned_user_id != null) return false
      return true
    }
    return false
  })

  const handleSend = async () => {
    if (!inputText.trim() || !activeId) return
    const text = inputText.trim()
    const tempId = `temp-${Date.now()}`
    const tempMsg: Message = {
      id: tempId,
      type: 'text',
      content: text,
      from: 'me',
      ts: new Date(),
      status: 'sent',
    }

    setConversations(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, messages: [...c.messages, tempMsg], lastMessage: text, lastTime: tempMsg.ts }
        : c
    ))
    setInputText('')
    setShowQuickReplies(false)

    try {
      const to = activeId
        .replace(/@s\.whatsapp\.net$/, '')
        .replace(/@.*/, '')
        .replace(/\D/g, '')

      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: user?.institution_id,
          to,
          text,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar')

      setConversations(prev => prev.map(c =>
        c.id === activeId
          ? {
              ...c,
              messages: c.messages.map(m =>
                m.id === tempId
                  ? { ...m, id: data.wamid || tempId, status: 'sent' as const }
                  : m
              ),
            }
          : c
      ))

    } catch (err: any) {
      setConversations(prev => prev.map(c =>
        c.id === activeId
          ? { ...c, messages: c.messages.filter(m => m.id !== tempId) }
          : c
      ))
      setSendError(err.message || 'Erro ao enviar mensagem.')
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
    // Generate data: URL for thumbnail preview (avoids blob: CSP violation)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setPendingFilePreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPendingFilePreview(null)
    }
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

    // Compute base64 first so we can use data: URL for preview (avoids CSP blob: violation)
    const fileToSend = mediatype === 'image' ? await compressImage(pendingFile) : pendingFile
    const base64 = await toBase64(fileToSend)
    setUploadProgress(30)

    const localUrl = `data:${fileToSend.type};base64,${base64}`
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
      setTimeout(() => { setPendingFile(null); setPendingFilePreview(null); setUploadProgress(0) }, 800)
    } catch (err) {
      console.error('[sendPendingFile] error:', err)
      setSendError('Erro ao enviar arquivo.')
      // Remove optimistic message on error
      setConversations(prev => prev.map(c =>
        c.id === activeId ? { ...c, messages: c.messages.filter(m => m.id !== tempId) } : c
      ))
      setPendingFile(null); setPendingFilePreview(null)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F0FDFB' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#00A896] border-t-transparent" />
      </div>
    )
  }

  // ── Not connected ──
  if (!isConnected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F0FDFB' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ width: 80, height: 80, background: '#E6F7F5', border: '2px solid #D1FAE5', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <MessageCircle style={{ width: 40, height: 40, color: '#00A896' }} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', marginBottom: 8 }}>WhatsApp não conectado</h2>
          <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 1.6 }}>
            Conecte seu WhatsApp nas Configurações para começar a atender.
          </p>
          <button
            onClick={() => navigate('/settings')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#00A896', color: '#fff', fontSize: 14, fontWeight: 600, borderRadius: 10, border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#007A6E')}
            onMouseLeave={e => (e.currentTarget.style.background = '#00A896')}
          >
            <Settings style={{ width: 16, height: 16 }} />
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

      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F0FDFB', height: '100%' }}>

        {/* Connection warning banner */}
        {connectionStatus === 'disconnected' && !useMetaApi && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, margin: '8px 16px', padding: '10px 16px', borderRadius: 10, background: '#FEF3C7', border: '1px solid #F59E0B' }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#92400E', flex: 1 }}>Conexão com WhatsApp instável ou desconectada. Verifique em Configurações → WhatsApp.</span>
            <button onClick={() => navigate('/settings?tab=whatsapp')} style={{ fontSize: 12, fontWeight: 600, color: '#D97706', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Ir para Configurações
            </button>
          </div>
        )}
        {/* Sync indicator */}
        {syncing && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 0', background: '#E6F7F5', borderBottom: '1px solid #D1FAE5' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00A896', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: 11, color: '#007A6E', fontWeight: 500 }}>Sincronizando mensagens...</span>
          </div>
        )}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Hidden file input for attachments */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xlsx,.xls"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* ── Col 1: Conversation List ──────────────────────────────────────────── */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRight: '1px solid #D1FAE5', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FFFFFF', borderBottom: '1px solid #D1FAE5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle style={{ width: 18, height: 18, color: '#00A896' }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>WhatsApp</span>
              {totalUnread > 0 && (
                <span style={{ background: '#00A896', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, minWidth: 20, textAlign: 'center' }}>
                  {totalUnread}
                </span>
              )}
            </div>
            <button
              style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00A896', border: 'none', cursor: 'pointer', color: '#fff', transition: 'background 0.15s' }}
              title="Nova conversa"
              onClick={() => setShowNewConvModal(true)}
              onMouseEnter={e => (e.currentTarget.style.background = '#007A6E')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00A896')}
            >
              <Plus style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '8px 12px', flexShrink: 0, background: '#FFFFFF', borderBottom: '1px solid #D1FAE5' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar nome ou número..."
                style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, background: '#F0FDFB', border: '1px solid #D1FAE5', borderRadius: 10, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#00A896')}
                onBlur={e => (e.currentTarget.style.borderColor = '#D1FAE5')}
              />
            </div>
          </div>

          {/* Main view tabs: Conversas | Contatos */}
          <div style={{ flexShrink: 0, display: 'flex', background: '#FFFFFF', borderBottom: '1px solid #D1FAE5' }}>
            {([
              { key: 'conversations', label: 'Conversas' },
              { key: 'contacts',      label: 'Contatos'  },
            ] as { key: MainView; label: string }[]).map(t => (
              <button key={t.key} onClick={() => setMainView(t.key)}
                style={{
                  flex: 1, padding: '10px 0', fontSize: 13, fontWeight: mainView === t.key ? 700 : 500,
                  color: mainView === t.key ? '#1A2B4A' : '#64748B',
                  borderBottom: mainView === t.key ? '2px solid #00A896' : '2px solid transparent',
                  background: 'none', border: 'none',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{t.label}</button>
            ))}
          </div>

          {/* Filters — Botconversa style */}
          <div style={{ borderBottom: '1px solid #D1FAE5' }}>
            {/* Row 1: Tab tabs with counters */}
            <div style={{ display: 'flex', padding: '0 12px', gap: 0 }}>
              {([
                { key: 'iniciada',   label: 'Iniciada',   count: iniciadas  },
                { key: 'encerrada',  label: 'Encerrada',  count: encerradas },
                { key: 'automatico', label: 'Automático', count: 0          },
              ] as { key: typeof tabFilter; label: string; count: number }[]).map(tab => (
                <button key={tab.key} onClick={() => setTabFilter(tab.key)} style={{
                  flex: 1, padding: '10px 4px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 13, fontWeight: tabFilter === tab.key ? 700 : 500,
                  color: tabFilter === tab.key ? '#1A2B4A' : '#94A3B8',
                  borderBottom: tabFilter === tab.key ? '2px solid #00A896' : '2px solid transparent',
                  transition: 'all 0.15s', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6,
                }}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      background: tabFilter === tab.key ? '#00A896' : '#D1FAE5',
                      color: tabFilter === tab.key ? '#fff' : '#007A6E',
                      borderRadius: 9999, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                    }}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
            {/* Row 2: Read + assign sub-filters */}
            <div style={{ display: 'flex', padding: '8px 12px', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {([
                { key: 'all',    label: 'Tudo',     count: 0        },
                { key: 'read',   label: 'Lida',     count: 0        },
                { key: 'unread', label: 'Não lida', count: naoLidas },
              ] as { key: typeof readFilter; label: string; count: number }[]).map(f => (
                <button key={f.key} onClick={() => setReadFilter(f.key)} style={{
                  padding: '3px 10px', borderRadius: 9999, fontSize: 12, border: 'none',
                  cursor: 'pointer', fontWeight: readFilter === f.key ? 600 : 400,
                  background: readFilter === f.key ? '#EDE9FE' : '#F0FDFB',
                  color: readFilter === f.key ? '#7C3AED' : '#64748B',
                  display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
                }}>
                  {f.label}
                  {f.count > 0 && (
                    <span style={{ background: '#7C3AED', color: '#fff', borderRadius: 9999, padding: '0px 5px', fontSize: 10, fontWeight: 700 }}>{f.count}</span>
                  )}
                </button>
              ))}
              <div style={{ width: 1, height: 16, background: '#D1FAE5', margin: '0 2px' }} />
              {([
                { key: 'all',  label: 'Todos'    },
                { key: 'mine', label: 'Meus'     },
                { key: 'none', label: 'Sem dono' },
              ] as { key: typeof assignFilter; label: string }[]).map(f => (
                <button key={f.key} onClick={() => setAssignFilter(f.key)} style={{
                  padding: '3px 10px', borderRadius: 9999, fontSize: 12, border: 'none',
                  cursor: 'pointer', fontWeight: assignFilter === f.key ? 600 : 400,
                  background: assignFilter === f.key ? '#1A2B4A' : '#F0FDFB',
                  color: assignFilter === f.key ? '#fff' : '#64748B',
                  transition: 'all 0.15s',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredConvs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, textAlign: 'center', padding: '0 16px' }}>
                <p style={{ fontSize: 12, color: '#94A3B8' }}>Nenhuma conversa encontrada</p>
              </div>
            ) : (
              filteredConvs.map(conv => {
                const isActive = conv.id === activeId
                const preview = getLastMsgPreview(conv.lastMessage)
                // Inline status colors
                const statusColors: Record<string, { bg: string; dot: string; text: string }> = {
                  waiting: { bg: '#FEF3C7', dot: '#D97706', text: '#D97706' },
                  open:    { bg: '#D1FAE5', dot: '#059669', text: '#059669' },
                  closed:  { bg: '#E2E8F0', dot: '#94A3B8', text: '#64748B' },
                }
                const sc = statusColors[conv.status] ?? statusColors['waiting']
                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveId(conv.id)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '11px 14px',
                      cursor: 'pointer',
                      borderLeft: isActive ? '3px solid #00A896' : '3px solid transparent',
                      borderBottom: '1px solid #F0FDFB',
                      background: isActive ? 'linear-gradient(135deg, #E6F7F5 0%, #F0FDFB 100%)' : 'transparent',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F8FAFC' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Avatar com ring colorido quando ativo */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: isActive
                          ? 'linear-gradient(135deg, #00A896, #0DD3BF)'
                          : getAvatarBgColor(conv.name),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 700, color: 'white',
                        border: isActive ? '2px solid #00A896' : '2px solid transparent',
                        boxShadow: isActive ? '0 0 0 3px rgba(0,168,150,0.15)' : 'none',
                        transition: 'all 0.2s',
                        overflow: 'hidden',
                      }}>
                        {conv.profile_picture_url
                          ? <img src={conv.profile_picture_url} alt={conv.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          : conv.isGroup
                          ? <Users style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.9)' }} />
                          : getInitials(conv.name)
                        }
                      </div>
                      {/* Badge do atendente */}
                      {conv.assigned_user_name && (
                        <div style={{
                          position: 'absolute', bottom: -1, right: -1,
                          width: 16, height: 16, borderRadius: '50%',
                          background: '#1A2B4A', border: '2px solid white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 7, fontWeight: 700, color: 'white',
                        }}>
                          {getInitials(conv.assigned_user_name).slice(0, 1)}
                        </div>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: isActive ? '#007A6E' : '#1A2B4A',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 160,
                        }}>
                          {conv.name}
                        </span>
                        <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>
                          {fmtConvTime(conv.lastTime)}
                        </span>
                      </div>

                      <p style={{
                        fontSize: 12, color: '#64748B', margin: '0 0 5px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {preview.icon ? (
                          <span style={{ color: '#00A896', fontStyle: 'italic' }}>
                            {preview.icon} {preview.text}
                          </span>
                        ) : preview.text}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* Badge de status */}
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          padding: '2px 8px', borderRadius: 999,
                          background: sc.bg,
                          color: sc.text,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
                            background: sc.dot,
                          }} />
                          {safeStatusCfg(conv.status).label}
                        </span>

                        {/* Unread badge */}
                        {conv.unreadCount > 0 && (
                          <span style={{
                            background: '#00A896', color: 'white',
                            fontSize: 10, fontWeight: 700,
                            minWidth: 20, height: 20, borderRadius: 999,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '0 5px',
                            boxShadow: '0 2px 6px rgba(0,168,150,0.4)',
                            animation: 'pulse 2s infinite',
                          }}>
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Col 2: Chat ───────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FAFFFE' }}>

          {/* ── Contacts table view ── */}
          {mainView === 'contacts' && (
            <div style={{ flex: 1, overflowY: 'auto', background: '#F0FDFB', padding: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', marginBottom: 16 }}>Contatos</h2>

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
            <div style={{ flexShrink: 0, position: 'relative', background: 'linear-gradient(135deg, #FFFFFF 0%, #F0FDFB 100%)', borderBottom: '1px solid #D1FAE5', minHeight: 64, boxShadow: '0 2px 8px rgba(0,168,150,0.06)' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 64 }}>
                <div style={{ position: 'relative' }}>
                  <div className={activeConv.avatarColor} style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {activeConv.profile_picture_url ? (
                      <img src={activeConv.profile_picture_url} alt={activeConv.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : activeConv.isGroup ? (
                      <Users style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.9)' }} />
                    ) : (
                      getInitials(activeConv.name)
                    )}
                  </div>
                  {activeConv.online && (
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: '#22C55E', borderRadius: '50%', border: '2px solid #fff' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{activeConv.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                      {activeConv.isGroup ? 'Grupo WhatsApp' : activeConv.phone}
                      {activeConv.online && <span style={{ marginLeft: 6, color: '#00A896', fontWeight: 500 }}>• online</span>}
                    </p>
                    {(() => {
                      const statusColors: Record<string, { bg: string; dot: string; text: string }> = {
                        waiting: { bg: '#FEF3C7', dot: '#D97706', text: '#D97706' },
                        open:    { bg: '#D1FAE5', dot: '#059669', text: '#059669' },
                        closed:  { bg: '#E2E8F0', dot: '#94A3B8', text: '#64748B' },
                      }
                      const sc = statusColors[activeConv.status] ?? statusColors['waiting']
                      return (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: sc.bg, color: sc.text }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                          {safeStatusCfg(activeConv.status).label}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[
                    { icon: Search, key: 'search', active: showMsgSearch, onClick: () => { setShowMsgSearch(v => !v); if (showMsgSearch) setMsgSearchText('') }, title: 'Buscar mensagens' },
                    { icon: Info,   key: 'info',   active: showContactInfo, onClick: () => setShowContactInfo(v => !v), title: 'Informações do contato' },
                    { icon: MoreVertical, key: 'more', active: showMoreMenu, onClick: () => setShowMoreMenu(v => !v), title: 'Mais opções' },
                  ].map(btn => {
                    const IconComp = btn.icon
                    return (
                      <button key={btn.key} onClick={btn.onClick} title={btn.title}
                        style={{
                          width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: btn.active ? '#E6F7F5' : '#F0FDFB', color: btn.active ? '#00A896' : '#64748B',
                          border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { if (!btn.active) e.currentTarget.style.background = '#D1FAE5' }}
                        onMouseLeave={e => { if (!btn.active) e.currentTarget.style.background = '#F0FDFB' }}
                      >
                        <IconComp style={{ width: 16, height: 16 }} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Message search bar */}
              {showMsgSearch && (
                <div style={{ flexShrink: 0, padding: '8px 16px', background: '#FFFFFF', borderTop: '1px solid #D1FAE5', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Search style={{ width: 14, height: 14, color: '#94A3B8', flexShrink: 0 }} />
                  <input autoFocus value={msgSearchText} onChange={e => setMsgSearchText(e.target.value)}
                    placeholder="Buscar nas mensagens..."
                    style={{ flex: 1, fontSize: 13, background: 'transparent', outline: 'none', border: 'none', color: '#1A2B4A' }}
                  />
                  <button onClick={() => { setShowMsgSearch(false); setMsgSearchText('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              )}

              {/* More menu dropdown */}
              {showMoreMenu && (
                <div ref={moreMenuRef} style={{ position: 'absolute', right: 16, top: 56, zIndex: 30, background: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #D1FAE5', paddingTop: 4, paddingBottom: 4, minWidth: 160 }}>
                  <button onClick={() => { setConversations(prev => prev.map(c => c.id === activeId ? {...c, messages: []} : c)); setShowMoreMenu(false) }}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, color: '#1A2B4A', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    Limpar conversa
                  </button>
                  <button onClick={() => { setShowMoreMenu(false) }}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, color: '#1A2B4A', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    Bloquear contato
                  </button>
                  {activeConv?.lead_id && (
                    <button onClick={() => { navigate(`/leads?highlight=${activeConv.lead_id}`); setShowMoreMenu(false) }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, color: '#1A2B4A', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      Ver perfil no CRM
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages area + Composer — hidden in contacts view */}
          {mainView !== 'contacts' && <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 2, backgroundImage: 'radial-gradient(circle at 1px 1px, #D1FAE5 1px, transparent 0)', backgroundSize: '24px 24px', backgroundColor: '#FAFFFE' }}>
            {!activeConv && conversations.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, background: '#E6F7F5', border: '2px solid #B2E8E2', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <MessageCircle style={{ width: 36, height: 36, color: '#00A896' }} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 6px' }}>Aguardando mensagens</p>
                <p style={{ fontSize: 13, color: '#94A3B8', maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
                  Seu WhatsApp está conectado. As conversas aparecerão aqui assim que chegarem novas mensagens.
                </p>
              </div>
            )}
            {!activeConv && conversations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, background: '#E6F7F5', border: '2px solid #B2E8E2', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <MessageCircle style={{ width: 30, height: 30, color: '#00A896' }} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px' }}>Selecione uma conversa</p>
                <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Escolha uma conversa para começar</p>
              </div>
            )}
            {msgGroups.map((group, gi) => (
              <div key={gi}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 10px' }}>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #D1FAE5, transparent)' }} />
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#007A6E',
                    background: '#E6F7F5', border: '1px solid #B2E8E2',
                    padding: '4px 14px', borderRadius: 999,
                    boxShadow: '0 1px 4px rgba(0,168,150,0.12)',
                  }}>
                    {group.label}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #D1FAE5, transparent)' }} />
                </div>
                {group.msgs.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} onImageClick={url => setLightboxUrl(url)} instanceName={instance} />
                ))}
              </div>
            ))}
            {activeConv?.messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '64px 0' }}>
                <div style={{ width: 56, height: 56, background: '#E6F7F5', border: '2px solid #B2E8E2', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <MessageCircle style={{ width: 26, height: 26, color: '#00A896' }} />
                </div>
                <p style={{ fontSize: 14, color: '#1A2B4A', margin: '0 0 4px', fontWeight: 500 }}>Nenhuma mensagem ainda</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Envie a primeira mensagem abaixo</p>
              </div>
            )}
            {/* Typing indicator */}
            {activeId && typingConvIds.has(activeId) && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 4 }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #D1FAE5', borderRadius: '2px 14px 14px 14px', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="animate-bounce"
                        style={{ width: 8, height: 8, background: '#94A3B8', borderRadius: '50%', animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div style={{ flexShrink: 0, background: 'linear-gradient(to top, #FFFFFF 0%, #F8FFFE 100%)', borderTop: '1px solid #D1FAE5', padding: '10px 16px 14px', boxShadow: '0 -2px 12px rgba(0,168,150,0.06)' }}>

            {/* Quick replies panel */}
            {showQuickReplies && (
              <div style={{ marginBottom: 8, background: '#F0FDFB', borderRadius: 12, border: '1px solid #D1FAE5', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Respostas rápidas</span>
                  <button onClick={() => setShowQuickReplies(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {QUICK_REPLIES.map(qr => (
                    <button
                      key={qr.id}
                      onClick={() => { setInputText(qr.text); setShowQuickReplies(false) }}
                      style={{ textAlign: 'left', padding: '8px 12px', background: '#FFFFFF', border: '1px solid #D1FAE5', borderRadius: 8, cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#00A896'; e.currentTarget.style.background = '#E6F7F5' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1FAE5'; e.currentTarget.style.background = '#FFFFFF' }}
                    >
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{qr.label}</p>
                      <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qr.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Attachment menu */}
            {showAttach && (
              <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { icon: Image,    label: 'Imagem',    bg: '#EDE9FE', color: '#7C3AED' },
                  { icon: Video,    label: 'Vídeo',     bg: '#DBEAFE', color: '#2563EB' },
                  { icon: FileText, label: 'Documento', bg: '#FEF3C7', color: '#D97706' },
                  { icon: Mic,      label: 'Áudio',     bg: '#D1FAE5', color: '#059669' },
                ].map(item => {
                  const IconComp = item.icon
                  return (
                    <button
                      key={item.label}
                      onClick={() => { fileInputRef.current?.click(); setShowAttach(false) }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, background: item.bg, color: item.color, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}
                    >
                      <IconComp style={{ width: 16, height: 16 }} />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* File preview area */}
            {pendingFile && (
              <div style={{ marginBottom: 8, background: '#F0FDFB', borderRadius: 12, border: '1px solid #D1FAE5', padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                {pendingFile.type.startsWith('image/') ? (
                  <img src={pendingFilePreview || ''} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText style={{ width: 20, height: 20, color: '#64748B' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#1A2B4A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.name}</p>
                  <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>{(pendingFile.size / 1024).toFixed(1)} KB</p>
                  {uploadProgress > 0 && (
                    <div style={{ marginTop: 4, height: 4, background: '#D1FAE5', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#00A896', transition: 'width 0.3s', width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={sendPendingFile} style={{ padding: 6, background: '#00A896', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                    <Send style={{ width: 14, height: 14 }} />
                  </button>
                  <button onClick={() => { setPendingFile(null); setPendingFilePreview(null) }} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            )}

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div style={{ marginBottom: 8, background: '#FFFFFF', borderRadius: 12, border: '1px solid #D1FAE5', padding: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
                  {COMMON_EMOJIS.map(e => (
                    <button key={e} onClick={() => { setInputText(t => t + e); setShowEmojiPicker(false) }}
                      style={{ width: 28, height: 28, fontSize: 16, background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = '#F0FDFB')}
                      onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[
                { icon: Paperclip, active: showAttach, onClick: () => { setShowAttach(v => !v); setShowQuickReplies(false) }, title: 'Anexar arquivo' },
                { icon: Zap,       active: showQuickReplies, onClick: () => { setShowQuickReplies(v => !v); setShowAttach(false) }, title: 'Respostas rápidas' },
                { icon: Smile,     active: showEmojiPicker,  onClick: () => { setShowEmojiPicker(v => !v); setShowAttach(false); setShowQuickReplies(false) }, title: 'Emojis' },
              ].map(btn => {
                const IconComp = btn.icon
                return (
                  <button key={btn.title} onClick={btn.onClick} title={btn.title}
                    style={{
                      padding: 8, borderRadius: 8, flexShrink: 0, background: btn.active ? '#E6F7F5' : 'none',
                      color: btn.active ? '#00A896' : '#64748B', border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!btn.active) e.currentTarget.style.background = '#F0FDFB' }}
                    onMouseLeave={e => { if (!btn.active) e.currentTarget.style.background = 'none' }}
                  >
                    <IconComp style={{ width: 20, height: 20 }} />
                  </button>
                )
              })}
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Digite uma mensagem..."
                rows={1}
                style={{
                  flex: 1,
                  padding: '10px 18px',
                  fontSize: 14,
                  background: '#F0FDFB',
                  border: '1.5px solid #D1FAE5',
                  borderRadius: 28,
                  color: '#1A2B4A',
                  outline: 'none',
                  resize: 'none',
                  minHeight: 42,
                  maxHeight: 100,
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 4px rgba(0,168,150,0.08) inset',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#00A896'; e.currentTarget.style.background = '#FFFFFF' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#D1FAE5'; e.currentTarget.style.background = '#F0FDFB' }}
              />
              {inputText.trim() ? (
                <button
                  onClick={handleSend}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', background: '#00A896', color: '#fff',
                    border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#007A6E'; e.currentTarget.style.transform = 'scale(1.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#00A896'; e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <Send style={{ width: 18, height: 18 }} />
                </button>
              ) : (
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isRecording ? '#EF4444' : '#00A896', color: '#fff', border: 'none', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  className={isRecording ? 'animate-pulse' : ''}
                  title="Segurar para gravar áudio"
                >
                  <Mic style={{ width: 18, height: 18 }} />
                </button>
              )}
            </div>
          </div>
          </>}
        </div>

        {/* ── Col 3: Contact Panel ──────────────────────────────────────────────── */}
        {showContactInfo && (
          <div style={{ width: 280, flexShrink: 0, background: '#FFFFFF', borderLeft: '1px solid #D1FAE5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeConv ? (
            <>
            {/* Tab bar */}
            <div style={{ flexShrink: 0, display: 'flex', background: '#FFFFFF', borderBottom: '1px solid #D1FAE5' }}>
              {([
                { key: 'details', label: 'Detalhes' },
                { key: 'history', label: 'Histórico' },
              ] as { key: RightPanelTab; label: string }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setRightPanelTab(tab.key)}
                  style={{
                    flex: 1, padding: '12px 0', fontSize: 12, fontWeight: rightPanelTab === tab.key ? 700 : 500,
                    color: rightPanelTab === tab.key ? '#1A2B4A' : '#64748B',
                    borderBottom: rightPanelTab === tab.key ? '2px solid #00A896' : '2px solid transparent',
                    background: 'none', border: 'none',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Detalhes tab ── */}
            {rightPanelTab === 'details' && (
              <div style={{ flex: 1, overflowY: 'auto' }}>

                {/* Concluir / Sair buttons */}
                {activeConv.status !== 'closed' && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #D1FAE5', background: '#F0FDFB', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={handleCloseConversation}
                      style={{ width: '100%', padding: '11px 0', fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #00A896 0%, #0DD3BF 100%)', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(0,168,150,0.35)', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,168,150,0.45)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,168,150,0.35)' }}>
                      ✅ Concluir Atendimento
                    </button>
                    {activeConv.assigned_user_id && (
                      <button onClick={handleLeaveConversation}
                        style={{ width: '100%', padding: '9px 0', fontSize: 12, fontWeight: 600, color: '#92400E', background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', border: '1px solid #FCD34D', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                        🚪 Sair do Atendimento
                      </button>
                    )}
                  </div>
                )}

                {/* Contact header */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px 20px', borderBottom: '1px solid #E6F7F5', background: 'linear-gradient(180deg, #F0FDFB 0%, #FFFFFF 100%)' }}>
                  <div style={{ width: 68, height: 68, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden', fontSize: 26, fontWeight: 700, color: '#fff', background: activeConv.profile_picture_url ? 'transparent' : getAvatarBgColor(activeConv.name), boxShadow: '0 4px 16px rgba(0,168,150,0.35)', border: '3px solid white' }}>
                    {activeConv.profile_picture_url ? (
                      <img src={activeConv.profile_picture_url} alt={activeConv.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : activeConv.isGroup ? (
                      <Users style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.9)' }} />
                    ) : (
                      getInitials(activeConv.name)
                    )}
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', textAlign: 'center', margin: 0 }}>{activeConv.name}</p>
                  <p style={{ fontSize: 12, color: '#64748B', marginTop: 2, textAlign: 'center' }}>
                    {activeConv.isGroup ? 'Grupo WhatsApp' : activeConv.phone}
                  </p>
                  {activeConv.contact_type && activeConv.contact_type !== 'unknown' && (
                    <span style={{
                      marginTop: 8, fontSize: 11, padding: '3px 12px', borderRadius: 9999, fontWeight: 500,
                      background: activeConv.contact_type === 'lead' ? '#E6F7F5' : activeConv.contact_type === 'client' ? '#D1FAE5' : activeConv.contact_type === 'supplier' ? '#EDE9FE' : '#F1F5F9',
                      color: activeConv.contact_type === 'lead' ? '#00A896' : activeConv.contact_type === 'client' ? '#059669' : activeConv.contact_type === 'supplier' ? '#7C3AED' : '#64748B',
                    }}>
                      {activeConv.contact_type === 'lead' ? 'Lead' : activeConv.contact_type === 'client' ? 'Cliente' : activeConv.contact_type === 'supplier' ? 'Fornecedor' : activeConv.contact_type}
                    </span>
                  )}
                  {activeConv.isGroup && (
                    <span style={{ marginTop: 8, fontSize: 11, padding: '3px 12px', borderRadius: 9999, fontWeight: 500, background: '#EDE9FE', color: '#7C3AED' }}>Grupo</span>
                  )}
                  {activeConv.labels.map(lb => (
                    <span key={lb.text} className={`mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${lb.color}`}>
                      {lb.text}
                    </span>
                  ))}
                  {!activeConv.isGroup && (
                    <button
                      onClick={() => { setShowDrawer(true) }}
                      style={{ marginTop: 8, fontSize: 12, border: '1px solid #00A896', color: '#00A896', background: 'transparent', padding: '5px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#E6F7F5')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      ✏️ Editar
                    </button>
                  )}
                </div>

                {/* Janela de 24h */}
                {!activeConv.isGroup && (() => {
                  const lastIncoming = [...activeConv.messages].filter(m => m.from === 'them').slice(-1)[0]
                  const msElapsed    = lastIncoming ? Date.now() - lastIncoming.ts.getTime() : Infinity
                  const windowOpen   = msElapsed < 24 * 3600000
                  const hoursLeft    = Math.max(0, 24 - msElapsed / 3600000)
                  const hh           = Math.floor(hoursLeft)
                  const mm           = Math.round((hoursLeft - hh) * 60)
                  return (
                    <div style={{ margin: '10px 12px 0', padding: '8px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
                      background: windowOpen ? '#D1FAE5' : '#FEE2E2',
                      border: `1px solid ${windowOpen ? '#A7F3D0' : '#FECACA'}` }}>
                      <span style={{ fontSize: 14 }}>{windowOpen ? '🟢' : '🔴'}</span>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: windowOpen ? '#059669' : '#DC2626', margin: 0 }}>
                          {windowOpen ? 'Janela aberta' : 'Janela expirada'}
                        </p>
                        <p style={{ fontSize: 11, color: windowOpen ? '#065F46' : '#991B1B', margin: 0 }}>
                          {windowOpen
                            ? `Expira em ${hh}h ${mm}min`
                            : 'Use template para iniciar'}
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* Inline edit form */}
                {editingContact && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #D1FAE5', background: '#F0FDFB' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748B', marginBottom: 4 }}>Nome</label>
                        <input value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: '#FFFFFF', border: '1px solid #D1FAE5', borderRadius: 8, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748B', marginBottom: 4 }}>Tipo</label>
                        <select value={editForm.contact_type} onChange={e => setEditForm(f => ({...f, contact_type: e.target.value}))}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: '#FFFFFF', border: '1px solid #D1FAE5', borderRadius: 8, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}>
                          <option value="">Desconhecido</option>
                          <option value="lead">Lead</option>
                          <option value="client">Cliente</option>
                          <option value="supplier">Fornecedor</option>
                          <option value="other">Outro</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
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
                        style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, color: '#fff', background: '#00A896', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                        Salvar
                      </button>
                      <button onClick={() => setEditingContact(false)}
                        style={{ padding: '6px 12px', fontSize: 12, color: '#64748B', border: '1px solid #D1FAE5', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Who is this contact? — only for unknown non-group, non-linked contacts */}
                {!activeConv.isGroup && (!activeConv.contact_type || activeConv.contact_type === 'unknown') && !activeConv.lead_id && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #D1FAE5', background: '#FFFBEB' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#D97706', margin: '0 0 8px' }}>Quem é esse contato?</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {[
                        { key: 'lead',     label: '🎓 Nova Família',      bg: '#00A896', color: '#fff',    border: 'none',        onClick: () => { setLeadForm(prev => ({ ...prev, responsible_name: activeConv.name !== formatPhone(activeConv.id) ? activeConv.name : '', phone: activeConv.phone })); setShowLeadModal(true) } },
                        { key: 'client',   label: '✅ Família da Casa',    bg: '#D1FAE5', color: '#059669', border: 'none',        onClick: () => setShowClientModal(true) },
                        { key: 'supplier', label: '🏢 Fornecedor',         bg: '#EDE9FE', color: '#7C3AED', border: 'none',        onClick: () => handleContactType('supplier') },
                        { key: 'other',    label: 'Outro',                 bg: '#F1F5F9', color: '#64748B', border: 'none',        onClick: () => handleContactType('other') },
                      ].map(opt => (
                        <button key={opt.key} onClick={opt.onClick}
                          style={{ padding: '8px 6px', fontSize: 12, fontWeight: activeConv.contact_type === opt.key ? 700 : 500, background: activeConv.contact_type === opt.key ? opt.bg : '#FFFFFF', color: activeConv.contact_type === opt.key ? opt.color : '#64748B', border: `1px solid ${activeConv.contact_type === opt.key ? opt.bg : '#D1FAE5'}`, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}
                          onMouseEnter={e => { e.currentTarget.style.background = opt.bg; e.currentTarget.style.color = opt.color; e.currentTarget.style.borderColor = opt.bg }}
                          onMouseLeave={e => { if (activeConv.contact_type !== opt.key) { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#D1FAE5' } }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status select */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #D1FAE5' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Status do atendimento
                  </label>
                  <select
                    value={activeConv.status}
                    onChange={e => handleStatusChange(e.target.value as ConvStatus)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: '#F0FDFB', border: '1px solid #D1FAE5', borderRadius: 8, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="waiting">Aguardando</option>
                    <option value="open">Em Atendimento</option>
                    <option value="closed">Concluído</option>
                  </select>
                </div>

                {/* Attendant section */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #D1FAE5' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Atendente
                  </label>
                  {transferring ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: '#F0FDFB', border: '1px solid #D1FAE5', borderRadius: 8, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}>
                        <option value="">Selecionar atendente...</option>
                        {users.filter(u => u.id !== activeConv.assigned_user_id).map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={activeConv.status === 'closed' ? handleAssignFromClosed : handleTransfer}
                          disabled={!transferTarget}
                          style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, color: '#fff', background: '#00A896', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: !transferTarget ? 0.4 : 1, transition: 'background 0.15s' }}>
                          {activeConv.status === 'closed' ? 'Atribuir' : 'Transferir'}
                        </button>
                        <button onClick={() => { setTransferring(false); setTransferTarget('') }}
                          style={{ padding: '7px 12px', fontSize: 12, color: '#64748B', border: '1px solid #D1FAE5', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : activeConv.status === 'closed' ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>—</span>
                      <button onClick={() => setTransferring(true)}
                        style={{ fontSize: 12, border: '1px solid #00A896', color: '#00A896', background: 'transparent', padding: '3px 10px', borderRadius: 8, fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#E6F7F5')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        Atribuir
                      </button>
                    </div>
                  ) : activeConv.assigned_user_id ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#1A2B4A', fontWeight: 500 }}>{activeConv.assigned_user_name}</span>
                      <button onClick={() => setTransferring(true)}
                        style={{ fontSize: 12, color: '#00A896', background: 'none', border: 'none', fontWeight: 500, cursor: 'pointer', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#007A6E')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#00A896')}>
                        Transferir
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setTransferring(true)}
                      style={{ width: '100%', padding: '8px 0', fontSize: 12, color: '#64748B', background: 'transparent', border: '1px dashed #D1FAE5', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#00A896'; e.currentTarget.style.color = '#00A896'; e.currentTarget.style.background = '#E6F7F5' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1FAE5'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'transparent' }}>
                      + Atribuir atendente
                    </button>
                  )}
                </div>

                {/* Etiquetas */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #D1FAE5' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Etiquetas
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(activeConv.tags || []).map(tag => (
                      <span key={tag} className={tagColor(tag)} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, padding: '3px 8px', borderRadius: 9999, fontWeight: 500, color: '#fff' }}>
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
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
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 9999, border: '1px dashed #D1FAE5', background: 'transparent', color: '#1A2B4A', outline: 'none', width: 110 }}
                        maxLength={20}
                      />
                    ) : (
                      <button onClick={() => setAddingTag(true)}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 9999, border: '1px dashed #D1FAE5', color: '#00A896', background: 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#00A896'; e.currentTarget.style.background = '#E6F7F5' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1FAE5'; e.currentTarget.style.background = 'transparent' }}>
                        + Etiqueta
                      </button>
                    )}
                  </div>
                </div>

                {/* Lead linking — only for individual contacts */}
                {!activeConv.isGroup && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #D1FAE5' }}>
                    {activeConv.lead_id ? (
                      <button
                        onClick={() => navigate(`/leads?highlight=${activeConv.lead_id}`)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F0FDFB', border: '1px solid #D1FAE5', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#1A2B4A', fontWeight: 500, transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#E6F7F5'; e.currentTarget.style.borderColor = '#00A896' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F0FDFB'; e.currentTarget.style.borderColor = '#D1FAE5' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <User style={{ width: 14, height: 14, color: '#00A896' }} />
                          <span>Vincular a um Lead</span>
                        </div>
                        <ChevronRight style={{ width: 14, height: 14, color: '#94A3B8' }} />
                      </button>
                    ) : linkingLead ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input
                          autoFocus
                          value={leadSearch}
                          onChange={e => searchLeads(e.target.value)}
                          placeholder="Buscar lead por nome ou tel..."
                          style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: '#F0FDFB', border: '1px solid #D1FAE5', borderRadius: 8, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {leadResults.map(l => (
                          <button key={l.id} onClick={() => handleLinkLead(l.id)}
                            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12, background: '#F0FDFB', border: '1px solid #D1FAE5', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#E6F7F5')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#F0FDFB')}>
                            <p style={{ fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{l.responsible_name}</p>
                            <p style={{ color: '#64748B', margin: 0 }}>{l.student_name} · {l.grade_interest}</p>
                          </button>
                        ))}
                        <button onClick={() => { setLinkingLead(false); setLeadSearch(''); setLeadResults([]) }}
                          style={{ fontSize: 12, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setLinkingLead(true)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F0FDFB', border: '1px solid #D1FAE5', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#1A2B4A', fontWeight: 500, transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#E6F7F5'; e.currentTarget.style.borderColor = '#00A896' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F0FDFB'; e.currentTarget.style.borderColor = '#D1FAE5' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <User style={{ width: 14, height: 14, color: '#00A896' }} />
                          <span>Vincular a um Lead</span>
                        </div>
                        <ChevronRight style={{ width: 14, height: 14, color: '#94A3B8' }} />
                      </button>
                    )}
                  </div>
                )}

                {/* Histórico CRM — colapsável */}
                <div style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => setCollapseHistory(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                  >
                    <span>Histórico CRM</span>
                    {collapseHistory ? <ChevronRight style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                  </button>
                  {!collapseHistory && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { action: 'Lead criado',      time: '2 dias atrás', color: '#60A5FA' },
                        { action: 'Contato realizado', time: '1 dia atrás',  color: '#2DD4BF' },
                        { action: 'Visita agendada',   time: 'Hoje',         color: '#FBBF24' },
                      ].map((ev, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0FDFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: ev.color, marginTop: 5, flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 500, color: '#1A2B4A', margin: 0 }}>{ev.action}</p>
                            <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>{ev.time}</p>
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
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', background: '#FFFFFF' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Histórico de eventos</p>
                {historyLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#00A896] border-t-transparent" />
                  </div>
                ) : convHistory.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#64748B', textAlign: 'center', padding: '32px 0' }}>Nenhum evento registrado</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {convHistory.map(ev => (
                      <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 8, transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F0FDFB')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div className={eventDotColor(ev.event_type)} style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: '#1A2B4A', margin: 0, lineHeight: 1.4 }}>{ev.description || ev.event_type}</p>
                          {ev.user_name && (
                            <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>{ev.user_name}</p>
                          )}
                          <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: 32 }}>
                <div style={{ width: 56, height: 56, background: '#E6F7F5', border: '2px solid #B2E8E2', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 28 }}>
                  💬
                </div>
                <p style={{ color: '#1A2B4A', fontSize: 13, fontWeight: 500, margin: '0 0 4px' }}>Selecione uma conversa</p>
                <p style={{ color: '#94A3B8', fontSize: 12, margin: 0 }}>
                  para ver os detalhes do contato
                </p>
              </div>
            )}
          </div>
        )}

        {/* Send error toast */}
        {sendError && (
          <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'none' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 12, fontWeight: 600, padding: '10px 16px', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
              {sendError}
            </div>
          </div>
        )}
        </div>{/* end flex 3-column row */}
      </div>{/* end main outer container */}

      {/* Feature 4: ContactCard drawer */}
      <ContactCard
        mode="drawer"
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        institutionId={user?.institution_id || ''}
        initialData={activeConv ? {
          lead_id:              activeConv.lead_id,
          remote_jid:           activeConv.id,
          name:                 activeConv.name,
          phone:                activeConv.phone,
          contact_type:         activeConv.contact_type,
          tags:                 activeConv.tags,
          profile_picture_url:  activeConv.profile_picture_url,
          assigned_user_name:   activeConv.assigned_user_name,
          assigned_user_id:     activeConv.assigned_user_id,
          status:               activeConv.status,
        } : {}}
        allConversations={conversations}
        onUpdate={updates => {
          if (activeConv) setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, ...updates } : c))
        }}
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
