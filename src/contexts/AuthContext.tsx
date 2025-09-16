import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface AppUser {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'consultant'
  institution_id: string
  active: boolean
}

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'consultant') => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Mock user for demo mode
const MOCK_USER: AppUser = {
  id: 'demo-user',
  full_name: 'Usuário Demonstração',
  email: 'demo@inscribo.com',
  role: 'admin',
  institution_id: 'demo-institution',
  active: true
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Check if Supabase is properly configured
  const isSupabaseConfigured = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    return supabaseUrl && 
           supabaseKey && 
           supabaseUrl !== 'https://demo.supabase.co' && 
           supabaseKey !== 'demo-key' &&
           supabaseUrl.includes('supabase.co')
  }

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    const initializeAuth = async () => {
      try {
        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.log('Auth initialization timeout, switching to demo mode')
            setLoading(false)
          }
        }, 5000)

        if (!isSupabaseConfigured()) {
          console.log('Supabase not configured, using demo mode')
          if (mounted) {
            clearTimeout(timeoutId)
            setLoading(false)
          }
          return
        }

        // Check active session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          if (mounted) {
            clearTimeout(timeoutId)
            setLoading(false)
          }
          return
        }

        if (session?.user && mounted) {
          await loadUserProfile(session.user.id)
        } else if (mounted) {
          clearTimeout(timeoutId)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          clearTimeout(timeoutId)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes only if Supabase is configured
    let subscription: any = null
    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return

        console.log('Auth state changed:', event, session?.user?.id)

        if (session?.user) {
          await loadUserProfile(session.user.id)
        } else {
          setUser(null)
          setLoading(false)
        }
      })
      subscription = data.subscription
    }

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
      if (subscription) subscription.unsubscribe()
    }
  }, [])

  const loadUserProfile = async (userId: string) => {
    try {
      if (!isSupabaseConfigured()) {
        setUser(MOCK_USER)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle() // Use maybeSingle instead of single to avoid errors when no rows

      if (error) {
        console.error('Error loading user profile:', error)
        // If user doesn't exist in users table, create a basic profile
        if (error.code === 'PGRST116') {
          console.log('User profile not found, user may need to complete setup')
        }
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
    if (!isSupabaseConfigured()) {
      // Demo mode login
      if (email === 'admin@demo.com' && password === 'demo123') {
        setUser({ ...MOCK_USER, role: 'admin' })
        return
      } else if (email === 'consultor@demo.com' && password === 'demo123') {
        setUser({ ...MOCK_USER, role: 'consultant', full_name: 'Consultor Demo' })
        return
      } else {
        throw new Error('Credenciais inválidas. Use: admin@demo.com / demo123 ou consultor@demo.com / demo123')
      }
    }

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

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'consultant') => {
    if (!isSupabaseConfigured()) {
      throw new Error('Cadastro não disponível no modo demonstração. Configure o Supabase para usar esta funcionalidade.')
    }

    setLoading(true)
    try {
      // Create institution if admin
      let institutionId = null
      if (role === 'admin') {
        const { data: institution, error: instError } = await supabase
          .from('institutions')
          .insert({
            name: `Instituição de ${fullName}`,
            primary_color: '#3B82F6',
            secondary_color: '#10B981'
          })
          .select()
          .single()

        if (instError) throw instError
        institutionId = institution.id
      }

      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
            institution_id: institutionId
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            role,
            institution_id: institutionId,
            active: true
          })

        if (profileError) {
          console.error('Error creating user profile:', profileError)
          // Don't throw here, as the auth user was created successfully
        }
      }
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const signOut = async () => {
    if (!isSupabaseConfigured()) {
      setUser(null)
      return
    }

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