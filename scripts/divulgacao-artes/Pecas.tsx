// =============================================================================
// scripts/divulgacao-artes/Pecas.tsx
//
// Monta as peças A04–A48 e os Reels R01–R32 no molde aprovado (Artes.tsx),
// com os textos EXATOS lidos do calendário por calendario.mjs (vêm como
// parâmetro; nada de texto de peça é escrito aqui). Este arquivo só define,
// por peça: qual tela do sistema entra, o trecho do título em destaque, os
// ícones e o enquadramento. A animação é feita por produzir.mjs.
// =============================================================================
import React from 'react'
import * as L from 'lucide-react'
import {
  makeCarrossel, Logo, Contatos, Fit, RawHtml, doc, frameStyle, T, title, HERO_BG, W, H,
} from './Artes'
import {
  WhatsApp, AgendarVisitaModal, Kanban, MotivoPerdaModal, GestorHome, FlowEditorTela, PlanoCampanha,
  DiagnosticoTransferencia, Celular, LeadCard, type Conv,
} from './TelasApp'
import { vitrineHtml, VITRINE_BLOCOS, TransmissaoTemplate, TransmissaoRevisao, TransmissaoTurmas, TransmissaoRespostas } from './TelasExtra'
import { ListaGatilhos, ModalGatilho, Dashboard as CaptacaoDashboard } from '../novidades-mockups/Mockups'
import { PermissoesUsuario } from './TelasDez'
import { AgendarMensagemModal, GestorHomeCelular } from './TelasDezExtra'
import { DetalheAtendente, Duplicados, PerfilEtiquetas, ChatInterno, SeletorUnidade, VitrineUltimasVagas } from './TelasJan'
import { Pesquisas } from './Telas'
import {
  ConfigWhatsApp, AtendenteHome, RelatorioMercado, SatisfacaoAtendimentos, HorariosMovimento, Relatorios, Contatos as ContatosTela, ImportarPlanilha,
  PesquisasLista, PesquisaPainel, TransferenciasLista, PesquisaFamilia, GeradorUpload, GeradorConfig, GeradorGerando,
} from './TelasNov'
import { VitrineModelos, VitrineCores, VitrineBlocos, OrigemVitrine, LembreteModal } from './TelasVitrine'
import { Publico, Detalhe } from '../novidades-mockups/MockupsTransmissoes'
export { SHARED_CSS } from '../../src/styles/sharedCSS'

// ── Tipos ───────────────────────────────────────────────────────────────────
export interface TxtCarrossel { tipo: 'carrossel'; telas: { title: string; text: string }[]; fecho: string }
export interface TxtUnica { tipo: 'unica'; title: string; explicacao: string; pontos: string[]; fecho: string | null }
export interface TxtReel { abertura: string; narracao: string[]; fecho: string }
// Enquadramento de uma tela: foco por texto exato ou por seletor ('@[data-focus]'),
// subindo `up` níveis, com zoom relativo ao encaixe na largura.
export interface Cam { focus?: string; up?: number; zoom?: number }
// Animação extra: alvos por seletor (página da Vitrine), rolagem e números automáticos.
export interface Extra { alvos?: { sel?: string; txt?: string; up?: number; t: number }[]; scroll?: { y: number; t0: number; t1: number }; autocount?: boolean }
export interface Tela { el: React.ReactElement; native: number; kind?: 'browser' | 'phone'; chrome?: boolean; cam?: Cam; extra?: Extra; maxh?: number }
export interface CfgCarrossel { hl: (string | undefined)[]; icon: React.FC<any>; icones: React.FC<any>[]; tela: Tela; recorte: Cam }
export interface CfgUnica { hl?: string; icones: React.FC<any>[]; tela: Tela }
export interface CfgReel { hl?: string; cenas: Tela[] }

// Moldura de navegador com câmera (recorte fixo pra caber legível na arte).
function Camera({ t, h }: { t: Tela; h?: number | string }) {
  return (
    <div data-stage data-native={t.native} data-focus-cam={t.cam?.focus ?? ''} data-up={t.cam?.up ?? 0} data-zoom={t.cam?.zoom ?? 1}
      data-extra={t.extra ? JSON.stringify(t.extra) : ''}
      style={{ position: 'relative', overflow: 'hidden', height: h ?? '100%', background: '#f8f9fb' }}>
      <iframe srcDoc={doc(t.el)} scrolling="no" style={frameStyle(t.native)} />
    </div>
  )
}
export function NavFrame({ t, h, dark }: { t: Tela; h?: number | string; dark?: boolean }) {
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: 4, border: dark ? '4px solid rgba(255,255,255,.14)' : '1px solid #E5E7EB', boxShadow: dark ? '0 40px 80px rgba(0,0,0,.45)' : '0 32px 72px rgba(0,48,31,.14)', height: h, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#fff', borderRadius: 15, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 14px', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <div style={{ display: 'flex', gap: 5 }}>{['#FF5F57', '#FFBD2E', '#28C840'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}</div>
          <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 6, padding: '3px 12px', fontSize: 11, color: '#9CA3AF' }}>aionedu.com.br</div>
        </div>
        <div data-anim-root style={{ flex: 1, minHeight: 0 }}><Camera t={t} /></div>
      </div>
    </div>
  )
}
export function PhoneFrame({ t, w }: { t: Tela; w: number }) {
  return (
    <div data-anim-root data-extra={t.extra ? JSON.stringify(t.extra) : ''} style={{ width: w, borderRadius: w * 0.13, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,.45)', ...(t.chrome ? { border: '12px solid #111', background: '#111' } : {}) }}>
      <Fit native={t.native} maxh={t.maxh}>{t.el}</Fit>
    </div>
  )
}

// ── Carrossel ───────────────────────────────────────────────────────────────
export function carrossel(txt: TxtCarrossel, cfg: CfgCarrossel) {
  const [t1, t2, t3, t4] = txt.telas
  const slides = makeCarrossel({
    icon: cfg.icon,
    s1: { title: t1.title, hl: cfg.hl[0] || '', sub: t1.text, recorte: { focus: cfg.recorte.focus || '@[data-focus]', up: cfg.recorte.up, zoom: cfg.recorte.zoom ?? 1.6 } },
    s2: { title: t2.title, hl: cfg.hl[1] || '', sub: t2.text },
    s3: { title: t3.title, hl: cfg.hl[2], pontos: t3.text.split(' / ').map((text, i) => ({ Icon: cfg.icones[i], text })) },
    tela: cfg.tela.el, native: cfg.tela.native,
    ...(cfg.tela.kind === 'phone' ? { phone: 400, chrome: cfg.tela.chrome, maxh: cfg.tela.maxh } : {}),
    s4: { title: t4.title, text: t4.text, fecho: txt.fecho },
  })
  // Imagem 3 com câmera (navegador) quando a peça pede enquadramento
  if (cfg.tela.kind !== 'phone' && cfg.tela.cam) {
    const S3orig = slides[2]
    slides[2] = () => <S3Cam txt={txt} cfg={cfg} fallback={S3orig} />
  }
  return slides
}
function S3Cam({ txt, cfg }: { txt: TxtCarrossel; cfg: CfgCarrossel; fallback: React.FC }) {
  const t3 = txt.telas[2]
  return (
    <div className="slide" style={{ width: W, height: H, background: '#F4F7F5', position: 'relative', overflow: 'hidden', padding: '60px 80px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(219,39,119,.08),transparent 70%)', top: -380, right: -300, pointerEvents: 'none', maxWidth: 'none' }} />
      <div style={{ position: 'relative', zIndex: 2, marginBottom: 40 }}><Logo /></div>
      <h2 className="s-title" style={{ ...title(84, '#111827'), marginBottom: 30, position: 'relative' }}><T text={t3.title} hl={cfg.hl[2]} /></h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32, position: 'relative' }}>
        {t3.text.split(' / ').map((p, i) => {
          const I = cfg.icones[i]
          return (
            <div key={i} className="card" style={{ padding: '20px 26px', display: 'flex', gap: 22, alignItems: 'center' }}>
              <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 26, width: 56, height: 56, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#00523C', color: '#fff', flexShrink: 0 }}>{i + 1}</span>
              <p style={{ flex: 1, fontSize: 28, fontWeight: 600, color: '#111827', lineHeight: 1.35 }}>{p}</p>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: '#E6F7F5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><I size={28} color="#00523C" /></div>
            </div>
          )
        })}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, margin: '0 -24px 44px' }}><NavFrame t={cfg.tela} h="100%" /></div>
      <div style={{ position: 'absolute', left: 80, bottom: 40, zIndex: 3, fontSize: 20, fontWeight: 700, color: '#6B7280', fontFamily: "'Bricolage Grotesque',sans-serif", letterSpacing: '.04em' }}>3 / 4</div>
    </div>
  )
}

