// Vitrine — painéis novos: Início (checklist), Desempenho e QR code.
import React, { useEffect, useMemo, useState } from 'react'
import { Check, Download, X, Copy, TrendingUp, TrendingDown, Eye, MousePointerClick, MessageCircle, Users, ChevronRight } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { type BlockType, BLOCK_TYPES, blockSummary } from '../../lib/vitrine'

const TEAL = '#05907B', TEAL_D = '#00695F', NAVY = '#1e2d6b', LINE = '#E3E8F0'
const fmt = (n: number) => n.toLocaleString('pt-BR')
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 18, padding: 16 }
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 10, border: `1px solid ${LINE}`,
  background: '#fff', color: TEAL_D, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

// ───────────────────────── Início ─────────────────────────
export interface StartItem { key: string; label: string; hint?: string; done: boolean; action?: { label: string; onClick: () => void } }
export interface StartProblem { text: string; action?: { label: string; onClick: () => void } }

export function VitrineStart({ items, problems }: { items: StartItem[]; problems: StartProblem[] }) {
  const done = items.filter(i => i.done).length
  const pct = Math.round((done / items.length) * 100)
  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: NAVY }}>{done === items.length ? 'Sua página está completa' : 'Deixe a página pronta para divulgar'}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>{done} de {items.length} passos concluídos</p>
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: TEAL_D }}>{pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#F1F5F9', margin: '12px 0 6px' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg, ${TEAL_D}, ${TEAL})`, transition: 'width .5s ease' }} />
        </div>
        {items.map(i => (
          <div key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid #F1F5F9' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i.done ? '#D1FAE5' : 'transparent', border: i.done ? 'none' : '1.5px dashed #94a3b8', color: '#047857' }}>
              {i.done && <Check size={13} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: i.done ? '#64748b' : NAVY, textDecoration: i.done ? 'line-through' : 'none', textDecorationColor: '#cbd5e1' }}>{i.label}</span>
              {i.hint && !i.done && <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{i.hint}</span>}
            </span>
            {!i.done && i.action && <button type="button" style={ghostBtn} onClick={i.action.onClick}>{i.action.label}</button>}
          </div>
        ))}
      </div>

      {problems.length > 0 && (
        <div style={{ ...card, background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E', marginBottom: 6 }}>Atenção</div>
          {problems.map((p, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#92400E', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 180 }}>{p.text}</span>
              {p.action && <button type="button" style={ghostBtn} onClick={p.action.onClick}>{p.action.label}</button>}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ───────────────────────── QR code ─────────────────────────
export function VitrineQrModal({ url, name, onClose, onCopy }: { url: string; name: string; onClose: () => void; onCopy: () => void }) {
  const [img, setImg] = useState<string | null>(null)
  useEffect(() => {
    QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: '#1A2B4A', light: '#ffffff' } }).then(setImg).catch(() => setImg(null))
  }, [url])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label="QR code da página" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 22, padding: 22, width: 340, maxWidth: '100%', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 16, color: NAVY }}>QR code da Vitrine</b>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ ...ghostBtn, padding: 6 }}><X size={15} /></button>
        </div>
        <div style={{ margin: '14px auto', width: 230, height: 230, borderRadius: 16, border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {img ? <img src={img} alt="QR code que abre a página da escola" style={{ width: 214, height: 214 }} /> : <span style={{ fontSize: 12, color: '#64748b' }}>Gerando…</span>}
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>Quem aponta a câmera abre a página da escola. Use em cartaz, panfleto, cartão e faixa.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {img && <a href={img} download={`qr-vitrine-${name.replace(/\W+/g, '-').toLowerCase()}.png`} style={{ ...ghostBtn, textDecoration: 'none' }}><Download size={13} /> Baixar imagem</a>}
          <button type="button" style={ghostBtn} onClick={onCopy}><Copy size={13} /> Copiar link</button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Desempenho ─────────────────────────
interface Sum { kind: string; label: string; day: string | null; events: number; visitors: number }
interface TStat { trigger_id: string; conversations: number; first_touch_leads: number; first_touch_enrollments: number }

const PERIODS = [{ k: 7, l: '7 dias' }, { k: 30, l: '30 dias' }, { k: 90, l: '90 dias' }] as const

export function VitrinePerformance({ institutionId, blocks }: {
  institutionId: string
  blocks: { id?: string | null; type: BlockType; config: Record<string, any>; capture_trigger_id?: string | null }[]
}) {
  const [days, setDays] = useState<number>(30)
  const [cur, setCur] = useState<Sum[] | null>(null)
  const [prev, setPrev] = useState<Sum[] | null>(null)
  const [blk, setBlk] = useState<{ block_id: string | null; event_type: string; events: number }[]>([])
  const [ts, setTs] = useState<TStat[]>([])
  const [err, setErr] = useState(false)

  const trigIds = useMemo(() => new Set(blocks.map(b => b.capture_trigger_id).filter(Boolean) as string[]), [blocks])

  useEffect(() => {
    let off = false
    setCur(null); setErr(false)
    const end = new Date(Date.now() + 60_000), start = new Date(Date.now() - days * 86400000), pStart = new Date(start.getTime() - days * 86400000)
    const p = { p_institution_id: institutionId }
    Promise.all([
      supabase.rpc('vitrine_summary', { ...p, p_start: start.toISOString(), p_end: end.toISOString() }),
      supabase.rpc('vitrine_summary', { ...p, p_start: pStart.toISOString(), p_end: start.toISOString() }),
      supabase.rpc('vitrine_stats', { ...p, p_start: start.toISOString(), p_end: end.toISOString() }),
      supabase.rpc('capture_trigger_stats', { ...p, p_start: start.toISOString(), p_end: end.toISOString() }),
    ]).then(([a, b, c, d]) => {
      if (off) return
      if (a.error) { setErr(true); return }
      const cast = (x: any[]) => x.map(r => ({ ...r, events: Number(r.events), visitors: Number(r.visitors) })) as Sum[]
      setCur(cast((a.data ?? []) as any[])); setPrev(cast((b.data ?? []) as any[]))
      setBlk(((c.data ?? []) as any[]).map(r => ({ ...r, events: Number(r.events) })))
      setTs(((d.data ?? []) as any[]).map(r => ({ trigger_id: r.trigger_id, conversations: Number(r.conversations), first_touch_leads: Number(r.first_touch_leads), first_touch_enrollments: Number(r.first_touch_enrollments) })))
    })
    return () => { off = true }
  }, [institutionId, days])

  const tot = (rows: Sum[] | null, t: 'view' | 'click') => rows?.find(r => r.kind === 'total' && r.label === t) ?? { events: 0, visitors: 0 }
  const views = tot(cur, 'view'), clicks = tot(cur, 'click'), pViews = tot(prev, 'view'), pClicks = tot(prev, 'click')
  const mine = ts.filter(t => trigIds.has(t.trigger_id))
  const conv = mine.reduce((a, t) => a + t.conversations, 0)
  const leads = mine.reduce((a, t) => a + t.first_touch_leads, 0)
  const enr = mine.reduce((a, t) => a + t.first_touch_enrollments, 0)

  const delta = (c: number, o: number) => {
    if (!prev) return null
    if (o === 0) return c > 0 ? { t: 'novo', up: true } : null
    const d = Math.round(((c - o) / o) * 100)
    return { t: `${d > 0 ? '+' : ''}${d}%`, up: d >= 0 }
  }

  const chart = useMemo(() => {
    if (!cur) return []
    const m = new Map<string, { v: number; c: number }>()
    cur.filter(r => r.kind === 'day' && r.day).forEach(r => {
      const o = m.get(r.day!) || { v: 0, c: 0 }
      if (r.label === 'view') o.v += r.events; else o.c += r.events
      m.set(r.day!, o)
    })
    const out: { d: string; Visitas: number; Cliques: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(Date.now() - 3 * 3600000 - i * 86400000)
      const key = dt.toISOString().slice(0, 10)
      const o = m.get(key)
      out.push({ d: `${key.slice(8, 10)}/${key.slice(5, 7)}`, Visitas: o?.v ?? 0, Cliques: o?.c ?? 0 })
    }
    return out
  }, [cur, days])

  const bars = (label: string, rows: { name: string; v: number }[], color = TEAL) => {
    const max = Math.max(1, ...rows.map(r => r.v))
    const total = rows.reduce((a, r) => a + r.v, 0)
    return (
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 8 }}>{label}</div>
        {rows.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Sem dados no período.</p> : rows.map(r => (
          <div key={r.name} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#334155' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{r.name}</span>
              <b style={{ color: NAVY }}>{fmt(r.v)} <span style={{ fontWeight: 500, color: '#94a3b8' }}>· {total ? Math.round((r.v / total) * 100) : 0}%</span></b>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#F1F5F9', marginTop: 3 }}><div style={{ height: '100%', borderRadius: 3, background: color, width: `${(r.v / max) * 100}%`, transition: 'width .5s ease' }} /></div>
          </div>
        ))}
      </div>
    )
  }

  const sources = (cur ?? []).filter(r => r.kind === 'source').sort((a, b) => b.events - a.events).map(r => ({ name: r.label, v: r.events }))
  const devLabel: Record<string, string> = { mobile: 'Celular', desktop: 'Computador', tablet: 'Tablet', outro: 'Outro' }
  const devices = (cur ?? []).filter(r => r.kind === 'device').sort((a, b) => b.events - a.events).map(r => ({ name: devLabel[r.label] || r.label, v: r.events }))
  const byBlock = blocks.filter(b => b.id).map(b => ({
    name: `${BLOCK_TYPES[b.type].label}: ${blockSummary(b.type, b.config)}`,
    v: blk.filter(r => r.block_id === b.id && r.event_type === 'click').reduce((a, r) => a + r.events, 0),
  })).sort((a, b) => b.v - a.v)

  const funnel = [
    { l: 'Visitas', v: views.events, icon: Eye, c: '#0284C7' },
    { l: 'Cliques', v: clicks.events, icon: MousePointerClick, c: '#7C3AED' },
    { l: 'Conversas', v: conv, icon: MessageCircle, c: '#059669' },
    { l: 'Leads', v: leads, icon: Users, c: '#2563EB' },
    { l: 'Matrículas', v: enr, icon: Check, c: TEAL_D },
  ]
  const fmax = Math.max(1, funnel[0].v)

  const kp = [
    { l: 'Visitas', v: views.events, d: delta(views.events, pViews.events) },
    { l: 'Pessoas', v: views.visitors, d: delta(views.visitors, pViews.visitors) },
    { l: 'Cliques', v: clicks.events, d: delta(clicks.events, pClicks.events) },
    { l: 'Taxa de clique', v: views.events ? `${Math.round((clicks.events / views.events) * 100)}%` : '—', d: null as any },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: NAVY }}>Desempenho</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Quem visitou a página, o que clicou e o que virou conversa.</p>
        </div>
        <div style={{ display: 'flex', gap: 3, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 11, padding: 3 }}>
          {PERIODS.map(p => (
            <button key={p.k} type="button" onClick={() => setDays(p.k)} style={{
              padding: '6px 13px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              background: days === p.k ? '#E6F7F5' : 'transparent', color: days === p.k ? TEAL_D : '#64748b',
            }}>{p.l}</button>
          ))}
        </div>
      </div>

      {err && <div style={{ ...card, color: '#991B1B', background: '#FEF2F2', borderColor: '#FECACA', fontSize: 13 }}>Não foi possível carregar o desempenho agora.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {kp.map(k => (
          <div key={k.l} style={{ ...card, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{k.l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, margin: '4px 0 2px' }}>{cur ? (typeof k.v === 'number' ? fmt(k.v) : k.v) : '…'}</div>
            <div style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: k.d?.up === false ? '#DC2626' : '#059669', minHeight: 14 }}>
              {k.d && (k.d.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}{k.d ? `${k.d.t} vs. anterior` : ''}
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: '14px 14px 6px' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Visitas e cliques por dia</div>
        <div style={{ height: 190 }}>
          {!cur ? <div className="animate-pulse" style={{ height: '100%', borderRadius: 12, background: '#f8fafc' }} /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="vg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TEAL} stopOpacity={0.3} /><stop offset="100%" stopColor={TEAL} stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="vg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.25} /><stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 12 }} />
                <Area type="monotone" dataKey="Visitas" stroke={TEAL} strokeWidth={2.2} fill="url(#vg1)" />
                <Area type="monotone" dataKey="Cliques" stroke="#7C3AED" strokeWidth={2} fill="url(#vg2)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>Do clique à matrícula</div>
        <p style={{ margin: '2px 0 10px', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>Conversas, leads e matrículas contam só quem chegou pelos botões de WhatsApp e matrícula da Vitrine (primeiro toque).</p>
        {funnel.map(f => {
          const Icon = f.icon
          return (
            <div key={f.l} style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#334155' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon size={13} color={f.c} /> {f.l}</span>
                <b style={{ color: NAVY }}>{cur ? fmt(f.v) : '…'}</b>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: '#F1F5F9', marginTop: 3 }}><div style={{ height: '100%', borderRadius: 4, background: f.c, width: `${Math.max(f.v > 0 ? 2 : 0, (f.v / fmax) * 100)}%`, transition: 'width .5s ease' }} /></div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {bars('De onde vêm as visitas', sources, '#2563EB')}
        {bars('Cliques por bloco', byBlock.filter(b => b.v > 0).slice(0, 8), TEAL)}
        {bars('Aparelho', devices, '#7C3AED')}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}><ChevronRight size={11} /> Para ver os leads de cada botão, abra a Captação.</p>
    </>
  )
}
