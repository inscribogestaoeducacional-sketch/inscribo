import type { Lesson } from '../academy'
import { go, info, click, fill, done } from './helpers'

export const LESSONS_E: Lesson[] = [
  // ───────── RELATÓRIOS ─────────
  {
    key: 'rl_ler', module: 'relatorios', title: 'Abrir um relatório e pedir a análise da IA', minutes: 3, managerOnly: true, to: '/reports', routes: ['/reports'],
    summary: 'Escolher o relatório, o período, baixar a planilha e ler a análise da IA.',
    steps: [
      'Abra Relatórios. As abas são: Leads, WhatsApp, Atendimento, Satisfação, Matrículas, Rematrículas, Contatos e Usuários.',
      'Escolha o período: Este mês, 7 dias, 30 dias, Este ano ou Personalizado.',
      'Leia os números e gráficos da aba.',
      'Toque em "Baixar CSV" para levar os dados para uma planilha.',
      'Toque em "Análise da IA" para receber um resumo com destaques, pontos de atenção e ações sugeridas.',
    ],
    tip: 'Use "Análise da IA" antes das reuniões da equipe. Ela já traz perguntas para a conversa.',
    tour: [
      go('/reports', 'Os relatórios reúnem tudo que o sistema registra.'),
      info('Estas abas trocam o assunto do relatório: Leads, WhatsApp, Atendimento, Satisfação e mais.', { button: 'Matrículas' }),
      click('Toque em "Matrículas" para ver esse relatório.', { button: 'Matrículas' }),
      info('Aqui você escolhe o período do relatório.', { button: 'Este mês' }, 'O período aparece no topo de cada relatório.'),
      info('"Baixar CSV" leva os dados para uma planilha.', { button: 'Baixar CSV' }, 'Este botão aparece na barra de ações do relatório.'),
      info('"Análise da IA" escreve um resumo com pontos de atenção e ações.', { button: 'Análise da IA' }, 'Este botão aparece na barra de ações do relatório.'),
      done('Nesta aula eu não gero nenhuma análise.'),
    ],
  },

  // ───────── PESQUISAS ─────────
  {
    key: 'pq_criar', module: 'pesquisas', title: 'Criar uma pesquisa de satisfação', minutes: 3, managerOnly: true, to: '/pesquisas', routes: ['/pesquisas'],
    summary: 'Montar uma pesquisa e enviar o link para as famílias.',
    steps: [
      'Abra Pesquisas e toque em "Nova pesquisa" no banner.',
      'Escolha o tipo: "Pesquisa padrão do sistema" (7 perguntas prontas, já fica ativa) ou "Criar minha própria pesquisa" (você escolhe as perguntas).',
      'Escreva o "Título da pesquisa *" e, se quiser, a descrição.',
      'Decida se quer "Pedir nome e série da família".',
      'Toque em "Criar pesquisa" (ou "Criar e montar perguntas", na personalizada).',
      'Na janela "Pesquisa criada!", copie o link ou envie pelo WhatsApp para as famílias.',
    ],
    tip: 'Envie a pesquisa perto da rematrícula: ela mostra quem está insatisfeito antes de sair.',
    tour: [
      go('/pesquisas', 'Aqui você cria e acompanha as pesquisas de satisfação.'),
      click('Toque em "Nova pesquisa".', { button: 'Nova pesquisa' }),
      info('Escolha o tipo: a padrão do sistema, ou uma que você monta com as suas perguntas.', { text: 'Pesquisa padrão do sistema', in: 'modal' }),
      info('A "Pesquisa dos colaboradores" é um modelo pronto e anônimo para a equipe.', { text: 'Pesquisa dos colaboradores', in: 'modal' }),
      done('Nesta aula eu não crio nenhuma pesquisa. Escolha um tipo e toque em "Criar pesquisa".'),
    ],
  },
  {
    key: 'pq_resultados', module: 'pesquisas', title: 'Ler as respostas da pesquisa', minutes: 3, managerOnly: true, to: '/pesquisas', routes: ['/pesquisas'],
    summary: 'Ver notas, respostas e o relatório da IA, e saber quem corre risco de sair.',
    steps: [
      'Abra Pesquisas. Os cartões mostram quantas pesquisas estão ativas e quantas respostas chegaram.',
      'Filtre por Todas, Ativas, Rascunhos ou Encerradas.',
      'Toque numa pesquisa para abri-la. Na aba "Visão geral", veja as notas e o risco de rematrícula.',
      'Na aba "Respostas", leia cada família. Na aba "Relatório IA", receba a análise com pontos fortes, fracos e ações.',
      'Para pesquisas personalizadas, "Editar perguntas" permite mudar as perguntas. "Encerrar pesquisa" fecha o recebimento de respostas.',
    ],
    tip: 'Ligue para as famílias que disseram "Ainda não decidi" ou "Provavelmente não" sobre a rematrícula.',
    tour: [
      go('/pesquisas', 'Aqui ficam as pesquisas e os resultados.'),
      info('Estes filtros mostram as pesquisas Todas, Ativas, Rascunhos ou Encerradas.', { text: 'Ativas' }, 'Os filtros aparecem quando a escola já tem pesquisas.'),
      info('Toque numa pesquisa para ver Visão geral, Respostas e Relatório IA.', { text: 'Pesquisa de satisfação' }, 'Quando a escola criar pesquisas, elas aparecem aqui.'),
      done('Acompanhe as respostas toda semana.'),
    ],
  },
]
