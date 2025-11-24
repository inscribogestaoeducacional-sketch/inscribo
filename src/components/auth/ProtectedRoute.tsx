// src/components/auth/ProtectedRoute.tsx
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'super_admin' | 'admin' | 'manager' | 'user'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const location = useLocation()

  useEffect(() => {
    checkAuth()
    
    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false)
        setHasPermission(false)
        localStorage.removeItem('inscribo-user')
        localStorage.removeItem('inscribo-auth-token')
      } else if (event === 'SIGNED_IN' && session) {
        await checkAuth()
      }
    })

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [requiredRole])

  const checkAuth = async () => {
    try {
      // Check for session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) throw sessionError

      if (!session) {
        setIsAuthenticated(false)
        setHasPermission(false)
        setLoading(false)
        return
      }

      setIsAuthenticated(true)

      // Check for stored user data
      const storedUser = localStorage.getItem('inscribo-user')
      
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        
        // Store auth token if not already stored
        if (!localStorage.getItem('inscribo-auth-token')) {
          localStorage.setItem('inscribo-auth-token', session.access_token)
        }

        // Check role permission
        if (requiredRole) {
          setHasPermission(userData.role === requiredRole)
        } else {
          setHasPermission(true)
        }
      } else {
        // If no stored user, fetch from database
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (userError) throw userError

        if (userData) {
          // Store user data
          localStorage.setItem('inscribo-user', JSON.stringify(userData))
          localStorage.setItem('inscribo-auth-token', session.access_token)

          // Check role permission
          if (requiredRole) {
            setHasPermission(userData.role === requiredRole)
          } else {
            setHasPermission(true)
          }
        } else {
          setIsAuthenticated(false)
          setHasPermission(false)
        }
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setIsAuthenticated(false)
      setHasPermission(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Store the attempted location for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole && !hasPermission) {
    // Redirect to unauthorized page or dashboard based on user role
    const storedUser = localStorage.getItem('inscribo-user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      if (userData.role === 'super_admin') {
        return <Navigate to="/super-admin" replace />
      } else {
        return <Navigate to="/dashboard" replace />
      }
    }
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
