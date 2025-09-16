import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
  cpf?: string
  whatsapp?: string
  address?: string
  budget_range?: string
  preferred_period?: string
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
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
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

  // Visits
  static async getVisits(institutionId: string): Promise<Visit[]> {
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .eq('institution_id', institutionId)
      .order('scheduled_date', { ascending: true })

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

  static async createFunnelMetrics(metrics: Partial<FunnelMetrics>): Promise<FunnelMetrics> {
    const { data, error } = await supabase
      .from('funnel_metrics')
      .insert(metrics)
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

  // Actions
  static async getActions(institutionId: string): Promise<Action[]> {
    const { data, error } = await supabase
      .from('actions')
      .select('*')
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

  // Activity Logs
  static async logActivity(activity: Partial<ActivityLog>): Promise<void> {
    const { error } = await supabase
      .from('activity_logs')
      .insert(activity)

    if (error) throw error
  }

  static async getActivityLogs(institutionId: string, entityId?: string): Promise<ActivityLog[]> {
    let query = supabase
      .from('activity_logs')
      .select('*')
      .eq('institution_id', institutionId)

    if (entityId) {
      query = query.eq('entity_id', entityId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Dashboard KPIs
  static async getDashboardKPIs(institutionId: string) {
    const [leads, visits, enrollments, campaigns] = await Promise.all([
      this.getLeads(institutionId),
      this.getVisits(institutionId),
      this.getEnrollments(institutionId),
      this.getMarketingCampaigns(institutionId)
    ])

    const today = new Date().toISOString().split('T')[0]
    const thisMonth = new Date().toISOString().slice(0, 7)

    const visitasHoje = visits.filter(v => v.scheduled_date.startsWith(today)).length
    const matriculasMes = enrollments.filter(e => e.created_at.startsWith(thisMonth)).length
    const totalLeads = leads.length
    const leadsConvertidos = leads.filter(l => l.status === 'enrolled').length
    const taxaConversao = totalLeads > 0 ? (leadsConvertidos / totalLeads) * 100 : 0

    const totalInvestment = campaigns.reduce((sum, c) => sum + c.investment, 0)
    const totalLeadsGenerated = campaigns.reduce((sum, c) => sum + c.leads_generated, 0)
    const cpaAtual = totalLeadsGenerated > 0 ? totalInvestment / totalLeadsGenerated : 0

    return {
      totalLeads,
      visitasHoje,
      matriculasMes,
      taxaConversao: Math.round(taxaConversao * 10) / 10,
      cpaAtual: Math.round(cpaAtual),
      taxaRematricula: 92.5 // Mock data
    }
  }
}