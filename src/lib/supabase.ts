import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Database Types
export interface Lead {
  id: string
  nome: string
  responsavel: string
  contato: {
    email?: string
    telefone?: string
  }
  serie_interesse: string
  origem: string
  etapa: 'novo' | 'contato' | 'agendado' | 'visita' | 'proposta' | 'matricula'
  valor_estimado: number
  notas: string
  owner_id: string
  institution_id: string
  created_at: string
  updated_at: string
}

export interface Visita {
  id: string
  lead_id: string
  data: string
  responsavel_id: string
  status: 'agendada' | 'concluida' | 'cancelada'
  observacoes: string
  resultado?: 'positivo' | 'negativo' | 'pendente'
  institution_id: string
  created_at: string
}

export interface Matricula {
  id: string
  lead_id?: string
  nome_aluno: string
  data_matricula: string
  curso: string
  serie: string
  valor: number
  status: 'ativa' | 'cancelada' | 'concluida'
  institution_id: string
  created_at: string
}

export interface CampanhaMarketing {
  id: string
  nome: string
  periodo_start: string
  periodo_end: string
  investimento: number
  leads_gerados: number
  cpa_meta?: number
  institution_id: string
  created_at: string
}

export interface Visit {
  id: string
  lead_id?: string
  lead_name: string
  scheduled_date: string
  assigned_to?: string
  assigned_user: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
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

export interface Rematricula {
  id: string
  periodo: string
  base_total: number
  rematriculados: number
  inadimplentes: number
  transferidos: number
  meta_percentual: number
  institution_id: string
  created_at: string
}

export interface User {
  id: string
  nome: string
  email: string
  role: 'admin' | 'gestor' | 'comercial'
  institution_id: string
  active: boolean
  created_at: string
}

export interface Institution {
  id: string
  nome: string
  cnpj?: string
  logo_url?: string
  cor_primaria: string
  cor_secundaria: string
  created_at: string
}

export interface Acao {
  id: string
  titulo: string
  descricao: string
  tipo: 'marketing' | 'comercial' | 'rematricula' | 'geral'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  status: 'pendente' | 'em_progresso' | 'concluida' | 'cancelada'
  responsavel_id?: string
  prazo?: string
  metrica_origem: string
  valor_atual: number
  valor_meta: number
  institution_id: string
  created_at: string
}

// Mock Database Service
export class DatabaseService {
  // Mock data
  private static mockLeads: Lead[] = [
    {
      id: '1',
      nome: 'Ana Silva Santos',
      responsavel: 'Maria Silva',
      contato: { email: 'maria@email.com', telefone: '(11) 99999-1111' },
      serie_interesse: '1º Médio',
      origem: 'Facebook',
      etapa: 'novo',
      valor_estimado: 2500,
      notas: 'Interessada em período integral',
      owner_id: 'user1',
      institution_id: 'inst1',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      nome: 'Carlos Eduardo Lima',
      responsavel: 'João Lima',
      contato: { email: 'joao@email.com', telefone: '(11) 99999-2222' },
      serie_interesse: '6º Ano',
      origem: 'Instagram',
      etapa: 'contato',
      valor_estimado: 1800,
      notas: 'Pai quer conhecer a metodologia',
      owner_id: 'user1',
      institution_id: 'inst1',
      created_at: '2024-01-14T14:30:00Z',
      updated_at: '2024-01-14T14:30:00Z'
    },
    {
      id: '3',
      nome: 'Beatriz Costa',
      responsavel: 'Ana Costa',
      contato: { email: 'ana@email.com', telefone: '(11) 99999-3333' },
      serie_interesse: '3º Ano',
      origem: 'Indicação',
      etapa: 'agendado',
      valor_estimado: 1500,
      notas: 'Visita agendada para quinta-feira',
      owner_id: 'user1',
      institution_id: 'inst1',
      created_at: '2024-01-13T09:15:00Z',
      updated_at: '2024-01-13T09:15:00Z'
    },
    {
      id: '4',
      nome: 'Diego Oliveira',
      responsavel: 'Paula Oliveira',
      contato: { email: 'paula@email.com', telefone: '(11) 99999-4444' },
      serie_interesse: '2º Médio',
      origem: 'Google',
      etapa: 'visita',
      valor_estimado: 2800,
      notas: 'Visita realizada, aguardando decisão',
      owner_id: 'user1',
      institution_id: 'inst1',
      created_at: '2024-01-12T16:45:00Z',
      updated_at: '2024-01-12T16:45:00Z'
    },
    {
      id: '5',
      nome: 'Fernanda Santos',
      responsavel: 'Roberto Santos',
      contato: { email: 'roberto@email.com', telefone: '(11) 99999-5555' },
      serie_interesse: '9º Ano',
      origem: 'Site',
      etapa: 'proposta',
      valor_estimado: 2200,
      notas: 'Proposta enviada, negociando desconto',
      owner_id: 'user1',
      institution_id: 'inst1',
      created_at: '2024-01-11T11:20:00Z',
      updated_at: '2024-01-11T11:20:00Z'
    },
    {
      id: '6',
      nome: 'Gabriel Ferreira',
      responsavel: 'Lucia Ferreira',
      contato: { email: 'lucia@email.com', telefone: '(11) 99999-6666' },
      serie_interesse: '5º Ano',
      origem: 'WhatsApp',
      etapa: 'matricula',
      valor_estimado: 1900,
      notas: 'Matrícula confirmada para 2024',
      owner_id: 'user1',
      institution_id: 'inst1',
      created_at: '2024-01-10T13:30:00Z',
      updated_at: '2024-01-10T13:30:00Z'
    }
  ]

