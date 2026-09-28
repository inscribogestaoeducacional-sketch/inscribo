# Roteiro de troca dos segredos — setembro/2026

**Por quê:** até 28/09/2026, qualquer usuário logado (de qualquer escola) conseguia ler
`platform_settings` inteira — inclusive `service_role_key`, `wa_access_token`,
`wa_app_secret`, `google_oauth_refresh_token` e `asaas_webhook_token` — e qualquer
usuário de escola conseguia **alterar** o `access_token` do WhatsApp da Áion
(`platform_whatsapp`). A chave secreta do app da Meta também passou pelo chat.
A brecha foi fechada (commits `e766d5c` e `fix(seguranca): fecha RLS…`), mas quem leu
antes ainda tem os valores. Todos os segredos abaixo são considerados comprometidos.

**Regra geral:** nenhum valor novo passa por chat, e-mail ou print. Você copia do painel
de origem e cola direto no destino. Os campos de segredo em **Super Admin →
Configurações** agora são mascarados: aparecem vazios com "Atual: EAAG…x1Z9", e
**vazio ao salvar = mantém o atual**.

---

## 0. Antes de começar (10 min)

1. **Confirme que a correção está no ar.** Abra Super Admin → Configurações → WhatsApp.
   Os campos de token devem aparecer vazios, com a linha "Atual: …".
2. **Veja se alguém leu os segredos.** Supabase → Logs → *API Gateway* (o período
   disponível depende do plano). Filtre por `path` contendo `platform_settings`.
   Chamadas `GET` feitas por usuários que não são o Super Admin (o `sub` do JWT) antes de
   28/09 ~18h14 indicam leitura. Isso não muda o roteiro, mas diz se algum item é urgente.
3. **Escolha um horário de pouco movimento.** Os passos C e D (Meta) têm uma janela de
   1–3 minutos em que envios falham ou webhooks atrasam.

Ordem recomendada: **A → B → C → D → E**, depois **F** (que depende de código).

---

## A. Token do webhook do Asaas (`asaas_webhook_token`)

Usado por `asaas-webhook` pra aceitar só chamadas do Asaas (o Asaas manda o token no
header `asaas-access-token`).

1. Gere um valor aleatório novo, de pelo menos 32 caracteres, no gerenciador de senhas.
2. Asaas → **Integrações → Webhooks** → edite o webhook da Áion → campo **Token de
   autenticação** → cole o valor novo → salvar.
3. **Logo em seguida**, no Super Admin → Configurações → **Chaves internas** → *Token do
   webhook do Asaas* → cole o mesmo valor → **Salvar seção**.
4. Na mesma tela do Asaas, confira se a **fila de webhooks** não ficou pausada. O Asaas
   pausa a fila depois de muitas falhas seguidas; se pausou, reative. Os eventos que
   falharam no meio são reenviados.
5. Supabase → Edge Functions → **Secrets**: a variável `ASAAS_WEBHOOK_TOKEN` guarda o
   valor antigo como reserva (só é usada se a linha da tabela sumir). Atualize com o novo
   ou apague.

**Conferir:** Asaas → Webhooks → envie um evento de teste, ou espere o próximo pagamento.
No log da função `asaas-webhook` não pode aparecer "token inválido".

---

## B. Google (`google_oauth_refresh_token`)

Usado pra criar reuniões no Google Meet.

1. Entre na conta Google conectada → https://myaccount.google.com/permissions →
   remova o acesso do app da Áion. Isso revoga o refresh token vazado.
2. Super Admin → Configurações → Google Meet → **Conectar Google** → autorize. O servidor
   grava o token novo sozinho.

**Conferir:** a tela mostra "conectado"; crie uma reunião de teste.

---

## C. Token global da Meta (`wa_access_token` + WhatsApp da Áion)

É o token do **System User** do app "Aion Edu" (1553850949606633), sem validade. Envia
as mensagens das escolas, das Transmissões e do número da Áion. **O mesmo valor está em
dois lugares:** `platform_settings.wa_access_token` e `platform_whatsapp.access_token`.

