// =============================================================================
// scripts/divulgacao-artes/Artes.tsx
//
// Peças do calendário de divulgação no MOLDE dos carrosséis de novidade
// (scripts/novidades-mockups/Carrossel.tsx): mesmos fundos, SHARED_CSS,
// títulos em Bricolage com destaque #0DD3BF, cartões, BrowserFrame e
// numeração. Ajustes pedidos sobre o molde: logo maior sobre retângulo branco
// arredondado, textos maiores e rodapé de contato completo. Textos exatamente
// como aprovados pelo Victor — não reescrever aqui.
// Telas entram vivas (não como imagem) pra versão animada: render.mjs ajusta
// a escala de [data-fit], posiciona os recortes [data-recorte] e anima.
// =============================================================================
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Link2, MessageCircle, BarChart3, Star, ListChecks, FileText, Moon, ClipboardCheck, Settings2, Megaphone, ClipboardList } from 'lucide-react'
import { Dashboard } from '../novidades-mockups/Mockups'
import { Pesquisas, Robo } from './Telas'
export { SHARED_CSS } from '../../src/styles/sharedCSS'

export const W = 1080, H = 1350
export const HERO_BG = `radial-gradient(ellipse 80% 60% at 15% 40%, rgba(0,82,60,0.98) 0%, transparent 65%), radial-gradient(ellipse 45% 55% at 88% 12%, rgba(219,39,119,0.16) 0%, transparent 60%), radial-gradient(ellipse 50% 70% at 80% 80%, rgba(0,168,150,0.2) 0%, transparent 55%), #00301F`
export const CTA_BG = 'linear-gradient(135deg,#00523C 0%,#006B50 50%,#00A896 100%)'
const CONTATOS = { whatsapp: '(83) 99344-4383', instagram: '@aioneduu', site: 'aionedu.com.br' }

export const title = (size: number, color: string): React.CSSProperties => ({ fontSize: size, color, lineHeight: 1.02, letterSpacing: '-0.035em' })
// Título com o trecho final em destaque, sem mudar o texto.
export const T = ({ text, hl }: { text: string; hl?: string }) => {
  if (!hl || !text.endsWith(hl)) return <>{text}</>
  return <>{text.slice(0, text.length - hl.length)}<span style={{ color: '#0DD3BF' }}>{hl}</span></>
}

// Logo original sobre retângulo branco arredondado (pedido do Victor).
export const Logo = () => (
  <div style={{ display: 'inline-flex', background: '#fff', borderRadius: 20, padding: '16px 24px', boxShadow: '0 10px 30px rgba(0,0,0,.18)' }}>
    <img src="/aion-logo-full.png" alt="Áion Edu" style={{ height: 62, display: 'block' }} />
  </div>
)

// ── Ícones do rodapé ────────────────────────────────────────────────────────
const IcWhats = () => <svg viewBox="0 0 24 24" width="30" height="30" fill="#fff"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.88 9.88 0 0 1 9.88 9.89c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41" /></svg>
const IcInsta = () => <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" /><circle cx="12" cy="12" r="4.3" /><circle cx="17.6" cy="6.4" r="1" fill="#fff" stroke="none" /></svg>
const IcSite = () => <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>

// Rodapé de contato completo: cartão translúcido do molde (slide 5).
export function Contatos({ compact }: { compact?: boolean }) {
  const item = (Icon: () => React.ReactElement, label: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, color: '#fff', fontWeight: 700, fontSize: compact ? 27 : 31, letterSpacing: '-.01em' }}>
      <span style={{ width: compact ? 52 : 60, height: compact ? 52 : 60, borderRadius: 16, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,168,150,.3)', flexShrink: 0 }}><Icon /></span>
      {label}
    </span>
  )
  return (
    <div style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 28, padding: compact ? '20px 30px' : '34px 44px', display: 'flex', flexDirection: compact ? 'row' : 'column', justifyContent: 'space-between', gap: compact ? 12 : 22 }}>
      {item(IcWhats, CONTATOS.whatsapp)}
      {item(IcInsta, CONTATOS.instagram)}
      {item(IcSite, CONTATOS.site)}
    </div>
  )
}

