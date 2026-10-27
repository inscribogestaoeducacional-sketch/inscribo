// Aba "Site (visitas)" do Super Admin: quem visita aionedu.com.br, o que vê, de onde vem e quem clica no WhatsApp.
// Dados vêm de site_stats (migration 20261027_site_analytics.sql). Sem login nem cookie de terceiros no site.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Users, Eye, Clock, WhatsappLogo, FileMagnifyingGlass, DeviceMobile } from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'

type Stats = {
  visitors: number; new_visitors: number; sessions: number; pageviews: number; avg_seconds: number
  wa_clicks: number; wa_people: number; raiox_clicks: number
  daily: { day: string; visitors: number; views: number }[]
  pages: { path: string; views: number; visitors: number; avg_seconds: number | null; avg_scroll: number | null }[]
  origins: { origin: string; medium: string; visitors: number; views: number }[]
  devices: { device: string; visitors: number }[]
  places: { tz: string; visitors: number }[]
  wa: { at: string; path: string; code: string | null; origin: string; campaign: string | null }[]
}

const fmtTime = (s: number | null) => { if (!s) return '-'; return s >= 60 ? `${Math.floor(s / 60)}min ${s % 60}s` : `${s}s` }
const PLACE: Record<string, string> = { 'America/Fortaleza': 'Nordeste (Fortaleza)', 'America/Recife': 'Nordeste (Recife)', 'America/Sao_Paulo': 'Sudeste/Sul (Brasília)', 'America/Bahia': 'Bahia', 'America/Manaus': 'Amazonas', 'America/Belem': 'Pará', 'America/Cuiaba': 'Centro-Oeste' }

function Card({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2EFEA', borderRadius: 18, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: color + '1A', color, display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#0F2A24', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12.5, color: '#5B7A71' }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: '#8AA39B' }}>{sub}</div>}
      </div>
    </div>
  )
}
const box: React.CSSProperties = { background: '#fff', border: '1px solid #E2EFEA', borderRadius: 18, padding: 16 }

