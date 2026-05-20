import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  Users, Plus, Edit, Trash2, Shield, User, UserCheck, Search,
  Eye, EyeOff, Mail, Calendar, CheckCircle, XCircle, Key, X,
  Building2, AlertTriangle, Loader2, RefreshCw, Lock, Save
} from 'lucide-react'

const PERM_MODULES = [
  { id: 'inicio',         label: 'Início',         icon: '🏠', desc: 'Painel com resumo e indicadores gerais' },
  { id: 'leads',          label: 'Leads',          icon: '👥', desc: 'Gestão do funil de captação de alunos' },
  { id: 'contatos',       label: 'Contatos',       icon: '📋', desc: 'Base de contatos e histórico' },
  { id: 'visitas',        label: 'Visitas',        icon: '📅', desc: 'Agendamento e controle de visitas' },
  { id: 'whatsapp',       label: 'WhatsApp',       icon: '💬', desc: 'Hub de atendimento e fluxos' },
  { id: 'relatorios',     label: 'Relatórios',     icon: '📊', desc: 'Métricas e relatórios de desempenho' },
  { id: 'transferencias', label: 'Transferências', icon: '↔️', desc: 'Transferência de leads entre atendentes' },
  { id: 'pesquisas',      label: 'Pesquisas',      icon: '⭐', desc: 'Pesquisas de satisfação e resultados' },
  { id: 'usuarios',       label: 'Usuários',       icon: '👤', desc: 'Gestão de usuários e permissões' },
  { id: 'configuracoes',  label: 'Configurações',  icon: '⚙️', desc: 'Configurações gerais do sistema' },
]

interface AppUser {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
  active: boolean
  created_at: string
  institutions?: { name: string }
}