// Tela viva num iframe (isolada do CSS da arte, igual ao sistema), com a
// largura nativa (data-fit) reduzida pra caber na moldura.
// Tela que já é um documento HTML pronto (ex.: página pública da Vitrine).
export const RawHtml = (_: { html: string }) => null
export const doc = (el: React.ReactNode) => (React.isValidElement(el) && el.type === RawHtml) ? (el.props as any).html as string : '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>* { box-sizing: border-box; } html, body { margin: 0; background: transparent; } body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; color: #1A2B4A; }</style></head><body>' + renderToStaticMarkup(<>{el}</>) + '</body></html>'
export const frameStyle = (native: number): React.CSSProperties => ({ border: 0, width: native, maxWidth: 'none', height: 2400, display: 'block', position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', background: 'transparent' })
export const Fit = ({ native, children, maxh }: { native: number; children: React.ReactNode; maxh?: number }) => (
  <div data-fit={native} {...(maxh ? { 'data-maxh': maxh } : {})} style={{ position: 'relative', overflow: 'hidden' }}>
    <iframe srcDoc={doc(children)} scrolling="no" style={frameStyle(native)} />
  </div>
)
// Moldura de navegador do molde (BrowserFrame) com a tela viva dentro.
export const Frame = ({ native, children }: { native: number; children: React.ReactNode }) => (
  <div style={{ background: '#fff', borderRadius: 18, padding: 4, border: '1px solid #E5E7EB', boxShadow: '0 32px 72px rgba(0,48,31,.14)' }}>
    <div style={{ background: '#fff', borderRadius: 15, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#FF5F57', '#FFBD2E', '#28C840'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 6, padding: '3px 12px', fontSize: 11, color: '#9CA3AF' }}>aionedu.com.br</div>
      </div>
      <div data-anim-root><Fit native={native}>{children}</Fit></div>
    </div>
  </div>
)
// Recorte ampliado da tela pra capa: render.mjs centraliza o elemento cujo
// texto é data-focus (subindo data-up níveis) e aplica o zoom data-zoom.
export const Recorte = ({ children, focus, up = 0, zoom, native }: { children: React.ReactNode; focus: string; up?: number; zoom: number; native: number }) => (
  <div data-recorte data-focus={focus} data-up={up} data-zoom={zoom} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#f8f9fb' }}>
    <iframe srcDoc={doc(children)} scrolling="no" style={frameStyle(native)} />
  </div>
)

export function Slide({ n, total, bg, dark, children }: { n: number; total: number; bg: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <div className="slide" style={{ width: W, height: H, background: bg, position: 'relative', overflow: 'hidden', padding: '60px 80px', display: 'flex', flexDirection: 'column' }}>
      {dark && <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />}
      <div style={{ position: 'relative', zIndex: 2, marginBottom: 40 }}><Logo /></div>
      <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      <div style={{ position: 'absolute', left: 80, bottom: 40, zIndex: 3, fontSize: 20, fontWeight: 700, color: dark ? 'rgba(255,255,255,.6)' : '#6B7280', fontFamily: "'Bricolage Grotesque',sans-serif", letterSpacing: '.04em' }}>{n} / {total}</div>
    </div>
  )
}

// ── Carrossel de 4 ──────────────────────────────────────────────────────────
export interface Carrossel {
  icon: React.FC<any>
  s1: { title: string; hl: string; sub: string; recorte: { focus: string; up?: number; zoom: number } }
  s2: { title: string; hl: string; sub: string }
  s3: { title: string; hl?: string; pontos: { Icon: React.FC<any>; text: string }[] }
  tela: React.ReactElement; native: number
  phone?: number   // largura do celular na imagem 3 (tela de celular em vez do navegador)
  chrome?: boolean // desenha a moldura do celular (telas que não têm, ex.: página da Vitrine)
  maxh?: number    // altura máxima da tela no celular
  s4: { title: string; text: string; fecho: string }
}

export function makeCarrossel(c: Carrossel) {
  const Icon = c.icon
  const S1 = () => (
    <Slide n={1} total={4} bg={HERO_BG} dark>
      <h1 className="s-title" style={{ ...title(92, '#fff'), marginBottom: 28 }}><T text={c.s1.title} hl={c.s1.hl} /></h1>
      <p style={{ fontSize: 34, lineHeight: 1.5, color: 'rgba(255,255,255,.8)', marginBottom: 44 }}>{c.s1.sub}</p>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, margin: '0 -140px -60px 0', maxWidth: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '28px 0 0 0', overflow: 'hidden', border: '4px solid rgba(255,255,255,.14)', borderRight: 'none', borderBottom: 'none', boxShadow: '0 40px 80px rgba(0,0,0,.5)' }}>
          <Recorte focus={c.s1.recorte.focus} up={c.s1.recorte.up} zoom={c.s1.recorte.zoom} native={c.native}>{c.tela}</Recorte>
        </div>
        <div style={{ position: 'absolute', left: -80, right: 0, bottom: 0, height: 260, background: 'linear-gradient(180deg,rgba(0,48,31,0),#00301F 85%)', maxWidth: 'none' }} />
      </div>
    </Slide>
  )
  const S2 = () => (
    <Slide n={2} total={4} bg="#00301F" dark>
      <div style={{ position: 'absolute', width: 760, height: 760, borderRadius: '50%', background: 'radial-gradient(circle,rgba(219,39,119,.16),transparent 70%)', top: -300, right: -260, pointerEvents: 'none', zIndex: -1, maxWidth: 'none' }} />
      <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
        <div style={{ width: 120, height: 120, borderRadius: 30, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 36px rgba(0,168,150,.35)', marginBottom: 44 }}>
          <Icon size={58} color="#fff" />
        </div>
        <h2 className="s-title" style={{ ...title(104, '#fff'), marginBottom: 40 }}><T text={c.s2.title} hl={c.s2.hl} /></h2>
        <p style={{ fontSize: 38, lineHeight: 1.5, color: 'rgba(255,255,255,.8)' }}>{c.s2.sub}</p>
      </div>
    </Slide>
  )
  const S3 = () => (
    <Slide n={3} total={4} bg="#F4F7F5">
      <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(219,39,119,.08),transparent 70%)', top: -380, right: -300, pointerEvents: 'none', zIndex: -1, maxWidth: 'none' }} />
      <h2 className="s-title" style={{ ...title(84, '#111827'), marginBottom: 30 }}><T text={c.s3.title} hl={c.s3.hl} /></h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
        {c.s3.pontos.map((p, i) => (
          <div key={i} className="card" style={{ padding: '20px 26px', display: 'flex', gap: 22, alignItems: 'center' }}>
            <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 26, width: 56, height: 56, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#00523C', color: '#fff', flexShrink: 0 }}>{i + 1}</span>
            <p style={{ flex: 1, fontSize: 28, fontWeight: 600, color: '#111827', lineHeight: 1.35 }}>{p.text}</p>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: '#E6F7F5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <p.Icon size={28} color="#00523C" />
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, margin: '0 -24px 44px', maxWidth: 'none', overflow: 'hidden', borderRadius: 18 }}>
        {c.phone
          ? <div data-anim-root style={{ width: c.phone, margin: '0 auto', borderRadius: c.phone * 0.13, overflow: 'hidden', boxShadow: '0 32px 72px rgba(0,48,31,.22)', ...(c.chrome ? { border: '12px solid #111', background: '#111' } : {}) }}><Fit native={c.native} maxh={c.maxh}>{c.tela}</Fit></div>
          : <Frame native={c.native}>{c.tela}</Frame>}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, background: 'linear-gradient(180deg,rgba(244,247,245,0),#F4F7F5 85%)' }} />
      </div>
    </Slide>
  )
  const S4 = () => (
    <Slide n={4} total={4} bg={CTA_BG} dark>
      <div style={{ marginTop: 'auto' }} />
      <div style={{ background: '#fff', borderRadius: 32, padding: '50px 52px 54px', boxShadow: '0 28px 72px rgba(0,0,0,.22)', marginBottom: 26 }}>
        <h2 className="s-title" style={{ ...title(96, '#00523C'), marginBottom: 26 }}>{c.s4.title}</h2>
        <p style={{ fontSize: 34, color: '#374151', lineHeight: 1.5, marginBottom: 36 }}>{c.s4.text}</p>
        <span className="btn-g" style={{ fontSize: 26, padding: '22px 36px', lineHeight: 1.35, whiteSpace: 'normal' }}>{c.s4.fecho}</span>
      </div>
      <Contatos />
      <div style={{ marginBottom: 'auto', paddingBottom: 30 }} />
    </Slide>
  )
  return [S1, S2, S3, S4]
}

export const CARROSSEIS: Record<string, React.FC[]> = {
  A01: makeCarrossel({
    icon: Megaphone,
    s1: { title: 'Sua escola sabe qual anúncio trouxe cada matrícula?', hl: 'cada matrícula?', sub: 'A maioria das escolas investe em anúncios sem saber quais deram resultado.', recorte: { focus: 'Matrículas (1º toque)', up: 2, zoom: 1.75 } },
    s2: { title: 'Conheça a Captação Inteligente do Áion Edu', hl: 'Captação Inteligente do Áion Edu', sub: 'O sistema identifica automaticamente de qual anúncio veio cada família que chama a escola no WhatsApp.' },
    s3: { title: 'Como funciona', pontos: [
      { Icon: Link2, text: 'A escola cria um link para cada anúncio.' },
      { Icon: MessageCircle, text: 'A família clica e a conversa chega identificada.' },
      { Icon: BarChart3, text: 'O painel mostra conversas, interessados e matrículas de cada anúncio.' },
    ] },
    tela: <Dashboard />, native: 1280,
    s4: { title: 'O resultado', text: 'O gestor passa a investir nos anúncios que trazem matrículas e deixa de gastar com os que não trazem.', fecho: 'Fale com a nossa equipe e veja funcionando na sua escola.' },
  }),
  A02: makeCarrossel({
    icon: ClipboardList,
    s1: { title: 'Sua escola sabe quais famílias pretendem renovar a matrícula?', hl: 'renovar a matrícula?', sub: 'Muitas escolas só descobrem a saída do aluno quando a rematrícula não acontece.', recorte: { focus: '✅ Vai renovar (31)', up: 1, zoom: 2.1 } },
    s2: { title: 'Pesquisa de Satisfação do Áion Edu', hl: 'do Áion Edu', sub: 'A escola envia um link, e a família responde pelo celular, em poucos minutos e sem precisar de senha.' },
    s3: { title: 'O que o gestor recebe', hl: 'recebe', pontos: [
      { Icon: Star, text: 'A nota geral de satisfação das famílias.' },
      { Icon: ListChecks, text: 'A lista de quem vai renovar, quem está em dúvida e quem não pretende renovar.' },
      { Icon: FileText, text: 'Um relatório escrito pela inteligência artificial, com os pontos fortes, os pontos fracos e o que fazer.' },
    ] },
    tela: <Pesquisas />, native: 1100,
    s4: { title: 'O resultado', text: 'A escola conversa com as famílias em dúvida enquanto ainda há tempo de mantê-las.', fecho: 'Fale com a nossa equipe e veja funcionando na sua escola.' },
  }),
}

// ── Arte única A03 ──────────────────────────────────────────────────────────
export function A03() {
  const pontos = [
    { Icon: Moon, text: 'Nenhuma família fica sem resposta à noite ou no fim de semana.' },
    { Icon: ClipboardCheck, text: 'A equipe recebe a conversa com as informações já preenchidas.' },
    { Icon: Settings2, text: 'A própria escola configura o robô, sem precisar de programador.' },
  ]
  return (
    <div className="slide" style={{ width: W, height: H, background: HERO_BG, position: 'relative', overflow: 'hidden', padding: '56px 64px 40px', display: 'flex', flexDirection: 'column' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 2, marginBottom: 32 }}><Logo /></div>
      <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', gap: 30 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h1 className="s-title" style={{ ...title(58, '#fff'), marginBottom: 18 }}><T text="Atendimento automático no WhatsApp da escola, 24 horas por dia" hl="24 horas por dia" /></h1>
        <p style={{ fontSize: 22, lineHeight: 1.5, color: 'rgba(255,255,255,.82)', marginBottom: 20 }}>Quando a família envia uma mensagem fora do horário, o robô do Áion Edu responde na hora. Ele pergunta o nome do aluno e a série e encaminha a conversa para a pessoa certa da equipe.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pontos.map((p, i) => (
              <div key={i} className="card-dark" style={{ padding: '16px 18px', display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,168,150,.25)' }}>
                  <p.Icon size={28} color="#fff" />
                </div>
                <p style={{ fontSize: 21, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>{p.text}</p>
              </div>
            ))}
            <p style={{ fontSize: 23, fontWeight: 700, color: '#0DD3BF', lineHeight: 1.4, marginTop: 4 }}>Fale com a nossa equipe e veja funcionando na sua escola.</p>
          </div>
        </div>
        <div data-anim-root style={{ width: 440, flexShrink: 0, borderRadius: 56, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,.45)', alignSelf: 'flex-start' }}>
          <Fit native={430}><Robo /></Fit>
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 1, marginTop: 20 }}><Contatos compact /></div>
    </div>
  )
}
