import { useState, useEffect, useRef, FormEvent } from 'react'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '../lib/supabase'
import { SHARED_CSS } from '../styles/sharedCSS'
import AION_LOGO_B64 from '../lib/aionLogo'
import { calculateRaioXMetrics } from '../lib/raioXMetrics'
import RaioXPdfDocument from '../lib/raioXPdf'

// ─── tipos ──────────────────────────────────────────────────────────────────
interface SchoolResult {
  co_entidade: string
  no_entidade: string
  no_municipio: string | null
  sg_uf: string | null
  qt_mat_total: number | null
  ano_censo: number
}

type Step = 'search' | 'confirm' | 'form' | 'success'
type SearchStage = 'uf' | 'city' | 'school'

// ─── design tokens — paleta oficial da Áion Edu (ver src/styles/sharedCSS.ts) ─
const VD     = '#00523C' // verde escuro — cor primária da marca
const VMID   = '#006B50' // verde médio — hover
const VM     = '#00A896' // teal — acento/CTA secundário
const VC     = '#0DD3BF' // mint — destaque
const TEXT   = '#111827'
const MUTED  = '#6b7280'
const BORDER = '#E5E7EB'
const SOFT   = '#E6F7F5' // fundo mint claro (mesmo de .tag-g)

const HERO_GRADIENT = `linear-gradient(135deg, ${VD} 0%, ${VMID} 50%, ${VM} 100%)`

// CSS responsivo específico da página — breakpoints mobile, tap targets maiores
const RAIOX_CSS = `
.rx-hero { padding: 48px 20px 130px; }
.rx-card-wrap { margin: -90px auto 60px; padding: 0 20px; }
.rx-card { padding: 32px; transition: padding .2s ease; }
.rx-uf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 8px; }
.rx-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rx-actions { display: flex; gap: 10px; }
.rx-list-item { display: block; width: 100%; text-align: left; padding: 14px 16px; border-radius: 10px; border: 1.5px solid ${BORDER}; background: #fff; cursor: pointer; min-height: 48px; transition: background .15s, border-color .15s; }
.rx-list-item:hover { background: ${SOFT}; border-color: ${VM}; }
.rx-uf-btn { padding: 13px 4px; border-radius: 10px; border: 1.5px solid ${BORDER}; background: #fff; color: ${TEXT}; font-size: 14px; font-weight: 700; cursor: pointer; min-height: 48px; transition: background .15s, border-color .15s; font-family: 'Plus Jakarta Sans', sans-serif; }
.rx-uf-btn:hover { background: ${SOFT}; border-color: ${VM}; color: ${VD}; }
.rx-gate-hero { min-height: 92vh; padding: 90px 20px; background: linear-gradient(135deg, ${VD} 0%, ${VMID} 50%, ${VM} 100%); background-size: 220% 220%; animation: rxGateGradient 14s ease infinite; }
.rx-gate-btn { width: auto; }
@keyframes rxGateGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes rxFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
.rx-gate-anim { opacity: 0; animation: rxFadeUp 0.7s cubic-bezier(.22,1,.36,1) forwards; }
.rx-gate-anim-1 { animation-delay: 0.05s; }
.rx-gate-anim-2 { animation-delay: 0.25s; }
.rx-gate-anim-3 { animation-delay: 0.45s; }
.rx-gate-anim-4 { animation-delay: 0.65s; }
.rx-gate-anim-5 { animation-delay: 0.9s; }
@media (prefers-reduced-motion: reduce) {
  .rx-gate-hero { animation: none; }
  .rx-gate-anim { animation: none; opacity: 1; }
}
@media (max-width: 480px) {
  .rx-hero { padding: 32px 16px 104px !important; }
  .rx-card-wrap { margin: -72px auto 36px !important; padding: 0 14px !important; }
  .rx-card { padding: 22px 18px !important; border-radius: 16px !important; }
  .rx-grid2 { grid-template-columns: 1fr !important; }
  .rx-actions { flex-direction: column !important; }
  .rx-actions > button, .rx-actions > a { width: 100% !important; }
  .rx-uf-grid { grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)) !important; gap: 6px !important; }
  .rx-gate-hero { min-height: 100vh; padding: 64px 16px !important; }
  .rx-gate-btn { width: 100% !important; }
}
`

