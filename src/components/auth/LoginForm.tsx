import React, { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, BookOpen } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isResetMode, setIsResetMode] = useState(false)
  const [resetMessage, setResetMessage] = useState('')

  const { signIn, resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await signIn(email, password)
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setResetMessage('')

    try {
      await resetPassword(email)
      setResetMessage('Link de recuperação enviado para seu e-mail!')
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar link de recuperação')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-6">
            <BookOpen className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Inscribo</h2>
          <p className="text-gray-600">
            {isResetMode ? 'Recuperar senha' : 'Sistema de Gestão Educacional'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg">
          <form onSubmit={isResetMode ? handleResetPassword : handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {resetMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                {resetMessage}
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
                  className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            {!isResetMode && (
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
                    className="pl-10 pr-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading
                  ? 'Carregando...'
                  : isResetMode
                  ? 'Enviar link de recuperação'
                  : 'Entrar'
                }
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(!isResetMode)
                  setError('')
                  setResetMessage('')
                }}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                {isResetMode ? 'Voltar ao login' : 'Esqueci minha senha'}
              </button>
            </div>
          </form>
        </div>

        {/* Demo credentials */}
        <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
          <p className="font-medium mb-2">Credenciais de demo:</p>
          <p>Admin: admin@inscribo.com / admin123</p>
          <p>Gestor: gestor@inscribo.com / gestor123</p>
          <p>Usuário: usuario@inscribo.com / user123</p>
        </div>
      </div>
    </div>
  )
}