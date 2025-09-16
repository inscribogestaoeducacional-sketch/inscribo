import React, { useState, useEffect } from 'react'
import { RefreshCw, Plus, TrendingUp, TrendingDown, Users, Target, Edit, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface ReEnrollmentData {
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

interface NewReEnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<ReEnrollmentData>) => void
  editingData?: ReEnrollmentData | null
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

  const currentPercentage = formData.total_base > 0 ? (formData.re_enrolled / formData.total_base) * 100 : 0

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
              placeholder="Ex: 2024/1, Janeiro 2024"
            />
          </div>

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
              placeholder="0"
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
              max={formData.total_base}
              value={formData.re_enrolled}
              onChange={(e) => setFormData({ ...formData, re_enrolled: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
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
              placeholder="0"
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
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta de Rematrícula (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={formData.target_percentage}
              onChange={(e) => setFormData({ ...formData, target_percentage: parseFloat(e.target.value) || 85 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="85"
            />
          </div>

          {formData.total_base > 0 && (
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Taxa Atual:</strong> {currentPercentage.toFixed(1)}%
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {currentPercentage >= formData.target_percentage ? '✅ Meta atingida!' : '⚠️ Abaixo da meta'}
              </p>
            </div>
          )}

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
  const [reEnrollments, setReEnrollments] = useState<ReEnrollmentData[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingData, setEditingData] = useState<ReEnrollmentData | null>(null)

  // Mock data for demonstration
  const mockData: ReEnrollmentData[] = [
    {
      id: '1',
      period: '2024/1',
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
      period: '2023/2',
      total_base: 1280,
      re_enrolled: 1165,
      defaulters: 78,
      transferred: 37,
      target_percentage: 85,
      institution_id: user?.institution_id || '',
      created_at: new Date().toISOString()
    },
    {
      id: '3',
      period: '2023/1',
      total_base: 1220,
      re_enrolled: 1098,
      defaulters: 89,
      transferred: 33,
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

  const handleSave = async (data: Partial<ReEnrollmentData>) => {
    try {
      if (editingData) {
        // Update existing
        const updated = reEnrollments.map(item => 
          item.id === editingData.id ? { ...item, ...data } : item
        )
        setReEnrollments(updated)
      } else {
        // Add new
        const newData: ReEnrollmentData = {
          id: Date.now().toString(),
          ...data as ReEnrollmentData,
          institution_id: user?.institution_id || '',
          created_at: new Date().toISOString()
        }
        setReEnrollments([newData, ...reEnrollments])
      }
      setEditingData(null)
    } catch (error) {
      console.error('Error saving re-enrollment data:', error)
    }
  }

  const handleEdit = (data: ReEnrollmentData) => {
    setEditingData(data)
    setShowModal(true)
  }

  const handleNew = () => {
    setEditingData(null)
    setShowModal(true)
  }

  const totalStudents = reEnrollments.reduce((sum, r) => sum + r.total_base, 0)
  const totalReEnrolled = reEnrollments.reduce((sum, r) => sum + r.re_enrolled, 0)
  const overallRate = totalStudents > 0 ? (totalReEnrolled / totalStudents) * 100 : 0

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rematrículas</h1>
          <p className="text-gray-600">Controle e análise de rematrículas por período</p>
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
              <p className="text-2xl font-bold text-gray-900">{totalStudents.toLocaleString()}</p>
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
              <p className="text-2xl font-bold text-gray-900">{totalReEnrolled.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Taxa Geral</p>
              <p className="text-2xl font-bold text-gray-900">{overallRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Re-enrollments Table */}
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
                const rate = (item.re_enrolled / item.total_base) * 100
                const isAboveTarget = rate >= item.target_percentage
                
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
                      {rate.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.target_percentage}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {isAboveTarget ? (
                          <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                        )}
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          isAboveTarget ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {isAboveTarget ? 'Meta atingida' : 'Abaixo da meta'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        <Edit className="h-4 w-4 mr-1" />
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