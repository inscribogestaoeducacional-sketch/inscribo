import React, { useState, useEffect } from 'react'
import { Calendar, Clock, X, ChevronLeft, ChevronRight, Flame, Droplets, Snowflake } from 'lucide-react'
import { Lead } from '../../lib/supabase'

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
]

interface ScheduleVisitModalProps {
  isOpen: boolean
  onClose: () => void
  lead: Lead
  onSchedule: (data: {
    scheduled_date: string
    scheduled_time: string
    notes: string
  }) => void
}

export default function ScheduleVisitModal({ isOpen, onClose, lead, onSchedule }: ScheduleVisitModalProps) {
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [notes, setNotes] = useState('')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setSelectedDate('')
      setSelectedTime('')
      setNotes('')
      setCurrentMonth(new Date())
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedDate || !selectedTime) {
      alert('Por favor, selecione data e horário!')
      return
    }

    onSchedule({
      scheduled_date: selectedDate,
      scheduled_time: selectedTime,
      notes
    })
  }

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const isDateDisabled = (date: Date | null) => {
    if (!date) return true
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
              <Calendar className="h-6 w-6 sm:h-7 sm:w-7 mr-3 text-blue-600" />
              Agendar Visita
            </h2>
            <p className="text-gray-600 mt-1">Lead: <span className="font-semibold">{lead.student_name}</span></p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Info do Lead */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-5 border-2 border-blue-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Responsável:</span>
                <p className="text-gray-900">{lead.responsible_name}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Telefone:</span>
                <p className="text-gray-900">{lead.phone || 'Não informado'}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Série:</span>
                <p className="text-gray-900">{lead.grade_interest}</p>
              </div>
            </div>
          </div>

          {/* Seleção de Data - Calendário Visual */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden">
            {/* Header do Calendário */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-all"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className="text-lg font-bold">
                  {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  type="button"
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-all"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-4">
              {/* Dias da semana */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid de dias */}
              <div className="grid grid-cols-7 gap-2">
                {getDaysInMonth().map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="aspect-square"></div>
                  }

                  const dateStr = formatDateForInput(date)
                  const isSelected = selectedDate === dateStr
                  const isDisabled = isDateDisabled(date)
                  const isToday = date.toDateString() === new Date().toDateString()

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => !isDisabled && setSelectedDate(dateStr)}
                      disabled={isDisabled}
                      className={`
                        aspect-square rounded-xl font-medium text-sm transition-all
                        ${isDisabled 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : isSelected
                            ? 'bg-blue-600 text-white shadow-lg scale-110 font-bold'
                            : isToday
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-2 border-blue-500'
                              : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:border-2 hover:border-blue-300'
                        }
                      `}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Seleção de Horário */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-600" />
              Selecione o Horário
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {timeSlots.map(time => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setSelectedTime(time)}
                  className={`
                    px-4 py-3 rounded-xl font-semibold text-sm transition-all
                    ${selectedTime === time
                      ? 'bg-blue-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:border-2 hover:border-blue-300'
                    }
                  `}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
              rows={3}
              placeholder="Adicione observações sobre a visita..."
            />
          </div>

          {/* Resumo */}
          {selectedDate && selectedTime && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-2xl p-5">
              <div className="flex items-center mb-3">
                <Calendar className="h-5 w-5 text-green-600 mr-2" />
                <h4 className="font-bold text-gray-900">Resumo do Agendamento</h4>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold text-gray-700">Data:</span>{' '}
                  <span className="text-gray-900">
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-gray-700">Horário:</span>{' '}
                  <span className="text-gray-900">{selectedTime}</span>
                </p>
                <p>
                  <span className="font-semibold text-gray-700">Lead:</span>{' '}
                  <span className="text-gray-900">{lead.student_name}</span>
                </p>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-6 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedDate || !selectedTime}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Calendar className="h-5 w-5 mr-2" />
              Confirmar Agendamento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