// ── Arte única ──────────────────────────────────────────────────────────────
export function unica(txt: TxtUnica, cfg: CfgUnica): React.FC {
  const phone = cfg.tela.kind === 'phone'
  const Pontos = ({ cols }: { cols?: boolean }) => (
    <div style={{ display: cols ? 'grid' : 'flex', gridTemplateColumns: cols ? 'repeat(3,1fr)' : undefined, flexDirection: 'column', gap: 12 }}>
      {txt.pontos.map((p, i) => {
        const I = cfg.icones[i]
        return (
          <div key={i} className="card-dark" style={{ padding: cols ? '16px 16px' : '16px 18px', display: 'flex', flexDirection: cols ? 'column' : 'row', gap: cols ? 10 : 16, alignItems: cols ? 'flex-start' : 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,168,150,.25)' }}><I size={24} color="#fff" /></div>
            <p style={{ fontSize: cols ? 20 : 21, fontWeight: 600, color: '#fff', lineHeight: 1.35 }}>{p}</p>
          </div>
        )
      })}
    </div>
  )
  return () => (
    <div className="slide" style={{ width: W, height: H, background: HERO_BG, position: 'relative', overflow: 'hidden', padding: '56px 64px 40px', display: 'flex', flexDirection: 'column' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 2, marginBottom: 28 }}><Logo /></div>
      {phone ? (
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', gap: 30 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h1 className="s-title" style={{ ...title(58, '#fff'), marginBottom: 18 }}><T text={txt.title} hl={cfg.hl} /></h1>
            <p style={{ fontSize: 22, lineHeight: 1.5, color: 'rgba(255,255,255,.82)', marginBottom: 20 }}>{txt.explicacao}</p>
            <Pontos />
            {txt.fecho && <p style={{ fontSize: 23, fontWeight: 700, color: '#0DD3BF', lineHeight: 1.4, marginTop: 16 }}>{txt.fecho}</p>}
          </div>
          <div style={{ width: 440, flexShrink: 0, alignSelf: 'flex-start' }}><PhoneFrame t={cfg.tela} w={440} /></div>
        </div>
      ) : (
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <h1 className="s-title" style={{ ...title(62, '#fff'), marginBottom: 16 }}><T text={txt.title} hl={cfg.hl} /></h1>
          <p style={{ fontSize: 23, lineHeight: 1.5, color: 'rgba(255,255,255,.82)', marginBottom: 20 }}>{txt.explicacao}</p>
          <Pontos cols />
          {txt.fecho && <p style={{ fontSize: 23, fontWeight: 700, color: '#0DD3BF', lineHeight: 1.4, margin: '16px 0 18px' }}>{txt.fecho}</p>}
          <div style={{ flex: 1, minHeight: 0 }}><NavFrame t={cfg.tela} h="100%" dark /></div>
        </div>
      )}
      <div style={{ position: 'relative', zIndex: 1, marginTop: 20 }}><Contatos compact /></div>
    </div>
  )
}

// ── Reel 1080×1920: abertura 3 s · 4 cenas de 6 s · encerramento 3 s ────────
export function reel(txt: TxtReel, cfg: CfgReel): React.FC {
  return () => (
    <div className="slide reel" style={{ width: 1080, height: 1920, background: HERO_BG, position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      {/* abertura */}
      <div data-layer="0" style={{ position: 'absolute', inset: 0, padding: '80px 80px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ alignSelf: 'flex-start' }}><Logo /></div>
        <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <h1 className="s-title" style={{ ...title(104, '#fff') }}><T text={txt.abertura} hl={cfg.hl} /></h1>
        </div>
      </div>
      {/* cenas */}
      {cfg.cenas.map((t, i) => (
        <div key={i} data-layer={i + 1} style={{ position: 'absolute', inset: 0, padding: '70px 48px 0', display: 'flex', flexDirection: 'column', opacity: 0 }}>
          <div style={{ marginBottom: 34, alignSelf: 'flex-start' }}><Logo /></div>
          <div style={{ height: 1180, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            {t.kind === 'phone'
              ? <PhoneFrame t={t} w={600} />
              : <div style={{ width: '100%', height: '100%' }}><NavFrame t={t} h="100%" dark /></div>}
          </div>
          <div style={{ position: 'absolute', left: 48, right: 48, bottom: 110, background: 'rgba(0,30,20,.72)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 28, padding: '30px 38px', boxShadow: '0 20px 50px rgba(0,0,0,.35)' }}>
            <p style={{ fontSize: 42, lineHeight: 1.32, fontWeight: 600, color: '#fff' }}>{txt.narracao[i]}</p>
          </div>
        </div>
      ))}
      {/* encerramento */}
      <div data-layer="5" style={{ position: 'absolute', inset: 0, padding: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'stretch', gap: 60, opacity: 0, background: 'linear-gradient(135deg,#00523C 0%,#006B50 50%,#00A896 100%)' }}>
        <div style={{ alignSelf: 'center', transform: 'scale(1.35)' }}><Logo /></div>
        <h2 className="s-title" style={{ ...title(84, '#fff'), textAlign: 'center' }}>{txt.fecho}</h2>
        <Contatos />
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DAS PEÇAS (tela, destaque, ícones). Texto vem do calendário.
// ═════════════════════════════════════════════════════════════════════════════
const B = (el: React.ReactElement, native: number, cam?: Cam, extra?: Extra): Tela => ({ el, native, kind: 'browser', cam, extra })
const P = (el: React.ReactElement, native = 430, extra?: Extra, chrome?: boolean, maxh?: number): Tela => ({ el, native, kind: 'phone', extra, chrome, maxh })

// Conversas de exemplo (nomes fictícios)
const FILA: Conv[] = [
  { name: 'Mariana Costa', preview: 'Boa tarde! Ainda tem vaga para o Infantil?', time: '14:32', status: 'waiting', unread: 2 },
  { name: 'Rafael Souza', preview: 'Qual o valor da mensalidade do 6º ano?', time: '14:28', status: 'waiting', unread: 1 },
]
const MINHAS: Conv[] = [
  { name: 'Fernanda Lima', preview: 'Perfeito, obrigada!', time: '14:10', status: 'open', assigned: 'Ana Beatriz' },
  { name: 'Lucas Martins', preview: 'Vou conversar com meu marido e retorno.', time: '13:52', status: 'open', assigned: 'Ana Beatriz' },
  { name: 'Beatriz Nunes', preview: 'Vocês têm período integral?', time: '13:40', status: 'open', assigned: 'Ana Beatriz' },
]
const PARADAS = (hl?: number): Conv[] => [
  { name: 'Thiago Alves', preview: 'Gostaria de agendar uma visita', time: 'ontem', status: 'open', assigned: 'Bruno Lima', stale: 26, hl },
  { name: 'Renata Dias', preview: 'Vocês aceitam transferência no meio do ano?', time: 'ontem', status: 'open', assigned: 'Camila Rocha', stale: 31 },
  { name: 'Carlos Eduardo', preview: 'Qual o horário da secretaria?', time: 'seg', status: 'open', assigned: 'Patrícia Gomes', stale: 52 },
]
const MSGS_FILA = [
  { text: 'Boa tarde! Ainda tem vaga para o Infantil 5 em 2027?', time: '14:31' },
  { text: 'Minha filha tem 4 anos.', time: '14:32' },
]

export const ARTES: Record<string, (txt: any) => React.FC | React.FC[]> = {
  A04: txt => carrossel(txt, {
    hl: ['perde matrículas?', 'do Áion Edu'], icon: L.UserX, icones: [L.UserX, L.ListChecks, L.BarChart3],
    tela: B(<Kanban cols={[
      { st: 'contact', cards: [{ resp: 'Fernanda Lima', aluno: 'Sofia', serie: '1º ano', origem: 'Instagram', temp: 'quente', atd: 'AB' }, { resp: 'Beatriz Nunes', aluno: 'Davi', serie: '6º ano', origem: 'Google', temp: 'morno', atd: 'CR' }] },
      { st: 'scheduled', cards: [{ resp: 'Thiago Alves', aluno: 'Helena', serie: 'Infantil 4', origem: 'Indicação', temp: 'quente', atd: 'BL' }] },
      { st: 'visit', cards: [{ resp: 'Renata Dias', aluno: 'Miguel', serie: '3º ano', origem: 'WhatsApp', temp: 'morno', atd: 'AB' }] },
      { st: 'lost', cards: [{ resp: 'Carlos Eduardo', aluno: 'Laura', serie: '2º ano', origem: 'Site', perdido: 'Valor da mensalidade alto' }] },
    ]} modal={<MotivoPerdaModal aluno="Lucas" resp="Lucas Martins" sel={2} selAt={2.2} inAt={0.5} />} />, 1280, { focus: 'Por que este lead foi perdido?', up: 3, zoom: 1.05 }),
    recorte: { focus: 'Por que este lead foi perdido?', up: 2, zoom: 1.45 },
  }),
  A05: txt => carrossel(txt, {
    hl: ['até a matrícula?', 'Vitrine do Áion Edu'], icon: L.Store, icones: [L.Image, L.MessageCircle, L.Palette],
    tela: P(<RawHtml html={vitrineHtml()} />, 390, { alvos: [{ sel: '.cta', t: 1.0 }], scroll: { y: 560, t0: 3.2, t1: 5.6 } }, true, 690),
    recorte: { focus: 'Matrículas 2027 abertas', up: 1, zoom: 1.7 },
  }),
  A06: txt => unica(txt, {
    hl: 'no WhatsApp da escola', icones: [L.BellRing, L.UserCheck, L.Timer],
    tela: B(<WhatsApp minhas={MINHAS.slice(0, 2)} paradas={PARADAS(1.2)} chat={{ name: 'Thiago Alves', phone: '+55 83 90000-2301', status: 'open', banner: 'parada', era: 'Bruno Lima', horas: 26, msgs: [{ text: 'Bom dia! Gostaria de agendar uma visita para conhecer a escola.', time: 'ontem 11:02' }, { text: 'Pode ser na próxima semana?', time: 'ontem 11:03' }] }} height={560} width={1000} />, 1000, { zoom: 1 }),
  }),
  A07: txt => carrossel(txt, {
    hl: ['meta de matrículas?', 'com inteligência artificial'], icon: L.Sparkles, icones: [L.CalendarDays, L.Star, L.SlidersHorizontal],
    tela: B(<PlanoCampanha />, 1160, { zoom: 1 }),
    recorte: { focus: 'Out/2026★', zoom: 1.9 },
  }),
  A08: txt => unica(txt, {
    hl: 'da equipe de atendimento', icones: [L.Award, L.LifeBuoy, L.BarChart3],
    tela: B(<GestorHome show={['kpis', 'ranking']} width={960} />, 960, { zoom: 1 }),
  }),
  A09: txt => carrossel(txt, {
    hl: ['o motivo real?', 'do Áion Edu'], icon: L.Sparkles, icones: [L.Send, L.Smartphone, L.Target],
    tela: B(<DiagnosticoTransferencia />, 760),
    recorte: { focus: 'Oportunidade de retenção', up: 2, zoom: 1.55 },
  }),
  // ── Novembro ──────────────────────────────────────────────────────────────
  A10: txt => carrossel(txt, {
    hl: ['bem divididas na sua equipe?', 'automática de conversas'], icon: L.Shuffle, icones: [L.Users, L.Repeat, L.Coffee],
    tela: B(<ConfigWhatsApp secao="Equipe" grupoNovoAt={1.2} focus={{ almoco: 3.4 }} />, 1100, { focus: 'Grupos de Atendimento', up: 2, zoom: 1 }),
    recorte: { focus: 'Grupos de Atendimento', up: 2, zoom: 1.1 },
  }),
  A11: txt => unica(txt, {
    hl: 'a posição da sua escola na cidade', icones: [L.Trophy, L.PieChart, L.Target],
    tela: B(<RelatorioMercado focus={{ faltam: 1.6 }} />, 900, { zoom: 1 }),
  }),
  A12: txt => unica(txt, {
    hl: 'famílias interessadas', icones: [L.AlertCircle, L.UserCheck, L.CheckCircle2],
    tela: B(<AtendenteHome focus={{ atrasado: 1.8 }} />, 1100, { focus: 'Meus lembretes', up: 3, zoom: 1 }),
  }),
  A13: txt => unica(txt, {
    hl: 'no WhatsApp da escola', icones: [L.Timer, L.Users, L.Zap],
    tela: B(<GestorHome show={['kpis', 'ranking']} focus={{ tempo: 1.4 }} width={960} />, 960, { focus: '@[data-focus]', zoom: 1 }),
  }),
  A14: txt => unica(txt, {
    hl: 'planilha de contatos da escola', icones: [L.Columns3, L.GitMerge, L.ListChecks],
    tela: B(<ImportarPlanilha />, 900, { focus: 'Colunas da planilha', up: 1, zoom: 1 }),
  }),
  A15: txt => unica(txt, {
    hl: 'alcançar a meta', icones: [L.CalendarClock, L.TrendingUp, L.Compass],
    tela: B(<Relatorios aba="Visão Geral" focus={{ velocidade: 1.8 }} />, 1180, { focus: '@[data-focus]', zoom: 1 }),
  }),
  A16: txt => carrossel(txt, {
    hl: ['da sua secretaria?', 'no WhatsApp'], icon: L.Star, icones: [L.Smile, L.LayoutDashboard, L.UserCheck],
    tela: B(<SatisfacaoAtendimentos />, 520, { zoom: 1 }),
    recorte: { focus: 'Satisfação dos Atendimentos', up: 3, zoom: 1.35 },
  }),
  A17: txt => unica(txt, {
    hl: 'quem chega por um anúncio', icones: [L.Zap, L.UserCheck, L.Megaphone],
    tela: B(<ModalGatilho />, 800, { focus: 'Pular o robô de atendimento', up: 3, zoom: 1 }, { alvos: [{ txt: 'Pular o robô de atendimento', up: 3, t: 1.0 }, { txt: 'Distribuir para (round-robin)', up: 1, t: 3.2 }] }),
  }),
  A18: txt => unica(txt, {
    hl: 'em um único lugar', icones: [L.Search, L.History, L.BookUser],
    tela: B(<ContatosTela focus={{ kpis: 1.4, filtros: 3.4 }} />, 1180, { zoom: 1 }),
  }),
  A19: txt => unica(txt, {
    hl: 'mais procuram a escola', icones: [L.Clock, L.CalendarDays, L.Timer],
    tela: B(<HorariosMovimento />, 760, { zoom: 1 }),
  }),
  A20: txt => unica(txt, {
    hl: 'no mesmo cadastro da família', icones: [L.MessageCircle, L.Users, L.CopyMinus],
    tela: B(<Kanban cols={[
      { st: 'new', cards: [{ resp: 'Juliana Prado', aluno: 'Alice', serie: 'Infantil 5', origem: 'Instagram', atd: 'AB' }] },
      { st: 'contact', cards: [{ resp: 'Fernanda Lima', aluno: 'Sofia', serie: '1º ano', origem: 'Indicação', temp: 'quente', atd: 'AB', fone: '(83) 90000-1104', focus: 1.4, irmaos: [{ nome: 'Sofia', dec: 'open' }, { nome: 'Pedro', dec: 'open' }, { nome: 'Lia', dec: 'open' }] }] },
      { st: 'scheduled', cards: [{ resp: 'Thiago Alves', aluno: 'Helena', serie: 'Infantil 4', origem: 'Indicação', atd: 'BL' }] },
      { st: 'visit', cards: [{ resp: 'Renata Dias', aluno: 'Miguel', serie: '3º ano', origem: 'Google', atd: 'CR' }] },
    ]} />, 1280, { focus: 'Fernanda Lima', up: 4, zoom: 1.35 }),
  }),
  A21: txt => carrossel(txt, {
    hl: ['quem leu o último comunicado?', 'Transmissões do Áion Edu'], icon: L.Send, icones: [L.CheckCheck, L.Eye, L.MousePointerClick],
    tela: B(<Detalhe />, 1100, { zoom: 1 }, { autocount: true }),
    recorte: { focus: 'Lidas', up: 2, zoom: 1.15 },
  }),
  A22: txt => unica(txt, {
    hl: 'que chega à escola', icones: [L.Calculator, L.AlertTriangle, L.PiggyBank],
    tela: B(<Relatorios aba="Marketing & CPA" focus={{ alerta: 1.6 }} />, 1180, { focus: '@[data-focus]', zoom: 1 }),
  }),
  A23: txt => unica(txt, {
    hl: 'que pararam de responder', icones: [L.Hourglass, L.MousePointerClick, L.ShieldCheck],
    tela: B(<WhatsApp minhas={[{ name: 'Lucas Martins', preview: 'Vou conversar com meu marido e retorno.', time: 'seg', status: 'open', assigned: 'Ana Beatriz', active: true }, ...MINHAS.slice(0, 1)]} chat={{ name: 'Lucas Martins', phone: '+55 83 90000-1103', status: 'open', expirada: true, pressReativar: 3.0, msgs: [{ text: 'Qual o valor da mensalidade do 2º ano?', time: 'seg 10:12' }, { me: true, sender: 'Ana Beatriz', text: 'Olá, Lucas! Te enviei a tabela de 2027. Posso agendar uma visita?', time: 'seg 10:20' }, { text: 'Vou conversar com meu marido e retorno.', time: 'seg 10:41' }] }} painel={{ atendente: 'Ana Beatriz', expirada: true }} width={1100} height={470} />, 1100, { zoom: 1 }),
  }),
  A24: txt => unica(txt, {
    hl: 'já vêm identificadas', icones: [L.UserPlus, L.Tag, L.BarChart3],
    tela: B(<OrigemVitrine cardEl={<LeadCard st="new" c={{ resp: 'Juliana Prado', aluno: 'Alice', serie: 'Infantil 5', origem: 'Vitrine', fone: '(83) 90000-3307', in: 1.2, focus: 2.2 }} />} />, 1000, { zoom: 1 }),
  }),
  // ── Dezembro ──────────────────────────────────────────────────────────────
  A25: txt => unica(txt, {
    hl: 'em dúvida sobre a rematrícula', icones: [L.Filter, L.FileText, L.PhoneCall],
    tela: B(<Pesquisas talvez={1.8} />, 1100, { zoom: 1 }),
  }),
  A26: txt => unica(txt, {
    hl: 'da campanha de matrículas', icones: [L.Gauge, L.RefreshCw, L.Target],
    tela: B(<Relatorios aba="Visão Geral" focus={{ saude: 1.6 }} fim="31/01/2027" dias={53} semanas={8} faltam={14} />, 1180, { focus: '@[data-focus]', zoom: 1 }),
  }),
  A27: txt => unica(txt, {
    hl: 'de cada família no atendimento', icones: [L.Repeat, L.MessageCircle, L.Lock],
    tela: B(<WhatsApp minhas={[{ name: 'Mariana Costa', preview: 'Sábado às 10h está ótimo!', time: '11:20', status: 'open', assigned: 'Camila Rocha', active: true }, ...MINHAS.slice(0, 2)]} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: [{ text: 'Bom dia! A Alice pode fazer uma aula experimental?', time: '11:12' }, { me: true, sender: 'Camila Rocha', text: 'Bom dia, Mariana! Pode sim. Vi aqui que vocês preferem sábado pela manhã. Sábado às 10h fica bom?', time: '11:15' }, { text: 'Sábado às 10h está ótimo!', time: '11:20' }] }} painel={{ atendente: 'Camila Rocha', lead: { nome: 'Mariana Costa', aluno: 'Alice', serie: 'Infantil 5', status: 'Visita Agendada', origem: 'Instagram' }, notas: [{ texto: 'Família prefere visitas aos sábados pela manhã.', autor: 'Ana Beatriz Lima', quando: '08/12/26, 10:12' }, { texto: 'Alice tem um irmão no 3º ano. Mãe perguntou sobre desconto para irmãos.', autor: 'Ana Beatriz Lima', quando: '09/12/26, 15:40', in: 1.4 }], notasFocus: 2.2 }} width={1100} height={720} />, 1100, { focus: 'Notas Internas (2)', up: 2, zoom: 1.05 }),
  }),
  A28: txt => unica(txt, {
    hl: 'durante o recesso escolar', icones: [L.Inbox, L.PenLine, L.ListOrdered],
    tela: P(<Celular hora="21:32" dia="22 DE DEZEMBRO" msgs={RECESSO} altura={900} />),
  }),
  A29: txt => carrossel(txt, {
    hl: ['o relatório do mês?', 'com inteligência artificial'], icon: L.Sparkles, icones: [L.FileText, L.Filter, L.ListChecks],
    tela: B(<Relatorios aba="Diagnóstico IA" gerarAt={1.6} />, 1180, { focus: 'Diagnóstico IA — Dezembro/2026', up: 3, zoom: 1 }),
    recorte: { focus: 'Histórico', up: 2, zoom: 0.85 },
  }),
  A30: txt => unica(txt, {
    hl: 'cada pessoa da equipe', icones: [L.LayoutGrid, L.BarChart3, L.Headphones],
    tela: B(<PermissoesUsuario desligaAt={2.2} />, 760, { focus: '@[data-focus]', zoom: 1 }),
  }),
  // A31 — agendamento: a atendente escolhe o template aprovado, preenche o
  // nome e agenda; a mensagem entra em "Mensagens Agendadas" da conversa.
  A31: txt => unica(txt, {
    hl: 'no WhatsApp da escola', icones: [L.CalendarClock, L.ListChecks, L.BellRing],
    tela: B(<WhatsApp minhas={[{ name: 'Mariana Costa', preview: 'Combinado, aguardo o contato em janeiro!', time: '16:05', status: 'open', assigned: 'Camila Rocha', active: true }, ...MINHAS.slice(0, 2)]}
      chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: [
        { text: 'Boa tarde! Vocês ainda têm vaga no Infantil 5 para 2027?', time: '15:48' },
        { me: true, sender: 'Camila Rocha', text: 'Boa tarde, Mariana! Temos sim. Entramos em recesso dia 23, posso te chamar no dia 5 de janeiro para agendar a visita?', time: '15:56' },
        { text: 'Combinado, aguardo o contato em janeiro!', time: '16:05' },
      ] }}
      painel={{ atendente: 'Camila Rocha', agendadas: [
        { nome: 'confirmacao_visita', quando: '18/12/2026, 09:00' },
        { nome: 'retorno_recesso', quando: '05/01/2027, 08:30', in: 2.9, focus: 3.3 },
      ] }}
      modal={<AgendarMensagemModal />} width={1100} height={720} />, 1100, { focus: 'Mensagens Agendadas (2)', up: 2, zoom: 1.05 }),
  }),
  A32: txt => unica(txt, {
    hl: 'no painel do gestor', icones: [L.BellRing, L.MousePointerClick, L.Zap],
    tela: B(<GestorHome show={['header', 'alerts', 'kpis']} focus={{ alerts: 1.4 }} width={1000} alertas={ALERTAS} />, 1000, { focus: '@[data-focus]', zoom: 1 }),
  }),
  A33: txt => natal(txt),
  A34: txt => unica(txt, {
    hl: 'das rematrículas da escola', icones: [L.UserCheck, L.Clock, L.Percent],
    tela: B(<Relatorios aba="Rematrículas" focus={{ kpis: 1.6 }} />, 1180, { focus: '@[data-focus]', zoom: 1 }),
  }),
  A35: txt => unica(txt, {
    hl: 'em internos e externos', icones: [L.ListOrdered, L.Wrench, L.CalendarRange],
    tela: B(<Relatorios aba="Transferências" focus={{ internos: 1.8 }} />, 1180, { focus: 'Recusas (Pareto)', up: 3, zoom: 1 }),
  }),
  // ── Janeiro ───────────────────────────────────────────────────────────────
  A37: txt => unica(txt, {
    hl: 'quando a atendente está ausente', icones: [L.Users, L.UserCheck, L.PlayCircle],
    tela: B(<WhatsApp minhas={MINHAS.slice(0, 1)} paradas={PARADAS(0.6)} chat={{ name: 'Thiago Alves', phone: '+55 83 90000-2301', status: 'open', banner: 'parada', era: 'Bruno Lima', horas: 26, bannerOut: 3.2, pressResgatar: 2.8, msgs: [{ text: 'Bom dia! Gostaria de agendar uma visita para conhecer a escola.', time: 'ontem 11:02' }, { text: 'Pode ser na próxima semana?', time: 'ontem 11:03' }] }} painel={{ atendente: 'Bruno Lima', transfer: { to: 'Ana Beatriz', at: 3.2 } }} width={1100} height={560} />, 1100, { zoom: 1 }),
  }),
  A38: txt => carrossel(txt, {
    hl: ['perde mais famílias?', 'das etapas de matrícula'], icon: L.Filter, icones: [L.Target, L.AlertTriangle, L.RefreshCw],
    tela: B(<Relatorios aba="Funil" focus={{ baixa: 1.8 }} fim="31/01/2027" />, 1180, { focus: 'Funil de Vendas', up: 2, zoom: 1 }),
    recorte: { focus: 'Agendamentos', up: 3, zoom: 0.95 },
  }),
  A39: txt => unica(txt, {
    hl: 'com várias unidades', icones: [L.Phone, L.Users, L.BarChart3],
    tela: P(<Celular hora="09:15" msgs={UNIDADES} altura={900} />),
  }),
  A40: txt => unica(txt, {
    hl: 'pelo WhatsApp', icones: [L.CalendarCheck, L.Send, L.ClipboardCheck],
    tela: P(<Celular hora="08:00" msgs={[
      { text: 'Olá, Mariana! Sua visita ao Colégio Horizonte está confirmada para 16/01, às 10:00. Até lá!', time: '14/01 15:05', in: 0.6, template: true },
      { text: 'Bom dia, Mariana! Lembrete: hoje, às 10:00, é a sua visita ao Colégio Horizonte. Esperamos você!', time: '08:00', in: 2.4, focus: 3.2 },
    ]} altura={900} />),
  }),
  A41: txt => unica(txt, {
    hl: 'nos contatos', icones: [L.Tags, L.Filter, L.LayoutList],
    tela: B(<PerfilEtiquetas novaAt={1.4} />, 640, { focus: 'Etiquetas', up: 2, zoom: 1 }),
  }),
  A42: txt => unica(txt, {
    hl: 'para a equipe da escola', icones: [L.MessagesSquare, L.ShieldCheck, L.Inbox],
    tela: B(<ChatInterno />, 1000, { zoom: 1 }),
  }),
  A43: txt => unica(txt, {
    hl: 'que haviam desistido', icones: [L.RotateCcw, L.History, L.CalendarPlus],
    tela: B(<Kanban cols={[
      { st: 'contact', cards: [{ resp: 'Fernanda Lima', aluno: 'Sofia', serie: '1º ano', origem: 'Instagram', temp: 'quente', atd: 'AB' }] },
      { st: 'scheduled', cards: [{ resp: 'Thiago Alves', aluno: 'Helena', serie: 'Infantil 4', origem: 'Indicação', atd: 'BL' }] },
      { st: 'visit', cards: [{ resp: 'Renata Dias', aluno: 'Miguel', serie: '3º ano', origem: 'Google', atd: 'CR' }] },
      { st: 'lost', cards: [{ resp: 'Carlos Eduardo', aluno: 'Laura', serie: '2º ano', origem: 'Site', perdido: 'Valor da mensalidade alto', focusReabrir: 1.4 }, { resp: 'Lucas Martins', aluno: 'Pedro', serie: '2º ano', origem: 'Google', perdido: 'Escolheu outra escola' }] },
    ]} />, 1280, { focus: 'Carlos Eduardo', up: 4, zoom: 1.3 }),
  }),
  A44: txt => unica(txt, {
    hl: 'redes de escolas', icones: [L.KeyRound, L.BarChart3, L.Network],
    tela: B(<SeletorUnidade abreAt={1.2} />, 900, { zoom: 1 }),
  }),
  A45: txt => unica(txt, {
    hl: 'em PDF', icones: [L.CalendarRange, L.Share2, L.Presentation],
    tela: B(<GestorHome show={['header', 'alerts', 'kpis']} alertas={ALERTAS} focus={{ pdf: 1.4 }} width={1000} />, 1000, { zoom: 1 }),
  }),
  A46: txt => unica(txt, {
    hl: 'e a matrícula', icones: [L.Hash, L.Hourglass, L.TrendingUp],
    tela: B(<Relatorios aba="Diagnóstico IA" focus={{ tempo: 1.4 }} fim="31/01/2027" mes="Janeiro/2027" gerado="21/01/2027" hist={['Dezembro/2026', 'Novembro/2026']} />, 1180, { focus: '@[data-focus]', zoom: 1 }),
  }),
  A47: txt => unica(txt, {
    hl: 'contatos duplicados', icones: [L.Database, L.MessageSquareOff, L.UserCheck],
    tela: B(<Duplicados selAt={1.6} />, 860, { focus: '@[data-focus]', zoom: 1 }),
  }),
  A48: txt => carrossel(txt, {
    hl: ['o ano letivo organizada?', 'em um só lugar'], icon: L.LayoutDashboard, icones: [L.MessageCircle, L.Users, L.Sparkles],
    tela: B(<Composicao />, 1280, { zoom: 1 }),
    recorte: { focus: '@[data-recorte-alvo]', zoom: 1.2 },
  }),
  A36: txt => unica(txt, {
    hl: 'a reta final das matrículas', icones: [L.Target, L.CalendarClock, L.TrendingUp],
    tela: B(<Relatorios aba="Visão Geral" focus={{ kpis: 1.4, dias: 2.8 }} fim="31/01/2027" dias={30} semanas={4} faltam={8} />, 1180, { zoom: 1 }),
  }),
}

// Mensagens do robô no recesso (A28/R21): texto de exemplo escrito pela escola
const RECESSO = [
  { me: true, text: 'Boa noite! Queria saber sobre matrícula para 2027.', time: '21:32', in: 0.4 },
  { text: 'Olá! A secretaria do Colégio Horizonte está em recesso de 21/12 a 05/01. Sua mensagem foi registrada e a equipe responde a partir de 06/01. Enquanto isso, escolha uma opção:', time: '21:32', in: 1.4, botoes: ['Matrículas 2027', 'Rematrícula', 'Outros assuntos'] },
  { me: true, text: 'Matrículas 2027', time: '21:33', in: 3.0 },
  { text: 'Perfeito! Qual o nome do aluno e a série de interesse?', time: '21:33', in: 3.8 },
]
const ALERTAS = [
  { type: 'warning' as const, msg: '12 leads sem contato há mais de 5 dias', action: 'Ver leads' },
  { type: 'warning' as const, msg: 'Cadastros 54% da meta — intensifique captação', action: 'Ver funil' },
  { type: 'success' as const, msg: 'Score 78 — escola com desempenho acima da média!' },
]

// A33 — Natal: arte institucional no molde, sem tela do sistema e sem fecho comercial
function natal(txt: TxtUnica): React.FC {
  const pontos = Array.from({ length: 46 }, (_, i) => ({ x: (i * 197) % 1080, y: (i * 331) % 1350, r: 2 + (i % 4), o: 0.12 + (i % 5) * 0.06 }))
  return () => (
    <div className="slide" style={{ width: W, height: H, background: HERO_BG, position: 'relative', overflow: 'hidden', padding: '64px 72px', display: 'flex', flexDirection: 'column' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', maxWidth: 'none' }}>
        {pontos.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#fff" opacity={p.o} />)}
      </svg>
      <div style={{ position: 'relative', zIndex: 2 }}><Logo /></div>
      <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto', marginBottom: 'auto' }}>
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#0DD3BF" strokeWidth="1.2" strokeLinecap="round" style={{ marginBottom: 36 }}>
          {[0, 60, 120].map(a => <line key={a} x1="12" y1="2" x2="12" y2="22" transform={`rotate(${a} 12 12)`} />)}
          {[0, 60, 120, 180, 240, 300].map(a => <path key={a} d="M12 5 L10 3 M12 5 L14 3" transform={`rotate(${a} 12 12)`} />)}
        </svg>
        <h1 className="s-title" style={{ ...title(104, '#fff'), marginBottom: 36 }}><span style={{ color: '#0DD3BF' }}>Feliz Natal</span>{txt.title.slice('Feliz Natal'.length)}</h1>
        <p style={{ fontSize: 36, lineHeight: 1.5, color: 'rgba(255,255,255,.88)', maxWidth: 900 }}>{txt.explicacao}</p>
      </div>
    </div>
  )
}

// Extras de animação das artes cuja tela entra pelo molde (sem data-extra)
export const EXTRAS: Record<string, Extra> = {
  A05: { alvos: [{ sel: '.cta', t: 1.0 }], scroll: { y: 560, t0: 3.2, t1: 5.6 } },
}

export const REELS: Record<string, (txt: TxtReel) => React.FC> = {
  R01: txt => reel(txt, { hl: 'em um único celular?', cenas: [
    B(<WhatsApp fila={FILA} minhas={MINHAS} chat={{ name: 'Fernanda Lima', phone: '+55 83 90000-1104', status: 'open', msgs: [{ text: 'Oi! Queria saber sobre o período integral.', time: '14:05', in: 0.4 }, { me: true, sender: 'Ana Beatriz', text: 'Olá, Fernanda! Temos integral do Infantil ao 5º ano. Posso te mandar os horários?', time: '14:07', in: 1.6 }, { text: 'Perfeito, obrigada!', time: '14:10', in: 3.0 }] }} painel={{ atendente: 'Ana Beatriz' }} />, 1280),
    B(<WhatsApp fila={[{ ...FILA[0], active: true }, FILA[1]]} minhas={MINHAS.slice(0, 2)} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'waiting', banner: 'fila', bannerOut: 3.4, pressAssumir: 3.0, msgs: MSGS_FILA }} painel={{ atendenteIn: { name: 'Ana Beatriz', at: 3.4 } }} />, 1280, { focus: '⏳ Conversa aguardando atendimento', up: 2, zoom: 1.1 }),
    B(<WhatsApp minhas={MINHAS.slice(0, 2)} paradas={PARADAS(0.8)} chat={{ name: 'Thiago Alves', phone: '+55 83 90000-2301', status: 'open', banner: 'parada', era: 'Bruno Lima', horas: 26, msgs: [{ text: 'Bom dia! Gostaria de agendar uma visita para conhecer a escola.', time: 'ontem 11:02' }] }} />, 1280, { focus: '@[data-focus]', zoom: 1.2 }),
    B(<GestorHome show={['kpis', 'ranking']} focus={{ ranking: 2.2 }} width={960} />, 960, { focus: '@[data-focus]', zoom: 0.56 }),
  ] }),
  R02: txt => reel(txt, { hl: 'da sua escola hoje?', cenas: [
    B(<GestorHome show={['header', 'alerts', 'kpis']} width={1000} />, 1000, { zoom: 1 }),
    B(<GestorHome show={['kpis']} focus={{ kpis: 2.6 }} width={760} />, 760, { zoom: 0.6 }),
    B(<GestorHome show={['alerts']} focus={{ alerts: 1.6 }} width={760} alertas={[{ type: 'warning', msg: '12 leads sem contato há mais de 5 dias', action: 'Ver leads' }, { type: 'warning', msg: 'Cadastros 54% da meta — intensifique captação', action: 'Ver funil' }, { type: 'success', msg: 'Score 78 — escola com desempenho acima da média!' }]} />, 760, { zoom: 1 }),
    B(<GestorHome show={['ranking', 'ia']} focus={{ ia: 3.2 }} width={960} />, 960, { zoom: 0.6 }),
  ] }),
  R03: txt => reel(txt, { hl: 'sem programador', cenas: [
    B(<FlowEditorTela ativo={false} menuIn={99} perguntaIn={99} transferIn={99} />, 1280, { focus: 'Início do fluxo', up: 1, zoom: 1 }),
    B(<FlowEditorTela ativo={false} menuIn={1.0} perguntaIn={99} transferIn={99} />, 1280, { focus: 'Sobre o que você quer falar?', up: 2, zoom: 1 }),
    B(<FlowEditorTela ativo={false} menuIn={0} perguntaIn={1.0} transferIn={99} />, 1280, { focus: 'Qual o nome do aluno e a série de interesse?', up: 2, zoom: 1 }),
    B(<FlowEditorTela menuIn={0} perguntaIn={0} transferIn={0.8} ativoAt={3.4} />, 1280, { zoom: 1 }),
  ] }),
  R04: txt => reel(txt, { hl: 'cada família', cenas: [
    B(<ListaGatilhos />, 1280, { zoom: 0.62 }),
    P(<Celular hora="20:14" msgs={[{ me: true, text: 'Olá! Vi o anúncio e quero saber sobre matrícula no Infantil 2027', time: '20:14', in: 3.2 }]} digitando={{ text: 'Olá! Vi o anúncio e quero saber sobre matrícula no Infantil 2027', t0: 0.6, t1: 0.61, out: 3.1 }} altura={820} />),
    B(<WhatsApp fila={[{ name: 'Juliana Prado', preview: 'Olá! Vi o anúncio e quero saber sobre...', time: '20:14', status: 'waiting', captacao: 'Matrículas 2027 — Infantil', unread: 1, active: true }, FILA[1]]} minhas={MINHAS.slice(0, 2)} chat={{ name: 'Juliana Prado', phone: '+55 83 90000-3307', status: 'waiting', captacao: { name: 'Matrículas 2027 — Infantil', canal: 'Meta Ads' }, msgs: [{ text: 'Olá! Vi o anúncio e quero saber sobre matrícula no Infantil 2027', time: '20:14', in: 0.4 }] }} />, 1280, { zoom: 0.66 }),
    B(<Kanban cols={[
      { st: 'new', cards: [{ resp: 'Juliana Prado', aluno: 'Alice', serie: 'Infantil 5', origem: 'Instagram', atd: 'AB', in: 0.9, focus: 1.8 }, { resp: 'Rafael Souza', aluno: 'Enzo', serie: '6º ano', origem: 'WhatsApp', temp: 'morno' }] },
      { st: 'contact', cards: [{ resp: 'Fernanda Lima', aluno: 'Sofia', serie: '1º ano', origem: 'Instagram', temp: 'quente', atd: 'AB' }] },
      { st: 'scheduled', cards: [{ resp: 'Thiago Alves', aluno: 'Helena', serie: 'Infantil 4', origem: 'Indicação', temp: 'quente', atd: 'BL' }] },
      { st: 'visit', cards: [{ resp: 'Renata Dias', aluno: 'Miguel', serie: '3º ano', origem: 'Google', atd: 'CR' }] },
    ]} />, 1280, { focus: '@[data-focus]', zoom: 1.1 }),
  ] }),
  R05: txt => reel(txt, { hl: 'sem sair do WhatsApp', cenas: [
    B(<WhatsApp minhas={[{ name: 'Mariana Costa', preview: 'Vocês fazem visita?', time: '15:02', status: 'open', assigned: 'Ana Beatriz', active: true }, ...MINHAS.slice(0, 2)]} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: [{ text: 'Boa tarde! Gostaria de conhecer a escola. Vocês fazem visita?', time: '15:02', in: 0.6 }] }} painel={{ atendente: 'Ana Beatriz', lead: { nome: 'Mariana Costa', aluno: 'Alice', serie: 'Infantil 5', status: 'Em Contato', origem: 'Instagram' }, focusAgendar: 2.6 }} />, 1280, { focus: 'Boa tarde! Gostaria de conhecer a escola. Vocês fazem visita?', up: 4, zoom: 1 }),
    B(<WhatsApp minhas={[{ name: 'Mariana Costa', preview: 'Vocês fazem visita?', time: '15:02', status: 'open', assigned: 'Ana Beatriz', active: true }]} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: [{ text: 'Boa tarde! Gostaria de conhecer a escola. Vocês fazem visita?', time: '15:02' }] }} painel={{ atendente: 'Ana Beatriz', lead: { nome: 'Mariana Costa', aluno: 'Alice', serie: 'Infantil 5', status: 'Em Contato', origem: 'Instagram' } }} modal={<AgendarVisitaModal aluno="Alice" responsavel="Mariana Costa" data="20/10/2026" hora="10:00" inAt={0.4} pressAt={3.4} />} />, 1280, { focus: 'Agendar visita', up: 3, zoom: 1.05 }),
    P(<Celular hora="15:05" msgs={[
      { text: 'Olá, Mariana! Sua visita ao Colégio Horizonte está confirmada para 20/10, às 10:00. Até lá!', time: '15:05', in: 0.6, template: true },
      { text: 'Bom dia, Mariana! Lembrete: hoje, às 10:00, é a sua visita ao Colégio Horizonte. Esperamos você!', time: '08:00', in: 3.0 },
    ]} altura={820} />),
    B(<Kanban cols={[
      { st: 'new', cards: [{ resp: 'Rafael Souza', aluno: 'Enzo', serie: '6º ano', origem: 'WhatsApp', temp: 'morno' }] },
      { st: 'contact', cards: [{ resp: 'Fernanda Lima', aluno: 'Sofia', serie: '1º ano', origem: 'Instagram', temp: 'quente', atd: 'AB' }] },
      { st: 'scheduled', cards: [{ resp: 'Mariana Costa', aluno: 'Alice', serie: 'Infantil 5', origem: 'Instagram', temp: 'quente', atd: 'AB', move: '-276,0,0.8,2.4', focus: 2.6 }, { resp: 'Thiago Alves', aluno: 'Helena', serie: 'Infantil 4', origem: 'Indicação', atd: 'BL' }] },
      { st: 'visit', cards: [{ resp: 'Renata Dias', aluno: 'Miguel', serie: '3º ano', origem: 'Google', atd: 'CR' }] },
    ]} />, 1280, { focus: 'Visita Agendada', up: 2, zoom: 1 }),
  ] }),
  R06: txt => reel(txt, { hl: 'a rematrícula está aberta', cenas: [
    B(<TransmissaoTemplate selAt={2.2} />, 932, { focus: '@[data-focus]', up: 2, zoom: 1.6 }),
    B(<Publico />, 932, { zoom: 1 }),
    B(<TransmissaoRevisao />, 932, { focus: 'A pagar', up: 2, zoom: 1 }),
    B(<Detalhe />, 1100, { zoom: 1 }, { autocount: true }),
  ] }),
  // ── Novembro ──────────────────────────────────────────────────────────────
  R07: txt => reel(txt, { hl: 'em um único quadro', cenas: [
    B(<Kanban cols={QUADRO()} />, 1280, { zoom: 0.75 }),
    B(<Kanban cols={QUADRO('visit')} />, 1280, { focus: '@[data-move]', zoom: 1 }),
    B(<Kanban cols={QUADRO('enrolled')} />, 1280, { focus: '@[data-move]', zoom: 1 }),
    B(<Kanban cols={QUADRO('fim')} toast={{ text: 'Nova matrícula confirmada!', sub: 'Alice foi matriculado(a) com sucesso.', at: 0.8 }} />, 1280, { focus: 'Nova matrícula confirmada!', up: 2, zoom: 1.1 }),
  ] }),
  R08: txt => reel(txt, { hl: 'em poucos minutos', cenas: [
    B(<VitrineModelos selAt={2.0} />, 1180, { zoom: 0.75 }),
    B(<VitrineCores trocaAt={2.4} />, 1180, { zoom: 0.75 }),
    B(<VitrineBlocos />, 1180, { zoom: 0.75 }),
    B(<VitrineBlocos copiarAt={2.0} />, 1180, { focus: 'aionedu.com.br/colegio-horizonte', zoom: 1 }),
  ] }),
  R09: txt => reel(txt, { hl: 'pensam da escola', cenas: [
    B(<PesquisasLista menuAt={0.8} />, 1100, { focus: 'Copiar link', up: 1, zoom: 0.9 }),
    B(<PesquisaPainel aba="Visão Geral" />, 1100, { zoom: 0.75 }),
    B(<Pesquisas talvez={2.2} />, 1100, { focus: 'Respostas individuais (48)', up: 1, zoom: 0.75 }),
    B(<PesquisaPainel aba="Relatório IA" />, 1100, { zoom: 0.75 }),
  ] }),
  R10: txt => reel(txt, { hl: 'perguntas que se repetem', cenas: [
    B(<WhatsApp fila={[{ name: 'Rafael Souza', preview: 'Qual o valor da mensalidade do 6º ano?', time: '14:28', status: 'waiting', unread: 1, in: 0.6 }, { name: 'Beatriz Nunes', preview: 'Quanto custa a mensalidade do integral?', time: '14:31', status: 'waiting', unread: 1, in: 1.6 }, { name: 'Carlos Eduardo', preview: 'Qual o valor da mensalidade?', time: '14:33', status: 'waiting', unread: 1, in: 2.6 }]} minhas={MINHAS.slice(0, 2)} chat={{ name: 'Rafael Souza', phone: '+55 83 90000-1102', status: 'waiting', msgs: [{ text: 'Boa tarde! Qual o valor da mensalidade do 6º ano?', time: '14:28', in: 0.6 }] }} width={760} height={900} />, 760, { zoom: 1 }),
    B(<WhatsApp minhas={[{ name: 'Rafael Souza', preview: 'Qual o valor da mensalidade do 6º ano?', time: '14:28', status: 'open', assigned: 'Ana Beatriz', active: true }]} chat={{ name: 'Rafael Souza', phone: '+55 83 90000-1102', status: 'open', msgs: [{ text: 'Boa tarde! Qual o valor da mensalidade do 6º ano?', time: '14:28' }], typing: { text: '/', t0: 0.5, t1: 0.6 }, slash: { at: 0.8, sel: 99, items: RESPOSTAS } }} width={760} height={900} />, 760, { zoom: 1 }),
    B(<WhatsApp minhas={[{ name: 'Rafael Souza', preview: 'Qual o valor da mensalidade do 6º ano?', time: '14:28', status: 'open', assigned: 'Ana Beatriz', active: true }]} chat={{ name: 'Rafael Souza', phone: '+55 83 90000-1102', status: 'open', msgs: [{ text: 'Boa tarde! Qual o valor da mensalidade do 6º ano?', time: '14:28' }, { me: true, sender: 'Ana Beatriz', text: RESPOSTAS[0].text, time: '14:29', in: 3.4 }], typing: { text: '/mens', t0: 0.3, t1: 0.9, out: 3.2 }, slash: { at: 1.0, out: 3.0, sel: 0, items: RESPOSTAS.slice(0, 1) } }}  width={760} height={900} />, 760, { zoom: 1 }),
    B(<WhatsApp minhas={[{ name: 'Rafael Souza', preview: 'Obrigado! Vou agendar.', time: '14:30', status: 'open', assigned: 'Ana Beatriz', active: true }, ...MINHAS.slice(0, 2)]} chat={{ name: 'Rafael Souza', phone: '+55 83 90000-1102', status: 'open', msgs: [{ text: 'Boa tarde! Qual o valor da mensalidade do 6º ano?', time: '14:28' }, { me: true, sender: 'Ana Beatriz', text: RESPOSTAS[0].text, time: '14:29' }, { text: 'Obrigado! Vou agendar.', time: '14:30', in: 1.2 }] }} width={760} height={900} />, 760, { zoom: 1 }),
  ] }),
  R11: txt => reel(txt, { hl: 'com o histórico da sua escola', cenas: [
    B(<GeradorUpload lidoAt={4.0} />, 860, { zoom: 0.68 }),
    B(<GeradorUpload lidoAt={0.5} />, 860, { zoom: 0.75 }),
    B(<GeradorConfig objetivoAt={1.6} />, 860, { zoom: 0.75 }),
    B(<PlanoCampanha />, 1160, { zoom: 0.75 }),
  ] }),
  R12: txt => reel(txt, { hl: 'em uma única tela', cenas: [
    B(<AtendenteHome />, 1100, { zoom: 0.75 }),
    B(<AtendenteHome focus={{ atrasado: 1.0 }} />, 1100, { focus: 'Meus lembretes', up: 2, zoom: 1 }),
    B(<AtendenteHome comTopo trocaAt={2.2} focus={{ disp: 1.0 }} />, 1100, { focus: '@[data-focus]', zoom: 1.4 }),
    B(<Kanban cols={QUADRO('fim')} />, 1280, { zoom: 0.75 }),
  ] }),
  R13: txt => reel(txt, { hl: 'pedido de transferência', cenas: [
    B(<TransferenciasLista linkAt={1.4} />, 1100, { zoom: 0.75 }),
    P(<PesquisaFamilia selAt={2.4} />, 430, undefined, true),
    B(<DiagnosticoTransferencia />, 760, { focus: 'Motivo principal', up: 2, zoom: 0.83 }),
    B(<DiagnosticoTransferencia />, 760, { focus: 'Oportunidade de retenção', up: 2, zoom: 0.83 }),
  ] }),
  R14: txt => reel(txt, { hl: 'no período de matrículas', cenas: [
    B(<ConfigWhatsApp secao="Equipe" grupoNovoAt={1.2} />, 1100, { focus: 'Grupos de Atendimento', up: 2, zoom: 0.66 }),
    B(<WhatsApp outras={[
      { name: 'Juliana Prado', preview: 'Olá! Quero saber sobre matrícula.', time: '09:02', status: 'open', assigned: 'Ana Beatriz', in: 0.6, hl: 1.0 },
      { name: 'Rafael Souza', preview: 'Tem vaga no 6º ano?', time: '09:03', status: 'open', assigned: 'Camila Rocha', in: 1.6, hl: 2.0 },
      { name: 'Beatriz Nunes', preview: 'Vocês têm período integral?', time: '09:05', status: 'open', assigned: 'Bruno Lima', in: 2.6, hl: 3.0 },
      { name: 'Mariana Costa', preview: 'Gostaria de agendar uma visita.', time: '09:06', status: 'open', assigned: 'Ana Beatriz', in: 3.6, hl: 4.0 },
    ]} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: [{ text: 'Gostaria de agendar uma visita.', time: '09:06', in: 3.8 }] }} width={760} height={900} />, 760, { zoom: 1 }),
    B(<ConfigWhatsApp secao="Equipe" focus={{ almoco: 1.0 }} />, 1100, { focus: '👥 Horário por Atendente', up: 1, zoom: 0.66 }),
    B(<AtendenteHome comTopo trocaAt={2.2} focus={{ disp: 1.0 }} />, 1100, { focus: '@[data-focus]', zoom: 1.4 }),
  ] }),
  R15: txt => reel(txt, { hl: 'entre as particulares da cidade?', cenas: [
    B(<RelatorioMercado />, 900, { zoom: 0.7 }),
    B(<RelatorioMercado focus={{ cards: 1.0 }} />, 900, { focus: '@[data-focus]', zoom: 1 }),
    B(<RelatorioMercado focus={{ concorrentes: 1.6 }} />, 900, { focus: '@[data-focus]', zoom: 0.9 }),
    B(<RelatorioMercado focus={{ faltam: 1.0 }} />, 900, { focus: '@[data-focus]', zoom: 1 }),
  ] }),
  R16: txt => reel(txt, { hl: 'sem contato há uma semana?', cenas: [
    B(<Kanban filtro="Sem contato · há mais de 7 dias" cols={SEM_CONTATO()} />, 1280, { zoom: 0.75 }),
    B(<Kanban filtro="Sem contato · há mais de 7 dias" cols={SEM_CONTATO({ focusWA: 1.2 })} />, 1280, { focus: 'Thiago Alves', up: 4, zoom: 1.2 }),
    B(<Kanban filtro="Sem contato · há mais de 7 dias" cols={SEM_CONTATO()} modal={<LembreteModal aluno="Helena" resp="Thiago Alves" data="07/12/2026" nota="Ligar para confirmar a visita de sábado." inAt={0.4} t0={1.4} t1={3.4} />} />, 1280, { focus: 'Definir lembrete', up: 3, zoom: 1 }),
    B(<Kanban filtro="Sem contato · há mais de 7 dias" cols={SEM_CONTATO({ lembrete: true })} />, 1280, { focus: 'Thiago Alves', up: 4, zoom: 1.2 }),
  ] }),
  // ── Dezembro ──
  // R19 — painel do gestor no navegador do celular. A versão de celular não
  // mostra a taxa de conversão, então a narração fala em interessados e
  // matrículas do mês (texto aprovado em 08/10/2026).
  R19: txt => reel(txt, { hl: 'pelo celular', cenas: [
    P(<GestorHomeCelular />, 390, { alvos: [{ sel: '.url', t: 0.8 }] }, true, 1150),
    P(<GestorHomeCelular />, 390, { scroll: { y: 300, t0: 0.3, t1: 1.3 }, alvos: [{ sel: '.kpi-Cadastros', t: 1.6 }, { sel: '.kpi-Matrículas', t: 3.0 }] }, true, 1150),
    P(<GestorHomeCelular />, 390, { scroll: { y: 330, t0: 1.6, t1: 2.6 }, alvos: [{ sel: '.alerta-topo', t: 0.5 }, { sel: '.alertas', t: 3.0 }] }, true, 1150),
    P(<GestorHomeCelular pressAt={{ WhatsApp: 1.8, Visitas: 3.6 }} />, 390, { scroll: { y: 330, t0: 0.2, t1: 1.0 }, alvos: [{ sel: '.qa-WhatsApp', t: 1.2 }, { sel: '.qa-Visitas', t: 3.0 }] }, true, 1150),
  ] }),
  R17: txt => reel(txt, { hl: 'pelo WhatsApp oficial da escola', cenas: [
    B(<TransmissaoTemplate selAt={2.2} />, 932, { focus: '@[data-focus]', up: 2, zoom: 1.6 }),
    B(<TransmissaoTurmas selAt={1.2} />, 932, { focus: 'Turma', up: 1, zoom: 1.6 }),
    B(<TransmissaoRespostas focusAt={1.4} />, 932, { focus: 'Clicou em "Tenho dúvidas"', up: 1, zoom: 1.6 }),
    B(<Detalhe />, 1100, { zoom: 1 }, { autocount: true }),
  ] }),
  R18: txt => reel(txt, { hl: 'quando a atendente se ausenta?', cenas: [
    B(<WhatsApp minhas={[CONV_MARI('Ana Beatriz')]} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: MSGS_MARI }} painel={{ atendente: 'Ana Beatriz', transfer: { to: 'Camila Rocha', at: 2.6 }, lead: LEAD_MARI }} />, 1280, { focus: 'Atendente', up: 1, zoom: 1.3 }),
    B(<WhatsApp minhas={[CONV_MARI('Camila Rocha')]} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: MSGS_MARI }} painel={{ aba: 'history', historico: [
      { desc: 'Transferido de Ana Beatriz para Camila Rocha', user: 'Ana Beatriz Lima', time: '10/12, 12:02', cor: '#8B5CF6', in: 0.8, focus: 1.6 },
      { desc: 'Transferido de Bruno Lima para Ana Beatriz', user: 'Bruno Lima', time: '09/12, 17:45', cor: '#8B5CF6' },
    ] }} />, 1280, { focus: 'Histórico de eventos', up: 1, zoom: 1.3 }),
    B(<WhatsApp minhas={[CONV_MARI('Camila Rocha')]} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: MSGS_MARI.map((m, i) => ({ ...m, in: 0.4 + i * 0.6 })) }} width={760} height={900} />, 760, { zoom: 1 }),
    B(<WhatsApp minhas={[CONV_MARI('Camila Rocha')]} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: [...MSGS_MARI.slice(1), { text: 'Oi! Ainda está tudo certo para sábado?', time: '12:10', in: 0.6 }, { me: true, sender: 'Camila Rocha', text: 'Oi, Mariana! Sou a Camila e vou continuar seu atendimento. A visita da Alice está confirmada para sábado às 10h, e já anotei a alergia a amendoim.', time: '12:12', in: 2.0 }] }}  width={760} height={900} />, 760, { zoom: 1 }),
  ] }),
  R20: txt => reel(txt, { hl: 'em qual anúncio investir mais', cenas: [
    B(<CaptacaoDashboard />, 1280, { zoom: 0.75 }),
    B(<CaptacaoDashboard />, 1280, { focus: '@tbody tr:nth-child(2) td:nth-child(4)', zoom: 1 }, { alvos: [{ sel: 'tbody tr:nth-child(2) td:nth-child(3)', t: 0.8 }, { sel: 'tbody tr:nth-child(2) td:nth-child(6)', t: 2.0 }] }),
    B(<CaptacaoDashboard />, 1280, { focus: '@tbody tr:nth-child(3) td:nth-child(4)', zoom: 1 }, { alvos: [{ sel: 'tbody tr:nth-child(3) td:nth-child(3)', t: 0.8 }, { sel: 'tbody tr:nth-child(3) td:nth-child(6)', t: 2.0 }] }),
    B(<CaptacaoDashboard />, 1280, { focus: 'Conversão contato → matrícula (1º toque)', up: 2, zoom: 0.95 }),
  ] }),
  R21: txt => reel(txt, { hl: 'para o recesso', cenas: [
    B(<ConfigWhatsApp secao="Horário" focus={{ dias: 1.0 }} />, 1100, { focus: 'Dias da semana', zoom: 1.35 }),
    B(<ConfigWhatsApp secao="Horário" focus={{ msg: 0.4 }} foraHorarioMsg={{ text: 'Olá! A secretaria está em recesso de 21/12 a 05/01. Sua mensagem foi registrada e a equipe responde a partir de 06/01.', t0: 0.6, t1: 3.6 }} />, 1100, { focus: 'Mensagem fora do horário', zoom: 1.35 }),
    P(<Celular hora="21:32" dia="22 DE DEZEMBRO" msgs={RECESSO.slice(0, 3)} altura={820} />),
    B(<WhatsApp fila={[
      { name: 'Juliana Prado', preview: 'Matrículas 2027', time: '04/01', status: 'waiting', unread: 3 },
      { name: 'Paulo Vieira', preview: 'Rematrícula', time: '03/01', status: 'waiting', unread: 2 },
      { name: 'Beatriz Nunes', preview: 'Outros assuntos', time: '30/12', status: 'waiting', unread: 1 },
      { name: 'Carlos Eduardo', preview: 'Matrículas 2027', time: '28/12', status: 'waiting', unread: 2 },
      { name: 'Renata Dias', preview: 'Rematrícula', time: '23/12', status: 'waiting', unread: 1 },
    ]} chat={{ name: 'Juliana Prado', phone: '+55 83 90000-3307', status: 'waiting', msgs: [{ text: 'Boa noite! Queria saber sobre matrícula para 2027.', time: '04/01 21:10' }, { me: true, bot: true, text: 'Olá! A secretaria está em recesso de 21/12 a 05/01. Sua mensagem foi registrada e a equipe responde a partir de 06/01.', time: '04/01 21:10' }, { text: 'Matrículas 2027', time: '04/01 21:11' }] }} width={760} height={900} />, 760, { zoom: 1 }),
  ] }),
  R22: txt => reel(txt, { hl: 'perder matrículas', cenas: [
    B(<Relatorios largura={820} aba="Transferências" />, 820, { focus: 'Recusas (Pareto)', up: 3, zoom: 1 }),
    B(<Relatorios largura={820} aba="Transferências" />, 820, { focus: 'Fator Interno', up: 3, zoom: 1 }, { alvos: [{ txt: 'Fator Interno', up: 2, t: 1.0 }, { txt: 'Fator Externo', up: 2, t: 2.2 }] }),
    B(<Relatorios largura={820} aba="Transferências" focus={{ internos: 1.0 }} />, 820, { focus: 'Recusas (Pareto)', up: 3, zoom: 1 }),
    B(<Relatorios largura={820} aba="Transferências" />, 820, { focus: 'Fator Interno (escola pode melhorar)', up: 2, zoom: 1.2 }, { alvos: [{ txt: 'Fator Interno (escola pode melhorar)', t: 1.0 }] }),
  ] }),
  R23: txt => reel(txt, { hl: 'da sua escola?', cenas: [
    B(<GestorHome show={['header', 'kpis']} periodo="Ano" focus={{ periodo: 1.0 }} width={1000} />, 1000, { focus: '@[data-focus]', zoom: 1.2 }),
    B(<GestorHome show={['kpis']} periodo="Ano" focus={{ kpis: 2.4 }} width={1000} />, 1000, { focus: '@[data-focus]', zoom: 1.5 }),
    B(<GestorHome show={['origem']} periodo="Ano" focus={{ origem: 2.6 }} width={800} />, 800, { focus: '@[data-focus]', zoom: 1.5 }),
    B(<GestorHome show={['header', 'kpis']} periodo="Ano" focus={{ pdf: 1.0 }} width={1000} />, 1000, { focus: '@[data-focus]', zoom: 1.3 }),
  ] }),
  R24: txt => reel(txt, { hl: 'quem ficou sem resposta', cenas: [
    B(<Kanban filtro="Sem contato · há mais de 15 dias" cols={RETOMADA()} />, 1280, { zoom: 0.75 }),
    B(<Kanban filtro="Sem contato · há mais de 15 dias · Quente" cols={RETOMADA({ quentes: true })} />, 1280, { zoom: 0.75 }),
    B(<Kanban filtro="Sem contato · há mais de 15 dias · Quente" cols={RETOMADA({ quentes: true, focusWA: 1.2 })} />, 1280, { focus: 'Thiago Alves', up: 4, zoom: 1.2 }),
    B(<Relatorios largura={820} aba="Visão Geral" focus={{ dias: 1.0 }} fim="31/01/2027" dias={30} semanas={4} faltam={8} />, 820, { focus: '@[data-focus]', zoom: 1 }),
  ] }),
}

