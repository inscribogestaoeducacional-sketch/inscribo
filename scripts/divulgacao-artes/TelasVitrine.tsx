// =============================================================================
// scripts/divulgacao-artes/TelasVitrine.tsx
//
// Vitrine — src/pages/gestor/Vitrine.tsx (cabeçalho, abas), TemplatePicker,
// AppearancePanel (seção "Cores", PRIMARY_SWATCHES) e BlockList. Prévia com o
// renderizador real (vitrineHtml). Vídeo e mapa aparecem só na lista de blocos:
// a prévia não carrega conteúdo externo.
// Também: modal "Definir lembrete" (LeadKanban.tsx, ReminderModal).
// =============================================================================
import React from 'react'
import {
  Store, LayoutList, Share2, Palette, SlidersHorizontal, BarChart3, GripVertical, Smartphone, Monitor, Megaphone, Image as ImageIcon,
  Video, Quote, Map as MapIcon, GraduationCap, MessageCircle, Plus, Eye, Copy, Check, ExternalLink, Link2, Bell, X, ArrowRight,
} from 'lucide-react'
import { TEMPLATES as VTEMPLATES } from '../../src/lib/vitrineCore'
import { vitrineHtml, VITRINE_BLOCOS } from './TelasExtra'
import { DemoSeal } from './TelasApp'

const d = (o: Record<string, any>) => o as any
const vbtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }

function VPhone({ html, height, width = 360 }: { html: string; height: number; width?: number }) {
  return (
    <div style={{ width, height, borderRadius: 44, padding: 10, background: 'linear-gradient(160deg,#1e293b,#0f172a)', boxShadow: '0 24px 48px rgba(15,23,42,.18)', flex: 'none' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 34, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 'none', height: 34, display: 'flex', alignItems: 'center', padding: '0 22px', fontSize: 12, fontWeight: 700, color: '#0f172a', position: 'relative' }}><span>9:41</span><span style={{ position: 'absolute', left: '50%', top: 7, transform: 'translateX(-50%)', width: 88, height: 22, borderRadius: 999, background: '#0b1120' }} /></div>
        <iframe srcDoc={html} scrolling="no" style={{ width: '100%', flex: 1, minHeight: 0, border: 0, display: 'block' }} />
      </div>
    </div>
  )
}
type VTab = 'blocks' | 'social' | 'appearance' | 'settings' | 'stats'
function VHeader({ tab, copiarAt }: { tab: VTab; copiarAt?: number }) {
  const NAV: [VTab, string, any, number?][] = [['blocks', 'Blocos', LayoutList, 6], ['social', 'Redes sociais', Share2, 2], ['appearance', 'Aparência', Palette], ['settings', 'Configurações', SlidersHorizontal], ['stats', 'Desempenho', BarChart3]]
  return (
    <div style={{ background: 'rgba(248,249,251,0.92)', borderBottom: '1px solid #E2E8F0', padding: '18px 24px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Store size={18} color="#00A896" /></div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Vitrine</h1>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#D1FAE5', color: '#059669' }}>Publicada</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', paddingLeft: 46, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span {...d(copiarAt != null ? { 'data-focus': copiarAt - 1.2 } : {})} style={{ color: '#00A896', fontWeight: 600 }}>aionedu.com.br/colegio-horizonte</span>
            <span {...d(copiarAt != null ? { 'data-press': copiarAt } : {})} style={{ padding: 4, color: '#94a3b8', display: 'flex' }}><Copy size={13} /></span>
          </p>
        </div>
        <span style={{ background: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 600 }}><Check size={14} /> Tudo salvo</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DemoSeal />
          <span style={vbtn}><ExternalLink size={15} /> Ver página</span>
          <span style={{ ...vbtn, color: '#64748b' }}><Eye size={15} /> Despublicar</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {NAV.map(([k, l, I, n]) => {
          const sel = tab === k
          return (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: sel ? '#fff' : 'transparent', color: sel ? '#1e2d6b' : '#64748b', boxShadow: sel ? '0 1px 3px rgba(0,0,0,0.10)' : 'none' }}>
              <I size={15} color={sel ? '#00A896' : '#94a3b8'} /> {l}{n != null && <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: sel ? '#E6F7F5' : '#E2E8F0', color: sel ? '#00A896' : '#64748b' }}>{n}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}
function VPreview({ children }: { children: React.ReactNode }) {
  return (
    <aside style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748b' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00A896', boxShadow: '0 0 0 3px #E6F7F5' }} /> Prévia ao vivo</span>
        <div style={{ display: 'flex', gap: 2, background: '#F1F5F9', borderRadius: 999, padding: 3 }}>
          {([['Celular', Smartphone, true], ['Computador', Monitor, false]] as const).map(([l, I, on]) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: on ? '#fff' : 'transparent', color: on ? '#1e2d6b' : '#64748b' }}><I size={13} /> {l}</span>)}
        </div>
      </div>
      {children}
    </aside>
  )
}

