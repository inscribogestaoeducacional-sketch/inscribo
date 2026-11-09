// Página pública do resultado (aberta pelo QR code). Só mostra algo depois que a escola divulga.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Info = { name: string; year: number; school_name: string; logo_url: string | null; primary_color: string | null }
type Res = { ok: boolean; error?: string; not_released?: boolean; student_name?: string; grade?: string; number?: number; contest?: string; hits?: number; total?: number; objective?: number | null; essay?: number | null; has_essay?: boolean; final?: number | null; decision?: string; scholarship_pct?: number | null }
const maskDate = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length <= 2 ? d : d.length <= 4 ? `${d.slice(0, 2)}/${d.slice(2)}` : `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` }

export default function ConcursoResultado() {
  const slug = window.location.pathname.split('/').filter(Boolean)[1] || ''
  const [info, setInfo] = useState<Info | null | undefined>(undefined)
  const [number, setNumber] = useState('')
  const [birth, setBirth] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Res | null>(null)
  useEffect(() => { (supabase as any).rpc('contest_public_get', { p_slug: slug }).then(({ data }: any) => setInfo(data ?? null)) }, [slug])

  const color = info?.primary_color || '#05907B'
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const m = birth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!number.trim() || !m) return setRes({ ok: false, error: 'Informe o número da inscrição e a data de nascimento (dd/mm/aaaa).' })
    setBusy(true)
    const { data } = await (supabase as any).rpc('contest_public_result', { p_slug: slug, p_number: Number(number), p_birth: `${m[3]}-${m[2]}-${m[1]}` })
    setBusy(false); setRes(data ?? { ok: false, error: 'Não foi possível consultar agora. Tente de novo.' })
  }
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #D5DCE6', borderRadius: 12, padding: '12px 13px', fontSize: 16, fontFamily: 'inherit', color: '#1A2B4A', background: '#fff' }

  if (info === undefined) return <div style={{ padding: 60, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
  if (info === null) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: '#475569' }}>Concurso não encontrado.</div>

  const dec = res?.ok ? (res.decision ?? 'pending') : null
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
            <div style={{ background: banner.bg, color: banner.fg, borderRadius: 12, padding: '14px 16px', fontWeight: 800, fontSize: 18 }}>{banner.t}</div>
            {res.final != null ? (
              <div style={{ display: 'grid', gridTemplateColumns: res.has_essay ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8, marginTop: 14 }}>
                <Box t="Prova objetiva" v={`${res.hits}/${res.total}`} s={`${res.objective}`} />
                {res.has_essay && <Box t="Redação" v={res.essay != null ? `${res.essay}` : 'em correção'} s="de 100" />}
                <Box t="Nota final" v={`${res.final}`} s="de 100" strong color={color} />
              </div>
            ) : <div style={{ marginTop: 14, fontSize: 14, color: '#64748B' }}>A prova deste aluno ainda não foi corrigida. Procure a secretaria da escola.</div>}
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
