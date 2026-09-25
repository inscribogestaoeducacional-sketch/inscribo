// =============================================================================
// src/pages/gestor/CaptacaoInteligente.tsx
//
// Módulo "Captação Inteligente": a escola cadastra gatilhos (um por anúncio/
// publicação) com o texto pré-preenchido do anúncio. O webhook
// (api/whatsapp/webhook.ts:applyCaptureTrigger) identifica a campanha quando
// a mensagem chega, marca conversa/contato com a origem e, conforme o
// gatilho, responde automaticamente, pula o robô e distribui round-robin.
//
// Duas abas: "Gatilhos" (CRUD + link wa.me pronto) e "Dashboard" (métricas
// por gatilho via RPC capture_trigger_stats). Visual segue GestorTransfers
// (KpiCard, Modal, DropdownMenu, abas em pílula).
// =============================================================================
import React, { useState, useEffect, useMemo } from 'react'
import {
  Megaphone, Plus, Copy, ExternalLink, X, Check, MoreHorizontal, Pencil, Trash2,
  Pause, Play, Bot, Users, AlertTriangle, MessageCircle, UserPlus, GraduationCap,
  Clock, TrendingUp, Zap, Loader2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  type CaptureTrigger, type CaptureChannel, CAPTURE_CHANNELS, CAPTURE_TEXT_MIN,
  buildWaMeLink, findOverlappingTriggers, formatDuration,
} from '../../lib/captureTriggers'

// ─── types ────────────────────────────────────────────────────────────────────
interface Assignee { trigger_id: string; user_id: string | null; group_id: string | null }
interface SchoolUser { id: string; full_name: string }
interface SchoolGroup { id: string; name: string; emoji: string | null; member_ids: string[] | null }

interface StatsRow {
  trigger_id: string
  hits: number
  conversations: number
  first_touch_contacts: number
  first_touch_leads: number
  first_touch_enrollments: number
  avg_first_response_seconds: number | null
  responded_entries: number
}

interface TriggerForm {
  name: string
  channel: CaptureChannel
  triggerText: string
  metaAdIds: string
  autoReply: string
  tagName: string
  skipBot: boolean
  isActive: boolean
  userIds: string[]
  groupIds: string[]
}

const EMPTY_FORM: TriggerForm = {
  name: '', channel: 'meta_ads', triggerText: '', metaAdIds: '', autoReply: '', tagName: '',
  skipBot: false, isActive: true, userIds: [], groupIds: [],
}

const PERIODS = [
  { key: 7,   label: '7 dias' },
  { key: 30,  label: '30 dias' },
  { key: 90,  label: '90 dias' },
  { key: 365, label: '12 meses' },
] as const

