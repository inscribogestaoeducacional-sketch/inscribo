import type { Lesson } from '../academy'
import { go, info, click, fill, done } from './helpers'

export const LESSONS_C: Lesson[] = [
  // ───────── CAPTAÇÃO ─────────
  {
    key: 'cp_nova', module: 'captacao', title: 'Criar uma captação para um anúncio', minutes: 4, to: '/captacao', routes: ['/captacao'],
    summary: 'Cadastrar o texto do anúncio para saber de qual campanha veio cada conversa.',
    steps: [
      'Abra Captação e toque em "Nova captação" no banner verde.',
      'Em "Nome da campanha", escreva um nome que você reconheça, por exemplo "Matrículas 2027 — Infantil (Instagram)".',
      'Em "Canal", escolha onde o anúncio roda (Meta Ads, Instagram orgânico, Site e outros).',
      'Em "Texto da mensagem pré-preenchida", escreva o texto que a família vai enviar ao tocar no anúncio. Ele precisa ser diferente de outras captações.',
      'Copie o "Link para o anúncio" e use no anúncio, no site ou no Instagram.',
      'Se quiser, escreva uma "Resposta automática (opcional)", uma "Etiqueta de origem", ligue "Pular o robô de atendimento" e escolha "Distribuir para" quem recebe as conversas.',
      'Toque em "Criar gatilho".',
    ],
    tip: 'Use um texto pré-preenchido único para cada anúncio. É assim que o sistema sabe de qual anúncio veio a conversa.',
    tour: [
      go('/captacao', 'Esta é a Captação Inteligente. Cada captação liga um anúncio às conversas que ele traz.'),
      click('Toque em "Nova captação" para criar uma.', { button: 'Nova captação' }),
      fill('Dê um nome que você reconheça.', { label: 'Nome da campanha', in: 'modal' }),
      info('Escolha o canal onde o anúncio roda.', { label: 'Canal', in: 'modal' }),
      fill('Escreva a mensagem que a família vai enviar ao tocar no anúncio.', { label: 'Texto da mensagem pré-preenchida', in: 'modal' }),
      info('Este é o link para usar no anúncio. Quando houver texto, você pode copiá-lo aqui.', { text: 'Link para o anúncio', in: 'modal' }),
      info('Para salvar, você toca em "Criar gatilho". Nesta aula eu não salvo nada.', { button: 'Criar gatilho', in: 'modal' }),
      done('Agora você sabe criar uma captação.'),
    ],
  },
  {
    key: 'cp_resultados', module: 'captacao', title: 'Ver o que cada captação trouxe', minutes: 3, to: '/captacao', routes: ['/captacao'],
    summary: 'Comparar acionamentos, conversas, leads, visitas e matrículas por captação.',
    steps: [
      'Abra Captação. Na aba "Resumo", escolha o período: 7 dias, 30 dias, 90 dias ou 12 meses.',
      'Os números mostram Acionamentos, Conversas, Leads, Visitas e Matrículas, comparados com o período anterior.',
      'Em "Buscar captação" e nos filtros Todas, Ativas, Pausadas e Vitrine, ache a que você quer ver.',
      'Toque em "Detalhes" para ver os leads trazidos por aquela captação.',
      'Na aba "Comparar", coloque duas ou mais captações lado a lado para ver qual traz mais matrícula.',
      'No cartão de cada captação, os botões "Copiar link", "QR code", "Testar", "Editar", "Pausar" e "Ativar" ficam à mão.',
    ],
    tip: 'Olhe "Lead → matrícula", e não só quantos leads. A captação mais barata nem sempre é a que mais matricula.',
    tour: [
      go('/captacao', 'Aqui você vê os resultados de cada captação.'),
      info('Estas abas trocam entre o Resumo e a comparação de captações.', { button: 'Comparar' }, 'Estas abas ficam no alto da tela.'),
      click('No celular, toque na aba "Captações" para ver a lista.', { button: 'Captações' }),
      fill('Escreva o nome para achar uma captação.', { css: 'input[placeholder="Buscar captação"]' }, 'A busca só aparece quando a escola tem mais de 5 captações.'),
      info('Estes filtros mostram só as captações ativas, pausadas ou da Vitrine.', { button: 'Ativas' }, 'Os filtros aparecem na lista de captações.'),
      done('Compare as captações com frequência para investir no que funciona.'),
    ],
  },

  // ───────── VITRINE ─────────
  {
    key: 'vt_montar', module: 'vitrine', title: 'Montar e publicar a Vitrine da escola', minutes: 4, to: '/vitrine', routes: ['/vitrine'],
    summary: 'Deixar a página da escola pronta e divulgar o link.',
    steps: [
      'Abra Vitrine. Na aba "Início" há uma lista do que falta: escolher modelo e cores, ter o WhatsApp conectado, ter o botão de matrícula, publicar, divulgar com QR code e colocar o link no Instagram.',
      'Em "Blocos", monte a página: o que aparece e em que ordem. Clique num bloco da prévia para editá-lo.',
      'Em "Aparência", escolha o modelo e as cores. Em "Redes sociais", coloque os links da escola.',
      'Em "Configurações", ajuste o endereço da página. Em "Desempenho", veja quantas famílias abriram e tocaram.',
      'Quando estiver pronto, toque em "Publicar página". Para divulgar, use "QR code" ou "Compartilhar".',
    ],
    tip: 'Coloque o link da Vitrine na bio do Instagram. É o jeito mais simples de levar a família ao WhatsApp da escola.',
    tour: [
      go('/vitrine', 'Esta é a Vitrine: a página da escola, com um link só.'),
      info('Estas abas organizam o editor: Início, Blocos, Redes sociais, Aparência, Configurações e Desempenho.', { css: '[aria-label="Áreas do editor"]' }),
      info('Na aba Início fica a lista do que falta para a página ficar pronta.', { text: 'Escolher modelo e cores' }, 'Esta lista fica na aba Início.'),
      info('"QR code" gera a imagem para cartaz e panfleto. Quando a página estiver pronta, "Publicar página" coloca ela no ar.', { button: 'QR code' }),
      done('Com a Vitrine publicada, divulgue o link.'),
    ],
  },

  // ───────── TRANSMISSÕES ─────────
  {
    key: 'tr_nova', module: 'transmissoes', title: 'Criar uma campanha de transmissão', minutes: 5, to: '/transmissoes', routes: ['/transmissoes'],
    summary: 'Enviar uma mensagem aprovada pela Meta para um grupo de famílias, com custo à vista.',
    steps: [
      'Abra Transmissões e toque em "Nova campanha".',
      'Passo "Template": escolha um template aprovado. Se não houver nenhum, crie na aba "Templates" e aguarde a Meta aprovar.',
      'Passo "Público": escolha para quem enviar (por tipo de contato, etiquetas, turma ou campanha anterior) ou importe uma lista (planilha).',
      'Passo "Mensagem e respostas": preencha as variáveis do template e diga o que acontece quando o contato responde.',
      'Passo "Revisão": dê um nome à campanha, escolha quando enviar (assim que liberada ou agendada) e confira o custo estimado.',
      'Toque em "Confirmar campanha". Se houver cobrança, falta só o pagamento.',
    ],
    tip: 'Confira o público antes de confirmar. Mandar mensagem em massa para quem não espera aumenta o bloqueio e piora a qualidade do número.',
    tour: [
      go('/transmissoes', 'Transmissões envia campanhas em massa pelo WhatsApp oficial da escola.', undefined, 'Se você não vê Transmissões, o módulo ainda não foi liberado para a sua escola.'),
      click('Toque em "Nova campanha" para abrir o passo a passo.', { button: 'Nova campanha' }, 'Este botão só aparece quando o módulo está liberado.', true),
      info('O passo a passo tem 4 etapas: Template, Público, Mensagem e respostas, e Revisão.', { text: 'Template', in: 'modal' }),
      info('Escolha um template aprovado pela Meta. Se não houver, crie um na aba "Templates".', { tour: 'wizard-template', in: 'modal' }),
      done('Nesta aula eu não envio nada. Para enviar, siga as 4 etapas e toque em "Confirmar campanha".'),
    ],
  },
  {
    key: 'tr_acompanhar', module: 'transmissoes', title: 'Acompanhar as campanhas enviadas', minutes: 3, to: '/transmissoes', routes: ['/transmissoes'],
    summary: 'Ver quantas mensagens foram enviadas, entregues, lidas e respondidas.',
    steps: [
      'Abra Transmissões. Os cartões do alto mostram o resumo dos últimos 30 dias.',
      'Em "Campanhas", filtre por Todas, Em andamento, Pausadas, Concluídas, ou Rascunho e canceladas.',
      'Cada campanha mostra a barra de envio e os números de Enviadas, Entregues, Lidas e Respostas.',
      'Se aparece um aviso vermelho ou amarelo (pausada, falhas, aguardando pagamento), toque nele para ver o detalhe.',
      'Toque em "Detalhes" na campanha para ver tudo e, se precisar, pausar ou continuar o envio.',
    ],
    tip: 'Campanha pausada por "agenda terminou" precisa ser reagendada. Veja o aviso no topo da tela.',
    tour: [
      go('/transmissoes', 'Aqui você acompanha as campanhas.', undefined, 'Se você não vê Transmissões, o módulo ainda não foi liberado para a sua escola.'),
      info('Estas abas trocam entre Campanhas, Templates e Não recebem.', { button: 'Templates' }, 'Estas abas só aparecem quando o módulo está liberado.', true),
      info('Estes filtros mostram só as campanhas em andamento, pausadas ou concluídas.', { button: 'Em andamento' }, 'Os filtros aparecem na aba Campanhas.'),
      done('Acompanhe as respostas: é onde nascem as matrículas.'),
    ],
  },
  {
    key: 'tr_templates', module: 'transmissoes', title: 'Templates e quem não recebe', minutes: 3, to: '/transmissoes', routes: ['/transmissoes'], managerOnly: true,
    summary: 'Ver os modelos de mensagem e a lista de contatos que não devem receber campanhas.',
    steps: [
      'Abra Transmissões e toque na aba "Templates" para ver os modelos aprovados pela Meta e o status de cada um.',
      'Para criar um modelo novo, use o botão da aba e aguarde a aprovação da Meta.',
      'Toque na aba "Não recebem" para ver e cuidar da lista de números que pediram para não receber mensagens.',
      'Quem pede para sair precisa ficar nesta lista. É regra para manter o WhatsApp da escola saudável.',
    ],
    tour: [
      go('/transmissoes', 'Vamos ver Templates e a lista de quem não recebe.', undefined, 'Se você não vê Transmissões, o módulo ainda não foi liberado para a sua escola.'),
      click('Toque em "Templates" para ver os modelos de mensagem.', { button: 'Templates' }, 'Estas abas só aparecem quando o módulo está liberado.', true),
      click('Agora toque em "Não recebem".', { button: 'Não recebem' }),
      done('Mantenha a lista "Não recebem" sempre em dia.'),
    ],
  },
]
