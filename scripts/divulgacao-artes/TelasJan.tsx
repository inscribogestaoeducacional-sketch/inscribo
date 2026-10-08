// =============================================================================
// scripts/divulgacao-artes/TelasJan.tsx
//
// Telas de janeiro que ainda não tinham espelho (mesmas regras de TelasApp.tsx):
// - Detalhe do atendente: src/components/gestor/AttendantDetailModal.tsx
// - Contatos duplicados: src/components/contacts/DuplicateContactsModal.tsx
// - Perfil do contato (Etiquetas e Campos Personalizados): ContactProfile.tsx
// - Chat Interno: src/components/chat/InternalChat.tsx
// - Seletor de unidade do topo: src/components/layout/TopBar.tsx (InstitutionSwitcher)
// - Vitrine com bloco Banner e efeito "Pulsar": Vitrine.tsx / BlockForms.tsx
// =============================================================================
import React from 'react'
import {
  X, Zap, GraduationCap, MessageCircle, Clock, Star, Frown, ArrowUpRight, GitMerge, EyeOff, Tag as TagIcon, Search, Send, Network,
  ChevronDown, Bell, Save, User, FileText, ArrowRightLeft, History, Image as ImageIcon, GripVertical, Eye, Megaphone, Sparkles, Plus, Check,
} from 'lucide-react'
import { DemoSeal, RANKING, ESCOLA } from './TelasApp'
import { vitrineHtml, VITRINE_BLOCOS } from './TelasExtra'

const d = (o: Record<string, any>) => o as any

