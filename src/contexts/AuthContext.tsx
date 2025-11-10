import React, { createContext, useState, useEffect, useContext } from 'react'
import axios from 'axios'

// Tipagem do usuário (com 'role' para controle de acesso)
interface User {
  id: string
  name: string
  email: string
  role: string // admin, manager, user etc.
}

interface AuthContextData {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Verifica se há sessão salva no localStorage
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

      // A API deve retornar um objeto com { user, token }
      const { user, token } = response.data

      // Salva no localStorage
      localStorage.setItem('@Esquimbro:user', JSON.stringify(user))
      localStorage.setItem('@Esquimbro:token', token)

      // Define o token padrão para futuras requisições
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      // Atualiza estado
      setUser(user)
    } catch (error) {
      console.error('Erro ao fazer login:', error)
      throw new Error('Falha no login. Verifique suas credenciais.')
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

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
