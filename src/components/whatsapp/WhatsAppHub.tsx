import React, { useState, useRef, useEffect, useCallback } from 'react'
import EmojiPicker from '@emoji-mart/react'
import emojiData from '@emoji-mart/data'
import {
  MessageCircle, Search, Plus, Info, Paperclip, Mic, Smile, Send,
  Play, Pause, FileText, Image, Video, ChevronDown, ChevronRight, ChevronLeft,
  CheckCheck, Check, Zap, Settings, User, Users, Download,
  X, MoreVertical, CornerUpLeft, SmilePlus, Edit, Trash2
} from 'lucide-react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, WhatsappMessage, WhatsappConversation, WhatsappConversationEvent, User as UserType, supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type MsgType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'deleted'
type ConvStatus = 'waiting' | 'open' | 'closed'
type RightPanelTab = 'details' | 'history'
interface Message {
  id: string
  type: MsgType
  content: string
  from: 'me' | 'them'
  ts: Date
  status: 'sent' | 'delivered' | 'read' | 'failed'
  duration?: number
  fileName?: string
  fileSize?: string
  media_url?: string
  message_id?: string
  senderName?: string
  isTemplate?: boolean
  quoted_message_id?: string
  quoted_content?: string
  quoted_from_me?: boolean
  reaction?: string | null
  reaction_attendant?: string | null
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
  bot_active?: boolean
  satisfaction_score?: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ConvStatus, { label: string; badge: string; dot: string }> = {
  waiting: { label: 'Aguardando',     badge: 'bg-[#FEF3C7] text-[#D97706]',   dot: 'bg-[#D97706]' },
  open:    { label: 'Em Atendimento', badge: 'bg-[#D1FAE5] text-[#059669]',   dot: 'bg-[#059669]' },
  closed:  { label: 'Concluído',      badge: 'bg-[#E2E8F0] text-[#64748B]',   dot: 'bg-[#94A3B8]' },
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
    case 'imageMessage':
    case 'image':               return 'image'
    case 'audioMessage':
    case 'audio':
    case 'ptt':                 return 'audio'
    case 'videoMessage':
    case 'video':               return 'video'
    case 'documentMessage':
    case 'document':            return 'document'
    case 'stickerMessage':
    case 'sticker':             return 'sticker'
    case 'extendedTextMessage': return 'text'
    case 'deleted':             return 'deleted'
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

function normalizeJid(jid: string): string {
  return jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
}

function rawJid(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
}

function buildConversations(msgs: WhatsappMessage[], convMap?: Map<string, WhatsappConversation>): Conversation[] {
  const byJid = new Map<string, WhatsappMessage[]>()
  msgs.forEach(m => {
    if (!byJid.has(m.remote_jid)) byJid.set(m.remote_jid, [])
    byJid.get(m.remote_jid)!.push(m)
  })

  const result: Conversation[] = Array.from(byJid.entries()).map(([jid, jidMsgs]) => {
    const sorted = [...jidMsgs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const last = sorted[sorted.length - 1]
    const normJid = normalizeJid(jid)
    const isGroup = normJid.endsWith('@g.us')
    const convData = convMap?.get(normJid) || convMap?.get(jid)

    let name: string
    if (isGroup) {
      name = jidMsgs.find(m => m.contact_name)?.contact_name || normJid.replace(/@g\.us$/, '')
    } else {
      // convData.contact_name (manually edited) takes priority over the WhatsApp-API name from messages
      name = convData?.contact_name
        || jidMsgs.find(m => !m.from_me && m.contact_name)?.contact_name
        || formatPhone(normJid)
      console.log('[BUILD CONV] nome:', convData?.contact_name, '| jid:', normJid)
    }

    return {
      id: normJid,
      name,
      phone: isGroup ? normJid.replace(/@g\.us$/, '') : formatPhone(normJid),
      avatarColor: jidToColor(normJid),
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
      bot_active: (convData as any)?.bot_active ?? false,
      satisfaction_score: (convData as any)?.satisfaction_score ?? null,
      messages: sorted
        .filter((m, idx, self) => idx === self.findIndex(t => (t.message_id && t.message_id === m.message_id) || t.id === m.id))
        .map(m => {
          console.log('[BUILD] msg type:', m.message_type, '| media_url:', m.media_url?.slice(0, 50))
          return {
            id: m.id,
            type: mapMsgType(m.message_type),
            content: m.content,
            from: m.from_me ? 'me' : 'them' as 'me' | 'them',
            ts: new Date(m.timestamp),
            status: (m.status as Message['status']) || 'sent',
            media_url: m.media_url,
            message_id: m.message_id,
            senderName: m.from_me ? (m.contact_name || undefined) : undefined,
            quoted_message_id: m.quoted_message_id,
            quoted_content:    m.quoted_content,
            quoted_from_me:    m.quoted_from_me,
            reaction:           (m as any).reaction || null,
            reaction_attendant: (m as any).reaction_attendant || null,
          }
        }),
    }
  })

  // Include conversations that exist in whatsapp_conversations but have no messages loaded
  if (convMap) {
    const coveredJids = new Set(result.map(c => c.id))
    for (const [remoteJid, conv] of convMap.entries()) {
      const normJid = normalizeJid(remoteJid)
      if (coveredJids.has(normJid) || coveredJids.has(remoteJid)) continue
      if (!conv.last_message && !conv.last_message_at) continue
      const isGroup = normJid.endsWith('@g.us')
      result.push({
        id: normJid,
        name: conv.contact_name || formatPhone(normJid),
        phone: isGroup ? normJid.replace(/@g\.us$/, '') : formatPhone(normJid),
        avatarColor: jidToColor(normJid),
        lastMessage: conv.last_message || '',
        lastTime: conv.last_message_at ? new Date(conv.last_message_at) : new Date(0),
        unreadCount: conv.unread_count ?? 0,
        status: ((conv.status ?? 'waiting') as ConvStatus),
        online: false,
        labels: [],
        isGroup,
        lead_id: conv.lead_id,
        assigned_user_id: conv.assigned_user_id,
        assigned_user_name: conv.assigned_user_name,
        contact_type: conv.contact_type,
        tags: conv.tags || [],
        profile_picture_url: conv.profile_picture_url,
        satisfaction_score: (conv as any).satisfaction_score ?? null,
        messages: [],
      })
    }
  }

  return result.sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime())
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

function buildTemplatePreview(tmpl: any, vars: Record<string, string>): string {
  if (!tmpl) return '[Template]'
  const bodyComp = tmpl.components?.find((c: any) => c.type === 'BODY')
  if (!bodyComp?.text) return `[Template: ${tmpl.name}]`
  let text: string = bodyComp.text
  Object.entries(vars).forEach(([n, val]) => {
    text = text.replace(new RegExp(`\\{\\{${n}\\}\\}`, 'g'), val)
  })
  return text
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
// Supabase Storage public URLs and data: URLs are returned directly.
// Legacy Evolution API ephemeral URLs still go through the proxy.
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
  // data: URLs and already-proxied paths are used as-is
  if (raw.startsWith('data:') || raw.startsWith('/api/')) return raw
  // Supabase Storage public URLs: use directly (no proxy needed)
  if (raw.includes('.supabase.co/storage/')) return raw
  // Evolution API ephemeral URLs: route through proxy
  const msgId = message.key?.id || message.message_id || message.id || ''
  const idParam = msgId ? `&messageId=${encodeURIComponent(msgId)}` : ''
  const instParam = instanceName ? `&instanceName=${encodeURIComponent(instanceName)}` : ''
  return `/api/evolution/media-proxy?url=${encodeURIComponent(raw)}${idParam}${instParam}`
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

async function handleDownload(url: string, filename: string) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

// ─── RenderMessageContent ─────────────────────────────────────────────────────
function RenderMessageContent({ message, fromMe, instanceName, onImageClick }: { message: any; fromMe: boolean; instanceName?: string; onImageClick?: (url: string) => void }) {
  const msgType = (
    message.type ||
    message.message_type ||
    message.messageType ||
    (message.message?.imageMessage    ? 'image'    : '') ||
    (message.message?.videoMessage    ? 'video'    : '') ||
    (message.message?.audioMessage    ? 'audio'    : '') ||
    (message.message?.ptvMessage      ? 'audio'    : '') ||
    (message.message?.documentMessage ? 'document' : '') ||
    'text'
  ).toLowerCase().replace('message', '')

  if (msgType === 'deleted') {
    const rawBody = message.body || message.content || message.conversation || ''
    const hasOriginal = rawBody.includes('~~') && rawBody.includes('🚫 Apagada')
    const originalText = hasOriginal ? rawBody.replace(/~~(.+?)~~ 🚫 Apagada/, '$1') : ''
    return (
      <div>
        {hasOriginal && (
          <span style={{ display: 'block', fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.5)' : '#94A3B8', textDecoration: 'line-through', fontStyle: 'italic' }}>
            {originalText}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: hasOriginal ? 2 : 0 }}>
          <span style={{ fontSize: 11 }}>🚫</span>
          <span style={{ fontSize: 11, color: fromMe ? 'rgba(255,255,255,0.5)' : '#94A3B8', fontStyle: 'italic' }}>Mensagem apagada</span>
        </div>
      </div>
    )
  }

  if (msgType === 'interactive') {
    const body2 = message.body || message.content || ''
    return (
      <span style={{ fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.85)' : '#64748B', fontStyle: body2 ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
        {body2 || 'Menu interativo'}
      </span>
    )
  }

  const mediaUrl = getMediaUrl(message, instanceName)
  const caption  = message.caption || message.message?.imageMessage?.caption || ''
  const body     = message.body || message.content || message.conversation ||
                   message.message?.conversation || ''

  console.log('[MEDIA]', message.message_type || message.messageType || msgType, '| media_url:', message.media_url, '| mediaUrl resolved:', mediaUrl, '| content:', (message.content || '').slice(0, 60))

  if (msgType === 'image' && mediaUrl) {
    return (
      <div>
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          <img
            src={mediaUrl}
            alt="imagem"
            style={{ maxWidth: 260, maxHeight: 320, width: '100%', borderRadius: 10, display: 'block', cursor: 'pointer', objectFit: 'cover' }}
            onClick={() => onImageClick ? onImageClick(mediaUrl) : window.open(mediaUrl, '_blank')}
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
          <button
            onClick={() => handleDownload(mediaUrl, `imagem_${Date.now()}.jpg`)}
            style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
            title="Baixar"
          >
            <DownloadIcon />
          </button>
        </div>
        {caption && <p style={{ fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.85)' : '#64748B', marginTop: 6 }}>{caption}</p>}
      </div>
    )
  }

  if (msgType === 'image' && !mediaUrl) {
    return <span style={{ fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.7)' : '#64748B' }}>📷 Imagem</span>
  }

  if (msgType === 'video' && mediaUrl) {
    return (
      <div style={{ maxWidth: 260, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
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
        <button
          onClick={() => handleDownload(mediaUrl, `video_${Date.now()}.mp4`)}
          style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Baixar vídeo"
        >
          <DownloadIcon />
        </button>
      </div>
    )
  }

  if ((msgType === 'audio' || msgType === 'ptt') && mediaUrl) {
    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <AudioPlayer duration={message.duration} from={fromMe ? 'me' : 'them'} mediaUrl={mediaUrl} isDark={fromMe} />
        <button
          onClick={() => handleDownload(mediaUrl, `audio_${Date.now()}.mp3`)}
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          title="Baixar áudio"
        >
          <DownloadIcon />
        </button>
      </div>
    )
  }

  if (msgType === 'document') {
    const filename = message.fileName || message.message?.documentMessage?.fileName || body || 'Documento'
    const docUrl = mediaUrl || (body?.startsWith('http') ? body : null)
    if (docUrl) {
      return (
        <div
          onClick={() => window.open(docUrl, '_blank')}
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
    return <span style={{ fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.7)' : '#64748B' }}>📄 {filename}</span>
  }

  if (msgType === 'sticker' && mediaUrl) {
    return <img src={mediaUrl} alt="sticker" style={{ width: 100, height: 100, objectFit: 'contain' }} />
  }

  if (!body && !mediaUrl) {
    return <span style={{ color: fromMe ? 'rgba(255,255,255,0.5)' : '#94A3B8', fontStyle: 'italic', fontSize: 13 }}>...</span>
  }
  return <span style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</span>
}

// ─── Quick emoji set for reaction picker ────────────────────────────────────
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg, onImageClick, instanceName, contactName, onReply, onReact,
}: {
  msg: Message
  onImageClick?: (url: string) => void
  instanceName?: string
  contactName?: string
  onReply?: (m: Message) => void
  onReact?: (m: Message, emoji: string) => void
}) {
  const isMe = msg.from === 'me'
  const [hovered, setHovered]                 = useState(false)
  const [showReactPicker, setShowReactPicker] = useState(false)
  const [pickerBelow, setPickerBelow]         = useState(false)
  const pickRef  = useRef<HTMLDivElement>(null)
  const smileRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!showReactPicker) return
    const handler = (e: MouseEvent) => {
      if (pickRef.current && !pickRef.current.contains(e.target as Node)) {
        setShowReactPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showReactPicker])

  const handleTogglePicker = (ev: React.MouseEvent) => {
    ev.stopPropagation()
    if (!showReactPicker) {
      // If bubble is near the top of the viewport, open downward instead
      const rect = smileRef.current?.getBoundingClientRect()
      setPickerBelow(rect ? rect.top < 120 : false)
    }
    setShowReactPicker(v => !v)
  }

  const hasAnyReaction = !!(msg.reaction || msg.reaction_attendant)
  const reactionBadge  = [msg.reaction, msg.reaction_attendant].filter(Boolean).join(' ')

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
      display: 'flex',
      justifyContent: isMe ? 'flex-end' : 'flex-start',
      marginBottom: hasAnyReaction ? 18 : 3,
      paddingLeft: isMe ? '15%' : 0,
      paddingRight: isMe ? 0 : '15%',
      position: 'relative',
    }}>
      {(hovered || showReactPicker) && msg.type !== 'deleted' && (
        <div style={{
          position: 'absolute',
          top: '50%', transform: 'translateY(-50%)',
          [isMe ? 'left' : 'right']: 'calc(100% - 10px)',
          display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
        }}>
          <button
            onClick={() => onReply?.(msg)}
            title="Responder"
            style={{ width: 28, height: 28, borderRadius: '50%', background: '#F0FDFB', border: '1px solid #B2E8E2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00A896' }}
          >
            <CornerUpLeft size={13} />
          </button>
          <button
            ref={smileRef}
            onClick={handleTogglePicker}
            title="Reagir"
            style={{ width: 28, height: 28, borderRadius: '50%', background: '#FFFBF0', border: '1px solid #FDE68A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}
          >
            <SmilePlus size={13} />
          </button>
        </div>
      )}
      <div style={{
        maxWidth: '100%',
        padding: '9px 13px',
        background: isMe
          ? 'linear-gradient(135deg, #0d9488 0%, #0ea5a0 100%)'
          : '#FFFFFF',
        color: isMe ? '#fff' : '#1A2B4A',
        borderRadius: isMe ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
        border: isMe ? 'none' : '1px solid #e2f5f3',
        boxShadow: isMe
          ? '0 2px 10px rgba(13,148,136,0.30)'
          : '0 1px 4px rgba(0,0,0,0.06)',
        position: 'relative',
        overflow: 'visible',
      }}>
        {/* Reaction picker — anchored to bubble, opens above (or below near top of screen) */}
        {showReactPicker && (
          <div ref={pickRef} style={{
            position: 'absolute',
            [pickerBelow ? 'top' : 'bottom']: '100%',
            [isMe ? 'right' : 'left']: 0,
            [pickerBelow ? 'marginTop' : 'marginBottom']: 4,
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
            display: 'flex',
            alignItems: 'center',
            padding: '4px 6px',
            gap: 2,
            zIndex: 9999,
            whiteSpace: 'nowrap',
          }}>
            {QUICK_EMOJIS.map(e => (
              <button
                key={e}
                onClick={ev => { ev.stopPropagation(); onReact?.(msg, e); setShowReactPicker(false) }}
                title={e}
                style={{
                  background: msg.reaction_attendant === e ? '#E6F7F4' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  lineHeight: 1,
                  transform: msg.reaction_attendant === e ? 'scale(1.2)' : 'scale(1)',
                  transition: 'transform 0.1s',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {isMe && msg.senderName && (
          <p style={{
            margin: '0 0 4px',
            fontSize: 11,
            fontWeight: 700,
            color: msg.senderName === '_bot_' ? 'rgba(255,255,255,0.45)' : '#5eead4',
            lineHeight: 1,
          }}>
            {msg.senderName === '_bot_' ? '🤖 Robô:' : `${msg.senderName}:`}
          </p>
        )}
        {msg.isTemplate && (
          <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: isMe ? 'rgba(255,255,255,0.6)' : '#0d9488', background: isMe ? 'rgba(255,255,255,0.15)' : '#ccfbf1', borderRadius: 4, padding: '1px 5px', marginBottom: 4 }}>
            🔖 Template
          </span>
        )}
        {msg.quoted_content && (
          <div style={{
            borderLeft: '3px solid',
            borderColor: isMe ? 'rgba(255,255,255,0.6)' : '#00A896',
            background: isMe ? 'rgba(0,0,0,0.15)' : 'rgba(0,168,150,0.08)',
            borderRadius: '4px',
            padding: '6px 10px',
            marginBottom: 6,
            cursor: 'default',
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: isMe ? 'rgba(255,255,255,0.9)' : '#00A896',
              marginBottom: 2,
            }}>
              {msg.quoted_from_me ? 'Você' : (contactName || 'Contato')}
            </div>
            <div style={{
              fontSize: 12,
              color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--color-text-secondary)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as any,
              overflow: 'hidden',
            }}>
              {msg.quoted_content}
            </div>
          </div>
        )}
        <RenderMessageContent message={msg} fromMe={isMe} instanceName={instanceName} onImageClick={onImageClick} />
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
          {isMe && (() => {
            if (msg.status === 'failed') {
              return <span style={{ fontSize: 12, color: '#EF4444' }} title="Falha ao enviar">⚠</span>
            }
            const color = msg.status === 'read' ? '#0DD3BF' : 'rgba(255,255,255,0.45)'
            const showDouble = msg.status === 'delivered' || msg.status === 'read'
            return (
              <svg width={showDouble ? 18 : 12} height="11" viewBox={showDouble ? '0 0 18 11' : '0 0 12 11'} fill="none">
                <path d={showDouble ? 'M1 5.5L5 9.5L15 1.5' : 'M1 5.5L5 9.5L11 1.5'}
                  stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                {showDouble && (
                  <path d="M6 5.5L10 9.5L18 1.5"
                    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                )}
              </svg>
            )
          })()}
        </div>
        {hasAnyReaction && (
          <div style={{
            position: 'absolute',
            bottom: -12,
            [isMe ? 'right' : 'left']: 4,
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 999,
            padding: '1px 5px',
            fontSize: 14,
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            zIndex: 2,
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
          }}>
            {reactionBadge}
          </div>
        )}
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
interface WhatsAppHubProps {
  institutionId?: string
  isAionInbox?: boolean
}

// Module-level set so it survives re-renders and StrictMode double-mounts
const CLOSING_IDS = new Set<string>()

// ─── Gerenciador de respostas rápidas pessoais do atendente ────────────────────
interface PersonalQuickReply {
  id: string
  title: string
  message: string
  shortcut: string | null
  order_index: number
}

function QuickReplyManagerModal({ isOpen, onClose, institutionId, userId, onSaved }: {
  isOpen: boolean; onClose: () => void; institutionId: string; userId: string; onSaved: () => void
}) {
  const [items, setItems] = useState<PersonalQuickReply[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<PersonalQuickReply | null>(null)
  const [form, setForm] = useState({ shortcut: '', title: '', message: '' })
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('whatsapp_quick_replies')
      .select('id, title, message, shortcut, order_index')
      .eq('institution_id', institutionId)
      .eq('user_id', userId)
      .order('order_index', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { if (isOpen) load() }, [isOpen])

  const startNew = () => { setEditing(null); setForm({ shortcut: '', title: '', message: '' }); setShowForm(true); setError('') }
  const startEdit = (item: PersonalQuickReply) => { setEditing(item); setForm({ shortcut: item.shortcut || '', title: item.title, message: item.message }); setShowForm(true); setError('') }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const shortcut = form.shortcut.trim() ? (form.shortcut.trim().startsWith('/') ? form.shortcut.trim() : `/${form.shortcut.trim()}`) : null
    const payload = { institution_id: institutionId, user_id: userId, title: form.title.trim(), message: form.message.trim(), shortcut }
    const { error: err } = editing
      ? await supabase.from('whatsapp_quick_replies').update(payload).eq('id', editing.id)
      : await supabase.from('whatsapp_quick_replies').insert(payload)
    if (err) { setError(err.message || 'Erro ao salvar'); return }
    setShowForm(false)
    await load()
    onSaved()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta resposta rápida?')) return
    await supabase.from('whatsapp_quick_replies').delete().eq('id', id)
    await load()
    onSaved()
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>⚡ Minhas Respostas Rápidas</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
        </div>

        {showForm ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#DC2626' }}>{error}</div>}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Atalho (opcional, ex: /oi)</label>
              <input value={form.shortcut} onChange={e => setForm(f => ({ ...f, shortcut: e.target.value }))} placeholder="/oi"
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Título *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Saudação inicial"
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Conteúdo *</label>
              <textarea required rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Texto completo da resposta"
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748B' }}>Cancelar</button>
              <button type="submit" style={{ padding: '8px 16px', borderRadius: 9, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
            </div>
          </form>
        ) : (
          <>
            <button onClick={startNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>
              <Plus size={14} /> Nova resposta
            </button>
            {loading ? (
              <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>Carregando...</p>
            ) : items.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>Nenhuma resposta pessoal cadastrada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(item => (
                  <div key={item.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.shortcut && <span style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '1px 6px', borderRadius: 999 }}>{item.shortcut}</span>}
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{item.title}</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{item.message}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => startEdit(item)} title="Editar" style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: '#EFF6FF', color: '#3B82F6', cursor: 'pointer' }}><Edit size={12} /></button>
                      <button onClick={() => handleDelete(item.id)} title="Excluir" style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function WhatsAppHub({ institutionId: propInstitutionId, isAionInbox = false }: WhatsAppHubProps = {}) {
  const { user } = useAuth()
  const effectiveInstitutionId = propInstitutionId ?? user?.institution_id ?? ''
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const phoneParam = searchParams.get('phone')
  const nameParam  = searchParams.get('name')

  const instance = effectiveInstitutionId ? `inst-${effectiveInstitutionId.slice(0, 8)}` : ''

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'abertos' | 'concluido' | 'ambos'>('abertos')
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all')
  const [assignFilter, setAssignFilter] = useState<'all' | 'mine' | 'none'>('all')
  const [canSeeAllConversations, setCanSeeAllConversations] = useState(false)
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
  const [collapseContact, setCollapseContact] = useState(false)
  const [collapseAtendimento, setCollapseAtendimento] = useState(false)
  const [collapseLead, setCollapseLead] = useState(false)
  const [collapseAvaliacao, setCollapseAvaliacao] = useState(true)
  const [sendError, setSendError] = useState<string | null>(null)
  const [recorderState, setRecorderState] = useState<'idle' | 'recording' | 'preview'>('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(20).fill(0.2))
  const [linkingLead, setLinkingLead] = useState(false)
  const [leadSearch, setLeadSearch] = useState('')
  const [leadResults, setLeadResults] = useState<any[]>([])

  // New state variables
  const [showNewConvModal, setShowNewConvModal] = useState(false)
  const [newConvPhone, setNewConvPhone] = useState('')
  const [newConvName, setNewConvName] = useState('')
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [leadForm, setLeadForm] = useState({ responsible_name: '', student_name: '', phone: '', email: '', grade_interest: '', source: 'WhatsApp' })
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [addingTag, setAddingTag] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [hubTags, setHubTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [quickReplies, setQuickReplies] = useState<{ id: string; label: string; text: string; shortcut: string | null; user_id: string | null }[]>([])
  const [showQRManager, setShowQRManager] = useState(false)
  const [slashMenuDismissed, setSlashMenuDismissed] = useState(false)
  const [slashHighlightIndex, setSlashHighlightIndex] = useState(0)
  const [flowConfig, setFlowConfig] = useState<{ satisfaction_survey_enabled: boolean; satisfaction_message: string } | null>(null)

  // Edit contact inline form
  const [editingContact, setEditingContact] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', contact_type: '', notes: '' })
  const [leadCrmEvents, setLeadCrmEvents] = useState<{ label: string; time: string; color: string }[]>([])
  const [leadCrmLoading, setLeadCrmLoading] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templates, setTemplates] = useState<{ id: string; name: string; language: string; components: any[] }[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({})
  const [sendingTemplate, setSendingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [institutionName, setInstitutionName] = useState('')
  const [sendingReactivate, setSendingReactivate] = useState(false)
  const [hubToast, setHubToast] = useState<string | null>(null)

  // Template panel for new outbound conversations
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)

  // Lead data for right panel
  const [leadData, setLeadData] = useState<any>(null)
  const [editingLead, setEditingLead] = useState(false)
  const [leadEditForm, setLeadEditForm] = useState<any>({})
  const [savingLead, setSavingLead] = useState(false)

  // New feature states
  const [showMsgSearch, setShowMsgSearch] = useState(false)
  const [msgSearchText, setMsgSearchText] = useState('')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Feature 1: Connection status
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')
  const [windowExpired, setWindowExpired] = useState(false)

  // Meta API state
  const [useMetaApi, setUseMetaApi] = useState(false)
  const [metaConfig, setMetaConfig] = useState<{ phone_id: string; token: string } | null>(null)

  // Sync state
  const [syncing, setSyncing] = useState(false)

  // Typing indicator
  const [typingConvIds, setTypingConvIds] = useState<Set<string>>(new Set())
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Mobile responsiveness
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobilePanel, setMobilePanel] = useState<'list' | 'chat'>('list')

  // [FIX P3] Reply-to state
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  useEffect(() => {
    const handler = () => { const m = window.innerWidth < 768; setIsMobile(m); if (!m) setMobilePanel('list') }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])


  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const waveformAnimRef = useRef<number | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const recordingMimeTypeRef = useRef<string>('')
  const phoneParamHandledRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const notifAudioRef = useRef<HTMLAudioElement | null>(null)
  const activeIdRef            = useRef<string | null>(null)
  const conversationsRef       = useRef<typeof conversations>([])
  const skipNextNameUpdateRef  = useRef<string | null>(null)
  // closingIdsRef replaced by module-level CLOSING_IDS

  // Keep refs in sync so realtime handlers can read the latest values
  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  // Permissão de visibilidade ampla do usuário logado — controla o dropdown
  // de atribuição e o grupo "Outras conversas" (o RLS no banco já bloqueia
  // os dados; isso é só para não exibir um filtro/grupo que não teria efeito).
  useEffect(() => {
    if (!user?.id) return
    supabase.from('users').select('can_see_all_conversations').eq('id', user.id).maybeSingle()
      .then(({ data }) => setCanSeeAllConversations(!!data?.can_see_all_conversations))
  }, [user?.id])

  const isPrivilegedRole = user?.role === 'admin' || user?.role === 'manager' || user?.user_type === 'admin_geral'
  const canSeeAll = isPrivilegedRole || canSeeAllConversations

  // Limite (em horas) configurado pela instituição para considerar uma
  // conversa atribuída "parada" — usado só para exibir "Parada há Xh" e
  // decidir o agrupamento no cliente; a regra de fato é aplicada no RLS.
  const [staleHours, setStaleHours] = useState(24)
  useEffect(() => {
    if (!effectiveInstitutionId) return
    supabase.from('whatsapp_flows').select('stale_conversation_hours').eq('institution_id', effectiveInstitutionId).maybeSingle()
      .then(({ data }) => setStaleHours(data?.stale_conversation_hours ?? 24))
  }, [effectiveInstitutionId])

  const isConvStale = (conv: Conversation) =>
    !!conv.assigned_user_id &&
    conv.assigned_user_id !== user?.id &&
    conv.status === 'waiting' &&
    (Date.now() - conv.lastTime.getTime()) > staleHours * 3600 * 1000

  const hoursSince = (date: Date) => Math.max(1, Math.floor((Date.now() - date.getTime()) / 3600000))

  // (leadData useEffect moved below activeConv definition — see below)

  // Request browser notification permission on first load
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    // Create a short beep via Web Audio API (no external file needed)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.sin(2 * Math.PI * 880 * i / ctx.sampleRate) * Math.exp(-i / (ctx.sampleRate * 0.05))
        }
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        // Only create the AudioContext, don't play yet
        notifAudioRef.current = { ctx, buf } as any
      }
    } catch {}
  }, [])

  // [FIX P1] Stop mic stream only on unmount — keep it alive between recordings so Chrome
  // doesn't lose the permission grant after the first stopRecordingForPreview call.
  useEffect(() => {
    return () => { audioStreamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  const startRecording = async () => {
    if (!activeId) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setSendError('Seu browser não suporta gravação de áudio.')
      return
    }
    try {
      // [FIX P4] Pre-check: verify at least one audio input device exists before calling
      // getUserMedia — avoids a confusing NotFoundError when the device is disconnected.
      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasAudio = devices.some(d => d.kind === 'audioinput')
        if (!hasAudio) {
          setSendError('Nenhum microfone encontrado. Conecte um microfone e tente novamente.')
          return
        }
      }

      // Reuse existing stream if still active — avoids repeated permission prompts in Chrome
      let stream = audioStreamRef.current
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        })
        audioStreamRef.current = stream
      }
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      recordingMimeTypeRef.current = mimeType

      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioPreviewUrl(url)
        if (waveformAnimRef.current) {
          cancelAnimationFrame(waveformAnimRef.current)
          waveformAnimRef.current = null
        }
        analyserRef.current = null
        setWaveformBars(Array(20).fill(0.2))
        setRecorderState('preview')
      }
      recorder.start(100)
      mediaRecorderRef.current = recorder

      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() =>
        setRecordingSeconds(s => s + 1), 1000)

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          const src = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 64
          src.connect(analyser)
          analyserRef.current = analyser
          const animate = () => {
            if (!analyserRef.current) return
            const data = new Uint8Array(analyserRef.current.frequencyBinCount)
            analyserRef.current.getByteFrequencyData(data)
            const bars = Array.from({ length: 20 }, (_, i) => {
              const idx = Math.floor(i * data.length / 20)
              return Math.max(0.1, (data[idx] ?? 0) / 255)
            })
            setWaveformBars(bars)
            waveformAnimRef.current = requestAnimationFrame(animate)
          }
          waveformAnimRef.current = requestAnimationFrame(animate)
        }
      } catch {}

      setRecorderState('recording')
    } catch (err: any) {
      console.error('[AUDIO] getUserMedia error:', err?.name, err?.message, err)
      // [FIX P4] Clear the stream ref so it isn't reused next time if it's invalid
      audioStreamRef.current?.getTracks().forEach(t => t.stop())
      audioStreamRef.current = null
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setSendError('Permissão de microfone negada. Clique no 🔒 na barra de endereço e permita o acesso ao microfone.')
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setSendError('Microfone não encontrado. Verifique se há um microfone conectado ao dispositivo.')
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        setSendError('Microfone em uso por outro aplicativo. Feche outros apps e tente novamente.')
      } else if (err?.name === 'OverconstrainedError') {
        setSendError('Configurações de áudio não suportadas pelo microfone. Tente novamente.')
      } else {
        setSendError('Erro ao acessar microfone: ' + (err?.message || 'desconhecido'))
      }
    }
  }

  const stopRecordingForPreview = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
    // [FIX P1] Do NOT stop the stream here — keep it alive so the next startRecording
    // can reuse it without triggering a new Chrome permission prompt.
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
  }

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    audioStreamRef.current?.getTracks().forEach(t => t.stop())
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    if (waveformAnimRef.current) { cancelAnimationFrame(waveformAnimRef.current); waveformAnimRef.current = null }
    analyserRef.current = null
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    setAudioBlob(null)
    setAudioPreviewUrl(null)
    setRecordingSeconds(0)
    setWaveformBars(Array(20).fill(0.2))
    setRecorderState('idle')
  }

  const discardAudio = () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    setAudioBlob(null)
    setAudioPreviewUrl(null)
    setRecordingSeconds(0)
    setRecorderState('idle')
  }

  const sendAudio = async () => {
    if (!audioBlob || (!effectiveInstitutionId && !isAionInbox) || !activeId) return
    const blob = audioBlob
    const mimeType = recordingMimeTypeRef.current || blob.type
    console.log('[AUDIO] sendAudio blob.size:', blob.size, 'mimeType:', mimeType)
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1]
      try {
        const uploadRes = await fetch('/api/whatsapp/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            institution_id: effectiveInstitutionId || undefined,
            base64,
            mimetype: mimeType,
            filename: `audio-${Date.now()}.${mimeType.includes('webm') ? 'webm' : 'mp4'}`,
          }),
        })
        if (!uploadRes.ok) throw new Error(`Upload HTTP ${uploadRes.status}`)
        const { url: mediaUrl } = await uploadRes.json()
        console.log('[AUDIO] upload ok, mediaUrl:', mediaUrl)
        discardAudio()
        const to = activeId
          .replace(/@s\.whatsapp\.net$/, '')
          .replace(/@.*/, '')
          .replace(/\D/g, '')
        console.log('[AUDIO] enviando para /api/whatsapp/send, to:', to)
        const sendRes = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            institution_id: effectiveInstitutionId || undefined,
            isAionSend: isAionInbox,
            to,
            type: 'audio',
            mediaUrl,
            sender_name: user?.full_name,
            sender_user_id: user?.id,
          }),
        })
        if (!sendRes.ok) {
          const err = await sendRes.json().catch(() => ({}))
          console.error('[send-audio] error:', err)
          setSendError('Erro ao enviar áudio.')
        } else {
          await stopBotIfActive(activeId)
        }
      } catch (e) {
        console.error('[send-audio] error:', e)
        setSendError('Erro ao enviar áudio.')
        discardAudio()
      }
    }
    reader.readAsDataURL(blob)
  }

  const handleLinkLead = async (leadId: string) => {
    if (!activeId || !effectiveInstitutionId) return
    const rJid = rawJid(activeId)
    await DatabaseService.updateWhatsappMessageLead(rJid, effectiveInstitutionId, leadId)
    await DatabaseService.linkConversationLead(effectiveInstitutionId, rJid, leadId)
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, lead_id: leadId } : c))
    const found = leadResults.find(l => l.id === leadId)
    if (found) setConversations(prev => prev.map(c =>
      c.id === activeId ? { ...c, name: found.responsible_name || found.student_name || c.name } : c
    ))
    // Carregar dados do lead imediatamente no painel direito
    const { data: lead } = await supabase
      .from('leads')
      .select('id, student_name, responsible_name, phone, email, grade_interest, status, source, created_at')
      .eq('id', leadId)
      .single()
    if (lead) {
      console.log('[LEAD PANEL] linked & loaded:', lead.responsible_name)
      setLeadData(lead)
      setLeadEditForm(lead)
    }
    setLinkingLead(false)
    setLeadSearch('')
    setLeadResults([])
  }

  const searchLeads = async (q: string) => {
    setLeadSearch(q)
    if (!effectiveInstitutionId || q.length < 2) { setLeadResults([]); return }
    const results = await DatabaseService.searchLeadsByPhone(effectiveInstitutionId, q)
    const allLeads = await DatabaseService.getLeads(effectiveInstitutionId)
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
      const typingJid = normalizeJid(newMsg.remote_jid)
      setTypingConvIds(prev => new Set(prev).add(typingJid))
      setTimeout(() => setTypingConvIds(prev => {
        const next = new Set(prev); next.delete(typingJid); return next
      }), 1200)

      // Browser notification + beep when this conversation is not the active one
      if (activeIdRef.current !== typingJid) {
        // Beep via Web Audio API
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
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
        } catch {}

        // Browser Notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const contactName = newMsg.contact_name || formatPhone(typingJid)
          const preview = newMsg.content?.slice(0, 60) || '[mídia]'
          try {
            new Notification(contactName, {
              body: preview,
              icon: '/favicon.ico',
              tag: typingJid,
            })
          } catch {}
        }
      }
    }
    const isGroup = newMsg.remote_jid.endsWith('@g.us')
    const msg: Message = {
      id: newMsg.id,
      type: mapMsgType(newMsg.message_type),
      content: newMsg.content,
      from: newMsg.from_me ? 'me' : 'them',
      ts: new Date(newMsg.timestamp),
      status: (newMsg.status as Message['status']) || 'sent',
      media_url: newMsg.media_url,
      message_id: newMsg.message_id,
      quoted_message_id: newMsg.quoted_message_id,
      quoted_content:    newMsg.quoted_content,
      quoted_from_me:    newMsg.quoted_from_me,
      reaction:           (newMsg as any).reaction || null,
      reaction_attendant: (newMsg as any).reaction_attendant || null,
    }
    setConversations(prev => {
      const normJid = normalizeJid(newMsg.remote_jid)
      const existing = prev.find(c => c.id === normJid)
      if (existing) {
        if (existing.messages.some(m =>
          m.id === newMsg.id ||
          m.id === newMsg.message_id ||
          (newMsg.message_id && m.id === newMsg.message_id)
        )) return prev
        return prev.map(c => c.id === normJid
          ? {
              ...c,
              name: (!c.name || c.name === formatPhone(normJid)) && newMsg.contact_name ? newMsg.contact_name : c.name,
              messages: [...c.messages, msg],
              lastMessage: newMsg.content,
              lastTime: new Date(newMsg.timestamp),
              unreadCount: c.unreadCount + (newMsg.from_me ? 0 : 1),
              status: c.status === 'closed' ? 'waiting' as ConvStatus : c.status,
            }
          : c
        ).sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime())
      }
      const conv: Conversation = {
        id: normJid,
        name: newMsg.contact_name || (isGroup ? normJid.replace(/@g\.us$/, '') : formatPhone(normJid)),
        phone: isGroup ? normJid.replace(/@g\.us$/, '') : formatPhone(normJid),
        avatarColor: jidToColor(normJid),
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

  const loadLeadCrmEvents = async (leadId: string) => {
    setLeadCrmLoading(true)
    try {
      const [{ data: lead }, { data: visits }] = await Promise.all([
        supabase.from('leads').select('status, created_at, responsible_name, student_name').eq('id', leadId).single(),
        supabase.from('visits').select('scheduled_date, status').eq('lead_id', leadId).order('scheduled_date', { ascending: true }),
      ])
      const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      const STATUS_LABEL: Record<string, string> = {
        new: 'Lead criado', contact: 'Contato realizado', scheduled: 'Visita agendada',
        visit: 'Visita realizada', proposal: 'Proposta enviada', enrolled: 'Matriculado', lost: 'Lead perdido',
      }
      const STATUS_COLOR: Record<string, string> = {
        new: '#60A5FA', contact: '#2DD4BF', scheduled: '#FBBF24',
        visit: '#A78BFA', proposal: '#F97316', enrolled: '#34D399', lost: '#F87171',
      }
      const events = []
      if (lead) {
        events.push({ label: `Lead criado (${lead.responsible_name || lead.student_name})`, time: fmtDate(lead.created_at), color: '#60A5FA' })
        if (lead.status !== 'new') events.push({ label: STATUS_LABEL[lead.status] || lead.status, time: fmtDate(lead.created_at), color: STATUS_COLOR[lead.status] || '#94A3B8' })
      }
      ;(visits || []).forEach(v => {
        events.push({ label: `Visita ${v.status === 'completed' ? 'realizada' : 'agendada'}`, time: fmtDate(v.scheduled_date), color: '#FBBF24' })
      })
      setLeadCrmEvents(events)
    } catch {
      setLeadCrmEvents([])
    } finally {
      setLeadCrmLoading(false)
    }
  }

  const handleSaveLead = async (overrides?: Partial<typeof leadEditForm>) => {
    const form = overrides ? { ...leadEditForm, ...overrides } : leadEditForm
    if (!activeConv?.lead_id || !form) return
    setSavingLead(true)
    try {
      await supabase.from('leads').update({
        responsible_name: form.responsible_name,
        student_name: form.student_name,
        grade_interest: form.grade_interest,
        email: form.email,
        status: form.status,
      }).eq('id', activeConv.lead_id)
      setLeadData({ ...leadData, ...form })
      setLeadEditForm({ ...leadData, ...form })
      setEditingLead(false)
      setHubToast('Lead atualizado!')
      setTimeout(() => setHubToast(null), 3000)

      if (form.responsible_name && effectiveInstitutionId) {
        const normPhone = (() => {
          let d = (form.phone || '').replace(/\D/g, '')
          // Brazilian with CC: 55 + DDD(2) + [9] + local
          if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
            return d.length === 12 ? d.slice(0, 4) + '9' + d.slice(4) : d
          }
          // 10-digit bare Brazilian (no valid E.164 is 10 digits globally)
          if (d.length === 10) return '55' + d.slice(0, 2) + '9' + d.slice(2)
          // 11-digit NOT starting with '1': unambiguous Brazilian DDD (21-99)
          if (d.length === 11 && !d.startsWith('1')) return '55' + d
          // 11-digit starting with '1': could be US/CA (+1) — preserve as-is
          // 12+ digits: already has a country code — preserve as-is
          return d
        })()

        if (normPhone) {
          await supabase.from('whatsapp_contacts')
            .update({ name: form.responsible_name })
            .eq('institution_id', effectiveInstitutionId)
            .eq('phone', normPhone)

          skipNextNameUpdateRef.current = activeId
          setConversations(prev => prev.map(c =>
            c.id === activeId ? { ...c, name: form.responsible_name } : c
          ))
          await supabase.from('whatsapp_conversations')
            .update({ contact_name: form.responsible_name })
            .eq('institution_id', effectiveInstitutionId)
            .eq('remote_jid', activeId)
        }
      }
    } catch {
      setSendError('Erro ao salvar lead.')
    } finally {
      setSavingLead(false)
    }
  }

  const loadHistory = async (jid: string) => {
    if (!effectiveInstitutionId || !jid) return
    setHistoryLoading(true)
    const events = await DatabaseService.getConversationEvents(effectiveInstitutionId, jid)
    setConvHistory(events)
    setHistoryLoading(false)
  }

  const loadMessages = async () => {
    if (!effectiveInstitutionId && !isAionInbox) return
    let msgs: any[]
    let convs: any[]
    if (isAionInbox) {
      const [{ data: msgData }, { data: convData }] = await Promise.all([
        supabase.from('whatsapp_messages').select('*').eq('is_aion_inbox', true).order('timestamp', { ascending: false }),
        supabase.from('whatsapp_conversations').select('*').eq('is_aion_inbox', true),
      ])
      msgs = msgData || []
      convs = convData || []
    } else {
      ;[msgs, convs] = await Promise.all([
        DatabaseService.getWhatsappMessages(effectiveInstitutionId),
        DatabaseService.getWhatsappConversations(effectiveInstitutionId),
      ])
    }
    const convMap = new Map(convs.map((c: any) => [c.remote_jid, c]))
    const built = buildConversations(msgs, convMap)
    const timestamps = msgs.map(m => new Date(m.timestamp).getTime()).filter(Boolean)
    console.log(`[loadMessages] total=${msgs.length} oldest=${timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : 'n/a'} newest=${timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : 'n/a'}`)
    setConversations(built)
    return built
  }

  // Load on mount + check connected + realtime
  useEffect(() => {
    if (!effectiveInstitutionId && !isAionInbox) { setLoading(false); return }

    const init = async () => {
      if (isAionInbox) {
        const { data: platformWA } = await supabase
          .from('platform_whatsapp')
          .select('phone_number_id')
          .eq('connected', true)
          .maybeSingle()
        setUseMetaApi(true)
        setConnectionStatus(platformWA ? 'connected' : 'disconnected')
        setIsConnected(!!platformWA)
      } else {
        const { data: phoneRecord } = await supabase
          .from('whatsapp_phone_numbers')
          .select('id')
          .eq('institution_id', effectiveInstitutionId)
          .eq('is_active', true)
          .maybeSingle()

        if (phoneRecord) {
          setUseMetaApi(true)
          setConnectionStatus('connected')
          setIsConnected(true)
        } else {
          const inst = await DatabaseService.getInstitution(effectiveInstitutionId)
          const instAny = inst as any
          if (instAny?.whatsapp_phone_id || instAny?.whatsapp_connected) {
            setUseMetaApi(true)
            setConnectionStatus('connected')
            setIsConnected(true)
            if (instAny?.whatsapp_phone_id) {
              setMetaConfig({ phone_id: instAny.whatsapp_phone_id, token: '' })
            }
          } else {
            setIsConnected(!!inst?.evolution_instance)
          }
        }
      }

      const initialConvs = await loadMessages()
      setActiveId(prev => prev ?? (initialConvs?.[0]?.id ?? null))
      if (!isAionInbox) DatabaseService.getUsers(effectiveInstitutionId).then(setUsers).catch(() => {})

      if (!isAionInbox) {
        // Load institution name for template variables
        ;(async () => {
          try {
            const { data: instData } = await supabase
              .from('institutions')
              .select('name')
              .eq('id', effectiveInstitutionId)
              .single()
            if (instData?.name) setInstitutionName(instData.name)
          } catch {}
        })()

        // Load approved templates
        ;(async () => {
          try {
            const { data } = await supabase
              .from('whatsapp_templates')
              .select('id, name, language, components')
              .eq('institution_id', effectiveInstitutionId)
              .eq('status', 'approved')
            if (data) setTemplates(data)
          } catch {}
        })()

        // Load quick replies from DB (globais + pessoais — RLS já filtra;
        // aqui só ordenamos pessoais primeiro, depois globais)
        ;(async () => {
          try {
            const { data } = await supabase
              .from('whatsapp_quick_replies')
              .select('id, title, message, order_index, user_id, shortcut')
              .eq('institution_id', effectiveInstitutionId)
              .order('order_index', { ascending: true })
            if (data) {
              const mapped = data.map((r: any) => ({ id: r.id, label: r.title, text: r.message, shortcut: r.shortcut ?? null, user_id: r.user_id ?? null }))
              mapped.sort((a, b) => (a.user_id ? 0 : 1) - (b.user_id ? 0 : 1))
              setQuickReplies(mapped)
            }
          } catch {}
        })()

        // Load flow config (satisfaction survey toggle)
        ;(async () => {
          try {
            const { data } = await supabase
              .from('whatsapp_flows')
              .select('satisfaction_survey_enabled, satisfaction_message')
              .eq('institution_id', effectiveInstitutionId)
              .maybeSingle()
            if (data) setFlowConfig({
              satisfaction_survey_enabled: !!(data as any).satisfaction_survey_enabled,
              satisfaction_message: (data as any).satisfaction_message || 'Como você avalia nosso atendimento hoje? Seu feedback é muito importante para nós! 😊',
            })
          } catch {}
        })()

        // Load whatsapp_tags for tag dropdown
        ;(async () => {
          try {
            const { data } = await supabase
              .from('whatsapp_tags')
              .select('id, name, color')
              .eq('institution_id', effectiveInstitutionId)
              .order('name')
            if (data) setHubTags(data as { id: string; name: string; color: string }[])
          } catch {}
        })()
      }

      setLoading(false)
    }
    init()

    const msgFilter = isAionInbox ? `is_aion_inbox=eq.true` : `institution_id=eq.${effectiveInstitutionId}`
    const channelSuffix = isAionInbox ? 'aion' : effectiveInstitutionId

    const msgChannel = supabase
      .channel(`wamsg-${channelSuffix}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'whatsapp_messages',
        filter: msgFilter
      }, (payload) => {
        const msg    = payload.new as WhatsappMessage
        const msgJid = msg.remote_jid || ''
        console.log('[REALTIME MSG] INSERT', msgJid, '| CLOSING_IDS tem?', CLOSING_IDS.has(msgJid), CLOSING_IDS.has(normalizeJid(msgJid)))
        if (CLOSING_IDS.has(msgJid) || CLOSING_IDS.has(normalizeJid(msgJid))) {
          console.log('[REALTIME MSG] ignorado — está em CLOSING_IDS')
          return
        }
        addMessageToConversations(msg)
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'whatsapp_messages',
        filter: msgFilter
      }, (payload) => {
        const updated = payload.new as WhatsappMessage & { reaction?: string | null; reaction_attendant?: string | null }
        setConversations(prev => prev.map(conv => {
          const normJid = normalizeJid(updated.remote_jid)
          if (conv.id !== normJid) return conv
          return {
            ...conv,
            messages: conv.messages.map(m =>
              m.id === updated.id || m.id === updated.message_id
                ? {
                    ...m,
                    status:             (updated.status as Message['status']) || m.status,
                    reaction:           updated.reaction           !== undefined ? updated.reaction           : m.reaction,
                    reaction_attendant: updated.reaction_attendant !== undefined ? updated.reaction_attendant : m.reaction_attendant,
                  }
                : m
            ),
          }
        }))
      })
      .subscribe()

    const convFilter = isAionInbox ? `is_aion_inbox=eq.true` : `institution_id=eq.${effectiveInstitutionId}`
    const convChannel = supabase
      .channel(`waconv-${channelSuffix}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: msgFilter
      }, (payload: any) => {
        const msgJid = payload.new?.remote_jid || ''
        if (normalizeJid(msgJid) === activeIdRef.current) {
          loadMessages()
        }
        setConversations(prev => prev.map(c =>
          c.id === normalizeJid(msgJid)
            ? {
                ...c,
                lastMessage: payload.new?.content || '',
                lastTime: new Date(payload.new?.timestamp || Date.now())
              }
            : c
        ))
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_conversations',
        filter: convFilter
      }, (payload: any) => {
        console.log('[RT] UPDATE conversa recebido:', payload.new?.remote_jid, payload.new?.contact_name)
        const normJid = normalizeJid(payload.new?.remote_jid || '')

        if (skipNextNameUpdateRef.current === normJid) {
          skipNextNameUpdateRef.current = null
          return
        }

        setConversations(prev => prev.map(c => {
          if (c.id !== normJid) return c
          return {
            ...c,
            name: payload.new?.contact_name || c.name,
            status: payload.new?.status || c.status,
            contact_type: payload.new?.contact_type || c.contact_type,
            lead_id: payload.new?.lead_id || c.lead_id,
            tags: payload.new?.tags || c.tags,
            assigned_user_id:   'assigned_user_id'   in payload.new ? payload.new.assigned_user_id   : c.assigned_user_id,
            assigned_user_name: 'assigned_user_name' in payload.new ? payload.new.assigned_user_name : c.assigned_user_name,
          }
        }))
      })
      .subscribe()

    let leadsChannel: ReturnType<typeof supabase.channel> | null = null
    if (effectiveInstitutionId) {
      leadsChannel = supabase
        .channel(`leads-${channelSuffix}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: `institution_id=eq.${effectiveInstitutionId}`
        }, (payload: any) => {
          const currentLeadId = conversationsRef.current.find(c => c.id === activeIdRef.current)?.lead_id
          if (payload.new?.id === currentLeadId) {
            setLeadData(payload.new)
            setLeadEditForm(payload.new)
          }
          if (payload.new?.responsible_name) {
            setConversations(prev => prev.map(c =>
              c.lead_id === payload.new.id
                ? { ...c, name: payload.new.responsible_name }
                : c
            ))
          }
        })
        .subscribe()
    }

    const interval = setInterval(loadMessages, 60000)
    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(convChannel)
      if (leadsChannel) supabase.removeChannel(leadsChannel)
      clearInterval(interval)
    }
  }, [effectiveInstitutionId, isAionInbox])

  const prevConnectionStatusRef = useRef<string>('unknown')

  // Feature 1: Connection status polling (só Evolution — Meta API não precisa de polling)
  useEffect(() => {
    if (!effectiveInstitutionId || useMetaApi) return
    const CONNECTED_STATES = ['open', 'connected', 'CONNECTED', 'OPEN']
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/evolution/connection-state?institutionId=${effectiveInstitutionId}`, {
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
  }, [effectiveInstitutionId, useMetaApi])

  // Sync 48h messages from Evolution API (não aplicável à Meta API — mensagens chegam via webhook)
  const syncMessages = async () => {
    if (!effectiveInstitutionId || !instance || syncing || useMetaApi) return
    try {
      setSyncing(true)
      const res = await fetch('/api/evolution/sync-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: effectiveInstitutionId, instanceName: instance }),
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
    if (!activeId || !effectiveInstitutionId) return
    // Reset unread
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, unreadCount: 0 } : c))
    const rJid = rawJid(activeId)
    DatabaseService.resetConversationUnread(effectiveInstitutionId, rJid).catch(() => {})

    const conv = conversations.find(c => c.id === activeId)

    // Auto-link lead if not linked
    if (conv && !conv.lead_id && !conv.isGroup && effectiveInstitutionId) {
      DatabaseService.searchLeadsByPhone(effectiveInstitutionId, conv.phone)
        .then(leads => {
          if (leads.length > 0) {
            const lead = leads[0]
            DatabaseService.updateWhatsappMessageLead(rJid, effectiveInstitutionId, lead.id)
            DatabaseService.linkConversationLead(effectiveInstitutionId, rJid, lead.id)
            setConversations(prev => prev.map(c => c.id === activeId
              ? { ...c, lead_id: lead.id, name: c.name === formatPhone(activeId) ? (lead.responsible_name || lead.student_name || c.name) : c.name }
              : c
            ))
          }
        })
        .catch(() => {})
    }

  }, [activeId])

  // Lazy-load messages for conversations that had none after the initial bulk fetch
  useEffect(() => {
    if (!activeId) return
    const conv = conversations.find(c => c.id === activeId)
    if (!conv || conv.messages.length > 0) return

    const institutionIdForLoad = isAionInbox ? null : effectiveInstitutionId
    if (!institutionIdForLoad && !isAionInbox) return

    const fetch = async () => {
      let rows: WhatsappMessage[]
      if (isAionInbox) {
        const { data } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('is_aion_inbox', true)
          .or(`remote_jid.eq.${rawJid(activeId)},remote_jid.eq.${activeId}`)
          .order('timestamp', { ascending: false })
          .limit(200)
        rows = data || []
      } else {
        rows = await DatabaseService.getConversationMessages(institutionIdForLoad!, activeId)
      }

      if (rows.length === 0) return

      const sorted = [...rows].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const messages = sorted
        .filter((m, idx, self) => idx === self.findIndex(t => (t.message_id && t.message_id === m.message_id) || t.id === m.id))
        .map(m => ({
          id: m.id,
          type: mapMsgType(m.message_type),
          content: m.content,
          from: (m.from_me ? 'me' : 'them') as 'me' | 'them',
          ts: new Date(m.timestamp),
          status: (m.status as Message['status']) || 'sent',
          media_url: m.media_url,
          message_id: m.message_id,
          senderName: m.from_me ? (m.contact_name || undefined) : undefined,
          quoted_message_id: m.quoted_message_id,
          quoted_content:    m.quoted_content,
          quoted_from_me:    m.quoted_from_me,
          reaction:           (m as any).reaction || null,
          reaction_attendant: (m as any).reaction_attendant || null,
        }))

      setConversations(prev => prev.map(c =>
        c.id === activeId && c.messages.length === 0
          ? { ...c, messages }
          : c
      ))
    }

    fetch().catch(() => {})
  }, [activeId])

  // Load history when switching to history tab (conv events + CRM events)
  useEffect(() => {
    if (rightPanelTab === 'history' && activeId) {
      loadHistory(rawJid(activeId))
      const leadId = conversations.find(c => c.id === activeId)?.lead_id
      if (leadId) loadLeadCrmEvents(leadId)
    }
  }, [rightPanelTab, activeId])

  // Presence channel for typing indicator — subscribe per active conversation
  useEffect(() => {
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current)
      presenceChannelRef.current = null
    }
    if (!activeId || !user?.id) return

    const ch = supabase.channel(`typing-${activeId}`, { config: { presence: { key: user.id } } })
    ch
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<{ typing: boolean; userId: string }>()
        const othersTyping = Object.values(state)
          .flat()
          .some((p: any) => p.userId !== user.id && p.typing)
        setTypingConvIds(prev => {
          const next = new Set(prev)
          if (othersTyping) next.add(activeId)
          else next.delete(activeId)
          return next
        })
      })
      .subscribe()

    presenceChannelRef.current = ch
    return () => { supabase.removeChannel(ch); presenceChannelRef.current = null }
  }, [activeId, user?.id])

  // Handle incoming phone param from LeadKanban — runs only after conversations finish loading
  useEffect(() => {
    if (!phoneParam || phoneParamHandledRef.current || loading) return
    phoneParamHandledRef.current = true

    // Normalize to canonical 13-digit BR format: 55 + DDD + 9 + 8 digits
    const normP = (p: string): string => {
      let d = p.replace(/\D/g, '')
      if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
      if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
      if (d.length === 11) d = '55' + d
      return d
    }
    const targetPhone = normP(phoneParam)

    const existing = conversations.find(c => {
      const convPhone = normP(c.phone || c.id || '')
      return convPhone === targetPhone
    })

    if (existing) {
      setActiveId(existing.id)
      if (isMobile) setMobilePanel('chat')
    } else {
      const jid   = `${targetPhone}@s.whatsapp.net`
      const local = targetPhone.slice(2) // strip 55
      const phone = local.replace(/(\d{2})(\d{5})(\d{4})/, '$1 $2-$3')
      const name  = nameParam ? decodeURIComponent(nameParam) : `+55 ${phone}`
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
      if (isMobile) setMobilePanel('chat')
    }
  }, [phoneParam, nameParam, loading, conversations])

  // Handle phone passed via navigation state (e.g. from ContactProfile WhatsApp button)
  useEffect(() => {
    const phoneParam = location.state?.phone
    if (!phoneParam || loading) return

    const normP = (p: string): string => {
      let d = p.replace(/\D/g, '')
      if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
      if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
      if (d.length === 11) d = '55' + d
      return d
    }

    const target = normP(String(phoneParam))
    console.log('[PHONE PARAM] procurando:', target)

    const found = conversations.find(c => {
      const jid = (c.id || '').replace('@s.whatsapp.net', '').replace('@c.us', '')
      const norm = normP(jid)
      console.log('[PHONE PARAM] comparando:', norm, '===', target)
      return norm === target
    })

    if (found) {
      console.log('[PHONE PARAM] conversa encontrada:', found.id)
      setActiveId(found.id)
      if (isMobile) setMobilePanel('chat')
    } else {
      console.log('[PHONE PARAM] conversa não encontrada — criando em branco')
      const jid = `${target}@s.whatsapp.net`
      const existingByJid = conversations.find(c => c.id === jid)
      if (existingByJid) {
        setActiveId(existingByJid.id)
        if (isMobile) setMobilePanel('chat')
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
        if (effectiveInstitutionId) {
          DatabaseService.upsertConversationStatus(effectiveInstitutionId, jid, 'open').catch(() => {})
        }
        setConversations(prev => [newConv, ...prev])
        setActiveId(jid)
        if (isMobile) setMobilePanel('chat')
      }
    }

    window.history.replaceState({}, '', '/whatsapp')
  }, [location.state?.phone, conversations, loading])

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

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmojiPicker])

  const handleEmojiSelect = useCallback((emoji: any) => {
    const native = emoji.native as string
    const el = inputRef.current
    if (el) {
      const start = el.selectionStart ?? inputText.length
      const end   = el.selectionEnd   ?? inputText.length
      const next  = inputText.slice(0, start) + native + inputText.slice(end)
      setInputText(next)
      // Restore cursor position after state update
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + native.length
        el.focus()
      })
    } else {
      setInputText(t => t + native)
    }
    setShowEmojiPicker(false)
  }, [inputText])

  const activeConv = conversations.find(c => c.id === activeId) ?? null

  const getDefaultVarValue = (index: number): string => {
    const defaults: Record<number, string> = {
      1: activeConv?.name || '',
      2: institutionName || 'Colégio',
      3: new Date().toLocaleDateString('pt-BR'),
    }
    return defaults[index] || ''
  }

  // Load lead data when active conversation or its lead_id changes
  useEffect(() => {
    const leadId = activeConv?.lead_id
    console.log('[LEAD PANEL] activeId:', activeId, '| lead_id:', leadId)
    if (!leadId) { setLeadData(null); setEditingLead(false); return }
    supabase
      .from('leads')
      .select('id, student_name, responsible_name, phone, email, grade_interest, status, source, created_at')
      .eq('id', leadId)
      .single()
      .then(({ data }) => {
        if (data) {
          console.log('[LEAD PANEL] loaded:', data.responsible_name)
          setLeadData(data)
          setLeadEditForm(data)
        }
      })
  }, [activeId, activeConv?.lead_id])

  // Reactive 24h window check — recalculates every minute
  useEffect(() => {
    const calcExpired = () => {
      if (!activeConv) { setWindowExpired(false); return }
      const lastClientMsg = activeConv.messages
        .filter(m => m.from === 'them')
        .sort((a, b) => b.ts.getTime() - a.ts.getTime())[0]
      setWindowExpired(
        !lastClientMsg ||
        Date.now() - lastClientMsg.ts.getTime() > 24 * 60 * 60 * 1000
      )
    }
    calcExpired()
    const interval = setInterval(calcExpired, 60000)
    return () => clearInterval(interval)
  }, [activeConv?.messages, activeId])

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)

  const naoLidas = conversations.filter(c => !c.isGroup && (c.unreadCount || 0) > 0).length

  // Fila de "aguardando": sem atendente e status waiting — visível a todos os
  // atendentes da instituição (RLS já garante isso; aqui é só organização visual).
  const waitingQueueConvs = conversations.filter(c => !c.isGroup && !c.assigned_user_id && c.status === 'waiting')

  const filteredConvs = conversations.filter(c => {
    if (c.isGroup) return false
    if (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)) {
      // status filter
      if (statusFilter === 'abertos'  && c.status === 'closed') return false
      if (statusFilter === 'concluido' && c.status !== 'closed') return false
      // read filter
      if (readFilter === 'read' && (c.unreadCount || 0) > 0) return false
      if (readFilter === 'unread') {
        if ((c.unreadCount || 0) === 0) return false
        if (user?.role !== 'gestor' && user?.role !== 'admin' && user?.role !== 'superadmin') {
          if (c.assigned_user_id !== user?.id) return false
        }
      }
      // assign filter
      if (assignFilter === 'mine' && c.assigned_user_id !== user?.id) return false
      if (assignFilter === 'none' && c.assigned_user_id != null) return false
      return true
    }
    return false
  })

  // Agrupamento visual da lista (respeita os filtros de busca/status já aplicados
  // em filteredConvs). RLS já garante que um atendente comum nunca recebe do
  // backend conversas de outro atendente — "outras conversas" só é populado
  // de fato para quem tem user_can_see_all_conversations() = true (admin etc).
  // "Paradas" é visível pra todo mundo (RLS libera isso à parte do canSeeAll).
  const filteredWaitingConvs = filteredConvs.filter(c => !c.assigned_user_id && c.status === 'waiting')
  const filteredMyConvs      = filteredConvs.filter(c => c.assigned_user_id === user?.id)
  const filteredStaleConvs   = filteredConvs.filter(c => isConvStale(c))
  const filteredOtherConvs   = filteredConvs.filter(c =>
    !(!c.assigned_user_id && c.status === 'waiting') &&
    c.assigned_user_id !== user?.id &&
    !isConvStale(c)
  )

  const renderConvItem = (conv: Conversation) => {
    const isActive = conv.id === activeId
    const preview = getLastMsgPreview(conv.lastMessage)
    const isFree = !conv.assigned_user_id && conv.status === 'waiting'
    const isStale = isConvStale(conv)
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
        onClick={() => { setActiveId(conv.id); if (isMobile) setMobilePanel('chat') }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '11px 14px',
          cursor: 'pointer',
          borderLeft: isActive ? '3px solid #00A896' : isStale ? '3px solid #F97316' : isFree ? '3px solid #F59E0B' : '3px solid transparent',
          borderBottom: '1px solid #F0FDFB',
          background: isActive ? 'linear-gradient(135deg, #E6F7F5 0%, #F0FDFB 100%)' : isStale ? '#FFF7ED' : isFree ? '#FFFBEB' : 'transparent',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = isStale ? '#FFEDD5' : isFree ? '#FEF3C7' : '#F8FAFC' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isStale ? '#FFF7ED' : isFree ? '#FFFBEB' : 'transparent' }}
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

          {isStale && conv.assigned_user_name && (
            <p style={{ fontSize: 11, color: '#C2410C', margin: '0 0 5px', fontWeight: 600 }}>
              Era de: {conv.assigned_user_name}
            </p>
          )}

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

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Badge "Parada há Xh" para conversas atribuídas a outro atendente sem atividade recente */}
              {isStale && (
                <span title={`Parada há ${hoursSince(conv.lastTime)}h`} style={{
                  fontSize: 9, fontWeight: 700, color: '#C2410C',
                  background: '#FFEDD5', border: '1px solid #FDBA74',
                  padding: '2px 6px', borderRadius: 999, whiteSpace: 'nowrap',
                }}>
                  ⏰ Parada há {hoursSince(conv.lastTime)}h
                </span>
              )}

              {/* Badge "Livre" para conversas sem atendente na fila */}
              {isFree && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#B45309',
                  background: '#FEF3C7', border: '1px solid #FCD34D',
                  padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.03em',
                }}>
                  Livre
                </span>
              )}

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
      </div>
    )
  }

  // Tenta assumir uma conversa da fila (sem atendente, waiting). Usada tanto
  // no envio da primeira mensagem quanto no botão "Assumir conversa" — mesmo
  // comportamento nos dois casos. UPDATE atômico (WHERE assigned_user_id IS
  // NULL): se outro atendente já respondeu/assumiu primeiro, retorna false.
  const claimActiveConversation = async (convId: string): Promise<boolean> => {
    if (!effectiveInstitutionId || !user?.id) return false
    const rJid = rawJid(convId)
    const claimed = await DatabaseService.claimConversationIfUnassigned(
      effectiveInstitutionId, rJid, user.id, user.full_name || user.email
    )

    if (!claimed) {
      setSendError('Essa conversa já foi assumida por outro atendente.')
      await loadMessages()
      return false
    }

    await DatabaseService.logConversationEvent({
      institution_id: effectiveInstitutionId,
      remote_jid: rJid,
      event_type: 'assignment',
      description: `${user.full_name || user.email} assumiu a conversa`,
      user_id: user.id,
    })

    setConversations(prev => prev.map(c => c.id === convId
      ? { ...c, status: 'open' as ConvStatus, assigned_user_id: user.id, assigned_user_name: user.full_name || user.email }
      : c
    ))
    return true
  }

  const handleClaimConversation = async () => {
    if (!activeId) return
    const claimed = await claimActiveConversation(activeId)
    if (claimed) {
      setHubToast('Conversa assumida!')
      setTimeout(() => setHubToast(null), 3000)
    }
  }

  const handleRescueConversation = async () => {
    if (!activeId || !effectiveInstitutionId || !user?.id) return
    const conv = conversationsRef.current.find(c => c.id === activeId)
    if (!conv || !conv.assigned_user_id) return
    const hours = hoursSince(conv.lastTime)
    if (!window.confirm(`Deseja resgatar essa conversa? Ela estava com ${conv.assigned_user_name || 'outro atendente'} há ${hours}h.`)) return

    const rJid = rawJid(activeId)
    const { error } = await DatabaseService.rescueConversation(
      effectiveInstitutionId, rJid, user.id, user.full_name || user.email,
      conv.assigned_user_id, conv.assigned_user_name || 'outro atendente', hours
    )

    if (error) {
      setSendError(error)
      await loadMessages()
      return
    }

    setConversations(prev => prev.map(c => c.id === activeId
      ? { ...c, status: 'open' as ConvStatus, assigned_user_id: user.id, assigned_user_name: user.full_name || user.email }
      : c
    ))
    setHubToast('Conversa resgatada!')
    setTimeout(() => setHubToast(null), 3000)
  }

  // Ao enviar uma mensagem humana, se o robô ainda estiver ativo na conversa,
  // desativa e assume — evita o robô responder em seguida gerando conflito
  // com o que o atendente acabou de escrever. UPDATE com WHERE bot_active =
  // true evita sobrescrever à toa quando o robô já tiver sido desativado.
  const stopBotIfActive = async (convId: string) => {
    if (!effectiveInstitutionId || !user?.id) return
    const conv = conversationsRef.current.find(c => c.id === convId)
    if (!conv?.bot_active) return

    const rJid = rawJid(convId)
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .update({
        bot_active:         false,
        assigned_user_id:   user.id,
        assigned_user_name: user.full_name || user.email,
        status:             'open',
      })
      .eq('institution_id', effectiveInstitutionId)
      .eq('remote_jid', rJid)
      .eq('bot_active', true)
      .select('id')

    if (error || !data || data.length === 0) return

    setConversations(prev => prev.map(c => c.id === convId
      ? { ...c, bot_active: false, status: 'open' as ConvStatus, assigned_user_id: user.id, assigned_user_name: user.full_name || user.email }
      : c
    ))

    await DatabaseService.logConversationEvent({
      institution_id: effectiveInstitutionId,
      remote_jid: rJid,
      event_type: 'bot_stopped',
      description: `Robô desativado — ${user.full_name || user.email} entrou na conversa`,
      user_id: user.id,
      metadata: { triggered_by: 'human_message' },
    })
  }

  // Menu "/" de respostas rápidas: ativo enquanto o campo inteiro for só
  // "/algo" (sem espaço) — some assim que o usuário digita um espaço ou
  // apaga a barra. Filtra por atalho ou título; só entram itens com atalho.
  const slashMatch = /^\/(\S*)$/.exec(inputText)
  const showSlashMenu = !!slashMatch && !slashMenuDismissed
  const slashQuery = (slashMatch?.[1] || '').toLowerCase()
  const slashResults = quickReplies
    .filter(qr => qr.shortcut && (qr.shortcut.toLowerCase().replace(/^\//, '').includes(slashQuery) || qr.label.toLowerCase().includes(slashQuery)))
    .slice(0, 8)

  const applyQuickReply = (qr: { text: string }) => {
    setInputText(qr.text)
    setSlashMenuDismissed(true)
    inputRef.current?.focus()
  }

  const handleSend = async () => {
    if (!inputText.trim() || !activeId) return

    // Conversa na fila (sem atendente, aguardando) — tenta assumir antes de
    // enviar, bloqueando o envio se outro atendente já tiver assumido.
    const convBeforeSend = conversationsRef.current.find(c => c.id === activeId)
    if (convBeforeSend && !convBeforeSend.assigned_user_id && convBeforeSend.status === 'waiting') {
      const claimed = await claimActiveConversation(activeId)
      if (!claimed) return
    }

    const text = inputText.trim()
    const quotedMsg = replyTo
    const tempId = `temp-${Date.now()}`
    const tempMsg: Message = {
      id: tempId,
      type: 'text',
      content: text,
      from: 'me',
      ts: new Date(),
      status: 'sent',
      senderName: user?.full_name || undefined,
      ...(quotedMsg ? {
        quoted_message_id: quotedMsg.message_id,
        quoted_content: quotedMsg.content,
        quoted_from_me: quotedMsg.from === 'me',
      } : {}),
    }

    setConversations(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, messages: [...c.messages, tempMsg], lastMessage: text, lastTime: tempMsg.ts }
        : c
    ))
    setInputText('')
    setReplyTo(null)
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
          institution_id: effectiveInstitutionId || undefined,
          isAionSend: isAionInbox,
          to,
          type: 'text',
          message: text,
          sender_name: user?.full_name,
          sender_user_id: user?.id,
          ...(quotedMsg?.message_id ? {
            quoted_message_id: quotedMsg.message_id,
            quoted_content:    quotedMsg.content,
            quoted_from_me:    quotedMsg.from === 'me',
          } : {}),
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

      await stopBotIfActive(activeId)

    } catch (err: any) {
      setConversations(prev => prev.map(c =>
        c.id === activeId
          ? { ...c, messages: c.messages.filter(m => m.id !== tempId) }
          : c
      ))
      setSendError(err.message || 'Erro ao enviar mensagem.')
    }
  }

  const handleSendTemplate = async () => {
    if (!activeId || !effectiveInstitutionId || !selectedTemplate) return
    const tmpl = templates.find(t => t.id === selectedTemplate) ||
      { id: '', name: selectedTemplate, language: 'pt_BR', components: [] }
    const to = activeId.replace(/@s\.whatsapp\.net$/, '').replace(/@.*/, '').replace(/\D/g, '')
    const varKeys = Object.keys(templateVars)
    const components = varKeys.length > 0
      ? [{ type: 'body', parameters: varKeys.map(k => ({ type: 'text', text: templateVars[k] })) }]
      : tmpl.components ?? []

    setTemplateError(null)
    setSendingTemplate(true)
    const preview = buildTemplatePreview(tmpl, templateVars)
    console.log('[TEMPLATE PREVIEW]', { tmpl: tmpl?.name, components: tmpl?.components, vars: templateVars, preview })
    try {
      console.log('[SEND-TEMPLATE] to:', to, 'template:', tmpl.name, 'components:', JSON.stringify(components))
      const res = await fetch('/api/whatsapp/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: effectiveInstitutionId,
          to,
          template_name: tmpl.name,
          language: tmpl.language || 'pt_BR',
          components,
          sender_user_id: user?.id,
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('❌ Template error:', errorData)
        setTemplateError(errorData.error || 'Erro ao enviar template')
        return
      }
      const optimistic: Message = {
        id: `temp-tmpl-${Date.now()}`,
        type: 'text',
        content: preview,
        from: 'me',
        ts: new Date(),
        status: 'sent',
        senderName: user?.full_name || undefined,
        isTemplate: true,
      }
      setConversations(prev => prev.map(c =>
        c.id === activeId
          ? { ...c, messages: [...c.messages, optimistic], lastMessage: preview, lastTime: optimistic.ts }
          : c
      ))

      // [FIX P3] Assign current attendant + disable bot so customer reply goes to them
      if (effectiveInstitutionId && user?.id && activeId) {
        const rJid = rawJid(activeId)
        await supabase.from('whatsapp_conversations')
          .update({
            assigned_user_id:   user.id,
            assigned_user_name: user.full_name || user.email,
            bot_active:         false,
            status:             'waiting',
          })
          .eq('institution_id', effectiveInstitutionId)
          .eq('remote_jid', rJid)
        setConversations(prev => prev.map(c =>
          c.id === activeId
            ? { ...c, assigned_user_id: user.id, assigned_user_name: user.full_name || user.email, bot_active: false, status: 'waiting' as ConvStatus }
            : c
        ))
      }

      setShowTemplateModal(false)
      setSelectedTemplate('')
      setTemplateVars({})
      setTemplateError(null)
      setHubToast('✅ Template enviado!')
      setTimeout(() => setHubToast(null), 3000)
      const jidSnapshot = activeId
      setTimeout(async () => {
        console.log('[RELOAD] recarregando para jid:', jidSnapshot)
        await loadMessages()
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 500)
      }, 2500)
    } catch (err: any) {
      setTemplateError(err.message || 'Erro ao enviar template')
    } finally {
      setSendingTemplate(false)
    }
  }

  const handleReactivate = async () => {
    if (!activeId || !effectiveInstitutionId || sendingReactivate) return
    setSendingReactivate(true)
    try {
      const to = activeId.replace(/@s\.whatsapp\.net$/, '').replace(/@.*/, '').replace(/\D/g, '')
      const contactName = activeConv?.name || to

      const { data: phoneData } = await supabase
        .from('whatsapp_phone_numbers')
        .select('phone_number_id, waba_id')
        .eq('institution_id', effectiveInstitutionId)
        .eq('is_active', true)
        .maybeSingle()

      const { data: tokenRow } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'wa_access_token')
        .maybeSingle()

      const token = tokenRow?.value || ''
      if (!phoneData?.phone_number_id || !token) throw new Error('WhatsApp não configurado')

      const wabaId = phoneData.waba_id || '1222972209822315'

      // Verify template exists and is approved
      const checkRes = await fetch(
        `https://graph.facebook.com/v18.0/${wabaId}/message_templates?name=reativar_atendimento&status=APPROVED`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const checkData = await checkRes.json()
      if (!checkData.data?.length) {
        throw new Error('Template "reativar_atendimento" não aprovado. Aguarde aprovação da Meta.')
      }

      const sendRes = await fetch(
        `https://graph.facebook.com/v18.0/${phoneData.phone_number_id}/messages`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
              name: 'reativar_atendimento',
              language: { code: 'pt_BR' },
              components: [{ type: 'body', parameters: [{ type: 'text', text: contactName }] }],
            },
          }),
        }
      )
      if (!sendRes.ok) {
        const err = await sendRes.json()
        throw new Error((err as any)?.error?.message || 'Erro ao enviar template')
      }

      const optimistic: Message = {
        id: `temp-reactivate-${Date.now()}`,
        type: 'text',
        content: '[Template] reativar_atendimento',
        from: 'me',
        ts: new Date(),
        status: 'sent',
        senderName: user?.full_name || undefined,
      }
      setConversations(prev => prev.map(c =>
        c.id === activeId
          ? { ...c, messages: [...c.messages, optimistic], lastMessage: optimistic.content, lastTime: optimistic.ts }
          : c
      ))
      setHubToast('Template enviado! Aguardando resposta...')
      setTimeout(() => setHubToast(null), 4000)
    } catch (err: any) {
      setSendError(err.message || 'Erro ao reativar conversa.')
    } finally {
      setSendingReactivate(false)
    }
  }

  const handleStatusChange = async (status: ConvStatus) => {
    if (!activeId || !effectiveInstitutionId) return
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, status } : c))
    const rJid = rawJid(activeId)
    await DatabaseService.upsertConversationStatus(effectiveInstitutionId, rJid, status)
    DatabaseService.logConversationEvent({
      institution_id: effectiveInstitutionId,
      remote_jid: rJid,
      event_type: 'status_change',
      description: `Status alterado para: ${safeStatusCfg(status).label}`,
      user_id: user.id,
      user_name: user.full_name || user.email,
    }).catch(() => {})
  }

  const handleTransfer = async () => {
    console.warn('🔄 TRANSFER INICIADO', new Date().toISOString())
    if (!activeId || !effectiveInstitutionId || !transferTarget) return
    const targetUser = users.find(u => u.id === transferTarget)
    if (!targetUser) return
    const fromName = activeConv?.assigned_user_name || user.full_name || user.email
    const rJid = rawJid(activeId)
    console.log('[TRANSFER] activeId completo:', activeId)
    console.log('[TRANSFER] rawJid resultado:', rJid)
    console.log('[TRANSFER] transferindo para:', targetUser.full_name, targetUser.id)
    const { data: convData } = await supabase
      .from('whatsapp_conversations')
      .select('id, remote_jid, assigned_user_id, assigned_user_name')
      .eq('institution_id', effectiveInstitutionId)
      .eq('remote_jid', rJid)
    console.log('[TRANSFER] conversa encontrada:', convData)
    if (!convData || convData.length === 0) {
      const { data: convData2 } = await supabase
        .from('whatsapp_conversations')
        .select('id, remote_jid, assigned_user_id')
        .eq('institution_id', effectiveInstitutionId)
        .ilike('remote_jid', `%${rJid}%`)
      console.log('[TRANSFER] busca ampla:', convData2)
    }
    const fromUserId = activeConv?.assigned_user_id
    await DatabaseService.transferConversation(effectiveInstitutionId, rJid, targetUser.id, targetUser.full_name, fromName, fromUserId)
    await DatabaseService.logConversationEvent({
      institution_id: effectiveInstitutionId,
      remote_jid: rJid,
      event_type: 'transfer',
      description: `Transferido de ${fromName} para ${targetUser.full_name}`,
      user_id: user.id,
      user_name: user.full_name || user.email,
      metadata: { from_user_id: fromUserId || null, to_user_id: targetUser.id },
    })
    await loadMessages()
    setConversations(prev => prev.map(c => c.id === activeId
      ? { ...c, assigned_user_id: targetUser.id, assigned_user_name: targetUser.full_name }
      : c
    ))
    setTransferring(false)
    setTransferTarget('')
  }

  const handleContactType = async (type: string) => {
    console.log('[CONTACT TYPE] chamada com:', type, '| activeId:', activeId, '| institution:', effectiveInstitutionId)
    if (!activeId || !effectiveInstitutionId) return
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
    const rJid = rawJid(activeId)
    await DatabaseService.setConversationContactType(effectiveInstitutionId, rJid, type)
    // Sync whatsapp_contacts.type — normalize to canonical 13-digit format
    const normContactPhone = (() => {
      let d = rJid.replace(/@.*/, '').replace(/\D/g, '')
      if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
      if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
      if (d.length === 11) d = '55' + d
      return d
    })()
    console.log('[SYNC] normPhone:', normContactPhone)
    console.log('[SYNC] institutionId:', effectiveInstitutionId)
    const { data: contactRow, error: contactErr } = await supabase
      .from('whatsapp_contacts')
      .select('id, phone, type')
      .eq('institution_id', effectiveInstitutionId)
      .eq('phone', normContactPhone)
      .maybeSingle()
    console.log('[SYNC] contact found:', contactRow, 'error:', contactErr)
    if (contactRow) {
      const { error: updateErr } = await supabase
        .from('whatsapp_contacts')
        .update({ type, updated_at: new Date().toISOString() })
        .eq('id', contactRow.id)
      console.log('[SYNC] update error:', updateErr)
    }
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, contact_type: type } : c))
    await DatabaseService.logConversationEvent({
      institution_id: effectiveInstitutionId,
      remote_jid: rJid,
      event_type: 'contact_identified',
      description: `Contato identificado como: ${type === 'lead' ? 'Lead' : type === 'client' ? 'Cliente' : type === 'supplier' ? 'Fornecedor' : 'Outro'}`,
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
    if (!pendingFile || !activeId || (!effectiveInstitutionId && !isAionInbox)) return
    if (pendingFile.size > 15 * 1024 * 1024) {
      setSendError('Arquivo muito grande. Máximo 15MB.')
      setPendingFile(null)
      setPendingFilePreview(null)
      return
    }
    setUploadProgress(10)

    const mediatype = pendingFile.type.startsWith('image/') ? 'image'
      : pendingFile.type.startsWith('video/') ? 'video'
      : pendingFile.type.startsWith('audio/') ? 'audio'
      : 'document'

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
      // Step 1: upload to Supabase Storage via /api/whatsapp/media
      const uploadRes = await fetch('/api/whatsapp/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: effectiveInstitutionId,
          base64,
          mimetype: fileToSend.type || pendingFile.type,
          filename: pendingFile.name,
        }),
      })
      setUploadProgress(65)
      if (!uploadRes.ok) throw new Error(`Upload HTTP ${uploadRes.status}`)
      const { url: mediaUrl } = await uploadRes.json()

      // Step 2: send via Meta Cloud API with the permanent URL
      const to = activeId.replace(/@s\.whatsapp\.net$/, '').replace(/@.*/, '').replace(/\D/g, '')
      const sendRes = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: effectiveInstitutionId || undefined,
          isAionSend: isAionInbox,
          to,
          type: mediatype,
          mediaUrl,
          filename: pendingFile.name,
          caption: '',
          conversation_id: undefined,
          sender_name: user?.full_name,
          sender_user_id: user?.id,
        }),
      })
      setUploadProgress(100)
      if (!sendRes.ok) throw new Error(`Send HTTP ${sendRes.status}`)

      setConversations(prev => prev.map(c =>
        c.id === activeId
          ? { ...c, messages: c.messages.map(m => m.id === tempId ? { ...m, status: 'sent' as const, media_url: mediaUrl } : m) }
          : c
      ))
      if (activeId) await stopBotIfActive(activeId)
      setTimeout(() => { setPendingFile(null); setPendingFilePreview(null); setUploadProgress(0) }, 800)
    } catch (err) {
      console.error('[sendPendingFile] error:', err)
      setSendError('Erro ao enviar arquivo.')
      setConversations(prev => prev.map(c =>
        c.id === activeId ? { ...c, messages: c.messages.filter(m => m.id !== tempId) } : c
      ))
      setPendingFile(null); setPendingFilePreview(null)
      setUploadProgress(0)
    }
  }

  const handleNewConv = async () => {
    if (!newConvPhone.trim()) return
    const raw = newConvPhone.trim()
    const digits = raw.replace(/\D/g, '')
    // Detect explicit international format typed by the user (+ or 00 prefix)
    const isExplicitIntl = raw.startsWith('+') || raw.startsWith('00')
    const hasBrCC = digits.startsWith('55') && (digits.length === 12 || digits.length === 13)
    let normalized: string
    if (hasBrCC) {
      normalized = digits.length === 12 ? digits.slice(0, 4) + '9' + digits.slice(4) : digits
    } else if (!isExplicitIntl && digits.length <= 11) {
      // Bare number entered without '+' prefix: treat as Brazilian
      normalized = '55' + (digits.length === 10 ? digits.slice(0, 2) + '9' + digits.slice(2) : digits)
    } else {
      // User typed '+' or '00' prefix, or number is 12+ digits: already has country code
      normalized = digits
    }
    const jid = `${normalized}@s.whatsapp.net`
    const existing = conversations.find(c => c.id === jid)
    if (existing) {
      if (newConvName) {
        setConversations(prev => prev.map(c => c.id === jid ? { ...c, name: newConvName } : c))
      }
      setActiveId(existing.id)
    } else {
      const phone = formatPhone(jid)
      const name = newConvName || phone
      const newConv: Conversation = {
        id: jid, name, phone,
        avatarColor: jidToColor(jid),
        lastMessage: '', lastTime: new Date(),
        unreadCount: 0, status: 'open', online: false,
        labels: [], isGroup: false, tags: [],
        messages: [],
      }
      if (effectiveInstitutionId) {
        DatabaseService.upsertConversationStatus(effectiveInstitutionId, jid, 'open').catch(() => {})
      }
      setConversations(prev => [newConv, ...prev])
      setActiveId(jid)
      // Show template panel for new outbound conversations
      setSelectedTemplate('')
      setTemplateVars({})
      setShowTemplatePanel(true)
    }

    if (effectiveInstitutionId) {
      try {
        const { data: existingContact } = await supabase
          .from('whatsapp_contacts')
          .select('id, name')
          .eq('institution_id', effectiveInstitutionId)
          .eq('phone', normalized)
          .maybeSingle()

        if (existingContact) {
          await supabase
            .from('whatsapp_contacts')
            .update({ name: newConvName || existingContact.name, updated_at: new Date().toISOString() })
            .eq('id', existingContact.id)
        } else {
          await supabase
            .from('whatsapp_contacts')
            .insert({ institution_id: effectiveInstitutionId, phone: normalized, name: newConvName || normalized, type: 'unknown', updated_at: new Date().toISOString() })
        }

        const noCode = normalized.startsWith('55') ? normalized.slice(2) : normalized
        const { data: lead } = await supabase
          .from('leads')
          .select('id')
          .eq('institution_id', effectiveInstitutionId)
          .or(`phone.eq.${normalized},phone.eq.${noCode},phone.eq.55${noCode}`)
          .maybeSingle()

        if (lead?.id) {
          await supabase
            .from('whatsapp_contacts')
            .update({ lead_id: lead.id, type: 'lead' })
            .eq('institution_id', effectiveInstitutionId)
            .eq('phone', normalized)
        }
      } catch {}
    }

    setShowNewConvModal(false)
    setNewConvPhone('')
    setNewConvName('')
  }

  const handleSendNewConvTemplate = async () => {
    if (!activeId || !effectiveInstitutionId || !selectedTemplate) return
    const tmpl = templates.find(t => t.id === selectedTemplate) ||
      { id: '', name: selectedTemplate, language: 'pt_BR', components: [] }
    const to = activeId.replace(/@s\.whatsapp\.net$/, '').replace(/@.*/, '').replace(/\D/g, '')
    const varKeys = Object.keys(templateVars)
    const components = varKeys.length > 0
      ? [{ type: 'body', parameters: varKeys.map(k => ({ type: 'text', text: templateVars[k] })) }]
      : []

    setSendingTemplate(true)
    try {
      const res = await fetch('/api/whatsapp/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: effectiveInstitutionId,
          to,
          template_name: tmpl.name,
          language: tmpl.language || 'pt_BR',
          components,
          sender_user_id: user?.id,
        }),
      })
      if (!res.ok) throw new Error('Erro ao enviar template')

      const optimistic: Message = {
        id: `temp-tmpl-${Date.now()}`,
        type: 'text',
        content: `[Template] ${tmpl.name}`,
        from: 'me',
        ts: new Date(),
        status: 'sent',
        senderName: user?.full_name || undefined,
      }
      setConversations(prev => prev.map(c =>
        c.id === activeId
          ? {
              ...c,
              messages: [...c.messages, optimistic],
              lastMessage: optimistic.content,
              lastTime: optimistic.ts,
              status: 'open',
              assigned_user_id: user?.id,
              assigned_user_name: user?.full_name,
            }
          : c
      ))

      // Update conversation in DB
      await supabase.from('whatsapp_conversations')
        .update({
          status: 'open',
          assigned_user_id: user?.id,
          assigned_user_name: user?.full_name,
          bot_active: false,
        })
        .eq('institution_id', effectiveInstitutionId)
        .eq('remote_jid', rawJid(activeId))

      // Increment outbound initiated count
      const monthYear = new Date().toISOString().slice(0, 7)
      try {
        await supabase.rpc('increment_initiated_count', {
          p_institution_id: effectiveInstitutionId,
          p_month_year: monthYear,
        })
      } catch {}

      setShowTemplatePanel(false)
      setSelectedTemplate('')
      setTemplateVars({})
      setHubToast('Template enviado! Aguardando resposta...')
      setTimeout(() => setHubToast(null), 4000)
    } catch (err: any) {
      setSendError(err.message || 'Erro ao enviar template')
    } finally {
      setSendingTemplate(false)
    }
  }

  const handleAddTag = async (tag: string) => {
    if (!tag.trim() || !activeId || !effectiveInstitutionId) return
    const currentTags = activeConv?.tags || []
    if (currentTags.includes(tag.trim())) return
    const newTags = [...currentTags, tag.trim()]
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, tags: newTags } : c))
    await DatabaseService.updateConversationTags(effectiveInstitutionId, rawJid(activeId), newTags)
    // Sync tags to whatsapp_contacts — phone stored = digits of the wa_id (exact match)
    const normPhone = rawJid(activeId).replace(/\D/g, '')
    await supabase.from('whatsapp_contacts')
      .update({ tags: newTags })
      .eq('institution_id', effectiveInstitutionId)
      .eq('phone', normPhone)
    setAddingTag(false)
    setNewTag('')
  }

  const handleRemoveTag = async (tag: string) => {
    if (!activeId || !effectiveInstitutionId) return
    const newTags = (activeConv?.tags || []).filter(t => t !== tag)
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, tags: newTags } : c))
    await DatabaseService.updateConversationTags(effectiveInstitutionId, rawJid(activeId), newTags)
    // Sync tags to whatsapp_contacts — phone stored = digits of the wa_id (exact match)
    const normPhone = rawJid(activeId).replace(/\D/g, '')
    await supabase.from('whatsapp_contacts')
      .update({ tags: newTags })
      .eq('institution_id', effectiveInstitutionId)
      .eq('phone', normPhone)
  }

  const handleCloseConversation = async () => {
    if (!activeId || !effectiveInstitutionId) return
    const convId = activeId
    const rJid   = rawJid(convId)

    console.log('[CLOSE 1] iniciando fechamento', rJid, '| convId:', convId)

    // 1. Guard all Realtime events for this JID before any async operation
    console.log('[CLOSE 2] adicionando ao CLOSING_IDS', rJid, convId)
    CLOSING_IDS.add(rJid)
    CLOSING_IDS.add(convId)
    console.log('[CLOSE 2] CLOSING_IDS agora:', [...CLOSING_IDS])

    // 2. Mark as closed locally (filter hides it for 'abertos', keeps it for 'ambos')
    console.log('[CLOSE 3] marcando como closed no estado local')
    setConversations(prev => prev.map(c =>
      c.id === convId
        ? { ...c, status: 'closed' as ConvStatus, bot_active: false, assigned_user_id: undefined, assigned_user_name: undefined }
        : c
    ))
    console.log('[CLOSE 4] setActiveId null')
    setActiveId(null)

    // 3. Persist to DB (triggers Realtime — guarded above)
    console.log('[CLOSE 5] salvando no banco | institutionId:', effectiveInstitutionId, '| rJid:', rJid)
    const closeResult = await DatabaseService.closeConversation(effectiveInstitutionId, rJid)
    console.log('[CLOSE 5] resultado banco:', JSON.stringify(closeResult))
    if (closeResult.count === 0) {
      console.warn('[CLOSE 5] AVISO: 0 linhas atualizadas — possível problema de RLS ou formato do JID')
    }
    DatabaseService.logConversationEvent({
      institution_id: effectiveInstitutionId,
      remote_jid: rJid,
      event_type: 'status_change',
      description: 'Conversa concluída',
      user_id: user!.id,
      user_name: user!.full_name || user!.email,
    }).catch(() => {})
    console.log('[CLOSE 6] concluído — aguardando Realtime (guard 5s)')

    // 4. Release guard after 10s (long enough for all Realtime events to arrive)
    setTimeout(() => {
      console.log('[CLOSE 7] limpando CLOSING_IDS para', rJid)
      CLOSING_IDS.delete(rJid)
      CLOSING_IDS.delete(convId)
    }, 10000)

    // 5. Send satisfaction survey if enabled
    if (flowConfig?.satisfaction_survey_enabled) {
      const to = rJid.replace(/@.*/, '').replace(/\D/g, '')
      const surveyMsg = flowConfig.satisfaction_message || 'Como você avalia nosso atendimento hoje? Seu feedback é muito importante para nós! 😊'
      try {
        const { data: phoneData } = await supabase
          .from('whatsapp_phone_numbers')
          .select('phone_number_id')
          .eq('institution_id', effectiveInstitutionId)
          .eq('is_active', true)
          .maybeSingle()

        const { data: settings } = await supabase
          .from('platform_settings')
          .select('key, value')
          .in('key', ['wa_access_token'])

        const token = settings?.find((s: any) => s.key === 'wa_access_token')?.value

        if (phoneData?.phone_number_id && token) {
          await fetch(`https://graph.facebook.com/v19.0/${phoneData.phone_number_id}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to,
              type: 'interactive',
              interactive: {
                type: 'button',
                body: { text: surveyMsg },
                action: {
                  buttons: [
                    { type: 'reply', reply: { id: 'survey_1', title: '😞 Ruim' } },
                    { type: 'reply', reply: { id: 'survey_2', title: '😐 Regular' } },
                    { type: 'reply', reply: { id: 'survey_3', title: '😊 Ótimo' } },
                  ],
                },
              },
            }),
          })
        } else {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              institution_id: effectiveInstitutionId || undefined,
              isAionSend: isAionInbox,
              to,
              type: 'text',
              message: surveyMsg + '\n\n1 - Ruim\n2 - Regular\n3 - Ótimo',
            }),
          })
        }
      } catch (e) {
        console.error('[survey] erro ao enviar pesquisa:', e)
      }
    }
  }

  const exportConversation = () => {
    if (!activeConv) return
    const BOM = '﻿'
    const header = 'Data,Hora,De,Mensagem,Tipo,Status'
    const rows = activeConv.messages.map(m => {
      const d = m.ts
      const date = d.toLocaleDateString('pt-BR')
      const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const from = m.from === 'me' ? 'Atendente' : (activeConv.name || activeConv.phone)
      const content = (m.content || '').replace(/\n/g, ' ')
      return [date, time, from, content, m.type, m.status || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    })
    const csv = BOM + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `conversa-${activeConv.phone || activeConv.name}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAssignFromClosed = async () => {
    if (!activeId || !effectiveInstitutionId || !transferTarget) return
    const targetUser = users.find(u => u.id === transferTarget)
    if (!targetUser) return
    const rJid = rawJid(activeId)
    await DatabaseService.assignConversation(effectiveInstitutionId, rJid, targetUser.id, targetUser.full_name)
    await DatabaseService.upsertConversationStatus(effectiveInstitutionId, rJid, 'open')
    await DatabaseService.logConversationEvent({
      institution_id: effectiveInstitutionId,
      remote_jid: rJid,
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
    if (!activeId || !effectiveInstitutionId) return
    setConversations(prev => prev.map(c => c.id === activeId
      ? { ...c, status: 'waiting' as ConvStatus, assigned_user_id: undefined, assigned_user_name: undefined }
      : c
    ))
    await DatabaseService.upsertConversationStatus(effectiveInstitutionId, rawJid(activeId), 'waiting')
    await supabase.from('whatsapp_conversations').update({ assigned_user_id: null, assigned_user_name: null })
      .eq('institution_id', effectiveInstitutionId).eq('remote_jid', rawJid(activeId))
    DatabaseService.logConversationEvent({
      institution_id: effectiveInstitutionId,
      remote_jid: rawJid(activeId),
      event_type: 'transfer',
      description: `${user.full_name || user.email} saiu do atendimento`,
      user_id: user.id,
      user_name: user.full_name || user.email,
    }).catch(() => {})
  }

  const handleReact = async (msg: Message, emoji: string) => {
    if (!msg.message_id || !activeId) return
    const rJid = rawJid(activeId)
    // Toggle: clicking the same emoji removes the reaction
    const emojiToSend = msg.reaction_attendant === emoji ? '' : emoji

    // Optimistic update
    setConversations(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, messages: c.messages.map(m => m.id === msg.id ? { ...m, reaction_attendant: emojiToSend || null } : m) }
        : c
    ))

    try {
      await fetch('/api/whatsapp/send-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: effectiveInstitutionId || null,
          message_id:     msg.message_id,
          emoji:          emojiToSend,
          remote_jid:     rJid,
        }),
      })
    } catch (err) {
      console.error('[handleReact]', err)
    }
  }

  const handleCreateLead = async () => {
    if (!effectiveInstitutionId || !leadForm.responsible_name) return
    try {
      const lead = await DatabaseService.createLead({
        ...leadForm,
        institution_id: effectiveInstitutionId,
        status: 'new',
      })
      if (activeId) {
        const rJid = rawJid(activeId)
        await DatabaseService.updateWhatsappMessageLead(rJid, effectiveInstitutionId, lead.id)
        await DatabaseService.linkConversationLead(effectiveInstitutionId, rJid, lead.id)
        await DatabaseService.setConversationContactType(effectiveInstitutionId, rJid, 'lead')
        setConversations(prev => prev.map(c => c.id === activeId
          ? { ...c, lead_id: lead.id, contact_type: 'lead', name: leadForm.responsible_name || c.name }
          : c
        ))
      }
      // Sync to whatsapp_contacts
      const normPhone = (() => {
        let d = (leadForm.phone || activeConv?.phone || '').replace(/\D/g, '')
        if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
        if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
        if (d.length === 11) d = '55' + d
        return d
      })()
      if (normPhone && effectiveInstitutionId) {
        await supabase
          .from('whatsapp_contacts')
          .upsert({
            institution_id: effectiveInstitutionId,
            phone: normPhone,
            name: leadForm.responsible_name || normPhone,
            type: 'lead',
            lead_id: lead.id,
            updated_at: new Date().toISOString()
          }, { onConflict: 'institution_id,phone' })
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
      <style>{`
        .wa-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .wa-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .wa-scrollbar::-webkit-scrollbar-thumb { background: #b2e8e2; border-radius: 9999px; }
        .wa-scrollbar::-webkit-scrollbar-thumb:hover { background: #0d9488; }
        .wa-scrollbar { scrollbar-width: thin; scrollbar-color: #b2e8e2 transparent; }
      `}</style>

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
              type="text"
              value={newConvName}
              onChange={e => setNewConvName(e.target.value)}
              placeholder="Nome do contato (opcional)"
              className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none mb-3"
            />
            <input
              type="tel"
              value={newConvPhone}
              onChange={e => setNewConvPhone(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNewConv() }}
              placeholder="+55 (00) 00000-0000"
              className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowNewConvModal(false); setNewConvPhone(''); setNewConvName('') }}
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
                if (!activeId || !effectiveInstitutionId) return
                const rJid = rawJid(activeId)
                await DatabaseService.setConversationContactType(effectiveInstitutionId, rJid, 'client')
                setConversations(prev => prev.map(c => c.id === activeId ? { ...c, contact_type: 'client' } : c))
                await DatabaseService.logConversationEvent({
                  institution_id: effectiveInstitutionId,
                  remote_jid: rJid,
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
        <div style={{ width: isMobile ? '100%' : 320, flexShrink: 0, display: isMobile && mobilePanel === 'chat' ? 'none' : 'flex', flexDirection: 'column', background: '#FFFFFF', borderRight: '1px solid #D1FAE5', overflow: 'hidden' }}>

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
              {waitingQueueConvs.length > 0 && (
                <span title="Conversas aguardando atendimento" style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, minWidth: 20, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 3 }}>
                  ⏳ {waitingQueueConvs.length}
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

          {/* Filters — Botconversa style */}
          <div style={{ borderBottom: '1px solid #D1FAE5' }}>
            {/* Row 1: Status + Atribuição dropdowns */}
            <div style={{ display: 'flex', padding: '8px 12px', gap: 8 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                  style={{ width: '100%', padding: '5px 8px', fontSize: 12, border: '1px solid #D1FAE5', borderRadius: 8, background: '#F0FDFB', color: '#1A2B4A', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="abertos">Abertos</option>
                  <option value="concluido">Concluídos</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
              {canSeeAll && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Atribuição</span>
                  <select
                    value={assignFilter}
                    onChange={e => setAssignFilter(e.target.value as typeof assignFilter)}
                    style={{ width: '100%', padding: '5px 8px', fontSize: 12, border: '1px solid #D1FAE5', borderRadius: 8, background: '#F0FDFB', color: '#1A2B4A', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="all">Todos</option>
                    <option value="mine">Meus chats</option>
                    <option value="none">Não atribuídos</option>
                  </select>
                </div>
              )}
            </div>
            {/* Row 2: Read sub-filter pills */}
            <div style={{ display: 'flex', padding: '0 12px 8px', gap: 6, alignItems: 'center' }}>
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
            </div>
          </div>

          {/* Conversation list */}
          <div className="wa-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
            {filteredConvs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, textAlign: 'center', padding: '0 16px' }}>
                <p style={{ fontSize: 12, color: '#94A3B8' }}>Nenhuma conversa encontrada</p>
              </div>
            ) : (
              <>
                {filteredWaitingConvs.length > 0 && (
                  <>
                    <div style={{ padding: '8px 14px 4px', fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      ⏳ Aguardando atendimento
                      <span style={{ background: '#EF4444', color: '#fff', borderRadius: 9999, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{filteredWaitingConvs.length}</span>
                    </div>
                    {filteredWaitingConvs.map(conv => renderConvItem(conv))}
                  </>
                )}
                {filteredMyConvs.length > 0 && (
                  <>
                    <div style={{ padding: '10px 14px 4px', fontSize: 11, fontWeight: 700, color: '#00A896', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Minhas conversas
                    </div>
                    {filteredMyConvs.map(conv => renderConvItem(conv))}
                  </>
                )}
                {filteredStaleConvs.length > 0 && (
                  <>
                    <div style={{ padding: '10px 14px 4px', fontSize: 11, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      ⏰ Conversas paradas
                      <span style={{ background: '#F97316', color: '#fff', borderRadius: 9999, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{filteredStaleConvs.length}</span>
                    </div>
                    {filteredStaleConvs.map(conv => renderConvItem(conv))}
                  </>
                )}
                {canSeeAll && filteredOtherConvs.length > 0 && (
                  <>
                    <div style={{ padding: '10px 14px 4px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Outras conversas
                    </div>
                    {filteredOtherConvs.map(conv => renderConvItem(conv))}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Col 2: Chat ───────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: isMobile && mobilePanel === 'list' ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FAFFFE' }}>

          {activeConv && (
            <div style={{ flexShrink: 0, position: 'relative', background: 'linear-gradient(135deg, #FFFFFF 0%, #F0FDFB 100%)', borderBottom: '1px solid #D1FAE5', minHeight: 64, boxShadow: '0 2px 8px rgba(0,168,150,0.06)' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 64 }}>
                {isMobile && (
                  <button
                    onClick={() => setMobilePanel('list')}
                    style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#1A2B4A', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <ChevronLeft style={{ width: 22, height: 22 }} />
                  </button>
                )}
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 14, fontWeight: 700, color: '#fff', background: activeConv.profile_picture_url ? 'transparent' : getAvatarBgColor(activeConv.name), boxShadow: '0 2px 8px rgba(13,148,136,0.2)' }}>
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
                  <button onClick={async () => {
                    if (!window.confirm('Isso apagará todas as mensagens permanentemente. Continuar?')) return
                    setConversations(prev => prev.map(c => c.id === activeId ? {...c, messages: []} : c))
                    setShowMoreMenu(false)
                    if (activeId && effectiveInstitutionId) {
                      await supabase.from('whatsapp_messages')
                        .delete()
                        .eq('institution_id', effectiveInstitutionId)
                        .eq('remote_jid', activeId)
                    }
                  }}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, color: '#1A2B4A', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    Limpar conversa
                  </button>
                  <button onClick={async () => {
                    if (!window.confirm('Bloquear este contato? Mensagens futuras serão ignoradas.')) return
                    setShowMoreMenu(false)
                    if (!activeId || !effectiveInstitutionId) return
                    const normPhone = (() => {
                      let d = rawJid(activeId).replace(/@.*/, '').replace(/\D/g, '')
                      if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
                      if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
                      if (d.length === 11) d = '55' + d
                      return d
                    })()
                    try {
                      await supabase.from('whatsapp_blacklist').insert({
                        institution_id: effectiveInstitutionId,
                        phone: normPhone,
                        blocked_at: new Date().toISOString()
                      })
                    } catch {}
                    setConversations(prev => prev.filter(c => c.id !== activeId))
                    setActiveId(null)
                    setHubToast('Contato bloqueado')
                    setTimeout(() => setHubToast(null), 3000)
                  }}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
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

          {/* Messages area + Composer */}
          <>
          <div className="wa-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 2, backgroundImage: 'radial-gradient(circle at 1px 1px, #ccf0ec 1px, transparent 0)', backgroundSize: '24px 24px', backgroundColor: '#f7fefe' }}>
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
                  <MessageBubble key={msg.id} msg={msg} onImageClick={url => setLightboxUrl(url)} instanceName={instance} contactName={activeConv?.name || 'Contato'} onReply={m => { setReplyTo(m); inputRef.current?.focus() }} onReact={handleReact} />
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

            {/* Template panel for new outbound conversations */}
            {showTemplatePanel && (
              <div style={{ marginBottom: 10, background: '#F0FDFB', borderRadius: 14, border: '1px solid #A7F3D0', padding: '14px 14px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0d9488' }}>Iniciar conversa com template</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B' }}>Selecione um template aprovado para enviar</p>
                  </div>
                  <button onClick={() => setShowTemplatePanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                {templates.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', margin: '0 0 10px' }}>
                    Nenhum template aprovado cadastrado.
                    <span style={{ color: '#00A896', cursor: 'pointer', marginLeft: 4 }} onClick={() => navigate('/settings?tab=whatsapp')}>
                      Configurar templates
                    </span>
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, maxHeight: 160, overflowY: 'auto' }}>
                    {templates.map(tpl => {
                      const bodyText = tpl.components?.find((c: any) => c.type === 'BODY')?.text || tpl.name
                      const isSelected = selectedTemplate === tpl.id
                      return (
                        <button key={tpl.id} onClick={() => { setSelectedTemplate(tpl.id); setTemplateVars({}) }}
                          style={{ textAlign: 'left', padding: '8px 10px', background: isSelected ? '#CCFBF1' : '#FFFFFF', border: `1.5px solid ${isSelected ? '#0d9488' : '#D1FAE5'}`, borderRadius: 9, cursor: 'pointer', transition: 'all 0.15s' }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1A2B4A' }}>{tpl.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bodyText}</p>
                        </button>
                      )
                    })}
                  </div>
                )}
                {selectedTemplate && (() => {
                  const tmpl = templates.find(t => t.id === selectedTemplate)
                  if (!tmpl) return null
                  const bodyComp = tmpl.components?.find((c: any) => c.type === 'BODY')
                  if (!bodyComp?.text) return null
                  const matches = [...bodyComp.text.matchAll(/\{\{(\d+)\}\}/g)]
                  if (matches.length === 0) return null
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Variáveis do template:</p>
                      {matches.map(([, n]) => (
                        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{`{{${n}}}`}</span>
                          <input value={templateVars[n] || ''}
                            onChange={e => setTemplateVars(v => ({ ...v, [n]: e.target.value }))}
                            placeholder={`Variável ${n}`}
                            style={{ flex: 1, padding: '5px 8px', fontSize: 12, background: '#fff', border: '1px solid #D1FAE5', borderRadius: 7, color: '#1A2B4A', outline: 'none' }} />
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowTemplatePanel(false)}
                    style={{ flex: 1, padding: '8px 0', fontSize: 12, color: '#64748B', border: '1px solid #D1FAE5', borderRadius: 9, background: '#fff', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleSendNewConvTemplate}
                    disabled={sendingTemplate || !selectedTemplate}
                    style={{ flex: 2, padding: '8px 0', fontSize: 12, fontWeight: 700, color: '#fff', background: sendingTemplate || !selectedTemplate ? '#94A3B8' : '#0d9488', border: 'none', borderRadius: 9, cursor: sendingTemplate || !selectedTemplate ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
                    {sendingTemplate ? 'Enviando...' : 'Enviar Template'}
                  </button>
                </div>
              </div>
            )}

            {/* Quick replies panel */}
            {showQuickReplies && (
              <div style={{ marginBottom: 8, background: '#F0FDFB', borderRadius: 12, border: '1px solid #D1FAE5', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Respostas rápidas</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => { setShowQuickReplies(false); setShowQRManager(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00A896', fontSize: 11, fontWeight: 600 }}>
                      Gerenciar minhas
                    </button>
                    <button onClick={() => setShowQuickReplies(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}>
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
                {quickReplies.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>
                    Nenhuma resposta rápida cadastrada.<br />
                    <span style={{ color: '#00A896', cursor: 'pointer' }} onClick={() => navigate('/settings?tab=whatsapp')}>
                      Configure em Configurações → WhatsApp
                    </span>
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {quickReplies.map(qr => (
                      <button
                        key={qr.id}
                        onClick={() => { setInputText(qr.text); setShowQuickReplies(false) }}
                        style={{ textAlign: 'left', padding: '8px 12px', background: '#FFFFFF', border: '1px solid #D1FAE5', borderRadius: 8, cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#00A896'; e.currentTarget.style.background = '#E6F7F5' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1FAE5'; e.currentTarget.style.background = '#FFFFFF' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{qr.label}</p>
                          <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: qr.user_id ? '#EFF6FF' : '#ECFDF5', color: qr.user_id ? '#1D4ED8' : '#059669' }}>
                            {qr.user_id ? 'Pessoal' : 'Global'}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qr.text}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Attachment menu */}
            {showAttach && (
              <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { icon: Image,    label: 'Imagem',    bg: '#EDE9FE', color: '#7C3AED', accept: 'image/*' },
                  { icon: Video,    label: 'Vídeo',     bg: '#DBEAFE', color: '#2563EB', accept: 'video/*' },
                  { icon: FileText, label: 'Documento', bg: '#FEF3C7', color: '#D97706', accept: '.pdf,.doc,.docx,.xlsx,.xls' },
                  { icon: Mic,      label: 'Áudio',     bg: '#D1FAE5', color: '#059669', accept: 'audio/*' },
                ].map(item => {
                  const IconComp = item.icon
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (fileInputRef.current) fileInputRef.current.accept = item.accept
                        fileInputRef.current?.click()
                        setShowAttach(false)
                      }}
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

            {/* [FIX P3] Reply preview bar */}
            {replyTo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDFB', border: '1px solid #B2E8E2', borderRadius: 10, padding: '6px 12px', marginBottom: 8 }}>
                <CornerUpLeft size={14} color="#00A896" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#00A896', marginBottom: 1 }}>
                    {replyTo.from === 'me' ? 'Você' : (activeConv?.name || 'Contato')}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {replyTo.content}
                  </div>
                </div>
                <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div ref={emojiPickerRef} style={{ position: 'absolute', bottom: 72, left: 0, zIndex: 40 }}>
                <EmojiPicker
                  data={emojiData}
                  onEmojiSelect={handleEmojiSelect}
                  locale="pt"
                  theme="light"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </div>
            )}

            {/* Menu "/" de respostas rápidas */}
            {showSlashMenu && slashResults.length > 0 && (
              <div style={{ position: 'absolute', bottom: 72, left: 0, right: 0, zIndex: 45, background: '#fff', border: '1px solid #D1FAE5', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto' }}>
                {slashResults.map((qr, i) => (
                  <div
                    key={qr.id}
                    onMouseDown={e => { e.preventDefault(); applyQuickReply(qr) }}
                    onMouseEnter={() => setSlashHighlightIndex(i)}
                    style={{ padding: '9px 14px', cursor: 'pointer', background: i === slashHighlightIndex ? '#F0FDFB' : '#fff', borderBottom: i < slashResults.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A' }}>{qr.label}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: qr.user_id ? '#EFF6FF' : '#ECFDF5', color: qr.user_id ? '#1D4ED8' : '#059669' }}>
                        {qr.user_id ? 'Pessoal' : 'Global'}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {qr.text.slice(0, 60)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 24h window expired overlay */}
            {windowExpired && recorderState === 'idle' ? (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>⏱ Janela de 24h expirada</p>
                  <p style={{ fontSize: 11, color: '#B45309', margin: '2px 0 0' }}>Use um template para reativar a conversa</p>
                </div>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  Reativar conversa
                </button>
              </div>
            ) : null}

            {/* Conversa livre na fila — permite reservar antes de digitar */}
            {activeConv && !activeConv.assigned_user_id && activeConv.status === 'waiting' && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>⏳ Conversa aguardando atendimento</p>
                  <p style={{ fontSize: 11, color: '#B45309', margin: '2px 0 0' }}>Assuma para reservar antes de responder, ou envie a mensagem que ela é atribuída a você automaticamente.</p>
                </div>
                <button
                  onClick={handleClaimConversation}
                  style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  Assumir conversa
                </button>
              </div>
            )}

            {/* Conversa parada de outro atendente — permite resgatar */}
            {activeConv && isConvStale(activeConv) && (
              <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#9A3412', margin: 0 }}>⏰ Conversa parada</p>
                  <p style={{ fontSize: 11, color: '#C2410C', margin: '2px 0 0' }}>
                    Era de {activeConv.assigned_user_name || 'outro atendente'}, sem resposta há {hoursSince(activeConv.lastTime)}h.
                  </p>
                </div>
                <button
                  onClick={handleRescueConversation}
                  style={{ background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  Resgatar
                </button>
              </div>
            )}

            {/* Input row */}
            {recorderState === 'recording' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Cancel */}
                <button onClick={cancelRecording} title="Cancelar"
                  style={{ width: 40, height: 40, borderRadius: '50%', background: '#F1F5F9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={16} color="#64748B" />
                </button>
                {/* Waveform + Timer */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDFB', border: '1.5px solid #D1FAE5', borderRadius: 28, padding: '0 16px', height: 46 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
                  </span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 28 }}>
                    {waveformBars.map((h, i) => (
                      <div key={i} style={{ flex: 1, height: `${Math.round(h * 100)}%`, minHeight: 3, background: '#00A896', borderRadius: 2, transition: 'height 0.08s ease' }} />
                    ))}
                  </div>
                </div>
                {/* Stop → preview */}
                <button onClick={stopRecordingForPreview} title="Parar e pré-visualizar"
                  style={{ width: 44, height: 44, borderRadius: '50%', background: '#00A896', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
                  <Check size={20} />
                </button>
              </div>
            ) : recorderState === 'preview' && audioPreviewUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Discard */}
                <button onClick={discardAudio} title="Descartar"
                  style={{ width: 40, height: 40, borderRadius: '50%', background: '#FEE2E2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={16} color="#EF4444" />
                </button>
                {/* Audio player */}
                <audio src={audioPreviewUrl} controls style={{ flex: 1, height: 36, minWidth: 0 }} />
                {/* Send */}
                <button onClick={sendAudio} title="Enviar áudio"
                  style={{ width: 44, height: 44, borderRadius: '50%', background: '#00A896', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
                  <Send size={18} />
                </button>
              </div>
            ) : (
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
                  ref={inputRef}
                  value={inputText}
                  disabled={windowExpired}
                  onChange={e => {
                    if (windowExpired) return
                    setInputText(e.target.value)
                    setSlashMenuDismissed(false)
                    setSlashHighlightIndex(0)
                    if (presenceChannelRef.current && user?.id) {
                      presenceChannelRef.current.track({ userId: user.id, typing: true }).catch(() => {})
                      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
                      typingTimerRef.current = setTimeout(() => {
                        presenceChannelRef.current?.track({ userId: user.id, typing: false }).catch(() => {})
                      }, 3000)
                    }
                  }}
                  onKeyDown={e => {
                    if (showSlashMenu && slashResults.length > 0) {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashHighlightIndex(i => Math.min(i + 1, slashResults.length - 1)); return }
                      if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashHighlightIndex(i => Math.max(i - 1, 0)); return }
                      if (e.key === 'Escape')    { e.preventDefault(); setSlashMenuDismissed(true); return }
                      if (e.key === 'Enter')     { e.preventDefault(); applyQuickReply(slashResults[slashHighlightIndex] || slashResults[0]); return }
                    }
                    if (!windowExpired && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                  placeholder={windowExpired ? 'Janela de 24h expirada' : 'Digite uma mensagem...'}
                  rows={1}
                  style={{
                    flex: 1, padding: '10px 18px', fontSize: 14,
                    background: windowExpired ? '#F9FAFB' : '#F0FDFB',
                    border: `1.5px solid ${windowExpired ? '#E5E7EB' : '#D1FAE5'}`,
                    borderRadius: 28,
                    color: windowExpired ? '#9CA3AF' : '#1A2B4A',
                    outline: 'none', resize: 'none', minHeight: 42, maxHeight: 100,
                    fontFamily: 'inherit', lineHeight: 1.5, transition: 'all 0.2s',
                    boxShadow: '0 1px 4px rgba(0,168,150,0.08) inset',
                    cursor: windowExpired ? 'not-allowed' : 'text',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#00A896'; e.currentTarget.style.background = '#FFFFFF' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#D1FAE5'; e.currentTarget.style.background = '#F0FDFB' }}
                />
                {inputText.trim() ? (
                  <button onClick={handleSend}
                    style={{ width: 44, height: 44, borderRadius: '50%', background: '#00A896', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, transform 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#007A6E'; e.currentTarget.style.transform = 'scale(1.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#00A896'; e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    <Send style={{ width: 18, height: 18 }} />
                  </button>
                ) : (
                  <button onClick={startRecording} title="Gravar áudio"
                    style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00A896', color: '#fff', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#007A6E' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#00A896' }}
                  >
                    <Mic style={{ width: 18, height: 18 }} />
                  </button>
                )}
              </div>
            )}
          </div>
          </>
        </div>

        {/* ── Col 3: Contact Panel ──────────────────────────────────────────────── */}
        {showContactInfo && !isMobile && (
          <div style={{ width: 280, flexShrink: 0, background: '#FFFFFF', borderLeft: '1px solid #D1FAE5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeConv ? (
            <>
            {/* Tab bar */}
            <div style={{ flexShrink: 0, display: 'flex', background: '#FFFFFF', borderBottom: '1px solid #D1FAE5', alignItems: 'center' }}>
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
              <button onClick={exportConversation} title="Exportar conversa"
                style={{ padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', flexShrink: 0, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#00A896')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
              >
                <Download size={14} />
              </button>
            </div>

            {/* ── Detalhes tab ── */}
            {rightPanelTab === 'details' && (
              <div className="wa-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>

                {/* Concluir / Sair buttons */}
                {activeConv.status !== 'closed' && (
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2f5f3', background: '#f0fdfb', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <button onClick={handleCloseConversation}
                      style={{ width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 3px 10px rgba(13,148,136,0.35)', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 5px 16px rgba(13,148,136,0.45)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(13,148,136,0.35)' }}>
                      ✅ Concluir Atendimento
                    </button>
                    {activeConv.assigned_user_id && (
                      <button onClick={handleLeaveConversation}
                        style={{ width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#92400E', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                        🚪 Sair do Atendimento
                      </button>
                    )}
                  </div>
                )}

                {/* ── SEÇÃO: CONTATO ─────────────────────────────────────────── */}
                <div style={{ borderBottom: '1px solid #e2f5f3' }}>
                  <button onClick={() => setCollapseContact(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fefd', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#edfaf8')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f8fefd')}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contato</span>
                    {collapseContact
                      ? <ChevronRight style={{ width: 14, height: 14, color: '#0d9488' }} />
                      : <ChevronDown style={{ width: 14, height: 14, color: '#0d9488' }} />}
                  </button>
                  {!collapseContact && (
                    <div style={{ padding: '0 0 12px' }}>
                      {/* Avatar + name + phone */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 16px 12px', background: 'linear-gradient(180deg, #f0fdfb 0%, #ffffff 100%)' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden', fontSize: 24, fontWeight: 700, color: '#fff', background: activeConv.profile_picture_url ? 'transparent' : getAvatarBgColor(activeConv.name), boxShadow: '0 3px 12px rgba(13,148,136,0.3)', border: '2.5px solid white' }}>
                          {activeConv.profile_picture_url
                            ? <img src={activeConv.profile_picture_url} alt={activeConv.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : activeConv.isGroup
                            ? <Users style={{ width: 26, height: 26, color: 'rgba(255,255,255,0.9)' }} />
                            : getInitials(activeConv.name)}
                        </div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', textAlign: 'center', margin: 0 }}>{activeConv.name}</p>
                        <p style={{ fontSize: 12, color: '#64748B', marginTop: 2, textAlign: 'center' }}>
                          {activeConv.isGroup ? 'Grupo WhatsApp' : activeConv.phone}
                        </p>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {activeConv.contact_type && activeConv.contact_type !== 'unknown' && (
                            <span style={{
                              fontSize: 11, padding: '2px 10px', borderRadius: 9999, fontWeight: 600,
                              background: activeConv.contact_type === 'lead' ? '#e6f7f5' : activeConv.contact_type === 'client' ? '#d1fae5' : activeConv.contact_type === 'supplier' ? '#ede9fe' : '#f1f5f9',
                              color: activeConv.contact_type === 'lead' ? '#0d9488' : activeConv.contact_type === 'client' ? '#059669' : activeConv.contact_type === 'supplier' ? '#7C3AED' : '#64748B',
                            }}>
                              {activeConv.contact_type === 'lead' ? 'Nova Família' : activeConv.contact_type === 'client' ? 'Cliente' : activeConv.contact_type === 'supplier' ? 'Fornecedor' : activeConv.contact_type}
                            </span>
                          )}
                          {activeConv.isGroup && (
                            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 9999, fontWeight: 600, background: '#ede9fe', color: '#7C3AED' }}>Grupo</span>
                          )}
                          {activeConv.labels.map(lb => (
                            <span key={lb.text} className={`text-xs px-2 py-0.5 rounded-full font-medium ${lb.color}`}>{lb.text}</span>
                          ))}
                        </div>
                        {!activeConv.isGroup && (
                          <button onClick={() => { setEditingContact(v => !v); if (!editingContact) setEditForm({ name: activeConv.name, contact_type: activeConv.contact_type || '', notes: '' }) }}
                            style={{ marginTop: 8, fontSize: 11, border: '1px solid #d1fae5', color: '#0d9488', background: 'transparent', padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#e6f7f5')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            ✏️ Editar contato
                          </button>
                        )}
                      </div>

                      {/* Inline edit form */}
                      {editingContact && (
                        <div style={{ padding: '0 12px 12px' }}>
                          <div style={{ background: '#f0fdfb', borderRadius: 10, padding: '10px 12px', border: '1px solid #d1fae5', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748B', marginBottom: 3 }}>Nome</label>
                              <input value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))}
                                style={{ width: '100%', padding: '7px 9px', fontSize: 12, background: '#fff', border: '1px solid #d1fae5', borderRadius: 7, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748B', marginBottom: 3 }}>Tipo</label>
                              <select value={editForm.contact_type} onChange={e => setEditForm(f => ({...f, contact_type: e.target.value}))}
                                style={{ width: '100%', padding: '7px 9px', fontSize: 12, background: '#fff', border: '1px solid #d1fae5', borderRadius: 7, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}>
                                <option value="">Desconhecido</option>
                                <option value="lead">Nova Família</option>
                                <option value="client">Cliente</option>
                                <option value="supplier">Fornecedor</option>
                                <option value="other">Outro</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748B', marginBottom: 3 }}>Nota interna</label>
                              <textarea value={editForm.notes || ''}
                                onChange={e => setEditForm(f => ({...f, notes: e.target.value}))}
                                placeholder="Anotações sobre este contato..."
                                rows={3}
                                style={{ width: '100%', padding: '7px 9px', fontSize: 12, background: '#fff', border: '1px solid #d1fae5', borderRadius: 7, color: '#1A2B4A', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={async () => {
                                if (!activeId || !effectiveInstitutionId) return
                                if (editForm.name && editForm.name !== activeConv.name) {
                                  skipNextNameUpdateRef.current = activeId
                                  setConversations(prev => prev.map(c => c.id === activeId ? {...c, name: editForm.name} : c))
                                  await supabase.from('whatsapp_conversations').update({ contact_name: editForm.name })
                                    .eq('institution_id', effectiveInstitutionId).eq('remote_jid', rawJid(activeId))
                                  const normPhone = (() => {
                                    let d = rawJid(activeId).replace(/@.*/, '').replace(/\D/g, '')
                                    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
                                    if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
                                    if (d.length === 11) d = '55' + d
                                    return d
                                  })()
                                  await supabase.from('whatsapp_contacts')
                                    .update({ name: editForm.name })
                                    .eq('institution_id', effectiveInstitutionId)
                                    .eq('phone', normPhone)
                                  console.log('[SYNC NAME] atualizado em whatsapp_contacts:', normPhone)
                                }
                                if (editForm.contact_type && editForm.contact_type !== (activeConv.contact_type || '')) {
                                  await DatabaseService.setConversationContactType(effectiveInstitutionId, rawJid(activeId), editForm.contact_type)
                                  setConversations(prev => prev.map(c => c.id === activeId ? {...c, contact_type: editForm.contact_type} : c))
                                }
                                if (editForm.notes !== undefined) {
                                  await supabase.from('whatsapp_conversations')
                                    .update({ notes: editForm.notes })
                                    .eq('institution_id', effectiveInstitutionId)
                                    .eq('remote_jid', rawJid(activeId))
                                }
                                setEditingContact(false)
                              }}
                                style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, color: '#fff', background: '#0d9488', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                                Salvar
                              </button>
                              <button onClick={() => setEditingContact(false)}
                                style={{ padding: '6px 10px', fontSize: 12, color: '#64748B', border: '1px solid #d1fae5', borderRadius: 7, background: '#fff', cursor: 'pointer' }}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Who is this contact? */}
                      {!activeConv.isGroup && (!activeConv.contact_type || activeConv.contact_type === 'unknown') && !activeConv.lead_id && (
                        <div style={{ margin: '0 12px', padding: '10px 12px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a' }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#d97706', margin: '0 0 8px' }}>Quem é esse contato?</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                            {[
                              { key: 'lead',     label: '🎓 Nova Família', bg: '#0d9488', color: '#fff',    onClick: () => handleContactType('lead') },
                              { key: 'client',   label: '✅ Família',       bg: '#d1fae5', color: '#059669', onClick: () => handleContactType('client') },
                              { key: 'supplier', label: '🏢 Fornecedor',    bg: '#ede9fe', color: '#7C3AED', onClick: () => handleContactType('supplier') },
                              { key: 'other',    label: 'Outro',            bg: '#f1f5f9', color: '#64748B', onClick: () => handleContactType('other') },
                            ].map(opt => (
                              <button key={opt.key} onClick={opt.onClick}
                                style={{ padding: '7px 5px', fontSize: 11, fontWeight: 500, background: '#fff', color: '#64748B', border: '1px solid #e2f5f3', borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}
                                onMouseEnter={e => { e.currentTarget.style.background = opt.bg; e.currentTarget.style.color = opt.color; e.currentTarget.style.borderColor = opt.bg }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#e2f5f3' }}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── SEÇÃO: ATENDIMENTO ─────────────────────────────────────── */}
                <div style={{ borderBottom: '1px solid #e2f5f3' }}>
                  <button onClick={() => setCollapseAtendimento(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fefd', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#edfaf8')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f8fefd')}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Atendimento</span>
                    {collapseAtendimento
                      ? <ChevronRight style={{ width: 14, height: 14, color: '#0d9488' }} />
                      : <ChevronDown style={{ width: 14, height: 14, color: '#0d9488' }} />}
                  </button>
                  {!collapseAtendimento && (
                    <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                      {/* 24h window */}
                      {!activeConv.isGroup && (() => {
                        const lastIncoming = [...activeConv.messages].filter(m => m.from === 'them').slice(-1)[0]
                        const msElapsed    = lastIncoming ? Date.now() - lastIncoming.ts.getTime() : Infinity
                        const windowOpen   = msElapsed < 24 * 3600000
                        const hoursLeft    = Math.max(0, 24 - msElapsed / 3600000)
                        const hh           = Math.floor(hoursLeft)
                        const mm           = Math.round((hoursLeft - hh) * 60)
                        return (
                          <div style={{ padding: '8px 10px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, background: windowOpen ? '#d1fae5' : '#fee2e2', border: `1px solid ${windowOpen ? '#a7f3d0' : '#fecaca'}` }}>
                            <span style={{ fontSize: 13 }}>{windowOpen ? '🟢' : '🔴'}</span>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: windowOpen ? '#059669' : '#dc2626', margin: 0 }}>
                                {windowOpen ? 'Janela aberta' : 'Janela expirada'}
                              </p>
                              <p style={{ fontSize: 11, color: windowOpen ? '#065f46' : '#991b1b', margin: 0 }}>
                                {windowOpen ? `Expira em ${hh}h ${mm}min` : 'Use template para iniciar'}
                              </p>
                            </div>
                            {!windowOpen && (
                              <button onClick={() => setShowTemplateModal(true)}
                                style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 7, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                                Template
                              </button>
                            )}
                          </div>
                        )
                      })()}

                      {/* Status */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Status</label>
                        <select value={activeConv.status} onChange={e => handleStatusChange(e.target.value as ConvStatus)}
                          style={{ width: '100%', padding: '7px 9px', fontSize: 12, background: '#f0fdfb', border: '1px solid #d1fae5', borderRadius: 8, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}>
                          <option value="waiting">Aguardando</option>
                          <option value="open">Em Atendimento</option>
                          <option value="closed">Concluído</option>
                        </select>
                      </div>

                      {/* Attendant */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Atendente</label>
                        {transferring ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)}
                              style={{ width: '100%', padding: '7px 9px', fontSize: 12, background: '#f0fdfb', border: '1px solid #d1fae5', borderRadius: 8, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}>
                              <option value="">Selecionar atendente...</option>
                              {users.filter(u => u.id !== activeConv.assigned_user_id).map(u => (
                                <option key={u.id} value={u.id}>{u.full_name}</option>
                              ))}
                            </select>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={activeConv.status === 'closed' ? handleAssignFromClosed : handleTransfer} disabled={!transferTarget}
                                style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, color: '#fff', background: '#0d9488', border: 'none', borderRadius: 7, cursor: 'pointer', opacity: !transferTarget ? 0.4 : 1 }}>
                                {activeConv.status === 'closed' ? 'Atribuir' : 'Transferir'}
                              </button>
                              <button onClick={() => { setTransferring(false); setTransferTarget('') }}
                                style={{ padding: '6px 10px', fontSize: 12, color: '#64748B', border: '1px solid #d1fae5', borderRadius: 7, background: '#fff', cursor: 'pointer' }}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : activeConv.status === 'closed' ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: '#94A3B8' }}>—</span>
                            <button onClick={() => setTransferring(true)}
                              style={{ fontSize: 11, border: '1px solid #0d9488', color: '#0d9488', background: 'transparent', padding: '3px 9px', borderRadius: 7, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#e6f7f5')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              Atribuir
                            </button>
                          </div>
                        ) : activeConv.assigned_user_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdfb', borderRadius: 8, border: '1px solid #d1fae5' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                {getInitials(activeConv.assigned_user_name || '').slice(0, 1)}
                              </div>
                              <span style={{ fontSize: 12, color: '#1A2B4A', fontWeight: 500 }}>{activeConv.assigned_user_name}</span>
                            </div>
                            <button onClick={() => setTransferring(true)}
                              style={{ fontSize: 11, color: '#0d9488', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                              Trocar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setTransferring(true)}
                            style={{ width: '100%', padding: '7px 0', fontSize: 12, color: '#64748B', background: 'transparent', border: '1px dashed #d1fae5', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.color = '#0d9488'; e.currentTarget.style.background = '#e6f7f5' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1fae5'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'transparent' }}>
                            + Atribuir atendente
                          </button>
                        )}
                      </div>

                      {/* Bot toggle */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Robô</label>
                        <button
                          onClick={async () => {
                            if (!activeId || !effectiveInstitutionId) return
                            const newBotActive = !activeConv.bot_active
                            await supabase.from('whatsapp_conversations')
                              .update(newBotActive
                                ? { bot_active: true, assigned_user_id: null, assigned_user_name: null }
                                : { bot_active: false, assigned_user_id: user?.id, assigned_user_name: user?.full_name || user?.email, status: 'open' }
                              )
                              .eq('institution_id', effectiveInstitutionId)
                              .eq('remote_jid', rawJid(activeId))
                            setConversations(prev => prev.map(c =>
                              c.id === activeId
                                ? { ...c, bot_active: newBotActive, ...(newBotActive
                                    ? { assigned_user_id: undefined, assigned_user_name: undefined }
                                    : { assigned_user_id: user?.id, assigned_user_name: user?.full_name || user?.email, status: 'open' as ConvStatus }) }
                                : c
                            ))
                            setHubToast(newBotActive ? 'Robô ativado' : 'Robô desativado — atendimento assumido por você')
                            setTimeout(() => setHubToast(null), 3000)
                          }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: activeConv.bot_active ? '#d1fae5' : '#f1f5f9',
                            border: `1px solid ${activeConv.bot_active ? '#a7f3d0' : '#e2e8f0'}`,
                            borderRadius: 9, cursor: 'pointer', transition: 'all 0.15s',
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontSize: 14 }}>🤖</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: activeConv.bot_active ? '#059669' : '#64748B' }}>
                              Robô {activeConv.bot_active ? 'ativo' : 'inativo'}
                            </span>
                          </div>
                          <div style={{
                            width: 32, height: 18, borderRadius: 9999,
                            background: activeConv.bot_active ? '#00A896' : '#CBD5E1',
                            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                          }}>
                            <div style={{
                              position: 'absolute', top: 2,
                              left: activeConv.bot_active ? 16 : 2,
                              width: 14, height: 14, borderRadius: '50%', background: '#fff',
                              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }} />
                          </div>
                        </button>
                      </div>

                      {/* Tags */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Etiquetas</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {(activeConv.tags || []).length === 0 && hubTags.length === 0 && (
                            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Configure etiquetas em Configurações → Etiquetas</span>
                          )}
                          {(activeConv.tags || []).map(tag => {
                            const color = hubTags.find(t => t.name === tag)?.color || '#6366f1'
                            return (
                              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, padding: '2px 7px', borderRadius: 9999, fontWeight: 600, color: '#fff', background: color }}>
                                {tag}
                                <button onClick={() => handleRemoveTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
                              </span>
                            )
                          })}
                          {addingTag ? (
                            hubTags.length > 0 ? (
                              <select autoFocus value={newTag}
                                onChange={e => { if (e.target.value) handleAddTag(e.target.value); else { setAddingTag(false); setNewTag('') } }}
                                onBlur={() => { setAddingTag(false); setNewTag('') }}
                                style={{ fontSize: 11, padding: '2px 7px', borderRadius: 9999, border: '1px dashed #d1fae5', background: '#fff', color: '#1A2B4A', outline: 'none', cursor: 'pointer' }}>
                                <option value="">Selecionar etiqueta...</option>
                                {hubTags.filter(t => !(activeConv?.tags || []).includes(t.name)).map(t => (
                                  <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                              </select>
                            ) : (
                              <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddTag(newTag); if (e.key === 'Escape') { setAddingTag(false); setNewTag('') } }}
                                onBlur={() => { if (newTag.trim()) handleAddTag(newTag); else { setAddingTag(false); setNewTag('') } }}
                                placeholder="Nova etiqueta..."
                                style={{ fontSize: 11, padding: '2px 7px', borderRadius: 9999, border: '1px dashed #d1fae5', background: 'transparent', color: '#1A2B4A', outline: 'none', width: 110 }}
                                maxLength={20} />
                            )
                          ) : hubTags.length > 0 ? (
                            <button onClick={() => setAddingTag(true)}
                              style={{ fontSize: 11, padding: '2px 9px', borderRadius: 9999, border: '1px dashed #d1fae5', color: '#0d9488', background: 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.background = '#e6f7f5' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1fae5'; e.currentTarget.style.background = 'transparent' }}>
                              + Etiqueta
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── SEÇÃO: LEAD VINCULADO ───────────────────────────────────── */}
                {!activeConv.isGroup && (
                  <div style={{ borderBottom: '1px solid #e2f5f3' }}>
                    <button onClick={() => setCollapseLead(v => !v)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fefd', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#edfaf8')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#f8fefd')}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lead Vinculado</span>
                      {collapseLead
                        ? <ChevronRight style={{ width: 14, height: 14, color: '#0d9488' }} />
                        : <ChevronDown style={{ width: 14, height: 14, color: '#0d9488' }} />}
                    </button>
                    {!collapseLead && (
                      <div style={{ padding: '0 12px 12px' }}>
                        {activeConv.lead_id ? (
                          leadData ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {/* Lead data header */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f0fdfb', borderRadius: 9, border: '1px solid #d1fae5' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <User style={{ width: 13, height: 13, color: '#0d9488', flexShrink: 0 }} />
                                  <div>
                                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1A2B4A' }}>{leadData.responsible_name || '—'}</p>
                                    {leadData.student_name && (
                                      <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{leadData.student_name}</p>
                                    )}
                                  </div>
                                </div>
                                <button onClick={() => { setEditingLead(v => !v); if (!editingLead) setLeadEditForm({ ...leadData }) }}
                                  style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 7, border: '1px solid #d1fae5', color: '#0d9488', background: 'transparent', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#e6f7f5')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  {editingLead ? 'Cancelar' : '✏️ Editar'}
                                </button>
                              </div>

                              {/* View mode */}
                              {!editingLead && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '0 2px' }}>
                                  {leadData.grade_interest && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                      <span style={{ color: '#64748B' }}>Série</span>
                                      <span style={{ color: '#1A2B4A', fontWeight: 500 }}>{leadData.grade_interest}</span>
                                    </div>
                                  )}
                                  {leadData.email && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
                                      <span style={{ color: '#64748B', flexShrink: 0 }}>E-mail</span>
                                      <span style={{ color: '#1A2B4A', fontWeight: 500, wordBreak: 'break-all', textAlign: 'right' }}>{leadData.email}</span>
                                    </div>
                                  )}
                                  {/* Lead funnel visual */}
                                  {(() => {
                                    const STAGES = [
                                      { key: 'new',       label: 'Novo'       },
                                      { key: 'contact',   label: 'Contato'    },
                                      { key: 'scheduled', label: 'Ag.'        },
                                      { key: 'visit',     label: 'Visita'     },
                                      { key: 'proposal',  label: 'Proposta'   },
                                      { key: 'enrolled',  label: 'Matrícula'  },
                                    ]
                                    const curStatus = leadEditForm.status || leadData.status || 'new'
                                    const curIdx = STAGES.findIndex(s => s.key === curStatus)
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                          {STAGES.map((stage, idx) => {
                                            const done   = idx < curIdx
                                            const active = idx === curIdx
                                            return (
                                              <React.Fragment key={stage.key}>
                                                <div
                                                  title={stage.label}
                                                  onClick={() => { setLeadEditForm((f: any) => ({ ...f, status: stage.key })); handleSaveLead({ status: stage.key }) }}
                                                  style={{
                                                    width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                                                    background: done || active ? '#00A896' : '#E2E8F0',
                                                    border: active ? '2.5px solid #007A6E' : '2px solid transparent',
                                                    boxSizing: 'border-box',
                                                    boxShadow: active ? '0 0 0 2px rgba(0,168,150,0.25)' : 'none',
                                                    transition: 'all 0.15s',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                  }}
                                                >
                                                  {done && <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>✓</span>}
                                                </div>
                                                {idx < STAGES.length - 1 && (
                                                  <div style={{ flex: 1, height: 2, background: done ? '#00A896' : '#E2E8F0', transition: 'background 0.15s' }} />
                                                )}
                                              </React.Fragment>
                                            )
                                          })}
                                        </div>
                                        <div style={{ display: 'flex' }}>
                                          {STAGES.map((stage, idx) => (
                                            <span key={stage.key}
                                              onClick={() => { setLeadEditForm((f: any) => ({ ...f, status: stage.key })); handleSaveLead({ status: stage.key }) }}
                                              style={{
                                                flex: 1, fontSize: 9, textAlign: 'center', lineHeight: 1.2, cursor: 'pointer',
                                                color: idx <= curIdx ? '#0d9488' : '#94A3B8',
                                                fontWeight: idx === curIdx ? 700 : 400,
                                              }}>
                                              {stage.label}
                                            </span>
                                          ))}
                                        </div>
                                        <button
                                          onClick={() => { setLeadEditForm((f: any) => ({ ...f, status: 'lost' })); handleSaveLead({ status: 'lost' }) }}
                                          style={{ fontSize: 10, color: curStatus === 'lost' ? '#fff' : '#EF4444', background: curStatus === 'lost' ? '#EF4444' : 'transparent', border: '1px solid #FECACA', borderRadius: 7, padding: '3px 8px', cursor: 'pointer', alignSelf: 'flex-start', transition: 'all 0.15s' }}
                                          onMouseEnter={e => { if (curStatus !== 'lost') e.currentTarget.style.background = '#FEE2E2' }}
                                          onMouseLeave={e => { if (curStatus !== 'lost') e.currentTarget.style.background = 'transparent' }}>
                                          {curStatus === 'lost' ? '🔴 Perdido' : 'Marcar como Perdido'}
                                        </button>
                                      </div>
                                    )
                                  })()}
                                  {leadData.source && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                      <span style={{ color: '#64748B' }}>Origem</span>
                                      <span style={{ color: '#1A2B4A', fontWeight: 500 }}>{leadData.source}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Edit mode */}
                              {editingLead && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, background: '#f0fdfb', borderRadius: 10, padding: '10px 12px', border: '1px solid #d1fae5' }}>
                                  {[
                                    { label: 'Responsável', key: 'responsible_name' },
                                    { label: 'Aluno', key: 'student_name' },
                                    { label: 'E-mail', key: 'email' },
                                  ].map(({ label, key }) => (
                                    <div key={key}>
                                      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748B', marginBottom: 3 }}>{label}</label>
                                      <input value={(leadEditForm as any)[key] || ''}
                                        onChange={e => setLeadEditForm((f: any) => ({ ...f, [key]: e.target.value }))}
                                        style={{ width: '100%', padding: '6px 8px', fontSize: 12, background: '#fff', border: '1px solid #d1fae5', borderRadius: 7, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                  ))}
                                  <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748B', marginBottom: 3 }}>Série</label>
                                    <select value={leadEditForm.grade_interest || ''}
                                      onChange={e => setLeadEditForm((f: any) => ({ ...f, grade_interest: e.target.value }))}
                                      style={{ width: '100%', padding: '6px 8px', fontSize: 12, background: '#fff', border: '1px solid #d1fae5', borderRadius: 7, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}>
                                      <option value="">Selecionar...</option>
                                      {['Educação Infantil','1º Ano','2º Ano','3º Ano','4º Ano','5º Ano','6º Ano','7º Ano','8º Ano','9º Ano','1º EM','2º EM','3º EM'].map(g => (
                                        <option key={g} value={g}>{g}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748B', marginBottom: 3 }}>Status</label>
                                    <select value={leadEditForm.status || 'new'}
                                      onChange={e => setLeadEditForm((f: any) => ({ ...f, status: e.target.value }))}
                                      style={{ width: '100%', padding: '6px 8px', fontSize: 12, background: '#fff', border: '1px solid #d1fae5', borderRadius: 7, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}>
                                      <option value="new">Novo</option>
                                      <option value="contact">Em contato</option>
                                      <option value="scheduled">Visita agendada</option>
                                      <option value="visit">Visita realizada</option>
                                      <option value="proposal">Proposta enviada</option>
                                      <option value="enrolled">Matriculado</option>
                                      <option value="lost">Perdido</option>
                                    </select>
                                  </div>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => handleSaveLead()}
                                      disabled={savingLead}
                                      style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, color: '#fff', background: savingLead ? '#94A3B8' : '#0d9488', border: 'none', borderRadius: 7, cursor: savingLead ? 'not-allowed' : 'pointer' }}>
                                      {savingLead ? 'Salvando...' : 'Salvar'}
                                    </button>
                                    <button onClick={() => setEditingLead(false)}
                                      style={{ padding: '6px 10px', fontSize: 12, color: '#64748B', border: '1px solid #d1fae5', borderRadius: 7, background: '#fff', cursor: 'pointer' }}>
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Actions row */}
                              <button onClick={() => navigate(`/leads?highlight=${activeConv.lead_id}`)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', background: 'transparent', border: '1px solid #d1fae5', borderRadius: 9, cursor: 'pointer', fontSize: 12, color: '#0d9488', fontWeight: 600, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#e6f7f5'; e.currentTarget.style.borderColor = '#0d9488' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#d1fae5' }}>
                                <User style={{ width: 12, height: 12 }} />
                                Ver no CRM
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#0d9488] border-t-transparent" />
                            </div>
                          )
                        ) : linkingLead ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            <input autoFocus value={leadSearch} onChange={e => searchLeads(e.target.value)}
                              placeholder="Buscar lead por nome ou tel..."
                              style={{ width: '100%', padding: '7px 9px', fontSize: 12, background: '#f0fdfb', border: '1px solid #d1fae5', borderRadius: 8, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }} />
                            {leadResults.map(l => (
                              <button key={l.id} onClick={() => handleLinkLead(l.id)}
                                style={{ width: '100%', textAlign: 'left', padding: '7px 9px', fontSize: 12, background: '#f0fdfb', border: '1px solid #d1fae5', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#e6f7f5')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#f0fdfb')}>
                                <p style={{ fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{l.responsible_name}</p>
                                <p style={{ color: '#64748B', margin: 0 }}>{l.student_name} · {l.grade_interest}</p>
                              </button>
                            ))}
                            <button onClick={() => { setLinkingLead(false); setLeadSearch(''); setLeadResults([]) }}
                              style={{ fontSize: 12, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0' }}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button onClick={() => setLinkingLead(true)}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: '#f0fdfb', border: '1px solid #d1fae5', borderRadius: 9, cursor: 'pointer', fontSize: 12, color: '#1A2B4A', fontWeight: 500, transition: 'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#e6f7f5'; e.currentTarget.style.borderColor = '#0d9488' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#f0fdfb'; e.currentTarget.style.borderColor = '#d1fae5' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <User style={{ width: 13, height: 13, color: '#0d9488' }} />
                                <span>Vincular a um Lead</span>
                              </div>
                              <ChevronRight style={{ width: 13, height: 13, color: '#94A3B8' }} />
                            </button>
                            {(!activeConv.contact_type || activeConv.contact_type === 'unknown') && (
                              <button onClick={() => { setLeadForm(prev => ({ ...prev, responsible_name: activeConv.name !== formatPhone(activeConv.id) ? activeConv.name : '', phone: activeConv.phone })); setShowLeadModal(true) }}
                                style={{ width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#0d9488', background: 'transparent', border: '1px dashed #d1fae5', borderRadius: 9, cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#e6f7f5'; e.currentTarget.style.borderColor = '#0d9488' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#d1fae5' }}>
                                + Criar Lead
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── SEÇÃO: AVALIAÇÃO ────────────────────────────────────────── */}
                <div style={{ borderBottom: '1px solid #e2f5f3' }}>
                  <button onClick={() => setCollapseAvaliacao(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fefd', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#edfaf8')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f8fefd')}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avaliação</span>
                    {collapseAvaliacao
                      ? <ChevronRight style={{ width: 14, height: 14, color: '#0d9488' }} />
                      : <ChevronDown style={{ width: 14, height: 14, color: '#0d9488' }} />}
                  </button>
                  {!collapseAvaliacao && (
                    <div style={{ padding: '0 12px 12px' }}>
                      {activeConv.satisfaction_score ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                          <span style={{ fontSize: 16 }}>{'⭐'.repeat(activeConv.satisfaction_score)}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>{activeConv.satisfaction_score}/5</span>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Sem avaliação registrada</p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ── Histórico tab ── */}
            {rightPanelTab === 'history' && (
              <div className="wa-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', background: '#FFFFFF' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Histórico de eventos</p>
                {historyLoading || leadCrmLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#00A896] border-t-transparent" />
                  </div>
                ) : convHistory.length === 0 && leadCrmEvents.length === 0 ? (
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
                    {leadCrmEvents.length > 0 && (
                      <>
                        {convHistory.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
                            <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>CRM</span>
                            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
                          </div>
                        )}
                        {leadCrmEvents.map((ev, i) => (
                          <div key={`crm-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 8, transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F0FDFB')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, marginTop: 4, flexShrink: 0 }} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontSize: 12, fontWeight: 500, color: '#1A2B4A', margin: 0, lineHeight: 1.4 }}>{ev.label}</p>
                              <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{ev.time}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
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

        {/* Hub success toast */}
        {hubToast && (
          <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'none' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #6EE7B7', color: '#059669', fontSize: 12, fontWeight: 600, padding: '10px 16px', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', whiteSpace: 'nowrap' }}>
              {hubToast}
            </div>
          </div>
        )}
        </div>{/* end flex 3-column row */}
      </div>{/* end main outer container */}


      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl border border-[#E2E8F0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1A2B4A]">Enviar Template WhatsApp</h3>
              <button onClick={() => { setShowTemplateModal(false); setSelectedTemplate(''); setTemplateVars({}) }}
                className="p-1 text-[#64748B] hover:text-[#1A2B4A]"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Template</label>
                <select value={selectedTemplate} onChange={e => {
                  const id = e.target.value
                  setSelectedTemplate(id)
                  const tmpl = templates.find(t => t.id === id)
                  const bodyComp = tmpl?.components?.find((c: any) => c.type === 'BODY')
                  const matches = bodyComp?.text ? [...bodyComp.text.matchAll(/\{\{(\d+)\}\}/g)] : []
                  const autoVars: Record<string, string> = {}
                  matches.forEach(([, n]) => { autoVars[n] = getDefaultVarValue(parseInt(n)) })
                  setTemplateVars(autoVars)
                }}
                  className="w-full px-3 py-2 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-1 focus:ring-[#00A896] outline-none">
                  <option value="">Selecionar template...</option>
                  {templates.length === 0 && (
                    <option value="hello_world">hello_world (padrão Meta)</option>
                  )}
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {selectedTemplate && (() => {
                const tmpl = templates.find(t => t.id === selectedTemplate)
                if (!tmpl) return null
                const bodyComp = tmpl.components?.find((c: any) => c.type === 'BODY')
                if (!bodyComp?.text) return null
                const matches = [...bodyComp.text.matchAll(/\{\{(\d+)\}\}/g)]
                if (matches.length === 0) return null
                return (
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] mb-2">Variáveis</label>
                    <div className="space-y-2">
                      {matches.map(([, n]) => (
                        <div key={n}>
                          <label className="block text-xs text-[#94A3B8] mb-0.5">{`{{${n}}}`}</label>
                          <input
                            value={templateVars[n] || ''}
                            onChange={e => setTemplateVars(v => ({ ...v, [n]: e.target.value }))}
                            placeholder={`Variável ${n}`}
                            className="w-full px-3 py-2 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-1 focus:ring-[#00A896] outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
              {templates.length === 0 && (
                <p className="text-xs text-[#64748B] bg-[#FEF3C7] p-3 rounded-lg">
                  Nenhum template aprovado cadastrado. Será enviado o template "hello_world" padrão da Meta.
                </p>
              )}
            </div>
            {templateError && (
              <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {templateError}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowTemplateModal(false); setSelectedTemplate(''); setTemplateVars({}); setTemplateError(null) }}
                className="flex-1 py-2.5 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFB]">
                Cancelar
              </button>
              <button onClick={handleSendTemplate} disabled={sendingTemplate || (!selectedTemplate && templates.length > 0)}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#00A896] rounded-lg hover:bg-[#008f81] disabled:opacity-40">
                {sendingTemplate ? 'Enviando...' : 'Enviar Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {effectiveInstitutionId && user?.id && (
        <QuickReplyManagerModal
          isOpen={showQRManager}
          onClose={() => setShowQRManager(false)}
          institutionId={effectiveInstitutionId}
          userId={user.id}
          onSaved={() => {
            supabase.from('whatsapp_quick_replies')
              .select('id, title, message, order_index, user_id, shortcut')
              .eq('institution_id', effectiveInstitutionId)
              .order('order_index', { ascending: true })
              .then(({ data }) => {
                if (!data) return
                const mapped = data.map((r: any) => ({ id: r.id, label: r.title, text: r.message, shortcut: r.shortcut ?? null, user_id: r.user_id ?? null }))
                mapped.sort((a, b) => (a.user_id ? 0 : 1) - (b.user_id ? 0 : 1))
                setQuickReplies(mapped)
              })
          }}
        />
      )}
    </>
  )
}
