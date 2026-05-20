import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

interface PermissionsContextType {
  permissions: Record<string, boolean>
  loading: boolean
  isModuleEnabled: (module: string) => boolean
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: {},
  loading: false,
  isModuleEnabled: () => true,
  refreshPermissions: async () => {},
})

export function usePermissions() {
  return useContext(PermissionsContext)
}

const isPrivilegedRole = (role: string) => role === 'admin' || role === 'manager'

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const loadPermissions = useCallback(async () => {
    if (!user?.id || isPrivilegedRole(user.role)) {
      setPermissions({})
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('user_permissions')
        .select('module, enabled')
        .eq('user_id', user.id)
      const map: Record<string, boolean> = {}
      if (data) {
        for (const row of data) {
          map[row.module] = row.enabled
        }
      }
      setPermissions(map)
    } catch (e) {
      console.error('loadPermissions error:', e)
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.role])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const isModuleEnabled = (module: string): boolean => {
    if (!user || isPrivilegedRole(user.role)) return true
    if (!(module in permissions)) return true
    return permissions[module]
  }

  return (
    <PermissionsContext.Provider value={{ permissions, loading, isModuleEnabled, refreshPermissions: loadPermissions }}>
      {children}
    </PermissionsContext.Provider>
  )
}
