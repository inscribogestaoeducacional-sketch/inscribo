import React, { useState } from 'react'
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
import UserManagement from './components/management/UserManagement'
import SystemSettings from './components/management/SystemSettings'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')

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
      case 'marketing':
        return <MarketingCPA />
      case 'funnel':
        return <FunnelAnalysis />
      case 'users':
        return <UserManagement />
      case 'settings':
        return <SystemSettings />
      default:
        return (
          <div className="p-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Módulo em Desenvolvimento</h3>
                <p className="text-gray-600">Esta funcionalidade será implementada em breve</p>
              </div>
            </div>
          </div>
        )
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
          <p className="text-sm text-gray-500">Sistema de Gestão Educacional</p>
        </div>
      </div>
    )
  }

  // Show login if no user
  if (!user) {
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