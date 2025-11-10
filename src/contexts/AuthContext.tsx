// ========================================
// AUTHCONTEXT FINAL - SOLUÇÃO COMPLETA
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
  const hasCompletedInit = useRef(false)
  
  const navigate = useNavigate()

  // ========================================
  // CARREGAR DADOS DO USUÁRIO
  // ========================================
  const loadUserData = useCallback(async (email: string): Promise<boolean> => {
    if (isLoadingUser.current) {
      console.log('[AUTH] Já está carregando - ignorando')
      return false
    }

    try {
      isLoadingUser.current = true
      console.log('[AUTH] Carregando dados:', email)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      if (!isMounted.current) return false

      if (error) {
        console.error('[AUTH] Erro ao carregar:', error)
        throw error
      }

      if (data) {
        console.log('[AUTH] ✅ Usuário carregado:', data.full_name)
        setUser(data)
        return true
      }

      return false
    } catch (error) {
      console.error('[AUTH] ❌ Erro crítico:', error)
      if (isMounted.current) {
        await supabase.auth.signOut()
        setUser(null)
        setSupabaseUser(null)
      }
      return false
    } finally {
      isLoadingUser.current = false
      if (isMounted.current) {
        setLoading(false)
        setInitializing(false)
        hasCompletedInit.current = true
      }
    }
  }, [])

  // ========================================
  // INICIALIZAÇÃO - UMA VEZ APENAS
  // ========================================
  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    async function initializeAuth() {
      // Timeout de segurança de 8 segundos
      timeoutId = setTimeout(() => {
        if (mounted && !hasCompletedInit.current) {
          console.warn('[AUTH] ⏱️ Timeout - forçando conclusão')
          setInitializing(false)
          hasCompletedInit.current = true
        }
      }, 8000)

      try {
        console.log('[AUTH] 🔐 Inicializando...')
        
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error('[AUTH] ❌ Erro ao obter sessão:', error)
          setInitializing(false)
          hasCompletedInit.current = true
          return
        }

        if (session?.user) {
          console.log('[AUTH] ✅ Sessão ativa:', session.user.email)
          setSupabaseUser(session.user)
          const success = await loadUserData(session.user.email)
          
          if (success && mounted) {
            console.log('[AUTH] ✅ Inicialização completa')
          }
        } else {
          console.log('[AUTH] ℹ️ Sem sessão ativa')
          setInitializing(false)
          hasCompletedInit.current = true
        }
      } catch (error) {
        console.error('[AUTH] ❌ Erro na inicialização:', error)
        if (mounted) {
          setInitializing(false)
          hasCompletedInit.current = true
        }
      } finally {
        clearTimeout(timeoutId)
      }
    }

    initializeAuth()

    return () => {
      mounted = false
      isMounted.current = false
      clearTimeout(timeoutId)
    }
  }, [loadUserData])

  // ========================================
  // LISTENER DE AUTH
  // ========================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] 🔔 Evento:', event)

        // Ignorar refresh de token (CRÍTICO!)
        if (event === 'TOKEN_REFRESHED') {
          console.log('[AUTH] 🔄 Token atualizado - mantendo estado')
          return
        }

        // Login
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AUTH] ✅ Login detectado')
          setSupabaseUser(session.user)
          
          const success = await loadUserData(session.user.email)
          
          if (success) {
            console.log('[AUTH] ➡️ Redirecionando para dashboard...')
            // Pequeno delay para garantir que o estado atualizou
            setTimeout(() => {
              navigate('/dashboard', { replace: true })
            }, 100)
          }
        }
        
        // Logout
        else if (event === 'SIGNED_OUT') {
          console.log('[AUTH] 🚪 Logout detectado')
          setUser(null)
          setSupabaseUser(null)
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
    console.log('[AUTH] 🔑 Tentando login...')
    setLoading(true)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      
      console.log('[AUTH] ✅ Login bem-sucedido')
      
      // O listener onAuthStateChange vai cuidar do resto
      
    } catch (error: any) {
      console.error('[AUTH] ❌ Erro no login:', error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    console.log('[AUTH] 🚪 Fazendo logout...')
    await supabase.auth.signOut()
    setUser(null)
    setSupabaseUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const refreshUser = useCallback(async () => {
    console.log('[AUTH] 🔄 Refresh manual')
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
