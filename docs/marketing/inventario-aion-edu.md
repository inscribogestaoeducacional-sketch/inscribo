# Inventário de produto — Áion Edu

**Para quem é este documento:** equipe de marketing (posts, roteiros de vídeo, artes) que fala com gestores escolares, secretaria e atendimento, com foco no período de matrículas.

**Como foi feito:** leitura do código do sistema em 06/10/2026: telas, menu, permissões, automações, banco de dados e textos da interface. Nada foi testado com uma escola real logada. Portanto:

- **"Em produção"** quer dizer que a tela existe no código e aparece no menu. Não quer dizer que cada escola já usa.
- Tudo que não deu para confirmar está marcado como **"não confirmado"**.
- Os números citados (limites, quantidades, prazos) foram tirados do código. Alguns são ajustáveis pela equipe Áion e podem variar por escola.

**Nomes dos perfis.** O sistema tem 3 perfis de usuário da escola, e o terceiro aparece com nomes diferentes conforme a tela:

| Perfil | Nome na tela de Usuários | Rodapé do menu | Topo da tela |
|---|---|---|---|
| Administrador | "Administrador — Acesso completo" | Administrador | Administrador |
| Gestor | "Gestor — Marketing, funil e relatórios" | Gestor | Gestor |
| Atendente | "Consultor — Leads, visitas e matrículas" | Usuário | Consultor |

Neste documento, o terceiro perfil é chamado de **atendente** (secretaria/atendimento). A tela inicial dele mostra o selo "Atendente".

---

## 1. Visão geral

O Áion Edu é um sistema web de **captação e relacionamento para escolas particulares**. Ele junta num só lugar:

- o funil de matrículas (leads em kanban, visitas, motivos de perda);
- o atendimento pelo **WhatsApp oficial da Meta**, com caixa de entrada da equipe, robô de atendimento montado sem código e distribuição entre atendentes;
- a identificação de qual anúncio trouxe cada família (Captação Inteligente);
- uma página de links da escola (Vitrine);
- disparos em massa pelo WhatsApp (Transmissões);
- pesquisas de satisfação e de transferência;
- relatórios de campanha de matrícula com metas e diagnósticos gerados por IA.

É feito para três públicos dentro da escola:

- **gestor/diretor:** metas, funil, ranking da equipe, mercado da cidade;
- **secretaria/atendimento:** WhatsApp, leads, visitas, lembretes;
- **administrador:** usuários, configurações, conexão do WhatsApp.

Funciona no navegador do computador e do celular (layout adaptado). **Não existe aplicativo para instalar.**

---

## 2. Mapa de módulos

### 2.1 Módulos no menu lateral

| Módulo | Nome no menu | Para que serve | Perfil que usa | Status |
|---|---|---|---|---|
| Painel do gestor | Início | Visão da escola em uma tela: KPIs, alertas, ranking da equipe, mercado e análise da IA | Administrador, Gestor | Em produção |
| Painel do atendente | Início | Os leads, visitas, lembretes e mensagens do dia de quem atende | Atendente | Em produção |
| Leads | Leads | Funil de matrícula em kanban de 7 colunas, com arrastar e soltar | Todos | Em produção |
| Contatos | Contatos | Base única de famílias, leads e contatos do WhatsApp, com importação e exportação | Todos | Em produção |
| Visitas | Visitas | Agenda de visitas à escola, com status e atualização automática do funil | Todos | Em produção |
| WhatsApp | WhatsApp | Caixa de entrada da equipe no WhatsApp oficial, com robô, filas e transferências | Todos | Em produção |
| Captação Inteligente | Captação | Descobre de qual anúncio veio cada conversa e direciona sozinho | Admin e Gestor; atendente só se liberado | Em produção |
| Vitrine | Vitrine | Página de links da escola (estilo "link na bio"), com botão de matrícula e WhatsApp | Admin e Gestor; atendente só se liberado | Em produção; o painel de desempenho é parcial |
| Transmissões | Transmissões | Disparo em massa pelo WhatsApp com modelo aprovado pela Meta, cobrado por mensagem | Admin e Gestor; atendente só se liberado | Atrás de liberação por escola (desligado por padrão) |
| Relatórios | Relatórios | Relatórios da campanha de matrícula: metas, funil, custo por lead, rematrículas, diagnóstico IA | Administrador, Gestor | Parcial (ver seção 8) |
| Transferências | Transferências | Registro de alunos que saem, com pesquisa para a família e diagnóstico por IA | Todos | Em produção |
| Pesquisas | Pesquisas | Pesquisas de satisfação com as famílias, com relatório por IA | Administrador, Gestor | Em produção |
| Usuários | Usuários | Cadastro da equipe e permissões por módulo | Administrador | Em produção |
| Configurações | Config. | Dados da escola, séries, identidade visual, WhatsApp, robô, horários, pagamentos | Administrador | Em produção |

### 2.2 Recursos fora do menu lateral

| Módulo | Onde aparece | Para que serve | Perfil | Status |
|---|---|---|---|---|
| Chat interno | Botão flutuante em todas as telas | Conversa 1 a 1 entre colegas da mesma escola | Todos | Em produção |
| Notificações | Sino no topo | Alertas do sistema (resumo do dia, metas, transferências etc.) | Todos | Em produção |
| Disponível / Ausente | Botão no topo | Diz se a pessoa recebe novas conversas distribuídas | Todos | Em produção |
| Seletor de unidade | Topo / tela de escolha após login | Quem trabalha em mais de uma escola escolhe qual acessar | Quem tem 2+ escolas | Em produção |
| Central de Atualizações | Só pela URL /updates (e pop-up automático) | Novidades publicadas pela Áion | Gestor/Admin (pop-up) | Pop-up em produção; a página não tem acesso pelo menu |
| Formulário para o site | Só pela URL /embed | Código de formulário de captação para colar no site da escola | Administrador, Gestor | Só no código, sem acesso pelo menu; **o envio provavelmente não funciona** (ver seção 8) |
| Meu Perfil | Clique no nome, no rodapé do menu | Dados pessoais e troca de senha | Todos | Em produção |

### 2.3 Telas que existem no código, mas a escola não acessa

Todas estas telas estão **só no código, sem acesso pelo menu**:

- **Matrículas:** controle de matrículas, receita, ticket médio.
- **Rematrículas:** tela dedicada de rematrículas.
- **Clientes:** cadastro antigo de alunos, substituído por Contatos.
- **Dashboard antigo:** contém números fixos, inventados no código.
- **Marketing & CPA antigo, Metas Anuais, Kanban antigo:** versões antigas.

### 2.4 Páginas públicas (sem login)

| Página | Para quem | Status |
|---|---|---|
| Página da Vitrine (aionedu.com.br/nome-da-escola) | Famílias | Em produção |
| Pesquisa de transferência (link enviado pela escola) | Famílias que estão saindo | Em produção |
| Pesquisa de satisfação (link enviado pela escola) | Famílias | Em produção |
| Raio-X Estratégico (/raio-x) | **Escolas que ainda não são clientes** (isca comercial da Áion) | Em produção |

---

## 3. Ficha de cada funcionalidade

### A. Painéis iniciais

#### A1. Início do gestor

- **Nome na tela:** "Início" (saudação "Bom dia/Boa tarde/Boa noite, {nome}").
- **O que faz:** mostra a saúde da escola em uma tela só: leads, conversas, matrículas, conversão, satisfação e tempo de resposta. Também traz alertas automáticos, ranking da equipe, mapa de concorrentes e um parágrafo de análise escrito pela IA.
- **Quem usa:** gestor/diretor, administrador.
- **Dor que resolve:** o diretor precisa pedir números para a secretaria e montar planilha para saber como vai a captação.
- **Antes e depois:**
  - **Antes:** relatório manual, informação atrasada.
  - **Depois:** abre o sistema e vê o mês, a semana ou o dia na hora.
- **O que é automático:**
  - Todos os cálculos e alertas.
  - Notificação "Alta captação de leads!" quando entram mais de 5 leads em 24 horas.
  - Notificação de meta abaixo de 60%.
  - Análise da IA, renovada a cada 2 horas.
- **O que é manual:** escolher o período e exportar o PDF.
- **Números concretos:**
  - Filtro de período com 4 opções: Hoje / Semana / Mês / Ano.
  - 6 indicadores no topo: Leads no período, Conversas WhatsApp, Matrículas, Taxa de conversão, Satisfação média, Tempo de resposta. O tempo de resposta mede só a resposta humana; o robô não conta.
  - Nota da escola de 0 a 100, com 4 faixas: Alto Desempenho, Desempenho Regular, Atenção Necessária, Situação Crítica.
  - Alertas automáticos, com selos "Atenção", "Ótimo" e "Info". Exemplos:
    - "N leads sem contato há mais de 5 dias";
    - "Novatos caíram X% vs ano anterior";
    - "Market share abaixo de 5%";
    - "Satisfação média abaixo de 2.5".
  - Ranking da Equipe por atendente: leads atribuídos, leads avançados, conversas, tempo de resposta, satisfação e nota. Os pesos da nota são matrículas 50, resposta 25 e satisfação 25.
  - Cartão WhatsApp: Total, Bot respondeu, Equipe resp., Sem resposta, Fechadas.
  - Mapa de calor "Horários de maior movimento".
  - Inteligência de Mercado com dados do Censo Escolar (INEP): escolas privadas da cidade, market share, 5 maiores concorrentes e selos "Líder de mercado", "Top 3", "Top 10".
  - Mapa com pinos da escola, das concorrentes privadas e das escolas públicas.
  - Gráficos: leads por dia, leads por origem, funil em rosca, evolução de matrículas, satisfação, transferências por motivo.
  - Botão "Exportar PDF" da tela.
  - No celular, a tela é resumida e tem "Acesso rápido" com 6 atalhos.
- **Status:** em produção.
- **Comprova:** rota `/home`, `src/pages/gestor/GestorHome.tsx`.

#### A2. Relatório de Mercado Completo

