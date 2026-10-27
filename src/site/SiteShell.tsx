import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { trackPage, trackEvent, sessionCode, trackingChoice, setTrackingChoice } from './track'
import { List, X, CaretDown, WhatsappLogo, ArrowRight } from '@phosphor-icons/react'
import './site.css'
import { MODULES, MODULE_GROUPS, waLink, WA_DISPLAY } from './lib'
import { ModIcon } from './icons'

const INTEGRATIONS = [
  { href: '/integracoes/whatsapp', label: 'WhatsApp oficial da Meta', icon: 'WhatsappLogo', color: '#16A34A', bg: '#D1FAE5' },
  { href: '/integracoes/activesoft', label: 'Activesoft', icon: 'Plugs', color: '#0D9488', bg: '#CCFBF1' },
  { href: '/integracoes/outros-sistemas', label: 'Outros sistemas', icon: 'Plugs', color: '#4F46E5', bg: '#E0E7FF' },
]
export const GUIDES = [
  { href: '/guias/crm-para-escolas', label: 'CRM para escolas particulares' },
  { href: '/guias/crm-escolar-brasileiro', label: 'CRM escolar brasileiro' },
  { href: '/guias/chatbot-whatsapp-para-escolas', label: 'Chatbot de WhatsApp para escolas' },
  { href: '/guias/whatsapp-api-oficial-para-escolas', label: 'WhatsApp API oficial para escolas' },
  { href: '/guias/como-montar-campanha-de-matricula', label: 'Como montar a campanha de matrícula' },
  { href: '/guias/campanha-de-matriculas-modelo-e-metas', label: 'Campanha de matrículas: modelo e metas' },
  { href: '/guias/como-aumentar-a-rematricula', label: 'Como aumentar a rematrícula' },
  { href: '/guias/funil-de-matriculas', label: 'Funil de matrículas' },
  { href: '/guias/captacao-de-alunos', label: 'Captação de alunos' },
]

export function Btn({ href, kind = 'main', children, external }: { href: string; kind?: 'main' | 'wa' | 'ghost' | 'line'; children: ReactNode; external?: boolean }) {
  return <a href={href} className={`st-btn st-btn-${kind}`} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>
}

export function WaButton({ label = 'Falar com a Áion no WhatsApp', text }: { label?: string; text?: string }) {
  return <Btn kind="wa" href={waLink(text)} external><WhatsappLogo size={22} weight="fill" />{label}</Btn>
}

