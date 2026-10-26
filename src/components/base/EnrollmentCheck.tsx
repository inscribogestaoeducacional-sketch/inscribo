// Aba "Conferir matrículas" da Base de alunos.
// Cruza os leads marcados como matriculados com os alunos do sistema da escola (ERP) e mostra o que não fecha:
// alunos novos sem lead, leads matriculados sem aluno, leads repetidos e leads com mais de um aluno.
// Só lê tabelas comuns (students, guardians...), então vale para qualquer sistema integrado.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Link2, Loader2, MessageCircle, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { erpSystem } from '../../lib/erp'
import EnrolledWithoutLead from '../shared/EnrolledWithoutLead'
import { SectionTitle, baseCard } from './baseShared'

type Cand = { student_id: string; name: string; grade: string | null }
type SemAluno = { lead_id: string; name: string; grade: string | null; phone: string | null; source: string | null; responsible: string | null; candidatos: Cand[] }
type Dup = { lead_id: string; name: string; grade: string | null; phone: string | null; created_at: string }
type Varios = { lead_id: string; name: string; phone: string | null; responsible: string | null; alunos: string[] }
type Check = {
  year: number; leads_matriculados: number; alunos_novos: number; leads_com_aluno: number; leads_sem_aluno: number
  grupos_duplicados: number; leads_varios_alunos: number
  sem_aluno: SemAluno[]; duplicados: Dup[][]; varios_alunos: Varios[]
}

const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, padding: '8px 12px', borderRadius: 12, fontFamily: 'inherit',
  fontWeight: 700, fontSize: 12.5, cursor: 'pointer', border: primary ? 'none' : `1px solid ${BRAND.line}`,
  background: primary ? 'var(--aion-grad)' : '#fff', color: primary ? '#fff' : BRAND.ink,
})

