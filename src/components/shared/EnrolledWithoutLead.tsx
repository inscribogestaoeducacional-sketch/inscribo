// Alunos novos matriculados no sistema da escola que ainda não estão ligados a um lead.
// Aparece na Base de alunos (Conferir matrículas) e na Campanha. Para cada aluno: vincular ao lead sugerido (mesmo nome e série),
// criar o lead já matriculado, abrir a conversa do responsável ou marcar "não é lead".
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronUp, Link2, MessageCircle, UserPlus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

type Sug = { lead_id: string; name: string | null; status: string; phone: string | null }
type Row = { student_id: string; student: string; grade: string | null; guardian: string | null; phone: string | null; suggestion: Sug | null; conversation: { id: string; name: string | null; lead_id: string | null } | null }
type Data = { year: number; novos_matriculados: number; sem_lead: number; lista: Row[] }

const STATUS_LABEL: Record<string, string> = { new: 'Novo', contact: 'Em contato', scheduled: 'Visita agendada', visit: 'Visitou', proposal: 'Proposta', enrolled: 'Matriculado', lost: 'Perdido' }

export default function EnrolledWithoutLead({ institutionId, year, onChanged, defaultOpen }: { institutionId?: string; year?: number | null; onChanged?: () => void; defaultOpen?: boolean }) {
  const navigate = useNavigate()
  const [data, setData] = useState<Data | null>(null)
  const [open, setOpen] = useState(!!defaultOpen)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [yr, setYr] = useState<number | null>(year ?? null)

  useEffect(() => {
    if (year) { setYr(year); return }
    if (!institutionId) return
    supabase.from('campaign_cycles').select('target_school_year,year').eq('institution_id', institutionId).in('status', ['active', 'released'])
      .order('created_at', { ascending: false }).limit(1).then(({ data: c }) => {
        const r = (c ?? [])[0] as { target_school_year: number | null; year: number } | undefined
        setYr(r ? (r.target_school_year ?? r.year) : null)
      })
  }, [institutionId, year])

  const load = useCallback(async () => {
    if (!institutionId || !yr) return
    const { data: d, error } = await supabase.rpc('campaign_enrollments_without_lead', { p_inst: institutionId, p_year: yr })
    setData(error ? null : (d as Data))
  }, [institutionId, yr])
  useEffect(() => { load() }, [load])

  if (!data || !Array.isArray(data.lista) || !data.sem_lead) return null

  const act = async (r: Row, action: 'link' | 'create' | 'dismiss', lead?: Sug) => {
    setBusy(r.student_id + action); setMsg(null)
    const { error } = await supabase.rpc('student_lead_action', {
      p_inst: institutionId, p_student: r.student_id, p_action: action, p_lead: lead?.lead_id ?? null,
      p_mark: !!lead && lead.status !== 'enrolled', p_year: yr,
    })
    setBusy(null)
    if (error) { setMsg('Não foi possível salvar: ' + error.message); return }
    await load(); onChanged?.()
  }
  const linkAll = async () => {
    const todo = data.lista.filter(r => r.suggestion && r.suggestion.status === 'enrolled')
    if (!todo.length) return
    setBusy('all'); setMsg(null)
    for (const r of todo) {
      const { error } = await supabase.rpc('student_lead_action', { p_inst: institutionId, p_student: r.student_id, p_action: 'link', p_lead: r.suggestion!.lead_id, p_mark: false, p_year: yr })
      if (error) { setMsg('Parou em ' + r.student + ': ' + error.message); break }
    }
    setBusy(null); await load(); onChanged?.()
  }
  const sugEnrolled = data.lista.filter(r => r.suggestion?.status === 'enrolled').length
  const btn = (primary: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, padding: '8px 12px', borderRadius: 12, fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
    border: primary ? 'none' : `1px solid ${BRAND.line}`, background: primary ? 'var(--aion-grad)' : '#fff', color: primary ? '#fff' : BRAND.ink,
  })

  return (
    <div className="ld-in" style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 18, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AlertTriangle size={17} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#92400E', lineHeight: 1.25 }}>{data.sem_lead} de {data.novos_matriculados} alunos novos matriculados em {data.year} sem lead ligado</span>
          <span style={{ display: 'block', fontSize: 12, color: '#92400E', marginTop: 2 }}>Toque para ligar cada um ao lead, criar o lead ou marcar que não é lead.</span>
        </span>
        {open ? <ChevronUp size={18} color="#92400E" /> : <ChevronDown size={18} color="#92400E" />}
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {msg && <div style={{ fontSize: 12.5, color: '#B91C1C' }}>{msg}</div>}
          {sugEnrolled > 1 && (
            <button type="button" disabled={busy === 'all'} onClick={linkAll} style={btn(true)}><Link2 size={14} /> Vincular todas as {sugEnrolled} sugestões (lead já matriculado)</button>
          )}
          {data.lista.map(r => (
            <div key={r.student_id} style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>{r.student}</div>
                <div style={{ fontSize: 12, color: BRAND.muted }}>{[r.grade, r.guardian, r.phone].filter(Boolean).join(' · ')}</div>
              </div>
              {r.suggestion ? (
                <div style={{ fontSize: 12.5, color: BRAND.ink, background: BRAND.softer, borderRadius: 10, padding: '8px 10px' }}>
                  Lead com nome parecido: <b>{r.suggestion.name}</b> ({STATUS_LABEL[r.suggestion.status] || r.suggestion.status}){r.suggestion.phone ? ` · ${r.suggestion.phone}` : ''}
                </div>
              ) : <div style={{ fontSize: 12.5, color: BRAND.muted }}>Nenhum lead com nome parecido.</div>}
              {r.conversation && (
                <div style={{ fontSize: 12.5, color: BRAND.muted }}>Já existe conversa neste telefone: {r.conversation.name || 'contato'}</div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {r.suggestion && (
                  <button type="button" disabled={!!busy} onClick={() => act(r, 'link', r.suggestion!)} style={btn(true)}>
                    <Link2 size={14} /> {r.suggestion.status === 'enrolled' ? 'Vincular a este lead' : 'Vincular e marcar matriculado'}
                  </button>
                )}
                <button type="button" disabled={!!busy} onClick={() => act(r, 'create')} style={btn(!r.suggestion)}><UserPlus size={14} /> Criar lead</button>
                {r.phone && <button type="button" onClick={() => navigate(`/whatsapp?phone=${r.phone}`)} style={btn(false)}><MessageCircle size={14} /> Conversa</button>}
                <button type="button" disabled={!!busy} onClick={() => act(r, 'dismiss')} style={btn(false)}><X size={14} /> Não é lead</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
