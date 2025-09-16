import React, { useState, useEffect } from 'react'
import { Plus, User, Calendar, DollarSign, Edit, GraduationCap } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Enrollment, Lead } from '../../lib/supabase'

export default function EnrollmentManager() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null)
  const [formData, setFormData] = useState({
    lead_id: '',
    student_name: '',
    course_grade: '',
    enrollment_value: '',
    enrollment_date: new Date().toISOString().slice(0, 10)
  })

  useEffect(() => {
    if (user?.institution_id) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      const [enrollmentsData, leadsData] = await Promise.all([
        DatabaseService.getEnrollments(user!.institution_id!),
        DatabaseService.getLeads(user!.institution_id!)
      ])
      setEnrollments(enrollmentsData)
      setLeads(leadsData.filter(lead => lead.status !== 'enrolled'))
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const enrollmentData = {
        ...formData,
        enrollment_value: formData.enrollment_value ? parseFloat(formData.enrollment_value) : null,
        institution_id: user!.institution_id!,
        lead_id: formData.lead_id || null
      }

      if (editingEnrollment) {
        await DatabaseService.updateEnrollment(editingEnrollment.id, enrollmentData)
      } else {
        await DatabaseService.createEnrollment(enrollmentData)
        
        // Update lead status to enrolled if lead is selected
        if (formData.lead_id) {
          await DatabaseService.updateLead(formData.lead_id, { status: 'enrolled' })
        }
      }

      await loadData()
      setShowForm(false)
      setEditingEnrollment(null)
      setFormData({
        lead_id: '',
        student_name: '',
        course_grade: '',
        enrollment_value: '',
        enrollment_date: new Date().toISOString().slice(0, 10)
      })
    } catch (error) {
      console.error('Error saving enrollment:', error)
    }
  }

  const handleEdit = (enrollment: Enrollment) => {
    setEditingEnrollment(enrollment)
    setFormData({
      lead_id: enrollment.lead_id || '',
      student_name: enrollment.student_name,
      course_grade: enrollment.course_grade,
      enrollment_value: enrollment.enrollment_value?.toString() || '',
      enrollment_date: enrollment.enrollment_date?.slice(0, 10) || new Date().toISOString().slice(0, 10)
    })
    setShowForm(true)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const totalEnrollments = enrollments.length
  const totalValue = enrollments.reduce((sum, enrollment) => sum + (enrollment.enrollment_value || 0), 0)
  const averageValue = totalEnrollments > 0 ? totalValue / totalEnrollments : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Gestão de Matrículas</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Matrícula
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Matrículas</p>
              <p className="text-2xl font-bold text-gray-900">{totalEnrollments}</p>
            </div>
            <GraduationCap className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Valor Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Valor Médio</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(averageValue)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Enrollments List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Matrículas Recentes</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
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
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {enrollment.student_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{enrollment.course_grade}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-green-600">
                      {enrollment.enrollment_value ? formatCurrency(enrollment.enrollment_value) : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {enrollment.enrollment_date ? formatDate(enrollment.enrollment_date) : '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(enrollment)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {enrollments.length === 0 && (
            <div className="text-center py-8">
              <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma matrícula encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingEnrollment ? 'Editar Matrícula' : 'Nova Matrícula'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead (opcional)
                </label>
                <select
                  value={formData.lead_id}
                  onChange={(e) => {
                    const selectedLead = leads.find(lead => lead.id === e.target.value)
                    setFormData({ 
                      ...formData, 
                      lead_id: e.target.value,
                      student_name: selectedLead ? selectedLead.student_name : formData.student_name
                    })
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Matrícula avulsa</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.student_name} - {lead.responsible_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Aluno *
                </label>
                <input
                  type="text"
                  required
                  value={formData.student_name}
                  onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Série/Curso *
                </label>
                <input
                  type="text"
                  required
                  value={formData.course_grade}
                  onChange={(e) => setFormData({ ...formData, course_grade: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor da Matrícula
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.enrollment_value}
                  onChange={(e) => setFormData({ ...formData, enrollment_value: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingEnrollment(null)
                    setFormData({
                      lead_id: '',
                      student_name: '',
                      course_grade: '',
                      enrollment_value: '',
                      enrollment_date: new Date().toISOString().slice(0, 10)
                    })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingEnrollment ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}