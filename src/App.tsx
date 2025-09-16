import React, { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginForm from './components/auth/LoginForm'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import Dashboard from './components/dashboard/Dashboard'
import LeadKanban from './components/leads/LeadKanban'
import VisitCalendar from './components/calendar/VisitCalendar'
import EnrollmentManager from './components/enrollments/EnrollmentManager'
import MarketingCPA from './components/marketing/MarketingCPA'
import FunnelAnalysis from './components/funnel/FunnelAnalysis'
import ReEnrollments from './components/reenrollments/ReEnrollments'
import ActionsManager from './components/actions/ActionsManager'
import Reports from './components/reports/Reports'
import UserManagement from './components/management/UserManagement'
import SystemSettings from './components/management/SystemSettings'
import { GraduationCap } from 'lucide-react'

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'leads':
        return <LeadKanban />
      case 'calendar':
        return <VisitCalendar />
      case 'matriculas':
        return <EnrollmentManager />
      case 'marketing':
        return <MarketingCPA />
      case 'funil':
        return <FunnelAnalysis />
      case 'rematriculas':
        return <ReEnrollments />
      case 'acoes':
        return <ActionsManager />
      case 'relatorios':
        return <Reports />
      case 'usuarios':
        return <UserManagement />
      case 'configuracoes':
        return <SystemSettings />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <main className="flex-1 overflow-auto bg-gray-50">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()

  // Show loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Carregando Inscribo...</p>
          <p className="text-sm text-gray-500">Sistema de Gestão Educacional</p>
        </div>
      </div>
    )
  }

  // Show login if no user
  if (!user) {
    return <LoginForm />
  }

  // Show main app if logged in
  return <MainApp />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App