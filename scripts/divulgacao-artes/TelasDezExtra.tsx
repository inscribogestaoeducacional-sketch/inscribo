// =============================================================================
// scripts/divulgacao-artes/TelasDezExtra.tsx
//
// Telas de dezembro das peças A31 e R19 (as duas que faltavam no calendário
// v2). Mesmas regras de TelasApp.tsx: espelham o JSX/estilos das telas reais,
// com dados fictícios do "Colégio Horizonte".
// =============================================================================
import React from 'react'
import { X, Users, Calendar, MessageCircle, BarChart3, TrendingDown, Star, GraduationCap, TrendingUp, Target, Bell, ChevronRight, Lock, RotateCw } from 'lucide-react'
import { DemoSeal } from './TelasApp'

const d = (o: Record<string, any>) => o as any

// ── A31 — "Agendar Mensagem" (src/components/whatsapp/WhatsAppHub.tsx ~6416) ──
// Template aprovado, variáveis e "Enviar em". Vai no `modal` do WhatsApp
// (cobre a tela toda). A atendente digita o nome, clica em Agendar e a janela
// fecha; a mensagem nova aparece em "Mensagens Agendadas" (painel lateral).
export function AgendarMensagemModal({ typeAt = [0.7, 1.5], pressAt = 2.4, outAt = 2.7 }: { typeAt?: [number, number]; pressAt?: number; outAt?: number }) {
  const lab: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 4 }
  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: 14, background: '#F1F5F9', borderRadius: 8, color: '#1A2B4A', minHeight: 36 }
  return (
    <div {...d({ 'data-out': outAt })} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 384, boxShadow: '0 25px 50px rgba(0,0,0,0.25)', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Agendar Mensagem</h3>
          <X size={16} color="#64748B" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lab}>Template</label>
            <div style={{ ...inp, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>Retorno após o recesso <span style={{ color: '#94A3B8', fontSize: 11 }}>▾</span></div>
          </div>
          <div>
            <label style={{ ...lab, marginBottom: 8 }}>Variáveis</label>
            <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>Nome do responsável</label>
            <div style={inp}><span {...d({ 'data-type': typeAt.join(',') })}>Mariana</span></div>
          </div>
          <div>
            <label style={lab}>Enviar em</label>
            <div style={{ ...inp, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>05/01/2027, 08:30 <Calendar size={14} color="#64748B" /></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <span style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 500, color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 8, textAlign: 'center' }}>Cancelar</span>
          <span {...d({ 'data-press': pressAt, 'data-focus': pressAt - 0.6 })} style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#fff', background: '#00A896', borderRadius: 8, textAlign: 'center' }}>Agendar</span>
        </div>
      </div>
    </div>
  )
}

