# Teste manual de segurança — api/whatsapp/embedded-signup.ts

Objetivo: provar que uma escola **nunca** consegue conectar/sobrescrever o
WhatsApp de outra escola através deste endpoint — nem passando o
`institution_id` errado no body, nem chamando sem estar autenticada como
admin de uma escola.

O endpoint resolve `institution_id` **somente** a partir do token de sessão
(`authenticateSchoolAdmin`, em `api/_lib/whatsappAuth.ts`), nunca do corpo da
requisição. Este roteiro comprova isso na prática.

## Pré-requisitos

- Duas escolas de teste já existentes: **Escola A** e **Escola B**, cada uma
  com um usuário `role: 'admin'` (`active: true`).
- Pegar o `access_token` de sessão de cada um (ex: no DevTools do browser
  logado, `localStorage`/`sessionStorage` do Supabase, ou via
  `supabase.auth.getSession()` no console) — chamarei de `TOKEN_A` e `TOKEN_B`.
- Saber o `id` de cada escola em `institutions` — `INSTITUTION_A_ID` e
  `INSTITUTION_B_ID`.
- URL do endpoint: `https://<seu-dominio>/api/whatsapp/embedded-signup`
  (ou `http://localhost:3000/api/whatsapp/embedded-signup` local).

## Teste 1 — sem Authorization header → 401/403

```bash
curl -i -X POST https://aionedu.com.br/api/whatsapp/embedded-signup \
  -H "Content-Type: application/json" \
  -d '{"code":"fake","phone_number_id":"123","waba_id":"456"}'
```
**Esperado**: `403` (ou `401`), body `{"error":"Apenas o admin..."}`. Nenhuma
linha gravada em `whatsapp_phone_numbers`/`institutions`.

## Teste 2 — token de usuário sem role admin → 403

Repetir com o `Authorization: Bearer <token de um usuário role='user'>` (não
admin) de qualquer escola.
```bash
curl -i -X POST https://aionedu.com.br/api/whatsapp/embedded-signup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_DE_USER_NAO_ADMIN>" \
  -d '{"code":"fake","phone_number_id":"123","waba_id":"456"}'
```
**Esperado**: `403`. `authenticateSchoolAdmin` retorna `null` porque
`row.role !== 'admin'`.

## Teste 3 (o crítico) — admin da Escola A tentando gravar na Escola B via body

Logado como admin da **Escola A** (`TOKEN_A`), forjar `institution_id` da
**Escola B** dentro do body — mesmo que o endpoint não declare esse campo:
```bash
curl -i -X POST https://aionedu.com.br/api/whatsapp/embedded-signup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{
        "code": "<code_real_de_teste_do_popup_meta>",
        "phone_number_id": "<phone_id_de_teste>",
        "waba_id": "<waba_id_de_teste>",
        "institution_id": "'$INSTITUTION_B_ID'"
      }'
```
**Esperado**:
- A requisição segue em frente normalmente (não é rejeitada por causa do
  campo extra) — mas o registro gravado em `whatsapp_phone_numbers` e
  `institutions` é o da **Escola A** (`INSTITUTION_A_ID`), nunca o da Escola B.
- Confirmar rodando (com a service role key, fora do fluxo da API):
  ```sql
  select institution_id, connection_method, updated_at
  from whatsapp_phone_numbers
  where phone_number_id = '<phone_id_de_teste>';
  ```
  → `institution_id` deve ser `INSTITUTION_A_ID`, **nunca**
  `INSTITUTION_B_ID`, comprovando que o valor do body foi ignorado.
- Repetir o teste com `TOKEN_B` no lugar de `TOKEN_A` (mesmo `phone_number_id`
  de teste) e confirmar que agora quem é sobrescrita é a linha da Escola B —
  cada token só consegue mexer na própria linha, nunca na do outro.

## Teste 4 — token expirado/inválido → 401/403

```bash
curl -i -X POST https://aionedu.com.br/api/whatsapp/embedded-signup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token-invalido-ou-expirado" \
  -d '{"code":"fake","phone_number_id":"123","waba_id":"456"}'
```
**Esperado**: `403`. `supabase.auth.getUser(token)` retorna erro, então
`authenticateSchoolAdmin` já retorna `null` antes de qualquer leitura na
tabela `users`.

## Critério de aceite

Os 4 testes acima devem passar antes de considerar este endpoint seguro para
uso em produção. O ponto não-negociável é o **Teste 3**: nenhum valor vindo
do corpo da requisição pode alterar qual `institution_id` é gravado.
