// src/contexts/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, User as AppUser } from '../lib/supabase'

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // 🔁 Carrega sessão atual e usuário associado
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          console.log('[AUTH] Sessão ativa encontrada')

          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', session.user.email)
            .eq('active', true)
            .single()

          if (data && !error) {
            setUser(data)
          } else {
            console.warn('[AUTH] Usuário não encontrado, desconectando...')
            await supabase.auth.signOut()
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('[AUTH] Erro ao inicializar:', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // 🔂 Escuta mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] Evento:', event)

        if (event === 'SIGNED_IN' && session?.user) {
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('email', session.user.email)
            .eq('active', true)
            .single()

          if (data) {
            setUser(data)
            navigate('/dashboard', { replace: true })
          }
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          navigate('/login', { replace: true })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [navigate])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (error: any) {
      console.error('[AUTH] Erro no login:', error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
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
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
