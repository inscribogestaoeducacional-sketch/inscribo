import React, { useState, useEffect } from 'react'
import { 
  Target, TrendingUp, TrendingDown, Users, Calendar, Eye, GraduationCap, 
  BarChart3, Plus, X, AlertCircle, CheckCircle, ArrowDown, Filter, Download
} from 'lucide-react'
import { DatabaseService, FunnelMetrics } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ===== INTERFACES =====

interface FunnelStage {
  name: string
  actual: number
  target: number
  conversion: number
  status: 'success' | 'warning' | 'danger'
  icon: React.ReactNode
  color: string
}

interface ParsedPeriod {
  year: number
  month: number
  monthName: string
}

interface FunnelWithParsed extends FunnelMetrics {
  parsed?: ParsedPeriod | null
}

interface NewFunnelModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<FunnelMetrics>) => void
  editingFunnel?: FunnelMetrics | null
}

interface AnnualGoalsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    year: number
    annual_registrations_target: number
    annual_schedules_target: number
    annual_visits_target: number
    annual_enrollments_target: number
  }) => void
  currentYear: number
  existingGoals: {
    registrations: number
    schedules: number
    visits: number
    enrollments: number
  }
}

// ===== HELPER FUNCTIONS =====

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function parsePeriod(period: string): ParsedPeriod | null {
  const yearMatch = period.match(/\d{4}/)
  if (!yearMatch) return null
  const year = parseInt(yearMatch[0])
  
  let month = 0
  let monthName = ''
  
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (period.toLowerCase().includes(MONTH_NAMES[i].toLowerCase())) {
      month = i + 1
      monthName = MONTH_NAMES[i]
      break
    }
  }
  
  if (month === 0) {
    const monthMatch = period.match(/^(\d{1,2})\//)
    if (monthMatch) {
      month = parseInt(monthMatch[1])
      if (month >= 1 && month <= 12) {
        monthName = MONTH_NAMES[month - 1]
      }
    }
  }
  
  if (month === 0) return null
  
  return { year, month, monthName }
}

