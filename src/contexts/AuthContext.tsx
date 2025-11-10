import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
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
        console.log('[AUTH] ✅ Cache restaurado')
        return JSON.parse(stored)
      }
    } catch {}
    return null
  })
  
  const [loading, setLoading] = useState(!user)
  const navigate = useNavigate()
  const hasNavigated = useRef(false)

  const saveUser = (userData: AppUser | null) => {
    try {
      if (userData) {
        localStorage.setItem(USER_KEY, JSON.stringify(userData))
      } else {
        localStorage.removeItem(USER_KEY)
      }
    } catch {}
  }

  const loadUser = async (email: string): Promise<AppUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      return error ? null : data
    } catch {
      return null
    }
  }

  // Verifica sessão no mount
  useEffect(() => {
    let mounted = true

    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!mounted) return

        if (!session?.user) {
          if (user) {
            setUser(null)
            saveUser(null)
          }
          setLoading(false)
          return
        }

        if (user && user.email === session.user.email) {
          setLoading(false)
          return
        }

        const userData = await loadUser(session.user.email)
        
        if (userData && mounted) {
          setUser(userData)
          saveUser(userData)
        }

        if (mounted) setLoading(false)
      } catch {
        if (mounted) setLoading(false)
      }
    }

    check()
    return () => { mounted = false }
  }, [])

  // Listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] Evento:', event)

        // Ignora TOKEN_REFRESHED
        if (event === 'TOKEN_REFRESHED') {
          return
        }

        // INICIAL_SESSION - se acabou de fazer login, navega
        if (event === 'INITIAL_SESSION' && session?.user) {
          // Se já tem usuário E ainda não navegou, navega!
          if (user && !hasNavigated.current) {
            console.log('[AUTH] 🚀 Navegando após INITIAL_SESSION')
            hasNavigated.current = true
            setTimeout(() => {
              navigate('/dashboard', { replace: true })
            }, 100)
          }
          return
        }

        // SIGNED_IN
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AUTH] ✅ Login detectado')
          
          const userData = await loadUser(session.user.email)
          
          if (userData) {
            setUser(userData)
            saveUser(userData)
            
            // Navega IMEDIATAMENTE
            if (!hasNavigated.current) {
              console.log('[AUTH] 🚀 Navegando para dashboard')
              hasNavigated.current = true
              setTimeout(() => {
                navigate('/dashboard', { replace: true })
              }, 100)
            }
          }
        }

        // SIGNED_OUT
        if (event === 'SIGNED_OUT') {
          console.log('[AUTH] 🚪 Logout')
          setUser(null)
          saveUser(null)
          hasNavigated.current = false
          navigate('/login', { replace: true })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [navigate, user])

  const signIn = async (email: string, password: string) => {
    console.log('[AUTH] 🔑 Login...')
    setLoading(true)
    hasNavigated.current = false // Reset flag
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (error: any) {
      console.error('[AUTH] ❌ Erro:', error.message)
      setLoading(false)
      throw error
    }
  }

  const signOut = async () => {
    console.log('[AUTH] 🚪 Logout...')
    await supabase.auth.signOut()
    setUser(null)
    saveUser(null)
    hasNavigated.current = false
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
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
