import React, { useEffect, useState } from 'react'
import { Shield, Loader2, Users, Mail } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface AttendantRow {
  id: string
  full_name: string
  email: string
  can_see_all_conversations: boolean
  can_see_full_history: boolean
}

export default function WhatsAppPermissionsPanel() {
  const { user } = useAuth()
  const [attendants, setAttendants] = useState<AttendantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => { loadAttendants() }, [user?.institution_id])

  const loadAttendants = async () => {
    if (!user?.institution_id) return
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, full_name, email, can_see_all_conversations, can_see_full_history')
        .eq('institution_id', user.institution_id)
        .eq('role', 'user')
        .order('full_name', { ascending: true })

      if (fetchError) throw fetchError
      setAttendants(data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar atendentes')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (attendantId: string, current: boolean) => {
    setTogglingId(attendantId)
    setError('')
    setAttendants(prev => prev.map(a => a.id === attendantId ? { ...a, can_see_all_conversations: !current } : a))
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ can_see_all_conversations: !current })
        .eq('id', attendantId)
      if (updateError) throw updateError
    } catch (e) {
      setAttendants(prev => prev.map(a => a.id === attendantId ? { ...a, can_see_all_conversations: current } : a))
      setError(e instanceof Error ? e.message : 'Erro ao atualizar permissão')
    } finally {
      setTogglingId(null)
    }
  }

  const handleToggleFullHistory = async (attendantId: string, current: boolean) => {
    setTogglingId(attendantId)
    setError('')
    setAttendants(prev => prev.map(a => a.id === attendantId ? { ...a, can_see_full_history: !current } : a))
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ can_see_full_history: !current })
        .eq('id', attendantId)
      if (updateError) throw updateError
    } catch (e) {
      setAttendants(prev => prev.map(a => a.id === attendantId ? { ...a, can_see_full_history: current } : a))
      setError(e instanceof Error ? e.message : 'Erro ao atualizar permissão')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>
          <Shield size={20} color="#00A896" /> Permissões do WhatsApp
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
          Libere a visualização de todas as conversas da instituição para atendentes específicos.
          Por padrão, um atendente só vê as conversas atribuídas a ele e as conversas sem atribuição.
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Loader2 size={28} color="#00A896" className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: '#94A3B8' }}>Carregando atendentes...</p>
          </div>
        ) : attendants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
            <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Nenhum atendente cadastrado</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Atendente', 'Vê todas as conversas', 'Vê histórico completo em transferência'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendants.map((a, i) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #F8FAFC', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#00A896,#0DD3BF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {a.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1A2B4A' }}>{a.full_name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={10} />{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleToggle(a.id, a.can_see_all_conversations)}
                      disabled={togglingId === a.id}
                      style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: 'none',
                        cursor: togglingId === a.id ? 'wait' : 'pointer',
                        background: a.can_see_all_conversations ? '#D1FAE5' : '#F1F5F9',
                        color: a.can_see_all_conversations ? '#16a34a' : '#64748B',
                        display: 'flex', alignItems: 'center', gap: 4, opacity: togglingId === a.id ? 0.6 : 1,
                      }}
                    >
                      {togglingId === a.id ? <Loader2 size={11} className="animate-spin" /> : null}
                      {a.can_see_all_conversations ? 'Liberado' : 'Restrito'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleToggleFullHistory(a.id, a.can_see_full_history)}
                      disabled={togglingId === a.id}
                      style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: 'none',
                        cursor: togglingId === a.id ? 'wait' : 'pointer',
                        background: a.can_see_full_history ? '#D1FAE5' : '#F1F5F9',
                        color: a.can_see_full_history ? '#16a34a' : '#64748B',
                        display: 'flex', alignItems: 'center', gap: 4, opacity: togglingId === a.id ? 0.6 : 1,
                      }}
                    >
                      {togglingId === a.id ? <Loader2 size={11} className="animate-spin" /> : null}
                      {a.can_see_full_history ? 'Liberado' : 'Restrito'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <style>{`.animate-spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
