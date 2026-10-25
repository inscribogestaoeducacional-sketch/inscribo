import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Send, Sparkles, Loader2, LifeBuoy, ExternalLink, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { LESSONS } from '../../lib/academy/academyContent'
import { MODULE_BY_ID } from '../../lib/academy/academy'
import { BRAND } from '../../lib/brand'

// "Tire suas dúvidas": conversa com a assistente (aulas da Academia). Se ela não souber,
// a pessoa chama a equipe da Áion e a resposta chega aqui (e no celular, por aviso).
interface Msg { id: string; author_type: 'user' | 'ai' | 'staff'; body: string; created_at: string }
interface Thread { id: string; status: 'ai' | 'escalated' | 'resolved'; user_unread: number }

const SUGGESTIONS = ['Como cadastro um lead novo?', 'Como agendo uma visita?', 'Como instalo a Áion no celular?', 'Como respondo uma conversa do WhatsApp?']

const ROUTE_LABEL: Record<string, string> = (() => {
  const m: Record<string, string> = { '/academia': 'a Academia' }
  for (const l of LESSONS) { const p = l.to.split('?')[0]; if (!m[p]) m[p] = MODULE_BY_ID[l.module]?.label || p }
  return m
})()

function parse(body: string) {
  const telas: string[] = []; let equipe = false; let aula: string | null = null
  const text = body
    .replace(/\[\[TELA:(\/[a-z0-9\-/]*)\]\]/gi, (_, p) => { if (ROUTE_LABEL[p] && !telas.includes(p)) telas.push(p); return '' })
    .replace(/\[\[AULA:([a-z0-9_\-.]+)\]\]/gi, (_, k) => { if (LESSONS.some(l => l.key === k)) aula = k; return '' })
    .replace(/\[\[EQUIPE\]\]/g, () => { equipe = true; return '' })
    .trim()
  return { text, telas, equipe, aula: aula as string | null }
}

