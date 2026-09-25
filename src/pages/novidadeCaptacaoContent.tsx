// =============================================================================
// src/pages/novidadeCaptacaoContent.tsx
//
// Copy, ícones e imagens da novidade Captação Inteligente. Fonte única pra
// página /novidades/captacao-inteligente (NovidadeCaptacao.tsx) e pro carrossel
// de posts (scripts/novidades-mockups/Carrossel.tsx) — mudou o texto aqui, os
// dois acompanham.
// =============================================================================
import React from 'react'

export const IMG = {
  lista:     '/novidades/img/captacao-gatilhos.jpg',
  modal:     '/novidades/img/captacao-modal.jpg',
  dashboard: '/novidades/img/captacao-dashboard.jpg',
}

// ── Icons ─────────────────────────────────────────────────────────────────
export function Ic({ children, size = 20, color = 'currentColor', stroke = 1.8 }: { children: React.ReactNode; size?: number; color?: string; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
export const IcMegaphone = (p: any) => <Ic {...p}><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></Ic>
export const IcCheck = (p: any) => <Ic {...p}><polyline points="20 6 9 17 4 12" /></Ic>
export const IcArrowRight = (p: any) => <Ic {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Ic>
export const IcChevDown = (p: any) => <Ic {...p}><polyline points="6 9 12 15 18 9" /></Ic>
export const IcLink = (p: any) => <Ic {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Ic>
export const IcMsg = (p: any) => <Ic {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Ic>
export const IcTag = (p: any) => <Ic {...p}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></Ic>
export const IcBarChart = (p: any) => <Ic {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Ic>
export const IcZap = (p: any) => <Ic {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Ic>
export const IcUsers = (p: any) => <Ic {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Ic>
export const IcUserPlus = (p: any) => <Ic {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></Ic>
export const IcSearch = (p: any) => <Ic {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Ic>
// ── Conteúdo ──────────────────────────────────────────────────────────────
export const FLUXO = [
  { Icon: IcMegaphone, title: 'A família vê o anúncio', desc: 'No Instagram, Facebook, Google, TikTok ou no site da escola, e toca no botão de WhatsApp.' },
  { Icon: IcLink, title: 'A mensagem já vem pronta', desc: 'O link wa.me gerado pela Áion abre o WhatsApp com o texto daquela campanha já digitado.' },
  { Icon: IcTag, title: 'A Áion reconhece a campanha', desc: 'Ao chegar, a conversa é marcada com a origem, o lead é criado e a família vai pra pessoa certa.' },
  { Icon: IcBarChart, title: 'Você vê o que dá resultado', desc: 'O dashboard mostra conversas, leads e matrículas de cada anúncio, lado a lado.' },
]

export const POR_QUE = [
  { Icon: IcBarChart, title: 'Investimento guiado por matrícula, não por clique', desc: 'Curtida e clique não pagam mensalidade. Com a origem registrada no primeiro contato, você sabe quais anúncios viram matrícula e onde vale colocar a verba da próxima campanha.' },
  { Icon: IcZap, title: 'Atendimento na hora em que o interesse está alto', desc: 'Quem vem de um anúncio pode pular o robô e cair direto com uma consultora, com uma resposta automática de boas-vindas no mesmo instante.' },
  { Icon: IcSearch, title: 'Chega de "como conheceu a escola?"', desc: 'A família não precisa responder de onde veio, e a equipe não precisa perguntar. A etiqueta da campanha já aparece na conversa e no contato.' },
  { Icon: IcUserPlus, title: 'Nenhum interessado fica fora do funil', desc: 'Todo início de conversa vindo de um anúncio já gera o lead no CRM, com canal de origem e responsável definidos. Ninguém precisa cadastrar à mão.' },
]

export const PASSOS = [
  {
    title: 'Cadastre um gatilho para cada anúncio',
    desc: 'No menu Captação, clique em "Novo gatilho". Dê um nome à campanha, escolha o canal e escreva a mensagem que a família vai enviar. Se quiser, defina uma resposta automática, uma etiqueta e para quem a conversa deve ir.',
    bullets: ['Canais: Meta Ads, Google Ads, Instagram, Facebook, TikTok, site e outros', 'Aviso automático se o texto se sobrepuser a outro gatilho', 'Distribuição em rodízio entre consultoras ou grupos da equipe'],
    img: IMG.modal, alt: 'Tela de criação de gatilho da Captação Inteligente',
  },
  {
    title: 'Copie o link e cole no anúncio',
    desc: 'Cada gatilho gera um link wa.me com o número da escola e o texto já codificado. É só usar esse link como destino do anúncio, da bio ou do botão do site, sem risco de erro de digitação.',
    bullets: ['Botões "Copiar" e "Testar" direto na lista', 'Em anúncios "Clique para WhatsApp" da Meta, dá pra vincular também o ID do anúncio', 'Pause ou reative campanhas com um clique'],
    img: IMG.lista, alt: 'Lista de gatilhos de captação com links wa.me prontos',
  },
  {
    title: 'A conversa chega identificada',
    desc: 'Quando a família envia a mensagem, a Áion reconhece a campanha (sem se confundir com maiúsculas, acentos ou pontuação) e aplica tudo o que você configurou, só no início do atendimento. Uma conversa já em andamento nunca recebe mensagem automática fora de hora.',
    bullets: ['Etiqueta de origem na conversa e no contato', 'Filtro por campanha na lista de Contatos', 'Aviso "Robô não ativado" pra consultora quando a conversa pula o robô'],
    img: null, alt: '',
  },
  {
    title: 'Acompanhe o resultado de cada campanha',
    desc: 'A aba Dashboard compara os gatilhos em 7, 30 ou 90 dias, ou em 12 meses: acionamentos, conversas, leads, matrículas, conversão e o tempo médio até a primeira resposta da equipe.',
    bullets: ['Contagem por primeiro toque: cada família conta pra campanha que a trouxe', 'Excluir um gatilho não apaga o histórico dele no dashboard', 'Tempo de primeira resposta por campanha'],
    img: IMG.dashboard, alt: 'Dashboard da Captação Inteligente com métricas por gatilho',
  },
]

export const FAQ = [
  { q: 'Preciso usar anúncio pago?', a: 'Não. O gatilho funciona com qualquer lugar onde você colocar o link: anúncio da Meta ou do Google, link na bio do Instagram, post orgânico, botão no site, QR code em material impresso. Cada origem pode ter o seu gatilho.' },
  { q: 'E se a família apagar ou mudar o texto da mensagem?', a: 'A identificação é por "contém": pequenas diferenças de maiúsculas, acentos e pontuação não atrapalham. Em anúncios "Clique para WhatsApp" da Meta, você pode vincular o ID do anúncio, e aí a campanha é reconhecida mesmo que a família reescreva a mensagem.' },
  { q: 'O robô de atendimento continua funcionando?', a: 'Continua. Você escolhe por gatilho: manter o fluxo normal do robô ou pular o robô e mandar a conversa direto pra consultoras específicas, em rodízio. O rodízio respeita quem está disponível e fora do horário de almoço.' },
  { q: 'Quem pode configurar?', a: 'Gestores e administradores da escola, pelo menu Captação no painel da Áion Edu. O módulo já está disponível pra todas as escolas com WhatsApp Oficial conectado.' },
]

// Títulos e textos das seções. `hl` é o trecho em destaque (teal) do título.
export const COPY = {
  hero: {
    pill: 'Novidade',
    date: 'Setembro de 2026',
    title: 'Saiba de qual anúncio veio', hl: 'cada matrícula',
    sub: <>Com a <strong style={{ color: '#fff' }}>Captação Inteligente</strong>, cada conversa que chega no WhatsApp da escola já vem marcada com a campanha de origem e vai direto pra pessoa certa. No fim do mês, você sabe exatamente quais anúncios trouxeram matrícula.</>,
  },
  oQueE: {
    tag: 'O que é',
    title: 'Um gatilho por anúncio.', hl: 'Rastreio do clique à matrícula.',
    sub: 'Você cadastra um gatilho para cada campanha, com a mensagem que a família vai mandar. A Áion Edu gera o link e, quando a mensagem chega, reconhece de onde ela veio e cuida do resto.',
  },
  porQue: {
    tag: 'Por que importa',
    title: 'A escola para de investir', hl: 'no escuro',
    sub: 'Na campanha de matrícula, todo real conta. Saber o que funciona é o que separa a escola que cresce da que só aumenta o gasto com anúncio.',
  },
  passos: {
    tag: 'Passo a passo',
    title: 'Da campanha no ar ao resultado', hl: 'em 4 passos',
    sub: <>Tudo no menu <strong>Captação</strong> do painel da Áion Edu, sem planilha e sem depender da agência de marketing.</>,
  },
  cta: {
    cliente: { tag: 'Já é cliente?', title: 'Já está no seu painel', text: <>Entre na Áion Edu e abra o menu <strong style={{ color: '#fff' }}>Captação</strong>. Cadastre o gatilho da sua próxima campanha em menos de 2 minutos.</>, btn: 'Acessar o painel' },
    prospect: { tag: 'Ainda não usa a Áion?', title: 'Veja funcionando na sua escola', text: 'Agende uma reunião e mostramos a Captação Inteligente e o restante da plataforma com o cenário da sua campanha de matrícula.', btn: 'Agendar reunião' },
  },
}
