// Linha do tempo completa do lead: etapas (inclusive as automáticas), visitas,
// ações da equipe, anotações de contato e a conversa do WhatsApp — tudo numa
// lista só, vinda da RPC lead_timeline.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

interface Ev { at: string; kind: string; title: string; detail: string | null; who: string | null; extra: string | null }

const STAGE: Record<string, string> = { new: 'Novo', contact: 'Contato', scheduled: 'Agendado', visit: 'Visita', proposal: 'Proposta', enrolled: 'Matriculado', lost: 'Perdido' }
const KIND: Record<string, { color: string; label: string }> = {
  acao: { color: '#6366F1', label: 'Equipe' },
  etapa: { color: '#05907B', label: 'Etapa' },
  visita: { color: '#8B5CF6', label: 'Visita' },
  visita_baixa: { color: '#8B5CF6', label: 'Visita' },
  msg: { color: '#15803D', label: 'WhatsApp' },
}
const FILTERS = [['all', 'Tudo'], ['etapa', 'Etapas'], ['visita', 'Visitas'], ['acao', 'Equipe'], ['msg', 'Conversa']] as const

const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const stageName = (s: string) => STAGE[s] ?? s

function etapaText(d: string | null) {
  if (!d) return ''
  const [a, b] = d.split(' → ')
  return b ? `${a === '—' ? '—' : stageName(a)} → ${stageName(b)}` : stageName(d)
}

export default function LeadTimeline({ leadId, refreshKey }: { leadId: string; refreshKey?: number }) {
  const [rows, setRows] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [f, setF] = useState<(typeof FILTERS)[number][0]>('all')

  useEffect(() => {
    let alive = true
    setLoading(true); setErr('')
    supabase.rpc('lead_timeline', { p_lead: leadId, p_msgs: 150 }).then(({ data, error }) => {
      if (!alive) return
      if (error) { setErr('Não consegui carregar o histórico.'); setRows([]) } else setRows((data ?? []) as Ev[])
      setLoading(false)
    })
    return () => { alive = false }
  }, [leadId, refreshKey])

  const shown = useMemo(() => rows.filter(r => f === 'all' || (f === 'visita' ? r.kind.startsWith('visita') : r.kind === f)), [rows, f])

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setF(k)} style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${f === k ? BRAND.primary : BRAND.line}`, background: f === k ? BRAND.soft : '#fff', color: f === k ? BRAND.primaryDark : BRAND.muted }}>{l}</button>
        ))}
      </div>
      {loading && <div style={{ textAlign: 'center', padding: 28 }}><div className="animate-spin rounded-full h-7 w-7 border-4 border-[#05907B] border-t-transparent mx-auto" /></div>}
      {!loading && err && <div style={{ textAlign: 'center', padding: 24, color: BRAND.danger, fontSize: 13 }}>{err}</div>}
      {!loading && !err && shown.length === 0 && <div style={{ textAlign: 'center', padding: 28, color: BRAND.faint, fontSize: 13 }}>Nada registrado ainda.</div>}
      {!loading && !err && shown.length > 0 && (
        <div style={{ position: 'relative', paddingLeft: 26 }}>
          <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: BRAND.line, borderRadius: 1 }} />
          {shown.map((e, i) => {
            const k = KIND[e.kind] ?? KIND.acao
            const msg = e.kind === 'msg'
            const mine = msg && e.extra === 'out'
            const detail = e.kind === 'etapa' ? etapaText(e.detail) : e.detail
            const auto = e.kind === 'etapa' && (e.extra ?? '').startsWith('auto')
            return (
              <div key={i} className="ld-in" style={{ position: 'relative', marginBottom: 8, animationDelay: `${Math.min(i, 10) * 20}ms` }}>
                <span style={{ position: 'absolute', left: -23, top: 12, width: 11, height: 11, borderRadius: '50%', background: k.color, border: '2.5px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.18)' }} />
                <div style={{ background: msg ? (mine ? '#F0FDF4' : '#F8FAFC') : '#fff', border: `1px solid ${BRAND.line}`, borderLeft: `3px solid ${k.color}`, borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink }}>{e.title}{auto ? ' · automático' : ''}</span>
                    <span style={{ fontSize: 10.5, color: BRAND.faint, whiteSpace: 'nowrap' }}>{fmt(e.at)}</span>
                  </div>
                  {detail && <p style={{ fontSize: 12.5, color: BRAND.text, margin: '3px 0 0', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detail}</p>}
                  <span style={{ fontSize: 11, color: BRAND.faint }}>{k.label}{e.who ? ` · ${e.who}` : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
