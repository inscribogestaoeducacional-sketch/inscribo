import { ICON_DATA } from '../lib/raiox/pdf/iconData'
import AION_LOGO_B64 from '../lib/aionLogo'

const VD = '#00402F', V2 = '#00523C', TEAL = '#00A896', TURQ = '#0DD3BF', AMBAR = '#F5A623', BG = '#F3FAF7', TINTA = '#0B2E25', TXT = '#365a50', MUTED = '#6b8a81'
const WPP = 'https://wa.me/5583993444383?text=Ol%C3%A1!%20Vi%20o%20Raio-X%20Estrat%C3%A9gico%20da%20%C3%81ion%20Edu%20e%20quero%20saber%20mais.'

export const GATE_CSS = `
@font-face { font-family: 'RxBric'; src: url('/fonts/rx-bricolage-800.woff') format('woff'); font-weight: 800; font-display: swap; }
.gt { font-family: 'Plus Jakarta Sans', sans-serif; color: ${TINTA}; }
.gt h1, .gt h2, .gt .gt-num { font-family: 'RxBric', 'Plus Jakarta Sans', sans-serif; font-weight: 800; letter-spacing: -0.02em; }
.gt-hero { position: relative; overflow: hidden; background: linear-gradient(135deg, ${VD} 0%, #00796B 60%, ${TURQ} 130%); padding: 56px 20px 96px; }
.gt-hero::before { content: ''; position: absolute; right: -120px; top: -120px; width: 460px; height: 460px; border-radius: 50%; background: rgba(255,255,255,.07); }
.gt-hero::after { content: ''; position: absolute; left: -90px; bottom: -140px; width: 360px; height: 360px; border-radius: 50%; background: rgba(13,211,191,.2); }
.gt-wrap { position: relative; z-index: 1; max-width: 1060px; margin: 0 auto; }
.gt-cols { display: grid; grid-template-columns: 1.1fr .9fr; gap: 36px; align-items: center; }
.gt-fan { position: relative; height: 430px; }
.gt-fan img { position: absolute; width: 50%; border-radius: 14px; border: 1px solid rgba(255,255,255,.5); box-shadow: 0 24px 50px rgba(0,0,0,.35); background: #fff; }
.gt-fan .a { left: 0; top: 40px; transform: rotate(-9deg); animation: gtFloat 6s ease-in-out infinite; }
.gt-fan .b { left: 24%; top: 0; transform: rotate(2deg); z-index: 2; animation: gtFloat 6s ease-in-out -2s infinite; }
.gt-fan .c { right: 4%; top: 56px; transform: rotate(10deg); animation: gtFloat 6s ease-in-out -4s infinite; }
@keyframes gtFloat { 0%,100% { translate: 0 0 } 50% { translate: 0 -10px } }
@keyframes gtIn { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
.gt-in { opacity: 0; animation: gtIn .7s cubic-bezier(.22,1,.36,1) forwards; }
.gt-chip { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 99px; background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.3); color: #fff; font-size: 13px; font-weight: 700; }
.gt-cta { display: inline-flex; align-items: center; justify-content: center; gap: 10px; border: 0; cursor: pointer; background: #fff; color: ${VD}; font-weight: 800; font-size: 16px; padding: 18px 34px; border-radius: 99px; box-shadow: 0 10px 30px rgba(0,0,0,.28); animation: gtPulse 2.2s ease-in-out infinite; font-family: inherit; }
.gt-cta:hover { transform: translateY(-3px); animation-play-state: paused; }
@keyframes gtPulse { 0%,100% { box-shadow: 0 10px 30px rgba(0,0,0,.28), 0 0 0 0 rgba(255,255,255,.5) } 50% { box-shadow: 0 10px 30px rgba(0,0,0,.28), 0 0 0 14px rgba(255,255,255,0) } }
.gt-cta2 { background: linear-gradient(120deg, ${V2}, #00796B); color: #fff; }
.gt-ghost { display: inline-flex; align-items: center; gap: 8px; color: #fff; font-weight: 700; font-size: 14px; padding: 14px 22px; border-radius: 99px; border: 1.5px solid rgba(255,255,255,.45); text-decoration: none; }
.gt-stats { margin: -54px auto 0; position: relative; z-index: 3; max-width: 960px; display: grid; grid-template-columns: repeat(4, 1fr); background: #fff; border-radius: 28px; padding: 22px 8px; box-shadow: 0 20px 50px rgba(0,64,47,.18); }
.gt-stats > div { text-align: center; padding: 4px 10px; border-left: 2px solid #E3F4EE; }
.gt-stats > div:first-child { border-left: 0; }
.gt-sec { padding: 72px 20px; }
.gt-h2 { font-size: clamp(26px, 4.6vw, 40px); line-height: 1.1; margin: 0; text-align: center; color: ${VD}; }
.gt-sub { max-width: 560px; margin: 12px auto 0; text-align: center; color: ${MUTED}; font-size: 15.5px; line-height: 1.6; }
.gt-ig { background: linear-gradient(135deg, ${VD}, #00796B); color: #fff; position: relative; overflow: hidden; }
.gt-ig .gt-h2 { color: #fff; text-align: left; }
.gt-igc { display: grid; grid-template-columns: .9fr 1.1fr; gap: 40px; align-items: center; }
.gt-igimgs { position: relative; height: 440px; }
.gt-igimgs img { position: absolute; width: 58%; border-radius: 14px; box-shadow: 0 24px 50px rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.4); }
.gt-igimgs .a { left: 0; top: 0; transform: rotate(-4deg); }
.gt-igimgs .b { right: 0; top: 56px; transform: rotate(5deg); }
.gt-li { display: flex; gap: 12px; align-items: flex-start; margin-top: 14px; }
.gt-ico { flex: none; width: 40px; height: 40px; border-radius: 13px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.16); }
.gt-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; max-width: 1060px; margin: 40px auto 0; }
.gt-card { background: #fff; border: 1px solid #DFF0EA; border-radius: 24px; padding: 20px; transition: transform .25s ease, box-shadow .25s ease; }
.gt-card:hover { transform: translateY(-5px); box-shadow: 0 16px 34px rgba(0,82,60,.14); }
.gt-gal { display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 10px 20px 26px; margin: 34px -20px 0; }
.gt-gal figure { flex: none; width: 250px; margin: 0; scroll-snap-align: center; }
.gt-gal img { width: 100%; border-radius: 14px; border: 1px solid #DFF0EA; box-shadow: 0 12px 28px rgba(0,82,60,.15); background: #fff; }
.gt-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 900px; margin: 40px auto 0; }
.gt-faq details { background: #fff; border: 1px solid #DFF0EA; border-radius: 18px; padding: 16px 20px; margin-top: 10px; }
.gt-faq summary { cursor: pointer; font-weight: 800; font-size: 15px; }
.gt-faq p { margin: 10px 0 0; color: ${TXT}; font-size: 14px; line-height: 1.6; }
.gt-final { background: linear-gradient(135deg, ${VD}, #00796B 70%, ${TURQ} 140%); text-align: center; color: #fff; padding: 76px 20px; }
@media (max-width: 860px) {
  .gt-cols, .gt-igc { grid-template-columns: 1fr; }
  .gt-fan { height: 360px; max-width: 420px; margin: 0 auto; width: 100%; }
  .gt-igimgs { height: 380px; max-width: 380px; margin: 0 auto; width: 100%; }
  .gt-stats { grid-template-columns: repeat(2, 1fr); margin-left: 16px; margin-right: 16px; row-gap: 14px; }
  .gt-stats > div:nth-child(3) { border-left: 0; }
  .gt-grid { grid-template-columns: repeat(2, 1fr); }
  .gt-steps { grid-template-columns: 1fr; }
  .gt-ig .gt-h2 { text-align: center; }
  .gt-hero { padding-top: 40px; }
}
@media (max-width: 480px) { .gt-grid { grid-template-columns: 1fr; } .gt-cta { width: 100%; } }
@media (prefers-reduced-motion: reduce) { .gt-fan img, .gt-cta, .gt-in { animation: none; opacity: 1; } }
`