- **Nome na tela:** "Relatório de Mercado Completo", aberto pelo botão "Ver relatório completo" no Início.
- **O que faz:** mostra a posição da escola entre as particulares da cidade. Usa dados oficiais do Censo Escolar (INEP).
- **Quem usa:** gestor.
- **Dor que resolve:** a escola não sabe quanto do mercado tem nem quem são os concorrentes reais.
- **Antes e depois:**
  - **Antes:** percepção "de ouvido".
  - **Depois:** ranking, participação e distância para o 5º colocado, em números.
- **O que é automático:** tudo. A interpretação é feita por regras fixas, **não por IA**.
- **Números concretos:**
  - "Faltam X matrículas pra alcançar o 5º colocado".
  - 8 principais concorrentes.
  - 3 etapas de ensino.
- **Status:** em produção. Depende de a escola ter o código INEP cadastrado.
- **Comprova:** `src/components/gestor/MarketReportModal.tsx`.

#### A3. Início do atendente

- **Nome na tela:** "Início", com o selo "Atendente".
- **O que faz:** reúne o dia de quem atende: os próprios leads, as visitas de hoje, os lembretes de retorno e o movimento do WhatsApp nas últimas 24 horas.
- **Quem usa:** secretaria/atendente.
- **Dor que resolve:** a atendente esquece de ligar de volta para uma família ou não sabe por onde começar o dia.
- **Antes e depois:**
  - **Antes:** caderno, post-it, memória.
  - **Depois:** lista do dia com os atrasados no topo.
- **O que é automático:** o lembrete "Sem contato há N dias", a partir de 5 dias.
- **O que é manual:** marcar a data do próximo retorno ("follow-up").
- **Números concretos:**
  - 4 indicadores: Leads hoje, Visitas agendadas, Mensagens (24h), Transferências pendentes.
  - "Meu desempenho no mês": Matrículas fechadas, Meus leads no mês, Taxa de conversão.
  - Até 10 leads recentes.
- **Status:** em produção. Os 4 botões de "Ações rápidas" só levam à página; não abrem o formulário direto.
- **Comprova:** rota `/atendente`, `src/pages/gestor/AttendantHome.tsx`, `src/lib/leadReminders.ts`.

### B. Funil, leads e visitas

#### B1. Kanban de Leads

- **Nome na tela:** "Leads — Gestão do funil de captação".
- **O que faz:** cada família interessada vira um cartão, que anda pelas etapas do funil arrastando com o mouse. Ao chegar em "Matriculado", a matrícula é registrada sozinha. Ao ir para "Perdido", o sistema pede o motivo.
- **Quem usa:** atendente, gestor, administrador.
- **Dor que resolve:** leads perdidos em planilha ou no WhatsApp pessoal, sem saber em que etapa cada família está nem por que a escola perde matrícula.
- **Antes e depois:**
  - **Antes:** planilha desatualizada; ninguém sabe quem ligou para quem.
  - **Depois:** quadro visual com responsável, temperatura e próximo retorno de cada família.
- **O que é automático:**
  - Ir para "Matriculado" cria o registro de matrícula e a notificação "Nova matrícula confirmada!".
  - Agendar visita move o lead para "Visita Agendada".
  - Lead novo entra na campanha de matrícula ativa.
  - Toda mudança fica no histórico.
- **O que é manual:** criar o lead, arrastar entre etapas, informar o motivo de perda, marcar lembrete.
- **Números concretos:**
  - **7 colunas:** Novo, Em Contato, Visita Agendada, Visitou, Proposta, Matriculado, Perdido.
  - **9 origens:** Facebook, Instagram, Google, Site, Indicação, WhatsApp, Concurso de Bolsas, Vitrine, Outros. "Indicação" pergunta quem indicou; "Concurso de Bolsas" pergunta qual concurso.
  - **3 temperaturas:** Quente, Morno, Frio.
  - **10 motivos de perda**, cada um classificado como fator interno ou externo:
    - Valor da mensalidade alto
    - Não retornou nosso contato
    - Escolheu outra escola
    - Sem vaga na série de interesse
    - Escola não oferece a série desejada
    - Não gostou da escola
    - Mudou de cidade
    - Dificuldade financeira
    - Desistiu sem informar motivo
    - Outro motivo
  - **Filtros:**
    - Responsável: Meus leads / Todos / Sem responsável / cada atendente.
    - Status e temperatura.
    - Sem contato há 3, 5, 7, 10, 15 ou 30 dias.
    - Origem.
    - Série (configurável pela escola).
    - Turno: Manhã / Tarde / Integral.
    - Período: Hoje, Semana, Mês, Ano, Personalizado.
  - **Irmãos:** filhos da mesma família viram um cartão só. Arrastar esse cartão move todos os filhos.
  - Cartão compacto ou normal. Botões no cartão: "WA" (abre o WhatsApp), "Visita" e "Reabrir" (em lead perdido).
  - No celular, o kanban vira abas por etapa.
- **Status:** em produção.
- **Comprova:** rota `/leads`, `src/components/leads/LeadKanban.tsx`, `src/components/leads/leadFormShared.ts`.

#### B2. Cadastro do lead

- **Nome na tela:** "Novo Lead". Abas: Dados, Histórico, Anotações.
- **O que faz:** registra o responsável e os alunos. Se o telefone já existir, avisa que a família já tem alunos cadastrados. Também registra atividades (ligações, e-mails, visitas presenciais) e notas da equipe.
- **Quem usa:** atendente.
- **Dor que resolve:** cadastro duplicado e histórico espalhado.
- **Antes e depois:**
  - **Antes:** cada atendente anota de um jeito.
  - **Depois:** uma ficha por família, com tudo o que aconteceu.
- **O que é automático:** detectar família pelo telefone e ligar o lead às conversas do WhatsApp.
- **Números concretos:**
  - 5 tipos de atividade: Ligação, Email, WhatsApp, Presencial, Outro.
  - Dá para adicionar irmãos no mesmo cadastro.
- **Status:** em produção.
- **Comprova:** `src/components/leads/NewLeadModal.tsx`, `src/lib/leadSave.ts`.

#### B3. Lembretes de retorno (follow-up)

- **Nome na tela:** "Definir lembrete" (sino no cartão), "Meus lembretes", "Lembretes da equipe".
- **O que faz:** a atendente marca a data de retorno de cada família. O sistema mostra o que está atrasado, o que é para hoje e quais leads estão parados.
- **Quem usa:** atendente; o gestor vê os lembretes da equipe toda.
- **Dor que resolve:** família que pediu "me liga semana que vem" e ninguém ligou.
- **O que é automático:** o lembrete "Sem contato há N dias" a partir de 5 dias. Atenção: hoje ele conta a partir da data de cadastro do lead, não do último contato.
- **O que é manual:** marcar a data do retorno.
- **Status:** em produção.
- **Comprova:** `src/lib/leadReminders.ts`.

#### B4. Agenda de Visitas

- **Nome na tela:** "Visitas", com calendário, lista do dia e "Nova Visita".
- **O que faz:** agenda visitas de famílias à escola e mostra o calendário do mês. Quando a visita é marcada como realizada, o lead avança sozinho para "Visitou".
- **Quem usa:** atendente, gestor.
- **Dor que resolve:** visitas marcadas em agenda de papel e famílias que não aparecem sem ninguém saber.
- **Antes e depois:**
  - **Antes:** agenda solta, sem ligação com o funil.
  - **Depois:** a visita atualiza o funil e mostra a taxa de comparecimento.
- **O que é automático:**
  - Agendar move o lead para "Visita Agendada".
  - "Confirmar Realizada" move o lead para "Visitou".
- **Números concretos:**
  - 4 indicadores: Hoje, Semana, Realizadas, Taxa.
  - 4 status: Agendada, Realizada, Não compareceu, Cancelada.
  - No celular: abas Hoje / Amanhã / Essa semana.
- **Lembrete automático por WhatsApp:** **só acontece quando a visita é agendada pelo painel do WhatsApp** (ficha B5/C10). A visita criada nesta tela não envia confirmação nem lembrete.
- **Status:** em produção.
- **Comprova:** rota `/visits`, `src/components/calendar/VisitCalendar.tsx`.

#### B5. Contatos (base unificada)

- **Nome na tela:** "Contatos — Leads e WhatsApp unificados".
- **O que faz:** junta numa lista todas as pessoas que falaram com a escola: leads, famílias clientes e contatos do WhatsApp. A lista pode ser filtrada, etiquetada em massa, exportada e importada de planilha.
- **Quem usa:** atendente, gestor, administrador.
- **Dor que resolve:** contatos espalhados no celular da secretaria, em planilhas e no sistema da escola.
- **Antes e depois:**
  - **Antes:** cada lista num lugar.
  - **Depois:** uma base só, com filtro por série, etiqueta e campanha de origem.
- **Números concretos:**
  - 4 indicadores que também filtram: Total, Leads, Clientes, WhatsApp.
  - Filtros: busca, tipo, status do lead, série, etiquetas, "Campanha de origem (Captação Inteligente)".
  - Ações em massa: aplicar etiqueta, excluir.
  - Exportação em CSV ou Excel, com escolha entre 10 campos.
  - Perfil do contato com 5 abas: Dados, Histórico, Anotações, Transferência, Alterações.
  - Botão "Converter para Lead".
  - **Campos personalizados** de 4 tipos: Texto, Número, Data, Lista de opções. Exemplo: "RA do aluno".
  - **Duplicados:** agrupa cadastros com o mesmo telefone, sugere qual manter e junta os dois.
- **Status:** em produção.
- **Comprova:** rota `/contacts`, `src/components/contacts/`.

#### B6. Importar planilha de contatos

- **Nome na tela:** "Importar planilha".
- **O que faz:** sobe uma planilha (CSV ou Excel), reconhece as colunas sozinho e mostra antes quantos contatos serão criados e quantos atualizados. Números repetidos viram um contato só, e os irmãos são juntados ("Ana / Pedro").
- **Quem usa:** secretaria, administrador.
- **Dor que resolve:** começar no sistema sem redigitar a base da escola.
- **O que é automático:** reconhecer as colunas, juntar repetidos e mostrar a prévia.
- **O que é manual:** escolher se cada campo "preenche só o que está vazio" ou "sobrescreve".
- **Números concretos:**
  - **Até 20.000 linhas** por planilha.
  - 8 campos: Telefone, Nome, E-mail, Endereço, Aluno, Turma/série, Parentesco, Etiquetas.
  - Botão "Baixar modelo".
