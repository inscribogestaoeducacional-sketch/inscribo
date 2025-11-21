"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SuperAdminService } from "@/lib/supabase";
import {
  LayoutDashboard,
  Building2,
  Users,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    totalInstitutions: 0,
    activeInstitutions: 0,
    inactiveInstitutions: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await SuperAdminService.getStats();
      setStats(data);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {loading ? "..." : value}
          </p>
          {subtext && (
            <p className="text-xs text-gray-500 mt-1">{subtext}</p>
          )}
        </div>
        <Icon className="h-12 w-12" style={{ color }} />
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Visão geral do sistema Inscribo</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total de Instituições"
          value={stats.totalInstitutions}
          icon={Building2}
          color="#3B82F6"
        />
        <StatCard
          title="Instituições Ativas"
          value={stats.activeInstitutions}
          icon={TrendingUp}
          color="#10B981"
        />
        <StatCard
          title="Instituições Inativas"
          value={stats.inactiveInstitutions}
          icon={AlertCircle}
          color="#6B7280"
        />
        <StatCard
          title="Total de Usuários"
          value={stats.totalUsers}
          icon={Users}
          color="#8B5CF6"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/super-admin/institutions"
          className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-white"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <Building2 className="h-12 w-12" />
              <svg className="h-6 w-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Gerenciar Instituições</h3>
            <p className="text-blue-100">
              Criar, editar e visualizar todas as instituições cadastradas no sistema
            </p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-500" />
        </Link>

        <Link
          href="/super-admin/users"
          className="group relative overflow-hidden bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-white"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-12 w-12" />
              <svg className="h-6 w-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Gerenciar Usuários</h3>
            <p className="text-green-100">
              Adicionar, editar e gerenciar usuários de todas as instituições
            </p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-500" />
        </Link>
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 rounded-lg p-3">
            <LayoutDashboard className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Super Admin Dashboard</h4>
            <p className="text-sm text-gray-600">
              Você tem acesso completo para gerenciar todas as instituições e usuários do sistema. 
              Use as opções acima para navegar entre as diferentes seções.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
