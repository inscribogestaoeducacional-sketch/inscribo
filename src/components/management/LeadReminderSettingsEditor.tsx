// src/components/management/LeadReminderSettingsEditor.tsx
//
// Fase 0A — Configurações → Escola → "Lembrete de lead sem contato". Define
// quantos dias sem interação real (mensagem na conversa vinculada, atividade
// registrada no lead ou nota do contato) o lead leva pra aparecer como "Sem
// contato" no Kanban, no Início do gestor e no do atendente. Gravação só
// admin/gestor (RLS: lead_unit_user_can_manage).
import { useEffect, useState, type CSSProperties } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { NO_CONTACT_DAYS } from '../../lib/leadReminders'

const inputStyle: CSSProperties = { width: 80, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', color: '#1A2B4A', boxSizing: 'border-box' }

export default function LeadReminderSettingsEditor({ institutionId, onToast }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void }) {
  const { user } = useAuth()
  const canManage = user?.role === 'admin' || user?.role === 'manager'
  const [days, setDays] = useState<number>(NO_CONTACT_DAYS)
  const [saved, setSaved] = useState<number>(NO_CONTACT_DAYS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('lead_reminder_settings').select('no_contact_days').eq('institution_id', institutionId).maybeSingle()
      if (cancelled) return
      const v = (data as { no_contact_days?: number } | null)?.no_contact_days ?? NO_CONTACT_DAYS
      setDays(v); setSaved(v)
    })()
    return () => { cancelled = true }
  }, [institutionId])

  const save = async () => {
    const v = Math.round(days)
    if (!(v >= 1 && v <= 60)) { onToast('Use um número de 1 a 60 dias.', false); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('lead_reminder_settings').upsert({
        institution_id: institutionId, no_contact_days: v, updated_by: user?.id ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: 'institution_id' })
      if (error) throw error
      setSaved(v)
      onToast('Lembrete atualizado.')
    } catch (e) {
      onToast('Não foi possível salvar: ' + (e as Error).message, false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24, maxWidth: 560 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Bell size={15} color="#D97706" /> Lembrete de lead sem contato
      </h3>
      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 1.6 }}>
        O lead em aberto aparece como <strong>"Sem contato"</strong> quando passa esse número de dias sem nenhuma interação:
        mensagem enviada pela equipe na conversa de WhatsApp vinculada (as automáticas do robô não contam), atividade registrada no lead (ligação, e-mail, presencial…) ou nota do contato.
        Vale para o Kanban, o Início do gestor e o do atendente.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="number" min={1} max={60} value={days} disabled={!canManage || saving}
          onChange={e => setDays(Number(e.target.value))} style={inputStyle} aria-label="Dias sem contato" />
        <span style={{ fontSize: 13, color: '#475569' }}>dias sem interação</span>
        {canManage && days !== saved && (
          <button onClick={save} disabled={saving}
            style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 10, border: 'none', background: '#05907B', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        )}
      </div>
    </div>
  )
}
