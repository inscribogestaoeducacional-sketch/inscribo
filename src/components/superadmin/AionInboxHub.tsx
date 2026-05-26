import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  MessageCircle, Bot, User, Phone, Building2, MapPin,
  ExternalLink, UserPlus, Send, Check, CheckCheck,
  Loader2, Image, FileText, Mic, Video,
  Tag, Clock, Calendar,
} from 'lucide-react'

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AionInboxHub() {
  const [conversations, setConversations]   = useState<AionConversation[]>([])
  const [activeConv, setActiveConv]         = useState<AionConversation | null>(null)
  const [messages, setMessages]             = useState<AionMessage[]>([])
  const [lead, setLead]                     = useState<AionLead | null>(null)
  const [consultants, setConsultants]       = useState<ConsultantUser[]>([])
  const [filter, setFilter]                 = useState<ConvFilter>('all')
  const [text, setText]                     = useState('')
  const [sending, setSending]               = useState(false)
  const [loadingMsgs, setLoadingMsgs]       = useState(false)
  const [loadingLead, setLoadingLead]       = useState(false)
  const [creatingLead, setCreatingLead]     = useState(false)
  const [loadingConvs, setLoadingConvs]     = useState(true)
  const messagesEndRef                      = useRef<HTMLDivElement>(null)
  const activeJidRef                        = useRef<string | null>(null)

  // Load conversations
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

  // Load consultants
  useEffect(() => {
    supabase
      .from('users')
      .select('id, full_name, email, user_type, role')
      .or('user_type.eq.consultant,role.eq.admin_geral')
      .then(({ data }) => setConsultants((data as ConsultantUser[]) ?? []))
  }, [])

  // Realtime: conversations
  useEffect(() => {
    const channel = supabase
      .channel('aion-conversations-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: 'is_aion_inbox=eq.true' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setConversations(prev => [payload.new as AionConversation, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as AionConversation
            setConversations(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
            setActiveConv(prev => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
          } else if (payload.eventType === 'DELETE') {
            setConversations(prev => prev.filter(c => c.id !== (payload.old as AionConversation).id))
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Realtime: messages
  useEffect(() => {
    const channel = supabase
      .channel('aion-messages-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: 'is_aion_inbox=eq.true' },
        (payload) => {
          const msg = payload.new as AionMessage
          if (activeJidRef.current && msg.remote_jid === activeJidRef.current) {
            setMessages(prev => [...prev, msg])
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Select conversation
  const selectConv = async (conv: AionConversation) => {
    setActiveConv(conv)
    activeJidRef.current = conv.remote_jid
    setMessages([])
    setLead(null)
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
      await supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', conv.id)
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c))
    }

    const phone = rawPhone(conv.remote_jid)
    if (phone.length >= 8) {
      setLoadingLead(true)
      const { data: leadData } = await supabase
        .from('crm_leads')
        .select('*')
        .ilike('phone', `%${phone}%`)
        .maybeSingle()
      setLead((leadData as AionLead) ?? null)
      setLoadingLead(false)
    }
  }

  // Send message
  const sendMessage = async () => {
    if (!activeConv || !text.trim() || sending) return
    const msg = text.trim()
    setText('')
    setSending(true)
    try {
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: null,
          to: activeConv.remote_jid,
          message: msg,
          isAionSend: true,
        }),
      })
    } finally {
      setSending(false)
    }
  }

  // Create lead
  const createLead = async () => {
    if (!activeConv) return
    setCreatingLead(true)
    const phone = rawPhone(activeConv.remote_jid)
    const { data } = await supabase
      .from('crm_leads')
      .insert({
        name: activeConv.contact_name || phone,
        phone,
        stage: 'interesse',
        origin: 'whatsapp',
      })
      .select()
      .maybeSingle()
    setLead((data as AionLead) ?? null)
    setCreatingLead(false)
  }

  // Update conversation status
  const updateStatus = async (status: string) => {
    if (!activeConv) return
    await supabase.from('whatsapp_conversations').update({ status }).eq('id', activeConv.id)
    setActiveConv(prev => (prev ? { ...prev, status } : prev))
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status } : c))
  }

  // Assign consultant
  const assignConsultant = async (userId: string) => {
    if (!activeConv) return
    const user = consultants.find(c => c.id === userId)
    await supabase
      .from('whatsapp_conversations')
      .update({ assigned_user_id: userId || null, assigned_user_name: user?.full_name || null })
      .eq('id', activeConv.id)
    setActiveConv(prev =>
      prev ? { ...prev, assigned_user_id: userId || undefined, assigned_user_name: user?.full_name || undefined } : prev,
    )
  }

  // Toggle bot
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

      {/* ── Col 1: Conversation list ──────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #E2E8F0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>Inbox Áion</div>
            {totalUnread > 0 && (
              <span style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 7px', minWidth: 20, textAlign: 'center' }}>
                {totalUnread}
              </span>
            )}
          </div>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            {(['all', 'leads', 'schools', 'general', 'unread'] as ConvFilter[]).map(f => {
              const labels: Record<ConvFilter, string> = { all: 'Todas', leads: 'Vendas', schools: 'Suporte', general: 'Geral', unread: 'Não lidas' }
              const active = filter === f
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: '1.5px solid',
                    borderColor: active ? '#00A896' : '#E2E8F0',
                    background: active ? '#E6F7F5' : '#F8FAFC',
                    color: active ? '#00A896' : '#64748B',
                    cursor: 'pointer',
                  }}
                >
                  {labels[f]}
                </button>
              )
            })}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvs ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 style={{ width: 22, height: 22, color: '#00A896', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filteredConvs.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Nenhuma conversa encontrada.
            </div>
          ) : (
            filteredConvs.map(conv => {
              const isActive = activeConv?.id === conv.id
              const qc = queueColor(conv.queue)
              return (
                <div
                  key={conv.id}
                  onClick={() => selectConv(conv)}
                  style={{
                    padding: '12px 14px', borderBottom: '1px solid #F8FAFC',
                    background: isActive ? '#F0FDFB' : '#fff',
                    borderLeft: `3px solid ${isActive ? '#00A896' : 'transparent'}`,
                    cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#00A896' }}>
                    {initials(conv.contact_name, conv.remote_jid)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                        {conv.contact_name || formatPhone(conv.remote_jid)}
                      </span>
                      <span style={{ fontSize: 11, color: '#94A3B8', flexShrink: 0, marginLeft: 4 }}>
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                      {conv.last_message || '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, background: qc.bg, color: qc.text, borderRadius: 20, padding: '1px 7px' }}>
                        {queueLabel(conv.queue)}
                      </span>
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
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>
                  {activeConv.contact_name || formatPhone(activeConv.remote_jid)}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {formatPhone(activeConv.remote_jid)} · {statusLabel(activeConv.status)}
                </div>
              </div>
              {activeConv.bot_active && (
                <span style={{ fontSize: 11, fontWeight: 600, background: '#EDE9FE', color: '#7C3AED', borderRadius: 20, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Bot style={{ width: 12, height: 12 }} /> Bot ativo
                </span>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, background: '#F8FAFC' }}>
              {loadingMsgs ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                  <Loader2 style={{ width: 22, height: 22, color: '#00A896', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, paddingTop: 40 }}>
                  Nenhuma mensagem ainda.
                </div>
              ) : (
                messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', background: '#fff', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Digite uma mensagem…"
                rows={1}
                style={{
                  flex: 1, padding: '10px 14px', border: '1.5px solid #E2E8F0',
                  borderRadius: 12, fontSize: 14, color: '#1A2B4A', background: '#fff',
                  outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                  maxHeight: 120, overflowY: 'auto', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !text.trim()}
                style={{
                  width: 40, height: 40, borderRadius: 10, border: 'none', flexShrink: 0,
                  background: (sending || !text.trim()) ? '#E2E8F0' : '#00A896',
                  color: (sending || !text.trim()) ? '#94A3B8' : '#fff',
                  cursor: (sending || !text.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {sending
                  ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  : <Send style={{ width: 16, height: 16 }} />
                }
              </button>
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeConv.contact_name || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Phone style={{ width: 11, height: 11 }} />
                    {formatPhone(activeConv.remote_jid)}
                  </div>
                </div>
              </div>
              {lead && (
                <a
                  href={`/super-admin/crm?lead=${lead.id}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#00A896', fontWeight: 600, textDecoration: 'none' }}
                >
                  <ExternalLink style={{ width: 12, height: 12 }} />
                  Ver no CRM
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>
                    {lead.name || lead.contact_name || '—'}
                  </div>
                  {lead.school && (
                    <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building2 style={{ width: 11, height: 11 }} />
                      {lead.school}
                    </div>
                  )}
                  {(lead.city || lead.state) && (
                    <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin style={{ width: 11, height: 11 }} />
                      {[lead.city, lead.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {lead.stage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Stage:</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 10px',
                        background: stageColor(lead.stage).bg,
                        color: stageColor(lead.stage).text,
                      }}>
                        {stageLabel(lead.stage)}
                      </span>
                    </div>
                  )}
                  {lead.next_followup && (
                    <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar style={{ width: 11, height: 11 }} />
                      Follow-up: {new Date(lead.next_followup).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  {lead.notes && (
                    <div style={{ fontSize: 12, color: '#64748B', background: '#F0FDFB', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, marginTop: 2 }}>
                      {lead.notes}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>
                    Nenhum lead vinculado a este contato.
                  </div>
                  <button
                    onClick={createLead}
                    disabled={creatingLead}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', background: '#00A896', color: '#fff',
                      fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none',
                      cursor: creatingLead ? 'not-allowed' : 'pointer',
                      opacity: creatingLead ? 0.7 : 1,
                    }}
                  >
                    {creatingLead
                      ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />
                      : <UserPlus style={{ width: 13, height: 13 }} />
                    }
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
                  <select
                    value={activeConv.status}
                    onChange={e => updateStatus(e.target.value)}
                    style={panelSelectStyle}
                  >
                    <option value="waiting">Aguardando</option>
                    <option value="open">Aberta</option>
                    <option value="closed">Fechada</option>
                  </select>
                </div>
                <div>
                  <label style={panelLabelStyle}>Consultor</label>
                  <select
                    value={activeConv.assigned_user_id || ''}
                    onChange={e => assignConsultant(e.target.value)}
                    style={panelSelectStyle}
                  >
                    <option value="">— Nenhum —</option>
                    {consultants.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
                {/* Bot toggle */}
                <div
                  onClick={toggleBot}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}
                >
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
                  <span style={{
                    fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 10px',
                    background: queueColor(activeConv.queue).bg,
                    color: queueColor(activeConv.queue).text,
                  }}>
                    {queueLabel(activeConv.queue)}
                  </span>
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

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: AionMessage }) {
  const fromMe = msg.from_me
  const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const renderContent = () => {
    const { message_type: type, content, media_url } = msg
    if (type === 'image') {
      return media_url
        ? <img src={media_url} alt="Imagem" style={{ maxWidth: 200, borderRadius: 8, display: 'block' }} />
        : <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.8)' : '#64748B' }}><Image style={{ width: 14, height: 14 }} /> Imagem</span>
    }
    if (type === 'audio') {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.9)' : '#1A2B4A' }}>
          <Mic style={{ width: 14, height: 14 }} />
          {media_url ? <audio src={media_url} controls style={{ height: 28, maxWidth: 160 }} /> : 'Áudio'}
        </span>
      )
    }
    if (type === 'video') {
      return media_url
        ? <video src={media_url} controls style={{ maxWidth: 220, borderRadius: 8 }} />
        : <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.8)' : '#64748B' }}><Video style={{ width: 14, height: 14 }} /> Vídeo</span>
    }
    if (type === 'document') {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: fromMe ? 'rgba(255,255,255,0.9)' : '#1A2B4A' }}>
          <FileText style={{ width: 14, height: 14 }} />
          {content || 'Documento'}
          {media_url && (
            <a href={media_url} target="_blank" rel="noopener noreferrer" style={{ color: fromMe ? '#fff' : '#00A896', fontSize: 11, marginLeft: 4 }}>
              Baixar
            </a>
          )}
        </span>
      )
    }
    return <span style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</span>
  }

  return (
    <div style={{ display: 'flex', justifyContent: fromMe ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '70%',
        background: fromMe ? '#00A896' : '#fff',
        color: fromMe ? '#fff' : '#1A2B4A',
        borderRadius: fromMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding: '8px 12px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      }}>
        {renderContent()}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: fromMe ? 'rgba(255,255,255,0.65)' : '#94A3B8' }}>{time}</span>
          {fromMe && <MsgStatusIcon status={msg.status} />}
        </div>
      </div>
    </div>
  )
}

function MsgStatusIcon({ status }: { status?: string }) {
  if (status === 'read')      return <CheckCheck style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.9)' }} />
  if (status === 'delivered') return <CheckCheck style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.55)' }} />
  return <Check style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.55)' }} />
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
