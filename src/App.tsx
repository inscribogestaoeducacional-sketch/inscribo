// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// Auth
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginForm from './components/auth/LoginForm'
import ProtectedRoute from './components/auth/ProtectedRoute'
import InitialSetup from './components/auth/InitialSetup'

// Layout
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'

// Usuário Normal
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

// Super Admin
import SuperAdminDashboard from './components/superadmin/SuperAdminDashboard'
import SuperAdminInstitutions from './components/superadmin/SuperAdminInstitutions'
import InstitutionDetails from './components/superadmin/InstitutionDetails'
import SuperAdminsPage from './components/superadmin/SuperAdminsPage'
import NotificationsPage from './components/superadmin/NotificationsPage'
import AllUsersPage from './components/superadmin/AllUsersPage'
import AnalyticsPage from './components/superadmin/AnalyticsPage'
import SettingsPage from './components/superadmin/SettingsPage'
import ProfilePage from './components/superadmin/ProfilePage'

function AppContent() {
  const { user, initializing } = useAuth()

  if (initializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-600"></div>
      </div>
    )
  }

  // 🔐 Se **não estiver logado**, vai para login
  if (!user) return <LoginForm />

  // 🛡 SUPER ADMIN MODE
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
        <Route path="*" element={<Navigate to="/super-admin" replace />} />
      </Routes>
    )
  }

  // 👤 USUÁRIO COMUM
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <div className="lg:ml-64">
        <TopBar />
        <main className="min-h-screen p-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
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
            <Route path="/setup" element={<InitialSetup />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}
