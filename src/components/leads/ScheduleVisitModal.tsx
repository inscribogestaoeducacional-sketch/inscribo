import React, { useState } from 'react'
import { Calendar, Clock, X, Save } from 'lucide-react'
import { Lead } from '../../lib/supabase'

interface ScheduleVisitModalProps {
  isOpen: boolean
  onClose: () => void
  lead: Lead
  onSchedule: (data: { scheduled_date: string; scheduled_time: string; notes: string }) => void
}

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
]

export default function ScheduleVisitModal({ isOpen, onClose, lead, onSchedule }: ScheduleVisitModalProps) {
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!scheduledDate || !scheduledTime) {
      alert('Por favor, selecione data e horário!')
      return
    }

    onSchedule({
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      notes: notes
    })

    // Reset form
    setScheduledDate('')
    setScheduledTime('')
    setNotes('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-2xl mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">📅 Agendar Visita</h2>
            <p className="text-gray-600">Lead: <span className="font-semibold">{lead.student_name}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Informações do Lead */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6 border border-blue-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-semibold text-gray-700">Responsável:</span>
              <p className="text-gray-900">{lead.responsible_name}</p>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Série Interesse:</span>
              <p className="text-gray-900">{lead.grade_interest}</p>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Telefone:</span>
              <p className="text-gray-900">{lead.phone || 'Não informado'}</p>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Origem:</span>
              <p className="text-gray-900">{lead.source}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                Data da Visita *
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                <Clock className="h-4 w-4 mr-2 text-blue-600" />
                Horário *
              </label>
              <select
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="">Selecione o horário</option>
                {timeSlots.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview da data/hora */}
          {scheduledDate && scheduledTime && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <p className="font-semibold text-green-900">Visita Agendada Para:</p>
                  <p className="text-green-700">
                    {new Date(scheduledDate).toLocaleDateString('pt-BR', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })} às {scheduledTime}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              rows={4}
              placeholder="Informações importantes sobre a visita..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium shadow-lg flex items-center"
            >
              <Save className="h-5 w-5 mr-2" />
              Confirmar Agendamento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
