import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowUpRight, Filter } from 'lucide-react'

export interface SatisfactionConv {
  id: string
  created_at: string
  satisfaction_score: number | null
  assigned_user_name: string | null
  remote_jid: string
  contact_name: string | null
  last_message: string | null
}

const SCORE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Ruim', color: '#DC2626', bg: '#FEF2F2' },
  2: { label: 'Regular', color: '#B45309', bg: '#FFFBEB' },
  3: { label: 'Ótimo', color: '#059669', bg: '#F0FDF4' },
}

export default function SatisfactionFullModal({
  conversations, onClose,
}: {
  conversations: SatisfactionConv[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [attendantFilter, setAttendantFilter] = useState('')
  const [scoreFilter, setScoreFilter] = useState<number | ''>('')

  // Todas as avaliações do período — resposta do cliente à pesquisa é a
  // própria nota, sem campo de comentário estruturado separado no schema
  // hoje. "Comentário" abaixo é o texto bruto da resposta (last_message no
  // momento em que a pesquisa foi respondida): pra clique em botão é só o
  // rótulo ("😊 Ótimo"); pra resposta em texto livre é o dígito digitado.
  const rated = useMemo(() =>
    conversations
      .filter(c => typeof c.satisfaction_score === 'number' && c.satisfaction_score >= 1 && c.satisfaction_score <= 3)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  [conversations])

  const attendantNames = useMemo(() =>
    Array.from(new Set(rated.map(c => c.assigned_user_name).filter((n): n is string => !!n))).sort(),
  [rated])

  const filtered = rated.filter(c =>
    (!attendantFilter || c.assigned_user_name === attendantFilter) &&
    (scoreFilter === '' || c.satisfaction_score === scoreFilter)
  )

  const openConversation = (remoteJid: string) => {
    onClose()
    navigate('/whatsapp', { state: { phone: remoteJid } })
  }

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12,
    color: '#374151', background: '#fff', outline: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 760, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Satisfação dos Atendimentos</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{filtered.length} de {rated.length} avaliação(ões) no período</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 6, borderRadius: 8 }}>
            <X size={18} />
          </button>
        </div>

        {/* Filtros */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <Filter size={14} color="#94a3b8" />
          <select value={attendantFilter} onChange={e => setAttendantFilter(e.target.value)} style={selectStyle}>
            <option value="">Todos os atendentes</option>
            {attendantNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value === '' ? '' : Number(e.target.value))} style={selectStyle}>
            <option value="">Todas as notas</option>
            <option value={3}>Ótimo</option>
            <option value={2}>Regular</option>
            <option value={1}>Ruim</option>
          </select>
        </div>

        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 24px 20px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>
              <p style={{ margin: 0, fontSize: 13 }}>Nenhuma avaliação encontrada com esses filtros.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {filtered.map(c => {
                const sc = SCORE_LABELS[c.satisfaction_score as number]
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: sc.bg, color: sc.color, flexShrink: 0 }}>
                      {sc.label}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e2d6b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.contact_name || c.remote_jid}
                        {c.assigned_user_name && <span style={{ fontWeight: 400, color: '#94a3b8' }}> · {c.assigned_user_name}</span>}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.last_message || '—'} · {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button onClick={() => openConversation(c.remote_jid)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0', color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      Abrir <ArrowUpRight size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
