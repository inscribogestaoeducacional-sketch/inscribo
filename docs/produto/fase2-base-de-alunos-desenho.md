# Fase 2 — Base de alunos e rematrícula · desenho técnico

Versão 2 · 12/10/2026 · só desenho: nenhuma linha de código e nenhum dado alterado.
A v2 incorpora as respostas do Victor de 12/10: as decisões (§16.4), a camada de IA (§11), a meta de novatos por série (§12),
as vagas no onboarding (§13), a data da matrícula no lead (§14), o catálogo de integrações (§15) e a entrega em 5 marcos (§16.3).

---

## 0. Resumo

Uma base única por escola, com **aluno, família, turma e situação por ano letivo**, abastecida por três fontes
(Activesoft, planilha padrão Áion, lançamento manual agregado). Os módulos (Rematrículas, Mapa de turmas,
Retenção/Evasão, Campanha) leem **só visões canônicas**. Nunca leem a fonte. Cada número vem com dois rótulos:
**fonte** (Activesoft / Planilha / Manual) e **nível** (aluno a aluno / agregado). Esses rótulos viram o selo
**Completo / Parcial / Manual**.

Princípios:
1. **Uma fonte principal por escola e por ano letivo.** Fontes não se somam, porque somar contaria o mesmo aluno duas vezes.
2. **A base é espelho da escola, não do CRM.** O vínculo com lead é opcional, revisável e nunca apaga nada.
3. **Histórico imutável.** Cada mudança de situação vira evento, no mesmo padrão de `lead_status_history` da Fase 0A.
4. **Minimização.** O adaptador só grava campos de uma lista permitida. O que não está nela é descartado na entrada.
5. **Nada vai pro ar sem a conferência de contagem.** A primeira carga de cada escola só conta. Grava quando a escola confere.

### O que já existe e o que acontece com cada coisa

Conferido no banco e no código em 12/10:

| Existe hoje | Situação | Destino |
|---|---|---|
| `re_enrollments` (5 linhas) + `ReEnrollments.tsx` | Tela antiga, sem rota em `App.tsx` | Aposentar. As 5 linhas vão pro agregado manual como histórico |
| `monthly_reenrollments` (Ágape 7 meses, 148 confirmadas; Santa Teresa 7 meses, 0) | Aba de rematrícula em `GestorReports.tsx`, digitada mês a mês | Vira **agregado manual** (um retrato por fim de mês). A aba passa a ler a visão canônica |
| `campaign_cycles.base_students`, `school_data.exits/grades/total_exits` | Base e saídas digitadas no assistente da campanha | Passam a ser **preenchidos pela base** quando houver. O assistente mostra "veio da base · fonte X" |
| `funnel_metrics.new_students_actual / returning_students_actual` | Colunas existem, ninguém preenche (só o `MonthlyChart`, código morto, lê) | Preenchidas por `recompute_funnel_metrics` a partir da base (ver §10) |
| `student_exits`, `grade_exit_config` | Vazias e **sem RLS** (achado de 01/10) | Apagar na migration da Fase 2. `grade_exit_config` é substituída por `school_grades.is_terminal` |
| `student_transfers` (37) + pesquisa de saída por token | Em uso (/transferencias) | Reaproveitada: "Não renovará" oferece a pesquisa de saída e grava `student_transfers.student_id` |
| `lead_families` / `leads.family_id` | Agrupa irmãos do CRM | O casamento usa como atalho: confirmar um irmão sugere os outros |
| `normalize_phone_br` (SQL) | **Ainda põe 9 em fixo.** A correção da Fase B está em `supabase/pendentes/` | O casamento usa a regra corrigida ("9 só se o 1º dígito local for 6–9"). Pré-requisito autorizado em 12/10 com ensaio; aplicação depois do ok |
| Vault (`supabase_vault`), `pg_cron`, `pg_net`, `pgcrypto` | Instalados | Token no Vault, cron noturno via `pg_net` (mesmo padrão dos crons atuais) |
| `pg_trgm`, `unaccent` | **Não instalados** | Ligar os dois para a semelhança de nomes (autorizado em 12/10, por migration versionada) |
| `whatsapp_contacts` | 6.731 contatos com celular gravado em 12 dígitos, 727 deles com um gêmeo de 13 (achado de 12/10) | O casamento por celular compara sempre os números normalizados, nunca o texto gravado |

---

## 1. Modelo de dados canônico

Todas as tabelas novas nascem com RLS ligada, sem nenhum privilégio para `anon`. A leitura usa
`institution_id = get_my_institution_id() OR is_super_admin_user()`. A escrita só acontece por funções
`SECURITY DEFINER` ou pelo service role da edge function, **nunca por insert direto do navegador** (lição de
`audit_logs` e `institutions`). Colunas sensíveis têm GRANT de coluna.

### 1.1 Configuração e cobertura

**`student_base_settings`** (PK `institution_id`)
- `primary_source` por padrão: `activesoft` | `planilha` | `manual` | `nenhuma`
- `declared_erp` (o ERP que a escola usa, mesmo sem integração: alimenta o catálogo do §15)
- `reenrollment_target_year` (ano que está sendo rematriculado, ex.: 2027)
- `reenrollment_window_start` (data em que a rematrícula abriu; é o dia 0 da curva)
- `base_cutoff_rule`: fixa em **ativos em N na data de abertura da rematrícula** (decidido em 12/10). A coluna existe só para mudar no futuro
- `count_prematricula_as_reenrolled` (bool, **padrão false**, decidido em 12/10): a pré-matrícula aparece sempre separada; ligar é escolha da escola
- `lead_link_mode`: `sugerir` (padrão) | `auto_confirmar_alta_confianca`
- `erp_confirms_enrollment` (bool, **false em todas as escolas**, decidido em 12/10): um novato casado com lead marca o lead como matriculado
- `retention_years` (**5**, decidido em 12/10): por quanto tempo guardar o aluno que saiu antes de anonimizar

**`student_base_coverage`** (uma linha por escola e ano letivo, PK `institution_id, academic_year`)
- `source` (`activesoft` | `planilha` | `manual`) e `level` (`aluno` | `agregado`)
- `grades_covered` / `grades_total`, `last_loaded_at`, `last_run_id`
- `seal` calculado: `completo` | `parcial` | `manual` (regra no §9)
- `locked_at`: um ano fechado (passado) não aceita outra fonte sem ação explícita do admin

Fica como coluna de tabela, e não de visão, porque guarda uma decisão: trocar a fonte de um ano é ação do admin, com log.

### 1.2 Catálogo da escola

**`school_grades`** (séries): `id, institution_id, name, code, segment` (`infantil` | `fund1` | `fund2` | `medio` | `outro`),
`sort_order, next_grade_id` (série seguinte), `is_terminal` (concluinte: a escola não oferece a série seguinte), `active`.
Tem um mapa de nomes externos: **`school_grade_aliases`** (`grade_id, source, external_id, external_name`).
Na primeira carga as séries são criadas pelo `serie_id`/`serie_nome` do Activesoft (ou pelos valores da planilha), com segmento
sugerido pelo nome. O admin confere numa tela de "Séries e segmentos" antes do primeiro cálculo.

**`school_classes`** (turmas): `id, institution_id, academic_year, grade_id, name, shift` (`manha` | `tarde` | `integral` | `noite`),
`erp_unit_id`, `unit_id` (opcional → `lead_units`), `capacity` (vagas, **digitada pela escola**, porque o Activesoft não traz),
`source, external_id, active`. Chave única: `(institution_id, source, external_id)` quando houver id externo.

