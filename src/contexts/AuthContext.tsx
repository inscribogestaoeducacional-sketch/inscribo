import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
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
  // Só preenchido pra gestor_rede sem vínculo em user_institutions (grupo
  // escolar legado — ver loadUserProfile): id do grupo e unidades do grupo.
  school_group_id?: string
  group_institutions?: { id: string; name: string }[]
  // Fase 2 de "usuário em múltiplas instituições": todas as instituições que
  // o usuário tem vínculo em user_institutions (1 ou mais). O seletor do
  // TopBar usa este campo (com fallback pra group_institutions, pro caso
  // legado de gestor de rede sem vínculo em user_institutions).
  available_institutions?: { id: string; name: string; logo_url?: string }[]
  // true quando o usuário tem 2+ vínculos e nenhum deles é a instituição
  // ativa atual (active_institution_id nulo ou apontando pra um vínculo que
  // não existe mais) — App.tsx mostra a tela de seleção antes do dashboard.
  needsInstitutionSelection?: boolean
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

  // Corrige race condition confirmada: init()/signIn()/switchInstitution()/
  // refreshSession() todos disparam loadUserProfile, e nada garantia que a
  // resposta mais LENTA não chegasse depois e sobrescrevesse um estado mais
  // novo com dado obsoleto (ex: reabrir a tela de seleção de instituição
  // depois que o usuário já tinha trocado com sucesso). "Última chamada
  // vence": cada loadUserProfile/refreshSession gera um id incremental; se
  // outra chamada mais nova já assumiu antes desta terminar, o resultado
  // desta é descartado silenciosamente (nenhum setState).
  const requestIdRef = useRef(0)

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
    const myRequestId = ++requestIdRef.current
    const isStale = () => requestIdRef.current !== myRequestId

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, institutions!users_institution_id_fkey(name)')
        .eq('id', userId)
        .single()

      if (isStale()) return // uma chamada mais nova já assumiu — descarta

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
        let availableInstitutions: { id: string; name: string; logo_url?: string }[] | undefined
        let needsInstitutionSelection = false

        // Fase 2 de "usuário em múltiplas instituições": fonte da verdade de
        // quais instituições o usuário pode acessar. Só consultado pra quem
        // pode ter vínculo (school_user/gestor_rede) — admin_geral/consultant
        // não são institution-bound e nunca chegam aqui.
        if (data.user_type === 'school_user' || data.user_type === 'gestor_rede') {
          const { data: linkRows } = await supabase
            .from('user_institutions')
            .select('institution_id, institutions(name, logo_url)')
            .eq('user_id', data.id)
            .eq('active', true)

          const links = (linkRows || []).map((r: any) => ({
            id: r.institution_id as string,
            name: r.institutions?.name as string || '',
            logo_url: r.institutions?.logo_url as string | undefined,
          }))

          if (links.length >= 1) {
            availableInstitutions = links
            if (links.length === 1) {
              effectiveInstitutionId = links[0].id
              institutionName = links[0].name
            } else {
              const activeId = data.active_institution_id as string | null
              const stillLinked = !!activeId && links.some(l => l.id === activeId)
              if (stillLinked) {
                effectiveInstitutionId = activeId!
                institutionName = links.find(l => l.id === activeId)?.name
              } else {
                needsInstitutionSelection = true
                effectiveInstitutionId = ''
                institutionName = undefined
              }
            }
          } else if (data.user_type === 'gestor_rede' && data.school_group_id) {
            // Mecanismo legado (gestor de rede sem vínculo em
            // user_institutions ainda — grupo escolar): institution_id é
            // NULL no banco, a unidade "efetiva" vem de active_institution_id.
            // Sem seleção prévia válida, cai na primeira unidade do grupo.
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
        }

        const appUser: AppUser = {
          id:                       data.id,
          full_name:                data.full_name        || '',
          email:                    data.email            || '',
          role:                     data.role             || 'user',
          institution_id:           effectiveInstitutionId,
          active:                   data.active           ?? true,
          is_available:             data.is_available     ?? true,
          user_type:                data.user_type,
          institution_name:         institutionName,
          // is_super_admin: mantido por compatibilidade
          is_super_admin:           data.user_type === 'admin_geral',
          school_group_id:          data.school_group_id || undefined,
          group_institutions:       groupInstitutions,
          available_institutions:   availableInstitutions,
          needsInstitutionSelection: needsInstitutionSelection,
        }
        // Recheca: os awaits acima (user_institutions, e no caminho legado
        // de gestor de rede também institutions/switch_active_institution)
        // deram tempo de sobra pra uma chamada mais nova assumir.
        if (isStale()) return
        setUser(appUser)
      }
    } catch (e) {
      console.error('loadUserProfile error:', e)
    } finally {
      if (!isStale()) {
        setLoading(false)
        setInitializing(false)
      }
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

  // ── switchInstitution ───────────────────────────────────
  // Único jeito permitido de trocar a unidade ativa (usado tanto pelo
  // seletor do TopBar quanto pela tela de seleção pós-login, quando
  // needsInstitutionSelection é true): o RPC valida server-side que o
  // usuário tem vínculo com institutionId — via user_institutions (Fase 2)
  // OU via mesmo school_group_id (gestor de rede legado) — antes de gravar.
  // Recarrega o profile pra refletir a nova unidade em todo o painel
  // (Kanban, financeiro, WhatsApp etc.) sem logout/login.
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
    // Marca esta como a chamada mais nova antes de mais nada — se der erro
    // (token inválido), o "usuário deslogado" que ela decide também precisa
    // valer mais que qualquer loadUserProfile antigo ainda em voo.
    const myRequestId = ++requestIdRef.current
    try {
      const { data: { session: refreshed }, error } = await supabase.auth.refreshSession()
      if (requestIdRef.current !== myRequestId) return // superada nesse meio tempo

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