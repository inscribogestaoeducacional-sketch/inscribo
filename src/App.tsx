import { BrandLoader } from './components/ui/BrandLoader'
import { useStageLabelsVersion } from './lib/stageLabels'
import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import PageTitle from './components/PageTitle'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PermissionsProvider, usePermissions } from './contexts/PermissionsContext'
import { supabase } from './lib/supabase'
import TourPlayer from './components/academy/TourPlayer'
import HelpPanel from './components/academy/HelpPanel'
import Academia from './pages/Academia'
import AdminSupport from './components/superadmin/AdminSupport'

// ── Auth ──────────────────────────────────────────────────────────────────
import LoginForm    from './components/auth/LoginForm'
import AppWelcome   from './pages/AppWelcome'
import NewLookGate from './components/layout/NewLookGate'
import InitialSetup from './components/auth/InitialSetup'

// ── Public pages ──────────────────────────────────────────────────────────
import TransferSurveyPage from './pages/survey/TransferSurveyPage'
import SatisfactionPage   from './pages/survey/SatisfactionPage'
import ProposalView       from './pages/ProposalView'
import RaioXPage          from './pages/RaioXPage'
import NovidadeCaptacao   from './pages/NovidadeCaptacao'
import NovidadeModulo     from './pages/NovidadeModulo'
import { NOVIDADE_VITRINE } from './pages/novidadeVitrineContent'
import { NOVIDADE_TRANSMISSOES } from './pages/novidadeTransmissoesContent'
import Landing            from './pages/Landing'
import { lazy, Suspense } from 'react'
const SiteHome = lazy(() => import('./site/Home'))
const SiteModules = lazy(() => import('./site/pages/ModulesHub'))
const SiteModule = lazy(() => import('./site/pages/ModuleRoute'))
void Landing
import ResetPassword      from './pages/ResetPassword'
import Privacidade        from './pages/Privacidade'
import Termos             from './pages/Termos'
import SobreNos           from './pages/SobreNos'
import Parceiros          from './pages/Parceiros'
import ParceriaMeta       from './pages/ParceriaMeta'
import Blog, { BlogPost } from './pages/Blog'

// ── School user ───────────────────────────────────────────────────────────
import Dashboard         from './components/dashboard/Dashboard'
import GestorHome        from './pages/gestor/GestorHomeNew'
import AttendantHome     from './pages/gestor/AttendantHomeNew'
import GestorTransfers   from './pages/gestor/GestorTransfers'
import GestorUpdates     from './pages/gestor/GestorUpdates'
import GestorSurveys     from './pages/gestor/GestorSurveys'
import GestorEmbed       from './pages/gestor/GestorEmbed'
import CaptacaoInteligente from './pages/gestor/CaptacaoInteligente'
import Vitrine from './pages/gestor/Vitrine'
import Transmissoes from './pages/gestor/Transmissoes'
import BaseAlunos from './pages/gestor/BaseAlunos'
import CampanhaMatriculas from './pages/gestor/CampanhaMatriculas'
import LeadKanban        from './components/leads/LeadKanban'
import VisitCalendar     from './components/calendar/VisitCalendar'
import WhatsAppHub       from './components/whatsapp/WhatsAppHub'
import HubErrorBoundary  from './components/whatsapp/HubErrorBoundary'
import ScreenErrorBoundary from './components/common/ScreenErrorBoundary'
import CentralRelatorios from './components/relatorios/CentralRelatorios'
import ClientsModule    from './components/clients/ClientsModule'
import ContactsModule  from './components/contacts/ContactsModule'
import UserManagement    from './components/management/UserManagement'
import SystemSettings    from './components/management/SystemSettings'
import UserProfile       from './components/management/UserProfile'

// ── Layout ────────────────────────────────────────────────────────────────
import Sidebar from './components/layout/Sidebar'
import TopBar  from './components/layout/TopBar'
import GestorUpdatePopup from './components/updates/GestorUpdatePopup'
import InternalChatWidget from './components/chat/InternalChatWidget'

// ── Super Admin ───────────────────────────────────────────────────────────
import AdminHome        from './components/superadmin/AdminHome'
import AdminSchools     from './components/superadmin/AdminSchools'
import AdminRoteiro     from './components/superadmin/AdminRoteiro'
import RoteiroCampanha from './pages/gestor/RoteiroCampanha'
import AdminFinancial   from './components/superadmin/AdminFinancial'
import AdminBroadcastPricing from './components/superadmin/AdminBroadcastPricing'
import AdminSettings    from './components/superadmin/AdminSettings'
import AdminCRM         from './components/superadmin/AdminCRM'
import AdminConsultants from './components/superadmin/AdminConsultants'
import AdminUpdates     from './components/superadmin/AdminUpdates'
import AdminProfile     from './components/superadmin/AdminProfile.tsx'
import AdminWhatsApp    from './components/superadmin/AdminWhatsApp'
import AdminWhatsAppTemplates from './components/superadmin/AdminWhatsAppTemplates'
import AdminAionInbox          from './components/superadmin/AdminAionInbox'
import AdminMarketIntelligence from './components/superadmin/AdminMarketIntelligence'
import ConsultantDetails       from './components/superadmin/ConsultantDetails'
import AdminSchoolGroups       from './components/superadmin/AdminSchoolGroups'
import AdminShowcaseSchools    from './components/superadmin/AdminShowcaseSchools'

