import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginForm from './components/auth/LoginForm'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import DashboardKPIs from './components/dashboard/DashboardKPIs'
import DashboardCharts from './components/dashboard/DashboardCharts'
import LeadKanban from './components/leads/LeadKanban'
import VisitCalendar from './components/calendar/VisitCalendar'
import MarketingCPA from './components/marketing/MarketingCPA'
import FunnelAnalysis from './components/funnel/FunnelAnalysis'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [darkMode, setDarkMode] = useState(false)

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <DashboardKPIs />
            <DashboardCharts />
          </div>
        )
      case 'leads':
        return <LeadKanban />
      case 'calendar':
        return <VisitCalendar />
      case 'marketing':
        return <MarketingCPA />
      case 'funnel':
        return <FunnelAnalysis />
      case 'reenrollments':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Rematrículas</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Módulo de rematrículas em desenvolvimento...</p>
            </div>
          </div>
        )
      case 'actions':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Ações Automáticas</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Sugestões de ações em desenvolvimento...</p>
            </div>
          </div>
        )
      case 'reports':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Relatórios</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Módulo de relatórios em desenvolvimento...</p>
            </div>
          </div>
        )
      case 'users':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Gerenciar Usuários</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Gestão de usuários em desenvolvimento...</p>
            </div>
          </div>
        )
      case 'settings':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Configurações</h1>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">Configurações do sistema em desenvolvimento...</p>
            </div>
          </div>
        )
      default:
        return (
          <div>
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
        
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
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