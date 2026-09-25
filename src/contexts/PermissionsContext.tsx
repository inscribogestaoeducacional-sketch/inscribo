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

// Módulos que ficam DESLIGADOS pra atendente sem linha em user_permissions
// (os demais seguem liberados por padrão). captacao: gestão de campanhas é
// de admin/gestor; o admin libera por atendente em Usuários → Permissões.
export const DEFAULT_OFF_MODULES = ['captacao']

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const loadPermissions = useCallback(async () => {
    if (!user?.id || isPrivilegedRole(user.role) || !user.institution_id) {
      setPermissions({})
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Escopado pela instituição ATIVA (user.institution_id) — sem isso, um
      // usuário com vínculo em 2+ escolas (Fase 2) carregava os módulos
      // configurados pra QUALQUER uma das escolas dele, misturados/
      // sobrescritos entre si (user_permissions só tinha UNIQUE(user_id,
      // module), sem institution_id na chave — ver migration
      // 20260922010000_user_permissions_institution_scope).
      const { data } = await supabase
        .from('user_permissions')
        .select('module, enabled')
        .eq('user_id', user.id)
        .eq('institution_id', user.institution_id)
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
  }, [user?.id, user?.role, user?.institution_id])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const isModuleEnabled = (module: string): boolean => {
    if (!user || isPrivilegedRole(user.role)) return true
    if (!(module in permissions)) return !DEFAULT_OFF_MODULES.includes(module)
    return permissions[module]
  }

  return (
    <PermissionsContext.Provider value={{ permissions, loading, isModuleEnabled, refreshPermissions: loadPermissions }}>
      {children}
    </PermissionsContext.Provider>
  )
}
