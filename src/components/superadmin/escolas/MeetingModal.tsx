import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { createGoogleMeet, buildEndDatetime } from '../../../lib/googleMeet'
import AttendeesPicker from '../../shared/AttendeesPicker'
import { X, Calendar, Link as LinkIcon } from 'lucide-react'
import { inp, lbl } from './ui'

export default function MeetingModal({
  processId, institutionId, phase, title: defaultTitle,
  attendeeEmail, consultants, onClose, onSaved,
}: {
  processId: string; institutionId: string; phase: string; title: string
  attendeeEmail?: string; consultants: any[]; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: defaultTitle,
    scheduled_at: '',
    duration_min: 60,
    meet_link: '',
    notes: '',
    attendees: [] as string[],
  })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleGenerateMeet = async () => {
    if (!form.scheduled_at) { setErr('Defina a data/hora antes de gerar o link.'); return }
    setGenerating(true); setErr('')
    const start = new Date(form.scheduled_at).toISOString()
    const end = buildEndDatetime(start, form.duration_min || 60)
    const result = await createGoogleMeet({
      title: form.title,
      start_datetime: start,
      end_datetime: end,
      attendees: form.attendees,
    })
    if (result.meet_link) set('meet_link', result.meet_link)
    else setErr(result.error || 'Erro ao criar Meet')
    setGenerating(false)
  }

  const handleSave = async () => {
    if (!form.title || !form.scheduled_at) { setErr('Título e data são obrigatórios.'); return }
    setSaving(true)
    try {
      await supabase.from('onboarding_meetings').insert({
        process_id: processId,
        institution_id: institutionId,
        type: phase,
        title: form.title,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_min: form.duration_min,
        meet_link: form.meet_link || null,
        notes: form.notes || null,
        status: 'scheduled',
        attendees: form.attendees,
      })
      onSaved()
    } catch (e: any) { setErr(e.message || 'Erro ao agendar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Agendar reunião</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {err && <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        <div className="space-y-3">
          <div>
            <label className={lbl}>Título *</label>
            <input className={inp} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Data e hora *</label>
              <input type="datetime-local" className={inp} value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Duração (min)</label>
              <input type="number" className={inp} value={form.duration_min} onChange={e => set('duration_min', Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className={lbl}>Link Google Meet</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className={inp + ' pl-9'} value={form.meet_link} onChange={e => set('meet_link', e.target.value)} placeholder="https://meet.google.com/..." />
              </div>
              <button onClick={handleGenerateMeet} disabled={generating}
                className="px-3 py-2 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg text-xs font-semibold disabled:opacity-60 whitespace-nowrap">
                {generating ? <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" /> : '+ Gerar'}
              </button>
            </div>
          </div>
          <div>
            <label className={lbl}>Participantes</label>
            <AttendeesPicker clientEmail={attendeeEmail || ''} consultants={consultants} value={form.attendees} onChange={v => set('attendees', v)} />
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <textarea rows={2} className={inp + ' resize-none'} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Calendar className="w-4 h-4" />}
            Agendar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
