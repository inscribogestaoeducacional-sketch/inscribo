// "Relação com a escola": alunos ligados ao telefone do contato (vem da Base de alunos / integração).
// Aparece para toda a equipe, na conversa do WhatsApp e em Contatos.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { GraduationCap, ExternalLink, UserPlus, RefreshCw, X, Hash, Layers, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { Z } from '../../lib/layers'
import { activesoftStudentUrl, activesoftNewStudentUrl } from '../../lib/activesoft'

export type SchoolHistory = { year: number; grade: string | null; class: string | null; status: string | null }
export type SchoolStudent = {
  name: string; registration: string | null; grade: string | null; class: string | null; year: number | null; status: string | null
  student_id?: string; external_id?: string | null; history?: SchoolHistory[]
}
// erp: sistema da escola ligado por integração ('activesoft'); null = sem integração (botões não aparecem).
export type SchoolCard = { relation: string | null; label: string | null; year: number; erp?: string | null; students: SchoolStudent[] }

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
      const c = !error && data ? (data as SchoolCard) : null
      // Sem alunos e sem integração, não há o que mostrar.
      if (alive) setCard(c && (c.students?.length || c.erp) ? c : null)
    })
    return () => { alive = false }
  }, [institutionId, phone])
  return card
}

const btnBase = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, borderRadius: 11, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', border: 'none' } as const
const openNew = (url: string) => window.open(url, '_blank', 'noopener')

// Aluno que já está matriculado neste ano → só abrir; aluno da casa sem matrícula no ano → rematricular.
function studentAction(s: SchoolStudent, year: number) {
  const matriculado = s.year === year && s.status === 'ativo'
  return matriculado ? { label: 'Abrir na Activesoft', Icon: ExternalLink } : { label: 'Rematricular na Activesoft', Icon: RefreshCw }
}

function ActionButton({ s, year, wide }: { s: SchoolStudent; year: number; wide?: boolean }) {
  if (!s.external_id) return null
  const a = studentAction(s, year)
  const primary = a.label.startsWith('Rematricular')
  return (
    <button type="button" onClick={() => openNew(activesoftStudentUrl(s.external_id!))}
      style={{ ...btnBase, width: wide ? '100%' : undefined, background: primary ? 'var(--aion-grad)' : '#fff', color: primary ? '#fff' : BRAND.primary, border: primary ? 'none' : `1.5px solid ${BRAND.primary}` }}>
      <a.Icon size={14} /> {a.label}
    </button>
  )
}

// Ficha leve do aluno: série atual, histórico de séries e o botão da Activesoft.
function StudentQuickSheet({ s, year, onClose }: { s: SchoolStudent; year: number; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const st = STATUS[s.status || ''] || [String(s.status || '').replace('_', '-'), '#475569', '#E2E8F0']
  const hist = s.history ?? []
  const Line = ({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0', borderTop: `1px solid ${BRAND.line}` }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: BRAND.soft, color: BRAND.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 14, color: BRAND.ink, fontWeight: 600, marginTop: 1, lineHeight: 1.4, wordBreak: 'break-word' }}>{children}</div>
      </div>
    </div>
  )
  return createPortal(
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={`Ficha de ${s.name}`}
      style={{ position: 'fixed', inset: 0, zIndex: Z.modal + 20, background: 'rgba(26,43,74,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: BRAND.bg, width: '100%', maxWidth: 480, maxHeight: '92dvh', overflowY: 'auto', borderRadius: 22, boxShadow: '0 24px 60px rgba(26,43,74,.35)' }}>
        <div style={{ background: 'var(--aion-grad)', color: '#fff', padding: '16px 16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>Ficha do aluno</div>
            <h2 style={{ margin: '3px 0 8px', fontSize: 19, fontWeight: 800, lineHeight: 1.25, color: '#fff', overflowWrap: 'anywhere' }}>{s.name}</h2>
            {s.status && <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '4px 11px', borderRadius: 999, background: '#fff', color: st[1] }}>{st[0]}</span>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
            style={{ width: 44, height: 44, borderRadius: 14, border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '10px 16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: '0 14px' }}>
            <div style={{ marginTop: -1 }}>
            <Line icon={Hash} label="Matrícula">{s.registration || '–'}</Line>
            <Line icon={GraduationCap} label={s.year ? `Série em ${s.year}` : 'Série'}>{[s.grade, s.class].filter(Boolean).join(' · ') || '–'}</Line>
            {hist.filter(h => h.year !== s.year).slice(0, 4).map(h => {
              const hs = STATUS[h.status || ''] || [String(h.status || ''), '#475569', '#E2E8F0']
              return <Line key={h.year} icon={Layers} label={`Série em ${h.year}`}>{[h.grade, h.class].filter(Boolean).join(' · ') || '–'}{h.status ? <span style={{ fontWeight: 500, color: BRAND.muted }}> · {hs[0]}</span> : null}</Line>
            })}
            </div>
          </div>
          <ActionButton s={s} year={year} wide />
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function SchoolRelationCard({ institutionId, phone }: { institutionId?: string; phone?: string | null }) {
  const card = useSchoolCard(institutionId, phone)
  const [open, setOpen] = useState<SchoolStudent | null>(null)
  if (!card) return null
  const erp = card.erp === 'activesoft'
  // Contato que não é aluno: só o atalho para matricular (escolas com Activesoft).
  if (!card.students.length) {
    return (
      <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14, boxShadow: '0 1px 2px rgba(26,43,74,.04)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: 9, background: BRAND.softer, color: BRAND.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GraduationCap size={15} /></span>
          <b style={{ flex: 1, fontSize: 13.5, color: BRAND.ink }}>Relação com a escola</b>
        </div>
        <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 10 }}>Nenhum aluno ligado a este telefone.</div>
        <button type="button" onClick={() => openNew(activesoftNewStudentUrl())} style={{ ...btnBase, width: '100%', background: 'var(--aion-grad)', color: '#fff' }}><UserPlus size={14} /> Matricular agora na Activesoft</button>
      </div>
    )
  }
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
            <div key={s.student_id || i} style={{ borderTop: i ? `1px solid ${BRAND.line}` : 'none', paddingTop: i ? 8 : 0 }}>
              <button type="button" onClick={() => setOpen(s)} aria-label={`Abrir a ficha de ${s.name}`}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink, minWidth: 0, overflowWrap: 'anywhere' }}>{s.name}</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {s.status && <span style={{ fontSize: 11, fontWeight: 800, color: st[1], background: st[2], borderRadius: 999, padding: '2px 9px' }}>{st[0]}</span>}
                  <ChevronRight size={15} color={BRAND.muted} />
                </span>
              </button>
              <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{[s.grade, s.class, s.year ? String(s.year) : null, s.registration ? `matrícula ${s.registration}` : null].filter(Boolean).join(' · ')}</div>
              {erp && <div style={{ marginTop: 8 }}><ActionButton s={s} year={card.year} wide /></div>}
            </div>
          )
        })}
      </div>
      {erp && (
        <button type="button" onClick={() => openNew(activesoftNewStudentUrl())} style={{ ...btnBase, width: '100%', marginTop: 10, background: '#fff', color: BRAND.primary, border: `1.5px dashed ${BRAND.primary}` }}><UserPlus size={14} /> Matricular outro aluno</button>
      )}
      {open && <StudentQuickSheet s={open} year={card.year} onClose={() => setOpen(null)} />}
    </div>
  )
}
