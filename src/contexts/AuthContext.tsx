import React, { createContext, useState, useEffect, useContext } from 'react'
import axios from 'axios'

// Tipagem dos dados do usuário (ajuste conforme sua API)
interface User {
  id: string
  name: string
  email: string
}

interface AuthContextData {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

// Criação do contexto
const AuthContext = createContext<AuthContextData>({} as AuthContextData)

// Provider
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Verifica se o usuário já está logado ao iniciar
  useEffect(() => {
    const storedUser = localStorage.getItem('@Esquimbro:user')
    const storedToken = localStorage.getItem('@Esquimbro:token')

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser))
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
    }

    setLoading(false)
  }, [])

  // Função de login
  const signIn = async (email: string, password: string) => {
    try {
      const response = await axios.post('https://seu-backend.com/api/login', {
        email,
        password,
      })

      const { user, token } = response.data

      localStorage.setItem('@Esquimbro:user', JSON.stringify(user))
      localStorage.setItem('@Esquimbro:token', token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(user)
    } catch (error) {
      console.error('Erro ao fazer login:', error)
      throw new Error('Credenciais inválidas')
    }
  }

  // Função de logout
  const signOut = () => {
    localStorage.removeItem('@Esquimbro:user')
    localStorage.removeItem('@Esquimbro:token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook personalizado para acessar o contexto
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
