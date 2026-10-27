import { ArrowRight, WarningCircle, Sparkle } from '@phosphor-icons/react'
import { SiteShell, Btn, WaButton } from '../SiteShell'
import { DeskFrame, PhoneFrame } from '../Devices'
import { ModIcon } from '../icons'
import { MODULES, moduleBySlug, useInView, useSeo } from '../lib'
import { appLd, crumbLd, faqLd } from '../jsonld'

function Rv({ children, d = 0, className = '', style }: { children: React.ReactNode; d?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useInView<HTMLDivElement>()
  return <div ref={ref} className={`st-rv${d ? ` d${d}` : ''} ${className}`} style={style}>{children}</div>
}

export function modulePageMeta(slug: string) {
  const m = moduleBySlug(slug)!
  return { title: `${m.name} para escolas | Áion Edu`, description: `${m.headline}. ${m.sub}` }
}

export default function ModulePage({ slug }: { slug: string }) {
  const m = moduleBySlug(slug)
  const meta = m ? modulePageMeta(slug) : { title: 'Módulo | Áion Edu', description: '' }
  useSeo({ ...meta, path: `/modulos/${slug}`, jsonLd: m ? [appLd(m.name, meta.description, `/modulos/${slug}`), faqLd(m.faq), crumbLd([{ name: 'Início', path: '/' }, { name: 'Módulos', path: '/modulos' }, { name: m.name, path: `/modulos/${slug}` }])] : [] })
  if (!m) return <SiteShell><div className="st-wrap st-sec"><h1>Módulo não encontrado</h1><p><a href="/modulos">Ver todos os módulos</a></p></div></SiteShell>
  const related = [...MODULES.filter(x => x.group === m.group && x.slug !== m.slug), ...MODULES.filter(x => x.group !== m.group && x.slug !== m.slug)].slice(0, 3)
  return (
    <SiteShell dark>
      <section className="st-page-hero">
        <div className="st-wrap">
          <nav className="st-crumb" aria-label="Você está em"><a href="/">Início</a> / <a href="/modulos">Módulos</a> / {m.name}</nav>
          <div className="st-split" style={{ alignItems: 'center' }}>
            <div>
              <span className="st-ico" style={{ background: m.color, color: '#fff', width: 60, height: 60, borderRadius: 18, marginBottom: 20, boxShadow: '0 12px 30px rgba(0,0,0,.3)' }}><ModIcon name={m.icon} size={32} weight="fill" /></span>
              {m.paid && <div><span className="st-tag" style={{ marginBottom: 14 }}>Módulo à parte, com cobrança própria</span></div>}
              <h1 style={{ marginTop: m.paid ? 12 : 0 }}>{m.headline}</h1>
              <p style={{ marginTop: 18, fontSize: 19, color: 'rgba(255,255,255,.82)', maxWidth: '50ch' }}>{m.sub}</p>
              <div className="st-hero-cta"><WaButton text={`Oi! Quero saber mais sobre o módulo ${m.name} da Áion Edu.`} /><Btn kind="ghost" href="/raio-x">Raio-X grátis</Btn></div>
            </div>
            <div className="st-showcase">
              <DeskFrame shot={m.shot} alt={`Tela do módulo ${m.name} no computador`} eager />
              <PhoneFrame shot={m.shot} alt={`Tela do módulo ${m.name} no celular`} eager />
            </div>
          </div>
        </div>
      </section>

      <section className="st-sec">
        <div className="st-wrap st-split">
          <Rv>
            <span className="st-eyebrow" style={{ color: '#B45309' }}>O problema</span>
            <div style={{ display: 'flex', gap: 14, marginTop: 14 }}><WarningCircle size={30} weight="duotone" color="#D97706" style={{ flex: 'none' }} /><p className="st-lead">{m.problem}</p></div>
          </Rv>
          <Rv d={2}>
            <span className="st-eyebrow">A solução</span>
            <div style={{ display: 'flex', gap: 14, marginTop: 14 }}><Sparkle size={30} weight="duotone" color="#05907B" style={{ flex: 'none' }} /><p className="st-lead" style={{ color: 'var(--ink)' }}>{m.solution}</p></div>
          </Rv>
        </div>
      </section>

      <section className="st-sec st-alt">
        <div className="st-wrap">
          <Rv><span className="st-eyebrow">O que o módulo faz</span><h2 className="st-h2" style={{ marginTop: 12 }}>{m.name} na prática</h2></Rv>
          <div className="st-grid" style={{ marginTop: 32 }}>
            {m.features.map((f, k) => (
              <Rv key={f.t} d={k % 3} className="st-card"><span className="st-ico" style={{ background: m.bg, color: m.color }}><ModIcon name={m.icon} size={20} /></span><h3>{f.t}</h3><p>{f.d}</p></Rv>
            ))}
          </div>
        </div>
      </section>

      <section className="st-sec">
        <div className="st-wrap">
          <Rv><span className="st-eyebrow">Computador e celular</span><h2 className="st-h2" style={{ marginTop: 12, maxWidth: 720 }}>As duas telas do módulo, do jeito que a equipe usa</h2></Rv>
          <Rv d={1}><div className="st-showcase" style={{ marginTop: 32 }}>
            <DeskFrame shot={m.shot} alt={`${m.name} no computador`} />
            <PhoneFrame shot={m.shot} alt={`${m.name} no celular`} />
          </div></Rv>
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--mut)' }}>Telas do app com dados de exemplo do Colégio Áion Edu, uma escola fictícia.</p>
        </div>
      </section>

      <section className="st-sec st-alt">
        <div className="st-wrap">
          <Rv style={{ textAlign: 'center' }}><span className="st-eyebrow">Perguntas frequentes</span><h2 className="st-h2" style={{ marginTop: 12 }}>Sobre {m.name}</h2></Rv>
          <div className="st-faq">{m.faq.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        </div>
      </section>

      <section className="st-sec">
        <div className="st-wrap">
          <h2 className="st-h2" style={{ marginBottom: 28 }}>Outros módulos que andam junto</h2>
          <div className="st-grid">
            {related.map(r => (
              <a key={r.slug} className="st-card" href={`/modulos/${r.slug}`}><span className="st-ico" style={{ background: r.bg, color: r.color }}><ModIcon name={r.icon} size={20} /></span><h3>{r.name}</h3><p>{r.sub}</p><span style={{ color: 'var(--g2)', fontWeight: 700, display: 'inline-flex', gap: 6, alignItems: 'center' }}>Ver módulo <ArrowRight size={16} weight="bold" /></span></a>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
