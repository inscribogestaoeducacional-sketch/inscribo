import React, { useState, useEffect } from 'react'
import { RefreshCw, Plus, Edit, Trash2, TrendingUp, TrendingDown, Users, Target, X, BarChart3, Calendar, Award } from 'lucide-react'
import { DatabaseService, ReEnrollment } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface NewReEnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<ReEnrollment>) => void
  editingReEnrollment?: ReEnrollment | null
}

function NewReEnrollmentModal({ isOpen, onClose, onSave, editingReEnrollment }: NewReEnrollmentModalProps) {
  const [formData, setFormData] = useState({
    period: '',
    total_base: 0,
    re_enrolled: 0,
    defaulters: 0,
    transferred: 0,
    target_percentage: 85.00
  })

  useEffect(() => {
    if (editingReEnrollment) {
      setFormData({
        period: editingReEnrollment.period,
        total_base: editingReEnrollment.total_base,
        re_enrolled: editingReEnrollment.re_enrolled,
        defaulters: editingReEnrollment.defaulters,
        transferred: editingReEnrollment.transferred,
        target_percentage: editingReEnrollment.target_percentage
      })
    } else {
      setFormData({
        period: '',
        total_base: 0,
        re_enrolled: 0,
        defaulters: 0,
        transferred: 0,
        target_percentage: 85.00
      })
    }
  }, [editingReEnrollment, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{editingReEnrollment ? 'Editar Rematrícula' : 'Novo Período'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Período *
            </label>
            <input
              type="text"
              required
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Ex: 2024/1, Janeiro 2024"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Base Total de Alunos *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.total_base}
                onChange={(e) => setFormData({ ...formData, total_base: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Meta de Rematrícula (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.target_percentage}
                onChange={(e) => setFormData({ ...formData, target_percentage: parseFloat(e.target.value) || 85 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Rematriculados *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.re_enrolled}
                onChange={(e) => setFormData({ ...formData, re_enrolled: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Inadimplentes *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.defaulters}
                onChange={(e) => setFormData({ ...formData, defaulters: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Transferidos *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.transferred}
                onChange={(e) => setFormData({ ...formData, transferred: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Preview */}
          {formData.total_base > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-xl border border-blue-200">
              <h4 className="font-semibold text-gray-900 mb-4">Prévia dos Resultados</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {((formData.re_enrolled / formData.total_base) * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Taxa Atual</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{formData.target_percentage}%</div>
                  <div className="text-sm text-gray-600">Meta</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {formData.total_base - formData.re_enrolled - formData.defaulters - formData.transferred}
                  </div>
                  <div className="text-sm text-gray-600">Pendentes</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    (formData.re_enrolled / formData.total_base) * 100 >= formData.target_percentage 
                      ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(formData.re_enrolled / formData.total_base) * 100 >= formData.target_percentage ? '✅' : '⚠️'}
                  </div>
                  <div className="text-sm text-gray-600">Status</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button 
              type="button"
              onClick={onClose}
              className="px-8 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-xl hover:from-blue-700 hover:to-green-700 transition-all font-medium shadow-lg"
            >
              {editingReEnrollment ? 'Atualizar' : 'Salvar'} Período
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ReEnrollments() {
  const { user } = useAuth()
  const [reEnrollments, setReEnrollments] = useState<ReEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [editingReEnrollment, setEditingReEnrollment] = useState<ReEnrollment | null>(null)

  useEffect(() => {
    if (user?.institution_id) {
      loadReEnrollments()
    }
  }, [user])

  const loadReEnrollments = async () => {
    try {
      setLoading(true)
      const data = await DatabaseService.getReEnrollments(user!.institution_id)
      setReEnrollments(data)
    } catch (error) {
      console.error('Error loading re-enrollments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<ReEnrollment>) => {
    try {
      const reEnrollmentData = {
        ...data,
        institution_id: user!.institution_id
      }

      if (editingReEnrollment) {
        await DatabaseService.updateReEnrollment(editingReEnrollment.id, reEnrollmentData)
      } else {
        await DatabaseService.createReEnrollment(reEnrollmentData)
      }

      await loadReEnrollments()
      setEditingReEnrollment(null)
    } catch (error) {
      console.error('Error saving re-enrollment:', error)
    }
  }

  const handleEdit = (reEnrollment: ReEnrollment) => {
    setEditingReEnrollment(reEnrollment)
    setShowNewModal(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este período?')) {
      try {
        await DatabaseService.deleteReEnrollment(id)
        await loadReEnrollments()
      } catch (error) {
        console.error('Error deleting re-enrollment:', error)
      }
    }
  }

  const handleNew = () => {
    setEditingReEnrollment(null)
    setShowNewModal(true)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Calculate current period stats
  const currentPeriod = reEnrollments[0]
  const currentRate = currentPeriod && currentPeriod.total_base > 0 
    ? (currentPeriod.re_enrolled / currentPeriod.total_base) * 100 
    : 0

  const targetRate = currentPeriod?.target_percentage || 85
  const isAboveTarget = currentRate >= targetRate

  // Calculate year-over-year comparison
  const currentYear = new Date().getFullYear()
  const lastYear = currentYear - 1
  const currentYearData = reEnrollments.filter(r => r.period.includes(currentYear.toString()))
  const lastYearData = reEnrollments.filter(r => r.period.includes(lastYear.toString()))
  
  const currentYearAvg = currentYearData.length > 0 
    ? currentYearData.reduce((sum, r) => sum + (r.re_enrolled / r.total_base * 100), 0) / currentYearData.length 
    : 0
  const lastYearAvg = lastYearData.length > 0 
    ? lastYearData.reduce((sum, r) => sum + (r.re_enrolled / r.total_base * 100), 0) / lastYearData.length 
    : 0
  const yearOverYearChange = lastYearAvg > 0 ? ((currentYearAvg - lastYearAvg) / lastYearAvg) * 100 : 0

  return (
    <div className="p-8 bg-gradient-to-br from-green-50 via-white to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Rematrículas</h1>
          <p className="text-gray-600 text-lg">Controle e análise de rematrículas por período</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-4 rounded-2xl hover:from-green-700 hover:to-blue-700 transition-all flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Período
        </button>
      </div>

      {reEnrollments.length > 0 ? (
        <>
          {/* Current Period Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Taxa Atual</h3>
                <RefreshCw className={`h-8 w-8 ${isAboveTarget ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <div className="text-4xl font-bold mb-2">
                <span className={isAboveTarget ? 'text-green-600' : 'text-red-600'}>
                  {currentRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center">
                {isAboveTarget ? (
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className="text-sm text-gray-600">
                  Meta: {targetRate}%
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Rematriculados</h3>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {currentPeriod?.re_enrolled || 0}
              </div>
              <div className="text-sm text-gray-600">
                de {currentPeriod?.total_base || 0} alunos
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Pendentes</h3>
                <Target className="h-8 w-8 text-orange-500" />
              </div>
              <div className="text-4xl font-bold text-orange-600 mb-2">
                {currentPeriod ? (currentPeriod.total_base - currentPeriod.re_enrolled - currentPeriod.defaulters - currentPeriod.transferred) : 0}
              </div>
              <div className="text-sm text-gray-600">
                ainda não processados
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Comparativo Anual</h3>
                <Award className="h-8 w-8 text-purple-500" />
              </div>
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {yearOverYearChange >= 0 ? '+' : ''}{yearOverYearChange.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">
                vs {lastYear}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Monthly Progress Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Evolução Mensal</h3>
                <BarChart3 className="h-6 w-6 text-gray-500" />
              </div>
              <div className="h-80">
                {reEnrollments.length > 0 ? (
                  <div className="h-full flex items-end justify-between space-x-2">
                    {reEnrollments.slice(-8).map((period, index) => {
                      const rate = period.total_base > 0 ? (period.re_enrolled / period.total_base) * 100 : 0
                      const height = (rate / 100) * 250
                      const isAboveTarget = rate >= period.target_percentage
                      
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center">
                          <div className="relative w-full">
                            {/* Target line */}
                            <div 
                              className="absolute w-full border-2 border-dashed border-orange-300"
                              style={{ bottom: `${(period.target_percentage / 100) * 250}px` }}
                            ></div>
                            {/* Rate bar */}
                            <div 
                              className={`w-full rounded-t-lg transition-all duration-500 ${
                                isAboveTarget ? 'bg-gradient-to-t from-green-500 to-green-400' : 'bg-gradient-to-t from-red-500 to-red-400'
                              }`}
                              style={{ height: `${height}px` }}
                            ></div>
                          </div>
                          <div className="mt-3 text-center">
                            <div className="text-xs font-semibold text-gray-900">{rate.toFixed(1)}%</div>
                            <div className="text-xs text-gray-600">{period.period}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center bg-gray-50 rounded-xl">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhum dado disponível</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                  <span>Acima da Meta</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                  <span>Abaixo da Meta</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-1 border-2 border-dashed border-orange-300 mr-2"></div>
                  <span>Meta</span>
                </div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Detalhamento - {currentPeriod?.period}</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="text-3xl font-bold text-green-600">{currentPeriod?.re_enrolled || 0}</div>
                  <div className="text-sm text-gray-600">Rematriculados</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="text-3xl font-bold text-red-600">{currentPeriod?.defaulters || 0}</div>
                  <div className="text-sm text-gray-600">Inadimplentes</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-600">{currentPeriod?.transferred || 0}</div>
                  <div className="text-sm text-gray-600">Transferidos</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="text-3xl font-bold text-blue-600">{currentPeriod?.total_base || 0}</div>
                  <div className="text-sm text-gray-600">Base Total</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progresso da Meta</span>
                  <span>{currentRate.toFixed(1)}% de {targetRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className={`h-4 rounded-full transition-all duration-500 ${isAboveTarget ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}
                    style={{ width: `${Math.min((currentRate / targetRate) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Year Comparison */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-200">
                <h4 className="font-semibold text-gray-900 mb-2">Comparativo Anual</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">{currentYear}:</span>
                    <p className="font-bold text-purple-600">{currentYearAvg.toFixed(1)}%</p>
                  </div>
                  <div>
                    <span className="text-gray-600">{lastYear}:</span>
                    <p className="font-bold text-gray-600">{lastYearAvg.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Data */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
              <h3 className="text-2xl font-bold text-gray-900">Histórico de Rematrículas</h3>
              <p className="text-gray-600 mt-1">Dados detalhados por período</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Período
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Base Total
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Rematriculados
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Taxa
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Meta
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reEnrollments.map((period) => {
                    const rate = period.total_base > 0 ? (period.re_enrolled / period.total_base) * 100 : 0
                    const metTarget = rate >= period.target_percentage
                    
                    return (
                      <tr key={period.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">
                              {period.period}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-900">{period.total_base}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-blue-600">{period.re_enrolled}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-bold ${metTarget ? 'text-green-600' : 'text-red-600'}`}>
                            {rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{period.target_percentage}%</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${
                            metTarget 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}>
                            {metTarget ? '✅ Meta Atingida' : '⚠️ Abaixo da Meta'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEdit(period)}
                              className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-all"
                              title="Editar período"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(period.id)}
                              className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-all"
                              title="Excluir período"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
          <div className="text-center">
            <RefreshCw className="h-20 w-20 text-gray-400 mx-auto mb-6" />
            <h3 className="text-2xl font-medium text-gray-900 mb-4">Nenhum período cadastrado</h3>
            <p className="text-gray-600 mb-8 text-lg">
              Comece cadastrando o primeiro período de rematrículas para acompanhar a evolução
            </p>
            <button
              onClick={handleNew}
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-4 rounded-2xl hover:from-green-700 hover:to-blue-700 transition-all shadow-lg"
            >
              Cadastrar Primeiro Período
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      <NewReEnrollmentModal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false)
          setEditingReEnrollment(null)
        }}
        onSave={handleSave}
        editingReEnrollment={editingReEnrollment}
      />
    </div>
  )
}