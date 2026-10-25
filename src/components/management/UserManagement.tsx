import PageHeader from '../ui/PageHeader'
import HeaderAction from '../mobile/HeaderAction'
import StatStrip, { cardBtn } from '../mobile/StatStrip'
import { PillTabs } from '../mobile/PillTabs'
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions, DEFAULT_OFF_MODULES } from '../../contexts/PermissionsContext'
import { supabase } from '../../lib/supabase'
import { sendEmail } from '../../lib/email'
import {
  UsersRound, Users, Plus, Edit, Shield, UserCheck, Search, Mail, Calendar, CheckCircle, XCircle, Key,
  Building2, AlertTriangle, Loader2, RefreshCw, UserX, Power,
} from 'lucide-react'
import {
  PERM_MODULES, UserModal, PasswordModal, ConfirmRemoveModal, BlockedRemovalModal, RemovedUsersSection,
  Avatar, RoleBadge, UserCss, useIsMobile, type AppUser,
} from './users/UserModals'

export default function UserManagement() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { refreshPermissions } = usePermissions()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [pwdUser, setPwdUser] = useState<AppUser | null>(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const isMobile = useIsMobile()
  const [confirmRemove, setConfirmRemove] = useState<AppUser | null>(null)
  const [removing, setRemoving] = useState(false)

  // Vínculos desativados (user_institutions.active=false) desta instituição —
  // "removido da escola" agora é reversível, então precisa de um jeito de
  // achar e reativar quem foi removido por engano ou voltou a trabalhar aqui.
  const [removedLinks, setRemovedLinks] = useState<{ user_id: string; full_name: string; email: string }[]>([])
  const [showRemoved, setShowRemoved] = useState(false)
  // Bloqueio de remoção por lead/conversa em aberto — ver
  // deactivate_user_institution_link (migration 20260922000000).
  const [blockedRemoval, setBlockedRemoval] = useState<{ user: AppUser; pendingLeads: number; pendingConversations: number } | null>(null)

  useEffect(() => { loadUsers(); loadRemovedLinks() }, [user])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const loadUsers = async () => {
    if (!user?.institution_id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('institution_id', user.institution_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const isConsultor = (role: string) => role !== 'admin' && role !== 'manager'

  const handleSave = async (formData: any) => {
    const { permissions, ...userData } = formData
    if (editingUser) {
      const { error } = await supabase
        .from('users')
        .update({ full_name: userData.full_name, active: userData.active })
        .eq('id', editingUser.id)
      if (error) throw error

      // role/can_see_all_conversations/can_see_full_history agora vivem no
      // vínculo (user_institutions), não em users direto — users.role e os
      // demais são só um CACHE do vínculo ativo, mantido pelo trigger de
      // sync da Fase 1. Todo usuário listado aqui está, por definição, com
      // esta instituição como ativa agora (loadUsers filtra por
      // users.institution_id), então este é sempre o vínculo certo.
      const { error: linkError } = await supabase
        .from('user_institutions')
        .update({
          role: userData.role,
          can_see_all_conversations: !!userData.can_see_all_conversations,
          can_see_full_history: !!userData.can_see_full_history,
        })
        .eq('user_id', editingUser.id)
        .eq('institution_id', user!.institution_id)
      if (linkError) throw linkError

      if (isConsultor(userData.role) && permissions) {
        const rows = PERM_MODULES.map(m => ({
          institution_id: user!.institution_id,
          user_id: editingUser.id,
          module: m.id,
          enabled: permissions[m.id] ?? !DEFAULT_OFF_MODULES.includes(m.id),
        }))
        const { error: permErr } = await supabase
          .from('user_permissions')
          .upsert(rows, { onConflict: 'user_id,institution_id,module' })
        if (permErr) throw permErr
        if (editingUser.id === user?.id) await refreshPermissions()
      }

      showToast('Usuário atualizado com sucesso!')
    } else {
      // Cria via edge function (service role) em vez de supabase.auth.signUp()
      // client-side: signUp() autentica automaticamente quem chamou na sessão
      // do usuário recém-criado, podendo trocar a sessão ativa deste admin
      // sem aviso. create-user roda no servidor e nunca toca na sessão do
      // navegador que fez a chamada.
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: userData.email,
            password: userData.password,
            full_name: userData.full_name,
            role: userData.role,
            user_type: 'school_user',
            institution_id: user!.institution_id,
            active: userData.active,
            can_see_all_conversations: !!userData.can_see_all_conversations,
            can_see_full_history: !!userData.can_see_full_history,
          }),
        }
      )
      const fnData = await res.json()
      if (!res.ok || fnData?.error) {
        throw new Error(fnData?.error || 'Erro ao criar usuário')
      }
      const newUserId = fnData.user_id
      // create-user faz cadastro inteligente: se o e-mail já tinha conta,
      // não cria de novo — só adiciona o vínculo com esta instituição
      // (created: false). Muda qual e-mail é disparado a seguir.
      const wasCreated = fnData.created !== false

      if (isConsultor(userData.role) && permissions) {
        const rows = PERM_MODULES.map(m => ({
          institution_id: user!.institution_id,
          user_id: newUserId,
          module: m.id,
          enabled: permissions[m.id] ?? !DEFAULT_OFF_MODULES.includes(m.id),
        }))
        await supabase.from('user_permissions').upsert(rows, { onConflict: 'user_id,institution_id,module' })
      }

      if (wasCreated) {
        await sendEmail('atendente_welcome', userData.email, {
          user_name: userData.full_name,
          email: userData.email,
          temp_password: userData.password,
          school_name: user?.institution_name || '',
          login_url: `${window.location.origin}/login`,
        })
        showToast('Usuário criado! Um e-mail com os dados de acesso foi enviado.')
      } else {
        await sendEmail('added_to_institution', userData.email, {
          user_name: userData.full_name,
          email: userData.email,
          school_name: user?.institution_name || '',
          login_url: `${window.location.origin}/login`,
        })
        showToast('Esse e-mail já tinha conta — vínculo com a equipe adicionado! E-mail de aviso enviado.')
      }
    }
    setEditingUser(null)
    await loadUsers()
  }

  const handleToggle = async (userId: string, current: boolean) => {
    const { error } = await supabase.from('users').update({ active: !current }).eq('id', userId)
    if (error) return showToast('Erro ao atualizar status', false)
    showToast(!current ? 'Usuário ativado' : 'Usuário desativado')
    await loadUsers()
  }

  const loadRemovedLinks = async () => {
    if (!user?.institution_id) return
    // RPC (não select direto): a RLS de `users` só libera a linha se
    // users.institution_id (cache da instituição ATIVA) bater com a do admin
    // — um removido com outro vínculo ativo em outra escola já não bate mais,
    // e um join direto voltaria nome/e-mail nulos. Ver migration 20260922000000.
    const { data } = await supabase.rpc('list_institution_removed_users', { p_institution_id: user.institution_id })
    setRemovedLinks((data || []).map((r: any) => ({
      user_id: r.user_id,
      full_name: r.full_name || '—',
      email: r.email || '',
    })))
  }

  // "Excluir" virou "remover desta escola": desativa o vínculo em
  // user_institutions (reversível) em vez de apagar a linha de users — que
  // além de quebrar por causa das várias FKs sem ON DELETE apontando pra
  // users(id) (leads, comissões, mensagens...), apagaria o acesso do usuário
  // a QUALQUER outra instituição onde ele também tem vínculo. A checagem de
  // lead/conversa em aberto e a própria desativação acontecem atomicamente
  // no servidor (deactivate_user_institution_link) — ver migration
  // 20260922000000.
  const handleRemoveFromInstitution = (u: AppUser) => setConfirmRemove(u)

  const doRemove = async () => {
    const u = confirmRemove
    if (!u) return
    setRemoving(true)
    const { data, error } = await supabase.rpc('deactivate_user_institution_link', {
      p_user_id: u.id,
      p_institution_id: user!.institution_id,
    })
    setRemoving(false)
    setConfirmRemove(null)
    if (error) return showToast(error.message || 'Erro ao remover usuário', false)
    const result = Array.isArray(data) ? data[0] : data
    if (!result?.success) {
      setBlockedRemoval({ user: u, pendingLeads: result?.pending_leads || 0, pendingConversations: result?.pending_conversations || 0 })
      return
    }
    showToast('Usuário removido desta escola')
    await loadUsers()
    await loadRemovedLinks()
  }

  const handleReactivateLink = async (userId: string) => {
    const { error } = await supabase
      .from('user_institutions')
      .update({ active: true })
      .eq('user_id', userId)
      .eq('institution_id', user!.institution_id)
    if (error) return showToast('Erro ao reativar usuário', false)
    showToast('Usuário reativado nesta escola')
    await loadUsers()
    await loadRemovedLinks()
  }

  const filtered = users.filter(u => {
    const s = search.toLowerCase()
    return (
      (!search || u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)) &&
      (!filterRole || u.role === filterRole) &&
      (!filterStatus || (filterStatus === 'active' ? u.active : !u.active))
    )
  })

  const stats = {
    total: users.length,
    active: users.filter(u => u.active).length,
    admins: users.filter(u => u.role === 'admin').length,
    managers: users.filter(u => u.role === 'manager').length,
  }
  const consultants = users.filter(u => u.role !== 'admin' && u.role !== 'manager').length
  const inactive = users.length - stats.active
  const schoolName = user?.institution_name || user?.institution_id || '—'

  const openNew = () => { setEditingUser(null); setShowModal(true) }
  const openEdit = (u: AppUser) => { setEditingUser(u); setShowModal(true) }
  const openPwd = (u: AppUser) => { setPwdUser(u); setShowPwdModal(true) }

  const statItems = [
    { label: 'Total', value: stats.total, sub: 'usuários cadastrados', color: '#3B82F6', icon: Users },
    { label: 'Ativos', value: stats.active, sub: 'com acesso liberado', color: '#16A34A', icon: CheckCircle },
    { label: 'Admins', value: stats.admins, sub: 'acesso total', color: '#DC2626', icon: Shield },
    { label: 'Gestores', value: stats.managers, sub: 'acompanham os números', color: '#8B5CF6', icon: UserCheck },
  ]

  const toastEl = toast && (
    <div role="status" style={isMobile
      ? { position: 'fixed', bottom: 90, left: 16, right: 16, margin: '0 auto', width: 'fit-content', maxWidth: 'calc(100% - 32px)', background: toast.ok ? '#1A2B4A' : '#DC2626', color: 'white', padding: '12px 18px', borderRadius: 14, fontSize: 13, fontWeight: 600, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }
      : { position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.ok ? '#1A2B4A' : '#DC2626', color: 'white', fontSize: 13, fontWeight: 500, padding: '12px 18px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
      {toast.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}{toast.msg}
    </div>
  )

  const modals = (
    <>
      <UserModal isOpen={showModal} onClose={() => { setShowModal(false); setEditingUser(null) }} onSave={handleSave} editingUser={editingUser} institutionId={user?.institution_id} />
      <PasswordModal isOpen={showPwdModal} onClose={() => { setShowPwdModal(false); setPwdUser(null) }} targetUser={pwdUser} />
      <ConfirmRemoveModal user={confirmRemove} loading={removing} onClose={() => setConfirmRemove(null)} onConfirm={doRemove} />
      <BlockedRemovalModal
        info={blockedRemoval}
        onClose={() => setBlockedRemoval(null)}
        onGoToLeads={() => { const id = blockedRemoval?.user.id; setBlockedRemoval(null); if (id) navigate(`/leads?owner=${id}`) }}
        onGoToWhatsApp={() => { setBlockedRemoval(null); navigate('/whatsapp') }}
      />
    </>
  )

  const emptyState = (
    <div style={{ padding: isMobile ? '36px 20px' : '48px 24px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Users size={24} color="#05907B" />
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>{users.length === 0 ? 'Nenhum usuário cadastrado' : 'Nenhum resultado encontrado'}</p>
      <p style={{ margin: '0 auto', fontSize: 13, color: '#64748b', maxWidth: 360, lineHeight: 1.6 }}>
        {users.length === 0 ? 'Crie o primeiro acesso para a sua equipe começar a usar o sistema.' : 'Tente mudar a busca ou os filtros.'}
      </p>
      {users.length === 0 ? (
        <button onClick={openNew} className="aion-tap" style={cardBtn('primary', { flex: '0 0 auto', marginTop: 18, padding: '10px 22px', display: 'inline-flex', alignItems: 'center', gap: 6 })}><Plus size={15} /> Novo usuário</button>
      ) : (
        <button onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus('') }} className="aion-tap" style={cardBtn('ghost', { flex: '0 0 auto', marginTop: 18, padding: '10px 22px' })}>Limpar filtros</button>
      )}
    </div>
  )

  // ─── MOBILE ───────────────────────────────────────────────
  if (isMobile) {
    const chip = (on: boolean): React.CSSProperties => ({
      flexShrink: 0, minHeight: 36, padding: '6px 14px', borderRadius: 999, fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
      border: `1px solid ${on ? '#05907B' : '#E3E8F0'}`, background: on ? '#E6F7F5' : '#fff', color: on ? '#00695F' : '#5B6B86',
    })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#F5FAF9' }}>
        <UserCss />
        {toastEl}

        <div style={{ padding: '12px 12px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PageHeader compact icon={UsersRound} title="Usuários" subtitle={`${stats.active} ativo${stats.active !== 1 ? 's' : ''} de ${stats.total}`}
            actions={<>
              <HeaderAction primary icon={Plus} label="Novo usuário" onClick={openNew} />
              <HeaderAction icon={RefreshCw} label="Atualizar" onClick={() => { loadUsers(); loadRemovedLinks() }} />
            </>} />

          <StatStrip items={statItems} />

          <div style={{ position: 'relative' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input aria-label="Buscar usuário" placeholder="Buscar por nome ou e-mail" value={search} onChange={e => setSearch(e.target.value)} className="um-in"
              style={{ paddingLeft: 40, height: 46, fontSize: 16, borderRadius: 14, boxShadow: '0 1px 2px rgba(26,43,74,.04)' }} />
          </div>

          <PillTabs value={filterRole} onChange={setFilterRole}
            tabs={[['', `Todos (${stats.total})`], ['admin', `Admins (${stats.admins})`], ['manager', `Gestores (${stats.managers})`], ['user', `Consultores (${consultants})`]]} />

          <div className="aion-hscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -12px', padding: '0 12px' }}>
            <button type="button" className="aion-tap" style={chip(filterStatus === '')} onClick={() => setFilterStatus('')}>Qualquer situação</button>
            <button type="button" className="aion-tap" style={chip(filterStatus === 'active')} onClick={() => setFilterStatus('active')}>Ativos ({stats.active})</button>
            <button type="button" className="aion-tap" style={chip(filterStatus === 'inactive')} onClick={() => setFilterStatus('inactive')}>Inativos ({inactive})</button>
          </div>

          {loading ? (
            [0, 1, 2].map(i => <div key={i} className="um-sk" style={{ height: 150, borderRadius: 18, background: '#fff', border: '1px solid #E3E8F0' }} />)
          ) : filtered.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E3E8F0' }}>{emptyState}</div>
          ) : filtered.map(u => (
            <div key={u.id} className="ld-card" style={{ padding: 14, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 18, boxShadow: '0 1px 2px rgba(26,43,74,.04)', opacity: u.active ? 1 : 0.8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={u.full_name} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0, overflowWrap: 'anywhere', lineHeight: 1.25 }}>
                    {u.full_name}{u.id === user?.id && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: '#00695F', background: '#E6F7F5', borderRadius: 999, padding: '1px 8px', verticalAlign: 'middle' }}>você</span>}
                  </p>
                  <p style={{ fontSize: 12.5, color: '#5B6B86', margin: '3px 0 0', display: 'flex', alignItems: 'flex-start', gap: 5, overflowWrap: 'anywhere', lineHeight: 1.3 }}><Mail size={12} style={{ flexShrink: 0, marginTop: 2 }} />{u.email}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0' }}>
                <RoleBadge role={u.role} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: u.active ? '#D1FAE5' : '#FEE2E2', color: u.active ? '#16a34a' : '#DC2626' }}>
                  {u.active ? <><CheckCircle size={11} />Ativo</> : <><XCircle size={11} />Inativo</>}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: '#5B6B86', marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={13} color="#94A3B8" />{schoolName}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={13} color="#94A3B8" />Cadastrado em {new Date(u.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => openEdit(u)} className="aion-tap" style={cardBtn('primary', { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}><Edit size={15} />Editar</button>
                <button onClick={() => openPwd(u)} className="aion-tap" style={cardBtn('ghost', { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}><Key size={15} />Senha</button>
                <button onClick={() => handleToggle(u.id, u.active)} className="aion-tap" style={cardBtn('ghost', { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}><Power size={15} />{u.active ? 'Desativar' : 'Ativar'}</button>
                <button onClick={() => handleRemoveFromInstitution(u)} className="aion-tap" style={cardBtn('danger', { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 })}><UserX size={15} />Remover</button>
              </div>
            </div>
          ))}

          <RemovedUsersSection removedLinks={removedLinks} show={showRemoved} onToggle={() => setShowRemoved(v => !v)} onReactivate={handleReactivateLink} />
        </div>

        {modals}
      </div>
    )
  }

  // ─── COMPUTADOR ───────────────────────────────────────────
  const seg = (on: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    background: on ? '#fff' : 'transparent', color: on ? '#1A2B4A' : '#64748b', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
  })
  const segWrap: React.CSSProperties = { display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4 }
  const actBtn = (color: string, bg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: bg, color, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })

  return (
    <div style={{ padding: 24, minHeight: '100%', background: '#F5FAF9', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <UserCss />
      {toastEl}

      <PageHeader icon={UsersRound} title="Usuários" subtitle="Controle de acesso e permissões da equipe"
        actions={<>
          <button onClick={() => { loadUsers(); loadRemovedLinks() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.14)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 12, border: 'none', background: '#fff', color: '#00695F', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 18px -10px rgba(0,0,0,.45)' }}>
            <Plus size={15} /> Novo usuário
          </button>
        </>} />

      <StatStrip items={statItems} />

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0, marginRight: 'auto' }}>Equipe da escola <span style={{ color: '#94a3b8', fontWeight: 600 }}>({filtered.length})</span></h3>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input aria-label="Buscar usuário" placeholder="Buscar por nome ou e-mail" value={search} onChange={e => setSearch(e.target.value)} className="um-in" style={{ paddingLeft: 34, height: 38, fontSize: 13, borderRadius: 10 }} />
          </div>
          <div style={segWrap}>
            {([['', 'Todos'], ['admin', 'Admins'], ['manager', 'Gestores'], ['user', 'Consultores']] as const).map(([id, l]) => (
              <button key={id} onClick={() => setFilterRole(id)} style={seg(filterRole === id)}>{l}</button>
            ))}
          </div>
          <div style={segWrap}>
            {([['', 'Todos'], ['active', 'Ativos'], ['inactive', 'Inativos']] as const).map(([id, l]) => (
              <button key={id} onClick={() => setFilterStatus(id)} style={seg(filterStatus === id)}>{l}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3].map(i => <div key={i} className="um-sk" style={{ height: 52, borderRadius: 10, background: '#f8fafc' }} />)}
          </div>
        ) : filtered.length === 0 ? emptyState : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Usuário', 'Perfil', 'Instituição', 'Status', 'Cadastrado em', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', opacity: u.active ? 1 : 0.75 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={u.full_name} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{u.full_name}{u.id === user?.id && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#00695F', background: '#E6F7F5', borderRadius: 999, padding: '1px 7px' }}>você</span>}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Mail size={10} />{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={12} color="#94A3B8" />{schoolName}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => handleToggle(u.id, u.active)} title={u.active ? 'Clique para desativar' : 'Clique para ativar'}
                        style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: u.active ? '#D1FAE5' : '#FEE2E2', color: u.active ? '#16a34a' : '#DC2626', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {u.active ? <><CheckCircle size={11} />Ativo</> : <><XCircle size={11} />Inativo</>}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />{new Date(u.created_at).toLocaleDateString('pt-BR')}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(u)} title="Editar" style={actBtn('#1D4ED8', '#EFF6FF')}><Edit size={12} />Editar</button>
                        <button onClick={() => openPwd(u)} title="Redefinir senha" style={actBtn('#7C3AED', '#F5F3FF')}><Key size={12} />Senha</button>
                        <button onClick={() => handleRemoveFromInstitution(u)} title="Remover desta escola" style={actBtn('#DC2626', '#FEF2F2')}><UserX size={12} />Remover</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RemovedUsersSection removedLinks={removedLinks} show={showRemoved} onToggle={() => setShowRemoved(v => !v)} onReactivate={handleReactivateLink} />

      {modals}
    </div>
  )
}