export default function AskAi({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  const { user } = useAuth()
  const loc = useLocation()
  const navigate = useNavigate()
  const [thread, setThread] = useState<Thread | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (id?: string) => {
    if (!user?.id) return
    let t: Thread | null = null
    if (id) {
      const { data } = await supabase.from('support_threads').select('id,status,user_unread').eq('id', id).maybeSingle()
      t = (data as Thread | null) ?? null
    } else {
      const { data } = await supabase.from('support_threads').select('id,status,user_unread').eq('user_id', user.id).neq('status', 'resolved').order('last_message_at', { ascending: false }).limit(1)
      t = ((data ?? [])[0] as Thread | undefined) ?? null
    }
    setThread(t)
    if (t) {
      const { data: m } = await supabase.from('support_messages').select('id,author_type,body,created_at').eq('thread_id', t.id).order('created_at', { ascending: true })
      setMsgs((m ?? []) as Msg[])
      if (t.user_unread > 0) supabase.rpc('support_mark_read', { p_thread: t.id }).then(() => {}, () => {})
    } else setMsgs([])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  // resposta da equipe chega na hora
  useEffect(() => {
    if (!thread?.id) return
    const ch = supabase.channel(`support_${thread.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `thread_id=eq.${thread.id}` }, () => { load(thread.id) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_threads', filter: `id=eq.${thread.id}` }, () => { load(thread.id) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [thread?.id, load])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, busy])

  const send = async (raw?: string) => {
    const message = (raw ?? text).trim()
    if (!message || busy) return
    setBusy(true); setErr(''); setText('')
    setMsgs(p => [...p, { id: 'tmp' + Date.now(), author_type: 'user', body: message, created_at: new Date().toISOString() }])
    try {
      const { data, error } = await supabase.functions.invoke('help-ai', { body: { thread_id: thread?.id ?? null, message, route: loc.pathname } })
      if (error || !data || (data as { error?: string }).error) throw new Error('falha')
      await load((data as { thread_id: string }).thread_id)
    } catch {
      setErr('Não consegui enviar agora. Tente de novo em instantes.')
      await load(thread?.id)
    }
    setBusy(false)
  }

  const callTeam = async () => {
    if (!thread) return
    setBusy(true)
    const { error } = await supabase.rpc('support_escalate', { p_thread: thread.id })
    if (error) setErr('Não consegui chamar a equipe agora. Tente de novo.')
    await load(thread.id)
    setBusy(false)
  }
  const resolve = async () => {
    if (!thread) return
    await supabase.rpc('support_close', { p_thread: thread.id })
    setThread(null); setMsgs([])
  }
  const goto = (p: string) => { onNavigate?.(); navigate(p) }

  const escalated = thread?.status === 'escalated'
  const lastAi = useMemo(() => [...msgs].reverse().find(m => m.author_type === 'ai'), [msgs])

  const bubble = (m: Msg) => {
    const mine = m.author_type === 'user'
    const p = mine ? { text: m.body, telas: [] as string[], equipe: false, aula: null as string | null } : parse(m.body)
    return (
      <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
        <div style={{ maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: mine ? 'flex-end' : 'flex-start' }}>
          {m.author_type === 'staff' && <span style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.primaryDark }}>Equipe Áion</span>}
          <div style={{ padding: '10px 13px', borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, fontSize: 14.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: mine ? BRAND.primary : m.author_type === 'staff' ? BRAND.soft : '#fff', color: mine ? '#fff' : BRAND.ink, border: mine ? 'none' : `1px solid ${m.author_type === 'staff' ? BRAND.softLine : BRAND.line}` }}>{p.text}</div>
          {p.telas.map(t => (
            <button key={t} type="button" onClick={() => goto(t)} style={chip}><ExternalLink size={14} /> Abrir {ROUTE_LABEL[t]}</button>
          ))}
          {p.aula && (
            <button type="button" onClick={() => goto(`/academia?aula=${p.aula}`)} style={chip}><ExternalLink size={14} /> Ver a aula: {LESSONS.find(l => l.key === p.aula)?.title}</button>
          )}
          {!escalated && m.id === lastAi?.id && !busy && (
            <button type="button" onClick={callTeam} disabled={busy} style={{ ...chip, background: 'transparent', border: 'none', color: BRAND.muted, fontWeight: 700, fontSize: 13, minHeight: 30, padding: '0 4px', textDecoration: 'underline' }}><LifeBuoy size={13} /> Falar com a equipe da Áion</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: compact ? '#F8FAFC' : 'transparent' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Loader2 size={20} className="animate-spin" color={BRAND.primary} /></div> : (
          <>
            {msgs.length === 0 && (
              <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: BRAND.ink }}><Sparkles size={18} color={BRAND.primary} /> Pergunte o que quiser</div>
                <div style={{ fontSize: 13.5, color: BRAND.muted, marginTop: 4, lineHeight: 1.45 }}>Eu respondo com base nas aulas da Academia. Se eu não souber, chamo a equipe da Áion.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {SUGGESTIONS.map(s => <button key={s} type="button" onClick={() => send(s)} style={{ ...chip, justifyContent: 'flex-start', textAlign: 'left', height: 'auto', minHeight: 42, padding: '9px 12px' }}>{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map(bubble)}
            {busy && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: BRAND.muted, fontSize: 13.5 }}><Loader2 size={16} className="animate-spin" /> Pensando…</div>}
            {escalated && <div style={{ padding: '10px 12px', borderRadius: 14, background: BRAND.warnSoft, border: '1px solid #FDE68A', color: '#78350F', fontSize: 13.5, lineHeight: 1.4 }}>A equipe da Áion foi chamada. Você recebe um aviso no celular quando responderem.</div>}
            {err && <div style={{ padding: '10px 12px', borderRadius: 14, background: BRAND.dangerSoft, color: BRAND.danger, fontSize: 13.5 }}>{err}</div>}
            {thread && !busy && <button type="button" onClick={resolve} style={{ ...chip, alignSelf: 'center', color: BRAND.success }}><CheckCircle2 size={15} /> Já resolvi, obrigado</button>}
          </>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ flexShrink: 0, display: 'flex', gap: 8, padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', background: '#fff', borderTop: `1px solid ${BRAND.line}` }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} maxLength={2000}
          placeholder="Escreva sua dúvida" style={{ flex: 1, minWidth: 0, height: 46, borderRadius: 14, border: `1.5px solid ${BRAND.line}`, padding: '0 14px', fontSize: 16, color: BRAND.ink, outline: 'none', fontFamily: 'inherit' }} />
        <button type="button" aria-label="Enviar" onClick={() => send()} disabled={!text.trim() || busy} style={{ width: 46, height: 46, borderRadius: 14, border: 'none', background: 'var(--aion-grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: !text.trim() || busy ? .45 : 1, flexShrink: 0 }}><Send size={18} /></button>
      </div>
    </div>
  )
}

const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 13px', borderRadius: 12, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.ink, fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }
