import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => Promise<void>
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
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    // Verificar sessão inicial
    checkSession()

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth event:', event)
      
      if (session?.user) {
        await loadUserProfile(session.user.id)
      } else {
        setUser(null)
      }
      
      setInitializing(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        await loadUserProfile(session.user.id)
      }
    } catch (error) {
      console.error('❌ Erro ao verificar sessão:', error)
    } finally {
      setInitializing(false)
    }
  }

  const loadUserProfile = async (userId: string) => {
    try {
      console.log('👤 Carregando perfil:', userId)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Erro ao carregar perfil:', error)
        
        // Se usuário não existe, criar perfil básico
        if (error.code === 'PGRST116') {
          const { data: { user: authUser } } = await supabase.auth.getUser()
          
          if (authUser) {
            const newUser = {
              id: authUser.id,
              email: authUser.email!,
              full_name: authUser.user_metadata?.full_name || authUser.email!.split('@')[0],
              role: 'admin' as const,
              institution_id: '00000000-0000-0000-0000-000000000000', // ID temporário
              active: true
            }

            const { data: createdUser, error: createError } = await supabase
              .from('users')
              .insert(newUser)
              .select()
              .single()

            if (!createError && createdUser) {
              console.log('✅ Perfil criado')
              setUser(createdUser)
              return
            }
          }
        }
        
        setUser(null)
      } else if (data) {
        console.log('✅ Perfil carregado')
        setUser(data)
      }
    } catch (error) {
      console.error('❌ Erro no perfil:', error)
      setUser(null)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log('🔐 Fazendo login:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error('❌ Erro no login:', error)
        throw new Error(error.message)
      }

      if (data.user) {
        console.log('✅ Login OK, carregando perfil...')
        await loadUserProfile(data.user.id)
        console.log('✅ Login completo!')
        
        // Redirecionamento forçado
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 100)
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
      setUser(null)
      
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Erro no logout:', error)
      }
      
      window.location.href = '/login'
    } catch (error) {
      console.error('❌ Erro no logout:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => {
    try {
      setLoading(true)
      
      const { error } = await supabase.auth.signUp({
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
      
      throw new Error('Conta criada! Faça login com suas credenciais.')
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Tela de carregamento inicial
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando sistema...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, signUp }}>
      {children}
    </AuthContext.Provider>
  )
}