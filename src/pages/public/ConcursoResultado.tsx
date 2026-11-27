// Página pública do resultado (aberta pelo QR code). Só mostra algo depois que a escola divulga.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const LET = 'ABCDE'
const ST: Record<string, { t: string; bg: string; fg: string }> = {
  hit: { t: 'Acertou', bg: '#D1FAE5', fg: '#047857' }, miss: { t: 'Errou', bg: '#FEE2E2', fg: '#B91C1C' },
  blank: { t: 'Em branco', bg: '#F1F5F9', fg: '#475569' }, annulled: { t: 'Anulada', bg: '#FEF3C7', fg: '#B45309' },
}

type Info = { name: string; year: number; school_name: string; logo_url: string | null; primary_color: string | null }
type Res = { ok: boolean; error?: string; not_released?: boolean; student_name?: string; grade?: string; number?: number; contest?: string; hits?: number; total?: number; objective?: number | null; essay?: number | null; has_essay?: boolean; final?: number | null; decision?: string | null; scholarship_pct?: number | null; stage?: number; position?: number | null; position_of?: number | null; questions?: Q[]; corrected?: boolean; vis?: { questions?: boolean; objective?: boolean; essay?: boolean; final?: boolean; position?: boolean; scholarship?: boolean } }
type Q = { n: number; subject: string | null; mine: string | null; correct: string; status: 'hit' | 'miss' | 'blank' | 'annulled'; mode?: string | null; statement: string; images: string[]; alternatives: string[] }
const maskDate = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length <= 2 ? d : d.length <= 4 ? `${d.slice(0, 2)}/${d.slice(2)}` : `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` }

