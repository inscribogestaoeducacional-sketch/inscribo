// =============================================================================
// src/pages/novidadeVitrineContent.tsx
//
// Copy, ícones e imagens da novidade Vitrine Áion. Fonte única pra página
// /novidades/vitrine (NovidadeModulo.tsx) e pro carrossel de posts
// (scripts/novidades-mockups/Carrossel.tsx) — mudou o texto aqui, os dois
// acompanham. Imagens geradas por scripts/novidades-mockups/render.mjs --vitrine.
// =============================================================================
import React from 'react'
import type { NovidadeContent } from './NovidadeModulo'
import { Ic, IcLink, IcBarChart, IcUserPlus, IcZap } from './novidadeCaptacaoContent'

export const IMG = {
  editor:     '/novidades/img/vitrine-editor.jpg',
  modelos:    '/novidades/img/vitrine-modelos.jpg',
  pagina:     '/novidades/img/vitrine-pagina.jpg',
  desempenho: '/novidades/img/vitrine-desempenho.jpg',
}

export const IcStore = (p: any) => <Ic {...p}><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" /></Ic>
export const IcPhone = (p: any) => <Ic {...p}><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></Ic>
export const IcPalette = (p: any) => <Ic {...p}><circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" /><circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.56C21.96 6.01 17.46 2 12 2z" /></Ic>
export const IcRefresh = (p: any) => <Ic {...p}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></Ic>

export const FLUXO = [
  { Icon: IcStore, title: 'A escola monta a página', desc: 'No menu Vitrine, escolhe um modelo pronto e adiciona os blocos: WhatsApp, matrícula, redes, horário, perguntas frequentes e mais.' },
  { Icon: IcLink, title: 'Um link em todo lugar', desc: 'O endereço aionedu.com.br/sua-escola vai na bio do Instagram, no anúncio, no e-mail e no QR code do material impresso.' },
  { Icon: IcPhone, title: 'A família resolve na hora', desc: 'Fala no WhatsApp, salva o contato, vê o horário e o caminho, tira dúvidas. Tudo no celular, sem baixar nada.' },
  { Icon: IcUserPlus, title: 'O interesse vira lead', desc: 'O botão de matrícula pelo WhatsApp passa pela Captação Inteligente: a conversa chega marcada com a origem Vitrine.' },
]

export const POR_QUE = [
  { Icon: IcRefresh, title: 'Chega de link desatualizado na bio', desc: 'Mudou o telefone, o horário ou a campanha? Você ajusta no painel e a página muda em cerca de um minuto, sem depender de agência nem de programador.' },
  { Icon: IcPalette, title: 'A cara da escola, sem designer', desc: 'Quatro modelos prontos, cores, pares de fontes, fundo em degradê, imagem ou vídeo. A página fica bonita no primeiro dia, com leitura confortável no celular.' },
  { Icon: IcZap, title: 'Matrícula a um toque', desc: 'Botão de matrícula em destaque (que pode até pulsar), WhatsApp flutuante que acompanha a rolagem e mensagem pronta pra família só tocar em enviar.' },
  { Icon: IcBarChart, title: 'Você vê se está funcionando', desc: 'Visitas e cliques dos últimos 7 dias no próprio editor, e as conversas que começam na página aparecem no dashboard da Captação Inteligente.' },
]

export const PASSOS: NovidadeContent['PASSOS'] = [
  {
    title: 'Escolha um modelo e a cor da escola',
    desc: 'Na aba Aparência, comece por um dos quatro modelos: Essencial, Vibrante, Institucional ou Matrículas. Depois ajuste cores, fontes, fundo e estilo dos botões. Trocar de modelo muda só o visual; blocos e textos continuam lá.',
    bullets: ['Logo e capa em imagem ou vídeo curto', 'Fundo sólido, degradê ou foto com película', 'Trocou de modelo e não gostou? Um clique em Desfazer'],
    img: IMG.modelos, alt: 'Os quatro modelos prontos da Vitrine Áion lado a lado', frame: 'plain', maxWidth: 560,
  },
  {
    title: 'Monte os blocos da página',
    desc: 'Adicione os blocos e mude a ordem arrastando. Ao lado, a prévia ao vivo mostra a página como a família vai ver; clicar num bloco da prévia abre a edição dele.',
    bullets: ['WhatsApp, matrícula, links, banner, galeria e vídeo', 'Perguntas frequentes, depoimentos, equipe e números da escola', 'Horário com "Aberto agora", mapa com várias unidades, PDF e "Salvar contato"'],
    img: IMG.editor, alt: 'Editor da Vitrine com a lista de blocos e a prévia ao vivo no celular', frame: 'browser',
  },
  {
    title: 'Publique e espalhe o link',
    desc: 'Escolha o endereço da página e publique. Ao compartilhar no WhatsApp ou nas redes, o link já aparece com o nome, a descrição e a imagem da escola.',
    bullets: ['Redes sociais em ícones, no topo ou no rodapé', 'Botão de compartilhar na própria página', 'Agende quando a página ou um bloco entra e sai do ar'],
    img: IMG.pagina, alt: 'Página de uma escola de exemplo aberta no celular', frame: 'plain', maxWidth: 360,
  },
  {
    title: 'Acompanhe e ajuste',
    desc: 'A aba Desempenho resume visitas e cliques dos últimos 7 dias. Tudo o que você muda é salvo sozinho, e o selo no topo avisa se algum bloco ficou incompleto.',
    bullets: ['Resumo de visitas e cliques no topo do editor', 'Conversa do botão de matrícula vira lead no CRM', 'Oculte um bloco sem apagar e volte com ele quando quiser'],
    img: IMG.desempenho, alt: 'Aba Desempenho da Vitrine com visitas e cliques', frame: 'browser',
  },
]

