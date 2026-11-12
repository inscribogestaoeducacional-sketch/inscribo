// Salas e listas do dia da prova: salas, distribuição dos inscritos, presença e impressões
// (lista de pátio, cartaz da porta, lista de assinatura e pacote de materiais por sala).
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, Printer } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, GRADES, fmtDate, type Candidate, type Contest, type Room } from '../../lib/concurso'
import { versionFor } from '../../lib/concursoProva'

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const input: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: BRAND.ink, background: '#fff', boxSizing: 'border-box' }
const btn = (primary = false): React.CSSProperties => ({ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const byName = (a: Candidate, b: Candidate) => a.student_name.localeCompare(b.student_name, 'pt-BR')
const byNumber = (a: Candidate, b: Candidate) => a.number - b.number

export default function ConcursoSalas({ contest, cands, onChanged, onGoProva }: { contest: Contest; cands: Candidate[]; onChanged: () => void; onGoProva?: () => void }) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [school, setSchool] = useState<{ name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [name, setName] = useState('')
  const [cap, setCap] = useState(30)
  const [grade, setGrade] = useState('')
  const grades = contest.grades.length ? contest.grades : GRADES
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }

  const load = useCallback(async () => {
    const [r, i] = await Promise.all([
      db.from('contest_rooms').select('*').eq('contest_id', contest.id).order('position').order('created_at'),
      db.from('institutions').select('name').eq('id', contest.institution_id).maybeSingle(),
    ])
    setRooms(r.data ?? []); setSchool(i.data)
  }, [contest.id, contest.institution_id])
  useEffect(() => { load() }, [load])

  const inRoom = (r: Room) => cands.filter(c => c.room_id === r.id).sort(byNumber)
  const noRoom = cands.filter(c => !c.room_id || !rooms.some(r => r.id === c.room_id))
  const absent = cands.filter(c => c.present === false).length

  const addRoom = async () => {
    const n = name.trim() || `Sala ${rooms.length + 1}`
    setBusy(true)
    const { error } = await db.from('contest_rooms').insert({ institution_id: contest.institution_id, contest_id: contest.id, name: n, capacity: Math.max(1, cap), grade: grade || null, position: rooms.length })
    setBusy(false)
    if (error) return flash('Erro: ' + error.message)
    setName(''); flash(`${n} criada.`); load()
  }
  const delRoom = async (r: Room) => {
    if (!confirm(`Apagar ${r.name}? Os alunos dela ficam sem sala.`)) return
    const { error } = await db.from('contest_rooms').delete().eq('id', r.id)
    if (error) return flash('Erro: ' + error.message)
    flash(`${r.name} apagada.`); load(); onChanged()
  }
  const move = async (c: Candidate, roomId: string) => {
    const { error } = await db.from('contest_candidates').update({ room_id: roomId || null }).eq('id', c.id)
    if (error) return flash('Erro: ' + error.message)
    onChanged()
  }
  const setPresent = async (c: Candidate, v: string) => {
    const { error } = await db.from('contest_candidates').update({ present: v === '' ? null : v === '1' }).eq('id', c.id)
    if (error) return flash('Erro: ' + error.message)
    onChanged()
  }

  const distribute = async (all: boolean) => {
    if (!rooms.length) return flash('Crie as salas primeiro.')
    if (all && cands.some(c => c.room_id) && !confirm('Isso refaz a distribuição de todos os inscritos. Continuar?')) return
    setBusy(true)
    const free: Record<string, number> = Object.fromEntries(rooms.map(r => [r.id, r.capacity - (all ? 0 : inRoom(r).length)]))
    const todo = (all ? [...cands] : noRoom).sort((a, b) => a.grade.localeCompare(b.grade, 'pt-BR') || a.number - b.number)
    const plan: Record<string, string[]> = {}; let left = 0
    for (const c of todo) {
      const r = rooms.find(x => (!x.grade || x.grade === c.grade) && free[x.id] > 0)
      if (!r) { left++; continue }
      free[r.id]--; (plan[r.id] ||= []).push(c.id)
    }
    try {
      if (all) await db.from('contest_candidates').update({ room_id: null }).eq('contest_id', contest.id)
      for (const [rid, ids] of Object.entries(plan)) {
        const { error } = await db.from('contest_candidates').update({ room_id: rid }).in('id', ids)
        if (error) throw error
      }
      flash(left ? `Distribuído. ${left} aluno(s) ficaram sem sala: faltam lugares.` : 'Todos os inscritos foram distribuídos.')
    } catch (e: any) { flash('Erro: ' + (e?.message || 'não foi possível distribuir')) }
    setBusy(false); onChanged()
  }

  // ---------- impressões ----------
  const openDoc = (title: string, body: string, landscape = false) => {
    const w = window.open('', '_blank'); if (!w) return flash('Libere pop-ups para imprimir.')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4${landscape ? ' landscape' : ''};margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#000;font-size:11pt;margin:0}h1{font-size:17pt;margin:0}h2{font-size:13pt;margin:0 0 3mm}.sub{font-size:10.5pt;color:#333;margin:1mm 0 5mm}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:2.2mm 2.5mm;font-size:10.5pt;text-align:left}th{background:#eee}td.c,th.c{text-align:center}.pg{page-break-after:always}.pg:last-child{page-break-after:auto}.bar{position:sticky;top:0;background:#1A2B4A;color:#fff;padding:10px 14px;font-size:14px;display:flex;gap:12px;align-items:center}.bar button{padding:7px 14px;border:0;border-radius:8px;background:#05907B;color:#fff;font-weight:700;cursor:pointer}@media print{.bar{display:none}}.big{font-size:70pt;font-weight:800;text-align:center;margin:30mm 0 8mm}.mid{font-size:26pt;text-align:center;margin:4mm 0}.sm{font-size:15pt;text-align:center;color:#333}</style></head><body><div class="bar"><b>${esc(title)}</b><button onclick="window.print()">Imprimir / Salvar PDF</button></div><div style="padding:14mm">${body}</div></body></html>`)
    w.document.close()
  }
  const head = (t: string, sub = '') => `<h1>${esc(school?.name ?? '')} — ${esc(contest.name)}</h1><div class="sub">${esc(t)}${sub ? ' · ' + esc(sub) : ''}${contest.exam_date ? ' · ' + esc(fmtDate(contest.exam_date)) : ''}</div>`
  const [lote, setLote] = useState('all')
  const loteHref = (kind: string) => `/concurso/imprimir?contest=${contest.id}&kind=${kind}&room=${lote}`
  const roomOf = (c: Candidate) => rooms.find(r => r.id === c.room_id)

  const printPatio = () => {
    const parts = grades.map(g => {
      const list = cands.filter(c => c.grade === g).sort(byName); if (!list.length) return ''
      return `<div class="pg"><h2>${esc(g)}</h2><table><thead><tr><th>Aluno</th><th class="c">Inscrição</th><th>Sala</th></tr></thead><tbody>${list.map(c => `<tr><td>${esc(c.student_name)}</td><td class="c">${c.number}</td><td><b>${esc(roomOf(c)?.name ?? 'a definir')}</b></td></tr>`).join('')}</tbody></table></div>`
    }).join('')
    openDoc('Lista de pátio', head('Em qual sala eu fico?') + (parts || '<p>Nenhum inscrito.</p>'))
  }
  const printCartazes = () => {
    if (!rooms.length) return flash('Crie as salas primeiro.')
    openDoc('Cartazes das salas', rooms.map(r => {
      const l = inRoom(r); const gs = Array.from(new Set(l.map(c => c.grade))).join(', ') || r.grade || ''
      return `<div class="pg"><div class="sm">${esc(school?.name ?? '')} · ${esc(contest.name)}</div><div class="big">${esc(r.name)}</div><div class="mid">${esc(gs)}</div>${l.length ? `<div class="mid">Inscrições nº ${l[0].number} a ${l[l.length - 1].number}</div><div class="sm">${l.length} aluno(s)${contest.exam_date ? ' · ' + esc(fmtDate(contest.exam_date)) : ''}</div>` : ''}</div>`
    }).join(''))
  }
  const printAssinatura = () => {
    if (!rooms.length) return flash('Crie as salas primeiro.')
    openDoc('Listas de assinatura', rooms.map(r => {
      const l = inRoom(r).sort(byName); if (!l.length) return ''
      return `<div class="pg">${head('Lista de presença e assinatura', r.name)}<table><thead><tr><th class="c" style="width:14mm">Nº</th><th>Aluno</th><th class="c" style="width:16mm">Versão</th><th style="width:62mm">Assinatura</th></tr></thead><tbody>${l.map(c => `<tr><td class="c">${c.number}</td><td>${esc(c.student_name)}<div style="font-size:8.5pt;color:#444">${esc(c.grade)}</div></td><td class="c">${versionFor(c.number, contest.versions_count)}</td><td style="height:10mm"></td></tr>`).join('')}</tbody></table><div style="margin-top:8mm;font-size:10.5pt">Fiscal: ______________________________ &nbsp; Presentes: ______ &nbsp; Ausentes: ______</div></div>`
    }).join('') || '<p>Nenhum aluno em sala.</p>')
  }
  const printPacote = () => {
    if (!rooms.length) return flash('Crie as salas primeiro.')
    openDoc('Pacote de materiais por sala', rooms.map(r => {
      const l = inRoom(r); if (!l.length) return ''
      const rows = grades.map(g => {
        const gl = l.filter(c => c.grade === g); if (!gl.length) return ''
        const vs: Record<string, number> = {}; gl.forEach(c => { const v = versionFor(c.number, contest.versions_count); vs[v] = (vs[v] || 0) + 1 })
        return `<tr><td>${esc(g)}</td><td>${Object.entries(vs).sort().map(([v, n]) => `${n} da versão ${v}`).join(' · ')}</td><td class="c">${gl.length}</td><td>${gl.map(c => c.number).join(', ')}</td></tr>`
      }).join('')
      return `<div class="pg">${head('Materiais da sala', r.name)}<table><thead><tr><th>Série</th><th>Cadernos</th><th class="c">Cartões e redações</th><th>Inscrições (cartões e folhas)</th></tr></thead><tbody>${rows}</tbody></table><p style="font-size:10.5pt">Total na sala: <b>${l.length}</b> aluno(s). Separe e confira antes do dia da prova.</p></div>`
    }).join('') || '<p>Nenhum aluno em sala.</p>', true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: BRAND.soft, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: '10px 14px', fontSize: 13.5, color: BRAND.ink, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 260px' }}><b>Dia da prova.</b> Crie as salas, distribua os inscritos e imprima tudo daqui. Os cadernos usam a prova que você fechou em "Preparar": as questões não mudam por aqui.</span>
        {onGoProva && <button style={btn()} onClick={onGoProva}>Ver a prova fechada</button>}
      </div>
      {msg && <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 200, maxWidth: 'min(520px, calc(100vw - 24px))', background: BRAND.ink, color: '#fff', borderRadius: 14, padding: '12px 18px', fontSize: 14.5, fontWeight: 700, boxShadow: '0 14px 40px -12px rgba(0,0,0,.5)' }}>{msg}</div>}

      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 16, color: BRAND.ink }}>Salas da prova</div>
        <div style={{ fontSize: 13.5, color: BRAND.muted, margin: '4px 0 10px' }}>Crie as salas, escolha a série de cada uma (ou "Todas as séries" para misturar) e distribua os inscritos.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...input, flex: '1 1 140px' }} placeholder={`Nome (ex.: Sala ${rooms.length + 1})`} value={name} onChange={e => setName(e.target.value)} aria-label="Nome da sala" />
          <label style={{ fontSize: 13, fontWeight: 700, color: BRAND.muted, display: 'flex', alignItems: 'center', gap: 6 }}>Lugares <input type="number" min={1} style={{ ...input, width: 74 }} value={cap} onChange={e => setCap(Number(e.target.value) || 1)} /></label>
          <select style={input} value={grade} onChange={e => setGrade(e.target.value)} aria-label="Série da sala"><option value="">Todas as séries</option>{grades.map(g => <option key={g}>{g}</option>)}</select>
          <button style={btn(true)} disabled={busy} onClick={addRoom}><Plus size={15} /> Adicionar sala</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <button style={btn()} disabled={busy || !rooms.length} onClick={() => distribute(false)}>{busy && <Loader2 size={15} className="animate-spin" />} Distribuir quem está sem sala</button>
          <button style={btn()} disabled={busy || !rooms.length} onClick={() => distribute(true)}>Refazer a distribuição de todos</button>
          <span style={{ fontSize: 13, color: BRAND.muted }}>{cands.length - noRoom.length} de {cands.length} em sala{absent ? ` · ${absent} faltaram` : ''}</span>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Impressões do dia da prova</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn()} onClick={printPatio}><Printer size={15} /> Lista de pátio</button>
          <button style={btn()} onClick={printCartazes}><Printer size={15} /> Cartazes das salas</button>
          <button style={btn()} onClick={printAssinatura}><Printer size={15} /> Listas de assinatura</button>
          <button style={btn()} onClick={printPacote}><Printer size={15} /> Pacote de materiais por sala</button>
        </div>
        <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 8 }}>A lista de pátio sai por série, em ordem alfabética, para o aluno achar o nome. A de assinatura sai uma folha por sala, com a versão do caderno de cada aluno.</div>
      </div>

      {rooms.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 800, color: BRAND.ink }}>Lote por sala</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, margin: '4px 0 10px' }}>Gera cadernos (um por aluno, na versão dele), cartões, folhas de redação e folhas do aluno já na ordem da sala (sala 1 inteira, depois a sala 2…). Cada aluno sai com a sua versão e a sua série, mesmo em sala mista.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={input} value={lote} onChange={e => setLote(e.target.value)} aria-label="Sala do lote"><option value="all">Todas as salas</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            <a style={{ ...btn(), textDecoration: 'none' }} href={loteHref('caderno')} target="_blank" rel="noreferrer"><Printer size={15} /> Cadernos (um por aluno)</a>
            <a style={{ ...btn(), textDecoration: 'none' }} href={loteHref('cartoes')} target="_blank" rel="noreferrer"><Printer size={15} /> Cartões-resposta</a>
            <a style={{ ...btn(), textDecoration: 'none' }} href={loteHref('redacao')} target="_blank" rel="noreferrer"><Printer size={15} /> Folhas de redação</a>
            <a style={{ ...btn(), textDecoration: 'none' }} href={loteHref('folha')} target="_blank" rel="noreferrer"><Printer size={15} /> Folhas do aluno</a>
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 8 }}>Os cadernos saem na ordem da sala, cada aluno com a sua versão e frente e verso fechando certinho. O PDF de uma sala cheia é pesado: se o computador travar, gere sala por sala. Quem prefere imprimir só uma cópia por versão usa Preparar → Montar prova.</div>
        </div>
      )}

      {rooms.map(r => {
        const l = inRoom(r)
        return (
          <div key={r.id} style={card}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: BRAND.ink }}>{r.name}</div>
              <span style={{ fontSize: 12.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: BRAND.soft, color: BRAND.primaryDark }}>{r.grade || 'Todas as séries'}</span>
              <span style={{ fontSize: 13, color: l.length > r.capacity ? '#B91C1C' : BRAND.muted, fontWeight: 700 }}>{l.length} de {r.capacity} lugares</span>
              <div style={{ flex: 1 }} />
              <button style={{ ...btn(), padding: '6px 10px' }} onClick={() => delRoom(r)} aria-label={`Apagar ${r.name}`}><Trash2 size={14} /></button>
            </div>
            {l.length === 0 && <div style={{ fontSize: 13.5, color: BRAND.muted, marginTop: 8 }}>Ninguém nesta sala ainda.</div>}
            {l.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', borderTop: i ? `1px solid ${BRAND.line}` : `1px solid ${BRAND.line}`, flexWrap: 'wrap', marginTop: i ? 0 : 10 }}>
                <span style={{ width: 44, fontWeight: 800, color: BRAND.primaryDark, fontSize: 13.5 }}>{c.number}</span>
                <span style={{ flex: 1, minWidth: 150, fontSize: 14, color: BRAND.ink }}>{c.student_name} <span style={{ color: BRAND.muted, fontSize: 12.5 }}>· {c.grade} · versão {versionFor(c.number, contest.versions_count)}</span></span>
                <select style={{ ...input, padding: '5px 8px', fontSize: 13 }} value={c.present == null ? '' : c.present ? '1' : '0'} onChange={e => setPresent(c, e.target.value)} aria-label={`Presença de ${c.student_name}`}>
                  <option value="">Presença</option><option value="1">Presente</option><option value="0">Faltou</option>
                </select>
                <select style={{ ...input, padding: '5px 8px', fontSize: 13 }} value={c.room_id ?? ''} onChange={e => move(c, e.target.value)} aria-label={`Mover ${c.student_name}`}>
                  <option value="">Sem sala</option>{rooms.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        )
      })}

      {rooms.length > 0 && noRoom.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 800, color: BRAND.ink }}>Sem sala ({noRoom.length})</div>
          {noRoom.sort(byNumber).map((c, i) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${BRAND.line}`, marginTop: i ? 0 : 10, flexWrap: 'wrap' }}>
              <span style={{ width: 44, fontWeight: 800, color: BRAND.primaryDark, fontSize: 13.5 }}>{c.number}</span>
              <span style={{ flex: 1, minWidth: 150, fontSize: 14 }}>{c.student_name} <span style={{ color: BRAND.muted, fontSize: 12.5 }}>· {c.grade}</span></span>
              <select style={{ ...input, padding: '5px 8px', fontSize: 13 }} value="" onChange={e => move(c, e.target.value)} aria-label={`Colocar ${c.student_name} em uma sala`}>
                <option value="">Escolher sala…</option>{rooms.filter(x => !x.grade || x.grade === c.grade).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
