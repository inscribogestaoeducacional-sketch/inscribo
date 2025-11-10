// ========================================
// AUTHCONTEXT PROFISSIONAL
// Com localStorage e token persistente
// Arquivo: src/contexts/AuthContext.tsx
// ========================================

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, User as AppUser } from '../lib/supabase'

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Keys do localStorage
const USER_KEY = 'inscribo_user'
const SESSION_KEY = 'inscribo_session'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    // Restaura usuário do localStorage
    try {
      const stored = localStorage.getItem(USER_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // ========================================
  // SALVAR NO LOCALSTORAGE
  // ========================================
  const saveUser = (userData: AppUser | null) => {
    try {
      if (userData) {
        localStorage.setItem(USER_KEY, JSON.stringify(userData))
        localStorage.setItem(SESSION_KEY, 'active')
      } else {
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(SESSION_KEY)
      }
    } catch (e) {
      console.error('[AUTH] Storage error:', e)
    }
  }

  // ========================================
  // CARREGAR USUÁRIO DO BANCO
  // ========================================
  const loadUser = async (email: string): Promise<AppUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      if (error || !data) {
        console.error('[AUTH] Load error:', error?.message)
        return null
      }

      return data
    } catch (e) {
      console.error('[AUTH] Exception:', e)
      return null
    }
  }

  // ========================================
  // VERIFICAR SESSÃO NO MOUNT
  // ========================================
  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      try {
        // Verifica sessão do Supabase
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error || !session?.user) {
          // Sem sessão válida - limpa tudo
          if (user) {
            console.log('[AUTH] Session expired - clearing')
            setUser(null)
            saveUser(null)
          }
          setLoading(false)
          return
        }

        // Tem sessão - verifica se precisa atualizar user
        if (!user || user.email !== session.user.email) {
          console.log('[AUTH] Loading user data')
          const userData = await loadUser(session.user.email)
          
          if (userData && mounted) {
            setUser(userData)
            saveUser(userData)
          }
        }
        
        setLoading(false)
      } catch (e) {
        console.error('[AUTH] Check error:', e)
        if (mounted) setLoading(false)
      }
    }

    checkSession()

    return () => {
      mounted = false
    }
  }, []) // Executa UMA VEZ

  // ========================================
  // LISTENER DE AUTH STATE
  // ========================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] Event:', event)

        // Ignora token refresh
        if (event === 'TOKEN_REFRESHED') {
          return
        }

        // Login
        if (event === 'SIGNED_IN' && session?.user) {
          const userData = await loadUser(session.user.email)
          if (userData) {
            setUser(userData)
            saveUser(userData)
            navigate('/dashboard', { replace: true })
          }
        }

        // Logout
        if (event === 'SIGNED_OUT') {
          setUser(null)
          saveUser(null)
          navigate('/login', { replace: true })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [navigate])

  // ========================================
  // MÉTODOS PÚBLICOS
  // ========================================
  const signIn = async (email: string, password: string) => {
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      
      // O listener vai cuidar do resto
      
    } catch (error: any) {
      console.error('[AUTH] Login error:', error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
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
