// Página pública do Concurso de Bolsas (/bolsas/:slug): edital + inscrição. Sem login.
import { useEffect, useState } from 'react'
import { CalendarDays, MapPin, GraduationCap, CheckCircle2, Loader2, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Field = { id: string; label: string; type: 'text' | 'select'; options?: string[]; required?: boolean }
type Info = {
  name: string; year: number; status: string; exam_date: string | null; location: string | null; grades: string[]
  edital: string | null; extra_fields: Field[]; deadline: string | null; open: boolean
  school_name: string; logo_url: string | null; primary_color: string | null; city: string | null
}

const fmt = (s: string | null, time = false) => s ? new Date(s).toLocaleString('pt-BR', time ? { dateStyle: 'long', timeStyle: 'short' } : { dateStyle: 'long' }) : ''
const maskCpf = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2') }
const maskPhone = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 11); return d.length <= 2 ? d : d.length <= 7 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` }

export default function ConcursoPublico() {
  const slug = window.location.pathname.split('/').filter(Boolean)[1] || ''
  const [info, setInfo] = useState<Info | null | undefined>(undefined)
  const [f, setF] = useState({ student_name: '', grade: '', birth_date: '', student_cpf: '', responsible_name: '', phone: '', email: '', origin_school: '' })
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [lgpd, setLgpd] = useState(false)
  const [publish, setPublish] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ number: number } | null>(null)
  const [showEdital, setShowEdital] = useState(false)

  useEffect(() => {
    (supabase as any).rpc('contest_public_get', { p_slug: slug }).then(({ data }: any) => setInfo(data ?? null))
  }, [slug])

  const color = info?.primary_color || '#05907B'
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    for (const x of info!.extra_fields) if (x.required && !answers[x.id]?.trim()) return setErr(`Responda: ${x.label}`)
    setBusy(true)
    const { data, error } = await (supabase as any).rpc('contest_public_register', { p_slug: slug, p_data: { ...f, answers, lgpd, publish_names: publish } })
    setBusy(false)
    if (error || !data?.ok) return setErr(data?.error || 'Não foi possível enviar agora. Tente de novo.')
    setDone({ number: data.number })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #D5DCE6', borderRadius: 12, padding: '12px 13px', fontSize: 16, fontFamily: 'inherit', color: '#1A2B4A', background: '#fff' }
  const lab: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', margin: '14px 0 6px' }

  if (info === undefined) return <div style={{ padding: 60, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
  if (info === null) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: '#475569' }}>Este concurso não foi encontrado ou ainda não está disponível.</div>

  return (
    <div style={{ minHeight: '100vh', background: '#F6F8FB', fontFamily: 'Inter, system-ui, sans-serif', color: '#1A2B4A' }}>
      <header style={{ background: color, color: '#fff', padding: '28px 18px 56px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {info.logo_url && <img src={info.logo_url} alt="" style={{ width: 46, height: 46, borderRadius: 12, background: '#fff', objectFit: 'contain', padding: 4 }} />}
            <div style={{ fontWeight: 700, fontSize: 15, opacity: .95 }}>{info.school_name}</div>
          </div>
          <h1 style={{ margin: '22px 0 6px', fontSize: 30, lineHeight: 1.15, fontWeight: 800, color: '#fff' }}>{info.name}</h1>
          <div style={{ opacity: .92, fontSize: 15 }}>Bolsas de estudo para {info.year}</div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '-32px auto 40px', padding: '0 14px' }}>
        <section style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 8px 30px -14px rgba(15,23,42,.25)', display: 'grid', gap: 12 }}>
          {info.exam_date && <Row icon={<CalendarDays size={18} color={color} />} t="Dia da prova" v={fmt(info.exam_date, true)} />}
          {info.location && <Row icon={<MapPin size={18} color={color} />} t="Local" v={info.location} />}
          {info.grades.length > 0 && <Row icon={<GraduationCap size={18} color={color} />} t="Séries" v={info.grades.join(', ')} />}
          {info.deadline && <Row icon={<CalendarDays size={18} color={color} />} t="Inscrições até" v={fmt(info.deadline, true)} />}
          {info.edital && (
            <div>
              <button type="button" onClick={() => setShowEdital(s => !s)} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', border: `1px solid ${color}`, color, background: '#fff', borderRadius: 12, padding: '10px 14px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                <FileText size={16} /> {showEdital ? 'Esconder o edital' : 'Ler o edital'}
              </button>
              {showEdital && <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.6, marginTop: 12, color: '#334155' }}>{info.edital}</div>}
            </div>
          )}
        </section>

        {done ? (
          <section style={{ background: '#fff', borderRadius: 18, padding: 24, marginTop: 16, textAlign: 'center', boxShadow: '0 8px 30px -14px rgba(15,23,42,.25)' }}>
            <CheckCircle2 size={44} color={color} />
            <h2 style={{ margin: '10px 0 4px', fontSize: 22, fontWeight: 800, color: '#1A2B4A' }}>Inscrição feita!</h2>
            <div style={{ color: '#475569', fontSize: 15 }}>Número de inscrição</div>
            <div style={{ fontSize: 40, fontWeight: 800, color, letterSpacing: 1 }}>{done.number}</div>
            <p style={{ color: '#475569', fontSize: 14.5, lineHeight: 1.55, margin: '10px 0 0' }}>Guarde este número. A escola envia as orientações da prova para o contato informado.</p>
          </section>
        ) : !info.open ? (
          <section style={{ background: '#fff', borderRadius: 18, padding: 22, marginTop: 16, textAlign: 'center', color: '#475569' }}>
            {info.status === 'published' ? 'O resultado deste concurso será divulgado pela escola.' : 'As inscrições estão encerradas.'}
          </section>
        ) : (
          <form onSubmit={submit} style={{ background: '#fff', borderRadius: 18, padding: '8px 18px 20px', marginTop: 16, boxShadow: '0 8px 30px -14px rgba(15,23,42,.25)' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1A2B4A', margin: '14px 0 0' }}>Faça a inscrição</h2>
            <label style={lab}>Nome completo do aluno</label>
            <input style={input} required value={f.student_name} onChange={set('student_name')} autoComplete="off" />
            <label style={lab}>Série em 2027</label>
            <select style={input} required value={f.grade} onChange={set('grade')}>
              <option value="">Escolha</option>{info.grades.map(g => <option key={g}>{g}</option>)}
            </select>
            <label style={lab}>Data de nascimento do aluno</label>
            <input style={input} type="date" required value={f.birth_date} onChange={set('birth_date')} />
            <label style={lab}>CPF do aluno</label>
            <input style={input} required inputMode="numeric" placeholder="000.000.000-00" value={f.student_cpf} onChange={e => setF({ ...f, student_cpf: maskCpf(e.target.value) })} />
            <label style={lab}>Nome do responsável</label>
            <input style={input} required value={f.responsible_name} onChange={set('responsible_name')} autoComplete="name" />
            <label style={lab}>WhatsApp do responsável</label>
            <input style={input} required inputMode="tel" placeholder="(83) 90000-0000" value={f.phone} onChange={e => setF({ ...f, phone: maskPhone(e.target.value) })} autoComplete="tel" />
            <label style={lab}>E-mail do responsável</label>
            <input style={input} type="email" required value={f.email} onChange={set('email')} autoComplete="email" />
            <label style={lab}>Escola onde estuda hoje</label>
            <input style={input} required value={f.origin_school} onChange={set('origin_school')} />
            {info.extra_fields.map(x => (
              <div key={x.id}>
                <label style={lab}>{x.label}{!x.required && <span style={{ fontWeight: 500 }}> (opcional)</span>}</label>
                {x.type === 'select'
                  ? <select style={input} value={answers[x.id] ?? ''} onChange={e => setAnswers({ ...answers, [x.id]: e.target.value })}><option value="">Escolha</option>{(x.options ?? []).map(o => <option key={o}>{o}</option>)}</select>
                  : <input style={input} value={answers[x.id] ?? ''} onChange={e => setAnswers({ ...answers, [x.id]: e.target.value })} />}
              </div>
            ))}
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18, fontSize: 13.5, lineHeight: 1.5, color: '#334155' }}>
              <input type="checkbox" checked={lgpd} onChange={e => setLgpd(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
              <span>Autorizo a {info.school_name} a usar os dados informados para organizar o concurso e entrar em contato comigo (LGPD).</span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 10, fontSize: 13.5, lineHeight: 1.5, color: '#334155' }}>
              <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
              <span>Autorizo divulgar o nome do aluno na lista de resultados, se ele for contemplado com bolsa. <i>(opcional)</i></span>
            </label>
            {err && <div style={{ color: '#B91C1C', fontSize: 14, marginTop: 14 }}>{err}</div>}
            <button type="submit" disabled={busy || !lgpd} style={{ width: '100%', marginTop: 18, padding: '14px 16px', borderRadius: 14, border: 0, background: color, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: busy || !lgpd ? .6 : 1, fontFamily: 'inherit' }}>
              {busy ? 'Enviando…' : 'Inscrever'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}

function Row({ icon, t, v }: { icon: React.ReactNode; t: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div><div style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B' }}>{t}</div><div style={{ fontSize: 15.5, fontWeight: 600 }}>{v}</div></div>
    </div>
  )
}
