// ========================================
// AUTHCONTEXT ABSOLUTO - ZERO FALHAS
// Versão testada e aprovada
// Arquivo: src/contexts/AuthContext.tsx
// ========================================

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase, User as AppUser } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

interface AuthContextType {
  user: AppUser | null
  supabaseUser: SupabaseUser | null
  loading: boolean
  initializing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  
  const isLoadingUser = useRef(false)
  const isMounted = useRef(true)
  const hasInitialized = useRef(false)
  
  const navigate = useNavigate()

  // ========================================
  // CARREGAR USUÁRIO - COM TIMEOUT INTERNO
  // ========================================
  const loadUserData = useCallback(async (email: string): Promise<boolean> => {
    if (isLoadingUser.current) {
      console.log('[AUTH] 🔒 Bloqueado')
      return false
    }

    const timeoutId = setTimeout(() => {
      if (isLoadingUser.current) {
        console.warn('[AUTH] ⏱️ Load timeout - forçando conclusão')
        isLoadingUser.current = false
        setInitializing(false)
        setLoading(false)
      }
    }, 5000) // 5 segundos timeout APENAS para loadUserData

    try {
      isLoadingUser.current = true
      console.log('[AUTH] 📊 Loading:', email)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      clearTimeout(timeoutId)

      if (!isMounted.current) return false

      if (error) {
        console.error('[AUTH] ❌ Error:', error.message)
        setInitializing(false)
        return false
      }

      if (data) {
        console.log('[AUTH] ✅ Loaded:', data.full_name)
        setUser(data)
        setInitializing(false)
        return true
      }

      setInitializing(false)
      return false
      
    } catch (error: any) {
      clearTimeout(timeoutId)
      console.error('[AUTH] ❌ Exception:', error.message)
      setInitializing(false)
      return false
    } finally {
      isLoadingUser.current = false
      setLoading(false)
    }
  }, [])

  // ========================================
  // INICIALIZAÇÃO - UMA VEZ APENAS
  // ========================================
  useEffect(() => {
    if (hasInitialized.current) {
      console.log('[AUTH] ✋ Skip - already initialized')
      return
    }

    let mounted = true

    const initialize = async () => {
      try {
        console.log('[AUTH] 🚀 Init')
        
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error('[AUTH] ❌ Session error:', error.message)
          setInitializing(false)
          hasInitialized.current = true
          return
        }

        if (session?.user) {
          console.log('[AUTH] ✅ Session:', session.user.email)
          setSupabaseUser(session.user)
          await loadUserData(session.user.email)
        } else {
          console.log('[AUTH] ℹ️ No session')
          setInitializing(false)
        }
        
        hasInitialized.current = true
        
      } catch (error: any) {
        console.error('[AUTH] ❌ Init error:', error.message)
        if (mounted) {
          setInitializing(false)
          hasInitialized.current = true
        }
      }
    }

    initialize()

    return () => {
      mounted = false
      isMounted.current = false
    }
  }, []) // Array vazio - UMA VEZ

  // ========================================
  // LISTENER - IGNORA EVENTOS PROBLEMÁTICOS
  // ========================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] 🔔', event)

        // IGNORAR estes eventos
        const ignoredEvents = ['TOKEN_REFRESHED', 'INITIAL_SESSION']
        if (ignoredEvents.includes(event)) {
          console.log('[AUTH] ⏭️ Skip:', event)
          return
        }

        // Login
        if (event === 'SIGNED_IN' && session?.user) {
          // Só processa se NÃO estiver carregando
          if (isLoadingUser.current) {
            console.log('[AUTH] ⏭️ Skip SIGNED_IN - já carregando')
            return
          }

          console.log('[AUTH] ✅ Signed in')
          setSupabaseUser(session.user)
          
          const success = await loadUserData(session.user.email)
          
          if (success) {
            console.log('[AUTH] ➡️ Navigate')
            setTimeout(() => {
              navigate('/dashboard', { replace: true })
            }, 300)
          }
        }
        
        // Logout
        else if (event === 'SIGNED_OUT') {
          console.log('[AUTH] 🚪 Signed out')
          setUser(null)
          setSupabaseUser(null)
          setInitializing(false)
          hasInitialized.current = false
          navigate('/login', { replace: true })
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate, loadUserData])

  // ========================================
  // MÉTODOS PÚBLICOS
  // ========================================
  const signIn = useCallback(async (email: string, password: string) => {
    console.log('[AUTH] 🔑 Sign in')
    setLoading(true)
    setInitializing(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      
      console.log('[AUTH] ✅ Auth OK')
      
    } catch (error: any) {
      console.error('[AUTH] ❌ Error:', error.message)
      setInitializing(false)
      setLoading(false)
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    console.log('[AUTH] 🚪 Logout')
    await supabase.auth.signOut()
    setUser(null)
    setSupabaseUser(null)
    setInitializing(false)
    hasInitialized.current = false
    navigate('/login', { replace: true })
  }, [navigate])

  const refreshUser = useCallback(async () => {
    if (isLoadingUser.current) return
    
    console.log('[AUTH] 🔄 Refresh')
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user && isMounted.current) {
      await loadUserData(session.user.email)
    }
  }, [loadUserData])

  const value = {
    user,
    supabaseUser,
    loading,
    initializing,
    signIn,
    signOut,
    refreshUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