const UFS = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' }, { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' }, { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' }, { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' }, { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' }, { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' }, { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' }, { uf: 'TO', name: 'Tocantins' },
]
const ufName = (uf: string) => UFS.find(u => u.uf === uf)?.name ?? uf

const STEP_LABELS = ['Buscar escola', 'Confirmar', 'Seus dados']
const STEP_INDEX: Record<Step, number> = { search: 0, confirm: 1, form: 2, success: 3 }

// carrossel de diferenciais exibido enquanto o relatório é calculado/gerado
// (mesmo conteúdo usado na página "Por que a Áion Edu" do PDF — ver raioXPdf.tsx)
type HighlightIconName = 'trend' | 'home' | 'chart' | 'grid' | 'star'

const AION_HIGHLIGHTS: { icon: HighlightIconName; title: string; desc: string }[] = [
  { icon: 'trend', title: 'Criamos sua campanha de matrícula com você', desc: 'A Áion não entrega só um sistema - montamos a campanha junto e acompanhamos os resultados automaticamente.' },
  { icon: 'home',  title: 'CRM feito especialmente para escolas',       desc: 'Não é um sistema genérico adaptado - foi construído pensando na realidade da gestão educacional.' },
  { icon: 'chart', title: 'Relatórios de campanha completos',          desc: 'Veja exatamente de onde vêm seus leads e o que está funcionando, sem precisar montar planilha.' },
  { icon: 'grid',  title: 'Mais de 10 módulos, um único clique',       desc: 'Tudo organizado numa única tela - sem dor de cabeça pra gerar nada.' },
  { icon: 'star',  title: 'O melhor custo-benefício do mercado educacional', desc: 'Tecnologia completa por um investimento que cabe no orçamento da sua escola.' },
]

const CAROUSEL_CARD_MS = 2400
const CAROUSEL_TOTAL_MS = CAROUSEL_CARD_MS * AION_HIGHLIGHTS.length // 12s no total

// ícones inline (SVG) — a fonte de ícones "ti ti-*" usada em outros pontos do site
// não está carregada em nenhum lugar do projeto (sem <link> nem @font-face), então
// renderiza em branco; para garantir que os ícones do carrossel realmente apareçam,
// usamos o mesmo padrão de SVG inline já usado (e funcional) em src/pages/Landing.tsx.
function HighlightIcon({ name, size = 24, color = '#00523C' }: { name: HighlightIconName; size?: number; color?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'trend':
      return <svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
    case 'home':
      return <svg {...common}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    case 'chart':
      return <svg {...common}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
    case 'grid':
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
    case 'star':
      return <svg {...common}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
  }
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151',
  marginBottom: 6, marginTop: 16,
}
const headingStyle: React.CSSProperties = { margin: '0 0 4px', fontSize: 18, color: TEXT }
const subtextStyle: React.CSSProperties = { margin: '0 0 16px', fontSize: 13, color: MUTED }
const hintStyle: React.CSSProperties = { fontSize: 12.5, color: MUTED, marginTop: 12, textAlign: 'center' }
const errStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginTop: 8 }
const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none',
  color: VM, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 14,
}

// ─── portão de entrada (gate) — exibido antes do fluxo de busca/formulário ───
const GATE_CHECKLIST = [
  'Ranking da cidade',
  'Principais concorrentes',
  'Market Share',
  'Dados oficiais do INEP',
  'Relatório em PDF',
]