export const FAQ = [
  { q: 'Preciso ter site ou domínio próprio?', a: 'Não. A página fica em aionedu.com.br/nome-da-escola, com o endereço que você escolher, se estiver livre. Se a escola já tem site, a Vitrine pode ser o link da bio e levar até ele.' },
  { q: 'A família precisa baixar algum aplicativo?', a: 'Não. A página abre no navegador do celular, leve e rápida. Vídeo do YouTube só carrega quando a pessoa toca no play, pra não pesar no 4G.' },
  { q: 'Posso mudar a página depois de publicada?', a: 'A qualquer momento. Tudo é salvo enquanto você edita, e a página publicada se atualiza em cerca de um minuto. Dá pra ocultar um bloco sem apagar, ou agendar um banner de campanha com data pra entrar e sair do ar.' },
  { q: 'Como sei de onde vieram as matrículas?', a: 'O botão de matrícula pelo WhatsApp cria um gatilho da Captação Inteligente com a origem Vitrine. A conversa chega marcada, o lead entra no CRM e o resultado aparece no dashboard da Captação.' },
  { q: 'Quem pode editar?', a: 'A equipe da escola, pelo menu Vitrine no painel da Áion Edu. O administrador escolhe quem tem acesso em Usuários e permissões.' },
]

export const COPY = {
  hero: {
    pill: 'Novidade',
    date: 'Outubro de 2026',
    title: 'Um link só com', hl: 'tudo o que a família procura',
    sub: <>Com a <strong style={{ color: '#fff' }}>Vitrine Áion</strong>, a escola ganha uma página própria em aionedu.com.br/sua-escola, com WhatsApp, matrícula, redes sociais, horário e endereço num endereço só. Pra bio do Instagram, o anúncio e o QR code do material impresso.</>,
  },
  oQueE: {
    tag: 'O que é',
    title: 'A página da escola.', hl: 'Montada em minutos, sem programador.',
    sub: 'Você escolhe um modelo, adiciona os blocos e publica. A Áion Edu cuida do endereço, da velocidade no celular e de ligar o botão de matrícula à Captação Inteligente.',
  },
  porQue: {
    tag: 'Por que importa',
    title: 'A primeira impressão', hl: 'cabe num toque',
    sub: 'A família chega pelo Instagram ou pelo anúncio e decide em segundos se vai falar com a escola. Um link organizado e atualizado é o que transforma essa visita em conversa.',
  },
  passos: {
    tag: 'Passo a passo',
    title: 'Da página em branco ao link no ar', hl: 'em 4 passos',
    sub: <>Tudo no menu <strong>Vitrine</strong> do painel da Áion Edu, com prévia ao vivo e salvamento automático.</>,
  },
  cta: {
    cliente: { tag: 'Já é cliente?', title: 'Já está no seu painel', text: <>Entre na Áion Edu e abra o menu <strong style={{ color: '#fff' }}>Vitrine</strong>. Escolha um modelo e publique a página da escola hoje mesmo.</>, btn: 'Acessar o painel' },
    prospect: { tag: 'Ainda não usa a Áion?', title: 'Veja a página da sua escola', text: 'Agende uma reunião e mostramos a Vitrine, a Captação Inteligente e o restante da plataforma com o cenário da sua escola.', btn: 'Agendar reunião' },
  },
}

export const NOVIDADE_VITRINE: NovidadeContent = {
  docTitle: 'Novidade: Vitrine Áion — Áion Edu',
  appUrl: 'app.aionedu.com.br/vitrine',
  heroImg: IMG.editor,
  heroAlt: 'Editor da Vitrine Áion com prévia ao vivo da página da escola',
  FLUXO, FLUXO_DESTAQUE: 3, POR_QUE, PASSOS, FAQ, COPY,
}