- **Status:** em produção. A funcionalidade está completa, mas **falta um teste pela interface com arquivo real** (não confirmado).
- **Comprova:** `src/components/contacts/ContactImportDialog.tsx`, `src/lib/contactImport.ts`.

### C. Atendimento por WhatsApp

#### C1. Caixa de entrada da equipe

- **Nome na tela:** "WhatsApp".
- **O que faz:** um só número oficial da escola, atendido por várias pessoas ao mesmo tempo, cada uma com as suas conversas. Conversas sem dono ficam numa fila visível para todos. Conversas esquecidas ganham o aviso "Parada há Xh".
- **Quem usa:** atendente/secretaria, gestor.
- **Dor que resolve:**
  - WhatsApp da escola num celular só, passado de mão em mão.
  - Duas pessoas respondendo a mesma família.
  - Mensagem que ninguém viu.
- **Antes e depois:**
  - **Antes:** um celular na mesa da secretaria, sem saber quem respondeu o quê.
  - **Depois:** cada atendente no próprio computador, com fila, dono da conversa e histórico.
- **O que é automático:**
  - Contador de não lidas.
  - Aviso de conversa parada.
  - Notificação no navegador com som.
  - Lead ligado à conversa pelo telefone.
- **O que é manual:** assumir, responder, transferir, concluir.
- **Números concretos:**
  - **3 status:** Aguardando, Em Atendimento, Concluído.
  - **Filtros:** busca; Status (Abertos / Concluídos / Ambos); Atribuição (Todos / Meus chats / Não atribuídos); Leitura (Tudo / Lida / Não lida).
  - **4 seções na lista:** "Aguardando atendimento", "Minhas conversas", "Conversas paradas", "Outras conversas".
  - Prazo para conversa "parada": 4, 8, 12, 24 ou 48 horas (padrão 24h).
  - Selo "Captação" nas conversas que vieram de anúncio.
- **Status:** em produção.
- **Comprova:** rota `/whatsapp`, `src/components/whatsapp/WhatsAppHub.tsx`.

#### C2. Assumir, transferir, resgatar e sair

- **Nome na tela:** "Assumir conversa", "Transferir", "Resgatar", "Sair do Atendimento", "Concluir Atendimento".
- **O que faz:**
  - A atendente pega uma conversa da fila ou passa a conversa para um colega. Fica registrado "Transferido de X para Y".
  - Quem tem permissão "resgata" uma conversa parada de outra pessoa.
  - Se dois clicarem juntos, aparece "Essa conversa já foi assumida por outro atendente".
- **Dor que resolve:** família esperando porque a atendente responsável saiu ou está de folga.
- **Status:** em produção.
- **Comprova:** `WhatsAppHub.tsx`, `supabase/functions/transfer-conversation`.

#### C3. Envio de mídia, áudio, reações e respostas

- **O que faz:** a atendente envia foto, vídeo, documento e áudio gravado no próprio computador. Também responde citando uma mensagem e reage com emoji. Os áudios recebidos tocam em 1x, 1,5x e 2x.
- **Números concretos:**
  - Limites: imagem até 5 MB, vídeo 16 MB, áudio 16 MB, documento 100 MB.
  - Imagens grandes são reduzidas sozinhas.
  - 6 reações rápidas: 👍 ❤️ 😂 😮 😢 🙏.
  - Status de cada mensagem: enviada, entregue, lida, falha.
  - Busca dentro da conversa; exportar a conversa em CSV.
- **Status:** em produção.
- **Comprova:** `WhatsAppHub.tsx`.

#### C4. Respostas rápidas

- **Nome na tela:** "Respostas rápidas" (ícone ⚡).
- **O que faz:** textos prontos ("valor da mensalidade", "horário de visita") para inserir com um clique. Também é possível digitar "/" e o atalho.
- **Tipos:** cada atendente tem as suas ("Pessoal") e o administrador cria as da escola ("Global").
- **Dor que resolve:** digitar a mesma resposta 50 vezes por dia em época de matrícula.
- **Números concretos:** o menu "/" mostra até 8 resultados.
- **Limitação:** as respostas globais não têm atalho "/"; aparecem só no painel ⚡.
- **Status:** em produção.

#### C5. Modelos (templates) e janela de 24 horas

- **Nome na tela:** "Enviar Template WhatsApp", "Reativar conversa", "Nova Conversa".
- **O que faz:** pela regra da Meta, depois de 24 horas sem mensagem da família só se pode escrever com uma mensagem-modelo aprovada. O sistema mostra quanto tempo falta ("Janela aberta — Expira em Xh Ymin") e oferece os modelos quando a janela fecha.
- **Pré-preenchimento:** nome do contato, nome da escola e data de hoje entram sozinhos nos modelos.
- **Quem cria os modelos:** a escola não cria modelos de atendimento; quem cadastra é a equipe Áion. A escola cria modelos próprios só dentro de Transmissões.
- **Limite:** existe um limite mensal de conversas iniciadas pela escola (padrão de 1.000 no código). A quantidade de cada plano é definida pela Áion e não foi confirmada.
- **Status:** em produção.

#### C6. Mensagens agendadas

- **Nome na tela:** "Mensagens Agendadas", "+ Agendar mensagem".
- **O que faz:** programa o envio de uma mensagem-modelo para data e hora futuras. Se a conversa estiver concluída, ela reabre sozinha.
- **Números concretos:** o sistema verifica a cada 3 minutos.
- **Limitação:** só agenda modelos aprovados, não texto livre.
- **Status:** em produção.
- **Comprova:** `supabase/functions/whatsapp-scheduled-send`.

#### C7. Etiquetas, notas internas e histórico

- **O que faz:**
  - **Etiquetas coloridas** na conversa, que também vão para o cadastro do contato.
  - **"Notas Internas"**, que só a equipe vê.
  - **Aba "Histórico"**, com atribuições, transferências e mudanças de status.
- **Dor que resolve:** contexto perdido quando a família volta semanas depois.
- **Status:** em produção.

#### C8. Ficha do contato dentro da conversa

- **Nome na tela:** "Quem é esse contato?", com os botões "Nova Família", "Família", "Fornecedor", "Outro"; seção "Lead Vinculado".
- **O que faz:** sem sair do WhatsApp, a atendente:
  - classifica o contato;
  - cria o lead já preenchido com nome, telefone e origem WhatsApp;
  - vê série e status;
  - agenda visita.
- **O que é automático:** ligar o lead à conversa pelo telefone.
- **Status:** em produção.

#### C9. Robô de atendimento com editor visual

- **Nome na tela:** "Editor de Fluxo" (em Configurações → WhatsApp → Conexão); botão "Robô ativo / inativo".
- **O que faz:** a escola desenha o robô arrastando blocos, sem programar. O robô:
  - dá boas-vindas;
  - mostra um menu de botões ou uma lista;
  - faz perguntas e guarda as respostas (por exemplo, o nome do aluno);
  - verifica horário de atendimento;
  - aplica etiquetas;
  - cria o lead;
  - passa a conversa para um atendente ou grupo.
- **Quem usa:** administrador monta; a família conversa com o robô.
- **Dor que resolve:** mensagens de madrugada e fim de semana sem resposta; atendente respondendo "qual a série?" o dia inteiro.
- **Antes e depois:**
  - **Antes:** a família espera até o dia seguinte.
  - **Depois:** recebe resposta e menu na hora, e já chega na atendente certa com nome e série.
- **O que é automático:** tudo depois de montado.
  - O robô roda na primeira mensagem de um novo atendimento.
  - Desliga sozinho quando um humano responde.
  - Se a família não responde, passa a conversa adiante depois de um tempo.
- **Números concretos:**
  - **9 tipos de bloco disponíveis:** Mensagem, Pergunta, Menu, Transferir, Condição, Ação, Aguardar, Mídia, Fim. Há também o bloco "Início", que é fixo.
  - **Menu:** até 3 opções viram botões; de 4 a 10, uma lista.
  - **Bloco Mensagem:** texto, imagem, vídeo, documento, áudio ou cartão de contato.
  - **5 condições:** Horário comercial, Horário de almoço, Palavra-chave, Primeira mensagem, Tem etiqueta. Podem ser combinadas com E/OU.
  - **Ações que funcionam:** Criar lead, Criar/atualizar lead, Adicionar etiqueta, Remover etiqueta, Encerrar conversa.
  - **Transferir:** para atendente, grupo (revezamento) ou fila geral, com mensagem antes de transferir.
  - **Resposta inválida no menu:** o robô responde "Não entendi sua resposta 😊" e reenvia as opções.
  - **Família que volta em até 2 horas após concluir:** volta para o mesmo atendente.
- **Status:** em produção, com partes que **não funcionam** (ver seção 8): blocos "Distribuir" e "Lead", ação "Vincular lead", bloco "Aguardar".
- **Comprova:** `src/components/whatsapp/FlowEditor.tsx`, `api/whatsapp/webhook.ts`.

#### C10. Distribuição automática entre atendentes

- **Nome na tela:** "Grupos de Atendimento" (Configurações → WhatsApp → Equipe); botão "Disponível / Ausente" no topo.
- **O que faz:** conversas encaminhadas a um grupo são distribuídas em revezamento (uma para cada). O revezamento pula quem marcou "Ausente" e quem está em horário de almoço. Se ninguém estiver disponível, a conversa vai para a fila "Aguardando".
- **Dor que resolve:** uma atendente sobrecarregada enquanto outra está livre.
- **O que é automático:** a distribuição.
- **O que é manual:** criar os grupos, marcar horários e almoço de cada atendente.
- **Limitação:** só existe o revezamento. Os modos "Aleatório" e "Menos ocupado" aparecem no editor como "EM BREVE" e não funcionam.
- **Status:** em produção (só revezamento).

