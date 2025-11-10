// ========================================
// AUTHCONTEXT ENTERPRISE - 100% ROBUSTO
// Sistema profissional sem falhas
// Arquivo: src/contexts/AuthContext.tsx
// ========================================

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
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
  
  // Controles robustos
  const isLoadingUser = useRef(false)
  const isMounted = useRef(true)
  const hasInitialized = useRef(false)
  const initPromise = useRef<Promise<void> | null>(null)
  
  const navigate = useNavigate()

  // ========================================
  // CARREGAR USUÁRIO - VERSÃO ROBUSTA
  // ========================================
  const loadUserData = useCallback(async (email: string): Promise<boolean> => {
    // Previne chamadas paralelas
    if (isLoadingUser.current) {
      console.log('[AUTH] 🔒 Bloqueado - já carregando')
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

      if (!isMounted.current) {
        console.log('[AUTH] ⚠️ Component unmounted')
        return false
      }

      if (error) {
        console.error('[AUTH] ❌ Query error:', error.message)
        
        // Se erro de autenticação, desloga
        if (error.message.includes('JWT') || error.message.includes('auth')) {
          console.log('[AUTH] 🚪 Erro de auth - deslogando')
          await supabase.auth.signOut()
          setUser(null)
          setSupabaseUser(null)
        }
        
        return false
      }

      if (data) {
        console.log('[AUTH] ✅ OK:', data.full_name)
        setUser(data)
        return true
      }

      console.warn('[AUTH] ⚠️ User not found')
      return false
      
    } catch (error: any) {
      console.error('[AUTH] ❌ Exception:', error.message)
      return false
    } finally {
      isLoadingUser.current = false
    }
  }, [])

  // ========================================
  // INICIALIZAÇÃO - UMA VEZ APENAS
  // ========================================
  useEffect(() => {
    // Se já inicializou, não faz nada
    if (hasInitialized.current) {
      console.log('[AUTH] ✋ Já inicializado - skip')
      return
    }

    // Se já tem uma inicialização rodando, não inicia outra
    if (initPromise.current) {
      console.log('[AUTH] ⏳ Init já em andamento - skip')
      return
    }

    let mounted = true

    const initialize = async () => {
      try {
        console.log('[AUTH] 🚀 Inicializando...')
        
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error('[AUTH] ❌ Session error:', error.message)
          setInitializing(false)
          hasInitialized.current = true
          return
        }

        if (session?.user) {
          console.log('[AUTH] ✅ Session OK:', session.user.email)
          setSupabaseUser(session.user)
          
          const success = await loadUserData(session.user.email)
          
          if (success && mounted) {
            console.log('[AUTH] 🎉 Init complete!')
          }
        } else {
          console.log('[AUTH] ℹ️ No session')
        }
        
        // SEMPRE seta false no final
        if (mounted) {
          setInitializing(false)
          hasInitialized.current = true
        }
        
      } catch (error: any) {
        console.error('[AUTH] ❌ Init error:', error.message)
        if (mounted) {
          setInitializing(false)
          hasInitialized.current = true
        }
      }
    }

    // Guarda promise para evitar dupla inicialização
    initPromise.current = initialize()

    return () => {
      mounted = false
      isMounted.current = false
    }
  }, []) // Array vazio - executa UMA VEZ

  // ========================================
  // LISTENER - OTIMIZADO
  // ========================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] 🔔', event)

        // CRÍTICO: Ignorar TOKEN_REFRESHED
        if (event === 'TOKEN_REFRESHED') {
          console.log('[AUTH] 🔄 Token refresh - IGNORANDO')
          return
        }

        // Login
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AUTH] ✅ Signed in')
          setSupabaseUser(session.user)
          
          const success = await loadUserData(session.user.email)
          
          if (success) {
            console.log('[AUTH] ➡️ → dashboard')
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
    hasInitialized.current = false
    navigate('/login', { replace: true })
  }, [navigate])

  const refreshUser = useCallback(async () => {
    console.log('[AUTH] 🔄 Manual refresh')
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
