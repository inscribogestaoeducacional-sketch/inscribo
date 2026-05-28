import React, { useState, useEffect, useRef, useCallback } from 'react'
import EmojiPicker from '@emoji-mart/react'
import emojiData from '@emoji-mart/data'
import {
  MessageCircle, Bot, User, Phone, Building2, MapPin,
  ExternalLink, UserPlus, Send, Check,
  Loader2, Image, FileText, Mic, Video,
  Tag, Clock, Calendar, Play, Pause,
  X, Paperclip, Smile, CornerUpLeft, SmilePlus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AionConversation {
  id: string
  remote_jid: string
  contact_name?: string
  last_message?: string
  last_message_at?: string
  unread_count: number
  status: string
  assigned_user_id?: string
  assigned_user_name?: string
  bot_active?: boolean
  queue?: string
  tags?: string[]
  created_at: string
  is_aion_inbox?: boolean
}

interface AionMessage {
  id: string
  remote_jid: string
  from_me: boolean
  message_type: string
  content: string
  media_url?: string
  timestamp: string
  created_at: string
  status?: string
  is_aion_inbox?: boolean
  message_id?: string
  quoted_message_id?: string
  quoted_content?: string
  quoted_from_me?: boolean
  reaction?: string | null
  reaction_attendant?: string | null
  duration?: number
}

interface AionLead {
  id: string
  name?: string
  contact_name?: string
  phone?: string
  school?: string
  city?: string
  state?: string
  stage?: string
  next_followup?: string
  notes?: string
  created_at?: string
}

interface ConsultantUser {
  id: string
  full_name: string
  email: string
  user_type?: string
  role?: string
}

type ConvFilter = 'all' | 'leads' | 'schools' | 'general' | 'unread'
type RecorderState = 'idle' | 'recording' | 'preview'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(jid: string): string {
  const raw = jid.replace('@s.whatsapp.net', '').replace('@c.us', '')
  if (raw.length === 13 && raw.startsWith('55')) {
    return `+55 (${raw.slice(2, 4)}) ${raw.slice(4, 9)}-${raw.slice(9)}`
  }
  if (raw.length === 12 && raw.startsWith('55')) {
    return `+55 (${raw.slice(2, 4)}) ${raw.slice(4, 8)}-${raw.slice(8)}`
  }
  return raw
}

function rawPhone(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/^55/, '')
}

function initials(name?: string, jid?: string): string {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  const phone = (jid || '').replace(/\D/g, '').slice(-4)
  return phone || '?'
}

function formatTime(ts?: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604_800_000) return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function queueLabel(queue?: string): string {
  if (queue === 'leads') return 'Vendas'
  if (queue === 'schools') return 'Suporte'
  return 'Geral'
}

function queueColor(queue?: string): { bg: string; text: string } {
  if (queue === 'leads') return { bg: '#DCFCE7', text: '#16A34A' }
  if (queue === 'schools') return { bg: '#DBEAFE', text: '#2563EB' }
  return { bg: '#F1F5F9', text: '#64748B' }
}

function stageColor(stage?: string): { bg: string; text: string } {
  switch (stage) {
    case 'interesse':    return { bg: '#DBEAFE', text: '#2563EB' }
    case 'qualificacao': return { bg: '#EDE9FE', text: '#7C3AED' }
    case 'proposta':     return { bg: '#FEF9C3', text: '#CA8A04' }
    case 'negociacao':   return { bg: '#FFEDD5', text: '#EA580C' }
    case 'fechado':      return { bg: '#DCFCE7', text: '#16A34A' }
    case 'cliente':      return { bg: '#CCFBF1', text: '#0F766E' }
    default:             return { bg: '#F1F5F9', text: '#64748B' }
  }
}

function stageLabel(stage?: string): string {
  switch (stage) {
    case 'interesse':    return 'Interesse'
    case 'qualificacao': return 'Qualificação'
    case 'proposta':     return 'Proposta'
    case 'negociacao':   return 'Negociação'
    case 'fechado':      return 'Fechado'
    case 'cliente':      return 'Cliente'
    default:             return stage || '—'
  }
}

function statusLabel(status: string): string {
  if (status === 'waiting') return 'Aguardando'
  if (status === 'open') return 'Aberta'
  if (status === 'closed') return 'Fechada'
  return status
}

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

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

async function downloadFile(url: string, filename: string) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl; a.download = filename
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────

