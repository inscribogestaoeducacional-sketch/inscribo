import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'inscribo-auth-token',
    storage: {
      getItem: (key: string) => {
        if (typeof window !== 'undefined') {
          const item = localStorage.getItem(key)
          console.log('📦 Storage getItem:', key, item ? 'found' : 'not found')
          return item
        }
        return null
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          console.log('💾 Storage setItem:', key)
          localStorage.setItem(key, value)
        }
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          console.log('🗑️ Storage removeItem:', key)
          localStorage.removeItem(key)
        }
      }
    },
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})

// Types
export interface Lead {
  id: string
  student_name: string
  responsible_name: string
  phone?: string
  email?: string
  grade_interest: string
  source: string
  status: 'new' | 'contact' | 'scheduled' | 'visit' | 'proposal' | 'enrolled' | 'lost'
  assigned_to?: string
  notes?: string
  institution_id: string
  created_at: string
  updated_at: string
  address?: string
  budget_range?: string
  cpf?: string
}

export interface Visit {
  id: string
  lead_id?: string
  scheduled_date: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  assigned_to?: string
  notes?: string
  institution_id: string
  created_at: string
  updated_at: string
  student_name?: string
}

export interface Enrollment {
  id: string
  lead_id?: string
  student_name: string
  course_grade: string
  enrollment_value?: number
  enrollment_date?: string
  institution_id: string
  created_at: string
}

export interface MarketingCampaign {
  id: string
  month_year: string
  investment: number
  leads_generated: number
  cpa_target?: number
  institution_id: string
  created_at: string
}

export interface ReEnrollment {
  id: string
  period: string
  total_base: number
  re_enrolled: number
  defaulters: number
  transferred: number
  target_percentage: number
  institution_id: string
  created_at: string
}

export interface FunnelMetrics {
  id: string
  period: string
  registrations: number
  registrations_target: number
  schedules: number
  schedules_target: number
  visits: number
  visits_target: number
  enrollments: number
  enrollments_target: number
  institution_id: string
  created_at: string
}

export interface Action {
  id: string
  title: string
  description: string
  action_type: 'marketing' | 'sales' | 'retention' | 'operations'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  due_date?: string
  institution_id: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'user'
  institution_id?: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id?: string
  details?: any
  institution_id: string
  created_at: string
  user_name?: string
}

export interface Institution {
  id: string
  name: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  created_at: string
  updated_at: string
}

export interface SuperAdmin {
  id: string
  email: string
  full_name: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface SaasMetrics {
  id: string
  metric_date: string
  total_institutions: number
  active_institutions: number
  total_users: number
  total_leads: number
  total_enrollments: number
  mrr: number
  created_at: string
}

// Database Service
export class DatabaseService {

