// =============================================================================
// scripts/divulgacao-artes/TelasApp.tsx
//
// Telas do painel da escola para as artes e os Reels, espelhando o JSX e os
// estilos inline das telas reais (arquivo citado em cada componente), com
// DADOS FICTÍCIOS da escola de exemplo "Colégio Horizonte". Nenhum nome ou
// telefone real. Classes Tailwind da tela real viraram estilo inline.
//
// Marcações para a animação (render.mjs → animar):
//   data-in="s"   aparece no segundo s      data-out="s"  some no segundo s
//   data-count    número sobe de 0          data-grow     barra cresce
//   data-focus="s" contorno pulsando a partir de s
//   data-move="dx,dy,t0,t1"  chega de (dx,dy) entre t0 e t1
//   data-type="t0,t1"        texto digitado entre t0 e t1
//   data-press="s"           clique (encolhe e volta) no segundo s
// =============================================================================
import React from 'react'
import {
  MessageCircle, Plus, Search, Info, MoreVertical, Megaphone, ChevronDown, User, Calendar, X, Paperclip, Zap, Smile, Mic, Send,
  Users, Trophy, Medal, Award, Zap as Bolt, TrendingUp, GraduationCap, Clock, Star, Sparkles, RefreshCw, Download, AlertTriangle, CheckCircle,
  ChevronRight, Phone, UserCog, Bell, LayoutGrid, SlidersHorizontal, Flame, Sun, Snowflake, ArrowRight, ArrowUp, ArrowRightLeft, Edit3, DollarSign, Check,
} from 'lucide-react'

export const ESCOLA = 'Colégio Horizonte'
const d = (o: Record<string, any>) => o as any // atalho pros data-*

export const DemoSeal = ({ small }: { small?: boolean }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: small ? '3px 9px' : '6px 12px', borderRadius: 999, border: '1.5px dashed #F9A8D4', background: '#FDF2F8', color: '#BE185D', fontSize: small ? 10 : 11, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
    ⓘ Dados de exemplo · demonstração
  </span>
)

// ═════════════════════════════════════════════════════════════════════════════
// WhatsApp — src/components/whatsapp/WhatsAppHub.tsx (lista l.4473, item
// l.2829, cabeçalho da conversa l.4640, faixas l.5175, painel l.5500–5900)
// ═════════════════════════════════════════════════════════════════════════════
type ConvStatus = 'waiting' | 'open' | 'closed'
const ST: Record<ConvStatus, { bg: string; dot: string; text: string; label: string }> = {
  waiting: { bg: '#FEF3C7', dot: '#D97706', text: '#D97706', label: 'Aguardando' },
  open:    { bg: '#D1FAE5', dot: '#059669', text: '#059669', label: 'Em Atendimento' },
  closed:  { bg: '#E2E8F0', dot: '#94A3B8', text: '#64748B', label: 'Concluído' },
}
const AV = ['#7C3AED', '#2563EB', '#DB2777', '#D97706', '#059669', '#0891B2', '#DC2626']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const avBg = (n: string) => AV[n.length % AV.length]