// ── Pending screen ────────────────────────────────────────────────────────
import PendingScreen from './components/PendingScreen'
import InstitutionSelectionScreen from './components/auth/InstitutionSelectionScreen'

// ── Legado ────────────────────────────────────────────────────────────────
import InstitutionDetails     from './components/superadmin/InstitutionDetails'
import ConsultantHome         from './components/superadmin/ConsultantHome'
import ConsultantSchools      from './components/superadmin/ConsultantSchools'
import ConsultantContracts    from './components/superadmin/ConsultantContracts'

// Nomes das etapas do funil (por escola): carrega e redesenha as telas quando mudam.
function StageLabelsGate({ institutionId, children }: { institutionId?: string | null; children: React.ReactNode }) {
  const version = useStageLabelsVersion(institutionId)
  return <React.Fragment key={version}>{children}</React.Fragment>
}

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

function PermissionDenied() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('permission-denied', {
      detail: { message: 'Você não tem permissão para acessar este módulo.' }
    }))
  }, [])
  return <Navigate to="/atendente" replace />
}

function PermissionRoute({ children, module }: { children: React.ReactNode; module: string }) {
  const { user } = useAuth()
  const { isModuleEnabled, loading } = usePermissions()
  if (!user || user.role !== 'user') return <>{children}</>
  if (loading) return null
  if (!isModuleEnabled(module)) return <PermissionDenied />
  return <>{children}</>
}

function GlobalToast() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    const handler = (e: Event) => {
      setMsg((e as CustomEvent).detail.message)
      setTimeout(() => setMsg(null), 4000)
    }
    window.addEventListener('permission-denied', handler)
    return () => window.removeEventListener('permission-denied', handler)
  }, [])
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 18px', fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
      🔒 {msg}
    </div>
  )
}

