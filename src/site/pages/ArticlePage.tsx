// Página de integração ou de guia (conteúdo vem de integrations.json e guides.json).
import { ArrowRight, CheckCircle } from '@phosphor-icons/react'
import { SiteShell, Btn, WaButton, GUIDES } from '../SiteShell'
import { DeskFrame, PhoneFrame } from '../Devices'
import { ModIcon } from '../icons'
import { moduleBySlug, useInView, useSeo } from '../lib'
import { appLd, crumbLd, faqLd } from '../jsonld'
import integrations from '../content/integrations.json'
import guides from '../content/guides.json'

type Section = { h: string; ps?: string[]; items?: { t: string; d: string }[]; steps?: { t: string; d: string }[]; shot?: string }
export type Article = { path: string; title: string; description: string; h1: string; intro: string[]; related?: string[]; sections: Section[]; faq: { q: string; a: string }[] }
const ALL = [...(integrations as Article[]), ...(guides as Article[])]

function Rv({ children, d = 0, className = '' }: { children: React.ReactNode; d?: number; className?: string }) {
  const ref = useInView<HTMLDivElement>()
  return <div ref={ref} className={`st-rv${d ? ` d${d}` : ''} ${className}`}>{children}</div>
}

export default function ArticlePage({ path }: { path: string }) {
  const a = ALL.find(x => x.path === path)
  const isGuide = path.startsWith('/guias/')
  useSeo({
    title: a?.title ?? 'Página não encontrada | Áion Edu', description: a?.description ?? '', path,
    jsonLd: a ? [appLd(a.h1, a.description, path), ...(a.faq.length ? [faqLd(a.faq)] : []), crumbLd([{ name: 'Início', path: '/' }, { name: a.h1, path }])] : [],
  })
  if (!a) return <SiteShell><div className="st-wrap st-sec"><h1>Página não encontrada</h1><p><a href="/">Voltar ao início</a></p></div></SiteShell>
  const rel = (a.related ?? []).map(moduleBySlug).filter(Boolean) as NonNullable<ReturnType<typeof moduleBySlug>>[]
  const otherGuides = GUIDES.filter(g => g.href !== path).slice(0, 4)
  return (
    <SiteShell dark>
      <section className="st-page-hero">
        <div className="st-wrap">
          <nav className="st-crumb" aria-label="Você está em"><a href="/">Início</a> / {isGuide ? 'Guias' : 'Integrações'}</nav>
          <h1 style={{ maxWidth: '22ch' }}>{a.h1}</h1>
          {a.intro.map((t, i) => <p key={i} style={{ marginTop: 18, fontSize: 19, color: 'rgba(255,255,255,.82)', maxWidth: '62ch' }}>{t}</p>)}
          <div className="st-hero-cta"><WaButton text={`Oi! Li a página "${a.h1}" e quero falar com a Áion.`} /><Btn kind="ghost" href="/raio-x">Raio-X grátis</Btn></div>
        </div>
      </section>

      {a.sections.map((s, i) => (
        <section key={s.h} className={`st-sec${i % 2 ? ' st-alt' : ''}`}>
          <div className="st-wrap">
            <Rv><h2 className="st-h2" style={{ maxWidth: 760 }}>{s.h}</h2></Rv>
            {s.ps?.map((p, k) => <Rv key={k}><p className="st-lead" style={{ marginTop: 16, maxWidth: '68ch', color: 'var(--ink)' }}>{p}</p></Rv>)}
            {s.items && <div className="st-grid" style={{ marginTop: 28 }}>{s.items.map((it, k) => <Rv key={it.t} d={k % 3} className="st-card"><span className="st-ico" style={{ background: '#D1FAE5', color: '#047857' }}><CheckCircle size={20} weight="fill" /></span><h3>{it.t}</h3><p>{it.d}</p></Rv>)}</div>}
            {s.steps && <ol className="st-steps">{s.steps.map((st, k) => <li key={st.t}><span className="st-step-n">{k + 1}</span><div><h3>{st.t}</h3><p>{st.d}</p></div></li>)}</ol>}
            {s.shot && <Rv d={1}><div className="st-showcase" style={{ marginTop: 32 }}><DeskFrame shot={s.shot} alt={`Tela: ${s.h}, no computador`} /><PhoneFrame shot={s.shot} alt={`Tela: ${s.h}, no celular`} /></div><p style={{ marginTop: 12, fontSize: 13, color: 'var(--mut)' }}>Telas do app com dados de exemplo do Colégio Áion Edu, uma escola fictícia.</p></Rv>}
          </div>
        </section>
      ))}

      {a.faq.length > 0 && (
        <section className="st-sec st-alt"><div className="st-wrap">
          <Rv><h2 className="st-h2" style={{ textAlign: 'center' }}>Perguntas frequentes</h2></Rv>
          <div className="st-faq">{a.faq.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        </div></section>
      )}

      <section className="st-sec">
        <div className="st-wrap">
          {rel.length > 0 && <>
            <h2 className="st-h2" style={{ marginBottom: 28 }}>Módulos ligados a este assunto</h2>
            <div className="st-grid">{rel.map(r => (
              <a key={r.slug} className="st-card" href={`/modulos/${r.slug}`}><span className="st-ico" style={{ background: r.bg, color: r.color }}><ModIcon name={r.icon} size={20} /></span><h3>{r.name}</h3><p>{r.sub}</p><span style={{ color: 'var(--g2)', fontWeight: 700, display: 'inline-flex', gap: 6, alignItems: 'center' }}>Ver módulo <ArrowRight size={16} weight="bold" /></span></a>
            ))}</div>
          </>}
          <h3 style={{ margin: '40px 0 12px', fontSize: 18 }}>Continue lendo</h3>
          <ul className="st-linklist">{otherGuides.map(g => <li key={g.href}><a href={g.href}>{g.label}</a></li>)}<li><a href="/integracoes/whatsapp">Integração com o WhatsApp oficial</a></li><li><a href="/integracoes/activesoft">Integração com a Activesoft</a></li></ul>
        </div>
      </section>
    </SiteShell>
  )
}
