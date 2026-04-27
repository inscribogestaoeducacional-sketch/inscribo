import React, { useState } from 'react'
import { User, Lock, Save, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1A2B4A',
  outline: 'none', boxSizing: 'border-box', background: '#FAFAFA',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6,
  display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em',
}

export default function UserProfile() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: ''
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: profileData.full_name, phone: profileData.phone })
        .eq('id', user!.id)
      if (error) throw error
      setMessage('Perfil atualizado com sucesso!')
    } catch (error) {
      setMessage('Erro ao atualizar perfil: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('As senhas não coincidem')
      setLoading(false)
      return
    }
    if (passwordData.newPassword.length < 6) {
      setMessage('A nova senha deve ter pelo menos 6 caracteres')
      setLoading(false)
      return
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword })
      if (error) throw error
      setMessage('Senha alterada com sucesso!')
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setMessage('Erro ao alterar senha: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const tabActive: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 700, background: '#E6F7F5', color: '#00A896',
  }
  const tabInactive: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, background: 'transparent', color: '#64748b',
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={18} color="#64748B" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Meu Perfil</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Gerencie suas informações pessoais e configurações</p>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 4 }}>
          <button onClick={() => setActiveTab('profile')} style={activeTab === 'profile' ? tabActive : tabInactive}>
            <User size={14} /> Informações Pessoais
          </button>
          <button onClick={() => setActiveTab('password')} style={activeTab === 'password' ? tabActive : tabInactive}>
            <Lock size={14} /> Alterar Senha
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {message && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13,
              background: message.includes('sucesso') ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${message.includes('sucesso') ? '#BBF7D0' : '#FECACA'}`,
              color: message.includes('sucesso') ? '#166534' : '#DC2626',
            }}>
              {message}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Nome Completo</label>
                  <input
                    type="text"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>E-mail</label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    style={{ ...inputStyle, background: '#F8FAFC', color: '#94A3B8' }}
                  />
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>O e-mail não pode ser alterado</p>
                </div>
                <div>
                  <label style={labelStyle}>Telefone</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Perfil</label>
                  <input
                    type="text"
                    value={user?.role === 'admin' ? 'Administrador' : user?.role === 'manager' ? 'Gestor' : 'Consultor'}
                    disabled
                    style={{ ...inputStyle, background: '#F8FAFC', color: '#94A3B8' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                  <Save size={13} />
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
              {[
                { label: 'Senha Atual', key: 'currentPassword' as const, show: showPasswords.current, toggle: () => setShowPasswords(s => ({ ...s, current: !s.current })) },
                { label: 'Nova Senha', key: 'newPassword' as const, show: showPasswords.new, toggle: () => setShowPasswords(s => ({ ...s, new: !s.new })) },
                { label: 'Confirmar Nova Senha', key: 'confirmPassword' as const, show: showPasswords.confirm, toggle: () => setShowPasswords(s => ({ ...s, confirm: !s.confirm })) },
              ].map(({ label, key, show, toggle }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={show ? 'text' : 'password'}
                      value={passwordData[key]}
                      onChange={(e) => setPasswordData({ ...passwordData, [key]: e.target.value })}
                      style={{ ...inputStyle, paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={toggle}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                    >
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                  <Lock size={13} />
                  {loading ? 'Alterando...' : 'Alterar Senha'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
