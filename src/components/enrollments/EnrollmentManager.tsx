import React, { useState, useEffect } from 'react'
import { Plus, User, Calendar, DollarSign, Edit, GraduationCap, Trash2, Search, Filter, TrendingUp, BarChart3, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Enrollment, Lead } from '../../lib/supabase'

interface NewEnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Enrollment>) => void
  editingEnrollment?: Enrollment | null
  leads: Lead[]
}

function NewEnrollmentModal({ isOpen, onClose, onSave, editingEnrollment, leads }: NewEnrollmentModalProps) {
  const [formData, setFormData] = useState({
    lead_id: '',
    student_name: '',
    course_grade: '',
    enrollment_value: '',
    enrollment_date: new Date().toISOString().slice(0, 10)
  })

  useEffect(() => {
    if (editingEnrollment) {
      setFormData({
        lead_id: editingEnrollment.lead_id || '',
        student_name: editingEnrollment.student_name,
        course_grade: editingEnrollment.course_grade,
        enrollment_value: editingEnrollment.enrollment_value?.toString() || '',
        enrollment_date: editingEnrollment.enrollment_date?.slice(0, 10) || new Date().toISOString().slice(0, 10)
      })
    } else {
      setFormData({
        lead_id: '',
        student_name: '',
        course_grade: '',
        enrollment_value: '',
        enrollment_date: new Date().toISOString().slice(0, 10)
      })
    }
  }, [editingEnrollment, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  if (!isOpen) return null

  const gradeOptions = [
    'Infantil I', 'Infantil II', 'Infantil III', 'Infantil IV', 'Infantil V',
    '1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF',
    '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF',
    '1ª Série EM', '2ª Série EM', '3ª Série EM'
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,43,74,0.35)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', border: '0.5px solid #D1FAE5', boxShadow: '0 20px 60px rgba(0,168,150,0.15)', animation: 'slideUp 0.2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FFE4E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap style={{ width: 16, height: 16, color: '#F43F5E' }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{editingEnrollment ? 'Editar Matrícula' : 'Nova Matrícula'}</h2>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '0.5px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 18 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Lead Relacionado (opcional)
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            >
              <option value="">Matrícula avulsa (sem lead)</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.student_name} - {lead.responsible_name} ({lead.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome do Aluno *
              </label>
              <input
                type="text"
                required
                value={formData.student_name}
                onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                placeholder="Nome completo do aluno"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Série/Curso *
              </label>
              <select
                required
                value={formData.course_grade}
                onChange={(e) => setFormData({ ...formData, course_grade: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              >
                <option value="">Selecione a série</option>
                {gradeOptions.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Valor da Matrícula (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.enrollment_value}
                onChange={(e) => setFormData({ ...formData, enrollment_value: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data da Matrícula *
              </label>
              <input
                type="date"
                required
                value={formData.enrollment_date}
                onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          {/* Preview */}
          {formData.student_name && formData.course_grade && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-200">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <GraduationCap className="h-5 w-5 mr-2 text-purple-600" />
                Resumo da Matrícula
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Aluno:</span>
                  <p className="text-gray-900">{formData.student_name}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Série:</span>
                  <p className="text-gray-900">{formData.course_grade}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Valor:</span>
                  <p className="text-gray-900">
                    {formData.enrollment_value ? `R$ ${parseFloat(formData.enrollment_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado'}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Data:</span>
                  <p className="text-gray-900">
                    {new Date(formData.enrollment_date).toLocaleDateString('pt-BR')}
                  </p>
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
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all font-medium shadow-lg"
            >
              {editingEnrollment ? 'Atualizar' : 'Salvar'} Matrícula
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
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterGrade, setFilterGrade] = useState('')

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

  const handleSubmit = async (data: Partial<Enrollment>) => {
    try {
      const enrollmentData = {
        ...data,
        enrollment_value: data.enrollment_value ? parseFloat(data.enrollment_value as string) : null,
        institution_id: user!.institution_id!,
        lead_id: data.lead_id || null
      }

      if (editingEnrollment) {
        await DatabaseService.updateEnrollment(editingEnrollment.id, enrollmentData)
        
        // Log activity
        await DatabaseService.logActivity({
          user_id: user!.id,
          action: 'Matrícula atualizada',
          entity_type: 'enrollment',
          entity_id: editingEnrollment.id,
          details: {
            student_name: data.student_name,
            course_grade: data.course_grade,
            enrollment_value: data.enrollment_value
          },
          institution_id: user!.institution_id
        })
      } else {
        const newEnrollment = await DatabaseService.createEnrollment(enrollmentData)
        
        // Update lead status to enrolled if lead is selected
        if (data.lead_id) {
          await DatabaseService.updateLead(data.lead_id as string, { status: 'enrolled' })
        }

        // Log activity
        await DatabaseService.logActivity({
          user_id: user!.id,
          action: 'Matrícula criada',
          entity_type: 'enrollment',
          entity_id: newEnrollment.id,
          details: {
            student_name: newEnrollment.student_name,
            course_grade: newEnrollment.course_grade,
            enrollment_value: newEnrollment.enrollment_value,
            lead_connected: !!data.lead_id
          },
          institution_id: user!.institution_id
        })
      }

      await loadData()
      setShowForm(false)
      setEditingEnrollment(null)
    } catch (error) {
      console.error('Error saving enrollment:', error)
      alert('Erro ao salvar matrícula: ' + (error as Error).message)
    }
  }

  const handleEdit = (enrollment: Enrollment) => {
    setEditingEnrollment(enrollment)
    setShowForm(true)
  }

  const handleDelete = async (enrollmentId: string) => {
    const enrollment = enrollments.find(e => e.id === enrollmentId)
    if (!enrollment) return

    if (confirm(`Tem certeza que deseja excluir a matrícula de "${enrollment.student_name}"?`)) {
      try {
        await DatabaseService.deleteEnrollment(enrollmentId)
        
        // Log activity
        await DatabaseService.logActivity({
          user_id: user!.id,
          action: 'Matrícula excluída',
          entity_type: 'enrollment',
          entity_id: enrollmentId,
          details: {
            student_name: enrollment.student_name,
            course_grade: enrollment.course_grade,
            enrollment_value: enrollment.enrollment_value
          },
          institution_id: user!.institution_id
        })

        await loadData()
      } catch (error) {
        console.error('Error deleting enrollment:', error)
        alert('Erro ao excluir matrícula')
      }
    }
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

  const getEnrollmentStats = () => {
    const total = enrollments.length
    const totalValue = enrollments.reduce((sum, enrollment) => sum + (enrollment.enrollment_value || 0), 0)
    const averageValue = total > 0 ? totalValue / total : 0
    
    const thisMonth = new Date().toISOString().slice(0, 7)
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)
    
    const thisMonthEnrollments = enrollments.filter(e => e.created_at.startsWith(thisMonth)).length
    const lastMonthEnrollments = enrollments.filter(e => e.created_at.startsWith(lastMonth)).length
    
    const monthlyGrowth = lastMonthEnrollments > 0 ? ((thisMonthEnrollments - lastMonthEnrollments) / lastMonthEnrollments) * 100 : 0

    return { total, totalValue, averageValue, thisMonthEnrollments, monthlyGrowth }
  }

  const getEnrollmentsByMonth = () => {
    const enrollmentsByMonth: { [key: string]: number } = {}
    
    enrollments.forEach(enrollment => {
      const month = new Date(enrollment.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      enrollmentsByMonth[month] = (enrollmentsByMonth[month] || 0) + 1
    })

    return Object.entries(enrollmentsByMonth)
      .map(([month, count]) => ({ month, count }))
      .slice(-12) // Last 12 months
  }

  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesSearch = searchTerm === '' || 
      enrollment.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.course_grade.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGrade = filterGrade === '' || enrollment.course_grade === filterGrade
    
    return matchesSearch && matchesGrade
  })

  const stats = getEnrollmentStats()
  const monthlyData = getEnrollmentsByMonth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%', background: '#f8f9fb' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <GraduationCap style={{ width: 18, height: 18, color: '#00A896' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Matrículas</h1>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Controle completo de matrículas e alunos</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ background: '#00A896', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,168,150,0.25)', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#007A6E'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#00A896'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <Plus style={{ width: 16, height: 16 }} />
          Nova Matrícula
        </button>
      </div>
      <div className="mb-0">

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total',       value: stats.total,                      sub: `+${stats.monthlyGrowth.toFixed(1)}% este mês`, iconBg: '#EDE9FE', iconColor: '#8B5CF6', Icon: GraduationCap },
            { label: 'Receita',     value: formatCurrency(stats.totalValue),  sub: 'Acumulado',                                    iconBg: '#D1FAE5', iconColor: '#10B981', Icon: DollarSign    },
            { label: 'Ticket Médio',value: formatCurrency(stats.averageValue),sub: 'Por matrícula',                                 iconBg: '#DBEAFE', iconColor: '#3B82F6', Icon: BarChart3     },
            { label: 'Este Mês',    value: stats.thisMonthEnrollments,        sub: 'Novas matrículas',                              iconBg: '#FFE4E6', iconColor: '#F43F5E', Icon: Calendar      },
          ].map(({ label, value, sub, iconBg, iconColor, Icon }) => (
            <div key={label} style={{ background: '#FFFFFF', borderRadius: 16, border: '0.5px solid #E2E8F0', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>{label}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px', lineHeight: 1.1 }}>{value}</p>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{sub}</p>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 18, height: 18, color: iconColor }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por nome do aluno ou série..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            />
          </div>
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
          >
            <option value="">Todas as séries</option>
            {['Infantil I', 'Infantil II', 'Infantil III', 'Infantil IV', 'Infantil V',
              '1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF',
              '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF',
              '1ª Série EM', '2ª Série EM', '3ª Série EM'].map(grade => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Monthly Enrollments Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Evolução Mensal</h3>
            <BarChart3 className="h-6 w-6 text-gray-500" />
          </div>
          <div className="h-80">
            {monthlyData.length > 0 ? (
              <div className="h-full flex items-end justify-between space-x-2">
                {monthlyData.slice(-8).map((item, index) => {
                  const maxCount = Math.max(...monthlyData.map(d => d.count))
                  const height = (item.count / maxCount) * 250
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t-lg transition-all duration-500 hover:from-purple-600 hover:to-purple-500"
                        style={{ height: `${height}px` }}
                        title={`${item.month}: ${item.count} matrículas`}
                      ></div>
                      <div className="mt-3 text-center">
                        <div className="text-sm font-bold text-gray-900">{item.count}</div>
                        <div className="text-xs text-gray-600">{item.month}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-xl">
                <div className="text-center">
                  <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhuma matrícula registrada</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enrollments by Grade */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Matrículas por Série</h3>
            <User className="h-6 w-6 text-gray-500" />
          </div>
          <div className="space-y-3">
            {Object.entries(
              enrollments.reduce((acc: { [key: string]: number }, enrollment) => {
                acc[enrollment.course_grade] = (acc[enrollment.course_grade] || 0) + 1
                return acc
              }, {})
            ).slice(0, 8).map(([grade, count]) => {
              const maxCount = Math.max(...Object.values(
                enrollments.reduce((acc: { [key: string]: number }, enrollment) => {
                  acc[enrollment.course_grade] = (acc[enrollment.course_grade] || 0) + 1
                  return acc
                }, {})
              ))
              const percentage = (count / maxCount) * 100
              
              return (
                <div key={grade} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{grade}</span>
                  <div className="flex items-center space-x-3 flex-1 ml-4">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-900 w-8">{count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Enrollments Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <h2 className="text-2xl font-bold text-gray-900">Lista de Matrículas</h2>
          <p className="text-gray-600 mt-1">Todas as matrículas registradas no sistema</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Aluno
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Série/Curso
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Origem
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEnrollments.map((enrollment) => {
                const relatedLead = leads.find(l => l.id === enrollment.lead_id)
                
                return (
                  <tr key={enrollment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {enrollment.student_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900">{enrollment.student_name}</div>
                          {relatedLead && (
                            <div className="text-xs text-gray-500">Lead: {relatedLead.responsible_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        {enrollment.course_grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-green-600">
                        {enrollment.enrollment_value ? formatCurrency(enrollment.enrollment_value) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {enrollment.enrollment_date ? formatDate(enrollment.enrollment_date) : formatDate(enrollment.created_at)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {relatedLead ? relatedLead.source : 'Matrícula Direta'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(enrollment)}
                          className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar matrícula"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(enrollment.id)}
                          className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir matrícula"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filteredEnrollments.length === 0 && (
            <div className="text-center py-12">
              <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {enrollments.length === 0 ? 'Nenhuma matrícula registrada' : 'Nenhuma matrícula encontrada'}
              </h3>
              <p className="text-gray-500 mb-4">
                {enrollments.length === 0 
                  ? 'Comece registrando a primeira matrícula'
                  : 'Tente ajustar os filtros de busca'
                }
              </p>
              {enrollments.length === 0 && (
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Registrar Primeira Matrícula
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <NewEnrollmentModal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingEnrollment(null)
        }}
        onSave={handleSubmit}
        editingEnrollment={editingEnrollment}
        leads={leads}
      />
    </div>
  )
}