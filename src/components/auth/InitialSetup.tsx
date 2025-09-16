import React, { useState } from 'react'
import { Building, User, Mail, Lock, Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface InitialSetupProps {
  onComplete: () => void
}

export default function InitialSetup({ onComplete }: InitialSetupProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [institutionData, setInstitutionData] = useState({
    name: '',
    email: ''
  })
  
  const [adminData, setAdminData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const handleInstitutionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!institutionData.name || !institutionData.email) {
      setError('Nome e e-mail da instituição são obrigatórios')
      return
    }
    setError('')
    setStep(2)
  }

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (adminData.password !== adminData.confirmPassword) {
      setError('As senhas não coincidem')
      setLoading(false)
      return
    }

    if (adminData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      setLoading(false)
      return
    }

    try {
      // Create institution
      const { data: institution, error: instError } = await supabase
        .from('institutions')
        .insert([{ 
          name: institutionData.name,
          primary_color: '#3B82F6',
          secondary_color: '#10B981'
        }])
        .select()
        .single()

      if (instError) throw instError

      // Sign up admin user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminData.email,
        password: adminData.password,
      })

      if (authError) throw authError

      // Create user record
      if (authData.user) {
        const { error: userError } = await supabase
          .from('users')
          .insert([{
            id: authData.user.id,
            email: adminData.email,
            full_name: adminData.full_name,
            role: 'admin',
            institution_id: institution.id,
            active: true
          }])

        if (userError) throw userError
      }

      onComplete()
    } catch (err: any) {
      setError(err.message || 'Erro ao criar configuração inicial')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 mb-6 rounded-full overflow-hidden bg-white shadow-lg">
            <img 
              src="/Inscribo.jpeg" 
              alt="Inscribo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Configuração Inicial</h2>
          <p className="text-gray-600">
            {step === 1 ? 'Configure sua instituição' : 'Crie o usuário administrador'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg border border-gray-100">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleInstitutionSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Instituição *
                </label>
                <input
                  type="text"
                  required
                  value={institutionData.name}
                  onChange={(e) => setInstitutionData({ ...institutionData, name: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Colégio São José"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail da Instituição *
                </label>
                <input
                  type="email"
                  required
                  value={institutionData.email}
                  onChange={(e) => setInstitutionData({ ...institutionData, email: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contato@colegio.com"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Continuar
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={adminData.full_name}
                  onChange={(e) => setAdminData({ ...adminData, full_name: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Seu nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail do Administrador *
                </label>
                <input
                  type="email"
                  required
                  value={adminData.email}
                  onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="admin@colegio.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  required
                  value={adminData.password}
                  onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Senha *
                </label>
                <input
                  type="password"
                  required
                  value={adminData.confirmPassword}
                  onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirme sua senha"
                />
              </div>

              <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-md">
                <Shield className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-blue-700">
                  Este será o usuário administrador com acesso total ao sistema.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Finalizar Configuração'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Voltar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}