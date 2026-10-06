// =============================================================================
// scripts/novidades-mockups/MockupsVitrine.tsx
//
// Telas da Vitrine Áion pra /novidades/vitrine, a landing e o carrossel.
// A página da escola é a DE VERDADE: sai do renderizador da página pública
// (api/_lib/vitrineRender.ts) com os mesmos dados que o editor monta
// (buildPreviewData), pra uma escola FICTÍCIA ("Colégio Exemplo"). O editor
// em volta espelha src/pages/gestor/Vitrine.tsx e components/vitrine/BlockList
// (cores, tamanhos, textos), sem Supabase. Cada tela leva o selo "Dados de
// exemplo". Se a tela real mudar, atualize aqui e rode:
//   node scripts/novidades-mockups/render.mjs --vitrine
// =============================================================================
import React from 'react'
import {
  Store, Copy, Check, Smartphone, Monitor, ExternalLink, EyeOff, Plus, LayoutList, Share2, Palette, SlidersHorizontal,
  BarChart3, GripVertical, Eye, Info, Sparkles, Megaphone, Globe, Layers, Users, MousePointerClick,
  MessageCircle, GraduationCap, Link2, HelpCircle, UserPlus, Clock, type LucideIcon,
} from 'lucide-react'
import {
  BLOCK_TYPES, blockSummary, blockDetail, buildPreviewData, templateTheme, TEMPLATES, EFFECTS,
  type BlockType, type VitrinePageRow, type TemplateKey,
} from '../../src/lib/vitrineCore'
import { renderVitrinePage } from '../../api/_lib/vitrineRender'

// Servidor local de render.mjs (logo fictícia): o renderizador só aceita http(s).
const ASSETS = process.env.DEMO_ASSETS || 'http://127.0.0.1:5297'
const PHONE = '5583900000000' // fictício
const SCHOOL = 'Colégio Exemplo'
const PRIMARY = '#1D4ED8'

// Tokens do editor (components/vitrine/ui.tsx → DS)
const DS = {
  shadowSm: '0 1px 3px rgba(0,168,150,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  r: { sm: 8, md: 12, lg: 16, xl: 20 },
}

// ── Dados de demonstração ───────────────────────────────────────────────────
interface DemoBlock { id: string; type: BlockType; config: Record<string, any>; is_visible: boolean; capture?: boolean }
const BLOCKS: DemoBlock[] = [
  { id: 'b1', type: 'enroll', is_visible: true, capture: true, config: { label: 'Matrículas 2027 abertas', mode: 'whatsapp', message: 'Olá! Vim pela página da escola e quero fazer a matrícula.', effect: 'pulse' } },
  { id: 'b2', type: 'whatsapp', is_visible: true, capture: true, config: { label: 'Fale com a secretaria', message: 'Olá! Vim pela página da escola e gostaria de mais informações.', phone_source: 'school', track_capture: true } },
  { id: 'b3', type: 'link', is_visible: true, config: { label: 'Agende uma visita', url: 'https://exemplo.com.br/visita', style: 'button' } },
  { id: 'b4', type: 'stats', is_visible: true, config: { title: '', animate: true, items: [
    { value: 25, prefix: '', suffix: '', label: 'anos de história' },
    { value: 850, prefix: '+', suffix: '', label: 'alunos' },
    { value: 98, prefix: '', suffix: '%', label: 'de aprovação' },
  ] } },
  { id: 'b5', type: 'hours', is_visible: true, config: { layout: 'compact', note: '',
    days: [1, 2, 3, 4, 5].map(dow => ({ dow, open: '07:00', close: '18:00' })).concat([{ dow: 6, open: '08:00', close: '12:00' } as any, { dow: 0, closed: true } as any]) } },
  { id: 'b6', type: 'faq', is_visible: true, config: { title: 'Perguntas frequentes', items: [
    { q: 'Quando começam as matrículas de 2027?', a: 'Já estão abertas. Fale com a secretaria pelo WhatsApp.' },
    { q: 'A escola tem período integral?', a: 'Sim, do Infantil ao Fundamental I.' },
    { q: 'Como agendar uma visita?', a: 'Pelo botão "Agende uma visita" ou pelo WhatsApp.' },
  ] } },
  { id: 'b7', type: 'contact', is_visible: true, config: { label: 'Salvar contato na agenda', name: '', phone_source: 'school', email: 'secretaria@exemplo.com.br', website: '', address: '' } },
]

