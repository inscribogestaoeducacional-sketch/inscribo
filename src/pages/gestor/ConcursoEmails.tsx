// Concurso de Bolsas — e-mails: confirmação automática, envio avulso/em massa, modelos e histórico.
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { supabase } from '../../lib/supabase'
import { db, DEFAULT_CONFIRMATION, EMAIL_VARS, fmtDate, GRADES, type Candidate, type Contest } from '../../lib/concurso'

const input: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: BRAND.ink, background: '#fff', boxSizing: 'border-box', width: '100%' }
const lab: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: BRAND.muted, marginBottom: 4, display: 'block' }
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
  border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink,
})
type Tpl = { id: string; name: string; subject: string; body: string }
type Log = { id: string; kind: string; to_email: string; subject: string; status: string; error: string | null; created_at: string }

function VarChips({ onPick }: { onPick: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
      {EMAIL_VARS.map(([k, l]) => <button key={k} type="button" title={l} onClick={() => onPick(`{{${k}}}`)} style={{ border: `1px solid ${BRAND.softLine}`, background: BRAND.softer, color: BRAND.primaryDark, borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
    </div>
  )
}

function Preview({ contest, school, subject, body, cand }: { contest: Contest; school: { name: string; logo_url: string | null } | null; subject: string; body: string; cand?: Candidate }) {
  const v: Record<string, string> = {
    aluno: cand?.student_name ?? 'Nome do Aluno', responsavel: cand?.responsible_name ?? 'Nome do Responsável', numero: String(cand?.number ?? 1001), serie: cand?.grade ?? contest.grades[0] ?? '6º ano',
    concurso: contest.name, data_prova: contest.exam_date ? fmtDate(contest.exam_date) : 'a definir', local: contest.location || 'a definir', duracao: contest.exam_duration || '',
    escola: school?.name ?? '', link: contest.public_slug ? `${window.location.origin}/bolsas/${contest.public_slug}` : '',
  }
  const fill = (t: string) => t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => v[k] ?? '')
  const accent = contest.print_color || BRAND.primary
  return (
    <div style={{ background: '#EEF2F6', borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 6 }}>Assunto: <b style={{ color: BRAND.ink }}>{fill(subject)}</b></div>
      <div style={{ background: accent, color: '#fff', borderRadius: '14px 14px 0 0', padding: '14px 18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
        {school?.logo_url && <img src={school.logo_url} alt="" style={{ height: 32, background: '#fff', borderRadius: 6, padding: 3 }} />}{school?.name}
      </div>
      <div style={{ background: '#fff', padding: '18px', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: '#1E293B', border: '1px solid #E2E8F0', borderTop: 0 }}>{fill(body)}</div>
      <div style={{ background: '#F8FAFC', borderRadius: '0 0 14px 14px', padding: '8px 18px', fontSize: 11.5, color: '#64748B', textAlign: 'center', border: '1px solid #E2E8F0', borderTop: 0 }}>Enviado por {school?.name} via Áion Edu</div>
    </div>
  )
}

export default function ConcursoEmails({ contest, cands, onChanged }: { contest: Contest; cands: Candidate[]; onChanged: () => void }) {
  const [school, setSchool] = useState<{ name: string; logo_url: string | null } | null>(null)
  const [tpls, setTpls] = useState<Tpl[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [auto, setAuto] = useState(contest.email_auto_confirm !== false)
  const [cSub, setCSub] = useState(contest.email_confirmation?.subject || DEFAULT_CONFIRMATION.subject)
  const [cBody, setCBody] = useState(contest.email_confirmation?.body || DEFAULT_CONFIRMATION.body)
  const [sub, setSub] = useState(''); const [body, setBody] = useState('')
  const [grade, setGrade] = useState('')
  const [focus, setFocus] = useState<'cb' | 'b'>('cb')
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('')
  const [confirmSend, setConfirmSend] = useState(false)
  const [testTo, setTestTo] = useState('')

  const load = useCallback(async () => {
    const [i, t, l] = await Promise.all([
      db.from('institutions').select('name, logo_url').eq('id', contest.institution_id).maybeSingle(),
      db.from('contest_email_templates').select('id,name,subject,body').eq('contest_id', contest.id).order('created_at'),
      db.from('contest_emails').select('id,kind,to_email,subject,status,error,created_at').eq('contest_id', contest.id).order('created_at', { ascending: false }).limit(60),
    ])
    setSchool(i.data); setTpls(t.data ?? []); setLogs(l.data ?? [])
  }, [contest.id, contest.institution_id])
  useEffect(() => { load() }, [load])

  const call = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('contest-email', { body: { contest_id: contest.id, ...payload } })
    if (error) throw new Error(error.message)
    return data as any
  }
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 6000) }
  const addVar = (v: string) => (focus === 'cb' ? setCBody(cBody + v) : setBody(body + v))

  const saveConfirmation = async () => {
    setBusy('save')
    const { error } = await db.from('contests').update({ email_auto_confirm: auto, email_confirmation: { subject: cSub, body: cBody } }).eq('id', contest.id)
    setBusy(''); if (error) flash('Não foi possível salvar: ' + error.message); else { flash('Confirmação salva.'); onChanged() }
  }
  const sendTest = async (s: string, b: string) => {
    setBusy('test')
    try { const r = await call({ action: 'test', subject: s, body: b, to: testTo.trim() || undefined }); flash(r.ok ? `Teste enviado para ${r.to}.` : 'Falha no envio: ' + (r.error ?? '')) } catch (e: any) { flash(e.message) }
    setBusy(''); load()
  }
  const withEmail = cands.filter(c => c.email && (!grade || c.grade === grade))
  const sendAll = async () => {
    setBusy('send'); setConfirmSend(false)
    try { const r = await call({ action: 'send', subject: sub, body, grade: grade || undefined }); flash(`Enviados: ${r.sent} de ${r.total}${r.failed ? ` · ${r.failed} falharam (veja o histórico)` : ''}.`) } catch (e: any) { flash(e.message) }
    setBusy(''); load()
  }
  const saveTpl = async () => {
    const name = window.prompt('Nome do modelo:', sub); if (!name) return
    const { error } = await db.from('contest_email_templates').insert({ institution_id: contest.institution_id, contest_id: contest.id, name, subject: sub, body })
    flash(error ? 'Não foi possível salvar o modelo: ' + error.message : 'Modelo salvo.')
    load()
  }
  const delTpl = async (id: string) => { await db.from('contest_email_templates').delete().eq('id', id); load() }
  const KIND: Record<string, string> = { confirmation: 'Confirmação', custom: 'Mensagem', test: 'Teste' }
  const grades = contest.grades.length ? contest.grades : GRADES

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 200, maxWidth: 'min(520px, calc(100vw - 24px))', background: BRAND.ink, color: '#fff', borderRadius: 14, padding: '12px 18px', fontSize: 14.5, fontWeight: 700, boxShadow: '0 14px 40px -12px rgba(0,0,0,.5)' }}>{msg}</div>}

      <div style={card}>
        <label style={lab}>Receber os e-mails de teste em</label>
        <input style={input} type="email" placeholder="seu-email@exemplo.com (se vazio, vai para o e-mail da sua conta no Áion)" value={testTo} onChange={e => setTestTo(e.target.value)} />
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 16, color: BRAND.ink }}>E-mail de confirmação da inscrição</div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0', fontSize: 14, color: BRAND.ink }}><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Enviar automaticamente quando a família se inscrever (só se informar e-mail)</label>
        <label style={lab}>Assunto</label><input style={input} value={cSub} onChange={e => setCSub(e.target.value)} onFocus={() => setFocus('cb')} />
        <label style={{ ...lab, marginTop: 10 }}>Mensagem (clique para inserir dados da inscrição)</label>
        <VarChips onPick={addVar} />
        <textarea rows={9} style={{ ...input, resize: 'vertical' }} value={cBody} onChange={e => setCBody(e.target.value)} onFocus={() => setFocus('cb')} />
        <div style={{ margin: '12px 0 6px', fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}>Como a família vai ver</div>
        <Preview contest={contest} school={school} subject={cSub} body={cBody} cand={cands[0]} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button style={btn(true)} disabled={!!busy} onClick={saveConfirmation}>{busy === 'save' && <Loader2 size={15} className="animate-spin" />}{busy === 'save' ? 'Salvando…' : 'Salvar'}</button>
          <button style={btn()} disabled={!!busy} onClick={() => sendTest(cSub, cBody)}>{busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : null}{busy === 'test' ? 'Enviando teste…' : 'Enviar teste para mim'}</button>
          <button style={btn()} onClick={() => { setCSub(DEFAULT_CONFIRMATION.subject); setCBody(DEFAULT_CONFIRMATION.body) }}>Voltar ao texto padrão</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 16, color: BRAND.ink }}>Enviar e-mail aos inscritos</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
          <select style={{ ...input, width: 'auto' }} value={grade} onChange={e => setGrade(e.target.value)}><option value="">Todas as séries</option>{grades.map(g => <option key={g}>{g}</option>)}</select>
          {tpls.length > 0 && <select style={{ ...input, width: 'auto' }} value="" onChange={e => { const t = tpls.find(x => x.id === e.target.value); if (t) { setSub(t.subject); setBody(t.body) } }}><option value="">Usar modelo salvo…</option>{tpls.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
          <span style={{ alignSelf: 'center', fontSize: 13, color: BRAND.muted }}>{withEmail.length} {withEmail.length === 1 ? 'inscrito com e-mail' : 'inscritos com e-mail'}</span>
        </div>
        <label style={lab}>Assunto</label><input style={input} value={sub} onChange={e => setSub(e.target.value)} onFocus={() => setFocus('b')} placeholder="Ex.: Orientações da prova — {{concurso}}" />
        <label style={{ ...lab, marginTop: 10 }}>Mensagem</label>
        <VarChips onPick={addVar} />
        <textarea rows={8} style={{ ...input, resize: 'vertical' }} value={body} onChange={e => setBody(e.target.value)} onFocus={() => setFocus('b')} placeholder="Escreva a mensagem. Cada família recebe com os dados do próprio aluno." />
        {(sub || body) && <div style={{ marginTop: 12 }}><Preview contest={contest} school={school} subject={sub} body={body} cand={withEmail[0]} /></div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          {!confirmSend
            ? <button style={btn(true)} disabled={!!busy || !sub.trim() || !body.trim() || !withEmail.length} onClick={() => setConfirmSend(true)}>{busy === 'send' && <Loader2 size={15} className="animate-spin" />}Enviar para {withEmail.length}</button>
            : <><b style={{ fontSize: 13.5 }}>Enviar agora para {withEmail.length} {withEmail.length === 1 ? 'pessoa' : 'pessoas'}?</b><button style={btn(true)} onClick={sendAll}>Sim, enviar</button><button style={btn()} onClick={() => setConfirmSend(false)}>Cancelar</button></>}
          <button style={btn()} disabled={!!busy || !sub.trim() || !body.trim()} onClick={() => sendTest(sub, body)}>{busy === 'test' ? 'Enviando teste…' : 'Enviar teste para mim'}</button>
          <button style={btn()} disabled={!sub.trim() || !body.trim()} onClick={saveTpl}>Salvar como modelo</button>
        </div>
        {tpls.length > 0 && <div style={{ marginTop: 12, fontSize: 12.5, color: BRAND.muted }}>Modelos salvos: {tpls.map(t => <span key={t.id} style={{ marginRight: 10 }}>{t.name} <button onClick={() => delTpl(t.id)} style={{ border: 0, background: 'none', color: '#B91C1C', cursor: 'pointer', fontSize: 12 }}>excluir</button></span>)}</div>}
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', fontWeight: 800, color: BRAND.ink }}>Histórico de envios</div>
        {logs.length === 0 && <div style={{ padding: '0 16px 16px', fontSize: 14, color: BRAND.muted }}>Nenhum e-mail enviado ainda.</div>}
        {logs.map(l => (
          <div key={l.id} style={{ display: 'flex', gap: 10, padding: '9px 16px', borderTop: `1px solid ${BRAND.line}`, fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: l.status === 'sent' ? '#D1FAE5' : '#FEE2E2', color: l.status === 'sent' ? '#047857' : '#B91C1C' }}>{l.status === 'sent' ? 'Enviado' : 'Falhou'}</span>
            <span style={{ color: BRAND.muted }}>{KIND[l.kind]}</span>
            <span style={{ flex: 1, minWidth: 160, color: BRAND.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.to_email} · {l.subject}</span>
            <span style={{ color: BRAND.muted }}>{new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
