import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, User, MapPin, Phone, Mail, X } from 'lucide-react'
import { DatabaseService, Visit } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface NewVisitModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Visit>) => void
  selectedDate?: Date
}

function NewVisitModal({ isOpen, onClose, onSave, selectedDate }: NewVisitModalProps) {
  const [formData, setFormData] = useState({
    lead_id: '',
    scheduled_date: '',
    time: '',
    notes: '',
    assigned_to: ''
  })

  useEffect(() => {
    if (selectedDate && isOpen) {
      setFormData(prev => ({
        ...prev,
        scheduled_date: selectedDate.toISOString().split('T')[0]
      }))
    }
  }, [selectedDate, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const visitData = {
      ...formData,
      scheduled_date: `${formData.scheduled_date}T${formData.time}:00Z`
    }
    onSave(visitData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Nova Visita</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lead/Aluno *
            </label>
            <select
              required
              value={formData.lead_id}
              onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecionar lead...</option>
              <option value="1">Ana Silva Santos</option>
              <option value="2">Carlos Eduardo Lima</option>
              <option value="3">Beatriz Costa</option>
              <option value="4">Diego Oliveira</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data *
            </label>
            <input
              type="date"
              required
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Horário *
            </label>
            <input
              type="time"
              required
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Responsável *
            </label>
            <select
              required
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecionar usuário...</option>
              <option value="user1">João Oliveira</option>
              <option value="user2">Maria Costa</option>
              <option value="user3">Pedro Santos</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Observações sobre a visita..."
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
              Agendar Visita
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function VisitCalendar() {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showNewVisitModal, setShowNewVisitModal] = useState(false)
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.institution_id) {
      loadVisits()
    }
  }, [user])

  const loadVisits = async () => {
    try {
      setLoading(true)
      const data = await DatabaseService.getVisits(user!.institution_id)
      setVisits(data)
    } catch (error) {
      console.error('Error loading visits:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<Visit>) => {
    try {
      const visitData = {
        ...data,
        institution_id: user!.institution_id
      }
      await DatabaseService.createVisit(visitData)
      await loadVisits()
    } catch (error) {
      console.error('Error saving visit:', error)
    }
  }

  const today = new Date()
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
  const firstDayOfWeek = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(currentMonth - 1)
    } else {
      newDate.setMonth(currentMonth + 1)
    }
    setCurrentDate(newDate)
  }

  const getVisitsForDate = (date: number) => {
    const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
    return visits.filter(visit => visit.scheduled_date.startsWith(dateString))
  }

  const isToday = (date: number) => {
    return (
      today.getDate() === date &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear
    )
  }

  const renderCalendarGrid = () => {
    const days = []
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-32"></div>)
    }

    // Days of the month
    for (let date = 1; date <= daysInMonth; date++) {
      const dayVisits = getVisitsForDate(date)
      const isCurrentDay = isToday(date)

      days.push(
        <div
          key={date}
          className={`h-32 border border-gray-200 p-2 cursor-pointer hover:bg-gray-50 ${
            isCurrentDay ? 'bg-blue-50 border-blue-200' : ''
          }`}
          onClick={() => {
            const clickedDate = new Date(currentYear, currentMonth, date)
            setSelectedDate(clickedDate)
            setShowNewVisitModal(true)
          }}
        >
          <div className={`text-sm font-medium mb-1 ${isCurrentDay ? 'text-blue-600' : 'text-gray-900'}`}>
            {date}
          </div>
          <div className="space-y-1">
            {dayVisits.slice(0, 2).map(visit => (
              <div
                key={visit.id}
                className={`text-xs p-1 rounded truncate ${
                  visit.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : visit.status === 'cancelled'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {new Date(visit.scheduled_date).toLocaleTimeString('pt-BR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })} - {visit.lead_name}
              </div>
            ))}
            {dayVisits.length > 2 && (
              <div className="text-xs text-gray-500">
                +{dayVisits.length - 2} mais
              </div>
            )}
          </div>
        </div>
      )
    }

    return days
  }

  const todayVisits = visits.filter(visit => {
    const visitDate = new Date(visit.scheduled_date)
    return visitDate.toDateString() === today.toDateString()
  })

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendário de Visitas</h1>
          <p className="text-gray-600">Gerencie agendamentos e visitas</p>
        </div>
        <button
          onClick={() => setShowNewVisitModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Visita
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {MONTHS[currentMonth]} {currentYear}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {WEEKDAYS.map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 bg-gray-50">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {renderCalendarGrid()}
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2" />
            Hoje ({todayVisits.length})
          </h3>
          
          <div className="space-y-3">
            {todayVisits.map(visit => (
              <div key={visit.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    visit.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : visit.status === 'cancelled'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {visit.status === 'completed' ? 'Concluída' : 
                     visit.status === 'cancelled' ? 'Cancelada' : 'Agendada'}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center text-gray-600">
                    <Clock className="h-4 w-4 mr-1" />
                    {new Date(visit.scheduled_date).toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                  <div className="font-medium text-gray-900">
                    {visit.lead_name}
                  </div>
                  <div className="flex items-center text-gray-600">
                    <User className="h-4 w-4 mr-1" />
                    {visit.assigned_user}
                  </div>
                  {visit.notes && (
                    <div className="text-xs text-gray-500 mt-2">
                      {visit.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {todayVisits.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                Nenhuma visita agendada para hoje
              </p>
            )}
          </div>
        </div>
      </div>

      {/* New Visit Modal */}
      <NewVisitModal
        isOpen={showNewVisitModal}
        onClose={() => {
          setShowNewVisitModal(false)
          setSelectedDate(null)
        }}
        onSave={handleSave}
        selectedDate={selectedDate}
      />
    </div>
  )
}