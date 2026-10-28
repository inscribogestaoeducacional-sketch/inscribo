// Peças que o WhatsApp das escolas e o Inbox da Áion usam IGUAIS: tipos, formatação,
// bolha de mensagem, player de áudio e respostas rápidas pessoais.
// Qualquer ajuste visual nessas peças vale para as duas telas.
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  MessageCircle, Search, Plus, Info, Paperclip, Mic, Smile, Send,
  Play, Pause, FileText, Image, Video, ChevronDown, ChevronRight, ChevronLeft,
  CheckCheck, Check, Zap, Settings, User, Users, Download, Calendar,
  X, MoreVertical, CornerUpLeft, SmilePlus, Edit, Trash2, Megaphone, Bot
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, WhatsappMessage, WhatsappConversation, supabase } from '../../lib/supabase'
import { getInitials, cleanName } from '../../lib/initials'
import { resolveSlotTemplate } from '../../lib/templateSlots'

export type MsgType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'deleted'
export type ConvStatus = 'waiting' | 'open' | 'closed'
export type RightPanelTab = 'details' | 'family' | 'history'
export interface Message {
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
  // Motivo da falha (status 'failed' vindo do webhook da Meta), já traduzido.
  error_reason?: string | null
}

// Motivo legível pra uma falha de envio da Meta (whatsapp_messages.error_details,
// gravado pelo webhook de status).
export function metaFailureReason(details: any): string | null {
  const e = Array.isArray(details) ? details[0] : details
  if (!e) return null
  switch (Number(e.code)) {
    case 131053: return 'Formato de mídia não aceito pelo WhatsApp.'
    case 131047: return 'Janela de 24h fechada — envie um template para retomar a conversa.'
    case 131042: return 'Problema de pagamento na conta do WhatsApp Business.'
    case 131026: return 'O número não pôde receber a mensagem (sem WhatsApp ou bloqueado).'
    case 131049: return 'A Meta limitou mensagens para este contato. Tente mais tarde.'
  }
  return e.error_data?.details || e.message || e.title || null
}

export interface Label { text: string; color: string }

