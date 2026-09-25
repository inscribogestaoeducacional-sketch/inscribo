// =============================================================================
// scripts/novidades-mockups/Mockups.tsx
//
// Mockups estáticos das telas do módulo Captação Inteligente, usados como
// imagens em /novidades/captacao-inteligente e na landing. Espelham o JSX e os
// estilos inline de src/pages/gestor/CaptacaoInteligente.tsx (cores, tamanhos,
// badges) com DADOS FICTÍCIOS de demonstração — nenhum dado real de escola.
// Cada tela leva o selo "Dados de exemplo". Se a tela real mudar, atualize
// aqui e rode: node scripts/novidades-mockups/render.mjs
// =============================================================================
import React from 'react'
import {
  Megaphone, Plus, Copy, ExternalLink, X, MoreHorizontal, Bot, MessageCircle, UserPlus,
  GraduationCap, Clock, TrendingUp, Zap, Info,
} from 'lucide-react'

// ── Mesmos tokens da tela real ──────────────────────────────────────────────
type Channel = 'meta_ads' | 'google_ads' | 'instagram' | 'facebook' | 'tiktok' | 'site' | 'outro'
const CHANNELS: Record<Channel, { label: string; color: string; bg: string }> = {
  meta_ads:   { label: 'Meta Ads',            color: '#2563EB', bg: '#DBEAFE' },
  google_ads: { label: 'Google Ads',          color: '#D97706', bg: '#FEF3C7' },
  instagram:  { label: 'Instagram orgânico',  color: '#DB2777', bg: '#FCE7F3' },
  facebook:   { label: 'Facebook orgânico',   color: '#4F46E5', bg: '#E0E7FF' },
  tiktok:     { label: 'TikTok',              color: '#1A2B4A', bg: '#E2E8F0' },
  site:       { label: 'Site / Landing page', color: '#059669', bg: '#D1FAE5' },
  outro:      { label: 'Outro',               color: '#64748B', bg: '#F1F5F9' },
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#FAFAFA', boxSizing: 'border-box', color: '#1e293b', lineHeight: 1.5 }
const hintStyle: React.CSSProperties = { margin: '4px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }
const fmt = (n: number) => n.toLocaleString('pt-BR')
const pct = (num: number, den: number) => den > 0 ? `${Math.round((num / den) * 1000) / 10}%`.replace('.', ',') : '—'
function formatDuration(s: number | null) {
  if (s == null) return '—'
  if (s < 60) return `${Math.round(s)}s`
  const m = s / 60
  if (m < 60) return `${Math.round(m)} min`
  return `${(m / 60).toFixed(1).replace('.', ',')} h`
}

// ── Dados de demonstração ───────────────────────────────────────────────────
const PHONE = '5583900000000' // fictício
interface Demo {
  name: string; channel: Channel; text: string; metaIds: number; autoReply: boolean; skipBot: boolean
  assignees: { label: string; group?: boolean }[]; active: boolean
  s: { hits: number; conv: number; contacts: number; leads: number; enroll: number; resp: number }
}
const DEMO: Demo[] = [
  { name: 'Matrículas 2027 — Educação Infantil', channel: 'meta_ads', text: 'Olá! Vi o anúncio e quero saber sobre matrícula no Infantil 2027', metaIds: 1, autoReply: true, skipBot: true,
    assignees: [{ label: 'Ana Beatriz Lima' }, { label: 'Camila Rocha' }], active: true,
    s: { hits: 214, conv: 186, contacts: 172, leads: 168, enroll: 23, resp: 252 } },
  { name: 'Bolsas Ensino Médio 2027', channel: 'google_ads', text: 'Olá, gostaria de informações sobre bolsas para o Ensino Médio 2027', metaIds: 0, autoReply: true, skipBot: true,
    assignees: [{ label: '🎓 Equipe Ensino Médio', group: true }], active: true,
    s: { hits: 143, conv: 121, contacts: 109, leads: 104, enroll: 9, resp: 690 } },
  { name: 'Open School — Visita guiada', channel: 'instagram', text: 'Oi! Quero agendar uma visita no Open School de outubro', metaIds: 0, autoReply: true, skipBot: false,
    assignees: [], active: true,
    s: { hits: 97, conv: 88, contacts: 81, leads: 79, enroll: 14, resp: 408 } },
  { name: 'Landing page — Fundamental I', channel: 'site', text: 'Olá! Vim pelo site e quero conhecer o Fundamental I', metaIds: 0, autoReply: false, skipBot: true,
    assignees: [], active: true,
    s: { hits: 61, conv: 54, contacts: 49, leads: 47, enroll: 8, resp: 185 } },
  { name: 'Colônia de Férias — Julho', channel: 'tiktok', text: 'Oi! Vi o vídeo e quero saber da colônia de férias', metaIds: 0, autoReply: false, skipBot: false,
    assignees: [], active: false,
    s: { hits: 38, conv: 33, contacts: 30, leads: 29, enroll: 2, resp: 560 } },
]

function waLink(text: string) {
  const enc = encodeURIComponent(text).replace(/[.!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return `https://wa.me/${PHONE}?text=${enc}`
}

// Selo que deixa explícito que é demonstração
function DemoSeal() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1.5px dashed #F9A8D4', background: '#FDF2F8', color: '#BE185D', fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
      <Info size={12} /> Dados de exemplo · demonstração
    </span>
  )
}

// ── Pedaços compartilhados (iguais à tela real) ─────────────────────────────
function Header({ showNew }: { showNew: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FCE7F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={18} color="#DB2777" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Captação Inteligente</h1>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b', paddingLeft: 46 }}>
          Identifique de qual anúncio veio cada conversa do WhatsApp e direcione automaticamente
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <DemoSeal />
        {showNew && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, background: '#00A896', color: 'white', fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> Novo gatilho
          </span>
        )}
      </div>
    </div>
  )
}

function Tabs({ active }: { active: 'triggers' | 'dashboard' }) {
  const visible = DEMO.length
  return (
    <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
      {[{ key: 'triggers', label: `Gatilhos (${visible})` }, { key: 'dashboard', label: 'Dashboard' }].map(tab => (
        <span key={tab.key} style={{
          padding: '6px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
          background: active === tab.key ? '#fff' : 'transparent',
          color: active === tab.key ? '#1e2d6b' : '#64748b',
          boxShadow: active === tab.key ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
        }}>{tab.label}</span>
      ))}
    </div>
  )
}

const Page = ({ children, width = 1280 }: { children: React.ReactNode; width?: number }) => (
  <div id="shot" style={{ width, padding: 24, display: 'flex', flexDirection: 'column', gap: 24, background: '#f8f9fb' }}>{children}</div>
)

// ── Tela 1: lista de gatilhos ───────────────────────────────────────────────
export function ListaGatilhos() {
  return (
    <Page>
      <Header showNew />
      <Tabs active="triggers" />
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Gatilhos de captação</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Gatilho', 'Texto da mensagem', 'Robô', 'Distribuição', 'Status', 'Link wa.me', ''].map(col => (
                <th key={col} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEMO.map((t, idx) => {
              const ch = CHANNELS[t.channel]
              return (
                <tr key={t.name} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa', opacity: t.active ? 1 : 0.65 }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                    <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: ch.bg, color: ch.color, whiteSpace: 'nowrap' }}>{ch.label}</span>
                    {t.metaIds > 0 && (
                      <span style={{ display: 'inline-block', marginTop: 4, marginLeft: 4, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>
                        {t.metaIds} ID de anúncio
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                    <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{t.text}"</div>
                    {t.autoReply && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Com resposta automática</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.skipBot ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#FEF3C7', color: '#B45309', whiteSpace: 'nowrap' }}><Bot size={11} /> Pula o robô</span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#D1FAE5', color: '#059669', whiteSpace: 'nowrap' }}><Bot size={11} /> Robô normal</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#475569', maxWidth: 220 }}>
                    {!t.skipBot ? <span style={{ color: '#cbd5e1' }}>Pelo fluxo do robô</span>
                      : t.assignees.length === 0 ? <span style={{ color: '#94a3b8' }}>Fila geral</span>
                      : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {t.assignees.map(a => (
                            <span key={a.label} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: a.group ? '#EDE9FE' : '#EFF6FF', color: a.group ? '#7C3AED' : '#2563EB', whiteSpace: 'nowrap' }}>{a.label}</span>
                          ))}
                        </div>
                      )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: t.active ? '#D1FAE5' : '#E2E8F0', color: t.active ? '#059669' : '#64748B' }}>
                      {t.active ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: '#E6F7F5', color: '#00A896', fontSize: 11, fontWeight: 600 }}><Copy size={12} /> Copiar</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 600 }}><ExternalLink size={12} /> Testar</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b' }}><MoreHorizontal size={14} /></span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Page>
  )
}

// ── Tela 2: modal de criação ────────────────────────────────────────────────
export function ModalGatilho() {
  const t = DEMO[0]
  const users = ['Ana Beatriz Lima', 'Camila Rocha', 'Fernanda Dias', 'Juliana Freitas', 'Larissa Moura']
  const selUsers = ['Ana Beatriz Lima', 'Camila Rocha']
  const groups = [{ n: 'Consultoras Infantil', e: '🧸', c: 3 }, { n: 'Equipe Ensino Médio', e: '🎓', c: 2 }]
  const Check = ({ on }: { on: boolean }) => (
    <span style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? '#0075FF' : '#fff', border: on ? 'none' : '1.5px solid #767676' }}>
      {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
    </span>
  )
  return (
    <div id="shot" style={{ width: 800, padding: '36px 60px', background: 'rgba(15,23,42,0.6)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 12, right: 14 }}><DemoSeal /></div>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>Novo gatilho de captação</h2>
          <span style={{ color: '#94a3b8', display: 'flex' }}><X size={18} /></span>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Nome da campanha <span style={{ color: '#F43F5E' }}>*</span></label>
            <div style={{ ...inputStyle, borderColor: '#00A896', background: '#fff' }}>{t.name}</div>
          </div>
          <div>
            <label style={labelStyle}>Canal</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(Object.keys(CHANNELS) as Channel[]).map(c => {
                const cfg = CHANNELS[c]; const sel = c === t.channel
                return <span key={c} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1.5px solid ${sel ? cfg.color : '#E2E8F0'}`, background: sel ? cfg.bg : '#fff', color: sel ? cfg.color : '#64748B' }}>{cfg.label}</span>
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Texto da mensagem pré-preenchida <span style={{ color: '#F43F5E' }}>*</span></label>
            <div style={{ ...inputStyle, minHeight: 58 }}>{t.text}</div>
            <p style={hintStyle}>A conversa é identificada quando a mensagem do lead <strong>contém</strong> este texto (sem diferenciar maiúsculas nem acentos). Use exatamente o mesmo texto do anúncio — de preferência copiando o link gerado abaixo.</p>
          </div>
          <div style={{ background: '#F0FDFB', border: '1px solid #D1FAE5', borderRadius: 12, padding: '12px 14px' }}>
            <label style={{ ...labelStyle, color: '#007A6E' }}>Link para o anúncio</label>
            <div style={{ fontSize: 12, color: '#1e293b', fontFamily: 'Consolas, monospace', wordBreak: 'break-all', background: '#fff', border: '1px solid #D1FAE5', borderRadius: 8, padding: '8px 10px' }}>{waLink(t.text)}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: '#E6F7F5', color: '#00A896', fontSize: 11, fontWeight: 600 }}><Copy size={12} /> Copiar link</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 600 }}><ExternalLink size={12} /> Testar</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>IDs de anúncio da Meta (opcional)</label>
            <div style={{ ...inputStyle, fontFamily: 'Consolas, monospace' }}>120214589630470187</div>
          </div>
          <div>
            <label style={labelStyle}>Resposta automática (opcional)</label>
            <div style={{ ...inputStyle, minHeight: 58 }}>Oi! Que bom que você se interessou pelo Infantil 😊 Em instantes uma de nossas consultoras vai te atender.</div>
            <p style={hintStyle}>Enviada só no início de um atendimento — nunca no meio de uma conversa já em andamento.</p>
          </div>
          <div>
            <label style={labelStyle}>Etiqueta de origem</label>
            <div style={inputStyle}>Infantil 2027 · Meta</div>
            <p style={hintStyle}>Aplicada no contato e na conversa — permite filtrar a lista de Contatos por origem.</p>
          </div>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ marginTop: 3 }}><Check on /></span>
              <span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Pular o robô de atendimento</span>
                <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.5 }}>A conversa não passa pelo fluxo do robô e vai direto para os atendentes escolhidos abaixo (ou para a fila geral, se ninguém for escolhido).</span>
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Distribuir para (round-robin)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {groups.map(g => (
                  <span key={g.n} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B' }}>
                    {g.e} {g.n} <span style={{ fontSize: 10, opacity: 0.7 }}>({g.c})</span>
                  </span>
                ))}
              </div>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: 9, padding: 4 }}>
                {users.map(u => (
                  <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 13, color: '#334155' }}>
                    <Check on={selUsers.includes(u)} /> {u}
                  </div>
                ))}
              </div>
              <p style={hintStyle}>Só recebe quem estiver disponível e fora do horário de almoço. Membros de grupos entram na mesma fila, sem repetição.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
            <Check on /> Gatilho ativo
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ flex: 1, padding: 12, borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, color: '#64748B', fontWeight: 500, textAlign: 'center' }}>Cancelar</span>
            <span style={{ flex: 1, padding: 12, borderRadius: 9, background: '#00A896', color: 'white', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>Criar gatilho</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tela 3: dashboard ───────────────────────────────────────────────────────
function KpiCard({ label, value, icon, bg }: { label: string; value: string; icon: React.ReactNode; bg: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#1e2d6b', lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px', display: 'flex', alignItems: 'center' }}>{icon}{title}</h3>
      {children}
    </div>
  )
}

// Barras horizontais no mesmo desenho do HBarChart (recharts) da tela real
function HBars({ data, unit, width = 560 }: { data: { name: string; value: number }[]; unit: string; width?: number }) {
  const rowH = 36, top = 0, axisW = 140, right = 48, bottom = 24
  const height = Math.max(120, data.length * rowH + 24)
  const plotW = width - axisW - right
  const rawMax = Math.max(...data.map(d => d.value))
  const step = unit === '%' ? 5 : rawMax > 150 ? 50 : 25
  const max = Math.ceil(rawMax / step) * step
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step)
  const x = (v: number) => axisW + (v / max) * plotW
  const bandH = (height - bottom - top) / data.length
  const fmtVal = (v: number) => `${v.toLocaleString('pt-BR')}${unit}`
  const short = (s: string) => s.length > 22 ? s.slice(0, 21) + '…' : s
  return (
    <svg width={width} height={height} style={{ display: 'block', fontFamily: 'inherit' }}>
      {ticks.map(t => <line key={t} x1={x(t)} x2={x(t)} y1={top} y2={height - bottom} stroke="#F3F4F6" strokeDasharray="3 3" />)}
      {data.map((d, i) => {
        const cy = top + bandH * i + bandH / 2, bh = Math.min(18, bandH - 10)
        const w = x(d.value) - axisW
        return (
          <g key={d.name}>
            <text x={axisW - 8} y={cy} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#475569">{short(d.name)}</text>
            <path d={`M${axisW},${cy - bh / 2} h${w - 4} a4,4 0 0 1 4,4 v${bh - 8} a4,4 0 0 1 -4,4 h${-(w - 4)} z`} fill="#00A896" />
            <text x={axisW + w + 5} y={cy} dominantBaseline="central" fontSize={11} fontWeight={600} fill="#475569">{fmtVal(d.value)}</text>
          </g>
        )
      })}
      {ticks.map(t => <text key={t} x={x(t)} y={height - bottom + 14} textAnchor="middle" fontSize={10} fill="#94a3b8">{t}</text>)}
    </svg>
  )
}

function DashboardBody({ chartW }: { chartW: number }) {
  const rows = [...DEMO].sort((a, b) => b.s.conv - a.s.conv)
  const tot = rows.reduce((a, r) => ({ hits: a.hits + r.s.hits, conv: a.conv + r.s.conv, contacts: a.contacts + r.s.contacts, leads: a.leads + r.s.leads, enroll: a.enroll + r.s.enroll }), { hits: 0, conv: 0, contacts: 0, leads: 0, enroll: 0 })
  const conv = rows.map(r => ({ name: r.name, value: Math.round((r.s.enroll / r.s.contacts) * 1000) / 10 })).sort((a, b) => b.value - a.value)
  const num: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: '#1e293b', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiCard label="Acionamentos"          value={fmt(tot.hits)}    icon={<Zap size={18} color="#7C3AED" />}           bg="#EDE9FE" />
        <KpiCard label="Conversas"             value={fmt(tot.conv)}    icon={<MessageCircle size={18} color="#10B981" />} bg="#D1FAE5" />
        <KpiCard label="Leads (1º toque)"      value={fmt(tot.leads)}   icon={<UserPlus size={18} color="#3B82F6" />}      bg="#DBEAFE" />
        <KpiCard label="Matrículas (1º toque)" value={fmt(tot.enroll)}  icon={<GraduationCap size={18} color="#00A896" />} bg="#E6F7F5" />
        <KpiCard label="Conversão geral"       value={pct(tot.enroll, tot.contacts)} icon={<TrendingUp size={18} color="#D97706" />} bg="#FEF3C7" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Conversas por gatilho" icon={<MessageCircle size={16} color="#10B981" style={{ marginRight: 6 }} />}>
          <HBars data={rows.map(r => ({ name: r.name, value: r.s.conv }))} unit="" width={chartW} />
        </ChartCard>
        <ChartCard title="Conversão contato → matrícula (1º toque)" icon={<TrendingUp size={16} color="#D97706" style={{ marginRight: 6 }} />}>
          <HBars data={conv} unit="%" width={chartW} />
        </ChartCard>
      </div>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Comparação entre gatilhos</h3>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            Acionamentos e conversas contam todo match no período. Contatos, leads e matrículas usam o <strong>primeiro toque</strong> — cada contato conta só para o gatilho que o trouxe primeiro, então a soma entre campanhas nunca passa do total real.
          </p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Gatilho', 'Acionamentos', 'Conversas', 'Contatos', 'Leads', 'Matrículas', 'Contato → Matrícula', 'Lead → Matrícula', '1ª resposta'].map(col => (
                <th key={col} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: col === 'Gatilho' ? 'left' : 'right', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const ch = CHANNELS[r.channel]
              return (
                <tr key={r.name} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                      {r.name}{!r.active && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>(pausado)</span>}
                    </div>
                    <span style={{ display: 'inline-block', marginTop: 3, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: ch.bg, color: ch.color }}>{ch.label}</span>
                  </td>
                  <td style={num}>{fmt(r.s.hits)}</td>
                  <td style={num}>{fmt(r.s.conv)}</td>
                  <td style={num}>{fmt(r.s.contacts)}</td>
                  <td style={num}>{fmt(r.s.leads)}</td>
                  <td style={{ ...num, fontWeight: 700, color: '#00A896' }}>{fmt(r.s.enroll)}</td>
                  <td style={num}>{pct(r.s.enroll, r.s.contacts)}</td>
                  <td style={num}>{pct(r.s.enroll, r.s.leads)}</td>
                  <td style={num}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} color="#94a3b8" /> {formatDuration(r.s.resp)}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Periods() {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
      {['7 dias', '30 dias', '90 dias', '12 meses'].map(p => (
        <span key={p} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: p === '30 dias' ? '#fff' : 'transparent', color: p === '30 dias' ? '#1e2d6b' : '#64748b', boxShadow: p === '30 dias' ? '0 1px 3px rgba(0,0,0,0.10)' : 'none' }}>{p}</span>
      ))}
    </div>
  )
}

export function Dashboard() {
  return (
    <Page>
      <Header showNew={false} />
      <Tabs active="dashboard" />
      <Periods />
      <DashboardBody chartW={568} />
    </Page>
  )
}
