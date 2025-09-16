import React, { createContext, useContext, useState, useEffect } from 'react'

interface AppUser {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
  active: boolean
}

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Mock user data
const MOCK_USER: AppUser = {
  id: '1',
  email: 'admin@escola.com',
  full_name: 'Administrador',
  role: 'admin',
  institution_id: '1',
  active: true
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in (localStorage)
    const savedUser = localStorage.getItem('inscribo_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.error('Error parsing saved user:', error)
        localStorage.removeItem('inscribo_user')
      }
    }
    
    // Always set loading to false after check
    setTimeout(() => {
      setLoading(false)
    }, 500)
  }, [])

  const signIn = async (email: string, password: string) => {
    // Mock authentication - accept any email/password for demo
    if (email && password) {
      const userData = {
        ...MOCK_USER,
        email: email
      }
      
      setUser(userData)
      localStorage.setItem('inscribo_user', JSON.stringify(userData))
    } else {
      throw new Error('Email e senha são obrigatórios')
    }
  }

  const signOut = async () => {
    setUser(null)
    localStorage.removeItem('inscribo_user')
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}