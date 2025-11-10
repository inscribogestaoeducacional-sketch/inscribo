import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, User as AppUser } from '../lib/supabase'

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const USER_KEY = 'inscribo_user'
const SESSION_KEY = 'inscribo_session_active'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      const hasSession = localStorage.getItem(SESSION_KEY)
      
      if (stored && hasSession) {
        console.log('[AUTH] ✅ Restaurado do cache')
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('[AUTH] Erro ao restaurar:', e)
    }
    return null
  })
  
  const [loading, setLoading] = useState(!user)
  const navigate = useNavigate()
  const location = useLocation()

  const saveUser = (userData: AppUser | null) => {
    try {
      if (userData) {
        localStorage.setItem(USER_KEY, JSON.stringify(userData))
        localStorage.setItem(SESSION_KEY, 'true')
      } else {
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(SESSION_KEY)
      }
    } catch (e) {
      console.error('[AUTH] Erro ao salvar:', e)
    }
  }

  const loadUser = async (email: string): Promise<AppUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      if (error || !data) {
        console.error('[AUTH] Erro ao carregar:', error?.message)
        return null
      }

      return data
    } catch (e) {
      console.error('[AUTH] Exception:', e)
      return null
    }
  }

  // Verifica sessão no mount
  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error || !session?.user) {
          console.log('[AUTH] Sem sessão válida')
          
          // Se tinha usuário em cache mas sessão expirou
          if (user) {
            setUser(null)
            saveUser(null)
          }
          
          setLoading(false)
          return
        }

        console.log('[AUTH] Sessão válida:', session.user.email)

        // Se já tem usuário em cache do mesmo email
        if (user && user.email === session.user.email) {
          console.log('[AUTH] Usando cache')
          setLoading(false)
          return
        }

        // Carrega usuário do banco
        const userData = await loadUser(session.user.email)
        
        if (userData && mounted) {
          setUser(userData)
          saveUser(userData)
        }

        if (mounted) setLoading(false)
      } catch (e) {
        console.error('[AUTH] Erro na verificação:', e)
        if (mounted) setLoading(false)
      }
    }

    checkSession()

    return () => {
      mounted = false
    }
  }, [])

  // Listener de auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] Evento:', event)

        // Ignora eventos desnecessários
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          return
        }

        // Login
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AUTH] Login detectado')
          
          const userData = await loadUser(session.user.email)
          
          if (userData) {
            setUser(userData)
            saveUser(userData)
            
            // Aguarda um pouco antes de navegar
            setTimeout(() => {
              navigate('/dashboard', { replace: true })
            }, 100)
          }
        }

        // Logout
        if (event === 'SIGNED_OUT') {
          console.log('[AUTH] Logout detectado')
          setUser(null)
          saveUser(null)
          navigate('/login', { replace: true })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [navigate])

  // Previne navegação se não estiver autenticado
  useEffect(() => {
    if (!loading && !user && location.pathname !== '/login') {
      navigate('/login', { replace: true })
    }
  }, [loading, user, location.pathname, navigate])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      
    } catch (error: any) {
      console.error('[AUTH] Erro de login:', error.message)
      setLoading(false)
      throw error
    }
  }

  const signOut = async () => {
    console.log('[AUTH] Fazendo logout...')
    await supabase.auth.signOut()
    setUser(null)
    saveUser(null)
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