// ── Janeiro (Reels) ─────────────────────────────────────────────────────────
Object.assign(REELS, {
  R25: (txt: TxtReel) => reel(txt, { hl: 'do início ao fim', cenas: [
    B(<WhatsApp fila={[{ ...FILA[0], active: true }, FILA[1]]} minhas={MINHAS.slice(0, 2)} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'waiting', banner: 'fila', bannerOut: 3.4, pressAssumir: 3.0, msgs: MSGS_FILA }} painel={{ atendenteIn: { name: 'Ana Beatriz', at: 3.4 } }} />, 1280, { focus: '⏳ Conversa aguardando atendimento', up: 2, zoom: 1.1 }),
    B(<WhatsApp minhas={[{ name: 'Mariana Costa', preview: 'Qual o valor da mensalidade?', time: '14:34', status: 'open', assigned: 'Ana Beatriz', active: true }]} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: [...MSGS_FILA, { text: 'Qual o valor da mensalidade do Infantil 5?', time: '14:34' }, { me: true, sender: 'Ana Beatriz', text: RESP_INF.text, time: '14:35', in: 3.4 }], typing: { text: '/mens', t0: 0.3, t1: 0.9, out: 3.2 }, slash: { at: 1.0, out: 3.0, sel: 0, items: [RESP_INF] } }}  width={760} height={900} />, 760, { zoom: 1 }),
    B(<WhatsApp minhas={[{ name: 'Mariana Costa', preview: 'Podemos visitar a escola?', time: '14:37', status: 'open', assigned: 'Ana Beatriz', active: true }]} chat={{ name: 'Mariana Costa', phone: '+55 83 90000-1101', status: 'open', msgs: [{ text: 'Gostei! Podemos visitar a escola?', time: '14:37' }] }} modal={<AgendarVisitaModal aluno="Alice" responsavel="Mariana Costa" data="09/01/2027" hora="10:00" inAt={0.4} pressAt={3.4} />} width={760} height={900} />, 760, { zoom: 1 }),
    P(<Celular hora="14:38" msgs={[{ text: 'Olá, Mariana! Sua visita ao Colégio Horizonte está confirmada para 09/01, às 10:00. Até lá!', time: '14:38', in: 0.8, template: true, focus: 1.8 }]} altura={820} />),
  ] }),
  R26: (txt: TxtReel) => reel(txt, { hl: 'Acompanhe o resultado', cenas: [
    B(<ModalGatilho />, 800, { focus: 'Link para o anúncio', up: 1, zoom: 1.6 }, { alvos: [{ txt: 'Link para o anúncio', up: 1, t: 1.0 }] }),
    B(<ModalGatilho />, 800, { focus: 'Link para o anúncio', up: 1, zoom: 1.6 }, { alvos: [{ txt: 'Copiar link', up: 0, t: 1.0 }] }),
    B(<ModalGatilho />, 800, { focus: 'Pular o robô de atendimento', up: 3, zoom: 1.6 }, { alvos: [{ txt: 'Pular o robô de atendimento', up: 3, t: 1.0 }] }),
    B(<CaptacaoDashboard />, 1280, { focus: '@tbody tr:nth-child(1) td:nth-child(4)', zoom: 1 }, { alvos: [{ sel: 'tbody tr:nth-child(1) td:nth-child(1)', t: 0.8 }, { sel: 'tbody tr:nth-child(1) td:nth-child(6)', t: 1.8 }] }),
  ] }),
  R27: (txt: TxtReel) => reel(txt, { hl: 'de cada atendente', cenas: [
    B(<GestorHome show={['ranking']} width={960} />, 960, { focus: 'Ranking da Equipe', zoom: 1.7 }, { alvos: [{ txt: 'Camila Rocha', up: 2, t: 1.6 }] }),
    B(<DetalheAtendente focusAt={1.8} />, 760, { focus: 'Conversas avaliadas como Ruim', up: 2, zoom: 1 }),
    B(<WhatsApp minhas={[{ name: 'Renata Dias', preview: 'Ninguém me respondeu ontem.', time: 'ter', status: 'open', assigned: 'Camila Rocha', active: true }]} chat={{ name: 'Renata Dias', phone: '+55 83 90000-2302', status: 'open', msgs: [
      { text: 'Bom dia! Vocês ainda têm vaga no 3º ano para 2027?', time: 'seg 09:10', in: 0.4 },
      { text: 'Ninguém me respondeu ontem.', time: 'ter 08:30', in: 1.4 },
      { me: true, sender: 'Camila Rocha', text: 'Desculpe a demora, Renata! Temos vaga, sim.', time: 'ter 11:02', in: 2.4 },
    ] }} width={760} height={900} />, 760, { zoom: 1 }),
    B(<DetalheAtendente inAt={0} focusAt={0.8} />, 760, { zoom: 0.95 }),
  ] }),
  R28: (txt: TxtReel) => reel(txt, { hl: 'para as últimas vagas', cenas: [
    B(<VitrineUltimasVagas bannerAt={1.4} />, 1180, { focus: 'Blocos da página', up: 2, zoom: 1.6 }),
    B(<VitrineUltimasVagas bannerAt={-1} efeitoAt={2.4} />, 1180, { focus: 'Blocos da página', up: 2, zoom: 1.6 }),
    B(<VitrineUltimasVagas bannerAt={-1} efeitoAt={-1} />, 1180, { focus: 'Tudo salvo', zoom: 1.2 }, { alvos: [{ txt: 'Tudo salvo', t: 0.8 }] }),
    P(<RawHtml html={vitrineHtml('matriculas', [BANNER(), ...VITRINE_BLOCOS().filter(b => b.id !== 'b4' && b.id !== 'b6')] as any)} />, 390, { alvos: [{ sel: '.cta', t: 1.4 }] }, true, 1100),
  ] }),
  R29: (txt: TxtReel) => reel(txt, { hl: 'ainda há vagas', cenas: [
    B(<TransmissaoTurmas selAt={1.2} tipo="Lead" />, 932, { focus: 'Turma', up: 1, zoom: 1.6 }),
    B(<TransmissaoTemplate selAt={2.0} ultimas />, 932, { focus: '@[data-focus]', up: 2, zoom: 1.6 }),
    B(<TransmissaoRespostas ultimas focusAt={1.2} />, 932, { focus: 'Clicou em "Quero visitar"', up: 1, zoom: 1.6 }),
    B(<Detalhe />, 1100, { zoom: 1 }, { autocount: true }),
  ] }),
  R30: (txt: TxtReel) => reel(txt, { hl: 'com um clique', cenas: [
    B(<Relatorios largura={820} aba="Diagnóstico IA" gerarAt={2.6} fim="31/01/2027" mes="Janeiro/2027" gerado="21/01/2027" hist={['Dezembro/2026', 'Novembro/2026']} />, 820, { focus: 'Gerar diagnóstico do mês', up: 1, zoom: 1.2 }),
    B(<Relatorios largura={820} aba="Diagnóstico IA" gerarAt={0} fim="31/01/2027" mes="Janeiro/2027" gerado="21/01/2027" hist={['Dezembro/2026', 'Novembro/2026']} />, 820, { focus: 'Diagnóstico IA — Janeiro/2027', up: 3, zoom: 1 }),
    B(<Relatorios largura={820} aba="Diagnóstico IA" focus={{ conteudo: 0.8 }} fim="31/01/2027" mes="Janeiro/2027" gerado="21/01/2027" hist={['Dezembro/2026', 'Novembro/2026']} />, 820, { focus: '@[data-focus]', zoom: 1 }),
    B(<Relatorios largura={820} aba="Diagnóstico IA" fim="31/01/2027" mes="Janeiro/2027" gerado="21/01/2027" hist={['Dezembro/2026', 'Novembro/2026']} />, 820, { focus: 'Histórico', up: 1, zoom: 1.3 }, { alvos: [{ txt: 'Histórico', up: 1, t: 1.0 }] }),
  ] }),
  R31: (txt: TxtReel) => reel(txt, { hl: 'em um só sistema', cenas: [
    P(<Celular hora="20:14" msgs={[{ me: true, text: 'Olá! Vi o anúncio e quero saber sobre matrícula no Infantil 2027', time: '20:14', in: 3.2 }]} digitando={{ text: 'Olá! Vi o anúncio e quero saber sobre matrícula no Infantil 2027', t0: 0.6, t1: 0.61, out: 3.1 }} altura={820} />),
    B(<WhatsApp fila={[{ name: 'Juliana Prado', preview: 'Olá! Vi o anúncio e quero saber sobre...', time: '20:14', status: 'waiting', captacao: 'Matrículas 2027 — Infantil', unread: 1, active: true }]} minhas={MINHAS.slice(0, 1)} chat={{ name: 'Juliana Prado', phone: '+55 83 90000-3307', status: 'waiting', captacao: { name: 'Matrículas 2027 — Infantil', canal: 'Meta Ads' }, banner: 'fila', bannerOut: 3.4, pressAssumir: 3.0, msgs: [{ text: 'Olá! Vi o anúncio e quero saber sobre matrícula no Infantil 2027', time: '20:14' }, { me: true, bot: true, text: 'Olá! Que bom ter você aqui. Qual o nome do aluno e a série de interesse?', time: '20:14' }, { text: 'Alice, Infantil 5.', time: '20:15' }] }} painel={{ atendenteIn: { name: 'Ana Beatriz', at: 3.4 } }} />, 1280, { focus: '⏳ Conversa aguardando atendimento', up: 2, zoom: 1.05 }),
    B(<Kanban cols={[
      { st: 'contact', cards: [{ resp: 'Fernanda Lima', aluno: 'Sofia', serie: '1º ano', origem: 'Instagram', temp: 'quente', atd: 'AB' }] },
      { st: 'scheduled', cards: [{ resp: 'Thiago Alves', aluno: 'Helena', serie: 'Infantil 4', origem: 'Indicação', atd: 'BL' }] },
      { st: 'visit', cards: [{ resp: 'Juliana Prado', aluno: 'Alice', serie: 'Infantil 5', origem: 'Instagram', temp: 'quente', atd: 'AB', move: '-276,0,0.8,2.4', focus: 2.6 }, { resp: 'Renata Dias', aluno: 'Miguel', serie: '3º ano', origem: 'Google', atd: 'CR' }] },
      { st: 'enrolled', cards: [{ resp: 'Beatriz Nunes', aluno: 'Davi', serie: '6º ano', origem: 'Site', atd: 'BL' }] },
    ]} />, 1280, { focus: '@[data-move]', zoom: 1 }),
    B(<CaptacaoDashboard />, 1280, { focus: '@tbody tr:nth-child(1) td:nth-child(4)', zoom: 1 }, { alvos: [{ sel: 'tbody tr:nth-child(1) td:nth-child(1)', t: 0.8 }, { sel: 'tbody tr:nth-child(1) td:nth-child(6)', t: 1.8 }] }),
  ] }),
  R32: (txt: TxtReel) => reel(txt, { hl: 'começa com um plano', cenas: [
    B(<GeradorUpload lidoAt={2.6} />, 860, { zoom: 0.75 }),
    B(<PlanoCampanha nivel={2} nivelAt={1.8} />, 1160, { focus: 'Realista', up: 3, zoom: 1 }),
    B(<GeradorGerando />, 860, { zoom: 0.75 }),
    B(<PlanoCampanha aplicarAt={2.6} />, 1160, { focus: 'Aplicar ao sistema', zoom: 1.5 }),
  ] }),
})

