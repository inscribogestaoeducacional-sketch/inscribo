import React from 'react'

function IconInstagram({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

const PRODUTO = ['CRM de Leads', 'WhatsApp Oficial', 'Pipeline', 'IA de Campanha', 'Relatórios']
const EMPRESA = [{ label: 'Quem Somos', href: '/sobre' }, { label: 'Blog', href: '/blog' }, { label: 'Parceiros', href: '/parceiros' }]
const LEGAL = [{ label: 'Privacidade', href: '/privacidade' }, { label: 'Termos de uso', href: '/termos' }]

export default function Footer() {
  return (
    <footer style={{ background: '#00301F', color: '#fff', padding: '72px 48px 40px' }}>
      <div className="footer-grid" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 48, marginBottom: 56 }}>

        {/* Brand */}
        <div>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: 24, marginBottom: 14, letterSpacing: '-.03em' }}>ÁION EDU</div>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, lineHeight: 1.75, marginBottom: 20, maxWidth: 220 }}>
            O futuro da campanha de matrícula e do atendimento da sua escola.
          </p>
          <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 12, lineHeight: 1.8 }}>
            CNPJ: 65.835.064/0001-58<br />
            Patos, Paraíba — Brasil
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <a href="https://instagram.com/meuaionedu" target="_blank" rel="noopener noreferrer"
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.7)', transition: 'color .2s, background .2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0DD3BF'; (e.currentTarget as HTMLElement).style.background = 'rgba(13,211,191,.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.7)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.08)' }}
            >
              <IconInstagram size={15} />
            </a>
          </div>
        </div>

        {/* Produto */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Produto</div>
          {PRODUTO.map(item => (
            <div key={item} style={{ marginBottom: 12 }}>
              <a href="/#solucoes" className="footer-link">{item}</a>
            </div>
          ))}
        </div>

        {/* Empresa */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Empresa</div>
          {EMPRESA.map(item => (
            <div key={item.label} style={{ marginBottom: 12 }}>
              <a href={item.href} className="footer-link">{item.label}</a>
            </div>
          ))}
          {LEGAL.map(item => (
            <div key={item.label} style={{ marginBottom: 12 }}>
              <a href={item.href} className="footer-link">{item.label}</a>
            </div>
          ))}
        </div>

        {/* Contato */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Contato</div>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginBottom: 8 }}>WhatsApp</p>
          <a href="https://wa.me/5583993444383" target="_blank" rel="noopener noreferrer" style={{ color: '#0DD3BF', textDecoration: 'none', fontSize: 16, fontWeight: 700, display: 'block', marginBottom: 20 }}>
            (83) 9 9344-4383
          </a>
          <a href="mailto:contato@aionedu.com.br" className="footer-link" style={{ fontSize: 13 }}>
            contato@aionedu.com.br
          </a>
          <div style={{ marginTop: 24 }}>
            <a href="/#demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(13,211,191,.15)', border: '1px solid rgba(13,211,191,.35)', color: '#0DD3BF', padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none', transition: 'background .2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(13,211,191,.25)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(13,211,191,.15)'}
            >
              Agendar demonstração
            </a>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 28, maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ color: 'rgba(255,255,255,.35)', fontSize: 12 }}>© 2026 ÁION Soluções Tecnológicas Ltda. Todos os direitos reservados.</span>
        <span style={{ color: 'rgba(255,255,255,.35)', fontSize: 12 }}>Feito com ♥ no sertão paraibano</span>
      </div>
    </footer>
  )
}