#### C11. Horário de atendimento, almoço e inatividade do robô

- **Nome na tela:** "Horário de Atendimento", "Tempo de Inatividade do Bot", "Horário por Atendente" (aba Configurações → WhatsApp → Horário/Equipe).
- **O que faz:**
  - Define dias e horários de atendimento, com mensagem para fora do horário e para o almoço.
  - Define quanto tempo o robô espera antes de passar a conversa para a equipe.
- **Números concretos:**
  - Transferir após **1 a 1.440 minutos** de inatividade.
  - O sistema verifica a cada 5 minutos.
- **Status:** em produção.
  - Existem duas telas de tempo de inatividade, uma nova e uma antiga, o que pode confundir.
  - A palavra {horario} que a tela diz que é preenchida sozinha **sai literal** na mensagem.

#### C12. Avaliação do atendimento

- **Nome na tela:** aba "Pesquisa" (Configurações → WhatsApp); no Início, o card "Satisfação dos Atendimentos".
- **O que faz:** ao concluir a conversa, a família recebe 3 botões: 😞 Ruim / 😐 Regular / 😊 Ótimo.
- **Onde aparece o resultado:** a nota alimenta o card do Início e o ranking da equipe. O gestor vê a lista de conversas avaliadas como "Ruim", por atendente, e abre cada conversa.
- **Dor que resolve:** não saber como a secretaria trata as famílias.
- **O que é automático:** o envio ao concluir.
- **Números concretos:** 3 notas. Atenção: a tela de configuração diz "avaliação de 1 a 5", mas o que a família recebe são 3 opções.
- **Status:** em produção.

#### C13. Conexão do número da escola

- **Nome na tela:** "Conectar via Meta" (Configurações → WhatsApp → Conexão).
- **O que faz:** o administrador conecta o número oficial da escola pelo cadastro oficial da Meta, sem copiar códigos. Existe o modo de uso junto com o aplicativo WhatsApp Business (coexistência), que traz o histórico e as mensagens enviadas pelo celular.
- **Status:** o botão está em produção, mas **não está confirmado** que um número conectado só por esse caminho funcione sem configuração da equipe Áion. A coexistência tem um trecho marcado no próprio código como "ainda não confirmado".
- **Comprova:** `src/components/whatsapp/EmbeddedSignupButton.tsx`, `api/whatsapp/embedded-signup.ts`.

#### C14. Permissões do WhatsApp por atendente

- **Nome na tela:** "Permissões do WhatsApp" e opções em Usuários.
- **O que faz:** define, para cada atendente, duas opções:
  - "Vê todas as conversas";
  - "Vê histórico completo em transferência".
- **Padrão:** o atendente vê só as conversas dele e as sem dono.
- **Status:** em produção. Só o administrador acessa.

#### C15. Chat interno da equipe

- **Nome na tela:** "Chat Interno" (botão flutuante).
- **O que faz:** conversa 1 a 1 entre colegas da mesma escola, em tempo real, sem usar o WhatsApp pessoal.
- **Limitação:** sem grupos e sem anexos.
- **Status:** em produção.
- **Comprova:** `src/components/chat/InternalChat.tsx`.

#### C16. Número compartilhado entre unidades (redes de escolas)

- **O que faz:** redes com várias unidades usam um único número. O robô pergunta qual unidade a família procura e manda a conversa para a equipe certa. Quem já falou com uma unidade vai direto para ela.
- **Quem configura:** só a equipe Áion.
- **Status:** em produção para redes configuradas.
- **Limitação:** Transmissões não funciona com número compartilhado.
- **Comprova:** `api/whatsapp/webhook.ts`, `src/components/superadmin/AdminSchoolGroups.tsx`.

### D. Captação Inteligente

#### D1. Gatilhos por anúncio

- **Nome na tela:** "Captação Inteligente — Identifique de qual anúncio veio cada conversa do WhatsApp e direcione automaticamente". Aba "Gatilhos".
- **O que faz:**
  - Para cada anúncio ou post, a escola cria um "gatilho". O sistema gera um link que abre o WhatsApp com uma frase já digitada.
  - Quando a família manda essa frase, o sistema sabe de qual campanha ela veio.
  - Nos anúncios "Clique para WhatsApp" da Meta, reconhece também pelo próprio anúncio.
- **Quem usa:** gestor/marketing, administrador. Atendente só se liberado.
- **Dor que resolve:** a escola investe em anúncio e não sabe qual trouxe matrícula.
- **Antes e depois:**
  - **Antes:** "como conheceu a escola?" e respostas vagas.
  - **Depois:** cada conversa chega com o selo da campanha e o painel mostra quantas matrículas cada anúncio gerou.
- **O que é automático, quando a frase chega:**
  - Etiqueta a conversa e o contato.
  - **Cria o lead sozinho**, com a origem certa: Meta Ads vira "Instagram", Google Ads vira "Google".
  - Envia uma resposta automática (opcional).
  - Pode pular o robô e distribuir direto para atendentes em revezamento.
- **O que é manual:** criar o gatilho e colocar o link no anúncio, na bio ou no material.
- **Números concretos:**
  - **7 canais:** Meta Ads, Google Ads, Instagram orgânico, Facebook orgânico, TikTok, Site / Landing page, Outro.
  - Frase com no mínimo 10 caracteres. O reconhecimento ignora maiúsculas, acentos e pontuação.
  - Ações por gatilho: Copiar link, Testar, Editar, Pausar/Ativar, Excluir (arquiva e mantém o histórico).
- **Status:** em produção, para escolas com WhatsApp oficial conectado.
- **Comprova:** rota `/captacao`, `src/pages/gestor/CaptacaoInteligente.tsx`, `src/lib/captureTriggers.ts`.

#### D2. Painel da Captação

- **Nome na tela:** aba "Dashboard".
- **O que faz:** compara as campanhas em acionamentos, conversas, leads, matrículas e tempo da primeira resposta. A matrícula conta para a campanha que trouxe a família primeiro.
- **Números concretos:**
  - Períodos: 7 dias, 30 dias, 90 dias, 12 meses.
  - 5 indicadores: Acionamentos, Conversas, Leads (1º toque), Matrículas (1º toque), Conversão geral.
  - 2 gráficos: "Conversas por gatilho" e "Conversão contato → matrícula".
  - Tabela comparativa com 8 colunas.
- **Status:** em produção.

### E. Vitrine (página de links da escola)

#### E1. Editor da Vitrine

- **Nome na tela:** "Vitrine". Abas: Blocos · Redes sociais · Aparência · Configurações · Desempenho.
- **O que faz:** a escola monta uma página própria, no estilo "link na bio", com endereço aionedu.com.br/nome-da-escola. A página reúne:
  - botão de matrícula e de WhatsApp;
  - fotos, vídeo, mapa, horário de atendimento;
  - perguntas frequentes, depoimentos, equipe, números da escola;
  - PDF e "salvar contato".
  
  A prévia aparece ao vivo, em celular ou computador, e o salvamento é automático.
- **Quem usa:** gestor/marketing, administrador. Atendente só se liberado.
- **Dor que resolve:** a escola usa ferramentas soltas (Linktree, Canva) que não se conversam com o atendimento nem medem resultado.
- **Antes e depois:**
  - **Antes:** link genérico na bio, sem saber quem clicou.
  - **Depois:** página com a cara da escola, e o botão de WhatsApp já identifica que a família veio da Vitrine.
- **O que é automático:** o botão de WhatsApp da Vitrine cria sozinho um gatilho na Captação Inteligente. As conversas chegam marcadas e o lead nasce com a origem "Vitrine".
- **Números concretos:**
  - **15 tipos de bloco:**
    - WhatsApp
    - Botão de matrícula
    - Link
    - Texto / Sobre
    - Galeria de imagens (1 a 12 fotos)
    - Vídeo (YouTube ou Vimeo, horizontal ou vertical)
    - Mapa / Endereço (até 4 outras unidades)
    - Horário de atendimento (mostra "Aberto agora")
    - Banner
    - Perguntas frequentes (até 20)
    - Depoimentos (até 12, com nota de 1 a 5)
    - Equipe (até 24 pessoas)
    - Números (até 6, com animação)
    - Arquivo PDF (até 10 MB)
    - Salvar contato
  - Até 50 blocos por página.
  - **4 modelos prontos:** Essencial, Vibrante, Institucional, Matrículas (com botão de matrícula pulsando). "Trocar modelo" muda só o visual.
  - **Efeitos de botão:** Pulsar, Brilho, Balançar.
  - **Capa em vídeo** de até 30 segundos.
  - **8 combinações de fonte** e fundo em cor, degradê ou imagem.
  - **9 redes sociais:** Instagram, Facebook, TikTok, YouTube, LinkedIn, X, WhatsApp, Threads, Telegram.
  - **Agendamento:** o bloco aparece de/até uma data, e a página inteira pode publicar ou sair do ar sozinha.
  - **Botões opcionais:** WhatsApp flutuante e Compartilhar.
  - **Troca de endereço:** o endereço antigo continua funcionando.
- **Status:** em produção. Módulo novo, entregue entre o fim de setembro e o início de outubro de 2026.
- **Comprova:** rota `/vitrine`, `src/pages/gestor/Vitrine.tsx`, `src/components/vitrine/`, `src/lib/vitrineCore.ts`.

#### E2. Desempenho da Vitrine

- **Nome na tela:** aba "Desempenho".
- **O que mostra hoje:** status da página, blocos na página, visitas e cliques dos últimos 7 dias.
- **Status:** **parcial.** A própria tela diz: "O painel completo (por bloco, por origem e funil do Captação) chega na próxima fase".

### F. Transmissões (disparo em massa)

#### F1. Campanhas de Transmissão

- **Nome na tela:** "Transmissões — Campanhas pelo WhatsApp pra sua base, com template aprovado pela Meta". Abas: Campanhas · Templates · Não recebem.
- **O que faz:** envia uma mensagem oficial para muitas famílias de uma vez (por exemplo, "rematrícula aberta"), em 4 passos: Template → Público → Mensagem e respostas → Revisão.
  - O custo aparece antes do envio. Se faltar crédito, a escola paga por Pix, boleto ou cartão e a campanha começa sozinha quando o pagamento é confirmado.
  - As respostas podem ganhar etiqueta e ir direto para uma atendente.