function pageRow(theme: Record<string, any>): VitrinePageRow {
  return {
    id: 'demo', institution_id: 'demo', slug: 'colegio-exemplo', is_published: true, published_at: null,
    title: SCHOOL, bio: 'Educação Infantil ao Ensino Médio · Matrículas 2027 abertas',
    logo_url: `${ASSETS}/logo.svg`, cover_url: null, theme: theme as any, seo_description: null,
    social_links: [{ network: 'instagram', handle: 'colegioexemplo' }, { network: 'facebook', handle: 'colegioexemplo' }, { network: 'youtube', handle: 'colegioexemplo' }],
    floating_block_id: null, show_share: true, social_position: 'top', cover_video_url: null,
    publish_at: null, unpublish_at: null, updated_at: '',
  }
}

// HTML da página pública (modo prévia: sem script de registro, números já
// no valor final, sem animação de entrada).
export function pageHtml(key: TemplateKey = 'matriculas', blocks: DemoBlock[] = BLOCKS): string {
  const theme = templateTheme(key, { primary: PRIMARY })
  const data = buildPreviewData(pageRow(theme), blocks, { schoolPhone: PHONE, institutionName: SCHOOL })
  return renderVitrinePage(data, { siteUrl: 'https://aionedu.com.br', preview: true })
}

function DemoSeal() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1.5px dashed #F9A8D4', background: '#FDF2F8', color: '#BE185D', fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
      <Info size={12} /> Dados de exemplo · demonstração
    </span>
  )
}

