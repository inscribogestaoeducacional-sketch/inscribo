import React from 'react'
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
import SuperAdminDashboard from './components/superadmin/SuperAdminDashboard'
import SuperAdminInstitutions from './components/superadmin/SuperAdminInstitutions'

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

  if (initializing) {
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

  if (!user) {
    return <LoginForm />
  }

  // SE FOR SUPER ADMIN
  if (user.is_super_admin) {
    return (
      <Routes>
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/super-admin/institutions" element={<SuperAdminInstitutions />} />
        <Route path="*" element={<Navigate to="/super-admin" replace />} />
      </Routes>
    )
  }

  // USUÁRIO NORMAL
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="lg:ml-64">
        <div className="lg:hidden h-16"></div>
        <TopBar />
        
        <main className="min-h-screen">
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