// Modelos prontos (TemplatePicker) com a página da escola de exemplo em cada um
export function VitrineModelos({ selAt = 2.4 }: { selAt?: number }) {
  const few = VITRINE_BLOCOS().filter(b => ['b1', 'b2', 'b3', 'b4'].includes(b.id))
  return (
    <div id="shot" style={{ width: 1180, padding: '24px 28px', background: '#F4F7F5' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e2d6b' }}>Escolha um modelo</h2><p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Dá pra trocar cores, fontes e blocos depois.</p></div>
        <DemoSeal />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        {VTEMPLATES.map((t, i) => (
          <div key={t.key} {...d(i === 0 ? { 'data-focus': selAt } : {})} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, background: '#fff', border: '1.5px solid #E2E8F0', position: 'relative' }}>
            <VPhone html={vitrineHtml(t.key, few)} height={520} width={240} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b' }}>{t.name}</span>
            {i === 0 && <span {...d({ 'data-in': selAt })} style={{ position: 'absolute', inset: -2, borderRadius: 18, border: '3px solid #00A896', boxShadow: '0 0 0 4px #E6F7F5' }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

// Aparência → Cores, com a prévia trocando de cor
export function VitrineCores({ trocaAt = 2.6 }: { trocaAt?: number }) {
  const SW = ['#00A896', '#3B82F6', '#1e2d6b', '#7C3AED', '#DB2777', '#DC2626', '#F59E0B', '#059669']
  const sw = (sel: string) => <div style={{ display: 'flex', gap: 6 }}>{SW.map(s => <span key={s} style={{ width: 26, height: 26, borderRadius: 7, background: s, border: s === sel ? '2px solid #1e2d6b' : '1px solid #CBD5E1', boxShadow: s === sel ? '0 0 0 2px #fff inset' : 'none' }} />)}</div>
  const lab: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }
  const box: React.CSSProperties = { width: 38, height: 38, borderRadius: 9, border: '1.5px solid #E2E8F0', padding: 3, position: 'relative', flex: 'none' }
  const hex: React.CSSProperties = { width: 96, padding: '9px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontFamily: 'ui-monospace, monospace', fontSize: 13, position: 'relative', flex: 'none' }
  return (
    <div id="shot" style={{ width: 1180, background: '#f8f9fb' }}>
      <VHeader tab="appearance" />
      <div style={{ padding: 24, display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: '#1e2d6b' }}>Cores</h3>
            <label style={lab}>Cor principal (botões)</label>
            <div {...d({ 'data-focus': trocaAt - 1 })} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={box}><span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 6, background: '#0F766E' }} /><span {...d({ 'data-in': trocaAt })} style={{ position: 'absolute', inset: 3, borderRadius: 6, background: '#7C3AED' }} /></span>
              <span style={hex}><span {...d({ 'data-out': trocaAt })}>#0F766E</span><span {...d({ 'data-in': trocaAt })} style={{ position: 'absolute', left: 10, top: 9 }}>#7C3AED</span></span>
              <div style={{ position: 'relative' }}><div {...d({ 'data-out': trocaAt })}>{sw('')}</div><div {...d({ 'data-in': trocaAt })} style={{ position: 'absolute', inset: 0 }}>{sw('#7C3AED')}</div></div>
            </div>
            <label style={lab}>Texto</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={box}><span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 6, background: '#0F172A' }} /></span><span style={hex}>#0F172A</span></div>
          </section>
          <section style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#1e2d6b' }}>Botões</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>{['Preenchido', 'Suave', 'Contorno', 'Vidro', 'Sombra marcada', 'Minimalista'].map((b, i) => <div key={b} style={{ padding: 12, borderRadius: 12, border: i === 0 ? '2px solid #00A896' : '1.5px solid #E2E8F0', background: i === 0 ? '#F0FDFA' : '#fff', fontSize: 12, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>{b}</div>)}</div>
          </section>
        </div>
        <VPreview>
          <div style={{ position: 'relative' }}>
            <VPhone html={vitrineHtml('matriculas')} height={680} />
            <div {...d({ 'data-in': trocaAt })} style={{ position: 'absolute', inset: 0 }}><VPhone html={vitrineHtml('matriculas', VITRINE_BLOCOS(), '#7C3AED')} height={680} /></div>
          </div>
        </VPreview>
      </div>
    </div>
  )
}

// Blocos: fotos, vídeo, depoimentos e mapa entrando na lista
export function VitrineBlocos({ copiarAt }: { copiarAt?: number } = {}) {
  const rows: [any, string, string, string, string][] = [
    [GraduationCap, '#00A896', '#E6F7F5', 'Matrículas 2027 abertas', 'Botão de matrícula · WhatsApp'],
    [MessageCircle, '#059669', '#D1FAE5', 'Fale com a secretaria', 'WhatsApp · número da escola'],
    [ImageIcon, '#7C3AED', '#EDE9FE', 'Galeria · 4 fotos', 'Galeria de imagens · grade'],
    [Video, '#7C3AED', '#EDE9FE', 'Conheça a escola', 'Vídeo · YouTube'],
    [Quote, '#D97706', '#FEF3C7', 'O que as famílias dizem', 'Depoimentos · 2 depoimentos'],
    [MapIcon, '#0284C7', '#E0F2FE', 'Como chegar', 'Mapa / Endereço · Rua Exemplo, 100'],
  ]
  return (
    <div id="shot" style={{ width: 1180, background: '#f8f9fb', position: 'relative' }}>
      <VHeader tab="blocks" copiarAt={copiarAt} />
      <div style={{ padding: 24, display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ flex: 1 }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e2d6b' }}>Blocos da página</h2><p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Clique num bloco para editar. Arraste pela alça para mudar a ordem.</p></div>
            <span style={{ ...vbtn, border: '1px solid #00A896', background: '#00A896', color: '#fff' }}><Plus size={15} /> Adicionar bloco</span>
          </div>
          {rows.map(([I, c, bg, t, s], i) => (
            <div key={t} {...d(i >= 2 && copiarAt == null ? { 'data-in': 0.6 + (i - 2) * 0.9, 'data-focus': 0.8 + (i - 2) * 0.9 } : {})} style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 6px' }}>
              <span style={{ width: 24, display: 'flex', justifyContent: 'center', color: '#CBD5E1' }}><GripVertical size={16} /></span>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><I size={18} color={c} /></span>
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#1e2d6b' }}>{t}</span><span style={{ display: 'block', fontSize: 12.5, color: '#64748B', marginTop: 2 }}>{s}</span></span>
              {i < 2 && <span style={{ color: '#DB2777', background: '#FCE7F3', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999 }}><Megaphone size={11} /> Captação</span>}
              <span style={{ width: 32, color: '#64748B', display: 'flex', justifyContent: 'center' }}><Eye size={16} /></span>
            </div>
          ))}
        </div>
        <VPreview><VPhone html={vitrineHtml('matriculas', VITRINE_BLOCOS().filter(b => b.id !== 'b4' && b.id !== 'b6'))} height={680} /></VPreview>
      </div>
      {copiarAt != null && <div {...d({ 'data-in': copiarAt + 0.2 })} style={{ position: 'absolute', left: 24, top: 110, background: '#1e2d6b', color: '#fff', fontSize: 14, fontWeight: 600, padding: '12px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,.2)' }}><Check size={15} /> Link copiado.</div>}
    </div>
  )
}

// Cartão do quadro com origem "Vitrine" ao lado da página no celular (A24)
export function OrigemVitrine({ cardEl }: { cardEl: React.ReactNode }) {
  return (
    <div id="shot" style={{ width: 1000, padding: 28, background: '#F9FAFB', display: 'flex', gap: 36, alignItems: 'center', justifyContent: 'center' }}>
      <VPhone html={vitrineHtml()} height={600} width={320} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#00A896' }}><ArrowRight size={34} /></div>
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Leads · Novo</span><DemoSeal small /></div>
        {cardEl}
      </div>
    </div>
  )
}

// Modal "Definir lembrete" — src/components/leads/LeadKanban.tsx (ReminderModal)
export function LembreteModal({ aluno, resp, data, nota, inAt = 0.4, t0 = 1.2, t1 = 3.0 }: { aluno: string; resp: string; data: string; nota: string; inAt?: number; t0?: number; t1?: number }) {
  const lab: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }
  const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1A2B4A', background: '#fff' }
  return (
    <div {...d({ 'data-in': inAt })} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid #FDE68A' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={18} color="#D97706" /></div>
          <div style={{ flex: 1 }}><h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Definir lembrete</h2><p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{aluno} · {resp}</p></div>
          <span style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} color="#94A3B8" /></span>
        </div>
        <div style={{ marginBottom: 14 }}><label style={lab}>Data do follow-up *</label><div {...d({ 'data-focus': t0 - 0.4 })} style={inp}>{data}</div></div>
        <div style={{ marginBottom: 20 }}><label style={lab}>Nota (opcional)</label><div style={{ ...inp, minHeight: 64 }}><span {...d({ 'data-type': `${t0},${t1}` })}>{nota}</span></div></div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <span style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, color: '#64748B', fontWeight: 500 }}>Cancelar</span>
          <span {...d({ 'data-press': t1 + 0.8 })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 9, background: '#D97706', color: '#fff', fontSize: 13, fontWeight: 700 }}><Bell size={14} /> Salvar lembrete</span>
        </div>
      </div>
    </div>
  )
}