function Bars({ rows, max }: { rows: { label: string; value: number; sub?: string }[]; max: number }) {
  if (!rows.length) return <div style={{ fontSize: 13, color: '#8AA39B' }}>Ainda sem dados neste período.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: '#0F2A24' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
            <b>{r.value}{r.sub ? <span style={{ fontWeight: 500, color: '#8AA39B' }}> · {r.sub}</span> : null}</b>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: '#EAF6F2', marginTop: 3 }}>
            <div style={{ width: `${Math.max(3, (r.value / Math.max(max, 1)) * 100)}%`, height: '100%', borderRadius: 6, background: 'linear-gradient(90deg,#00523C,#0DD3BF)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminSite() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true); setErr('')
    supabase.rpc('site_stats', { p_days: days }).then(({ data: d, error }) => {
      if (!alive) return
      if (error) setErr(error.message); else setData(d as Stats)
      setLoading(false)
    })
    return () => { alive = false }
  }, [days])

  const conv = data && data.visitors ? Math.round((data.wa_people / data.visitors) * 1000) / 10 : 0
  const maxDay = Math.max(1, ...(data?.daily.map(x => x.visitors) ?? [1]))

  return (
    <SuperAdminLayout>
      <div className="p-4 md:p-8 space-y-5">
        <div className="aion-band flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="aion-band-title">Site (visitas)</h1>
            <p className="aion-band-sub">Quem visita aionedu.com.br, o que vê, de onde vem e quem chama no WhatsApp</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[7, 30, 90].map(n => (
              <button key={n} type="button" onClick={() => setDays(n)}
                style={{ padding: '8px 14px', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: '1px solid rgba(255,255,255,.5)', background: days === n ? '#fff' : 'transparent', color: days === n ? '#00523C' : '#fff' }}>
                {n} dias
              </button>
            ))}
          </div>
        </div>

        {loading && !data && <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Loader2 className="animate-spin" /></div>}
        {err && <div style={{ ...box, color: '#B91C1C' }}>Não foi possível carregar: {err}</div>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
              <Card icon={<Users size={24} weight="duotone" />} label="visitantes" value={data.visitors} sub={`${data.new_visitors} novos`} color="#00A896" />
              <Card icon={<Eye size={24} weight="duotone" />} label="páginas vistas" value={data.pageviews} sub={`${data.sessions} visitas`} color="#4F46E5" />
              <Card icon={<Clock size={24} weight="duotone" />} label="tempo médio na página" value={fmtTime(data.avg_seconds)} color="#D97706" />
              <Card icon={<WhatsappLogo size={24} weight="duotone" />} label="chamaram no WhatsApp" value={data.wa_people} sub={`${conv}% dos visitantes · ${data.wa_clicks} cliques`} color="#16A34A" />
              <Card icon={<FileMagnifyingGlass size={24} weight="duotone" />} label="cliques no Raio-X" value={data.raiox_clicks} color="#0D9488" />
            </div>

            <div style={box}>
              <div style={{ fontWeight: 800, color: '#0F2A24', marginBottom: 10 }}>Visitantes por dia</div>
              {data.daily.length === 0 ? <div style={{ fontSize: 13, color: '#8AA39B' }}>Ainda sem visitas neste período.</div> : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                  {data.daily.map(d => (
                    <div key={d.day} title={`${d.day.split('-').reverse().join('/')}: ${d.visitors} visitantes, ${d.views} páginas`} style={{ flex: 1, minWidth: 3, height: `${Math.max(4, (d.visitors / maxDay) * 100)}%`, background: 'linear-gradient(180deg,#0DD3BF,#00523C)', borderRadius: '4px 4px 0 0' }} />
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
              <div style={box}>
                <div style={{ fontWeight: 800, color: '#0F2A24', marginBottom: 10 }}>Páginas mais vistas</div>
                {data.pages.length === 0 ? <div style={{ fontSize: 13, color: '#8AA39B' }}>Ainda sem dados.</div> : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead><tr style={{ textAlign: 'left', color: '#5B7A71', fontSize: 12 }}><th style={{ padding: '4px 6px' }}>Página</th><th>Vistas</th><th>Pessoas</th><th>Tempo</th><th>Rolagem</th></tr></thead>
                      <tbody>{data.pages.map(p => (
                        <tr key={p.path} style={{ borderTop: '1px solid #EAF6F2' }}>
                          <td style={{ padding: '6px', fontWeight: 600, color: '#0F2A24' }}>{p.path}</td><td>{p.views}</td><td>{p.visitors}</td><td>{fmtTime(p.avg_seconds)}</td><td>{p.avg_scroll != null ? p.avg_scroll + '%' : '-'}</td>
                        </tr>))}</tbody>
                    </table>
                  </div>
                )}
              </div>
              <div style={box}>
                <div style={{ fontWeight: 800, color: '#0F2A24', marginBottom: 10 }}>De onde vêm</div>
                <Bars max={Math.max(1, ...data.origins.map(o => o.visitors))} rows={data.origins.map(o => ({ label: o.origin + (o.medium ? ` (${o.medium})` : ''), value: o.visitors }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
              <div style={box}>
                <div style={{ fontWeight: 800, color: '#0F2A24', marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}><DeviceMobile size={18} /> Aparelho</div>
                <Bars max={Math.max(1, ...data.devices.map(o => o.visitors))} rows={data.devices.map(o => ({ label: o.device, value: o.visitors }))} />
              </div>
              <div style={box}>
                <div style={{ fontWeight: 800, color: '#0F2A24', marginBottom: 10 }}>Região (fuso do aparelho)</div>
                <Bars max={Math.max(1, ...data.places.map(o => o.visitors))} rows={data.places.map(o => ({ label: PLACE[o.tz] ?? o.tz, value: o.visitors }))} />
              </div>
            </div>

            <div style={box}>
              <div style={{ fontWeight: 800, color: '#0F2A24' }}>Quem chamou no WhatsApp</div>
              <div style={{ fontSize: 12.5, color: '#5B7A71', margin: '2px 0 10px' }}>A mensagem da pessoa chega com o código <b>(ref XXXXXX)</b>. Procure esse código na conversa para ligar o lead à visita.</div>
              {data.wa.length === 0 ? <div style={{ fontSize: 13, color: '#8AA39B' }}>Nenhum clique ainda neste período.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead><tr style={{ textAlign: 'left', color: '#5B7A71', fontSize: 12 }}><th style={{ padding: '4px 6px' }}>Quando</th><th>Código</th><th>Página</th><th>Origem</th><th>Campanha</th></tr></thead>
                    <tbody>{data.wa.map((w, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #EAF6F2' }}>
                        <td style={{ padding: '6px' }}>{new Date(w.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td><b>{w.code ?? '-'}</b></td><td>{w.path}</td><td>{w.origin}</td><td>{w.campaign ?? '-'}</td>
                      </tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#8AA39B' }}>A medição é anônima e própria (sem Google Analytics). Quem recusa o aviso ou usa "Não rastrear" não aparece aqui. A região é aproximada pelo fuso do aparelho. Para saber a origem de um anúncio, use links com ?utm_source=instagram&utm_campaign=nome.</div>
          </>
        )}
      </div>
    </SuperAdminLayout>
  )
}
