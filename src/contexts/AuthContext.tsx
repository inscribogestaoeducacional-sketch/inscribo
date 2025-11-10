// ========================================
// AUTHCONTEXT FINAL CORRIGIDO
// Trata INITIAL_SESSION corretamente
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
  const initPromise = useRef<Promise<void> | null>(null)
  
  const navigate = useNavigate()

  // ========================================
  // CARREGAR USUÁRIO
  // ========================================
  const loadUserData = useCallback(async (email: string): Promise<boolean> => {
    if (isLoadingUser.current) {
      console.log('[AUTH] 🔒 Já carregando')
      return false
    }

    try {
      isLoadingUser.current = true
      console.log('[AUTH] 📊 Carregando:', email)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      if (!isMounted.current) return false

      if (error) {
        console.error('[AUTH] ❌ Erro:', error.message)
        throw error
      }

      if (data) {
        console.log('[AUTH] ✅ OK:', data.full_name)
        setUser(data)
        setInitializing(false) // ← IMPORTANTE!
        return true
      }

      setInitializing(false)
      return false
      
    } catch (error: any) {
      console.error('[AUTH] ❌ Exception:', error.message)
      setInitializing(false)
      return false
    } finally {
      isLoadingUser.current = false
      setLoading(false)
    }
  }, [])

  // ========================================
  // INICIALIZAÇÃO
  // ========================================
  useEffect(() => {
    if (hasInitialized.current) {
      return
    }

    if (initPromise.current) {
      return
    }

    let mounted = true

    const initialize = async () => {
      try {
        console.log('[AUTH] 🚀 Inicializando...')
        
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error('[AUTH] ❌ Erro sessão:', error.message)
          setInitializing(false)
          hasInitialized.current = true
          return
        }

        if (session?.user) {
          console.log('[AUTH] ✅ Sessão OK:', session.user.email)
          setSupabaseUser(session.user)
          
          const success = await loadUserData(session.user.email)
          
          if (success && mounted) {
            console.log('[AUTH] 🎉 Init OK!')
          }
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

    initPromise.current = initialize()

    return () => {
      mounted = false
      isMounted.current = false
    }
  }, [loadUserData])

  // ========================================
  // LISTENER - COM TRATAMENTO CORRETO
  // ========================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] 🔔', event)

        // CRÍTICO: Ignorar estes eventos
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          console.log('[AUTH] ⏭️ Ignorando:', event)
          return
        }

        // Login
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AUTH] ✅ Login OK')
          setSupabaseUser(session.user)
          
          const success = await loadUserData(session.user.email)
          
          if (success) {
            console.log('[AUTH] ➡️ Navegando...')
            // Delay maior para garantir
            setTimeout(() => {
              navigate('/dashboard', { replace: true })
            }, 500)
          }
        }
        
        // Logout
        else if (event === 'SIGNED_OUT') {
          console.log('[AUTH] 🚪 Logout')
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
    console.log('[AUTH] 🔑 Sign in...')
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
      console.error('[AUTH] ❌ Login error:', error.message)
      setInitializing(false)
      setLoading(false)
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    console.log('[AUTH] 🚪 Sign out...')
    await supabase.auth.signOut()
    setUser(null)
    setSupabaseUser(null)
    setInitializing(false)
    hasInitialized.current = false
    navigate('/login', { replace: true })
  }, [navigate])

  const refreshUser = useCallback(async () => {
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