function ReportsPage() {
  const { user } = useAuth()
  return (
    <CentralRelatorios
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
  // Abertura com a animação da logo: toca inteira a cada abertura do app (~3,6 s), mesmo que a página carregue antes.
  const [introDone, setIntroDone] = useState(false)
  useEffect(() => {
    if (introDone) return
    const t = setTimeout(() => setIntroDone(true), 3600)
    return () => clearTimeout(t)
  }, [introDone])
  const [schoolStatus, setSchoolStatus] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    purgeLegacyCache()
    supabase.auth.getSession()
      .catch(console.error)
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    const checkSchoolStatus = async () => {
      if (user?.user_type === 'school_user' && user?.institution_id) {
        setCheckingStatus(true)
        const { data } = await supabase
          .from('institutions')
          .select('plan_status')
          .eq('id', user.institution_id)
          .single()
        setSchoolStatus(data?.plan_status || null)
        setCheckingStatus(false)
      }
    }
    if (user) checkSchoolStatus()
  }, [user])

  const { pathname } = window.location
  if (pathname.startsWith('/survey/')) {
    return <Routes><Route path="/survey/:token" element={<TransferSurveyPage />} /></Routes>
  }
  if (pathname.startsWith('/satisfaction/')) {
    return <Routes><Route path="/satisfaction/:token" element={<SatisfactionPage />} /></Routes>
  }
  if (pathname.startsWith('/proposta/')) {
    return <Routes><Route path="/proposta/:token" element={<ProposalView />} /></Routes>
  }
  if (pathname.startsWith('/raio-x')) {
    return <Routes><Route path="/raio-x" element={<RaioXPage />} /></Routes>
  }
  // Página de novidade: link enviado a clientes (logados) e prospects — abre igual pros dois
  if (pathname.startsWith('/novidades/captacao-inteligente')) {
    return <Routes><Route path="/novidades/captacao-inteligente" element={<NovidadeCaptacao />} /></Routes>
  }
  if (pathname.startsWith('/novidades/vitrine')) {
    return <Routes><Route path="/novidades/vitrine" element={<NovidadeModulo content={NOVIDADE_VITRINE} />} /></Routes>
  }
  if (pathname.startsWith('/novidades/transmissoes')) {
    return <Routes><Route path="/novidades/transmissoes" element={<NovidadeModulo content={NOVIDADE_TRANSMISSOES} />} /></Routes>
  }

  // O site público (início, módulos, integrações, guias, blog...) abre direto, sem a tela de carregamento.
  // A animação da logo fica para o app instalado, para o login e para quem já tem sessão salva.
  const PUBLIC_PATHS = ['/modulos', '/integracoes', '/guias', '/sobre', '/blog', '/parceiros', '/parceria-meta', '/privacidade', '/termos']
  const isPublicPath = pathname === '/' || PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  let standalone = false
  let hasStoredSession = false
  try {
    standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
    hasStoredSession = Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k))
  } catch { /* sem acesso ao armazenamento: segue com o carregamento normal */ }
  const skipLoader = isPublicPath && !standalone && !hasStoredSession

  if (!skipLoader && (initializing || !ready || !introDone)) {
    return (
      <BrandLoader fullscreen label="Carregando" />
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/"               element={<Suspense fallback={null}><SiteHome /></Suspense>} />
        <Route path="/modulos"        element={<Suspense fallback={null}><SiteModules /></Suspense>} />
        <Route path="/modulos/:slug"  element={<Suspense fallback={null}><SiteModule /></Suspense>} />
        <Route path="/privacidade"    element={<Privacidade />} />
        <Route path="/termos"         element={<Termos />} />
        <Route path="/sobre"          element={<SobreNos />} />
        <Route path="/parceiros"      element={<Parceiros />} />
        <Route path="/parceria-meta"  element={<ParceriaMeta />} />
        <Route path="/blog"           element={<Blog />} />
        <Route path="/blog/:slug"     element={<BlogPost />} />
        <Route path="/entrar"         element={<AppWelcome />} />
        <Route path="/login"          element={<LoginForm />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/unauthorized"   element={<UnauthorizedPage />} />
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // ── SELEÇÃO DE INSTITUIÇÃO (Fase 2 de "usuário em múltiplas instituições") ─
  // Usuário tem 2+ vínculos em user_institutions e nenhum deles é a
  // instituição ativa atual — precisa escolher antes de ver qualquer coisa.
  // Sempre false pra admin_geral/consultant e pra quem tem só 1 vínculo (a
  // grande maioria hoje), então não muda o comportamento de ninguém além de
  // quem realmente está em mais de uma instituição.
  if (user.needsInstitutionSelection) {
    return <InstitutionSelectionScreen />
  }

  // ── ÁREA DO ADMIN ─────────────────────────────────────────────────────
  const isAdminArea =
    user.user_type === 'admin_geral' ||
    user.user_type === 'consultant'  ||
    (user.role as string) === 'super_admin' ||
    (user.role as string) === 'admin_geral'

  if (isAdminArea) {
    const isConsultant = user.user_type === 'consultant'
    const defaultPath  = isConsultant ? '/super-admin/consultant' : '/super-admin'

    return (
      <>
      <NewLookGate />
      <Routes>
        <Route path="/super-admin"                    element={<AdminHome />} />
        <Route path="/super-admin/crm"                element={<AdminCRM />} />
        <Route path="/super-admin/schools"              element={<AdminSchools />} />
        <Route path="/super-admin/roteiro"              element={<AdminRoteiro />} />
        <Route path="/super-admin/schools/:id"        element={<InstitutionDetails />} />
        <Route path="/super-admin/school-groups"       element={<AdminSchoolGroups />} />
        <Route path="/super-admin/school-groups/:id"   element={<AdminSchoolGroups />} />
        <Route path="/super-admin/showcase-schools"    element={<AdminShowcaseSchools />} />
        <Route path="/super-admin/market-intelligence" element={<AdminMarketIntelligence />} />
        <Route path="/super-admin/consultants"        element={<AdminConsultants />} />
        <Route path="/super-admin/consultants/:id"    element={<ConsultantDetails />} />
        <Route path="/super-admin/financial"          element={<AdminFinancial />} />
        <Route path="/super-admin/transmissoes/precos" element={<AdminBroadcastPricing />} />
        <Route path="/super-admin/settings"           element={<AdminSettings />} />
        <Route path="/super-admin/updates"           element={<AdminUpdates />} />
        <Route path="/super-admin/support"           element={<AdminSupport />} />
        <Route path="/super-admin/whatsapp"          element={<AdminWhatsApp />} />
        <Route path="/super-admin/whatsapp-templates" element={<AdminWhatsAppTemplates />} />
        <Route path="/super-admin/aion-inbox"         element={<AdminAionInbox />} />
        <Route path="/super-admin/profile"            element={<AdminProfile />} />

        {/* Legado */}
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
      </>
    )
  }
  // ── BLOQUEIO POR STATUS ───────────────────────────────────────────────────
  if (user.user_type === 'school_user') {
    if (checkingStatus) return <BrandLoader fullscreen label="Verificando acesso" />
    if (schoolStatus === 'pending_contract') return <PendingScreen type="contract" />
    if (schoolStatus === 'pending_payment') return <PendingScreen type="payment" />
    if (schoolStatus === 'suspended') return <PendingScreen type="suspended" />
  }
  // ── ÁREA DA ESCOLA ────────────────────────────────────────────────────
  const isAttendant   = user.role === 'user'
  const schoolDefault = isAttendant ? '/atendente' : '/home'

  // Popup automático de novidade não lida — só pro gestor da escola (admin/
  // manager), não pro atendente nem pro Áion/admin_geral (esses passam pela
  // ÁREA DO ADMIN acima, que nem chega neste bloco).
  const isGestor = user.role === 'admin' || user.role === 'manager'

  return (
    <div className="h-viewport" style={{ display: 'flex', width: '100vw', overflow: 'hidden', background: 'var(--bg-page)' }}>
      <Sidebar />
      <div className="h-viewport" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <NewLookGate />
        {isGestor && user.institution_id && <GestorUpdatePopup institutionId={user.institution_id} />}
        <InternalChatWidget />
        <TourPlayer />
        <HelpPanel />
        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg-page)' }}>
          <StageLabelsGate institutionId={user.institution_id}>
          <ScreenErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to={schoolDefault} replace />} />
            <Route path="/home" element={<RequireRole roles={['admin','manager']}><GestorHome /></RequireRole>} />
            <Route path="/atendente" element={<RequireRole roles={['user','school_user']}><AttendantHome /></RequireRole>} />
            <Route path="/dashboard"      element={<Dashboard />} />
            <Route path="/leads"          element={<PermissionRoute module="leads"><LeadKanban /></PermissionRoute>} />
            <Route path="/clients"        element={<ClientsModule />} />
            <Route path="/contacts"       element={<PermissionRoute module="contatos"><ContactsModule /></PermissionRoute>} />
            <Route path="/visits"         element={<PermissionRoute module="visitas"><VisitCalendar /></PermissionRoute>} />
            <Route path="/whatsapp"       element={<PermissionRoute module="whatsapp"><HubErrorBoundary><WhatsAppHub /></HubErrorBoundary></PermissionRoute>} />
            <Route path="/captacao"       element={<PermissionRoute module="captacao"><CaptacaoInteligente /></PermissionRoute>} />
            <Route path="/vitrine"        element={<PermissionRoute module="vitrine"><Vitrine /></PermissionRoute>} />
            <Route path="/transmissoes"   element={<PermissionRoute module="transmissoes"><Transmissoes /></PermissionRoute>} />
            {/* Etapa B passo 4: atendente só com a permissão base_alunos (o banco confere de novo) */}
            <Route path="/campanha"       element={<ProtectedRoute allowedRoles={['admin','manager']}><CampanhaMatriculas /></ProtectedRoute>} />
            <Route path="/base-alunos"    element={<PermissionRoute module="base_alunos"><BaseAlunos /></PermissionRoute>} />
            <Route path="/transferencias"element={<PermissionRoute module="transferencias"><GestorTransfers /></PermissionRoute>} />
            <Route path="/updates"        element={<GestorUpdates />} />
            <Route path="/pesquisas"      element={<GestorSurveys />} />
            <Route path="/embed" element={<ProtectedRoute allowedRoles={['admin','manager']}><GestorEmbed /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={['manager','admin']}><ReportsPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
            {/* Fase 6.2: gestor também abre; cada item é filtrado por perfil em lib/settingsAccess.ts */}
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin','manager']}><SystemSettings /></ProtectedRoute>} />
            <Route path="/academia"     element={<Academia />} />
            <Route path="/roteiro"      element={<ProtectedRoute allowedRoles={['admin','manager']}><RoteiroCampanha /></ProtectedRoute>} />
            <Route path="/profile"      element={<UserProfile />} />
            <Route path="/setup"        element={<InitialSetup />} />
            <Route path="/login"        element={<Navigate to={schoolDefault} replace />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="*"             element={<Navigate to={schoolDefault} replace />} />
          </Routes>
          </ScreenErrorBoundary>
          </StageLabelsGate>
        </main>
      </div>
    </div>
  )
}

// Toque numa notificação push com o app já aberto (caso típico do celular/PWA):
// o service worker só foca a janela e manda 'aion-open'; aqui a gente navega.
function PushNavBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => {
      const d = e.data
      if (d && d.type === 'aion-open' && typeof d.url === 'string' && d.url.startsWith('/')) {
        navigate(d.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [navigate])
  return null
}

export default function App() {
  return (
    <Router>
      <PageTitle />
      <PushNavBridge />
      <AuthProvider>
        <PermissionsProvider>
          <GlobalToast />
          <AppContent />
        </PermissionsProvider>
      </AuthProvider>
    </Router>
  )
}