const RESP_INF = { label: 'Valor da mensalidade', text: 'Olá! A mensalidade do Infantil 5 em 2027 é de R$ 1.280,00, com material incluso. Quer agendar uma visita para conhecer a escola?' }
const UNIDADES = [
  { me: true, text: 'Oi! Quero informações sobre matrícula.', time: '09:15', in: 0.4 },
  { text: 'Olá! Você está falando com o Colégio Horizonte. Qual unidade você procura?', time: '09:15', in: 1.4, botoes: ['Unidade Centro', 'Unidade Bairro Novo', 'Unidade Praia'], focus: 2.2 },
  { me: true, text: 'Unidade Bairro Novo', time: '09:16', in: 3.2 },
  { text: 'Certo! A equipe da Unidade Bairro Novo já vai falar com você.', time: '09:16', in: 4.0 },
]
const BANNER = () => ({ id: 'b0', type: 'banner', is_visible: true, config: { image_url: `${process.env.DEMO_ASSETS || 'http://127.0.0.1:5297'}/banner.svg`, aspect: '3:1', alt: 'Últimas vagas 2027', link_url: '' } })
// A48 — composição com três telas: WhatsApp, quadro e painel do gestor
function Composicao() {
  const box = (left: number, top: number, w: number, h: number, s: number, el: React.ReactNode, alvo?: boolean) => (
    <div {...(alvo ? { 'data-recorte-alvo': '' } : {})} style={{ position: 'absolute', left, top, width: w * s, height: h * s, borderRadius: 14, overflow: 'hidden', boxShadow: '0 18px 40px rgba(0,0,0,.18)', border: '1px solid #E2E8F0', background: '#fff' }}>
      <div style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: '0 0' }}>{el}</div>
    </div>
  )
  return (
    <div id="shot" style={{ width: 1280, height: 760, position: 'relative', background: 'linear-gradient(135deg,#E6F7F5,#F4F7F5)' }}>
      {box(30, 30, 1280, 780, 0.55, <WhatsApp fila={FILA} minhas={MINHAS} chat={{ name: 'Fernanda Lima', phone: '+55 83 90000-1104', status: 'open', msgs: [{ text: 'Oi! Queria saber sobre o período integral.', time: '14:05' }, { me: true, sender: 'Ana Beatriz', text: 'Olá, Fernanda! Temos integral do Infantil ao 5º ano.', time: '14:07' }] }} />, true)}
      {box(560, 250, 1280, 760, 0.52, <Kanban cols={QUADRO('fim')} />)}
      {box(180, 470, 960, 520, 0.55, <GestorHome show={['kpis', 'ranking']} width={960} />)}
    </div>
  )
}

