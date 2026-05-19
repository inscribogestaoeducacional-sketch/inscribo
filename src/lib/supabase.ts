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
    autoRefreshToken: true,
    detectSessionInUrl: false,
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
  year: number
  month: number
  month_name: string
  registrations: number
  registrations_target: number
  schedules: number
  schedules_target: number
  visits: number
  visits_target: number
  enrollments: number
  enrollments_target: number
  annual_registrations_target: number
  annual_schedules_target: number
  annual_visits_target: number
  annual_enrollments_target: number
  notes?: string
  institution_id: string
  created_at: string
}
export interface FunnelAnalysisView extends FunnelMetrics {
  conversion_reg_to_schedule: number
  conversion_schedule_to_visit: number
  conversion_visit_to_enrollment: number
  conversion_overall: number
  registrations_deviation_pct: number
  schedules_deviation_pct: number
  visits_deviation_pct: number
  enrollments_deviation_pct: number
}

export interface AnnualFunnelTotals {
  year: number
  total_registrations: number
  total_schedules: number
  total_visits: number
  total_enrollments: number
  annual_registrations_target: number
  annual_schedules_target: number
  annual_visits_target: number
  annual_enrollments_target: number
  overall_conversion_rate: number
}

export interface YearComparison {
  month: number
  month_name: string
  year1_registrations: number
  year2_registrations: number
  registrations_variation: number
  year1_enrollments: number
  year2_enrollments: number
  enrollments_variation: number
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
  evolution_url?: string
  evolution_key?: string
  evolution_instance?: string
  created_at: string
  updated_at: string
}

export interface WhatsappMessage {
  id: string
  institution_id: string
  remote_jid: string
  from_me: boolean
  message_id?: string
  message_type: string
  content: string
  media_url?: string
  contact_name?: string
  lead_id?: string
  timestamp: string
  created_at: string
  status?: string
  direction?: string
}

export interface WhatsappConversation {
  id: string
  institution_id: string
  remote_jid: string
  contact_name?: string
  lead_id?: string
  status: string
  last_message?: string
  last_message_at?: string
  unread_count: number
  assigned_user_id?: string
  assigned_user_name?: string
  transferred_from?: string
  transferred_at?: string
  contact_type?: string
  tags?: string[]
  profile_picture_url?: string
  conversation_history?: any[]
  created_at: string
  bot_active?: boolean
  satisfaction_score?: number | null
}

