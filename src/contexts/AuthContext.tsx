import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AppUser {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
  active: boolean
}

interface AuthContextType {
  user: AppUser | null
  session: Session | null
  loading: boolean
  initializing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    console.log('🔄 Inicializando AuthProvider...')
    initializeAuth()
  }, [])

  const initializeAuth = async () => {
    try {
      console.log('🔍 Verificando sessão existente...')
      
      // 1. Verificar sessão atual no Supabase
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ Erro ao verificar sessão:', sessionError)
        clearAuthState()
        return
      }

      if (currentSession?.user) {
        console.log('✅ Sessão encontrada:', currentSession.user.email)
        setSession(currentSession)
        await loadUserProfile(currentSession.user.id)
      } else {
        console.log('ℹ️ Nenhuma sessão ativa encontrada')
        clearAuthState()
      }

      // 2. Configurar listener para mudanças de auth
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log('🔄 Auth state change:', event, newSession?.user?.email)
        
        switch (event) {
          case 'SIGNED_IN':
            console.log('✅ Usuário logado')
            setSession(newSession)
            if (newSession?.user) {
              await loadUserProfile(newSession.user.id)
            }
            break
            
          case 'SIGNED_OUT':
            console.log('🚪 Usuário deslogado')
            clearAuthState()
            break
            
          case 'TOKEN_REFRESHED':
            console.log('🔄 Token renovado')
            setSession(newSession)
            break
            
          case 'USER_UPDATED':
            console.log('👤 Usuário atualizado')
            if (newSession?.user) {
              await loadUserProfile(newSession.user.id)
            }
            break
            
          default:
            console.log('ℹ️ Evento de auth:', event)
        }
      })

      return () => {
        console.log('🧹 Limpando subscription de auth')
        subscription.unsubscribe()
      }
    } catch (error) {
      console.error('❌ Erro na inicialização:', error)
      clearAuthState()
    } finally {
      setInitializing(false)
    }
  }

  const loadUserProfile = async (userId: string) => {
    try {
      console.log('👤 Carregando perfil do usuário:', userId)
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError) {
        console.error('❌ Erro ao carregar perfil:', userError)
        
        // Se usuário não existe na tabela users, isso pode ser normal
        if (userError.code === 'PGRST116') {
          console.log('ℹ️ Usuário não encontrado na tabela users - redirecionando para setup')
          setUser(null)
          return
        }
        
        throw userError
      }

      if (userData) {
        console.log('✅ Perfil carregado:', userData.full_name)
        setUser(userData)
        
        // Salvar dados do usuário no localStorage para recuperação rápida
        localStorage.setItem('inscribo_user', JSON.stringify(userData))
      }
    } catch (error) {
      console.error('❌ Erro ao carregar perfil:', error)
      
      // Em caso de erro de rede, tentar recuperar do localStorage
      const cachedUser = localStorage.getItem('inscribo_user')
      if (cachedUser) {
        try {
          const parsedUser = JSON.parse(cachedUser)
          console.log('🔄 Usando dados em cache:', parsedUser.full_name)
          setUser(parsedUser)
          return
        } catch (parseError) {
          console.error('❌ Erro ao parsear cache:', parseError)
          localStorage.removeItem('inscribo_user')
        }
      }
      
      setUser(null)
    }
  }

  const clearAuthState = () => {
    console.log('🧹 Limpando estado de autenticação')
    setUser(null)
    setSession(null)
    localStorage.removeItem('inscribo_user')
    localStorage.removeItem('inscribo_session')
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log('🔐 Iniciando login:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error('❌ Erro no login:', error)
        throw new Error(error.message)
      }

      if (data.session) {
        console.log('✅ Login bem-sucedido')
        setSession(data.session)
        
        // Salvar sessão no localStorage
        localStorage.setItem('inscribo_session', JSON.stringify(data.session))
        
        if (data.user) {
          await loadUserProfile(data.user.id)
        }
      }
    } catch (error) {
      console.error('❌ Falha no login:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      console.log('🚪 Iniciando logout...')
      
      // Limpar estado local primeiro
      clearAuthState()
      
      // Fazer logout no Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Erro no logout:', error)
      }
      
      console.log('✅ Logout completo')
      
      // Redirecionar para login
      window.location.href = '/login'
    } catch (error) {
      console.error('❌ Erro no logout:', error)
      // Força redirecionamento mesmo com erro
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => {
    try {
      setLoading(true)
      console.log('📝 Criando conta:', email)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role
          }
        }
      })

      if (error) throw error
      
      console.log('✅ Conta criada com sucesso')
      throw new Error('Conta criada! Faça login com suas credenciais.')
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const refreshSession = async () => {
    try {
      console.log('🔄 Renovando sessão...')
      
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession()
      
      if (error) {
        console.error('❌ Erro ao renovar sessão:', error)
        clearAuthState()
        return
      }

      if (refreshedSession) {
        console.log('✅ Sessão renovada')
        setSession(refreshedSession)
        localStorage.setItem('inscribo_session', JSON.stringify(refreshedSession))
        
        if (refreshedSession.user) {
          await loadUserProfile(refreshedSession.user.id)
        }
      }
    } catch (error) {
      console.error('❌ Erro ao renovar sessão:', error)
      clearAuthState()
    }
  }

  // Auto-refresh da sessão a cada 50 minutos (tokens expiram em 1 hora)
  useEffect(() => {
    if (session) {
      const refreshInterval = setInterval(() => {
        console.log('⏰ Auto-refresh da sessão')
        refreshSession()
      }, 50 * 60 * 1000) // 50 minutos

      return () => clearInterval(refreshInterval)
    }
  }, [session])

  // Verificar se a sessão está próxima do vencimento
  useEffect(() => {
    if (session) {
      const expiresAt = session.expires_at
      if (expiresAt) {
        const timeUntilExpiry = (expiresAt * 1000) - Date.now()
        
        // Se expira em menos de 5 minutos, renovar
        if (timeUntilExpiry < 5 * 60 * 1000) {
          console.log('⚠️ Sessão próxima do vencimento, renovando...')
          refreshSession()
        }
      }
    }
  }, [session])

  // Tela de carregamento inicial
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 mb-6 mx-auto">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Carregando Inscribo</h2>
          <p className="text-gray-600 mb-6">Verificando sua sessão...</p>
          
          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span>Verificando autenticação</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse delay-100"></div>
              <span>Carregando perfil</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse delay-200"></div>
              <span>Preparando dashboard</span>
            </div>
          </div>
          
          <button
            onClick={() => {
              console.log('🔄 Forçando limpeza de sessão...')
              clearAuthState()
              setInitializing(false)
              window.location.href = '/login'
            }}
            className="mt-8 px-6 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 hover:border-red-300 transition-colors"
          >
            Limpar Sessão e Relogar
          </button>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      initializing, 
      signIn, 
      signOut, 
      signUp, 
      refreshSession 
    }}>
      {children}
    </AuthContext.Provider>
  )
}