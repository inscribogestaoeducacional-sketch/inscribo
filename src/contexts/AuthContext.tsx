
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase, DatabaseService, User as AppUser } from '../lib/supabase'
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
  
  // Refs para evitar múltiplas chamadas
  const isLoadingUser = useRef(false)
  const isMounted = useRef(true)
  const initializationTimeout = useRef<NodeJS.Timeout>()
  
  const navigate = useNavigate()

  // ========================================
  // TIMEOUT DE SEGURANÇA
  // ========================================
  useEffect(() => {
    // Timeout de 10 segundos para garantir que não fica travado
    initializationTimeout.current = setTimeout(() => {
      if (initializing) {
        console.warn('[AUTH] Timeout de inicialização - forçando conclusão')
        setInitializing(false)
      }
    }, 10000)

    return () => {
      if (initializationTimeout.current) {
        clearTimeout(initializationTimeout.current)
      }
    }
  }, [initializing])

  // ========================================
  // CARREGAR DADOS DO USUÁRIO
  // ========================================
  const loadUserData = useCallback(async (email: string) => {
    // Previne chamadas duplicadas
    if (isLoadingUser.current) {
      console.log('[AUTH] Já está carregando usuário - ignorando')
      return
    }

    try {
      isLoadingUser.current = true
      console.log('[AUTH] Carregando dados do usuário:', email)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      if (!isMounted.current) return

      if (error) throw error

      if (data) {
        console.log('[AUTH] Usuário carregado:', data.full_name)
        setUser(data)
      }
    } catch (error) {
      console.error('[AUTH] Erro ao carregar usuário:', error)
      if (isMounted.current) {
        await supabase.auth.signOut()
        setUser(null)
      }
    } finally {
      isLoadingUser.current = false
      if (isMounted.current) {
        setLoading(false)
        setInitializing(false)
      }
    }
  }, [])

  // ========================================
  // INICIALIZAÇÃO - EXECUTAR APENAS UMA VEZ
  // ========================================
  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      try {
        console.log('[AUTH] Inicializando autenticação...')
        
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error('[AUTH] Erro ao obter sessão:', error)
          setInitializing(false)
          return
        }

        if (session?.user) {
          console.log('[AUTH] Sessão encontrada:', session.user.email)
          setSupabaseUser(session.user)
          await loadUserData(session.user.email)
        } else {
          console.log('[AUTH] Nenhuma sessão ativa')
          setInitializing(false)
        }
      } catch (error) {
        console.error('[AUTH] Erro na inicialização:', error)
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
  // LISTENER DE AUTH - OTIMIZADO
  // ========================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] Evento:', event)

        // CRÍTICO: Ignorar TOKEN_REFRESHED para evitar reloads
        if (event === 'TOKEN_REFRESHED') {
          console.log('[AUTH] Token atualizado silenciosamente - mantendo usuário')
          return
        }

        // Apenas processar eventos importantes
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AUTH] Usuário logou')
          setSupabaseUser(session.user)
          await loadUserData(session.user.email)
        } else if (event === 'SIGNED_OUT') {
          console.log('[AUTH] Usuário deslogou')
          setUser(null)
          setSupabaseUser(null)
          navigate('/login')
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
  const refreshUser = useCallback(async () => {
    console.log('[AUTH] Refresh manual solicitado')
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user && isMounted.current) {
      await loadUserData(session.user.email)
    }
  }, [loadUserData])

  const signIn = useCallback(async (email: string, password: string) => {
    console.log('[AUTH] Tentando login...')
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      console.log('[AUTH] Login bem-sucedido')
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    console.log('[AUTH] Fazendo logout...')
    await supabase.auth.signOut()
    setUser(null)
    setSupabaseUser(null)
    navigate('/login')
  }, [navigate])

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
