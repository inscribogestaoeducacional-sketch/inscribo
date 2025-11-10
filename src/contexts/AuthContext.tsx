import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'

import LoginForm from './components/auth/LoginForm'
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

// Protege rotas de acordo com o papel do usuário
function ProtectedRoute({ children, allowedRoles = [] }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando sessão...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// Layout do painel principal
function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1">
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}

// Conteúdo principal da aplicação
function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 mb-6 mx-auto">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Inscribo</h2>
          <p className="text-gray-600 mt-2">Verificando sessão...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leads" element={<LeadKanban />} />
        <Route path="/visits" element={<VisitCalendar />} />
        <Route path="/enrollments" element={<EnrollmentManager />} />

        <Route
          path="/marketing"
          element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <MarketingCPA />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reenrollments"
          element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ReEnrollments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/funnel"
          element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <FunnelAnalysis />
            </ProtectedRoute>
          }
        />

        <Route
          path="/actions"
          element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ActionsManager />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SystemSettings />
            </ProtectedRoute>
          }
        />

        <Route path="/profile" element={<UserProfile />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
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
