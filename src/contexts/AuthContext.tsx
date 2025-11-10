// ========================================
// AUTHCONTEXT DEFINITIVO - SEM TIMEOUT
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
  
  const navigate = useNavigate()

  // ========================================
  // CARREGAR DADOS DO USUÁRIO
  // ========================================
  const loadUserData = useCallback(async (email: string): Promise<boolean> => {
    if (isLoadingUser.current) {
      console.log('[AUTH] Já carregando - aguardando...')
      return false
    }

    try {
      isLoadingUser.current = true
      console.log('[AUTH] 📊 Carregando dados:', email)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      if (!isMounted.current) return false

      if (error) {
        console.error('[AUTH] ❌ Erro:', error)
        throw error
      }

      if (data) {
        console.log('[AUTH] ✅ Carregado:', data.full_name)
        setUser(data)
        setInitializing(false) // ← AQUI que seta false, não no timeout!
        return true
      }

      setInitializing(false)
      return false
    } catch (error) {
      console.error('[AUTH] ❌ Erro crítico:', error)
      if (isMounted.current) {
        await supabase.auth.signOut()
        setUser(null)
        setSupabaseUser(null)
        setInitializing(false)
      }
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
    let mounted = true

    async function initializeAuth() {
      try {
        console.log('[AUTH] 🔐 Inicializando...')
        
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error('[AUTH] ❌ Erro sessão:', error)
          setInitializing(false)
          return
        }

        if (session?.user) {
          console.log('[AUTH] ✅ Sessão encontrada:', session.user.email)
          setSupabaseUser(session.user)
          await loadUserData(session.user.email)
        } else {
          console.log('[AUTH] ℹ️ Sem sessão')
          setInitializing(false)
        }
      } catch (error) {
        console.error('[AUTH] ❌ Erro init:', error)
        if (mounted) {
          setInitializing(false)
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
      isMounted.current = false
    }
  }, [loadUserData])

  // ========================================
  // LISTENER DE AUTH
  // ========================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] 🔔 Evento:', event)

        // Ignorar refresh (CRÍTICO)
        if (event === 'TOKEN_REFRESHED') {
          console.log('[AUTH] 🔄 Token OK - mantendo')
          return
        }

        // Login
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AUTH] ✅ Login OK')
          setSupabaseUser(session.user)
          
          const success = await loadUserData(session.user.email)
          
          if (success) {
            console.log('[AUTH] ➡️ Redirecionando...')
            // Aguarda render cycle completar
            setTimeout(() => {
              navigate('/dashboard', { replace: true })
            }, 200)
          }
        }
        
        // Logout
        else if (event === 'SIGNED_OUT') {
          console.log('[AUTH] 🚪 Logout')
          setUser(null)
          setSupabaseUser(null)
          setInitializing(false)
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
    console.log('[AUTH] 🔑 Login...')
    setLoading(true)
    setInitializing(true) // ← Seta true para mostrar loading
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      
      console.log('[AUTH] ✅ Autenticado')
      
    } catch (error: any) {
      console.error('[AUTH] ❌ Erro login:', error.message)
      setInitializing(false)
      setLoading(false)
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    console.log('[AUTH] 🚪 Saindo...')
    await supabase.auth.signOut()
    setUser(null)
    setSupabaseUser(null)
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
