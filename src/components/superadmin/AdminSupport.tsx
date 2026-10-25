import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LifeBuoy, ArrowLeft, Send, CheckCircle2, Loader2, School } from 'lucide-react'
import SupportInsights from './SupportInsights'
import SuperAdminLayout from './SuperAdminLayout'
import PageHeader from '../ui/PageHeader'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

// Suporte (dúvidas): perguntas que a assistente da Academia não resolveu e foram para a equipe da Áion.
interface Row { id: string; user_id: string; user_name: string; institution_id: string | null; school_name: string | null; subject: string | null; status: string; staff_unread: boolean; escalated_at: string | null; last_message_at: string; last_body: string | null }
interface Msg { id: string; author_type: 'user' | 'ai' | 'staff'; body: string; created_at: string }
type Filter = 'open' | 'all' | 'painel'

const when = (iso: string) => {
  const d = new Date(iso), now = new Date()
  return d.toDateString() === now.toDateString() ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function AdminSupport() {
  const [filter, setFilter] = useState<Filter>('open')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [mobile, setMobile] = useState(window.innerWidth < 900)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const h = () => setMobile(window.innerWidth < 900); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])

  const loadList = useCallback(async () => {
    if (filter === 'painel') return
    const { data, error } = await supabase.rpc('support_staff_list', { p_status: filter })
    if (error) { setErr('Não foi possível carregar as dúvidas.'); setRows([]); return }
    setErr(''); setRows((data ?? []) as Row[])
  }, [filter])
  const loadMsgs = useCallback(async (id: string) => {
    const { data } = await supabase.from('support_messages').select('id,author_type,body,created_at').eq('thread_id', id).order('created_at', { ascending: true })
    setMsgs((data ?? []) as Msg[])
  }, [])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => {
    const ch = supabase.channel('sa_support_list').on('postgres_changes', { event: '*', schema: 'public', table: 'support_threads' }, () => { loadList(); if (activeId) loadMsgs(activeId) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => { if (activeId) loadMsgs(activeId) }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadList, loadMsgs, activeId])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, activeId])

  const open = async (r: Row) => {
    setActiveId(r.id); setReply(''); await loadMsgs(r.id)
    if (r.staff_unread) { await supabase.rpc('support_mark_read', { p_thread: r.id }); loadList() }
  }
  const active = rows?.find(r => r.id === activeId) || null

  const send = async (resolve: boolean) => {
    if (!active || busy) return
    if (!reply.trim() && !resolve) return
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('support_staff_reply', { p_thread: active.id, p_body: reply, p_resolve: resolve })
    if (error) setErr('Não foi possível enviar. Tente de novo.')
    else { setReply(''); await loadMsgs(active.id); await loadList() }
    setBusy(false)
  }

  const tabBtn = (on: boolean): React.CSSProperties => ({ border: 'none', borderRadius: 10, padding: '9px 18px', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? BRAND.primaryDark : BRAND.muted, boxShadow: on ? '0 1px 3px rgba(26,43,74,.12)' : 'none' })

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {rows === null && <div style={{ display: 'flex', gap: 8, color: BRAND.muted, padding: 16 }}><Loader2 size={18} className="animate-spin" /> Carregando…</div>}
      {rows?.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: BRAND.muted, fontSize: 14, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18 }}>{filter === 'open' ? 'Nenhuma dúvida esperando resposta.' : 'Nenhuma dúvida registrada ainda.'}</div>}
      {rows?.map(r => (
        <button key={r.id} type="button" onClick={() => open(r)} className="aion-tap" style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', padding: '12px 14px', borderRadius: 16, background: activeId === r.id ? BRAND.softer : '#fff', border: `1.5px solid ${activeId === r.id ? BRAND.primary : r.staff_unread ? '#FCA5A5' : BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {r.staff_unread && <span aria-label="Não lida" style={{ width: 9, height: 9, borderRadius: 99, background: '#F43F5E', flexShrink: 0 }} />}
            <span style={{ fontSize: 14.5, fontWeight: 800, color: BRAND.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.school_name || 'Escola sem nome'}</span>
            <span style={{ fontSize: 11.5, color: BRAND.faint }}>{when(r.last_message_at)}</span>
          </span>
          <span style={{ fontSize: 12.5, color: BRAND.muted }}>{r.user_name}{r.status === 'resolved' ? ' · Resolvida' : ''}</span>
          <span style={{ fontSize: 13, color: BRAND.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.last_body || r.subject}</span>
        </button>
      ))}
    </div>
  )

  const convo = active && (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, overflow: 'hidden', minHeight: mobile ? 'calc(100vh - 220px)' : 520, maxHeight: mobile ? undefined : 'calc(100vh - 260px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${BRAND.line}` }}>
        {mobile && <button type="button" aria-label="Voltar" onClick={() => setActiveId(null)} style={{ width: 38, height: 38, borderRadius: 11, border: `1px solid ${BRAND.line}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ArrowLeft size={18} /></button>}
        <span style={{ width: 38, height: 38, borderRadius: 12, background: BRAND.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><School size={19} color={BRAND.primary} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{active.school_name || 'Escola sem nome'}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: BRAND.muted }}>{active.user_name}{active.status === 'resolved' ? ' · Resolvida' : ''}</span>
        </span>
        {active.status !== 'resolved' && <button type="button" onClick={() => send(true)} disabled={busy} style={{ height: 38, padding: '0 12px', borderRadius: 11, border: `1px solid ${BRAND.softLine}`, background: BRAND.successSoft, color: BRAND.success, fontFamily: 'inherit', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={16} /> Resolvida</button>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC' }}>
        {msgs.map(m => {
          const staff = m.author_type === 'staff'
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: staff ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '84%' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: BRAND.faint, marginBottom: 2, textAlign: staff ? 'right' : 'left' }}>{m.author_type === 'user' ? active.user_name : m.author_type === 'ai' ? 'Assistente' : 'Equipe Áion'} · {when(m.created_at)}</div>
                <div style={{ padding: '9px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: staff ? BRAND.primary : m.author_type === 'ai' ? '#EEF2F7' : '#fff', color: staff ? '#fff' : BRAND.ink, border: staff ? 'none' : `1px solid ${BRAND.line}` }}>{m.body}</div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {err && <div style={{ color: BRAND.danger, fontSize: 13 }}>{err}</div>}
        <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} maxLength={4000} placeholder="Escreva a resposta (a pessoa recebe um aviso no celular)"
          style={{ width: '100%', borderRadius: 12, border: `1.5px solid ${BRAND.line}`, padding: '10px 12px', fontSize: 16, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => send(false)} disabled={busy || !reply.trim()} style={{ height: 42, padding: '0 16px', borderRadius: 12, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontFamily: 'inherit', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: busy || !reply.trim() ? .5 : 1 }}><Send size={16} /> Responder</button>
          {active.status !== 'resolved' && <button type="button" onClick={() => send(true)} disabled={busy || !reply.trim()} style={{ height: 42, padding: '0 16px', borderRadius: 12, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.ink, fontFamily: 'inherit', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: busy || !reply.trim() ? .5 : 1 }}>Responder e marcar Resolvida</button>}
        </div>
      </div>
    </div>
  )

  return (
    <SuperAdminLayout>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: mobile ? '12px 12px 24px' : '28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PageHeader icon={LifeBuoy} compact={mobile} title="Suporte (dúvidas)" subtitle="Perguntas que a assistente não resolveu e vieram para a equipe" />
        {!(mobile && active) && (
          <div role="tablist" style={{ display: 'inline-flex', gap: 2, background: '#EEF3F2', borderRadius: 14, padding: 4, alignSelf: 'flex-start' }}>
            <button type="button" role="tab" aria-selected={filter === 'open'} style={tabBtn(filter === 'open')} onClick={() => { setFilter('open'); setActiveId(null) }}>Abertas</button>
            <button type="button" role="tab" aria-selected={filter === 'all'} style={tabBtn(filter === 'all')} onClick={() => { setFilter('all'); setActiveId(null) }}>Todas</button>
            <button type="button" role="tab" aria-selected={filter === 'painel'} style={tabBtn(filter === 'painel')} onClick={() => { setFilter('painel'); setActiveId(null) }}>Painel</button>
          </div>
        )}
        {err && !active && <div style={{ padding: 12, borderRadius: 14, background: BRAND.dangerSoft, color: BRAND.danger, fontSize: 14 }}>{err}</div>}
        {filter === 'painel' ? <SupportInsights /> : mobile ? (active ? convo : list) : (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
            {list}
            {convo || <div style={{ padding: 40, textAlign: 'center', color: BRAND.muted, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, fontSize: 14 }}>Escolha uma dúvida para ver a conversa.</div>}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}
