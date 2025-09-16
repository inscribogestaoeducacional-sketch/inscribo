import React, { useState, useEffect } from 'react'
import { RefreshCw, Plus, Edit, Trash2, TrendingUp, TrendingDown, Users, Target, X } from 'lucide-react'
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
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{editingReEnrollment ? 'Editar Rematrícula' : 'Novo Período'}</h2>
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
              placeholder="Ex: 2024/1, Janeiro 2024"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Total de Alunos *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.total_base}
                onChange={(e) => setFormData({ ...formData, total_base: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta de Rematrícula (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.target_percentage}
                onChange={(e) => setFormData({ ...formData, target_percentage: parseFloat(e.target.value) || 85 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rematriculados *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.re_enrolled}
                onChange={(e) => setFormData({ ...formData, re_enrolled: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inadimplentes *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.defaulters}
                onChange={(e) => setFormData({ ...formData, defaulters: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transferidos *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.transferred}
                onChange={(e) => setFormData({ ...formData, transferred: parseInt(e.target.value) || 0 })}
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rematrículas</h1>
          <p className="text-gray-600">Controle e análise de rematrículas</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Período
        </button>
      </div>

      {reEnrollments.length > 0 ? (
        <>
          {/* Current Period Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Taxa Atual</h3>
                <RefreshCw className={`h-5 w-5 ${isAboveTarget ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <div className="text-3xl font-bold mb-2">
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

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Rematriculados</h3>
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {currentPeriod?.re_enrolled || 0}
              </div>
              <div className="text-sm text-gray-600">
                de {currentPeriod?.total_base || 0} alunos
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Pendentes</h3>
                <Target className="h-5 w-5 text-orange-500" />
              </div>
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {currentPeriod ? (currentPeriod.total_base - currentPeriod.re_enrolled - currentPeriod.defaulters - currentPeriod.transferred) : 0}
              </div>
              <div className="text-sm text-gray-600">
                ainda não processados
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalhamento - {currentPeriod?.period}</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{currentPeriod?.re_enrolled || 0}</div>
                <div className="text-sm text-gray-600">Rematriculados</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{currentPeriod?.defaulters || 0}</div>
                <div className="text-sm text-gray-600">Inadimplentes</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{currentPeriod?.transferred || 0}</div>
                <div className="text-sm text-gray-600">Transferidos</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{currentPeriod?.total_base || 0}</div>
                <div className="text-sm text-gray-600">Base Total</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Progresso da Meta</span>
                <span>{currentRate.toFixed(1)}% de {targetRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full ${isAboveTarget ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min((currentRate / targetRate) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Historical Data */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Histórico de Rematrículas</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Período
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Base Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Rematriculados
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Taxa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Meta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reEnrollments.map((period) => {
                    const rate = period.total_base > 0 ? (period.re_enrolled / period.total_base) * 100 : 0
                    const metTarget = rate >= period.target_percentage
                    
                    return (
                      <tr key={period.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {period.period}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {period.total_base}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {period.re_enrolled}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <span className={metTarget ? 'text-green-600' : 'text-red-600'}>
                            {rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {period.target_percentage}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            metTarget 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {metTarget ? 'Meta Atingida' : 'Abaixo da Meta'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEdit(period)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            <Edit className="h-4 w-4" />
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
            <RefreshCw className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum período cadastrado</h3>
            <p className="text-gray-600 mb-4">
              Comece cadastrando o primeiro período de rematrículas
            </p>
            <button
              onClick={handleNew}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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