# Teste de segurança — api/whatsapp/embedded-signup.ts

Objetivo: provar quem pode conectar o WhatsApp de qual escola por este
endpoint (conexão, reconexão e eventos do popup):

| Quem chama | Pode conectar |
|---|---|
| Super Admin `admin_geral` (ativo) | **qualquer** escola, informando `institution_id` no corpo; é o único que conclui **sem `code`** (só com os ids do FINISH da Meta) |
| Consultor (`user_type` = `consultant`) | **nenhuma** → 403 (nem vê o botão na ficha) |
| Admin da escola (`role` = `admin`) | **só a própria** escola (resolvida pelo token) e **só com `code`**; `institution_id` de outra escola → 403 |
| Atendente (`role` ≠ `admin`), sem login, token inválido | **nenhuma** → 403 |

A regra está em `api/_lib/whatsappConnectAuth.ts` (`resolveConnectContext`).
Nenhum caso negado lê ou grava nada antes de responder.

Travas da conta (`api/_lib/whatsappConnect.ts`, com ou sem `code`), nesta ordem:
1. nunca troca a WABA já salva da escola; nunca aceita a WABA de teste
   `2812701862456294` (nem a de `platform_settings.wa_waba_id`) — antes de
   chamar a Meta;
2. a WABA tem de estar no portfólio da Áion `1009021325175669`
   (`client_whatsapp_business_accounts` ou `owned_whatsapp_business_accounts`),
   conferido com o token da plataforma; senão 409 `waba_de_outro_portfolio`;
3. o número tem de ser dessa WABA (`/{waba}/phone_numbers`);
4. só então: `subscribed_apps`, leitura do número, gravação e `smb_app_data`.
   **Nunca** `/register` e **nunca** `fb_exchange_token`.
Toda recusa grava `Conexão WhatsApp (Meta): recusada` com o motivo.

## 1. Teste automático (rodar antes de todo deploy que mexa nisso)

```bash
npx tsx --test tests/embedded-signup.security.test.ts
```

Usa o handler real com a autenticação, o banco e a Meta simulados (em memória). Cobre:
sem login, token inválido, atendente (com e sem `institution_id`), admin da
própria escola, admin tentando a escola B (conexão, reconexão e evento),
superadmin nas escolas A e B, superadmin com escola inexistente/id inválido,
superadmin sem escola, consultor (conexão, reconexão e evento → 403),
superadmin inativo, a regra `canConnectAnySchool` e a regra de WABA (`checkPopupWaba`: nunca troca a
conta salva nem aceita a conta de teste da plataforma). E a conexão sem `code`:
superadmin com ids válidos grava (sem trocar code, com webhook e histórico, sem
/register); WABA de outro portfólio, WABA de teste, WABA diferente da salva e
número fora da WABA são recusados sem gravar; admin da escola sem `code` → 400;
admin com `code` válido grava e com `code` recusado não; consultor e atendente
não concluem nem disparam a verificação antes do popup; o filtro dos detalhes
da Meta no audit (`metaDetail`) descarta qualquer campo fora da lista.

**Critério de aceite:** todos passam.

## 2. Teste manual em produção (com tokens reais)

Pré-requisitos: Escola A e Escola B de teste; tokens de sessão
(`supabase.auth.getSession()` no console do navegador logado) de:
`TOKEN_SUPER` (Super Admin admin_geral), `TOKEN_CONSULTOR` (consultor),
`TOKEN_ADMIN_A` (admin da A), `TOKEN_USER_A`
(atendente da A). IDs `INSTITUTION_A_ID` e `INSTITUTION_B_ID`.

Os testes abaixo mandam corpo **sem `code`** e com ids falsos de propósito:
admin da escola para em `400 ... obrigatórios`, sem chamar a Meta; o Super
Admin segue para a Meta e é recusado (`409`) porque a conta `2` não está no
portfólio da Áion — grava só a linha de recusa no audit, nunca o número.

```bash
URL=https://www.aionedu.com.br/api/whatsapp/embedded-signup
post() { curl -s -o /dev/stderr -w "%{http_code}\n" -X POST $URL \
  -H "Content-Type: application/json" ${1:+-H "Authorization: Bearer $1"} -d "$2"; }
```

| # | Comando | Esperado |
|---|---|---|
| 1 | `post "" '{"phone_number_id":"1","waba_id":"2"}'` | 403 |
| 2 | `post token-invalido '{"phone_number_id":"1","waba_id":"2"}'` | 403 |
| 3 | `post $TOKEN_USER_A '{"phone_number_id":"1","waba_id":"2"}'` | 403 (atendente não conecta) |
| 4 | `post $TOKEN_ADMIN_A '{"phone_number_id":"1","waba_id":"2"}'` | 400 obrigatórios (própria escola) |
| 5 | `post $TOKEN_ADMIN_A '{"phone_number_id":"1","waba_id":"2","institution_id":"'$INSTITUTION_B_ID'"}'` | **403** (o crítico) |
| 6 | `post $TOKEN_ADMIN_A '{"event":"reconnect_click","institution_id":"'$INSTITUTION_B_ID'"}'` | 403 |
| 7 | `post $TOKEN_SUPER '{"phone_number_id":"1","waba_id":"2","institution_id":"'$INSTITUTION_A_ID'"}'` | 409 (conta fora do portfólio) |
| 8 | `post $TOKEN_SUPER '{"phone_number_id":"1","waba_id":"2812701862456294","institution_id":"'$INSTITUTION_B_ID'"}'` | 409 (conta de teste) |
| 9 | `post $TOKEN_SUPER '{"phone_number_id":"1","waba_id":"2","institution_id":"00000000-0000-4000-8000-000000000000"}'` | 404 |
| 10 | `post $TOKEN_CONSULTOR '{"phone_number_id":"1","waba_id":"2","institution_id":"'$INSTITUTION_A_ID'"}'` | **403** (consultor não conecta) |

Depois dos testes, conferir com a service role que nada mudou:

```sql
select institution_id, phone_number_id, waba_id, connection_method
from whatsapp_phone_numbers
where institution_id in ('<INSTITUTION_A_ID>', '<INSTITUTION_B_ID>');
```

## 3. Registro (audit_logs)

Toda conexão/reconexão pelo popup grava em `audit_logs` (`module = 'whatsapp'`)
a escola (`institution_id`), quem fez (`user_id`, `user_name`; `user_role` =
`superadmin (admin_geral)` quando foi a equipe Áion), o resultado
(`... clicado`, `verificação antes do popup`, `Meta avisou o fim (FINISH)`,
`popup não concluído`, `recusada`, `concluída`, `falhou`) e o tipo (`tipo:
coexistencia | cloud_api` e `sem_code` no `new_value` da conclusão). Em todos os
modos (inclusive o botão comum da escola). Detalhes da Meta (código e mensagem
do erro, `session_id`, etapa, `business_id`, ids) vão em JSON no `new_value`.

## Critério de aceite

Teste automático verde e, em produção, os casos 3, 5, 6 e 10 respondendo 403. O
ponto não-negociável é o **caso 5**: admin de uma escola nunca conecta outra.