- **Quem usa:** gestor, administrador. Atendente só se liberado.
- **Dor que resolve:**
  - Lista de transmissão do WhatsApp comum, que chega a quem não salvou o número e arrisca bloqueio.
  - Disparo manual um por um.
- **Antes e depois:**
  - **Antes:** horas copiando e colando, sem saber quem leu.
  - **Depois:** um envio só, com relatório de entregues, lidas, respostas e cliques por botão.
- **O que é automático:**
  - Envio em ritmo controlado.
  - Novas tentativas em caso de falha.
  - Quem responde "parar" sai sozinho da lista de marketing.
  - Etiqueta e distribuição de quem responde.
  - Liberação da campanha quando o pagamento é confirmado.
- **O que é manual:** criar o modelo, escolher o público e aprovar o custo.
- **Números concretos:**
  - **Públicos:** todos os contatos; etiquetas; tipo (Cliente, Lead, Outro, Sem classificação); turma; "Veio da Captação"; quem recebeu, respondeu ou clicou numa campanha anterior; planilha importada (exige confirmar a autorização dos contatos).
  - Até **20.000 destinatários** por campanha.
  - Limite padrão de **250 mensagens por hora e 1.000 por dia**, ajustável pela Áion.
  - Agendamento de 5 minutos a 60 dias à frente.
  - **Modelos da escola:**
    - Categoria Marketing ou Utilidade.
    - Cabeçalho de texto, imagem (5 MB) ou vídeo (16 MB).
    - Texto de até 1.024 caracteres.
    - Até 10 botões, no máximo 2 de link.
  - **Opt-out:** a mensagem inteira precisa ser "parar", "sair", "stop" ou "cancelar". O contato sai só do marketing.
  - **Cobrança:** preço por mensagem conforme a categoria. A cobrança mínima é de R$ 5,00. Se a campanha for cancelada, o que não foi enviado vira crédito.
  - **Detalhe da campanha:** Destinatários, Enviadas, Entregues, Lidas, Responderam, Falhas, cliques por botão.
- **Status:** **atrás de liberação por escola.** O menu só aparece quando a Áion liberar. A tabela de preços em uso é provisória (valores de teste) e **falta o teste real completo** com uma escola.
- **Comprova:** rota `/transmissoes`, `src/pages/gestor/Transmissoes.tsx`, `src/components/transmissoes/`, `supabase/functions/broadcast-campaigns`, `supabase/functions/school-broadcast-send`.

### G. Relatórios e campanha de matrícula

#### G1. Gerador de Campanha de Matrícula com IA

- **Nome na tela:** "Áion Edu · Gerador de Campanha". Abre em Relatórios pelos botões "Configurar agora", "Ajustar campanha" e "Iniciar campanha {ano}".
- **O que faz:**
  1. A escola sobe os relatórios de matrícula exportados do sistema de gestão (ERP), ou digita os números.
  2. A IA lê os arquivos e extrai o histórico.
  3. A escola define o objetivo.
  4. A IA monta um **plano mês a mês** com metas de cadastros, agendamentos, visitas, novatos, rematrículas e investimento, além de riscos e ações prioritárias.
  5. "Aplicar ao sistema" grava as metas, que passam a alimentar os Relatórios.
- **Quem usa:** gestor/diretor.
- **Dor que resolve:** metas de matrícula definidas "no chute", sem base no histórico nem na sazonalidade.
- **Antes e depois:**
  - **Antes:** meta única anual, sem saber quantas visitas são necessárias por mês.
  - **Depois:** plano mensal com o funil inteiro, e a escola sabe se está atrasada.
- **O que é automático:** a leitura dos arquivos e o plano, ambos pela IA.
- **O que é manual:** subir os arquivos, escolher o objetivo, revisar e aplicar.
- **Números concretos:**
  - 5 passos: Upload · Diagnóstico · Configurar · Gerando · Revisar.
  - Arquivos em PDF, Excel ou CSV. A leitura é afinada para o relatório "Matrículas Efetivadas" do SIGA; outros sistemas: não confirmado.
  - **3 tipos de objetivo:** "Crescer X%", "Adicionar X novatos", "Atingir X alunos total".
  - **3 níveis de ambição:** Conservador, Realista, Agressivo.
  - Tabela mensal editável com 8 colunas.
  - Meses críticos marcados com ★.
  - Ajuste de uma campanha já ativa vai para aprovação da equipe Áion.
- **Atenção:**
  - O passo "Diagnóstico da sua escola", com os textos "IA sugere", é **uma conta automática, não IA**.
  - O botão "Salvar rascunho" **não grava**.
- **Status:** em produção (a partir de Relatórios).
- **Comprova:** `src/components/reports/CampaignGeneratorModal.tsx`, `src/lib/campaignApply.ts`, `api/ai.ts`.

#### G2. Relatórios da Campanha

- **Nome na tela:** "Relatórios da Campanha". **6 abas:** Visão Geral · Funil · Marketing & CPA · Rematrículas · Transferências · Diagnóstico IA.
- **O que faz:** compara o realizado com a meta da campanha de matrícula em cada etapa, mês a mês.
- **Quem usa:** gestor, administrador.
- **Dor que resolve:** descobrir em fevereiro que a campanha não bateu a meta.
- **Antes e depois:**
  - **Antes:** a escola descobre o resultado no fim.
  - **Depois:** vê toda semana a "Velocidade necessária: N matrículas/semana".
- **Números concretos, por aba:**
  - **Visão Geral:**
    - Nota de saúde de 0 a 100, com os pesos Cadastros 20%, Visitas 20%, Matrículas 35%, Rematrículas 25%.
    - 3 faixas: "Campanha saudável", "Atenção necessária", "Campanha em risco".
    - 4 indicadores contra a meta.
    - "X dias restantes".
    - Gráfico de evolução.
  - **Funil:**
    - 4 etapas: Cadastros → Agendamentos → Visitas → Matrículas.
    - Conversão "Por aluno" ou "Por família".
    - Taxas comparadas a uma referência fixa: 76% / 63% / 40%.
    - Tabela mês a mês.
  - **Marketing & CPA:** o gestor digita o investimento do mês; os leads entram sozinhos; o sistema calcula o custo por lead. Alerta quando o custo passa 20% do previsto.
  - **Rematrículas:** **lançamento manual** mês a mês. Mostra Rematriculados, Base Elegível, Taxa de Fidelização e A Rematricular.
  - **Transferências:** ranking dos 10 motivos de perda de leads (interno/externo) e histórico de transferências.
- **Outros recursos:** "Vincular leads a esta campanha" (por período ou manual).
- **Status:** parcial.
  - Na tabela de transferências, as colunas Série, Destino e Motivo devem aparecer vazias ("—").
  - O encerramento de campanha falha (ver G3).
- **Comprova:** rota `/reports`, `src/components/reports/GestorReports.tsx`.

#### G3. Diagnóstico IA do mês

- **Nome na tela:** aba "Diagnóstico IA", botão "Gerar diagnóstico do mês".
- **O que faz:** a IA escreve um relatório do mês com até 400 palavras em 7 seções: Resumo executivo, Funil, Rematrículas, Ações de marketing, Ações do time, Ações de rematrícula, Próximos passos.
- **Outros elementos da aba:**
  - "Tempo médio de matrícula": quantos dias do lead à matrícula, classificado como rápido, moderado ou lento.
  - Histórico de diagnósticos anteriores.
- **Números concretos:** 1 diagnóstico por mês. Para gerar o PDF, o botão abre a impressão do navegador.
- **Status:** em produção.
- **Atenção:** o botão "Finalizar campanha e gerar relatório final" **dá erro hoje**. Ele encerra a campanha, mas o relatório final não é gerado.

#### G4. Análise da IA no Início

- **Nome na tela:** card "Análise da IA" no Início do gestor.
- **O que faz:** a IA escreve um parágrafo curto sobre o gargalo do funil e a ação imediata recomendada.
- **O que é automático:** é gerada ao abrir o Início e renovada a cada 2 horas.
- **Condição para aparecer:** só aparece com metas de campanha configuradas.
- **Status:** em produção.

### H. Transferências e pesquisas

#### H1. Transferências com pesquisa e diagnóstico por IA

- **Nome na tela:** "Transferências — Gerencie solicitações de transferência e entenda os motivos reais".
- **O que faz:**
  1. A secretaria registra o aluno que está saindo.
  2. A família recebe um link de pesquisa com o visual da escola.
  3. Quando a família responde, **a IA gera sozinha um diagnóstico**: motivo principal, grau de confiança, fatores de risco e "oportunidade de retenção".
  4. A escola marca "Retido" ou "Transferência confirmada".
- **Quem usa:** secretaria, gestor.
- **Dor que resolve:** a família diz "é a distância" e a escola nunca descobre o motivo real.
- **Antes e depois:**
  - **Antes:** formulário de papel, motivo genérico.
  - **Depois:** pesquisa que se adapta à resposta, diagnóstico pronto e números por motivo no Início.
- **O que é automático:** o diagnóstico da IA após a resposta e as notificações.
- **O que é manual:** registrar a transferência e **enviar o link para a família.** O sistema copia o link; não envia sozinho.
- **Números concretos:**
  - 4 indicadores: Total, Este mês, Aguardando pesquisa, Com diagnóstico IA.
  - 5 status: Aguardando pesquisa, Pesquisa enviada, Respondido, Diagnóstico pronto, Cancelado.
  - **Pesquisa da família:** 8 perguntas possíveis, das quais cada família responde de 3 a 5, conforme o motivo.
  - 6 motivos: Financeiro, Pedagógico, Distância, Outra escola, Mudança de cidade, Outro.
  - Pergunta de recomendação de 0 a 10.
  - Lixeira com restauração.