export interface Conversation {
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
  last_customer_message_at?: string
  notes?: string | null
  // Captação Inteligente (preenchidos pelo webhook, ver applyCaptureTrigger)
  capture_trigger_id?: string | null
  capture_bot_skipped?: boolean
  capture_referral?: Record<string, any> | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const STATUS_CFG: Record<ConvStatus, { label: string; badge: string; dot: string }> = {
  waiting: { label: 'Aguardando',     badge: 'bg-[#FEF3C7] text-[#D97706]',   dot: 'bg-[#D97706]' },
  open:    { label: 'Em Atendimento', badge: 'bg-[#D1FAE5] text-[#059669]',   dot: 'bg-[#059669]' },
  closed:  { label: 'Concluído',      badge: 'bg-[#E2E8F0] text-[#64748B]',   dot: 'bg-[#94A3B8]' },
}


// ─── Helpers ──────────────────────────────────────────────────────────────────
export function safeStatusCfg(status: string) {
  return STATUS_CFG[status as ConvStatus] ?? STATUS_CFG['waiting']
}

export const AVATAR_COLORS = ['bg-violet-500','bg-blue-500','bg-rose-500','bg-amber-500','bg-emerald-500','bg-teal-500','bg-pink-500','bg-indigo-500']

export function jidToColor(jid: string): string {
  let hash = 0
  for (let i = 0; i < jid.length; i++) hash = jid.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function formatPhone(jid: string): string {
  const num = jid.replace(/@.*/, '')
  if (num.startsWith('55') && num.length >= 12) {
    const local = num.slice(2)
    if (local.length === 11) return `${local.slice(0,2)} ${local.slice(2,7)}-${local.slice(7)}`
    if (local.length === 10) return `${local.slice(0,2)} ${local.slice(2,6)}-${local.slice(6)}`
  }
  return num
}

export function mapMsgType(messageType: string): MsgType {
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

export const AVATAR_BG_COLORS = [
  'var(--aion-grad)',
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #fd7b42, #fd5c63)',
  'linear-gradient(135deg, #1A2B4A, #2D4A7A)',
]
export function getAvatarBgColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length]
}

export function normalizeJid(jid: string): string {
  return jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
}

export function rawJid(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
}


export function fmtTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function fmtConvTime(d: Date) {
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return fmtTime(d)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function fmtDateSep(d: Date) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (msgDay === today) return 'Hoje'
  if (msgDay === today - 86400000) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

// Mensagens + linhas de sistema (eventos de dono) na mesma linha do tempo,
// agrupadas por dia como as mensagens.

export function buildTemplatePreview(tmpl: any, vars: Record<string, string>): string {
  if (!tmpl) return '[Template]'
  const bodyComp = tmpl.components?.find((c: any) => c.type === 'BODY')
  if (!bodyComp?.text) return `[Template: ${tmpl.name}]`
  let text: string = bodyComp.text
  Object.entries(vars).forEach(([n, val]) => {
    text = text.replace(new RegExp(`\\{\\{${n}\\}\\}`, 'g'), val)
  })
  return text
}


// Reconhece tanto o rótulo em português capitalizado (formato legado, usado
// em api/whatsapp/send.ts) quanto o `[${msgType}]` em inglês minúsculo
// gravado por processAionMessage (api/whatsapp/webhook.ts) — generalizar
// aqui é mais seguro que forçar todo write-path a usar o mesmo formato de
// string, e cobre qualquer outro lugar que já dependa do formato atual.
export const MSG_TYPE_PREVIEW: Record<string, { icon: string; text: string }> = {
  image:       { icon: '🖼️', text: 'Imagem' },
  imagem:      { icon: '🖼️', text: 'Imagem' },
  audio:       { icon: '🎵', text: 'Áudio' },
  'áudio':     { icon: '🎵', text: 'Áudio' },
  ptt:         { icon: '🎵', text: 'Áudio' },
  video:       { icon: '🎬', text: 'Vídeo' },
  'vídeo':     { icon: '🎬', text: 'Vídeo' },
  document:    { icon: '📄', text: 'Documento' },
  documento:   { icon: '📄', text: 'Documento' },
  sticker:     { icon: '🎭', text: 'Figurinha' },
  figurinha:   { icon: '🎭', text: 'Figurinha' },
  interactive: { icon: '🔘', text: 'Menu interativo' },
}

export function getLastMsgPreview(lastMessage: string): { icon?: string; text: string } {
  const match = /^\[(.+)\]$/.exec((lastMessage || '').trim())
  if (match) {
    const mapped = MSG_TYPE_PREVIEW[match[1].toLowerCase()]
    if (mapped) return mapped
  }
  return { text: lastMessage }
}

export function AudioPlayer({ duration = 15, mediaUrl, isDark = true }: { duration?: number; from?: 'me' | 'them'; mediaUrl?: string; isDark?: boolean }) {
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
    isDark ? 'bg-white/20 hover:bg-white/30' : 'bg-[#05907B] hover:bg-[#008f81]'
  }`
  const trackCls = `h-[3px] rounded-full overflow-hidden ${isDark ? 'bg-white/30' : 'bg-[#E2E8F0]'}`
  const fillCls  = `h-full rounded-full transition-all duration-100 ${isDark ? 'bg-white' : 'bg-[#05907B]'}`
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
// Só mídia hospedada no Supabase Storage (o webhook Meta baixa e reidrata pra
// lá) ou já como data: URL. Mensagens antigas sem isso simplesmente não carregam.
export function getMediaUrl(message: any): string | null {
  const raw = message.media_url || message.mediaUrl || message.url || null
  if (!raw) return null
  if (raw.startsWith('data:') || raw.startsWith('/api/')) return raw
  if (raw.includes('.supabase.co/storage/')) return raw
  return null
}

export function DownloadIcon() {
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

export async function handleDownload(url: string, filename: string) {
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
export const CAN_HIGHLIGHT = typeof CSS !== 'undefined' && 'highlights' in (CSS as any) && typeof (window as any).Highlight !== 'undefined'

export function RenderMessageContent({ message, fromMe, onImageClick }: { message: any; fromMe: boolean; onImageClick?: (url: string) => void }) {
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

  const mediaUrl = getMediaUrl(message)
  const caption  = message.caption || message.message?.imageMessage?.caption || ''
  const body     = message.body || message.content || message.conversation ||
                   message.message?.conversation || ''

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
          <span style={{ fontSize: 18, color: '#05907B' }}>↓</span>
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
export const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

// ─── MessageBubble ────────────────────────────────────────────────────────────
export function MessageBubble({
  msg, onImageClick, contactName, onReply, onReact, onRetry, gutter = 16,
}: {
  msg: Message
  gutter?: number
  onImageClick?: (url: string) => void
  contactName?: string
  onReply?: (m: Message) => void
  onReact?: (m: Message, emoji: string) => void
  onRetry?: (m: Message) => void
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
          // 28px de botão: sobram (gutter - 2)px pra fora da linha, dentro do
          // padding lateral da lista (com -10px passava 2px e ligava a barra
          // horizontal a cada hover — a "tela tremendo").
          [isMe ? 'left' : 'right']: `calc(100% - ${30 - gutter}px)`,
          display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
        }}>
          <button
            onClick={() => onReply?.(msg)}
            title="Responder"
            style={{ width: 28, height: 28, borderRadius: '50%', background: '#F0FDFB', border: '1px solid #B2E8E2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#05907B' }}
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
          ? 'var(--aion-grad)'
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
            borderColor: isMe ? 'rgba(255,255,255,0.6)' : '#05907B',
            background: isMe ? 'rgba(0,0,0,0.15)' : 'rgba(0,168,150,0.08)',
            borderRadius: '4px',
            padding: '6px 10px',
            marginBottom: 6,
            cursor: 'default',
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: isMe ? 'rgba(255,255,255,0.9)' : '#05907B',
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
        <RenderMessageContent message={msg} fromMe={isMe} onImageClick={onImageClick} />
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
              return <span style={{ fontSize: 12, color: '#FECACA', fontWeight: 700 }} title={msg.error_reason || 'Falha ao enviar'}>⚠ Não enviada</span>
            }
            const color = msg.status === 'read' ? '#2DCBA4' : 'rgba(255,255,255,0.45)'
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
        {/* Falha de envio: motivo + reenvio — antes parecia enviada */}
        {isMe && msg.status === 'failed' && (
          <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#B91C1C', flex: 1, lineHeight: 1.35 }}>
              Não enviada{msg.error_reason ? ` — ${msg.error_reason}` : ''}
            </span>
            {onRetry && (
              <button onClick={() => onRetry(msg)} style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#DC2626', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>
                Reenviar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Event type icon colors ───────────────────────────────────────────────────

// ─── Gerenciador de respostas rápidas pessoais do atendente ────────────────────
export interface PersonalQuickReply {
  id: string
  title: string
  message: string
  shortcut: string | null
  order_index: number
}

export function QuickReplyManagerModal({ isOpen, onClose, institutionId, userId, onSaved }: {
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
              <button type="submit" style={{ padding: '8px 16px', borderRadius: 9, background: '#05907B', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
            </div>
          </form>
        ) : (
          <>
            <button onClick={startNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: '#05907B', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>
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


