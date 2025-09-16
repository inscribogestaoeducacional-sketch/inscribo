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
      // Check if there's pending user data to create profile (safely)
      let pendingData = null
      try {
        pendingData = localStorage.getItem('pendingUserData')
      } catch (e) {
        console.log('localStorage not available')
      }
      
      if (pendingData) {
        try {
          const userData = JSON.parse(pendingData)
          if (userData.userId === userId) {
            await createUserProfile(userData)
            try {
              localStorage.removeItem('pendingUserData')
            } catch (e) {
              console.log('Could not remove from localStorage')
            }
          }
        } catch (e) {
          console.log('Error parsing pending data')
        }
      }
      
      if (pendingData) {
        try {
          const userData = JSON.parse(pendingData)
          if (userData.userId === userId) {
            await createUserProfile(userData)
            try {
              localStorage.removeItem('pendingUserData')
            } catch (e) {
              console.log('Could not remove from localStorage')
            }
          }
        } catch (e) {
          console.log('Error parsing pending data')
        }
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        if (error.code === '42501' || error.message.includes('permission denied')) {
          // RLS is blocking - user profile doesn't exist, try to create it
          const { data: authUser } = await supabase.auth.getUser()
          if (authUser.user?.user_metadata) {
            await createUserProfile({
              userId: authUser.user.id,
              email: authUser.user.email || '',
              fullName: authUser.user.user_metadata.full_name || 'Usuário',
            }
            )
          }
          const { data: authUser } = await supabase.auth.getUser()
          if (authUser.user?.user_metadata) {
            await createUserProfile({
              userId: authUser.user.id,
              email: authUser.user.email || '',
              fullName: authUser.user.user_metadata.full_name || 'Usuário',
                  } else if (data) {
        setUser(data)
      } else {
        console.log('No user profile found')
        setUser(null)
      }
            )
              } catch (error) {
      console.error('Error loading user profile:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
          }
      }
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
      // Sign up user with email confirmation disabled
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
          data: {
            full_name: fullName,
            role: role
          }
          data: {
            full_name: fullName,
            role: role
          }
        }
      })

      if (authError) throw authError

      // If user was created but not confirmed, try to create profile anyway
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
        
        // Always throw success message to redirect to login
        throw new Error('Conta criada com sucesso! Faça login com suas credenciais.')
          } catch (error) {
      setLoading(false)
      throw error
    }
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