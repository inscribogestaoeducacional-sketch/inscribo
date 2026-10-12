# Segredos em `platform_settings` — levantamento e plano de migração

12/10/2026 · **só leitura**: nada foi trocado, movido ou apagado. Complementa
`rotacao-de-segredos-2026-09.md` (roteiro de troca de setembro).

## 1. O que está guardado

`platform_settings` é `key`/`value` em texto puro, 13 linhas. Segredos (regra
`platform_setting_is_secret`: nome com token/secret/password/api_key ou terminado em `_key`):

| Chave | Tipo |
|---|---|
| `service_role_key` | JWT **legado** do Supabase (papel `service_role`, não expira) |
| `wa_access_token` | token da Meta (System User, `EAA…`) |
| `wa_app_secret` | chave secreta do app da Meta (assina os webhooks) |
| `wa_verify_token` | token de verificação do webhook (baixo risco) |
| `asaas_webhook_token` | token que o Asaas manda no webhook |
| `google_oauth_refresh_token` | refresh token do Google (Meet) |

## 2. Quem consegue ler hoje

**Navegador (anon e usuários logados): ninguém.** Conferido no banco e testado como anon:
- RLS ligada; a única policy (`platform_settings_super_admin`) libera só o Super Admin **e exclui as chaves secretas**. Como anon a API responde `42501 permission denied`.
- Nenhuma view, função ou RPC pública devolve esses valores (a única função que lê a tabela é `broadcast_price_campaign`, que lê `asaas_min_charge_brl` e não é executável por anon/authenticated).
- A tela Super Admin → Configurações recebe os segredos **mascarados** pela edge function `platform-admin` (`settings_get`): 4 primeiros + 4 últimos caracteres.
- Nenhuma rota `/api` nem edge function devolve segredo na resposta.

**Servidor (com service_role) — quem lê de fato:**

| Segredo | Quem lê | Reserva em variável de ambiente |
|---|---|---|
| `service_role_key` | **os 10 crons** (`net.http_post`, header `Authorization: Bearer` via `SELECT value FROM platform_settings`) | — |
| `wa_access_token` | Vercel: `api/whatsapp/webhook.ts`, `send.ts`, `send-reaction.ts`, `send-template.ts`, `template-definitions.ts`. Edge: `platform-admin`, `bot-timeout-send`, `school-broadcast-send`, `whatsapp-scheduled-send` | `WA_ACCESS_TOKEN` (Vercel) |
| `wa_app_secret`, `wa_verify_token` | Vercel: `webhook.ts`, `send.ts` | `WA_APP_SECRET`, `WA_VERIFY_TOKEN` (Vercel) |
| `asaas_webhook_token` | Edge: `asaas-webhook` | `ASAAS_WEBHOOK_TOKEN` (Edge) |
| `google_oauth_refresh_token` | Edge: `create-google-meet` lê; Vercel: `api/google/oauth-callback.ts` **grava** | — |
| todos | Edge `platform-admin` (`settings_get` mascarado, `settings_set` grava) | — |

Quem **precisa** ler é exatamente essa lista de servidor. Ninguém no navegador precisa.

## 3. Risco real

1. **Quem tiver a service_role lê todos os outros segredos**, e a própria service_role está na tabela. Um vazamento de qualquer acesso de servidor vira vazamento de tudo.
2. **Os valores de setembro continuam sob suspeita** (roteiro 2026-09). Não dá para saber pelo banco quais foram trocados. Pistas comparando *hashes*, sem ler valores:
   - `service_role_key` da tabela = `APP_SERVICE_ROLE_KEY` (usada pelo `bot-timeout-send`) e é JWT legado. Logo **não foi trocada**, porque a troca exige a migração para chaves novas (item F do roteiro).
   - A `SUPABASE_SERVICE_ROLE_KEY` que o Supabase injeta nas Edge Functions tem hash **diferente** (reinjetada em 12/10 14:25).
   - `asaas_webhook_token` da tabela ≠ `ASAAS_WEBHOOK_TOKEN` da Edge: um dos dois foi trocado e o outro ficou com valor antigo.
3. **`cron.job_run_details` guarda a service_role em texto em 38.231 execuções** (28/05 a 21/08/2026, jobs 6, 10, 11 e 12), da época em que os crons tinham a chave escrita no comando. Hoje só o `postgres` lê (anon/authenticated não têm USAGE no schema `cron`), mas a chave vai junto em qualquer backup ou exportação do banco. A tabela tem 193 mil linhas, porque não há limpeza.
4. **GRANTs largos demais (defesa em profundidade):** `anon` e `authenticated` têm SELECT em `net.http_request_queue` (os cabeçalhos dos crons, com o `Bearer`, ficam ali por segundos até o envio), `net._http_response`, `cron.job`, `cron.job_run_details` e `extensions.pg_stat_statements`.
   - Hoje não são alcançáveis: a API só expõe `public` e `graphql_public` (testado: `PGRST106`), e o schema `cron` não tem USAGE.
   - Mas bastaria uma função `SECURITY INVOKER` em `public` lendo `net.*` para virar vazamento.
   - `pg_stat_statements` e `_http_response` não contêm segredo (conferido: 0 ocorrências de JWT ou token Meta).
