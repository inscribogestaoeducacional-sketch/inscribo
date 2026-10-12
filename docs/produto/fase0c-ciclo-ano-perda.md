# Fase 0C — ciclo, ano letivo e motivo de perda

12/10/2026 · itens 1 a 3 prontos para aplicar (ensaio feito e desfeito, **nada aplicado**); itens 4 a 8 só desenho.

## Itens 1 a 3 — o que muda

| | Antes | Depois |
|---|---|---|
| **Ciclo** | `year` mistura ano da campanha e ano letivo (Ágape "Campanha 2026" vai de 08/09/2026 a 31/03/2027) | `campaign_year` (início da captação) e `target_school_year` (ano letivo que a campanha enche). Rótulo "Campanha AAAA" mostra o ano letivo alvo |
| **Lead novo** | só o formulário do Kanban vinculava ao ciclo; robô, Captação, Vitrine e Hub criavam lead solto | gatilho no banco vincula **todo** lead novo ao ciclo ativo (ativo/liberado, com datas, o mais recente — mesma regra do funil) |
| **Lead antes do ciclo** | contava igual | `cycle_link_kind = 'herdado'`: fica no ciclo como pipeline, **não** conta como lead da campanha. Selo "Herdado" no Kanban |
| **Ano de interesse** | `leadSave.ts` descartava o campo → 100% vazio | gravado ao criar e editar; vazio = ano letivo alvo do ciclo (gatilho) |
| **Perdido** | podia ficar sem motivo (8 de 10) | banco recusa perdido sem motivo; o botão "Marcar como Perdido" do formulário abre o mesmo modal do Kanban |

Arquivos (branch `fase0c-ciclo-ano-perda`):
- `supabase/migrations/20261013100000_fase0c_ciclo_ano_perda.sql`
- `supabase/pendentes/fase0c_backup.sql`, `fase0c_backfill.sql`, `fase0c_ensaio_inicio.sql`, `fase0c_ensaio_relatorio.sql`
- front: `leadSave.ts`, `NewLeadModal.tsx`, `LeadKanban.tsx`, `lostReasons.tsx` (novo, modal compartilhado), `GestorReports.tsx`, `supabase.ts`

### Ensaio de 12/10 (desfeito) — antes × depois por escola

| Escola | Leads com ciclo | Campanha / herdado / sem ciclo | Ano alvo preenchido | Perdidos com motivo |
|---|---|---|---|---|
| CEMA | 151 → 222 | 222 / 0 / 0 | 0 → 222 (2027) | 0 → 1 de 1 |
| Ágape | 104 → 187 | 143 / 44 / 1 | 0 → 187 (2027) | 0 → 4 de 4 |
| Santa Teresa | 7 → 88 | 51 / 37 / 3 | 0 → 88 (2027) | 1 → 2 de 2 |
| Colégio Áion (teste) | 0 → 20 | 1 / 19 / 11 | 0 → 20 (2027) | 0 → 2 de 2 |
| Universo Uno | 0 → 0 | 0 / 0 / 98 | — | — |
| Espaço Criativo | 0 → 0 | 0 / 0 / 31 | — | 1 → 1 de 1 |

- **Ágape: 44 herdados = 10 soltos em aberto + 34 que já estavam vinculados à mão mas foram criados antes de 08/09.** Agosto do Ágape passa de 28 leads de campanha para 0 (os 28 viram herdados). É a regra pedida, mas muda o número que a escola via.
- Sem ciclo ficam só os criados antes do início **e já fechados** (matriculados/perdidos): Ágape 1, Santa Teresa 3, Áion 11.
- Universo Uno e Espaço Criativo só têm ciclo em `setup` → nada muda até a campanha ser liberada (teste: lead novo fica sem ciclo).
- `funnel_metrics`: **0 linhas mudaram** (cadastros contam por data de criação).
- Os 8 perdidos sem motivo ganham `nao_informado` + detalhe "antes do motivo ser obrigatório"; a regra fica validada.
- Testes dos gatilhos: lead novo do Ágape (origem WhatsApp, sem passar ciclo) → ciclo, `campanha`, 2027; perdido sem motivo → recusado; com motivo → aceito.
- Colégio Áion (teste) fica com dois ciclos "Campanha 2027" (o ativo de 05–12/2026 e o de `setup`). Sugestão: arquivar um.

### Ordem para aplicar (com ok)
1. `fase0c_backup.sql` (ciclos inteiros + colunas de lead em `dedup_backup_rows`, run `fase0c_<data>`).
2. Migration → backfill (mesma janela; o backfill preenche o motivo dos perdidos **antes** de mexer em qualquer lead, senão a regra nova recusa).
3. Front (merge no main). Entre 2 e 3, o formulário antigo não manda motivo: "Marcar como Perdido" pelo formulário falha com erro claro; o Kanban já pede motivo. Janela curta, de madrugada.

## Itens 4 a 8 — desenho (sem código)

### 4. Investimento por canal
Hoje `marketing_campaigns` (37 linhas) guarda investimento **por mês**, sem canal. Proposta: tabela `channel_investments` (`institution_id, campaign_cycle_id, month, channel_id, amount, notes, created_by`) com os canais do item 5; tela de lançamento mês × canal na Campanha; CPA por canal = investimento ÷ leads `campanha` do canal no mês (e ÷ matrículas). `marketing_campaigns` vira leitura de legado (total do mês) até a escola lançar por canal.

### 5. Canais fixos + `capture_referral`
`leads.source` é texto livre (WhatsApp 533, Instagram 47, Indicação 28, vazio 27, Vitrine 12, Outros 8, Google 8, Facebook 6, Site 3). Proposta: catálogo fixo `lead_channels` (WhatsApp orgânico, Anúncio Meta, Instagram orgânico, Google, Indicação, Vitrine, Site, Evento, Outros) + `leads.channel_id`. Regra de atribuição: conversa com `capture_referral` (anúncio da Meta: 53 conversas, 40 leads) → "Anúncio Meta" com o id do anúncio; Captação Inteligente → canal do gatilho; Vitrine → Vitrine; formulário → escolha obrigatória. Backfill por mapa de `source`. `source` continua como texto livre complementar.

### 6. Data real da matrícula
Já desenhado na Fase 2 (§14 de `fase2-base-de-alunos-desenho.md`): pergunta a data ao mover para Matriculado (padrão hoje, sem futuro), origem rotulada, correção por admin/gestor com log, divergência CRM × ERP. Pode entrar antes da Fase 2 porque não depende do ERP.

### 7. Séries padronizadas
`leads.grade_interest` tem 43 valores distintos ("1º Ano", "1º Ano EF", "1º EM", "1º Médio", "3º Ano A"…). `school_grade_levels` já existe (153 linhas, 8 escolas). Proposta: `leads.grade_level_id` (FK) preenchido pelo formulário; backfill por mapa de texto → série (tela de revisão dos que não casarem); `grade_interest` fica como texto exibido. É a mesma série canônica que a Fase 2 usa (`school_grades`) — unificar as duas tabelas antes de criar a da Fase 2.

### 8. Foto do encerramento
Ao encerrar o ciclo (`finished_at`), gravar `campaign_cycle_snapshots` (`cycle_id, taken_at, metrics jsonb`): funil por mês, metas, leads campanha/herdado, matrículas, perdidos por motivo, CPA por canal, conversão por série. Imutável. Relatórios de ciclos passados leem a foto, não recalculam (dados de lead mudam depois). Foto também em marcos (fim de cada mês) para comparação ano a ano no mesmo dia da campanha.
