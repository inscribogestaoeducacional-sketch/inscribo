// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "./lib/supabase"

// Auth
import ProtectedRoute from "./components/auth/ProtectedRoute"
import Login from "./components/auth/Login"

// Super Admin Pages
import SuperAdminDashboard from "./components/superadmin/SuperAdminDashboard"
import SuperAdminInstitutions from "./components/superadmin/SuperAdminInstitutions"
import InstitutionDetails from "./components/superadmin/InstitutionDetails"
import SuperAdminsPage from "./components/superadmin/SuperAdminsPage"
import NotificationsPage from "./components/superadmin/NotificationsPage"
import AllUsersPage from "./components/superadmin/AllUsersPage"
import AnalyticsPage from "./components/superadmin/AnalyticsPage"
import SettingsPage from "./components/superadmin/SettingsPage"

// Pages Temporárias / Placeholder
function UnauthorizedPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-4">Acesso Negado</h1>
        <p className="text-gray-600 mb-8">Você não tem permissão para acessar esta página.</p>
        <a
          href="/login"
          className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
        >
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
        <a
          href="/super-admin"
          className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
        >
          Voltar para Dashboard
        </a>
      </div>
    </div>
  )
}

function App() {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        await supabase.auth.getSession()
        setInitialized(true)
      } catch (error) {
        console.error("Initialization error:", error)
        setInitialized(true)
      }
    }

    init()
  }, [])

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-600"></div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* SUPER ADMIN ROUTES */}
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/institutions"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <SuperAdminInstitutions />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/institutions/:id"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <InstitutionDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/super-admins"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <SuperAdminsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/notifications"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/users"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <AllUsersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/analytics"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/settings"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Redirect root to super-admin */}
        <Route path="/" element={<Navigate to="/super-admin" replace />} />

        {/* Catch all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
