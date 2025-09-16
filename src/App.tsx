import React, { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Visão geral do sistema</p>
            </div>
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
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Gestão de Alunos</h1>
              <p className="text-gray-600">Controle de alunos matriculados</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Módulo de Alunos</h3>
                <p className="text-gray-600">Sistema integrado ao Supabase para gestão completa de alunos</p>
              </div>
            </div>
          </div>
        )
      case 'courses':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Gestão de Cursos</h1>
              <p className="text-gray-600">Controle de cursos e disciplinas</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Módulo de Cursos</h3>
                <p className="text-gray-600">Sistema integrado ao Supabase para gestão de cursos</p>
              </div>
            </div>
          </div>
        )
      case 'teachers':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Gestão de Professores</h1>
              <p className="text-gray-600">Controle do corpo docente</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Módulo de Professores</h3>
                <p className="text-gray-600">Sistema integrado ao Supabase para gestão de professores</p>
              </div>
            </div>
          </div>
        )
      case 'enrollments':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Gestão de Matrículas</h1>
              <p className="text-gray-600">Controle de matrículas e pagamentos</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Módulo de Matrículas</h3>
                <p className="text-gray-600">Sistema integrado ao Supabase para gestão de matrículas</p>
              </div>
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
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Rematrículas</h1>
              <p className="text-gray-600">Controle de rematrículas e retenção</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Módulo de Rematrículas</h3>
                <p className="text-gray-600">Sistema integrado ao Supabase para controle de rematrículas</p>
              </div>
            </div>
          </div>
        )
      case 'actions':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Ações Automáticas</h1>
              <p className="text-gray-600">Sugestões inteligentes de ações</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Módulo de Ações</h3>
                <p className="text-gray-600">Sistema integrado ao Supabase para sugestões automáticas</p>
              </div>
            </div>
          </div>
        )
      case 'reports':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
              <p className="text-gray-600">Análises e relatórios detalhados</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Módulo de Relatórios</h3>
                <p className="text-gray-600">Sistema integrado ao Supabase para relatórios avançados</p>
              </div>
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
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Visão geral do sistema</p>
            </div>
            <DashboardKPIs />
            <DashboardCharts />
          </div>
        )
    }
  }

  return (
    <div className={`flex h-screen bg-gray-50 ${darkMode ? 'dark' : ''}`}>
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
  const { session, loading, user } = useAuth()
  const [needsSetup, setNeedsSetup] = useState(false)

  // Show loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-20 w-20 mx-auto mb-6 rounded-full overflow-hidden bg-white shadow-lg">
            <img 
              src="/Inscribo.jpeg" 
              alt="Inscribo" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Carregando Inscribo...</p>
          <p className="text-sm text-gray-500 mt-2">Sistema de Gestão Educacional</p>
        </div>
      </div>
    )
  }

  // Show setup if needed
  if (needsSetup) {
    return <InitialSetup onComplete={() => setNeedsSetup(false)} />
  }

  // Show login if no session
  if (!session) {
    return <LoginForm />
  }

  // Show dashboard if logged in
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