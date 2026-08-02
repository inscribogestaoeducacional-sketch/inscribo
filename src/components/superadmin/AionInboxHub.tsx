import React, { useState, useEffect, useRef, useCallback } from 'react'
import EmojiPicker from '@emoji-mart/react'
import emojiData from '@emoji-mart/data'
import {
  MessageCircle, Bot, User, Phone,
  ExternalLink, UserPlus, Send, Check,
  Loader2, Image, FileText, Mic, Video,
  Tag, Clock, Calendar, Play, Pause,
  X, Paperclip, Smile, CornerUpLeft, SmilePlus, Save, Zap,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

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
  contact_type?: string
  aion_lead_id?: string
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
  name?: string | null
  contact_name?: string
  phone?: string
  school_name?: string | null
  city?: string | null
  state?: string | null
  stage?: string | null
  next_followup?: string | null
  notes?: string | null
  created_at?: string
}

// crm_interactions e crm_meetings já existem e são usados por AdminCRM.tsx
// (LeadModal) — mesmas tabelas, mesmo lead_id (crm_leads.id), reaproveitadas aqui.
interface AionInteraction {
  id: string
  lead_id: string
  type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'note'
  content: string
  created_at: string
}

interface AionCrmMeeting {
  id: string
  lead_id: string
  title: string
  type: string
  scheduled_at: string
  status: string
}

