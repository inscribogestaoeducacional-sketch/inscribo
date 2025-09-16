import React, { useState, useEffect } from 'react'
import { GraduationCap, Plus, Search, Filter, Calendar, DollarSign, User, X } from 'lucide-react'
import { DatabaseService, Enrollment } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface NewEnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Enrollment>) => void
  editingEnrollment?: Enrollment | null
}

function NewEnrollmentModal({ isOpen, onClose, onSave, editingEnrollment }: NewEnrollmentModalProps) {
  const [formData, setFormData] = useState({
    student_name: '',
    course_grade: '',
    enrollment_value: 0,
    discount_percentage: 0,
    payment_method: '',
    enrollment_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (editingEnrollment) {
      setFormData({
        student_name: editingEnrollment.student_name || '',
        course_grade: editingEnrollment.course_grade || '',
        enrollment_value: editingEnrollment.enrollment_value || 0,
        discount_percentage: editingEnrollment.discount_percentage || 0,
        payment_method: editingEnrollment.payment_method || '',
        enrollment_date: editingEnrollment.enrollment_date ? editingEnrollment.enrollment_date.split('T')[0] : ''
      })
    } else {
      setFormData({
        student_name: '',
        course_grade: '',
        enrollment_value: 0,
        discount_percentage: 0,
        payment_method: '',
        enrollment_date: new Date().toISOString().split('T')[0]
      })
    }
  }, [editingEnrollment, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const finalValue = formData.enrollment_value * (1 - formData.discount_percentage / 100)
    onSave({
      ...formData,
      final_value: finalValue
    })
    onClose()
  }

  if (!isOpen) return null

  const finalValue = formData.enrollment_value * (1 - formData.discount_percentage / 100)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{editingEnrollment ? 'Editar Matrícula' : 'Nova Matrícula'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Aluno *
            </label>
            <input
              type="text"
              required
              value={formData.student_name}
              onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nome completo do aluno"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Série/Curso *
            </label>
            <select
              required
              value={formData.course_grade}
              onChange={(e) => setFormData({ ...formData, course_grade: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecionar série/curso...</option>
              <option value="Infantil">Educação Infantil</option>
              <option value="1º Ano">1º Ano</option>
              <option value="2º Ano">2º Ano</option>
              <option value="3º Ano">3º Ano</option>
              <option value="4º Ano">4º Ano</option>
              <option value="5º Ano">5º Ano</option>
              <option value="6º Ano">6º Ano</option>
              <option value="7º Ano">7º Ano</option>
              <option value="8º Ano">8º Ano</option>
              <option value="9º Ano">9º Ano</option>
              <option value="1º Médio">1º Ano Médio</option>
              <option value="2º Médio">2º Ano Médio</option>
              <option value="3º Médio">3º Ano Médio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor da Matrícula (R$) *
            </label>
            <input
              type="number"
              required
              step="0.01"
              min="0"
              value={formData.enrollment_value}
              onChange={(e) => setFormData({ ...formData, enrollment_value: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0,00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desconto (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={formData.discount_percentage}
              onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
            />
          </div>

          {formData.discount_percentage > 0 && (
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Valor Final:</strong> R$ {finalValue.toFixed(2).replace('.', ',')}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Forma de Pagamento
            </label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecionar forma...</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="PIX">PIX</option>
              <option value="Boleto">Boleto</option>
              <option value="Transferência">Transferência</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data da Matrícula *
            </label>
            <input
              type="date"
              required
              value={formData.enrollment_date}
              onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })}
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
              {editingEnrollment ? 'Atualizar' : 'Matricular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EnrollmentManager() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Mock data for demonstration
  const mockEnrollments: Enrollment[] = [
    {
      id: '1',
      student_name: 'Ana Silva Santos',
      course_grade: '1º Médio',
      enrollment_value: 2500,
      discount_percentage: 10,
      final_value: 2250,
      payment_method: 'PIX',
      enrollment_date: '2024-01-15T00:00:00Z',
      status: 'active',
      institution_id: user?.institution_id || '',
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      student_name: 'Carlos Eduardo Lima',
      course_grade: '6º Ano',
      enrollment_value: 1800,
      discount_percentage: 0,
      final_value: 1800,
      payment_method: 'Cartão de Crédito',
      enrollment_date: '2024-01-12T00:00:00Z',
      status: 'active',
      institution_id: user?.institution_id || '',
      created_at: new Date().toISOString()
    },
    {
      id: '3',
      student_name: 'Maria Fernanda Costa',
      course_grade: '3º Ano',
      enrollment_value: 1500,
      discount_percentage: 15,
      final_value: 1275,
      payment_method: 'Boleto',
      enrollment_date: '2024-01-10T00:00:00Z',
      status: 'active',
      institution_id: user?.institution_id || '',
      created_at: new Date().toISOString()
    }
  ]

  useEffect(() => {
    loadEnrollments()
  }, [user])

  const loadEnrollments = async () => {
    try {
      setLoading(true)
      // Use mock data for now
      setEnrollments(mockEnrollments)
    } catch (error) {
      console.error('Error loading enrollments:', error)
      setEnrollments(mockEnrollments)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<Enrollment>) => {
    try {
      if (editingEnrollment) {
        // Update existing
        const updated = enrollments.map(enrollment => 
          enrollment.id === editingEnrollment.id ? { ...enrollment, ...data } : enrollment
        )
        setEnrollments(updated)
      } else {
        // Add new
        const newEnrollment: Enrollment = {
          id: Date.now().toString(),
          ...data as Enrollment,
          status: 'active',
          institution_id: user?.institution_id || '',
          created_at: new Date().toISOString()
        }
        setEnrollments([newEnrollment, ...enrollments])
      }
      setEditingEnrollment(null)
    } catch (error) {
      console.error('Error saving enrollment:', error)
    }
  }

  const handleEdit = (enrollment: Enrollment) => {
    setEditingEnrollment(enrollment)
    setShowModal(true)
  }

  const handleNew = () => {
    setEditingEnrollment(null)
    setShowModal(true)
  }

  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesSearch = enrollment.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         enrollment.course_grade.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || enrollment.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalRevenue = enrollments.reduce((sum, e) => sum + (e.final_value || 0), 0)
  const averageTicket = enrollments.length > 0 ? totalRevenue / enrollments.length : 0

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
          <h1 className="text-2xl font-bold text-gray-900">Matrículas</h1>
          <p className="text-gray-600">Gerenciamento de matrículas e alunos</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Matrícula
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <GraduationCap className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total de Matrículas</p>
              <p className="text-2xl font-bold text-gray-900">{enrollments.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Receita Total</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {totalRevenue.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <User className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ticket Médio</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {averageTicket.toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por nome ou série..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="suspended">Suspenso</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Enrollments Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aluno
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Série/Curso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Desconto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Final
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pagamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
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
              {filteredEnrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {enrollment.student_name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{enrollment.student_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {enrollment.course_grade}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    R$ {enrollment.enrollment_value?.toLocaleString('pt-BR') || '0'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {enrollment.discount_percentage}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    R$ {enrollment.final_value?.toLocaleString('pt-BR') || '0'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {enrollment.payment_method || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(enrollment.enrollment_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      enrollment.status === 'active' ? 'bg-green-100 text-green-800' :
                      enrollment.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {enrollment.status === 'active' ? 'Ativo' :
                       enrollment.status === 'suspended' ? 'Suspenso' : 'Cancelado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(enrollment)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <NewEnrollmentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingEnrollment(null)
        }}
        onSave={handleSave}
        editingEnrollment={editingEnrollment}
      />
    </div>
  )
}