**`grade_capacity`** (vagas por série e ano): `institution_id, academic_year, grade_id, planned_classes, capacity, updated_by, updated_at`.
Existe porque as turmas de N+1 costumam não estar criadas no ERP quando a rematrícula abre: as vagas são cadastradas por série no
onboarding (§13). Quando as turmas existem e têm `capacity`, a soma das turmas prevalece e a diferença aparece como aviso.

**`school_erp_units`**: `institution_id, external_id, name, unit_id` (opcional → `lead_units`). Assim a "Unidade" do lead (Etapa 5) e a
unidade do ERP falam a mesma língua.

### 1.3 Pessoas

**`students`**
- `id, institution_id, full_name, name_key` (sem acento, minúsculo, espaços únicos), `birth_date`
- `registration_code` (matrícula da escola), `first_year` (primeiro ano letivo visto na base)
- `family_id`, `source`, `created_at`, `anonymized_at`
- Não guarda celular do aluno: o campo `celular` do Activesoft é descartado (aluno menor; o contato é o responsável).

**`student_external_ids`**: `(student_id, source, external_id)`, único por `(institution_id, source, external_id)`. Um aluno pode
ter id do Activesoft e código de planilha. É isso que permite trocar a fonte sem duplicar o aluno.

**`guardians`** (responsáveis)
- `id, institution_id, full_name, name_key, phone_raw, phone_norm` (13 dígitos se celular, 12 se fixo, pela regra corrigida)
- `email`, `cpf_hmac` (HMAC-SHA256 do CPF com segredo da plataforma no Vault), `cpf_last2`
- `source, external_id`
- **O CPF não é guardado em claro.** Serve só para casar (comparando com o HMAC do `leads.cpf`) e para deduplicar responsáveis.

**`student_guardians`**: `student_id, guardian_id, role` (`responsavel` | `responsavel_secundario` | `filiacao_1` | `filiacao_2` | `adicional`),
`is_primary, valid_from, valid_to` (de `vinculo_aluno_responsavel_liberado`), `source`.

**`families`**: `id, institution_id, primary_guardian_id, lead_family_id` (opcional → `lead_families`). A família é derivada:
alunos que têm o mesmo responsável principal. A tabela só existe para ter um id estável (painel por família, irmãos no funil de
pendentes, "família com 3 filhos, 2 pendentes").

### 1.4 Enturmação por ano e eventos

**`class_enrollments`** (enturmação: o aluno numa turma num ano)
- `id, institution_id, student_id, academic_year, class_id, grade_id`
- `status`: um destes valores canônicos
  - `ativo`, `pre_matricula`, `selecao`
  - `transferido`, `cancelado`, `desistente`, `remanejado`, `concluido`
  - `inativo_outro`, `desconhecido`
- `raw_status`, `raw_status_type` (o texto como veio, para auditoria e para remapear sem recarregar)
- `enrolled_at` (`data_efetivacao_matricula`; pode ser nula), `is_new_student` (`novato_considerando_periodo_anterior`; nulo se a escola não configurou "Próximo período")
- `source, run_id, first_seen_at, last_seen_at, status_changed_at, missing_runs` (contador de cargas seguidas em que não veio)
- Chave única: `(student_id, academic_year, class_id)`. Remanejamento de turma no mesmo ano = 2 linhas (a antiga fica `remanejado`).

**`student_status_events`** (imutável, o mesmo gatilho anti-UPDATE/DELETE de `lead_status_history`)
- `id, institution_id, student_id, academic_year, class_enrollment_id`
- `from_status, to_status, event_date` (data efetiva quando a fonte informa; senão a data em que a carga percebeu)
- `date_source` (`fonte` | `detectado_na_carga` | `estimado`), `detected_at, source, run_id, reason_code, reason_detail, is_inferred`
- Também grava `apareceu` (primeira vez no ano) e `sumiu_da_origem` (ver §2.4).

**`erp_status_map`** (por escola): `source, raw_status, raw_status_type → canonical_status`. Vem com um padrão e pode ser editado.
Situação nova e não mapeada vira `desconhecido`, não entra em nenhuma conta e aparece no log com aviso
"N alunos com situação 'X' não mapeada".

### 1.5 Nível agregado

**`class_aggregates`** (lançamento manual ou planilha agregada)
- `id, institution_id, academic_year, grade_id, class_id` (opcional; nulo = série inteira)
- `as_of_date` (retrato: "na data X, os números eram estes")
- `enrolled_total, reenrolled, prematricula, new_students, exits_during_year, not_renewing, graduates, pending, capacity`
- `source` (`manual` | `planilha_agregada` | `legado_monthly_reenrollments`), `entered_by, entered_at, notes`
- Cada "Atualizar números" grava um retrato novo, e o histórico de retratos forma a curva mensal do agregado.
  Corrigir um retrato cria outro com o mesmo `as_of_date`; vale o mais recente, sem UPDATE destrutivo.

### 1.6 Execuções, conexões e mapeamentos

**`erp_connections`**: `institution_id, provider` (`activesoft`), `token_secret_id` (id no Vault), `token_last4`,
`token_expires_at` (**informada pelo admin**, porque a API não informa validade; a confirmar), `status`
(`ativa` | `token_invalido` | `pausada` | `desconectada`), `scopes_ok` (jsonb: resultado do teste de cada rota),
`allowed_periods` (anos que a API devolveu de fato), `last_success_at, last_error_at, last_error, cursors`
(jsonb: `data_ultima_alteracao` por rota), `nightly_enabled, created_by`.
O navegador nunca lê `token_secret_id`: há GRANT de coluna e só a edge function, com service role, resolve o segredo.

**`sync_runs`** (o log de execuções, usado por todas as fontes)
- `id, institution_id, source, kind`
  - `kind`: `dry_run_contagem` | `completa` | `incremental` | `manual_agora` | `planilha` | `agregado`
- `status` (`na_fila` | `rodando` | `ok` | `ok_com_avisos` | `erro` | `cancelada`), `triggered_by` (usuário ou `cron`)
- `queued_at, started_at, finished_at`
- `step, step_offset` (para retomar, ver §2.3)
- `http_calls, pages`
- `counts` (jsonb: lidos, novos, alterados, sem mudança, ignorados, por rota)
- `warnings, error` (sem dados pessoais: só ids e contagens)
- `summary` (o relatório de contagem por ano, série e turma, usado na conferência)

**`import_mappings`**: `id, institution_id, name, kind` (`alunos` | `agregado`), `header_signature` (hash dos cabeçalhos
normalizados), `column_map` (coluna → campo canônico), `value_maps` (texto da planilha → série canônica e → situação canônica),
`date_format, last_used_at`.

### 1.7 Casamento e funil de rematrícula

**`student_lead_links`**: `id, institution_id, student_id, lead_id, score, reasons` (jsonb: `celular_igual`, `cpf_igual`,
`nome_92%`, `serie_compativel`…), `status` (`sugerido` | `confirmado` | `rejeitado` | `auto_confirmado`), `decided_by, decided_at`.
Par rejeitado nunca volta a ser sugerido. Único: `(student_id, lead_id)`. No máximo um `confirmado` por aluno.

**`reenrollment_items`** (um card por aluno da base de N para o ano N+1)
- `id, institution_id, target_year, student_id, from_class_enrollment_id, expected_grade_id`
- `stage` (`pendente` | `contatado` | `intencao` | `rematriculado` | `nao_renovara`)
- `stage_origin` (`base` = a fonte confirmou | `equipe` = alguém mudou), `assigned_to`
- `not_renewing_reason` (**obrigatório** quando `nao_renovara`; catálogo no §7), `not_renewing_detail`
- `last_contact_at, conversation_id` (Hub), `transfer_id` (→ `student_transfers`, se mandou a pesquisa)
- `family_id`, `updated_at`

