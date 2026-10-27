import { ArrowRight } from '@phosphor-icons/react'
import { SiteShell } from '../SiteShell'
import { ModIcon } from '../icons'
import { MODULES, MODULE_GROUPS, useSeo } from '../lib'
import { crumbLd } from '../jsonld'

export const HUB = { title: 'Módulos da Áion Edu: CRM, WhatsApp, campanha e matrículas', description: 'Conheça os módulos da Áion Edu: CRM de leads, WhatsApp, robô, captação, vitrine, campanha de matrículas, base de alunos, rematrícula e mais.' }

export default function ModulesHub() {
  useSeo({ ...HUB, path: '/modulos', jsonLd: [crumbLd([{ name: 'Início', path: '/' }, { name: 'Módulos', path: '/modulos' }])] })
  return (
    <SiteShell dark>
      <section className="st-page-hero"><div className="st-wrap">
        <nav className="st-crumb" aria-label="Você está em"><a href="/">Início</a> / Módulos</nav>
        <h1>{MODULES.length} módulos, um sistema só</h1>
        <p style={{ marginTop: 18, fontSize: 19, color: 'rgba(255,255,255,.82)', maxWidth: '56ch' }}>Cada módulo resolve um problema da rotina da escola e todos conversam entre si. Escolha um para ver as telas no computador e no celular.</p>
      </div></section>
      {MODULE_GROUPS.filter(g => MODULES.some(m => m.group === g)).map((g, gi) => (
        <section key={g} className={`st-sec${gi % 2 ? ' st-alt' : ''}`} style={{ paddingBlock: 'clamp(40px,5vw,64px)' }}>
          <div className="st-wrap">
            <h2 className="st-h2" style={{ fontSize: 'clamp(24px,3vw,34px)', marginBottom: 22 }}>{g}</h2>
            <div className="st-grid">
              {MODULES.filter(m => m.group === g).map(m => (
                <a key={m.slug} className="st-card" href={`/modulos/${m.slug}`}>
                  <span className="st-ico" style={{ background: m.bg, color: m.color }}><ModIcon name={m.icon} size={20} /></span>
                  <h3>{m.name}{m.paid && <span className="st-tag" style={{ marginLeft: 8 }}>Módulo à parte</span>}</h3>
                  <p>{m.headline}</p>
                  <span style={{ color: 'var(--g2)', fontWeight: 700, display: 'inline-flex', gap: 6, alignItems: 'center' }}>Ver módulo <ArrowRight size={16} weight="bold" /></span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ))}
    </SiteShell>
  )
}
