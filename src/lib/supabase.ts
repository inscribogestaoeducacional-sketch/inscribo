import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey)

// Database Types
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
}

export interface Enrollment {
  id: string
  lead_id?: string
  student_name: string
  course_grade: string
  enrollment_value?: number
  discount_percentage?: number
  final_value?: number
  payment_method?: string
  enrollment_date: string
  status?: 'active' | 'suspended' | 'cancelled'
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
  role: 'admin' | 'consultant'
  phone?: string
  institution_id: string
  active: boolean
  last_login?: string
  created_at: string
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

// Database Service with real Supabase integration
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

  static async createLead(leadData: Partial<Lead>): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateLead(id: string, leadData: Partial<Lead>): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .update(leadData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
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

  static async createVisit(visitData: Partial<Visit>): Promise<Visit> {
    const { data, error } = await supabase
      .from('visits')
      .insert(visitData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Enrollments
  static async getEnrollments(institutionId: string): Promise<Enrollment[]> {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('institution_id', institutionId)
      .order('enrollment_date', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createEnrollment(enrollmentData: Partial<Enrollment>): Promise<Enrollment> {
    const { data, error } = await supabase
      .from('enrollments')
      .insert(enrollmentData)
      .select()
      .single()

    if (error) throw error
    return data
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

  static async createMarketingCampaign(campaignData: Partial<MarketingCampaign>): Promise<MarketingCampaign> {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .insert(campaignData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateMarketingCampaign(id: string, campaignData: Partial<MarketingCampaign>): Promise<MarketingCampaign> {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .update(campaignData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
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

  static async createFunnelMetrics(funnelData: Partial<FunnelMetrics>): Promise<FunnelMetrics> {
    const { data, error } = await supabase
      .from('funnel_metrics')
      .insert(funnelData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateFunnelMetrics(id: string, funnelData: Partial<FunnelMetrics>): Promise<FunnelMetrics> {
    const { data, error } = await supabase
      .from('funnel_metrics')
      .update(funnelData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
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

  static async createReEnrollment(reEnrollmentData: Partial<ReEnrollment>): Promise<ReEnrollment> {
    const { data, error } = await supabase
      .from('re_enrollments')
      .insert(reEnrollmentData)
      .select()
      .single()

    if (error) throw error
    return data
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

  static async createAction(actionData: Partial<Action>): Promise<Action> {
    const { data, error } = await supabase
      .from('actions')
      .insert(actionData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateAction(id: string, actionData: Partial<Action>): Promise<Action> {
    const { data, error } = await supabase
      .from('actions')
      .update(actionData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
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

  static async createUser(userData: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(userData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async deleteUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Dashboard KPIs
  static async getDashboardKPIs(institutionId: string) {
    try {
      // Get leads count
      const { count: totalLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institutionId)

      // Get today's visits
      const today = new Date().toISOString().split('T')[0]
      const { count: visitasHoje } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .gte('scheduled_date', today)
        .lt('scheduled_date', `${today}T23:59:59`)

      // Get this month's enrollments
      const thisMonth = new Date().toISOString().slice(0, 7)
      const { count: matriculasMes } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .gte('enrollment_date', `${thisMonth}-01`)

      // Get conversion rate
      const { count: enrolledLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .eq('status', 'enrolled')

      const taxaConversao = totalLeads && totalLeads > 0 ? (enrolledLeads || 0) / totalLeads * 100 : 0

      // Get CPA from marketing campaigns
      const { data: campaigns } = await supabase
        .from('marketing_campaigns')
        .select('investment, leads_generated')
        .eq('institution_id', institutionId)

      const totalInvestment = campaigns?.reduce((sum, c) => sum + c.investment, 0) || 0
      const totalLeadsGenerated = campaigns?.reduce((sum, c) => sum + c.leads_generated, 0) || 0
      const cpaAtual = totalLeadsGenerated > 0 ? totalInvestment / totalLeadsGenerated : 0

      // Get re-enrollment rate
      const { data: reEnrollments } = await supabase
        .from('re_enrollments')
        .select('total_base, re_enrolled')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
        .limit(1)

      const latestReEnrollment = reEnrollments?.[0]
      const taxaRematricula = latestReEnrollment 
        ? (latestReEnrollment.re_enrolled / latestReEnrollment.total_base) * 100 
        : 0

      return {
        totalLeads: totalLeads || 0,
        visitasHoje: visitasHoje || 0,
        matriculasMes: matriculasMes || 0,
        taxaConversao: Number(taxaConversao.toFixed(1)),
        cpaAtual: Number(cpaAtual.toFixed(0)),
        taxaRematricula: Number(taxaRematricula.toFixed(1))
      }
    } catch (error) {
      console.error('Error loading dashboard KPIs:', error)
      return {
        totalLeads: 0,
        visitasHoje: 0,
        matriculasMes: 0,
        taxaConversao: 0,
        cpaAtual: 0,
        taxaRematricula: 0
      }
    }
  }
}