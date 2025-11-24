import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const location = useLocation()

  useEffect(() => {
    checkAuth()
    
    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id)
      
      if (event === 'SIGNED_IN' && session) {
        await loadUserData(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        clearUserData()
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const checkAuth = async () => {
    try {
      console.log('🔍 Checking authentication...')
      
      // 1. Verificar sessão do Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError)
        clearUserData()
        setIsAuthenticated(false)
        setLoading(false)
        return
      }

      if (!session) {
        console.log('❌ No session found')
        clearUserData()
        setIsAuthenticated(false)
        setLoading(false)
        return
      }

      console.log('✅ Session found:', session.user.id)

      // 2. Verificar localStorage
      const storedUser = localStorage.getItem('inscribo-user')
      const storedToken = localStorage.getItem('inscribo-auth-token')

      if (storedUser && storedToken) {
        console.log('✅ User data in localStorage')
        const userData = JSON.parse(storedUser)
        setUserRole(userData.role)
        setIsAuthenticated(true)
        setLoading(false)
        return
      }

      // 3. Se não tem no localStorage, buscar do banco
      console.log('⏳ Loading user data from database...')
      await loadUserData(session.user.id)

    } catch (error) {
      console.error('❌ Auth check error:', error)
      clearUserData()
      setIsAuthenticated(false)
      setLoading(false)
    }
  }

  const loadUserData = async (userId: string) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      console.log('✅ User data loaded:', userData.email, userData.role)

      // Salvar no localStorage
      localStorage.setItem('inscribo-user', JSON.stringify(userData))
      localStorage.setItem('inscribo-auth-token', 'authenticated')

      setUserRole(userData.role)
      setIsAuthenticated(true)
      setLoading(false)
    } catch (error) {
      console.error('❌ Error loading user data:', error)
      clearUserData()
      setIsAuthenticated(false)
      setLoading(false)
    }
  }

  const clearUserData = () => {
    localStorage.removeItem('inscribo-user')
    localStorage.removeItem('inscribo-auth-token')
    setIsAuthenticated(false)
    setUserRole(null)
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Verificando autenticação...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    console.log('❌ Not authenticated, redirecting to login')
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check role if required
  if (requiredRole && userRole !== requiredRole) {
    console.log('❌ Insufficient permissions:', userRole, 'required:', requiredRole)
    return <Navigate to="/unauthorized" replace />
  }

  console.log('✅ Authenticated, rendering protected content')
  return <>{children}</>
}