export interface WhatsappConversationEvent {
  id: string
  institution_id: string
  remote_jid: string
  event_type: string
  description?: string
  user_id?: string
  user_name?: string
  metadata?: any
  created_at: string
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
    } catch (error) {
      console.error('❌ Falha ao registrar atividade:', error)
      // Não quebra o fluxo principal se falhar o log
    }
  }

  // NOVOS MÉTODOS para editar e excluir ações
  static async updateActivityLog(activityId: string, data: { details: any }): Promise<void> {
    try {
      const { error } = await supabase
        .from('activity_logs')
        .update({
          details: data.details
        })
        .eq('id', activityId)

      if (error) {
        console.error('Erro ao atualizar atividade:', error)
        throw error
      }
    } catch (error) {
      console.error('Erro ao atualizar log de atividade:', error)
      throw error
    }
  }

  static async deleteActivityLog(activityId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .eq('id', activityId)

      if (error) {
        console.error('Erro ao excluir atividade:', error)
        throw error
      }
    } catch (error) {
      console.error('Erro ao excluir log de atividade:', error)
      throw error
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

  // WhatsApp Messages
  static async getWhatsappMessages(institutionId: string): Promise<WhatsappMessage[]> {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('institution_id', institutionId)
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Error loading whatsapp messages:', error)
      return []
    }
    return data || []
  }

  static async getWhatsappConversations(institutionId: string): Promise<WhatsappConversation[]> {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('institution_id', institutionId)
    if (error) {
      console.error('Error loading whatsapp conversations:', error)
      return []
    }
    return data || []
  }

  static async upsertConversationStatus(institutionId: string, remoteJid: string, status: string, leadId?: string): Promise<void> {
    const raw = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    const updates: any = { status }
    if (leadId) updates.lead_id = leadId
    const { error } = await supabase
      .from('whatsapp_conversations')
      .upsert({ institution_id: institutionId, remote_jid: raw, ...updates }, { onConflict: 'institution_id,remote_jid' })
    if (error) throw error
  }

  static async linkConversationLead(institutionId: string, remoteJid: string, leadId: string): Promise<void> {
    const raw = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    await supabase
      .from('whatsapp_conversations')
      .update({ lead_id: leadId })
      .eq('institution_id', institutionId)
      .eq('remote_jid', raw)
  }

  static async resetConversationUnread(institutionId: string, remoteJid: string): Promise<void> {
    const raw = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('institution_id', institutionId)
      .eq('remote_jid', raw)
  }

  static async updateWhatsappMessageLead(remoteJid: string, institutionId: string, leadId: string): Promise<void> {
    const raw = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({ lead_id: leadId })
      .eq('institution_id', institutionId)
      .eq('remote_jid', raw)
    if (error) throw error
  }

  static async searchLeadsByPhone(institutionId: string, phone: string): Promise<Lead[]> {
    const digits = phone.replace(/\D/g, '').slice(-8)
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('institution_id', institutionId)
      .limit(50)
    if (error) return []
    return (data || []).filter((l: Lead) => l.phone && l.phone.replace(/\D/g, '').endsWith(digits))
  }

  // Super Admin Methods
  static async isSuperAdmin(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('super_admins')
        .select('id')
        .eq('email', email)
        .eq('active', true)
        .single()

      const isSuperAdmin = !error && !!data
      return isSuperAdmin
    } catch {
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

  static async getConversationEvents(institutionId: string, remoteJid: string): Promise<WhatsappConversationEvent[]> {
    const raw = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    const { data, error } = await supabase
      .from('whatsapp_conversation_events')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('remote_jid', raw)
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) return []
    return data || []
  }

  static async logConversationEvent(event: {
    institution_id: string
    remote_jid: string
    event_type: string
    description?: string
    user_id?: string
    user_name?: string
    metadata?: any
  }): Promise<void> {
    await supabase.from('whatsapp_conversation_events').insert({
      ...event,
      remote_jid: event.remote_jid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, ''),
    })
  }

  static async assignConversation(institutionId: string, remoteJid: string, userId: string, userName: string): Promise<void> {
    const raw = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    await supabase.from('whatsapp_conversations')
      .upsert({ institution_id: institutionId, remote_jid: raw, assigned_user_id: userId, assigned_user_name: userName }, { onConflict: 'institution_id,remote_jid' })
  }

  static async transferConversation(institutionId: string, remoteJid: string, newUserId: string, newUserName: string, fromUserName: string): Promise<void> {
    const raw = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    await supabase.from('whatsapp_conversations')
      .update({ assigned_user_id: newUserId, assigned_user_name: newUserName, transferred_from: fromUserName, transferred_at: new Date().toISOString() })
      .eq('institution_id', institutionId)
      .eq('remote_jid', raw)
  }

  static async setConversationContactType(institutionId: string, remoteJid: string, contactType: string): Promise<void> {
    const raw = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    await supabase.from('whatsapp_conversations')
      .upsert({ institution_id: institutionId, remote_jid: raw, contact_type: contactType }, { onConflict: 'institution_id,remote_jid' })
  }

  static async updateConversationTags(institutionId: string, remoteJid: string, tags: string[]): Promise<void> {
    const raw = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    await supabase.from('whatsapp_conversations')
      .update({ tags })
      .eq('institution_id', institutionId)
      .eq('remote_jid', raw)
  }

  static async closeConversation(institutionId: string, remoteJid: string): Promise<{ count: number; error: any }> {
    const raw  = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    const norm = `${raw}@s.whatsapp.net`
    const payload = { status: 'closed', bot_active: false, assigned_user_id: null, assigned_user_name: null }

    // Always update both formats in parallel — DB may have either form (legacy + current)
    const [r1, r2] = await Promise.all([
      supabase.from('whatsapp_conversations').update(payload)
        .eq('institution_id', institutionId).eq('remote_jid', raw).select('id'),
      supabase.from('whatsapp_conversations').update(payload)
        .eq('institution_id', institutionId).eq('remote_jid', norm).select('id'),
    ])

    const count = (r1.data?.length ?? 0) + (r2.data?.length ?? 0)
    console.log('[DB CLOSE] raw rows:', r1.data?.length ?? 0, '| norm rows:', r2.data?.length ?? 0, '| total:', count)
    if (r1.error) console.error('[DB CLOSE] erro raw:', r1.error.message)
    if (r2.error) console.error('[DB CLOSE] erro norm:', r2.error.message)

    return { count, error: r1.error || r2.error }
  }

  static async updateProfilePicture(institutionId: string, remoteJid: string, url: string): Promise<void> {
    const raw = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    await supabase.from('whatsapp_conversations')
      .upsert({ institution_id: institutionId, remote_jid: raw, profile_picture_url: url }, { onConflict: 'institution_id,remote_jid' })
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
