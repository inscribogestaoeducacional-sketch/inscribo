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
        
        // Se usuário não existe na tabela users, isso é normal
        // Os usuários são criados dentro do sistema, não automaticamente
        console.log('ℹ️ Usuário não encontrado na tabela users - isso é esperado')
        
        // Em caso de erro de rede, não limpa o usuário imediatamente
        if (error.message && error.message.includes('Failed to fetch')) {
          console.error('🌐 Erro de conexão - mantendo estado atual')
          setInitializing(false)
          return
        }
        
        console.log('ℹ️ Usuário não tem perfil no sistema ainda')
        setUser(null)
        setInitializing(false)
      } else if (data) {
        console.log('✅ Perfil carregado')
        setUser(data)
        setInitializing(false)
      }
    } catch (error) {
      console.error('❌ Erro no perfil:', error)
      
      // If it's a network error, show helpful message
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('🌐 Erro de conexão com Supabase. Verifique:')
        console.error('1. Variáveis de ambiente (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)')
        console.error('2. Conexão com internet')
        console.error('3. Status do projeto Supabase')
        
        // Não limpa usuário em erro de rede - permite usar botão "Forçar Login"
        setInitializing(false)
        return
      }
      
      setUser(null)
      setInitializing(false)
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
        // Não chama loadUserProfile aqui - deixa o onAuthStateChange fazer isso
        console.log('✅ Login completo, aguardando carregamento do perfil...')
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
      console.log('🚪 Fazendo logout forçado...')
      setUser(null)
      
      // Limpa localStorage
      localStorage.clear()
      
      // Limpa sessionStorage
      sessionStorage.clear()
      
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Erro no logout:', error)
      }
      
      console.log('✅ Logout completo, redirecionando...')
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
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 hover:border-red-300 transition-colors"
          >
            Forçar Novo Login
          </button>
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