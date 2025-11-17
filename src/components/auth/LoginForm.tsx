import React, { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, AlertCircle, ArrowRight, Sparkles, TrendingUp, Users, BarChart3 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      console.log('Attempting login for:', email)
      await signIn(email, password)
      console.log('✅ Login realizado, aguardando redirecionamento...')
    } catch (err: any) {
      console.error('Login error:', err)
      
      let errorMessage = 'Erro ao processar solicitação'
      
      if (err.message) {
        if (err.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos'
        } else if (err.message.includes('Email not confirmed')) {
          errorMessage = 'Email não confirmado. Verifique sua caixa de entrada.'
        } else if (err.message.includes('Too many requests')) {
          errorMessage = 'Muitas tentativas. Tente novamente em alguns minutos.'
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#00D4C4] via-[#00B8AA] to-[#2D3E9E] relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#FFD700]/10 rounded-full blur-3xl animate-pulse delay-700"></div>
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-white/5 rounded-full blur-2xl animate-bounce-slow"></div>
        </div>

        {/* Decorative Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo - Removida do lado colorido */}
          <div className="animate-fade-in-down">
            <div className="text-4xl font-bold mb-2">Inscribo</div>
            <div className="text-white/80 text-sm">Sistema de Gestão Educacional</div>
          </div>

          {/* Main Content com Animações */}
          <div className="space-y-8">
            <div className="space-y-4 animate-fade-in-up animation-delay-200">
              <h1 className="text-6xl font-bold leading-tight">
                Gestão inteligente de
                <br />
                <span className="text-[#FFD700] inline-block animate-gradient-text">
                  matrículas escolares
                </span>
              </h1>
              
              <p className="text-xl text-white/90 max-w-md animate-fade-in-up animation-delay-400">
                Simplifique o processo de captação de alunos e aumente suas matrículas com nossa plataforma completa.
              </p>
            </div>

            {/* Features com Animações Escalonadas */}
            <div className="space-y-5 pt-4">
              <div className="flex items-start space-x-4 animate-slide-in-left animation-delay-600 group hover:translate-x-2 transition-transform duration-300">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center mt-1 group-hover:bg-white/20 transition-all duration-300 group-hover:scale-110">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-1">Kanban de Leads</h3>
                  <p className="text-white/80">Gerencie todo o funil de vendas visualmente</p>
                </div>
              </div>

              <div className="flex items-start space-x-4 animate-slide-in-left animation-delay-800 group hover:translate-x-2 transition-transform duration-300">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center mt-1 group-hover:bg-white/20 transition-all duration-300 group-hover:scale-110">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-1">Agendamento de Visitas</h3>
                  <p className="text-white/80">Organize e acompanhe todas as visitas escolares</p>
                </div>
              </div>

              <div className="flex items-start space-x-4 animate-slide-in-left animation-delay-1000 group hover:translate-x-2 transition-transform duration-300">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center mt-1 group-hover:bg-white/20 transition-all duration-300 group-hover:scale-110">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-1">Relatórios Completos</h3>
                  <p className="text-white/80">Análises detalhadas para tomada de decisão</p>
                </div>
              </div>
            </div>

            {/* Badge Animado */}
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full animate-fade-in-up animation-delay-1200">
              <Sparkles className="w-4 h-4 text-[#FFD700] animate-pulse" />
              <span className="text-sm font-medium">Sistema completo para sua escola</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-white/60 text-sm animate-fade-in animation-delay-1400">
            © 2024 Inscribo. Todos os direitos reservados.
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo Original - Agora no Lado Branco */}
          <div className="mb-10 flex justify-center animate-fade-in-down">
            <img 
              src="/Inscribologo.png" 
              alt="Inscribo" 
              className="h-16 w-auto"
            />
          </div>

          {/* Login Card */}
          <div className="space-y-8">
            <div className="animate-fade-in-up animation-delay-200">
              <h2 className="text-3xl font-bold text-[#2D3E9E] mb-2">
                Entrar no Sistema
              </h2>
              <p className="text-gray-600">
                Digite suas credenciais para acessar sua conta
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in-up animation-delay-400">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center animate-shake">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="group">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 transition-colors group-focus-within:text-[#00D4C4]" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00D4C4]/20 focus:border-[#00D4C4] transition-all text-base hover:border-gray-300"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div className="group">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 transition-colors group-focus-within:text-[#00D4C4]" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00D4C4]/20 focus:border-[#00D4C4] transition-all text-base hover:border-gray-300"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#00D4C4] transition-colors"
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
                    className="h-4 w-4 text-[#00D4C4] focus:ring-[#00D4C4] border-gray-300 rounded transition-all"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Lembrar de mim
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-semibold text-[#00D4C4] hover:text-[#00B8AA] transition-colors">
                    Esqueceu a senha?
                  </a>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-4 px-4 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-[#00D4C4] to-[#2D3E9E] hover:from-[#00B8AA] hover:to-[#252F7E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00D4C4] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 active:translate-y-0"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar no Sistema
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Help Section */}
            <div className="text-center pt-6 border-t border-gray-200 animate-fade-in-up animation-delay-600">
              <p className="text-sm text-gray-600">
                Precisa de ajuda?{' '}
                <a href="#" className="font-semibold text-[#00D4C4] hover:text-[#00B8AA] transition-colors">
                  Entre em contato
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Estilos de Animação */}
      <style jsx>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        @keyframes bounceSlow {
          0%, 100% {
            transform: translateY(-5%);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }

        @keyframes gradientText {
          0%, 100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.2);
          }
        }

        .animate-fade-in-down {
          animation: fadeInDown 0.6s ease-out forwards;
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }

        .animate-slide-in-left {
          animation: slideInLeft 0.6s ease-out forwards;
        }

        .animate-shake {
          animation: shake 0.5s ease-out;
        }

        .animate-bounce-slow {
          animation: bounceSlow 3s infinite;
        }

        .animate-gradient-text {
          animation: gradientText 2s ease-in-out infinite;
        }

        .animation-delay-200 {
          animation-delay: 0.2s;
          opacity: 0;
        }

        .animation-delay-400 {
          animation-delay: 0.4s;
          opacity: 0;
        }

        .animation-delay-600 {
          animation-delay: 0.6s;
          opacity: 0;
        }

        .animation-delay-800 {
          animation-delay: 0.8s;
          opacity: 0;
        }

        .animation-delay-1000 {
          animation-delay: 1s;
          opacity: 0;
        }

        .animation-delay-1200 {
          animation-delay: 1.2s;
          opacity: 0;
        }

        .animation-delay-1400 {
          animation-delay: 1.4s;
          opacity: 0;
        }
      `}</style>
    </div>
  )
}
