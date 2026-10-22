# ETAPA 3B — Protótipo do novo painel de Configurações

22/10/2026 · branch `config-prototipo` (a partir da `main` ad30260) · **só visual e navegação**: nenhum dado, migration, coluna ou regra de banco alterado.

## O que mudou na tela
- `/settings` abre o **Início**: 9 cartões (grupos) e uma busca no topo. Cada perfil vê só os cartões que já abre hoje. Atendente continua sem acesso.
- `/settings/<grupo>` abre a **tela do grupo**: as opções agrupadas por assunto, cada uma com uma frase de ajuda e, quando faz sentido, a linha **"Valendo agora"**, que mostra o valor salvo (somente leitura).
- Cada opção **leva para a tela que já existe hoje**: os mesmos componentes e as mesmas gravações. Itens sem tela aparecem como **"Em breve"**, desabilitados.
- As telas antigas (`/settings?tab=…&sec=…`) não têm mais a barra de abas. No lugar dela há o caminho "Configurações › grupo" e o título.
- Transmissões aceita `?aba=modelos` e `?aba=nao-recebem` para abrir direto na aba certa. Antes a aba só existia no estado da tela.

Código: `src/lib/settingsMap.ts` (mapa único, busca, links antigos) · `src/components/management/settings/` (telas e "Valendo agora") · `SystemSettings.tsx` (liga tudo) · `tests/settings-map.test.ts`.

## Links antigos
| Link | Para onde vai |
|---|---|
| `/settings` (menu, TopBar, Início do gestor) | Início das Configurações |
| `/settings?tab=whatsapp` sem seção (**alertas da central de notificações**, atalhos do Hub) | `/settings/whatsapp`, com a conexão em destaque no topo |
| `/settings?tab=whatsapp&sec=<seção que o perfil abre>` | a mesma tela de hoje |
| `/settings?tab=whatsapp&sec=<seção que o perfil não abre>` | `/settings/whatsapp` |
| `/settings?tab=escola`, `?tab=integracoes`, `?tab=geral`, `?tab=identidade`, `?tab=pagamentos` | a mesma tela de hoje (se o perfil abre) |
| `?tab=transmissoes` | a mesma tela, se o módulo estiver liberado; senão, o Início |
| aba que o perfil não abre, aba ou grupo inexistente | Início |

Antes, uma aba proibida ou inexistente caía na primeira aba visível. Agora cai no Início.

## Mapa dos 51 itens
Situação: **tela existente** · **a juntar** (com outra tela ou cópia) · **remover** (sem efeito) · **nova** (sem tela, "em breve") · **fora** (não é do painel da escola).
Os itens #19 e #37 aparecem duas vezes porque viraram duas opções.

