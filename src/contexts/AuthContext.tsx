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
        console.log('Initializing auth...')
        
        // Get current session
        const { data: { session: currentSession }, error } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (error) {
          console.error('Session error:', error)
          setSession(null)
          setUser(null)
        } else {
          console.log('Session loaded:', !!currentSession)
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

    // Initialize auth
    initializeAuth()
    
    // Set timeout for initialization
    timeoutId = setTimeout(() => {
      if (mounted && initializing) {
        console.log('Auth initialization timeout')
        setInitTimeout(true)
        setInitializing(false)
      }
    }, 8000) // 8 seconds timeout

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
      
      // Clear initialization state on auth change
      if (initializing) {
        setInitializing(false)
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
      console.log('Loading user profile for:', userId)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error loading user profile:', error)
        
        if (error.code === 'PGRST116') {
          // User doesn't exist in users table, create it
          const { data: { user: authUser } } = await supabase.auth.getUser()
          
          if (authUser) {
            console.log('Creating user profile...')
            const newUserData = {
              id: authUser.id,
              email: authUser.email!,
              full_name: authUser.user_metadata?.full_name || authUser.email!.split('@')[0],
              role: (authUser.user_metadata?.role || 'admin') as 'admin' | 'manager' | 'user',
              institution_id: null,
              active: true
            }

            const { data: createdUser, error: createError } = await supabase
              .from('users')
              .insert(newUserData)
              .select()
              .single()

            if (!createError && createdUser) {
              console.log('User profile created successfully')
              setUser(createdUser)
            } else {
              console.error('Error creating user profile:', createError)
              setUser(null)
            }
          }
        } else {
          setUser(null)
        }
      } else if (data) {
        console.log('User profile loaded successfully')
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
      console.log('Attempting sign in for:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error('Sign in error:', error)
        throw new Error(error.message)
      }

      console.log('Sign in successful')
      // The onAuthStateChange will handle setting the user
    } catch (error) {
      console.error('Sign in failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      console.log('Signing out...')
      
      // Clear local state first
      setSession(null)
      setUser(null)
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error)
      } else {
        console.log('Sign out successful')
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
      console.log('Attempting sign up for:', email)
      
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

      if (authError) {
        console.error('Sign up error:', authError)
        throw authError
      }

      if (authData.user) {
        console.log('Sign up successful')
        throw new Error('Conta criada com sucesso! Faça login com suas credenciais.')
      }
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const forceLogin = () => {
    console.log('Forcing login...')
    setUser(null)
    setSession(null)
    setInitializing(false)
    setInitTimeout(false)
    setLoading(false)
  }

  // Show loading during initialization
  if (initializing && !initTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Inicializando sistema...</p>
        </div>
      </div>
    )
  }
  
  // Show timeout screen with force login option
  if (initTimeout && !session && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Problema de Conexão</h2>
          <p className="text-gray-600 text-sm mb-6">
            O sistema está demorando para carregar. Isso pode ser devido a problemas de rede ou configuração.
          </p>
          <button
            onClick={forceLogin}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Ir para Login
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