**`reenrollment_stage_history`**: imutável, com `from_stage, to_stage, changed_by, changed_at, source` (`app` | `base`).

No nível **agregado** não há cards: o funil vira um painel de números por série (§9).

### 1.8 Visões canônicas (o que os módulos leem)

Os módulos só conhecem estas visões e RPCs, com `security_invoker` e sem `anon`:

- **`v_base_year_grade_stats`** (`institution_id, academic_year, grade_id, class_id, source, level, seal`, e os números:
  base, rematriculados, pré-matrícula, pendentes, novatos, saídas no ano, não renovará, concluintes, vagas, `as_of`).
  No nível aluno é um `GROUP BY` sobre `class_enrollments` + `reenrollment_items`. No agregado é o retrato mais recente de
  `class_aggregates`. **É o mesmo formato nos dois casos.** É isso que faz os módulos não saberem qual é a fonte.
- **`v_base_daily_curve`** (`institution_id, target_year, day_offset, date, reenrolled_cum, base`): curva de rematrícula. No nível aluno
  vem das datas dos eventos; no agregado, dos retratos (degraus entre um retrato e outro).
- **`v_base_flow`** (`institution_id, from_year, from_grade_id, destino, n`): matriz série × ano. Só existe no nível aluno.
- **`v_base_cohorts`** (`institution_id, entry_year, years_after, active, entered`): retenção por coorte. Só existe no nível aluno.
- **`rpc_base_students(...)`**: lista paginada de alunos para os detalhes. Devolve vazio quando `level = agregado`.

---

## 2. Adaptador Activesoft

### 2.1 Onde roda

Uma edge function **`erp-activesoft-sync`** (Deno), mais duas peças no banco:
- **cron noturno** `erp-sync-enqueue` (03h de Brasília, 06:00 UTC): coloca na fila uma execução `incremental` para cada conexão `ativa` com `nightly_enabled`;
- **cron trabalhador** `erp-sync-worker` (a cada 1 min): chama a edge function, que pega **uma** execução `na_fila`/`rodando`, avança por até ~100 s e salva `step/step_offset`.
  A próxima rodada continua dali. É o mesmo padrão `pg_cron` + `net.http_post` + service role dos crons atuais.

O motivo da fila: com 25 itens por página, uma escola de 1.000 alunos dá ~40 páginas de alunos, ~40 de enturmação, ~60 de responsáveis e
~60 de vínculos, ou seja ~200 chamadas. A ~0,5–1 s cada, isso passa do limite de tempo de uma execução de edge function. Retomável por passo resolve isso.

**"Sincronizar agora"** (só admin): grava `sync_runs` `manual_agora` com `triggered_by`. Limite de 1 a cada 15 min por escola e no máximo
1 execução rodando por escola; se já houver uma, o botão mostra "já está sincronizando (passo 3 de 7)". A tela acompanha pelo realtime de `sync_runs`.

### 2.2 Ordem dos passos e o que é incremental

Paginação: `limit=25`, `offset`. Antes de tudo, a etapa 0 do §16 confirma o formato `count/next/results`. O adaptador aceita os dois formatos (lista crua ou envelope).

| Passo | Rota | Modo | Observação |
|---|---|---|---|
| 1 | `lista_unidades` | completa (poucas linhas) | → `school_erp_units` |
| 2 | `lista_cursos` | completa | só guarda curso_id/nome (para `cursos_oficiais`) |
| 3 | `lista_turmas` | completa **por período** (N e N+1; na 1ª carga também N-1, N-2 se a API devolver) | `mostrar_todas_as_turmas=true` para pegar turmas encerradas |
| 4 | `enturmacao_com_detalhes` | **completa por período**, `situacao_sistema` A, I, P e S em chamadas separadas | Não tem `data_ultima_alteracao`. É onde a situação muda, então é lida inteira toda noite para N e N+1 |
| 5 | `lista_alunos` | **incremental** por `data_ultima_alteracao` (1ª carga completa) | só os campos permitidos (§2.5) |
| 6 | `lista_responsaveis` | **incremental** | `possui_aluno_vinculado_ativo=true` na 1ª carga |
| 7 | `acesso/vinculo_aluno_responsavel_liberado` | **incremental** | define `student_guardians` |
| 8 | pós-processamento (SQL) | — | detectar mudanças → eventos; reclassificar; atualizar funil e cobertura; recalcular `funnel_metrics` uma vez; casar alunos novos |

O cursor `data_ultima_alteracao` só avança quando o passo termina sem erro, com 1 dia de sobreposição para não perder alterações da borda.
Se `lista_alunos` incremental não trouxer um aluno citado numa enturmação, o adaptador busca esse aluno por `aluno=<id>`.

### 2.3 Robustez

- Repetição com espera crescente em 429/5xx/timeout (3 tentativas). 401/403 → `erp_connections.status = token_invalido`, a execução para e um aviso é gerado (§2.4).
- Gravação **idempotente** por id externo (upsert). Rodar duas vezes seguidas dá zero mudanças.
- Uma execução por escola por vez (trava pelo status da linha). No máximo 2 escolas sincronizando ao mesmo tempo, para não martelar o Activesoft.
- **Ausência não apaga.** Uma enturmação que não vem numa leitura completa ganha `missing_runs += 1`. Só depois de **2 cargas completas seguidas**
  sem ela vira o evento `sumiu_da_origem`, e o aluno sai das contas com um aviso no log. Ele nunca é apagado.
- Situação não mapeada → `desconhecido` + aviso (§1.4).
- A execução termina `ok_com_avisos` quando há qualquer aviso, e o selo da escola cai para Parcial até alguém olhar.

### 2.4 Token, validade e avisos

- **Cadastro** em Configurações → Escola → "Integração Activesoft" (só admin): colar o token. A gravação passa por uma função que manda o token
  ao Vault (`vault.create_secret`) e guarda só o id e os 4 últimos caracteres. Trocar o token cria um segredo novo e apaga o antigo.
- **Teste de conexão** ao salvar: uma chamada `limit=1` em cada rota permitida → `scopes_ok`. Mostra "dados cadastrais ✓ / enturmação ✗".
- **Validade:** campo de data opcional ("até quando este token vale"). Avisos em `system_notifications` para os admins da escola e para o
  Super Admin em 15, 7 e 1 dia antes, e na hora em que vier um 401. Se o Activesoft tiver rota ou cabeçalho de validade, a etapa 0 confirma e o campo passa a ser preenchido sozinho.
- **Desconectar:** apaga o segredo do Vault e pergunta se a base fica (congelada, selo Parcial) ou se é anonimizada.
- O token nunca aparece em log, em `sync_runs.error` ou em resposta para o navegador.
- Trocar ou remover o token grava em `audit_logs`.

### 2.5 Lista de campos permitidos e de rotas proibidas

O adaptador tem uma lista **fixa** de rotas (as 7 acima) e de campos por rota. Qualquer outra rota é recusada no próprio código antes da chamada
(um teste automatizado garante isso). Campos fora da lista são descartados antes de tocar o banco. Não há armazenamento do JSON cru.

| Rota | Campos guardados | Campos descartados |
|---|---|---|
| alunos | id, matricula, nome, data_nascimento, responsavel_id, responsavel_secundario_id, filiacao_1_id, filiacao_2_id, responsaveis_adicionais_ids, unidade_id, id_turmas | **celular do aluno** |
| responsáveis | id, nome, celular, email, unidade_id, cpf_cnpj (**só vira HMAC + 2 últimos dígitos**) | — |
| vínculos | id_aluno, id_responsavel, data_inicial, data_final | nome e cpf repetidos |
| enturmação | todos os listados | — |
| turmas | todos os listados | — |

