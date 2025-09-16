import React, { createContext, useContext, useState } from 'react'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  institution_id: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
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
  const [loading, setLoading] = useState(false)

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    
    // Simular login - em produção conectaria com Supabase
    if (email === 'admin@escola.com' && password === '123456') {
      const mockUser: User = {
        id: '1',
        email: 'admin@escola.com',
        full_name: 'Administrador',
        role: 'admin',
        institution_id: '1'
      }
      setUser(mockUser)
      setLoading(false)
    } else {
      setLoading(false)
      throw new Error('Email ou senha incorretos')
    }
  }

  const signOut = () => {
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}