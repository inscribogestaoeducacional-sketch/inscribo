import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useEffect } from 'react'
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

function AppContent() {
  const { user, loading, session, refreshSession } = useAuth()

  // Add timeout for loading state
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.log('⏰ Loading timeout reached, forcing redirect to login')
        window.location.href = '/login'
      }, 10000) // 10 seconds timeout

      return () => clearTimeout(timeout)
    }
  }, [loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Carregando sistema...</p>
          <p className="text-gray-500 text-sm mt-2">Verificando autenticação</p>
          <button 
            onClick={() => {
              console.log('🔄 Manual refresh triggered')
              localStorage.clear()
              sessionStorage.clear()
              window.location.href = '/login'
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Forçar Login
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/setup" element={<InitialSetup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-64">
        <TopBar />
        <main className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leads" element={<LeadKanban />} />
            <Route path="/visits" element={<VisitCalendar />} />
            <Route path="/enrollments" element={<EnrollmentManager />} />
            <Route path="/marketing" element={<MarketingCPA />} />
            <Route path="/reenrollments" element={<ReEnrollments />} />
            <Route path="/funnel" element={<FunnelAnalysis />} />
            <Route path="/actions" element={<ActionsManager />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/settings" element={<SystemSettings />} />
            <Route path="/profile" element={<UserProfile />} />
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