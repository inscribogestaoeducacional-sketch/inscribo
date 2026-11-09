// Aba "Resultados": ranking por série, decisão de bolsas pela coordenação, PDF e divulgação (com QR code).
import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Loader2 } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, essayFor, finalScore, GRADES, type Candidate, type Contest, type Decision, type Essay } from '../../lib/concurso'

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const sel: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '7px 9px', fontSize: 13.5, fontFamily: 'inherit', color: BRAND.ink, background: '#fff' }
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
  border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink,
})
type Res = { candidate_id: string; score: number; total: number }
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const decKey = (d?: Decision) => !d ? 'pending' : d.status === 'granted' ? `p:${d.scholarship_pct}` : d.status
const decLabel = (d?: Decision) => !d || d.status === 'pending' ? 'Sem decisão' : d.status === 'granted' ? `Bolsa ${d.scholarship_pct}%` : d.status === 'waitlist' ? 'Lista de espera' : 'Sem bolsa'

export default function ConcursoResultados({ contest, cands, onChanged }: { contest: Contest; cands: Candidate[]; onChanged: () => void }) {
  const [results, setResults] = useState<Res[]>([])
  const [essays, setEssays] = useState<Essay[]>([])
  const [decs, setDecs] = useState<Decision[]>([])
  const [school, setSchool] = useState<{ name: string; logo_url: string | null } | null>(null)
  const [grade, setGrade] = useState('')
  const [qr, setQr] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [bulk, setBulk] = useState<Record<string, number>>({})
  const [confirmPub, setConfirmPub] = useState(false)
  const link = contest.public_slug ? `${window.location.origin}/bolsas/${contest.public_slug}/resultado` : ''

  const load = useCallback(async () => {
    const [r, e, d, i] = await Promise.all([
      db.from('contest_results').select('candidate_id,score,total').eq('contest_id', contest.id),
      db.from('contest_essays').select('*').eq('contest_id', contest.id),
      db.from('contest_decisions').select('*').eq('contest_id', contest.id),
      db.from('institutions').select('name, logo_url').eq('id', contest.institution_id).maybeSingle(),
    ])
    setResults(r.data ?? []); setEssays(e.data ?? []); setDecs(d.data ?? []); setSchool(i.data)
  }, [contest.id, contest.institution_id])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (link) QRCode.toDataURL(link, { margin: 1, width: 360 }).then(setQr) }, [link])
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }

  const rows = useMemo(() => {
    const all = cands.map(c => {
      const f = finalScore(contest, c.grade, results.find(r => r.candidate_id === c.id), essays.find(e => e.candidate_id === c.id))
      return { c, ...f, dec: decs.find(d => d.candidate_id === c.id) }
    })
    const out: ((typeof all)[number] & { pos: number | null })[] = []
    for (const g of contest.grades.length ? contest.grades : GRADES) {
      const list = all.filter(x => x.c.grade === g)
      const ranked = list.filter(x => x.final != null).sort((a, b) => (b.final! - a.final!) || (b.obj ?? 0) - (a.obj ?? 0) || a.c.number - b.c.number)
      let pos = 0, last: number | null = null
      ranked.forEach((x, i) => { if (x.final !== last) { pos = i + 1; last = x.final }; out.push({ ...x, pos }) })
      list.filter(x => x.final == null).forEach(x => out.push({ ...x, pos: null }))
    }
    return out
  }, [cands, results, essays, decs, contest])
  const shown = rows.filter(r => !grade || r.c.grade === grade)
  const missing = rows.filter(r => r.final == null).length
  const essayPending = rows.filter(r => r.pending).length
  const undecided = rows.filter(r => r.final != null && (!r.dec || r.dec.status === 'pending')).length
  const published = contest.status === 'published'

  const setDecision = async (candId: string, value: string) => {
    const base = { institution_id: contest.institution_id, contest_id: contest.id, candidate_id: candId, decided_at: new Date().toISOString() }
    const row = value.startsWith('p:') ? { ...base, status: 'granted', scholarship_pct: Number(value.slice(2)) } : { ...base, status: value, scholarship_pct: null }
    const { error } = await db.from('contest_decisions').upsert(row, { onConflict: 'contest_id,candidate_id' })
    if (error) flash('Não foi possível salvar: ' + error.message); else load()
  }
  const applyBulk = async () => {
    if (!grade) return flash('Escolha uma série para aplicar as bolsas por posição.')
    const ranked = shown.filter(r => r.pos != null)
    const upserts: any[] = []; let i = 0
    for (const t of contest.scholarship_tiers) {
      const n = bulk[t.label] ?? 0
      for (let k = 0; k < n && i < ranked.length; k++, i++) upserts.push({ institution_id: contest.institution_id, contest_id: contest.id, candidate_id: ranked[i].c.id, status: 'granted', scholarship_pct: t.percent, decided_at: new Date().toISOString() })
    }
    if (!upserts.length) return flash('Informe quantas bolsas de cada faixa.')
    setBusy(true)
    const { error } = await db.from('contest_decisions').upsert(upserts, { onConflict: 'contest_id,candidate_id' })
    setBusy(false); if (error) flash('Erro: ' + error.message); else { flash(`${upserts.length} bolsas aplicadas pela ordem do ranking. Você pode ajustar uma a uma.`); load() }
  }
  const setStatus = async (status: 'published' | 'closed') => {
    setBusy(true); setConfirmPub(false)
    const { error } = await db.from('contests').update({ status }).eq('id', contest.id)
    setBusy(false); if (error) flash('Erro: ' + error.message); else { flash(status === 'published' ? 'Resultado divulgado. As famílias já podem consultar.' : 'Divulgação retirada.'); onChanged() }
  }

  const printRanking = () => {
    const w = window.open('', '_blank'); if (!w) return flash('Libere pop-ups para gerar o PDF.')
    const grades = grade ? [grade] : (contest.grades.length ? contest.grades : GRADES)
    const body = grades.map(g => {
      const list = rows.filter(r => r.c.grade === g && r.pos != null)
      if (!list.length) return ''
      const hasE = essayFor(contest, g).enabled
      return `<h2>${esc(g)}</h2><table><thead><tr><th>Pos.</th><th>Insc.</th><th style="text-align:left">Aluno</th><th>Objetiva</th>${hasE ? '<th>Redação</th>' : ''}<th>Nota final</th><th>Decisão</th></tr></thead><tbody>${list.map(r => `<tr><td>${r.pos}º</td><td>${r.c.number}</td><td style="text-align:left">${esc(r.c.student_name)}</td><td>${r.obj ?? '-'}</td>${hasE ? `<td>${r.essay ?? '-'}</td>` : ''}<td><b>${r.final}</b></td><td>${esc(decLabel(r.dec))}</td></tr>`).join('')}</tbody></table>`
    }).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ranking — ${esc(contest.name)}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#000;font-size:11pt}h1{font-size:16pt;margin:0}h2{font-size:13pt;margin:16px 0 6px;border-bottom:2px solid ${esc(contest.print_color || BRAND.primary)};padding-bottom:3px}table{width:100%;border-collapse:collapse;font-size:10pt;break-inside:auto}th,td{border:1px solid #999;padding:3px 6px;text-align:center}th{background:#eee}tr{break-inside:avoid}.sub{color:#444;font-size:10pt;margin:2px 0 8px}</style></head><body><h1>${esc(school?.name ?? '')} — ${esc(contest.name)}</h1><div class="sub">Ranking por série · uso da coordenação${published ? '' : ' · resultado ainda não divulgado'}</div>${body || '<p>Sem notas lançadas.</p>'}<script>setTimeout(()=>window.print(),400)</script></body></html>`)
    w.document.close()
  }
  const printQr = () => {
    const w = window.open('', '_blank'); if (!w) return flash('Libere pop-ups para imprimir.')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR do resultado</title><style>@page{size:A4;margin:20mm}body{font-family:Arial,sans-serif;text-align:center;color:#000}h1{font-size:26pt;margin:20mm 0 6mm}p{font-size:14pt}img{width:110mm;height:110mm}</style></head><body><h1>Resultado do ${esc(contest.name)}</h1><p>Aponte a câmera do celular para o QR code</p><img src="${qr}"/><p>ou acesse:<br><b>${esc(link)}</b></p><p style="font-size:12pt">Tenha em mãos o número da inscrição e a data de nascimento do aluno.</p><script>setTimeout(()=>window.print(),400)</script></body></html>`)
    w.document.close()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && <div role="status" style={{ ...card, background: BRAND.softer, borderColor: BRAND.softLine, fontSize: 14 }}>{msg}</div>}

      <div style={card}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: BRAND.ink, flex: 1 }}>Divulgação do resultado</div>
          <span style={{ fontSize: 12.5, fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: published ? '#D1FAE5' : '#FEF3C7', color: published ? '#047857' : '#B45309' }}>{published ? 'Divulgado às famílias' : 'Ainda não divulgado'}</span>
        </div>
        <div style={{ fontSize: 13.5, color: BRAND.muted, margin: '8px 0' }}>Enquanto não divulgar, ninguém vê nota nem resultado, mesmo com o QR code. A família consulta com o número da inscrição e a data de nascimento do aluno.</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {qr && <img src={qr} alt="QR code do resultado" style={{ width: 110, height: 110, border: `1px solid ${BRAND.line}`, borderRadius: 10 }} />}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13, color: BRAND.muted, wordBreak: 'break-all' }}>{link || 'Defina o endereço da página na aba Concurso para gerar o QR code.'}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {link && <button style={btn()} onClick={() => navigator.clipboard?.writeText(link).then(() => flash('Link copiado.'))}>Copiar link</button>}
              {qr && <button style={btn()} onClick={printQr}>Imprimir QR code</button>}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!published && !confirmPub && <button style={btn(true)} disabled={busy} onClick={() => setConfirmPub(true)}>Divulgar resultado</button>}
          {!published && confirmPub && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>
                Divulgar agora?{missing > 0 && ` ${missing} sem nota.`}{essayPending > 0 && ` ${essayPending} com redação por corrigir.`}{undecided > 0 && ` ${undecided} sem decisão de bolsa.`}
              </span>
              <button style={btn(true)} onClick={() => setStatus('published')}>Sim, divulgar</button><button style={btn()} onClick={() => setConfirmPub(false)}>Cancelar</button>
            </div>
          )}
          {published && <button style={btn()} disabled={busy} onClick={() => setStatus('closed')}>Retirar divulgação</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {([['Inscritos', cands.length], ['Com nota', rows.filter(r => r.final != null).length], ['Sem nota', missing], ['Redação por corrigir', essayPending], ['Sem decisão', undecided]] as [string, number][]).map(([l, v]) => (
          <div key={l} style={card}><div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}>{l}</div><div style={{ fontSize: 26, fontWeight: 800, color: BRAND.ink }}>{v}</div></div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={sel} value={grade} onChange={e => setGrade(e.target.value)}><option value="">Todas as séries</option>{(contest.grades.length ? contest.grades : GRADES).map(g => <option key={g}>{g}</option>)}</select>
        <button style={btn()} onClick={printRanking}>Gerar PDF do ranking</button>
      </div>

      {grade && (
        <div style={card}>
          <div style={{ fontWeight: 800, color: BRAND.ink }}>Aplicar bolsas pela posição ({grade})</div>
          <div style={{ fontSize: 13, color: BRAND.muted, margin: '4px 0 10px' }}>Diga quantas bolsas de cada faixa. Elas são dadas do 1º lugar para baixo. Depois você ajusta caso a caso.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {contest.scholarship_tiers.map(t => (
              <label key={t.label} style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, display: 'flex', gap: 6, alignItems: 'center' }}>Bolsa {t.label}
                <input type="number" min={0} style={{ ...sel, width: 64 }} value={bulk[t.label] ?? ''} onChange={e => setBulk({ ...bulk, [t.label]: Math.max(0, Number(e.target.value) || 0) })} /></label>
            ))}
            <button style={btn(true)} disabled={busy} onClick={applyBulk}>{busy && <Loader2 size={15} className="animate-spin" />}Aplicar</button>
          </div>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {shown.length === 0 && <div style={{ padding: 16, fontSize: 14, color: BRAND.muted }}>Nenhum inscrito.</div>}
        {shown.map((r, i) => (
          <div key={r.c.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', alignItems: 'center', borderTop: i ? `1px solid ${BRAND.line}` : 0, flexWrap: 'wrap' }}>
            <div style={{ width: 40, fontWeight: 800, color: BRAND.primaryDark }}>{r.pos != null ? `${r.pos}º` : '—'}</div>
            <div style={{ flex: 1, minWidth: 170 }}>
              <div style={{ fontWeight: 700, color: BRAND.ink, fontSize: 14.5 }}>{r.c.student_name}</div>
              <div style={{ fontSize: 12.5, color: BRAND.muted }}>{r.c.number} · {r.c.grade}</div>
            </div>
            <div style={{ fontSize: 12.5, color: BRAND.muted, minWidth: 130 }}>Objetiva {r.obj ?? '-'}{r.hasEssay ? ` · Redação ${r.essay ?? 'pendente'}` : ''}</div>
            <div style={{ minWidth: 56, fontWeight: 800, fontSize: 16, color: BRAND.ink }}>{r.final ?? '-'}</div>
            <select style={sel} value={decKey(r.dec)} disabled={r.final == null} onChange={e => setDecision(r.c.id, e.target.value)} aria-label={`Decisão para ${r.c.student_name}`}>
              <option value="pending">Sem decisão</option>
              {contest.scholarship_tiers.map(t => <option key={t.label} value={`p:${t.percent}`}>Bolsa {t.label}</option>)}
              <option value="waitlist">Lista de espera</option><option value="denied">Sem bolsa</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
