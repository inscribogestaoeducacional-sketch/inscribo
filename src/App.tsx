import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'

// Auth Components
import LoginForm from './components/auth/LoginForm'
import InitialSetup from './components/auth/InitialSetup'
import LandingPage from './components/landing/LandingPage'

// Regular User Components
import Dashboard from './components/dashboard/Dashboard'
import LeadKanban from './components/leads/LeadKanban'
import VisitCalendar from './components/calendar/VisitCalendar'
import EnrollmentManager from './components/enrollments/EnrollmentManager'
import WhatsAppHub from './components/whatsapp/WhatsAppHub'
import GestorReports from './components/reports/GestorReports'
import UserManagement from './components/management/UserManagement'
import SystemSettings from './components/management/SystemSettings'
import UserProfile from './components/management/UserProfile'

// Layout Components
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'

// Super Admin Components
import SuperAdminDashboard from './components/superadmin/SuperAdminDashboard'
import SuperAdminInstitutions from './components/superadmin/SuperAdminInstitutions'
import InstitutionDetails from './components/superadmin/InstitutionDetails'
import SuperAdminsPage from './components/superadmin/SuperAdminsPage'
import NotificationsPage from './components/superadmin/NotificationsPage'

// Protected Route Component
function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode
  allowedRoles: string[] 
}) {
  const { user } = useAuth()
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

// Placeholder Components
function UnauthorizedPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-4">Acesso Negado</h1>
        <p className="text-gray-600 mb-8">Você não tem permissão para acessar esta página.</p>
        <a href="/login" className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
          Voltar para Login
        </a>
      </div>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">404 - Página Não Encontrada</h1>
        <p className="text-gray-600 mb-8">A página que você procura não existe.</p>
        <a href="/super-admin" className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">
          Voltar para Dashboard
        </a>
      </div>
    </div>
  )
}

function AllUsersPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Todos os Usuários</h1>
      <p className="text-gray-600 mt-2">Página em desenvolvimento...</p>
    </div>
  )
}

function AnalyticsPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Analytics</h1>
      <p className="text-gray-600 mt-2">Página em desenvolvimento...</p>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <p className="text-gray-600 mt-2">Página em desenvolvimento...</p>
    </div>
  )
}

function ProfilePage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Meu Perfil</h1>
      <p className="text-gray-600 mt-2">Página em desenvolvimento...</p>
    </div>
  )
}

// Main App Content
function AppContent() {
  const { user, initializing } = useAuth()
  const [supabaseInitialized, setSupabaseInitialized] = useState(false)

  useEffect(() => {
    const initSupabase = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('🚀 App initialized, session:', session?.user?.id || 'none')
        setSupabaseInitialized(true)
      } catch (error) {
        console.error('❌ Error initializing:', error)
        setSupabaseInitialized(true)
      }
    }

    initSupabase()
  }, [])

  // Loading state
  if (initializing || !supabaseInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center px-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 mb-4 sm:mb-6 mx-auto">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Inscribo</h2>
          <p className="text-sm sm:text-base text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // SUPER ADMIN ROUTES
  if (user.is_super_admin) {
    return (
      <Routes>
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/super-admin/institutions" element={<SuperAdminInstitutions />} />
        <Route path="/super-admin/institutions/:id" element={<InstitutionDetails />} />
        <Route path="/super-admin/super-admins" element={<SuperAdminsPage />} />
        <Route path="/super-admin/notifications" element={<NotificationsPage />} />
        <Route path="/super-admin/users" element={<AllUsersPage />} />
        <Route path="/super-admin/analytics" element={<AnalyticsPage />} />
        <Route path="/super-admin/settings" element={<SettingsPage />} />
        <Route path="/super-admin/profile" element={<ProfilePage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/" element={<Navigate to="/super-admin" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    )
  }

  // REGULAR USER ROUTES
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden lg:ml-[220px]">
        <div className="lg:hidden h-14 flex-shrink-0"></div>
        <TopBar />

        <main className="flex-1 min-h-0 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leads" element={<LeadKanban />} />
            <Route path="/visits" element={<VisitCalendar />} />
            <Route path="/enrollments" element={<EnrollmentManager />} />
            <Route path="/whatsapp" element={<WhatsAppHub />} />

            <Route path="/reports" element={
              <ProtectedRoute allowedRoles={['manager', 'admin']}>
                <GestorReports />
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
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

// Main App Component

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
