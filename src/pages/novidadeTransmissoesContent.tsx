// =============================================================================
// src/pages/novidadeTransmissoesContent.tsx
//
// Copy, ícones e imagens da novidade Transmissões. Fonte única pra página
// /novidades/transmissoes (NovidadeModulo.tsx) e pro carrossel de posts
// (scripts/novidades-mockups/Carrossel.tsx). Imagens geradas por
// scripts/novidades-mockups/render.mjs --transmissoes.
// Sem valores em reais de propósito: a tabela de preço com os valores
// definitivos ainda não existe (só a versão de teste). Quando existir, o
// preço pode entrar no FAQ "Quanto custa?".
// =============================================================================
import React from 'react'
import type { NovidadeContent } from './NovidadeModulo'
import { Ic, IcMsg, IcTag, IcUsers, IcBarChart } from './novidadeCaptacaoContent'

export const IMG = {
  detalhe:   '/novidades/img/transmissoes-detalhe.jpg',
  publico:   '/novidades/img/transmissoes-publico.jpg',
  respostas: '/novidades/img/transmissoes-respostas.jpg',
  mensagem:  '/novidades/img/transmissoes-mensagem.jpg',
}

export const IcSend = (p: any) => <Ic {...p}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></Ic>
export const IcShield = (p: any) => <Ic {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Ic>
export const IcCalc = (p: any) => <Ic {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="16" y1="14" x2="16" y2="18" /><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" /></Ic>
export const IcUserX = (p: any) => <Ic {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" /></Ic>

export const FLUXO = [
  { Icon: IcMsg, title: 'Escolha a mensagem', desc: 'Um template aprovado pela Meta, criado pela escola ou um dos modelos da Áion, com texto, imagem ou vídeo e botões de resposta.' },
  { Icon: IcUsers, title: 'Defina quem recebe', desc: 'Filtre por etiqueta, turma, tipo de contato, gatilho da Captação ou campanha anterior, ou importe uma planilha.' },
  { Icon: IcCalc, title: 'Veja o custo e confirme', desc: 'O valor aparece antes do envio. A cobrança sai pelo Asaas e a campanha é liberada sozinha quando o pagamento é confirmado.' },
  { Icon: IcBarChart, title: 'Acompanhe as respostas', desc: 'Enviadas, entregues, lidas e respondidas, cliques em cada botão, e quem respondeu vai direto pra pessoa certa da equipe.' },
]

export const POR_QUE = [
  { Icon: IcShield, title: 'Do número oficial, não do celular de alguém', desc: 'Nada de lista de transmissão no WhatsApp pessoal ou chip avulso. A campanha sai do número oficial da escola, com mensagem aprovada pela Meta.' },
  { Icon: IcUsers, title: 'Cada família recebe pelo nome', desc: 'As variáveis preenchem o primeiro nome, a turma ou qualquer coluna da planilha. Quem não tiver o dado recebe um texto padrão que você define.' },
  { Icon: IcTag, title: 'Nenhuma resposta fica sem dono', desc: 'Quem responde ou toca num botão pode ganhar uma etiqueta e cair direto com uma atendente, em rodízio, sem passar pelo robô.' },
  { Icon: IcUserX, title: 'Quem não quer receber, não recebe', desc: 'Respondeu "parar" ou tocou no botão "Parar"? Sai das próximas campanhas de marketing na hora. Números bloqueados ou inválidos ficam de fora sozinhos.' },
]

export const PASSOS: NovidadeContent['PASSOS'] = [
  {
    title: 'Crie ou escolha o template',
    desc: 'Na aba Templates, escreva a mensagem com variáveis, coloque imagem ou vídeo no cabeçalho e até 10 botões, como "Tenho interesse" e "Parar". A Áion envia o template pra aprovação da Meta, e você acompanha a situação ali mesmo.',
    bullets: ['Modelos da Áion prontos pra usar', 'Cabeçalho com texto, imagem ou vídeo', 'Botões de resposta rápida ou de link'],
    img: IMG.mensagem, alt: 'Ilustração de uma campanha recebida no WhatsApp, com imagem e botões', frame: 'plain', maxWidth: 400,
  },
  {
    title: 'Escolha quem recebe',
    desc: 'Combine filtros ou importe uma planilha. A lista aparece com todo mundo marcado: desmarque quem não deve receber, ou busque um contato pra incluir. O total de destinatários se atualiza na hora.',
    bullets: ['Etiqueta, turma, tipo de contato, gatilho da Captação e campanha anterior', 'Planilha CSV ou Excel, com a confirmação de autorização que a Meta exige', 'Opt-out, bloqueados e números inválidos ficam de fora sozinhos'],
    img: IMG.publico, alt: 'Etapa de público da nova campanha, com filtros e lista de contatos', frame: 'plain', maxWidth: 560,
  },
  {
    title: 'Decida o que acontece na resposta',
    desc: 'Para cada botão, e para qualquer resposta, escolha uma etiqueta e se a conversa pula o robô e vai pra uma atendente. Depois, envie assim que a campanha for liberada ou agende.',
    bullets: ['Rodízio entre atendentes ou grupos da equipe', 'Envio respeita o limite por hora e por dia da escola', 'Pause, retome ou cancele quando quiser'],
    img: IMG.respostas, alt: 'Etapa de mensagem e respostas da nova campanha', frame: 'plain', maxWidth: 560,
  },
  {
    title: 'Acompanhe o resultado',
    desc: 'O detalhe da campanha mostra destinatários, enviadas, entregues, lidas, respostas e falhas, os cliques em cada botão e a situação de cada contato.',
    bullets: ['Mensagem paga que não saiu vira crédito pra próxima campanha', 'Filtro por quem respondeu', 'Cobranças e crédito nas Configurações da escola, aba Transmissões'],
    img: IMG.detalhe, alt: 'Detalhe de uma campanha com enviadas, entregues, lidas e respostas', frame: 'browser',
  },
]

export const FAQ = [
  { q: 'Quanto custa?', a: 'Você paga por mensagem enviada. O valor depende da categoria do template (marketing ou utilidade) e aparece na tela antes de você confirmar a campanha. Mensagem paga que não sair vira crédito pra próxima.' },
  { q: 'Posso enviar pra uma lista que não está na Áion?', a: 'Pode. Importe uma planilha (CSV ou Excel) com telefone, nome e outras colunas que quiser usar na mensagem. Os contatos entram na base da escola, e você confirma que essas pessoas autorizaram receber mensagens, como a Meta exige.' },
  { q: 'E se a pessoa não quiser mais receber?', a: 'Ela responde "parar" (ou toca no botão "Parar") e sai das próximas campanhas de marketing. A lista fica na aba "Não recebem", onde a escola pode reativar alguém que pedir pra voltar.' },
  { q: 'A resposta vira lead?', a: 'A conversa é ligada ao lead que a família já tem no CRM, se houver, e segue a regra de resposta que você definiu: etiqueta, atendente ou robô. A campanha não cria lead novo sozinha.' },
  { q: 'Como libero na minha escola?', a: 'As Transmissões são ativadas pela equipe da Áion pra cada escola com WhatsApp Oficial conectado, com limite de envio por hora e por dia. Fale com a gente pra ligar.' },
]

export const COPY = {
  hero: {
    pill: 'Novidade',
    date: 'Outubro de 2026',
    title: 'Fale com todas as famílias', hl: 'pelo WhatsApp oficial',
    sub: <>Com as <strong style={{ color: '#fff' }}>Transmissões</strong>, a escola envia campanhas pelo WhatsApp com mensagem aprovada pela Meta: rematrícula, eventos, avisos e captação. Você escolhe o público, vê o custo antes e acompanha quem recebeu, leu e respondeu.</>,
  },
  oQueE: {
    tag: 'O que é',
    title: 'Campanha no WhatsApp.', hl: 'Com público, custo e resultado à vista.',
    sub: 'Você escolhe a mensagem e quem recebe. A Áion Edu calcula o valor, libera o envio quando o pagamento cai, respeita os limites da Meta e organiza as respostas.',
  },
  porQue: {
    tag: 'Por que importa',
    title: 'O recado chega', hl: 'onde a família lê',
    sub: 'E-mail fica sem abrir e o recado na agenda se perde na mochila. O WhatsApp é onde a família responde, e campanha bem feita ali vira rematrícula, presença no evento e conversa de matrícula.',
  },
  passos: {
    tag: 'Passo a passo',
    title: 'Da mensagem às respostas', hl: 'em 4 passos',
    sub: <>Tudo no menu <strong>Transmissões</strong> do painel da Áion Edu, com o assistente de nova campanha guiando cada etapa.</>,
  },
  cta: {
    cliente: { tag: 'Já é cliente?', title: 'Peça a ativação', text: <>As Transmissões são ativadas pela equipe da Áion. Com o módulo ligado, o menu <strong style={{ color: '#fff' }}>Transmissões</strong> aparece no seu painel.</>, btn: 'Acessar o painel' },
    prospect: { tag: 'Ainda não usa a Áion?', title: 'Veja uma campanha de verdade', text: 'Agende uma reunião e mostramos as Transmissões, o WhatsApp Oficial e o restante da plataforma com o cenário da sua escola.', btn: 'Agendar reunião' },
  },
}

export const NOVIDADE_TRANSMISSOES: NovidadeContent = {
  docTitle: 'Novidade: Transmissões — Áion Edu',
  appUrl: 'app.aionedu.com.br/transmissoes',
  heroImg: IMG.detalhe,
  heroAlt: 'Detalhe de uma campanha de Transmissões com os números de envio e respostas',
  FLUXO, FLUXO_DESTAQUE: 2, POR_QUE, PASSOS, FAQ, COPY,
}