  private static mockVisitas: Visita[] = [
    {
      id: '1',
      lead_id: '3',
      data: '2024-01-18T14:00:00Z',
      responsavel_id: 'user1',
      status: 'agendada',
      observacoes: 'Primeira visita - apresentar metodologia',
      institution_id: 'inst1',
      created_at: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      lead_id: '4',
      data: '2024-01-16T10:30:00Z',
      responsavel_id: 'user1',
      status: 'concluida',
      observacoes: 'Visita realizada com sucesso',
      resultado: 'positivo',
      institution_id: 'inst1',
      created_at: '2024-01-14T09:00:00Z'
    }
  ]

  private static mockMatriculas: Matricula[] = [
    {
      id: '1',
      lead_id: '6',
      nome_aluno: 'Gabriel Ferreira',
      data_matricula: '2024-01-10T00:00:00Z',
      curso: 'Ensino Fundamental II',
      serie: '5º Ano',
      valor: 1900,
      status: 'ativa',
      institution_id: 'inst1',
      created_at: '2024-01-10T13:30:00Z'
    }
  ]

  private static mockCampanhas: CampanhaMarketing[] = [
    {
      id: '1',
      nome: 'Campanha Facebook Janeiro',
      periodo_start: '2024-01-01',
      periodo_end: '2024-01-31',
      investimento: 5000,
      leads_gerados: 25,
      cpa_meta: 200,
      institution_id: 'inst1',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      nome: 'Campanha Instagram Janeiro',
      periodo_start: '2024-01-01',
      periodo_end: '2024-01-31',
      investimento: 3000,
      leads_gerados: 18,
      cpa_meta: 180,
      institution_id: 'inst1',
      created_at: '2024-01-01T00:00:00Z'
    }
  ]

  private static mockVisits: Visit[] = [
    {
      id: '1',
      lead_id: '3',
      lead_name: 'Beatriz Costa',
      scheduled_date: '2024-01-18T14:00:00Z',
      assigned_to: 'user1',
      assigned_user: 'João Oliveira',
      status: 'scheduled',
      notes: 'Primeira visita - apresentar metodologia',
      institution_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      created_at: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      lead_id: '4',
      lead_name: 'Diego Oliveira',
      scheduled_date: '2024-01-16T10:30:00Z',
      assigned_to: 'user1',
      assigned_user: 'Maria Costa',
      status: 'completed',
      notes: 'Visita realizada com sucesso',
      institution_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      created_at: '2024-01-14T09:00:00Z'
    },
    {
      id: '3',
      lead_id: '1',
      lead_name: 'Ana Silva Santos',
      scheduled_date: new Date().toISOString(),
      assigned_to: 'user2',
      assigned_user: 'Pedro Santos',
      status: 'scheduled',
      notes: 'Visita hoje - confirmar presença',
      institution_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      created_at: new Date().toISOString()
    }
  ]

