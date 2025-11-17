'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SuperAdminSidebar from './components/SuperAdminSidebar'
import SuperAdminTopBar from './components/SuperAdminTopBar'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Verificar se está logado como super admin
      const userStr = localStorage.getItem('inscribo-user')
      if (!userStr) {
        router.push('/login')
        return
      }

      const user = JSON.parse(userStr)
      if (!user.is_super_admin) {
        console.warn('❌ Acesso negado: não é super admin')
        router.push('/dashboard')
        return
      }

      console.log('✅ Super Admin autorizado:', user.email)
      setAuthorized(true)
    } catch (error) {
      console.error('❌ Erro na verificação:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    )
  }

  if (!authorized) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminSidebar />
      <div className="ml-64">
        <SuperAdminTopBar />
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