- **Status:** em produção. **Não confirmado:** o botão "Gerar link pesquisa" pode nunca aparecer, porque o link talvez já nasça pronto. Nesse caso o card "Aguardando pesquisa" fica sempre em zero.
- **Comprova:** rota `/transferencias`, `src/pages/gestor/GestorTransfers.tsx`, `src/pages/survey/TransferSurveyPage.tsx`.

#### H2. Pesquisas de Satisfação com relatório por IA

- **Nome na tela:** "Pesquisas de Satisfação — Entenda o que as famílias pensam e antecipe rematrículas".
- **O que faz:** a escola cria uma pesquisa, que pode ser a pronta ou uma personalizada, e compartilha o link com as famílias. O painel mostra:
  - nota geral;
  - NPS;
  - **probabilidade de rematrícula** (quem vai renovar, quem está em dúvida, quem não vai);
  - filtros por segmento e série.
  
  A IA gera um relatório com pontos fortes, pontos fracos, risco de rematrícula e ações prioritárias.
- **Quem usa:** gestor, coordenação.
- **Dor que resolve:** a escola descobre que a família estava insatisfeita só quando ela não rematricula.
- **Antes e depois:**
  - **Antes:** Google Forms solto, resultado em planilha.
  - **Depois:** lista de famílias "em risco" antes da rematrícula, com relatório pronto.
- **O que é automático:** os cálculos e o redirecionamento após a resposta.
- **O que é manual:** criar a pesquisa, **compartilhar o link** e pedir o relatório da IA.
  - Não há envio em massa a partir desta tela.
  - Na ficha do contato existe um botão de WhatsApp com mensagem pronta, um por vez.
- **Números concretos:**
  - **Pesquisa padrão com 7 perguntas:**
    - 5 notas de 1 a 5: geral, ensino, atendimento, infraestrutura, custo-benefício.
    - Probabilidade de rematrícula, com 5 opções.
    - Comentário.
  - **Pesquisa personalizada** com 4 tipos de pergunta: Escala 1–5, NPS 0–10, Múltipla escolha, Texto livre.
  - Opção de pedir a identificação da família.
  - **Painel com 3 abas:** Visão Geral, Respostas, Relatório IA.
  - Filtros rápidos: "Vai renovar / Talvez / Não vai renovar".
- **Status:** em produção. Na pesquisa padrão, o NPS é **aproximado** a partir da nota geral, porque ela não tem a pergunta de 0 a 10.
- **Comprova:** rota `/pesquisas`, `src/pages/gestor/GestorSurveys.tsx`, `src/pages/survey/SatisfactionPage.tsx`.

### I. Gestão, configurações e multiescola

#### I1. Usuários e permissões

- **Nome na tela:** "Usuários".
- **O que faz:**
  - O administrador cria, edita, desativa e remove pessoas da equipe.
  - Define o perfil de cada uma (Administrador, Gestor, Consultor/atendente).
  - Liga ou desliga módulos para cada atendente.
- **Proteção:** quem tem leads ou conversas em aberto não pode ser removido antes de transferir.
- **Números concretos:**
  - 13 módulos com permissão individual.
  - 3 deles vêm **desligados** para atendente por padrão: Captação, Vitrine, Transmissões.
  - Senha mínima de 6 caracteres.
- **Status:** em produção.
- **Comprova:** rota `/users`, `src/components/management/UserManagement.tsx`.

#### I2. Configurações

- **Nome na tela:** "Config."
- **Abas:**
  - **Geral:** dados da escola, plano.
  - **Pagamentos:** mensalidades da Áion.
  - **Transmissões:** crédito e extrato. Só aparece com o módulo liberado.
  - **Escola:** séries/etapas de ensino editáveis.
  - **Identidade:** logo e cores, usadas nas pesquisas.
  - **WhatsApp**, com 7 sub-abas: Conexão, Horário, Respostas, Equipe, Bloqueios, Etiquetas, Pesquisa.
- **Status:** em produção. Só o administrador acessa. **O Gestor não acessa as Configurações.**
- **Comprova:** rota `/settings`, `src/components/management/SystemSettings.tsx`.

#### I3. Configuração inicial com importação do histórico

- **Nome na tela:** "Bem-vindo ao Áion Edu!" → "Configure sua escola" → "Importe seu histórico de matrículas" → "Escola configurada!".
- **O que faz:** abre sozinho no primeiro acesso do gestor. Pede os dados da escola e o código INEP, e aceita os relatórios de matrícula exportados do ERP, que a **IA lê** para montar o histórico ano a ano.
- **Números concretos:** a tela fala em até 5 arquivos PDF, XLS, XLSX ou CSV.
- **Importante:** é **leitura do relatório exportado**, não integração direta com o ERP. Traz números agregados por ano, não a lista de alunos.
- **Status:** em produção.
- **Comprova:** `src/components/onboarding/SchoolSetupModal.tsx`.

#### I4. Várias escolas e redes

- **O que faz:**
  - Quem trabalha em 2 ou mais escolas escolhe qual acessar ("Qual instituição você quer acessar?"), e as permissões valem por escola.
  - Redes de escolas configuradas pela Áion ganham um seletor de unidade no topo, para o "gestor de rede" trocar de unidade sem sair do sistema.
  - Cada unidade continua com o próprio funil, financeiro e nota fiscal.
- **Status:** em produção. A configuração da rede é feita pela Áion.
- **Comprova:** `src/components/auth/InstitutionSelectionScreen.tsx`, `src/components/layout/TopBar.tsx`.

#### I5. Notificações e Central de Atualizações

- **Sino de notificações:** mostra as 20 mais recentes, em tempo real. Exemplos:
  - "Resumo do dia" (diário, às 18h de Brasília);
  - "Alerta de funil abaixo da meta" (segundas, às 9h de Brasília);
  - nova transferência;
  - nova resposta de pesquisa;
  - campanha configurada;
  - mensalidade em atraso.
- **Novidades da Áion:** aparecem em pop-up para o gestor ao entrar.
- **Status:** em produção.
- **Atenção:** a busca do topo ("Buscar leads, visitas, matrículas...") **não faz nada**.

---

## 4. Automações e IA

### 4.1 O que o sistema faz sozinho, sem ninguém clicar

| Gatilho | O que acontece | Onde aparece |
|---|---|---|
| Família manda a 1ª mensagem no WhatsApp | O robô responde, mostra o menu, coleta dados, cria o lead e transfere | WhatsApp |
| Mensagem com a frase de um gatilho da Captação | Etiqueta, cria o lead com a origem certa, resposta automática, pula o robô e distribui | WhatsApp, Leads, Captação → Dashboard |
| Família clica no botão de WhatsApp da Vitrine | Igual à Captação, com origem "Vitrine" | WhatsApp, Leads |
| Conversa encaminhada a um grupo | Distribui em revezamento, pulando ausentes e quem está no almoço | WhatsApp |
| Mensagem fora do horário | Envia a mensagem de fora do horário | WhatsApp |
| Família para de responder ao robô | Depois do tempo configurado, passa a conversa para a equipe (verifica a cada 5 min) | WhatsApp |
| Atendente envia qualquer mensagem | O robô desliga naquela conversa | WhatsApp |
| Família volta em até 2 horas após concluir | A conversa volta para o mesmo atendente, com o aviso "Recebemos sua mensagem!" | WhatsApp |
| Conversa concluída | Envia a avaliação Ruim/Regular/Ótimo (se ligada) | Início → Satisfação dos Atendimentos |
| Conversa sem resposta por X horas | Marca "Parada há Xh" para resgate | WhatsApp |
| Visita agendada pelo painel do WhatsApp | Envia a confirmação na hora e agenda um lembrete para as 8h do dia (ou 3h antes) | WhatsApp |
| Mensagem agendada chega na hora | Envia (verifica a cada 3 min) | WhatsApp |
| Lead vai para "Matriculado" | Registra a matrícula e notifica | Leads, Relatórios, sino |
| Visita marcada como realizada | O lead avança para "Visitou" | Leads |
| Lead sem contato há 5 dias | Lembrete "Sem contato há Nd" | Início, Leads |
| Mais de 5 leads em 24h | Notificação "Alta captação de leads!" | Sino |
| Etapa do funil abaixo de 60% da meta | Notificação ao abrir o Início e alerta semanal às segundas | Sino |
| Todo dia às 18h (Brasília) | "Resumo do dia": novos leads, matrículas, transferências pendentes | Sino |
| Família responde a pesquisa de transferência | A IA gera o diagnóstico | Transferências |
| Família responde "parar" a uma Transmissão | Sai da lista de marketing e recebe confirmação | Transmissões → Não recebem |
| Pagamento da campanha de Transmissão confirmado | A campanha é liberada e começa a enviar (a cada 1 min) | Transmissões |
| Página ou bloco da Vitrine com data marcada | Publica ou esconde na data | Vitrine pública |

### 4.2 O que usa IA

| Função | O que dispara | O que a IA gera | Onde aparece |
|---|---|---|---|
| Análise da IA | Abrir o Início (renova a cada 2h) | Parágrafo curto com o gargalo do funil e a ação imediata | Início do gestor |
| Leitura de relatórios do ERP | Subir arquivo | Histórico de matrículas por ano (total, novatos, rematrículas) | Configuração inicial; Gerador de Campanha |
| Plano de campanha | "Gerar plano com IA" / "Recalcular com IA" | Metas mês a mês, investimento, riscos, ações prioritárias | Gerador de Campanha → Relatórios |
| Diagnóstico do mês | "Gerar diagnóstico do mês" | Relatório de 7 seções | Relatórios → Diagnóstico IA |
| Diagnóstico de transferência | Resposta da família (automático) ou botão | Motivo principal, confiança, riscos, oportunidade de retenção | Transferências |
| Relatório de pesquisa | "Gerar relatório IA" | Resumo, nota, pontos fortes e fracos, risco de rematrícula, ações | Pesquisas → Relatório IA |
| Estimativa de mercado da cidade | Automático (guardado 30 dias) | Estimativa de população escolar e da rede privada | Início, dentro do plano de campanha |

**O que parece IA, mas não é:**

- o passo "Diagnóstico da sua escola" do Gerador;
- os botões Conservador/Realista/Agressivo;
- o Relatório de Mercado;
- a nota da escola;
- o Score do Raio-X.

