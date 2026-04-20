import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'

// ── Auth ──────────────────────────────────────────────────────────────────
import LoginForm    from './components/auth/LoginForm'
import InitialSetup from './components/auth/InitialSetup'

// ── Public pages ──────────────────────────────────────────────────────────
import TransferSurveyPage from './pages/survey/TransferSurveyPage'
import SatisfactionPage   from './pages/survey/SatisfactionPage'
import Landing            from './pages/Landing'
import ResetPassword      from './pages/ResetPassword'
import Privacidade        from './pages/Privacidade'
import Termos             from './pages/Termos'
import SobreNos           from './pages/SobreNos'
import Parceiros          from './pages/Parceiros'
import Blog, { BlogPost } from './pages/Blog'

// ── School user ───────────────────────────────────────────────────────────
import Dashboard         from './components/dashboard/Dashboard'
import GestorHome        from './pages/gestor/GestorHome'
import AttendantHome     from './pages/gestor/AttendantHome'
import GestorTransfers   from './pages/gestor/GestorTransfers'
import GestorSurveys     from './pages/gestor/GestorSurveys'
import GestorEmbed       from './pages/gestor/GestorEmbed'
import LeadKanban        from './components/leads/LeadKanban'
import VisitCalendar     from './components/calendar/VisitCalendar'
import EnrollmentManager from './components/enrollments/EnrollmentManager'
import WhatsAppHub       from './components/whatsapp/WhatsAppHub'
import GestorReports     from './components/reports/GestorReports'
import UserManagement    from './components/management/UserManagement'
import SystemSettings    from './components/management/SystemSettings'
import UserProfile       from './components/management/UserProfile'

// ── Layout ────────────────────────────────────────────────────────────────
import Sidebar from './components/layout/Sidebar'
import TopBar  from './components/layout/TopBar'

// ── Super Admin ───────────────────────────────────────────────────────────
import AdminHome        from './components/superadmin/AdminHome'
import AdminSchools     from './components/superadmin/AdminSchools'
import AdminFinancial   from './components/superadmin/AdminFinancial'
import AdminContracts   from './components/superadmin/AdminContracts'
import AdminSettings    from './components/superadmin/AdminSettings'
import AdminCRM         from './components/superadmin/AdminCRM'
import AdminOnboarding  from './components/superadmin/AdminOnboarding'
import AdminConsultants from './components/superadmin/AdminConsultants'
import AdminProfile     from './components/superadmin/AdminProfile.tsx'
import ConsultantDetails from './components/superadmin/ConsultantDetails'

// ── Pending screen ────────────────────────────────────────────────────────
import PendingScreen from './components/PendingScreen'

// ── Legado ────────────────────────────────────────────────────────────────
import SuperAdminInstitutions from './components/superadmin/SuperAdminInstitutions'
import InstitutionDetails     from './components/superadmin/InstitutionDetails'
import ConsultantHome         from './components/superadmin/ConsultantHome'
import ConsultantSchools      from './components/superadmin/ConsultantSchools'
import ConsultantContracts    from './components/superadmin/ConsultantContracts'

// ─── Guards ───────────────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />
  return <>{children}</>
}

function RequireRole({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user } = useAuth()
  const match = roles.includes(user?.role ?? '') || roles.includes(user?.user_type ?? '')
  if (!match) return <Navigate to="/unauthorized" replace />
  return <>{children}</>
}

function ReportsPage() {
  const { user } = useAuth()
  return (
    <GestorReports
      institutionId={user?.institution_id || ''}
      institutionName={user?.institution_name || user?.full_name || 'Escola'}
    />
  )
}

// ─── Páginas simples ──────────────────────────────────────────────────────
function UnauthorizedPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Acesso negado</h1>
        <p className="text-gray-500 mb-6">Você não tem permissão para acessar esta página.</p>
        <a href="/login" className="px-6 py-3 bg-cyan-600 text-white rounded-xl font-semibold hover:bg-cyan-700 inline-block">
          Voltar para o login
        </a>
      </div>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Página não encontrada</h1>
        <p className="text-gray-500 mb-6">A página que você procura não existe.</p>
        <a href="/super-admin" className="px-6 py-3 bg-cyan-600 text-white rounded-xl font-semibold hover:bg-cyan-700 inline-block">
          Voltar para o dashboard
        </a>
      </div>
    </div>
  )
}

// ─── Limpeza de cache legado ───────────────────────────────────────────────
function purgeLegacyCache() {
  try {
    const raw = localStorage.getItem('inscribo-user')
    if (!raw) return
    const cached = JSON.parse(raw)
    const isLegacy =
      cached.institution_id === 'super-admin' ||
      (cached.is_super_admin && !cached.user_type)
    if (isLegacy) {
      localStorage.removeItem('inscribo-user')
      localStorage.removeItem('inscribo-auth-token')
    }
  } catch {}
}