function createPeriodString(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

// ===== MODAL DE METAS ANUAIS =====

function AnnualGoalsModal({ isOpen, onClose, onSave, currentYear, existingGoals }: AnnualGoalsModalProps) {
  const [formData, setFormData] = useState({
    year: currentYear,
    annual_registrations_target: existingGoals.registrations,
    annual_schedules_target: existingGoals.schedules,
    annual_visits_target: existingGoals.visits,
    annual_enrollments_target: existingGoals.enrollments
  })

  useEffect(() => {
    setFormData({
      year: currentYear,
      annual_registrations_target: existingGoals.registrations,
      annual_schedules_target: existingGoals.schedules,
      annual_visits_target: existingGoals.visits,
      annual_enrollments_target: existingGoals.enrollments
    })
  }, [currentYear, existingGoals, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Metas Anuais - {formData.year}</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ano *
            </label>
            <input
              type="number"
              required
              min="2020"
              max="2050"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Meta Anual de Cadastros *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.annual_registrations_target}
                onChange={(e) => setFormData({ ...formData, annual_registrations_target: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Meta Anual de Agendamentos *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.annual_schedules_target}
                onChange={(e) => setFormData({ ...formData, annual_schedules_target: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Meta Anual de Visitas *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.annual_visits_target}
                onChange={(e) => setFormData({ ...formData, annual_visits_target: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Meta Anual de Matrículas *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.annual_enrollments_target}
                onChange={(e) => setFormData({ ...formData, annual_enrollments_target: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium shadow-sm"
            >
              Salvar Metas
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===== MODAL DE NOVO/EDITAR PERÍODO =====

function NewFunnelModal({ isOpen, onClose, onSave, editingFunnel }: NewFunnelModalProps) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  
  const [formData, setFormData] = useState({
    year: currentYear,
    month: currentMonth,
    registrations: 0,
    registrations_target: 0,
    schedules: 0,
    schedules_target: 0,
    visits: 0,
    visits_target: 0,
    enrollments: 0,
    enrollments_target: 0,
  })

  useEffect(() => {
    if (editingFunnel) {
      const parsed = parsePeriod(editingFunnel.period)
      setFormData({
        year: parsed?.year || currentYear,
        month: parsed?.month || currentMonth,
        registrations: editingFunnel.registrations,
        registrations_target: editingFunnel.registrations_target,
        schedules: editingFunnel.schedules,
        schedules_target: editingFunnel.schedules_target,
        visits: editingFunnel.visits,
        visits_target: editingFunnel.visits_target,
        enrollments: editingFunnel.enrollments,
        enrollments_target: editingFunnel.enrollments_target,
      })
    } else {
      setFormData({
        year: currentYear,
        month: currentMonth,
        registrations: 0,
        registrations_target: 0,
        schedules: 0,
        schedules_target: 0,
        visits: 0,
        visits_target: 0,
        enrollments: 0,
        enrollments_target: 0,
      })
    }
  }, [editingFunnel, isOpen, currentYear, currentMonth])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const period = createPeriodString(formData.year, formData.month)
    
    onSave({
      period,
      registrations: formData.registrations,
      registrations_target: formData.registrations_target,
      schedules: formData.schedules,
      schedules_target: formData.schedules_target,
      visits: formData.visits,
      visits_target: formData.visits_target,
      enrollments: formData.enrollments,
      enrollments_target: formData.enrollments_target,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingFunnel ? 'Editar Período' : 'Novo Período'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ano *
              </label>
              <select
                required
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              >
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mês *
              </label>
              <select
                required
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              >
                {MONTH_NAMES.map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Dados Realizados</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cadastros Realizados *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.registrations}
                  onChange={(e) => setFormData({ ...formData, registrations: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Agendamentos Realizados *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.schedules}
                  onChange={(e) => setFormData({ ...formData, schedules: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Visitas Realizadas *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.visits}
                  onChange={(e) => setFormData({ ...formData, visits: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Matrículas Realizadas *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.enrollments}
                  onChange={(e) => setFormData({ ...formData, enrollments: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Metas do Mês</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Meta de Cadastros *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.registrations_target}
                  onChange={(e) => setFormData({ ...formData, registrations_target: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Meta de Agendamentos *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.schedules_target}
                  onChange={(e) => setFormData({ ...formData, schedules_target: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Meta de Visitas *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.visits_target}
                  onChange={(e) => setFormData({ ...formData, visits_target: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Meta de Matrículas *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.enrollments_target}
                  onChange={(e) => setFormData({ ...formData, enrollments_target: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium shadow-sm"
            >
              {editingFunnel ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===== COMPONENTE PRINCIPAL =====

export default function FunnelAnalysis() {
  const { user } = useAuth()
  const [funnelData, setFunnelData] = useState<FunnelWithParsed[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewFunnelModal, setShowNewFunnelModal] = useState(false)
  const [showAnnualGoalsModal, setShowAnnualGoalsModal] = useState(false)
  const [editingFunnel, setEditingFunnel] = useState<FunnelMetrics | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [annualGoals, setAnnualGoals] = useState({
    registrations: 0,
    schedules: 0,
    visits: 0,
    enrollments: 0
  })

  useEffect(() => {
    if (user?.institution_id) {
      loadFunnelData()
    }
  }, [user])

  const loadFunnelData = async () => {
    try {
      setLoading(true)
      const data = await DatabaseService.getFunnelMetrics(user!.institution_id)
      
      const dataWithParsed: FunnelWithParsed[] = data.map(item => ({
        ...item,
        parsed: parsePeriod(item.period)
      }))
      
      setFunnelData(dataWithParsed)
    } catch (error) {
      console.error('Error loading funnel data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<FunnelMetrics>) => {
    try {
      const funnelMetrics = {
        ...data,
        institution_id: user!.institution_id,
      }

      if (editingFunnel) {
        await DatabaseService.updateFunnelMetrics(editingFunnel.id, funnelMetrics)
      } else {
        await DatabaseService.createFunnelMetrics(funnelMetrics)
      }

      await loadFunnelData()
      setEditingFunnel(null)
      setShowNewFunnelModal(false)
    } catch (error) {
      console.error('Error saving funnel data:', error)
      alert('Erro ao salvar dados. Por favor, tente novamente.')
    }
  }

  const handleSaveAnnualGoals = (data: {
    year: number
    annual_registrations_target: number
    annual_schedules_target: number
    annual_visits_target: number
    annual_enrollments_target: number
  }) => {
    setAnnualGoals({
      registrations: data.annual_registrations_target,
      schedules: data.annual_schedules_target,
      visits: data.annual_visits_target,
      enrollments: data.annual_enrollments_target
    })
    setShowAnnualGoalsModal(false)
  }

  const handleEdit = (funnel: FunnelMetrics) => {
    setEditingFunnel(funnel)
    setShowNewFunnelModal(true)
  }

  const handleNew = () => {
    setEditingFunnel(null)
    setShowNewFunnelModal(true)
  }

  // Filtrar dados do ano selecionado
  const yearData = funnelData
    .filter(f => f.parsed?.year === selectedYear)
    .sort((a, b) => (a.parsed?.month || 0) - (b.parsed?.month || 0))

  // Calcular totais do ano
  const yearTotals = yearData.reduce((acc, curr) => ({
    registrations: acc.registrations + curr.registrations,
    schedules: acc.schedules + curr.schedules,
    visits: acc.visits + curr.visits,
    enrollments: acc.enrollments + curr.enrollments,
  }), { registrations: 0, schedules: 0, visits: 0, enrollments: 0 })

  // Mês atual
  const currentMonth = new Date().getMonth() + 1
  const currentMonthData = yearData.find(f => f.parsed?.month === currentMonth)

  // Anos disponíveis
  const availableYears = Array.from(new Set(
    funnelData
      .map(f => f.parsed?.year)
      .filter((y): y is number => y !== null && y !== undefined)
  )).sort((a, b) => b - a)

  // Estágios do funil
  const FUNNEL_STAGES: FunnelStage[] = currentMonthData ? [
    {
      name: 'Cadastros',
      actual: currentMonthData.registrations,
      target: currentMonthData.registrations_target,
      conversion: 100,
      status: currentMonthData.registrations >= currentMonthData.registrations_target ? 'success' : 'warning',
      icon: <Users className="h-6 w-6" />,
      color: 'blue'
    },
    {
      name: 'Agendamentos',
      actual: currentMonthData.schedules,
      target: currentMonthData.schedules_target,
      conversion: currentMonthData.registrations > 0 ? (currentMonthData.schedules / currentMonthData.registrations) * 100 : 0,
      status: currentMonthData.schedules >= currentMonthData.schedules_target ? 'success' : 'warning',
      icon: <Calendar className="h-6 w-6" />,
      color: 'purple'
    },
    {
      name: 'Visitas',
      actual: currentMonthData.visits,
      target: currentMonthData.visits_target,
      conversion: currentMonthData.schedules > 0 ? (currentMonthData.visits / currentMonthData.schedules) * 100 : 0,
      status: currentMonthData.visits >= currentMonthData.visits_target ? 'success' : 'warning',
      icon: <Eye className="h-6 w-6" />,
      color: 'orange'
    },
    {
      name: 'Matrículas',
      actual: currentMonthData.enrollments,
      target: currentMonthData.enrollments_target,
      conversion: currentMonthData.visits > 0 ? (currentMonthData.enrollments / currentMonthData.visits) * 100 : 0,
      status: currentMonthData.enrollments >= currentMonthData.enrollments_target ? 'success' : 'warning',
      icon: <GraduationCap className="h-6 w-6" />,
      color: 'green'
    }
  ] : []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-white rounded-xl shadow-sm"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <BarChart3 className="h-7 w-7 text-cyan-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Planejamento & Funil</h1>
            </div>
            <p className="text-gray-600">Análise do funil de vendas e metas</p>
          </div>
          <div className="flex items-center space-x-3">
            {availableYears.length > 0 && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all bg-white font-medium"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowAnnualGoalsModal(true)}
              className="px-5 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center font-medium text-gray-700 shadow-sm"
            >
              <Target className="h-5 w-5 mr-2" />
              Metas Anuais
            </button>
            <button
              onClick={handleNew}
              className="px-5 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center font-medium shadow-sm"
            >
              <Plus className="h-5 w-5 mr-2" />
              Novo Período
            </button>
          </div>
        </div>

        {yearData.length > 0 ? (
          <>
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Total de Usuários */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-600">Cadastros no Ano</p>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{yearTotals.registrations}</p>
                {annualGoals.registrations > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Meta: {annualGoals.registrations}</p>
                    {yearTotals.registrations >= annualGoals.registrations ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                )}
              </div>

              {/* Usuários Ativos */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-600">Agendamentos no Ano</p>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{yearTotals.schedules}</p>
                <p className="text-xs text-gray-500">
                  Taxa: {yearTotals.registrations > 0 
                    ? `${((yearTotals.schedules / yearTotals.registrations) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
              </div>

              {/* Administradores */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-600">Visitas no Ano</p>
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Eye className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{yearTotals.visits}</p>
                <p className="text-xs text-gray-500">
                  Taxa: {yearTotals.schedules > 0 
                    ? `${((yearTotals.visits / yearTotals.schedules) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
              </div>

              {/* Gestores */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-600">Matrículas no Ano</p>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <GraduationCap className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{yearTotals.enrollments}</p>
                <p className="text-xs text-gray-500">
                  Conversão: {yearTotals.registrations > 0 
                    ? `${((yearTotals.enrollments / yearTotals.registrations) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
              </div>
            </div>

            {/* Funil do Mês Atual */}
            {FUNNEL_STAGES.length > 0 && currentMonthData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Funil do Mês - {currentMonthData.parsed?.monthName} {selectedYear}
                  </h3>
                  <button
                    onClick={() => handleEdit(currentMonthData)}
                    className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center"
                  >
                    <Target className="h-4 w-4 mr-1" />
                    Editar Dados
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {FUNNEL_STAGES.map((stage, index) => {
                    const deviation = stage.target > 0 ? ((stage.actual - stage.target) / stage.target * 100) : 0
                    const isLast = index === FUNNEL_STAGES.length - 1
                    
                    return (
                      <div key={stage.name} className="relative">
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-lg ${
                              stage.color === 'blue' ? 'bg-blue-100' :
                              stage.color === 'purple' ? 'bg-purple-100' :
                              stage.color === 'orange' ? 'bg-orange-100' :
                              'bg-green-100'
                            }`}>
                              <div className={
                                stage.color === 'blue' ? 'text-blue-600' :
                                stage.color === 'purple' ? 'text-purple-600' :
                                stage.color === 'orange' ? 'text-orange-600' :
                                'text-green-600'
                              }>
                                {stage.icon}
                              </div>
                            </div>
                            {deviation >= 0 ? (
                              <TrendingUp className="h-5 w-5 text-green-500" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-red-500" />
                            )}
                          </div>
                          
                          <h4 className="text-sm font-semibold text-gray-600 mb-3">{stage.name}</h4>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-500">Realizado</span>
                              <span className="text-2xl font-bold text-gray-900">{stage.actual}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-500">Meta</span>
                              <span className="text-sm font-medium text-gray-600">{stage.target}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                              <span className="text-xs text-gray-500">Desvio</span>
                              <span className={`text-sm font-bold ${
                                deviation >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}%
                              </span>
                            </div>
                            {index > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Conversão</span>
                                <span className="text-sm font-bold text-cyan-600">
                                  {stage.conversion.toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {!isLast && (
                          <div className="hidden md:flex absolute top-1/2 -right-3 transform -translate-y-1/2 z-10 items-center justify-center">
                            <div className="bg-white rounded-full p-1 shadow-sm border border-gray-200">
                              <ArrowDown className="h-4 w-4 text-gray-400 rotate-[-90deg]" />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tabela Histórica */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Histórico Completo - {selectedYear}</h3>
                <button
                  className="text-gray-600 hover:text-gray-900 flex items-center text-sm font-medium"
                  onClick={() => {
                    const csv = [
                      ['Mês', 'Cadastros', 'Meta', 'Agendamentos', 'Meta', 'Visitas', 'Meta', 'Matrículas', 'Meta'],
                      ...yearData.map(f => [
                        f.parsed?.monthName || '',
                        f.registrations,
                        f.registrations_target,
                        f.schedules,
                        f.schedules_target,
                        f.visits,
                        f.visits_target,
                        f.enrollments,
                        f.enrollments_target
                      ])
                    ].map(row => row.join(',')).join('\n')
                    
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `funil-${selectedYear}.csv`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    window.URL.revokeObjectURL(url)
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Exportar
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        MÊS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        CADASTROS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        AGENDAMENTOS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        VISITAS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        MATRÍCULAS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        TAXA FINAL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        AÇÕES
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {yearData.map((period) => {
                      const finalRate = period.registrations > 0 ? (period.enrollments / period.registrations) * 100 : 0
                      
                      return (
                        <tr key={period.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">{period.parsed?.monthName}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">{period.registrations}</span>
                              <span className="text-xs text-gray-500">Meta: {period.registrations_target}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">{period.schedules}</span>
                              <span className="text-xs text-gray-500">Meta: {period.schedules_target}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">{period.visits}</span>
                              <span className="text-xs text-gray-500">Meta: {period.visits_target}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">{period.enrollments}</span>
                              <span className="text-xs text-gray-500">Meta: {period.enrollments_target}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-bold text-green-600">
                              {finalRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleEdit(period)}
                              className="text-cyan-600 hover:text-cyan-700 font-medium text-sm"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
            <div className="text-center">
              <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
                <BarChart3 className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Nenhum dado configurado para {selectedYear}
              </h3>
              <p className="text-gray-600 mb-6">
                Configure seus dados mensais e metas anuais para começar a analisar o funil
              </p>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => setShowAnnualGoalsModal(true)}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 shadow-sm"
                >
                  Definir Metas Anuais
                </button>
                <button
                  onClick={handleNew}
                  className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium shadow-sm"
                >
                  Adicionar Primeiro Período
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        <NewFunnelModal
          isOpen={showNewFunnelModal}
          onClose={() => {
            setShowNewFunnelModal(false)
            setEditingFunnel(null)
          }}
          onSave={handleSave}
          editingFunnel={editingFunnel}
        />

        <AnnualGoalsModal
          isOpen={showAnnualGoalsModal}
          onClose={() => setShowAnnualGoalsModal(false)}
          onSave={handleSaveAnnualGoals}
          currentYear={selectedYear}
          existingGoals={annualGoals}
        />
      </div>
    </div>
  )
}