**Rotas proibidas:** notas, boletim, frequência, ocorrências, cor/raça, deficiência, RG, financeiro e qualquer rota de escrita.

---

## 3. Importador de planilha (padrão Áion)

**Modelo para baixar:** `modelo-base-de-alunos.xlsx` com uma aba "Alunos" e uma aba "Como preencher". Colunas:
Ano letivo · Código/matrícula · Nome do aluno · Data de nascimento · Série · Turma · Turno · Unidade · Situação · Data da matrícula ·
Responsável 1 (nome, celular, e-mail, CPF) · Responsável 2 (nome, celular). As obrigatórias são **ano letivo, nome do aluno, série e situação**.
Há também um modelo "Números por série" para quem só tem agregado (§4).

**Fluxo** (mesmo esqueleto de `contactImport.ts`/`contacts_import`, que já funciona em produção):
1. Envio do CSV/XLSX. A leitura é a mesma do importador de contatos, extraída para um leitor compartilhado.
2. **Mapeamento de colunas:** se o `header_signature` bater com um `import_mappings` salvo, ele é aplicado e a tela mostra "Usando o mapeamento 'Secretaria 2026'".
   Senão, aplica reconhecimento por cabeçalho (como os `ALIASES` atuais) e o admin ajusta.
3. **Mapeamento de valores:** cada série e cada situação distinta da planilha aparecem uma vez para casar com a série e a situação canônicas
   ("5º Ano A" → série 5º ano, turma A). Fica salvo em `value_maps`.
4. **Escopo da carga:**
   - "Esta planilha é a base **completa** do ano X": quem estava no ano e não veio fica marcado "não veio nesta carga" (não sai das contas sem confirmação);
   - "É **parcial**, só estas séries": só mexe nas séries presentes.
5. **Prévia (dry-run no banco):** contagem por série e turma, novos e alterados, linhas com erro (sem nome, série não mapeada, data inválida, duplicada).
   Nada é gravado.
6. **Gravar:** cria `sync_runs` `planilha`, faz o upsert e gera eventos, igual ao Activesoft.

**Identidade do aluno na planilha**, em ordem: código/matrícula → (nome + data de nascimento) → (nome + celular do responsável).
Sem nenhuma dessas chaves, a linha é recusada na prévia. Datas aceitas: dd/mm/aaaa, aaaa-mm-dd e número serial do Excel.
O celular passa pela regra corrigida de normalização.

---

## 4. Lançamento manual agregado

Para a escola sem ERP e sem planilha. Tela "Números da base" com uma grade por ano letivo:
**linhas = séries** (com a opção "detalhar por turma") e **colunas** = Matriculados no ano · Rematriculados para o próximo · Em pré-matrícula ·
Novatos · Saídas durante o ano · Não renovarão · Concluintes · Vagas.

- Cada vez que salva, grava um **retrato** com a data de hoje (`as_of_date`). "Atualizar" toda semana já produz uma curva.
- Atalho "copiar estrutura do ano anterior" (séries e vagas).
- Checagens na hora: rematriculados + pré + não renovarão + pendentes ≤ base; aviso (não bloqueio) se a soma por turma não bater com a série.
- **Migração do legado:** `monthly_reenrollments` (Ágape, Santa Teresa) vira um retrato por fim de mês com `source = legado_monthly_reenrollments`.
  `re_enrollments` também vira retrato. Os números históricos que a escola digitou continuam visíveis.

---

## 5. Casamento aluno ↔ lead

### 5.1 Para que serve
1. **Novato matriculado ↔ lead:** fecha o funil de captação ("de onde veio quem matriculou") e corrige matrícula que o atendente esqueceu de marcar.
2. **Pendente de rematrícula ↔ conversa:** o card do funil abre a conversa do responsável no Hub. Isso é casamento por telefone com `whatsapp_conversations`, não com lead.
3. **Irmãos:** um aluno cujo responsável tem lead aberto de outro filho aparece como "família da casa".

### 5.2 Chaves e pontuação

O motor roda no pós-processamento de cada carga, só para alunos novos ou alterados, como função SQL com `pg_trgm` e `unaccent`.

| Sinal | Pontos |
|---|---|
| CPF do responsável = `leads.cpf` (comparando HMAC) | +60 |
| Celular de qualquer responsável = `leads.phone` ou `lead_families.phone` (normalizados) | +40 |
| Nome do aluno igual (`name_key`) | +40 |
| Nome do aluno parecido, similaridade ≥ 0,80 | +25 |
| Série do aluno compatível com `leads.grade_interest` | +10 |
| `leads.year_interest` = ano da enturmação | +5 |
| Lead criado **depois** da efetivação da matrícula | −30 |
| Lead excluído (`deleted_at`) | fora |

- **≥ 100 e candidato único** (nenhum outro lead ≥ 70 para o mesmo aluno): `auto_confirmado`, só se a escola ligou `auto_confirmar_alta_confianca`. Senão fica `sugerido`.
- **60 a 99:** `sugerido` e vai pra revisão.
- **< 60:** descartado.
- **Celular sozinho (40) nunca confirma**, porque irmãos dividem o celular. Precisa de nome ou CPF junto.

### 5.3 Tela de revisão (Base de alunos → "Vincular com leads")
- Lista de sugestões com o aluno (nome, série/turma, ano, responsável, celular mascarado `(83) 9****-1234`) ao lado do lead (nome, etapa, atendente, criado em, origem).
- Chips com os motivos ("mesmo celular", "nome 92% igual", "mesma série") e a pontuação.
- Ações: **Confirmar** · **Não é** (vira rejeitado para sempre) · **Escolher outro lead** (busca) · **Pular**.
- Filtros: só novatos de N+1 · só leads em aberto · por série.
- Ao confirmar um irmão da mesma `lead_families`, a tela sugere os outros na sequência.
- Só admin e gestor. Cada decisão grava quem e quando.

### 5.4 O que um vínculo confirmado faz
Ver §10.1. Resumo: se `erp_confirms_enrollment` estiver ligado e o aluno for **novato ativo** (ou em pré-matrícula, conforme a configuração)
no ano de interesse, o lead vira matriculado com a **data da efetivação** e a fonte `erp`. Senão, só aparece "aluno na base desde dd/mm" no card do lead.

---

## 6. Regras

Vocabulário: **N** = ano letivo corrente (o da base). **N+1** = ano que está sendo rematriculado.
Status "conta como na escola" = `ativo` (+ `pre_matricula` se a escola ligou `count_prematricula_as_reenrolled`).

| Conceito | Regra (nível aluno) |
|---|---|
| **Base de rematrícula de N+1** | Alunos com enturmação `ativo` em N na data de corte (`base_cutoff_rule`), **menos os concluintes** |
| **Concluinte** | Aluno ativo em N numa série com `is_terminal = true`. Configurado por segmento. Ex.: escola até o 9º ano → 9º ano é terminal; escola com Ensino Médio → 3ª série. Se a escola tem o EM, o 9º ano **não** é terminal: quem não volta é saída, não conclusão |
| **Rematriculado** | Aluno da base com enturmação em N+1 em status que conta. Data = `enrolled_at` de N+1, senão a data em que a carga percebeu (`date_source = detectado_na_carga`) |
| **Retido (repetente)** | Rematriculado na mesma série de N. Conta como rematriculado e aparece separado no Fluxo |
| **Pendente** | Aluno da base que não é rematriculado nem saída |
| **Novato** | Enturmação que conta em N+1 **sem** enturmação ativa em N na escola. Usa a flag `novato_considerando_periodo_anterior` do Activesoft quando vem. Se a flag e o cálculo discordarem, vale o cálculo e o caso entra no log (sinal de "Próximo período" mal configurado). Sem os dados de N, vale só a flag e o selo fica Parcial |
| **Saída durante o ano (evasão)** | Evento em N para `transferido`, `cancelado` ou `desistente`, com data do evento |
| **Não renovação** | Aluno da base que termina o ciclo sem voltar em N+1, ou que foi marcado "Não renovará" no funil |
| **Retenção do ano** | Rematriculados ÷ base (concluintes já fora) |
| **Retenção por coorte** | Para quem entrou na escola no ano E (`first_year`), a % ainda ativa em E+1, E+2… (curva de sobrevivência). Precisa de 2 ou mais anos na base |
| **Curva mensal/diária** | Rematriculados acumulados por dia desde `reenrollment_window_start`, comparados ao **mesmo dia_offset** do ciclo anterior (ver §8.1) |