// ─── constants ────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none',
  background: '#FAFAFA', boxSizing: 'border-box',
}
const hintStyle: React.CSSProperties = { margin: '4px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }

const pct = (num: number, den: number) => den > 0 ? `${Math.round((num / den) * 1000) / 10}%`.replace('.', ',') : '—'
const fmt = (n: number) => n.toLocaleString('pt-BR')

export default function CaptacaoInteligente() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!

  const [activeTab, setActiveTab]   = useState<'triggers' | 'dashboard'>('triggers')
  const [triggers, setTriggers]     = useState<CaptureTrigger[]>([])
  const [assignees, setAssignees]   = useState<Assignee[]>([])
  const [users, setUsers]           = useState<SchoolUser[]>([])
  const [groups, setGroups]         = useState<SchoolGroup[]>([])
  const [schoolPhone, setSchoolPhone] = useState<string>('')
  const [loading, setLoading]       = useState(true)

  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<CaptureTrigger | null>(null)
  const [form, setForm]             = useState<TriggerForm>(EMPTY_FORM)
  const [formError, setFormError]   = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<CaptureTrigger | null>(null)
  const [openDropdown, setOpenDropdown]   = useState<string | null>(null)
  const [toast, setToast]           = useState<string | null>(null)

  const [period, setPeriod]         = useState<number>(30)
  const [stats, setStats]           = useState<StatsRow[]>([])
  const [statsLoading, setStatsLoading] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    const close = () => setOpenDropdown(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  // ── Loaders ─────────────────────────────────────────────────────────────────
  async function loadAll() {
    if (!institutionId) return
    setLoading(true)
    try {
      const [trgRes, asgRes, linksRes, groupsRes, phoneRes] = await Promise.all([
        // Inclui arquivados: a listagem esconde, mas o dashboard ainda mostra
        // o histórico deles.
        supabase.from('capture_triggers').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
        supabase.from('capture_trigger_assignees').select('trigger_id, user_id, group_id').eq('institution_id', institutionId),
        // Atendentes a partir do vínculo por escola (user_institutions), não
        // de users.institution_id — que só reflete a escola ATIVA de quem
        // tem vínculo em mais de uma.
        supabase.from('user_institutions').select('user_id, users(full_name)').eq('institution_id', institutionId).eq('active', true),
        supabase.from('whatsapp_groups').select('id, name, emoji, member_ids').eq('institution_id', institutionId).order('name'),
        supabase.from('whatsapp_phone_numbers').select('phone_number').eq('institution_id', institutionId).eq('is_active', true).limit(1).maybeSingle(),
      ])
      if (trgRes.error) throw trgRes.error
      setTriggers((trgRes.data ?? []) as CaptureTrigger[])
      setAssignees((asgRes.data ?? []) as Assignee[])
      setUsers(((linksRes.data ?? []) as any[])
        .map(r => {
          const u = Array.isArray(r.users) ? r.users[0] : r.users
          return { id: r.user_id as string, full_name: (u?.full_name as string) || 'Usuário' }
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setGroups((groupsRes.data ?? []) as SchoolGroup[])
      setSchoolPhone((phoneRes.data as any)?.phone_number || '')
    } catch (e) {
      console.error('[CaptacaoInteligente] loadAll error:', e)
      showToast('Erro ao carregar gatilhos.')
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    if (!institutionId) return
    setStatsLoading(true)
    const end   = new Date(Date.now() + 60_000)
    const start = new Date(Date.now() - period * 24 * 60 * 60 * 1000)
    // Recarrega a lista de gatilhos junto: a RPC já devolve gatilho criado em
    // outra aba/por outro usuário, e sem ele na lista local a linha seria
    // descartada em dashRows até um reload.
    const [{ data, error }, trgRes] = await Promise.all([
      supabase.rpc('capture_trigger_stats', {
        p_institution_id: institutionId,
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      }),
      supabase.from('capture_triggers').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
    ])
    if (!trgRes.error && trgRes.data) setTriggers(trgRes.data as CaptureTrigger[])
    if (error) {
      console.error('[CaptacaoInteligente] capture_trigger_stats error:', error)
      showToast('Erro ao carregar métricas.')
    }
    setStats(((data ?? []) as any[]).map(r => ({
      ...r,
      hits: Number(r.hits), conversations: Number(r.conversations),
      first_touch_contacts: Number(r.first_touch_contacts), first_touch_leads: Number(r.first_touch_leads),
      first_touch_enrollments: Number(r.first_touch_enrollments), responded_entries: Number(r.responded_entries),
      avg_first_response_seconds: r.avg_first_response_seconds == null ? null : Number(r.avg_first_response_seconds),
    })))
    setStatsLoading(false)
  }

  useEffect(() => { loadAll() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === 'dashboard') loadStats() }, [activeTab, period, institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleTriggers = triggers.filter(t => !t.archived_at)
  const userName  = (id: string) => users.find(u => u.id === id)?.full_name || 'Usuário'
  const groupById = (id: string) => groups.find(g => g.id === id)

  // ── Form ────────────────────────────────────────────────────────────────────
  function openNew() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(null); setShowModal(true)
  }

  function openEdit(t: CaptureTrigger) {
    const own = assignees.filter(a => a.trigger_id === t.id)
    setEditing(t)
    setForm({
      name: t.name, channel: t.channel, triggerText: t.trigger_text,
      metaAdIds: (t.meta_ad_ids || []).join('\n'), autoReply: t.auto_reply || '', tagName: t.tag_name || '',
      skipBot: t.skip_bot_flow, isActive: t.is_active,
      userIds: own.filter(a => a.user_id).map(a => a.user_id!),
      groupIds: own.filter(a => a.group_id).map(a => a.group_id!),
    })
    setFormError(null)
    setShowModal(true)
  }

  function closeForm() { setShowModal(false); setEditing(null) }

  const toggleIn = (list: string[], id: string) => list.includes(id) ? list.filter(x => x !== id) : [...list, id]

  const overlapping = useMemo(
    () => findOverlappingTriggers(form.triggerText, visibleTriggers.filter(t => t.id !== editing?.id)),
    [form.triggerText, visibleTriggers, editing?.id],
  )
  const formLink = buildWaMeLink(schoolPhone, form.triggerText)

  async function handleSave() {
    const name = form.name.trim()
    const triggerText = form.triggerText.trim()
    if (!name) { setFormError('Informe o nome do gatilho.'); return }
    if (triggerText.length < CAPTURE_TEXT_MIN) {
      setFormError(`O texto do gatilho precisa ter pelo menos ${CAPTURE_TEXT_MIN} caracteres — textos curtos (ex: "oi") pegariam qualquer mensagem.`)
      return
    }
    setSaving(true); setFormError(null)
    try {
      const payload = {
        institution_id: institutionId,
        name,
        channel: form.channel,
        trigger_text: triggerText,
        meta_ad_ids: form.metaAdIds.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean),
        auto_reply: form.autoReply.trim() || null,
        tag_name: form.tagName.trim() || null,
        skip_bot_flow: form.skipBot,
        is_active: form.isActive,
      }
      let triggerId = editing?.id
      if (editing) {
        const { error } = await supabase.from('capture_triggers').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('capture_triggers')
          .insert({ ...payload, created_by: user?.id }).select('id').single()
        if (error) throw error
        triggerId = data.id
      }

      // Atendentes/grupos só valem com "pular robô" (decisão da Fase 1: com o
      // robô rodando, quem decide a transferência é o próprio fluxo).
      const { error: delErr } = await supabase.from('capture_trigger_assignees').delete().eq('trigger_id', triggerId!)
      if (delErr) throw delErr
      if (form.skipBot) {
        const rows = [
          ...form.userIds.map(uid => ({ institution_id: institutionId, trigger_id: triggerId!, user_id: uid, group_id: null })),
          ...form.groupIds.map(gid => ({ institution_id: institutionId, trigger_id: triggerId!, user_id: null, group_id: gid })),
        ]
        if (rows.length) {
          const { error: insErr } = await supabase.from('capture_trigger_assignees').insert(rows)
          if (insErr) throw insErr
        }
      }

      closeForm()
      showToast(editing ? 'Gatilho atualizado.' : 'Gatilho criado.')
      loadAll()
    } catch (e: any) {
      console.error('[CaptacaoInteligente] save error:', e)
      setFormError(e?.message || 'Erro ao salvar gatilho.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(t: CaptureTrigger) {
    const { error } = await supabase.from('capture_triggers').update({ is_active: !t.is_active }).eq('id', t.id)
    if (error) { showToast('Erro ao atualizar gatilho.'); return }
    setTriggers(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !t.is_active } : x))
    showToast(t.is_active ? 'Gatilho pausado.' : 'Gatilho ativado.')
  }

  // "Excluir" = arquivar: some da lista, mas o histórico (hits, origem dos
  // contatos) continua aparecendo no dashboard.
  async function handleArchive() {
    if (!archiveTarget) return
    const { error } = await supabase.from('capture_triggers')
      .update({ archived_at: new Date().toISOString(), is_active: false }).eq('id', archiveTarget.id)
    if (error) { showToast('Erro ao excluir gatilho.'); return }
    setArchiveTarget(null)
    showToast('Gatilho excluído.')
    loadAll()
  }

  async function copyLink(link: string | null) {
    if (!link) return
    try { await navigator.clipboard.writeText(link); showToast('Link copiado!') }
    catch { showToast('Não foi possível copiar — selecione e copie manualmente.') }
  }

  // ── Dashboard data ──────────────────────────────────────────────────────────
  const dashRows = useMemo(() => {
    return stats
      .map(s => ({ ...s, trigger: triggers.find(t => t.id === s.trigger_id) }))
      .filter(r => r.trigger && ((r.trigger.is_active && !r.trigger.archived_at) || r.hits > 0 || r.first_touch_contacts > 0))
      .sort((a, b) => b.conversations - a.conversations || b.hits - a.hits) as (StatsRow & { trigger: CaptureTrigger })[]
  }, [stats, triggers])

  const totals = useMemo(() => dashRows.reduce((acc, r) => ({
    hits: acc.hits + r.hits,
    conversations: acc.conversations + r.conversations,
    contacts: acc.contacts + r.first_touch_contacts,
    leads: acc.leads + r.first_touch_leads,
    enrollments: acc.enrollments + r.first_touch_enrollments,
  }), { hits: 0, conversations: 0, contacts: 0, leads: 0, enrollments: 0 }), [dashRows])

  const chartConversations = dashRows.map(r => ({ name: r.trigger.name, value: r.conversations }))
  const chartConversion = dashRows
    .filter(r => r.first_touch_contacts > 0)
    .map(r => ({ name: r.trigger.name, value: Math.round((r.first_touch_enrollments / r.first_touch_contacts) * 1000) / 10 }))
    .sort((a, b) => b.value - a.value)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1e2d6b', color: 'white', fontSize: 13, fontWeight: 500,
          padding: '12px 18px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Check size={14} /> {toast}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FCE7F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={18} color="#DB2777" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Captação Inteligente</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', paddingLeft: 46 }}>
            Identifique de qual anúncio veio cada conversa do WhatsApp e direcione automaticamente
          </p>
        </div>
        {activeTab === 'triggers' && (
          <button onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#00A896', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15} /> Novo gatilho
          </button>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([
          { key: 'triggers' as const,  label: `Gatilhos (${visibleTriggers.length})` },
          { key: 'dashboard' as const, label: 'Dashboard' },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '6px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === tab.key ? '#fff' : 'transparent',
            color: activeTab === tab.key ? '#1e2d6b' : '#64748b',
            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Aba Gatilhos ───────────────────────────────────────────────────── */}
      {activeTab === 'triggers' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Gatilhos de captação</h3>
            {!loading && !schoolPhone && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#B45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={13} /> Nenhum número de WhatsApp ativo encontrado — o link wa.me só é gerado com o número conectado.
              </p>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(3)].map((_, i) => <div key={i} style={{ height: 52, borderRadius: 10, background: '#f8fafc' }} className="animate-pulse" />)}
            </div>
          ) : visibleTriggers.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FCE7F3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Megaphone size={24} color="#DB2777" />
              </div>
              <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1e2d6b' }}>Nenhum gatilho cadastrado</p>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', maxWidth: 460, marginInline: 'auto', lineHeight: 1.6 }}>
                Cadastre um gatilho para cada anúncio ou publicação. Quando o lead mandar a mensagem pré-preenchida,
                a conversa chega no WhatsApp já marcada com a campanha de origem.
              </p>
              <button onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={14} /> Cadastrar primeiro gatilho
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Gatilho', 'Texto da mensagem', 'Robô', 'Distribuição', 'Status', 'Link wa.me', ''].map(col => (
                      <th key={col} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTriggers.map((t, idx) => {
                    const ch = CAPTURE_CHANNELS[t.channel] ?? CAPTURE_CHANNELS.outro
                    const own = assignees.filter(a => a.trigger_id === t.id)
                    const link = buildWaMeLink(schoolPhone, t.trigger_text)
                    return (
                      <tr key={t.id} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa', opacity: t.is_active ? 1 : 0.65 }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                          <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: ch.bg, color: ch.color, whiteSpace: 'nowrap' }}>{ch.label}</span>
                          {t.meta_ad_ids?.length > 0 && (
                            <span style={{ display: 'inline-block', marginTop: 4, marginLeft: 4, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>
                              {t.meta_ad_ids.length} ID{t.meta_ad_ids.length > 1 ? 's' : ''} de anúncio
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                          <div title={t.trigger_text} style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{t.trigger_text}"</div>
                          {t.auto_reply && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Com resposta automática</div>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {t.skip_bot_flow ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#FEF3C7', color: '#B45309', whiteSpace: 'nowrap' }}>
                              <Bot size={11} /> Pula o robô
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#D1FAE5', color: '#059669', whiteSpace: 'nowrap' }}>
                              <Bot size={11} /> Robô normal
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#475569', maxWidth: 220 }}>
                          {!t.skip_bot_flow ? <span style={{ color: '#cbd5e1' }}>Pelo fluxo do robô</span>
                            : own.length === 0 ? <span style={{ color: '#94a3b8' }}>Fila geral</span>
                            : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {own.map(a => {
                                  const g = a.group_id ? groupById(a.group_id) : null
                                  return (
                                    <span key={a.user_id || a.group_id} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: g ? '#EDE9FE' : '#EFF6FF', color: g ? '#7C3AED' : '#2563EB', whiteSpace: 'nowrap' }}>
                                      {g ? `${g.emoji || '👥'} ${g.name}` : userName(a.user_id!)}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: t.is_active ? '#D1FAE5' : '#E2E8F0', color: t.is_active ? '#059669' : '#64748B' }}>
                            {t.is_active ? 'Ativo' : 'Pausado'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {link ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <ActionBtn onClick={() => copyLink(link)} color="#00A896" bg="#E6F7F5" icon={<Copy size={12} />} label="Copiar" />
                              <a href={link} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                                <ExternalLink size={12} /> Testar
                              </a>
                            </div>
                          ) : <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <DropdownMenu
                            isOpen={openDropdown === t.id}
                            onToggle={e => { e.stopPropagation(); setOpenDropdown(openDropdown === t.id ? null : t.id) }}
                            items={[
                              { icon: <Pencil size={13} />, label: 'Editar', onClick: () => { setOpenDropdown(null); openEdit(t) } },
                              { icon: t.is_active ? <Pause size={13} /> : <Play size={13} />, label: t.is_active ? 'Pausar' : 'Ativar', onClick: () => { setOpenDropdown(null); handleToggleActive(t) } },
                              { icon: <Trash2 size={13} />, label: 'Excluir', danger: true, onClick: () => { setOpenDropdown(null); setArchiveTarget(t) } },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Dashboard ──────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <>
          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '5px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: period === p.key ? '#fff' : 'transparent',
                color: period === p.key ? '#1e2d6b' : '#64748b',
                boxShadow: period === p.key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
              }}>
                {p.label}
              </button>
            ))}
          </div>

          {statsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
              {[...Array(5)].map((_, i) => <div key={i} style={{ height: 90, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }} className="animate-pulse" />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
              <KpiCard label="Acionamentos"          value={fmt(totals.hits)}          icon={<Zap size={18} color="#7C3AED" />}          bg="#EDE9FE" />
              <KpiCard label="Conversas"             value={fmt(totals.conversations)} icon={<MessageCircle size={18} color="#10B981" />} bg="#D1FAE5" />
              <KpiCard label="Leads (1º toque)"      value={fmt(totals.leads)}         icon={<UserPlus size={18} color="#3B82F6" />}      bg="#DBEAFE" />
              <KpiCard label="Matrículas (1º toque)" value={fmt(totals.enrollments)}   icon={<GraduationCap size={18} color="#00A896" />} bg="#E6F7F5" />
              <KpiCard label="Conversão geral"       value={pct(totals.enrollments, totals.contacts)} icon={<TrendingUp size={18} color="#D97706" />} bg="#FEF3C7" />
            </div>
          )}

          {!statsLoading && dashRows.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1e2d6b' }}>Sem dados no período</p>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Nenhum gatilho ativo ou acionado nos últimos {PERIODS.find(p => p.key === period)?.label}.</p>
            </div>
          ) : !statsLoading && (
            <>
              {/* Comparação lado a lado — duas medidas de escala diferente,
                  então dois gráficos separados (nunca eixo duplo). */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                <ChartCard title="Conversas por gatilho" icon={<MessageCircle size={16} color="#10B981" style={{ marginRight: 6 }} />}>
                  <HBarChart data={chartConversations} unit="" />
                </ChartCard>
                <ChartCard title="Conversão contato → matrícula (1º toque)" icon={<TrendingUp size={16} color="#D97706" style={{ marginRight: 6 }} />}>
                  {chartConversion.length === 0
                    ? <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>Nenhum contato captado no período.</p>
                    : <HBarChart data={chartConversion} unit="%" />}
                </ChartCard>
              </div>

              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Comparação entre gatilhos</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                    Acionamentos e conversas contam todo match no período. Contatos, leads e matrículas usam o
                    <strong> primeiro toque</strong> — cada contato conta só para o gatilho que o trouxe primeiro, então a soma entre campanhas nunca passa do total real.
                  </p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Gatilho', 'Acionamentos', 'Conversas', 'Contatos', 'Leads', 'Matrículas', 'Contato → Lead', 'Lead → Matrícula', '1ª resposta'].map(col => (
                          <th key={col} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: col === 'Gatilho' ? 'left' : 'right', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dashRows.map((r, idx) => {
                        const ch = CAPTURE_CHANNELS[r.trigger.channel] ?? CAPTURE_CHANNELS.outro
                        const num: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: '#1e293b', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
                        return (
                          <tr key={r.trigger_id} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                                {r.trigger.name}
                                {r.trigger.archived_at && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>(excluído)</span>}
                                {!r.trigger.archived_at && !r.trigger.is_active && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>(pausado)</span>}
                              </div>
                              <span style={{ display: 'inline-block', marginTop: 3, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: ch.bg, color: ch.color }}>{ch.label}</span>
                            </td>
                            <td style={num}>{fmt(r.hits)}</td>
                            <td style={num}>{fmt(r.conversations)}</td>
                            <td style={num}>{fmt(r.first_touch_contacts)}</td>
                            <td style={num}>{fmt(r.first_touch_leads)}</td>
                            <td style={{ ...num, fontWeight: 700, color: '#00A896' }}>{fmt(r.first_touch_enrollments)}</td>
                            <td style={num}>{pct(r.first_touch_leads, r.first_touch_contacts)}</td>
                            <td style={num}>{pct(r.first_touch_enrollments, r.first_touch_leads)}</td>
                            <td style={num} title={r.responded_entries ? `Média de ${r.responded_entries} atendimento(s) respondido(s)` : 'Nenhum atendimento respondido ainda'}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} color="#94a3b8" /> {formatDuration(r.avg_first_response_seconds)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Modal: criar/editar gatilho ────────────────────────────────────── */}
      {showModal && (
        <Modal onClose={closeForm} title={editing ? 'Editar gatilho' : 'Novo gatilho de captação'} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nome da campanha <span style={{ color: '#F43F5E' }}>*</span></label>
              <input style={inputStyle} placeholder="ex: Matrículas 2027 — Infantil (Instagram)" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>

            <div>
              <label style={labelStyle}>Canal</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(CAPTURE_CHANNELS) as CaptureChannel[]).map(c => {
                  const cfg = CAPTURE_CHANNELS[c]
                  const sel = form.channel === c
                  return (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, channel: c }))}
                      style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${sel ? cfg.color : '#E2E8F0'}`, background: sel ? cfg.bg : '#fff', color: sel ? cfg.color : '#64748B' }}>
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Texto da mensagem pré-preenchida <span style={{ color: '#F43F5E' }}>*</span></label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2}
                placeholder="ex: Olá! Vi o anúncio e quero saber sobre matrícula no Infantil"
                value={form.triggerText} onChange={e => setForm(f => ({ ...f, triggerText: e.target.value }))} />
              <p style={hintStyle}>
                A conversa é identificada quando a mensagem do lead <strong>contém</strong> este texto (sem diferenciar maiúsculas nem acentos).
                Use exatamente o mesmo texto do anúncio — de preferência copiando o link gerado abaixo.
                {form.triggerText.trim().length > 0 && form.triggerText.trim().length < CAPTURE_TEXT_MIN && (
                  <span style={{ color: '#DC2626' }}> Mínimo {CAPTURE_TEXT_MIN} caracteres.</span>
                )}
              </p>
              {overlapping.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                  <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                    Este texto se sobrepõe a: {overlapping.map(o => `"${o.name}"`).join(', ')}. Quando os dois batem, vale o gatilho de texto mais longo.
                  </span>
                </div>
              )}
            </div>

            {/* Link wa.me gerado */}
            <div style={{ background: '#F0FDFB', border: '1px solid #D1FAE5', borderRadius: 12, padding: '12px 14px' }}>
              <label style={{ ...labelStyle, color: '#007A6E' }}>Link para o anúncio</label>
              {formLink && form.triggerText.trim() ? (
                <>
                  <div style={{ fontSize: 12, color: '#1e293b', fontFamily: 'monospace', wordBreak: 'break-all', background: '#fff', border: '1px solid #D1FAE5', borderRadius: 8, padding: '8px 10px' }}>{formLink}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <ActionBtn onClick={() => copyLink(formLink)} color="#00A896" bg="#E6F7F5" icon={<Copy size={12} />} label="Copiar link" />
                    <a href={formLink} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                      <ExternalLink size={12} /> Testar
                    </a>
                  </div>
                  <p style={hintStyle}>Cole este link como destino do anúncio — o texto já vai codificado, sem risco de erro de digitação.</p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                  {schoolPhone ? 'Preencha o texto da mensagem para gerar o link.' : 'Conecte um número de WhatsApp para gerar o link.'}
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>IDs de anúncio da Meta (opcional)</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }} rows={2}
                placeholder="Um por linha — ex: 120212345678900123"
                value={form.metaAdIds} onChange={e => setForm(f => ({ ...f, metaAdIds: e.target.value }))} />
              <p style={hintStyle}>
                Em anúncios "Clique para WhatsApp", a Meta informa o ID do anúncio junto com a mensagem. Quando ele bate,
                a identificação é garantida mesmo que o lead altere o texto.
              </p>
            </div>

            <div>
              <label style={labelStyle}>Resposta automática (opcional)</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3}
                placeholder="ex: Oi! Que bom que você se interessou pelo Infantil 😊 Em instantes uma de nossas consultoras vai te atender."
                value={form.autoReply} onChange={e => setForm(f => ({ ...f, autoReply: e.target.value }))} />
              <p style={hintStyle}>Enviada só no início de um atendimento — nunca no meio de uma conversa já em andamento.</p>
            </div>

            <div>
              <label style={labelStyle}>Etiqueta de origem</label>
              <input style={inputStyle} placeholder={form.name.trim() || 'Mesmo nome da campanha'} value={form.tagName}
                onChange={e => setForm(f => ({ ...f, tagName: e.target.value }))} />
              <p style={hintStyle}>Aplicada no contato e na conversa — permite filtrar a lista de Contatos por origem.</p>
            </div>

            {/* Pular robô + distribuição */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" style={{ marginTop: 3 }} checked={form.skipBot}
                  onChange={e => setForm(f => ({ ...f, skipBot: e.target.checked }))} />
                <span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Pular o robô de atendimento</span>
                  <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.5 }}>
                    A conversa não passa pelo fluxo do robô e vai direto para os atendentes escolhidos abaixo
                    (ou para a fila geral, se ninguém for escolhido). O atendente vê o aviso "Robô não ativado — Captação Inteligente".
                  </span>
                </span>
              </label>

              <div style={{ marginTop: 12, opacity: form.skipBot ? 1 : 0.5, pointerEvents: form.skipBot ? 'auto' : 'none' }}>
                <label style={labelStyle}>Distribuir para (round-robin)</label>
                {!form.skipBot && <p style={{ ...hintStyle, marginTop: 0, marginBottom: 6 }}>Com o robô ativo, quem define o atendente é o próprio fluxo do robô.</p>}
                {groups.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {groups.map(g => {
                      const sel = form.groupIds.includes(g.id)
                      return (
                        <button key={g.id} type="button" onClick={() => setForm(f => ({ ...f, groupIds: toggleIn(f.groupIds, g.id) }))}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${sel ? '#7C3AED' : '#E2E8F0'}`, background: sel ? '#EDE9FE' : '#fff', color: sel ? '#7C3AED' : '#64748B' }}>
                          {g.emoji || <Users size={12} />} {g.name}
                          <span style={{ fontSize: 10, opacity: 0.7 }}>({g.member_ids?.length || 0})</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 9, padding: 4 }}>
                  {users.length === 0 ? (
                    <p style={{ margin: 0, padding: 8, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Nenhum atendente ativo.</p>
                  ) : users.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: '#334155' }}>
                      <input type="checkbox" checked={form.userIds.includes(u.id)}
                        onChange={() => setForm(f => ({ ...f, userIds: toggleIn(f.userIds, u.id) }))} />
                      {u.full_name}
                    </label>
                  ))}
                </div>
                <p style={hintStyle}>Só recebe quem estiver disponível e fora do horário de almoço. Membros de grupos entram na mesma fila, sem repetição.</p>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              Gatilho ativo
            </label>

            {formError && <p style={{ margin: 0, fontSize: 13, color: '#DC2626', background: '#FFF5F5', padding: '8px 12px', borderRadius: 8 }}>{formError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeForm} style={{ flex: 1, padding: '12px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, color: '#64748B', cursor: 'pointer', fontWeight: 500, minHeight: 48 }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', borderRadius: 9, border: 'none', background: '#00A896', color: 'white', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', minHeight: 48, opacity: saving ? 0.7 : 1 }}>
                {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar gatilho'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: excluir (arquivar) ──────────────────────────────────────── */}
      {archiveTarget && (
        <Modal onClose={() => setArchiveTarget(null)} title="Excluir gatilho">
          <p style={{ margin: '0 0 8px', fontSize: 14, color: '#334155' }}>
            Excluir o gatilho <strong>"{archiveTarget.name}"</strong>? Novas mensagens deixam de ser identificadas por ele.
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>
            O histórico continua no dashboard e as etiquetas já aplicadas nos contatos são mantidas.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setArchiveTarget(null)} style={{ flex: 1, padding: '12px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, color: '#64748B', cursor: 'pointer', minHeight: 48 }}>Cancelar</button>
            <button onClick={handleArchive} style={{ flex: 1, padding: '12px', borderRadius: 9, border: 'none', background: '#DC2626', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 48 }}>Excluir</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Subcomponents (mesmo visual de GestorTransfers) ────────────────────────
function KpiCard({ label, value, icon, bg }: { label: string; value: string; icon: React.ReactNode; bg: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#1e2d6b', lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}

function ActionBtn({ onClick, color, bg, icon, label }: { onClick: () => void; color: string; bg: string; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: bg, color, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
      {icon} {label}
    </button>
  )
}

interface DropdownItem { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }

function DropdownMenu({ isOpen, onToggle, items }: { isOpen: boolean; onToggle: (e: React.MouseEvent) => void; items: DropdownItem[] }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: isOpen ? '#f8fafc' : '#fff', cursor: 'pointer', color: '#64748b' }}>
        <MoreHorizontal size={14} />
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute', right: 0, top: 34, zIndex: 200,
          background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 170, overflow: 'hidden',
        }} onClick={e => e.stopPropagation()}>
          {items.map((item, i) => (
            <button key={i} onClick={item.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 14px',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                color: item.danger ? '#dc2626' : '#1e293b', fontWeight: 500,
                borderTop: i > 0 ? '1px solid #f8fafc' : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = item.danger ? '#fef2f2' : '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: wide ? 680 : 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px', display: 'flex', alignItems: 'center' }}>{icon}{title}</h3>
      {children}
    </div>
  )
}

// Barras horizontais de série única (magnitude → uma cor só, sem legenda — o
// título nomeia a série). Valor visível na ponta de cada barra: o teal da
// marca tem contraste < 3:1 contra o fundo branco, então a leitura não pode
// depender só da barra.
function HBarChart({ data, unit }: { data: { name: string; value: number }[]; unit: string }) {
  const height = Math.max(120, data.length * 36 + 24)
  const fmtVal = (v: number) => `${v.toLocaleString('pt-BR')}${unit}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap={10}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={unit === '%'} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: '#F0FDFB' }}
          contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
          formatter={(v: any) => [fmtVal(Number(v)), unit === '%' ? 'Conversão' : 'Conversas']}
        />
        <Bar dataKey="value" fill="#00A896" radius={[0, 4, 4, 0]} maxBarSize={18}>
          <LabelList dataKey="value" position="right" formatter={(v: any) => fmtVal(Number(v))} style={{ fontSize: 11, fontWeight: 600, fill: '#475569' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
