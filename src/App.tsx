import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { hasSupabaseConfig } from './lib/supabase';
import { LoginForm } from './components/auth/LoginForm';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/dashboard/Dashboard';
import { LeadsKanban } from './components/leads/LeadsKanban';
import { CalendarView } from './components/calendar/CalendarView';
import { Reports } from './components/reports/Reports';
import { UserManagement } from './components/users/UserManagement';
import { Settings } from './components/settings/Settings';

function App() {
  const { user, profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginForm />;
  }

  // Authenticated user
  const currentProfile = profile || {
    id: user?.id || 'user',
    full_name: user?.user_metadata?.full_name || 'Usuário',
    email: user?.email || 'user@email.com',
    role: 'user' as const,
    institution_id: null,
    avatar_url: null,
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={setCurrentPage}
        profile={currentProfile}
        onSignOut={signOut}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={getPageTitle(currentPage)} subtitle={getPageSubtitle(currentPage)} />
        
        <main className="flex-1 overflow-y-auto">
          {renderCurrentPage(currentPage, setCurrentPage, currentProfile)}
        </main>
      </div>
    </div>
  );
}

function getPageTitle(currentPage: string) {
  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    leads: 'Gestão de Leads',
    calendar: 'Calendário de Visitas',
    reports: 'Relatórios',
    users: 'Gestão de Usuários',
    settings: 'Configurações',
  };
  return titles[currentPage] || 'Dashboard';
}

function getPageSubtitle(currentPage: string) {
  const subtitles: Record<string, string> = {
    dashboard: 'Visão geral das suas atividades',
    leads: 'Gerencie seus leads através do funil de vendas',
    calendar: 'Agende e gerencie visitas',
    reports: 'Análise de performance e conversões',
    users: 'Gerenciar usuários do sistema',
    settings: 'Configurações gerais do sistema',
  };
  return subtitles[currentPage];
}

function renderCurrentPage(currentPage: string, setCurrentPage: (page: string) => void, profile: any) {
  switch (currentPage) {
    case 'dashboard':
      return <Dashboard onNavigate={setCurrentPage} profile={profile} />;
    case 'leads':
      return <LeadsKanban />;
    case 'calendar':
      return <CalendarView />;
    case 'reports':
      return <Reports />;
    case 'users':
      return <UserManagement />;
    case 'settings':
      return <Settings />;
    default:
      return <Dashboard onNavigate={setCurrentPage} profile={profile} />;
  }
}

export default App;