São cálculos automáticos. Em material de marketing, chame de "análise automática", não de "IA".

**Sobre os "dados do IBGE":** os números de população escolar da cidade são **estimados pela IA**, não consultados no IBGE. Os dados do **Censo Escolar (INEP)** são reais.

---

## 5. Jornadas completas

### a) Do "oi" no WhatsApp até a matrícula

1. **A família vê o anúncio** no Instagram ou entra na Vitrine da escola e toca em "Falar no WhatsApp". A mensagem já vem escrita.
2. **O sistema reconhece de onde ela veio** (Captação Inteligente). A conversa ganha o selo da campanha e o lead é criado sozinho com a origem certa.
3. **O robô responde na hora**, mesmo à noite:
   - dá boas-vindas e mostra o menu ("1. Matrículas 2. Financeiro...");
   - pergunta o nome do aluno e a série;
   - fora do horário, avisa quando a equipe volta.
   
   Se a campanha estiver configurada para pular o robô, a conversa vai direto para uma atendente.
4. **A conversa cai na atendente certa** pelo revezamento entre as disponíveis, ou na fila "Aguardando atendimento" para quem pegar primeiro.
5. **A atendente atende** com respostas rápidas, fotos e vídeo da escola e áudio. Ela vê na lateral a ficha do lead e as notas internas.
6. **Ela agenda a visita** pelo painel da conversa. A família recebe na hora a confirmação no WhatsApp e, no dia, um lembrete. O lead passa para "Visita Agendada" no kanban.
7. **A família visita a escola.** A atendente marca "Realizada" na agenda e o lead vai para "Visitou".
8. **Proposta e retorno:** o lead vai para "Proposta". A atendente marca um lembrete de retorno. Se a família some, o lembrete aparece como atrasado. Se a conversa passa de 24h, ela reativa com uma mensagem-modelo.
9. **Matrícula:** a atendente arrasta o cartão para "Matriculado". O sistema registra a matrícula, notifica o gestor e conta a matrícula para a campanha que trouxe a família (Captação → Dashboard).
10. **Se não matricular:** vai para "Perdido" com um dos 10 motivos, que alimentam o ranking de motivos de perda nos Relatórios.

### b) A rotina diária de quem atende na secretaria

1. **Entra no sistema** e cai no **Início do atendente**: leads de hoje, visitas do dia, lembretes (atrasados primeiro) e mensagens das últimas 24h.
2. **Marca "Disponível"** no topo para receber conversas.
3. **Abre o WhatsApp:**
   - pega as conversas da fila "Aguardando atendimento";
   - responde as "Minhas conversas";
   - resgata as "Conversas paradas", se tiver permissão.
4. **Usa as respostas rápidas** ("/valor", "/visita") para as perguntas repetidas.
5. **Classifica cada contato** ("Nova Família", "Família", "Fornecedor") e cria o lead quando é interesse em matrícula.
6. **Agenda visitas** pela conversa ou pela agenda de Visitas.
7. **Atualiza o kanban** ao fim de cada contato: arrasta o cartão e marca o próximo retorno.
8. **Recebe as visitas do dia** e marca "Realizada" ou "Não compareceu".
9. **Registra transferências** quando uma família avisa que vai sair e manda o link da pesquisa.
10. **Fala com os colegas pelo Chat Interno** sem sair do sistema.
11. **No almoço**, o sistema já sabe o horário dela e não distribui conversas. Ao sair, marca "Ausente".

### c) O que o gestor vê e decide em 5 minutos

1. **Abre o Início** e escolhe "Semana" ou "Mês".
2. **Lê os alertas no topo.** Por exemplo, "12 leads sem contato há mais de 5 dias" leva com um clique à lista filtrada.
3. **Olha os 6 números:** leads, conversas, matrículas, conversão, satisfação e tempo de resposta, cada um comparado ao período anterior.
4. **Lê a "Análise da IA":** um parágrafo com o gargalo do funil e o que fazer agora.
5. **Confere o "Ranking da Equipe".** Clica numa atendente e vê as conversas avaliadas como "Ruim" para conversar com ela.
6. **Vê "Horários de maior movimento"** para decidir a escala da equipe.
7. **Abre Relatórios → Visão Geral:** nota de saúde da campanha, dias restantes e "Velocidade necessária: N matrículas/semana".
8. **Abre Captação → Dashboard:** qual anúncio está trazendo matrícula e qual só traz conversa. Decide onde colocar a verba.
9. **Decisões típicas:**
   - cobrar o retorno dos leads parados;
   - remanejar a verba de anúncio;
   - reforçar a equipe no horário de pico;
   - fazer uma Transmissão para leads mornos.

### d) Uma campanha de rematrícula do início ao fim

**Atenção:** o sistema **não tem um módulo próprio de rematrícula**. A tela "Rematrículas" existe no código, mas não está acessível. A jornada abaixo usa os recursos que existem hoje.

1. **Planejar a meta:** em Relatórios, o gestor usa o Gerador de Campanha. A IA calcula a **meta de rematrículas mês a mês**, junto com a de novatos, a partir do histórico e dos formandos por série.
2. **Medir o risco antes:** em Pesquisas, a escola cria a pesquisa padrão, que pergunta a **probabilidade de rematrícula**, e compartilha o link com as famílias.
   - O painel separa "Vai renovar / Talvez / Não vai renovar".
   - O relatório da IA aponta o risco e as ações.
3. **Agir com quem está em dúvida:** a coordenação liga ou chama no WhatsApp as famílias do "Talvez" e do "Não vai renovar".
4. **Comunicar em massa** (só se a escola tiver Transmissões liberado):
   - criar o modelo "Rematrícula aberta" com os botões "Quero rematricular" e "Tenho dúvidas" e enviar para aprovação da Meta;
   - escolher o público "Cliente (família)" ou por turma;
   - pagar e disparar.
   
   Quem toca em "Tenho dúvidas" pode ir direto para uma atendente com etiqueta. O detalhe da campanha mostra quem leu, respondeu e clicou.
   
   Sem Transmissões: a comunicação é feita uma a uma pelo WhatsApp.
5. **Acompanhar:** o gestor **lança mês a mês** o número de rematrículas confirmadas em Relatórios → Rematrículas (lançamento manual) e acompanha a taxa de fidelização contra a meta.
6. **Quem sai:** registrar em Transferências. A família responde a pesquisa e a IA diz o motivo real e se ainda há chance de retenção.
7. **Fechar:** o gestor vê a campanha encerrada em Relatórios e inicia a do ano seguinte. O botão "Finalizar campanha e gerar relatório final" **está com erro hoje**.

---

## 6. Top 10 para a época de matrícula

1. **Captação Inteligente:** mostra qual anúncio virou matrícula de verdade. É o argumento mais forte para quem investe em tráfego pago.
2. **Caixa de entrada do WhatsApp para a equipe toda:** acaba com o celular único da secretaria. Ninguém perde mensagem nem responde duas vezes no pico de procura.
3. **Robô de atendimento montado sem código:** responde na hora à noite e no fim de semana, quando muita família pesquisa escola, e já entrega nome e série para a atendente.
4. **Kanban de Leads com motivo de perda:** a escola vê cada família no funil e descobre por que está perdendo matrícula (preço, vaga, concorrente).
5. **Gerador de Campanha com IA:** transforma o histórico da escola num plano mensal de metas. O diretor sabe em agosto se vai bater a meta de fevereiro.
6. **Vitrine com o modelo "Matrículas":** página de links com botão de matrícula pulsando, pronta para a bio do Instagram e já rastreada.
7. **Distribuição automática e conversas paradas:** em época de pico, a demanda se divide entre as atendentes e nenhuma família fica esquecida.
8. **Agendamento de visita com confirmação e lembrete no WhatsApp:** menos famílias faltando à visita, que é a etapa que mais converte.
9. **Pesquisa de satisfação com probabilidade de rematrícula:** antecipa quem pode não rematricular, antes que seja tarde.
10. **Painel do gestor com ranking da equipe e tempo de resposta:** mostra quem atende rápido e bem, e em que horário a escola precisa de mais gente.

**Menção especial:** Transmissões tem grande apelo ("rematrícula aberta" para toda a base com um clique), mas **só pode ser anunciado como disponível mediante liberação da Áion** (ver seção 8).

---

## 7. Telas que rendem vídeo

| Tela | Rota | O que mostrar |
|---|---|---|
| Início do gestor | `/home` | Saudação, os 6 números com setas de variação, alertas coloridos, anel da nota da escola, gráficos de leads por dia e por origem, ranking da equipe, mapa de concorrentes. Trocar Hoje → Mês e mostrar os números mudando |
| Kanban de Leads | `/leads` | Arrastar um cartão de "Visitou" para "Matriculado"; arrastar outro para "Perdido" e escolher o motivo. Mostrar cartão de irmãos e os filtros |
| WhatsApp, caixa de entrada | `/whatsapp` | Fila "Aguardando atendimento" com contador, clicar em "Assumir conversa", resposta rápida com "/", enviar áudio, selo "Captação" na conversa, ficha do lead na lateral, "Agendar Visita" |
| Editor de Fluxo do robô | `/settings` → WhatsApp → Conexão → Editor de Fluxo | Tela cheia com blocos ligados por setas; adicionar um bloco Menu com 3 botões; ligar "Robô ativo". Muito visual |
| Captação → Dashboard | `/captacao` | 5 números no topo, gráfico de barras por campanha, tabela comparativa com a coluna de matrículas. Antes, mostrar "Copiar link" de um gatilho |
| Vitrine, editor com prévia | `/vitrine` | Prévia no celular ao lado do editor; aplicar o modelo "Matrículas" e ver o botão pulsar; trocar a cor e ver a página mudar ao vivo; alternar Celular/Computador |
| Vitrine, página pública | aionedu.com.br/{endereço} | Rolagem no celular: capa em vídeo, botão de matrícula, galeria, horário com "Aberto agora", mapa, depoimentos |
| Gerador de Campanha com IA | `/reports` → "Configurar agora" / "Ajustar campanha" | Subir o arquivo, tela "Gerando seu plano" com as mensagens animadas, tabela mensal com ★ nos meses críticos, troca Conservador/Realista/Agressivo |
| Relatórios → Visão Geral e Funil | `/reports` | Nota de saúde da campanha, faixa "Velocidade necessária", funil de 4 etapas real × meta |
| Pesquisas → painel e Relatório IA | `/pesquisas` | Distribuição "Vai renovar / Talvez / Não vai", NPS, relatório da IA com pontos fortes e fracos |
| Transferências → diagnóstico | `/transferencias` | Abrir o "Diagnóstico completo" com motivo principal, confiança e oportunidade de retenção |
| Pesquisa de transferência (visão da família) | link `/survey/...` | Uma pergunta por tela com animação e a cor da escola. Bom para mostrar o "lado da família" |
| Transmissões → nova campanha | `/transmissoes` | Assistente em 4 passos, contador de público e custo ao vivo, detalhe com Enviadas/Entregues/Lidas/Responderam. **Gravar só em escola com o módulo liberado** |
| Agenda de Visitas | `/visits` | Calendário com bolinhas coloridas, "Confirmar Realizada" |
| Relatório de Mercado | `/home` → "Ver relatório completo" | Animação de 5 etapas, ranking "Nº de N escolas privadas", "Faltam X matrículas pra alcançar o 5º colocado" |

