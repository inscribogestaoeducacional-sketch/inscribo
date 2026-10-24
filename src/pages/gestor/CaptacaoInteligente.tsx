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
  Copy, ExternalLink, X, Check, 
  Users, AlertTriangle, 
  Loader2, Store,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import CaptacaoOverview from '../../components/captacao/CaptacaoOverview'
import { useActiveCampaign } from '../../lib/activeCampaign'
import {
  type CaptureTrigger, type CaptureChannel, CAPTURE_CHANNELS, CAPTURE_TEXT_MIN,
  buildWaMeLink, findOverlappingTriggers,
} from '../../lib/captureTriggers'

// ─── types ────────────────────────────────────────────────────────────────────
interface Assignee { trigger_id: string; user_id: string | null; group_id: string | null }
interface SchoolUser { id: string; full_name: string }
interface SchoolGroup { id: string; name: string; emoji: string | null; member_ids: string[] | null }

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


export default function CaptacaoInteligente() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!

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
  const [toast, setToast]           = useState<string | null>(null)

  const campaign = useActiveCampaign(institutionId)
  const [reloadKey, setReloadKey] = useState(0)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

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

  useEffect(() => { loadAll() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleTriggers = triggers.filter(t => !t.archived_at)
  const userName  = (id: string) => users.find(u => u.id === id)?.full_name || 'Usuário'

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

  // Gatilho criado por um bloco da Vitrine: nome/texto/canal/exclusão só pela
  // Vitrine (o banco recusa — capture_triggers_managed_guard).
  const managedByVitrine = editing?.managed_by === 'vitrine'

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
      loadAll(); setReloadKey(k => k + 1)
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
    setReloadKey(k => k + 1)
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
    loadAll(); setReloadKey(k => k + 1)
  }

  async function copyLink(link: string | null) {
    if (!link) return
    try { await navigator.clipboard.writeText(link); showToast('Link copiado!') }
    catch { showToast('Não foi possível copiar — selecione e copie manualmente.') }
  }

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

      <CaptacaoOverview
        institutionId={institutionId}
        triggers={visibleTriggers}
        allTriggers={triggers}
        assignees={assignees}
        groups={groups}
        userName={userName}
        schoolPhone={schoolPhone}
        loading={loading}
        campaign={campaign}
        reloadKey={reloadKey}
        onNew={openNew}
        onEdit={openEdit}
        onToggle={handleToggleActive}
        onArchive={t => setArchiveTarget(t)}
        onCopy={copyLink}
      />

      {/* ── Modal: criar/editar gatilho ────────────────────────────────────── */}
      {showModal && (
        <Modal onClose={closeForm} title={editing ? 'Editar gatilho' : 'Novo gatilho de captação'} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {managedByVitrine && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 10, fontSize: 12, color: '#0F766E', lineHeight: 1.5 }}>
                <Store size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  Este gatilho é de um botão da <Link to="/vitrine" style={{ color: '#0F766E', fontWeight: 700 }}>Vitrine</Link>: nome e texto
                  acompanham o bloco e só mudam por lá. Aqui dá pra ajustar resposta automática, robô e distribuição.
                </span>
              </div>
            )}
            <div>
              <label style={labelStyle}>Nome da campanha <span style={{ color: '#F43F5E' }}>*</span></label>
              <input style={{ ...inputStyle, ...(managedByVitrine ? { color: '#64748b', cursor: 'not-allowed' } : {}) }}
                placeholder="ex: Matrículas 2027 — Infantil (Instagram)" value={form.name} disabled={managedByVitrine}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus={!managedByVitrine} />
            </div>

            {!managedByVitrine && <div>
              <label style={labelStyle}>Canal</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(CAPTURE_CHANNELS) as CaptureChannel[]).filter(c => c !== 'vitrine').map(c => {
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
            </div>}

            <div>
              <label style={labelStyle}>Texto da mensagem pré-preenchida <span style={{ color: '#F43F5E' }}>*</span></label>
              <textarea style={{ ...inputStyle, resize: 'vertical', ...(managedByVitrine ? { color: '#64748b', cursor: 'not-allowed' } : {}) }} rows={2}
                placeholder="ex: Olá! Vi o anúncio e quero saber sobre matrícula no Infantil" disabled={managedByVitrine}
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
              <label style={{ ...labelStyle, color: '#00695F' }}>Link para o anúncio</label>
              {formLink && form.triggerText.trim() ? (
                <>
                  <div style={{ fontSize: 12, color: '#1e293b', fontFamily: 'monospace', wordBreak: 'break-all', background: '#fff', border: '1px solid #D1FAE5', borderRadius: 8, padding: '8px 10px' }}>{formLink}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <ActionBtn onClick={() => copyLink(formLink)} color="#05907B" bg="#E6F7F5" icon={<Copy size={12} />} label="Copiar link" />
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
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', borderRadius: 9, border: 'none', background: '#05907B', color: 'white', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', minHeight: 48, opacity: saving ? 0.7 : 1 }}>
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
function ActionBtn({ onClick, color, bg, icon, label }: { onClick: () => void; color: string; bg: string; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: bg, color, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
      {icon} {label}
    </button>
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

// Barras horizontais de série única (magnitude → uma cor só, sem legenda — o
// título nomeia a série). Valor visível na ponta de cada barra: o teal da
// marca tem contraste < 3:1 contra o fundo branco, então a leitura não pode
// depender só da barra.