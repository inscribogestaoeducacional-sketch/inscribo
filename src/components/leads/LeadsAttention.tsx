// Faixa de atenção da tela de Leads: números que são botões (filtram a tela),
// lista de "famílias esperando" e animações. Fonte: RPC lead_waiting (conversas
// do WhatsApp) — o mesmo critério para todos os números.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarCheck, ClipboardList, MessageCircle, Trophy, UserX, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

export type Waiting = { lead_id: string; side: 'us' | 'family' | null; since: string; last_text: string | null; conversation_id: string | null }
export type AttentionKey = 'us' | 'family' | 'visits' | 'enrolled' | 'incomplete'

export function useLeadWaiting(institutionId: string | null | undefined) {
  const [map, setMap] = useState<Map<string, Waiting>>(new Map())
  const refresh = useCallback(async () => {
    if (!institutionId) return
    const { data, error } = await supabase.rpc('lead_waiting', { p_institution_id: institutionId })
    if (error) { console.error('[lead_waiting]', error); return }
    setMap(new Map(((data ?? []) as Waiting[]).filter(w => w.side).map(w => [w.lead_id, w])))
  }, [institutionId])
  useEffect(() => { refresh(); const t = setInterval(refresh, 120000); return () => clearInterval(t) }, [refresh])
  return { waiting: map, refresh }
}

