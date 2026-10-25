// O que esta pessoa pode ver na Academia: mesmos módulos liberados do menu + o papel dela.
import { useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../contexts/PermissionsContext'
import { useBroadcastEnabled } from '../broadcasts'
import { useBaseModuleEnabled } from '../baseModule'
import { LESSONS, TRAILS } from './academyContent'
import { defaultRole, trailsFor, visibleLessons, type Access, type Lesson, type RoleKey } from './academy'

export function useAcademyAccess() {
  const { user } = useAuth()
  const { isModuleEnabled } = usePermissions()
  const broadcast = useBroadcastEnabled(user?.institution_id)
  const base = useBaseModuleEnabled(user?.institution_id)
  const manager = user?.role === 'admin' || user?.role === 'manager'
  const admin = user?.role === 'admin'
  const has = (m: string) => {
    if (m === 'celular') return true
    if (m === 'transmissoes' && broadcast !== true) return false
    if (m === 'base_alunos' && base !== true) return false
    return isModuleEnabled(m)
  }
  const access: Access = { has, manager, admin }
  const key = `${manager}|${admin}|${broadcast}|${base}|${LESSONS.map(l => (has(l.module) ? 1 : 0)).join('')}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible: Lesson[] = useMemo(() => visibleLessons(LESSONS, access), [key])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trails = useMemo(() => trailsFor(TRAILS, visible), [visible])
  const role: RoleKey = defaultRole(manager, has)
  return { access, visible, trails, role, manager, admin }
}