Detalhes que viram regra:
- Remanejamento de turma no mesmo ano não é saída nem entrada.
- Aluno em duas turmas ativas no mesmo ano (ex.: curso extra que não é oficial): só contam turmas de `cursos_oficiais`. Na planilha não há esse caso.
- Transferência entre unidades da mesma escola não é saída; o "Fluxo" mostra como troca de unidade.
- Matrícula feita **antes** da abertura da rematrícula (antecipada) entra no dia 0 da curva.

---

## 7. "Pendentes de rematrícula" como funil

Kanban com o mesmo visual do Kanban de leads, um card por aluno pendente, agrupável por **família** (irmãos juntos).

`Pendente → Contatado → Intenção → Rematriculado`, com a saída lateral **`Não renovará`**.

- **Pendente:** entra sozinho quando o aluno vira base de N+1.
- **Contatado:** a equipe arrasta, ou entra sozinho quando há mensagem **enviada pela equipe** (mesmo critério de "interação" da Fase 0A: `from_me` sem robô)
  na conversa do responsável depois que a rematrícula abriu.
- **Intenção:** a família disse que vai rematricular (só manual).
- **Rematriculado:** **só pela base** quando o nível é aluno, porque a fonte confirma. A equipe pode marcar "Rematriculado (declarado)" quando a escola
  ainda não lançou no ERP. Fica `stage_origin = equipe` com um selo "aguardando confirmação da base"; se a base não confirmar em X dias
  (configurável, padrão 15), vira alerta.
- **Não renovará:** **motivo obrigatório**, de um catálogo: financeiro · mudança de cidade · insatisfação pedagógica · insatisfação com atendimento ·
  distância/transporte · foi para escola pública · foi para concorrente (qual?) · horário/turno · saúde · outro (texto obrigatório).
  O mesmo catálogo de `student_transfers.reason_category`, para os relatórios de evasão cruzarem. Ao marcar, o sistema oferece **"Enviar pesquisa de saída"**,
  que cria `student_transfers` com `student_id` e o token que já existe.
- Se a base mostrar o aluno **rematriculado** depois de "Não renovará", ele vai para Rematriculado sozinho, com evento "recuperado" (vira indicador).
- Atalhos no card: abrir a conversa no Hub, registrar ligação, ver irmãos. Ação em lote: **mandar para Transmissões** como público
  ("pendentes do 5º ano", "intenção sem confirmação"), usando o público por lista do módulo de Transmissões.
- **Permissão** (decidida em 12/10): menu **"Base de alunos"** com a chave `base_alunos`. Admin e gestor veem tudo.
  O atendente vê **só o funil, só com os cards atribuídos a ele/ela**, e **nunca** vê CPF ou data de nascimento.
  A RLS de `reenrollment_items` aplica a regra no banco (`assigned_to = auth.uid()` para o perfil atendente); a tela não é a única barreira.

---

## 8. Painéis

Todos leem só as visões do §1.8 e trazem no topo **fonte · nível · selo · "atualizado em"**.

### 8.1 Rematrículas hoje × mesmo dia do ano anterior
- **Cartões:** Base N+1 · Rematriculados (n e %) · Mesmo dia no ciclo anterior (% e diferença em pontos) · Pendentes · Não renovarão (com o motivo mais comum) · Meta (`campaign_cycles.target_reenrollment_rate`).
- **Curva acumulada** em dois traços (ciclo atual e anterior), com o eixo em "dias desde a abertura", para os ciclos serem comparáveis mesmo se a abertura mudou de data.
- **Tabela por série e turma:** base, rematriculados, %, pendentes, não renovará, com clique para o funil filtrado.
- **Comparação com o ano anterior:**
  - Activesoft: vem do `enrolled_at` das enturmações de N com o aluno presente em N-1, **se a API devolver períodos passados** (a confirmar na etapa 0).
  - Senão: só a partir do primeiro ciclo acompanhado pelo Áion, e o cartão mostra "sem comparação ainda".
  - Agregado: só se houver retratos do ciclo anterior.

### 8.2 Mapa de turmas
- Grade **série → turmas** de N+1: ocupação (matriculados ÷ vagas, com barra), divisão rematriculados/novatos, turno e unidade.
- **Projeção:** pendentes da série anterior que, se voltarem, caem nesta série. Mostra "pode chegar a X/Y".
- As vagas vêm de `grade_capacity` (série) ou de `school_classes.capacity` (turma), cadastradas no onboarding (§13).
  Série sem vagas mostra "cadastre as vagas" e fica fora da meta de novatos.
- Coluna **"Meta de novatos"** por série (§12): vagas − rematrículas esperadas, ao lado dos novatos já matriculados.
- Clique na turma → lista de alunos (só nível aluno).

### 8.3 Fluxo série × ano
- **Matriz** origem (série em N) × destino em N+1: próxima série · mesma série (retido) · saída · concluiu · pendente.
- **Pirâmide histórica:** alunos por série em cada ano carregado.
- Só existe no nível aluno com pelo menos 2 anos. No agregado, a tela explica por quê.

### 8.4 Evasão
- Saídas durante o ano por mês, por série e por motivo (eventos + motivos do funil + `student_transfers`).
- Taxa de não renovação por série.
- Curva de retenção por coorte (§6).
- Lista "em risco": irmão já saiu, família com pendência de muitos dias, série de troca de segmento (5º→6º, 9º→1ª EM).
  Só sinais da própria base, nada financeiro.

### 8.5 Campanha (módulo atual)
- `base_students` e saídas por série do assistente passam a vir da base ("veio da base · Activesoft · 12/10"), e a escola pode sobrescrever.
- A meta de rematrícula (a parte de 794 dos 1.086 do Ágape) passa a ser comparada com rematriculados reais, não digitados.

---

## 9. Selo Completo / Parcial / Manual e o comportamento de cada tela

| Selo | Quando |
|---|---|
| **Completo** | Nível aluno · anos N e N+1 carregados (N-1 também para comparação e coorte) · todas as séries mapeadas · zero situações `desconhecido` · última carga ok há menos de 36 h (Activesoft) ou menos de 15 dias (planilha) |
| **Parcial** | Nível aluno, mas falta alguma condição acima: falta ano anterior, carga atrasada ou com aviso, planilha parcial, séries sem mapeamento. O selo diz **qual** condição falta |
| **Manual** | Nível agregado (manual ou planilha de números) |

| Tela | Completo | Parcial | Manual |
|---|---|---|---|
| Rematrículas: cartões e tabela | tudo | tudo, com aviso do que falta | números do último retrato + "atualizado em" |
| Curva diária | dia a dia | dia a dia desde a 1ª carga | degraus entre retratos |
| Comparação com o ano anterior | sim | se houver o ano anterior | se houver retratos do ciclo anterior |
| Funil de pendentes | cards por aluno | cards por aluno | **sem cards**: painel por série com "pendentes: N" editável |
| Mapa de turmas | completo + lista de alunos | completo, sem projeção se faltar N | ocupação por série/turma, sem lista |
| Fluxo série × ano | sim | só com 2 ou mais anos | "indisponível no lançamento por série" |
| Evasão | completo | sem coorte se tiver só 1 ano | saídas e não renovação por série; sem motivos por aluno nem coorte |
| Casamento com lead | sim | sim | não existe |