> Ponto a conferir no painel: no Business Manager, "Revogar tokens" de um System User
> revoga **todos** os tokens dele naquele app. Por isso a ordem abaixo gera o novo
> **depois** de revogar. Se o seu painel permitir revogar só o token antigo, gere o
> novo primeiro e revogue o antigo no fim, sem janela nenhuma.

1. Deixe aberta a tela Super Admin → Configurações (seção WhatsApp global **e** seção
   WhatsApp Áion). Se houver campanha de Transmissões **enviando**, pause antes (detalhe
   da campanha → Pausar) e retome depois do passo 4.
2. Business Manager (business.facebook.com) → **Configurações do negócio → Usuários →
   Usuários do sistema** → o usuário do sistema do app → **Revogar tokens** do app
   "Aion Edu". *A partir daqui os envios falham até o passo 4.*
3. No mesmo usuário → **Gerar novo token** → app "Aion Edu" → validade **Nunca** →
   permissões `whatsapp_business_management` e `whatsapp_business_messaging` → gerar →
   copiar.
4. Cole em **dois campos** e salve cada seção:
   - Configurações → WhatsApp global → **Access Token** → Salvar seção.
   - Configurações → WhatsApp Áion → **Access Token** → **Salvar credenciais**.
5. Mensagens de atendimento enviadas durante a janela falham e precisam ser reenviadas
   pelo inbox. Por isso o horário de pouco movimento.

**Conferir:**
- Configurações da escola → WhatsApp → **Testar conexão** mostra "✅ Conectado".
- Mande uma mensagem de teste pelo inbox de uma escola e uma pelo inbox da Áion.
- Configurações → a linha "Atual:" dos dois campos mostra o começo e o fim do token novo.

**Reservas antigas:** Vercel → Project → Settings → Environment Variables → se existir
`WA_ACCESS_TOKEN`, atualize com o novo ou apague. Ela só é usada se a linha da tabela
sumir. No Supabase não existe essa variável.

---

## D. Chave secreta do app (`wa_app_secret` + `WA_APP_SECRET` na Vercel)

Usada pra validar a assinatura dos webhooks da Meta (`api/whatsapp/webhook.ts`, lida da
tabela) e no cadastro de número por Embedded Signup (`api/whatsapp/embedded-signup.ts`,
lida **só** da variável da Vercel).

**Durante a troca não se perde mensagem.** Com a chave dessincronizada, o webhook
responde 401 e a Meta reenvia a notificação por até 7 dias. As mensagens só chegam
atrasadas.

1. Deixe abertas: Super Admin → Configurações → WhatsApp global, e Vercel → Settings →
   Environment Variables.
2. Meta for Developers → app **Aion Edu** → **Configurações do app → Básico → Chave
   secreta do app → Redefinir** → confirme → copie a chave nova.
   *A partir daqui os webhooks recebidos dão 401 (a Meta vai reenviar).*
3. **Imediatamente:** Configurações → WhatsApp global → **App Secret** → cole →
   **Salvar seção**. Os webhooks voltam a ser aceitos na hora.
4. Vercel → `WA_APP_SECRET` → edite com a chave nova (Production, e Preview se houver) →
   **Redeploy** do último deploy de produção. Isso é o que faz o Embedded Signup usar a
   chave nova.

**Conferir:**
- Mande um "oi" pro número de uma escola e pro da Áion. As mensagens aparecem no inbox;
  as que atrasaram na janela chegam em seguida.
- Vercel → Logs → não devem aparecer novos `Webhook signature inválida`.

---

## E. Token de verificação do webhook (`wa_verify_token`) — opcional, baixo risco

Só é usado quando a Meta **verifica** a URL do webhook (ao configurar ou editar). Não
assina nada.