export function Header({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])
  return (
    <header className={`st-head${dark ? ' dark' : ''}`}>
      <div className="st-wrap st-head-in">
        <a className="st-logo" href="/" aria-label="Áion Edu, página inicial"><img src={dark ? '/site/logo-white.webp' : '/site/logo-color.webp'} alt="Áion Edu" width="130" height="38" /></a>
        <nav className="st-nav" aria-label="Principal">
          <div className="st-dd">
            <button type="button" aria-haspopup="true">Módulos <CaretDown size={13} weight="bold" /></button>
            <div className="st-mega">
              {MODULE_GROUPS.filter(g => MODULES.some(m => m.group === g)).map(g => (
                <div key={g}><h4>{g}</h4>
                  {MODULES.filter(m => m.group === g).map(m => (
                    <a key={m.slug} href={`/modulos/${m.slug}`}><span className="st-ico" style={{ background: m.bg, color: m.color }}><ModIcon name={m.icon} size={19} /></span>{m.name}</a>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="st-dd">
            <button type="button" aria-haspopup="true">Integrações <CaretDown size={13} weight="bold" /></button>
            <div className="st-mega small">
              {INTEGRATIONS.map(i => <a key={i.href} href={i.href}><span className="st-ico" style={{ background: i.bg, color: i.color }}><ModIcon name={i.icon} size={19} /></span>{i.label}</a>)}
            </div>
          </div>
          <div className="st-dd">
            <button type="button" aria-haspopup="true">Guias <CaretDown size={13} weight="bold" /></button>
            <div className="st-mega small">{GUIDES.map(g => <a key={g.href} href={g.href}>{g.label}</a>)}</div>
          </div>
          <a className="st-raiox" href="/raio-x">Raio-X grátis</a>
          <a href="/blog">Blog</a>
          <a href="/sobre">Quem somos</a>
        </nav>
        <div className="st-head-cta">
          <a className="st-btn st-btn-line" href="/entrar">Entrar</a>
          <Btn kind="wa" href={waLink()} external><WhatsappLogo size={20} weight="fill" /><span className="long">Falar com a Áion</span></Btn>
        </div>
        <button type="button" className="st-burger" aria-label={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen(o => !o)}>{open ? <X size={26} /> : <List size={26} />}</button>
      </div>
      {open && createPortal(<div className="st"><div className="st-drawer" role="dialog" aria-label="Menu">
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="st-burger" style={{ display: 'block', color: '#fff' }} aria-label="Fechar menu" onClick={() => setOpen(false)}><X size={28} /></button></div>
          <a href="/raio-x" onClick={() => setOpen(false)} style={{ color: '#2DCBA4' }}>Raio-X grátis da sua escola <ArrowRight size={18} /></a>
          <small>Módulos</small>
          {MODULES.map(m => <a key={m.slug} href={`/modulos/${m.slug}`} onClick={() => setOpen(false)}><ModIcon name={m.icon} size={22} color={m.color} weight="fill" />{m.name}</a>)}
          <small>Integrações</small>
          {INTEGRATIONS.map(i => <a key={i.href} href={i.href}>{i.label}</a>)}
          <small>Guias</small>
          {GUIDES.map(g => <a key={g.href} href={g.href}>{g.label}</a>)}
          <small>Empresa</small>
          <a href="/blog">Blog</a><a href="/sobre">Quem somos</a><a href="/entrar">Entrar</a>
          <div style={{ marginTop: 18 }}><WaButton /></div>
        </div></div>, document.body)}
    </header>
  )
}

export function RaioXBand() {
  return (
    <div className="st-raiox-band">
      <div className="st-wrap st-raiox-in">
        <div><b>Faça o Raio-X da sua escola. É grátis.</b><div style={{ color: '#047857', fontSize: 14 }}>Em poucos minutos você vê onde a campanha de matrículas perde famílias.</div></div>
        <Btn kind="main" href="/raio-x">Fazer o Raio-X <ArrowRight size={18} weight="bold" /></Btn>
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="st-foot">
      <div className="st-wrap">
        <div className="st-foot-grid">
          <div>
            <img src="/site/logo-white.webp" alt="Áion Edu" width="130" height="38" style={{ height: 38, width: 'auto' }} />
            <p style={{ marginTop: 14, maxWidth: 280 }}>Campanha de matrículas, atendimento por WhatsApp e números que batem com o sistema da escola.</p>
            <p style={{ marginTop: 14, fontSize: 12.5, color: 'rgba(255,255,255,.5)' }}>Áion Soluções Tecnológicas LTDA<br />CNPJ 65.835.064/0001-58<br />Patos, Paraíba, Brasil</p>
            <p style={{ marginTop: 14 }}><a href={waLink()} target="_blank" rel="noopener noreferrer" style={{ display: 'inline' }}>WhatsApp {WA_DISPLAY}</a></p>
          </div>
          <div><h4>Módulos</h4>{MODULES.slice(0, 9).map(m => <a key={m.slug} href={`/modulos/${m.slug}`}>{m.name}</a>)}</div>
          <div><h4>Mais módulos</h4>{MODULES.slice(9).map(m => <a key={m.slug} href={`/modulos/${m.slug}`}>{m.name}</a>)}</div>
          <div>
            <h4>Integrações e guias</h4>
            {INTEGRATIONS.map(i => <a key={i.href} href={i.href}>{i.label}</a>)}
            <a href="/guias/crm-para-escolas">CRM para escolas</a>
            <a href="/guias/como-montar-campanha-de-matricula">Montar campanha de matrícula</a>
            <h4 style={{ marginTop: 20 }}>Empresa</h4>
            <a href="/raio-x">Raio-X grátis</a><a href="/sobre">Quem somos</a><a href="/blog">Blog</a><a href="/parceiros">Parceiros</a><a href="/parceria-meta">Parceria Meta</a><a href="/privacidade">Privacidade</a><a href="/termos">Termos de uso</a>
          </div>
        </div>
        <div className="st-foot-bot"><span>© {new Date().getFullYear()} Áion Soluções Tecnológicas Ltda. Todos os direitos reservados.</span><span>Feito no sertão paraibano</span></div>
      </div>
    </footer>
  )
}

function PrivacyNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => { setShow(trackingChoice() === null && (navigator as Navigator & { doNotTrack?: string }).doNotTrack !== '1') }, [])
  if (!show) return null
  const pick = (v: 'yes' | 'no') => { setTrackingChoice(v); setShow(false); if (v === 'yes') trackPage(location.pathname) }
  return (
    <div className="st-cookie" role="dialog" aria-label="Aviso de privacidade">
      <p>Usamos uma medição simples e anônima das visitas para melhorar o site. Não vendemos nem compartilhamos dados. <a href="/privacidade">Saiba mais</a></p>
      <div><button type="button" className="st-cookie-ok" onClick={() => pick('yes')}>Tudo bem</button><button type="button" className="st-cookie-no" onClick={() => pick('no')}>Não medir</button></div>
    </div>
  )
}

/** Mede a visita, o tempo na página e os cliques no WhatsApp (o código da visita vai na mensagem). */
function useSiteTracking() {
  const { pathname } = useLocation()
  useEffect(() => { trackPage(pathname) }, [pathname])
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null
      if (!a) return
      if (a.href.startsWith('https://wa.me/')) {
        const code = sessionCode()
        try {
          const u = new URL(a.href); const t = u.searchParams.get('text') ?? ''
          if (!t.includes('(ref ')) { u.searchParams.set('text', `${t} (ref ${code})`); a.href = u.toString() }
        } catch { /* ignora */ }
        trackEvent('wa_click', code)
      } else if (a.pathname === '/raio-x') trackEvent('raiox_click')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
}

export function SiteShell({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  useSiteTracking()
  return (
    <div className="st">
      <Header dark={dark} />
      <main>{children}</main>
      <RaioXBand />
      <Footer />
      <PrivacyNotice />
      <a className="st-wa-fab" href={waLink()} target="_blank" rel="noopener noreferrer" aria-label="Falar com a Áion no WhatsApp"><WhatsappLogo size={30} weight="fill" /></a>
    </div>
  )
}