function Ico({ name, size = 22, color = '#fff', sw = 2 }: { name: string; size?: number; color?: string; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {(ICON_DATA[name] ?? []).map(([tag, a], i) => {
        const P: any = { key: i, ...a }
        return tag === 'path' ? <path {...P} /> : tag === 'circle' ? <circle {...P} /> : tag === 'rect' ? <rect {...P} /> : tag === 'line' ? <line {...P} /> : tag === 'polyline' ? <polyline {...P} /> : tag === 'polygon' ? <polygon {...P} /> : null
      })}
    </svg>
  )
}
const Arrow = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></svg>
const Wpp = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.8a9.87 9.87 0 0 1-5.03-1.38l-.36-.22-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.89-9.89 9.89m8.41-18.3A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.68 1.45c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41" /></svg>

const FEATS: [string, string, string][] = [
  ['pin', 'Sua posição na cidade', 'Ranking entre as particulares, por etapa de ensino.'],
  ['trend', 'Crescimento em 5 anos', 'Quanto a escola e a cidade cresceram, e onde os alunos saem.'],
  ['map', 'Mapa de bairros', 'Onde estão as crianças, a renda das famílias e as concorrentes.'],
  ['cap', 'ENEM', 'A nota da escola frente às outras particulares da cidade e do estado.'],
  ['baby', 'Nascimentos e creche', 'A demanda que chega nos próximos anos, com fonte oficial.'],
  ['school', 'Estrutura vs. concorrentes', 'O que as escolas mais próximas oferecem e o que falta à sua.'],
  ['call', 'Nota de atendimento', 'Cinco perguntas mostram onde a matrícula escapa.'],
  ['bot', 'Diagnóstico por IA', 'Resumo escrito a partir dos seus números e as 3 maiores oportunidades.'],
]
const IG: [string, string][] = [
  ['Nota de 0 a 100 do perfil', 'Oito critérios: link e WhatsApp na bio, convite nas legendas, frequência, vídeo e mais.'],
  ['Quanto você posta e quando', 'Posts por dia, gráfico dos últimos 30 posts e o melhor dia da semana.'],
  ['Qual formato engaja', 'Reels, carrossel ou foto: o que a sua família realmente curte e comenta.'],
  ['Matrícula engaja menos que o resto?', 'Comparamos os posts de matrícula com todos os outros, por assunto.'],
  ['3 ajustes que mais mudam o resultado', 'Priorizados pelo peso de cada critério na nota.'],
]
const GAL: [number, string][] = [[2, 'Sua posição'], [3, 'Crescimento'], [6, 'Mapa de bairros'], [5, 'ENEM'], [9, 'Instagram'], [10, 'O que a família responde'], [13, 'Atendimento'], [14, 'Diagnóstico IA']]