// Moldura de celular da prévia (Vitrine.tsx → phoneFrame)
export function PhoneFrame({ html, height, width = 380 }: { html: string; height: number; width?: number }) {
  return (
    <div style={{ position: 'relative', width, height, borderRadius: 44, padding: 10, background: 'linear-gradient(160deg,#1e293b,#0f172a)', boxShadow: '0 24px 48px rgba(15,23,42,.18), 0 8px 16px rgba(0,168,150,.08)', flex: 'none' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 34, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 'none', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', background: '#fff', fontSize: 12, fontWeight: 700, color: '#0f172a', position: 'relative' }}>
          <span>9:41</span>
          <span style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', width: 92, height: 24, borderRadius: 999, background: '#0b1120' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 10 }}>{[4, 6, 8, 10].map(h => <span key={h} style={{ width: 3, height: h, borderRadius: 1, background: '#0f172a' }} />)}</span>
            <span style={{ width: 20, height: 10, borderRadius: 3, border: '1.5px solid #0f172a', padding: 1, display: 'flex' }}><span style={{ flex: 1, borderRadius: 1, background: '#0f172a' }} /></span>
          </span>
        </div>
        <iframe srcDoc={html} title="" style={{ width: '100%', flex: 1, minHeight: 0, border: 0, display: 'block' }} scrolling="no" />
      </div>
    </div>
  )
}

const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, boxShadow: DS.shadowSm, color: '#1e293b', whiteSpace: 'nowrap' }

type Tab = 'blocks' | 'social' | 'appearance' | 'settings' | 'stats'
function Header({ tab }: { tab: Tab }) {
  const NAV: { key: Tab; label: string; Icon: LucideIcon; count?: number }[] = [
    { key: 'blocks', label: 'Blocos', Icon: LayoutList, count: BLOCKS.length },
    { key: 'social', label: 'Redes sociais', Icon: Share2, count: 3 },
    { key: 'appearance', label: 'Aparência', Icon: Palette },
    { key: 'settings', label: 'Configurações', Icon: SlidersHorizontal },
    { key: 'stats', label: 'Desempenho', Icon: BarChart3 },
  ]
  return (
    <div style={{ background: 'rgba(248,249,251,0.92)', borderBottom: '1px solid #E2E8F0', padding: '18px 24px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={18} color="#00A896" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Vitrine</h1>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#D1FAE5', color: '#059669' }}>Publicada</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', paddingLeft: 46, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#00A896', fontWeight: 600 }}>aionedu.com.br/colegio-exemplo</span>
            <span style={{ padding: 4, color: '#94a3b8', display: 'flex' }}><Copy size={13} /></span>
          </p>
        </div>
        <span style={{ background: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
          <Check size={14} /> Tudo salvo
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <DemoSeal />
          <span style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 10px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
            <span><strong style={{ color: '#1e293b' }}>1.284</strong> visitas</span>
            <span><strong style={{ color: '#1e293b' }}>412</strong> cliques</span>
            <span style={{ color: '#94a3b8' }}>7 dias</span>
          </span>
          <span style={btn}><ExternalLink size={15} /> Ver página</span>
          <span style={{ ...btn, color: '#64748b' }}><EyeOff size={15} /> Despublicar</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {NAV.map(t => {
          const sel = tab === t.key
          return (
            <span key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: sel ? '#fff' : 'transparent', color: sel ? '#1e2d6b' : '#64748b', boxShadow: sel ? '0 1px 3px rgba(0,0,0,0.10)' : 'none' }}>
              <t.Icon size={15} color={sel ? '#00A896' : '#94a3b8'} /> {t.label}
              {t.count !== undefined && <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: sel ? '#E6F7F5' : '#E2E8F0', color: sel ? '#00A896' : '#64748b' }}>{t.count}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

const ICONS: Partial<Record<BlockType, LucideIcon>> = {
  enroll: GraduationCap, whatsapp: MessageCircle, link: Link2, stats: BarChart3, hours: Clock, faq: HelpCircle, contact: UserPlus,
}
function Tag({ color, background, Icon, children }: { color: string; background: string; Icon: LucideIcon; children: React.ReactNode }) {
  return <span style={{ color, background, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}><Icon size={11} /> {children}</span>
}
function BlockRow({ b }: { b: DemoBlock }) {
  const meta = BLOCK_TYPES[b.type]
  const Icon = ICONS[b.type] || Link2
  const fx = EFFECTS.find(e => e.value === b.config.effect && e.value !== 'none')
  return (
    <div style={{ background: '#fff', borderRadius: DS.r.lg, border: '1px solid #E2E8F0', boxShadow: DS.shadowSm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 6px' }}>
        <span style={{ width: 24, display: 'flex', justifyContent: 'center', color: '#CBD5E1' }}><GripVertical size={16} /></span>
        <span style={{ width: 40, height: 40, borderRadius: DS.r.md, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon size={18} color={meta.color} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#1e2d6b', letterSpacing: '-0.01em', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{blockSummary(b.type, b.config)}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{meta.label} · {blockDetail(b.type, b.config)}</span>
        </span>
        <span style={{ display: 'flex', gap: 6 }}>
          {b.capture && <Tag color="#DB2777" background="#FCE7F3" Icon={Megaphone}>Captação</Tag>}
          {fx && <Tag color="#00A896" background="#E6F7F5" Icon={Sparkles}>{fx.label}</Tag>}
        </span>
        <span style={{ width: 32, height: 32, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Eye size={16} /></span>
      </div>
    </div>
  )
}

function Preview({ html, height }: { html: string; height: number }) {
  return (
    <aside style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 30 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00A896', boxShadow: '0 0 0 3px #E6F7F5' }} /> Prévia ao vivo
        </span>
        <div style={{ display: 'flex', gap: 2, background: '#F1F5F9', borderRadius: 999, padding: 3 }}>
          {[{ label: 'Celular', Icon: Smartphone, on: true }, { label: 'Computador', Icon: Monitor, on: false }].map(({ label, Icon, on }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: on ? '#fff' : 'transparent', color: on ? '#1e2d6b' : '#64748b', boxShadow: on ? '0 1px 3px rgba(0,0,0,.10)' : 'none' }}>
              <Icon size={13} /> {label}
            </span>
          ))}
        </div>
      </div>
      <PhoneFrame html={html} height={height} />
    </aside>
  )
}

const Page = ({ children, width = 1280 }: { children: React.ReactNode; width?: number }) => (
  <div id="shot" style={{ width, display: 'flex', flexDirection: 'column', background: '#f8f9fb' }}>{children}</div>
)

// ── Tela 1: editor (lista de blocos + prévia ao vivo) ───────────────────────
export function Editor() {
  return (
    <Page>
      <Header tab="blocks" />
      <div style={{ padding: '24px 24px 32px', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e2d6b', letterSpacing: '-0.01em' }}>Blocos da página</h2>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Clique num bloco para editar. Arraste pela alça para mudar a ordem.</p>
            </div>
            <span style={{ ...btn, border: '1px solid #00A896', background: '#00A896', color: '#fff', boxShadow: '0 4px 14px rgba(0,168,150,0.25)' }}><Plus size={15} /> Adicionar bloco</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BLOCKS.map(b => <BlockRow key={b.id} b={b} />)}
          </div>
        </div>
        <Preview html={pageHtml()} height={700} />
      </div>
    </Page>
  )
}

// ── Tela 2: os quatro modelos (mesmos blocos, visual de cada modelo) ────────
export function Modelos() {
  const few = BLOCKS.filter(b => ['b1', 'b2', 'b3', 'b4', 'b6'].includes(b.id))
  return (
    <div id="shot" style={{ width: 880, padding: 28, background: '#F4F7F5', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, justifyItems: 'center' }}>
      {TEMPLATES.map(t => (
        <div key={t.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <PhoneFrame html={pageHtml(t.key, few)} height={640} width={340} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>{t.name}</span>
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1' }}><DemoSeal /></div>
    </div>
  )
}

// ── Tela 3: a página no celular (alta, pra mostrar a página inteira) ────────
export function Pagina() {
  return (
    <div id="shot" style={{ width: 440, padding: 30, background: '#F4F7F5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <PhoneFrame html={pageHtml()} height={1000} />
      <DemoSeal />
    </div>
  )
}

// ── Tela 4: aba Desempenho ──────────────────────────────────────────────────
function KpiCard({ label, value, icon, bg, hint }: { label: string; value: string; icon: React.ReactNode; bg: string; hint?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1e2d6b', lineHeight: 1.1 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}
export function Desempenho() {
  return (
    <Page>
      <Header tab="stats" />
      <div style={{ padding: '24px 24px 32px', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e2d6b', letterSpacing: '-0.01em' }}>Desempenho</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Resumo dos últimos 7 dias.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <KpiCard label="Página" value="Publicada" hint="Visível pra quem tem o link" icon={<Globe size={16} color="#059669" />} bg="#D1FAE5" />
            <KpiCard label="Blocos na página" value={String(BLOCKS.length)} hint="Todos visíveis" icon={<Layers size={16} color="#00A896" />} bg="#E6F7F5" />
            <KpiCard label="Visitas · 7 dias" value="1.284" hint="903 pessoa(s)" icon={<Users size={16} color="#0284C7" />} bg="#E0F2FE" />
            <KpiCard label="Cliques · 7 dias" value="412" hint="32% das visitas" icon={<MousePointerClick size={16} color="#7C3AED" />} bg="#EDE9FE" />
          </div>
        </div>
        <Preview html={pageHtml()} height={560} />
      </div>
    </Page>
  )
}