function AudioPlayer({ duration = 15, mediaUrl, isDark = true }: { duration?: number; mediaUrl?: string; isDark?: boolean }) {
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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 210 }}>
      {mediaUrl && (
        <audio ref={audioRef} src={mediaUrl} style={{ display: 'none' }}
          onEnded={() => { setPlaying(false); setProgress(0) }}
          onTimeUpdate={() => {
            if (audioRef.current) setProgress((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100)
          }}
        />
      )}
      <button onClick={handleToggle} style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: isDark ? 'rgba(255,255,255,0.2)' : '#00A896', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {playing
          ? <Pause style={{ width: 14, height: 14, color: '#fff' }} />
          : <Play  style={{ width: 14, height: 14, color: '#fff' }} />}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 3, borderRadius: 999, overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.3)' : '#E2E8F0' }}>
          <div style={{ height: '100%', borderRadius: 999, transition: 'width 0.1s', width: `${progress}%`, background: isDark ? '#fff' : '#00A896' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }}>{playing ? fmt(elapsed) : fmt(duration)}</span>
          <button onClick={cycleSpeed} style={{ fontSize: 10, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' }}>
            {speed}x
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── RenderAionContent ────────────────────────────────────────────────────────

function RenderAionContent({ msg, fromMe, onImageClick }: { msg: AionMessage; fromMe: boolean; onImageClick?: (url: string) => void }) {
  const type = (msg.message_type || 'text').toLowerCase().replace('message', '')
  const url = msg.media_url || null
  const body = msg.content || ''

  if (type === 'deleted') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11 }}>🚫</span>
        <span style={{ fontSize: 11, color: fromMe ? 'rgba(255,255,255,0.5)' : '#94A3B8', fontStyle: 'italic' }}>Mensagem apagada</span>
      </div>
    )
  }

  if (type === 'image' && url) {
    return (
      <div>
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          <img
            src={url} alt="imagem"
            style={{ maxWidth: 260, maxHeight: 320, width: '100%', borderRadius: 10, display: 'block', cursor: 'pointer', objectFit: 'cover' }}
            onClick={() => onImageClick ? onImageClick(url) : window.open(url, '_blank')}
            onError={e => {
              const t = e.currentTarget; t.style.display = 'none'
              const fb = document.createElement('div')
              fb.style.cssText = 'padding:10px 14px;background:#F1F5F9;border-radius:10px;cursor:pointer;color:#64748B;font-size:13px;display:flex;gap:8px;align-items:center'
              fb.innerHTML = '🖼️ Imagem (clique para abrir)'; fb.onclick = () => window.open(url, '_blank')
              t.parentElement?.appendChild(fb)
            }}
          />
          <button onClick={() => downloadFile(url, `imagem_${Date.now()}.jpg`)}
            style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <DownloadIcon />
          </button>
        </div>
        {body && <p style={{ fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.85)' : '#64748B', marginTop: 6 }}>{body}</p>}
      </div>
    )
  }

  if (type === 'image') return <span style={{ fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.7)' : '#64748B' }}>📷 Imagem</span>

  if (type === 'video' && url) {
    return (
      <div style={{ maxWidth: 260, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
        <video controls preload="metadata" style={{ width: '100%', maxHeight: 200, display: 'block', background: '#000', borderRadius: 10 }}
          onError={e => {
            const t = e.currentTarget; t.style.display = 'none'
            const fb = document.createElement('div')
            fb.style.cssText = 'padding:10px 14px;background:#F1F5F9;border-radius:10px;cursor:pointer;color:#64748B;font-size:13px;display:flex;gap:8px;align-items:center'
            fb.innerHTML = '🎬 Vídeo (clique para abrir)'; fb.onclick = () => window.open(url, '_blank')
            t.parentElement?.appendChild(fb)
          }}
        >
          <source src={url} type="video/mp4" /><source src={url} type="video/webm" />
        </video>
        <button onClick={() => downloadFile(url, `video_${Date.now()}.mp4`)}
          style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DownloadIcon />
        </button>
      </div>
    )
  }

  if (type === 'video') return <span style={{ fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.7)' : '#64748B' }}>🎬 Vídeo</span>

  if ((type === 'audio' || type === 'ptt') && url) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <AudioPlayer duration={msg.duration} mediaUrl={url} isDark={fromMe} />
        <button onClick={() => downloadFile(url, `audio_${Date.now()}.mp3`)}
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <DownloadIcon />
        </button>
      </div>
    )
  }

  if (type === 'audio' || type === 'ptt') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.9)' : '#1A2B4A' }}>
        <Mic style={{ width: 14, height: 14 }} /> Áudio
      </span>
    )
  }

  if (type === 'document') {
    const docUrl = url || (body?.startsWith('http') ? body : null)
    if (docUrl) {
      return (
        <div onClick={() => window.open(docUrl, '_blank')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', background: fromMe ? 'rgba(255,255,255,0.1)' : '#F8FAFB', border: `1px solid ${fromMe ? 'rgba(255,255,255,0.15)' : '#E2E8F0'}` }}>
          <span style={{ fontSize: 22 }}>📄</span>
          <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: fromMe ? '#fff' : '#1A2B4A' }}>{body || 'Documento'}</span>
          <span style={{ fontSize: 18, color: '#00A896' }}>↓</span>
        </div>
      )
    }
    return <span style={{ fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.7)' : '#64748B' }}>📄 {body || 'Documento'}</span>
  }

  if (type === 'sticker' && url) return <img src={url} alt="sticker" style={{ width: 100, height: 100, objectFit: 'contain' }} />

  if (!body) return <span style={{ color: fromMe ? 'rgba(255,255,255,0.5)' : '#94A3B8', fontStyle: 'italic', fontSize: 13 }}>...</span>
  return <span style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</span>
}

