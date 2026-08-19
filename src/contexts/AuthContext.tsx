import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

// ─── tipos ────────────────────────────────────────────────────────────────
interface AppUser {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  // Pra "gestor de rede" (user_type='gestor_rede'), institution_id aqui é a
  // unidade SELECIONADA no momento (users.active_institution_id), não um
  // institution_id fixo no banco — todo o resto do app continua lendo esse
  // campo normalmente e passa a refletir a unidade escolhida, sem precisar
  // saber que esse usuário pertence a um grupo. Ver switchInstitution().
  institution_id: string
  active: boolean
  // Disponibilidade manual do atendente (toggle no TopBar) — só afeta
  // distribuição round-robin de grupo no WhatsApp (timeout_group_id).
  is_available?: boolean
  institution_name?: string
  user_type?: 'school_user' | 'consultant' | 'admin_geral' | 'gestor_rede'
  // mantido por compatibilidade com código legado
  is_super_admin?: boolean
  // Só preenchido pra gestor_rede: id do grupo e unidades disponíveis pro
  // seletor (TopBar).
  school_group_id?: string
  group_institutions?: { id: string; name: string }[]
}

interface AuthContextType {
  user: AppUser | null
  session: Session | null
  loading: boolean
  initializing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => Promise<void>
  refreshSession: () => Promise<void>
  // Troca a unidade "ativa" do gestor de rede (sem logout/login) — valida
  // server-side (RPC switch_active_institution) que a unidade pertence ao
  // grupo do usuário antes de gravar.
  switchInstitution: (institutionId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

// ─── PROVIDER ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,         setUser]         = useState<AppUser | null>(null)
  const [session,      setSession]      = useState<Session | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [initializing, setInitializing] = useState(true)

  // ── init ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) setSession(session)
        if (session?.user) {
          await loadUserProfile(session.user.id)
        }
      } catch (e) {
        console.error('Auth init error:', e)
      } finally {
        setLoading(false)
        setInitializing(false)
      }
    }

    init()
  }, [])

  // ── loadUserProfile ───────────────────────────────────
  // REGRA: busca SEMPRE na tabela users primeiro.
  // Se user_type = 'admin_geral' ou 'consultant' → é área admin.
  // Não depende mais de tabela super_admins nem de e-mail hardcoded.
  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, institutions!users_institution_id_fkey(name)')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Usuário não existe na tabela — pode ser primeiro acesso
          console.warn('Usuário não encontrado na tabela users:', userId)
          setUser(null)
          return
        }
        throw error
      }

      if (data) {
        let effectiveInstitutionId = data.institution_id || ''
        let institutionName = (data as any).institutions?.name as string | undefined
        let groupInstitutions: { id: string; name: string }[] | undefined

        // Gestor de rede: institution_id é NULL no banco — a unidade
        // "efetiva" vem de active_institution_id (ver switch_active_institution
        // / migration school_groups). Sem seleção prévia válida, cai na
        // primeira unidade do grupo por padrão.
        if (data.user_type === 'gestor_rede' && data.school_group_id) {
          const { data: groupInsts } = await supabase
            .from('institutions')
            .select('id, name')
            .eq('school_group_id', data.school_group_id)
            .order('name')
          groupInstitutions = (groupInsts as { id: string; name: string }[]) || []

          let activeId = data.active_institution_id as string | null
          const stillInGroup = !!activeId && groupInstitutions.some(i => i.id === activeId)
          if (!stillInGroup) {
            activeId = groupInstitutions[0]?.id || null
            if (activeId) {
              const { error: switchErr } = await supabase.rpc('switch_active_institution', { target_institution_id: activeId })
              if (switchErr) console.error('switch_active_institution error:', switchErr)
            }
          }
          effectiveInstitutionId = activeId || ''
          institutionName = groupInstitutions.find(i => i.id === activeId)?.name
        }

        const appUser: AppUser = {
          id:                 data.id,
          full_name:          data.full_name        || '',
          email:              data.email            || '',
          role:               data.role             || 'user',
          institution_id:     effectiveInstitutionId,
          active:             data.active           ?? true,
          is_available:       data.is_available     ?? true,
          user_type:          data.user_type,
          institution_name:   institutionName,
          // is_super_admin: mantido por compatibilidade
          is_super_admin:     data.user_type === 'admin_geral',
          school_group_id:    data.school_group_id || undefined,
          group_institutions: groupInstitutions,
        }
        setUser(appUser)
      }
    } catch (e) {
      console.error('loadUserProfile error:', e)
    } finally {
      setLoading(false)
      setInitializing(false)
    }
  }

  // ── signIn ────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      if (data.user) {
        await loadUserProfile(data.user.id)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── signOut ───────────────────────────────────────────
  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (e) {
      // ignora erro do servidor (ex: 403 com token já inválido)
    } finally {
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/login'
    }
  }

  // ── switchInstitution (gestor de rede) ─────────────────
  // Único jeito permitido de trocar a unidade ativa: o RPC valida
  // server-side que institutionId pertence ao mesmo school_group_id do
  // usuário antes de gravar, então não dá pra "escolher" uma instituição de
  // outro grupo por aqui. Recarrega o profile pra refletir a nova unidade em
  // todo o painel (Kanban, financeiro, WhatsApp etc.) sem logout/login.
  const switchInstitution = async (institutionId: string) => {
    const { error } = await supabase.rpc('switch_active_institution', { target_institution_id: institutionId })
    if (error) {
      console.error('switchInstitution error:', error)
      throw error
    }
    if (session?.user) await loadUserProfile(session.user.id)
  }

  // ── signUp ────────────────────────────────────────────
  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, role } },
      })
      if (error) throw error
      throw new Error('Conta criada! Faça login com suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  // ── refreshSession ────────────────────────────────────
  const refreshSession = async () => {
    try {
      const { data: { session: refreshed }, error } = await supabase.auth.refreshSession()
      if (error) { setUser(null); setSession(null); return }
      if (refreshed) {
        setSession(refreshed)
        if (refreshed.user) await loadUserProfile(refreshed.user.id)
      }
    } catch (e) {
      console.error('refreshSession error:', e)
    }
  }

  // ── auto-refresh ──────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const id = setInterval(() => {
      // Só faz refresh se a sessão está próxima de expirar
      const expiresAt = session.expires_at
      if (expiresAt && (expiresAt * 1000 - Date.now()) < 5 * 60 * 1000) {
        refreshSession()
      }
    }, 60 * 1000) // checa a cada 1 minuto
    return () => clearInterval(id)
  }, [session?.access_token])

  return (
    <AuthContext.Provider value={{ user, session, loading, initializing, signIn, signOut, signUp, refreshSession, switchInstitution }}>
      {children}
    </AuthContext.Provider>
  )
}