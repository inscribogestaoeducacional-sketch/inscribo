// "Relação com a escola": alunos ligados ao telefone do contato (vem da Base de alunos / integração).
// Aparece para toda a equipe, na conversa do WhatsApp e em Contatos.
import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

export type SchoolStudent = { name: string; registration: string | null; grade: string | null; class: string | null; year: number | null; status: string | null }
export type SchoolCard = { relation: string | null; label: string | null; year: number; students: SchoolStudent[] }

const STATUS: Record<string, [string, string, string]> = {
  ativo: ['Ativo', '#047857', '#D1FAE5'], pre_matricula: ['Pré-matrícula', '#7C3AED', '#EDE9FE'], concluido: ['Concluído', '#475569', '#E2E8F0'],
  transferido: ['Transferido', '#B45309', '#FEF3C7'], evadido: ['Saiu', '#B91C1C', '#FEE2E2'], cancelado: ['Cancelado', '#B91C1C', '#FEE2E2'],
}

export function useSchoolCard(institutionId: string | undefined, phone: string | null | undefined) {
  const [card, setCard] = useState<SchoolCard | null>(null)
  useEffect(() => {
    let alive = true
    setCard(null)
    if (!institutionId || !phone || phone.replace(/\D/g, '').length < 10) return
    supabase.rpc('contact_school_card', { p_inst: institutionId, p_phone: phone }).then(({ data, error }) => {
      if (alive) setCard(!error && data && (data as SchoolCard).students?.length ? (data as SchoolCard) : null)
    })
    return () => { alive = false }
  }, [institutionId, phone])
  return card
}

export default function SchoolRelationCard({ institutionId, phone }: { institutionId?: string; phone?: string | null }) {
  const card = useSchoolCard(institutionId, phone)
  if (!card) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14, boxShadow: '0 1px 2px rgba(26,43,74,.04)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: BRAND.softer, color: BRAND.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GraduationCap size={15} /></span>
        <b style={{ flex: 1, fontSize: 13.5, color: BRAND.ink }}>Relação com a escola</b>
      </div>
      {card.label && <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.primaryDark, marginBottom: 8 }}>{card.label}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {card.students.map((s, i) => {
          const st = STATUS[s.status || ''] || [String(s.status || '').replace('_', '-'), '#475569', '#E2E8F0']
          return (
            <div key={i} style={{ borderTop: i ? `1px solid ${BRAND.line}` : 'none', paddingTop: i ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink, minWidth: 0, overflowWrap: 'anywhere' }}>{s.name}</div>
                {s.status && <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: st[1], background: st[2], borderRadius: 999, padding: '2px 9px' }}>{st[0]}</span>}
              </div>
              <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{[s.grade, s.class, s.year ? String(s.year) : null, s.registration ? `matrícula ${s.registration}` : null].filter(Boolean).join(' · ')}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
