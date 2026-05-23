import React, { useState, useEffect, useRef } from 'react'

function IconMenu({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}
function IconX({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function IconChevronDown({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

const NAV_LINKS = [
  { href: '/', label: 'Início' },
  { href: '/#solucoes', label: 'Módulos' },
  { href: '/sobre', label: 'Quem Somos' },
  { href: '/blog', label: 'Blog' },
  { href: '/parceiros', label: 'Parceiros' },
]

const SOLUCOES_DROPDOWN = [
  { href: '/#solucoes', label: 'CRM de Leads' },
  { href: '/#solucoes', label: 'WhatsApp Oficial' },
  { href: '/#solucoes', label: 'Pipeline de Matrículas' },
  { href: '/#solucoes', label: 'Diagnóstico com IA' },
  { href: '/#solucoes', label: 'Relatórios Mensais' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const linkClass = scrolled ? 'nav-link-scrolled' : 'nav-link'
  const borderColor = scrolled ? '#D1D5DB' : 'rgba(255,255,255,.35)'

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? 'rgba(255,255,255,0.97)' : 'transparent',
      backdropFilter: scrolled ? 'blur(16px)' : 'none',
      boxShadow: scrolled ? '0 1px 28px rgba(0,0,0,0.09)' : 'none',
      transition: 'all .3s ease',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>

        {/* Logo */}
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <img
            src="/aion-logo-full.png"
            alt="ÁION EDU"
            style={{ height: 34, objectFit: 'contain' }}
            onError={e => {
              e.currentTarget.style.display = 'none';
              (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute('style')
            }}
          />
          <span style={{ display: 'none', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: 20, color: scrolled ? '#00523C' : '#fff', letterSpacing: '-.03em' }}>
            ÁION EDU
          </span>
        </a>

        {/* Desktop Links */}
        <div className="nav-links-desktop" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {/* Soluções dropdown */}
          <div style={{ position: 'relative' }}
            onMouseEnter={() => { if (dropTimerRef.current) clearTimeout(dropTimerRef.current); setDropOpen(true) }}
            onMouseLeave={() => { dropTimerRef.current = setTimeout(() => setDropOpen(false), 150) }}
          >
            <button className={linkClass} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Soluções <IconChevronDown color={scrolled ? '#4B5563' : 'rgba(255,255,255,.85)'} />
            </button>
            {dropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: 8, zIndex: 1000, minWidth: 220 }}>
                <div className="nav-dropdown" style={{ position: 'static', top: 'unset', left: 'unset' }}>
                  {SOLUCOES_DROPDOWN.map(item => (
                    <a key={item.label} href={item.href} className="nav-dropdown-item">{item.label}</a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} className={linkClass}>{link.label}</a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="nav-ctas-desktop" style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <a href="/login" style={{
            color: scrolled ? '#374151' : 'rgba(255,255,255,.88)',
            border: `1.5px solid ${borderColor}`,
            padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700,
            textDecoration: 'none', transition: 'all .2s',
          }}>
            Entrar
          </a>
          <a href="/#demo" className="btn-g" style={{ fontSize: 13, padding: '10px 22px' }}>
            Agende uma reunião
          </a>
        </div>

        {/* Mobile Hamburger */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="nav-mobile-btn">
          {menuOpen
            ? <IconX color={scrolled ? '#111827' : '#fff'} />
            : <IconMenu color={scrolled ? '#111827' : '#fff'} />
          }
        </button>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div style={{ background: '#fff', padding: '16px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid #F3F4F6', boxShadow: '0 8px 24px rgba(0,0,0,.1)' }}>
          <a href="/#solucoes" onClick={() => setMenuOpen(false)} style={{ color: '#374151', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>Soluções</a>
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{ color: '#374151', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>{link.label}</a>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <a href="/login" style={{ flex: 1, textAlign: 'center', border: '1.5px solid #D1D5DB', color: '#374151', padding: '11px 0', borderRadius: 999, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>Entrar</a>
            <a href="/#demo" onClick={() => setMenuOpen(false)} style={{ flex: 2, textAlign: 'center', background: '#00523C', color: '#fff', padding: '11px 0', borderRadius: 999, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>Agendar reunião</a>
          </div>
        </div>
      )}
    </nav>
  )
}