export default function RaioXGate({ onStart }: { onStart: () => void }) {
  return (
    <div className="gt">
      <style>{GATE_CSS}</style>

      <section className="gt-hero">
        <div className="gt-wrap">
          <div className="gt-cols">
            <div>
              <div className="gt-in" style={{ animationDelay: '.05s', display: 'inline-flex', background: '#fff', borderRadius: 16, padding: '9px 16px', marginBottom: 22 }}>
                <img src={AION_LOGO_B64} alt="Áion Edu" style={{ height: 26 }} />
              </div>
              <h1 className="gt-in" style={{ animationDelay: '.2s', margin: 0, color: '#fff', fontSize: 'clamp(32px, 6.4vw, 56px)', lineHeight: 1.04 }}>
                VOCÊ JÁ PLANEJOU AS <span style={{ color: AMBAR }}>MATRÍCULAS 2027?</span>
              </h1>
              <p className="gt-in" style={{ animationDelay: '.35s', color: 'rgba(255,255,255,.92)', fontSize: 'clamp(16px, 2.4vw, 19px)', lineHeight: 1.55, margin: '18px 0 0', maxWidth: 520 }}>
                Receba <b>grátis</b> o relatório de inteligência de mercado e de marketing da sua escola: posição na cidade, bairros, ENEM, <b>Instagram</b> e atendimento.
              </p>
              <div className="gt-in" style={{ animationDelay: '.5s', display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                <span className="gt-chip"><Ico name="check" size={15} sw={3} /> 100% grátis</span>
                <span className="gt-chip"><Ico name="library" size={15} /> Dados oficiais</span>
                <span className="gt-chip"><Ico name="timer" size={15} /> PDF na hora</span>
              </div>
              <div className="gt-in" style={{ animationDelay: '.65s', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 30 }}>
                <button type="button" className="gt-cta" onClick={onStart}>GERAR MEU RAIO-X GRÁTIS <Arrow /></button>
                <a className="gt-ghost" href={WPP} target="_blank" rel="noopener noreferrer"><Wpp /> Falar no WhatsApp</a>
              </div>
            </div>
            <div className="gt-fan gt-in" style={{ animationDelay: '.4s' }} aria-hidden>
              <img className="a" src="/raiox/prev-6.jpg" alt="" />
              <img className="c" src="/raiox/prev-9.jpg" alt="" />
              <img className="b" src="/raiox/prev-1.jpg" alt="" />
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: -4, textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,.8)', zIndex: 3 }}>Exemplo com dados fictícios</span>
            </div>
          </div>
        </div>
      </section>

      <div className="gt-stats">
        {[['16', 'páginas de análise'], ['8', 'estudos em um só PDF'], ['4', 'fontes oficiais'], ['R$ 0', 'para gerar']].map(([n, t]) => (
          <div key={t}><div className="gt-num" style={{ fontSize: 'clamp(28px, 5vw, 40px)', color: TEAL, lineHeight: 1 }}>{n}</div><div style={{ fontSize: 13, fontWeight: 700, color: TXT, marginTop: 6 }}>{t}</div></div>
        ))}
      </div>

      <section className="gt-sec gt-ig" style={{ marginTop: 64 }}>
        <div className="gt-wrap gt-igc">
          <div className="gt-igimgs" aria-hidden><img className="a" src="/raiox/prev-10.jpg" alt="" loading="lazy" /><img className="b" src="/raiox/prev-9.jpg" alt="" loading="lazy" /></div>
          <div>
            <span className="gt-chip" style={{ background: AMBAR, borderColor: AMBAR, color: '#3b2600' }}><Ico name="sparkles" size={15} color="#3b2600" /> Novidade, grátis</span>
            <h2 className="gt-h2" style={{ marginTop: 14 }}>INTELIGÊNCIA DE MARKETING DO SEU INSTAGRAM</h2>
            <p style={{ color: 'rgba(255,255,255,.88)', fontSize: 15.5, lineHeight: 1.6, margin: '14px 0 0' }}>Digite o @ da escola e a Áion lê os últimos posts públicos para mostrar o que atrai matrícula e o que está deixando passar.</p>
            {IG.map(([t, d]) => (
              <div className="gt-li" key={t}><div className="gt-ico"><Ico name="check" size={20} sw={3} color={TURQ} /></div><div><div style={{ fontWeight: 800, fontSize: 15.5 }}>{t}</div><div style={{ fontSize: 13.5, opacity: .85, marginTop: 2, lineHeight: 1.5 }}>{d}</div></div></div>
            ))}
            <p style={{ fontSize: 12, opacity: .7, margin: '16px 0 0' }}>Só lemos o que é público. O perfil precisa ser profissional (comercial ou criador).</p>
          </div>
        </div>
      </section>

      <section className="gt-sec" style={{ background: BG }}>
        <h2 className="gt-h2">TUDO QUE VEM NO SEU RAIO-X</h2>
        <p className="gt-sub">Só dados públicos oficiais, comparando apenas escolas particulares. Página sem dado para a sua cidade simplesmente não aparece.</p>
        <div className="gt-grid">
          {FEATS.map(([ic, t, d]) => (
            <div className="gt-card" key={t}>
              <div style={{ width: 46, height: 46, borderRadius: 15, background: `linear-gradient(135deg, ${V2}, ${TEAL})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name={ic} size={24} /></div>
              <div style={{ fontWeight: 800, fontSize: 16, marginTop: 14 }}>{t}</div>
              <div style={{ fontSize: 13.5, color: TXT, marginTop: 5, lineHeight: 1.55 }}>{d}</div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 12.5, color: MUTED, margin: '26px 0 0' }}>Páginas de exemplo, com escola e dados fictícios. No seu relatório, tudo vem dos dados oficiais da sua escola.</p>
        <div className="gt-gal" style={{ marginTop: 10 }} role="list" aria-label="Páginas do relatório">
          {GAL.map(([n, t]) => <figure key={n} role="listitem"><img src={`/raiox/prev-${n}.jpg`} alt={`Página: ${t}`} loading="lazy" /><figcaption style={{ textAlign: 'center', fontWeight: 800, fontSize: 13.5, color: TXT, marginTop: 10 }}>{t}</figcaption></figure>)}
        </div>
      </section>

      <section className="gt-sec" style={{ background: '#fff' }}>
        <h2 className="gt-h2">COMO FUNCIONA</h2>
        <div className="gt-steps">
          {[['1', 'Escolha sua escola', 'Estado, cidade e nome. Achamos no Censo Escolar.'], ['2', 'Responda rápido', 'Seus dados, 5 perguntas de atendimento e o @ do Instagram, se quiser.'], ['3', 'Baixe o PDF', 'Pronto em instantes, no celular ou no computador.']].map(([n, t, d]) => (
            <div key={n} style={{ textAlign: 'center', padding: '0 8px' }}>
              <div className="gt-num" style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto', background: `linear-gradient(135deg, ${V2}, ${TEAL})`, color: '#fff', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>
              <div style={{ fontWeight: 800, fontSize: 17, marginTop: 14 }}>{t}</div><div style={{ color: TXT, fontSize: 14, marginTop: 5, lineHeight: 1.55 }}>{d}</div>
            </div>
          ))}
        </div>
        <div className="gt-faq" style={{ maxWidth: 720, margin: '44px auto 0' }}>
          <details><summary>É grátis mesmo?</summary><p>Sim. Gerar e baixar o relatório não custa nada e não exige cartão.</p></details>
          <details><summary>De onde vêm os dados?</summary><p>INEP (Censo Escolar e ENEM), IBGE (Censo 2022) e Ministério da Saúde (nascimentos). Os números do Instagram vêm do perfil público da escola. A Áion calcula as médias e comparações.</p></details>
          <details><summary>Preciso ter Instagram?</summary><p>Não. Sem o @, o relatório sai sem as páginas de Instagram.</p></details>
          <details><summary>Quanto tempo leva?</summary><p>Poucos minutos entre escolher a escola e baixar o PDF.</p></details>
        </div>
      </section>

      <section className="gt-final">
        <div className="gt-wrap">
          <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.1 }}>DESCUBRA A POSIÇÃO DA SUA ESCOLA.</h2>
          <p style={{ margin: '14px auto 0', maxWidth: 480, opacity: .9, fontSize: 16 }}>Grátis, com dados oficiais e pronto em poucos minutos.</p>
          <div style={{ marginTop: 28 }}><button type="button" className="gt-cta" onClick={onStart}>GERAR MEU RAIO-X GRÁTIS <Arrow /></button></div>
          <div style={{ marginTop: 16 }}><a className="gt-ghost" href={WPP} target="_blank" rel="noopener noreferrer"><Wpp /> Falar com a Áion no WhatsApp</a></div>
        </div>
      </section>
    </div>
  )
}
