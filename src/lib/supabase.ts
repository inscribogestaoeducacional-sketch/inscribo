import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types
export interface Institution {
  id: string
  name: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
  active: boolean
  created_at: string
  updated_at: string
}

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
  notes: string
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
  enrollment_date: string
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