5. `authenticated` tem GRANT de INSERT/UPDATE/DELETE na tabela. Hoje a RLS bloqueia, mas o GRANT não precisa existir: quem grava é a edge function, com service_role.
6. A máscara mostra 8 caracteres do segredo (4 + 4). Baixo risco, mas reduz a entropia de tokens curtos (`wa_app_secret` tem 32).
7. Já listado como MÉDIO: `asaas-generate-monthly` roda com `verify_jwt = false`.

## 4. Plano de migração (para aprovar)

**Destino recomendado: Supabase Vault para tudo.** O Vault já está instalado e vazio, e `anon`/`authenticated` não têm acesso ao schema `vault`. Variáveis de ambiente puras quebrariam duas coisas que existem hoje: a troca de token pela tela de Chaves internas e o `oauth-callback` gravando o refresh token do Google. Com o Vault, as duas continuam funcionando. As variáveis `WA_*`/`ASAAS_*` ficam só como reserva, como hoje.

| Etapa | O quê | Quem/onde |
|---|---|---|
| 1 | Funções `platform_secret_get(key)` e `platform_secret_set(key, value)`, `SECURITY DEFINER`, **EXECUTE só para `service_role`**. Leem e gravam `vault.decrypted_secrets` com nome `platform:<chave>`. Durante a transição, se a chave não existir no Vault, leem `platform_settings` | migration |
| 2 | Copiar os 6 segredos para o Vault **dentro do banco** (`vault.create_secret(value)` lendo da tabela; nada passa por chat nem por arquivo) | migration, com ensaio |
| 3 | Leitores passam a usar `platform_secret_get`: as 5 rotas `/api/whatsapp/*` e o `oauth-callback` (que grava via `_set`); as edge functions `platform-admin` (`settings_get/set`), `bot-timeout-send`, `school-broadcast-send`, `whatsapp-scheduled-send`, `asaas-webhook` e `create-google-meet` | código + deploy (Vercel e Edge) |
| 4 | **Crons:** cada job passa a montar o header com `(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'platform:cron_key')`. O job roda como `postgres`, que lê o Vault; o texto do comando não contém a chave. Troca via `cron.alter_job`, um por um, conferindo `cron.job_run_details` e o status HTTP | migration |
| 5 | Depois de 48 h sem leitura de `platform_settings` para segredos: apagar os valores secretos da tabela, tirar o fallback das funções e manter a policy | migration |
| 6 | Limpeza: apagar de `cron.job_run_details` as linhas com JWT; agendar limpeza periódica (7 dias); `REVOKE SELECT` de `anon`/`authenticated` em `net.*`, `cron.*` e `pg_stat_statements`; `REVOKE INSERT/UPDATE/DELETE` de `authenticated` em `platform_settings` | migration |

**Ordem de troca das chaves** (depois da etapa 3, para o valor novo já ir direto ao Vault pela tela de Chaves internas, sem passar pela tabela):
1. **Meta:**
   - `wa_access_token`: gerar um token novo do System User, colar na tela e revogar o antigo;
   - `wa_app_secret`: redefinir no app e atualizar a tela e o `WA_APP_SECRET` da Vercel;
   - `wa_verify_token`, opcional.
   - Passos C, D e E do roteiro de setembro.
2. **Asaas:** `asaas_webhook_token` novo no painel do Asaas e na tela; apagar ou alinhar o `ASAAS_WEBHOOK_TOKEN` da Edge (hoje divergente). Passo A.
3. **Google:** revogar o acesso do app na conta, reconectar (o `oauth-callback` grava no Vault). Passo B.
4. **service_role por último:** é a migração para as chaves novas (`sb_secret_…`), item F do roteiro.
   - As funções passam a aceitar a chave nova.
   - O Vault recebe `platform:cron_key` = `sb_secret_…`, e os crons passam a mandar `apikey` em vez de `Bearer`.
   - Vercel e navegador passam para as chaves novas.
   - Por fim, **desativar as chaves legadas** no painel. Só aí a chave vazada morre, e `APP_SERVICE_ROLE_KEY` sai do `bot-timeout-send`.

Nada disso foi executado. Cada etapa sai com ensaio e espera o ok.
