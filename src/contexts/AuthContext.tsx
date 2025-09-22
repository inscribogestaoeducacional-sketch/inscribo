import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AppUser {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
  active: boolean
}

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  session: any
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [initTimeout, setInitTimeout] = useState(false)

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    const initializeAuth = async () => {
      try {
        // Get current session without any delays
        const { data: { session: currentSession }, error } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (error) {
          console.error('Session error:', error)
          setSession(null)
          setUser(null)
        } else {
          setSession(currentSession)
          
          if (currentSession?.user) {
            await loadUserProfile(currentSession.user.id)
          } else {
            setUser(null)
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          setSession(null)
          setUser(null)
        }
      } finally {
        if (mounted) {
          setInitializing(false)
        }
      }
    }

    // Initialize immediately
    initializeAuth()
    
    // Set timeout for initialization
    timeoutId = setTimeout(() => {
      if (mounted && initializing) {
        setInitTimeout(true)
      }
    }, 5000) // 5 seconds timeout

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('Auth state changed:', event, !!session)
      
      setSession(session)

      if (session?.user) {
        await loadUserProfile(session.user.id)
      } else {
        setUser(null)
      }
    })

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // User doesn't exist in users table, create it
          const { data: { user: authUser } } = await supabase.auth.getUser()
          
          if (authUser) {
            const newUserData = {
              id: authUser.id,
              email: authUser.email!,
              full_name: authUser.user_metadata?.full_name || authUser.email!.split('@')[0],
              role: authUser.user_metadata?.role || 'admin',
              institution_id: null,
              active: true
            }

            const { data: createdUser, error: createError } = await supabase
              .from('users')
              .insert(newUserData)
              .select()
              .single()

            if (!createError && createdUser) {
              setUser(createdUser)
            } else {
              console.error('Error creating user profile:', createError)
              setUser(null)
            }
          }
        } else {
          console.error('Error loading user profile:', error)
          setUser(null)
        }
      } else if (data) {
        setUser(data)
      }
    } catch (error) {
      console.error('Profile loading error:', error)
      setUser(null)
    }
  }

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error
      
      if (data.session) {
        setSession(data.session)
        if (data.session.user) {
          await loadUserProfile(data.session.user.id)
        }
      }
    } catch (error) {
      console.error('Error refreshing session:', error)
      setSession(null)
      setUser(null)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw new Error(error.message)
      }
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      
      // Clear local state first
      setSession(null)
      setUser(null)
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error)
      }
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => {
    try {
      setLoading(true)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        throw new Error('Conta criada com sucesso! Faça login com suas credenciais.')
      }
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const forceLogin = () => {
    setUser(null)
    setSession(null)
    setInitializing(false)
    setInitTimeout(false)
    setLoading(false)
  }

  // Show loading only during initialization
  if (initializing && !initTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }
  
  // Show timeout screen with force login option
  if (initializing && initTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Carregando sistema...</h2>
          <p className="text-gray-600 text-sm mb-4">Verificando autenticação</p>
          <button
            onClick={forceLogin}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Forçar Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loading, session, signIn, signOut, signUp, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}