---

## 10. LGPD e impacto na Fase 0A e em `funnel_metrics`

### 10.1 Fase 0A: matrícula com fonte "erp"
O gatilho `trg_lead_status_changed` faz `INSERT … ON CONFLICT (lead_id) DO UPDATE` e **preserva** `enrollment_date` e `source`
quando a matrícula já existe e não foi desfeita. Então o caminho **não exige mudar o gatilho**:
1. A função de vínculo grava antes a linha em `enrollments` com `source = 'erp'`, `date_source = 'erp'`, `enrollment_date = enrolled_at`
   (ou a data em que a carga percebeu, com `date_is_estimated = true`), `course_grade` = série da base.
2. Depois muda `leads.status` para `enrolled`. O gatilho escreve o `lead_status_history` (fonte `app`; ver item abaixo) e cai no ON CONFLICT, que mantém a data e a fonte do ERP.

Ajustes pequenos no banco:
- Novos valores documentados de `enrollments.source` (`erp`) e `date_source` (`erp`). `lead_status_history.source` ganha `base` para
  diferenciar a mudança feita pelo sistema; isso pede que o gatilho leia uma configuração local da transação (`app.status_source`). É a única mudança no gatilho, e é opcional.
- **Divergências** viram alerta (`system_notifications`), **nunca correção automática**:
  - data da matrícula diferente entre CRM e ERP (com o botão "usar a do ERP", ver §14);
  - lead matriculado no CRM sem aluno na base X dias depois;
  - aluno novato da base com lead `lost`;
  - matrícula do lead cancelada na base (`cancelado`/`transferido` em N+1).
    Não seta `cancelled_at` sozinho; o admin decide.
- Com `erp_confirms_enrollment = false` (padrão), nada disso acontece. Só aparece a informação no card.

### 10.2 `funnel_metrics`
- `recompute_funnel_metrics` continua contando `enrollments` pela data do evento. Matrículas `erp` entram sozinhas, com a data certa.
- Novo: a mesma função preenche **`new_students_actual`** (novatos da base com `enrolled_at` no mês, **todos**, com ou sem lead) e
  **`returning_students_actual`** (rematriculados no mês). A distinção na tela vira "Matrículas pelo CRM" × "Novatos na base".
  A diferença entre os dois é o tamanho da captação que passa fora do Áion.
- No agregado, os dois campos vêm da diferença entre retratos consecutivos.
- **Desempenho:** o gatilho `sync_funnel_metrics` em `enrollments` roda por linha. Na carga e na confirmação em lote, chamar
  `recompute_funnel_metrics` **uma vez no fim** (pós-processamento), com o gatilho pulado por uma configuração local da transação durante o lote.

### 10.3 LGPD
- **Papéis:** a escola é controladora e o Áion é operador. Precisa de **aditivo de tratamento de dados** no contrato e de atualização da
  `/privacidade`, citando a base de alunos e a integração com o ERP.
- **Base legal** (a escola declara): execução de contrato / legítimo interesse para gestão de matrícula e rematrícula.
- **Dados de crianças e adolescentes** (art. 14): minimização forte. Nada do que a lista proíbe; sem celular do aluno; data de nascimento só para identidade.
- **Minimização técnica:** lista fixa de campos (§2.5); CPF só como HMAC; token no Vault; sem JSON cru; logs só com ids e contagens.
- **Acesso:**
  - admin e gestor veem a base;
  - atendente vê só os próprios cards do funil, sem CPF e sem data de nascimento;
  - a IA recebe só números agregados (§11);
  - Super Admin vê para suporte, com registro em `audit_logs`;
  - exportação de lista de alunos é registrada em `audit_logs`.
- **Retenção:** aluno que saiu há mais de `retention_years` (5 anos, decidido em 12/10) é **anonimizado** (nome → "Aluno #id", responsáveis desvinculados);
  as enturmações e os eventos ficam para estatística. Aplicado por um cron mensal.
- **Direitos do titular:** a função "exportar dados de um aluno" e a função "anonimizar este aluno" ficam só com o admin.
- **Desconexão do ERP:** a pergunta "manter congelada ou anonimizar" (§2.4).

---

## 11. Camada de IA: estudo anual e fechamento mensal

**Regra de ouro: o código calcula, a IA interpreta.** Nenhum número nasce na IA. Ela recebe números prontos e devolve leitura, riscos e sugestões.

### 11.1 O que a IA pode ler
- **Só as visões agregadas `v_base_*`** (§1.8): `v_base_year_grade_stats`, `v_base_daily_curve`, `v_base_flow`, `v_base_cohorts`,
  mais a meta de novatos por série (§12) e as vagas. **Nunca** `students`, `guardians`, `rpc_base_students`, nomes, ids de aluno, CPF, celular ou texto livre.
- O pacote é montado por uma função SQL própria (`base_ai_payload(institution_id, kind, period)`), que só faz `SELECT` nas visões. É o único caminho.
  A edge function não tem como pedir outra coisa.
- **Célula pequena é escondida:** qualquer contagem de 1 ou 2 vai como `"<3"`. Isso evita que "1 saída no 3º ano por saúde" identifique uma criança.
  Os motivos vão só como código do catálogo (§7), nunca como o texto digitado.
- O pacote leva o **selo e o nível** de cada ano, e a IA é instruída a dizer o que não dá para concluir (ex.: "coorte indisponível: só 1 ano na base").

### 11.2 Estudo anual
- **Quando:** na abertura da rematrícula (ao preencher `reenrollment_window_start`) e sob demanda pelo gestor; no máximo 1 por mês por escola.
- **Entrada:** até 5 anos de pirâmide por série; fluxo série × ano; retenção por passagem de série (5º→6º, 9º→1ª EM…); curvas de coorte;
  evasão por mês, série e motivo; curva de rematrícula do ciclo anterior; ocupação × vagas; meta de novatos por série.
- **Saída** (JSON com formato fixo + texto):
  - diagnóstico em até 6 frases;
  - de 3 a 5 riscos ordenados, cada um citando os números de onde vem (ex.: "passagem 9º→1ª EM: 71% contra 88% da escola");
  - recomendações por série;
  - perguntas que só a escola responde (ex.: "o 2º ano B fechou por decisão da escola?").

### 11.3 Fechamento mensal
- **Quando:** dia 1 às 8h (cron) para as escolas com rematrícula aberta, e por botão no painel.
- **Entrada:** o mês contra o mês anterior e contra o mesmo `day_offset` do ciclo passado; rematriculados no mês, pendentes, "não renovará" por motivo,
  saídas no ano, novatos contra a meta por série, ocupação.
- **Saída:**
  - resumo de 5 linhas;
  - 3 destaques (o que melhorou ou piorou) e 3 ações para o próximo mês;
  - alertas.
- Fica no painel de Rematrículas e vai como notificação para admin e gestor.

### 11.4 Como garantir que a IA não inventa número
- Todo número citado no texto é conferido contra o pacote de entrada. Se algum não existir lá, a resposta é refeita uma vez; se falhar de novo,
  o relatório sai **só com os números** e a observação "interpretação indisponível".
- A IA **não escreve** em nenhuma tabela da base, do funil ou de metas. O único registro é o próprio relatório.
- O relatório fica em **`base_ai_reports`**: `institution_id, kind` (`estudo_anual` | `fechamento_mensal`), `period, payload` (o agregado enviado),
  `payload_hash, output, model, created_by, created_at`. Assim dá para auditar o que a IA viu.
