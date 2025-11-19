import React, { useState, useEffect } from 'react'
import { 
  Target, TrendingUp, TrendingDown, Users, Calendar, Eye, GraduationCap, 
  BarChart3, Plus, X, AlertCircle, CheckCircle, ArrowUp, ArrowDown,
  Filter, Download, Info
} from 'lucide-react'
import { DatabaseService, FunnelMetrics, FunnelAnalysisView, AnnualFunnelTotals, YearComparison } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ===== INTERFACES =====

interface FunnelStage {
  name: string
  actual: number
  target: number
  conversion: number
  status: 'success' | 'warning' | 'danger'
  icon: React.ReactNode
}

interface NewFunnelModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<FunnelMetrics>) => void
  editingFunnel?: FunnelMetrics | null
  availableYears: number[]
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
  existingGoals?: AnnualFunnelTotals | null
}

// ===== MODAL DE METAS ANUAIS =====

function AnnualGoalsModal({ isOpen, onClose, onSave, currentYear, existingGoals }: AnnualGoalsModalProps) {
  const [formData, setFormData] = useState({
    year: currentYear,
    annual_registrations_target: existingGoals?.annual_registrations_target || 0,
    annual_schedules_target: existingGoals?.annual_schedules_target || 0,
    annual_visits_target: existingGoals?.annual_visits_target || 0,
    annual_enrollments_target: existingGoals?.annual_enrollments_target || 0
  })

  useEffect(() => {
    if (existingGoals) {
      setFormData({
        year: existingGoals.year,
        annual_registrations_target: existingGoals.annual_registrations_target,
        annual_schedules_target: existingGoals.annual_schedules_target,
        annual_visits_target: existingGoals.annual_visits_target,
        annual_enrollments_target: existingGoals.annual_enrollments_target
      })
    }
  }, [existingGoals])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Metas Anuais - {formData.year}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ano *
            </label>
            <input
              type="number"
              required
              min="2020"
              max="2050"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta Anual de Cadastros *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.annual_registrations_target}
                onChange={(e) => setFormData({ ...formData, annual_registrations_target: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta Anual de Agendamentos *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.annual_schedules_target}
                onChange={(e) => setFormData({ ...formData, annual_schedules_target: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta Anual de Visitas *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.annual_visits_target}
                onChange={(e) => setFormData({ ...formData, annual_visits_target: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta Anual de Matrículas *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.annual_enrollments_target}
                onChange={(e) => setFormData({ ...formData, annual_enrollments_target: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Distribuição Automática</p>
                <p>As metas mensais serão distribuídas automaticamente com base nas metas anuais definidas acima.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Salvar Metas Anuais
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===== MODAL DE NOVO FUNIL =====

function NewFunnelModal({ isOpen, onClose, onSave, editingFunnel, availableYears }: NewFunnelModalProps) {
  const currentYear = new Date().getFullYear()
  const [formData, setFormData] = useState({
    year: currentYear,
    month: 1,
    registrations: 0,
    registrations_target: 0,
    schedules: 0,
    schedules_target: 0,
    visits: 0,
    visits_target: 0,
    enrollments: 0,
    enrollments_target: 0,
    notes: ''
  })

  useEffect(() => {
    if (editingFunnel) {
      setFormData({
        year: editingFunnel.year,
        month: editingFunnel.month,
        registrations: editingFunnel.registrations,
        registrations_target: editingFunnel.registrations_target,
        schedules: editingFunnel.schedules,
        schedules_target: editingFunnel.schedules_target,
        visits: editingFunnel.visits,
        visits_target: editingFunnel.visits_target,
        enrollments: editingFunnel.enrollments,
        enrollments_target: editingFunnel.enrollments_target,
        notes: editingFunnel.notes || ''
      })
    } else {
      setFormData({
        year: currentYear,
        month: new Date().getMonth() + 1,
        registrations: 0,
        registrations_target: 0,
        schedules: 0,
        schedules_target: 0,
        visits: 0,
        visits_target: 0,
        enrollments: 0,
        enrollments_target: 0,
        notes: ''
      })
    }
  }, [editingFunnel, isOpen, currentYear])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{editingFunnel ? 'Editar Período' : 'Novo Período'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ano *
              </label>
              <select
                required
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mês *
              </label>
              <select
                required
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {monthNames.map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Dados Realizados</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cadastros Realizados *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.registrations}
                  onChange={(e) => setFormData({ ...formData, registrations: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agendamentos Realizados *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.schedules}
                  onChange={(e) => setFormData({ ...formData, schedules: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visitas Realizadas *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.visits}
                  onChange={(e) => setFormData({ ...formData, visits: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Matrículas Realizadas *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.enrollments}
                  onChange={(e) => setFormData({ ...formData, enrollments: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Metas do Mês</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta de Cadastros *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.registrations_target}
                  onChange={(e) => setFormData({ ...formData, registrations_target: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta de Agendamentos *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.schedules_target}
                  onChange={(e) => setFormData({ ...formData, schedules_target: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta de Visitas *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.visits_target}
                  onChange={(e) => setFormData({ ...formData, visits_target: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta de Matrículas *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.enrollments_target}
                  onChange={(e) => setFormData({ ...formData, enrollments_target: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Adicione observações sobre este período..."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
  const [funnelData, setFunnelData] = useState<FunnelMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewFunnelModal, setShowNewFunnelModal] = useState(false)
  const [showAnnualGoalsModal, setShowAnnualGoalsModal] = useState(false)
  const [editingFunnel, setEditingFunnel] = useState<FunnelMetrics | null>(null)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [annualTotals, setAnnualTotals] = useState<AnnualFunnelTotals | null>(null)
  const [yearComparison, setYearComparison] = useState<YearComparison[]>([])
  const [comparisonYears, setComparisonYears] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (user?.institution_id) {
      loadAllData()
    }
  }, [user, selectedYear])

  const loadAllData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadAvailableYears(),
        loadFunnelData(),
        loadAnnualTotals(),
      ])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableYears = async () => {
    const years = await DatabaseService.getAvailableYears(user!.institution_id)
    setAvailableYears(years)
    
    // Se houver anos e nenhum selecionado, selecionar o mais recente
    if (years.length > 0 && !selectedYear) {
      setSelectedYear(years[0])
    }
  }

  const loadFunnelData = async () => {
    const data = await DatabaseService.getFunnelMetricsByYear(user!.institution_id, selectedYear)
    setFunnelData(data)
  }

  const loadAnnualTotals = async () => {
    const totals = await DatabaseService.getAnnualFunnelTotals(user!.institution_id, selectedYear)
    setAnnualTotals(totals)
  }

  const loadYearComparison = async (year1: number, year2: number) => {
    const comparison = await DatabaseService.compareYearsFunnel(user!.institution_id, year1, year2)
    setYearComparison(comparison)
    setComparisonYears([year1, year2])
  }

  const handleSave = async (data: Partial<FunnelMetrics>) => {
    try {
      const funnelMetrics = {
        ...data,
        institution_id: user!.institution_id,
        // Copiar metas anuais se existirem
        annual_registrations_target: annualTotals?.annual_registrations_target || 0,
        annual_schedules_target: annualTotals?.annual_schedules_target || 0,
        annual_visits_target: annualTotals?.annual_visits_target || 0,
        annual_enrollments_target: annualTotals?.annual_enrollments_target || 0,
      }

      if (editingFunnel) {
        await DatabaseService.updateFunnelMetricsWithDate(editingFunnel.id, funnelMetrics)
      } else {
        await DatabaseService.createFunnelMetricsWithDate(funnelMetrics)
      }

      await loadAllData()
      setEditingFunnel(null)
    } catch (error) {
      console.error('Error saving funnel data:', error)
    }
  }

  const handleSaveAnnualGoals = async (data: {
    year: number
    annual_registrations_target: number
    annual_schedules_target: number
    annual_visits_target: number
    annual_enrollments_target: number
  }) => {
    try {
      // Atualizar todas as entradas deste ano com as novas metas anuais
      const yearData = await DatabaseService.getFunnelMetricsByYear(user!.institution_id, data.year)
      
      for (const entry of yearData) {
        await DatabaseService.updateFunnelMetricsWithDate(entry.id, {
          annual_registrations_target: data.annual_registrations_target,
          annual_schedules_target: data.annual_schedules_target,
          annual_visits_target: data.annual_visits_target,
          annual_enrollments_target: data.annual_enrollments_target,
        })
      }

      await loadAllData()
    } catch (error) {
      console.error('Error saving annual goals:', error)
    }
  }

  const handleEdit = (funnel: FunnelMetrics) => {
    setEditingFunnel(funnel)
    setShowNewFunnelModal(true)
  }

  const handleNew = () => {
    setEditingFunnel(null)
    setShowNewFunnelModal(true)
  }

  // Calcular dados do mês atual
  const currentMonth = new Date().getMonth() + 1
  const currentMonthData = funnelData.find(f => f.month === currentMonth)
  
  // Calcular totais do ano até agora
  const yearToDateTotals = funnelData.reduce((acc, curr) => {
    if (curr.month <= currentMonth) {
      return {
        registrations: acc.registrations + curr.registrations,
        schedules: acc.schedules + curr.schedules,
        visits: acc.visits + curr.visits,
        enrollments: acc.enrollments + curr.enrollments,
      }
    }
    return acc
  }, { registrations: 0, schedules: 0, visits: 0, enrollments: 0 })

  const FUNNEL_STAGES: FunnelStage[] = currentMonthData ? [
    {
      name: 'Cadastros',
      actual: currentMonthData.registrations,
      target: currentMonthData.registrations_target,
      conversion: 100,
      status: currentMonthData.registrations >= currentMonthData.registrations_target ? 'success' : 'warning',
      icon: <Users className="h-5 w-5" />
    },
    {
      name: 'Agendamentos',
      actual: currentMonthData.schedules,
      target: currentMonthData.schedules_target,
      conversion: currentMonthData.registrations > 0 ? (currentMonthData.schedules / currentMonthData.registrations) * 100 : 0,
      status: currentMonthData.schedules >= currentMonthData.schedules_target ? 'success' : 'warning',
      icon: <Calendar className="h-5 w-5" />
    },
    {
      name: 'Visitas',
      actual: currentMonthData.visits,
      target: currentMonthData.visits_target,
      conversion: currentMonthData.schedules > 0 ? (currentMonthData.visits / currentMonthData.schedules) * 100 : 0,
      status: currentMonthData.visits >= currentMonthData.visits_target ? 'success' : 'warning',
      icon: <Eye className="h-5 w-5" />
    },
    {
      name: 'Matrículas',
      actual: currentMonthData.enrollments,
      target: currentMonthData.enrollments_target,
      conversion: currentMonthData.visits > 0 ? (currentMonthData.enrollments / currentMonthData.visits) * 100 : 0,
      status: currentMonthData.enrollments >= currentMonthData.enrollments_target ? 'success' : 'warning',
      icon: <GraduationCap className="h-5 w-5" />
    }
  ] : []

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planejamento & Funil</h1>
          <p className="text-gray-600">Análise completa do funil de vendas com comparativos históricos</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
              {!availableYears.includes(new Date().getFullYear()) && (
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              )}
            </select>
          </div>
          <button
            onClick={() => setShowAnnualGoalsModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <Target className="h-4 w-4 mr-2" />
            Metas Anuais
          </button>
          <button
            onClick={handleNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Período
          </button>
        </div>
      </div>

      {/* Cards de Resumo Anual */}
      {annualTotals && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-blue-900">Cadastros no Ano</h3>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900">{annualTotals.total_registrations}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-blue-700">Meta: {annualTotals.annual_registrations_target}</span>
              {annualTotals.total_registrations >= annualTotals.annual_registrations_target ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              )}
            </div>
            <div className="mt-2 text-xs text-blue-700">
              {annualTotals.annual_registrations_target > 0 
                ? `${((annualTotals.total_registrations / annualTotals.annual_registrations_target) * 100).toFixed(1)}% da meta`
                : 'Meta não definida'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-purple-900">Agendamentos no Ano</h3>
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-900">{annualTotals.total_schedules}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-purple-700">Meta: {annualTotals.annual_schedules_target}</span>
              {annualTotals.total_schedules >= annualTotals.annual_schedules_target ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              )}
            </div>
            <div className="mt-2 text-xs text-purple-700">
              Taxa: {annualTotals.total_registrations > 0 
                ? `${((annualTotals.total_schedules / annualTotals.total_registrations) * 100).toFixed(1)}%`
                : '0%'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-orange-900">Visitas no Ano</h3>
              <Eye className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-900">{annualTotals.total_visits}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-orange-700">Meta: {annualTotals.annual_visits_target}</span>
              {annualTotals.total_visits >= annualTotals.annual_visits_target ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              )}
            </div>
            <div className="mt-2 text-xs text-orange-700">
              Taxa: {annualTotals.total_schedules > 0 
                ? `${((annualTotals.total_visits / annualTotals.total_schedules) * 100).toFixed(1)}%`
                : '0%'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-green-900">Matrículas no Ano</h3>
              <GraduationCap className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">{annualTotals.total_enrollments}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-green-700">Meta: {annualTotals.annual_enrollments_target}</span>
              {annualTotals.total_enrollments >= annualTotals.annual_enrollments_target ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              )}
            </div>
            <div className="mt-2 text-xs text-green-700">
              Conversão Geral: {annualTotals.overall_conversion_rate.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Resto do conteúdo continua... */}
      {FUNNEL_STAGES.length > 0 ? (
        <>
          {/* Funil do Mês Atual */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Funil do Mês - {currentMonthData?.month_name} {selectedYear}
              </h3>
              <button
                onClick={() => currentMonthData && handleEdit(currentMonthData)}
                className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
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
                    <div className={`rounded-lg p-6 ${
                      stage.status === 'success' ? 'bg-green-50 border border-green-200' :
                      stage.status === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                      'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-2 rounded-lg ${
                          stage.status === 'success' ? 'bg-green-100 text-green-600' :
                          stage.status === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {stage.icon}
                        </div>
                        <div className="flex items-center">
                          {deviation >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      
                      <h4 className="text-sm font-medium text-gray-900 mb-2">{stage.name}</h4>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">Realizado</span>
                          <span className="text-lg font-bold text-gray-900">{stage.actual}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">Meta</span>
                          <span className="text-sm text-gray-700">{stage.target}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">Desvio</span>
                          <span className={`text-sm font-medium ${
                            deviation >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}%
                          </span>
                        </div>
                        {index > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Conversão</span>
                            <span className="text-sm font-medium text-blue-600">
                              {stage.conversion.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {!isLast && (
                      <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                        <ArrowDown className="h-6 w-6 text-gray-400 rotate-[-90deg]" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Gráfico Mensal - Performance Mês a Mês */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Mês a Mês - {selectedYear}</h3>
            <div className="space-y-6">
              {['Cadastros', 'Agendamentos', 'Visitas', 'Matrículas'].map((metric, metricIndex) => {
                const dataKey = metricIndex === 0 ? 'registrations' : 
                              metricIndex === 1 ? 'schedules' : 
                              metricIndex === 2 ? 'visits' : 'enrollments'
                const targetKey = `${dataKey}_target` as keyof FunnelMetrics
                const maxValue = Math.max(
                  ...funnelData.map(f => Math.max(f[dataKey] as number, f[targetKey] as number))
                )

                return (
                  <div key={metric}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{metric}</span>
                      <div className="flex items-center space-x-4 text-xs">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-blue-500 rounded-full mr-1"></div>
                          <span>Realizado</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-gray-300 rounded-full mr-1"></div>
                          <span>Meta</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end space-x-2 h-24">
                      {funnelData.map((month, idx) => {
                        const actual = month[dataKey] as number
                        const target = month[targetKey] as number
                        const actualHeight = maxValue > 0 ? (actual / maxValue) * 100 : 0
                        const targetHeight = maxValue > 0 ? (target / maxValue) * 100 : 0

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center">
                            <div className="w-full flex items-end justify-center space-x-1 h-20">
                              <div 
                                className="w-1/2 bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                                style={{ height: `${actualHeight}%` }}
                                title={`${month.month_name}: ${actual}`}
                              ></div>
                              <div 
                                className="w-1/2 bg-gray-300 rounded-t transition-all hover:bg-gray-400"
                                style={{ height: `${targetHeight}%` }}
                                title={`Meta: ${target}`}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600 mt-1">
                              {month.month_name.substring(0, 3)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Comparativo de Anos */}
          {availableYears.length >= 2 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Comparativo entre Anos</h3>
                <div className="flex items-center space-x-2">
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    onChange={(e) => {
                      const year1 = parseInt(e.target.value)
                      if (comparisonYears) {
                        loadYearComparison(year1, comparisonYears[1])
                      }
                    }}
                    value={comparisonYears?.[0] || ''}
                  >
                    <option value="">Ano 1</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <span className="text-gray-600">vs</span>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    onChange={(e) => {
                      const year2 = parseInt(e.target.value)
                      if (comparisonYears) {
                        loadYearComparison(comparisonYears[0], year2)
                      }
                    }}
                    value={comparisonYears?.[1] || ''}
                  >
                    <option value="">Ano 2</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (availableYears.length >= 2) {
                        loadYearComparison(availableYears[1], availableYears[0])
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Comparar
                  </button>
                </div>
              </div>

              {yearComparison.length > 0 && comparisonYears && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Mês
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Cadastros {comparisonYears[0]}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Cadastros {comparisonYears[1]}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Variação
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Matrículas {comparisonYears[0]}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Matrículas {comparisonYears[1]}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Variação
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {yearComparison.map((row) => (
                        <tr key={row.month} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {row.month_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.year1_registrations}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.year2_registrations}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`flex items-center ${
                              row.registrations_variation >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {row.registrations_variation >= 0 ? (
                                <ArrowUp className="h-4 w-4 mr-1" />
                              ) : (
                                <ArrowDown className="h-4 w-4 mr-1" />
                              )}
                              {Math.abs(row.registrations_variation).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.year1_enrollments}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.year2_enrollments}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`flex items-center ${
                              row.enrollments_variation >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {row.enrollments_variation >= 0 ? (
                                <ArrowUp className="h-4 w-4 mr-1" />
                              ) : (
                                <ArrowDown className="h-4 w-4 mr-1" />
                              )}
                              {Math.abs(row.enrollments_variation).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tabela Histórica Completa */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Histórico Completo - {selectedYear}</h3>
              <button
                className="text-gray-600 hover:text-gray-900 flex items-center text-sm"
                onClick={() => {
                  // Exportar dados como CSV
                  const csv = [
                    ['Mês', 'Cadastros', 'Meta Cadastros', 'Agendamentos', 'Meta Agendamentos', 'Visitas', 'Meta Visitas', 'Matrículas', 'Meta Matrículas'],
                    ...funnelData.map(f => [
                      f.month_name,
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
                  
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `funil-${selectedYear}.csv`
                  a.click()
                }}
              >
                <Download className="h-4 w-4 mr-1" />
                Exportar CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Mês
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cadastros
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Agendamentos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Visitas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Matrículas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Taxa Final
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {funnelData.map((period) => {
                    const finalRate = period.registrations > 0 ? (period.enrollments / period.registrations) * 100 : 0
                    
                    return (
                      <tr key={period.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {period.month_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex flex-col">
                            <span className="font-medium">{period.registrations}</span>
                            <span className="text-xs text-gray-500">Meta: {period.registrations_target}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex flex-col">
                            <span className="font-medium">{period.schedules}</span>
                            <span className="text-xs text-gray-500">Meta: {period.schedules_target}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex flex-col">
                            <span className="font-medium">{period.visits}</span>
                            <span className="text-xs text-gray-500">Meta: {period.visits_target}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex flex-col">
                            <span className="font-medium">{period.enrollments}</span>
                            <span className="text-xs text-gray-500">Meta: {period.enrollments_target}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {finalRate.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEdit(period)}
                            className="text-blue-600 hover:text-blue-900"
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum dado configurado para {selectedYear}</h3>
            <p className="text-gray-600 mb-4">
              Configure seus dados mensais e metas anuais para começar a analisar o funil
            </p>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => setShowAnnualGoalsModal(true)}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Definir Metas Anuais
              </button>
              <button
                onClick={handleNew}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
        availableYears={availableYears}
      />

      <AnnualGoalsModal
        isOpen={showAnnualGoalsModal}
        onClose={() => setShowAnnualGoalsModal(false)}
        onSave={handleSaveAnnualGoals}
        currentYear={selectedYear}
        existingGoals={annualTotals}
      />
    </div>
  )
}
