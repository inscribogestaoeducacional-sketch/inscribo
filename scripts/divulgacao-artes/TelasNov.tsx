// =============================================================================
// scripts/divulgacao-artes/TelasNov.tsx
//
// Mais telas do painel da escola (mesmas regras de TelasApp.tsx: espelham o JSX
// e os estilos inline das telas reais, dados fictícios do "Colégio Horizonte",
// marcações data-* para a animação). Gráficos do recharts viraram SVG simples
// com as mesmas cores e séries.
// =============================================================================
import React from 'react'
import {
  Users, MessageCircle, Calendar, ArrowRightLeft, GraduationCap, Target, Bell, ChevronRight, CheckCircle, ArrowUpRight, ArrowDownRight,
  Clock, Sunrise, Sun, Moon, Star, Smile, Meh, Frown, MapPin, X, Trophy, Award, BarChart3, Activity, DollarSign, RefreshCw, Sparkles,
  AlertTriangle, Info, Link2, Settings, Save, ArrowUp, ArrowDown, BookUser, Plus, Upload, Download, GitMerge, Settings2, Search, FileText,
  ClipboardList, TrendingUp, Copy, Eye, Brain, Check, ExternalLink, Pencil, StopCircle, MoreVertical, Loader2,
} from 'lucide-react'
import { DemoSeal, ESCOLA } from './TelasApp'

const d = (o: Record<string, any>) => o as any
const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