- Passa por `/api/ai`, que já exige login e a escola do usuário e já tem cota mensal por escola. Entram dois tipos novos de chamada,
  e o cron usa o service role com a mesma contagem de cota.
- Funciona também no nível agregado, com menos profundidade e com o selo "Manual" mencionado no texto.

---

## 12. Meta de novatos por série

**Meta de novatos (série s, ano N+1) = vagas(s) − rematrículas esperadas(s)**, nunca abaixo de zero.

- **Rematrículas esperadas(s)** = ativos em N na série anterior × taxa histórica da passagem (anterior → s)
  \+ ativos em N na própria série s × taxa histórica de retenção na mesma série (repetência).
- **Taxa histórica da passagem:** média ponderada pelo número de alunos dos últimos até 3 anos (nível aluno, por `v_base_flow`).
  Sem histórico da passagem, usa a taxa da escola toda; sem nada, usa `campaign_cycles.target_reenrollment_rate`.
  A origem da taxa aparece ao lado do número ("histórico 3 anos" / "média da escola" / "meta da campanha").
- **Nível agregado:** a taxa vem dos retratos (rematriculados ÷ base de cada série). Sem a passagem detalhada, usa a taxa da própria série.
- **Série de entrada** (sem série anterior na escola, ex.: Infantil 2): todas as vagas são de novatos.
- **Rematrículas esperadas maiores que as vagas** → meta 0 e o alerta "série acima da capacidade prevista".
- **Na Campanha:**
  - a soma por série vira o `target_new_students` **sugerido**;
  - a distribuição pelos meses usa a curva histórica de novatos (`new_students_by_month`, que o assistente já lê dos arquivos do ERP);
  - a escola pode sobrescrever. A tela mostra "sugerido pela base: 112 · definido pela escola: 120".
- **Durante o ciclo**, a meta é recalculada a cada carga: quando a rematrícula real passa da esperada, a meta de novatos daquela série cai, e vice-versa.
  O Mapa de turmas (§8.2) e o fechamento mensal (§11.3) mostram a meta do momento.

---

## 13. Onboarding da base (com o passo de vagas)

Assistente em "Base de alunos → Configurar", só para admin. Cada passo grava e pode ser retomado depois.

1. **Fonte:** Activesoft (abre o cadastro do token e a ficha de integração do §15) · Planilha · Lançamento manual.
   Também pergunta qual ERP a escola usa (`declared_erp`), mesmo que não haja integração.
2. **Séries e segmentos:** confirmar as séries (criadas pela fonte ou digitadas), o segmento, a ordem, a série seguinte e a **série final** de cada segmento.
3. **Vagas do próximo ano:**
   - por série: quantidade de turmas previstas e vagas (`grade_capacity`);
   - opção "detalhar por turma" quando as turmas já existem;
   - atalho "copiar do ano atual";
   - uma série sem vagas é permitida, mas fica marcada "sem meta de novatos".
4. **Situações** (só Activesoft e planilha): conferir o mapa de situações (`erp_status_map`), com a contagem de alunos em cada uma.
5. **Conferência de contagem:** o dry-run do §16.2. A escola confirma os totais por série e só então a carga grava.
6. **Rematrícula:** ano alvo, data de abertura (o corte da base é "ativos nessa data") e a chave da pré-matrícula (desligada por padrão).

Um painel de "pendências do onboarding" fica visível no topo da Base de alunos até os 6 passos estarem completos.
Faltar o passo 3 deixa o selo **Parcial**, com o motivo "vagas não cadastradas".

---

## 14. Data da matrícula no lead

Vale para **todas** as escolas, com ou sem base de alunos. Melhora a Fase 0A já no marco 1.

### 14.1 Ao mover para Matriculado
- Nos três caminhos (Kanban, modal do lead e Hub) abre a pergunta **"Data da matrícula"**:
  - padrão: **hoje**;
  - aceita data passada e **recusa data futura** (validada também no banco);
  - data anterior à criação do lead gera aviso, mas não bloqueia.
- Uma função no banco (`set_lead_enrolled(lead_id, date)`) grava antes `enrollments` com `enrollment_date` = data informada e `date_source = 'manual'`,
  e depois muda `leads.status`. O gatilho da Fase 0A preserva a data e a fonte (o mesmo caminho do §10.1), **sem mudar o gatilho**.
- Caminhos sem pessoa (robô, importação) continuam como hoje: data = momento do evento.

### 14.2 Origem rotulada

O card do lead e os relatórios mostram a origem da data como um selo:

| Selo | `date_source` |
|---|---|
| **manual** | `manual` (informada); `evento` (momento em que alguém marcou) |
| **erp** | `erp` (veio da base) |
| **estimada** | `estimada`, `log_edicao` e `log_status` do backfill da Fase 0A |

### 14.3 Correção
- Só **admin e gestor** corrigem a data, num botão "corrigir data" no card. O motivo é obrigatório.
- A correção grava em **`enrollment_date_changes`** (imutável): `enrollment_id, old_date, new_date, old_source, new_source, reason, changed_by, changed_at`.
  O `funnel_metrics` é recalculado pelo gatilho que já existe.
- O atendente informa a data ao marcar, mas não corrige depois.

### 14.4 Divergência CRM × ERP
- Para lead com aluno vinculado (`student_lead_links` confirmado) e `enrolled_at` do ERP preenchido: se a data do CRM e a do ERP diferirem em mais de
  3 dias (configurável) ou caírem em meses diferentes, aparece o alerta **"Data da matrícula diverge: CRM 03/10 · ERP 28/09"**.
- O alerta aparece no card do lead e numa lista em Base de alunos → Divergências.
- O botão **"Usar a do ERP"** faz uma correção comum (`new_source = 'erp'`, motivo "alinhado ao ERP"), com log.
- **Nunca há correção automática**, nem com `erp_confirms_enrollment` ligado.

---

## 15. Catálogo de integrações (Super Admin)

### 15.1 Tela "Integrações" (`/super-admin/integracoes`)
- **Matriz ERP × escolas.** Para cada escola: ERP declarado, situação da integração, última carga, selo da base e aviso de token vencendo.
  A situação é uma destas:
  - sem ERP informado;
  - ERP sem integração;
  - token pendente;
  - conectada;
  - com aviso;
  - com erro;
  - pausada.
- Contagem por ERP ("7 escolas usam Sophia, 0 integradas"), que orienta qual adaptador fazer depois do Activesoft.
- Ações: abrir a ficha do ERP, ver o log da escola (`sync_runs`), pausar ou retomar a carga noturna.
  O token **nunca aparece**, nem para o Super Admin, só os 4 últimos caracteres.

### 15.2 Ficha de integração por ERP
Tabela **`erp_providers`**: `slug, name, status` (`disponivel` | `em_teste` | `planejado` | `sem_api`), `auth_type, docs_url, support_contact`,
`adapter_version, last_verified_at`, mais a ficha em texto estruturado:
- o que a API oferece e o que usamos (rotas e campos), e o que é **proibido** (§2.5);
- escopos que a escola precisa liberar e o **passo a passo para gerar o token** (é mostrado para a escola no passo 1 do onboarding);
- limites conhecidos (paginação, volume, tempo por página) e o que está **confirmado × a confirmar** (alimentado pela etapa 0);
- mapa padrão de situações (semente do `erp_status_map` de cada escola nova);
- problemas conhecidos e como resolver (ex.: "novato vem nulo → configurar 'Próximo período'").

A primeira ficha é a do Activesoft, preenchida com o Swagger e com o resultado da etapa 0.

---

## 16. Riscos, testes e entrega

