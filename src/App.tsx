import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginForm from './components/auth/LoginForm'
import InitialSetup from './components/auth/InitialSetup'
import Dashboard from './components/dashboard/Dashboard'
import LeadKanban from './components/leads/LeadKanban'
import VisitCalendar from './components/calendar/VisitCalendar'
import EnrollmentManager from './components/enrollments/EnrollmentManager'
import MarketingCPA from './components/marketing/MarketingCPA'
import ReEnrollments from './components/reenrollments/ReEnrollments'
import FunnelAnalysis from './components/funnel/FunnelAnalysis'
import ActionsManager from './components/actions/ActionsManager'
import Reports from './components/reports/Reports'
import UserManagement from './components/management/UserManagement'
import SystemSettings from './components/management/SystemSettings'
import UserProfile from './components/management/UserProfile'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'

// ========================================
// ANTI-RELOAD - Previne reload ao trocar de aba
// ========================================
if (typeof window !== 'undefined') {
  let preventReload = false
  
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      preventReload = true
      console.log('[ANTI-RELOAD] Aba visível - bloqueando reload por 2s')
      
      setTimeout(() => {
        preventReload = false
      }, 2000)
    }
  })
  
  const originalReload = window.location.reload.bind(window.location)
  window.location.reload = function() {
    if (preventReload) {
      console.log('[ANTI-RELOAD] Reload bloqueado!')
      return
    }
    originalReload()
  } as any
}
// ========================================

// Route protection component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) {
  const { user } = useAuth()
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

function AppContent() {
  const { user, initializing } = useAuth()

  // Mostrar loading apenas enquanto inicializa
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 mb-6 mx-auto">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Inscribo</h2>
          <p className="text-gray-600 mb-4">Verificando sua sessão...</p>
          
          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span>Verificando autenticação</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse delay-100"></div>
              <span>Carregando perfil</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse delay-200"></div>
              <span>Preparando sistema</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mostrar tela de login se não houver usuário
  if (!user) {
    return <LoginForm />
  }

  // Redirecionar super admin para painel específico
  if (user.is_super_admin && !window.location.pathname.startsWith('/super-admin')) {
    return <Navigate to="/super-admin" replace />
  }

  // Renderizar aplicação principal
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-64">
        <TopBar />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leads" element={<LeadKanban />} />
            <Route path="/visits" element={<VisitCalendar />} />
            <Route path="/enrollments" element={<EnrollmentManager />} />
            <Route path="/marketing" element={
              <ProtectedRoute allowedRoles={['manager', 'admin']}>
                <MarketingCPA />
              </ProtectedRoute>
            } />
            <Route path="/reenrollments" element={
              <ProtectedRoute allowedRoles={['manager', 'admin']}>
                <ReEnrollments />
              </ProtectedRoute>
            } />
            <Route path="/funnel" element={
              <ProtectedRoute allowedRoles={['manager', 'admin']}>
                <FunnelAnalysis />
              </ProtectedRoute>
            } />
            <Route path="/actions" element={
              <ProtectedRoute allowedRoles={['manager', 'admin']}>
                <ActionsManager />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute allowedRoles={['manager', 'admin']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <SystemSettings />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/setup" element={<InitialSetup />} />
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App
