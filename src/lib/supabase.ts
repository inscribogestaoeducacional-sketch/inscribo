import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Database Types
export interface Institution {
  id: string
  name: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  phone?: string
  email?: string
  address?: string
  website?: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'pedagogical_manager' | 'commercial_manager' | 'consultant' | 'teacher' | 'support'
  institution_id: string
  phone?: string
  avatar_url?: string
  active: boolean
  last_login?: string
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  name: string
  description?: string
  level: 'infantil' | 'fundamental_1' | 'fundamental_2' | 'medio' | 'tecnico' | 'superior'
  duration_months?: number
  price?: number
  active: boolean
  institution_id: string
  created_at: string
  updated_at: string
}

export interface Teacher {
  id: string
  full_name: string
  email?: string
  phone?: string
  specialization?: string
  hire_date?: string
  active: boolean
  institution_id: string
  created_at: string
  updated_at: string
}

export interface Class {
  id: string
  name: string
  course_id: string
  teacher_id?: string
  capacity: number
  current_students: number
  schedule?: string
  start_date?: string
  end_date?: string
  active: boolean
  institution_id: string
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  full_name: string
  birth_date?: string
  cpf?: string
  rg?: string
  email?: string
  phone?: string
  address?: string
  responsible_name?: string
  responsible_phone?: string
  responsible_email?: string
  emergency_contact?: string
  emergency_phone?: string
  medical_info?: string
  active: boolean
  institution_id: string
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  student_name: string
  responsible_name: string
  phone?: string
  email?: string
  birth_date?: string
  grade_interest: string
  course_interest?: string
  source: string
  status: 'new' | 'contact' | 'scheduled' | 'visit' | 'proposal' | 'enrolled' | 'lost'
  assigned_to?: string
  notes: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  lost_reason?: string
  institution_id: string
  created_at: string
  updated_at: string
}

export interface Visit {
  id: string
  lead_id: string
  scheduled_date: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  assigned_to?: string
  notes: string
  feedback?: string
  next_steps?: string
  institution_id: string
  created_at: string
  updated_at: string
}

export interface Enrollment {
  id: string
  lead_id?: string
  student_id?: string
  course_id: string
  class_id?: string
  enrollment_value?: number
  discount_percentage: number
  final_value?: number
  payment_method?: string
  enrollment_date: string
  start_date?: string
  status: 'active' | 'suspended' | 'cancelled' | 'completed'
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
  cancelled: number
  target_percentage: number
  institution_id: string
  created_at: string
}

export interface MarketingCampaign {
  id: string
  month_year: string
  investment: number
  leads_generated: number
  cpa_target?: number
  platform?: string
  campaign_name?: string
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
  completed_at?: string
  institution_id: string
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id?: string
  details: Record<string, any>
  ip_address?: string
  user_agent?: string
  institution_id: string
  created_at: string
}

export interface SystemSetting {
  id: string
  setting_key: string
  setting_value: Record<string, any>
  description?: string
  institution_id: string
  created_at: string
  updated_at: string
}

// Database service functions
export class DatabaseService {
  // Users
  static async getUsers(institutionId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  }

  static async createUser(userData: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async updateUser(id: string, userData: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .update(userData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async deleteUser(id: string) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // Leads
  static async getLeads(institutionId: string) {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        assigned_user:users!leads_assigned_to_fkey(full_name)
      `)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  }

  static async createLead(leadData: Partial<Lead>) {
    const { data, error } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async updateLead(id: string, leadData: Partial<Lead>) {
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
  static async getVisits(institutionId: string) {
    const { data, error } = await supabase
      .from('visits')
      .select(`
        *,
        lead:leads(student_name, responsible_name),
        assigned_user:users!visits_assigned_to_fkey(full_name)
      `)
      .eq('institution_id', institutionId)
      .order('scheduled_date', { ascending: true })
    
    if (error) throw error
    return data
  }

  static async createVisit(visitData: Partial<Visit>) {
    const { data, error } = await supabase
      .from('visits')
      .insert([visitData])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async updateVisit(id: string, visitData: Partial<Visit>) {
    const { data, error } = await supabase
      .from('visits')
      .update(visitData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Courses
  static async getCourses(institutionId: string) {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('active', true)
      .order('name')
    
    if (error) throw error
    return data
  }

  static async createCourse(courseData: Partial<Course>) {
    const { data, error } = await supabase
      .from('courses')
      .insert([courseData])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Teachers
  static async getTeachers(institutionId: string) {
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('active', true)
      .order('full_name')
    
    if (error) throw error
    return data
  }

  static async createTeacher(teacherData: Partial<Teacher>) {
    const { data, error } = await supabase
      .from('teachers')
      .insert([teacherData])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Students
  static async getStudents(institutionId: string) {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('active', true)
      .order('full_name')
    
    if (error) throw error
    return data
  }

  static async createStudent(studentData: Partial<Student>) {
    const { data, error } = await supabase
      .from('students')
      .insert([studentData])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Enrollments
  static async getEnrollments(institutionId: string) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('institution_id', institutionId)
      .order('enrollment_date', { ascending: false })
    
    if (error) throw error
    return data
  }

  static async createEnrollment(enrollmentData: Partial<Enrollment>) {
    const { data, error } = await supabase
      .from('enrollments')
      .insert([enrollmentData])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Marketing Campaigns
  static async getMarketingCampaigns(institutionId: string) {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('institution_id', institutionId)
      .order('month_year', { ascending: false })
    
    if (error) throw error
    return data
  }

  static async createMarketingCampaign(campaignData: Partial<MarketingCampaign>) {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .insert([campaignData])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Activity Logs
  static async logActivity(logData: Partial<ActivityLog>) {
    // Skip logging if institution_id is missing
    if (!logData.institution_id) {
      console.warn('Activity log skipped: missing institution_id')
      return
    }
    
    const { error } = await supabase
      .from('activity_logs')
      .insert([logData])
    
    if (error) throw error
  }

  static async getActivityLogs(institutionId: string, limit = 50) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        *,
        user:users(full_name)
      `)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data
  }

  // Dashboard KPIs
  static async getDashboardKPIs(institutionId: string) {
    const today = new Date().toISOString().split('T')[0]
    const thisMonth = new Date().toISOString().slice(0, 7)
    
    // Get total leads
    const { data: totalLeads } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('institution_id', institutionId)
    
    // Get today's visits
    const { data: todayVisits } = await supabase
      .from('visits')
      .select('id', { count: 'exact' })
      .eq('institution_id', institutionId)
      .gte('scheduled_date', today)
      .lt('scheduled_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    
    // Get this month's enrollments
    const { data: monthlyEnrollments } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact' })
      .eq('institution_id', institutionId)
      .gte('enrollment_date', thisMonth + '-01')
    
    // Get conversion rate (enrollments / leads)
    const conversionRate = totalLeads && monthlyEnrollments 
      ? ((monthlyEnrollments.length / totalLeads.length) * 100).toFixed(1)
      : '0.0'
    
    return {
      totalLeads: totalLeads?.length || 0,
      todayVisits: todayVisits?.length || 0,
      monthlyEnrollments: monthlyEnrollments?.length || 0,
      conversionRate: parseFloat(conversionRate)
    }
  }
}