// Template buscado ao vivo na Graph API (mesmo shape de InstitutionDetails.tsx
// loadWaTemplates() / WhatsAppHub.tsx) — não cacheado em whatsapp_templates
// porque essa tabela tem institution_id com FK real pra institutions(id), e
// platform_whatsapp.id (a pseudo-instituição do Inbox Áion) violaria essa FK.
interface AionWaTemplate {
  id?: string
  name: string
  language: string
  status?: string
  components?: { type: string; text?: string; [key: string]: unknown }[]
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

// Mesmos 6 estágios usados em AdminCRM.tsx (STAGES) — crm_leads.stage
const AION_LEAD_STAGES = ['interesse', 'qualificacao', 'proposta', 'negociacao', 'fechado', 'cliente'] as const

function interactionIcon(type: string): string {
  if (type === 'call') return '📞'
  if (type === 'whatsapp') return '💬'
  if (type === 'email') return '📧'
  if (type === 'meeting') return '🤝'
  return '📌'
}

function interactionLabel(type: string): string {
  if (type === 'call') return 'Ligação'
  if (type === 'whatsapp') return 'WhatsApp'
  if (type === 'email') return 'E-mail'
  if (type === 'meeting') return 'Reunião'
  return 'Nota'
}

// Mesma lógica de buildTemplatePreview() em WhatsAppHub.tsx — resolve {{n}}
// no corpo do template com os valores preenchidos, pra pré-visualização.
function buildAionTemplatePreview(tmpl: AionWaTemplate | undefined, vars: Record<string, string>): string {
  if (!tmpl) return '[Template]'
  const bodyComp = tmpl.components?.find(c => c.type === 'BODY')
  if (!bodyComp?.text) return `[Template: ${tmpl.name}]`
  let text: string = bodyComp.text
  Object.entries(vars).forEach(([n, val]) => {
    text = text.replace(new RegExp(`\\{\\{${n}\\}\\}`, 'g'), val)
  })
  return text
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
  useEffect(() => { console.log('[AUDIO] mediaUrl:', mediaUrl) }, [mediaUrl])

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

export default function AionInboxHub({ aionPlatformId, onManageQuickReplies }: {
  aionPlatformId?: string
  onManageQuickReplies?: () => void
} = {}) {
  const { user } = useAuth()
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
  // tags + lead + contact type
  const [aionTags, setAionTags]                     = useState<{id:string;name:string;color:string}[]>([])
  const [addingTag, setAddingTag]                   = useState(false)
  const [newTag, setNewTag]                         = useState('')
  const [showLeadModal, setShowLeadModal]           = useState(false)
  const [leadForm, setLeadForm]                     = useState({ name: '', phone: '', email: '', grade_interest: '' })
  const [savingLead, setSavingLead]                 = useState(false)
  const [linkingLead, setLinkingLead]               = useState(false)
  const [leadSearch, setLeadSearch]                 = useState('')
  const [leadResults, setLeadResults]               = useState<{id:string;name:string;phone:string}[]>([])
  const [searchingLeads, setSearchingLeads]         = useState(false)
  // lead panel — edição, histórico e reuniões
  const [leadTab, setLeadTab]                       = useState<'dados' | 'historico' | 'reunioes'>('dados')
  const [leadEditForm, setLeadEditForm]             = useState<Partial<AionLead>>({})
  const [savingLeadEdit, setSavingLeadEdit]         = useState(false)
  const [leadEditSaved, setLeadEditSaved]           = useState(false)
  const [leadInteractions, setLeadInteractions]     = useState<AionInteraction[]>([])
  const [loadingInteractions, setLoadingInteractions] = useState(false)
  const [newInteraction, setNewInteraction]         = useState({ type: 'note', content: '' })
  const [savingInteraction, setSavingInteraction]   = useState(false)
  const [leadMeetings, setLeadMeetings]             = useState<AionCrmMeeting[]>([])
  const [loadingMeetings, setLoadingMeetings]       = useState(false)
  // respostas rápidas — whatsapp_quick_replies com platform_whatsapp.id como pseudo-institution_id
  const [showQuickReplies, setShowQuickReplies]     = useState(false)
  const [quickReplies, setQuickReplies]             = useState<{ id: string; label: string; text: string; shortcut: string | null }[]>([])
  // mensagens agendadas — sempre via template aprovado (reativação fora da
  // janela de 24h exige template; texto livre é rejeitado pela Meta nesse caso)
  const [showScheduleModal, setShowScheduleModal]   = useState(false)
  const [aionTemplates, setAionTemplates]           = useState<AionWaTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates]     = useState(false)
  const [scheduleTemplateName, setScheduleTemplateName] = useState('')
  const [scheduleTemplateVars, setScheduleTemplateVars] = useState<Record<string, string>>({})
  const [scheduleSendAt, setScheduleSendAt]         = useState('')
  const [savingSchedule, setSavingSchedule]         = useState(false)
  const [scheduleError, setScheduleError]           = useState('')
  const [scheduledMessages, setScheduledMessages]   = useState<{ id: string; content: string; send_at: string; message_type: string }[]>([])
  const [loadingScheduled, setLoadingScheduled]     = useState(false)
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

  // ── load aion_tags ──
  useEffect(() => {
    supabase.from('aion_tags').select('*').order('name')
      .then(({ data }) => setAionTags(data ?? []))
  }, [])

  // ── load consultants ──
  useEffect(() => {
    supabase
      .from('users')
      .select('id, full_name, email, user_type, role')
      .or('user_type.eq.consultant,role.eq.admin_geral')
      .then(({ data }) => setConsultants((data as ConsultantUser[]) ?? []))
  }, [])

  // ── load quick replies (globais + pessoais — RLS já filtra) ──
  useEffect(() => {
    if (!aionPlatformId) return
    supabase
      .from('whatsapp_quick_replies')
      .select('id, title, message, order_index, shortcut')
      .eq('institution_id', aionPlatformId)
      .order('order_index', { ascending: true })
      .then(({ data }) => {
        if (data) setQuickReplies(data.map((r: any) => ({ id: r.id, label: r.title, text: r.message, shortcut: r.shortcut ?? null })))
      })
  }, [aionPlatformId])

  // ── load mensagens agendadas pendentes da conversa ativa ──
  const loadScheduledMessages = useCallback(async (convId: string) => {
    setLoadingScheduled(true)
    const { data } = await supabase
      .from('aion_scheduled_messages')
      .select('id, content, send_at, message_type')
      .eq('conversation_id', convId)
      .eq('status', 'pending')
      .order('send_at', { ascending: true })
    setScheduledMessages(data ?? [])
    setLoadingScheduled(false)
  }, [])

  useEffect(() => {
    if (!activeConv?.id) { setScheduledMessages([]); return }
    loadScheduledMessages(activeConv.id)
  }, [activeConv?.id, loadScheduledMessages])

  // ── stop mic on unmount ──
  useEffect(() => {
    return () => { audioStreamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  // ── reset draft de edição + carregar histórico/reuniões quando o lead muda ──
  useEffect(() => {
    setLeadEditForm(lead ? { ...lead } : {})
    setLeadEditSaved(false)
    setLeadTab('dados')
    if (!lead?.id) {
      setLeadInteractions([])
      setLeadMeetings([])
      return
    }
    setLoadingInteractions(true)
    supabase.from('crm_interactions').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false })
      .then(({ data }) => { setLeadInteractions((data as AionInteraction[]) ?? []); setLoadingInteractions(false) })
    setLoadingMeetings(true)
    supabase.from('crm_meetings').select('*').eq('lead_id', lead.id).order('scheduled_at', { ascending: false })
      .then(({ data }) => { setLeadMeetings((data as AionCrmMeeting[]) ?? []); setLoadingMeetings(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

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
        console.log('[RT MSG]', msg.message_type, 'media_url:', msg.media_url)
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
        body: JSON.stringify({ institution_id: null, base64, mimetype: fileToSend.type, filename: pendingFile.name }),
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
          body: JSON.stringify({ institution_id: null, base64, mimetype: mimeType, filename: `audio-${Date.now()}.${mimeType.includes('webm') ? 'webm' : 'mp4'}` }),
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

  // ── tags ──
  const handleAddTag = async (tag: string) => {
    if (!activeConv || !tag.trim()) return
    const tags = [...(activeConv.tags || []).filter(t => t !== tag), tag]
    await supabase.from('whatsapp_conversations').update({ tags }).eq('id', activeConv.id)
    setActiveConv(prev => prev ? { ...prev, tags } : prev)
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, tags } : c))
    setAddingTag(false); setNewTag('')
  }

  const handleRemoveTag = async (tag: string) => {
    if (!activeConv) return
    const tags = (activeConv.tags || []).filter(t => t !== tag)
    await supabase.from('whatsapp_conversations').update({ tags }).eq('id', activeConv.id)
    setActiveConv(prev => prev ? { ...prev, tags } : prev)
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, tags } : c))
  }

  // ── contact type ──
  const updateContactType = async (type: string) => {
    if (!activeConv) return
    await supabase.from('whatsapp_conversations').update({ contact_type: type }).eq('id', activeConv.id)
    setActiveConv(prev => prev ? { ...prev, contact_type: type } : prev)
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, contact_type: type } : c))
  }

  // ── atendimento ──
  const handleCloseConversation = async () => {
    if (!activeConv) return
    await supabase.from('whatsapp_conversations').update({ status: 'closed' }).eq('id', activeConv.id)
    setActiveConv(prev => prev ? { ...prev, status: 'closed' } : prev)
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status: 'closed' } : c))
  }

  const handleLeaveConversation = async () => {
    if (!activeConv) return
    await supabase.from('whatsapp_conversations').update({ status: 'waiting', assigned_user_id: null, assigned_user_name: null }).eq('id', activeConv.id)
    setActiveConv(prev => prev ? { ...prev, status: 'waiting', assigned_user_id: undefined, assigned_user_name: undefined } : prev)
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status: 'waiting', assigned_user_id: undefined, assigned_user_name: undefined } : c))
  }

  // ── lead modal ──
  const handleCreateLead = async () => {
    if (!activeConv || !leadForm.name.trim() || savingLead) return
    setSavingLead(true)
    try {
      const phone = leadForm.phone || rawPhone(activeConv.remote_jid)
      const { data: newLead } = await supabase.from('crm_leads').insert({
        name: leadForm.name.trim(),
        phone,
        email: leadForm.email.trim() || null,
        grade_interest: leadForm.grade_interest.trim() || null,
        origin: 'whatsapp',
        stage: 'interesse',
      }).select().maybeSingle()
      if (newLead) {
        setLead(newLead as AionLead)
        await supabase.from('whatsapp_conversations')
          .update({ contact_type: 'lead', aion_lead_id: newLead.id }).eq('id', activeConv.id)
        setActiveConv(prev => prev ? { ...prev, contact_type: 'lead', aion_lead_id: (newLead as AionLead).id } : prev)
      }
    } finally {
      setSavingLead(false)
      setShowLeadModal(false)
      setLeadForm({ name: '', phone: '', email: '', grade_interest: '' })
    }
  }

  const searchLeads = async (q: string) => {
    setLeadSearch(q)
    if (!q || q.length < 2) { setLeadResults([]); return }
    setSearchingLeads(true)
    const { data } = await supabase.from('crm_leads').select('id, name, phone')
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(5)
    setLeadResults(data ?? [])
    setSearchingLeads(false)
  }

  const handleLinkLead = async (leadId: string) => {
    if (!activeConv) return
    const { data: linkedLead } = await supabase.from('crm_leads').select('*').eq('id', leadId).maybeSingle()
    if (linkedLead) setLead(linkedLead as AionLead)
    await supabase.from('whatsapp_conversations')
      .update({ aion_lead_id: leadId, contact_type: 'lead' }).eq('id', activeConv.id)
    setActiveConv(prev => prev ? { ...prev, aion_lead_id: leadId, contact_type: 'lead' } : prev)
    setLinkingLead(false); setLeadSearch(''); setLeadResults([])
  }

  const handleSaveLeadEdit = async () => {
    if (!lead) return
    setSavingLeadEdit(true)
    try {
      const payload = {
        name:          leadEditForm.name?.trim() || null,
        school_name:   leadEditForm.school_name?.trim() || null,
        city:          leadEditForm.city?.trim() || null,
        state:         leadEditForm.state?.trim() || null,
        stage:         leadEditForm.stage || null,
        next_followup: leadEditForm.next_followup || null,
        notes:         leadEditForm.notes?.trim() || null,
      }
      const { error } = await supabase.from('crm_leads').update(payload).eq('id', lead.id)
      if (!error) {
        setLead(prev => (prev ? { ...prev, ...payload } : prev))
        setLeadEditSaved(true)
        setTimeout(() => setLeadEditSaved(false), 2000)
      }
    } finally {
      setSavingLeadEdit(false)
    }
  }

  const handleAddInteraction = async () => {
    if (!lead || !newInteraction.content.trim() || savingInteraction) return
    setSavingInteraction(true)
    try {
      await supabase.from('crm_interactions').insert({
        lead_id: lead.id, type: newInteraction.type, content: newInteraction.content.trim(),
      })
      setNewInteraction({ type: 'note', content: '' })
      const { data } = await supabase.from('crm_interactions')
        .select('*').eq('lead_id', lead.id).order('created_at', { ascending: false })
      setLeadInteractions((data as AionInteraction[]) ?? [])
    } finally {
      setSavingInteraction(false)
    }
  }

  // Busca templates aprovados direto na Graph API (mesmo padrão de
  // InstitutionDetails.tsx:loadWaTemplates()) — sem cache local, ver comentário
  // da migration 20260803000000 sobre por que whatsapp_templates não serve aqui.
  const loadAionTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const { data: waRow } = await supabase.from('platform_whatsapp').select('waba_id').eq('connected', true).maybeSingle()
      const wabaId = waRow?.waba_id
      if (!wabaId) { setAionTemplates([]); return }

      const { data: tokenRow } = await supabase.from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
      const token = tokenRow?.value || ''
      if (!token) { setAionTemplates([]); return }

      const res = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/message_templates?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const approved = ((data.data || []) as AionWaTemplate[]).filter(t => t.status?.toUpperCase() === 'APPROVED')
      setAionTemplates(approved)
    } catch (e) {
      console.error('[schedule] erro ao carregar templates:', e)
      setAionTemplates([])
    } finally {
      setLoadingTemplates(false)
    }
  }

  const openScheduleModal = () => {
    setScheduleTemplateName('')
    setScheduleTemplateVars({})
    setScheduleSendAt('')
    setScheduleError('')
    setShowScheduleModal(true)
    loadAionTemplates()
  }

  const handleSchedule = async () => {
    if (!activeConv || savingSchedule) return
    const tmpl = aionTemplates.find(t => t.name === scheduleTemplateName)
    if (!tmpl) { setScheduleError('Selecione um template.'); return }
    if (!scheduleSendAt) { setScheduleError('Escolha a data e hora de envio.'); return }
    const sendAtIso = new Date(scheduleSendAt).toISOString()
    if (new Date(sendAtIso).getTime() <= Date.now()) { setScheduleError('A data/hora precisa ser no futuro.'); return }

    const varKeys = Object.keys(scheduleTemplateVars)
    const components = varKeys.length > 0
      ? [{ type: 'body', parameters: varKeys.map(k => ({ type: 'text', text: scheduleTemplateVars[k] })) }]
      : (tmpl.components ?? [])
    const preview = buildAionTemplatePreview(tmpl, scheduleTemplateVars)

    setSavingSchedule(true)
    setScheduleError('')
    try {
      const { error } = await supabase.from('aion_scheduled_messages').insert({
        conversation_id:     activeConv.id,
        remote_jid:           activeConv.remote_jid,
        message_type:         'template',
        content:               preview,
        template_name:         tmpl.name,
        template_language:     tmpl.language || 'pt_BR',
        template_components:   components,
        send_at:               sendAtIso,
        created_by:            user?.id || null,
      })
      if (error) throw error
      setShowScheduleModal(false)
      await loadScheduledMessages(activeConv.id)
    } catch (e: any) {
      setScheduleError(e?.message || 'Erro ao agendar mensagem.')
    } finally {
      setSavingSchedule(false)
    }
  }

  const cancelScheduledMessage = async (id: string) => {
    if (!confirm('Cancelar esta mensagem agendada?')) return
    await supabase.from('aion_scheduled_messages').update({ status: 'cancelled' }).eq('id', id)
    setScheduledMessages(prev => prev.filter(m => m.id !== id))
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

              {/* Quick replies panel */}
              {showQuickReplies && (
                <div style={{ marginBottom: 8, background: '#F0FDFB', borderRadius: 12, border: '1px solid #D1FAE5', padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Respostas rápidas</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {onManageQuickReplies && (
                        <button onClick={() => { setShowQuickReplies(false); onManageQuickReplies() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00A896', fontSize: 11, fontWeight: 600 }}>
                          Gerenciar
                        </button>
                      )}
                      <button onClick={() => setShowQuickReplies(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}>
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                  {quickReplies.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>
                      Nenhuma resposta rápida cadastrada.<br />
                      {onManageQuickReplies && (
                        <span style={{ color: '#00A896', cursor: 'pointer' }} onClick={() => { setShowQuickReplies(false); onManageQuickReplies() }}>
                          Configure em Configurações → Respostas Rápidas
                        </span>
                      )}
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
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{qr.label}</p>
                          <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qr.text}</p>
                        </button>
                      ))}
                    </div>
                  )}
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
                    { icon: Paperclip, active: showAttach,        onClick: () => { setShowAttach(v => !v); setShowEmojiPicker(false); setShowQuickReplies(false) }, title: 'Anexar' },
                    { icon: Zap,       active: showQuickReplies,  onClick: () => { setShowQuickReplies(v => !v); setShowAttach(false); setShowEmojiPicker(false) }, title: 'Respostas rápidas' },
                    { icon: Clock,     active: showScheduleModal, onClick: () => { setShowAttach(false); setShowEmojiPicker(false); setShowQuickReplies(false); openScheduleModal() }, title: 'Agendar mensagem' },
                    { icon: Smile,     active: showEmojiPicker,   onClick: () => { setShowEmojiPicker(v => !v); setShowAttach(false); setShowQuickReplies(false) }, title: 'Emoji'  },
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

      {/* Lead modal */}
      {showLeadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px 24px', width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', marginBottom: 20 }}>Criar Lead no CRM</div>
            {([
              { label: 'Nome *', key: 'name', placeholder: 'Nome do responsável' },
              { label: 'Telefone', key: 'phone', placeholder: activeConv ? formatPhone(activeConv.remote_jid) : '' },
              { label: 'E-mail', key: 'email', placeholder: 'email@exemplo.com' },
              { label: 'Série de interesse', key: 'grade_interest', placeholder: 'Ex: 1º ano EF' },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>{f.label}</label>
                <input value={leadForm[f.key]} onChange={e => setLeadForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={handleCreateLead} disabled={savingLead || !leadForm.name.trim()}
                style={{ flex: 1, padding: '10px 0', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, borderRadius: 9, border: 'none', cursor: (savingLead || !leadForm.name.trim()) ? 'not-allowed' : 'pointer', opacity: (savingLead || !leadForm.name.trim()) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {savingLead ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <UserPlus style={{ width: 14, height: 14 }} />}
                Criar Lead
              </button>
              <button onClick={() => { setShowLeadModal(false); setLeadForm({ name: '', phone: '', email: '', grade_interest: '' }) }}
                style={{ padding: '10px 16px', background: '#F1F5F9', color: '#64748B', fontSize: 13, fontWeight: 600, borderRadius: 9, border: 'none', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agendar Mensagem */}
      {showScheduleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px 24px', width: 460, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', marginBottom: 4 }}>Agendar Mensagem</div>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 0, marginBottom: 16 }}>
              Só templates aprovados pela Meta — necessário pra reativar contato fora da janela de 24h.
            </p>

            {scheduleError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 14 }}>
                {scheduleError}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>Template aprovado</label>
              {loadingTemplates ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                  <Loader2 style={{ width: 18, height: 18, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : aionTemplates.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Nenhum template aprovado encontrado. Confirme se o WhatsApp da Áion está conectado e tem templates aprovados no Gerenciador de Negócios da Meta.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {aionTemplates.map(tpl => {
                    const bodyText = tpl.components?.find(c => c.type === 'BODY')?.text || tpl.name
                    const isSelected = scheduleTemplateName === tpl.name
                    return (
                      <button key={tpl.id || tpl.name}
                        onClick={() => { setScheduleTemplateName(tpl.name); setScheduleTemplateVars({}) }}
                        style={{ textAlign: 'left', padding: '8px 10px', background: isSelected ? '#E6F7F5' : '#FFFFFF', border: `1.5px solid ${isSelected ? '#00A896' : '#E2E8F0'}`, borderRadius: 9, cursor: 'pointer', transition: 'all 0.15s' }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1A2B4A' }}>{tpl.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bodyText}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {scheduleTemplateName && (() => {
              const tmpl = aionTemplates.find(t => t.name === scheduleTemplateName)
              const bodyComp = tmpl?.components?.find(c => c.type === 'BODY')
              const matches = bodyComp?.text ? [...bodyComp.text.matchAll(/\{\{(\d+)\}\}/g)] : []
              return (
                <div style={{ marginBottom: 14 }}>
                  {matches.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Variáveis do template:</p>
                      {matches.map(([, n]) => (
                        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{`{{${n}}}`}</span>
                          <input value={scheduleTemplateVars[n] || ''}
                            onChange={e => setScheduleTemplateVars(v => ({ ...v, [n]: e.target.value }))}
                            placeholder={`Variável ${n}`}
                            style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 7, color: '#1A2B4A', outline: 'none' }} />
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: '#64748B', margin: 0, background: '#F8FAFC', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
                    {buildAionTemplatePreview(tmpl, scheduleTemplateVars)}
                  </p>
                </div>
              )
            })()}

            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>Data e hora de envio</label>
              <input type="datetime-local" value={scheduleSendAt} onChange={e => setScheduleSendAt(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={handleSchedule} disabled={savingSchedule || !scheduleTemplateName}
                style={{ flex: 1, padding: '10px 0', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, borderRadius: 9, border: 'none', cursor: (savingSchedule || !scheduleTemplateName) ? 'not-allowed' : 'pointer', opacity: (savingSchedule || !scheduleTemplateName) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {savingSchedule ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Clock style={{ width: 14, height: 14 }} />}
                Agendar
              </button>
              <button onClick={() => setShowScheduleModal(false)}
                style={{ padding: '10px 16px', background: '#F1F5F9', color: '#64748B', fontSize: 13, fontWeight: 600, borderRadius: 9, border: 'none', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
              {/* Contact type badges */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {([
                  { key: 'lead',     label: 'Nova Família', bg: '#E6F7F5', color: '#0d9488' },
                  { key: 'client',   label: 'Cliente',      bg: '#D1FAE5', color: '#059669' },
                  { key: 'supplier', label: 'Fornecedor',   bg: '#EDE9FE', color: '#7C3AED' },
                  { key: 'other',    label: 'Outro',        bg: '#F1F5F9', color: '#64748B' },
                ] as const).map(ct => {
                  const active = activeConv.contact_type === ct.key
                  return (
                    <button key={ct.key} onClick={() => updateContactType(active ? '' : ct.key)}
                      style={{ fontSize: 11, padding: '2px 9px', borderRadius: 9999, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? ct.color : '#E2E8F0'}`, background: active ? ct.bg : '#fff', color: active ? ct.color : '#94A3B8', transition: 'all 0.15s' }}>
                      {ct.label}
                    </button>
                  )
                })}
              </div>
              {/* Tags */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'block' }}>Etiquetas</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(activeConv.tags || []).map(tag => {
                    const color = aionTags.find(t => t.name === tag)?.color || '#6366F1'
                    return (
                      <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, padding: '2px 7px', borderRadius: 9999, fontWeight: 600, color: '#fff', background: color }}>
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '0 0 0 2px', lineHeight: 1, fontSize: 13 }}>×</button>
                      </span>
                    )
                  })}
                  {addingTag ? (
                    aionTags.length > 0 ? (
                      <select autoFocus value={newTag}
                        onChange={e => { if (e.target.value) handleAddTag(e.target.value); else { setAddingTag(false); setNewTag('') } }}
                        onBlur={() => { setAddingTag(false); setNewTag('') }}
                        style={{ fontSize: 11, padding: '2px 7px', borderRadius: 9999, border: '1px dashed #D1FAE5', background: '#fff', color: '#1A2B4A', outline: 'none', cursor: 'pointer' }}>
                        <option value="">Selecionar etiqueta...</option>
                        {aionTags.filter(t => !(activeConv.tags || []).includes(t.name)).map(t => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTag(newTag); if (e.key === 'Escape') { setAddingTag(false); setNewTag('') } }}
                        onBlur={() => { if (newTag.trim()) handleAddTag(newTag); else { setAddingTag(false); setNewTag('') } }}
                        placeholder="Nova etiqueta..." maxLength={20}
                        style={{ fontSize: 11, padding: '2px 7px', borderRadius: 9999, border: '1px dashed #D1FAE5', background: 'transparent', color: '#1A2B4A', outline: 'none', width: 110 }} />
                    )
                  ) : (
                    <button onClick={() => setAddingTag(true)}
                      style={{ fontSize: 11, padding: '2px 9px', borderRadius: 9999, border: '1px dashed #D1FAE5', color: '#00A896', background: 'transparent', cursor: 'pointer' }}>
                      + Etiqueta
                    </button>
                  )}
                </div>
              </div>
              {lead && (
                <a href={`/super-admin/crm?lead=${lead.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#00A896', fontWeight: 600, textDecoration: 'none', marginTop: 8 }}>
                  <ExternalLink style={{ width: 12, height: 12 }} />Ver no CRM
                </a>
              )}
            </PanelSection>

            {/* LEAD VINCULADO */}
            <PanelSection title="Lead Vinculado">
              {loadingLead ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                  <Loader2 style={{ width: 18, height: 18, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : lead ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Mini-abas */}
                  <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #E2E8F0' }}>
                    {([
                      { key: 'dados',     label: 'Dados' },
                      { key: 'historico', label: 'Histórico' },
                      { key: 'reunioes',  label: 'Reuniões' },
                    ] as const).map(t => (
                      <button key={t.key} onClick={() => setLeadTab(t.key)}
                        style={{
                          padding: '6px 10px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                          borderBottom: leadTab === t.key ? '2px solid #00A896' : '2px solid transparent',
                          color: leadTab === t.key ? '#00A896' : '#94A3B8', background: 'transparent', transition: 'color 0.15s',
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* ABA DADOS — edição inline */}
                  {leadTab === 'dados' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={panelLabelStyle}>Nome</label>
                        <input value={leadEditForm.name || ''} onChange={e => setLeadEditForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Nome do responsável" style={{ ...panelSelectStyle, cursor: 'text' }} />
                      </div>
                      <div>
                        <label style={panelLabelStyle}>Escola</label>
                        <input value={leadEditForm.school_name || ''} onChange={e => setLeadEditForm(f => ({ ...f, school_name: e.target.value }))}
                          placeholder="Nome da escola" style={{ ...panelSelectStyle, cursor: 'text' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 6 }}>
                        <div>
                          <label style={panelLabelStyle}>Cidade</label>
                          <input value={leadEditForm.city || ''} onChange={e => setLeadEditForm(f => ({ ...f, city: e.target.value }))}
                            style={{ ...panelSelectStyle, cursor: 'text' }} />
                        </div>
                        <div>
                          <label style={panelLabelStyle}>UF</label>
                          <input value={leadEditForm.state || ''} maxLength={2}
                            onChange={e => setLeadEditForm(f => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))}
                            style={{ ...panelSelectStyle, cursor: 'text' }} />
                        </div>
                      </div>
                      <div>
                        <label style={panelLabelStyle}>Stage</label>
                        <select value={leadEditForm.stage || ''} onChange={e => setLeadEditForm(f => ({ ...f, stage: e.target.value }))} style={panelSelectStyle}>
                          <option value="">—</option>
                          {AION_LEAD_STAGES.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={panelLabelStyle}>Próximo follow-up</label>
                        <input type="date" value={leadEditForm.next_followup ? leadEditForm.next_followup.slice(0, 10) : ''}
                          onChange={e => setLeadEditForm(f => ({ ...f, next_followup: e.target.value }))}
                          style={{ ...panelSelectStyle, cursor: 'text' }} />
                      </div>
                      <div>
                        <label style={panelLabelStyle}>Notas</label>
                        <textarea value={leadEditForm.notes || ''} onChange={e => setLeadEditForm(f => ({ ...f, notes: e.target.value }))}
                          rows={3} placeholder="Anotações sobre este lead..."
                          style={{ ...panelSelectStyle, cursor: 'text', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
                      </div>
                      <button onClick={handleSaveLeadEdit} disabled={savingLeadEdit}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0',
                          background: leadEditSaved ? '#10B981' : '#00A896', color: '#fff', fontSize: 12, fontWeight: 700,
                          borderRadius: 8, border: 'none', cursor: savingLeadEdit ? 'not-allowed' : 'pointer', opacity: savingLeadEdit ? 0.7 : 1,
                          transition: 'background 0.15s',
                        }}>
                        {savingLeadEdit
                          ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />Salvando...</>
                          : leadEditSaved
                            ? <><Check style={{ width: 13, height: 13 }} />Salvo!</>
                            : <><Save style={{ width: 13, height: 13 }} />Salvar alterações</>}
                      </button>
                    </div>
                  )}

                  {/* ABA HISTÓRICO — crm_interactions (mesma tabela do CRM Comercial) */}
                  {leadTab === 'historico' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 8 }}>
                        <select value={newInteraction.type} onChange={e => setNewInteraction(f => ({ ...f, type: e.target.value }))}
                          style={{ ...panelSelectStyle, marginBottom: 6, padding: '5px 8px', fontSize: 11 }}>
                          <option value="note">Nota</option>
                          <option value="call">Ligação</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="email">E-mail</option>
                          <option value="meeting">Reunião</option>
                        </select>
                        <textarea value={newInteraction.content} onChange={e => setNewInteraction(f => ({ ...f, content: e.target.value }))}
                          placeholder="Registrar contato..." rows={2}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #E2E8F0', borderRadius: 6, fontSize: 12, outline: 'none', resize: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                        <button onClick={handleAddInteraction} disabled={savingInteraction || !newInteraction.content.trim()}
                          style={{ marginTop: 6, padding: '5px 12px', borderRadius: 7, background: '#00A896', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: (savingInteraction || !newInteraction.content.trim()) ? 0.5 : 1 }}>
                          {savingInteraction ? 'Salvando...' : 'Registrar'}
                        </button>
                      </div>

                      {loadingInteractions ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                          <Loader2 style={{ width: 16, height: 16, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                        </div>
                      ) : leadInteractions.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '10px 0' }}>Nenhuma interação registrada ainda.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {leadInteractions.map(item => (
                            <div key={item.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#1A2B4A' }}>{interactionIcon(item.type)} {interactionLabel(item.type)}</span>
                                <span style={{ fontSize: 10, color: '#94A3B8', whiteSpace: 'nowrap', marginLeft: 6 }}>
                                  {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0', lineHeight: 1.5 }}>{item.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA REUNIÕES — crm_meetings (mesma tabela do CRM Comercial); agendamento
                      em si fica pra próxima etapa, aqui só a lista + o espaço reservado */}
                  {leadTab === 'reunioes' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        disabled
                        title="Em breve — o agendamento será conectado na próxima etapa"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0',
                          background: '#F1F5F9', color: '#94A3B8', fontSize: 12, fontWeight: 700,
                          borderRadius: 8, border: '1px dashed #CBD5E1', cursor: 'not-allowed',
                        }}>
                        <Calendar style={{ width: 13, height: 13 }} /> Agendar reunião
                        <span style={{ fontSize: 9, fontWeight: 700, background: '#E2E8F0', color: '#64748B', padding: '1px 6px', borderRadius: 20, marginLeft: 2 }}>EM BREVE</span>
                      </button>

                      {loadingMeetings ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                          <Loader2 style={{ width: 16, height: 16, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                        </div>
                      ) : leadMeetings.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '10px 0' }}>Nenhuma reunião agendada ainda.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {leadMeetings.map(m => (
                            <div key={m.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A' }}>{m.title}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                <Calendar style={{ width: 11, height: 11, color: '#94A3B8' }} />
                                <span style={{ fontSize: 11, color: '#64748B' }}>
                                  {new Date(m.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, marginLeft: 'auto',
                                  background: m.status === 'completed' ? '#DCFCE7' : m.status === 'cancelled' ? '#FEE2E2' : '#DBEAFE',
                                  color: m.status === 'completed' ? '#16A34A' : m.status === 'cancelled' ? '#DC2626' : '#2563EB',
                                }}>
                                  {m.status === 'completed' ? 'Realizada' : m.status === 'cancelled' ? 'Cancelada' : 'Agendada'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {/* Link lead search */}
                  {linkingLead ? (
                    <div style={{ marginBottom: 10 }}>
                      <input value={leadSearch} onChange={e => searchLeads(e.target.value)}
                        placeholder="Buscar por nome ou telefone…" autoFocus
                        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }} />
                      {searchingLeads && <div style={{ fontSize: 12, color: '#94A3B8', padding: '4px 0' }}>Buscando…</div>}
                      {leadResults.length > 0 && (
                        <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
                          {leadResults.map(r => (
                            <button key={r.id} onClick={() => handleLinkLead(r.id)}
                              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: '#fff', border: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', fontSize: 13 }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F0FDFB')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                              <div style={{ fontWeight: 600, color: '#1A2B4A' }}>{r.name}</div>
                              <div style={{ fontSize: 11, color: '#94A3B8' }}>{r.phone}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      <button onClick={() => { setLinkingLead(false); setLeadSearch(''); setLeadResults([]) }}
                        style={{ marginTop: 6, fontSize: 12, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10, textAlign: 'center' }}>
                      Nenhum lead vinculado a este contato.
                    </div>
                  )}
                  {!linkingLead && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => setShowLeadModal(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#00A896', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer' }}>
                        <UserPlus style={{ width: 12, height: 12 }} /> Criar Lead
                      </button>
                      <button onClick={() => setLinkingLead(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#F1F5F9', color: '#64748B', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer' }}>
                        Vincular
                      </button>
                    </div>
                  )}
                </div>
              )}
            </PanelSection>

            {/* ATENDIMENTO */}
            <PanelSection title="Atendimento">
              {/* Concluir / Sair */}
              {activeConv.status !== 'closed' && (
                <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <button onClick={handleCloseConversation}
                    style={{ width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 3px 10px rgba(13,148,136,0.3)' }}>
                    ✅ Concluir Atendimento
                  </button>
                  {activeConv.assigned_user_id && (
                    <button onClick={handleLeaveConversation}
                      style={{ width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#92400E', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, cursor: 'pointer' }}>
                      🚪 Sair do Atendimento
                    </button>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={panelLabelStyle}>Status</label>
                  <select value={activeConv.status} onChange={e => updateStatus(e.target.value)} style={panelSelectStyle}>
                    <option value="waiting">Aguardando</option>
                    <option value="open">Em Atendimento</option>
                    <option value="closed">Concluído</option>
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
                <div style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock style={{ width: 11, height: 11 }} />
                  Iniciado em {new Date(activeConv.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              </div>
            </PanelSection>

            {/* MENSAGENS AGENDADAS */}
            <PanelSection title="Mensagens Agendadas">
              {loadingScheduled ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
                  <Loader2 style={{ width: 16, height: 16, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : scheduledMessages.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '6px 0' }}>
                  Nenhuma mensagem agendada pra este contato.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {scheduledMessages.map(m => (
                    <div key={m.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#00A896', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock style={{ width: 11, height: 11 }} />
                          {new Date(m.send_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button onClick={() => cancelScheduledMessage(m.id)} title="Cancelar"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2, flexShrink: 0 }}>
                          <X style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                        {m.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </PanelSection>

          </div>
        )}
      </div>
    </div>
  )
}