export interface Conv {
  name: string; preview: string; time: string; status: ConvStatus
  assigned?: string; stale?: number; captacao?: string; unread?: number; active?: boolean
  in?: number; hl?: number
}
function ConvItem({ c }: { c: Conv }) {
  const free = !c.assigned && c.status === 'waiting'
  const stale = !!c.stale
  const sc = ST[c.status]
  return (
    <div {...d(c.in != null ? { 'data-in': c.in } : {})} {...d(c.hl != null ? { 'data-focus': c.hl } : {})} style={{
      position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px',
      borderLeft: c.active ? '3px solid #00A896' : stale ? '3px solid #F97316' : free ? '3px solid #F59E0B' : '3px solid transparent',
      borderBottom: '1px solid #F0FDFB',
      background: c.active ? 'linear-gradient(135deg, #E6F7F5 0%, #F0FDFB 100%)' : stale ? '#FFF7ED' : free ? '#FFFBEB' : 'transparent',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: c.active ? 'linear-gradient(135deg, #00A896, #0DD3BF)' : avBg(c.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white', border: c.active ? '2px solid #00A896' : '2px solid transparent' }}>{ini(c.name)}</div>
        {c.assigned && <div style={{ position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderRadius: '50%', background: '#1A2B4A', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: 'white' }}>{c.assigned[0]}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: c.active ? '#007A6E' : '#1A2B4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{c.name}</span>
          <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>{c.time}</span>
        </div>
        <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.preview}</p>
        {stale && c.assigned && <p style={{ fontSize: 11, color: '#C2410C', margin: '0 0 5px', fontWeight: 600 }}>Era de: {c.assigned}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: sc.bg, color: sc.text, display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', background: sc.dot }} />{sc.label}
            </span>
            {c.captacao && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: '#FCE7F3', color: '#DB2777', display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: 120 }}>
                <Megaphone style={{ width: 9, height: 9, flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.captacao}</span>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {stale && <span data-hora style={{ fontSize: 9, fontWeight: 700, color: '#C2410C', background: '#FFEDD5', border: '1px solid #FDBA74', padding: '2px 6px', borderRadius: 999, whiteSpace: 'nowrap' }}>⏰ Parada há <span data-count>{c.stale}</span>h</span>}
            {free && <span style={{ fontSize: 9, fontWeight: 700, color: '#B45309', background: '#FEF3C7', border: '1px solid #FCD34D', padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Livre</span>}
            {!!c.unread && <span style={{ background: '#00A896', color: 'white', fontSize: 10, fontWeight: 700, minWidth: 20, height: 20, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', boxShadow: '0 2px 6px rgba(0,168,150,0.4)' }}>{c.unread}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
const Sec = ({ children, color, count, countBg }: { children: React.ReactNode; color: string; count?: number; countBg?: string }) => (
  <div style={{ padding: '10px 14px 4px', fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
    {children}{count != null && <span style={{ background: countBg, color: '#fff', borderRadius: 9999, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{count}</span>}
  </div>
)

export interface Msg { me?: boolean; bot?: boolean; sender?: string; text: string; time: string; in?: number; template?: boolean }
export interface WAProps {
  fila?: Conv[]; minhas?: Conv[]; paradas?: Conv[]; outras?: Conv[]
  chat?: {
    name: string; phone: string; status: ConvStatus; captacao?: { name: string; canal: string }
    banner?: 'fila' | 'parada'; bannerOut?: number; era?: string; horas?: number
    msgs: Msg[]; typing?: { text: string; t0: number; t1: number; out?: number }
    pressAssumir?: number; pressResgatar?: number
    expirada?: boolean; pressReativar?: number
    slash?: { at: number; out?: number; sel?: number; items: { label: string; text: string; pessoal?: boolean }[] }
  }
  painel?: {
    atendente?: string; atendenteIn?: { name: string; at: number }; janela?: string; expirada?: boolean
    lead?: { nome: string; aluno: string; serie: string; status: string; origem: string; statusIn?: { label: string; at: number } }
    focusAgendar?: number; transfer?: { to: string; at: number }
    aba?: 'details' | 'history'; historico?: { desc: string; user?: string; time: string; cor: string; in?: number; focus?: number }[]
    notas?: { texto: string; autor: string; quando: string; in?: number }[]; notasFocus?: number
    // Seção "Mensagens Agendadas" (WhatsAppHub.tsx ~6200): nome do template + data/hora
    agendadas?: { nome: string; quando: string; in?: number; focus?: number }[]
  }
  modal?: React.ReactNode
  height?: number; width?: number
}
export function WhatsApp(p: WAProps) {
  const H = p.height ?? 780
  const total = (p.fila?.length ?? 0)
  const c = p.chat
  return (
    <div id="shot" style={{ width: p.width ?? 1280, height: H, display: 'flex', background: '#fff', position: 'relative', overflow: 'hidden' }}>
      {/* Col 1 — lista */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRight: '1px solid #D1FAE5', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #D1FAE5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MessageCircle style={{ width: 18, height: 18, color: '#00A896' }} /></div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>WhatsApp</span>
            <span style={{ background: '#00A896', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>7</span>
            {total > 0 && <span style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>⏳ {total}</span>}
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00A896', color: '#fff' }}><Plus style={{ width: 16, height: 16 }} /></div>
        </div>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #D1FAE5' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
            <div style={{ paddingLeft: 34, paddingTop: 8, paddingBottom: 8, fontSize: 13, background: '#F0FDFB', border: '1px solid #D1FAE5', borderRadius: 10, color: '#94A3B8' }}>Buscar nome ou número...</div>
          </div>
        </div>
        <div style={{ borderBottom: '1px solid #D1FAE5' }}>
          <div style={{ display: 'flex', padding: '8px 12px', gap: 8 }}>
            {[['Status', 'Abertos'], ['Atribuição', 'Todos']].map(([l, v]) => (
              <div key={l} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</span>
                <div style={{ padding: '5px 8px', fontSize: 12, border: '1px solid #D1FAE5', borderRadius: 8, background: '#F0FDFB', color: '#1A2B4A', display: 'flex', justifyContent: 'space-between' }}>{v}<ChevronDown size={12} /></div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', padding: '0 12px 8px', gap: 6 }}>
            {['Tudo', 'Lida', 'Não lida'].map((l, i) => (
              <span key={l} style={{ padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: i === 0 ? 600 : 400, background: i === 0 ? '#EDE9FE' : '#F0FDFB', color: i === 0 ? '#7C3AED' : '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                {l}{i === 2 && <span style={{ background: '#7C3AED', color: '#fff', borderRadius: 9999, padding: '0px 5px', fontSize: 10, fontWeight: 700 }}>7</span>}
              </span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {!!p.fila?.length && <><Sec color="#D97706" count={p.fila.length} countBg="#EF4444">⏳ Aguardando atendimento</Sec>{p.fila.map(x => <ConvItem key={x.name} c={x} />)}</>}
          {!!p.minhas?.length && <><Sec color="#00A896">Minhas conversas</Sec>{p.minhas.map(x => <ConvItem key={x.name} c={x} />)}</>}
          {!!p.paradas?.length && <><Sec color="#C2410C" count={p.paradas.length} countBg="#F97316">⏰ Conversas paradas</Sec>{p.paradas.map(x => <ConvItem key={x.name} c={x} />)}</>}
          {!!p.outras?.length && <><Sec color="#64748B">Outras conversas</Sec>{p.outras.map(x => <ConvItem key={x.name} c={x} />)}</>}
        </div>
      </div>

      {/* Col 2 — conversa */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#FAFFFE' }}>
        {c && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: '#fff', borderBottom: '1px solid #D1FAE5' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #00A896, #0DD3BF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff' }}>{ini(c.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{c.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>{c.phone}</p>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: ST[c.status].bg, color: ST[c.status].text }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ST[c.status].dot, display: 'inline-block' }} />{ST[c.status].label}
                  </span>
                  {c.captacao && (
                    <span {...d({ 'data-focus': 1.6 })} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FCE7F3', color: '#DB2777' }}>
                      <Megaphone style={{ width: 11, height: 11 }} />{c.captacao.name}<span style={{ fontWeight: 500, opacity: 0.8 }}>· {c.captacao.canal}</span>
                    </span>
                  )}
                </div>
              </div>
              <DemoSeal small />
              <div style={{ display: 'flex', gap: 4 }}>{[Search, Info, MoreVertical].map((I, i) => <div key={i} style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><I size={16} /></div>)}</div>
            </div>
            <div style={{ flex: 1, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              <span style={{ alignSelf: 'center', fontSize: 11, color: '#64748B', background: '#E6F7F5', padding: '3px 12px', borderRadius: 999, fontWeight: 600 }}>Hoje</span>
              {c.msgs.map((m, i) => (
                <div key={i} {...d(m.in != null ? { 'data-in': m.in } : {})} style={{ alignSelf: m.me ? 'flex-end' : 'flex-start', maxWidth: '68%' }}>
                  <div style={{ padding: '9px 13px', background: m.me ? 'linear-gradient(135deg, #0d9488 0%, #0ea5a0 100%)' : '#FFFFFF', color: m.me ? '#fff' : '#1A2B4A', borderRadius: m.me ? '18px 4px 18px 18px' : '4px 18px 18px 18px', border: m.me ? 'none' : '1px solid #e2f5f3', boxShadow: m.me ? '0 2px 10px rgba(13,148,136,0.30)' : '0 1px 4px rgba(0,0,0,0.06)', fontSize: 13.5, lineHeight: 1.5 }}>
                    {m.me && (m.bot || m.sender) && <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: m.bot ? 'rgba(255,255,255,0.55)' : '#5eead4', lineHeight: 1 }}>{m.bot ? '🤖 Robô:' : `${m.sender}:`}</p>}
                    {m.template && <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '1px 5px', marginBottom: 4 }}>🔖 Template</span>}
                    <div>{m.text}</div>
                    <div style={{ fontSize: 10, textAlign: 'right', marginTop: 3, color: m.me ? 'rgba(255,255,255,0.7)' : '#94A3B8' }}>{m.time}{m.me && ' ✓✓'}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 16px 14px', background: '#fff', borderTop: '1px solid #D1FAE5', position: 'relative' }}>
              {c.slash && (
                <div {...d({ 'data-in': c.slash.at, ...(c.slash.out != null ? { 'data-out': c.slash.out } : {}) })} style={{ position: 'absolute', bottom: 72, left: 16, right: 16, zIndex: 45, background: '#fff', border: '1px solid #D1FAE5', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                  {c.slash.items.map((qr, i) => (
                    <div key={qr.label} {...d(i === (c.slash!.sel ?? 0) ? { 'data-focus': c.slash!.at + 0.6 } : {})} style={{ padding: '9px 14px', background: i === (c.slash!.sel ?? 0) ? '#F0FDFB' : '#fff', borderBottom: i < c.slash!.items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A' }}>{qr.label}</span><span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: qr.pessoal ? '#EFF6FF' : '#ECFDF5', color: qr.pessoal ? '#1D4ED8' : '#059669' }}>{qr.pessoal ? 'Pessoal' : 'Global'}</span></div>
                      <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qr.text.slice(0, 60)}</p>
                    </div>
                  ))}
                </div>
              )}
              {c.expirada && (
                <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>⏱ Janela de 24h expirada</p><p style={{ fontSize: 11, color: '#B45309', margin: '2px 0 0' }}>Use um template para reativar a conversa</p></div>
                  <span {...d(c.pressReativar != null ? { 'data-press': c.pressReativar, 'data-focus': Math.max(0.4, c.pressReativar - 1.4) } : {})} style={{ background: '#F59E0B', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Reativar conversa</span>
                </div>
              )}
              {c.banner === 'fila' && (
                <div {...d(c.bannerOut != null ? { 'data-out': c.bannerOut } : {})} style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: 0 }}>⏳ Conversa aguardando atendimento</p>
                    <p style={{ fontSize: 11, color: '#B45309', margin: '2px 0 0' }}>Assuma para reservar antes de responder, ou envie a mensagem que ela é atribuída a você automaticamente.</p>
                  </div>
                  <span {...d(c.pressAssumir != null ? { 'data-press': c.pressAssumir, 'data-focus': Math.max(0.4, c.pressAssumir - 1.4) } : {})} style={{ background: '#F59E0B', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Assumir conversa</span>
                </div>
              )}
              {c.banner === 'parada' && (
                <div {...d(c.bannerOut != null ? { 'data-out': c.bannerOut } : {})} style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#9A3412', margin: 0 }}>⏰ Conversa parada</p>
                    <p style={{ fontSize: 11, color: '#C2410C', margin: '2px 0 0' }}>Era de {c.era}, sem resposta há {c.horas}h.</p>
                  </div>
                  <span {...d(c.pressResgatar != null ? { 'data-press': c.pressResgatar, 'data-focus': Math.max(0.4, c.pressResgatar - 1.4) } : {})} style={{ background: '#F97316', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Resgatar</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {[Paperclip, Zap, Smile].map((I, i) => <div key={i} style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', background: '#F0FDFB' }}><I size={16} /></div>)}
                <div style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid #D1FAE5', background: '#F0FDFB', fontSize: 13, color: c.typing ? '#1A2B4A' : '#94A3B8', minHeight: 40 }}>
                  {c.typing ? <span {...d({ 'data-type': `${c.typing.t0},${c.typing.t1}`, ...(c.typing.out != null ? { 'data-out': c.typing.out } : {}) })}>{c.typing.text}</span> : 'Digite uma mensagem...'}
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#00A896', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{c.typing ? <Send size={16} /> : <Mic size={16} />}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Col 3 — painel */}
      {p.painel && (
        <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid #D1FAE5', background: '#fff', overflow: 'hidden' }}>
          {(p.painel.aba || p.painel.historico || p.painel.notas || p.painel.agendadas) && (
            <div style={{ display: 'flex', borderBottom: '1px solid #D1FAE5' }}>
              {([['details', 'Detalhes'], ['history', 'Histórico']] as const).map(([k, l]) => { const on = (p.painel!.aba ?? 'details') === k; return <span key={k} style={{ flex: 1, textAlign: 'center', padding: '12px 0', fontSize: 12, fontWeight: on ? 700 : 500, color: on ? '#1A2B4A' : '#64748B', borderBottom: on ? '2px solid #00A896' : '2px solid transparent' }}>{l}</span> })}
            </div>
          )}
          {p.painel.aba === 'history' ? (
            <div style={{ padding: '12px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Histórico de eventos</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(p.painel.historico || []).map((ev, i) => (
                  <div key={i} {...d({ ...(ev.in != null ? { 'data-in': ev.in } : {}), ...(ev.focus != null ? { 'data-focus': ev.focus } : {}) })} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: ev.cor }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#1A2B4A', margin: 0, lineHeight: 1.4 }}>{ev.desc}</p>
                      {ev.user && <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>{ev.user}</p>}
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{ev.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (<>
          <PanelHead>Atendimento</PanelHead>
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {p.painel.expirada ? (
              <div style={{ padding: '8px 10px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, background: '#fee2e2', border: '1px solid #fecaca' }}>
                <span style={{ fontSize: 13 }}>🔴</span>
                <div style={{ flex: 1 }}><p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', margin: 0 }}>Janela expirada</p><p style={{ fontSize: 11, color: '#991b1b', margin: 0 }}>Use template para iniciar</p></div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 7, background: '#dc2626', color: '#fff' }}>Template</span>
              </div>
            ) : (
            <div {...d(p.painel.janela ? { 'data-focus': 1.2 } : {})} style={{ padding: '8px 10px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, background: '#d1fae5', border: '1px solid #a7f3d0' }}>
              <span style={{ fontSize: 13 }}>🟢</span>
              <div><p style={{ fontSize: 11, fontWeight: 700, color: '#059669', margin: 0 }}>Janela aberta</p><p style={{ fontSize: 11, color: '#065f46', margin: 0 }}>Expira em {p.painel.janela ?? '23h 41min'}</p></div>
            </div>)}
            <Field label="Status"><div style={selSt}>{c ? ST[c.status].label : '—'}<ChevronDown size={12} /></div></Field>
            <Field label="Atendente">
              {p.painel.transfer ? (
                <div style={{ position: 'relative', height: 38 }}>
                  <div {...d({ 'data-out': p.painel.transfer.at })} style={{ position: 'absolute', inset: 0 }}><Atd name={p.painel.atendente || ''} /></div>
                  <div {...d({ 'data-in': p.painel.transfer.at })} style={{ position: 'absolute', inset: 0 }}><Atd name={p.painel.transfer.to} /></div>
                </div>
              ) : p.painel.atendenteIn ? (
                <div style={{ position: 'relative', height: 38 }}>
                  <div {...d({ 'data-out': p.painel.atendenteIn.at })} style={{ position: 'absolute', inset: 0, padding: '9px 0', fontSize: 12, color: '#64748B', border: '1px dashed #d1fae5', borderRadius: 8, textAlign: 'center' }}>+ Transferir para atendente</div>
                  <div {...d({ 'data-in': p.painel.atendenteIn.at })} style={{ position: 'absolute', inset: 0 }}><Atd name={p.painel.atendenteIn.name} /></div>
                </div>
              ) : p.painel.atendente ? <Atd name={p.painel.atendente} /> : <div style={{ padding: '7px 0', fontSize: 12, color: '#64748B', border: '1px dashed #d1fae5', borderRadius: 8, textAlign: 'center' }}>+ Transferir para atendente</div>}
            </Field>
          </div>
          {p.painel.lead && (
            <>
              <PanelHead>Lead Vinculado</PanelHead>
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f0fdfb', borderRadius: 9, border: '1px solid #d1fae5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User style={{ width: 13, height: 13, color: '#0d9488' }} />
                    <div><p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1A2B4A' }}>{p.painel.lead.nome}</p><p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{p.painel.lead.aluno}</p></div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 7, border: '1px solid #d1fae5', color: '#0d9488' }}>✏️ Editar</span>
                </div>
                {[['Série', p.painel.lead.serie], ['Origem', p.painel.lead.origem]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '0 2px' }}><span style={{ color: '#64748B' }}>{l}</span><span style={{ color: '#1A2B4A', fontWeight: 500 }}>{v}</span></div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '0 2px', position: 'relative' }}>
                  <span style={{ color: '#64748B' }}>Status</span>
                  {p.painel.lead.statusIn ? (
                    <span style={{ position: 'relative', minWidth: 110, textAlign: 'right' }}>
                      <span {...d({ 'data-out': p.painel.lead.statusIn.at })} style={{ color: '#1A2B4A', fontWeight: 500, position: 'absolute', right: 0 }}>{p.painel.lead.status}</span>
                      <span {...d({ 'data-in': p.painel.lead.statusIn.at })} style={{ color: '#B45309', fontWeight: 700 }}>{p.painel.lead.statusIn.label}</span>
                    </span>
                  ) : <span style={{ color: '#1A2B4A', fontWeight: 500 }}>{p.painel.lead.status}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <span style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 600, color: '#0d9488', border: '1px solid #d1fae5', borderRadius: 7 }}>Ver no CRM</span>
                  <span {...d(p.painel.focusAgendar != null ? { 'data-focus': p.painel.focusAgendar } : {})} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 600, color: '#fff', background: '#2563EB', borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Calendar size={11} /> Agendar Visita</span>
                </div>
              </div>
            </>
          )}
          {p.painel.notas && (
            <div {...d(p.painel.notasFocus != null ? { 'data-focus': p.painel.notasFocus } : {})}>
              <PanelHead>{`Notas Internas (${p.painel.notas.length})`}</PanelHead>
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.painel.notas.map((n, i) => (
                  <div key={i} {...d(n.in != null ? { 'data-in': n.in } : {})} style={{ padding: '8px 10px', background: '#f0fdfb', borderRadius: 8, border: '1px solid #d1fae5' }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#1A2B4A', lineHeight: 1.5 }}>{n.texto}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 10, color: '#94A3B8' }}>{n.autor} · {n.quando}</p>
                  </div>
                ))}
                <div style={{ padding: '7px 9px', fontSize: 12, border: '1px solid #d1fae5', borderRadius: 7, color: '#94A3B8', minHeight: 44 }}>Adicionar nota interna sobre este contato — só a equipe vê...</div>
              </div>
            </div>
          )}
          {p.painel.agendadas && (() => {
            const ag = p.painel.agendadas
            const novo = ag.find(a => a.in != null)
            const antes = ag.filter(a => a.in == null).length
            return (
              <div>
                <PanelHead>
                  {novo ? (
                    <span style={{ position: 'relative', display: 'inline-block' }}>
                      <span {...d({ 'data-out': novo.in })}>{`Mensagens Agendadas (${antes})`}</span>
                      <span {...d({ 'data-in': novo.in })} style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap' }}>{`Mensagens Agendadas (${ag.length})`}</span>
                    </span>
                  ) : `Mensagens Agendadas (${ag.length})`}
                </PanelHead>
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ag.map((m, i) => (
                    <div key={i} {...d({ ...(m.in != null ? { 'data-in': m.in } : {}), ...(m.focus != null ? { 'data-focus': m.focus } : {}) })}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: '#f0fdfb', borderRadius: 8, border: '1px solid #d1fae5' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1A2B4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nome}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{m.quando}</p>
                      </div>
                      <span style={{ flexShrink: 0, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#FEF2F2', color: '#DC2626' }}><X style={{ width: 12, height: 12 }} /></span>
                    </div>
                  ))}
                  <div style={{ width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#0d9488', border: '1px dashed #d1fae5', borderRadius: 9, textAlign: 'center' }}>+ Agendar mensagem</div>
                </div>
              </div>
            )
          })()}
          </>)}
        </div>
      )}
      {p.modal}
    </div>
  )
}
const selSt: React.CSSProperties = { width: '100%', padding: '7px 9px', fontSize: 12, background: '#f0fdfb', border: '1px solid #d1fae5', borderRadius: 8, color: '#1A2B4A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const PanelHead = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fefd', borderBottom: '1px solid #e2f5f3', marginBottom: 10 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</span>
    <ChevronDown style={{ width: 14, height: 14, color: '#0d9488' }} />
  </div>
)
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{label}</label>{children}</div>
)
const Atd = ({ name }: { name: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdfb', borderRadius: 8, border: '1px solid #d1fae5' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{name[0]}</div>
      <span style={{ fontSize: 12, color: '#1A2B4A', fontWeight: 500 }}>{name}</span>
    </div>
    <span style={{ fontSize: 11, color: '#0d9488', fontWeight: 600 }}>Trocar</span>
  </div>
)

// Modal "Agendar visita" — src/components/leads/ScheduleVisitModal.tsx
export function AgendarVisitaModal({ aluno, responsavel, data, hora, inAt, pressAt }: { aluno: string; responsavel: string; data: string; hora: string; inAt?: number; pressAt?: number }) {
  const lab: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }
  const inp: React.CSSProperties = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1A2B4A', background: '#fff' }
  return (
    <div {...d(inAt != null ? { 'data-in': inAt } : {})} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: 460, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Agendar visita</h2><X size={18} color="#94a3b8" />
        </div>
        <div style={{ background: '#EFF6FF', borderRadius: 10, padding: '10px 14px', fontSize: 12, marginBottom: 14, display: 'grid', gap: 3 }}>
          <div style={{ fontWeight: 700, color: '#1E3A8A' }}>{aluno} · {responsavel}</div>
          <div><span style={{ fontWeight: 700, color: '#1D4ED8' }}>Status:</span> <span style={{ color: '#1E3A8A' }}>Em Contato</span></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label style={lab}>Data *</label><div style={inp}>{data}</div></div>
          <div><label style={lab}>Horário *</label><div style={inp}>{hora}</div></div>
        </div>
        <label style={lab}>Observações</label>
        <div style={{ ...inp, color: '#94A3B8', minHeight: 56, marginBottom: 16 }}>Informações importantes sobre a visita...</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <span style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, color: '#64748B' }}>Cancelar</span>
          <span {...d(pressAt != null ? { 'data-press': pressAt, 'data-focus': Math.max(0.3, pressAt - 1.2) } : {})} style={{ padding: '9px 20px', borderRadius: 9, background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 600 }}>Agendar visita</span>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Quadro de famílias interessadas — src/components/leads/LeadKanban.tsx
// (cabeçalho l.1490, colunas l.1560, cartão l.330, motivo de perda l.95)
// ═════════════════════════════════════════════════════════════════════════════
export const STATUS = {
  new:       { label: 'Novo',             accent: '#6b7280', head: '#F3F4F6', text: '#374151', badge: '#6B7280' },
  contact:   { label: 'Em Contato',       accent: '#3b82f6', head: '#EFF6FF', text: '#1E40AF', badge: '#3B82F6' },
  scheduled: { label: 'Visita Agendada',  accent: '#f59e0b', head: '#FFFBEB', text: '#92400E', badge: '#F59E0B' },
  visit:     { label: 'Visitou',          accent: '#f97316', head: '#FFF7ED', text: '#9A3412', badge: '#F97316' },
  proposal:  { label: 'Proposta',         accent: '#8b5cf6', head: '#FAF5FF', text: '#6B21A8', badge: '#8B5CF6' },
  enrolled:  { label: 'Matriculado',      accent: '#22c55e', head: '#F0FDF4', text: '#166534', badge: '#22C55E' },
  lost:      { label: 'Perdido',          accent: '#ef4444', head: '#FEF2F2', text: '#991B1B', badge: '#EF4444' },
}
export type StatusKey = keyof typeof STATUS
const TEMP = { quente: { label: 'Quente', Icon: Flame, color: '#EF4444', bg: '#FEF2F2' }, morno: { label: 'Morno', Icon: Sun, color: '#F59E0B', bg: '#FFFBEB' }, frio: { label: 'Frio', Icon: Snowflake, color: '#3B82F6', bg: '#EFF6FF' } }
export interface Card {
  resp: string; aluno: string; serie: string; origem?: string; temp?: keyof typeof TEMP; fone?: string; atd?: string
  lembrete?: { label: string; cor: 'red' | 'amber' | 'blue' | 'gray' }; perdido?: string; irmaos?: { nome: string; dec: 'enrolled' | 'lost' | 'open' }[]
  move?: string; in?: number; focus?: number; out?: number; focusWA?: number; focusReabrir?: number; focusLembrete?: number
}
const LEMB = { red: { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626' }, amber: { bg: '#FFFBEB', border: '#FDE68A', color: '#B45309' }, blue: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' }, gray: { bg: '#F1F5F9', border: '#E2E8F0', color: '#64748B' } }
export function LeadCard({ c, st }: { c: Card; st: StatusKey }) {
  const cfg = STATUS[st]
  const t = c.temp ? TEMP[c.temp] : null
  const attrs: Record<string, any> = {}
  if (c.move) attrs['data-move'] = c.move
  if (c.in != null) attrs['data-in'] = c.in
  if (c.out != null) attrs['data-out'] = c.out
  if (c.focus != null) attrs['data-focus'] = c.focus
  return (
    <div {...d(attrs)} style={{ position: 'relative', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.05)', overflow: 'hidden', borderLeft: `3px solid ${cfg.accent}` }}>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e2d6b', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{c.resp[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#111827', lineHeight: 1.25, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.resp}</h4>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🎓 {c.aluno}{c.irmaos && <span style={{ marginLeft: 5, fontWeight: 600, color: '#8B5CF6' }}>+{c.irmaos.length - 1} irmão{c.irmaos.length - 1 === 1 ? '' : 's'}</span>}</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          <span style={{ background: 'rgba(20,184,166,.1)', color: '#0d9488', fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(20,184,166,.2)' }}>{c.serie}</span>
          {c.origem && <span style={{ background: '#F3F4F6', color: '#6B7280', fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 999 }}>{c.origem}</span>}
          {t && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: t.bg, color: t.color }}><t.Icon size={10} />{t.label}</span>}
        </div>
        {(c.fone || c.atd) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            {c.fone && <span style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={10} />{c.fone}</span>}
            {c.atd && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#1e2d6b', background: '#EEF2FF', padding: '2px 7px', borderRadius: 999 }}><UserCog size={10} />{c.atd}</span>}
          </div>
        )}
        {c.lembrete && (
          <div {...d(c.focusLembrete != null ? { 'data-focus': c.focusLembrete } : {})} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, marginBottom: 4, background: LEMB[c.lembrete.cor].bg, border: `1px solid ${LEMB[c.lembrete.cor].border}` }}>
            <Bell size={11} color={LEMB[c.lembrete.cor].color} /><span style={{ fontSize: 11, color: LEMB[c.lembrete.cor].color, fontWeight: 600 }}>{c.lembrete.label}</span>
          </div>
        )}
        {c.perdido && <div style={{ background: '#FEF2F2', borderRadius: 6, padding: '4px 8px', marginBottom: 4 }}><p style={{ fontSize: 11, color: '#DC2626', fontWeight: 500, margin: 0 }}>⚠ {c.perdido}</p></div>}
        {c.irmaos && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
            {c.irmaos.map(ch => (
              <div key={ch.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, background: '#F8FAFC', borderRadius: 7, padding: '4px 6px' }}>
                <span style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>{ch.nome}</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {([['enrolled', 'Matric.', '#16A34A'], ['lost', 'Não', '#DC2626'], ['open', 'Aberto', '#64748B']] as const).map(([k, l, col]) => (
                    <span key={k} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, border: `1px solid ${ch.dec === k ? col : '#E2E8F0'}`, background: ch.dec === k ? col : '#fff', color: ch.dec === k ? '#fff' : '#94A3B8' }}>{l}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid #F1F5F9', padding: '5px 8px', display: 'flex', gap: 5 }}>
        {st === 'lost' ? (
          <span {...d(c.focusReabrir != null ? { 'data-focus': c.focusReabrir } : {})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 0', borderRadius: 7, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', fontSize: 11, fontWeight: 700 }}>🔄 Reabrir</span>
        ) : (
          <>
            <span {...d(c.focusWA != null ? { 'data-focus': c.focusWA } : {})} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 0', borderRadius: 7, background: '#DCFCE7', color: '#15803D', fontSize: 11, fontWeight: 700 }}><MessageCircle style={{ width: 12, height: 12 }} /> WA</span>
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 0', borderRadius: 7, background: '#DBEAFE', color: '#1D4ED8', fontSize: 11, fontWeight: 700 }}><Calendar style={{ width: 12, height: 12 }} /> Visita</span>
          </>
        )}
      </div>
    </div>
  )
}
export interface KanbanProps { cols: { st: StatusKey; cards: Card[]; count?: number }[]; modal?: React.ReactNode; height?: number; filtro?: string; toast?: { text: string; sub?: string; at: number } }
export function Kanban({ cols, modal, height = 760, filtro, toast }: KanbanProps) {
  const total = cols.reduce((s, c) => s + (c.count ?? c.cards.length), 0)
  return (
    <div id="shot" style={{ width: 1280, height, padding: 24, background: '#F9FAFB', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users style={{ width: 18, height: 18, color: '#8B5CF6' }} /></div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Leads</h1><span style={{ padding: '2px 10px', background: '#EDE9FE', color: '#7C3AED', fontSize: 12, fontWeight: 700, borderRadius: 999 }}>{total}</span></div>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Gestão do funil de captação</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DemoSeal />
          <div style={{ width: 38, height: 38, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LayoutGrid style={{ width: 16, height: 16, color: '#64748B' }} /></div>
          <span style={{ background: '#00A896', color: 'white', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Plus style={{ width: 16, height: 16 }} /> Novo Lead</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 380 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#9CA3AF' }} />
          <div style={{ padding: '10px 16px 10px 40px', border: '1px solid #E5E7EB', borderRadius: 12, background: '#fff', fontSize: 14, color: '#9CA3AF' }}>Buscar por nome...</div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#64748B' }}><UserCog style={{ width: 14, height: 14 }} /> Meus Leads</span>
        <span {...d(filtro ? { 'data-focus': 0.8 } : {})} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1.5px solid ' + (filtro ? '#00A896' : '#E2E8F0'), background: filtro ? '#F0FDFB' : '#fff', fontSize: 13, fontWeight: 600, color: filtro ? '#00A896' : '#64748B' }}>
          <SlidersHorizontal style={{ width: 14, height: 14 }} /> Filtros{filtro && <span style={{ width: 6, height: 6, borderRadius: 999, background: '#00A896' }} />}
        </span>
        {filtro && <span style={{ padding: '7px 12px', borderRadius: 999, background: '#E6F7F5', color: '#00796B', fontSize: 12, fontWeight: 600 }}>{filtro}</span>}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {cols.map(col => {
          const cfg = STATUS[col.st]
          return (
            <div key={col.st} data-col={col.st} style={{ flexShrink: 0, width: 260, display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: cfg.head, borderRadius: '12px 12px 0 0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${cfg.accent}` }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: cfg.text, display: 'flex', alignItems: 'center', gap: 6 }}><ChevronDown size={14} />{cfg.label}</span>
                <span style={{ background: cfg.badge, color: '#fff', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, minWidth: 24, textAlign: 'center' }}><span data-count>{col.count ?? col.cards.length}</span></span>
              </div>
              <div style={{ background: 'rgba(243,244,246,.6)', borderRadius: '0 0 12px 12px', padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 300 }}>
                {col.cards.map((c, i) => <LeadCard key={i} c={c} st={col.st} />)}
              </div>
            </div>
          )
        })}
      </div>
      {toast && (
        <div {...d({ 'data-in': toast.at })} style={{ position: 'absolute', right: 24, top: 24, zIndex: 30, background: '#fff', border: '1px solid #BBF7D0', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,.15)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, width: 330 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={16} color="#16A34A" /></div>
          <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#166534' }}>{toast.text}</p><p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{toast.sub ?? 'agora'}</p></div>
        </div>
      )}
      {modal}
    </div>
  )
}
const LOST_REASONS = [
  { label: 'Valor da mensalidade alto', fator: 'Interno' }, { label: 'Não retornou nosso contato', fator: 'Externo' },
  { label: 'Escolheu outra escola', fator: 'Externo' }, { label: 'Sem vaga na série de interesse', fator: 'Interno' },
  { label: 'Escola não oferece a série desejada', fator: 'Interno' }, { label: 'Não gostou da escola', fator: 'Interno' },
  { label: 'Mudou de cidade', fator: 'Externo' }, { label: 'Dificuldade financeira', fator: 'Externo' },
  { label: 'Desistiu sem informar motivo', fator: 'Externo' }, { label: 'Outro motivo', fator: 'Interno' },
]
export function MotivoPerdaModal({ aluno, resp, sel = 2, selAt, inAt }: { aluno: string; resp: string; sel?: number; selAt?: number; inAt?: number }) {
  const Row = ({ r, active }: { r: typeof LOST_REASONS[number]; active: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderRadius: 10, border: active ? '2px solid #EF4444' : '1.5px solid #E2E8F0', background: active ? '#FEF2F2' : '#F8FAFC' }}>
      <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#DC2626' : '#475569' }}>{r.label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: r.fator === 'Externo' ? '#EFF6FF' : '#FFF7ED', color: r.fator === 'Externo' ? '#1D4ED8' : '#9A3412' }}>{r.fator}</span>
        {active && <CheckCircle style={{ width: 14, height: 14, color: '#EF4444' }} />}
      </div>
    </div>
  )
  return (
    <div {...d(inAt != null ? { 'data-in': inAt } : {})} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid #fee2e2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle style={{ width: 18, height: 18, color: '#EF4444' }} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Por que este lead foi perdido?</h2><p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{aluno} · {resp}</p></div>
          <div style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X style={{ width: 13, height: 13, color: '#94A3B8' }} /></div>
        </div>
        <div data-focus-list style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {LOST_REASONS.map((r, i) => i === sel && selAt != null ? (
            <div key={i} style={{ position: 'relative' }}>
              <div {...d({ 'data-out': selAt })}><Row r={r} active={false} /></div>
              <div {...d({ 'data-in': selAt, 'data-focus': selAt + 0.2 })} style={{ position: 'absolute', inset: 0 }}><Row r={r} active /></div>
            </div>
          ) : <Row key={i} r={r} active={i === sel && selAt == null} />)}
        </div>
        <div {...d(selAt != null ? { 'data-in': selAt + 0.3 } : {})} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '9px 14px', marginBottom: 14, fontSize: 12, color: '#1E40AF' }}>
          <strong>Fator {LOST_REASONS[sel].fator}</strong>{LOST_REASONS[sel].fator === 'Externo' ? ' — Fatores fora do controle da escola' : ' · Administrativo — Pontos que a escola pode melhorar'}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <span style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, color: '#64748B', fontWeight: 500 }}>Cancelar</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 9, background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 600 }}><AlertTriangle style={{ width: 13, height: 13 }} />Confirmar perda</span>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Início do gestor — src/pages/gestor/GestorHome.tsx (cabeçalho l.1300,
// alertas l.1345, indicadores l.1375, Ranking da Equipe l.1597, IA l.2430)
// ═════════════════════════════════════════════════════════════════════════════
export const RANKING = [
  { nome: 'Ana Beatriz Lima', score: 92, atr: 46, av: 31, mat: 14, wa: 128, resp: '4m', sat: 94 },
  { nome: 'Camila Rocha', score: 81, atr: 39, av: 24, mat: 11, wa: 102, resp: '7m', sat: 89 },
  { nome: 'Bruno Lima', score: 64, atr: 33, av: 17, mat: 7, wa: 87, resp: '12m', sat: 81 },
  { nome: 'Patrícia Gomes', score: 52, atr: 28, av: 12, mat: 5, wa: 64, resp: '19m', sat: 76 },
]
export function GestorHome({ show = ['header', 'alerts', 'kpis', 'ranking', 'ia'], focus, periodo = 'Mês', alertas, height, width = 1280 }: { show?: string[]; focus?: Record<string, number>; periodo?: string; alertas?: { type: 'warning' | 'info' | 'success'; msg: string; action?: string }[]; height?: number; width?: number }) {
  const f = (k: string) => (focus && focus[k] != null ? { 'data-focus': focus[k] } : {})
  const al = alertas ?? [
    { type: 'warning' as const, msg: '12 leads sem contato há mais de 5 dias', action: 'Ver leads' },
    { type: 'warning' as const, msg: 'Cadastros 54% da meta — intensifique captação', action: 'Ver funil' },
  ]
  const AL = { warning: { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B', Icon: AlertTriangle }, success: { bg: '#F0FDF4', border: '#BBF7D0', color: '#166534', Icon: CheckCircle }, info: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF', Icon: Info } }
  const kpis = [
    { label: 'Leads no período', value: '184', var: 23, Icon: Users, color: '#00A896', bg: '#F0FDFA' },
    { label: 'Conversas WhatsApp', value: '312', Icon: MessageCircle, color: '#25D366', bg: '#F0FDF4' },
    { label: 'Matrículas', value: '38', var: 15, Icon: GraduationCap, color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Taxa de conversão', value: '20,7%', Icon: TrendingUp, color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Satisfação média', value: '91%', Icon: Star, color: '#16A34A', bg: '#FFFBEB' },
    { label: 'Tempo de resposta', value: '8min', Icon: Clock, color: '#0EA5E9', bg: '#F0F9FF' },
  ]
  const cols = '28px 1fr 44px 44px 44px 52px 52px 64px 56px'
  return (
    <div id="shot" style={{ width, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: '#F9FAFB', ...(height ? { height, overflow: 'hidden' } : {}) }}>
      {show.includes('header') && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Boa tarde, Paula!</h1>
            <p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>{ESCOLA} • terça-feira, 13 de outubro de 2026</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DemoSeal />
            {['Hoje', 'Semana', 'Mês', 'Ano'].map(p => <span key={p} {...d(p === periodo && focus?.periodo != null ? { 'data-focus': focus.periodo } : {})} style={{ padding: '6px 14px', borderRadius: 20, background: p === periodo ? '#00A896' : '#F3F4F6', color: p === periodo ? 'white' : '#374151', fontSize: 13, fontWeight: 500 }}>{p}</span>)}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: '#F0FDF4', border: '1px solid #BBF7D0' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} /><span style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>23 conversas abertas</span></div>
            <span {...d(f('pdf'))} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Exportar PDF</span>
          </div>
        </div>
      )}
      {show.includes('alerts') && (
        <div {...d(f('alerts'))} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {al.map((a, i) => {
            const c = AL[a.type]
            return (
              <div key={i} {...d({ 'data-in': 0.3 + i * 0.35 })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, background: c.bg, border: `1px solid ${c.border}` }}>
                <c.Icon size={16} color={c.color} /><span style={{ fontSize: 13, color: c.color, flex: 1, fontWeight: 500 }}>{a.msg}</span>
                {a.action && <span style={{ fontSize: 11, fontWeight: 700, color: c.color, background: 'rgba(0,0,0,0.06)', borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>{a.action} <ArrowRight size={10} /></span>}
              </div>
            )
          })}
        </div>
      )}
      {show.includes('kpis') && (
        <div {...d(f('kpis'))} style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
          {kpis.map(k => (
            <div key={k.label} {...d(k.label === 'Tempo de resposta' ? f('tempo') : {})} style={{ background: k.bg, borderRadius: 16, padding: '16px 18px', border: `1px solid ${k.color}22`, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <div style={{ marginBottom: 8 }}><k.Icon size={20} color={k.color} /></div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1 }}><span data-count>{k.value}</span></div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{k.label}</div>
              {k.var != null && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3 }}><ArrowUp size={11} />{k.var}% vs anterior</div>}
            </div>
          ))}
        </div>
      )}
      {show.includes('origem') && (() => {
        const src: [string, number, string][] = [['Instagram', 412, '#E1306C'], ['WhatsApp', 356, '#25D366'], ['Indicação', 198, '#F59E0B'], ['Site', 141, '#6366F1'], ['Facebook', 96, '#1877F2'], ['Vitrine', 74, '#9CA3AF']]
        const max = 450, H0 = 190
        return (
          <div {...d(f('origem'))} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Leads por origem</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: H0, borderBottom: '1px solid #F3F4F6', padding: '0 10px' }}>
              {src.map(([n, v, c], i) => <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4 }}><span data-count>{v}</span></span><div {...d({ 'data-in': 0.3 + i * 0.2 })} style={{ width: '70%', height: (v / max) * (H0 - 24), background: c, borderRadius: '6px 6px 0 0' }} /></div>)}
            </div>
            <div style={{ display: 'flex', gap: 18, padding: '6px 10px 0' }}>{src.map(([n]) => <span key={n} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#6B7280' }}>{n}</span>)}</div>
          </div>
        )
      })()}
      {show.includes('ranking') && (
        <div {...d(f('ranking'))} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trophy size={16} color="#F59E0B" /></div>
              <div><h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Ranking da Equipe</h3><p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Score: matrículas + resposta + satisfação · clique num atendente pra ver o detalhe</p></div>
            </div>
            <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>Ver relatórios <ChevronRight size={12} /></span>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 4, padding: '12px 8px 8px', borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
              {[[Award, ''], [User, 'Atendente'], [Bolt, 'Score'], [Users, 'Atrib.'], [TrendingUp, 'Avanç.'], [GraduationCap, 'Mat.'], [MessageCircle, 'WA'], [Clock, 'T. Resp.'], [Star, 'Satisf.']].map(([I, l]: any) => (
                <div key={l} style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}><I size={11} />{l}</div>
              ))}
            </div>
            {RANKING.map((u, i) => (
              <div key={u.nome} {...d({ 'data-in': 0.3 + i * 0.3 })} style={{ display: 'grid', gridTemplateColumns: cols, gap: 4, alignItems: 'center', padding: '7px 8px', borderRadius: 8, background: i % 2 === 1 ? '#f8fafc' : '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>{i === 0 ? <Trophy size={15} color="#F59E0B" /> : i < 3 ? <Medal size={15} color={['', '#9CA3AF', '#CD7C4B'][i]} /> : <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>#{i + 1}</span>}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#4f46e5' }}>{ini(u.nome)}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1e2d6b' }}>{u.nome}</span>
                  </div>
                  <div style={{ height: 3, background: '#f1f5f9', borderRadius: 9999, marginTop: 4, marginLeft: 28 }}><div data-grow style={{ height: 3, width: `${Math.round(u.score / 92 * 100)}%`, background: i === 0 ? '#F59E0B' : '#6366f1', borderRadius: 9999 }} /></div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#F59E0B', textAlign: 'center' }}><span data-count>{u.score}</span></div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1e2d6b', textAlign: 'center' }}><span data-count>{u.atr}</span></div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0d9488', textAlign: 'center' }}><span data-count>{u.av}</span></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED', textAlign: 'center' }}><span data-count>{u.mat}</span></div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#25D366', textAlign: 'center' }}><span data-count>{u.wa}</span></div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#EF4444', textAlign: 'center' }}>{u.resp}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: u.sat >= 85 ? '#16a34a' : '#f59e0b', textAlign: 'center' }}><span data-count>{u.sat}</span>%</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {show.includes('ia') && (
        <div {...d(f('ia'))} style={{ background: '#F8FAFC', borderRadius: 14, border: '1px solid #E2E8F0', padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Sparkles size={13} color="#6366F1" /><span style={{ fontSize: 12, fontWeight: 700, color: '#374151', flex: 1 }}>Análise da IA</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>13/10, 14:20</span>
            <span style={{ padding: '2px 4px', borderRadius: 6, border: '1px solid #E2E8F0', display: 'flex' }}><RefreshCw size={16} color="#94a3b8" /></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <p {...d({ 'data-type': '0.6,3.4' })} style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5, flex: 1 }}>O gargalo está entre o cadastro e o agendamento: 12 famílias interessadas estão sem contato há mais de 5 dias. Priorize o retorno a essas famílias nesta semana e ofereça horários de visita já na primeira conversa.</p>
            <span style={{ fontSize: 11, color: '#6366F1', fontWeight: 600, whiteSpace: 'nowrap' }}>Ver análise completa</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Editor de Fluxo — src/components/whatsapp/FlowEditor.tsx (CFG l.83, barra
// l.1285, lateral l.1352, cartão de bloco l.765, corpos l.276)
// ═════════════════════════════════════════════════════════════════════════════
const NCFG: Record<string, { color: string; label: string; icon: string }> = {
  start: { color: '#10b981', label: 'Início', icon: '▶' }, message: { color: '#3b82f6', label: 'Mensagem', icon: '💬' },
  question: { color: '#8b5cf6', label: 'Pergunta', icon: '?' }, menu: { color: '#f59e0b', label: 'Menu', icon: '☰' },
  transfer: { color: '#0d9488', label: 'Transferir', icon: '→' }, condition: { color: '#ef4444', label: 'Condição', icon: '⚡' },
  action: { color: '#ec4899', label: 'Ação', icon: '★' }, wait: { color: '#6b7280', label: 'Aguardar', icon: '⏱' },
  media: { color: '#06b6d4', label: 'Mídia', icon: '📷' }, end: { color: '#374151', label: 'Fim', icon: '■' },
}
const inSt: React.CSSProperties = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 8px', fontSize: 12, background: 'white', color: '#1e293b' }
function FlowNode({ type, x, y, children, attrs }: { type: string; x: number; y: number; children: React.ReactNode; attrs?: Record<string, any> }) {
  const c = NCFG[type]
  return (
    <div {...d(attrs || {})} style={{ position: 'absolute', left: x, top: y, width: 240, borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.09)', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', zIndex: 5 }}>
      {type !== 'start' && <div style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: 'white', border: `2.5px solid ${c.color}` }} />}
      <div style={{ background: c.color, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: '12px 12px 0 0' }}>
        <span style={{ fontSize: 15, color: '#fff' }}>{c.icon}</span><span style={{ color: 'white', fontWeight: 700, fontSize: 12, flex: 1 }}>{c.label}</span>
        {type !== 'start' && <span style={{ background: 'rgba(255,255,255,0.22)', color: 'white', borderRadius: 4, padding: '2px 5px', fontSize: 14, lineHeight: 1 }}>×</span>}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
      <div style={{ position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: c.color, border: '2.5px solid #fff' }} />
    </div>
  )
}
export function FlowEditorTela({ ativo = true, ativoAt, menuIn, perguntaIn, transferIn }: { ativo?: boolean; ativoAt?: number; menuIn?: number; perguntaIn?: number; transferIn?: number }) {
  const at = (v?: number) => (v != null ? { 'data-in': v } : undefined)
  const edge = (x1: number, y1: number, x2: number, y2: number, v?: number) => {
    const dy = Math.max(40, Math.abs(y2 - y1) * 0.5)
    return <path {...d(v != null ? { 'data-in': v } : {})} d={`M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`} stroke="#94a3b8" strokeWidth={2} fill="none" />
  }
  const Ativo = ({ on }: { on: boolean }) => (
    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: on ? '#dcfce7' : '#f1f5f9', color: on ? '#16a34a' : '#64748b', border: `1px solid ${on ? '#bbf7d0' : '#e2e8f0'}`, fontWeight: 600 }}>{on ? '🤖 Robô ativo' : '👤 Robô inativo'}</span>
  )
  return (
    <div id="shot" style={{ width: 1280, height: 780, display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ height: 52, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ padding: '7px 12px', borderRadius: 8, background: '#f8fafc', color: '#475569', fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0' }}>← Voltar</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a2b4a' }}>Editor de Fluxo</span>
          {ativoAt != null ? (
            <span {...d({ 'data-focus': ativoAt - 0.8 })} style={{ position: 'relative', display: 'inline-block' }}>
              <span {...d({ 'data-out': ativoAt })}><Ativo on={false} /></span>
              <span {...d({ 'data-in': ativoAt })} style={{ position: 'absolute', left: 0, top: 0 }}><Ativo on /></span>
            </span>
          ) : <Ativo on={ativo} />}
          <span style={{ fontSize: 11, color: '#94a3b8' }}>5 blocos · 4 conexões</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DemoSeal small />
          <span style={{ padding: '7px 12px', borderRadius: 8, background: '#f8fafc', color: '#475569', fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0' }}>⊡ Ajustar</span>
          <span style={{ padding: '7px 12px', borderRadius: 8, background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 600 }}>↑ Salvar fluxo</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 156, borderRight: '1px solid #e2e8f0', background: '#f8fafc', padding: '10px 6px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px 4px' }}>Blocos</p>
          <div style={{ padding: '7px 10px', marginBottom: 3, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>▶ INÍCIO <span style={{ fontWeight: 400, color: '#4ade80', fontSize: 10 }}>(fixo)</span></div>
          {['message', 'question', 'menu', 'transfer', 'condition', 'action', 'wait', 'media', 'end'].map(t => (
            <div key={t} {...d(t === 'menu' && menuIn != null ? { 'data-press': menuIn - 0.3 } : {})} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: `${NCFG[t].color}12`, border: `1px solid ${NCFG[t].color}30`, borderRadius: 8, fontSize: 11, fontWeight: 600, color: NCFG[t].color, marginBottom: 3 }}><span>{NCFG[t].icon}</span> {NCFG[t].label}</div>
          ))}
          <div style={{ marginTop: 10, padding: 9, background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 10, color: '#94a3b8', lineHeight: 1.55 }}>Clique para adicionar. Arraste pelo cabeçalho. Conecte as portas.</div>
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px) 0 0 / 24px 24px, #f8fafc' }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}>
            {edge(160, 98, 160, 136)}
            {edge(160, 300, 180, 358, menuIn)}
            {edge(130, 640, 540, 120, perguntaIn)}
            {edge(660, 290, 660, 420, transferIn)}
          </svg>
          <FlowNode type="start" x={40} y={20}><p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Início do fluxo</p></FlowNode>
          <FlowNode type="message" x={40} y={140}>
            <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>{['Texto', 'Imagem', 'Vídeo', 'Doc', 'Áudio', 'Contato'].map((t, i) => <span key={t} style={{ padding: '3px 6px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: i === 0 ? '#3b82f6' : '#f1f5f9', color: i === 0 ? '#fff' : '#64748b' }}>{t}</span>)}</div>
            <div style={{ ...inSt, minHeight: 54 }}>Olá! 👋 Bem-vindo ao atendimento do {ESCOLA}.</div>
          </FlowNode>
          <FlowNode type="menu" x={60} y={362} attrs={at(menuIn)}>
            <div style={{ ...inSt, marginBottom: 8 }}>Sobre o que você quer falar?</div>
            {['Matrículas', 'Financeiro', 'Secretaria'].map((o, i) => (
              <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 5 }}>
                <span style={{ background: '#f59e0b', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <div style={{ ...inSt, display: 'flex', justifyContent: 'space-between' }}>{o}<span style={{ fontSize: 9, color: '#94a3b8' }}>{o.length}/20</span></div>
              </div>
            ))}
            <p style={{ fontSize: 10, color: '#64748b', margin: '4px 0 0' }}>🔘 Botões interativos</p>
          </FlowNode>
          <FlowNode type="question" x={420} y={124} attrs={at(perguntaIn)}>
            <div style={{ ...inSt, minHeight: 40, marginBottom: 6 }}>Qual o nome do aluno e a série de interesse?</div>
            <div style={inSt}>nome_aluno</div>
          </FlowNode>
          <FlowNode type="transfer" x={540} y={424} attrs={at(transferIn)}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>{['👤 Atendente', '👥 Grupo', '🌐 Geral'].map((t, i) => <span key={t} style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid', borderColor: i === 1 ? '#0d9488' : '#e2e8f0', background: i === 1 ? '#0d9488' : '#fff', color: i === 1 ? '#fff' : '#64748b' }}>{t}</span>)}</div>
            <div style={inSt}>🎓 Matrículas</div>
            <div style={{ ...inSt, marginTop: 6, color: '#64748b' }}>Já vou te passar para a nossa equipe!</div>
          </FlowNode>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Plano de campanha — src/components/reports/CampaignGeneratorModal.tsx,
// Step5Review (l.745): resumo, análise da IA, nível de ambição e tabela mensal
// ═════════════════════════════════════════════════════════════════════════════
const PLANO = [
  ['Set/2026', 40, 26, 17, 6, 22, 4200], ['Out/2026', 62, 41, 27, 11, 58, 6100], ['Nov/2026', 70, 46, 30, 13, 64, 6500],
  ['Dez/2026', 38, 25, 16, 7, 31, 3300], ['Jan/2027', 52, 34, 22, 9, 26, 4800], ['Fev/2027', 24, 15, 10, 4, 9, 1900],
] as const
export function PlanoCampanha({ nivel = 1, nivelAt, height, aplicarAt }: { nivel?: number; nivelAt?: number; height?: number; aplicarAt?: number }) {
  const th = (c: string, bg: string): React.CSSProperties => ({ padding: '10px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: c, borderBottom: '1px solid #E2E8F0', background: bg, whiteSpace: 'nowrap' })
  const cell = (v: number, b: string, c = '#1A2B4A', w = 54) => <td style={{ padding: '3px 4px', textAlign: 'center' }}><span style={{ display: 'inline-block', width: w, padding: '3px 4px', borderRadius: 5, border: `1px solid ${b}`, fontSize: 11, color: c, background: '#fff' }}><span data-count>{v.toLocaleString('pt-BR')}</span></span></td>
  const tot = PLANO.reduce((a, r) => ({ c: a.c + r[1], a: a.a + r[2], v: a.v + r[3], n: a.n + r[4], r: a.r + r[5], i: a.i + r[6] }), { c: 0, a: 0, v: 0, n: 0, r: 0, i: 0 })
  const Nivel = ({ sel }: { sel: number }) => (
    <div style={{ display: 'flex', gap: 6 }}>{[['🛡️', 'Conserv.'], ['🎯', 'Realista'], ['🚀', 'Agressivo']].map(([i, t], k) => (
      <span key={t} style={{ flex: 1, padding: '7px 3px', borderRadius: 8, fontSize: 10, fontWeight: 600, border: sel === k ? '2px solid #00A896' : '1px solid #E2E8F0', background: sel === k ? '#E6F7F5' : '#fff', color: sel === k ? '#00A896' : '#64748B', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><span style={{ fontSize: 14 }}>{i}</span><span>{t}</span></span>
    ))}</div>
  )
  return (
    <div id="shot" style={{ width: 1160, background: '#fff', padding: 24, ...(height ? { height, overflow: 'hidden' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1A2B4A' }}>Plano — Ano letivo 2027</h3>
          <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#DCFCE7', color: '#166534' }}>Meta Realista</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DemoSeal />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 12, color: '#64748B', fontWeight: 600 }}><Edit3 size={12} /> Ajustar metas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 600 }}><RefreshCw size={12} /> Recalcular com IA</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
        {[['Total projetado', '612', 'alunos no final', '#1A2B4A', '#F8FAFC', Users], ['Novatos (meta)', '50', 'novas matrículas', '#00A896', '#E6F7F5', TrendingUp], ['Rematrículas (meta)', '210', '548 elegíveis', '#3B82F6', '#EFF6FF', RefreshCw], ['Investimento total', 'R$ 26.800', 'CPA médio R$ 536', '#8B5CF6', '#F5F3FF', DollarSign]].map(([l, v, s, c, bg, I]: any) => (
          <div key={l} style={{ background: bg, borderRadius: 14, padding: '16px 18px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</span><I size={18} color={c} /></div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c, lineHeight: 1 }}><span data-count>{v}</span></p><p style={{ margin: '4px 0 0', fontSize: 11, color: '#94A3B8' }}>{s}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, marginBottom: 18 }}>
        <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '12px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><Sparkles size={13} color="#3B82F6" /><span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>Análise da IA</span></div><p style={{ margin: 0, fontSize: 12, color: '#1E40AF', lineHeight: 1.65 }}>Com base no histórico de 2024 a 2026, a escola cresce em média 6% ao ano. Outubro e novembro concentram 45% das matrículas: é nesses meses que a captação precisa estar no ritmo máximo.</p></div>
        <div {...d(nivelAt != null ? { 'data-focus': nivelAt - 0.6 } : {})} style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}><SlidersHorizontal size={12} /> Nível de ambição</p>
          {nivelAt != null ? (
            <div style={{ position: 'relative' }}><div {...d({ 'data-out': nivelAt })}><Nivel sel={1} /></div><div {...d({ 'data-in': nivelAt })} style={{ position: 'absolute', inset: 0 }}><Nivel sel={nivel} /></div></div>
          ) : <Nivel sel={nivel} />}
          <p style={{ margin: '6px 0 0', fontSize: 9, color: '#94A3B8', textAlign: 'center' }}>Escala proporcional sem chamar a IA</p>
        </div>
      </div>
      <div style={{ borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: '#F8FAFC' }}>
            <th style={{ ...th('#64748B', '#F8FAFC'), textAlign: 'left', padding: '10px 12px' }}>Mês</th>
            {['Cadastros', 'Agendas', 'Visitas'].map(h => <th key={h} style={th('#1D4ED8', '#F0F7FF')}>{h}</th>)}
            <th style={th('#0d9488', '#F0FDFB')}>Novatos</th><th style={th('#16a34a', '#F0FDFB')}>Remat.</th><th style={th('#065F46', '#F0FDFB')}>Total</th>
            {['Invest. R$', 'CPA R$'].map(h => <th key={h} style={th('#7C3AED', '#F9F5FF')}>{h}</th>)}
          </tr></thead>
          <tbody>
            {PLANO.map((r, i) => {
              const key = r[0].startsWith('Out') || r[0].startsWith('Nov')
              const te = r[4] + r[5]
              return (
                <tr key={r[0]} {...d(key ? { 'data-focus': 2.4 + (r[0].startsWith('Nov') ? 0.15 : 0) } : {})} style={{ borderBottom: '1px solid #F8FAFC', background: key ? '#FFFBEB' : i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 600, color: '#1A2B4A', whiteSpace: 'nowrap', fontSize: 11 }}>{r[0]}{key && <span style={{ marginLeft: 4, fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>★</span>}</td>
                  {cell(r[1], '#BFDBFE')}{cell(r[2], '#BFDBFE')}{cell(r[3], '#BFDBFE')}{cell(r[4], '#99F6E4', '#0d9488')}{cell(r[5], '#BBF7D0', '#16a34a')}
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: '#065F46', fontSize: 12 }}><span data-count>{te}</span></td>
                  {cell(r[6], '#DDD6FE', '#1A2B4A', 64)}
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: '#7C3AED', fontSize: 11 }}><span data-count>{Math.round(r[6] / te).toLocaleString('pt-BR')}</span></td>
                </tr>
              )
            })}
            <tr style={{ background: '#F0FDFB', borderTop: '2px solid #00A896' }}>
              <td style={{ padding: '9px 12px', fontWeight: 800, color: '#1A2B4A', fontSize: 12 }}>TOTAL</td>
              {[tot.c, tot.a, tot.v].map((v, i) => <td key={i} style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#1D4ED8' }}><span data-count>{v}</span></td>)}
              <td style={{ textAlign: 'center', fontWeight: 800, color: '#0d9488' }}><span data-count>{tot.n}</span></td>
              <td style={{ textAlign: 'center', fontWeight: 800, color: '#16a34a' }}><span data-count>{tot.r}</span></td>
              <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 13, color: '#065F46' }}><span data-count>{tot.n + tot.r}</span></td>
              <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#7C3AED' }}>R$ <span data-count>{tot.i.toLocaleString('pt-BR')}</span></td>
              <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#7C3AED' }}>R$ <span data-count>{Math.round(tot.i / (tot.n + tot.r)).toLocaleString('pt-BR')}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94A3B8' }}>★ Meses críticos · Azul = captação · Verde = matrículas · Roxo = financeiro · Células editáveis</p>
      {aplicarAt != null && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, color: '#475569' }}>Voltar</span>
          <span {...d({ 'data-focus': aplicarAt - 1.2, 'data-press': aplicarAt })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 600 }}><Check size={14} />Aplicar ao sistema</span>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Diagnóstico de transferência — src/pages/gestor/GestorTransfers.tsx
// (Modal l.981 "Diagnóstico IA", DiagnosisView l.996)
// ═════════════════════════════════════════════════════════════════════════════
export function DiagnosticoTransferencia() {
  const lab: React.CSSProperties = { margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }
  return (
    <div id="shot" style={{ width: 760, background: 'rgba(15,23,42,0.6)', padding: 40 }}>
      <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>Diagnóstico IA</h2>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><DemoSeal /><X size={18} color="#94a3b8" /></span>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f8fafc', borderRadius: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={18} color="#DC2626" /></div>
            <div><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Gabriel Fernandes</p><p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>7º ano</p></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div {...d({ 'data-in': 0.3, 'data-focus': 2.2 })} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
              <p style={lab}>Motivo principal</p>
              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}>Financeiro</span>
            </div>
            <div {...d({ 'data-in': 0.5 })} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confiança</span><span style={{ fontSize: 12, fontWeight: 700, color: '#1e2d6b' }}><span data-count>82</span>%</span></div>
              <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}><div data-grow style={{ height: '100%', width: '82%', background: 'linear-gradient(90deg,#00A896,#0DD3BF)', borderRadius: 99 }} /></div>
            </div>
          </div>
          <div {...d({ 'data-in': 0.9 })}>
            <p style={lab}>Diagnóstico completo</p>
            <p {...d({ 'data-type': '1.0,3.0' })} style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.6, background: '#f8fafc', padding: '12px 14px', borderRadius: 10 }}>A família informou que o valor da mensalidade ficou acima do orçamento após a mudança de emprego de um dos responsáveis. A distância foi citada, mas não é o fator decisivo. A família avalia bem o ensino e não chegou a negociar condições com a escola.</p>
          </div>
          <div {...d({ 'data-in': 1.4 })}>
            <p style={lab}>Fatores de risco</p>
            {['Mudança na renda da família', 'Nenhuma conversa sobre condições de pagamento'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 6 }}><AlertTriangle size={13} color="#D97706" /><span style={{ fontSize: 12, color: '#92400e' }}>{f}</span></div>
            ))}
          </div>
          <div {...d({ 'data-in': 1.8, 'data-focus': 2.6 })} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}><CheckCircle size={15} color="#16a34a" /><span style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Oportunidade de retenção</span></div>
            <p style={{ margin: 0, fontSize: 13, color: '#15803d', lineHeight: 1.5 }}>A família gosta da escola. Uma conversa sobre condições de pagamento pode manter o aluno.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, background: '#f0fdf4', color: '#16a34a', fontSize: 13, fontWeight: 700 }}><CheckCircle size={14} /> Marcar como retido</span>
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, background: '#FEE2E2', color: '#DC2626', fontSize: 13, fontWeight: 700 }}><ArrowRightLeft size={14} /> Transferência confirmada</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Celular com WhatsApp da família (visão da família, não é tela do painel)
// ═════════════════════════════════════════════════════════════════════════════
export interface PMsg { me?: boolean; text: string; time: string; in?: number; botoes?: string[]; template?: boolean; focus?: number }
const Ticks = () => <svg width="14" height="10" viewBox="0 0 16 11" fill="none" stroke="#53BDEB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6l3 3 6-7" /><path d="M6 9l1 1 7-8" /></svg>
export function Celular({ msgs, dia = 'HOJE', hora = '09:41', digitando, altura = 900, contato = ESCOLA, sub = 'Conta comercial', topo }: { msgs: PMsg[]; dia?: string; hora?: string; digitando?: { text: string; t0: number; t1: number; out?: number }; altura?: number; contato?: string; sub?: string; topo?: React.ReactNode }) {
  const bubble: React.CSSProperties = { borderRadius: 12, padding: '10px 13px 6px', fontSize: 19, lineHeight: 1.42, color: '#111B21', boxShadow: '0 1px 1px rgba(0,0,0,.1)', maxWidth: '84%' }
  const h = (t: string, out?: boolean) => <span style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, fontSize: 13, color: '#667781', marginTop: 3 }}>{t}{out && <Ticks />}</span>
  return (
    <div id="shot" style={{ width: 430, background: 'transparent' }}>
      <div style={{ background: '#111', borderRadius: 54, padding: 13 }}>
        <div style={{ borderRadius: 42, overflow: 'hidden', background: '#EFEAE2', height: altura, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#fff', padding: '14px 26px 0', display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#111' }}><span>{hora}</span><span style={{ width: 110, height: 30, background: '#111', borderRadius: 20, marginTop: -6 }} /><span>5G ▮</span></div>
          <div style={{ background: '#fff', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #E9EDEF' }}>
            <span style={{ fontSize: 22, color: '#54656F' }}>‹</span>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#0F766E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15 }}>{ini(contato)}</div>
            <div><p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#111B21' }}>{contato}</p><p style={{ margin: 0, fontSize: 14, color: '#667781' }}>{sub}</p></div>
          </div>
          {topo}
          <div style={{ flex: 1, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
            <span style={{ alignSelf: 'flex-end', fontSize: 13, fontWeight: 700, color: '#BE185D', background: '#FDF2F8', border: '1.5px dashed #F9A8D4', borderRadius: 999, padding: '3px 10px' }}>Ilustração · dados de exemplo</span>
            <span style={{ alignSelf: 'center', background: '#fff', color: '#54656F', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8, boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>{dia}</span>
            {msgs.map((m, i) => (
              <div key={i} data-msg {...d(m.in != null ? { 'data-in': m.in } : {})} {...d(m.focus != null ? { 'data-focus': m.focus } : {})} style={{ alignSelf: m.me ? 'flex-end' : 'flex-start', maxWidth: '86%' }}>
                <div style={{ ...bubble, maxWidth: 'none', background: m.me ? '#D9FDD3' : '#fff' }}>{m.text}{h(m.time, m.me)}</div>
                {m.botoes?.map(b => <div key={b} style={{ marginTop: 4, background: '#fff', borderRadius: 10, padding: '11px 0', textAlign: 'center', fontSize: 17, fontWeight: 600, color: '#008069', boxShadow: '0 1px 1px rgba(0,0,0,.1)' }}>↩ {b}</div>)}
              </div>
            ))}
          </div>
          <div style={{ background: '#F0F2F5', padding: '10px 14px 24px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: 22, padding: '11px 16px', fontSize: 17, color: digitando ? '#111B21' : '#8696A0' }}>{digitando ? <span {...d({ 'data-type': `${digitando.t0},${digitando.t1}`, ...(digitando.out != null ? { 'data-out': digitando.out } : {}) })}>{digitando.text}</span> : 'Mensagem'}</div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#00A884' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