1. Gere um valor novo → Configurações → WhatsApp global → **Verify Token** → salvar.
2. Meta for Developers → WhatsApp → Configuração → Webhook → **Editar** → cole o mesmo
   valor no *Token de verificação* → **Verificar e salvar**.
3. Vercel: se existir `WA_VERIFY_TOKEN`, atualize ou apague.

---

## F. `service_role_key` do Supabase — NÃO dá pra trocar só pelo painel

**O problema:** a `service_role_key` atual é uma chave **legada** (um JWT assinado pelo
segredo legado do projeto) que **não expira**. O Supabase não gera uma nova
`service_role` legada. Pra invalidar a vazada é preciso **desativar as chaves legadas**
(anon e service_role juntas) e passar a usar as chaves novas: `sb_secret_…` no servidor e
`sb_publishable_…` no navegador.

Isso mexe em código em vários pontos, por isso não entra neste roteiro manual:

| Onde | Hoje | Muda para |
|---|---|---|
| 26 das 29 Edge Functions | `SUPABASE_SERVICE_ROLE_KEY` (injetada pelo Supabase, legada) | `SUPABASE_SECRET_KEYS` (**já está injetada no projeto**) |
| `bot-timeout-send` | variável manual `APP_SERVICE_ROLE_KEY` | chave secreta nova |
| 10 funções em `api/` na Vercel | env `SUPABASE_SERVICE_ROLE_KEY` | env com a chave secreta nova |
| 10 crons (`net.http_post`) | `Authorization: Bearer <service_role>` lido de `platform_settings.service_role_key` | header `apikey` com a chave secreta. **Chave nova não é JWT**: funções com verificação de JWT ligada recusariam `Bearer sb_secret_…`, então essas funções passam a conferir a chave no código |
| Navegador (`VITE_SUPABASE_ANON_KEY`), `public/embed.js`, anon fixa em `SystemSettings.tsx` | anon legada (JWT) | `sb_publishable_…` |

O Supabase já anunciou que as chaves legadas deixam de existir até o fim de 2026, então
essa migração teria que ser feita de qualquer jeito.

**Proposta (precisa da sua aprovação, código à parte):** eu preparo a migração em
etapas, cada uma testada e sem janela de queda:
1. As funções passam a aceitar a chave nova e a antiga ao mesmo tempo.
2. Você cria a chave secreta nova no painel e grava pela tela de Chaves internas.
3. Os crons passam a usar a chave nova.
4. A Vercel e o navegador passam a usar as chaves novas.
5. Por último, você **desativa as chaves legadas** no painel. Só aí a chave vazada morre.

**Até lá, a contenção possível:** a tabela já não é mais legível pelo navegador, então
ninguém *novo* consegue pegar a chave. Quem pegou antes continua com acesso total ao
banco (por isso o item 0.2 importa). Se o log mostrar leitura suspeita, a migração vira
prioridade máxima.

---

## Pendência encontrada durante o levantamento (não é segredo vazado)

- **Cron `nf-pending-check` quebrado.** O header dele tem um texto provisório no lugar da
  chave (algo como `<SERVICE_ROLE_KEY>`), então a chamada diária das 12h10 não autentica.
  Isso será corrigido junto com a etapa 3 da migração do item F.

---

## Checklist rápido

- [ ] 0. Correção no ar confirmada; logs de `platform_settings` conferidos
- [ ] A. Asaas: token novo no Asaas + Chaves internas; fila ativa; secret `ASAAS_WEBHOOK_TOKEN` atualizado/apagado
- [ ] B. Google: acesso revogado + reconectado
- [ ] C. Meta token: revogado + novo gerado + colado nos **2** campos; testes de envio ok; `WA_ACCESS_TOKEN` da Vercel atualizado/apagado
- [ ] D. App secret: redefinido + colado na tela + `WA_APP_SECRET` na Vercel + redeploy; webhooks chegando
- [ ] E. (opcional) Verify token nos dois lados
- [ ] F. Aprovar a migração pras chaves novas do Supabase
