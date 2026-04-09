import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase redireciona com tokens no hash da URL — deixamos o SDK processar
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const passwordStrength = (): { label: string; color: string; width: string } => {
    const len = password.length
    if (len === 0) return { label: '', color: '#E5E7EB', width: '0%' }
    if (len < 6) return { label: 'Fraca', color: '#EF4444', width: '25%' }
    if (len < 8) return { label: 'Regular', color: '#F59E0B', width: '50%' }
    if (len < 12) return { label: 'Boa', color: '#00A896', width: '75%' }
    return { label: 'Forte', color: '#00523C', width: '100%' }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha. Solicite um novo link de recuperação.')
    } finally {
      setLoading(false)
    }
  }

  const strength = passwordStrength()

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #F0FDF9 0%, #E6F7F5 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 15, height: 15, borderRadius: '50%', background: 'white', border: '2px solid rgba(255,255,255,0.5)' }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#00523C', letterSpacing: '-0.02em' }}>Áion Edu</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Inteligência em matrículas</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#D1FAE5' }}>
                  <CheckCircle className="w-10 h-10" style={{ color: '#00523C' }} />
                </div>
              </div>
              <h2 className="text-2xl font-bold" style={{ color: '#00523C' }}>Senha redefinida!</h2>
              <p className="text-gray-500">Sua senha foi atualizada com sucesso. Redirecionando para o login...</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#00523C' }}>Nova Senha</h2>
                <p className="text-gray-500 text-sm">Crie uma senha segura para sua conta.</p>
              </div>

              {!sessionReady && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Aguardando validação do link... Se esta mensagem persistir, solicite um novo link de recuperação.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nova senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoFocus
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-12 pr-12 block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:border-[#00A896] transition-all text-base"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00A896] transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {password.length > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: strength.width, background: strength.color }} />
                      </div>
                      <p className="text-xs mt-1 font-medium" style={{ color: strength.color }}>{strength.label}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirmar nova senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="pl-12 block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:border-[#00A896] transition-all text-base"
                      placeholder="Repita a senha"
                    />
                  </div>
                  {confirm.length > 0 && password !== confirm && (
                    <p className="text-xs mt-1 text-red-500">As senhas não coincidem</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !sessionReady}
                  className="w-full flex justify-center items-center py-4 px-4 rounded-xl text-base font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #00523C, #00A896)' }}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Salvando...
                    </>
                  ) : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
