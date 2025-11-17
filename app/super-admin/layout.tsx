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
      console.log('🔐 Verificando autorização de Super Admin...')
      
      // Verificar se está logado como super admin
      const userStr = localStorage.getItem('inscribo-user')
      if (!userStr) {
        console.warn('❌ Sem usuário no localStorage')
        router.push('/login')
        return
      }

      const user = JSON.parse(userStr)
      console.log('👤 Usuário:', user)
      
      if (!user.is_super_admin) {
        console.warn('❌ Acesso negado: não é super admin')
        alert('Acesso negado! Você não tem permissão para acessar esta área.')
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-900 mb-2">Super Admin</p>
          <p className="text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600">Você não tem permissão para acessar esta área.</p>
        </div>
      </div>
    )
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