// ── R19 — painel do gestor no celular (src/pages/gestor/GestorHome.tsx, ramo isMobile ~1160) ──
// Saudação + Score, alerta principal, KPIs 2×2, "Campanha ativa" (cadastros,
// agendamentos, visitas e matrículas do mês × meta), "Acesso rápido" e
// "Alertas". A barra do navegador por cima mostra que o sistema abre no
// navegador do celular, sem instalar nada. A tela real NÃO mostra a taxa de
// conversão no celular — por isso a narração do R19 fala só em interessados
// e matrículas.
const QUICK = [
  { label: 'Leads', Icon: Users, bg: '#EDE9FE', color: '#7C3AED' },
  { label: 'Visitas', Icon: Calendar, bg: '#FEF3C7', color: '#D97706' },
  { label: 'WhatsApp', Icon: MessageCircle, bg: '#D1FAE5', color: '#059669' },
  { label: 'Relatórios', Icon: BarChart3, bg: '#DBEAFE', color: '#2563EB' },
  { label: 'Transferências', Icon: TrendingDown, bg: '#FEE2E2', color: '#DC2626' },
  { label: 'Pesquisas', Icon: Star, bg: '#F5F3FF', color: '#7C3AED' },
]
const ALERT_C = {
  warning: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  info: { bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' },
  success: { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
}
const ALERTAS_CEL = [
  { type: 'warning' as const, msg: '12 leads sem contato há mais de 5 dias', action: true },
  { type: 'warning' as const, msg: 'Cadastros 54% da meta — intensifique captação', action: true },
  { type: 'info' as const, msg: '3 visitas agendadas para hoje', action: true },
  { type: 'success' as const, msg: 'Score 78 — escola com desempenho acima da média!', action: false },
]
const FUNIL: [string, number, number][] = [['Cadastros', 184, 340], ['Agendamentos', 96, 170], ['Visitas', 71, 120], ['Matrículas', 38, 70]]

export function GestorHomeCelular({ pressAt }: { pressAt?: Record<string, number> }) {
  const sec: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }
  return (
    <div id="shot" style={{ width: 390, background: '#f8f9fb' }}>
      {/* barra do navegador do celular */}
      <div style={{ background: '#fff', padding: '10px 12px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="url" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: '#F1F3F4', borderRadius: 999, padding: '8px 14px', fontSize: 14, color: '#202124' }}>
          <Lock size={12} color="#5F6368" /> aionedu.com.br/home
        </div>
        <RotateCw size={16} color="#5F6368" />
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Olá,</p>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Paula</h1>
          </div>
          <div style={{ textAlign: 'center', background: '#F0FDF4', border: '1px solid #16A34A22', borderRadius: 14, padding: '8px 16px' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#16A34A', margin: 0 }}><span data-count>78</span></p>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#16A34A', margin: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>Score</p>
          </div>
        </div>
        <div><DemoSeal small /></div>
        <div className="alerta-topo" style={{ padding: '12px 16px', borderRadius: 12, background: ALERT_C.warning.bg, border: `1px solid ${ALERT_C.warning.border}` }}>
          <p style={{ fontSize: 13, color: ALERT_C.warning.color, margin: 0, fontWeight: 500 }}>{ALERTAS_CEL[0].msg}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Total Alunos', value: '412', Icon: GraduationCap, color: '#00A896', bg: '#E6F7F5' },
            { label: 'Novatos', value: '58', Icon: TrendingUp, color: '#7C3AED', bg: '#EDE9FE' },
            { label: 'Market Share', value: '12%', Icon: Target, color: '#2563EB', bg: '#DBEAFE' },
            { label: 'Próx. Campanha', value: 'Agora', Icon: Bell, color: '#D97706', bg: '#FEF3C7' },
          ].map(({ label, value, Icon, color, bg }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={18} color={color} /></div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0, lineHeight: 1 }}>{/^\d/.test(value) ? <span data-count>{value}</span> : value}</p>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', fontWeight: 500 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="campanha" style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Campanha ativa</p>
            <span style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', borderRadius: 9999, padding: '2px 8px', fontWeight: 600 }}>Em andamento</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {FUNIL.map(([label, val, target]) => {
              const pct = Math.min(100, Math.round((val / target) * 100))
              return (
                <div key={label} className={`kpi-${label}`} style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: 10 }}>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 4px', fontWeight: 500 }}>{label}</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}><span data-count>{val}</span><span style={{ fontSize: 11, color: '#94A3B8' }}>/{target}</span></p>
                  <div style={{ height: 4, background: '#E2E8F0', borderRadius: 9999 }}>
                    <div data-grow style={{ height: 4, width: `${pct}%`, background: pct >= 80 ? '#00A896' : pct >= 50 ? '#F59E0B' : '#EF4444', borderRadius: 9999 }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ width: '100%', padding: 10, borderRadius: 10, background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>Ver relatório completo</div>
        </div>
        <div className="acesso">
          <p style={sec}>Acesso rápido</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {QUICK.map(({ label, Icon, bg, color }) => (
              <div key={label} className={`qa-${label}`} {...d(pressAt && pressAt[label] != null ? { 'data-press': pressAt[label] } : {})}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, borderRadius: 16, background: '#fff', border: '1px solid #E2E8F0', minHeight: 80 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={color} /></div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#1A2B4A', margin: 0, textAlign: 'center' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="alertas">
          <p style={sec}>Alertas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ALERTAS_CEL.slice(1).map((a, i) => {
              const c = ALERT_C[a.type]
              return (
                <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontSize: 13, color: c.color, margin: 0, fontWeight: 500, flex: 1 }}>{a.msg}</p>
                  {a.action && <ChevronRight size={14} color={c.color} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