| # | Item | Grupo | Assunto | Situação | Leva para | Quem vê |
|---|---|---|---|---|---|---|
| 1 | Nome, e-mail, telefone e CNPJ | Escola | Dados da escola | tela existente | `/settings?tab=geral` | admin |
| 2 | Cidade e estado | Escola | Dados da escola | a juntar — uma cópia só (hoje também no assistente da campanha) | `/settings?tab=geral` | admin |
| 3 | Logo e cores da escola | Escola | Logo e cores | tela existente | `/settings?tab=identidade` | admin |
| 4 | Séries | Escola | Séries | a juntar — uma lista só (hoje o assistente tem outra) | `/settings?tab=escola` | admin, gestor |
| 5 | Nome do atendente nas mensagens | WhatsApp e atendimento | Atendimento | tela existente | `/settings?tab=whatsapp&sec=conexao` | admin |
| 6 | Usuários | Equipe e acessos | Pessoas | tela existente | `/users` | admin |
| 7 | Vê todas as conversas e o histórico | Equipe e acessos | O que cada pessoa vê | tela existente | `/users` | admin |
| 8 | Módulos por atendente | Equipe e acessos | O que cada pessoa vê | a juntar — mostrar junto o que a escola contratou (#44) | `/users` | admin |
| 9 | Permissões Relatórios, Pesquisas, Usuários, Configurações | Equipe e acessos | O que cada pessoa vê | remover (sem efeito) — sem efeito: o perfil já decide | — | — |
| 10 | Horário e almoço de cada atendente | Equipe e acessos | Horário dos atendentes | tela existente | `/settings?tab=whatsapp&sec=equipe` | admin |
| 11 | Meu perfil | Equipe e acessos | Pessoas | tela existente — fica no menu da pessoa | `/profile` | admin, gestor |
| 12 | Robô de atendimento | Robô e mensagens automáticas | Robô | tela existente | `/settings?tab=whatsapp&sec=conexao` | admin |
| 13 | Dias e horário de atendimento | WhatsApp e atendimento | Atendimento | tela existente | `/settings?tab=whatsapp&sec=horario` | admin |
| 14 | Mensagem fora do horário | Robô e mensagens automáticas | Mensagens automáticas | a juntar — fica só a das transferências (#15); a genérica (#14) sai | `/settings?tab=whatsapp&sec=horario` | admin |
| 15 | Mensagem fora do horário | Robô e mensagens automáticas | Mensagens automáticas | a juntar — fica só a das transferências (#15); a genérica (#14) sai | `/settings?tab=whatsapp&sec=horario` | admin |
| 16 | Mensagem de almoço | Robô e mensagens automáticas | Mensagens automáticas | tela existente | `/settings?tab=whatsapp&sec=horario` | admin |
| 17 | Tempo do robô (inatividade) | Robô e mensagens automáticas | Mensagens automáticas | a juntar — juntar os dois tempos (Horário e Equipe) num só; o destino fora do horário vira campo próprio | `/settings?tab=whatsapp&sec=horario` | admin |
| 18 | Conversa parada | WhatsApp e atendimento | Atendimento | tela existente | `/settings?tab=whatsapp&sec=horario` | admin |
| 19 | Tempo do robô (inatividade) | Robô e mensagens automáticas | Mensagens automáticas | a juntar — juntar os dois tempos (Horário e Equipe) num só; o destino fora do horário vira campo próprio | `/settings?tab=whatsapp&sec=horario` | admin |
| 19 | Tempo de inatividade (Equipe) | Robô e mensagens automáticas | Mensagens automáticas | a juntar — parte do #17 | `/settings?tab=whatsapp&sec=equipe` | admin, gestor |
| 20 | Boas-vindas e menu antigos | Robô e mensagens automáticas | Robô | remover (sem efeito) — sem efeito (o robô visual substituiu); parar de regravar | — | — |
| 21 | Reativação de conversa | Robô e mensagens automáticas | Robô | remover (sem efeito) — nenhum código lê | — | — |
| 22 | Avaliação do atendimento | WhatsApp e atendimento | Atendimento | tela existente — renomear: deixa de se chamar "Pesquisa" | `/settings?tab=whatsapp&sec=pesquisa` | admin, gestor |
| 23 | Conexão do WhatsApp | WhatsApp e atendimento | Conexão | tela existente | `/settings?tab=whatsapp&sec=conexao` | admin |
| 24 | Respostas rápidas | WhatsApp e atendimento | Atendimento | a juntar — uma lista só (hoje editável aqui e no Hub) | `/settings?tab=whatsapp&sec=respostas` | admin, gestor |
| 25 | Grupos de atendimento (filas) | WhatsApp e atendimento | Organização | tela existente | `/settings?tab=whatsapp&sec=equipe` | admin, gestor |
| 26 | Números bloqueados | Bloqueios e privacidade de contatos | Bloqueios | a juntar — tela única com 2 tipos (tabelas continuam separadas) | `/settings?tab=whatsapp&sec=bloqueios` | admin, gestor |
| 27 | Não recebem campanhas | Bloqueios e privacidade de contatos | Bloqueios | a juntar — mesma tela dos bloqueados, tipo "só campanhas" | `/transmissoes?aba=nao-recebem` | admin, gestor (com Transmissões) |
| 28 | Etiquetas | WhatsApp e atendimento | Organização | tela existente | `/settings?tab=whatsapp&sec=etiquetas` | admin, gestor |
| 29 | Campo de unidade do lead | Funil e leads | Leads | tela existente | `/settings?tab=escola` | admin, gestor |
| 30 | Lembrete de lead sem contato | Funil e leads | Leads | tela existente | `/settings?tab=escola` | admin |
| 31 | Motivos de perda | Funil e leads | Leads | nova (em breve) — só consulta no início | — | admin, gestor |
| 32 | Nomes das etapas do funil | Funil e leads | Leads | nova (em breve) — antes: fonte única dos nomes (hoje copiados em 6 arquivos) | — | admin, gestor |
| 33 | Campos personalizados de contato | Funil e leads | Contatos | tela existente | `/contacts` | admin, gestor |
| 34 | Captação Inteligente | Funil e leads | Captação | tela existente — fica no módulo | `/captacao` | admin, gestor |
| 35 | Dados da campanha (assistente) | Escola | Campanha de matrículas | a juntar — cidade/UF e séries passam a vir de Escola | `/settings?tab=escola` | admin |
| 36 | Pedidos de mudança da campanha | Escola | Campanha de matrículas | tela existente | `/home` | admin, gestor |
| 37 | Fonte da base e rematrícula | Funil e leads | Base de alunos | tela existente | `/settings?tab=integracoes` | admin |
| 37 | Base de alunos: planilha e lançamento manual | Funil e leads | Base de alunos | tela existente | `/settings?tab=integracoes` | admin, gestor |
| 38 | Pesquisa de saída | Funil e leads | Base de alunos | tela existente — renomear "Pesquisa de saída" | `/pesquisas` | admin, gestor |
| 39 | Activesoft | Funil e leads | Base de alunos | tela existente | `/settings?tab=integracoes` | admin |
| 40 | Vitrine (página de links) | Funil e leads | Captação | tela existente — fica no módulo; logo e cores herdam de Escola | `/vitrine` | admin, gestor |
| 41 | Modelos aprovados pela Meta | Robô e mensagens automáticas | Modelos | tela existente | `/transmissoes?aba=modelos` | admin, gestor (com Transmissões) |
| 42 | Plano e mensalidade da Áion | Plano e cobrança | Plano | tela existente — renomear "Mensalidade da Áion" | `/settings?tab=geral` | admin |
| 43 | Pagamentos | Plano e cobrança | Pagamentos | tela existente | `/settings?tab=pagamentos` | admin |
| 44 | Módulos contratados | Plano e cobrança | Módulos e créditos | nova (em breve) — escola só vê; a Áion libera | — | admin |
| 45 | Créditos de Transmissões | Plano e cobrança | Módulos e créditos | tela existente | `/settings?tab=transmissoes` | admin (com Transmissões) |
| 46 | Uso da IA no mês | Inteligência artificial | Uso da IA | nova (em breve) | — | admin |
| 47 | Termo de uso de dados (LGPD) | Dados e privacidade (LGPD) | LGPD | nova (em breve) — aguarda texto final | — | admin |
| 48 | Exportar conversas | Dados e privacidade (LGPD) | Exportação | tela existente — ampliar depois | `/whatsapp` | admin, gestor |
| 49 | notification_settings | Dados e privacidade (LGPD) | LGPD | remover (sem efeito) — coluna sem código | — | — |
| 50 | Alertas do WhatsApp | WhatsApp e atendimento | Conexão | nova (em breve) | — | admin, gestor |
| 51 | Limites do silêncio e escolas ignoradas | — | — | fora do painel da escola — Super Admin → Configurações (regra da Áion) | — | — |

## Verificação
- `npx tsc --noEmit -p tsconfig.app.json`: 51 erros, **os mesmos 51 da main** (nenhum nos arquivos novos ou alterados).
- `npx eslint` nos arquivos alterados: 49 problemas, **os mesmos 49 da main**.
- `npx vite build`: passou.
- `npx tsx --test tests/settings-map.test.ts`: 9/9. Cobre os 51 itens no mapa, os links usados no código e nos alertas, todo `settingsHref()` para admin e gestor, perfil sem acesso, módulo de Transmissões, os cartões por perfil e a busca sem acento.
- Escritas: nenhuma mudança em `api/` ou `supabase/`, e nenhuma chamada nova ou removida de `update`, `insert`, `upsert`, `delete` ou `rpc` no diff. O "Valendo agora" só faz `select`.
