import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface AppUser {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
  active: boolean
}

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'manager' | 'user') => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Check active session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          if (mounted) {
            setLoading(false)
          }
          return
        }

        if (session?.user && mounted) {
        }
      }
    }
  }
  )
}
// Database Service with complete Supabase integration
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
      .select(`
        *,
        leads(student_name, responsible_name)
      `)
      .eq('institution_id', institutionId)
      .order('scheduled_date', { ascending: true })

    if (error) throw error
    
    // Transform data to include student_name from lead or direct field
    return (data || []).map(visit => ({
      ...visit,
      student_name: visit.leads?.student_name || visit.student_name || 'Visita avulsa'
    }))
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

  static async updateVisit(id: string, visitData: Partial<Visit>): Promise<Visit> {
    const { data, error } = await supabase
      .from('visits')
      .update(visitData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Enrollments
  static async getEnrollments(institutionId: string): Promise<Enrollment[]> {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        leads(student_name, responsible_name)
      `)
      .eq('institution_id', institutionId)
      .order('enrollment_date', { ascending: false })

    if (error) throw error
    
    // Transform data to include student_name from lead or direct field
    return (data || []).map(enrollment => ({
      ...enrollment,
      student_name: enrollment.leads?.student_name || enrollment.student_name
    }))
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

  static async updateEnrollment(id: string, enrollmentData: Partial<Enrollment>): Promise<Enrollment> {
    const { data, error } = await supabase
      .from('enrollments')
      .update(enrollmentData)
      .eq('id', id)
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

  static async updateReEnrollment(id: string, reEnrollmentData: Partial<ReEnrollment>): Promise<ReEnrollment> {
    const { data, error } = await supabase
      .from('re_enrollments')
      .update(reEnrollmentData)
      .eq('id', id)
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
        .gte('scheduled_date', `${today}T00:00:00`)
        .lt('scheduled_date', `${today}T23:59:59`)

      // Get this month's enrollments
      const thisMonth = new Date().toISOString().slice(0, 7)
      const { count: matriculasMes } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .gte('enrollment_date', `${thisMonth}-01T00:00:00`)

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

      const totalInvestment = campaigns?.reduce((sum, c) => sum + (c.investment || 0), 0) || 0
      const totalLeadsGenerated = campaigns?.reduce((sum, c) => sum + (c.leads_generated || 0), 0) || 0
      const cpaAtual = totalLeadsGenerated > 0 ? totalInvestment / totalLeadsGenerated : 0

      // Get re-enrollment rate
      const { data: reEnrollments } = await supabase
        .from('re_enrollments')
        .select('total_base, re_enrolled')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
        .limit(1)

      const latestReEnrollment = reEnrollments?.[0]
      const taxaRematricula = latestReEnrollment && latestReEnrollment.total_base > 0
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