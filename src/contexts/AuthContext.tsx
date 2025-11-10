// ========================================
// AUTHCONTEXT FINAL - COM TIMEOUT INTELIGENTE
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
  const safetyTimeoutRef = useRef<NodeJS.Timeout>()
  
  const navigate = useNavigate()

  // ========================================
  // TIMEOUT DE SEGURANÇA (10s)
  // Só ativa se realmente travar
  // ========================================
  useEffect(() => {
    // Timeout de SEGURANÇA de 10 segundos
    // Só serve para caso algo dê muito errado
    safetyTimeoutRef.current = setTimeout(() => {
      if (initializing && isMounted.current) {
        console.warn('[AUTH] ⚠️ TIMEOUT DE SEGURANÇA - Forçando conclusão')
        setInitializing(false)
        
        // Se não tem usuário, vai para login
        if (!user) {
          console.log('[AUTH] ➡️ Sem usuário - redirecionando para login')
          navigate('/login', { replace: true })
        }
      }
    }, 10000)

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current)
      }
    }
  }, [initializing, user, navigate])

  // ========================================
  // CARREGAR DADOS DO USUÁRIO
  // ========================================
  const loadUserData = useCallback(async (email: string): Promise<boolean> => {
    if (isLoadingUser.current) {
      console.log('[AUTH] ⏳ Já carregando - aguardando...')
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
        console.error('[AUTH] ❌ Erro na query:', error.message)
        throw error
      }

      if (data) {
        console.log('[AUTH] ✅ Usuário carregado:', data.full_name)
        setUser(data)
        setInitializing(false)
        
        // Limpa timeout de segurança
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current)
        }
        
        return true
      }

      console.warn('[AUTH] ⚠️ Usuário não encontrado')
      setInitializing(false)
      return false
      
    } catch (error: any) {
      console.error('[AUTH] ❌ Erro crítico:', error.message)
      
      if (isMounted.current) {
        // Em caso de erro, desloga
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
          console.error('[AUTH] ❌ Erro ao obter sessão:', error.message)
          setInitializing(false)
          return
        }

        if (session?.user) {
          console.log('[AUTH] ✅ Sessão ativa:', session.user.email)
          setSupabaseUser(session.user)
          
          const success = await loadUserData(session.user.email)
          
          if (success) {
            console.log('[AUTH] 🎉 Inicialização completa!')
          }
        } else {
          console.log('[AUTH] ℹ️ Sem sessão ativa')
          setInitializing(false)
        }
      } catch (error: any) {
        console.error('[AUTH] ❌ Erro na inicialização:', error.message)
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
            setTimeout(() => {
              navigate('/dashboard', { replace: true })
            }, 200)
          }
        }
        
        // Logout
        else if (event === 'SIGNED_OUT') {
          console.log('[AUTH] 🚪 Logout detectado')
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
    console.log('[AUTH] 🔑 Tentando login...')
    setLoading(true)
    setInitializing(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      
      console.log('[AUTH] ✅ Login bem-sucedido')
      
    } catch (error: any) {
      console.error('[AUTH] ❌ Erro no login:', error.message)
      setInitializing(false)
      setLoading(false)
      throw error
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
    console.log('[AUTH] 🔄 Refresh manual solicitado')
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