**Cuidados na gravação:**

- Use uma escola de demonstração com dados fictícios. Não grave nomes, telefones nem conversas reais de famílias.
- Não grave o Dashboard antigo (`/dashboard`): ele tem números fixos inventados.

---

## 8. O que não prometer

### 8.1 Não existe hoje

| Não prometer | Situação real |
|---|---|
| **Aplicativo para celular** (App Store, Play Store, "instale o app") | Não existe app nem versão instalável. O sistema funciona no **navegador do celular**, com layout adaptado |
| **Integração com ERP** (SIGA, Totvs, Sponte etc.) | Não há integração automática. A escola **exporta o relatório do ERP e sobe o arquivo**, e a IA lê os números agregados por ano. A leitura é afinada para o relatório do SIGA; outros sistemas: não confirmado. Não importa lista de alunos |
| **Módulo de Matrículas / Rematrículas** como tela própria | As telas existem no código, mas a escola não acessa. A matrícula é registrada ao mover o lead; a rematrícula é **lançada à mão**, mês a mês, em Relatórios |
| **Google Meet automático nas visitas** | Só existe no comercial interno da Áion. A agenda de visitas da escola não gera Meet |
| **Lembrete automático de visita em qualquer agendamento** | Só quando a visita é marcada pelo **painel do WhatsApp**. Pela tela Visitas, não sai lembrete |
| **Envio automático de pesquisas** (satisfação ou transferência) para as famílias | A escola **copia e compartilha o link**. Não há disparo em massa a partir dessas telas |
| **Distribuição "menos ocupado" ou aleatória** | Só existe o **revezamento**. Os outros modos aparecem como "EM BREVE" |
| **Renda por bairro / mapa de renda** | A própria tela mostra "Em breve" / "aguardando IBGE 2022" |
| **Dados oficiais do IBGE** | A população escolar da cidade é **estimada por IA**. Dados oficiais são só os do Censo Escolar (INEP) |
| **QR Code gerado pelo sistema** | Não existe. A escola pode gerar o QR do link por fora |
| **Busca geral no topo da tela** | O campo existe, mas não busca nada |
| **Relatório final de campanha por IA** | O botão "Finalizar campanha e gerar relatório final" dá erro |
| **Painel completo de desempenho da Vitrine** (por bloco, por origem) | Hoje mostra só visitas e cliques de 7 dias; "chega na próxima fase" |
| **Avaliação do atendimento "de 1 a 5"** | A família recebe 3 opções (Ruim/Regular/Ótimo). A tela de configuração diz "1 a 5" por engano |
| **"Importação sem limite de linhas"** (texto atual do site) | O limite é de 20.000 linhas por planilha |
| **NPS na pesquisa padrão** | Na pesquisa pronta, o NPS é aproximado. NPS de verdade (0 a 10) só em pesquisa personalizada com esse tipo de pergunta |
| **Chat interno com grupos ou anexos** | Só conversa 1 a 1, sem anexos |
| **Escola criar os próprios modelos de atendimento no WhatsApp** | Quem cadastra os modelos de atendimento é a Áion. A escola cria modelos só dentro de Transmissões |

### 8.2 Depende de liberação ou de configuração da Áion

| Recurso | Situação |
|---|---|
| **Transmissões** (disparo em massa) | Desligado por padrão. A Áion libera escola por escola. A tabela de preços em uso é **provisória** e falta o teste real completo. Não funciona em redes com número compartilhado. Anuncie como "disponível mediante liberação" e não divulgue preço por mensagem até a tabela definitiva |
| **Número compartilhado entre unidades** | Só a Áion configura |
| **Captação, Vitrine e Transmissões para atendentes** | Desligados por padrão para o atendente. O administrador precisa liberar |
| **Conexão do número "sem a equipe Áion"** | O botão "Conectar via Meta" existe, mas não está confirmado que funcione sem apoio da Áion. A coexistência com o app WhatsApp Business tem trecho não confirmado |
| **Gestor mexer em configurações** | Só o Administrador acessa Configurações, Usuários e Permissões do WhatsApp |

### 8.3 Funciona com defeito ou parcialmente

| Recurso | Problema |
|---|---|
| **Formulário de captação para o site** (`/embed`) | Sem acesso pelo menu e com forte indício de que **o envio não grava o lead**: os campos não batem com o banco e o banco recusa gravação anônima. Não prometer "captação no site" até ser corrigido |
| Robô: bloco "Aguardar" | Não espera; a própria tela avisa |
| Robô: ação "Vincular lead" e blocos "Distribuir"/"Lead" | Não funcionam ou estão escondidos ("EM BREVE") |
| Robô: palavra {horario} na mensagem de fora do horário | Sai escrita literalmente, sem trocar pelo horário |
| Robô: "Configurar Bot" com tom, séries, mensalidade e palavras de transferência | Provavelmente não é usado pelo robô (não confirmado). Não anunciar "robô que responde sobre mensalidade sozinho" |
| WhatsApp: "Bloquear contato" no menu da conversa | Provavelmente não bloqueia, apesar da mensagem de sucesso. O bloqueio que funciona é o de Configurações → Bloqueios |
| WhatsApp: "Limpar conversa" | Provavelmente não apaga (não confirmado) |
| Relatórios → Transferências | As colunas Série, Destino e Motivo devem aparecer vazias |
| Transferências: botão "Gerar link pesquisa" | Pode nunca aparecer (não confirmado) |
| Gerador de Campanha: "Salvar rascunho" | Mostra "Salvo!", mas não grava |
| Lembrete "sem contato há 5 dias" | Conta desde o cadastro do lead, não desde o último contato |
| Pesquisa de satisfação: notificação de nova resposta | Leva para uma página que não existe e só é criada se a escola tiver atendente cadastrado |
| Central de Atualizações (`/updates`) | Sem acesso pelo menu. Só aparece o pop-up |

### 8.4 Cuidados com textos do site atual

O site (página inicial) já promete alguns itens desta seção:

- "Google Meet Automático";
- "Integração com o ERP" / "SIGA, Totvs, Escolare, Sistec";
- "Captação no Site";
- "Importação sem limite de linhas";
- "Pesquisas NPS".

Vale revisar antes de reaproveitar em campanha. O site **não menciona Vitrine nem Transmissões**.

---

## 9. Dúvidas para o Victor

1. **Nome do terceiro perfil:** o perfil de quem atende aparece como "Consultor", "Usuário" e "Atendente" em telas diferentes. Qual nome o marketing deve usar?
2. **Transmissões:** já pode ser anunciado? Para todas as escolas ou só sob consulta? Quando sai a tabela de preços definitiva?
3. **Conexão do WhatsApp:** a escola consegue conectar o número sozinha pelo botão "Conectar via Meta", ou a Áion sempre faz junto na implantação? A coexistência com o app WhatsApp Business está liberada?
4. **Limite de conversas:** quantas conversas por mês cada plano inclui? O código tem 1.000 como padrão. Quanto custa a conversa extra? Isso pode aparecer em material público?
5. **Planos e preços:** existe diferença de módulos entre planos? O código não mostra planos com módulos diferentes, só liberações caso a caso.
6. **Integração com ERP:** além do SIGA, a leitura de relatórios já foi testada com Totvs, Escolare, Sistec ou outros? O site cita esses nomes.
7. **Formulário para site (`/embed`):** alguma escola usa hoje? Ele grava leads em produção? Pelo código, provavelmente não.
8. **Rematrícula:** existe plano de liberar as telas de Matrículas e Rematrículas que estão no código? Ou a rematrícula continua sendo lançamento manual em Relatórios?
9. **Satisfação do atendimento:** a ideia é 3 opções (como envia hoje) ou 1 a 5 (como diz a tela)?
10. **Vitrine:** quando chega o painel completo de desempenho (Fase 4)? Pode ser anunciado como "em breve"?
11. **Captação Inteligente:** a página de novidade diz "disponível pra todas as escolas com WhatsApp Oficial conectado". Confirma que não há custo adicional?
12. **Implantação:** o site diz "5 a 7 dias úteis". Continua valendo?
13. **Uso real:** quais módulos as escolas clientes realmente usam hoje (para escolher depoimentos e casos)? Isso não dá para ver pelo código.
14. **Escola de demonstração:** existe uma escola de demonstração com dados fictícios para gravar vídeos sem expor famílias reais?
15. **Raio-X Estratégico:** pode ser divulgado pelo marketing como ferramenta gratuita para prospects? A chamada atual é "Matrículas 2027".
16. **Lembretes automáticos de cobrança e resumos diários:** confirma que os agendamentos automáticos (resumo diário às 18h, alerta de funil às segundas) estão ativos em produção? Algumas dessas rotinas dependiam de aplicação manual no banco.
