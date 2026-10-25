// Ficha do aluno da Base de alunos: tela cheia no celular, janela no computador.
// Mostra tudo que a lista traz (e mais) e as ações: WhatsApp, marcar/desfazer rematrícula.
import { useEffect, type ReactNode } from 'react'
import { X, MessageCircle, Phone, CheckCircle2, Undo2, Loader2, User, GraduationCap, CalendarDays, Hash, Layers, Info as InfoIcon } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { Z } from '../../lib/layers'
import { cardBtn } from '../mobile/StatStrip'
import { Badge, ORIGIN_COLOR, ORIGIN_LABEL, fmtDate, fmtPhone, stateInfo, waNumber, type Row } from './baseShared'

function Line({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0' }} className="ba-line">
      <span style={{ width: 32, height: 32, borderRadius: 10, background: BRAND.soft, color: BRAND.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 14, color: BRAND.ink, fontWeight: 600, marginTop: 1, lineHeight: 1.4, wordBreak: 'break-word' }}>{children}</div>
      </div>
    </div>
  )
}

export default function StudentSheet({ row, year, canEdit, busy, onClose, onMark }: {
  row: Row; year: number; canEdit: boolean; busy: boolean; onClose: () => void; onMark: (r: Row, on: boolean) => void
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const st = stateInfo(row)
  const hasPhone = !!row.guardian_phone
  const sources = (row.origins ?? []).map(o => o === 'activesoft' ? 'Activesoft' : 'planilha enviada pela escola')
  return (
    <div className="m-sheet" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Ficha de ${row.student_name}`}
      style={{ position: 'fixed', inset: 0, zIndex: Z.modal, background: 'rgba(26,43,74,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: BRAND.bg, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', borderRadius: 22, boxShadow: '0 24px 60px rgba(26,43,74,.35)' }}>
        <style>{'.ba-lines .ba-line + .ba-line{border-top:1px solid #F1F5F9}'}</style>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--aion-grad)', color: '#fff', padding: '16px 16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>Ficha do aluno · rematrícula {year}</div>
            <h2 style={{ margin: '3px 0 8px', fontSize: 19, fontWeight: 800, lineHeight: 1.25, color: '#fff' }}>{row.student_name}</h2>
            {st && <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '4px 11px', borderRadius: 999, background: '#fff', color: st.color }}>{st.label}</span>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="aion-tap"
            style={{ width: 44, height: 44, borderRadius: 14, border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '14px 16px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="ba-lines" style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: '2px 14px' }}>
            <Line icon={Hash} label="Matrícula">{row.registration_code || '–'}</Line>
            <Line icon={GraduationCap} label={`Série em ${year}`}>{row.grade_name || '–'}</Line>
            {row.prev_grade && <Line icon={Layers} label={`Série em ${year - 1}`}>{row.prev_grade}</Line>}
            <Line icon={InfoIcon} label="Origem">
              {row.origin ? <Badge color={ORIGIN_COLOR[row.origin]}>{ORIGIN_LABEL[row.origin]}</Badge> : '–'}
            </Line>
            <Line icon={CalendarDays} label="Matrícula em">
              {row.enrolled_on ? <>{fmtDate(row.enrolled_on)}{row.date_is_estimate && <span style={{ fontWeight: 500, color: BRAND.muted }}> · data estimada (primeira vez que o aluno apareceu no sistema)</span>}</> : '–'}
            </Line>
            {row.cur_status_text && <Line icon={InfoIcon} label="Situação no sistema da escola">{row.cur_status_text}</Line>}
          </div>

          <div className="ba-lines" style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: '2px 14px' }}>
            <Line icon={User} label="Responsável">{row.guardian_name || '–'}</Line>
            <Line icon={Phone} label="Telefone">{hasPhone ? fmtPhone(row.guardian_phone as string) : '–'}</Line>
          </div>

          {(row.declared_note || row.declared_at || sources.length > 0) && (
            <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: '12px 14px', fontSize: 13, color: BRAND.text, lineHeight: 1.55 }}>
              {row.category === 'rematriculado_declarado' && (
                <div><b style={{ color: BRAND.ink }}>Rematrícula marcada pela escola</b>{row.declared_at ? ` em ${fmtDate(row.declared_at.slice(0, 10))}` : ''}
                  {row.declared_note ? <>: {row.declared_note}</> : '.'} A marcação some sozinha quando o sistema da escola trouxer o aluno.</div>
              )}
              {row.category !== 'rematriculado_declarado' && row.declared_note && <div>{row.declared_note}</div>}
              {sources.length > 0 && <div style={{ color: BRAND.muted, marginTop: row.declared_note || row.declared_at ? 6 : 0 }}>Dados vindos de: {sources.join(' e ')}</div>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hasPhone && (
              <a href={`https://wa.me/${waNumber(row.guardian_phone as string)}`} target="_blank" rel="noreferrer" className="aion-tap"
                style={{ ...cardBtn(row.category === 'a_rematricular' ? 'primary' : 'ghost'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none' }}>
                <MessageCircle size={16} /> Chamar no WhatsApp
              </a>
            )}
            {hasPhone && (
              <a href={`tel:+${waNumber(row.guardian_phone as string)}`} className="aion-tap"
                style={{ ...cardBtn('ghost'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none' }}>
                <Phone size={16} /> Ligar
              </a>
            )}
            {row.category === 'a_rematricular' && canEdit && (
              <button type="button" onClick={() => onMark(row, true)} disabled={busy} className="aion-tap" style={cardBtn(hasPhone ? 'ghost' : 'primary', { flexBasis: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 })}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Marcar rematriculado
              </button>
            )}
            {row.category === 'rematriculado_declarado' && canEdit && (
              <button type="button" onClick={() => onMark(row, false)} disabled={busy} className="aion-tap" style={cardBtn('ghost', { flexBasis: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 })}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />} Desfazer marcação
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