// R18: conversa da Mariana passando da Ana Beatriz para a Camila
const CONV_MARI = (atd: string): Conv => ({ name: 'Mariana Costa', preview: 'Prefiro sábado. Ela tem alergia a amendoim.', time: '11:48', status: 'open', assigned: atd, active: true })
const MSGS_MARI = [
  { text: 'Bom dia! Queria agendar uma visita para a Alice, do Infantil 5.', time: '11:40' },
  { me: true, sender: 'Ana Beatriz', text: 'Bom dia, Mariana! Temos sábado às 10h ou terça às 15h. Qual fica melhor?', time: '11:42' },
  { text: 'Prefiro sábado. Ela tem alergia a amendoim, tá?', time: '11:48' },
  { me: true, sender: 'Ana Beatriz', text: 'Anotado! Visita confirmada para sábado às 10h.', time: '11:50' },
]
const LEAD_MARI = { nome: 'Mariana Costa', aluno: 'Alice', serie: 'Infantil 5', status: 'Visita Agendada', origem: 'Instagram' }
// R24: retomada em janeiro (sem contato há mais de 15 dias; quentes primeiro)
function RETOMADA(o: { quentes?: boolean; focusWA?: number } = {}): { st: any; cards: any[] }[] {
  const all = [
    { st: 'new', c: { resp: 'Carlos Eduardo', aluno: 'Laura', serie: '2º ano', origem: 'Site', temp: 'frio', lembrete: { label: 'Sem contato há 21d', cor: 'gray' } } },
    { st: 'contact', c: { resp: 'Thiago Alves', aluno: 'Helena', serie: 'Infantil 4', origem: 'Indicação', temp: 'quente', atd: 'BL', fone: '(83) 90000-2301', focusWA: o.focusWA, lembrete: { label: 'Sem contato há 17d', cor: 'gray' } } },
    { st: 'contact', c: { resp: 'Lucas Martins', aluno: 'Pedro', serie: '2º ano', origem: 'Google', temp: 'morno', atd: 'AB', lembrete: { label: 'Sem contato há 19d', cor: 'gray' } } },
    { st: 'scheduled', c: { resp: 'Renata Dias', aluno: 'Miguel', serie: '3º ano', origem: 'WhatsApp', temp: 'quente', atd: 'CR', lembrete: { label: 'Sem contato há 16d', cor: 'gray' } } },
    { st: 'visit', c: { resp: 'Paulo Vieira', aluno: 'Clara', serie: '9º ano', origem: 'Instagram', temp: 'quente', atd: 'AB', lembrete: { label: 'Sem contato há 23d', cor: 'gray' } } },
  ].filter(x => !o.quentes || x.c.temp === 'quente')
  return (['new', 'contact', 'scheduled', 'visit'] as const).map(st => ({ st, cards: all.filter(x => x.st === st).map(x => x.c) }))
}

