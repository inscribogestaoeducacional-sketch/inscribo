'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building,
  Users,
  CreditCard,
  FileText,
  Settings,
  BarChart3,
  Shield,
  GraduationCap
} from 'lucide-react'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/super-admin' },
  { icon: Building, label: 'Instituições', path: '/super-admin/institutions' },
  { icon: Users, label: 'Usuários', path: '/super-admin/users' },
  { icon: CreditCard, label: 'Planos', path: '/super-admin/plans' },
  { icon: BarChart3, label: 'Analytics', path: '/super-admin/analytics' },
  { icon: FileText, label: 'Logs', path: '/super-admin/logs' },
  { icon: Settings, label: 'Configurações', path: '/super-admin/settings' }
]

export default function SuperAdminSidebar() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <div className="bg-white shadow-lg h-full w-64 fixed left-0 top-0 z-40 border-r border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div className="ml-3">
            <h1 className="text-xl font-bold text-gray-900">Inscribo</h1>
            <p className="text-xs text-gray-600">Super Admin</p>
          </div>
        </div>
      </div>
      
      <nav className="mt-6">
        <ul className="space-y-1 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Super Admin Badge */}
      <div className="absolute bottom-6 left-3 right-3">
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center">
            <Shield className="h-5 w-5 text-red-600 mr-2" />
            <div>
              <div className="text-sm font-semibold text-red-900">Super Admin</div>
              <div className="text-xs text-red-700">Acesso total ao sistema</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}