  export const DatabaseService = {
  // ... seus métodos existentes ...
  
  getLeads: async (institution_id: string) => { ... },
  updateLead: async (id: string, data: Partial<Lead>) => { ... },
  
  // NOVOS MÉTODOS (cole aqui)
  logActivity: async (data: { ... }) => { ... },
  getActivityLogs: async (institution_id: string, entity_id?: string) => { ... }
}// ============================================
// MÉTODOS PARA ADICIONAR AO SEU DatabaseService
// Arquivo: src/lib/supabase.ts (ou onde está seu DatabaseService)
// ============================================

// Cole estes métodos dentro da sua classe/objeto DatabaseService

/**
 * Registra uma ação no histórico de atividades
 * Usado para rastrear todas as ações realizadas em leads
 */
async logActivity(data: {
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  details: any
  institution_id: string
}) {
  try {
    const { data: activity, error } = await supabase
      .from('activity_logs')
      .insert([{
        user_id: data.user_id,
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        details: data.details,
        institution_id: data.institution_id,
        created_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Erro ao registrar atividade:', error)
      throw error
    }
    
    return activity
  } catch (error) {
    console.error('Erro ao salvar log de atividade:', error)
    throw error
  }
}

/**
 * Busca o histórico de atividades
 * @param institution_id - ID da instituição
 * @param entity_id - (Opcional) ID da entidade específica (ex: lead_id)
 * @returns Array de atividades com nome do usuário
 */
async getActivityLogs(institution_id: string, entity_id?: string) {
  try {
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        users!activity_logs_user_id_fkey (
          full_name,
          email
        )
      `)
      .eq('institution_id', institution_id)
      .order('created_at', { ascending: false })

    // Se entity_id for fornecido, filtra por ele
    if (entity_id) {
      query = query.eq('entity_id', entity_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar histórico:', error)
      throw error
    }
    
    // Adicionar user_name ao objeto para facilitar exibição
    return data.map(log => ({
      ...log,
      user_name: log.users?.full_name || 'Usuário desconhecido'
    }))
  } catch (error) {
    console.error('Erro ao carregar logs de atividade:', error)
    return []
  }
}

// ============================================
// EXEMPLO DE USO
// ============================================

// 1. Registrar uma nova ação
/*
await DatabaseService.logActivity({
  user_id: currentUser.id,
  action: 'Lead criado',
  entity_type: 'lead',
  entity_id: newLead.id,
  details: {
    student_name: newLead.student_name,
    responsible_name: newLead.responsible_name,
    source: newLead.source
  },
  institution_id: currentUser.institution_id
})
*/

// 2. Buscar histórico de um lead específico
/*
const history = await DatabaseService.getActivityLogs(
  institution_id,
  lead_id  // ID do lead específico
)
*/

// 3. Buscar todo o histórico da instituição
/*
const allHistory = await DatabaseService.getActivityLogs(
  institution_id
  // Sem passar entity_id
)
*/

// ============================================
// TIPOS DE AÇÕES REGISTRADAS AUTOMATICAMENTE
// ============================================

/*
- "Lead criado" - Quando um novo lead é adicionado
- "Lead editado" - Quando informações são atualizadas
- "Status alterado" - Quando o status muda no kanban
- "Ação manual adicionada" - Quando usuário adiciona ação manualmente
- "Lead excluído" - Quando um lead é removido (se implementado)

Todos com:
- Data e hora exata
- Usuário que realizou
- Detalhes específicos da ação
*/

// ============================================
// ESTRUTURA DO OBJETO 'details'
// ============================================

/*
Para "Lead criado":
{
  student_name: string,
  responsible_name: string,
  source: string,
  grade_interest: string,
  phone: string,
  email: string,
  address: string,
  budget_range: string,
  notes: string
}

Para "Status alterado":
{
  previous_status: string,
  new_status: string,
  student_name: string,
  responsible_name: string
}

Para "Lead editado":
{
  changes: { [campo]: novo_valor },
  previous: { [campo]: valor_anterior },
  student_name: string,
  responsible_name: string
}

Para "Ação manual adicionada":
{
  description: string,
  student_name: string,
  responsible_name: string
}
*/

// ============================================
// DICAS DE IMPLEMENTAÇÃO
// ============================================

/*
1. SEMPRE envolver em try/catch para não quebrar o fluxo principal
2. Registrar o log DEPOIS da ação principal ser bem-sucedida
3. Incluir informações relevantes em 'details' para contexto
4. Usar ações consistentes (mesmos nomes) para facilitar filtros
5. Considerar adicionar índices no banco se o histórico crescer muito
*/

// ============================================
// VERIFICAÇÃO DE INSTALAÇÃO
// ============================================

/*
Para verificar se está funcionando:

1. Execute uma ação no sistema (ex: criar um lead)
2. Verifique no console se há erros
3. Vá no Supabase > Table Editor > activity_logs
4. Deve haver um novo registro com:
   - user_id preenchido
   - action descrita
   - details com JSON
   - created_at com timestamp
*/

// ============================================
// FIM DOS MÉTODOS
// ============================================
  // Leads
  static async getLeads(institutionId: string): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createLead(lead: Partial<Lead>): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateLead(id: string, updates: Partial<Lead>): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)

    if (error) throw error
  }

  static async deleteLead(id: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Visits
  static async getVisits(institutionId: string): Promise<Visit[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .eq('institution_id', institutionId)
      .order('scheduled_date', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createVisit(visit: Partial<Visit>): Promise<Visit> {
    const { data, error } = await supabase
      .from('visits')
      .insert(visit)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateVisit(id: string, updates: Partial<Visit>): Promise<void> {
    const { error } = await supabase
      .from('visits')
      .update(updates)
      .eq('id', id)

    if (error) throw error
  }

 
  // Enrollments
  static async getEnrollments(institutionId: string): Promise<Enrollment[]> {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createEnrollment(enrollment: Partial<Enrollment>): Promise<Enrollment> {
    const { data, error } = await supabase
      .from('enrollments')
      .insert(enrollment)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateEnrollment(id: string, updates: Partial<Enrollment>): Promise<void> {
    const { error } = await supabase
      .from('enrollments')
      .update(updates)
      .eq('id', id)

    if (error) throw error
  }

  static async deleteEnrollment(id: string): Promise<void> {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Marketing Campaigns
  static async getMarketingCampaigns(institutionId: string): Promise<MarketingCampaign[]> {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createMarketingCampaign(campaign: Partial<MarketingCampaign>): Promise<MarketingCampaign> {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .insert(campaign)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateMarketingCampaign(id: string, updates: Partial<MarketingCampaign>): Promise<void> {
    const { error } = await supabase
      .from('marketing_campaigns')
      .update(updates)
      .eq('id', id)

    if (error) throw error
  }

  static async deleteMarketingCampaign(id: string): Promise<void> {
    const { error } = await supabase
      .from('marketing_campaigns')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Re-enrollments
  static async getReEnrollments(institutionId: string): Promise<ReEnrollment[]> {
    const { data, error } = await supabase
      .from('re_enrollments')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createReEnrollment(reEnrollment: Partial<ReEnrollment>): Promise<ReEnrollment> {
    const { data, error } = await supabase
      .from('re_enrollments')
      .insert(reEnrollment)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateReEnrollment(id: string, updates: Partial<ReEnrollment>): Promise<void> {
    const { error } = await supabase
      .from('re_enrollments')
      .update(updates)
      .eq('id', id)

    if (error) throw error
  }

  static async deleteReEnrollment(id: string): Promise<void> {
    const { error } = await supabase
      .from('re_enrollments')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Funnel Metrics
  static async getFunnelMetrics(institutionId: string): Promise<FunnelMetrics[]> {
    const { data, error } = await supabase
      .from('funnel_metrics')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createFunnelMetrics(funnel: Partial<FunnelMetrics>): Promise<FunnelMetrics> {
    const { data, error } = await supabase
      .from('funnel_metrics')
      .insert(funnel)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateFunnelMetrics(id: string, updates: Partial<FunnelMetrics>): Promise<void> {
    const { error } = await supabase
      .from('funnel_metrics')
      .update(updates)
      .eq('id', id)

    if (error) throw error
  }

  static async deleteFunnelMetrics(id: string): Promise<void> {
    const { error } = await supabase
      .from('funnel_metrics')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Actions
  static async getActions(institutionId: string): Promise<Action[]> {
    const { data, error } = await supabase
      .from('actions')
      .select(`
        *,
        assigned_user:assigned_to(full_name)
      `)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createAction(action: Partial<Action>): Promise<Action> {
    const { data, error } = await supabase
      .from('actions')
      .insert(action)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateAction(id: string, updates: Partial<Action>): Promise<void> {
    const { error } = await supabase
      .from('actions')
      .update(updates)
      .eq('id', id)

    if (error) throw error
  }

  static async deleteAction(id: string): Promise<void> {
    const { error } = await supabase
      .from('actions')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Users
  static async getUsers(institutionId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Activity Logs
  static async getActivityLogs(institutionId: string, entityId?: string): Promise<ActivityLog[]> {
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        users!activity_logs_user_id_fkey(full_name)
      `)
      .eq('institution_id', institutionId)

    if (entityId) {
      query = query.eq('entity_id', entityId)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error loading activity logs:', error)
      return []
    }

    // Transform data to include user_name
    return (data || []).map(log => ({
      ...log,
      user_name: log.users?.full_name || 'Usuário desconhecido'
    }))
  }

  static async logActivity(activity: {
    user_id: string
    action: string
    entity_type: string
    entity_id?: string
    details?: any
    institution_id: string
  }): Promise<void> {
    try {
      console.log('📝 Registrando atividade:', activity)
      
      const { error } = await supabase
        .from('activity_logs')
        .insert({
          user_id: activity.user_id,
          action: activity.action,
          entity_type: activity.entity_type,
          entity_id: activity.entity_id,
          details: activity.details || {},
          institution_id: activity.institution_id
        })

      if (error) {
        console.error('❌ Erro ao registrar atividade:', error)
        throw error
      }

      console.log('✅ Atividade registrada com sucesso')
    } catch (error) {
      console.error('❌ Falha ao registrar atividade:', error)
      // Não quebra o fluxo principal se falhar o log
    }
  }

  // Institutions
  static async getInstitution(id: string): Promise<Institution | null> {
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error loading institution:', error)
      return null
    }
    return data
  }

  static async updateInstitution(id: string, updates: Partial<Institution>): Promise<void> {
    const { error } = await supabase
      .from('institutions')
      .update(updates)
      .eq('id', id)

    if (error) throw error
  }

  // Super Admin Methods
  static async isSuperAdmin(email: string): Promise<boolean> {
    try {
      console.log('🔍 Verificando se é super admin:', email)
      const { data, error } = await supabase
        .from('super_admins')
        .select('id')
        .eq('email', email)
        .eq('active', true)
        .single()

      const isSuperAdmin = !error && !!data
      console.log('🛡️ Resultado super admin:', isSuperAdmin)
      return isSuperAdmin
    } catch {
      console.log('❌ Erro ao verificar super admin')
      return false
    }
  }

  static async getAllInstitutions(): Promise<Institution[]> {
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async getAllUsersForSuperAdmin(): Promise<(User & { institution_name?: string })[]> {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        institutions(name)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(user => ({
      ...user,
      institution_name: (user as any).institutions?.name
    }))
  }

  static async getSaasMetrics(): Promise<SaasMetrics[]> {
    const { data, error } = await supabase
      .from('saas_metrics')
      .select('*')
      .order('metric_date', { ascending: false })
      .limit(12)

    if (error) throw error
    return data || []
  }

  static async updateSaasMetrics(): Promise<void> {
    try {
      // Get current counts
      const [institutions, users, leads, enrollments] = await Promise.all([
        supabase.from('institutions').select('id, created_at'),
        supabase.from('users').select('id'),
        supabase.from('leads').select('id'),
        supabase.from('enrollments').select('id, enrollment_value')
      ])

      const totalInstitutions = institutions.data?.length || 0
      const activeInstitutions = institutions.data?.filter(i => {
        const createdAt = new Date(i.created_at)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return createdAt > thirtyDaysAgo
      }).length || 0

      const totalUsers = users.data?.length || 0
      const totalLeads = leads.data?.length || 0
      const totalEnrollments = enrollments.data?.length || 0
      
      // Calculate MRR (simplified - would be more complex in production)
      const mrr = totalInstitutions * 97 // Assuming average of R$ 97/month

      // Insert or update today's metrics
      const { error } = await supabase
        .from('saas_metrics')
        .upsert({
          metric_date: new Date().toISOString().split('T')[0],
          total_institutions: totalInstitutions,
          active_institutions: activeInstitutions,
          total_users: totalUsers,
          total_leads: totalLeads,
          total_enrollments: totalEnrollments,
          mrr: mrr
        }, {
          onConflict: 'metric_date'
        })
      if (error) throw error
    } catch (error) {
      console.error('Error updating SaaS metrics:', error)
    }
  }
}
