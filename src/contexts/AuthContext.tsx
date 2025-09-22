import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

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
  loading: boolean
  session: any
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
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [showTimeout, setShowTimeout] = useState(false)

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    const initializeAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticação...')
        
        // Timeout para mostrar botão de força
        timeoutId = setTimeout(() => {
          if (mounted && initializing) {
            console.log('⏰ Timeout de inicialização - mostrando botão forçar')
            setShowTimeout(true)
          }
        }, 3000) // 3 segundos
        
        // Get current session
        const { data: { session: currentSession }, error } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (error) {
          console.error('❌ Erro na sessão:', error)
          setSession(null)
          setUser(null)
        } else {
          console.log('✅ Sessão carregada:', !!currentSession)
          setSession(currentSession)
          
          if (currentSession?.user) {
            await loadUserProfile(currentSession.user.id)
          } else {
            setUser(null)
          }
        }
      } catch (error) {
        console.error('❌ Erro na inicialização:', error)
        if (mounted) {
          setSession(null)
          setUser(null)
        }
      } finally {
        if (mounted) {
          console.log('✅ Inicialização concluída')
          setInitializing(false)
          if (timeoutId) clearTimeout(timeoutId)
        }
      }
    }

    // Initialize auth
    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('🔄 Auth state changed:', event, !!session)
      
      setSession(session)

      if (session?.user) {
        await loadUserProfile(session.user.id)
      } else {
        setUser(null)
      }
      
      // Clear initialization state on auth change
      if (initializing) {
        setInitializing(false)
        setShowTimeout(false)
        if (timeoutId) clearTimeout(timeoutId)
      }
    })

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const loadUserProfile = async (userId: string) => {
    try {
      console.log('👤 Carregando perfil do usuário:', userId)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Erro ao carregar perfil:', error)
        
        if (error.code === 'PGRST116') {
          // User doesn't exist in users table, create it
          const { data: { user: authUser } } = await supabase.auth.getUser()
          
          if (authUser) {
            console.log('🆕 Criando perfil do usuário...')
            const newUserData = {
              id: authUser.id,
              email: authUser.email!,
              full_name: authUser.user_metadata?.full_name || authUser.email!.split('@')[0],
              role: (authUser.user_metadata?.role || 'admin') as 'admin' | 'manager' | 'user',
              institution_id: null,
              active: true
            }

            const { data: createdUser, error: createError } = await supabase
              .from('users')
              .insert(newUserData)
              .select()
              .single()

            if (!createError && createdUser) {
              console.log('✅ Perfil criado com sucesso')
              setUser(createdUser)
            } else {
              console.error('❌ Erro ao criar perfil:', createError)
              setUser(null)
            }
          }
        } else {
          setUser(null)
        }
      } else if (data) {
        console.log('✅ Perfil carregado com sucesso')
        setUser(data)
      }
    } catch (error) {
      console.error('❌ Erro no carregamento do perfil:', error)
      setUser(null)
    }
  }

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error
      
      if (data.session) {
        setSession(data.session)
        if (data.session.user) {
          await loadUserProfile(data.session.user.id)
        }
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar sessão:', error)
      setSession(null)
      setUser(null)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log('🔐 Tentando fazer login:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error('❌ Erro no login:', error)
        throw new Error(error.message)
      }

      console.log('✅ Login realizado com sucesso')
      // The onAuthStateChange will handle setting the user
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
      console.log('🚪 Fazendo logout...')
      
      // Clear local state first
      setSession(null)
      setUser(null)
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Erro no logout:', error)
      } else {
        console.log('✅ Logout realizado com sucesso')
      }
    } catch (error) {
      console.error('❌ Erro no logout:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => {
    try {
      setLoading(true)
      console.log('📝 Tentando criar conta:', email)
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role
          }
        }
      })

      if (authError) {
        console.error('❌ Erro ao criar conta:', authError)
        throw authError
      }

      if (authData.user) {
        console.log('✅ Conta criada com sucesso')
        throw new Error('Conta criada com sucesso! Faça login com suas credenciais.')
      }
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const forceLogin = () => {
    console.log('🔄 Forçando ir para login...')
    setUser(null)
    setSession(null)
    setInitializing(false)
    setShowTimeout(false)
    setLoading(false)
  }

  // Show loading during initialization
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm mb-4">Inicializando sistema...</p>
          
          {showTimeout && (
            <div className="mt-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sistema Demorou para Carregar</h3>
              <p className="text-gray-600 text-sm mb-4">
                O sistema está demorando mais que o esperado. Clique no botão abaixo para ir direto ao login.
              </p>
              <button
                onClick={forceLogin}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Forçar Login
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loading, session, signIn, signOut, signUp, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}