// ─── Modal Novo/Editar Usuário ────────────────────────────────────────────────
function UserModal({ isOpen, onClose, onSave, editingUser }: {
  isOpen: boolean; onClose: () => void; onSave: (data: any) => Promise<void>; editingUser?: AppUser | null
}) {
  const [formData, setFormData] = useState({ full_name: '', email: '', role: 'user' as any, password: '', confirmPassword: '', active: true })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editingUser) {
      setFormData({ full_name: editingUser.full_name, email: editingUser.email, role: editingUser.role, password: '', confirmPassword: '', active: editingUser.active })
    } else {
      setFormData({ full_name: '', email: '', role: 'user', password: '', confirmPassword: '', active: true })
    }
    setError('')
  }, [editingUser, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!editingUser) {
      if (formData.password !== formData.confirmPassword) return setError('As senhas não coincidem')
      if (formData.password.length < 6) return setError('Senha mínima: 6 caracteres')
    }
    setLoading(true)
    try { await onSave(formData); onClose() }
    catch (err: any) { setError(err.message || 'Erro ao salvar') }
    finally { setLoading(false) }
  }

  if (!isOpen) return null

  const S = { input: 'w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#00A896] focus:outline-none transition-all text-sm' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626', display: 'flex', gap: 8 }}><AlertTriangle size={15} />{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Nome Completo *</label>
              <input required className={S.input} placeholder="Nome do usuário" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>E-mail *</label>
              <input required type="email" className={S.input} placeholder="email@escola.com" value={formData.email} disabled={!!editingUser} onChange={e => setFormData({ ...formData, email: e.target.value })} style={editingUser ? { background: '#F8FAFC', color: '#94A3B8' } : {}} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Perfil de Acesso *</label>
            <select required className={S.input} value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as any })}>
              <option value="user">👤 Consultor — Leads, visitas e matrículas</option>
              <option value="manager">👨‍💼 Gestor — Marketing, funil e relatórios</option>
              <option value="admin">🛡️ Administrador — Acesso completo</option>
            </select>
          </div>

          {!editingUser && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Senha *</label>
                <div style={{ position: 'relative' }}>
                  <input required type={showPwd ? 'text' : 'password'} className={S.input} placeholder="Mín. 6 caracteres" minLength={6} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} style={{ paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Confirmar Senha *</label>
                <input required type={showPwd ? 'text' : 'password'} className={S.input} placeholder="Confirme a senha" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
            <input type="checkbox" id="active" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#00A896' }} />
            <label htmlFor="active" style={{ fontSize: 13, color: '#475569', cursor: 'pointer' }}>Usuário ativo no sistema</label>
          </div>

          {!editingUser && (
            <div style={{ background: '#EFF6FF', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1D4ED8' }}>
              📧 O usuário receberá um e-mail de boas-vindas com as instruções de acesso.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748B' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ padding: '9px 20px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.7 : 1 }}>
              {loading ? <><Loader2 size={13} className="animate-spin" />{editingUser ? 'Salvando...' : 'Criando...'}</> : editingUser ? 'Salvar alterações' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Alterar Senha ──────────────────────────────────────────────────────
function PasswordModal({ isOpen, onClose, targetUser }: { isOpen: boolean; onClose: () => void; targetUser: AppUser | null }) {
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => { setPwd(''); setConfirm(''); setError(''); setSuccess(false) }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd !== confirm) return setError('As senhas não coincidem')
    if (pwd.length < 6) return setError('Mínimo 6 caracteres')
    setLoading(true); setError('')
    try {
      // Usa edge function ou admin API — aqui usamos reset por email como fallback seguro
      const { error } = await supabase.auth.resetPasswordForEmail(targetUser!.email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar email de redefinição')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !targetUser) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Key size={16} color="#00A896" />Redefinir Senha</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
        </div>

        <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#475569' }}>
          <strong>{targetUser.full_name}</strong><br />{targetUser.email}
        </div>

        {success ? (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 16, textAlign: 'center' }}>
            <CheckCircle size={32} color="#16a34a" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: '#166534', fontWeight: 600, margin: 0 }}>Email de redefinição enviado!</p>
            <p style={{ fontSize: 12, color: '#16a34a', margin: '4px 0 0' }}>O usuário receberá instruções por email.</p>
            <button onClick={onClose} style={{ marginTop: 14, padding: '8px 20px', borderRadius: 9, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          </div>
        ) : (
          <>
            {error && <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626' }}>{error}</div>}
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Clique abaixo para enviar um email de redefinição de senha para o usuário.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748B' }}>Cancelar</button>
              <button onClick={handleSubmit as any} disabled={loading} style={{ padding: '9px 18px', borderRadius: 9, background: '#8B5CF6', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                Enviar email
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function UserManagement() {
  const { user } = useAuth()
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users')
  const [permMap, setPermMap] = useState<Record<string, boolean>>({})
  const [savingPerms, setSavingPerms] = useState(false)
  const [permsSaved, setPermsSaved] = useState(false)
  const [loadingPerms, setLoadingPerms] = useState(false)

  useEffect(() => { loadUsers() }, [user])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const loadPermissions = async () => {
    if (!user?.institution_id) return
    setLoadingPerms(true)
    try {
      const { data } = await supabase
        .from('role_permissions')
        .select('module, enabled')
        .eq('institution_id', user.institution_id)
        .eq('role', 'consultor')
      const map: Record<string, boolean> = {}
      PERM_MODULES.forEach(m => { map[m.id] = true })
      if (data) {
        for (const row of data) map[row.module] = row.enabled
      }
      setPermMap(map)
    } catch (e) { console.error(e) } finally { setLoadingPerms(false) }
  }

  const handleSavePerms = async () => {
    if (!user?.institution_id) return
    setSavingPerms(true)
    try {
      const rows = PERM_MODULES.map(m => ({
        institution_id: user.institution_id,
        role: 'consultor',
        module: m.id,
        enabled: permMap[m.id] ?? true,
      }))
      const { error } = await supabase
        .from('role_permissions')
        .upsert(rows, { onConflict: 'institution_id,role,module' })
      if (error) throw error
      showToast('Permissões salvas com sucesso!')
      setPermsSaved(true)
      setTimeout(() => setPermsSaved(false), 2500)
    } catch (e: any) {
      showToast('Erro ao salvar permissões: ' + e.message, false)
    } finally { setSavingPerms(false) }
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

  const handleSave = async (formData: any) => {
    if (editingUser) {
      // Editar usuário existente
      const { error } = await supabase
        .from('users')
        .update({ full_name: formData.full_name, role: formData.role, active: formData.active })
        .eq('id', editingUser.id)
      if (error) throw error
      showToast('Usuário atualizado com sucesso!')
    } else {
      // Criar novo usuário via signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.full_name, role: formData.role },
          emailRedirectTo: `${window.location.origin}/login`
        }
      })
      if (authError) throw authError
      if (!authData.user) throw new Error('Erro ao criar usuário')

      // Inserir na tabela users
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          institution_id: user!.institution_id,
          active: formData.active
        }, { onConflict: 'id' })
      if (profileError) throw profileError

      showToast('Usuário criado! Email de boas-vindas enviado.')
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

  const handleDelete = async (u: AppUser) => {
    if (!confirm(`Excluir "${u.full_name}" permanentemente?`)) return
    const { error } = await supabase.from('users').delete().eq('id', u.id)
    if (error) return showToast('Erro ao excluir', false)
    showToast('Usuário excluído')
    await loadUsers()
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

  const roleLabel = (r: string) => r === 'admin' ? 'Administrador' : r === 'manager' ? 'Gestor' : 'Consultor'
  const roleBg = (r: string) => r === 'admin' ? '#FEE2E2' : r === 'manager' ? '#DBEAFE' : '#F1F5F9'
  const roleColor = (r: string) => r === 'admin' ? '#DC2626' : r === 'manager' ? '#3B82F6' : '#64748B'

  // ─── MOBILE ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#f8f9fb', paddingBottom: 96 }}>
        <style>{`.animate-spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

        {toast && (
          <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#1A2B4A' : '#DC2626', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8 }}>
            {toast.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}{toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} color="#3B82F6" />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Usuários</p>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{stats.active} ativo{stats.active !== 1 ? 's' : ''} de {stats.total}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 44, border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 16, outline: 'none', background: '#F8FAFC', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Stats 2x2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 16px' }}>
          {[
            { label: 'Total', value: stats.total, color: '#3B82F6', bg: '#DBEAFE', Icon: Users },
            { label: 'Ativos', value: stats.active, color: '#16a34a', bg: '#D1FAE5', Icon: CheckCircle },
            { label: 'Admins', value: stats.admins, color: '#DC2626', bg: '#FEE2E2', Icon: Shield },
            { label: 'Gestores', value: stats.managers, color: '#8B5CF6', bg: '#EDE9FE', Icon: UserCheck },
          ].map(({ label, value, color, bg, Icon }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={15} color={color} />
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* User cards */}
        <div style={{ flex: 1, padding: '0 0 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Loader2 size={28} color="#00A896" className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: '#94A3B8' }}>Carregando...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <Users size={40} color="#CBD5E1" style={{ marginBottom: 12 }} />
              <p style={{ color: '#94A3B8', fontSize: 14 }}>{users.length === 0 ? 'Nenhum usuário cadastrado' : 'Nenhum resultado'}</p>
            </div>
          ) : filtered.map(u => (
            <div key={u.id} style={{ margin: '0 16px 10px', background: '#fff', borderRadius: 14, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#00A896,#0DD3BF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {u.full_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name}</p>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: roleBg(u.role), color: roleColor(u.role), flexShrink: 0 }}>
                  {roleLabel(u.role)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleToggle(u.id, u.active)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: u.active ? '#D1FAE5' : '#FEE2E2', color: u.active ? '#16a34a' : '#DC2626', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44 }}
                >
                  {u.active ? <><CheckCircle size={13} />Ativo</> : <><XCircle size={13} />Inativo</>}
                </button>
                <button
                  onClick={() => { setEditingUser(u); setShowModal(true) }}
                  style={{ width: 44, height: 44, borderRadius: 10, border: 'none', background: '#EFF6FF', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => { setPwdUser(u); setShowPwdModal(true) }}
                  style={{ width: 44, height: 44, borderRadius: 10, border: 'none', background: '#F5F3FF', color: '#8B5CF6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Key size={16} />
                </button>
                <button
                  onClick={() => handleDelete(u)}
                  style={{ width: 44, height: 44, borderRadius: 10, border: 'none', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FAB */}
        <button
          onClick={() => { setEditingUser(null); setShowModal(true) }}
          style={{ position: 'fixed', bottom: 80, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#00A896', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,168,150,0.4)', cursor: 'pointer', zIndex: 100 }}
        >
          <Plus size={24} />
        </button>

        <UserModal isOpen={showModal} onClose={() => { setShowModal(false); setEditingUser(null) }} onSave={handleSave} editingUser={editingUser} />
        <PasswordModal isOpen={showPwdModal} onClose={() => { setShowPwdModal(false); setPwdUser(null) }} targetUser={pwdUser} />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, minHeight: '100%', background: '#f8f9fb', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`.animate-spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${toast.ok ? '#BBF7D0' : '#FECACA'}`, borderRadius: 12, padding: '12px 18px', fontSize: 13, color: toast.ok ? '#166534' : '#DC2626', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {toast.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} color="#3B82F6" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Usuários</h1>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Controle de acesso e permissões</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'users' && (
            <>
              <button onClick={loadUsers} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, color: '#64748B', cursor: 'pointer' }}>
                <RefreshCw size={13} /> Atualizar
              </button>
              <button onClick={() => { setEditingUser(null); setShowModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={15} /> Novo Usuário
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {([
          { id: 'users' as 'users' | 'permissions', label: 'Usuários', icon: <Users size={13} /> },
          { id: 'permissions' as 'users' | 'permissions', label: 'Permissões por Perfil', icon: <Lock size={13} /> },
        ]).map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'permissions') loadPermissions() }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500, background: activeTab === tab.id ? '#fff' : 'transparent', color: activeTab === tab.id ? '#1A2B4A' : '#64748B', cursor: 'pointer', boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'permissions' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>🔒 Permissões — Consultor</h2>
              <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Administradores e gestores têm acesso total e não são configuráveis.</p>
            </div>
            <button onClick={handleSavePerms} disabled={savingPerms}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: permsSaved ? '#16a34a' : '#00A896', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingPerms ? 0.7 : 1 }}>
              {savingPerms ? <><Loader2 size={13} className="animate-spin" />Salvando...</> : permsSaved ? <><CheckCircle size={13} />Salvo!</> : <><Save size={13} />Salvar permissões</>}
            </button>
          </div>
          {loadingPerms ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Loader2 size={24} color="#00A896" className="animate-spin" style={{ margin: '0 auto' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {PERM_MODULES.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, border: '1px solid #F1F5F9', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.desc}</div>
                    </div>
                  </div>
                  <button onClick={() => setPermMap(p => ({ ...p, [m.id]: !(p[m.id] ?? true) }))}
                    style={{ width: 44, height: 24, borderRadius: 999, background: (permMap[m.id] ?? true) ? '#00A896' : '#CBD5E1', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: 3, left: (permMap[m.id] ?? true) ? 22 : 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', display: 'block' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
      <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Total', value: stats.total, color: '#3B82F6', bg: '#DBEAFE', Icon: Users },
          { label: 'Ativos', value: stats.active, color: '#16a34a', bg: '#D1FAE5', Icon: CheckCircle },
          { label: 'Admins', value: stats.admins, color: '#DC2626', bg: '#FEE2E2', Icon: Shield },
          { label: 'Gestores', value: stats.managers, color: '#8B5CF6', bg: '#EDE9FE', Icon: UserCheck },
        ].map(({ label, value, color, bg, Icon }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 6px' }}>{label}</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{value}</p>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} color={color} />
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 40, border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, outline: 'none', background: '#F8FAFC', boxSizing: 'border-box' }} />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, background: '#F8FAFC', outline: 'none', color: '#475569' }}>
          <option value="">Todos os perfis</option>
          <option value="admin">Administradores</option>
          <option value="manager">Gestores</option>
          <option value="user">Consultores</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, background: '#F8FAFC', outline: 'none', color: '#475569' }}>
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Loader2 size={28} color="#00A896" className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: '#94A3B8' }}>Carregando usuários...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
            <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>{users.length === 0 ? 'Nenhum usuário cadastrado' : 'Nenhum resultado encontrado'}</p>
            <p style={{ fontSize: 12, margin: 0 }}>{users.length === 0 ? 'Clique em "Novo Usuário" para começar' : 'Tente ajustar os filtros'}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Usuário', 'Perfil', 'Instituição', 'Status', 'Cadastrado em', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F8FAFC', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#00A896,#0DD3BF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1A2B4A' }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={10} />{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: roleBg(u.role), color: roleColor(u.role) }}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748B', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={12} color="#94A3B8" />{user?.institution_name || user?.institution_id || '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => handleToggle(u.id, u.active)} style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: u.active ? '#D1FAE5' : '#FEE2E2', color: u.active ? '#16a34a' : '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {u.active ? <><CheckCircle size={11} />Ativo</> : <><XCircle size={11} />Inativo</>}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748B', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} color="#94A3B8" />{new Date(u.created_at).toLocaleDateString('pt-BR')}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setEditingUser(u); setShowModal(true) }} title="Editar" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit size={13} /></button>
                      <button onClick={() => { setPwdUser(u); setShowPwdModal(true) }} title="Redefinir senha" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#F5F3FF', color: '#8B5CF6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Key size={13} /></button>
                      <button onClick={() => handleDelete(u)} title="Excluir" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      </>
      )}

      <UserModal isOpen={showModal} onClose={() => { setShowModal(false); setEditingUser(null) }} onSave={handleSave} editingUser={editingUser} />
      <PasswordModal isOpen={showPwdModal} onClose={() => { setShowPwdModal(false); setPwdUser(null) }} targetUser={pwdUser} />
    </div>
  )
}