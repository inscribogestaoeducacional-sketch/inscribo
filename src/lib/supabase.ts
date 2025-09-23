import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'inscribo-auth',
    storage: {
      getItem: (key: string) => {
        if (typeof window !== 'undefined') {
          return localStorage.getItem(key)
        }
        return null
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value)
        }
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key)
        }
      }
    },
    autoRefreshToken: true,
    detectSessionInUrl: true
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

// Database Service
export class DatabaseService {
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
}