// ── Detalhe do atendente (clique no Ranking da Equipe) ───────────────────────
export function DetalheAtendente({ inAt = 0.3, focusAt = 1.6, abrirAt }: { inAt?: number; focusAt?: number; abrirAt?: number }) {
  const u = RANKING[1] as any
  const ruins = [
    ['Thiago Alves', 'Ok, vou procurar outra escola.', '04/01/2027'],
    ['Renata Dias', 'Ninguém me respondeu ontem.', '06/01/2027'],
    ['Carlos Eduardo', 'Ainda aguardo o retorno sobre o valor.', '08/01/2027'],
  ]
  const metrics = [
    ['Score', String(u?.score ?? 81), Zap, '#F59E0B', '#FFFBEB'], ['Matrículas', '11', GraduationCap, '#7C3AED', '#F5F3FF'],
    ['Conversas WA', '102', MessageCircle, '#25D366', '#F0FDF4'], ['Tempo de resposta', '7min', Clock, '#EF4444', '#FEF2F2'], ['Satisfação', '89%', Star, '#00A896', '#F0FDFA'],
  ] as const
  return (
    <div id="shot" style={{ width: 760, background: 'rgba(15,23,42,0.6)', padding: 40 }}>
      <div {...d({ 'data-in': inAt })} style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#4f46e5' }}>CR</div>
            <div><h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Camila Rocha</h3><p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Detalhe no período selecionado</p></div>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><DemoSeal small /><X size={18} color="#94a3b8" /></span>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 24 }}>
            {metrics.map(([l, v, I, c, bg]) => (
              <div key={l} style={{ background: bg, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}><I size={16} color={c} /></div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c }}><span data-count>{v}</span></div>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginTop: 2, lineHeight: 1.2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div {...d({ 'data-focus': focusAt })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Frown size={15} color="#EF4444" /><span style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b' }}>Conversas avaliadas como Ruim</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: '#FEF2F2', padding: '2px 8px', borderRadius: 999 }}>{ruins.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ruins.map(([n, m, dt], i) => (
                <div key={n} {...d({ 'data-in': inAt + 0.6 + i * 0.3 })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e2d6b' }}>{n}</p><p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{m} · {dt}</p></div>
                  <span {...d(i === 1 && abrirAt != null ? { 'data-focus': abrirAt - 1, 'data-press': abrirAt } : {})} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: '#fff', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 11, fontWeight: 700 }}>Abrir conversa <ArrowUpRight size={12} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Contatos duplicados ──────────────────────────────────────────────────────
export function Duplicados({ selAt = 2.0 }: { selAt?: number }) {
  const grupos = [
    { tel: '5583900001104', itens: [
      { n: 'Fernanda Lima', conv: true, lead: true, tags: 'Integral, Rematrícula', ult: '12/01/2027', sug: true },
      { n: 'Fernanda (mãe da Sofia)', conv: false, lead: false, tags: 'sem etiquetas', ult: '03/08/2026' },
    ] },
    { tel: '5583900002302', itens: [
      { n: 'Renata Dias', conv: true, lead: true, tags: 'Integral', ult: '10/01/2027', sug: true },
      { n: 'Renata', conv: true, lead: false, tags: 'Open School', ult: '21/09/2026' },
      { n: 'Renata D.', conv: false, lead: false, tags: 'sem etiquetas', ult: '02/05/2026' },
    ] },
  ]
  const Card = ({ c, sel }: { c: any; sel: boolean }) => (
    <div style={{ padding: 12, borderRadius: 10, border: `1.5px solid ${sel ? '#00A896' : '#E2E8F0'}`, background: sel ? '#F0FDFB' : '#F8FAFC' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${sel ? '#0075FF' : '#767676'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{sel && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0075FF' }} />}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.n}</span>
      </div>
      {c.sug && <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#0F766E', background: '#CCFBF1', padding: '2px 7px', borderRadius: 999, marginBottom: 6 }}>Sugerido</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#64748B' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MessageCircle size={11} color={c.conv ? '#16A34A' : '#CBD5E1'} />{c.conv ? 'Tem conversa' : 'Sem conversa'}</span>
        <span>{c.lead ? '👤 É lead' : 'Não é lead'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><TagIcon size={11} />{c.tags}</span>
        <span>Última atividade: {c.ult}</span>
      </div>
    </div>
  )
  return (
    <div id="shot" style={{ width: 860, background: 'rgba(15,23,42,0.5)', padding: 40 }}>
      <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><GitMerge size={18} color="#3B82F6" /><div><h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A2B4A' }}>Contatos duplicados</h2><p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8' }}>Mesmo telefone, mais de um cadastro</p></div></div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><DemoSeal /><X size={20} color="#94A3B8" /></span>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grupos.map((g, gi) => (
            <div key={g.tel} {...d({ 'data-in': 0.3 + gi * 0.5 })} style={{ border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{g.tel} · {g.itens.length} cadastros</p>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${g.itens.length},1fr)`, gap: 10, marginBottom: 12 }}>
                {g.itens.map((c, i) => <div key={i} {...d(gi === 0 && c.sug ? { 'data-focus': selAt } : {})}><Card c={c} sel={!!c.sug} /></div>)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span {...d(gi === 0 ? { 'data-press': selAt + 2.2 } : {})} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: '#00A896', color: '#fff', fontSize: 12, fontWeight: 700 }}><GitMerge size={12} /> Mesclar</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1px solid #E2E8F0', color: '#64748B', fontSize: 12, fontWeight: 600 }}><EyeOff size={12} /> Ignorar este grupo</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Perfil do contato: Etiquetas e Campos Personalizados ─────────────────────
export function PerfilEtiquetas({ novaAt = 1.6 }: { novaAt?: number }) {
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }
  const inp: React.CSSProperties = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, background: '#FAFAFA', color: '#1A2B4A', display: 'flex', justifyContent: 'space-between' }
  const Tag = ({ t, c }: { t: string; c: string }) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: c + '22', color: c, border: `1px solid ${c}44` }}>{t}<span style={{ opacity: 0.7 }}>×</span></span>
  return (
    <div id="shot" style={{ width: 640, background: 'rgba(15,23,42,0.5)', padding: 40 }}>
      <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ background: 'linear-gradient(135deg, #D1FAE5 0%, #ECFDF5 100%)', padding: '20px 24px 16px', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.06)', borderRadius: 10, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></span>
          <span style={{ position: 'absolute', top: 16, left: 16 }}><DemoSeal small /></span>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>FL</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Fernanda Lima</h2>
          <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Aluno: Sofia</p>
          <span style={{ fontSize: 12, color: '#64748B' }}>📞 (83) 90000-1104</span>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9' }}>
          {[[User, 'Dados'], [Clock, 'Histórico'], [FileText, 'Anotações'], [ArrowRightLeft, 'Transferência'], [History, 'Alterações']].map(([I, l]: any, i) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px', fontSize: 12, fontWeight: 600, color: i === 0 ? '#00A896' : '#94A3B8', borderBottom: i === 0 ? '2px solid #00A896' : '2px solid transparent' }}><I size={13} /> {l}</span>)}
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div><label style={lbl}>Tipo de contato</label><div style={inp}>Cliente<ChevronDown size={14} /></div></div><div><label style={lbl}>Série</label><div style={inp}>1º ano<ChevronDown size={14} /></div></div></div>
          <div {...d({ 'data-focus': novaAt + 0.6 })}>
            <label style={lbl}>Etiquetas</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <Tag t="Integral" c="#0EA5E9" /><Tag t="Irmão de aluno" c="#8B5CF6" />
              <span {...d({ 'data-in': novaAt })}><Tag t="Bolsista" c="#F59E0B" /></span>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1.5px dashed #CBD5E1', borderRadius: 9, background: '#F8FAFC', color: '#94A3B8', fontSize: 12, fontWeight: 600 }}><TagIcon size={12} /> Adicionar etiqueta</span>
          </div>
          <div {...d({ 'data-focus': novaAt + 2.4 })} style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
            <label style={lbl}>Campos Personalizados</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[['Lista de espera', 'Sim — 2º ano 2027'], ['Percentual da bolsa', '30'], ['Como conheceu a escola', 'Indicação de outra família']].map(([l, v]) => (
                <div key={l}><label style={{ ...lbl, marginBottom: 3, textTransform: 'none', fontSize: 12, fontWeight: 500, color: '#475569' }}>{l}</label><div style={inp}>{v}</div></div>
              ))}
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 9, border: '1.5px solid #00A896', background: '#F0FDFB', color: '#00A896', fontSize: 13, fontWeight: 700 }}><Save size={13} /> Salvar campos personalizados</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Chat Interno ─────────────────────────────────────────────────────────────
export function ChatInterno() {
  const cols = [
    ['Paula Mendes', 'Pode sim, já libero a sala.', '10:42', 0, 'Gestor'], ['Bruno Lima', 'Atendente', '', 0, ''],
    ['Camila Rocha', 'A família da Sofia chegou na recepção', '10:15', 2, ''], ['Patrícia Gomes', 'Boletos de janeiro enviados ✔', 'ontem', 0, ''],
  ]
  const msgs = [
    { me: true, t: 'Paula, a família da Alice chegou para a visita das 10h30. Podemos usar a sala de reuniões?', h: '10:38' },
    { me: false, t: 'Pode sim, já libero a sala.', h: '10:42', in: 1.2 },
    { me: false, t: 'Depois me conta como foi. Se fecharem, já registra no quadro.', h: '10:42', in: 2.2 },
    { me: true, t: 'Combinado! 👍', h: '10:43', in: 3.2 },
  ]
  const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('')
  return (
    <div id="shot" style={{ width: 1000, height: 600, display: 'flex', background: '#fff', fontSize: 14 }}>
      <div style={{ width: 320, borderRight: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><h1 style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Chat Interno</h1><DemoSeal small /></div>
          <div style={{ position: 'relative' }}><Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: 9 }} /><div style={{ padding: '8px 12px 8px 36px', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 14, color: '#9CA3AF' }}>Buscar colega...</div></div>
        </div>
        {cols.map(([n, p, h, u], i) => (
          <div key={n as string} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #F9FAFB', background: i === 0 ? '#E6F7F5' : '#fff' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #00A896, #0DD3BF)', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(n as string)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 14, fontWeight: u ? 700 : 600, color: '#1A2B4A' }}>{n}</span><span style={{ fontSize: 11, color: '#9CA3AF' }}>{h}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}><span style={{ fontSize: 12, color: u ? '#1A2B4A' : '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p}</span>{!!u && <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: '#F43F5E', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u}</span>}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #00A896, #0DD3BF)', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>PM</div>
          <div><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Paula Mendes</p><p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>Gestor</p></div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {msgs.map((m, i) => (
            <div key={i} {...d(m.in != null ? { 'data-in': m.in } : {})} style={{ display: 'flex', justifyContent: m.me ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%', padding: '8px 14px', borderRadius: 16, borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4, background: m.me ? '#00A896' : '#fff', color: m.me ? '#fff' : '#1A2B4A', border: m.me ? 'none' : '1px solid #E5E7EB', fontSize: 14 }}>
                {m.t}<div style={{ fontSize: 10, marginTop: 4, textAlign: 'right', color: m.me ? 'rgba(255,255,255,.7)' : '#9CA3AF' }}>{m.h}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: 10, borderTop: '1px solid #F1F5F9', background: '#fff', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: 12, color: '#9CA3AF', fontSize: 14 }}>Escreva uma mensagem...</div>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: '#00A896', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={15} color="#fff" /></div>
        </div>
      </div>
    </div>
  )
}

// ── Seletor de unidade no topo (gestor de rede) ──────────────────────────────
export function SeletorUnidade({ abreAt = 1.0 }: { abreAt?: number }) {
  const unidades = ['Colégio Horizonte — Centro', 'Colégio Horizonte — Bairro Novo', 'Colégio Horizonte — Praia']
  return (
    <div id="shot" style={{ width: 900, height: 330, background: '#f8f9fb', position: 'relative' }}>
      <div style={{ height: 64, background: '#fff', borderBottom: '1px solid #D1FAE5', display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px' }}>
        <div style={{ width: 300, padding: '8px 12px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 13, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14} />Buscar leads, visitas, matrículas...</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <span {...d({ 'data-press': abreAt - 0.3, 'data-focus': abreAt - 0.8 })} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 10, background: '#F0FDFB', border: '0.5px solid #D1FAE5', color: '#1A2B4A' }}>
              <Network size={14} color="#00A896" /><span style={{ fontSize: 12.5, fontWeight: 600 }}>Colégio Horizonte — Centro</span><ChevronDown size={12} color="#94A3B8" />
            </span>
            <div {...d({ 'data-in': abreAt })} style={{ position: 'absolute', left: 0, top: 'calc(100% + 8px)', background: '#fff', borderRadius: 12, border: '0.5px solid #D1FAE5', boxShadow: '0 8px 32px rgba(0,168,150,0.12)', zIndex: 50, minWidth: 260, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #E2E8F0', background: '#F0FDFB', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suas instituições</div>
              {unidades.map((u, i) => <div key={u} {...d(i === 1 ? { 'data-focus': abreAt + 1.0 } : {})} style={{ padding: '9px 14px', fontSize: 13, background: i === 0 ? '#F0FDFB' : '#fff', color: '#1A2B4A', fontWeight: i === 0 ? 700 : 500 }}>{u}</div>)}
            </div>
          </div>
          <Bell size={18} color="#64748B" />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9999, border: '1px solid #A7F3D0', background: '#ECFDF5' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A' }} /><span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>Disponível</span></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 6px', borderRadius: 12, background: '#F0FDFB', border: '0.5px solid #D1FAE5' }}><div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#00A896,#0DD3BF)', color: '#fff', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>PM</div><div><div style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>Paula Mendes</div><div style={{ fontSize: 10, color: '#94A3B8' }}>Gestor</div></div></div>
        </div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Bom dia, Paula!</h1><p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>Colégio Horizonte — Centro</p></div><DemoSeal /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 18 }}>
          {[['Leads', '184'], ['Conversas WhatsApp', '312'], ['Matrículas', '38'], ['Taxa de conversão', '20,7%']].map(([l, v]) => <div key={l} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px 18px' }}><div style={{ fontSize: 24, fontWeight: 800, color: '#1A2B4A' }}>{v}</div><div style={{ fontSize: 12, color: '#64748B' }}>{l}</div></div>)}
        </div>
      </div>
    </div>
  )
}

// ── Vitrine: bloco Banner de últimas vagas + efeito "Pulsar" no botão ───────
export function VitrineUltimasVagas({ bannerAt = 0.8, efeitoAt }: { bannerAt?: number; efeitoAt?: number }) {
  const ASSETS = process.env.DEMO_ASSETS || 'http://127.0.0.1:5297'
  const banner = { id: 'b0', type: 'banner' as any, is_visible: true, config: { image_url: `${ASSETS}/banner.svg`, aspect: '3:1', alt: 'Últimas vagas 2027', link_url: '' } }
  const blocos = VITRINE_BLOCOS().filter(b => b.id !== 'b4' && b.id !== 'b6')
  const comBanner = [banner, ...blocos]
  const vbtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#1e293b' }
  const Row = ({ I, c, bg, t, s, tag }: any) => (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 6px' }}>
      <span style={{ width: 24, display: 'flex', justifyContent: 'center', color: '#CBD5E1' }}><GripVertical size={16} /></span>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I size={18} color={c} /></span>
      <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#1e2d6b' }}>{t}</span><span style={{ display: 'block', fontSize: 12.5, color: '#64748B', marginTop: 2 }}>{s}</span></span>
      {tag}
      <span style={{ width: 32, color: '#64748B', display: 'flex', justifyContent: 'center' }}><Eye size={16} /></span>
    </div>
  )
  const capt = <span style={{ color: '#DB2777', background: '#FCE7F3', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999 }}><Megaphone size={11} /> Captação</span>
  const pulsar = <span style={{ color: '#00A896', background: '#E6F7F5', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999 }}><Sparkles size={11} /> Pulsar</span>
  const Phone = ({ html }: { html: string }) => (
    <div style={{ width: 360, height: 680, borderRadius: 44, padding: 10, background: 'linear-gradient(160deg,#1e293b,#0f172a)', flex: 'none' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 34, overflow: 'hidden', background: '#fff' }}><iframe srcDoc={html} scrolling="no" style={{ width: '100%', height: '100%', border: 0, display: 'block' }} /></div>
    </div>
  )
  return (
    <div id="shot" style={{ width: 1180, background: '#f8f9fb' }}>
      <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Vitrine</h1>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#D1FAE5', color: '#059669' }}>Publicada</span>
        <span style={{ color: '#00A896', fontWeight: 600, fontSize: 13 }}>aionedu.com.br/colegio-horizonte</span>
        <span {...d(efeitoAt != null ? { 'data-focus': efeitoAt + 1.2 } : {})} style={{ marginLeft: 'auto', background: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 600 }}><Check size={14} /> Tudo salvo</span>
        <DemoSeal />
      </div>
      <div style={{ padding: 24, display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}><h2 style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 700, color: '#1e2d6b' }}>Blocos da página</h2><span style={{ ...vbtn, background: '#00A896', borderColor: '#00A896', color: '#fff' }}><Plus size={15} /> Adicionar bloco</span></div>
          <div {...d({ 'data-in': bannerAt, 'data-focus': bannerAt + 0.6 })}><Row I={ImageIcon} c="#1D4ED8" bg="#DBEAFE" t="Últimas vagas 2027" s="Banner · Faixa 3:1 · sem link" /></div>
          <div {...d(efeitoAt != null ? { 'data-focus': efeitoAt - 0.4 } : {})} style={{ position: 'relative' }}>
            {efeitoAt != null ? (<>
              <div {...d({ 'data-out': efeitoAt })}><Row I={GraduationCap} c="#00A896" bg="#E6F7F5" t="Matrículas 2027 abertas" s="Botão de matrícula · WhatsApp" tag={capt} /></div>
              <div {...d({ 'data-in': efeitoAt })} style={{ position: 'absolute', inset: 0 }}><Row I={GraduationCap} c="#00A896" bg="#E6F7F5" t="Matrículas 2027 abertas" s="Botão de matrícula · WhatsApp" tag={<span style={{ display: 'flex', gap: 6 }}>{capt}{pulsar}</span>} /></div>
            </>) : <Row I={GraduationCap} c="#00A896" bg="#E6F7F5" t="Matrículas 2027 abertas" s="Botão de matrícula · WhatsApp" tag={<span style={{ display: 'flex', gap: 6 }}>{capt}{pulsar}</span>} />}
          </div>
          {efeitoAt != null && (
            <div {...d({ 'data-in': efeitoAt - 1.2 })} style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>Efeito do botão</label>
              <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, width: 'fit-content', position: 'relative' }}>
                {['Nenhum', 'Pulsar', 'Brilho', 'Balançar'].map((e, i) => <span key={e} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#64748b', position: 'relative' }}>{i === 1 && <span {...d({ 'data-in': efeitoAt })} style={{ position: 'absolute', inset: 0, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.1)' }} />}{i === 0 && <span {...d({ 'data-out': efeitoAt })} style={{ position: 'absolute', inset: 0, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.1)' }} />}<span style={{ position: 'relative', color: '#1e2d6b' }}>{e}</span></span>)}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>Um anel sai do botão de tempos em tempos. Bom pra matrícula e WhatsApp.</p>
            </div>
          )}
          <Row I={MessageCircle} c="#059669" bg="#D1FAE5" t="Fale com a secretaria" s="WhatsApp · número da escola" tag={capt} />
        </div>
        <div style={{ position: 'relative' }}>
          <Phone html={vitrineHtml('matriculas', blocos as any)} />
          <div {...d({ 'data-in': bannerAt })} style={{ position: 'absolute', inset: 0 }}><Phone html={vitrineHtml('matriculas', comBanner as any)} /></div>
        </div>
      </div>
    </div>
  )
}
export { ESCOLA }