// ═════════════════════════════════════════════════════════════════════════════
// Configurações → WhatsApp — src/components/management/SystemSettings.tsx
// (WA_SECTIONS l.370, menu l.813, Horário l.902, Equipe l.1116, Grupos l.1175)
// ═════════════════════════════════════════════════════════════════════════════
const WA_SECTIONS = [['📡', 'Conexão'], ['🕐', 'Horário'], ['⚡', 'Respostas'], ['👥', 'Equipe'], ['🚫', 'Bloqueios'], ['🏷️', 'Etiquetas'], ['⭐', 'Pesquisa']]
const dCard: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20 }
const dInput: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', color: '#1A2B4A', borderRadius: 8, padding: '9px 12px', fontSize: 13 }
const dLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
export function ConfigWhatsApp({ secao, grupoNovoAt, foraHorarioMsg, focus }: { secao: 'Equipe' | 'Horário'; grupoNovoAt?: number; foraHorarioMsg?: { text: string; t0: number; t1: number }; focus?: Record<string, number> }) {
  const f = (k: string) => (focus && focus[k] != null ? { 'data-focus': focus[k] } : {})
  return (
    <div id="shot" style={{ width: 1100, padding: 24, background: '#f8f9fb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Configurações</h1><p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>WhatsApp · {ESCOLA}</p></div>
        <DemoSeal />
      </div>
      <div style={{ display: 'flex', background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden', minHeight: 560 }}>
        <div style={{ width: 200, flexShrink: 0, background: '#F8FAFC', borderRight: '1px solid #E2E8F0', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {WA_SECTIONS.map(([i, l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, background: l === secao ? '#00A896' : 'transparent', color: l === secao ? '#fff' : '#64748B', fontSize: 13, fontWeight: 600 }}>
              <span style={{ fontSize: 14 }}>{i}</span><span style={{ flex: 1 }}>{l}</span>{l === 'Conexão' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />}
            </span>
          ))}
        </div>
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {secao === 'Equipe' ? (
            <>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>👥 Horário por Atendente</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[['Ana Beatriz Lima', true], ['Camila Rocha', true]].map(([n, almoco]) => (
                  <div key={n as string} style={{ ...dCard, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 10 }}>{n}</div>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>{DIAS.map((x, i) => <span key={x} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: `2px solid ${i < 5 ? '#00A896' : '#E2E8F0'}`, background: i < 5 ? '#E6F7F5' : '#fff', color: i < 5 ? '#00A896' : '#94A3B8' }}>{x}</span>)}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}><div><label style={dLabel}>Início</label><div style={dInput}>07:30</div></div><div><label style={dLabel}>Fim</label><div style={dInput}>17:30</div></div></div>
                    <div {...d(f('almoco'))} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
                      <span style={{ width: 36, height: 20, borderRadius: 999, background: almoco ? '#00A896' : '#CBD5E1', position: 'relative', display: 'inline-block' }}><span style={{ position: 'absolute', top: 2, left: almoco ? 18 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%' }} /></span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>Tem horário de almoço? <strong style={{ color: '#1A2B4A' }}>12:00 – 13:00</strong></span>
                    </div>
                  </div>
                ))}
              </div>
              <div {...d(f('grupos'))}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Grupos de Atendimento</h4>
                  <span {...d(grupoNovoAt != null ? { 'data-press': grupoNovoAt - 0.4 } : {})} style={{ fontSize: 12, fontWeight: 600, color: '#00A896', background: '#E6F7F5', border: '1px solid #B2E8E2', borderRadius: 8, padding: '5px 12px' }}>+ Novo grupo</span>
                </div>
                {[['🎓', 'Matrículas', 'Ana Beatriz Lima, Camila Rocha, Bruno Lima', grupoNovoAt], ['💰', 'Financeiro', 'Patrícia Gomes, Bruno Lima', undefined], ['📋', 'Secretaria', 'Camila Rocha, Patrícia Gomes', undefined]].map(([e, n, m, at]) => (
                  <div key={n as string} {...d(at != null ? { 'data-in': at, 'data-focus': (at as number) + 0.6 } : {})} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #D1FAE5', background: '#F0FDFB', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div><div style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{e} {n}</div><div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{(m as string).split(', ').length} membro(s): {m}</div></div>
                    <div style={{ display: 'flex', gap: 6 }}><span style={{ fontSize: 11, color: '#00A896', border: '1px solid #B2E8E2', borderRadius: 6, padding: '3px 8px' }}>Editar</span><span style={{ fontSize: 11, color: '#EF4444', border: '1px solid #FCA5A5', borderRadius: 6, padding: '3px 8px' }}>Excluir</span></div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>🕐 Horário de Atendimento</h3>
              <div {...d(f('dias'))} style={dCard}>
                <label style={dLabel}>Dias da semana</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>{DIAS.map((x, i) => <span key={x} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `2px solid ${i < 5 ? '#00A896' : '#E2E8F0'}`, background: i < 5 ? '#E6F7F5' : '#fff', color: i < 5 ? '#00A896' : '#94A3B8' }}>{x}</span>)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}><div><label style={dLabel}>Início</label><div style={dInput}>07:00</div></div><div><label style={dLabel}>Fim</label><div style={dInput}>18:00</div></div></div>
                <label style={dLabel}>Mensagem fora do horário</label>
                <div {...d(f('msg'))} style={{ ...dInput, minHeight: 74, lineHeight: 1.5 }}>{foraHorarioMsg ? <span {...d({ 'data-type': `${foraHorarioMsg.t0},${foraHorarioMsg.t1}` })}>{foraHorarioMsg.text}</span> : 'Olá! Nosso atendimento é de segunda a sexta, das 7h às 18h. Deixe sua mensagem que retornamos assim que possível.'}</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 600, marginTop: 14 }}><Save size={13} />Salvar horário</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
// ═════════════════════════════════════════════════════════════════════════════
// Início do atendente — src/pages/gestor/AttendantHome.tsx (KPIs l.346,
// desempenho l.361, Meus lembretes l.496); cores de lib/leadReminders.ts
// ═════════════════════════════════════════════════════════════════════════════
const RC = { overdue: { color: '#DC2626', bg: '#FEF2F2' }, today: { color: '#D97706', bg: '#FFFBEB' }, upcoming: { color: '#2563EB', bg: '#EFF6FF' }, stale: { color: '#64748B', bg: '#F1F5F9' } }
function Stat({ label, value, Icon, iconBg, color, sub, variation }: { label: string; value: string; Icon: any; iconBg: string; color: string; sub?: string; variation?: number }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={color} /></div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1A2B4A', lineHeight: 1.1 }}><span data-count>{value}</span></div>
      {variation != null && <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#16a34a' }}><ArrowUpRight size={10} /> {variation}% vs. mês anterior</div>}
      {sub && <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>{sub}</div>}
    </div>
  )
}
export function AtendenteHome({ focus, comTopo, trocaAt }: { focus?: Record<string, number>; comTopo?: boolean; trocaAt?: number }) {
  const f = (k: string) => (focus && focus[k] != null ? { 'data-focus': focus[k] } : {})
  const lemb = [
    ['Helena · Thiago Alves', 'Atrasado desde 09/11', 'overdue'], ['Davi · Beatriz Nunes', 'Atrasado desde 10/11', 'overdue'],
    ['Sofia · Fernanda Lima', 'Follow-up hoje', 'today'], ['Enzo · Rafael Souza', 'Sem contato há 6d', 'stale'], ['Miguel · Renata Dias', 'Follow-up em 14/11', 'upcoming'],
  ] as const
  const Btn = ({ on }: { on: boolean }) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9999, border: `1px solid ${on ? '#A7F3D0' : '#FED7AA'}`, background: on ? '#ECFDF5' : '#FFF7ED' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? '#16A34A' : '#F97316' }} /><span style={{ fontSize: 12, fontWeight: 700, color: on ? '#059669' : '#C2410C' }}>{on ? 'Disponível' : 'Ausente'}</span>
    </span>
  )
  return (
    <div id="shot" style={{ width: 1100, background: '#f8f9fb' }}>
      {comTopo && (
        <div style={{ height: 58, background: '#fff', borderBottom: '1px solid #D1FAE5', display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px' }}>
          <div style={{ width: 300, padding: '8px 12px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 13, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14} />Buscar leads, visitas, matrículas...</div>
          <div style={{ marginLeft: 'auto', position: 'relative' }} {...d(f('disp'))}>
            {trocaAt != null ? (<><div {...d({ 'data-out': trocaAt })}><Btn on={false} /></div><div {...d({ 'data-in': trocaAt })} style={{ position: 'absolute', inset: 0 }}><Btn on /></div></>) : <Btn on />}
          </div>
          <Bell size={18} color="#64748B" />
        </div>
      )}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div><h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Bom dia, Ana</h1><p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{ESCOLA} · quinta-feira, 12 de novembro</p></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><DemoSeal /><span style={{ fontSize: 11, fontWeight: 600, color: '#0F6E56', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '4px 12px' }}>Atendente</span></div>
        </div>
        <div {...d(f('kpis'))} style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <Stat label="Leads hoje" value="6" Icon={Users} iconBg="#f5f3ff" color="#8b5cf6" />
          <Stat label="Visitas agendadas" value="3" Icon={Calendar} iconBg="#f0fdf4" color="#0F6E56" />
          <Stat label="Mensagens (24h)" value="47" Icon={MessageCircle} iconBg="#d1fae5" color="#10B981" />
          <Stat label="Transferências pendentes" value="1" Icon={ArrowRightLeft} iconBg="#fef2f2" color="#dc2626" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div {...d(f('lembretes'))} style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', display: 'flex', alignItems: 'center', gap: 6 }}><Bell size={13} color="#f59e0b" /> Meus lembretes</span>
              <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>Ver leads <ChevronRight size={12} /></span>
            </div>
            {lemb.map(([n, l, u], i) => {
              const c = RC[u]
              return (
                <div key={n} {...d({ 'data-in': 0.3 + i * 0.25, ...(i === 0 && focus?.atrasado != null ? { 'data-focus': focus.atrasado } : {}) })} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={13} color={c.color} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{n}</div><div style={{ fontSize: 10, color: c.color, fontWeight: 600, marginTop: 1 }}>{l}</div></div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: c.color, background: c.bg, borderRadius: 6, padding: '3px 8px' }}>Retomar</span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div {...d(f('visitas'))} style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Minhas visitas de hoje</span></div>
              {[['09:00', 'Alice · Mariana Costa', 'Infantil 5'], ['14:30', 'Sofia · Fernanda Lima', '1º ano'], ['16:00', 'Davi · Beatriz Nunes', '6º ano']].map(([h, n, s]) => (
                <div key={h} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0F6E56', background: '#f0fdf4', borderRadius: 8, padding: '4px 8px' }}>{h}</span>
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{n}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{s}</div></div>
                </div>
              ))}
            </div>
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Meus leads recentes</span></div>
              {[['Juliana Prado', 'Infantil 5', 'Novo'], ['Rafael Souza', '6º ano', 'Em Contato']].map(([n, s, st]) => (
                <div key={n} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e2d6b', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n[0]}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{n}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{s}</div></div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6', background: '#EFF6FF', borderRadius: 999, padding: '2px 8px' }}>{st}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Relatório de Mercado Completo — src/components/gestor/MarketReportModal.tsx
// (dados do Censo Escolar; concorrentes com nomes fictícios)
// ═════════════════════════════════════════════════════════════════════════════
const CONCORRENTES = [
  ['Colégio Monte Verde', 1180, 14.2], ['Escola Nova Aurora', 960, 11.6], ['Instituto Primavera', 840, 10.1], ['Colégio São Lucas', 720, 8.7],
  ['Escola Raízes', 650, 7.8], ['Colégio Horizonte', 612, 7.4, true], ['Centro Educacional Sol', 540, 6.5], ['Escola Arco-Íris', 410, 4.9],
] as const
export function RelatorioMercado({ focus }: { focus?: Record<string, number> }) {
  const f = (k: string) => (focus && focus[k] != null ? { 'data-focus': focus[k] } : {})
  return (
    <div id="shot" style={{ width: 900, background: 'rgba(15,23,42,0.65)', padding: 40 }}>
      <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MapPin size={16} color="#00A896" /><h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Relatório de Mercado Completo</h3></div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><DemoSeal /><X size={18} color="#94a3b8" /></span>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: 16, background: '#FFFBEB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 22, fontWeight: 800, color: '#D97706', lineHeight: 1 }}><span data-count>64</span></span><span style={{ fontSize: 9, color: '#D97706', fontWeight: 700 }}>SCORE</span></div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e2d6b' }}>{ESCOLA}</h2>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Cidade Exemplo/PB · Censo Escolar 2025</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#FFFBEB', color: '#D97706' }}>Em crescimento</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#F0FDF4', color: '#16A34A' }}><ArrowUpRight size={11} />6% vs. Censo 2024</span></div>
            </div>
          </div>
          <div {...d(f('cards'))} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[[Trophy, '#7C3AED', '#F5F3FF', '6º', 'de 23 escolas privadas'], [Users, '#00A896', '#F0FDFA', '7,4%', 'participação de mercado'], [Target, '#D97706', '#FFFBEB', '612', 'alunos matriculados']].map(([I, c, bg, v, l]: any) => (
              <div key={l} style={{ background: bg, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}><I size={18} color={c} style={{ marginBottom: 6 }} /><div style={{ fontSize: 18, fontWeight: 800, color: c }}><span data-count>{v}</span></div><div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{l}</div></div>
            ))}
          </div>
          <div {...d({ 'data-in': 0.8, ...f('faltam') })} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#991B1B' }}>Faltam <strong>38</strong> matrículas pra alcançar o 5º colocado do município.</div>
          <div {...d(f('concorrentes'))}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}><Award size={14} color="#6366f1" /> Principais concorrentes</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CONCORRENTES.map(([n, q, p, sel], i) => (
                <div key={n} {...d({ 'data-in': 0.4 + i * 0.15 })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: sel ? '#F0FDFA' : '#f8fafc', border: sel ? '1px solid #A7F3D0' : '1px solid transparent' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', minWidth: 18 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? '#00523C' : '#374151' }}>{n}{sel ? ' (você)' : ''}</span>
                  <div style={{ width: 80, height: 5, background: '#e5e7eb', borderRadius: 9999 }}><div data-grow style={{ width: `${(p as number) * 6}%`, height: 5, borderRadius: 9999, background: sel ? '#00A896' : '#94a3b8' }} /></div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', minWidth: 80, textAlign: 'right' }}>{(q as number).toLocaleString('pt-BR')} ({String(p).replace('.', ',')}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Início do gestor: Satisfação dos Atendimentos e Horários de maior movimento
// — src/pages/gestor/GestorHome.tsx (l.1900, l.1938)
// ═════════════════════════════════════════════════════════════════════════════
export function SatisfacaoAtendimentos() {
  const circ = 2 * Math.PI * 34
  return (
    <div id="shot" style={{ width: 520, padding: 24, background: '#F9FAFB' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Star size={16} color="#F59E0B" /></div><div><h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Satisfação dos Atendimentos</h3><p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Período selecionado</p></div></div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><DemoSeal small /><span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>Ver pesquisas <ChevronRight size={12} /></span></span>
        </div>
        <div style={{ padding: 20 }}>
          <div {...d({ 'data-focus': 2.4 })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16, gap: 4 }}>
            <div style={{ position: 'relative', width: 80, height: 80 }}>
              <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}><circle cx={40} cy={40} r={34} fill="none" stroke="#f1f5f9" strokeWidth={7} /><circle cx={40} cy={40} r={34} fill="none" stroke="#16A34A" strokeWidth={7} strokeDasharray={`${0.91 * circ} ${circ}`} strokeLinecap="round" /></svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 15, fontWeight: 800, color: '#16A34A' }}><span data-count>91</span>%</span></div>
            </div>
            <div style={{ color: '#6B7280', fontSize: 12 }}>214 avaliações</div>
          </div>
          {[[Smile, 'Ótimo', '#10B981', 84], [Meh, 'Regular', '#F59E0B', 12], [Frown, 'Ruim', '#EF4444', 4]].map(([I, l, c, p]: any) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, minWidth: 68, color: c, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><I size={16} />{l}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden' }}><div data-grow style={{ width: `${p}%`, height: '100%', background: c, borderRadius: 4 }} /></div>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 600, minWidth: 35 }}><span data-count>{p}</span>%</span>
            </div>
          ))}
          <div style={{ width: '100%', padding: '9px 0', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>Ver mais <ChevronRight size={13} /></div>
        </div>
      </div>
    </div>
  )
}
const HEAT = [[12, 34, 41, 38, 36, 29, 5], [28, 52, 61, 58, 55, 40, 3], [18, 46, 53, 49, 44, 22, 8]]
export function HorariosMovimento() {
  const max = 61
  const col = (v: number) => { const i = v / max; return i > 0.7 ? { bg: '#00A896', color: '#fff' } : i > 0.4 ? { bg: '#7dd3ca', color: '#fff' } : i > 0.1 ? { bg: '#ccf2ee', color: '#0F6E56' } : { bg: '#F8FAFC', color: '#94a3b8' } }
  return (
    <div id="shot" style={{ width: 760, padding: 24, background: '#F9FAFB' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 16px' }}><h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0, display: 'flex', alignItems: 'center' }}><Clock size={16} color="#00A896" style={{ marginRight: 6 }} />Horários de maior movimento</h3><DemoSeal small /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(7,1fr)', gap: 4 }}>
          <div />
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(x => <div key={x} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 0' }}>{x}</div>)}
          {(['Manhã', 'Tarde', 'Noite'] as const).map((p, r) => (
            <React.Fragment key={p}>
              <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>{r === 0 ? <Sunrise size={14} /> : r === 1 ? <Sun size={14} /> : <Moon size={14} />} {p}</div>
              {[6, 0, 1, 2, 3, 4, 5].map((di, k) => { const v = HEAT[r][di]; const c = col(v); return <div key={k} {...d({ 'data-in': 0.2 + (r * 7 + k) * 0.08, ...(v === max ? { 'data-focus': 2.6 } : {}) })} style={{ background: c.bg, borderRadius: 6, padding: '12px 4px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: c.color }}>{v > 0 ? v : ''}</div> })}
            </React.Fragment>
          ))}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#94a3b8' }}>Baseado nas conversas do período selecionado</p>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Relatórios da Campanha — src/components/reports/GestorReports.tsx
// (cabeçalho l.1940, abas l.1725/2033, Visão Geral l.189, Funil l.420,
// Marketing & CPA l.588, Rematrículas l.816, Transferências l.1019,
// Diagnóstico IA l.1240)
// ═════════════════════════════════════════════════════════════════════════════
const TABS = [[BarChart3, 'Visão Geral'], [Activity, 'Funil'], [DollarSign, 'Marketing & CPA'], [RefreshCw, 'Rematrículas'], [ArrowUpRight, 'Transferências'], [Sparkles, 'Diagnóstico IA']] as const
const desvioColor = (v: number) => (v >= 0 ? '#16a34a' : v >= -15 ? '#D97706' : '#DC2626')
function Kpi({ label, value, sub, Icon, color, desvio }: { label: string; value: string; sub?: string; Icon: any; color: string; desvio?: number }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span><div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} color={color} /></div></div>
      <span style={{ fontSize: 26, fontWeight: 800, color: '#1A2B4A', lineHeight: 1 }}><span data-count>{value}</span></span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {desvio != null && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: desvio >= 0 ? '#F0FDF4' : desvio >= -15 ? '#FFFBEB' : '#FEF2F2', color: desvioColor(desvio), display: 'flex', alignItems: 'center', gap: 3 }}>{desvio >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{Math.abs(desvio).toFixed(1).replace('.', ',')}% vs meta</span>}
        {sub && <span style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</span>}
      </div>
    </div>
  )
}
const STitle = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <div style={{ marginBottom: 20 }}><h2 style={{ fontSize: 17, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{children}</h2>{sub && <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0' }}>{sub}</p>}</div>
)
// Gráfico de barras + linha (substitui o ComposedChart do recharts)
function Barras({ labels, series, linhas, h = 200 }: { labels: string[]; series: { color: string; vals: number[] }[]; linhas?: { color: string; vals: number[] }[]; h?: number }) {
  const W = 760, top = 10, bottom = 24, left = 30
  const all = [...series.flatMap(s => s.vals), ...(linhas || []).flatMap(l => l.vals)]
  const max = Math.ceil(Math.max(...all) / 10) * 10 || 10
  const bw = (W - left) / labels.length
  const y = (v: number) => top + (h - top - bottom) * (1 - v / max)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(k => <line key={k} x1={left} x2={W} y1={y(max * k)} y2={y(max * k)} stroke="#F1F5F9" strokeDasharray="3 3" />)}
      {labels.map((l, i) => {
        const x0 = left + i * bw + bw * 0.2, w = (bw * 0.6) / series.length
        return (
          <g key={l}>
            {series.map((s, k) => <rect key={k} data-grow-y x={x0 + k * w} y={y(s.vals[i])} width={w - 3} height={y(0) - y(s.vals[i])} rx={3} fill={s.color} />)}
            <text x={left + i * bw + bw / 2} y={h - 6} fontSize={11} fill="#94A3B8" textAnchor="middle">{l}</text>
          </g>
        )
      })}
      {(linhas || []).map((ln, k) => <polyline key={k} points={ln.vals.map((v, i) => `${left + i * bw + bw / 2},${y(v)}`).join(' ')} fill="none" stroke={ln.color} strokeWidth={2} strokeDasharray="5 3" />)}
    </svg>
  )
}
export type AbaRel = 'Visão Geral' | 'Funil' | 'Marketing & CPA' | 'Rematrículas' | 'Transferências' | 'Diagnóstico IA'
export function Relatorios({ aba, focus, gerarAt, fim = '28/02/2027', dias = 108, semanas = 16, faltam = 23, vel = 2, mes = 'Dezembro/2026', gerado = '16/12/2026', hist = ['Novembro/2026', 'Outubro/2026'], largura = 1180 }: { largura?: number; mes?: string; gerado?: string; hist?: string[]; aba: AbaRel; focus?: Record<string, number>; gerarAt?: number; fim?: string; dias?: number; semanas?: number; faltam?: number; vel?: number }) {
  const f = (k: string) => (focus && focus[k] != null ? { 'data-focus': focus[k] } : {})
  const meses = ['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev']
  return (
    <div id="shot" style={{ width: largura, padding: 24, background: '#f8f9fb', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 style={{ width: 18, height: 18, color: '#3B82F6' }} /></div>
          <div><h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Relatórios da Campanha</h1><p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>Campanha 2027 · 01/09/2026 até {fim}</p></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <DemoSeal />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, color: '#475569', fontWeight: 600 }}><Link2 size={13} /> Vincular leads a esta campanha</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, color: '#475569', fontWeight: 600 }}><Settings size={13} /> Ajustar campanha</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, background: '#F8FAFC', borderRadius: 14, padding: 4, border: '1px solid #E2E8F0' }}>
        {TABS.map(([I, l]) => <span key={l} style={{ flex: largura < 1000 ? '1 1 30%' : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: aba === l ? '#fff' : 'transparent', color: aba === l ? '#00A896' : '#64748B', boxShadow: aba === l ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', whiteSpace: 'nowrap' }}><I size={15} /> {l}</span>)}
      </div>

      {aba === 'Visão Geral' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
            <div {...d(f('saude'))} style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 12 }}>
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}><circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="10" /><circle cx="50" cy="50" r="42" fill="none" stroke="#f59e0b" strokeWidth="10" strokeDasharray={`${2 * Math.PI * 42 * 0.68} ${2 * Math.PI * 42 * 0.32}`} strokeLinecap="round" /></svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}><span data-count>68</span></span><span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>SCORE</span></div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>Atenção necessária</span>
              <span {...d(f('dias'))} style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}><span data-count>{dias}</span> dias restantes</span>
            </div>
            <div {...d(f('kpis'))} style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
              <Kpi label="Cadastros" value="186" sub="meta: 214" Icon={Users} color="#3B82F6" desvio={-13.1} />
              <Kpi label="Visitas" value="71" sub="meta: 90" Icon={Activity} color="#8B5CF6" desvio={-21.1} />
              <Kpi label="Matrículas Novas" value="27" sub="meta: 30" Icon={Target} color="#00A896" desvio={-10} />
              <Kpi label="Rematrículas" value="118" sub="meta: 144" Icon={RefreshCw} color="#F59E0B" desvio={-18.1} />
            </div>
          </div>
          <div {...d(f('velocidade'))} style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={16} color="#16A34A" /></div>
            <div><p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Velocidade necessária: <span style={{ color: '#16A34A' }}><span data-count>{vel}</span> matrículas/semana</span></p><p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>Faltam {faltam} matrículas em {semanas} semanas · {dias} dias até o fim da campanha</p></div>
          </div>
          <div style={card}>
            <STitle sub="Cadastros e matrículas reais vs meta mês a mês">Evolução da Campanha</STitle>
            <Barras labels={meses.slice(0, 3)} series={[{ color: '#93C5FD', vals: [44, 66, 76] }, { color: '#00A896', vals: [7, 9, 11] }]} linhas={[{ color: '#3B82F6', vals: [40, 62, 70] }, { color: '#047857', vals: [6, 11, 13] }]} h={180} />
          </div>
        </div>
      )}

      {aba === 'Funil' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <STitle sub="Cascata de conversão completa do ciclo">Funil de Vendas</STitle>
          <div {...d(f('etapas'))} style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: -16 }}>
            {[['Cadastros', 186, 214, '#3B82F6', '#EFF6FF', '→ 64% agendaram'], ['Agendamentos', 119, 162, '#8B5CF6', '#F5F3FF', '→ 60% visitaram'], ['Visitas', 71, 90, '#F59E0B', '#FFFBEB', '→ 38% matricularam'], ['Matrículas', 27, 30, '#00A896', '#E6F7F5', '']].map(([l, r, m, c, bg, t], i) => {
              const desv = ((r as number) - (m as number)) / (m as number) * 100
              return (
                <div key={l as string} {...d({ 'data-in': 0.2 + i * 0.3, ...(l === 'Agendamentos' && focus?.baixa != null ? { 'data-focus': focus.baixa } : {}) })} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 16, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: '#F1F5F9' }}><div data-grow style={{ height: '100%', width: `${Math.min(100, (r as number) / (m as number) * 100)}%`, background: c as string }} /></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><div style={{ width: 28, height: 28, borderRadius: 8, background: bg as string, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 13, fontWeight: 800, color: c as string }}>{i + 1}</span></div><span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>{l}</span></div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: c as string, lineHeight: 1, marginBottom: 6 }}><span data-count>{r}</span></div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>meta: {m}</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: desv >= -15 ? '#FFFBEB' : '#FEF2F2', color: desvioColor(desv) }}><ArrowDown size={9} />{desv.toFixed(1).replace('.', ',')}%</span>
                  {t && <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9', fontSize: 11, color: '#94A3B8' }}>{t}</div>}
                </div>
              )
            })}
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, display: 'flex', gap: 48, alignItems: 'center', justifyContent: 'center' }}>
            {[['Cadastro → Agenda', 64.0, 76], ['Agenda → Visita', 59.7, 63], ['Visita → Matrícula', 38.0, 40]].map(([l, v, i]) => (
              <div key={l as string} style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: (v as number) >= (i as number) ? '#16a34a' : (v as number) >= (i as number) * 0.7 ? '#F59E0B' : '#DC2626' }}><span data-count>{String(v).replace('.', ',')}</span>%</div><div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{l}</div><div style={{ fontSize: 10, color: '#94A3B8' }}>ideal: {i}%</div></div>
            ))}
          </div>
          <div style={card}><STitle sub="Todas as etapas do funil mês a mês">Detalhe Mensal</STitle><Barras labels={meses.slice(0, 3)} series={[{ color: '#93C5FD', vals: [44, 66, 76] }, { color: '#C4B5FD', vals: [29, 42, 48] }, { color: '#FCD34D', vals: [17, 25, 29] }, { color: '#00A896', vals: [7, 9, 11] }]} h={170} /></div>
        </div>
      )}

      {aba === 'Marketing & CPA' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <STitle sub="Insira o investimento mensal — leads sincronizados automaticamente do funil">Marketing & CPA</STitle>
          <div {...d(f('kpis'))} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: -14 }}>
            <Kpi label="Investimento Total" value="R$ 16.800" Icon={DollarSign} color="#8B5CF6" />
            <Kpi label="CPA Geral" value="R$ 90" sub="projetado: R$ 72" Icon={Target} color="#DC2626" desvio={25} />
            <Kpi label="Total de Leads" value="186" sub="sincronizado do funil" Icon={Users} color="#3B82F6" />
          </div>
          <div {...d({ 'data-in': 0.9, ...f('alerta') })} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={16} color="#DC2626" /><p style={{ fontSize: 13, color: '#1A2B4A', margin: 0, fontWeight: 600 }}>CPA 25,0% acima do projetado — campanha gerando leads acima do custo esperado</p><span style={{ marginLeft: 'auto', fontSize: 11, color: '#DC2626', fontWeight: 600 }}>Avaliar canais e investimento</span>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Inserir Investimento Mensal</span><span style={{ fontSize: 11, color: '#3B82F6', background: '#EFF6FF', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>Leads sincronizados do funil</span></div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, background: '#00A896', color: '#fff', fontSize: 12, fontWeight: 600 }}><Save size={12} />Salvar tudo</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#F8FAFC' }}>{['Mês', '% Leads', 'Leads (funil)', 'Investimento (R$)', 'CPA Real', 'CPA Meta', 'Status'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>)}</tr></thead>
              <tbody>
                {[['Setembro', '23,7%', 44, '3.600', 82, 72, false], ['Outubro', '35,5%', 66, '6.200', 94, 72, true], ['Novembro', '40,9%', 76, '7.000', 92, 72, true]].map(([m, p, l, inv, c, cm, over]) => (
                  <tr key={m as string} style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#1A2B4A' }}>{m}</td><td style={{ textAlign: 'center', color: '#64748B' }}>{p}</td><td style={{ textAlign: 'center', fontWeight: 600 }}>{l}</td>
                    <td style={{ textAlign: 'center' }}><span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 6, border: '1px solid #DDD6FE', minWidth: 80 }}>{inv}</span></td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: over ? '#DC2626' : '#16a34a' }}>R$ {c}</td><td style={{ textAlign: 'center', color: '#64748B' }}>R$ {cm}</td>
                    <td style={{ textAlign: 'center' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: over ? '#FEF2F2' : '#F0FDF4', color: over ? '#DC2626' : '#16a34a' }}>{over ? 'Acima' : 'OK'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'Rematrículas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <STitle sub="Insira as rematrículas confirmadas mês a mês">Rematrículas</STitle>
          <div {...d(f('kpis'))} style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: -14 }}>
            <Kpi label="Rematriculados" value="412" sub="meta total: 451" Icon={RefreshCw} color="#F59E0B" desvio={-8.6} />
            <Kpi label="Base Elegível" value="548" sub="total - formandos" Icon={Users} color="#64748B" />
            <Kpi label="Taxa Fidelização" value="75,2%" sub="meta: 82,3%" Icon={Target} color="#DC2626" desvio={-7.1} />
            <Kpi label="A Rematricular" value="136" sub="ainda elegíveis" Icon={Clock} color="#8B5CF6" />
          </div>
          <div style={card}><STitle sub="% de rematrícula acumulada vs meta mês a mês">Evolução de Rematrículas</STitle><Barras labels={meses.slice(0, 4)} series={[{ color: '#FCD34D', vals: [22, 41, 58, 75] }]} linhas={[{ color: '#DC2626', vals: [26, 46, 66, 82] }]} h={180} /></div>
        </div>
      )}

      {aba === 'Transferências' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <STitle sub="Transferências e motivos de perda de leads">Transferências & Desistências</STitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: -14 }}>
            <Kpi label="Transferências" value="9" sub="saídas confirmadas" Icon={ArrowUpRight} color="#6B7280" />
            <Kpi label="Leads Perdidos" value="58" sub="com motivo registrado" Icon={X} color="#DC2626" />
            <Kpi label="Fator Interno" value="25" sub="43% das recusas" Icon={AlertTriangle} color="#F59E0B" />
            <Kpi label="Fator Externo" value="33" sub="57% das recusas" Icon={Info} color="#3B82F6" />
          </div>
          <div {...d(f('pareto'))} style={card}>
            <STitle sub="Motivos de perda por frequência">Recusas (Pareto)</STitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: -8 }}>
              {[['Outra escola', 14, 'Externo'], ['Valor alto', 12, 'Interno'], ['Não retornou', 9, 'Externo'], ['Sem vaga', 7, 'Interno'], ['Dificuldade financeira', 6, 'Externo'], ['Mudou de cidade', 4, 'Externo'], ['Série não ofertada', 3, 'Interno'], ['Não gostou', 3, 'Interno']].map(([n, c, fa], i) => (
                <div key={n as string} {...d({ 'data-in': 0.2 + i * 0.15, ...(fa === 'Interno' && focus?.internos != null ? { 'data-focus': focus.internos + i * 0.02 } : {}) })} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 150, fontSize: 12, color: '#475569', flexShrink: 0 }}>{n}</span>
                  <div style={{ flex: 1, height: 20, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}><div data-grow style={{ height: '100%', borderRadius: 4, width: `${(c as number) / 14 * 100}%`, background: fa === 'Interno' ? '#F59E0B' : '#3B82F6' }} /></div>
                  <span style={{ width: 30, fontSize: 12, fontWeight: 700, color: '#1A2B4A', textAlign: 'right' }}><span data-count>{c}</span></span>
                  <span style={{ width: 44, fontSize: 10, color: '#94A3B8', textAlign: 'right' }}>{((c as number) / 58 * 100).toFixed(1).replace('.', ',')}%</span>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: fa === 'Interno' ? '#FFFBEB' : '#EFF6FF', color: fa === 'Interno' ? '#92400E' : '#1D4ED8', minWidth: 52, textAlign: 'center' }}>{fa}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748B' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#F59E0B' }} />Fator Interno (escola pode melhorar)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748B' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#3B82F6' }} />Fator Externo</span>
            </div>
          </div>
        </div>
      )}

      {aba === 'Diagnóstico IA' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <STitle sub="Análise mensal gerada por IA com ações recomendadas">Diagnóstico IA</STitle>
            {gerarAt != null ? (
              <span style={{ position: 'relative' }} {...d({ 'data-focus': gerarAt - 1.2 })}>
                <span {...d({ 'data-out': gerarAt, 'data-press': gerarAt - 0.2 })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #00A896, #1A2B4A)', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(0,168,150,0.3)' }}><Sparkles size={14} />Gerar diagnóstico do mês</span>
                <span {...d({ 'data-in': gerarAt })} style={{ position: 'absolute', right: 0, top: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: '#F1F5F9', color: '#94A3B8', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}><Sparkles size={14} />Diagnóstico gerado em {gerado.slice(0, 5)}</span>
              </span>
            ) : <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: '#F1F5F9', color: '#94A3B8', fontSize: 13, fontWeight: 700 }}><Sparkles size={14} />Diagnóstico gerado em {gerado.slice(0, 5)}</span>}
          </div>
          <div {...d(f('tempo'))} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, marginTop: -12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={20} color="#1D4ED8" /></div>
            <div><p style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF', margin: 0 }}>Tempo médio de matrícula: <span style={{ fontSize: 20, fontWeight: 900 }}><span data-count>19</span> dias</span></p><p style={{ fontSize: 12, color: '#3B82F6', margin: '2px 0 0' }}>Média entre o cadastro do lead e a confirmação da matrícula. ⚠ Moderado — há espaço para acelerar o fechamento.</p></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Histórico</span>
              {[[mes, 'Este mês', true], [hist[0], 'Anterior', false], [hist[1], 'Anterior', false]].map(([p, t, sel], i) => (
                <div key={p as string} {...d(i === 0 && gerarAt != null ? { 'data-in': gerarAt + 0.2 } : {})} style={{ padding: '12px 14px', borderRadius: 12, border: sel ? '2px solid #00A896' : '1px solid #E2E8F0', background: sel ? '#E6F7F5' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 13, fontWeight: 700, color: sel ? '#00A896' : '#1A2B4A' }}>{p}</span><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: sel ? '#D1FAE5' : '#F1F5F9', color: sel ? '#16A34A' : '#94A3B8' }}>{t}</span></div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{sel ? gerado : i === 1 ? '16/' + (hist[0] === 'Novembro/2026' ? '11/2026' : '12/2026') : '15/' + (hist[1] === 'Outubro/2026' ? '10/2026' : '11/2026')}</div>
                </div>
              ))}
            </div>
            <div {...d({ ...(gerarAt != null ? { 'data-in': gerarAt + 0.3 } : {}), ...f('conteudo') })} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'linear-gradient(135deg, #1A2B4A, #2D4A7A)', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={22} color="#fff" /></div>
                <div><p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>Diagnóstico IA — {mes}</p><p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Gerado em {gerado}, 09:12:40</p></div>
                <span style={{ marginLeft: 'auto', padding: '8px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>📄 Baixar PDF</span>
              </div>
              <div style={{ ...card, padding: 22, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                <p {...d({ 'data-type': `${(gerarAt ?? 0) + 0.4},${(gerarAt ?? 0) + 2.6}` })} style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{`RESUMO EXECUTIVO\nA campanha chega a ${mes.split('/')[0].toLowerCase()} com 87% da meta de matrículas novas. O ponto de atenção é a etapa de agendamento, 26% abaixo da meta.\n\nFUNIL\nCadastros dentro do esperado; agendamentos e visitas abaixo. Famílias sem contato há mais de 5 dias somam 12.\n\nREMATRÍCULAS\nTaxa de fidelização de 75,2%, contra meta de 82,3%. Faltam 136 famílias elegíveis.\n\nAÇÕES DE MARKETING\nConcentrar a verba nos anúncios que mais trouxeram matrículas e reforçar o convite para visitas.\n\nAÇÕES DO TIME\nRetomar os 12 contatos parados e oferecer horário de visita já na primeira conversa.`}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Contatos — src/components/contacts/ContactsModule.tsx (cabeçalho l.1325,
// indicadores l.1367, filtros l.1385)
// ═════════════════════════════════════════════════════════════════════════════
const CONTATOS = [
  ['Mariana Costa', '(83) 90000-1101', 'Lead', 'Infantil 5', ['Open School'], 'hoje'], ['Fernanda Lima', '(83) 90000-1104', 'Cliente', '1º ano', ['Integral'], 'ontem'],
  ['Rafael Souza', '(83) 90000-1102', 'Lead', '6º ano', ['Bolsa 2027'], 'ontem'], ['Beatriz Nunes', '(83) 90000-1105', 'Cliente', '6º ano', ['Rematrícula'], '10/11'],
  ['Thiago Alves', '(83) 90000-2301', 'Lead', 'Infantil 4', ['Visitou a escola'], '09/11'], ['Renata Dias', '(83) 90000-2302', 'Cliente', '3º ano', ['Integral', 'Rematrícula'], '08/11'],
] as const
const TIPO = { Lead: { bg: '#EFF6FF', color: '#1D4ED8' }, Cliente: { bg: '#F0FDF4', color: '#16A34A' } }
export function Contatos({ focus, filtro }: { focus?: Record<string, number>; filtro?: string }) {
  const f = (k: string) => (focus && focus[k] != null ? { 'data-focus': focus[k] } : {})
  const sel: React.CSSProperties = { border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, background: '#fff', padding: '9px 12px', color: '#1A2B4A', width: 150, display: 'flex', justifyContent: 'space-between' }
  return (
    <div id="shot" style={{ width: 1180, padding: 24, background: '#f8f9fb', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookUser size={18} color="#3B82F6" /></div>
          <div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Contatos</h1><span style={{ padding: '2px 9px', background: '#EFF6FF', color: '#3B82F6', fontSize: 11, fontWeight: 700, borderRadius: 999 }}>1.248</span></div><p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Leads e WhatsApp unificados</p></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DemoSeal />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#00A896', color: '#fff', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}><Plus size={14} /> Novo Contato</span>
          {[[Upload, 'Importar planilha', 'import'], [Download, 'Exportar (1.248)', ''], [GitMerge, 'Duplicados', 'dup'], [Settings2, 'Campos Personalizados', 'campos']].map(([I, l, k]: any) => <span key={l} {...d(k ? f(k) : {})} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', padding: '9px 14px', borderRadius: 10, fontSize: 13 }}><I size={14} /> {l}</span>)}
        </div>
      </div>
      <div {...d(f('kpis'))} style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[['1.248', 'Total'], ['386', 'Leads'], ['702', 'Clientes'], ['160', 'WhatsApp']].map(([v, l]) => <div key={l} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px 18px' }}><p style={{ fontSize: 28, fontWeight: 700, color: '#1e2d6b', margin: '0 0 4px' }}><span data-count>{v}</span></p><p style={{ fontSize: 11, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{l}</p></div>)}
      </div>
      <div {...d(f('filtros'))} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 260 }}><Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} /><div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, background: '#fff', padding: '9px 12px 9px 36px', color: '#94A3B8' }}>Buscar por nome, telefone ou turma...</div></div>
        {['Todos os tipos', 'Todos os status', 'Todas as séries', filtro || 'Todas as etiquetas', 'Todas as campanhas'].map((l, i) => <span key={i} style={{ ...sel, ...(i === 3 && filtro ? { borderColor: '#00A896', background: '#F0FDFA' } : {}) }}>{l}<ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /></span>)}
      </div>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#F8FAFC' }}>{['', 'Contato', 'Telefone', 'Tipo', 'Série', 'Último contato', 'Ações'].map((h, i) => <th key={i} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B', fontSize: 12, borderBottom: '1px solid #E2E8F0' }}>{h}</th>)}</tr></thead>
          <tbody>
            {CONTATOS.map(([n, ph, t, s, tags, u], i) => (
              <tr key={n} {...d({ 'data-in': 0.2 + i * 0.15 })} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '10px 14px', width: 30 }}><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, border: '1.5px solid #CBD5E1' }} /></td>
                <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e2d6b', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n[0]}</div><div><div style={{ fontWeight: 600, color: '#1A2B4A' }}>{n}</div><div style={{ display: 'flex', gap: 4, marginTop: 3 }}>{tags.map(tg => <span key={tg} style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: '#EEF2FF', color: '#4338CA' }}>{tg}</span>)}</div></div></div></td>
                <td style={{ padding: '10px 14px', color: '#64748B' }}>{ph}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: TIPO[t].bg, color: TIPO[t].color }}>{t}</span></td>
                <td style={{ padding: '10px 14px', color: '#475569' }}>{s}</td>
                <td style={{ padding: '10px 14px', color: '#94A3B8' }}>{u}</td>
                <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', gap: 6 }}><span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: '#F1F5F9', color: '#475569' }}>Ver perfil</span><span style={{ padding: '4px 8px', borderRadius: 8, background: '#DCFCE7', color: '#15803D', display: 'flex' }}><MessageCircle size={13} /></span></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Importar contatos — src/components/contacts/ContactImportDialog.tsx
export function ImportarPlanilha() {
  const C = { navy: '#1e2d6b', muted: '#64748b', light: '#94a3b8', line: '#e2e8f0', teal: '#00A896' }
  const secT: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }
  const Stat2 = ({ label, value, color, hint, focus }: { label: string; value: string; color: string; hint?: string; focus?: number }) => (
    <div {...d(focus != null ? { 'data-focus': focus } : {})} style={{ border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '12px 14px' }}><div style={{ fontSize: 24, fontWeight: 800, color }}><span data-count>{value}</span></div><div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{label}</div>{hint && <div style={{ fontSize: 11, color: C.light }}>{hint}</div>}</div>
  )
  return (
    <div id="shot" style={{ width: 900, background: 'rgba(0,0,0,0.5)', padding: 40 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.navy }}>Importar contatos</h2><span style={{ display: 'flex', gap: 12, alignItems: 'center' }}><DemoSeal /><X size={20} color={C.light} /></span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1.5px solid ${C.line}`, borderRadius: 12 }}><FileText size={20} color="#3B82F6" /><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>contatos-escola.xlsx</div><div style={{ fontSize: 12, color: C.muted }}>3.412 linhas · 6 colunas</div></div><span style={{ fontSize: 12, color: C.teal, fontWeight: 600 }}>Trocar arquivo</span></div>
        <div {...d({ 'data-in': 0.3 })}>
          <div style={secT}>Colunas da planilha</div>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
            {[['Responsável', 'Fernanda Lima', 'Nome'], ['Celular', '(83) 90000-1104', 'Telefone'], ['E-mail', 'fernanda@exemplo.com', 'E-mail'], ['Aluno', 'Sofia', 'Aluno'], ['Turma', '1º ano', 'Turma / série'], ['Grupo', 'Integral', 'Etiquetas']].map(([h, ex, campo], i) => (
              <div key={h} {...d({ 'data-in': 0.4 + i * 0.15 })} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', gap: 10, alignItems: 'center', padding: '7px 12px', borderTop: i ? `1px solid ${C.line}` : 'none', fontSize: 13 }}>
                <strong style={{ color: C.navy }}>{h}</strong><span style={{ color: C.light }}>{ex}</span>
                <span style={{ padding: '6px 8px', borderRadius: 8, border: `1.5px solid ${C.teal}`, fontSize: 12, color: C.navy, display: 'flex', justifyContent: 'space-between' }}>{campo}<Check size={12} color={C.teal} /></span>
              </div>
            ))}
          </div>
        </div>
        <div {...d({ 'data-in': 1.6 })} style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          <Stat2 label="Novos" value="2.106" color="#059669" focus={2.6} />
          <Stat2 label="Já existem" value="1.187" color="#2563EB" focus={2.8} />
          <Stat2 label="Inválidos" value="31" color="#DC2626" />
          <Stat2 label="Linhas repetidas" value="88" color={C.muted} hint="mesmo número — juntadas" />
        </div>
        <p {...d({ 'data-in': 1.9 })} style={{ margin: 0, fontSize: 12, color: C.muted }}>Números repetidos na planilha viram um contato só: aluno e turma são juntados (ex.: "Ana / Pedro") e as etiquetas somadas.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: C.teal, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>Revisar e importar</span></div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Pesquisas — src/pages/gestor/GestorSurveys.tsx (lista l.1765, Visão Geral
// l.1395, relatório IA l.655)
// ═════════════════════════════════════════════════════════════════════════════
export function PesquisasLista({ menuAt }: { menuAt?: number }) {
  return (
    <div id="shot" style={{ width: 1100, padding: 24, background: '#f8f9fb', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Pesquisas de Satisfação</h1><p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>Entenda o que as famílias pensam e antecipe rematrículas</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><DemoSeal /><span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 600 }}><Plus size={15} /> Nova pesquisa</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[[ClipboardList, 'Total de pesquisas', '3', '#F97316', '#FFF7ED'], [TrendingUp, 'Pesquisas ativas', '1', '#10B981', '#F0FDF4'], [Users, 'Total de respostas', '212', '#3B82F6', '#EFF6FF'], [BarChart3, 'Média por pesquisa', '71', '#8B5CF6', '#EDE9FE']].map(([I, l, v, c, bg]: any) => (
          <div key={l} style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I size={18} color={c} /></div><div><div style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A' }}><span data-count>{v}</span></div><div style={{ fontSize: 12, color: '#64748B' }}>{l}</div></div></div>
        ))}
      </div>
      <div style={{ ...card, padding: 0, overflow: 'visible' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#F8FAFC' }}>{['Título', 'Status', 'Respostas', 'Criada em', 'Ações'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>)}</tr></thead>
          <tbody>
            {[['Pesquisa de Satisfação 2026', 'Satisfação geral das famílias — 2º semestre', 'Ativa', '#D1FAE5', '#065F46', '48', '01/10/2026'], ['Avaliação do Open School', 'Famílias que visitaram em setembro', 'Encerrada', '#DBEAFE', '#1E40AF', '96', '02/09/2026'], ['Satisfação 1º semestre', '', 'Encerrada', '#DBEAFE', '#1E40AF', '68', '05/06/2026']].map(([t, ds, s, bg, c, r, dt], i) => (
              <tr key={t} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '14px 16px' }}><p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{t}</p>{ds && <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{ds}</p>}</td>
                <td style={{ padding: '14px 16px' }}><span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: bg, color: c }}>{s}</span></td>
                <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1A2B4A' }}>{r}</td>
                <td style={{ padding: '14px 16px', color: '#94A3B8' }}>{dt}</td>
                <td style={{ padding: '14px 16px', position: 'relative' }}>
                  <span style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 10px', display: 'inline-flex', color: '#64748B' }}><MoreVertical size={15} /></span>
                  {i === 0 && menuAt != null && (
                    <div {...d({ 'data-in': menuAt })} style={{ position: 'absolute', right: 16, top: 50, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 200, overflow: 'hidden' }}>
                      {[[ExternalLink, 'Visualizar pesquisa'], [Copy, 'Copiar link'], [Eye, 'Ver respostas'], [Brain, 'Gerar relatório IA'], [StopCircle, 'Encerrar pesquisa']].map(([I, l]: any) => <div key={l} {...d(l === 'Copiar link' ? { 'data-focus': menuAt + 0.6, 'data-press': menuAt + 1.6 } : {})} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}><I size={13} /> {l}</div>)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {menuAt != null && <div {...d({ 'data-in': menuAt + 1.8 })} style={{ position: 'absolute', right: 24, bottom: 24, background: '#1e2d6b', color: '#fff', fontSize: 13, fontWeight: 500, padding: '12px 18px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,.2)' }}><Check size={14} /> Link copiado para a área de transferência.</div>}
    </div>
  )
}
export function PesquisaPainel({ aba }: { aba: 'Visão Geral' | 'Relatório IA' }) {
  const cardC: React.CSSProperties = { ...card, padding: 14 }
  return (
    <div id="shot" style={{ width: 1100, padding: 24, background: '#f8f9fb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <span style={{ padding: '8px 14px', borderRadius: 10, background: '#F1F5F9', color: '#374151', fontSize: 13, fontWeight: 600 }}>← Voltar</span>
        <div style={{ flex: 1 }}><h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Pesquisa de Satisfação 2026</h1><p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>48 respostas no período selecionado</p></div>
        <DemoSeal />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E2E8F0' }}>
        {['Visão Geral', 'Respostas', 'Relatório IA'].map(t => <span key={t} style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700, color: t === aba ? '#00A896' : '#94A3B8', borderBottom: t === aba ? '2px solid #00A896' : '2px solid transparent', marginBottom: -1 }}>{t}</span>)}
      </div>
      {aba === 'Visão Geral' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div data-focus="2.4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            <div style={cardC}><p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px' }}>Respostas</p><p style={{ fontSize: 28, fontWeight: 900, color: '#1A2B4A', margin: 0 }}><span data-count>48</span></p></div>
            <div style={cardC}><p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px' }}>Nota geral</p><p style={{ fontSize: 28, fontWeight: 900, color: '#10B981', margin: 0 }}><span data-count>8,4</span> <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>/ 10</span></p></div>
            <div style={cardC}><p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px' }}>Rematrícula</p><p style={{ fontSize: 28, fontWeight: 900, color: '#10B981', margin: 0 }}><span data-count>65</span>%</p><p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 0' }}>12% não · 23% talvez</p></div>
            <div style={cardC}><p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px' }}>NPS</p><p style={{ fontSize: 28, fontWeight: 900, color: '#10B981', margin: 0 }}>+<span data-count>42</span></p></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
            <div style={{ ...cardC, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}><p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: 0 }}>Nota geral</p><div style={{ fontSize: 56, fontWeight: 900, color: '#10B981', lineHeight: 1 }}><span data-count>8,4</span></div><p style={{ fontSize: 14, color: '#94A3B8', margin: 0 }}>de 10</p><div style={{ display: 'flex', gap: 4 }}>{[1, 2, 3, 4, 5].map(s => <Star key={s} size={16} fill={s <= 4 ? '#10B981' : 'none'} color="#10B981" />)}</div></div>
            <div style={cardC}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 16, marginTop: 0 }}>Média por categoria (1–5)</p>
              {[['Satisfação geral', 4.3], ['Ensino', 4.5], ['Atendimento', 4.1], ['Infraestrutura', 3.9], ['Custo-benefício', 3.6]].map(([l, v]) => (
                <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}><span style={{ width: 110, fontSize: 11, color: '#475569', textAlign: 'right' }}>{l}</span><div style={{ flex: 1, height: 16, background: '#F8FAFC' }}><div data-grow style={{ height: 16, width: `${(v as number) / 5 * 100}%`, background: '#F97316', borderRadius: '0 6px 6px 0' }} /></div><span style={{ fontSize: 11, color: '#475569', width: 26 }}>{String(v).replace('.', ',')}</span></div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>Relatório IA</h3><p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8' }}>Análise das respostas do período filtrado</p></div><div style={{ display: 'flex', gap: 8 }}><span style={{ padding: '9px 18px', borderRadius: 10, background: '#1A2B4A', color: '#fff', fontSize: 13, fontWeight: 600 }}>Exportar PDF</span><span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 600 }}><Brain size={15} /> Gerar novamente</span></div></div>
          <div style={card}>
            <div style={{ textAlign: 'center', padding: '10px 0 16px' }}><div style={{ fontSize: 64, fontWeight: 900, color: '#10B981', lineHeight: 1 }}><span data-count>8,2</span></div><p style={{ color: '#94A3B8', margin: '4px 0 12px' }}>/ 10</p><span style={{ padding: '4px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: '#FEF3C7', color: '#92400E' }}>Risco de rematrícula: médio</span></div>
            <div {...d({ 'data-in': 0.6 })} style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 18 }}><p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 8px' }}>Resumo executivo</p><p {...d({ 'data-type': '0.8,2.6' })} style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6 }}>As famílias avaliam bem o ensino e a equipe pedagógica. O custo-benefício e a comunicação sobre eventos são os pontos mais citados para melhorar. 11 famílias estão em dúvida sobre a rematrícula.</p></div>
            <div {...d({ 'data-in': 2.4, 'data-focus': 3.2 })} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div><p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', margin: '0 0 10px' }}>Pontos fortes</p>{['Qualidade do ensino', 'Acolhimento da equipe', 'Segurança na escola'].map(s => <div key={s} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151', marginBottom: 6 }}><Check size={14} color="#10B981" /> {s}</div>)}</div>
              <div><p style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', margin: '0 0 10px' }}>Pontos fracos</p>{['Custo-benefício percebido', 'Comunicação sobre eventos', 'Estacionamento na entrada'].map(s => <div key={s} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151', marginBottom: 6 }}><X size={14} color="#EF4444" /> {s}</div>)}</div>
            </div>
            <div {...d({ 'data-in': 3.2 })}><p style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', margin: '0 0 10px' }}>Ações prioritárias</p>{['Ligar para as 11 famílias em dúvida antes das férias', 'Enviar o calendário de eventos de 2027 junto com a rematrícula', 'Apresentar as condições de pagamento para quem citou custo'].map((a, i) => <div key={a} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#374151', marginBottom: 6 }}><span style={{ fontWeight: 700, color: '#3B82F6' }}>{i + 1}.</span> {a}</div>)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Transferências — src/pages/gestor/GestorTransfers.tsx (página l.540) e
// pesquisa da família — src/pages/survey/TransferSurveyPage.tsx
// ═════════════════════════════════════════════════════════════════════════════
export function TransferenciasLista({ linkAt }: { linkAt?: number }) {
  const toast = linkAt != null ? <div {...d({ 'data-in': linkAt + 1.2 })} style={{ position: 'absolute', right: 24, bottom: 24, background: '#1e2d6b', color: '#fff', fontSize: 13, fontWeight: 500, padding: '12px 18px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,.2)' }}><Check size={14} /> Link copiado para a área de transferência.</div> : null
  const rows = [
    ['Gabriel Fernandes', 'Questões financeiras', '7º ano', '05/11/2026', 'Pesquisa enviada', '#d97706', '#fef3c7', ''],
    ['Larissa Moura', 'Mudança de cidade', '3º ano', '28/10/2026', 'Diagnóstico pronto', '#16a34a', '#dcfce7', 'Mudança'],
    ['Pedro Henrique', 'Outra escola', '9º ano', '21/10/2026', 'Diagnóstico pronto', '#16a34a', '#dcfce7', 'Outra escola'],
  ]
  return (
    <div id="shot" style={{ width: 1100, padding: 24, background: '#f8f9fb', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
      {toast}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}><div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRightLeft size={18} color="#00A896" /></div><h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Transferências</h1></div><p style={{ margin: 0, fontSize: 13, color: '#64748b', paddingLeft: 46 }}>Gerencie solicitações de transferência e entenda os motivos reais</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><DemoSeal /><span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, background: '#00A896', color: 'white', fontSize: 13, fontWeight: 600 }}><Plus size={15} /> Nova transferência</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[[ArrowRightLeft, '#DC2626', '#FEE2E2', 'Total', '3'], [Clock, '#D97706', '#FEF3C7', 'Este mês', '1'], [AlertTriangle, '#64748B', '#F1F5F9', 'Aguardando pesquisa', '0'], [Sparkles, '#8B5CF6', '#EDE9FE', 'Com diagnóstico IA', '2']].map(([I, c, bg, l, v]: any) => (
          <div key={l} style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I size={18} color={c} /></div><div><div style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A' }}><span data-count>{v}</span></div><div style={{ fontSize: 12, color: '#64748B' }}>{l}</div></div></div>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}><h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Registros de transferência</h3></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f8fafc' }}>{['Nome do aluno', 'Série', 'Data', 'Status', 'Diagnóstico', 'Ações'].map(h => <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(([n, m, s, dt, st, c, bg, dg], i) => (
              <tr key={n} {...d(i === 0 && linkAt != null ? { 'data-in': 0.3 } : {})} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '12px 16px' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{n}</div><div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{m}</div></td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{s}</td><td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>{dt}</td>
                <td style={{ padding: '12px 16px' }}><span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color: c }}>{st}</span></td>
                <td style={{ padding: '12px 16px' }}>{dg ? <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: dg === 'Outra escola' ? '#ede9fe' : '#f1f5f9', color: dg === 'Outra escola' ? '#7c3aed' : '#64748b' }}>{dg}</span> : <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>}</td>
                <td style={{ padding: '12px 16px' }}>{dg ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#dcfce7', color: '#16a34a', fontSize: 12, fontWeight: 600 }}><Eye size={12} /> Ver diagnóstico</span> : <span {...d(linkAt != null ? { 'data-focus': linkAt, 'data-press': linkAt + 1 } : {})} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#FEF3C7', color: '#D97706', fontSize: 12, fontWeight: 600 }}><Copy size={12} /> Copiar link</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
export function PesquisaFamilia({ selAt = 2.4 }: { selAt?: number }) {
  const brand = '#0F766E'
  const opts = ['Financeiro — dificuldade com o valor da mensalidade', 'Pedagógico — expectativas não atendidas', 'Distância — localização da escola', 'Escolheu outra escola', 'Mudança de cidade ou bairro', 'Outro motivo']
  const Opt = ({ l, s }: { l: string; s: boolean }) => <div style={{ padding: '14px 18px', borderRadius: 12, border: `2px solid ${s ? brand : '#e2e8f0'}`, background: s ? `${brand}10` : 'white', fontSize: 15, fontWeight: s ? 600 : 400, color: s ? brand : '#374151' }}>{l}</div>
  return (
    <div id="shot" style={{ width: 430, background: '#f8fafc', minHeight: 860 }}>
      <header style={{ backgroundColor: brand, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>C</div><span style={{ color: 'white', fontWeight: 600, fontSize: 17 }}>{ESCOLA}</span></header>
      <div style={{ height: 4, background: '#e2e8f0' }}><div data-grow style={{ height: '100%', background: brand, width: '25%' }} /></div>
      <div style={{ padding: '20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><DemoSeal small /></div>
        <div style={{ background: 'white', borderRadius: 12, padding: '12px 16px', marginBottom: 20, border: '1px solid #e2e8f0', display: 'flex', gap: 16 }}><div><p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 2px' }}>Aluno</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Gabriel Fernandes</p></div><div><p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 2px' }}>Série</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>7º ano</p></div></div>
        <div style={{ background: 'white', borderRadius: 20, padding: '24px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 12px' }}>Pergunta 1 de 4</p>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: '#1e2d6b', margin: '0 0 20px', lineHeight: 1.4 }}>Qual foi o principal motivo da transferência?</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {opts.map((o, i) => i === 0 ? (
              <div key={o} style={{ position: 'relative' }}><div {...d({ 'data-out': selAt })}><Opt l={o} s={false} /></div><div {...d({ 'data-in': selAt, 'data-focus': selAt + 0.2 })} style={{ position: 'absolute', inset: 0 }}><Opt l={o} s /></div></div>
            ) : <Opt key={o} l={o} s={false} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Gerador de Campanha — src/components/reports/CampaignGeneratorModal.tsx
// (cabeçalho e passos l.526, Upload l.599, Configurar l.685, Gerando l.707)
// ═════════════════════════════════════════════════════════════════════════════
const STEPS = ['Upload', 'Diagnóstico', 'Configurar', 'Gerando', 'Revisar']
function GeradorShell({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div id="shot" style={{ width: 860, background: 'rgba(0,0,0,0.5)', padding: 30 }}>
      <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 9, background: '#00A896', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 13, height: 13, borderRadius: '50%', background: 'white', border: '2px solid rgba(255,255,255,0.4)' }} /></div><span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Áion Edu</span><span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 4 }}>· Gerador de Campanha</span></div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><DemoSeal small /><span style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} color="#64748B" /></span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            {STEPS.map((l, i) => { const n = i + 1, act = n === step, done = n < step; return (
              <React.Fragment key={l}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: done ? '#00A896' : act ? '#1A2B4A' : '#E2E8F0', color: done || act ? '#fff' : '#94A3B8' }}>{done ? <Check size={12} /> : n}</div><span style={{ fontSize: 9, fontWeight: 600, color: act ? '#1A2B4A' : '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</span></div>
                {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: n < step ? '#00A896' : '#E2E8F0', margin: '0 4px 14px' }} />}
              </React.Fragment>
            ) })}
          </div>
        </div>
        <div style={{ padding: '0 28px 28px' }}>{children}</div>
      </div>
    </div>
  )
}
export function GeradorUpload({ lidoAt = 2.6 }: { lidoAt?: number }) {
  return (
    <GeradorShell step={1}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 6 }}>Suba os relatórios do ERP</h2>
      <p style={{ fontSize: 14, color: '#64748B', marginBottom: 20, lineHeight: 1.6 }}>A IA lê e extrai os dados automaticamente. Aceita <strong>SIGA</strong>, Totvs e outros ERPs em PDF, Excel ou CSV.</p>
      <div style={{ border: '2px dashed #CBD5E1', borderRadius: 16, padding: '28px 20px', textAlign: 'center', marginBottom: 16, position: 'relative', minHeight: 130 }}>
        <div {...d({ 'data-out': 0.8 })} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Upload size={28} color="#94A3B8" /><p style={{ fontSize: 14, fontWeight: 600, color: '#475569', margin: 0 }}>Clique ou arraste os arquivos aqui</p><p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Até 5 arquivos · PDF, Excel ou CSV</p></div>
        <div {...d({ 'data-in': 0.8, 'data-out': lidoAt })} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}><div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={24} color="#00A896" /></div><p style={{ fontSize: 14, color: '#475569', margin: 0 }}>A IA está lendo os relatórios...</p></div>
        <div {...d({ 'data-in': lidoAt })} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}><CheckCircle size={28} color="#00A896" /><p style={{ fontSize: 14, fontWeight: 600, color: '#065F46', margin: 0 }}>3 relatórios lidos</p></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[['matriculas-2024.pdf', '2024 · 548 alunos · 92 novatos'], ['matriculas-2025.pdf', '2025 · 581 alunos · 104 novatos'], ['matriculas-2026.pdf', '2026 · 612 alunos · 116 novatos']].map(([n, r], i) => (
          <div key={n} {...d({ 'data-in': lidoAt + 0.2 + i * 0.3, ...(i === 2 ? { 'data-focus': lidoAt + 1.4 } : {}) })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}><FileText size={18} color="#16a34a" /><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{n}</div><div style={{ fontSize: 12, color: '#16a34a' }}>{r}</div></div><Check size={16} color="#16a34a" /></div>
        ))}
      </div>
    </GeradorShell>
  )
}
export function GeradorConfig({ objetivoAt = 1.6 }: { objetivoAt?: number }) {
  const S: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }
  const I: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, color: '#1A2B4A', background: '#fff' }
  return (
    <GeradorShell step={3}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 6 }}>Configure a campanha</h2>
      <p style={{ fontSize: 14, color: '#64748B', marginBottom: 20 }}>Confirme os dados e ajuste o objetivo antes de gerar o plano.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}><div><label style={S}>Mensalidade média</label><div style={I}>1.480</div></div><div><label style={S}>Total de alunos atualmente</label><div style={I}>612</div><span style={{ fontSize: 11, color: '#00A896', fontWeight: 600 }}>✓ Preenchido do arquivo ERP</span></div></div>
      <label style={S}>Objetivo<span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>— a IA analisa criticamente</span></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
        {[['Crescer X%', '10'], ['Adicionar X novatos', ''], ['Atingir X alunos total', '']].map(([l, v], i) => {
          const box = (act: boolean, val: string) => <div style={{ padding: 14, borderRadius: 12, border: act ? '2px solid #00A896' : '1.5px solid #E2E8F0', background: act ? '#E6F7F5' : '#F8FAFC' }}><div style={{ fontSize: 12, fontWeight: 600, color: act ? '#00A896' : '#475569', marginBottom: 8 }}>{l}</div><div style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 14, background: '#fff', color: val ? '#1A2B4A' : '#94A3B8', minHeight: 32 }}>{val || ['10', '50', '1000'][i]}</div></div>
          return i === 0 ? (
            <div key={l} style={{ position: 'relative' }}><div {...d({ 'data-out': objetivoAt })}>{box(false, '')}</div><div {...d({ 'data-in': objetivoAt, 'data-focus': objetivoAt + 0.3 })} style={{ position: 'absolute', inset: 0 }}>{box(true, v)}</div></div>
          ) : <div key={l}>{box(false, '')}</div>
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span {...d({ 'data-press': objetivoAt + 2.4 })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 600 }}><Sparkles size={14} />Gerar plano com IA</span></div>
    </GeradorShell>
  )
}
export function GeradorGerando() {
  const msgs = ['Analisando histórico e sazonalidade...', 'Calculando taxas de conversão...', 'Definindo metas mensais...', 'Estimando investimento...', 'Preparando plano completo...']
  return (
    <GeradorShell step={4}>
      <div style={{ paddingTop: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 6 }}>Gerando seu plano</h2>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 28 }}>A IA está montando as metas com base no histórico e sazonalidade real.</p>
        <div style={{ height: 6, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden', marginBottom: 24 }}><div data-grow style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg,#00A896,#0DD3BF)', borderRadius: 999 }} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {msgs.map((m, i) => <div key={m} {...d({ 'data-in': 0.3 + i * 0.6 })} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#475569' }}><CheckCircle size={16} color="#00A896" />{m}</div>)}
        </div>
        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 20 }}>Pode levar até 20 segundos...</p>
      </div>
    </GeradorShell>
  )
}
