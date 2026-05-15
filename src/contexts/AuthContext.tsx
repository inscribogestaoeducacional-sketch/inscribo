import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

// ─── tipos ────────────────────────────────────────────────────────────────
interface AppUser {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
  active: boolean
  institution_name?: string
  user_type?: 'school_user' | 'consultant' | 'admin_geral'
  // mantido por compatibilidade com código legado
  is_super_admin?: boolean
}

interface AuthContextType {
  user: AppUser | null
  session: Session | null
  loading: boolean
  initializing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

// ─── PROVIDER ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,         setUser]         = useState<AppUser | null>(null)
  const [session,      setSession]      = useState<Session | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [initializing, setInitializing] = useState(true)

  // ── init ─────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession)
        if (newSession?.user) {
          await loadUserProfile(newSession.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
        } else {
          setLoading(false)
        }
        setInitializing(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // ── loadUserProfile ───────────────────────────────────
  // REGRA: busca SEMPRE na tabela users primeiro.
  // Se user_type = 'admin_geral' ou 'consultant' → é área admin.
  // Não depende mais de tabela super_admins nem de e-mail hardcoded.
  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, institutions!users_institution_id_fkey(name)')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Usuário não existe na tabela — pode ser primeiro acesso
          console.warn('Usuário não encontrado na tabela users:', userId)
          setUser(null)
          return
        }
        throw error
      }

      if (data) {
        const appUser: AppUser = {
          id:               data.id,
          full_name:        data.full_name        || '',
          email:            data.email            || '',
          role:             data.role             || 'user',
          institution_id:   data.institution_id   || '',
          active:           data.active           ?? true,
          user_type:        data.user_type,
          institution_name: (data as any).institutions?.name,
          // is_super_admin: mantido por compatibilidade
          is_super_admin:   data.user_type === 'admin_geral',
        }
        setUser(appUser)
      }
    } catch (e) {
      console.error('loadUserProfile error:', e)
    }
  }

  // ── signIn ────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      if (data.user) {
        await loadUserProfile(data.user.id)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── signOut ───────────────────────────────────────────
  const signOut = async () => {
    setLoading(true)
    try {
      setUser(null)
      setSession(null)
      await supabase.auth.signOut()
    } catch (e) {
      console.error('signOut error:', e)
    } finally {
      setLoading(false)
      window.location.href = '/login'
    }
  }

  // ── signUp ────────────────────────────────────────────
  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, role } },
      })
      if (error) throw error
      throw new Error('Conta criada! Faça login com suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  // ── refreshSession ────────────────────────────────────
  const refreshSession = async () => {
    try {
      const { data: { session: refreshed }, error } = await supabase.auth.refreshSession()
      if (error) { clearCache(); setUser(null); setSession(null); return }
      if (refreshed) {
        setSession(refreshed)
        if (refreshed.user) await loadUserProfile(refreshed.user.id)
      }
    } catch (e) {
      console.error('refreshSession error:', e)
    }
  }

  // ── auto-refresh ──────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const id = setInterval(() => {
      // Só faz refresh se a sessão está próxima de expirar
      const expiresAt = session.expires_at
      if (expiresAt && (expiresAt * 1000 - Date.now()) < 5 * 60 * 1000) {
        refreshSession()
      }
    }, 60 * 1000) // checa a cada 1 minuto
    return () => clearInterval(id)
  }, [session?.access_token])

  return (
    <AuthContext.Provider value={{ user, session, loading, initializing, signIn, signOut, signUp, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}