export default function EnrollmentCheck({ institutionId, year, mobile }: { institutionId: string; year: number; mobile: boolean }) {
  const navigate = useNavigate()
  const [data, setData] = useState<Check | null>(null)
  const [erp, setErp] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    if (!institutionId) return
    setLoading(true)
    const [{ data: d, error }, { data: c }] = await Promise.all([
      supabase.rpc('enrollment_leads_check', { p_inst: institutionId, p_year: year }),
      supabase.from('erp_connections').select('provider').eq('institution_id', institutionId).limit(1).maybeSingle(),
    ])
    setData(error ? null : (d as Check))
    setMsg(error ? 'Não foi possível conferir agora: ' + error.message : '')
    setErp((c as { provider?: string } | null)?.provider ?? null)
    setLoading(false)
  }, [institutionId, year])
  useEffect(() => { load() }, [load])

  const link = async (lead: SemAluno, cand: Cand) => {
    setBusy(lead.lead_id + cand.student_id); setMsg('')
    const { error } = await supabase.rpc('student_lead_action', { p_inst: institutionId, p_student: cand.student_id, p_action: 'link', p_lead: lead.lead_id, p_mark: false, p_year: year })
    setBusy('')
    if (error) { setMsg('Não foi possível vincular: ' + error.message); return }
    load()
  }

  if (loading && !data) return <div style={{ ...baseCard, display: 'flex', justifyContent: 'center', padding: 28 }}><Loader2 size={20} className="animate-spin" color={BRAND.primary} /></div>
  if (!data) return <div style={{ ...baseCard, color: '#B91C1C', fontSize: 13 }}>{msg || 'Sem dados para conferir.'}</div>

  const sys = erpSystem(erp)
  const sem = data.sem_aluno ?? [], dups = data.duplicados ?? [], varios = data.varios_alunos ?? []
  const nada = !sem.length && !dups.length && !varios.length
  const chip = (n: number, label: string, warn: boolean) => (
    <div style={{ flex: '1 1 0', minWidth: mobile ? 'calc(50% - 4px)' : 140, background: warn && n ? '#FFFBEB' : '#fff', border: `1px solid ${warn && n ? '#FDE68A' : BRAND.line}`, borderRadius: 14, padding: '10px 12px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: warn && n ? '#B45309' : BRAND.ink, lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: BRAND.muted, marginTop: 2, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
  const leadLine = (name: string, extra: (string | null | undefined)[]) => (
    <div>
      <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>{name}</div>
      <div style={{ fontSize: 12, color: BRAND.muted }}>{extra.filter(Boolean).join(' · ')}</div>
    </div>
  )
  const leadBtns = (id: string, phone: string | null) => (
    <>
      <button type="button" onClick={() => navigate(`/leads?open=${id}`)} style={btn()}><UserRound size={14} /> Ver lead</button>
      {phone && <button type="button" onClick={() => navigate(`/whatsapp?phone=${phone.replace(/\D/g, '')}`)} style={btn()}><MessageCircle size={14} /> Conversa</button>}
    </>
  )
  const item: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 12 : 16 }}>
      <div style={baseCard}>
        <SectionTitle hint={`Leads marcados como matriculados × alunos novos que o sistema da escola${sys ? ` (${sys.label})` : ''} trouxe em ${year}.`}>Conferir matrículas {year}</SectionTitle>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chip(data.leads_matriculados, 'leads matriculados', false)}
          {chip(data.alunos_novos, 'alunos novos no sistema', false)}
          {chip(data.leads_com_aluno, 'leads com aluno', false)}
          {chip(data.leads_sem_aluno, 'leads sem aluno', true)}
        </div>
        {msg && <div style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 8 }}>{msg}</div>}
        {nada && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: '#047857', fontWeight: 700 }}><CheckCircle2 size={16} /> Tudo certo: leads e alunos novos batem.</div>}
      </div>

      <EnrolledWithoutLead institutionId={institutionId} year={year} defaultOpen onChanged={load} />

      {sem.length > 0 && (
        <div style={baseCard}>
          <SectionTitle hint="O lead está como matriculado, mas não achamos esse aluno no sistema da escola. Confira se a matrícula foi feita lá.">Leads matriculados sem aluno ({sem.length})</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sem.map(l => (
              <div key={l.lead_id} style={item}>
                {leadLine(l.name, [l.grade, l.phone, l.responsible && `resp. ${l.responsible}`])}
                {l.candidatos?.map(c => (
                  <div key={c.student_id} style={{ fontSize: 12.5, color: BRAND.ink, background: BRAND.softer, borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 140 }}>Aluno com nome parecido: <b>{c.name}</b>{c.grade ? ` (${c.grade})` : ''}</span>
                    <button type="button" disabled={!!busy} onClick={() => link(l, c)} style={btn(true)}><Link2 size={14} /> Vincular</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {leadBtns(l.lead_id, l.phone)}
                  {sys && <a href={sys.newStudentUrl()} target="_blank" rel="noopener noreferrer" style={{ ...btn(!l.candidatos?.length), textDecoration: 'none' }}><ExternalLink size={14} /> Matricular na {sys.label}</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dups.length > 0 && (
        <div style={baseCard}>
          <SectionTitle hint="Mesmo telefone e nome parecido: provavelmente o mesmo aluno em dois leads. Abra os dois e deixe só um.">Leads repetidos ({dups.length})</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dups.map((g, i) => (
              <div key={i} style={item}>
                {g.map(l => (
                  <div key={l.lead_id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 150 }}>{leadLine(l.name, [l.grade, l.phone, new Date(l.created_at).toLocaleDateString('pt-BR')])}</div>
                    <button type="button" onClick={() => navigate(`/leads?open=${l.lead_id}`)} style={btn()}><UserRound size={14} /> Ver lead</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {varios.length > 0 && (
        <div style={baseCard}>
          <SectionTitle hint="Mesmo telefone ligado a mais de um aluno (irmãos, por exemplo). É normal: só confira se cada filho tem o seu lead.">Leads com mais de um aluno ({varios.length})</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {varios.map(l => (
              <div key={l.lead_id} style={item}>
                {leadLine(l.name, [l.phone, l.responsible && `resp. ${l.responsible}`])}
                <div style={{ fontSize: 12.5, color: BRAND.muted }}>Alunos: {l.alunos.join(', ')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{leadBtns(l.lead_id, l.phone)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
