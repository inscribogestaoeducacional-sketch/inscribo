'use client'

import React from 'react'
import SuperAdminSidebar from './components/SuperAdminSidebar'
import SuperAdminTopBar from './components/SuperAdminTopBar'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminSidebar />
      <div className="ml-64">
        <SuperAdminTopBar />
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}