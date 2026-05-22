import React, { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'

// ─── Dados dos artigos ──────────────────────────────────────────────────────
export const POSTS = [
  {
    slug: 'como-estruturar-campanha-matriculas',
    title: 'Como estruturar sua campanha de matrículas antes de agosto',
    category: 'Captação',
    date: 'Março 2026',
    readTime: '5 min',
    excerpt: 'Escolas que planejam com antecedência têm resultados consistentemente melhores. Veja o passo a passo para chegar em agosto pronto.',
    content: `
A campanha de matrículas de uma escola privada não começa em agosto. Ela começa em maio — ou até antes. Escolas que chegam no início do ciclo com um plano estruturado conseguem resultados consistentemente melhores do que aquelas que improvisam.

**Por que planejar antes de agosto?**

Agosto é o mês em que as famílias começam a pensar ativamente na escola do ano que vem. Se você não estiver presente nesse momento com uma proposta clara, a concorrência vai estar. O problema é que, para estar presente em agosto com qualidade, você precisa ter feito a lição de casa antes.

**O passo a passo para uma campanha estruturada**

**1. Analise o histórico dos últimos 3 anos**

Antes de definir qualquer meta, olhe para o que aconteceu antes. Quantos alunos novos entraram em cada ano? Em qual mês as matrículas aconteceram com mais frequência? Qual foi a taxa de rematrícula? Esses dados são a base de tudo.

**2. Defina metas mensais — não anuais**

Uma meta anual de "100 novos alunos" não serve de nada se você não sabe quantos precisam vir em agosto, quantos em setembro e quantos em janeiro. Desdobrar a meta anual em metas mensais permite que você identifique desvios cedo — antes que seja tarde demais para corrigir.

**3. Dimensione sua equipe para o pico**

Campanha de matrículas tem pico. Agosto e setembro concentram a maior parte do volume. Sua equipe de atendimento precisa estar preparada para responder leads em minutos, não em horas. Defina quantas pessoas vão atuar no período e qual é o protocolo de atendimento.

**4. Estruture o funil antes de abrir leads**

Defina os estágios do funil (Novo → Contato feito → Visita agendada → Proposta → Matriculado) e treine a equipe para registrar cada movimentação. Um funil sem registro não existe.

**5. Prepare o canal de WhatsApp**

Se sua escola ainda usa o WhatsApp pessoal de alguém para atender famílias, esse é o maior risco da sua campanha. Configure o número oficial antes do início da campanha.

**Conclusão**

O planejamento antecipado não é burocracia — é a diferença entre uma campanha que você controla e uma campanha que te controla. Com dados, processo e time preparado, você chega em agosto com clareza do que precisa acontecer cada semana.
    `,
  },
  {
    slug: 'por-que-escola-perde-leads',
    title: 'Por que sua escola perde leads sem saber',
    category: 'Gestão',
    date: 'Fevereiro 2026',
    readTime: '4 min',
    excerpt: 'A maioria das escolas perde entre 30% e 50% dos leads por falta de acompanhamento. Veja como isso acontece e como evitar.',
    content: `
A família demonstrou interesse. Mandou mensagem no WhatsApp, preencheu o formulário do site, ou ligou perguntando sobre vagas. E então... nada aconteceu. Três semanas depois ela matriculou o filho na escola ao lado.

Isso acontece todos os dias em escolas privadas brasileiras. E o pior: a escola nem sabe que perdeu esse lead.

**Como os leads desaparecem**

**Sem registro, sem acompanhamento.** Se o contato inicial chegou no WhatsApp pessoal de um atendente e não foi registrado em nenhum sistema, quando aquele atendente ficou ocupado o lead simplesmente esfriou. Sem notificação. Sem segundo contato. Sem chance de recuperação.

**Tempo de resposta longo.** Estudos de comportamento do consumidor mostram que a probabilidade de converter um lead cai drasticamente depois de 5 minutos sem resposta. Famílias que estão pesquisando escola para o filho estão falando com 3 ou 4 opções ao mesmo tempo. Quem responde primeiro sai na frente.

**Falta de follow-up estruturado.** O primeiro contato raramente converte. A maioria das matrículas acontece depois do segundo, terceiro ou quarto contato. Sem um processo de follow-up — com datas e responsáveis definidos — a equipe para no primeiro contato e passa para o próximo lead.

**A família visita e some.** A família veio conhecer a escola, adorou, mas não matriculou na hora. Sem um processo claro de pós-visita, ninguém entra em contato de forma proativa e a família esfria.

**Como resolver**

O problema não é a equipe — é a falta de processo. Com um CRM estruturado, cada lead tem:

- Registro de todos os contatos
- Responsável definido
- Prazo para próximo contato
- Histórico completo de interações

Com esse processo em lugar, sua equipe para de perder leads por omissão e começa a trabalhar com intenção.
    `,
  },
  {
    slug: 'taxa-rematricula',
    title: 'Taxa de rematrícula: como calcular e melhorar',
    category: 'Gestão',
    date: 'Janeiro 2026',
    readTime: '6 min',
    excerpt: 'Reter um aluno custa 5x menos do que captar um novo. Mas a maioria das escolas não sabe calcular corretamente sua taxa de rematrícula.',
    content: `
Reter um aluno existente custa, em média, cinco vezes menos do que captar um aluno novo. Mesmo assim, a maioria das escolas privadas investe toda a energia e o orçamento na captação e negligencia a retenção — muitas vezes sem perceber.

**Por que o cálculo errado atrapalha**

O erro mais comum é calcular a taxa de rematrícula sobre o total de alunos sem descontar os formandos e transferências inevitáveis. Se você tem 300 alunos e 240 renovam, mas 20 eram do último ano do ensino médio (formandos naturais), sua taxa real de retenção é 240/280 = 85,7%, não 80%.

Esse erro faz a escola parecer ter um problema de retenção que não existe — ou esconder um problema real.

**A fórmula correta**

Taxa de rematrícula = Alunos que renovaram ÷ Base elegível para renovação

Base elegível = Total de alunos − Formandos − Transferências inevitáveis (ex.: mudança de cidade)

**O que uma boa taxa significa**

Para escolas de Ensino Fundamental, uma taxa saudável de rematrícula gira entre 85% e 92%. Taxas abaixo de 80% indicam um problema real que precisa ser investigado.

**Como identificar os alunos em risco**

Não espere a campanha de rematrícula para descobrir quem vai sair. Sinais de risco aparecem antes:

- Atrasos frequentes no pagamento da mensalidade
- Reclamações registradas no atendimento
- Nota baixa na pesquisa de satisfação
- Irmãos mais novos que não foram matriculados
- Mudança no envolvimento dos pais com a escola

**Como melhorar a taxa**

A melhora começa com visibilidade. Quando você sabe quais alunos têm risco de não renovar, pode agir antes que a decisão seja tomada. Uma conversa com a família no momento certo — antes da matrícula na concorrência — salva mais alunos do que qualquer campanha de retenção feita tarde.
    `,
  },
  {
    slug: 'whatsapp-business-escolas',
    title: 'WhatsApp Business para escolas: API Oficial vs QR Code',
    category: 'WhatsApp',
    date: 'Dezembro 2025',
    readTime: '5 min',
    excerpt: 'Existe uma diferença enorme entre usar WhatsApp Business com QR Code e usar a API Oficial do Meta. Entenda qual é o risco de cada abordagem.',
    content: `
Toda escola privada brasileira usa WhatsApp para se comunicar com as famílias. Mas existe uma diferença enorme entre usar WhatsApp Business pelo celular — com QR Code — e usar a API Oficial do Meta integrada a um sistema de CRM.

**O problema do QR Code**

Quando sua escola usa WhatsApp Business no celular ou no computador com autenticação por QR Code, você está usando a versão não-oficial da API. Isso significa:

- **Risco de banimento:** O Meta pode bloquear o número sem aviso. Se isso acontecer no meio da campanha de matrículas, você perde o canal de comunicação com todas as famílias em contato.
- **Histórico perdido:** Se o atendente sai da empresa ou troca de celular, o histórico de conversas pode se perder.
- **Sem múltiplos atendentes:** Só uma pessoa por vez consegue atender pelo mesmo número.
- **Sem automação oficial:** Bots e fluxos automatizados feitos fora da API oficial são contra os termos de uso do Meta.

**A API Oficial do Meta**

Com a API Oficial, sua escola tem um número de WhatsApp verificado e registrado no Meta Business. Isso traz:

- **Sem risco de bloqueio:** Você está usando o canal dentro das regras.
- **Múltiplos atendentes:** Toda a equipe atende pelo mesmo número, com histórico completo.
- **Automação real:** Bot de atendimento fora do horário, fluxos personalizados, qualificação automática de leads.
- **Integração com CRM:** Lead que chega pelo WhatsApp já entra no funil automaticamente.

**O que considerar na migração**

A migração de um número de WhatsApp Business comum para a API Oficial exige um processo com o Meta. O número precisa ser um número de linha (não pode ser número que já está no WhatsApp pessoal ativo). Com o parceiro certo, o processo leva de 2 a 5 dias úteis.

**Conclusão**

Se WhatsApp é um canal crítico para sua campanha de matrículas — e é — use a API Oficial. O risco de perder o número no meio da campanha não vale a economia de curto prazo.
    `,
  },
  {
    slug: 'inep-censo-escolar',
    title: 'INEP e Censo Escolar: como usar os dados para sua campanha',
    category: 'Tecnologia',
    date: 'Novembro 2025',
    readTime: '7 min',
    excerpt: 'O INEP publica dados públicos sobre todas as escolas do Brasil. Saiba como usar essas informações para entender seu mercado e definir metas realistas.',
    content: `
O Instituto Nacional de Estudos e Pesquisas Educacionais (INEP) publica, todos os anos, o Censo Escolar — uma das bases de dados mais completas sobre educação básica no Brasil. E a maioria das escolas privadas nunca usa esses dados para planejar a campanha de matrículas.

**O que você consegue do Censo Escolar**

O Censo Escolar contém informações sobre todas as escolas ativas no Brasil: número de alunos matriculados por série, localização, dependência administrativa (pública ou privada), infraestrutura e muito mais.

Para uma escola privada, os dados mais úteis são:

- **Número total de matrículas privadas no seu município por série:** quantos alunos estão disponíveis no seu mercado.
- **Evolução histórica:** o mercado local está crescendo ou encolhendo? Isso impacta diretamente o quanto é possível crescer.
- **Número de escolas privadas concorrentes:** quantas escolas disputam os mesmos alunos.

**Como usar esses dados para definir metas**

Com o dado de total de matrículas privadas na sua cidade, você consegue calcular a participação de mercado da sua escola. Se sua cidade tem 10.000 alunos em escolas privadas e você tem 400, sua participação é de 4%.

A partir desse número, você pode definir metas de crescimento realistas — crescer de 4% para 5% é diferente de crescer de 4% para 8%.

**Benchmark real**

Além dos dados absolutos, os dados do Censo permitem entender a velocidade de crescimento do mercado local. Em municípios onde o número total de matrículas privadas cresce 3% ao ano, uma escola que cresce 3% está apenas acompanhando o mercado. Para crescer de verdade, precisa superar esse índice.

**Conclusão**

Usar dados do INEP não é complexo — é necessário. Uma meta de matrículas que ignora o tamanho real do mercado local é uma meta no escuro.
    `,
  },
  {
    slug: 'funil-matriculas',
    title: 'Funil de matrículas: da captação ao contrato assinado',
    category: 'Captação',
    date: 'Outubro 2025',
    readTime: '6 min',
    excerpt: 'Um funil bem estruturado é a diferença entre uma campanha caótica e uma campanha previsível. Veja como montar o funil certo para a sua escola.',
    content: `
Um funil de matrículas é a representação visual de todos os estágios que uma família percorre desde o primeiro contato com a escola até a assinatura do contrato. Quando o funil está bem estruturado, a equipe sabe exatamente o que fazer em cada momento — e o gestor consegue prever quantas matrículas vão acontecer.

**Os estágios do funil**

**Novo lead:** A família demonstrou interesse pela primeira vez. Pode ter chegado por indicação, Google, Instagram, ou evento. Nesse estágio, o objetivo é qualificar: a família tem filhos na faixa etária certa? Está buscando escola para o ano que vem?

**Contato feito:** A equipe entrou em contato e a família respondeu. Aqui o objetivo é agendar a visita.

**Visita agendada:** A família marcou um horário para conhecer a escola. Esse é o estágio mais crítico: visitas que acontecem têm taxa de conversão muito maior do que famílias que nunca vieram pessoalmente.

**Visita realizada:** A família veio, conheceu a escola, saiu com uma impressão. Agora é o pós-visita: acompanhamento ativo nas próximas 48 horas.

**Proposta enviada:** A escola enviou os valores e condições de pagamento. Nesse estágio, a família está em negociação.

**Matriculado:** Contrato assinado, documentação recebida, primeira mensalidade paga.

**Por que registrar cada estágio**

Sem registro, o funil não existe na prática. Quando você tem os dados de cada estágio, consegue calcular as taxas de conversão entre estágios — e identificar onde está o gargalo.

Se sua taxa de visita para matrícula é alta (acima de 60%) mas sua taxa de agendamento de visita é baixa (menos de 30%), o problema está na qualificação e no agendamento — não na visita em si.

**Conclusão**

Funil de matrículas não é burocracia — é o mapa da campanha. Com o funil registrado e atualizado, você para de trabalhar no escuro e começa a tomar decisões com base no que está realmente acontecendo.
    `,
  },
]

const CATEGORIES = ['Todos', 'Captação', 'Gestão', 'WhatsApp', 'Tecnologia', 'Cases']

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #111827; }
.anim { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
.anim.visible { opacity: 1; transform: none; }
.post-card { background: #fff; border-radius: 20px; border: 1px solid #E5E7EB; overflow: hidden; transition: box-shadow 0.25s, transform 0.25s; cursor: pointer; text-decoration: none; color: inherit; display: block; }
.post-card:hover { box-shadow: 0 12px 40px rgba(0,0,0,0.1); transform: translateY(-4px); }
.post-content h2 { font-size: 22px; font-weight: 800; color: #111827; margin: 28px 0 16px; }
.post-content h3, .post-content strong { font-size: 16px; font-weight: 700; color: #111827; display: block; margin: 20px 0 8px; }
.post-content p { font-size: 15px; color: #374151; line-height: 1.8; margin-bottom: 16px; }
.cat-btn { padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1.5px solid #E5E7EB; background: #fff; color: #6B7280; transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; }
.cat-btn.active { background: #00523C; color: #fff; border-color: #00523C; }
.cat-btn:hover:not(.active) { border-color: #00A896; color: #00523C; }
@media (max-width: 768px) {
  .blog-grid { grid-template-columns: 1fr !important; }
  .nav-links-desktop { display: none !important; }
  .nav-mobile-btn { display: block !important; }
}
@media (max-width: 480px) {
  .footer-grid { grid-template-columns: 1fr !important; }
}
`

function useAnim() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect() } }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

// ─── NAVBAR ─────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, background: scrolled ? 'rgba(255,255,255,0.97)' : 'transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none', boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.3s ease', padding: '0 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img src="/aion-logo-full.png" alt="ÁION EDU" style={{ height: 36, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute('style') }} />
          <span style={{ display: 'none', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 20, color: scrolled ? '#00523C' : 'white' }}>ÁION EDU</span>
        </a>
        <div className="nav-links-desktop" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {[{ href: '/', label: 'Início' }, { href: '/#modulos', label: 'Módulos' }, { href: '/#como-funciona', label: 'Como funciona' }, { href: '/blog', label: 'Blog' }, { href: '/sobre', label: 'Sobre' }, { href: '/parceiros', label: 'Parceiros' }].map(link => (
            <a key={link.href} href={link.href} style={{ color: scrolled ? '#374151' : 'rgba(255,255,255,0.9)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}>{link.label}</a>
          ))}
          <a href="/#demo" style={{ background: '#00A896', color: 'white', padding: '8px 20px', borderRadius: 20, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Agendar demo</a>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="nav-mobile-btn" style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: scrolled ? '#111827' : 'white' }}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
      {menuOpen && (
        <div style={{ background: 'white', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[{ href: '/', label: 'Início' }, { href: '/blog', label: 'Blog' }, { href: '/sobre', label: 'Sobre' }, { href: '/parceiros', label: 'Parceiros' }].map(link => (
            <a key={link.href} href={link.href} style={{ color: '#374151', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>{link.label}</a>
          ))}
          <a href="/#demo" style={{ background: '#00A896', color: 'white', padding: '10px 20px', borderRadius: 20, textDecoration: 'none', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>Agendar demo</a>
        </div>
      )}
    </nav>
  )
}

// ─── FOOTER ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#00523C', color: 'white', padding: '60px 24px 32px' }}>
      <div className="footer-grid" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40, marginBottom: 48 }}>
        <div>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 22, marginBottom: 12 }}>ÁION EDU</div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>A plataforma inteligente para campanhas de matrícula escolar.</p>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>CNPJ: 65.835.064/0001-58<br/>Patos, Paraíba — Brasil</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Produto</div>
          {['Módulos', 'Como funciona', 'Implantação', 'Parceiros'].map(item => (
            <div key={item} style={{ marginBottom: 10 }}><a href="#" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13 }}>{item}</a></div>
          ))}
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Empresa</div>
          {[{ label: 'Sobre nós', href: '/sobre' }, { label: 'Blog', href: '/blog' }, { label: 'Parceiros', href: '/parceiros' }].map(item => (
            <div key={item.label} style={{ marginBottom: 10 }}><a href={item.href} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13 }}>{item.label}</a></div>
          ))}
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Legal</div>
          {[{ label: 'Privacidade', href: '/privacidade' }, { label: 'Termos de uso', href: '/termos' }].map(item => (
            <div key={item.label} style={{ marginBottom: 10 }}><a href={item.href} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13 }}>{item.label}</a></div>
          ))}
          <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            WhatsApp:<br/><a href="https://wa.me/5583933444383" style={{ color: '#0DD3BF', textDecoration: 'none' }}>(83) 9344-4383</a>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>© 2026 ÁION Soluções Tecnológicas Ltda. Todos os direitos reservados.</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Feito com 💚 no sertão paraibano</span>
      </div>
    </footer>
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  Captação: '#00A896',
  Gestão: '#6366F1',
  WhatsApp: '#10B981',
  Tecnologia: '#8B5CF6',
  Cases: '#F59E0B',
  Planejamento: '#00A896',
  CRM: '#6366F1',
  Retenção: '#10B981',
  Dados: '#8B5CF6',
  Processo: '#F59E0B',
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Blog Grid ──────────────────────────────────────────────────────────────
export default function Blog() {
  const r1 = useAnim()
  const [activeCategory, setActiveCategory] = useState('Todos')

  const filtered = activeCategory === 'Todos'
    ? POSTS
    : POSTS.filter(p => p.category === activeCategory)

  return (
    <>
      <style>{CSS}</style>
      <Navbar />

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg,#00523C 0%,#006B50 45%,#00A896 100%)', padding: '110px 24px 72px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 16px', marginBottom: 20 }}>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>Conteúdo para gestores escolares</span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 900, color: '#fff', marginBottom: 16, fontFamily: 'Bricolage Grotesque, sans-serif', lineHeight: 1.15 }}>Blog Áion Edu</h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>Insights e estratégias para gestores de escolas particulares</p>
        </div>
      </section>

      {/* Filtro de categorias */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 24px', position: 'sticky', top: 64, zIndex: 50 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {CATEGORIES.map(cat => (
            <button key={cat} className={`cat-btn${activeCategory === cat ? ' active' : ''}`} onClick={() => setActiveCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de artigos */}
      <section style={{ padding: '60px 24px', background: '#F9FAFB', minHeight: '60vh' }}>
        <div ref={r1} className="anim" style={{ maxWidth: 1000, margin: '0 auto' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Nenhum artigo nesta categoria ainda.</p>
            </div>
          ) : (
            <div className="blog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {filtered.map(post => {
                const color = CATEGORY_COLORS[post.category] || '#00A896'
                const initials = getInitials('Áion Edu')
                return (
                  <Link key={post.slug} to={`/blog/${post.slug}`} className="post-card">
                    <div style={{ background: `linear-gradient(135deg,#00523C,${color})`, height: 8 }} />
                    <div style={{ padding: '22px 22px 26px' }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                        <span style={{ background: `${color}18`, color, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999 }}>{post.category}</span>
                        <span style={{ color: '#9CA3AF', fontSize: 11 }}>⏱ {post.readTime}</span>
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1.4, marginBottom: 10 }}>{post.title}</h3>
                      <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.65, marginBottom: 20 }}>{post.excerpt}</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg,#00523C,#00A896)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>{initials}</div>
                          <span style={{ fontSize: 12, color: '#6B7280' }}>{post.date}</span>
                        </div>
                        <span style={{ fontSize: 13, color: '#00523C', fontWeight: 600 }}>Ler →</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', background: 'linear-gradient(135deg,#00523C,#00A896)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 12, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Pronto para colocar em prática?</h2>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: 28 }}>Conheça a plataforma que coloca tudo isso em um só lugar.</p>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#00523C', padding: '13px 28px', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
          Ver a plataforma →
        </a>
      </section>

      <Footer />
    </>
  )
}

// ─── BlogPost ───────────────────────────────────────────────────────────────
export function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const post = POSTS.find(p => p.slug === slug)

  if (!post) return (
    <>
      <style>{CSS}</style>
      <Navbar />
      <div style={{ padding: '120px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, color: '#111827' }}>Artigo não encontrado</h1>
        <a href="/blog" style={{ color: '#00A896', marginTop: 16, display: 'inline-block' }}>← Voltar ao blog</a>
      </div>
    </>
  )

  function renderContent(text: string) {
    return text.trim().split('\n\n').map((block, i) => {
      const trimmed = block.trim()
      if (!trimmed) return null
      if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
        return <strong key={i}>{trimmed.slice(2, -2)}</strong>
      }
      const parts = trimmed.split(/\*\*(.*?)\*\*/g)
      return (
        <p key={i}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
        </p>
      )
    })
  }

  const color = CATEGORY_COLORS[post.category] || '#00A896'

  return (
    <>
      <style>{CSS}</style>
      <Navbar />

      <section style={{ background: 'linear-gradient(135deg,#00523C,#00A896)', padding: '110px 24px 60px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999 }}>{post.category}</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{post.date} · ⏱ {post.readTime} de leitura</span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: '#fff', lineHeight: 1.3, fontFamily: 'Bricolage Grotesque, sans-serif' }}>{post.title}</h1>
        </div>
      </section>

      <section style={{ padding: '60px 24px 80px', background: '#fff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="post-content">
            {renderContent(post.content)}
          </div>

          <div style={{ marginTop: 48, padding: '32px', background: '#F0FDF9', borderRadius: 16, textAlign: 'center', border: `1px solid ${color}30` }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#00523C', marginBottom: 10, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Pronto para colocar em prática?</h3>
            <p style={{ fontSize: 14, color: '#374151', marginBottom: 20, lineHeight: 1.7 }}>A Áion Edu integra tudo que você acabou de ler em uma só plataforma.</p>
            <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#00523C', color: '#fff', padding: '12px 24px', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
              Conhecer a plataforma →
            </a>
          </div>

          <div style={{ marginTop: 32 }}>
            <a href="/blog" style={{ color: '#00A896', fontSize: 14, textDecoration: 'none', fontWeight: 600 }}>← Voltar ao blog</a>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
