import React, { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginForm() {
  const [email, setEmail] = useState('admin@escola.com')
  const [password, setPassword] = useState('123456')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const { signIn, loading } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await signIn(email, password)
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header with Logo */}
        <div className="text-center">
          <div className="mx-auto h-24 w-24 mb-6 rounded-2xl overflow-hidden bg-white shadow-xl">
            <img 
              src="/Inscribo.jpeg" 
              alt="Inscribo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo ao Inscribo</h2>
          <p className="text-gray-600">Sistema de Gestão Educacional</p>
        </div>

        {/* Demo Credentials */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Credenciais de Demonstração:</h3>
          <div className="text-sm text-blue-700">
            <p><strong>Email:</strong> admin@escola.com</p>
            <p><strong>Senha:</strong> 123456</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full px-3 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 block w-full px-3 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Entrando...
                  </div>
                ) : (
                  'Entrar no Sistema'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2024 Inscribo. Sistema de Gestão Educacional.
          </p>
        </div>
      </div>
    </div>
  )
}