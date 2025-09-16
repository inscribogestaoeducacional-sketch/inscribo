import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'
import LoginForm from './components/auth/LoginForm'
import InitialSetup from './components/auth/InitialSetup'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import DashboardKPIs from './components/dashboard/DashboardKPIs'
import DashboardCharts from './components/dashboard/DashboardCharts'
import LeadKanban from './components/leads/LeadKanban'
import VisitCalendar from './components/calendar/VisitCalendar'
import MarketingCPA from './components/marketing/MarketingCPA'
import FunnelAnalysis from './components/funnel/FunnelAnalysis'
import UserManagement from './components/management/UserManagement'
import SystemSettings from './components/management/SystemSettings'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [darkMode, setDarkMode] = useState(false)

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="p-6">
            <DashboardKPIs />
            <DashboardCharts />
          </div>
        )
      case 'leads':
        return <LeadKanban />
      case 'calendar':
        return <VisitCalendar />
      case 'students':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Gestão de Alunos</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Módulo de gestão de alunos integrado ao Supabase...</p>
            </div>
          </div>
        )
      case 'courses':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Gestão de Cursos</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Módulo de gestão de cursos integrado ao Supabase...</p>
            </div>
          </div>
        )
      case 'teachers':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Gestão de Professores</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Módulo de gestão de professores integrado ao Supabase...</p>
            </div>
          </div>
        )
      case 'enrollments':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Gestão de Matrículas</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Módulo de gestão de matrículas integrado ao Supabase...</p>
            </div>
          </div>
        )
      case 'marketing':
        return <MarketingCPA />
      case 'funnel':
        return <FunnelAnalysis />
      case 'reenrollments':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Rematrículas</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Módulo de rematrículas integrado ao Supabase...</p>
            </div>
          </div>
        )
      case 'actions':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Ações Automáticas</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Sugestões de ações integradas ao Supabase...</p>
            </div>
          </div>
        )
      case 'reports':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Relatórios</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Módulo de relatórios integrado ao Supabase...</p>
            </div>
          </div>
        )
      case 'users':
        return <UserManagement />
      case 'settings':
        return <SystemSettings />
      default:
        return (
          <div className="p-6">
            <DashboardKPIs />
            <DashboardCharts />
          </div>
        )
    }
  }

  return (
    <div className={`flex h-screen bg-gray-100 ${darkMode ? 'dark' : ''}`}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar darkMode={darkMode} setDarkMode={setDarkMode} />
        
        <main className="flex-1 overflow-auto bg-gray-50">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  const [needsSetup, setNeedsSetup] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full overflow-hidden bg-white shadow-lg">
            <img 
              src="/Inscribo.jpeg" 
              alt="Inscribo" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando sistema...</p>
        </div>
      </div>
    )
  }

  if (needsSetup) {
    return <InitialSetup onComplete={() => {
      setNeedsSetup(false)
    }} />
  }

  if (!user) {
    return <LoginForm />
  }

  return <Dashboard />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App