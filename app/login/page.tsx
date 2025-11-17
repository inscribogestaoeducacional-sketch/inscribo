'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError('')

  try {
    // Importar o supabase
    const { supabase } = await import('../../../src/lib/supabase')
    
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      setError('Email ou senha incorretos')
      return
    }

    if (data.session) {
      // Verificar se é super admin
      if (email === 'admin@inscribo.com') {
        // Super Admin
        const superAdminUser = {
          id: data.user.id,
          full_name: 'Super Administrador',
          email: email,
          role: 'admin',
          institution_id: 'super-admin',
          active: true,
          is_super_admin: true,
          institution_name: 'Inscribo - Super Admin'
        }
        
        localStorage.setItem('inscribo-user', JSON.stringify(superAdminUser))
        localStorage.setItem('inscribo-auth-token', JSON.stringify(data.session))
        
        window.location.href = '/super-admin'
      } else {
        // Usuário normal
        window.location.href = '/dashboard'
      }
    }
  } catch (err: any) {
    console.error('Erro no login:', err)
    setError('Erro ao fazer login. Tente novamente.')
  } finally {
    setLoading(false)
  }
}

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#00C7B7] via-[#00B5A5] to-[#1A1F71] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo */}
          <div>
            <Image 
              src="/Inscribologo.png" 
              alt="Inscribo" 
              width={200} 
              height={60}
              className="mb-8"
            />
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            <h1 className="text-5xl font-bold leading-tight">
              Gestão inteligente de
              <br />
              <span className="text-[#FFD700]">matrículas escolares</span>
            </h1>
            
            <p className="text-xl text-white/90 max-w-md">
              Simplifique o processo de captação de alunos e aumente suas matrículas com nossa plataforma completa.
            </p>

            <div className="space-y-4 pt-8">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Kanban de Leads</h3>
                  <p className="text-white/80 text-sm">Gerencie todo o funil de vendas visualmente</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Agendamento de Visitas</h3>
                  <p className="text-white/80 text-sm">Organize e acompanhe todas as visitas escolares</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Relatórios Completos</h3>
                  <p className="text-white/80 text-sm">Análises detalhadas para tomada de decisão</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-white/60 text-sm">
            © 2024 Inscribo. Todos os direitos reservados.
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Image 
              src="/Inscribologo.png" 
              alt="Inscribo" 
              width={180} 
              height={54}
            />
          </div>

          {/* Login Card */}
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-[#1A1F71] mb-2">
                Entrar no Sistema
              </h2>
              <p className="text-gray-600">
                Digite suas credenciais para acessar sua conta
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 block w-full px-4 py-3.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00C7B7] focus:border-transparent transition-all text-base"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 block w-full px-4 py-3.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00C7B7] focus:border-transparent transition-all text-base"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#00C7B7] transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-[#00C7B7] focus:ring-[#00C7B7] border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Lembrar de mim
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-semibold text-[#00C7B7] hover:text-[#00B5A5] transition-colors">
                    Esqueceu a senha?
                  </a>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-[#00C7B7] to-[#1A1F71] hover:from-[#00B5A5] hover:to-[#151861] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00C7B7] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar no Sistema
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>
            </form>

            {/* Help Section */}
            <div className="text-center pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Precisa de ajuda?{' '}
                <a href="#" className="font-semibold text-[#00C7B7] hover:text-[#00B5A5] transition-colors">
                  Entre em contato
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