### 16.1 Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| A API não devolve anos anteriores | sem comparação com o ano anterior nem coorte na largada | etapa 0 confirma; plano B: planilha do ano anterior no mesmo modelo (mesma identidade por matrícula) |
| Textos de situação variam por escola | contas erradas | `erp_status_map` editável + `desconhecido` fora das contas + aviso |
| Flag de novato depende do "Próximo período" | novato errado | o cálculo pela base é a regra; a flag só é conferência |
| Volume × 25 por página | carga noturna lenta, estouro de tempo | fila retomável; incremental onde existe; máximo de 2 escolas simultâneas |
| Validade do token desconhecida | sync para em silêncio | 401 vira aviso imediato; data opcional com avisos antecipados |
| Contar duas vezes ao trocar ou misturar fontes | números inflados | uma fonte por ano (`student_base_coverage`), troca só pelo admin e com log |
| Irmãos com o mesmo celular | vínculo errado com lead | celular sozinho nunca confirma; revisão manual |
| `normalize_phone_br` do banco ainda com o bug do 9 em fixo | casamento por telefone falha em fixos | função corrigida da Fase B (autorizada com ensaio em 12/10) antes do marco 3 |
| Ausência na origem por falha parcial da API | aluno "sai" sem ter saído | só depois de 2 cargas completas seguidas, e sem apagar |
| Vazamento de dados de menores | jurídico e reputação | RLS desde o primeiro dia, sem anon, teste de anon em transação desfeita (como nas correções de setembro e outubro), lista de campos permitidos |
| Divergência ERP × CRM vira "correção" automática | perda de confiança | divergências só geram alerta |
| Schema drift (tabelas criadas direto no banco) | migration quebra | conferir no banco antes; tudo versionado em `supabase/migrations` |

### 16.2 Plano de testes
1. **Etapa 0, contrato da API** (token real de uma escola piloto, só leitura, script fora do produto): formato da paginação; quais períodos voltam;
   formatos de data e de situação (valores distintos e quantidades); volume por rota; tempo médio por página; resposta a token inválido; se existe validade.
   O resultado vira uma ficha **sem dados pessoais** (só chaves, tipos, valores distintos de situação e contagens).
2. **Primeira carga só contagem** (`dry_run_contagem`): o adaptador lê tudo e **não grava nada**, só o `summary` por ano, série, turma e situação
   (ativos, pré, inativos, novatos). A escola compara com o relatório da secretaria.
   - Critério de aceite: total de ativos idêntico; por série idêntico ou com diferença explicada.
   - Só depois do **ok explícito** a carga grava.
3. **Recontagem:** depois de gravar, as visões canônicas têm que devolver exatamente o `summary` do dry-run.
4. **Idempotência:** rodar a sincronização duas vezes → zero mudanças. Depois, simular uma mudança de situação, uma transferência e um aluno novo → eventos certos.
5. **Regras** (ensaio no banco com RAISE no fim, como na Fase 0A): coortes sintéticas cobrindo rematriculado, pendente, novato, retido, concluinte,
   saída no ano, remanejamento, troca de unidade e pré-matrícula com a configuração ligada e desligada.
6. **Planilha:** arquivos de teste com acentos, CSV com `;` e `,`, data serial do Excel, linhas duplicadas, coluna faltando, série não mapeada,
   reimportação com o mapeamento salvo, carga parcial × completa.
7. **Casamento:** gabarito com as matrículas reais (Ágape 23, Universo Uno 19) → precisão e cobertura. Critério: **zero** auto-confirmação errada.
8. **Segurança:** como anon, atendente, gestor e admin de outra escola, em transação desfeita: nenhuma leitura cruzada; token ilegível; as rotas proibidas
   recusadas pelo adaptador (teste automatizado).
9. **Fase 0A:** diferença de `funnel_metrics` antes e depois na escola piloto. Matrícula `erp` com a data da efetivação; o gatilho preserva a data e a fonte.
10. **Painéis:** conferência manual de três números por tela contra a planilha da escola.

Testes adicionais da v2:

11. **IA:** o pacote de entrada não contém nenhum texto além de nomes de séries, turmas e códigos (teste automático procurando nomes de alunos da escola piloto
    no `payload`); célula < 3 mascarada; todo número citado existe no pacote.
12. **Data da matrícula:** data futura recusada no banco; data passada preservada pelo gatilho; correção só por admin/gestor e com log;
    "usar a do ERP" registra `new_source = erp`.
13. **Meta de novatos:** conferência à mão de três séries (passagem com histórico, série de entrada, série acima da capacidade).

### 16.3 Entrega em 5 marcos

Cada marco termina com ensaio, ok e no ar antes do próximo.

| Marco | Conteúdo | Dias |
|---|---|---|
| **1** | **Etapa 0 + modelo + lançamento manual + painel de Rematrículas.** Etapa 0 com token real (só leitura, ficha sem dados pessoais); migrations do modelo, RLS e visões; regras em SQL; migração de `monthly_reenrollments`/`re_enrollments`; onboarding na trilha manual (passos 1, 2, 3 e 6, incluindo as vagas); lançamento manual agregado; painel de Rematrículas (hoje × ano anterior, curva, tabela por série); data da matrícula no lead (§14.1–14.3); menu "Base de alunos" e permissão `base_alunos` | 12–16 |
| **2** | **Planilha + Activesoft.** Importador com mapeamento salvo e modelo; adaptador com fila, Vault, log, "Sincronizar agora", avisos de token; dry-run de contagem; passos 4 e 5 do onboarding; catálogo de integrações e ficha do Activesoft (§15) | 11–14 |
| **3** | **Casamento + funil de pendentes.** Motor e tela de revisão; matrícula `erp` e `funnel_metrics` (§10); divergência CRM × ERP com "usar a do ERP" (§14.4); Kanban de pendentes com motivos, pesquisa de saída e público para Transmissões | 8–10 |
| **4** | **Mapa de turmas, Fluxo, Evasão e IA.** Os três painéis; meta de novatos por série ligada à Campanha (§12); estudo anual e fechamento mensal (§11) | 9–12 |
| **5** | **LGPD e piloto.** Anonimização por cron, exportação e anonimização por aluno, revisão de acessos e logs, página de privacidade final; piloto acompanhado em uma escola com Activesoft e uma manual; ajustes | 4–6 |
| **Total** | | **44–58 dias** (~9–12 semanas) |

**Atenção, LGPD antes do marco 2:** o marco 5 fecha o pacote, mas **antes da primeira carga que grava dados pessoais** (marco 2) precisam estar prontos
o aditivo de tratamento de dados assinado pela escola piloto e a página `/privacidade` atualizada. O dry-run de contagem não grava dados pessoais
e pode rodar antes.

### 16.4 Decisões

**Tomadas em 12/10:**
- Pré-matrícula sempre separada; contar como rematriculado fica **desligado por padrão** (`count_prematricula_as_reenrolled = false`).
- Corte da base = **ativos na abertura da rematrícula**.
- `erp_confirms_enrollment` **desligado em todas** as escolas.
- Retenção de quem saiu: **5 anos**, depois anonimiza.
- Menu **"Base de alunos"**, permissão `base_alunos`: admin e gestor veem tudo; atendente vê só o funil, com os próprios cards.
- `pg_trgm` e `unaccent`: autorizados por migration versionada.
- `normalize_phone_br` corrigida: autorizada **com ensaio**; aplicação só depois do ok sobre o resultado do ensaio.

**Ainda abertas:**
1. Escola piloto do Activesoft (para a etapa 0 do marco 1).
2. Redação do aditivo de tratamento de dados.
3. Prazo de tolerância para "Rematriculado (declarado)" sem confirmação da base (proposta: 15 dias) e para a divergência de data (proposta: 3 dias).