export default function ConcursoResultado() {
  const slug = window.location.pathname.split('/').filter(Boolean)[1] || ''
  const [info, setInfo] = useState<Info | null | undefined>(undefined)
  const [number, setNumber] = useState('')
  const [birth, setBirth] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Res | null>(null)
  const [view, setView] = useState<'questoes' | 'espelho'>('questoes')
  const [media, setMedia] = useState<Record<string, string>>({})
  const [scans, setScans] = useState<{ card: string | null; essay: string | null }>({ card: null, essay: null })
  useEffect(() => { (supabase as any).rpc('contest_public_get', { p_slug: slug }).then(({ data }: any) => setInfo(data ?? null)) }, [slug])

  const color = info?.primary_color || '#05907B'
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const m = birth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!number.trim() || !m) return setRes({ ok: false, error: 'Informe o número da inscrição e a data de nascimento (dd/mm/aaaa).' })
    setBusy(true)
    const { data } = await (supabase as any).rpc('contest_public_result', { p_slug: slug, p_number: Number(number), p_birth: `${m[3]}-${m[2]}-${m[1]}` })
    setBusy(false); setRes(data ?? { ok: false, error: 'Não foi possível consultar agora. Tente de novo.' })
    if (data?.ok) {
      setScans({ card: null, essay: null })
      ;(supabase as any).functions.invoke('contest-result-media', { body: { slug, number: Number(number), birth: `${m[3]}-${m[2]}-${m[1]}` } }).then(({ data: md }: any) => { setMedia(md?.urls ?? {}); setScans({ card: md?.card ?? null, essay: md?.essay ?? null }) }).catch(() => {})
    }
  }
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #D5DCE6', borderRadius: 12, padding: '12px 13px', fontSize: 16, fontFamily: 'inherit', color: '#1A2B4A', background: '#fff' }

  if (info === undefined) return <div style={{ padding: 60, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
  if (info === null) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: '#475569' }}>Concurso não encontrado.</div>

  const stage = res?.stage ?? 3
  const dec = res?.ok && stage >= 3 && res.vis?.scholarship !== false ? (res.decision ?? 'pending') : null
  const banner = dec === 'granted' ? { bg: '#D1FAE5', fg: '#047857', t: `Parabéns! Bolsa de ${res!.scholarship_pct}%` }
    : dec === 'waitlist' ? { bg: '#FEF3C7', fg: '#B45309', t: 'Lista de espera' }
    : dec === 'denied' ? { bg: '#F1F5F9', fg: '#475569', t: 'Sem bolsa neste concurso' }
    : { bg: '#E0E7FF', fg: '#3730A3', t: 'Decisão da bolsa em análise' }

  return (
    <div style={{ minHeight: '100vh', background: '#F6F8FB', fontFamily: 'Inter, system-ui, sans-serif', color: '#1A2B4A' }}>
      <header style={{ background: color, color: '#fff', padding: '26px 18px 54px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {info.logo_url && <img src={info.logo_url} alt="" style={{ width: 46, height: 46, borderRadius: 12, background: '#fff', objectFit: 'contain', padding: 4 }} />}
            <div style={{ fontWeight: 700, fontSize: 15 }}>{info.school_name}</div>
          </div>
          <h1 style={{ margin: '20px 0 4px', fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.15 }}>Resultado — {info.name}</h1>
        </div>
      </header>
      <main style={{ maxWidth: 560, margin: '-30px auto 40px', padding: '0 14px' }}>
        {!res?.ok && (
          <form onSubmit={submit} style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 8px 30px -14px rgba(15,23,42,.25)', display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 14.5, color: '#475569' }}>Digite os dados da inscrição para ver o resultado.</div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Número da inscrição<input style={{ ...input, marginTop: 6 }} inputMode="numeric" value={number} onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} /></label>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Data de nascimento do aluno<input style={{ ...input, marginTop: 6 }} inputMode="numeric" placeholder="dd/mm/aaaa" value={birth} onChange={e => setBirth(maskDate(e.target.value))} /></label>
            {res && !res.ok && <div role="alert" style={{ color: res.not_released ? '#3730A3' : '#B91C1C', background: res.not_released ? '#E0E7FF' : '#FEF2F2', borderRadius: 10, padding: '10px 12px', fontSize: 14 }}>{res.error}</div>}
            <button disabled={busy} style={{ background: color, color: '#fff', border: 0, borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? 'Consultando…' : 'Ver resultado'}</button>
          </form>
        )}
        {res?.ok && (
          <section style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 8px 30px -14px rgba(15,23,42,.25)' }}>
            <div style={{ fontSize: 13, color: '#64748B' }}>Inscrição nº {res.number} · {res.grade}</div>
            <div style={{ fontSize: 22, fontWeight: 800, margin: '2px 0 14px' }}>{res.student_name}</div>
            {dec && <div style={{ background: banner.bg, color: banner.fg, borderRadius: 12, padding: '14px 16px', fontWeight: 800, fontSize: 18 }}>{banner.t}</div>}
            {res.position != null && <div style={{ marginTop: 10, border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 14px', fontWeight: 800 }}>Colocação: {res.position}º lugar <span style={{ fontWeight: 600, color: '#64748B' }}>de {res.position_of} na {res.grade}</span></div>}
            {(() => {
              const showObj = res.vis?.objective !== false && res.objective != null
              const showEssay = stage >= 2 && !!res.has_essay
              const showFinal = stage >= 2 && res.final != null && !(res.has_essay && res.essay == null)
              const n = (showObj ? 1 : 0) + (showEssay ? 1 : 0) + (showFinal ? 1 : 0)
              if (res.corrected === false || (res.corrected === undefined && res.objective == null)) return <div style={{ marginTop: 14, fontSize: 14, color: '#64748B' }}>A prova deste aluno ainda não foi corrigida. Procure a secretaria da escola.</div>
              if (!n) return null
              return (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n},1fr)`, gap: 8, marginTop: 14 }}>
                  {showObj && <Box t="Prova objetiva" v={`${res.hits}/${res.total}`} s={`${res.objective} de 100`} />}
                  {showEssay && <Box t="Redação" v={res.essay != null ? `${res.essay}` : 'em correção'} s="de 100" />}
                  {showFinal && <Box t="Nota final" v={`${res.final}`} s="de 100" strong color={color} />}
                </div>
              )
            })()}
            {stage < 3 && <div style={{ marginTop: 12, fontSize: 13, color: '#3730A3', background: '#E0E7FF', borderRadius: 10, padding: '9px 12px' }}>{stage < 2 ? 'A nota da redação, a nota final, a colocação e a bolsa serão liberadas em breve.' : 'A colocação e a decisão da bolsa serão liberadas em breve.'}</div>}
            {!!res.questions?.length && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {([['questoes', 'Questões'], ['espelho', 'Espelho do gabarito']] as const).map(([k, t]) => (
                    <button key={k} onClick={() => setView(k)} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `1px solid ${view === k ? color : '#D5DCE6'}`, background: view === k ? color : '#fff', color: view === k ? '#fff' : '#1A2B4A', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>{t}</button>
                  ))}
                </div>
                {view === 'espelho' ? (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr 1.2fr', background: '#F1F5F9', fontSize: 12, fontWeight: 800, color: '#475569', padding: '8px 10px' }}><span>Nº</span><span>Você marcou</span><span>Gabarito</span><span>Resultado</span></div>
                    {res.questions.map(q => (
                      <div key={q.n} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr 1.2fr', alignItems: 'center', padding: '7px 10px', borderTop: '1px solid #EEF2F6', fontSize: 14 }}>
                        <b>{q.n}</b><span>{q.mine ?? '—'}</span><b>{q.correct}</b>
                        <span style={{ background: ST[q.status].bg, color: ST[q.status].fg, borderRadius: 99, padding: '2px 8px', fontSize: 12.5, fontWeight: 800, justifySelf: 'start' }}>{ST[q.status].t}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {res.questions.map(q => (
                      <details key={q.n} style={{ border: `1px solid ${ST[q.status].bg}`, borderRadius: 12, padding: '10px 12px' }}>
                        <summary style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontWeight: 800, fontSize: 14.5 }}>
                          <span>Questão {q.n}</span>{q.subject && <span style={{ fontWeight: 600, color: '#64748B', fontSize: 13 }}>{q.subject}</span>}
                          <span style={{ marginLeft: 'auto', background: ST[q.status].bg, color: ST[q.status].fg, borderRadius: 99, padding: '2px 9px', fontSize: 12.5 }}>{ST[q.status].t}</span>
                        </summary>
                        <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{q.statement}</div>
                        {q.images?.map(pth => media[pth] ? <img key={pth} src={media[pth]} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: 320, margin: '10px auto', objectFit: 'contain' }} /> : <div key={pth} style={{ height: 60, background: '#F1F5F9', borderRadius: 8, margin: '10px 0' }} />)}
                        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                          {q.alternatives.map((t, i) => {
                            const L = LET[i], isMine = q.mine === L, isOk = q.correct === L
                            return (
                              <div key={i} style={{ display: 'flex', gap: 8, borderRadius: 10, padding: '8px 10px', border: `1px solid ${isOk ? '#34D399' : isMine ? '#F87171' : '#E2E8F0'}`, background: isOk ? '#ECFDF5' : isMine ? '#FEF2F2' : '#fff', fontSize: 14.5 }}>
                                <b style={{ width: 18 }}>{L}</b><span style={{ flex: 1 }}>{t}</span>
                                {(isOk || isMine) && <span style={{ fontSize: 12, fontWeight: 800, color: isOk ? '#047857' : '#B91C1C', whiteSpace: 'nowrap' }}>{isOk && isMine ? 'Sua resposta · correta' : isOk ? 'Correta' : 'Sua resposta'}</span>}
                              </div>
                            )
                          })}
                        </div>
                        {q.status === 'annulled' && <div style={{ marginTop: 8, fontSize: 13, color: '#B45309', fontWeight: 700 }}>{q.mode === 'remove' ? 'Questão anulada e retirada da prova. Não conta na nota.' : 'Questão anulada. Vale ponto para todos os alunos.'}</div>}
                      </details>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(scans.card || scans.essay) && (
              <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
                {scans.card && <div><div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Seu cartão-resposta</div><div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 6 }}>Foto da folha que o aluno entregou. Toque para ampliar.</div><a href={scans.card} target="_blank" rel="noreferrer"><img src={scans.card} alt="Cartão-resposta do aluno" style={{ width: '100%', borderRadius: 12, border: '1px solid #E2E8F0' }} /></a></div>}
                {scans.essay && <div><div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Sua redação</div><div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 6 }}>Foto da folha de redação do aluno. Toque para ampliar.</div><a href={scans.essay} target="_blank" rel="noreferrer"><img src={scans.essay} alt="Redação do aluno" style={{ width: '100%', borderRadius: 12, border: '1px solid #E2E8F0' }} /></a></div>}
              </div>
            )}
            <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 14 }}>Dúvidas sobre o resultado e a matrícula: fale com a secretaria da escola.</div>
            <button onClick={() => setRes(null)} style={{ marginTop: 12, border: `1px solid ${color}`, color, background: '#fff', borderRadius: 12, padding: '10px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Consultar outra inscrição</button>
          </section>
        )}
      </main>
    </div>
  )
}
function Box({ t, v, s, strong, color }: { t: string; v: string; s: string; strong?: boolean; color?: string }) {
  return <div style={{ border: `1px solid ${strong ? color : '#E2E8F0'}`, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}><div style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>{t}</div><div style={{ fontSize: 22, fontWeight: 800, color: strong ? color : '#1A2B4A' }}>{v}</div><div style={{ fontSize: 11.5, color: '#64748B' }}>{s}{!s.startsWith('d') && s !== '' && !strong ? '%' : ''}</div></div>
}
