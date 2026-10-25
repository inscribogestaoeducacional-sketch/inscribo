import type { Lesson } from '../academy'
import { go, info, click, fill, done } from './helpers'

export const LESSONS_F: Lesson[] = [
  // ───────── USUÁRIOS ─────────
  {
    key: 'us_novo', module: 'usuarios', title: 'Cadastrar uma pessoa da equipe', minutes: 3, managerOnly: true, to: '/users', routes: ['/users'],
    summary: 'Criar o acesso de um colega e escolher o perfil dele.',
    steps: [
      'Abra Usuários e toque em "Novo usuário" no banner.',
      'Escreva o "Nome completo *" e o "E-mail *" da pessoa.',
      'Em "Perfil de acesso *", escolha Consultor, Gestor ou Administrador. Gestor e administrador têm acesso total aos módulos da escola.',
      'Crie a "Senha *" (mínimo 6 caracteres) e repita em "Confirmar senha *".',
      'Para Consultor, escolha em "Acesso aos módulos" o que ele pode usar. Se ele atende no WhatsApp, decida se "Pode ver todas as conversas do WhatsApp".',
      'Toque em "Criar usuário".',
    ],
    tip: 'Dê a cada pessoa só o que ela precisa. Quem só atende não precisa ver Relatórios nem Configurações.',
    tour: [
      go('/users', 'Aqui o administrador cuida de quem usa o sistema.'),
      click('Toque em "Novo usuário".', { button: 'Novo usuário' }),
      fill('Digite o nome completo.', { label: 'Nome completo *', in: 'modal' }),
      fill('Digite o e-mail da pessoa.', { label: 'E-mail *', in: 'modal' }),
      info('Escolha o perfil: Consultor, Gestor ou Administrador.', { label: 'Perfil de acesso *', in: 'modal' }),
      info('Para salvar, você toca em "Criar usuário". Nesta aula eu não crio ninguém.', { button: 'Criar usuário', in: 'modal' }),
      done('Agora você sabe cadastrar a equipe.'),
    ],
  },
  {
    key: 'us_acesso', module: 'usuarios', title: 'Escolher o que cada pessoa acessa', minutes: 3, managerOnly: true, to: '/users', routes: ['/users'],
    summary: 'Ligar e desligar os módulos de cada consultor e ajustar o acesso às conversas.',
    steps: [
      'Abra Usuários e procure a pessoa em "Buscar por nome ou e-mail". Use os filtros Todos, Admins, Gestores e Consultores.',
      'Toque em "Editar" na linha da pessoa.',
      'Em "Acesso aos módulos", ligue ou desligue Início, Leads, Contatos, Visitas, WhatsApp, Captação, Vitrine, Transmissões, Base de alunos e os outros.',
      'Escolha se ela "Pode ver todas as conversas do WhatsApp" e se vê o "histórico completo ao receber transferência".',
      'Deixe "Usuário ativo no sistema" ligado. Desligado, a pessoa não consegue entrar.',
      'Toque em "Salvar alterações".',
    ],
    tip: 'Alguns módulos só aparecem para o consultor se a Áion liberou para a escola e se você ligou aqui.',
    tour: [
      go('/users', 'Aqui você escolhe o que cada pessoa acessa.'),
      fill('Digite o nome para achar a pessoa.', { css: 'input[placeholder="Buscar por nome ou e-mail"]' }),
      info('Em cada linha, "Editar" abre as permissões da pessoa.', { text: 'Editar' }, 'Quando a escola tem usuários, cada linha tem o botão Editar.'),
      done('Nesta aula eu não mudo nenhuma permissão.'),
    ],
  },
  {
    key: 'us_senha', module: 'usuarios', title: 'Redefinir senha ou remover alguém', minutes: 2, managerOnly: true, to: '/users', routes: ['/users'],
    summary: 'Ajudar quem esqueceu a senha e tirar da escola quem saiu da equipe.',
    steps: [
      'Abra Usuários e ache a pessoa.',
      'Toque em "Senha" na linha dela para enviar um e-mail de redefinição.',
      'Para tirar alguém da equipe, toque em "Remover". O sistema avisa se ainda há leads ou conversas com essa pessoa.',
      'Quem foi removido pode ser reativado depois, na lista de removidos.',
    ],
    tip: 'Antes de remover alguém, passe os leads e as conversas dela para outra pessoa.',
    tour: [
      go('/users', 'Senha e remoção ficam em cada linha da equipe.'),
      info('"Senha" envia o e-mail para a pessoa criar uma nova. "Remover" tira a pessoa da escola. Nesta aula eu só mostro, não clico em nada.', { text: 'Senha' }, 'Quando a escola tem usuários, cada linha mostra estas opções.'),
      done('Cuide da equipe com calma e sempre confira antes de remover.'),
    ],
  },

  // ───────── CONFIGURAÇÕES ─────────
  {
    key: 'cf_funil', module: 'configuracoes', title: 'Ajustar o funil: etapas, origens e motivos', minutes: 4, managerOnly: true, to: '/settings?tab=funil', routes: ['/settings'],
    summary: 'Deixar o funil com a cara da sua escola.',
    steps: [
      'Abra Configurações e toque na aba "Funil e leads".',
      'Em "Origens do lead", escolha as origens que a escola usa e acrescente as suas.',
      'Em "Motivos de perda", ajuste a lista usada quando um lead é marcado como perdido.',
      'Em "Etapas do funil", renomeie as etapas e crie etapas extras, como "Sem resposta".',
      'Em "Campo de unidade do lead", para escolas com mais de uma unidade, ligue o campo e cadastre as opções.',
      'Em "Lead sem contato", defina depois de quantos dias sem conversa o lead aparece como sem contato (só o administrador muda).',
    ],
    tip: 'Poucas origens e poucos motivos, bem claros, geram relatórios muito melhores do que listas enormes.',
    tour: [
      go('/settings?tab=funil', 'As configurações do funil ficam na aba "Funil e leads".'),
      info('Estas abas organizam as configurações: Escola, Plano e pagamentos, Funil e leads, WhatsApp e Integrações.', { button: 'Funil e leads' }),
      info('"Origens do lead" define de onde as famílias chegam.', { text: 'Origens do lead' }),
      info('"Etapas do funil" permite renomear e criar etapas extras.', { text: 'Etapas do funil' }),
      done('Nesta aula eu não mudo nenhuma configuração.'),
    ],
  },
  {
    key: 'cf_whatsapp', module: 'configuracoes', title: 'Configurar o atendimento do WhatsApp', minutes: 4, managerOnly: true, to: '/settings?tab=whatsapp', routes: ['/settings'],
    summary: 'Respostas rápidas, etiquetas, horário e quem recebe cada conversa.',
    steps: [
      'Abra Configurações e toque na aba "WhatsApp".',
      'Em "Respostas rápidas", cadastre os textos prontos que a equipe usa com "/".',
      'Em "Etiquetas", crie cores para organizar as conversas.',
      'Em "Equipe e distribuição", monte os grupos de atendimento e escolha para onde vai a conversa fora do horário.',
      'Em "Horário de atendimento", defina os dias e horários e o que o robô responde fora do horário.',
      'Em "Números bloqueados", veja e ajuste quem o sistema ignora. Em "Alertas", escolha os avisos do sininho.',
    ],
    tip: 'Comece por "Horário de atendimento" e "Respostas rápidas": são os que mais ajudam no dia a dia.',
    tour: [
      go('/settings?tab=whatsapp', 'As configurações do atendimento ficam na aba "WhatsApp".'),
      info('Aqui ficam as respostas rápidas, as etiquetas, o horário e a distribuição das conversas.', { text: 'Respostas rápidas' }, 'Algumas opções só aparecem para o administrador.'),
      info('"Horário de atendimento" define quando a escola atende e o que o robô responde fora do horário.', { text: 'Horário de atendimento' }, 'Algumas opções só aparecem para o administrador.'),
      done('Nesta aula eu não mudo nenhuma configuração.'),
    ],
  },
  {
    key: 'cf_escola', module: 'configuracoes', title: 'Dados, logo e séries da escola', minutes: 3, managerOnly: true, to: '/settings?tab=escola', routes: ['/settings'],
    summary: 'Manter os dados da escola e a lista de séries em dia.',
    steps: [
      'Abra Configurações e toque na aba "Escola".',
      'Em "Dados da escola", confira nome, contato e cidade (só o administrador altera).',
      'Em "Logo e cores", escolha a logo e a cor que a família vê nas pesquisas e na Vitrine.',
      'Em "Séries", organize as séries e etapas da escola, na ordem em que aparecem em todo o sistema.',
      'Em "Dados da campanha", abra o passo a passo com séries oferecidas e mensalidade média.',
    ],
    tour: [
      go('/settings?tab=escola', 'Os dados da escola ficam na aba "Escola".'),
      info('"Séries" define as séries que aparecem em todo o sistema, na ordem certa.', { text: 'Séries' }),
      done('Nesta aula eu não mudo nenhuma configuração.'),
    ],
  },
  {
    key: 'cf_plano', module: 'configuracoes', title: 'Ver o plano e os pagamentos', minutes: 2, managerOnly: true, adminOnly: true, to: '/settings?tab=plano', routes: ['/settings'],
    summary: 'Consultar a mensalidade, o que está pago ou atrasado e gerar o link de pagamento.',
    steps: [
      'Abra Configurações e toque na aba "Plano e pagamentos".',
      'Em "Pagamentos", veja a mensalidade do plano, quantas parcelas estão pagas e quantas pendentes.',
      'Na tabela "Mensalidades", toque em "Pagar" para abrir o link de pagamento. Se a parcela ainda não tem link, toque em "Gerar link".',
      'Se o módulo Transmissões estiver liberado, "Créditos de Transmissões" mostra o saldo e as recargas.',
    ],
    tour: [
      go('/settings?tab=plano', 'O plano e os pagamentos ficam na aba "Plano e pagamentos".'),
      info('Aqui estão os pagamentos do plano da escola.', { text: 'Pagamentos' }, 'Só o administrador vê esta área.'),
      done('Nesta aula eu não pago nem gero nada.'),
    ],
  },
  {
    key: 'cf_integracoes', module: 'configuracoes', title: 'Enviar a planilha de alunos', minutes: 3, managerOnly: true, to: '/settings?tab=integracoes', routes: ['/settings'],
    summary: 'Levar os alunos para a Áion por planilha, lançamento manual ou pelo sistema da escola.',
    steps: [
      'Abra Configurações e toque na aba "Integrações".',
      'Em "Planilha ou relatório", envie o relatório de alunos do ano anterior e do ano atual.',
      'Em "Lançamento manual", digite os números de cada série, sem precisar de integração.',
      'Em "Sistema da escola (Activesoft)", o administrador liga a leitura direta do sistema da escola.',
      'Em "Ajustes da rematrícula", defina o ano que está sendo rematriculado e a data de abertura.',
    ],
    tip: 'A Base de alunos e a Campanha ficam muito mais completas depois que a planilha é enviada.',
    tour: [
      go('/settings?tab=integracoes', 'As integrações ficam na aba "Integrações".'),
      info('"Planilha ou relatório" recebe os alunos do ano anterior e do atual.', { text: 'Planilha ou relatório' }),
      info('"Lançamento manual" deixa digitar os números de cada série.', { text: 'Lançamento manual' }),
      done('Nesta aula eu não envio nenhum arquivo.'),
    ],
  },

  // ───────── USE NO CELULAR ─────────
  {
    key: 'cel_instalar', module: 'celular', title: 'Instalar a Áion no celular', minutes: 2, to: '/profile', routes: ['/profile'],
    summary: 'Ter o ícone da Áion na tela do celular e abrir como um aplicativo.',
    steps: [
      'No Android (Chrome), toque em "Instalar app" quando o cartão aparecer no topo. Se não aparecer, abra o menu do navegador (os três pontinhos) e toque em "Instalar app" ou "Adicionar à tela inicial".',
      'No iPhone, abra no Safari, toque em "Compartilhar" (o quadrado com a seta, embaixo) e escolha "Adicionar à Tela de Início". Toque em "Adicionar".',
      'Abra a Áion pelo ícone novo na tela inicial.',
      'Com o app instalado, ative os avisos para saber na hora quando chegar mensagem de uma família.',
    ],
    tip: 'No iPhone, os avisos só funcionam depois de instalar o app na tela de início.',
  },
  {
    key: 'cel_avisos', module: 'celular', title: 'Escolher os avisos que você recebe', minutes: 2, to: '/profile', routes: ['/profile'],
    summary: 'Ligar os avisos no celular e escolher quais assuntos avisam você.',
    steps: [
      'Abra o menu com o seu nome (no topo) e toque em "Editar meu perfil".',
      'Na área "Notificações", ligue cada aviso que você quer: "Mensagem nova de cliente", "Conversa transferida para mim", "Lead novo", "Visitas do dia" e outros.',
      'Em "Lembrete “Dê uma olhadinha na Áion”", escolha se quer um lembrete quando ficar sem abrir.',
      'Em "Horário de silêncio", escolha o período em que você não quer ser avisado.',
      'Se o cartão "Ativar avisos" aparecer no topo, toque nele e permita as notificações no celular.',
    ],
    tour: [
      go('/profile', 'Os avisos ficam no seu perfil.'),
      info('Aqui você escolhe quais avisos recebe e o horário de silêncio.', { text: 'Notificações' }, 'A área de avisos fica mais abaixo, no seu perfil.'),
      done('Escolha só o que realmente ajuda você.'),
    ],
  },
  {
    key: 'cel_ajuda', module: 'celular', title: 'Pedir ajuda com o botão "?"', minutes: 2, to: '/academia', routes: ['/academia'],
    summary: 'Usar o "?" do topo para ver as aulas da tela, fazer o passo a passo e tirar dúvidas.',
    steps: [
      'Em qualquer tela, toque no "?" no topo.',
      'Abre um painel com as aulas daquela tela. Toque em uma aula para ler o passo a passo.',
      'Toque em "Fazer comigo" para a Áion guiar você na tela de verdade, com voz.',
      'Toque em "Tire suas dúvidas" para perguntar à assistente. Se ela não resolver, a conversa passa para a equipe Áion.',
      'Toque em "Ver todas as aulas" para abrir a Academia, com trilhas por assunto.',
    ],
    tip: 'Na Academia, a faixa "Comece por aqui" mostra o melhor caminho para o seu papel.',
    tour: [
      go('/academia', 'Esta é a Academia Áion Edu.'),
      info('Aqui em cima fica o "?" que abre a ajuda da tela em que você estiver.', { tour: 'topbar-ajuda' }),
      info('Aqui ficam as trilhas por assunto, com a sua evolução em cada uma.', { tour: 'academia-trilhas' }, 'As trilhas aparecem abaixo da faixa "Comece por aqui".'),
      done('Sempre que travar, toque no "?".'),
    ],
  },
  {
    key: 'cel_barra', module: 'celular', title: 'Personalizar a barra de baixo', minutes: 2, to: '/', routes: ['/home', '/atendente'],
    summary: 'Escolher os atalhos que ficam sempre à mão na barra do celular.',
    steps: [
      'No celular, toque em "Menu" na barra de baixo.',
      'Toque em "Editar barra" ou em "Personalizar a barra".',
      'Escolha os atalhos que você mais usa. O WhatsApp fica sempre no meio.',
      'Salve. Seu jeito fica guardado na sua conta.',
      'No mesmo menu, "Chat da equipe" abre a conversa interna com os colegas e "Meu perfil" abre seus dados.',
    ],
    tip: 'Deixe na barra o que você abre dezenas de vezes por dia, como Leads e Visitas.',
  },
  {
    key: 'cel_status', module: 'celular', title: 'Mostrar se você está disponível', minutes: 1, to: '/', routes: ['/home', '/atendente'],
    summary: 'Avisar a equipe quando você está disponível, ocupado ou ausente.',
    steps: [
      'Toque no seu nome ou na sua foto, no topo da tela.',
      'Escolha "Disponível", "Ocupado" ou "Ausente".',
      'A equipe e a distribuição de conversas passam a respeitar o seu status.',
      'No mesmo menu estão "Editar meu perfil", "Configurações" e "Sair".',
    ],
  },
]
