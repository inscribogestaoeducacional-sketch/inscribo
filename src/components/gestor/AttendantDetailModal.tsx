import { useNavigate } from 'react-router-dom'
import { X, GraduationCap, MessageCircle, Clock, Star, Zap, ArrowUpRight, Frown } from 'lucide-react'

export interface AttendantStats {
  user_id: string
  full_name: string
  role: string
  enrollments_count: number
  wa_count: number
  satisf_score: number | null
  avg_response: number | null
  score: number
}

export interface AttendantConv {
  id: string
  created_at: string
  status: string
  assigned_user_id: string | null
  satisfaction_score: number | null
  remote_jid: string
  contact_name: string | null
  last_message: string | null
}

const toSatisfPct = (score: number | null) => score !== null ? Math.round(((score - 1) / 2) * 100) : null
const satisfPctColor = (pct: number | null) => pct !== null ? pct >= 75 ? '#00A896' : pct >= 40 ? '#F59E0B' : '#EF4444' : '#94a3b8'

function fmtResponse(min: number | null) {
  if (min === null) return '—'
  return min < 60 ? `${min}min` : `${Math.floor(min / 60)}h${min % 60}m`
}

export default function AttendantDetailModal({
  attendant, conversations, onClose,
}: {
  attendant: AttendantStats
  conversations: AttendantConv[]
  onClose: () => void
}) {
  const navigate = useNavigate()

  const mine = conversations.filter(c => c.assigned_user_id === attendant.user_id)
  const badConvs = mine
    .filter(c => c.satisfaction_score === 1)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const openConversation = (remoteJid: string) => {
    onClose()
    navigate('/whatsapp', { state: { phone: remoteJid } })
  }

  const initials = (attendant.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const metrics = [
    { label: 'Score', value: attendant.score, icon: <Zap size={16} color="#F59E0B" />, color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Matrículas', value: attendant.enrollments_count, icon: <GraduationCap size={16} color="#7C3AED" />, color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Conversas WA', value: attendant.wa_count, icon: <MessageCircle size={16} color="#25D366" />, color: '#25D366', bg: '#F0FDF4' },
    { label: 'Tempo de resposta', value: fmtResponse(attendant.avg_response), icon: <Clock size={16} color="#EF4444" />, color: '#EF4444', bg: '#FEF2F2' },
    { label: 'Satisfação', value: attendant.satisf_score !== null ? `${toSatisfPct(attendant.satisf_score)}%` : '—', icon: <Star size={16} color={satisfPctColor(toSatisfPct(attendant.satisf_score))} />, color: satisfPctColor(toSatisfPct(attendant.satisf_score)), bg: '#FFFBEB' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#4f46e5', flexShrink: 0 }}>{initials}</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>{attendant.full_name}</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Detalhe no período selecionado</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 6, borderRadius: 8 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 24 }}>
            {metrics.map(m => (
              <div key={m.label} style={{ background: m.bg, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 2, lineHeight: 1.2 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Conversas ruins */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Frown size={15} color="#EF4444" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b' }}>Conversas avaliadas como Ruim</span>
              {badConvs.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: '#FEF2F2', padding: '2px 8px', borderRadius: 999 }}>{badConvs.length}</span>
              )}
            </div>
            {badConvs.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ margin: 0, fontSize: 13 }}>Nenhuma avaliação ruim nesse período — bom sinal.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {badConvs.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e2d6b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.contact_name || c.remote_jid}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.last_message || '—'} · {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <button onClick={() => openConversation(c.remote_jid)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: '#fff', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      Abrir conversa <ArrowUpRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
