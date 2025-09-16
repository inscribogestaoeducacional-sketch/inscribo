import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, User } from 'lucide-react'

interface Visit {
  id: string
  title: string
  date: string
  time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  assignedTo: string
  studentName: string
}

const SAMPLE_VISITS: Visit[] = [
  {
    id: '1',
    title: 'Visita - Ana Silva',
    date: '2024-01-15',
    time: '09:00',
    status: 'scheduled',
    assignedTo: 'João Oliveira',
    studentName: 'Ana Silva'
  },
  {
    id: '2',
    title: 'Visita - Carlos Santos',
    date: '2024-01-15',
    time: '14:00',
    status: 'completed',
    assignedTo: 'Maria Costa',
    studentName: 'Carlos Santos'
  },
  {
    id: '3',
    title: 'Visita - Paula Lima',
    date: '2024-01-16',
    time: '10:30',
    status: 'scheduled',
    assignedTo: 'João Oliveira',
    studentName: 'Paula Lima'
  }
]

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function VisitCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showNewVisitModal, setShowNewVisitModal] = useState(false)
  const [visits] = useState<Visit[]>(SAMPLE_VISITS)

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
    return visits.filter(visit => visit.date === dateString)
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
          onClick={() => setSelectedDate(new Date(currentYear, currentMonth, date))}
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
                {visit.time} - {visit.studentName}
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
            Hoje
          </h3>
          
          <div className="space-y-3">
            {visits
              .filter(visit => {
                const visitDate = new Date(visit.date)
                return (
                  visitDate.toDateString() === today.toDateString()
                )
              })
              .map(visit => (
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
                      {visit.time}
                    </div>
                    <div className="font-medium text-gray-900">
                      {visit.studentName}
                    </div>
                    <div className="flex items-center text-gray-600">
                      <User className="h-4 w-4 mr-1" />
                      {visit.assignedTo}
                    </div>
                  </div>
                </div>
              ))
            }
            {visits.filter(visit => {
              const visitDate = new Date(visit.date)
              return visitDate.toDateString() === today.toDateString()
            }).length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                Nenhuma visita agendada para hoje
              </p>
            )}
          </div>
        </div>
      </div>

      {/* New Visit Modal */}
      {showNewVisitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Nova Visita</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead/Aluno
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option>Selecionar lead...</option>
                  <option>Ana Silva</option>
                  <option>João Santos</option>
                  <option>Carolina Lima</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horário
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsável
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option>Selecionar usuário...</option>
                  <option>João Oliveira</option>
                  <option>Maria Costa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Observações sobre a visita..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button 
                onClick={() => setShowNewVisitModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Agendar Visita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}