  private static mockFunnelMetrics: FunnelMetrics[] = [
    {
      id: '1',
      period: 'Janeiro 2024',
      registrations: 150,
      registrations_target: 120,
      schedules: 85,
      schedules_target: 90,
      visits: 72,
      visits_target: 80,
      enrollments: 18,
      enrollments_target: 24,
      institution_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      period: 'Dezembro 2023',
      registrations: 130,
      registrations_target: 120,
      schedules: 95,
      schedules_target: 90,
      visits: 82,
      visits_target: 80,
      enrollments: 24,
      enrollments_target: 20,
      institution_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      created_at: '2023-12-01T00:00:00Z'
    }
  ]

  private static mockRematriculas: Rematricula[] = [
    {
      id: '1',
      periodo: '2024/1',
      base_total: 1350,
      rematriculados: 1248,
      inadimplentes: 67,
      transferidos: 35,
      meta_percentual: 85,
      institution_id: 'inst1',
      created_at: '2024-01-01T00:00:00Z'
    }
  ]

  private static mockAcoes: Acao[] = [
    {
      id: '1',
      titulo: 'Aumentar investimento em mídia',
      descricao: 'Cadastros abaixo da meta. Recomenda-se aumentar investimento em campanhas digitais.',
      tipo: 'marketing',
      prioridade: 'alta',
      status: 'pendente',
      responsavel_id: 'user1',
      prazo: '2024-01-25',
      metrica_origem: 'cadastros_mensais',
      valor_atual: 120,
      valor_meta: 200,
      institution_id: 'inst1',
      created_at: '2024-01-15T00:00:00Z'
    },
    {
      id: '2',
      titulo: 'Campanha de follow-up',
      descricao: 'Taxa de conversão visita→matrícula baixa. Implementar follow-up estruturado.',
      tipo: 'comercial',
      prioridade: 'media',
      status: 'em_progresso',
      responsavel_id: 'user1',
      prazo: '2024-01-30',
      metrica_origem: 'conversao_visita_matricula',
      valor_atual: 15.5,
      valor_meta: 25,
      institution_id: 'inst1',
      created_at: '2024-01-14T00:00:00Z'
    }
  ]

  // API Methods
  static async getLeads(institutionId: string): Promise<Lead[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return this.mockLeads.filter(lead => lead.institution_id === institutionId)
  }

  static async createLead(leadData: Partial<Lead>): Promise<Lead> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newLead: Lead = {
      id: Date.now().toString(),
      nome: leadData.nome || '',
      responsavel: leadData.responsavel || '',
      contato: leadData.contato || {},
      serie_interesse: leadData.serie_interesse || '',
      origem: leadData.origem || '',
      etapa: leadData.etapa || 'novo',
      valor_estimado: leadData.valor_estimado || 0,
      notas: leadData.notas || '',
      owner_id: leadData.owner_id || '',
      institution_id: leadData.institution_id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    this.mockLeads.unshift(newLead)
    return newLead
  }

  static async updateLead(id: string, leadData: Partial<Lead>): Promise<Lead> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = this.mockLeads.findIndex(lead => lead.id === id)
    if (index !== -1) {
      this.mockLeads[index] = { ...this.mockLeads[index], ...leadData, updated_at: new Date().toISOString() }
      return this.mockLeads[index]
    }
    throw new Error('Lead não encontrado')
  }

  static async getVisitas(institutionId: string): Promise<Visita[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return this.mockVisitas.filter(visita => visita.institution_id === institutionId)
  }

