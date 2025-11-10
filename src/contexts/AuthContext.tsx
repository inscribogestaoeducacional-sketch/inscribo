import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, User as AppUser } from '../lib/supabase'

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const USER_KEY = 'inscribo_user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      if (stored) {
        console.log('[AUTH] ✅ Usuário restaurado do cache')
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('[AUTH] ❌ Erro ao restaurar cache:', e)
    }
    return null
  })
  
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const isCheckingSession = useRef(false)
  const isMounted = useRef(true)

  const saveUser = useCallback((userData: AppUser | null) => {
    try {
      if (userData) {
        localStorage.setItem(USER_KEY, JSON.stringify(userData))
        console.log('[AUTH] 💾 Cache salvo')
      } else {
        localStorage.removeItem(USER_KEY)
        console.log('[AUTH] 🗑️ Cache limpo')
      }
    } catch (e) {
      console.error('[AUTH] ❌ Erro ao salvar:', e)
    }
  }, [])

  const loadUser = useCallback(async (email: string): Promise<AppUser | null> => {
    try {
      console.log('[AUTH] 📊 Carregando usuário:', email)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      if (error) {
        console.error('[AUTH] ❌ Erro ao carregar:', error.message)
        return null
      }

      if (data) {
        console.log('[AUTH] ✅ Usuário carregado:', data.full_name)
        return data
      }

      return null
    } catch (e) {
      console.error('[AUTH] ❌ Exception:', e)
      return null
    }
  }, [])

  // Verifica sessão no mount
  useEffect(() => {
    if (!isMounted.current) return
    
    const checkSession = async () => {
      if (isCheckingSession.current) {
        console.log('[AUTH] ⏭️ Verificação já em andamento')
        return
      }

      isCheckingSession.current = true
      console.log('[AUTH] 🔍 Verificando sessão...')

      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!isMounted.current) return

        if (error) {
          console.error('[AUTH] ❌ Erro de sessão:', error.message)
          setUser(null)
          saveUser(null)
          setLoading(false)
          return
        }

        if (!session?.user) {
          console.log('[AUTH] ℹ️ Sem sessão ativa')
          if (user) {
            setUser(null)
            saveUser(null)
          }
          setLoading(false)
          return
        }

        console.log('[AUTH] ✅ Sessão válida:', session.user.email)

        // Se já tem usuário em cache e é o mesmo
        if (user && user.email === session.user.email) {
          console.log('[AUTH] ✅ Usando cache')
          setLoading(false)
          return
        }

        // Carrega usuário do banco
        const userData = await loadUser(session.user.email)
        
        if (userData && isMounted.current) {
          setUser(userData)
          saveUser(userData)
        } else if (isMounted.current) {
          setUser(null)
          saveUser(null)
        }

        if (isMounted.current) {
          setLoading(false)
        }
      } catch (e) {
        console.error('[AUTH] ❌ Erro na verificação:', e)
        if (isMounted.current) {
          setLoading(false)
        }
      } finally {
        isCheckingSession.current = false
      }
    }

    checkSession()

    return () => {
      isMounted.current = false
    }
  }, []) // Executa UMA VEZ

  // Listener de mudanças de autenticação
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] 🔔 Evento:', event)

        // Ignora eventos que não precisam de ação
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          console.log('[AUTH] ⏭️ Ignorando:', event)
          return
        }

        // Login bem-sucedido
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AUTH] ✅ Login detectado')
          setLoading(true)
          
          const userData = await loadUser(session.user.email)
          
          if (userData && isMounted.current) {
            setUser(userData)
            saveUser(userData)
            setLoading(false)
            
            // Pequeno delay para garantir que o estado atualizou
            setTimeout(() => {
              console.log('[AUTH] 🚀 Navegando para dashboard')
              navigate('/dashboard', { replace: true })
            }, 200)
          } else if (isMounted.current) {
            setLoading(false)
          }
        }

        // Logout
        if (event === 'SIGNED_OUT') {
          console.log('[AUTH] 🚪 Logout detectado')
          setUser(null)
          saveUser(null)
          setLoading(false)
          navigate('/login', { replace: true })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [navigate, loadUser, saveUser])

  const signIn = async (email: string, password: string) => {
    console.log('[AUTH] 🔑 Tentando login...')
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      
      console.log('[AUTH] ✅ Autenticação OK')
      
    } catch (error: any) {
      console.error('[AUTH] ❌ Erro de login:', error.message)
      setLoading(false)
      throw error
    }
  }

  const signOut = async () => {
    console.log('[AUTH] 🚪 Fazendo logout...')
    await supabase.auth.signOut()
    setUser(null)
    saveUser(null)
    setLoading(false)
    navigate('/login', { replace: true })
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
