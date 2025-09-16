import React, { useState, useEffect } from 'react'
import { RefreshCw, Plus, TrendingUp, TrendingDown, Users, Target, Edit, X } from 'lucide-react'
import { DatabaseService, ReEnrollment } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface NewReEnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<ReEnrollment>) => void
  editingData?: ReEnrollment | null
}

function NewReEnrollmentModal({ isOpen, onClose, onSave, editingData }: NewReEnrollmentModalProps) {
  const [formData, setFormData] = useState({
    period: '',
    total_base: 0,
    re_enrolled: 0,
    defaulters: 0,
    transferred: 0,
    target_percentage: 85
  })

  useEffect(() => {
    if (editingData) {
      setFormData({
        period: editingData.period,
        total_base: editingData.total_base,
        re_enrolled: editingData.re_enrolled,
        defaulters: editingData.defaulters,
        transferred: editingData.transferred,
        target_percentage: editingData.target_percentage
      })
    } else {
      setFormData({
        period: '',
        total_base: 0,
        re_enrolled: 0,
        defaulters: 0,
        transferred: 0,
        target_percentage: 85
      })
    }
  }, [editingData, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{editingData ? 'Editar Rematrícula' : 'Nova Rematrícula'}</h2>
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
              placeholder="Ex: 2024.1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base Total *
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
              Inadimplentes
            </label>
            <input
              type="number"
              min="0"
              value={formData.defaulters}
              onChange={(e) => setFormData({ ...formData, defaulters: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transferidos
            </label>
            <input
              type="number"
              min="0"
              value={formData.transferred}
              onChange={(e) => setFormData({ ...formData, transferred: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={formData.target_percentage}
              onChange={(e) => setFormData({ ...formData, target_percentage: parseFloat(e.target.value) || 85 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              {editingData ? 'Atualizar' : 'Salvar'}
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
  const [showModal, setShowModal] = useState(false)
  const [editingData, setEditingData] = useState<ReEnrollment | null>(null)

  // Mock data for demonstration
  const mockData: ReEnrollment[] = [
    {
      id: '1',
      period: '2024.1',
      total_base: 1350,
      re_enrolled: 1248,
      defaulters: 67,
      transferred: 35,
      target_percentage: 85,
      institution_id: user?.institution_id || '',
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      period: '2023.2',
      total_base: 1280,
      re_enrolled: 1156,
      defaulters: 89,
      transferred: 35,
      target_percentage: 85,
      institution_id: user?.institution_id || '',
      created_at: new Date().toISOString()
    }
  ]

  useEffect(() => {
    loadReEnrollments()
  }, [user])

  const loadReEnrollments = async () => {
    try {
      setLoading(true)
      // Use mock data for now
      setReEnrollments(mockData)
    } catch (error) {
      console.error('Error loading re-enrollments:', error)
      setReEnrollments(mockData)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<ReEnrollment>) => {
    try {
      if (editingData) {
        // Update existing
        const updated = reEnrollments.map(item => 
          item.id === editingData.id ? { ...item, ...data } : item
        )
        setReEnrollments(updated)
      } else {
        // Add new
        const newItem: ReEnrollment = {
          id: Date.now().toString(),
          ...data as ReEnrollment,
          institution_id: user?.institution_id || '',
          created_at: new Date().toISOString()
        }
        setReEnrollments([newItem, ...reEnrollments])
      }
      setEditingData(null)
    } catch (error) {
      console.error('Error saving re-enrollment:', error)
    }
  }

  const handleEdit = (item: ReEnrollment) => {
    setEditingData(item)
    setShowModal(true)
  }

  const handleNew = () => {
    setEditingData(null)
    setShowModal(true)
  }

  const calculatePercentage = (reEnrolled: number, totalBase: number) => {
    return totalBase > 0 ? (reEnrolled / totalBase * 100) : 0
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const currentPeriod = reEnrollments[0]
  const currentPercentage = currentPeriod ? calculatePercentage(currentPeriod.re_enrolled, currentPeriod.total_base) : 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rematrículas</h1>
          <p className="text-gray-600">Controle de rematrículas por período</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Período
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Base Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {currentPeriod?.total_base.toLocaleString() || '0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <RefreshCw className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Rematriculados</p>
              <p className="text-2xl font-bold text-gray-900">
                {currentPeriod?.re_enrolled.toLocaleString() || '0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Taxa Atual</p>
              <p className="text-2xl font-bold text-gray-900">
                {currentPercentage.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Re-enrollment Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Histórico de Rematrículas</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Período
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rematriculados
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inadimplentes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transferidos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taxa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Meta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reEnrollments.map((item) => {
                const percentage = calculatePercentage(item.re_enrolled, item.total_base)
                const isAboveTarget = percentage >= item.target_percentage
                
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.period}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.total_base.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.re_enrolled.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.defaulters.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.transferred.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {percentage.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.target_percentage}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {isAboveTarget ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                            <span className="text-sm text-green-700 font-medium">Meta atingida</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                            <span className="text-sm text-red-700 font-medium">Abaixo da meta</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:text-blue-900"
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

      {/* Modal */}
      <NewReEnrollmentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingData(null)
        }}
        onSave={handleSave}
        editingData={editingData}
      />
    </div>
  )
}