  static async createVisita(visitaData: Partial<Visita>): Promise<Visita> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newVisita: Visita = {
      id: Date.now().toString(),
      lead_id: visitaData.lead_id || '',
      data: visitaData.data || '',
      responsavel_id: visitaData.responsavel_id || '',
      status: visitaData.status || 'agendada',
      observacoes: visitaData.observacoes || '',
      resultado: visitaData.resultado,
      institution_id: visitaData.institution_id || '',
      created_at: new Date().toISOString()
    }
    this.mockVisitas.unshift(newVisita)
    return newVisita
  }

  static async getMatriculas(institutionId: string): Promise<Matricula[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return this.mockMatriculas.filter(matricula => matricula.institution_id === institutionId)
  }

  static async createMatricula(matriculaData: Partial<Matricula>): Promise<Matricula> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newMatricula: Matricula = {
      id: Date.now().toString(),
      lead_id: matriculaData.lead_id,
      nome_aluno: matriculaData.nome_aluno || '',
      data_matricula: matriculaData.data_matricula || new Date().toISOString(),
      curso: matriculaData.curso || '',
      serie: matriculaData.serie || '',
      valor: matriculaData.valor || 0,
      status: matriculaData.status || 'ativa',
      institution_id: matriculaData.institution_id || '',
      created_at: new Date().toISOString()
    }
    this.mockMatriculas.unshift(newMatricula)
    return newMatricula
  }

  static async getCampanhas(institutionId: string): Promise<CampanhaMarketing[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return this.mockCampanhas.filter(campanha => campanha.institution_id === institutionId)
  }

  static async createCampanha(campanhaData: Partial<CampanhaMarketing>): Promise<CampanhaMarketing> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newCampanha: CampanhaMarketing = {
      id: Date.now().toString(),
      nome: campanhaData.nome || '',
      periodo_start: campanhaData.periodo_start || '',
      periodo_end: campanhaData.periodo_end || '',
      investimento: campanhaData.investimento || 0,
      leads_gerados: campanhaData.leads_gerados || 0,
      cpa_meta: campanhaData.cpa_meta,
      institution_id: campanhaData.institution_id || '',
      created_at: new Date().toISOString()
    }
    this.mockCampanhas.unshift(newCampanha)
    return newCampanha
  }

  static async updateMarketingCampaign(id: string, campaignData: Partial<CampanhaMarketing>): Promise<CampanhaMarketing> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = this.mockCampanhas.findIndex(campaign => campaign.id === id)
    if (index !== -1) {
      this.mockCampanhas[index] = { ...this.mockCampanhas[index], ...campaignData }
      return this.mockCampanhas[index]
    }
    throw new Error('Campanha não encontrada')
  }

  static async getVisits(institutionId: string): Promise<Visit[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return this.mockVisits.filter(visit => visit.institution_id === institutionId)
  }

  static async createVisit(visitData: Partial<Visit>): Promise<Visit> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newVisit: Visit = {
      id: Date.now().toString(),
      lead_id: visitData.lead_id,
      lead_name: visitData.lead_name || 'Lead',
      scheduled_date: visitData.scheduled_date || new Date().toISOString(),
      assigned_to: visitData.assigned_to,
      assigned_user: visitData.assigned_user || 'Usuário',
      status: visitData.status || 'scheduled',
      notes: visitData.notes || '',
      institution_id: visitData.institution_id || '',
      created_at: new Date().toISOString()
    }
    this.mockVisits.unshift(newVisit)
    return newVisit
  }

  static async getFunnelMetrics(institutionId: string): Promise<FunnelMetrics[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return this.mockFunnelMetrics.filter(funnel => funnel.institution_id === institutionId)
  }

  static async createFunnelMetrics(funnelData: Partial<FunnelMetrics>): Promise<FunnelMetrics> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newFunnel: FunnelMetrics = {
      id: Date.now().toString(),
      period: funnelData.period || '',
      registrations: funnelData.registrations || 0,
      registrations_target: funnelData.registrations_target || 0,
      schedules: funnelData.schedules || 0,
      schedules_target: funnelData.schedules_target || 0,
      visits: funnelData.visits || 0,
      visits_target: funnelData.visits_target || 0,
      enrollments: funnelData.enrollments || 0,
      enrollments_target: funnelData.enrollments_target || 0,
      institution_id: funnelData.institution_id || '',
      created_at: new Date().toISOString()
    }
    this.mockFunnelMetrics.unshift(newFunnel)
    return newFunnel
  }

  static async updateFunnelMetrics(id: string, funnelData: Partial<FunnelMetrics>): Promise<FunnelMetrics> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = this.mockFunnelMetrics.findIndex(funnel => funnel.id === id)
    if (index !== -1) {
      this.mockFunnelMetrics[index] = { ...this.mockFunnelMetrics[index], ...funnelData }
      return this.mockFunnelMetrics[index]
    }
    throw new Error('Funil não encontrado')
  }

  static async getRematriculas(institutionId: string): Promise<Rematricula[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return this.mockRematriculas.filter(rematricula => rematricula.institution_id === institutionId)
  }

  static async createRematricula(rematriculaData: Partial<Rematricula>): Promise<Rematricula> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const newRematricula: Rematricula = {
      id: Date.now().toString(),
      periodo: rematriculaData.periodo || '',
      base_total: rematriculaData.base_total || 0,
      rematriculados: rematriculaData.rematriculados || 0,
      inadimplentes: rematriculaData.inadimplentes || 0,
      transferidos: rematriculaData.transferidos || 0,
      meta_percentual: rematriculaData.meta_percentual || 85,
      institution_id: rematriculaData.institution_id || '',
      created_at: new Date().toISOString()
    }
    this.mockRematriculas.unshift(newRematricula)
    return newRematricula
  }

  static async getAcoes(institutionId: string): Promise<Acao[]> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return this.mockAcoes.filter(acao => acao.institution_id === institutionId)
  }

  static async updateAcao(id: string, acaoData: Partial<Acao>): Promise<Acao> {
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = this.mockAcoes.findIndex(acao => acao.id === id)
    if (index !== -1) {
      this.mockAcoes[index] = { ...this.mockAcoes[index], ...acaoData }
      return this.mockAcoes[index]
    }
    throw new Error('Ação não encontrada')
  }

  // Dashboard KPIs
  static async getDashboardKPIs(institutionId: string) {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const leads = await this.getLeads(institutionId)
    const matriculas = await this.getMatriculas(institutionId)
    const campanhas = await this.getCampanhas(institutionId)
    const rematriculas = await this.getRematriculas(institutionId)

    // Visitas hoje
    const visitas = await this.getVisits(institutionId)
    const hoje = new Date().toISOString().split('T')[0]
    const visitasHoje = visitas.filter(v => v.scheduled_date.startsWith(hoje) && v.status === 'scheduled').length

    // Matrículas do mês
    const mesAtual = new Date().toISOString().slice(0, 7)
    const matriculasMes = matriculas.filter(m => m.data_matricula.startsWith(mesAtual)).length

    // Taxa de conversão
    const leadsMatriculados = leads.filter(l => l.etapa === 'matricula').length
    const taxaConversao = leads.length > 0 ? (leadsMatriculados / leads.length) * 100 : 0

    // CPA atual
    const totalInvestimento = campanhas.reduce((sum, c) => sum + c.investimento, 0)
    const totalLeadsGerados = campanhas.reduce((sum, c) => sum + c.leads_gerados, 0)
    const cpaAtual = totalLeadsGerados > 0 ? totalInvestimento / totalLeadsGerados : 0

    // Taxa de rematrícula
    const ultimaRematricula = rematriculas[0]
    const taxaRematricula = ultimaRematricula 
      ? (ultimaRematricula.rematriculados / ultimaRematricula.base_total) * 100 
      : 0

    return {
      totalLeads: leads.length,
      visitasHoje,
      matriculasMes,
      taxaConversao: Number(taxaConversao.toFixed(1)),
      cpaAtual: Number(cpaAtual.toFixed(0)),
      taxaRematricula: Number(taxaRematricula.toFixed(1))
    }
  }
}