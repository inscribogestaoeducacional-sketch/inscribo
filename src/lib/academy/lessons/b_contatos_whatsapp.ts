import type { Lesson } from '../academy'
import { go, info, click, fill, done } from './helpers'

export const LESSONS_B: Lesson[] = [
  // ───────── CONTATOS ─────────
  {
    key: 'ct_novo', module: 'contatos', title: 'Cadastrar um contato', minutes: 2, to: '/contacts', routes: ['/contacts'],
    summary: 'Guardar na agenda uma família ou pessoa que fala com a escola.',
    steps: [
      'Abra Contatos e toque em "Novo contato" no banner verde.',
      'Preencha o "Telefone *" (é o único campo obrigatório). Se souber, preencha também "Nome", "E-mail" e "Endereço".',
      'Em "Aluno", "Turma" e "Parentesco", registre quem é a pessoa na escola (por exemplo "Mãe").',
      'Escolha as "Etiquetas" que quiser.',
      'Toque em "Criar contato".',
    ],
    tip: 'Quem escreve pelo WhatsApp já entra sozinho em Contatos. Cadastre à mão só quem ainda não falou com a escola.',
    tour: [
      go('/contacts', 'Esta é a agenda de contatos da escola.'),
      click('Toque em "Novo contato" para cadastrar uma pessoa.', { button: 'Novo contato' }),
      fill('Digite o telefone com DDD.', { label: 'Telefone *', in: 'modal' }),
      fill('Se souber, digite o nome.', { label: 'Nome', in: 'modal' }),
      info('Para salvar, você toca em "Criar contato". Nesta aula eu não salvo nada.', { button: 'Criar contato', in: 'modal' }),
      done('Agora você sabe cadastrar um contato.'),
    ],
  },
  {
    key: 'ct_buscar', module: 'contatos', title: 'Buscar e organizar contatos', minutes: 3, to: '/contacts', routes: ['/contacts'],
    summary: 'Achar uma pessoa, filtrar por tipo e resolver pendências como contatos sem nome ou repetidos.',
    steps: [
      'Abra Contatos. Os quatro cartões do alto separam por tipo: Todos, Leads, Clientes e WhatsApp. Toque em um para filtrar.',
      'Escreva o nome ou o número em "Buscar contato...".',
      'Abaixo dos cartões aparecem as pendências: "Sem nome", "Duplicados", "Sem relação" e "Leads sem contato". Toque em uma para resolver.',
      'No computador, o botão "Filtros" permite filtrar por origem, etiqueta, série e mais.',
      'Toque em um contato para abrir a ficha com a conversa, o lead e as visitas dele.',
    ],
    tip: 'Resolva "Duplicados" de vez em quando: a mesma família com dois cadastros atrapalha os relatórios.',
    tour: [
      go('/contacts', 'Aqui você acha e organiza os contatos.'),
      info('Estes cartões separam os contatos por tipo: Todos, Leads, Clientes e WhatsApp.', { tour: 'contatos-tipos' }, 'Estes cartões ficam no alto da tela.'),
      fill('Digite o nome ou o número para buscar.', { css: 'input[placeholder="Buscar contato..."], input[placeholder="Buscar contato por nome ou telefone..."]' }),
      info('Quando houver pendências, como "sem nome" ou "duplicados", elas aparecem logo abaixo para você resolver.', { tour: 'contatos-pendencias' }, 'Quando não há pendências, esta faixa não aparece. Isso é bom sinal.'),
      done('Contatos organizados deixam os relatórios mais certos.'),
    ],
  },
  {
    key: 'ct_importar', module: 'contatos', title: 'Importar ou exportar contatos', minutes: 3, to: '/contacts', routes: ['/contacts'],
    summary: 'Trazer contatos de uma planilha ou baixar a sua lista.',
    steps: [
      'Abra Contatos e toque em "Ações" no banner verde.',
      'Escolha "Importar planilha" para trazer contatos de um arquivo CSV ou Excel. Siga o passo a passo da janela.',
      'Escolha "Exportar contatos" para baixar a lista, com filtros e os campos que você quiser.',
      'Escolha "Campos personalizados" para criar informações extras da sua escola.',
    ],
    tip: 'Antes de importar, confira se a planilha tem uma coluna de telefone com DDD.',
    tour: [
      go('/contacts', 'Importar e exportar ficam no menu "Ações".'),
      click('Toque em "Ações" para abrir o menu.', { button: 'Ações' }),
      info('"Importar planilha" traz contatos de um CSV ou Excel. Nesta aula eu não importo nada.', { text: 'Importar planilha' }),
      info('"Exportar contatos" baixa a sua lista.', { text: 'Exportar contatos' }),
      info('"Campos personalizados" cria informações extras para a sua escola.', { text: 'Campos personalizados' }),
      done('Você já sabe onde ficam a importação e a exportação.'),
    ],
  },

  // ───────── WHATSAPP ─────────
  {
    key: 'wa_atender', module: 'whatsapp', title: 'Atender uma conversa', minutes: 3, to: '/whatsapp', routes: ['/whatsapp'],
    summary: 'Abrir a conversa de uma família, assumir o atendimento e responder.',
    steps: [
      'Abra WhatsApp. A lista mostra as conversas, com as não lidas em destaque.',
      'Toque em uma conversa para abri-la. No celular a conversa ocupa a tela toda; a seta volta para a lista.',
      'Se a conversa está livre, aparece "Conversa aguardando atendimento". Toque em "Assumir conversa" para reservar para você.',
      'Escreva em "Digite uma mensagem..." (no celular, "Mensagem") e envie. Responder também assume a conversa automaticamente.',
      'Toque no "i" (Informações do contato) para ver a ficha, o lead, as visitas e as anotações da equipe.',
    ],
    tip: 'Assuma antes de digitar uma resposta longa, para um colega não responder ao mesmo tempo.',
    tour: [
      go('/whatsapp', 'Esta é a central de atendimento. Aqui ficam as conversas das famílias.'),
      info('Esta é a lista de conversas. Toque em uma para abrir.', { tour: 'wa-lista' }, 'Quando chegarem mensagens, as conversas aparecem aqui.'),
      click('Toque numa conversa para abrir.', { tour: 'wa-conversa' }, 'Ainda não há conversas para abrir.', true),
      info('Se a conversa estiver livre, "Assumir conversa" reserva o atendimento para você.', { button: 'Assumir conversa' }, 'Esta conversa já tem alguém atendendo, então o botão não aparece.'),
      info('Escreva a resposta aqui e envie.', { tour: 'wa-escrever' }, 'A caixa de mensagem aparece quando a conversa está aberta.'),
      info('O "i" abre a ficha da família: lead, visitas e anotações.', { css: 'button[title="Informações do contato"]' }, 'Este botão fica no topo da conversa.'),
      done('Você já sabe atender uma conversa.'),
    ],
  },
  {
    key: 'wa_filtros', module: 'whatsapp', title: 'Achar conversas na lista', minutes: 2, to: '/whatsapp', routes: ['/whatsapp'],
    summary: 'Buscar por nome ou número e filtrar por status, atendente e leitura.',
    steps: [
      'Abra WhatsApp e escreva em "Buscar nome ou número...".',
      'Em "Status", escolha "Abertos", "Concluídos" ou "Ambos".',
      'Em "Atendente" (para quem vê todas as conversas), escolha "Todos", "Eu", "Sem atendente" ou uma pessoa.',
      'Use os botões "Tudo", "Lida" e "Não lida" para ver só o que ainda não foi lido.',
    ],
    tip: 'Filtre por "Sem atendente" para achar conversas que ninguém assumiu.',
    tour: [
      go('/whatsapp', 'Vamos achar uma conversa mais rápido.'),
      fill('Digite o nome ou o número para buscar.', { css: 'input[placeholder="Buscar nome ou número..."]' }),
      info('Em "Status" você escolhe entre abertos, concluídos ou ambos.', { label: 'Status' }),
      info('Aqui você filtra o que foi lido e o que não foi.', { button: 'Não lida' }),
      done('Agora ficou fácil achar qualquer conversa.'),
    ],
  },
  {
    key: 'wa_respostas', module: 'whatsapp', title: 'Usar respostas rápidas', minutes: 2, to: '/whatsapp', routes: ['/whatsapp'],
    summary: 'Responder em segundos com textos prontos da escola.',
    steps: [
      'Abra uma conversa no WhatsApp.',
      'No campo de mensagem, escreva "/" para abrir a lista de respostas rápidas. Você também pode tocar em "Respostas rápidas" no menu do campo de mensagem.',
      'Busque por título ou conteúdo e toque na resposta para colocá-la no campo.',
      'Leia, ajuste o que quiser e envie.',
      'Para criar ou editar as respostas da escola, o gestor usa Configurações → WhatsApp → Respostas rápidas.',
    ],
    tip: 'Respostas rápidas são ótimas para valores, documentos da matrícula e endereço. Sempre releia antes de enviar.',
    tour: [
      go('/whatsapp', 'Respostas rápidas aparecem dentro de uma conversa.'),
      click('Primeiro, toque numa conversa para abri-la.', { tour: 'wa-conversa' }, 'Ainda não há conversas para abrir.', true),
      info('Neste campo, escreva "/" para abrir as respostas rápidas da escola.', { tour: 'wa-escrever' }, 'Abra uma conversa para ver o campo de mensagem.', true),
      done('Quem usa respostas rápidas atende muito mais rápido.'),
    ],
  },
  {
    key: 'wa_nova', module: 'whatsapp', title: 'Começar uma conversa nova', minutes: 2, to: '/whatsapp', routes: ['/whatsapp'],
    summary: 'Chamar no WhatsApp uma família que ainda não escreveu.',
    steps: [
      'Abra WhatsApp e toque no botão "Nova conversa" (o "+" do topo da lista).',
      'Escreva o telefone com DDD. O nome é opcional.',
      'O sistema confere se o número tem WhatsApp. Escolha se o contato é Nova família, Cliente, Fornecedor ou Outro.',
      'Se a família não falou com a escola nas últimas 24 horas, o WhatsApp só permite começar com um modelo aprovado pela Meta: escolha o modelo e preencha as variáveis.',
    ],
    tip: 'Fora da janela de 24 horas, só vai modelo aprovado. É regra do WhatsApp, não do sistema.',
    tour: [
      go('/whatsapp', 'Para chamar alguém que ainda não escreveu, você usa "Nova conversa".'),
      click('Toque no botão "+" para abrir "Nova conversa".', { css: 'button[title="Nova conversa"]' }, 'Este botão só aparece quando o WhatsApp da escola está conectado.', true),
      fill('Digite o telefone com DDD.', { css: 'input[placeholder="+55 (00) 00000-0000"]', in: 'modal' }),
      info('O nome do contato é opcional.', { css: 'input[placeholder="Nome do contato (opcional)"]', in: 'modal' }),
      done('Agora você sabe começar uma conversa.'),
    ],
  },
  {
    key: 'wa_transferir', module: 'whatsapp', title: 'Passar a conversa para um colega', minutes: 2, to: '/whatsapp', routes: ['/whatsapp'],
    summary: 'Trocar quem atende, sem perder o histórico.',
    steps: [
      'Abra a conversa e toque no "i" (Informações do contato).',
      'Em "Quem atende", toque em "Trocar" (ou "Atribuir", se ninguém atende).',
      'Em "Passar para…", escolha o colega.',
      'O colega recebe um aviso e passa a ver a conversa. Se a conversa for transferida, ele pode ver o histórico completo, conforme o acesso dele.',
    ],
    tip: 'Antes de passar, deixe uma "Anotação da equipe" na ficha explicando o caso.',
    tour: [
      go('/whatsapp', 'Para passar uma conversa, abra a ficha da família.'),
      click('Primeiro, toque numa conversa para abri-la.', { tour: 'wa-conversa' }, 'Ainda não há conversas para abrir.', true),
      info('Dentro da conversa, o "i" abre a ficha. Lá, "Quem atende" mostra quem atende e deixa trocar.', { css: 'button[title="Informações do contato"]' }, 'Abra uma conversa para ver este botão.', true),
      done('Nesta aula eu não passo nenhuma conversa de verdade.'),
    ],
  },
  {
    key: 'wa_concluir', module: 'whatsapp', title: 'Concluir um atendimento', minutes: 2, to: '/whatsapp', routes: ['/whatsapp'],
    summary: 'Fechar a conversa quando o assunto acabou, ou devolvê-la para a fila.',
    steps: [
      'Abra a conversa e toque no "i" (Informações do contato).',
      'Toque em "Concluir" quando o assunto estiver resolvido. A conversa vai para "Concluídos".',
      'Se não puder continuar, toque em "Sair": a conversa volta para a fila.',
      'Se a família escrever de novo, a conversa reabre sozinha.',
    ],
    tip: 'Concluir no fim do atendimento deixa a fila limpa e libera a avaliação do atendimento, se a escola usa.',
    tour: [
      go('/whatsapp', 'Concluir fica na ficha da conversa.'),
      click('Primeiro, toque numa conversa para abri-la.', { tour: 'wa-conversa' }, 'Ainda não há conversas para abrir.', true),
      info('Dentro da conversa, o "i" abre a ficha, e lá ficam os botões "Concluir" e "Sair". Nesta aula eu não concluo nada.', { css: 'button[title="Informações do contato"]' }, 'Abra uma conversa para ver este botão.', true),
      done('Conclua sempre que o assunto acabar.'),
    ],
  },
  {
    key: 'wa_lead', module: 'whatsapp', title: 'Ligar a conversa a um lead', minutes: 2, to: '/whatsapp', routes: ['/whatsapp'],
    summary: 'Criar o lead a partir da conversa, para a família entrar no funil.',
    steps: [
      'Abra a conversa e toque no "i" (Informações do contato).',
      'No bloco "No funil", se a conversa ainda não é um lead, toque em "+ Criar lead".',
      'Se a família já foi cadastrada, toque em "Ligar a um lead" e busque pelo nome ou telefone.',
      'Com o lead ligado, você vê a "Etapa" e as "Visitas" dele ali mesmo, e pode tocar em "Editar lead".',
    ],
    tip: 'Todo contato que pergunta sobre matrícula deve virar lead. Sem lead, a família some do funil.',
    tour: [
      go('/whatsapp', 'O bloco "No funil" fica na ficha da conversa.'),
      click('Primeiro, toque numa conversa para abri-la.', { tour: 'wa-conversa' }, 'Ainda não há conversas para abrir.', true),
      info('Dentro da conversa, o "i" abre a ficha. Lá, em "No funil", você cria ou liga um lead.', { css: 'button[title="Informações do contato"]' }, 'Abra uma conversa para ver este botão.', true),
      done('Lead ligado é família acompanhada.'),
    ],
  },
]
