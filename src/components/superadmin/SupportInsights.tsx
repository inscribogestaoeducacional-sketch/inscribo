import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { LESSONS } from '../../lib/academy/academyContent'

// Painel do suporte: o que as pessoas perguntam, o que a assistente resolveu, o que ficou sem aula e foi para a equipe.
interface Insights {
  dias: number; conversas: number; perguntas: number; ia: number; sem_aula: number; equipe: number
  aulas: { aula: string; n: number }[]; palavras: { palavra: string; n: number }[]
  recentes: { at: string; thread: string; pergunta: string; resultado: 'ia' | 'sem_aula' | 'equipe' | 'outro'; escola: string | null; pessoa: string | null; route: string | null }[]
}
const RES: Record<string, { label: string; bg: string; fg: string }> = {
  ia: { label: 'Assistente respondeu', bg: '#DCFCE7', fg: '#15803D' },
  sem_aula: { label: 'Sem aula sobre isso', bg: '#FEF3C7', fg: '#92400E' },
  equipe: { label: 'Foi para a equipe', bg: '#FEE2E2', fg: '#B91C1C' },
  outro: { label: 'Outro', bg: '#E2E8F0', fg: '#475569' },
}
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: '14px 16px' }
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const titleOf = (k: string) => LESSONS.find(l => l.key === k)?.title || k

export default function SupportInsights() {
  const [days, setDays] = useState(30)
  const [d, setD] = useState<Insights | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'todas' | 'sem_aula' | 'equipe'>('todas')
  useEffect(() => {
    let alive = true
    setD(null); setErr('')
    supabase.rpc('support_insights', { p_days: days }).then(({ data, error }) => { if (!alive) return; if (error) setErr('Não foi possível carregar o painel.'); else setD(data as Insights) })
    return () => { alive = false }
  }, [days])

  const chip = (on: boolean): React.CSSProperties => ({ border: 'none', borderRadius: 99, padding: '7px 14px', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: on ? BRAND.primary : '#EEF3F2', color: on ? '#fff' : BRAND.muted })
  if (err) return <div style={{ padding: 12, borderRadius: 14, background: BRAND.dangerSoft, color: BRAND.danger, fontSize: 14 }}>{err}</div>
  if (!d) return <div style={{ display: 'flex', gap: 8, color: BRAND.muted, padding: 16 }}><Loader2 size={18} className="animate-spin" /> Carregando…</div>
  const pctIa = d.perguntas ? Math.round(d.ia / d.perguntas * 100) : 0
  const maxA = Math.max(1, ...d.aulas.map(a => a.n)), maxW = Math.max(1, ...d.palavras.map(w => w.n))
  const shown = d.recentes.filter(r => filter === 'todas' || r.resultado === filter)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[7, 30, 90].map(n => <button key={n} type="button" style={chip(days === n)} onClick={() => setDays(n)}>Últimos {n} dias</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {([
          ['Perguntas feitas', d.perguntas, `em ${d.conversas} conversas`, BRAND.ink],
          ['Assistente respondeu', d.ia, `${pctIa}% das perguntas`, '#15803D'],
          ['Sem aula sobre isso', d.sem_aula, 'faltou conteúdo na Academia', '#B45309'],
          ['Foram para a equipe', d.equipe, 'conversas chamadas', '#B91C1C'],
        ] as [string, number, string, string][]).map(([t, n, sub, c]) => (
          <div key={t} style={{ ...card, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.muted }}>{t}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c, lineHeight: 1.15 }}>{n}</div>
            <div style={{ fontSize: 12, color: BRAND.muted }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Assuntos mais perguntados</div>
          {d.aulas.length === 0 && <div style={{ fontSize: 13, color: BRAND.muted }}>Ainda não há perguntas respondidas neste período.</div>}
          {d.aulas.map(a => (
            <div key={a.aula} style={{ margin: '7px 0' }}>
              <div style={{ display: 'flex', gap: 8, fontSize: 13, color: BRAND.text }}><span style={{ flex: 1, minWidth: 0 }}>{titleOf(a.aula)}</span><b>{a.n}</b></div>
              <div style={{ height: 6, borderRadius: 4, background: '#EEF3F2', marginTop: 3 }}><div style={{ height: 6, borderRadius: 4, width: `${a.n / maxA * 100}%`, background: BRAND.primary }} /></div>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Palavras mais usadas</div>
          {d.palavras.length === 0 && <div style={{ fontSize: 13, color: BRAND.muted }}>Sem dados ainda.</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {d.palavras.map(w => <span key={w.palavra} style={{ padding: '5px 10px', borderRadius: 99, background: BRAND.soft, color: BRAND.primaryDark, fontSize: 12.5 + Math.round(w.n / maxW * 2), fontWeight: 800 }}>{w.palavra} · {w.n}</span>)}
          </div>
        </div>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, flex: 1 }}>O que estão perguntando</div>
          <button type="button" style={chip(filter === 'todas')} onClick={() => setFilter('todas')}>Todas</button>
          <button type="button" style={chip(filter === 'sem_aula')} onClick={() => setFilter('sem_aula')}>Sem aula</button>
          <button type="button" style={chip(filter === 'equipe')} onClick={() => setFilter('equipe')}>Foram para a equipe</button>
        </div>
        <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 6 }}>As perguntas "sem aula" mostram o que falta ensinar na Academia.</div>
        {shown.length === 0 && <div style={{ fontSize: 13, color: BRAND.muted, padding: '10px 0' }}>Nenhuma pergunta aqui.</div>}
        {shown.map((r, i) => (
          <div key={i} style={{ padding: '9px 0', borderTop: `1px solid ${BRAND.line}` }}>
            <div style={{ fontSize: 14, color: BRAND.ink, fontWeight: 700, wordBreak: 'break-word' }}>{r.pergunta}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 3, fontSize: 12, color: BRAND.muted }}>
              <span style={{ padding: '1px 8px', borderRadius: 99, fontWeight: 800, background: RES[r.resultado].bg, color: RES[r.resultado].fg }}>{RES[r.resultado].label}</span>
              <span>{r.escola || 'Escola'} · {r.pessoa || 'Pessoa'}{r.route ? ` · ${r.route}` : ''} · {when(r.at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
