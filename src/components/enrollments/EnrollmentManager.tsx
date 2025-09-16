import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => Promise<void>
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Check active session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          if (mounted) {
            setLoading(false)
          }
          return
        }

        if (session?.user && mounted) {
          await loadUserProfile(session.user.id)
        } else if (mounted) {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('Auth state changed:', event, session?.user?.id)

      if (session?.user) {
        await loadUserProfile(session.user.id)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const loadUserProfile = async (userId: string) => {
    try {
      // Check if there's pending user data to create profile
      const pendingData = localStorage.getItem('pendingUserData')
      if (pendingData) {
        const userData = JSON.parse(pendingData)
        if (userData.userId === userId) {
          await createUserProfile(userData)
          localStorage.removeItem('pendingUserData')
        }
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error loading user profile:', error)
        setUser(null)
      } else if (data) {
        setUser(data)
      } else {
        console.log('No user profile found')
        setUser(null)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw new Error(error.message)
      }
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => {
    setLoading(true)
    try {
      // Sign up user without email confirmation
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined // Disable email confirmation
        }
      })

      if (authError) throw authError

      // Create user profile immediately if we have a session
      if (authData.user && authData.session) {
        await createUserProfile({
          userId: authData.user.id,
          email,
          fullName,
          role
        })
      } else if (authData.user && !authData.session) {
        // Store signup data for manual confirmation
        localStorage.setItem('pendingUserData', JSON.stringify({
          userId: authData.user.id,
          email,
          fullName,
          role
        }))
        throw new Error('Conta criada! Faça login com suas credenciais.')
      }

    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const createUserProfile = async (userData: any) => {
    try {
      // Create institution if admin
      let institutionId = null
      if (userData.role === 'admin') {
        const { data: institution, error: instError } = await supabase
          .from('institutions')
          .insert({
            name: `Instituição de ${userData.fullName}`,
            primary_color: '#3B82F6',
            secondary_color: '#10B981'
          })
          .select()
          .single()

        if (instError) throw instError
        institutionId = institution.id
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: userData.userId,
          email: userData.email,
          full_name: userData.fullName,
          role: userData.role,
          institution_id: institutionId,
          active: true
        })

      if (profileError) {
        console.error('Error creating user profile:', profileError)
        throw profileError
      }
    } catch (error) {
      console.error('Error in createUserProfile:', error)
      throw error
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new Error(error.message)
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, signUp }}>
      {children}
    </AuthContext.Provider>
  )
}