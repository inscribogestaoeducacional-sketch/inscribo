# ETAPA 3B-2 — Configurações do Edu no desenho do AION Business

22/10/2026 · branch `config-visual-business` (base `main` ad30260) · só prévia, sem merge.
Referência: AION Business `origin/main` 1382564, `SystemSettings.tsx`, `WhatsAppAutomations.tsx`, `lib/brand.ts` e `ui/PageHeader.tsx`.

## O que foi portado
- **Casca:** `PageHeader` (ícone em degradê), busca, assuntos em abas no computador e lista de seleção no celular.
- **Grupos:** WhatsApp e robô, Escola, Equipe e acessos, Funil e leads, Bloqueios. Cada um abre em `/settings/<grupo>`.
- **Início do WhatsApp:** faixa da conexão (Conectado/Desconectado, Verificar, Robô ligado, Gerenciar conexão / Reconectar agora) e cartões por assunto (Automação, Atendimento, Organização).
- **Seções:** "← WhatsApp", título e uma frase explicando a seção. Cartões, botões em degradê e cores vêm de `src/lib/brand.ts`, copiado do Business; para usar o verde-água do Edu, basta trocar esse arquivo.
- **Automações:** visão do Business adaptada ao Edu, só leitura. Mostra robô, fora do horário, almoço, família parou de responder e avaliação, com "Valendo agora", e cada cartão abre onde aquilo se edita.
- **Valendo agora:**
  - tempo do robô × tempo da Equipe (já existia);
  - novo: **destino de quem chama fora do horário** (o webhook usa o grupo do tempo de inatividade), mostrado em Horário e em Equipe.

## Gravações
- Os mesmos caminhos de antes (`whatsapp_flows` por `institution_id`, `institutions`, `users`, `whatsapp_quick_replies`, `whatsapp_groups`, `whatsapp_tags`, `whatsapp_blacklist`).
- **Mudou só uma coisa:** Horário, tempo de espera do robô e conversa parada deixaram de gravar a linha inteira (cerca de 25 colunas, inclusive boas-vindas, menu e o liga/desliga do robô). Cada botão agora grava só as colunas da própria seção, como Equipe e Avaliação já faziam.
- A mensagem genérica de fora do horário só aparece (e só é gravada) com o robô desligado, que é quando ela tem efeito.
- **Testes:**
  - `tests/settings-columns.test.ts`: cada coluna gravada é lida pelo webhook, por `workingHours`, por `transfer-conversation` ou por `process_bot_timeouts`;
  - `tests/settings-map.test.ts`: links antigos, 9 de 9;
  - autoteste no navegador (fora do repositório): salvar e recarregar, 14 de 14.

## Removido por não existir (ou não ter efeito) no Edu
- **Do Business, não portado:** Empresa, Endereço na internet, Recebimentos, Assinatura, Loja, Catálogo, Feriados e datas especiais, Modelos da Meta (no Edu ficam em Transmissões), conexão por QR Code, Agenda, Pedidos e Lembrete de cobrança nas Automações, liga/desliga por automação (precisaria da coluna `automations`, que o Edu não tem) e "Cliente voltou depois de concluída" (coluna que o Edu não tem).
- **Do menu do Edu:**
  - os cartões Plano e cobrança, Inteligência artificial e Dados e privacidade;
  - todos os itens "em breve".
  - Os links antigos `?tab=pagamentos`, `?tab=transmissoes` e `?tab=geral` continuam abrindo as telas de hoje.
- **Sem efeito, não aparecem:** boas-vindas e menu fora do robô, reativação, e a mensagem genérica de fora do horário quando o robô está ligado.
- **Avaliação do atendimento:** o Business tem botões editáveis, uma pergunta quando a nota é ruim e prazos. Isso exige colunas que o Edu não tem, então ficou o desenho com os campos atuais (liga/desliga e mensagem).
