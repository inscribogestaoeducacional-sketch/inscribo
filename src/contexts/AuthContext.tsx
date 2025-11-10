// ========================================
// AUTHCONTEXT ULTIMATE - COM SESSIONSTORAGE
// Nunca perde sessão ao recarregar
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

// Cache de usuário no SessionStorage
const USER_STORAGE_KEY = 'inscribo_user_cache'
const SESSION_STORAGE_KEY = 'inscribo_has_session'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    // Tenta restaurar do SessionStorage
    try {
      const cached = sessionStorage.getItem(USER_STORAGE_KEY)
      if (cached) {
        console.log('[AUTH] 💾 Usuário em cache')
        return JSON.parse(cached)
      }
    } catch (e) {
      console.error('[AUTH] ❌ Cache error:', e)
    }
    return null
  })
  
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  
  const isLoadingUser = useRef(false)
  const isMounted = useRef(true)
  const hasInitialized = useRef(false)
  const initTimeoutRef = useRef<NodeJS.Timeout>()
  
  const navigate = useNavigate()

  // ========================================
  // SALVAR USUÁRIO NO CACHE
  // ========================================
  const cacheUser = useCallback((userData: AppUser | null) => {
    try {
      if (userData) {
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
        sessionStorage.setItem(SESSION_STORAGE_KEY, 'true')
        console.log('[AUTH] 💾 Cache salvo')
      } else {
        sessionStorage.removeItem(USER_STORAGE_KEY)
        sessionStorage.removeItem(SESSION_STORAGE_KEY)
        console.log('[AUTH] 🗑️ Cache limpo')
      }
    } catch (e) {
      console.error('[AUTH] ❌ Cache save error:', e)
    }
  }, [])

  // ========================================
  // VERIFICAR SE TEM SESSÃO ATIVA
  // ========================================
  const hasActiveSession = useCallback(() => {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true'
  }, [])

  // ========================================
  // CARREGAR USUÁRIO
  // ========================================
  const loadUserData = useCallback(async (email: string): Promise<boolean> => {
    if (isLoadingUser.current) {
      console.log('[AUTH] 🔒 Bloqueado')
      return false
    }

    try {
      isLoadingUser.current = true
      console.log('[AUTH] 📊 Loading:', email)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      if (!isMounted.current) return false

      if (error) {
        console.error('[AUTH] ❌ Error:', error.message)
        setInitializing(false)
        return false
      }

      if (data) {
        console.log('[AUTH] ✅ Loaded:', data.full_name)
        setUser(data)
        cacheUser(data) // Salva no cache
        setInitializing(false)
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
  }, [cacheUser])

  // ========================================
  // INICIALIZAÇÃO COM TIMEOUT DE SEGURANÇA
  // ========================================
  useEffect(() => {
    if (hasInitialized.current) {
      console.log('[AUTH] ✋ Skip')
      return
    }

    let mounted = true

    // Timeout de segurança - 15 segundos
    // Só ativa se realmente travar
    initTimeoutRef.current = setTimeout(() => {
      if (initializing && mounted) {
        console.warn('[AUTH] ⏱️ Init timeout')
        
        // Se tem usuário em cache, mantém
        if (user) {
          console.log('[AUTH] ✅ Mantendo cache')
          setInitializing(false)
        } 
        // Se tinha sessão mas perdeu, tenta uma última vez
        else if (hasActiveSession()) {
          console.log('[AUTH] 🔄 Tentativa final')
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user && mounted) {
              loadUserData(session.user.email).then(() => {
                if (mounted) setInitializing(false)
              })
            } else {
              if (mounted) setInitializing(false)
            }
          })
        }
        // Sem nada, libera
        else {
          console.log('[AUTH] ℹ️ Sem sessão')
          setInitializing(false)
        }
        
        hasInitialized.current = true
      }
    }, 15000)

    const initialize = async () => {
      try {
        console.log('[AUTH] 🚀 Init')
        
        // Se já tem usuário em cache, usa temporariamente
        if (user) {
          console.log('[AUTH] ⚡ Usando cache')
        }
        
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error('[AUTH] ❌ Session error:', error.message)
          
          // Se tem cache, mantém
          if (user) {
            console.log('[AUTH] ✅ Mantendo cache')
            setInitializing(false)
          } else {
            setInitializing(false)
          }
          
          hasInitialized.current = true
          return
        }

        if (session?.user) {
          console.log('[AUTH] ✅ Session:', session.user.email)
          setSupabaseUser(session.user)
          
          // Só carrega se não tem cache OU cache desatualizado
          if (!user || user.email !== session.user.email) {
            await loadUserData(session.user.email)
          } else {
            console.log('[AUTH] ✅ Cache válido')
            setInitializing(false)
          }
        } else {
          console.log('[AUTH] ℹ️ No session')
          
          // Limpa cache se não tem sessão
          if (user) {
            console.log('[AUTH] 🗑️ Limpando cache desatualizado')
            setUser(null)
            cacheUser(null)
          }
          
          setInitializing(false)
        }
        
        hasInitialized.current = true
        
      } catch (error: any) {
        console.error('[AUTH] ❌ Init error:', error.message)
        
        // Em caso de erro, mantém cache se existir
        if (mounted) {
          if (user) {
            console.log('[AUTH] ✅ Mantendo cache em erro')
          }
          setInitializing(false)
          hasInitialized.current = true
        }
      }
    }

    initialize()

    return () => {
      mounted = false
      isMounted.current = false
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current)
      }
    }
  }, [loadUserData, user, cacheUser, hasActiveSession])

  // ========================================
  // LISTENER
  // ========================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] 🔔', event)

        // Ignorar eventos
        const ignoredEvents = ['TOKEN_REFRESHED', 'INITIAL_SESSION']
        if (ignoredEvents.includes(event)) {
          console.log('[AUTH] ⏭️ Skip:', event)
          return
        }

        // Login
        if (event === 'SIGNED_IN' && session?.user) {
          if (isLoadingUser.current) {
            console.log('[AUTH] ⏭️ Skip - já carregando')
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
          cacheUser(null)
          setInitializing(false)
          hasInitialized.current = false
          navigate('/login', { replace: true })
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate, loadUserData, cacheUser])

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
    cacheUser(null)
    setInitializing(false)
    hasInitialized.current = false
    navigate('/login', { replace: true })
  }, [navigate, cacheUser])

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
