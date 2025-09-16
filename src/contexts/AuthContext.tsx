import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, User, DatabaseService } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateProfile: (userData: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await fetchUserProfile(session.user.id)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .limit(1)

      if (error) {
        console.error('Error fetching user profile:', error)
        return
      }
      
      if (data && data.length > 0) {
        const userData = data[0]
        
        // Update last login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', userId)
        
        setUser(userData)
        
        // Log login activity only after user data is set
        await DatabaseService.logActivity({
          user_id: userId,
          action: 'login',
          entity_type: 'auth',
          details: { timestamp: new Date().toISOString() },
          institution_id: userData.institution_id
        })
      }
      
    } catch (error) {
      console.error('Error fetching user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signOut = async () => {
    // Log logout activity
    if (user) {
      await DatabaseService.logActivity({
        user_id: user.id,
        action: 'logout',
        entity_type: 'auth',
        details: { timestamp: new Date().toISOString() },
        institution_id: user.institution_id
      })
    }
    
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  }

  const updateProfile = async (userData: Partial<User>) => {
    if (!user) throw new Error('No user logged in')
    
    const updatedUser = await DatabaseService.updateUser(user.id, userData)
    setUser(updatedUser)
    
    // Log profile update
    await DatabaseService.logActivity({
      user_id: user.id,
      action: 'update_profile',
      entity_type: 'user',
      entity_id: user.id,
      details: { updated_fields: Object.keys(userData) },
      institution_id: user.institution_id
    })
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}