// src/components/superadmin/AdminProfile.tsx
// Página de perfil do admin — coloque em src/components/superadmin/AdminProfile.tsx
// e atualize o App.tsx para usar este componente no lugar do inline AdminProfilePage
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import SuperAdminLayout from './SuperAdminLayout'
import {
  User, Mail, Phone, Lock, CheckCircle2, AlertTriangle,
  Eye, EyeOff, Save, Shield, Building2, Calendar
} from 'lucide-react'

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

export default function AdminProfile() {
  const { user } = useAuth()
  const [profile, setProfile]     = useState({ full_name: '', email: '', phone: '' })
  const [pwForm,  setPwForm]      = useState({ current: '', next: '', confirm: '' })
  const [showPw,  setShowPw]      = useState({ current: false, next: false, confirm: false })
  const [saving,  setSaving]      = useState(false)
  const [savingPw, setSavingPw]   = useState(false)
  const [toast,   setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [stats,   setStats]       = useState({ schools: 0, contracts: 0, leads: 0 })

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  useEffect(() => {
    if (user) {
      setProfile({ full_name: user.full_name || '', email: user.email || '', phone: (user as any).phone || '' })
      loadStats()
    }
  }, [user?.id])

  const loadStats = async () => {
    const [schRes, contRes, leadRes] = await Promise.all([
      supabase.from('institutions').select('id', { count: 'exact', head: true }),
      supabase.from('contracts').select('id', { count: 'exact', head: true }),
      supabase.from('crm_leads').select('id', { count: 'exact', head: true }),
    ])
    setStats({
      schools:   schRes.count  || 0,
      contracts: contRes.count || 0,
      leads:     leadRes.count || 0,
    })
  }

  const handleSaveProfile = async () => {
    if (!profile.full_name.trim()) { showToast('Nome é obrigatório.', false); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('users').update({
        full_name: profile.full_name.trim(),
        phone:     profile.phone.trim() || null,
      }).eq('id', user!.id)
      if (error) throw error
      showToast('Perfil atualizado!')
      // Atualiza cache
      const cached = localStorage.getItem('inscribo-user')
      if (cached) {
        const parsed = JSON.parse(cached)
        localStorage.setItem('inscribo-user', JSON.stringify({ ...parsed, full_name: profile.full_name.trim() }))
      }
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!pwForm.next || pwForm.next.length < 8) { showToast('Nova senha: mínimo 8 caracteres.', false); return }
    if (pwForm.next !== pwForm.confirm) { showToast('Senhas não conferem.', false); return }
    setSavingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.next })
      if (error) throw error
      showToast('Senha alterada com sucesso!')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (e: any) {
      showToast(e?.message || 'Erro ao alterar senha.', false)
    } finally {
      setSavingPw(false)
    }
  }

  const initials = (user?.full_name || 'A').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6 max-w-2xl">

        {toast && (
          <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
            ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie suas informações de conta</p>
        </div>

        {/* Avatar + Stats */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-sm">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold text-gray-900">{user?.full_name || '—'}</p>
              <p className="text-sm text-gray-400 mt-0.5">{user?.email}</p>
              <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold px-2.5 py-1 bg-cyan-100 text-cyan-700 rounded-full">
                <Shield className="w-3 h-3" />
                {user?.user_type === 'consultant' ? 'Consultor' : 'Admin Geral'}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
            {[
              { label: 'Escolas',   value: stats.schools,   icon: Building2 },
              { label: 'Contratos', value: stats.contracts, icon: CheckCircle2 },
              { label: 'Leads',     value: stats.leads,     icon: User },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="text-center">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-1">
                    <Icon className="w-4 h-4 text-gray-400" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Editar dados */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" /> Dados pessoais
          </h2>

          <div>
            <label className={lbl}>Nome completo *</label>
            <input className={inp} value={profile.full_name}
              onChange={e => setProfile(f => ({ ...f, full_name: e.target.value }))} />
          </div>

          <div>
            <label className={lbl}>E-mail</label>
            <input className={inp + ' opacity-60 cursor-not-allowed'} value={profile.email} disabled />
            <p className="text-xs text-gray-400 mt-1">O e-mail não pode ser alterado por aqui.</p>
          </div>

          <div>
            <label className={lbl}>Telefone / WhatsApp</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className={inp + ' pl-9'} placeholder="(83) 99999-9999" value={profile.phone}
                onChange={e => setProfile(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>

          <button onClick={handleSaveProfile} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
              : <><Save className="w-4 h-4" /> Salvar dados</>
            }
          </button>
        </div>

        {/* Alterar senha */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-400" /> Alterar senha
          </h2>

          {[
            { key: 'next',    label: 'Nova senha *',           placeholder: 'Mínimo 8 caracteres' },
            { key: 'confirm', label: 'Confirmar nova senha *', placeholder: 'Repita a senha' },
          ].map(f => (
            <div key={f.key}>
              <label className={lbl}>{f.label}</label>
              <div className="relative">
                <input
                  type={showPw[f.key as keyof typeof showPw] ? 'text' : 'password'}
                  className={inp + ' pr-10'}
                  placeholder={f.placeholder}
                  value={pwForm[f.key as keyof typeof pwForm]}
                  onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
                <button type="button"
                  onClick={() => setShowPw(s => ({ ...s, [f.key]: !s[f.key as keyof typeof s] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw[f.key as keyof typeof showPw] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}

          {pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm && (
            <p className="text-xs text-red-500 font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> As senhas não conferem.
            </p>
          )}

          <button onClick={handleChangePassword} disabled={savingPw || !pwForm.next || !pwForm.confirm}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {savingPw
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Alterando...</>
              : <><Lock className="w-4 h-4" /> Alterar senha</>
            }
          </button>
        </div>

        {/* Info da conta */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" /> Informações da conta
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ID do usuário</span>
              <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{user?.id?.slice(0, 16)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tipo de acesso</span>
              <span className="font-semibold text-gray-700 capitalize">{user?.user_type || user?.role || '—'}</span>
            </div>
          </div>
        </div>

      </div>
    </SuperAdminLayout>
  )
}