// ─── Quick emoji set ──────────────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg, contactName, onReply, onReact, onImageClick,
}: {
  msg: AionMessage
  contactName?: string
  onReply?: (m: AionMessage) => void
  onReact?: (m: AionMessage, emoji: string) => void
  onImageClick?: (url: string) => void
}) {
  const isMe = msg.from_me
  const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const [hovered, setHovered]             = useState(false)
  const [showReactPicker, setShowReactPicker] = useState(false)
  const [pickerBelow, setPickerBelow]     = useState(false)
  const pickRef  = useRef<HTMLDivElement>(null)
  const smileRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!showReactPicker) return
    const handler = (e: MouseEvent) => {
      if (pickRef.current && !pickRef.current.contains(e.target as Node)) setShowReactPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showReactPicker])

  const handleTogglePicker = (ev: React.MouseEvent) => {
    ev.stopPropagation()
    if (!showReactPicker) {
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
        display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start',
        marginBottom: hasAnyReaction ? 18 : 3,
        paddingLeft: isMe ? '15%' : 0, paddingRight: isMe ? 0 : '15%',
        position: 'relative',
      }}
    >
      {(hovered || showReactPicker) && msg.message_type !== 'deleted' && (
        <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', ...(isMe ? { left: 'calc(100% - 10px)' } : { right: 'calc(100% - 10px)' }), display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
          <button onClick={() => onReply?.(msg)} title="Responder"
            style={{ width: 28, height: 28, borderRadius: '50%', background: '#F0FDFB', border: '1px solid #B2E8E2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00A896' }}>
            <CornerUpLeft size={13} />
          </button>
          {msg.message_id && (
            <button ref={smileRef} onClick={handleTogglePicker} title="Reagir"
              style={{ width: 28, height: 28, borderRadius: '50%', background: '#FFFBF0', border: '1px solid #FDE68A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
              <SmilePlus size={13} />
            </button>
          )}
        </div>
      )}
      <div style={{
        maxWidth: '100%', padding: '9px 13px',
        background: isMe ? 'linear-gradient(135deg, #0d9488 0%, #0ea5a0 100%)' : '#FFFFFF',
        color: isMe ? '#fff' : '#1A2B4A',
        borderRadius: isMe ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
        border: isMe ? 'none' : '1px solid #e2f5f3',
        boxShadow: isMe ? '0 2px 10px rgba(13,148,136,0.30)' : '0 1px 4px rgba(0,0,0,0.06)',
        position: 'relative', overflow: 'visible',
      }}>
        {showReactPicker && (
          <div ref={pickRef} style={{
            position: 'absolute',
            ...(pickerBelow ? { top: '100%', marginTop: 4 } : { bottom: '100%', marginBottom: 4 }),
            ...(isMe ? { right: 0 } : { left: 0 }),
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
            display: 'flex', alignItems: 'center', padding: '4px 6px', gap: 2, zIndex: 9999, whiteSpace: 'nowrap',
          }}>
            {QUICK_EMOJIS.map(e => (
              <button key={e} onClick={ev => { ev.stopPropagation(); onReact?.(msg, e); setShowReactPicker(false) }} title={e}
                style={{ background: msg.reaction_attendant === e ? '#E6F7F4' : 'transparent', border: 'none', borderRadius: 8, fontSize: 20, cursor: 'pointer', padding: '2px 4px', lineHeight: 1, transform: msg.reaction_attendant === e ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.1s' }}>
                {e}
              </button>
            ))}
          </div>
        )}
        {msg.quoted_content && (
          <div style={{ borderLeft: '3px solid', borderColor: isMe ? 'rgba(255,255,255,0.6)' : '#00A896', background: isMe ? 'rgba(0,0,0,0.15)' : 'rgba(0,168,150,0.08)', borderRadius: 4, padding: '6px 10px', marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isMe ? 'rgba(255,255,255,0.9)' : '#00A896', marginBottom: 2 }}>
              {msg.quoted_from_me ? 'Você' : (contactName || 'Contato')}
            </div>
            <div style={{ fontSize: 12, color: isMe ? 'rgba(255,255,255,0.75)' : '#64748B', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'] }}>
              {msg.quoted_content}
            </div>
          </div>
        )}
        <RenderAionContent msg={msg} fromMe={isMe} onImageClick={onImageClick} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>{time}</span>
          {isMe && <MsgStatusSvg status={msg.status} />}
        </div>
        {hasAnyReaction && (
          <div style={{ position: 'absolute', bottom: -12, ...(isMe ? { right: 4 } : { left: 4 }), background: '#fff', border: '1px solid #E2E8F0', borderRadius: 999, padding: '1px 5px', fontSize: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.12)', zIndex: 2, lineHeight: 1.5, whiteSpace: 'nowrap' }}>
            {reactionBadge}
          </div>
        )}
      </div>
    </div>
  )
}

function MsgStatusSvg({ status }: { status?: string }) {
  if (status === 'failed') return <span style={{ fontSize: 12, color: '#EF4444' }} title="Falha">⚠</span>
  const color = status === 'read' ? '#0DD3BF' : 'rgba(255,255,255,0.45)'
  const showDouble = status === 'delivered' || status === 'read'
  return (
    <svg width={showDouble ? 18 : 12} height="11" viewBox={showDouble ? '0 0 18 11' : '0 0 12 11'} fill="none">
      <path d={showDouble ? 'M1 5.5L5 9.5L15 1.5' : 'M1 5.5L5 9.5L11 1.5'}
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      {showDouble && (
        <path d="M6 5.5L10 9.5L18 1.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </svg>
  )
}

// ─── PanelSection ─────────────────────────────────────────────────────────────

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

const panelLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
}

const panelSelectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1.5px solid #E2E8F0',
  borderRadius: 8, fontSize: 13, color: '#1A2B4A', background: '#fff',
  outline: 'none', cursor: 'pointer',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AionInboxHub() {
  // ── state ──
  const [conversations, setConversations]           = useState<AionConversation[]>([])
  const [activeConv, setActiveConv]                 = useState<AionConversation | null>(null)
  const [messages, setMessages]                     = useState<AionMessage[]>([])
  const [lead, setLead]                             = useState<AionLead | null>(null)
  const [consultants, setConsultants]               = useState<ConsultantUser[]>([])
  const [filter, setFilter]                         = useState<ConvFilter>('all')
  const [inputText, setInputText]                   = useState('')
  const [sending, setSending]                       = useState(false)
  const [loadingMsgs, setLoadingMsgs]               = useState(false)
  const [loadingLead, setLoadingLead]               = useState(false)
  const [creatingLead, setCreatingLead]             = useState(false)
  const [loadingConvs, setLoadingConvs]             = useState(true)
  // media state
  const [replyTo, setReplyTo]                       = useState<AionMessage | null>(null)
  const [pendingFile, setPendingFile]               = useState<File | null>(null)
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress]         = useState(0)
  const [showAttach, setShowAttach]                 = useState(false)
  const [showEmojiPicker, setShowEmojiPicker]       = useState(false)
  const [recorderState, setRecorderState]           = useState<RecorderState>('idle')
  const [audioBlob, setAudioBlob]                   = useState<Blob | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl]       = useState<string | null>(null)
  const [waveformBars, setWaveformBars]             = useState<number[]>(Array(20).fill(0.2))
  const [recordingSeconds, setRecordingSeconds]     = useState(0)
  const [sendError, setSendError]                   = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl]               = useState<string | null>(null)

  // ── refs ──
  const messagesEndRef        = useRef<HTMLDivElement>(null)
  const activeJidRef          = useRef<string | null>(null)
  const fileInputRef          = useRef<HTMLInputElement>(null)
  const emojiPickerRef        = useRef<HTMLDivElement>(null)
  const mediaRecorderRef      = useRef<MediaRecorder | null>(null)
  const audioChunksRef        = useRef<Blob[]>([])
  const audioStreamRef        = useRef<MediaStream | null>(null)
  const recordingTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveformAnimRef       = useRef<number | null>(null)
  const analyserRef           = useRef<AnalyserNode | null>(null)
  const recordingMimeTypeRef  = useRef<string>('')

  // ── load conversations ──
  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('is_aion_inbox', true)
      .order('last_message_at', { ascending: false })
    setConversations((data as AionConversation[]) ?? [])
    setLoadingConvs(false)
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── load consultants ──
  useEffect(() => {
    supabase
      .from('users')
      .select('id, full_name, email, user_type, role')
      .or('user_type.eq.consultant,role.eq.admin_geral')
      .then(({ data }) => setConsultants((data as ConsultantUser[]) ?? []))
  }, [])

  // ── stop mic on unmount ──
  useEffect(() => {
    return () => { audioStreamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  // ── emoji picker outside click ──
  useEffect(() => {
    if (!showEmojiPicker) return
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setShowEmojiPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmojiPicker])

  // ── realtime: conversations ──
  useEffect(() => {
    const channel = supabase
      .channel('aion-conversations-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: 'is_aion_inbox=eq.true' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setConversations(prev => [payload.new as AionConversation, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as AionConversation
          setConversations(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
          setActiveConv(prev => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
        } else if (payload.eventType === 'DELETE') {
          setConversations(prev => prev.filter(c => c.id !== (payload.old as AionConversation).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── realtime: messages (with deduplication) ──
  useEffect(() => {
    const channel = supabase
      .channel('aion-messages-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: 'is_aion_inbox=eq.true' }, (payload) => {
        const msg = payload.new as AionMessage
        if (activeJidRef.current && msg.remote_jid === activeJidRef.current) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id || (msg.message_id && m.id === msg.message_id))) return prev
            // Replace temp outbound message if applicable
            if (msg.from_me && msg.message_id) {
              const hasTmp = prev.some(m => m.id.startsWith('temp-') && m.from_me)
              if (hasTmp) return prev.map(m => (m.id.startsWith('temp-') && m.from_me ? msg : m))
            }
            return [...prev, msg]
          })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages', filter: 'is_aion_inbox=eq.true' }, (payload) => {
        const updated = payload.new as AionMessage
        setMessages(prev => prev.map(m =>
          m.id === updated.id || (updated.message_id && m.id === updated.message_id)
            ? {
                ...m,
                status:             updated.status || m.status,
                reaction:           updated.reaction           !== undefined ? updated.reaction           : m.reaction,
                reaction_attendant: updated.reaction_attendant !== undefined ? updated.reaction_attendant : m.reaction_attendant,
              }
            : m
        ))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── select conversation ──
  const selectConv = async (conv: AionConversation) => {
    setActiveConv(conv)
    activeJidRef.current = conv.remote_jid
    setMessages([])
    setLead(null)
    setReplyTo(null)
    setPendingFile(null)
    setPendingFilePreview(null)
    setLoadingMsgs(true)

    const { data: msgs } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('is_aion_inbox', true)
      .eq('remote_jid', conv.remote_jid)
      .order('timestamp', { ascending: true })
      .limit(100)
    setMessages((msgs as AionMessage[]) ?? [])
    setLoadingMsgs(false)

    if ((conv.unread_count ?? 0) > 0) {
      await supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', conv.id)
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c))
    }

    const phone = rawPhone(conv.remote_jid)
    if (phone.length >= 8) {
      setLoadingLead(true)
      const { data: leadData } = await supabase.from('crm_leads').select('*').ilike('phone', `%${phone}%`).maybeSingle()
      setLead((leadData as AionLead) ?? null)
      setLoadingLead(false)
    }
  }

  // ── send text ──
  const handleSend = async () => {
    if (!activeConv || !inputText.trim() || sending) return
    const text = inputText.trim()
    const quotedMsg = replyTo
    const tempId = `temp-${Date.now()}`
    const tempMsg: AionMessage = {
      id: tempId,
      remote_jid: activeConv.remote_jid,
      from_me: true,
      message_type: 'text',
      content: text,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      status: 'sent',
      is_aion_inbox: true,
      ...(quotedMsg ? { quoted_message_id: quotedMsg.message_id, quoted_content: quotedMsg.content, quoted_from_me: quotedMsg.from_me } : {}),
    }
    setMessages(prev => [...prev, tempMsg])
    setInputText('')
    setReplyTo(null)
    setSending(true)
    try {
      const to = activeConv.remote_jid.replace(/@s\.whatsapp\.net$/, '').replace(/@.*/, '').replace(/\D/g, '')
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAionSend: true, to, type: 'text', message: text,
          ...(quotedMsg?.message_id ? { quoted_message_id: quotedMsg.message_id, quoted_content: quotedMsg.content, quoted_from_me: quotedMsg.from_me } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar')
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, id: data.wamid || tempId, message_id: data.wamid || undefined, status: 'sent' } : m
      ))
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setSendError(err.message || 'Erro ao enviar mensagem.')
    } finally {
      setSending(false)
    }
  }

  // ── emoji ──
  const handleEmojiSelect = (emoji: { native?: string; id?: string }) => {
    setInputText(prev => prev + (emoji.native || emoji.id || ''))
    setShowEmojiPicker(false)
  }

  // ── file select ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeConv) return
    setPendingFile(file)
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

  // ── send pending file ──
  const sendPendingFile = async () => {
    if (!pendingFile || !activeConv) return
    if (pendingFile.size > 15 * 1024 * 1024) {
      setSendError('Arquivo muito grande. Máximo 15MB.')
      setPendingFile(null); setPendingFilePreview(null); return
    }
    setUploadProgress(10)
    const mediatype = pendingFile.type.startsWith('image/') ? 'image'
      : pendingFile.type.startsWith('video/') ? 'video'
      : pendingFile.type.startsWith('audio/') ? 'audio'
      : 'document'

    const fileToSend = mediatype === 'image' ? await compressImage(pendingFile) : pendingFile
    const base64 = await toBase64(fileToSend)
    setUploadProgress(30)

    const tempId = `temp-file-${Date.now()}`
    const tempMsg: AionMessage = {
      id: tempId, remote_jid: activeConv.remote_jid, from_me: true, message_type: mediatype,
      content: pendingFile.name, media_url: `data:${fileToSend.type};base64,${base64}`,
      timestamp: new Date().toISOString(), created_at: new Date().toISOString(), status: 'sent', is_aion_inbox: true,
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const uploadRes = await fetch('/api/whatsapp/media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institution_id: 'aion', base64, mimetype: fileToSend.type, filename: pendingFile.name }),
      })
      setUploadProgress(65)
      if (!uploadRes.ok) throw new Error(`Upload HTTP ${uploadRes.status}`)
      const { url: mediaUrl } = await uploadRes.json()

      const to = activeConv.remote_jid.replace(/@s\.whatsapp\.net$/, '').replace(/@.*/, '').replace(/\D/g, '')
      const sendRes = await fetch('/api/whatsapp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAionSend: true, to, type: mediatype, mediaUrl, filename: pendingFile.name }),
      })
      setUploadProgress(100)
      if (!sendRes.ok) throw new Error(`Send HTTP ${sendRes.status}`)
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, media_url: mediaUrl, status: 'sent' } : m))
      setTimeout(() => { setPendingFile(null); setPendingFilePreview(null); setUploadProgress(0) }, 800)
    } catch (err: any) {
      setSendError('Erro ao enviar arquivo.')
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setPendingFile(null); setPendingFilePreview(null); setUploadProgress(0)
    }
  }

  // ── recording ──
  const startRecording = async () => {
    if (!activeConv) return
    if (!navigator.mediaDevices?.getUserMedia) { setSendError('Seu browser não suporta gravação de áudio.'); return }
    try {
      let stream = audioStreamRef.current
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        audioStreamRef.current = stream
      }
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      recordingMimeTypeRef.current = mimeType
      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setAudioPreviewUrl(URL.createObjectURL(blob))
        if (waveformAnimRef.current) { cancelAnimationFrame(waveformAnimRef.current); waveformAnimRef.current = null }
        analyserRef.current = null
        setWaveformBars(Array(20).fill(0.2))
        setRecorderState('preview')
      }
      recorder.start(100)
      mediaRecorderRef.current = recorder
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          const src = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser(); analyser.fftSize = 64
          src.connect(analyser); analyserRef.current = analyser
          const animate = () => {
            if (!analyserRef.current) return
            const data = new Uint8Array(analyserRef.current.frequencyBinCount)
            analyserRef.current.getByteFrequencyData(data)
            setWaveformBars(Array.from({ length: 20 }, (_, i) => Math.max(0.1, (data[Math.floor(i * data.length / 20)] ?? 0) / 255)))
            waveformAnimRef.current = requestAnimationFrame(animate)
          }
          waveformAnimRef.current = requestAnimationFrame(animate)
        }
      } catch {}
      setRecorderState('recording')
    } catch (err: any) {
      audioStreamRef.current?.getTracks().forEach(t => t.stop()); audioStreamRef.current = null
      const n = err?.name || ''
      setSendError(
        n === 'NotAllowedError' || n === 'PermissionDeniedError' ? 'Permissão de microfone negada.' :
        n === 'NotFoundError' ? 'Microfone não encontrado.' :
        'Erro ao acessar microfone: ' + (err?.message || 'desconhecido')
      )
    }
  }

  const stopRecordingForPreview = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
  }

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') { recorder.onstop = null; recorder.stop() }
    audioStreamRef.current?.getTracks().forEach(t => t.stop())
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    if (waveformAnimRef.current) { cancelAnimationFrame(waveformAnimRef.current); waveformAnimRef.current = null }
    analyserRef.current = null
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    setAudioBlob(null); setAudioPreviewUrl(null); setRecordingSeconds(0)
    setWaveformBars(Array(20).fill(0.2)); setRecorderState('idle')
  }

  const discardAudio = () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    setAudioBlob(null); setAudioPreviewUrl(null); setRecordingSeconds(0); setRecorderState('idle')
  }

  const sendAudio = async () => {
    if (!audioBlob || !activeConv) return
    const blob = audioBlob
    const mimeType = recordingMimeTypeRef.current || blob.type
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1]
      try {
        const uploadRes = await fetch('/api/whatsapp/media', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ institution_id: 'aion', base64, mimetype: mimeType, filename: `audio-${Date.now()}.${mimeType.includes('webm') ? 'webm' : 'mp4'}` }),
        })
        if (!uploadRes.ok) throw new Error(`Upload HTTP ${uploadRes.status}`)
        const { url: mediaUrl } = await uploadRes.json()
        discardAudio()
        const to = activeConv.remote_jid.replace(/@s\.whatsapp\.net$/, '').replace(/@.*/, '').replace(/\D/g, '')
        const sendRes = await fetch('/api/whatsapp/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isAionSend: true, to, type: 'audio', mediaUrl }),
        })
        if (!sendRes.ok) {
          const err = await sendRes.json().catch(() => ({}))
          setSendError(err.error || 'Erro ao enviar áudio.')
        }
      } catch {
        setSendError('Erro ao enviar áudio.'); discardAudio()
      }
    }
    reader.readAsDataURL(blob)
  }

  // ── react ──
  const handleReact = async (msg: AionMessage, emoji: string) => {
    if (!msg.message_id || !activeConv) return
    const emojiToSend = msg.reaction_attendant === emoji ? '' : emoji
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reaction_attendant: emojiToSend || null } : m))
    try {
      await fetch('/api/whatsapp/send-reaction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institution_id: null, message_id: msg.message_id, emoji: emojiToSend, remote_jid: activeConv.remote_jid }),
      })
    } catch {}
  }

  // ── existing actions ──
  const createLead = async () => {
    if (!activeConv) return
    setCreatingLead(true)
    const phone = rawPhone(activeConv.remote_jid)
    const { data } = await supabase.from('crm_leads').insert({ name: activeConv.contact_name || phone, phone, stage: 'interesse', origin: 'whatsapp' }).select().maybeSingle()
    setLead((data as AionLead) ?? null)
    setCreatingLead(false)
  }

  const updateStatus = async (status: string) => {
    if (!activeConv) return
    await supabase.from('whatsapp_conversations').update({ status }).eq('id', activeConv.id)
    setActiveConv(prev => (prev ? { ...prev, status } : prev))
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status } : c))
  }

  const assignConsultant = async (userId: string) => {
    if (!activeConv) return
    const user = consultants.find(c => c.id === userId)
    await supabase.from('whatsapp_conversations').update({ assigned_user_id: userId || null, assigned_user_name: user?.full_name || null }).eq('id', activeConv.id)
    setActiveConv(prev => prev ? { ...prev, assigned_user_id: userId || undefined, assigned_user_name: user?.full_name || undefined } : prev)
  }

  const toggleBot = async () => {
    if (!activeConv) return
    const newVal = !activeConv.bot_active
    await supabase.from('whatsapp_conversations').update({ bot_active: newVal }).eq('id', activeConv.id)
    setActiveConv(prev => (prev ? { ...prev, bot_active: newVal } : prev))
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, bot_active: newVal } : c))
  }

  const filteredConvs = conversations.filter(c => {
    if (filter === 'unread') return (c.unread_count ?? 0) > 0
    if (filter === 'leads') return c.queue === 'leads'
    if (filter === 'schools') return c.queue === 'schools'
    if (filter === 'general') return !c.queue || (c.queue !== 'leads' && c.queue !== 'schools')
    return true
  })
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#F8FAFC' }}>

      {/* hidden file input */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />

      {/* image lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={lightboxUrl} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} />
          <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
      )}

      {/* ── Col 1: Conversation list ──────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #E2E8F0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>Inbox Áion</div>
            {totalUnread > 0 && (
              <span style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 7px', minWidth: 20, textAlign: 'center' }}>
                {totalUnread}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {(['all', 'leads', 'schools', 'general', 'unread'] as ConvFilter[]).map(f => {
              const labels: Record<ConvFilter, string> = { all: 'Todas', leads: 'Vendas', schools: 'Suporte', general: 'Geral', unread: 'Não lidas' }
              const active = filter === f
              return (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: '1.5px solid', borderColor: active ? '#00A896' : '#E2E8F0', background: active ? '#E6F7F5' : '#F8FAFC', color: active ? '#00A896' : '#64748B', cursor: 'pointer' }}>
                  {labels[f]}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvs ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 style={{ width: 22, height: 22, color: '#00A896', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filteredConvs.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Nenhuma conversa encontrada.</div>
          ) : (
            filteredConvs.map(conv => {
              const isActive = activeConv?.id === conv.id
              const qc = queueColor(conv.queue)
              return (
                <div key={conv.id} onClick={() => selectConv(conv)} style={{ padding: '12px 14px', borderBottom: '1px solid #F8FAFC', background: isActive ? '#F0FDFB' : '#fff', borderLeft: `3px solid ${isActive ? '#00A896' : 'transparent'}`, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#00A896' }}>
                    {initials(conv.contact_name, conv.remote_jid)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                        {conv.contact_name || formatPhone(conv.remote_jid)}
                      </span>
                      <span style={{ fontSize: 11, color: '#94A3B8', flexShrink: 0, marginLeft: 4 }}>{formatTime(conv.last_message_at)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{conv.last_message || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, background: qc.bg, color: qc.text, borderRadius: 20, padding: '1px 7px' }}>{queueLabel(conv.queue)}</span>
                      {conv.bot_active && <Bot style={{ width: 11, height: 11, color: '#6366F1' }} />}
                      {(conv.unread_count ?? 0) > 0 && (
                        <span style={{ marginLeft: 'auto', background: '#00A896', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px', minWidth: 17, textAlign: 'center' }}>
                          {conv.unread_count}
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

      {/* ── Col 2: Messages ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <MessageCircle style={{ width: 48, height: 48, color: '#CBD5E1' }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: '#94A3B8' }}>Selecione uma conversa</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#00A896' }}>
                {initials(activeConv.contact_name, activeConv.remote_jid)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>{activeConv.contact_name || formatPhone(activeConv.remote_jid)}</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>{formatPhone(activeConv.remote_jid)} · {statusLabel(activeConv.status)}</div>
              </div>
              {activeConv.bot_active && (
                <span style={{ fontSize: 11, fontWeight: 600, background: '#EDE9FE', color: '#7C3AED', borderRadius: 20, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Bot style={{ width: 12, height: 12 }} /> Bot ativo
                </span>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4, background: '#F8FAFC' }}>
              {loadingMsgs ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                  <Loader2 style={{ width: 22, height: 22, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, paddingTop: 40 }}>Nenhuma mensagem ainda.</div>
              ) : (
                messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    contactName={activeConv.contact_name}
                    onReply={setReplyTo}
                    onReact={handleReact}
                    onImageClick={setLightboxUrl}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error toast */}
            {sendError && (
              <div style={{ margin: '0 20px 6px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: '#DC2626' }}>{sendError}</span>
                <button onClick={() => setSendError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 0, marginLeft: 8 }}><X size={14} /></button>
              </div>
            )}

            {/* Input area */}
            <div style={{ padding: '10px 20px 12px', borderTop: '1px solid #E2E8F0', background: '#fff', flexShrink: 0, position: 'relative' }}>

              {/* Attach menu */}
              {showAttach && (
                <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {([
                    { icon: Image,    label: 'Imagem',    bg: '#EDE9FE', color: '#7C3AED', accept: 'image/*' },
                    { icon: Video,    label: 'Vídeo',     bg: '#DBEAFE', color: '#2563EB', accept: 'video/*' },
                    { icon: FileText, label: 'Documento', bg: '#FEF3C7', color: '#D97706', accept: '.pdf,.doc,.docx,.xlsx,.xls' },
                    { icon: Mic,      label: 'Áudio',     bg: '#D1FAE5', color: '#059669', accept: 'audio/*' },
                  ] as const).map(item => {
                    const IconComp = item.icon
                    return (
                      <button key={item.label}
                        onClick={() => { if (fileInputRef.current) fileInputRef.current.accept = item.accept; fileInputRef.current?.click(); setShowAttach(false) }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, background: item.bg, color: item.color, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                        <IconComp style={{ width: 16, height: 16 }} />{item.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* File preview */}
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

              {/* Reply-to preview */}
              {replyTo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDFB', border: '1px solid #B2E8E2', borderRadius: 10, padding: '6px 12px', marginBottom: 8 }}>
                  <CornerUpLeft size={14} color="#00A896" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#00A896', marginBottom: 1 }}>
                      {replyTo.from_me ? 'Você' : (activeConv.contact_name || 'Contato')}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {replyTo.content}
                    </div>
                  </div>
                  <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}><X size={14} /></button>
                </div>
              )}

              {/* Emoji picker */}
              {showEmojiPicker && (
                <div ref={emojiPickerRef} style={{ position: 'absolute', bottom: 72, left: 20, zIndex: 40 }}>
                  <EmojiPicker data={emojiData} onEmojiSelect={handleEmojiSelect} locale="pt" theme="light" previewPosition="none" skinTonePosition="none" />
                </div>
              )}

              {/* Input row — recording or normal */}
              {recorderState === 'recording' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={cancelRecording} style={{ width: 40, height: 40, borderRadius: '50%', background: '#F1F5F9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <X size={16} color="#64748B" />
                  </button>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDFB', border: '1.5px solid #D1FAE5', borderRadius: 28, padding: '0 16px', height: 46 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', flexShrink: 0 }}>
                      {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
                    </span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 28 }}>
                      {waveformBars.map((h, i) => (
                        <div key={i} style={{ flex: 1, height: `${Math.round(h * 100)}%`, minHeight: 3, background: '#00A896', borderRadius: 2, transition: 'height 0.08s ease' }} />
                      ))}
                    </div>
                  </div>
                  <button onClick={stopRecordingForPreview} style={{ width: 44, height: 44, borderRadius: '50%', background: '#00A896', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
                    <Check size={20} />
                  </button>
                </div>
              ) : recorderState === 'preview' && audioPreviewUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={discardAudio} style={{ width: 40, height: 40, borderRadius: '50%', background: '#FEE2E2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <X size={16} color="#EF4444" />
                  </button>
                  <audio src={audioPreviewUrl} controls style={{ flex: 1, height: 36, minWidth: 0 }} />
                  <button onClick={sendAudio} style={{ width: 44, height: 44, borderRadius: '50%', background: '#00A896', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
                    <Send size={18} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {([
                    { icon: Paperclip, active: showAttach,      onClick: () => { setShowAttach(v => !v); setShowEmojiPicker(false) }, title: 'Anexar' },
                    { icon: Smile,     active: showEmojiPicker, onClick: () => { setShowEmojiPicker(v => !v); setShowAttach(false) },  title: 'Emoji'  },
                  ] as const).map(btn => {
                    const IconComp = btn.icon
                    return (
                      <button key={btn.title} onClick={btn.onClick} title={btn.title}
                        style={{ padding: 8, borderRadius: 8, flexShrink: 0, background: btn.active ? '#E6F7F5' : 'none', color: btn.active ? '#00A896' : '#64748B', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}>
                        <IconComp style={{ width: 20, height: 20 }} />
                      </button>
                    )
                  })}
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder="Digite uma mensagem…"
                    rows={1}
                    style={{ flex: 1, padding: '10px 18px', fontSize: 14, background: '#F0FDFB', border: '1.5px solid #D1FAE5', borderRadius: 28, color: '#1A2B4A', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, minHeight: 42, maxHeight: 100, boxSizing: 'border-box', transition: 'all 0.2s' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#00A896'; e.currentTarget.style.background = '#FFFFFF' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#D1FAE5'; e.currentTarget.style.background = '#F0FDFB' }}
                  />
                  {inputText.trim() ? (
                    <button onClick={handleSend} disabled={sending}
                      style={{ width: 44, height: 44, borderRadius: '50%', background: sending ? '#94A3B8' : '#00A896', color: '#fff', border: 'none', cursor: sending ? 'not-allowed' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {sending ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 18, height: 18 }} />}
                    </button>
                  ) : (
                    <button onClick={startRecording} title="Gravar áudio"
                      style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00A896', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      <Mic style={{ width: 18, height: 18 }} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Col 3: Contact / Lead panel ───────────────────────────────────── */}
      <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid #E2E8F0', background: '#fff', overflowY: 'auto' }}>
        {!activeConv ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <User style={{ width: 40, height: 40, color: '#CBD5E1' }} />
            <div style={{ fontSize: 13, color: '#94A3B8' }}>Selecione uma conversa</div>
          </div>
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* CONTATO */}
            <PanelSection title="Contato">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#00A896', flexShrink: 0 }}>
                  {initials(activeConv.contact_name, activeConv.remote_jid)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeConv.contact_name || '—'}</div>
                  <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Phone style={{ width: 11, height: 11 }} />{formatPhone(activeConv.remote_jid)}
                  </div>
                </div>
              </div>
              {lead && (
                <a href={`/super-admin/crm?lead=${lead.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#00A896', fontWeight: 600, textDecoration: 'none' }}>
                  <ExternalLink style={{ width: 12, height: 12 }} />Ver no CRM
                </a>
              )}
            </PanelSection>

            {/* LEAD CRM */}
            <PanelSection title="Lead CRM">
              {loadingLead ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                  <Loader2 style={{ width: 18, height: 18, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : lead ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{lead.name || lead.contact_name || '—'}</div>
                  {lead.school && (
                    <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building2 style={{ width: 11, height: 11 }} />{lead.school}
                    </div>
                  )}
                  {(lead.city || lead.state) && (
                    <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin style={{ width: 11, height: 11 }} />{[lead.city, lead.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {lead.stage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Stage:</span>
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 10px', background: stageColor(lead.stage).bg, color: stageColor(lead.stage).text }}>{stageLabel(lead.stage)}</span>
                    </div>
                  )}
                  {lead.next_followup && (
                    <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar style={{ width: 11, height: 11 }} />Follow-up: {new Date(lead.next_followup).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  {lead.notes && (
                    <div style={{ fontSize: 12, color: '#64748B', background: '#F0FDFB', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, marginTop: 2 }}>{lead.notes}</div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Nenhum lead vinculado a este contato.</div>
                  <button onClick={createLead} disabled={creatingLead}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#00A896', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: creatingLead ? 'not-allowed' : 'pointer', opacity: creatingLead ? 0.7 : 1 }}>
                    {creatingLead ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <UserPlus style={{ width: 13, height: 13 }} />}
                    Criar Lead no CRM
                  </button>
                </div>
              )}
            </PanelSection>

            {/* ATENDIMENTO */}
            <PanelSection title="Atendimento">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={panelLabelStyle}>Status</label>
                  <select value={activeConv.status} onChange={e => updateStatus(e.target.value)} style={panelSelectStyle}>
                    <option value="waiting">Aguardando</option>
                    <option value="open">Aberta</option>
                    <option value="closed">Fechada</option>
                  </select>
                </div>
                <div>
                  <label style={panelLabelStyle}>Consultor</label>
                  <select value={activeConv.assigned_user_id || ''} onChange={e => assignConsultant(e.target.value)} style={panelSelectStyle}>
                    <option value="">— Nenhum —</option>
                    {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div onClick={toggleBot} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Bot style={{ width: 14, height: 14, color: '#6366F1' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>Bot</span>
                  </div>
                  <div style={{ width: 36, height: 20, borderRadius: 10, background: activeConv.bot_active ? '#6366F1' : '#CBD5E1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: activeConv.bot_active ? 19 : 3, transition: 'left 0.2s' }} />
                  </div>
                </div>
              </div>
            </PanelSection>

            {/* ORIGEM */}
            <PanelSection title="Origem">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Fila:</span>
                  <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 10px', background: queueColor(activeConv.queue).bg, color: queueColor(activeConv.queue).text }}>{queueLabel(activeConv.queue)}</span>
                </div>
                {activeConv.tags && activeConv.tags.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <Tag style={{ width: 11, height: 11, color: '#94A3B8' }} />
                    {activeConv.tags.map((t, i) => (
                      <span key={i} style={{ fontSize: 11, background: '#F1F5F9', color: '#64748B', borderRadius: 20, padding: '1px 8px' }}>{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock style={{ width: 11, height: 11 }} />
                  Iniciado em {new Date(activeConv.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              </div>
            </PanelSection>

          </div>
        )}
      </div>
    </div>
  )
}