export function daysSince(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) }
export function waitLabel(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (h < 1) return 'agora há pouco'
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} dia${d === 1 ? '' : 's'}`
}

// Número que "sobe" até o valor (animação leve).
function CountUp({ value }: { value: number }) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = from.current, t0 = performance.now(), dur = 650
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      setV(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step); else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{v}</>
}

export const LEADS_CSS = `
@keyframes ldFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ldPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.35)}50%{box-shadow:0 0 0 7px rgba(239,68,68,0)}}
@keyframes ldPop{0%{transform:scale(.96)}60%{transform:scale(1.02)}100%{transform:scale(1)}}
.ld-in{animation:ldFadeUp .35s ease both}
.ld-card{transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease}
.ld-card:hover{transform:translateY(-2px);box-shadow:0 10px 22px -12px rgba(0,122,110,.45)}
.ld-kpi{transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease;cursor:pointer;text-align:left;font-family:inherit}
.ld-kpi:hover{transform:translateY(-2px);box-shadow:0 10px 22px -14px rgba(26,43,74,.35)}
.ld-kpi:active{transform:scale(.98)}
.ld-kpi[data-on="1"]{animation:ldPop .25s ease;border-color:${BRAND.primary}}
.ld-alert{animation:ldPulse 2.2s ease-in-out infinite}
.ld-row{transition:background .12s ease}
.ld-row:hover{background:#F3FAF9}
@media (prefers-reduced-motion: reduce){.ld-in,.ld-alert,.ld-kpi[data-on="1"]{animation:none}.ld-card,.ld-kpi{transition:none}}
`

export interface StripCounts { us: number; family: number; visits: number; todayVisits: number; enrolled: number; incomplete: number }

export function AttentionStrip({ counts, active, onPick }: { counts: StripCounts; active: AttentionKey | null; onPick: (k: AttentionKey | null) => void }) {
  const items: { key: AttentionKey; label: string; value: number; sub: string; color: string; icon: any; alert?: boolean }[] = [
    { key: 'us', label: 'Sem resposta nossa', value: counts.us, sub: 'famílias esperando a escola', color: '#B91C1C', icon: AlertCircle, alert: counts.us > 0 },
    { key: 'family', label: 'Sem retorno da família', value: counts.family, sub: 'esperando a família responder', color: '#B45309', icon: UserX },
    { key: 'visits', label: 'Visitas da semana', value: counts.visits, sub: counts.todayVisits ? `${counts.todayVisits} hoje` : 'nenhuma hoje', color: '#6366F1', icon: CalendarCheck },
    { key: 'enrolled', label: 'Matrículas no mês', value: counts.enrolled, sub: 'leads que matricularam', color: '#00695F', icon: Trophy },
    { key: 'incomplete', label: 'Dados incompletos', value: counts.incomplete, sub: 'sem série, origem ou atendente', color: '#5B6B86', icon: ClipboardList },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 12 }}>
      {items.map((it, i) => {
        const on = active === it.key
        const Icon = it.icon
        return (
          <button key={it.key} type="button" className={`ld-kpi ld-in ${it.alert && !on ? 'ld-alert' : ''}`} data-on={on ? '1' : '0'}
            onClick={() => onPick(on ? null : it.key)} aria-pressed={on} style={{
              animationDelay: `${i * 60}ms`, position: 'relative', overflow: 'hidden', background: on ? `${it.color}0D` : '#fff', borderRadius: 18, padding: '14px 14px 13px',
              border: `1.5px solid ${on ? it.color : it.alert ? '#FCA5A5' : '#E3E8F0'}`, display: 'flex', flexDirection: 'column', gap: 6,
              boxShadow: on ? `0 10px 24px -14px ${it.color}` : '0 1px 2px rgba(26,43,74,.04)',
            }}>
            <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: it.color, opacity: on || it.alert ? 1 : .55 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink, lineHeight: 1.2 }}>{it.label}</span>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: `${it.color}14`, color: it.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} /></span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: it.alert ? '#B91C1C' : BRAND.ink, lineHeight: 1, letterSpacing: '-.02em' }}><CountUp value={it.value} /></div>
            <div style={{ fontSize: 11.5, color: BRAND.muted, lineHeight: 1.3 }}>{it.sub}</div>
          </button>
        )
      })}
    </div>
  )
}

export interface WaitingRow { id: string; name: string; sub: string; initials: string; w: Waiting; phone?: string | null }

// Lista direta das famílias (mais antigas primeiro). Clicar na linha abre a conversa.
export function WaitingList({ title, color, rows, onOpenChat, onOpenLead, onClose }: {
  title: string; color: string; rows: WaitingRow[]
  onOpenChat: (r: WaitingRow) => void; onOpenLead: (r: WaitingRow) => void; onClose: () => void
}) {
  const sorted = useMemo(() => [...rows].sort((a, b) => +new Date(a.w.since) - +new Date(b.w.since)), [rows])
  return (
    <div className="ld-in" style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EEF2F1' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>{title} <span style={{ color }}>({rows.length})</span></span>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, color: '#5B6B86', display: 'flex', alignItems: 'center', gap: 4 }}><X size={14} />Limpar filtro</button>
      </div>
      {sorted.length === 0 && <div style={{ padding: 22, textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>Ninguém aqui. Tudo em dia.</div>}
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {sorted.map((r, i) => {
          const d = daysSince(r.w.since)
          const hot = d >= 2
          return (
            <div key={r.id} className="ld-row ld-in" onClick={() => onOpenChat(r)} style={{ animationDelay: `${Math.min(i, 12) * 25}ms`, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid #F1F5F4', cursor: 'pointer' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#D1FAE5', color: '#00695F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{r.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1A2B4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name} <span style={{ fontWeight: 400, color: '#5B6B86' }}>· {r.sub}</span></div>
                {r.w.last_text && <div style={{ fontSize: 12, color: '#5B6B86', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“{r.w.last_text}”</div>}
              </div>
              <span style={{ background: hot ? '#FEE2E2' : '#FEF3C7', color: hot ? '#B91C1C' : '#B45309', fontSize: 11.5, padding: '2px 9px', borderRadius: 99, fontWeight: 700, whiteSpace: 'nowrap' }}>{waitLabel(r.w.since)}</span>
              <button type="button" title="Abrir ficha do lead" onClick={e => { e.stopPropagation(); onOpenLead(r) }} style={{ border: '1px solid #E3E8F0', background: '#fff', borderRadius: 9, padding: '5px 9px', fontSize: 12, color: '#1A2B4A', cursor: 'pointer', fontWeight: 600 }}>Ficha</button>
              <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: 12, padding: '5px 10px', borderRadius: 9, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><MessageCircle size={13} />Conversa</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
