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

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth...')
        
        // Get current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError)
          if (mounted) {
            setSession(null)
            setUser(null)
            setLoading(false)
          }
          return
        }

        console.log('📋 Session status:', currentSession ? 'Found' : 'Not found')
        
        if (mounted) {
          setSession(currentSession)
        }

        if (currentSession?.user) {
          console.log('👤 Loading user profile...')
          await loadUserProfile(currentSession.user.id)
        } else {
          console.log('🚫 No session, setting loading to false')
          if (mounted) {
            setUser(null)
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('💥 Auth initialization error:', error)
        if (mounted) {
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      }
    }

    // Initialize auth
    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('🔔 Auth state changed:', event, session ? 'Session exists' : 'No session')
      
      setSession(session)

      if (session?.user) {
        console.log('👤 Auth change - loading user profile...')
        await loadUserProfile(session.user.id)
      } else {
        console.log('🚫 Auth change - no session, clearing user')
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
      console.log(`🔍 Loading profile for user: ${userId}`)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Profile load error:', error)
        
        // If user doesn't exist in users table, create it from auth user
        if (error.code === 'PGRST116') {
          console.log('👤 User not found in users table, checking auth user...')
          
          const { data: { user: authUser } } = await supabase.auth.getUser()
          
          if (authUser) {
            console.log('✨ Creating user profile from auth data...')
            
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

            if (createError) {
              console.error('❌ Error creating user profile:', createError)
              setUser(null)
            } else {
              console.log('✅ User profile created successfully')
              setUser(createdUser)
            }
          } else {
            console.error('❌ No auth user found')
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } else if (data) {
        console.log('✅ User profile loaded successfully')
        setUser(data)
      } else {
        console.log('⚠️ No user data returned')
        setUser(null)
      }
    } catch (error) {
      console.error('💥 Profile loading error:', error)
      setUser(null)
    } finally {
      console.log('🏁 Setting loading to false')
      setLoading(false)
    }
  }

  const refreshSession = async () => {
    try {
      console.log('🔄 Refreshing session...')
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error
      
      if (data.session) {
        setSession(data.session)
        if (data.session.user) {
          await loadUserProfile(data.session.user.id)
        }
      }
    } catch (error) {
      console.error('❌ Error refreshing session:', error)
      setSession(null)
      setUser(null)
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      console.log('🔐 Signing in...')
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw new Error(error.message)
      }
      
      console.log('✅ Sign in successful')
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      console.log('🚪 Signing out...')
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear local state
      setSession(null)
      setUser(null)
      console.log('✅ Sign out successful')
    } catch (error) {
      console.error('❌ Error signing out:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => {
    setLoading(true)
    try {
      console.log('📝 Signing up...')
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
        console.log('✅ Sign up successful')
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