// ─── App Content ──────────────────────────────────────────────────────────
function AppContent() {
  const { user, initializing } = useAuth()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    purgeLegacyCache()
    supabase.auth.getSession()
      .catch(console.error)
      .finally(() => setReady(true))
  }, [])

  const { pathname } = window.location
  if (pathname.startsWith('/survey/')) {
    return <Routes><Route path="/survey/:token" element={<TransferSurveyPage />} /></Routes>
  }
  if (pathname.startsWith('/satisfaction/')) {
    return <Routes><Route path="/satisfaction/:token" element={<SatisfactionPage />} /></Routes>
  }

  if (initializing || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="text-center">
          <img src="/aion-logo-full.png" alt="Áion Edu" style={{ height: 48, objectFit: 'contain', marginBottom: 24 }} />
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 mt-1">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/"               element={<Landing />} />
        <Route path="/privacidade"    element={<Privacidade />} />
        <Route path="/termos"         element={<Termos />} />
        <Route path="/sobre"          element={<SobreNos />} />
        <Route path="/parceiros"      element={<Parceiros />} />
        <Route path="/blog"           element={<Blog />} />
        <Route path="/blog/:slug"     element={<BlogPost />} />
        <Route path="/login"          element={<LoginForm />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/unauthorized"   element={<UnauthorizedPage />} />
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // ── ÁREA DO ADMIN ─────────────────────────────────────────────────────
  const isAdminArea =
    user.user_type === 'admin_geral' ||
    user.user_type === 'consultant'  ||
    user.role      === 'super_admin' ||
    user.role      === 'admin_geral'

  if (isAdminArea) {
    const isConsultant = user.user_type === 'consultant'
    const defaultPath  = isConsultant ? '/super-admin/consultant' : '/super-admin'

    return (
      <Routes>
        <Route path="/super-admin"                    element={<AdminHome />} />
        <Route path="/super-admin/crm"                element={<AdminCRM />} />
        <Route path="/super-admin/onboarding"         element={<AdminOnboarding />} />
        <Route path="/super-admin/schools"            element={<AdminSchools />} />
        <Route path="/super-admin/consultants"        element={<AdminConsultants />} />
        <Route path="/super-admin/consultants/:id"    element={<ConsultantDetails />} />
        <Route path="/super-admin/financial"          element={<AdminFinancial />} />
        <Route path="/super-admin/contracts"          element={<AdminContracts />} />
        <Route path="/super-admin/settings"           element={<AdminSettings />} />
        <Route path="/super-admin/profile"            element={<AdminProfile />} />

        {/* Legado */}
        <Route path="/super-admin/institutions"       element={<SuperAdminInstitutions />} />
        <Route path="/super-admin/institutions/:id"   element={<InstitutionDetails />} />

        {/* Consultor */}
        <Route path="/super-admin/consultant"             element={<ConsultantHome />} />
        <Route path="/super-admin/consultant/schools"     element={<ConsultantSchools />} />
        <Route path="/super-admin/consultant/contracts"   element={<ConsultantContracts />} />

        <Route path="/unauthorized"  element={<UnauthorizedPage />} />
        <Route path="/login"         element={<Navigate to={defaultPath} replace />} />
        <Route path="/"              element={<Navigate to={defaultPath} replace />} />
        <Route path="*"              element={<NotFoundPage />} />
      </Routes>
    )
  }
// ── BLOQUEIO POR STATUS ───────────────────────────────────────────────────
if (user.user_type === 'school_user') {
  if (user.plan_status === 'pending_contract') return <PendingScreen type="contract" />
  if (user.plan_status === 'pending_payment') return <PendingScreen type="payment" />
  if (user.plan_status === 'suspended') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #E2E8F0', padding: 48, maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 8px 48px rgba(0,0,0,0.07)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <span style={{ fontSize: 32 }}>🔒</span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 10 }}>Acesso suspenso</h2>
        <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7, marginBottom: 28 }}>
          Sua conta foi suspensa por inadimplência. Entre em contato com a equipe Áion Edu para regularizar.
        </p>
        <p style={{ fontSize: 13, color: '#94A3B8' }}>Dúvidas? <strong>(83) 98556-6393</strong></p>
        <button onClick={() => { localStorage.clear(); window.location.href = '/login' }}
          style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#94A3B8', textDecoration: 'underline' }}>
          Sair
        </button>
      </div>
    </div>
  )
}
  // ── ÁREA DA ESCOLA ────────────────────────────────────────────────────
  const isAttendant   = user.role === 'user'
  const schoolDefault = isAttendant ? '/atendente' : '/home'

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-page)' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg-page)' }}>
          <Routes>
            <Route path="/" element={<Navigate to={schoolDefault} replace />} />
            <Route path="/home" element={<RequireRole roles={['admin','manager']}><GestorHome /></RequireRole>} />
            <Route path="/atendente" element={<RequireRole roles={['user','school_user']}><AttendantHome /></RequireRole>} />
            <Route path="/dashboard"      element={<Dashboard />} />
            <Route path="/leads"          element={<LeadKanban />} />
            <Route path="/visits"         element={<VisitCalendar />} />
            <Route path="/enrollments"    element={<EnrollmentManager />} />
            <Route path="/whatsapp"       element={<WhatsAppHub />} />
            <Route path="/transferencias" element={<GestorTransfers />} />
            <Route path="/pesquisas"      element={<GestorSurveys />} />
            <Route path="/embed" element={<ProtectedRoute allowedRoles={['admin','manager']}><GestorEmbed /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={['manager','admin']}><ReportsPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><SystemSettings /></ProtectedRoute>} />
            <Route path="/profile"      element={<UserProfile />} />
            <Route path="/setup"        element={<InitialSetup />} />
            <Route path="/login"        element={<Navigate to={schoolDefault} replace />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="*"             element={<Navigate to={schoolDefault} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}