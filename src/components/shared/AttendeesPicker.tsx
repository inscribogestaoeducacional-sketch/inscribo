// src/components/shared/AttendeesPicker.tsx
import { useEffect, useState } from 'react'
import { X, Plus, ChevronDown, ChevronUp, Users, Lock, Mail } from 'lucide-react'

export interface AttendeesPickerConsultant {
  id: string
  full_name: string
  email: string
}

interface AttendeesPickerProps {
  clientEmail: string
  consultants: AttendeesPickerConsultant[]
  value: string[]
  onChange: (emails: string[]) => void
}

// Sempre coloca clientEmail primeiro e remove duplicatas (case-insensitive),
// preservando a grafia da primeira ocorrência de cada e-mail.
function normalize(clientEmail: string, rest: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  const add = (email: string) => {
    const trimmed = email.trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    result.push(trimmed)
  }
  add(clientEmail)
  rest.forEach(add)
  return result
}

const chipBase = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border'

export default function AttendeesPicker({ clientEmail, consultants, value, onChange }: AttendeesPickerProps) {
  const [showConsultants, setShowConsultants] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [manualError, setManualError] = useState('')

  // Garante clientEmail sempre presente no array final, mesmo se o usuário
  // nunca interagir com o seletor (ex: salvar direto sem tocar em nada).
  useEffect(() => {
    const hasClient = !!clientEmail && value.some(e => e.toLowerCase() === clientEmail.toLowerCase())
    if (clientEmail && !hasClient) {
      onChange(normalize(clientEmail, value))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientEmail, value])

  const consultantEmailSet = new Set(consultants.map(c => c.email.toLowerCase()))
  const selectedConsultantEmails = new Set(
    value.filter(e => consultantEmailSet.has(e.toLowerCase())).map(e => e.toLowerCase())
  )
  const manualEmails = value.filter(e =>
    e.toLowerCase() !== clientEmail.toLowerCase() && !consultantEmailSet.has(e.toLowerCase())
  )

  const toggleConsultant = (email: string) => {
    const isSelected = value.some(e => e.toLowerCase() === email.toLowerCase())
    const rest = isSelected
      ? value.filter(e => e.toLowerCase() !== email.toLowerCase())
      : [...value, email]
    onChange(normalize(clientEmail, rest))
  }

  const removeEmail = (email: string) => {
    onChange(normalize(clientEmail, value.filter(e => e.toLowerCase() !== email.toLowerCase())))
  }

  const addManualEmail = () => {
    const email = manualInput.trim()
    if (!email) return
    if (!email.includes('@')) { setManualError('E-mail inválido'); return }
    setManualError('')
    onChange(normalize(clientEmail, [...value, email]))
    setManualInput('')
  }

  return (
    <div className="space-y-2">
      {/* Chips selecionados */}
      <div className="flex flex-wrap gap-1.5">
        {clientEmail && (
          <span className={`${chipBase} bg-cyan-50 text-cyan-700 border-cyan-200`} title="Cliente — sempre incluído">
            <Lock className="w-3 h-3" />
            {clientEmail}
          </span>
        )}
        {consultants
          .filter(c => selectedConsultantEmails.has(c.email.toLowerCase()))
          .map(c => (
            <span key={c.id} className={`${chipBase} bg-purple-50 text-purple-700 border-purple-200`}>
              {c.full_name}
              <button type="button" onClick={() => removeEmail(c.email)} className="hover:text-purple-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        {manualEmails.map(email => (
          <span key={email} className={`${chipBase} bg-gray-100 text-gray-700 border-gray-200`}>
            <Mail className="w-3 h-3" />
            {email}
            <button type="button" onClick={() => removeEmail(email)} className="hover:text-gray-900">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Consultores */}
      {consultants.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowConsultants(s => !s)}
            className="flex items-center gap-1.5 text-xs font-semibold text-cyan-700 hover:text-cyan-800"
          >
            <Users className="w-3.5 h-3.5" />
            Consultores
            {showConsultants ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showConsultants && (
            <div className="mt-1.5 border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50 max-h-40 overflow-y-auto">
              {consultants.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-xs text-gray-700 px-1.5 py-1 rounded hover:bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedConsultantEmails.has(c.email.toLowerCase())}
                    onChange={() => toggleConsultant(c.email)}
                    className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="font-medium">{c.full_name}</span>
                  <span className="text-gray-400">{c.email}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* E-mail livre */}
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={manualInput}
          onChange={e => { setManualInput(e.target.value); setManualError('') }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualEmail() } }}
          placeholder="Adicionar outro e-mail..."
          className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white"
        />
        <button
          type="button"
          onClick={addManualEmail}
          className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition-colors flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar
        </button>
      </div>
      {manualError && <p className="text-xs text-red-500">{manualError}</p>}
    </div>
  )
}
