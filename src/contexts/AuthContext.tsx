import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DatabaseService } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AppUser {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
  active: boolean
  institution_name?: string
  is_super_admin?: boolean
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

  // Listener para storage changes (sincronização entre abas)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'inscribo-auth-token') {
        console.log('🔄 Mudança detectada no storage, sincronizando...')
        if (e.newValue) {
          // Nova sessão detectada em outra aba
          const sessionData = JSON.parse(e.newValue)
          setSession(sessionData)
          if (sessionData.user) {
            loadUserProfile(sessionData.user.id)
          }
        } else {
          // Sessão removida em outra aba
          clearAuthState()
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const initializeAuth = async () => {
    try {
      console.log('🔍 Verificando sessão existente...')
      
      // 1. Tentar recuperar sessão do localStorage primeiro
      const cachedSession = localStorage.getItem('inscribo-auth-token')
      const cachedUser = localStorage.getItem('inscribo-user')
      
      if (cachedSession && cachedUser) {
        try {
          const sessionData = JSON.parse(cachedSession)
          const userData = JSON.parse(cachedUser)
          
          // Verificar se a sessão não expirou
          const expiresAt = sessionData.expires_at * 1000
          const now = Date.now()
          
          if (expiresAt > now) {
            console.log('✅ Sessão válida encontrada no cache')
            setSession(sessionData)
            setUser(userData)
            setInitializing(false)
            return
          } else {
            console.log('⏰ Sessão em cache expirada, removendo...')
            localStorage.removeItem('inscribo-auth-token')
            localStorage.removeItem('inscribo-user')
          }
        } catch (parseError) {
          console.error('❌ Erro ao parsear cache:', parseError)
          localStorage.removeItem('inscribo-auth-token')
          localStorage.removeItem('inscribo-user')
        }
      }
      
      // 2. Verificar sessão atual no Supabase
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ Erro ao verificar sessão:', sessionError)
        clearAuthState()
        return
      }

      if (currentSession?.user) {
        console.log('✅ Sessão ativa encontrada no Supabase:', currentSession.user.email)
        setSession(currentSession)
        
        // Salvar no localStorage
        localStorage.setItem('inscribo-auth-token', JSON.stringify(currentSession))
        
        await loadUserProfile(currentSession.user.id)
      } else {
        console.log('ℹ️ Nenhuma sessão ativa encontrada')
        clearAuthState()
      }

      // 3. Configurar listener para mudanças de auth
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log('🔄 Auth state change:', event, newSession?.user?.email)
        
        switch (event) {
          case 'SIGNED_IN':
            console.log('✅ Usuário logado')
            setSession(newSession)
            if (newSession) {
              localStorage.setItem('inscribo-auth-token', JSON.stringify(newSession))
              if (newSession.user) {
                await loadUserProfile(newSession.user.id)
              }
            }
            break
            
          case 'SIGNED_OUT':
            console.log('🚪 Usuário deslogado')
            clearAuthState()
            break
            
          case 'TOKEN_REFRESHED':
            console.log('🔄 Token renovado')
            setSession(newSession)
            if (newSession) {
              localStorage.setItem('inscribo-auth-token', JSON.stringify(newSession))
            }
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
      
      // First check if user is super admin
      const { data: authUser } = await supabase.auth.getUser()
      const userEmail = authUser.user?.email
      
      if (userEmail) {
        console.log('📧 Email do usuário:', userEmail)
        const isSuperAdmin = await DatabaseService.isSuperAdmin(userEmail)
        console.log('🔍 É super admin?', isSuperAdmin)
        
        if (isSuperAdmin) {
          console.log('🛡️ Super Admin detectado:', userEmail)
          const { data: superAdminData } = await supabase
            .from('super_admins')
            .select('*')
            .eq('email', userEmail)
            .single()

          if (superAdminData) {
            console.log('✅ Dados do super admin carregados:', superAdminData)
            setUser({
              id: superAdminData.id,
              full_name: superAdminData.full_name,
              email: superAdminData.email,
              role: 'admin',
              institution_id: 'super-admin',
              active: superAdminData.active,
              is_super_admin: true,
              institution_name: 'Inscribo - Super Admin'
            })
            localStorage.setItem('inscribo-user', JSON.stringify({
              id: superAdminData.id,
              full_name: superAdminData.full_name,
              email: superAdminData.email,
              role: 'admin',
              institution_id: 'super-admin',
              active: superAdminData.active,
              is_super_admin: true,
              institution_name: 'Inscribo - Super Admin'
            }))
            return
          }
        }
      }
      
      // Regular user lookup
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          institutions(name)
        `)
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
        const userWithInstitution = {
          ...userData,
          institution_name: (userData as any).institutions?.name,
          is_super_admin: false
        }
        setUser(userWithInstitution)
        
        // Salvar dados do usuário no localStorage para recuperação rápida
        localStorage.setItem('inscribo-user', JSON.stringify(userWithInstitution))
      }
    } catch (error) {
      console.error('❌ Erro ao carregar perfil:', error)
      
      // Em caso de erro de rede, tentar recuperar do localStorage
      const cachedUser = localStorage.getItem('inscribo-user')
      if (cachedUser) {
        try {
          const parsedUser = JSON.parse(cachedUser)
          console.log('🔄 Usando dados em cache:', parsedUser.full_name)
          setUser(parsedUser)
          return
        } catch (parseError) {
          console.error('❌ Erro ao parsear cache:', parseError)
          localStorage.removeItem('inscribo-user')
        }
      }
      
      setUser(null)
    }
  }

  const clearAuthState = () => {
    console.log('🧹 Limpando estado de autenticação')
    setUser(null)
    setSession(null)
    localStorage.removeItem('inscribo-user')
    localStorage.removeItem('inscribo-auth-token')
    localStorage.removeItem('inscribo-session')
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log('🔐 Iniciando login:', email)
      
      // Verificar se é super admin ANTES do login
      const isSuperAdmin = email === 'admin@inscribo.com'
      
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
        
        // Salvar sessão no localStorage imediatamente
        localStorage.setItem('inscribo-auth-token', JSON.stringify(data.session))
        
        if (isSuperAdmin) {
          // Para super admin, criar perfil especial
          const superAdminUser = {
            id: data.user!.id,
            full_name: 'Super Admin',
            email: email,
            role: 'admin' as const,
            institution_id: 'super-admin',
            active: true,
            is_super_admin: true,
            institution_name: 'Inscribo - Super Admin'
          }
          setUser(superAdminUser)
          localStorage.setItem('inscribo-user', JSON.stringify(superAdminUser))
        } else if (data.user) {
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
        
        // Tentar recuperar do localStorage se falhar
        const cachedSession = localStorage.getItem('inscribo-auth-token')
        const cachedUser = localStorage.getItem('inscribo-user')
        
        if (cachedSession && cachedUser) {
          try {
            const sessionData = JSON.parse(cachedSession)
            const userData = JSON.parse(cachedUser)
            
            // Verificar se ainda não expirou
            const expiresAt = sessionData.expires_at * 1000
            if (expiresAt > Date.now()) {
              console.log('🔄 Usando sessão em cache')
              setSession(sessionData)
              setUser(userData)
              return
            }
          } catch (parseError) {
            console.error('❌ Erro ao parsear cache:', parseError)
          }
        }
        
        clearAuthState()
        return
      }

      if (refreshedSession) {
        console.log('✅ Sessão renovada')
        setSession(refreshedSession)
        localStorage.setItem('inscribo-auth-token', JSON.stringify(refreshedSession))
        
        if (refreshedSession.user) {
          await loadUserProfile(refreshedSession.user.id)
        }
      }
    } catch (error) {
      console.error('❌ Erro ao renovar sessão:', error)
      
      // Fallback para dados em cache
      const cachedUser = localStorage.getItem('inscribo-user')
      if (cachedUser) {
        try {
          const userData = JSON.parse(cachedUser)
          console.log('🔄 Mantendo usuário em cache durante erro de rede')
          setUser(userData)
          return
        } catch (parseError) {
          console.error('❌ Erro ao parsear cache de usuário:', parseError)
        }
      }
      
      clearAuthState()
    }
  }

  // Auto-refresh da sessão a cada 45 minutos (tokens expiram em 1 hora)
  useEffect(() => {
    if (session) {
      const refreshInterval = setInterval(() => {
        console.log('⏰ Auto-refresh da sessão')
        refreshSession()
      }, 45 * 60 * 1000) // 45 minutos

      return () => clearInterval(refreshInterval)
    }
  }, [session])

  // Verificar se a sessão está próxima do vencimento
  useEffect(() => {
    if (session) {
      const expiresAt = session.expires_at
      if (expiresAt) {
        const timeUntilExpiry = (expiresAt * 1000) - Date.now()
        
        // Se expira em menos de 10 minutos, renovar
        if (timeUntilExpiry < 10 * 60 * 1000) {
          console.log('⚠️ Sessão próxima do vencimento, renovando...')
          refreshSession()
        }
      }
    }
  }, [session])

  // Heartbeat para manter sessão ativa
  useEffect(() => {
    if (session && user) {
      const heartbeat = setInterval(() => {
        // Fazer uma pequena query para manter a conexão ativa
        supabase.from('users').select('id').eq('id', user.id).limit(1)
          .then(() => console.log('💓 Heartbeat - sessão ativa'))
          .catch(error => console.warn('⚠️ Heartbeat falhou:', error))
      }, 5 * 60 * 1000) // A cada 5 minutos

      return () => clearInterval(heartbeat)
    }
  }, [session, user])

  // Tela de carregamento inicial mais rápida
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 mb-6 mx-auto">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Inscribo</h2>
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
              <span>Preparando sistema</span>
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