function CheckIcon({ size = 22, color = VD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="11" fill={color} />
      <path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AlertIcon({ size = 28, color = '#dc2626' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="11" fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.6} />
      <line x1="12" y1="7" x2="12" y2="13.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.15" fill={color} />
    </svg>
  )
}

function SchoolIcon({ size = 20, color = VD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function WhatsAppIcon({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

const AION_WHATSAPP_URL = 'https://wa.me/5583993444383?text=Ol%C3%A1!%20Vi%20o%20Raio-X%20Estrat%C3%A9gico%20da%20%C3%81ion%20Edu%20e%20quero%20saber%20mais.'

function GateScreen({ onStart }: { onStart: () => void }) {
  return (
    <div>
      {/* ── Seção 1 — Hero principal ──────────────────────────────── */}
      <div className="rx-gate-hero" style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 340, height: 340, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -120, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 20px' }}>
          <div className="rx-gate-anim rx-gate-anim-1" style={{
            background: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: '9px 16px', display: 'inline-flex', alignItems: 'center',
            marginBottom: 22, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}>
            <img src={AION_LOGO_B64} alt="Áion Edu" style={{ height: 26, objectFit: 'contain' }} />
          </div>

          <div className="rx-gate-anim rx-gate-anim-2" style={{
            display: 'block', padding: '8px 18px', borderRadius: 999,
            background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)',
            marginBottom: 22,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Atenção, diretores e mantenedores de escolas
            </span>
          </div>

          <h1 className="s-title rx-gate-anim rx-gate-anim-3" style={{ margin: 0, fontSize: 'clamp(28px, 6vw, 48px)', color: '#fff', lineHeight: 1.15 }}>
            VOCÊ JÁ PLANEJOU AS MATRÍCULAS 2027?
          </h1>

          <div className="rx-gate-anim rx-gate-anim-4">
            <p style={{ margin: '20px auto 0', fontSize: 'clamp(14px, 2.4vw, 17px)', color: 'rgba(255,255,255,0.88)', lineHeight: 1.6, maxWidth: 480 }}>
              Descubra gratuitamente como sua escola está posicionada no mercado e identifique oportunidades para crescer.
            </p>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 9, marginTop: 26,
              padding: '11px 20px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.28)',
            }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>🟢</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Receba seu Raio-X Estratégico em menos de 1 minuto.</span>
            </div>
          </div>

          <div className="rx-gate-anim rx-gate-anim-5" style={{ marginTop: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <button type="button" className="btn-white rx-gate-btn" onClick={onStart} style={{ fontSize: 15, padding: '17px 44px' }}>
              GERAR RAIO-X GRATUITO
            </button>
            <a
              href={AION_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost rx-gate-btn"
              style={{ fontSize: 13, padding: '11px 26px' }}
            >
              <WhatsAppIcon size={16} />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* ── Seção 2 — Reforço ──────────────────────────────────────── */}
      <div style={{ background: '#fff', padding: 'clamp(56px, 10vw, 96px) 20px' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="s-title" style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 36px)', color: VD, lineHeight: 1.2 }}>
            DESCUBRA A POSIÇÃO DA SUA ESCOLA.
          </h2>

          <div style={{ marginTop: 36, display: 'inline-flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
            {GATE_CHECKLIST.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CheckIcon />
                <span style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>{item}</span>
              </div>
            ))}
          </div>

          <p style={{ margin: '32px 0 0', fontSize: 18, fontWeight: 800, color: VD }}>Tudo isso gratuitamente.</p>

          <div style={{ marginTop: 26 }}>
            <button type="button" className="btn-g rx-gate-btn" onClick={onStart} style={{ fontSize: 15, padding: '17px 44px' }}>
              FAZER MEU RAIO-X
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── componente ───────────────────────────────────────────────────────────
export default function RaioXPage() {
  // injeta a folha de estilos oficial do site (fontes, .inp, .btn-g, .tag-g etc.) + CSS responsivo da página
  useEffect(() => {
    const shared = document.createElement('style')
    shared.id = 'aion-css'
    shared.textContent = SHARED_CSS
    if (!document.getElementById('aion-css')) document.head.appendChild(shared)

    const own = document.createElement('style')
    own.id = 'raiox-css'
    own.textContent = RAIOX_CSS
    document.head.appendChild(own)

    return () => {
      document.getElementById('aion-css')?.remove()
      document.getElementById('raiox-css')?.remove()
    }
  }, [])

  // portão de entrada — só avança pro fluxo de busca ao clicar num CTA da tela inicial
  const [showGate, setShowGate] = useState(true)

  const [step, setStep] = useState<Step>('search')
  const [searchStage, setSearchStage] = useState<SearchStage>('uf')

  // funil — passo 1: UF
  const [selectedUf, setSelectedUf] = useState('')

  // funil — passo 2: cidade (autocomplete filtrado pela UF)
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<string[]>([])
  const [citySearching, setCitySearching] = useState(false)
  const [cityError, setCityError] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState('')

  // funil — passo 3: escola (universo pré-carregado por UF+cidade, filtro local)
  const [schoolQuery, setSchoolQuery] = useState('')
  const [allSchools, setAllSchools] = useState<SchoolResult[]>([])
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [schoolsError, setSchoolsError] = useState<string | null>(null)
  const [selectedSchool, setSelectedSchool] = useState<SchoolResult | null>(null)

  // formulário de captura
  const [directorName, setDirectorName] = useState('')
  const [role, setRole] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [lgpdAccepted, setLgpdAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // geração do relatório em PDF (Fase C)
  const [pdfState, setPdfState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }
  }, [pdfUrl])

  // carrossel de diferenciais — roda por conta própria por CAROUSEL_TOTAL_MS (12s),
  // independente de quanto tempo o cálculo/PDF real leva. Antes, o intervalo era
  // reiniciado/cancelado toda vez que `pdfState` mudava (efeito com [pdfState] como
  // dependência): se o PDF ficava pronto antes dos 3s do primeiro tick, o carrossel
  // nunca chegava a trocar de card ("não passa"). Agora o timer é disparado uma única
  // vez por geração (via startCarousel, chamado dentro de generateReport) e só é
  // interrompido no unmount ou no fim natural dos 12s.
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [carouselProgress, setCarouselProgress] = useState(0) // 0-100
  const [carouselDone, setCarouselDone] = useState(false)
  const carouselTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (carouselTimerRef.current) clearInterval(carouselTimerRef.current) }
  }, [])

  function startCarousel() {
    if (carouselTimerRef.current) clearInterval(carouselTimerRef.current)
    setHighlightIndex(0)
    setCarouselProgress(0)
    setCarouselDone(false)

    const startedAt = Date.now()
    carouselTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt
      setCarouselProgress(Math.min(100, (elapsed / CAROUSEL_TOTAL_MS) * 100))
      setHighlightIndex(Math.min(AION_HIGHLIGHTS.length - 1, Math.floor(elapsed / CAROUSEL_CARD_MS)))
      if (elapsed >= CAROUSEL_TOTAL_MS) {
        setCarouselDone(true)
        if (carouselTimerRef.current) clearInterval(carouselTimerRef.current)
      }
    }, 100)
  }

  // fade curto a cada troca de card (puramente cosmético, não controla o tempo)
  const [highlightVisible, setHighlightVisible] = useState(true)
  useEffect(() => {
    setHighlightVisible(false)
    const t = setTimeout(() => setHighlightVisible(true), 60)
    return () => clearTimeout(t)
  }, [highlightIndex])

  // ── passo 2: busca de cidades com debounce, escopada pela UF escolhida ────
  useEffect(() => {
    if (searchStage !== 'city' || !selectedUf) return
    const term = cityQuery.trim()
    if (term.length < 1) { setCityResults([]); setCityError(null); return }
    const timer = setTimeout(() => runCitySearch(term), 300)
    return () => clearTimeout(timer)
  }, [cityQuery, searchStage, selectedUf])

  async function runCitySearch(term: string) {
    setCitySearching(true)
    setCityError(null)
    const safeTerm = term.replace(/[,()%*]/g, ' ').trim()
    if (!safeTerm) { setCitySearching(false); setCityResults([]); return }

    const { data, error } = await supabase
      .from('inep_escolas')
      .select('no_municipio')
      .eq('sg_uf', selectedUf)
      .ilike('no_municipio', `%${safeTerm}%`)
      .limit(500)
    setCitySearching(false)

    if (error) {
      setCityError('Não foi possível buscar agora. Tente novamente.')
      setCityResults([])
      return
    }

    const uniq = Array.from(new Set((data ?? []).map(r => r.no_municipio).filter((v): v is string => !!v)))
    uniq.sort((a, b) => a.localeCompare(b, 'pt-BR'))
    setCityResults(uniq.slice(0, 10))
  }

  // ── passo 3: pré-carrega todas as escolas da cidade escolhida (universo já pequeno) ─
  useEffect(() => {
    if (searchStage === 'school' && selectedUf && selectedCity) loadSchools()
  }, [searchStage, selectedUf, selectedCity]) // eslint-disable-line

  async function loadSchools() {
    setLoadingSchools(true)
    setSchoolsError(null)
    const { data, error } = await supabase
      .from('inep_escolas')
      .select('co_entidade, no_entidade, no_municipio, sg_uf, qt_mat_total, ano_censo')
      .eq('sg_uf', selectedUf)
      .eq('no_municipio', selectedCity)
      .order('ano_censo', { ascending: false })
    setLoadingSchools(false)

    if (error) {
      setSchoolsError('Não foi possível carregar as escolas agora. Tente novamente.')
      setAllSchools([])
      return
    }

    // a mesma escola aparece uma vez por ano do censo — mantém só o ano mais recente
    const seen = new Set<string>()
    const deduped: SchoolResult[] = []
    for (const row of (data ?? []) as SchoolResult[]) {
      if (seen.has(row.co_entidade)) continue
      seen.add(row.co_entidade)
      deduped.push(row)
    }
    deduped.sort((a, b) => a.no_entidade.localeCompare(b.no_entidade, 'pt-BR'))
    setAllSchools(deduped)
  }

  const schoolResults = schoolQuery.trim()
    ? allSchools.filter(s => s.no_entidade.toLowerCase().includes(schoolQuery.trim().toLowerCase()))
    : allSchools

  function pickUf(uf: string) {
    setSelectedUf(uf)
    setSearchStage('city')
    setCityQuery('')
    setCityResults([])
    setSelectedCity('')
  }

  function backToUf() {
    setSearchStage('uf')
    setSelectedCity('')
    setCityQuery('')
    setCityResults([])
  }

  function pickCity(cityName: string) {
    setSelectedCity(cityName)
    setSearchStage('school')
    setSchoolQuery('')
  }

  function backToCity() {
    setSearchStage('city')
    setAllSchools([])
    setSchoolQuery('')
  }

  function selectSchool(school: SchoolResult) {
    setSelectedSchool(school)
    setCity(school.no_municipio ?? '')
    setStep('confirm')
  }

  function backToSearch() {
    setSelectedSchool(null)
    setStep('search')
    setSearchStage('school')
  }

  async function generateReport(school: SchoolResult, director: string) {
    setPdfState('loading')
    startCarousel()
    try {
      const metrics = await calculateRaioXMetrics(school.co_entidade, school.no_municipio ?? '', school.sg_uf ?? '')
      if (!metrics) throw new Error('Sem dados suficientes')

      const generatedDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      const blob = await pdf(
        <RaioXPdfDocument data={{ metrics, directorName: director, generatedDate }} />
      ).toBlob()

      setPdfUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
      setPdfState('ready')
    } catch (err) {
      // TODO(diagnóstico): remover depois de identificar a causa real em produção
      console.error('[RaioX] Erro ao gerar relatório:', err instanceof Error ? err.stack ?? err.message : err)
      setPdfState('error')
    }
  }

  const digits = whatsapp.replace(/\D/g, '')
  const canSubmit =
    directorName.trim().length > 1 &&
    role.trim().length > 1 &&
    digits.length >= 10 &&
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    city.trim().length > 1 &&
    lgpdAccepted

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || !selectedSchool || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/raio-x-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          director_name: directorName.trim(),
          role: role.trim(),
          phone: whatsapp.trim(),
          email: email.trim(),
          city: city.trim(),
          state: selectedSchool.sg_uf,
          school_name: selectedSchool.no_entidade,
          co_entidade: selectedSchool.co_entidade,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao enviar. Tente novamente.')
      setStep('success')
      void generateReport(selectedSchool, directorName.trim())
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao enviar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const disabledBtnStyle: React.CSSProperties = {
    background: '#E5E7EB', color: '#9CA3AF', boxShadow: 'none', cursor: 'not-allowed', pointerEvents: 'none',
  }

  // o botão de download só aparece quando os DOIS terminaram: o carrossel (12s fixos)
  // e o cálculo/PDF real — o que demorar mais define o momento
  const showCarousel = pdfState === 'loading' || (pdfState === 'ready' && !carouselDone)
  const showReady = pdfState === 'ready' && carouselDone
  const showError = pdfState === 'error'

  if (showGate) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <GateScreen onStart={() => setShowGate(false)} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="rx-hero" style={{ background: HERO_GRADIENT, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ maxWidth: 620, margin: '0 auto', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: '10px 18px', display: 'inline-flex', alignItems: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            <img src={AION_LOGO_B64} alt="Áion Edu" style={{ height: 30, objectFit: 'contain' }} />
          </div>
          <h1 className="s-title" style={{ margin: 0, fontSize: 30, color: '#fff' }}>
            Raio-X Estratégico da Escola
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
            Descubra gratuitamente como sua escola está posicionada frente à concorrência da sua região — com dados oficiais do Censo Escolar INEP.
          </p>
        </div>
      </div>

      {/* ── Card ─────────────────────────────────────────────────────── */}
      <div className="rx-card-wrap" style={{ maxWidth: 560, position: 'relative', zIndex: 2 }}>
        <div className="rx-card" style={{ background: '#fff', borderRadius: 20, boxShadow: '0 20px 50px rgba(0,82,60,0.18)', border: `1px solid ${BORDER}` }}>

          {step !== 'success' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
              {STEP_LABELS.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: i <= STEP_INDEX[step] ? `linear-gradient(135deg, ${VD}, ${VM})` : '#f1f5f9',
                    color: i <= STEP_INDEX[step] ? '#fff' : '#94a3b8',
                  }}>
                    {i + 1}
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div style={{ width: 24, height: 2, background: i < STEP_INDEX[step] ? VM : '#e5e7eb' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Passo 1: busca em funil (UF → Cidade → Escola) ──────── */}
          {step === 'search' && (
            <div>
              {searchStage === 'uf' && (
                <div>
                  <h2 className="s-title" style={headingStyle}>Em qual estado sua escola está?</h2>
                  <p style={subtextStyle}>Selecione o estado (UF) para começar a busca.</p>
                  <div className="rx-uf-grid">
                    {UFS.map(u => (
                      <button key={u.uf} type="button" className="rx-uf-btn" onClick={() => pickUf(u.uf)}>
                        {u.uf}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchStage === 'city' && (
                <div>
                  <button type="button" style={backLinkStyle} onClick={backToUf}>← {ufName(selectedUf)}</button>
                  <h2 className="s-title" style={headingStyle}>Qual é a cidade?</h2>
                  <p style={subtextStyle}>Digite o nome da cidade em {ufName(selectedUf)}.</p>
                  <input
                    className="inp"
                    value={cityQuery}
                    onChange={e => setCityQuery(e.target.value)}
                    placeholder="Nome da cidade"
                    autoFocus
                  />
                  {cityError && <p style={errStyle}>{cityError}</p>}
                  {citySearching && <p style={hintStyle}>Buscando...</p>}
                  {!citySearching && !cityError && cityQuery.trim().length >= 1 && cityResults.length === 0 && (
                    <p style={hintStyle}>Nenhuma cidade encontrada.</p>
                  )}
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {cityResults.map(c => (
                      <button key={c} type="button" className="rx-list-item" onClick={() => pickCity(c)}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{c}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchStage === 'school' && (
                <div>
                  <button type="button" style={backLinkStyle} onClick={backToCity}>← {selectedCity}/{selectedUf}</button>
                  <h2 className="s-title" style={headingStyle}>Qual é a sua escola?</h2>
                  <p style={subtextStyle}>
                    {loadingSchools ? 'Carregando escolas...' : `${allSchools.length} escola(s) encontrada(s) em ${selectedCity}/${selectedUf}.`}
                  </p>
                  <input
                    className="inp"
                    value={schoolQuery}
                    onChange={e => setSchoolQuery(e.target.value)}
                    placeholder="Filtrar pelo nome da escola"
                  />
                  {schoolsError && <p style={errStyle}>{schoolsError}</p>}

                  {loadingSchools ? (
                    <div style={{ textAlign: 'center', padding: '28px 0' }}>
                      <div style={{ width: 26, height: 26, margin: '0 auto', border: `3px solid ${VM}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'raiox-spin 0.8s linear infinite' }} />
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                      {schoolResults.length === 0 && <p style={hintStyle}>Nenhuma escola encontrada com esse filtro.</p>}
                      {schoolResults.map(r => (
                        <button key={r.co_entidade} type="button" className="rx-list-item" onClick={() => selectSchool(r)}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{r.no_entidade}</div>
                          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                            {r.qt_mat_total != null ? `${r.qt_mat_total.toLocaleString('pt-BR')} matrículas` : 'Matrículas não informadas'} · Censo {r.ano_censo}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Passo 2: confirmação ───────────────────────────────── */}
          {step === 'confirm' && selectedSchool && (
            <div>
              <h2 className="s-title" style={headingStyle}>É esta a sua escola?</h2>
              <p style={subtextStyle}>Confirme os dados antes de continuar.</p>

              <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: 20, background: SOFT }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                    <SchoolIcon size={20} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TEXT }}>{selectedSchool.no_entidade}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: MUTED }}>
                      {selectedSchool.no_municipio ?? '—'}{selectedSchool.sg_uf ? `/${selectedSchool.sg_uf}` : ''}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matrículas totais</p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: TEXT }}>
                      {selectedSchool.qt_mat_total != null ? selectedSchool.qt_mat_total.toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Censo Escolar</p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: TEXT }}>{selectedSchool.ano_censo}</p>
                  </div>
                </div>
              </div>

              <div className="rx-actions" style={{ marginTop: 20 }}>
                <button type="button" className="btn-outline-green" onClick={backToSearch} style={{ flex: '0 0 auto', padding: '12px 18px', fontSize: 13 }}>
                  ← Buscar outra
                </button>
                <button type="button" className="btn-g" onClick={() => setStep('form')} style={{ flex: 1, justifyContent: 'center', fontSize: 13, padding: '12px 18px' }}>
                  Confirmar e continuar
                </button>
              </div>
            </div>
          )}

          {/* ── Passo 3: formulário ────────────────────────────────── */}
          {step === 'form' && selectedSchool && (
            <form onSubmit={handleSubmit}>
              <h2 className="s-title" style={headingStyle}>Seus dados de contato</h2>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: MUTED }}>Enviaremos o Raio-X Estratégico assim que estiver pronto.</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: SOFT, marginTop: 14 }}>
                <SchoolIcon size={14} />
                <span style={{ fontSize: 12.5, color: TEXT, fontWeight: 600 }}>{selectedSchool.no_entidade}</span>
              </div>

              <label style={labelStyle}>Nome do diretor(a) *</label>
              <input className="inp" value={directorName} onChange={e => setDirectorName(e.target.value)} required placeholder="Seu nome completo" />

              <label style={labelStyle}>Cargo *</label>
              <input className="inp" value={role} onChange={e => setRole(e.target.value)} required placeholder="Ex: Diretor(a), Coordenador(a) Pedagógico(a)" />

              <div className="rx-grid2">
                <div>
                  <label style={labelStyle}>WhatsApp *</label>
                  <input className="inp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <label style={labelStyle}>Cidade *</label>
                  <input className="inp" value={city} onChange={e => setCity(e.target.value)} required placeholder="Sua cidade" />
                </div>
              </div>

              <label style={labelStyle}>E-mail *</label>
              <input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 18, cursor: 'pointer' }}>
                <input type="checkbox" checked={lgpdAccepted} onChange={e => setLgpdAccepted(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: VM }} />
                <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
                  Autorizo o uso dos meus dados para receber o Raio-X Estratégico da minha escola, conforme a{' '}
                  <a href="/privacidade" target="_blank" rel="noreferrer" style={{ color: VD, fontWeight: 600 }}>Política de Privacidade</a> e a LGPD. *
                </span>
              </label>

              {submitError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 12 }}>{submitError}</p>}

              <div className="rx-actions" style={{ marginTop: 22 }}>
                <button type="button" className="btn-outline-green" onClick={() => setStep('confirm')} style={{ flex: '0 0 auto', padding: '12px 18px', fontSize: 13 }}>
                  ← Voltar
                </button>
                <button
                  type="submit"
                  className="btn-g"
                  disabled={!canSubmit || submitting}
                  style={{ flex: 1, justifyContent: 'center', fontSize: 14, padding: '13px 18px', ...(!canSubmit || submitting ? disabledBtnStyle : {}) }}
                >
                  {submitting ? 'Enviando...' : 'Gerar meu Raio-X gratuito'}
                </button>
              </div>
            </form>
          )}

          {/* ── Passo 4: relatório (Fase C — geração real do PDF) ──── */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {showCarousel && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 18 }}>
                    <div style={{ width: 16, height: 16, border: `2.5px solid ${VM}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'raiox-spin 0.8s linear infinite', flexShrink: 0 }} />
                    <h2 className="s-title" style={{ margin: 0, fontSize: 17, color: TEXT }}>Gerando seu relatório...</h2>
                  </div>

                  {/* carrossel dos diferenciais Áion */}
                  <div
                    style={{
                      background: SOFT, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '26px 24px',
                      minHeight: 176, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      opacity: highlightVisible ? 1 : 0,
                      transform: highlightVisible ? 'translateY(0)' : 'translateY(6px)',
                      transition: 'opacity 0.35s ease, transform 0.35s ease',
                    }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, boxShadow: '0 4px 14px rgba(0,82,60,0.14)', flexShrink: 0 }}>
                      <HighlightIcon name={AION_HIGHLIGHTS[highlightIndex].icon} size={24} color={VD} />
                    </div>
                    <p className="s-title" style={{ margin: 0, fontSize: 15, color: TEXT, textAlign: 'center' }}>
                      {AION_HIGHLIGHTS[highlightIndex].title}
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: 12.5, color: MUTED, textAlign: 'center', lineHeight: 1.6, maxWidth: 340 }}>
                      {AION_HIGHLIGHTS[highlightIndex].desc}
                    </p>
                  </div>

                  {/* indicador de progresso (5 dots) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 }}>
                    {AION_HIGHLIGHTS.map((h, i) => (
                      <div
                        key={h.title}
                        style={{
                          width: i === highlightIndex ? 18 : 6, height: 6, borderRadius: 3,
                          background: i === highlightIndex ? VD : '#D1D5DB',
                          transition: 'width 0.3s ease, background 0.3s ease',
                        }}
                      />
                    ))}
                  </div>

                  {/* barra de progresso — sincronizada com a troca dos cards (0-100% em 12s) */}
                  <div style={{ height: 5, borderRadius: 3, background: '#E5E7EB', marginTop: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${carouselProgress}%`, borderRadius: 3, background: `linear-gradient(90deg, ${VD}, ${VM})`, transition: 'width 0.1s linear' }} />
                  </div>
                </>
              )}

              {showReady && pdfUrl && selectedSchool && (
                <>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <CheckIcon size={34} />
                  </div>
                  <h2 className="s-title" style={{ margin: 0, fontSize: 19, color: TEXT }}>Seu relatório está pronto!</h2>
                  <p style={{ margin: '10px 0 0', fontSize: 13.5, color: MUTED, lineHeight: 1.6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                    O Raio-X Estratégico de <strong>{selectedSchool.no_entidade}</strong> já pode ser baixado.
                  </p>
                  <a
                    href={pdfUrl}
                    download={`raio-x-${selectedSchool.no_entidade.replace(/\s+/g, '_')}.pdf`}
                    className="btn-g"
                    style={{ marginTop: 20, justifyContent: 'center' }}
                  >
                    Baixar Relatório Gratuito
                  </a>
                </>
              )}

              {showError && (
                <>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <AlertIcon size={30} />
                  </div>
                  <h2 className="s-title" style={{ margin: 0, fontSize: 19, color: TEXT }}>Não foi possível gerar o relatório</h2>
                  <p style={{ margin: '10px 0 0', fontSize: 13.5, color: MUTED, lineHeight: 1.6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                    Seu cadastro foi recebido normalmente, mas houve um problema ao calcular os indicadores. Tente novamente.
                  </p>
                  <button
                    type="button"
                    className="btn-outline-green"
                    onClick={() => selectedSchool && generateReport(selectedSchool, directorName.trim())}
                    style={{ marginTop: 18 }}
                  >
                    Tentar novamente
                  </button>
                </>
              )}

              <style>{`@keyframes raiox-spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