// Quadro do R07/R12: a família da Mariana anda de "Visita Agendada" até "Matriculado"
function QUADRO(etapa?: 'visit' | 'enrolled' | 'fim'): { st: any; cards: any[] }[] {
  const mari = { resp: 'Mariana Costa', aluno: 'Alice', serie: 'Infantil 5', origem: 'Instagram', temp: 'quente', atd: 'AB' }
  const em = (st: string) => etapa === st || (etapa === 'fim' && st === 'enrolled')
  return [
    { st: 'contact', cards: [{ resp: 'Fernanda Lima', aluno: 'Sofia', serie: '1º ano', origem: 'Instagram', temp: 'quente', atd: 'AB' }, { resp: 'Rafael Souza', aluno: 'Enzo', serie: '6º ano', origem: 'WhatsApp', temp: 'morno', atd: 'CR' }] },
    { st: 'scheduled', cards: [...(!etapa ? [{ ...mari, focus: 1.8 }] : []), { resp: 'Thiago Alves', aluno: 'Helena', serie: 'Infantil 4', origem: 'Indicação', atd: 'BL' }] },
    { st: 'visit', cards: [...(etapa === 'visit' ? [{ ...mari, move: '-276,0,0.8,2.4', focus: 2.6 }] : []), { resp: 'Renata Dias', aluno: 'Miguel', serie: '3º ano', origem: 'Google', atd: 'CR' }] },
    { st: 'enrolled', cards: [...(em('enrolled') ? [{ ...mari, ...(etapa === 'enrolled' ? { move: '-276,0,0.8,2.4', focus: 2.6 } : {}) }] : []), { resp: 'Beatriz Nunes', aluno: 'Davi', serie: '6º ano', origem: 'Site', atd: 'BL' }] },
  ]
}
// Filtro "sem contato" do R16 (lembrete automático cinza → lembrete marcado)
function SEM_CONTATO(o: { focusWA?: number; lembrete?: boolean } = {}): { st: any; cards: any[] }[] {
  return [
    { st: 'new', cards: [{ resp: 'Carlos Eduardo', aluno: 'Laura', serie: '2º ano', origem: 'Site', lembrete: { label: 'Sem contato há 12d', cor: 'gray' } }] },
    { st: 'contact', cards: [
      { resp: 'Thiago Alves', aluno: 'Helena', serie: 'Infantil 4', origem: 'Indicação', atd: 'BL', fone: '(83) 90000-2301', focusWA: o.focusWA, ...(o.lembrete ? { lembrete: { label: 'Follow-up em 07/12', cor: 'blue' }, focusLembrete: 1.0 } : { lembrete: { label: 'Sem contato há 9d', cor: 'gray' } }) },
      { resp: 'Lucas Martins', aluno: 'Pedro', serie: '2º ano', origem: 'Google', atd: 'AB', lembrete: { label: 'Sem contato há 8d', cor: 'gray' } },
    ] },
    { st: 'scheduled', cards: [{ resp: 'Renata Dias', aluno: 'Miguel', serie: '3º ano', origem: 'WhatsApp', atd: 'CR', lembrete: { label: 'Sem contato há 7d', cor: 'gray' } }] },
    { st: 'visit', cards: [{ resp: 'Paulo Vieira', aluno: 'Clara', serie: '9º ano', origem: 'Instagram', atd: 'AB', lembrete: { label: 'Sem contato há 10d', cor: 'gray' } }] },
  ]
}
const RESPOSTAS = [
  { label: 'Valor da mensalidade', text: 'Olá! A mensalidade do 6º ano em 2027 é de R$ 1.480,00, com material incluso. Quer agendar uma visita para conhecer a escola?' },
  { label: 'Horário da secretaria', text: 'A secretaria funciona de segunda a sexta, das 7h às 18h.' },
  { label: 'Documentos para matrícula', text: 'Para a matrícula, traga RG e CPF do responsável, certidão do aluno e comprovante de residência.' },
  { label: 'Agendar visita', text: 'Podemos agendar sua visita! Qual o melhor dia e horário para você?' },
]
