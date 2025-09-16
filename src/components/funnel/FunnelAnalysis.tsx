import React, { useState, useEffect } from 'react'
import { Target, TrendingUp, TrendingDown, Users, Calendar, Eye, GraduationCap, BarChart3, Plus, X } from 'lucide-react'
import { DatabaseService, FunnelMetrics } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

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
}

function NewFunnelModal({ isOpen, onClose, onSave, editingFunnel }: NewFunnelModalProps) {
  const [formData, setFormData] = useState({
    period: '',
    registrations: 0,
    registrations_target: 0,
    schedules: 0,
    schedules_target: 0,
    visits: 0,
    visits_target: 0,
    enrollments: 0,
    enrollments_target: 0
  })

  useEffect(() => {
    if (editingFunnel) {
      setFormData({
        period: editingFunnel.period,
        registrations: editingFunnel.registrations,
        registrations_target: editingFunnel.registrations_target,
        schedules: editingFunnel.schedules,
        schedules_target: editingFunnel.schedules_target,
        visits: editingFunnel.visits,
        visits_target: editingFunnel.visits_target,
        enrollments: editingFunnel.enrollments,
        enrollments_target: editingFunnel.enrollments_target
      })
    } else {
      setFormData({
        period: '',
        registrations: 0,
        registrations_target: 0,
        schedules: 0,
        schedules_target: 0,
        visits: 0,
        visits_target: 0,
        enrollments: 0,
        enrollments_target: 0
      })
    }
  }, [editingFunnel, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{editingFunnel ? 'Editar Funil' : 'Novo Período'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Período *
            </label>
            <input
              type="text"
              required
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Janeiro 2024, 2024/1"
            />
          </div>

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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              {editingFunnel ? 'Atualizar' : 'Salvar'} Funil
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function FunnelAnalysis() {
  const { user } = useAuth()
  const [funnelData, setFunnelData] = useState<FunnelMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewFunnelModal, setShowNewFunnelModal] = useState(false)
  const [editingFunnel, setEditingFunnel] = useState<FunnelMetrics | null>(null)

  useEffect(() => {
    if (user?.institution_id) {
      loadFunnelData()
    }
  }, [user])

  const loadFunnelData = async () => {
    try {
      setLoading(true)
      const data = await DatabaseService.getFunnelMetrics(user!.institution_id)
      setFunnelData(data)
    } catch (error) {
      console.error('Error loading funnel data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<FunnelMetrics>) => {
    try {
      const funnelData = {
        ...data,
        institution_id: user!.institution_id
      }

      if (editingFunnel) {
        await DatabaseService.updateFunnelMetrics(editingFunnel.id, funnelData)
      } else {
        await DatabaseService.createFunnelMetrics(funnelData)
      }

      await loadFunnelData()
      setEditingFunnel(null)
    } catch (error) {
      console.error('Error saving funnel data:', error)
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

  // Get current period data (most recent)
  const currentPeriod = funnelData[0]
  
  const FUNNEL_STAGES: FunnelStage[] = currentPeriod ? [
    {
      name: 'Cadastros',
      actual: currentPeriod.registrations,
      target: currentPeriod.registrations_target,
      conversion: 100,
      status: currentPeriod.registrations >= currentPeriod.registrations_target ? 'success' : 'warning',
      icon: <Users className="h-5 w-5" />
    },
    {
      name: 'Agendamentos',
      actual: currentPeriod.schedules,
      target: currentPeriod.schedules_target,
      conversion: currentPeriod.registrations > 0 ? (currentPeriod.schedules / currentPeriod.registrations) * 100 : 0,
      status: currentPeriod.schedules >= currentPeriod.schedules_target ? 'success' : 'warning',
      icon: <Calendar className="h-5 w-5" />
    },
    {
      name: 'Visitas',
      actual: currentPeriod.visits,
      target: currentPeriod.visits_target,
      conversion: currentPeriod.schedules > 0 ? (currentPeriod.visits / currentPeriod.schedules) * 100 : 0,
      status: currentPeriod.visits >= currentPeriod.visits_target ? 'success' : 'warning',
      icon: <Eye className="h-5 w-5" />
    },
    {
      name: 'Matrículas',
      actual: currentPeriod.enrollments,
      target: currentPeriod.enrollments_target,
      conversion: currentPeriod.visits > 0 ? (currentPeriod.enrollments / currentPeriod.visits) * 100 : 0,
      status: currentPeriod.enrollments >= currentPeriod.enrollments_target ? 'success' : 'warning',
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
          <p className="text-gray-600">Análise do funil de vendas e metas</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Período
        </button>
      </div>

      {FUNNEL_STAGES.length > 0 ? (
        <>
          {/* Funnel Overview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Funil Geral - {currentPeriod.period}</h3>
              <button
                onClick={() => handleEdit(currentPeriod)}
                className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
              >
                <Target className="h-4 w-4 mr-1" />
                Editar Metas
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {FUNNEL_STAGES.map((stage, index) => {
                const deviation = ((stage.actual - stage.target) / stage.target * 100)
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
                      <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                        <div className="w-6 h-0.5 bg-gray-300"></div>
                        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1">
                          <div className="w-0 h-0 border-l-4 border-r-0 border-t-2 border-b-2 border-l-gray-400 border-t-transparent border-b-transparent"></div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detailed Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funnel Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Visualização do Funil</h3>
              <div className="space-y-4">
                {FUNNEL_STAGES.map((stage, index) => {
                  const width = (stage.actual / FUNNEL_STAGES[0].actual) * 100
                  
                  return (
                    <div key={stage.name} className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{stage.name}</span>
                        <span className="text-sm text-gray-600">{stage.actual}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-8">
                        <div 
                          className={`h-8 rounded-full flex items-center justify-end pr-2 ${
                            stage.status === 'success' ? 'bg-green-500' :
                            stage.status === 'warning' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${width}%` }}
                        >
                          <span className="text-xs font-medium text-white">
                            {width.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Performance Comparison */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparativo de Performance</h3>
              
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Meta vs Realizado</h4>
                  <div className="space-y-2">
                    {FUNNEL_STAGES.map((stage) => (
                      <div key={stage.name} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{stage.name}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-900">{stage.actual}</span>
                          <span className="text-xs text-gray-500">/</span>
                          <span className="text-sm text-gray-700">{stage.target}</span>
                          {stage.actual >= stage.target ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Taxas de Conversão</h4>
                  <div className="space-y-2">
                    {FUNNEL_STAGES.slice(1).map((stage, index) => (
                      <div key={stage.name} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {FUNNEL_STAGES[index].name} → {stage.name}
                        </span>
                        <span className={`text-sm font-medium ${
                          stage.conversion >= 70 ? 'text-green-600' :
                          stage.conversion >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {stage.conversion.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Comparison */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparativo Histórico</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Período
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
                          {period.period}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {period.registrations} / {period.registrations_target}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {period.schedules} / {period.schedules_target}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {period.visits} / {period.visits_target}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {period.enrollments} / {period.enrollments_target}
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum funil configurado</h3>
            <p className="text-gray-600 mb-4">
              Configure seu primeiro período para começar a analisar o funil de vendas
            </p>
            <button
              onClick={handleNew}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Configurar Primeiro Período
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      <NewFunnelModal
        isOpen={showNewFunnelModal}
        onClose={() => {
          setShowNewFunnelModal(false)
          setEditingFunnel(null)
        }}
        onSave={handleSave}
        editingFunnel={editingFunnel}
      />
    </div>
  )
}