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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let retryCount = 0
    const maxRetries = 3

    const initializeAuth = async (retry = 0) => {
      try {
        console.log(`Initializing auth, attempt ${retry + 1}`)
        
        // Clear any stale session data first
        if (retry === 0) {
          await supabase.auth.refreshSession()
        }
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          
          // If session error and we have retries left, try refreshing
          if (retry < maxRetries && error.message.includes('refresh_token_not_found')) {
            console.log('Attempting to refresh session...')
            await new Promise(resolve => setTimeout(resolve, 1000))
            return initializeAuth(retry + 1)
          }
          
          if (mounted) {
            setSession(null)
            setUser(null)
            setLoading(false)
          }
          return
        }

        console.log('Session found:', !!session)
        
        if (session?.user) {
          if (mounted) {
            setSession(session)
          }
          await loadUserProfile(session.user.id)
        } else {
          if (mounted) {
            setSession(null)
            setUser(null)
          }
        }
        
        if (mounted) {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        
        // Retry logic for network errors
        if (retry < maxRetries && mounted) {
          console.log(`Retrying auth initialization in ${(retry + 1) * 1000}ms...`)
          await new Promise(resolve => setTimeout(resolve, (retry + 1) * 1000))
          return initializeAuth(retry + 1)
        }
        
        if (mounted) {
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('Auth state changed:', event, !!session)
      
      if (mounted) {
        setSession(session)
      }

      if (session?.user) {
        await loadUserProfile(session.user.id)
      } else {
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

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
  const loadUserProfile = async (userId: string, retryCount = 0) => {
    try {
      console.log(`Loading user profile for ${userId}, attempt ${retryCount + 1}`)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error loading user profile:', error)
        
        // Handle specific database errors with retry logic
        if ((error.code === '42P17' || error.code === 'PGRST116') && retryCount < 3) {
          console.log(`Retrying in 1 second... (attempt ${retryCount + 1}/3)`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          return loadUserProfile(userId, retryCount + 1)
        }
        
        // Handle permission errors by creating user profile
        if (error.code === '42501' || error.code === 'PGRST301' || error.message.includes('permission denied')) {
          console.log('Permission denied, attempting to create user profile...')
          const { data: authUser, error: userError } = await supabase.auth.getUser()
          
          if (!userError && authUser.user?.user_metadata) {
            await createUserProfile({
              userId: authUser.user.id,
              email: authUser.user.email || '',
              fullName: authUser.user.user_metadata.full_name || 'Usuário',
              role: authUser.user.user_metadata.role || 'user'
            })
            // Retry loading profile after creation
            return loadUserProfile(userId, retryCount + 1)
          }
        }
        
        setUser(null)
      } else if (data) {
        console.log('User profile loaded successfully:', data)
        setUser(data)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const createUserProfile = async (userData: any) => {
    try {
      const { error } = await supabase
        .from('users')
        .insert({
          id: userData.userId,
          email: userData.email,
          full_name: userData.fullName,
          role: userData.role,
          institution_id: null,
          active: true
        })

      if (error) {
        console.error('Error creating user profile:', error)
      }
    } catch (error) {
      console.error('Error creating user profile:', error)
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      // Clear any existing session first
      await supabase.auth.signOut()
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw new Error(error.message)
      }
      
      // Session will be handled by the auth state change listener
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear local state
      setSession(null)
      setUser(null)
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => {
    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
          data: {
            full_name: fullName,
            role: role
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        try {
          await createUserProfile({
            userId: authData.user.id,
            email,
            fullName,
            role
          })
        } catch (profileError) {
          console.log('Profile creation will be handled on login')
        }
        
        throw new Error('Conta criada com sucesso! Faça login com suas credenciais.')
      }
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, session, signIn, signOut, signUp, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}