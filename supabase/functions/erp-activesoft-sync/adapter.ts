// supabase/functions/erp-activesoft-sync/adapter.ts
//
// Peças puras do adaptador Activesoft (sem Deno, sem banco), testáveis fora:
//   * ROTAS: lista FIXA das 6 rotas de leitura. Qualquer outra é recusada antes
//     da chamada (notas, boletim, frequência, ocorrências, financeiro e escrita
//     nunca passam por aqui). Só GET.
//   * Paginação de 25 (limit/offset), aceitando lista crua ou {count,next,results}.
//   * Normalização: cada objeto da API vira um registro com SÓ os campos
//     permitidos (desenho §2.5). Celular do aluno, CPF e o resto são descartados
//     aqui, antes de tocar o banco. Nomes só com `names` = true.

export const PAGE_SIZE = 25

export const ROUTES = {
  unidades:     'lista_unidades',
  cursos:       'lista_cursos',
  turmas:       'lista_turmas',
  enturmacao:   'enturmacao_com_detalhes',
  alunos:       'lista_alunos',
  responsaveis: 'lista_responsaveis',
} as const
export type RouteKey = keyof typeof ROUTES
const ALLOWED_PATHS = new Set<string>(Object.values(ROUTES))

export class ForbiddenRoute extends Error {}

// Monta a URL de uma rota permitida. Recusa qualquer outra coisa.
export function routeUrl(baseUrl: string, route: string, params: Record<string, string | number | boolean | undefined>): string {
  if (!ALLOWED_PATHS.has(route)) throw new ForbiddenRoute(`Rota não permitida: ${route}`)
  const base = new URL(baseUrl.replace(/\/+$/, '') + '/')
  if (base.protocol !== 'https:' || !/(^|\.)activesoft\.com\.br$/.test(base.hostname)) {
    throw new ForbiddenRoute('Endereço da API fora do Activesoft')
  }
  const u = new URL(route.replace(/^\/+/, '') + '/', base)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, String(v))
  return u.toString()
}

// Página: lista crua ou envelope. `hasMore` pela contagem/next ou pelo tamanho.
export function readPage(body: unknown, offset: number): { items: Record<string, unknown>[]; hasMore: boolean; total?: number } {
  if (Array.isArray(body)) return { items: body as Record<string, unknown>[], hasMore: body.length >= PAGE_SIZE }
  const b = (body ?? {}) as Record<string, unknown>
  const items = (Array.isArray(b.results) ? b.results : Array.isArray(b.data) ? b.data : Array.isArray(b.resultados) ? b.resultados : []) as Record<string, unknown>[]
  const total = typeof b.count === 'number' ? b.count : undefined
  const hasMore = b.next != null && b.next !== '' ? true
    : total !== undefined ? offset + items.length < total
    : items.length >= PAGE_SIZE
  return { items, hasMore, total }
}

// Só os NOMES dos campos (para o teste mostrar o formato sem dados pessoais)
export function fieldNames(items: Record<string, unknown>[]): string[] {
  const s = new Set<string>()
  for (const it of items.slice(0, 3)) for (const k of Object.keys(it ?? {})) s.add(k)
  return [...s].sort()
}

// ── normalização ──
type Obj = Record<string, unknown>
const str = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined
  if (typeof v === 'object') return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}
function pick(o: Obj, ...keys: string[]): string | undefined {
  for (const k of keys) {
    if (k.includes('.')) {
      const [a, b] = k.split('.')
      const inner = o?.[a]
      if (inner && typeof inner === 'object') { const v = str((inner as Obj)[b]); if (v) return v }
    } else {
      const v = str(o?.[k]); if (v) return v
    }
  }
  return undefined
}
const yearOf = (...vals: (string | undefined)[]) => {
  for (const v of vals) { const m = v?.match(/(?:19|20)\d{2}/); if (m) return m[0] }
  return undefined
}
// sigla_periodo do Activesoft: "2026", "2026/1" ou "26"
const yearFromSigla = (v: string | undefined) => {
  if (!v) return undefined
  const full = yearOf(v); if (full) return full
  const m = v.trim().match(/^(\d{2})(?:\D.*)?$/)
  return m ? '20' + m[1] : undefined
}
const clean = (o: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Record<string, string>

export type Staged = { external_id: string; data: Record<string, string> }

export function normUnidade(o: Obj): Staged | null {
  const id = pick(o, 'id', 'unidade_id', 'codigo')
  return id ? { external_id: id, data: clean({ id, nome: pick(o, 'nome', 'descricao', 'nome_unidade') }) } : null
}

export function normCurso(o: Obj): Staged | null {
  const id = pick(o, 'id', 'curso_id', 'codigo')
  return id ? { external_id: id, data: clean({ id, nome: pick(o, 'curso_nome', 'nome', 'descricao', 'nome_curso') }) } : null
}

export function normTurma(o: Obj): Staged | null {
  const id = pick(o, 'id', 'turma_id', 'codigo')
  if (!id) return null
  const periodo = pick(o, 'periodo_nome', 'periodo.nome', 'periodo_letivo', 'periodo', 'ano_letivo', 'ano')
  const unidade = o?.unidade
  return { external_id: id, data: clean({
    id,
    nome:       pick(o, 'nome', 'descricao', 'nome_turma', 'turma'),
    serie_id:   pick(o, 'serie_id', 'serie.id', 'id_serie'),
    serie_nome: pick(o, 'serie_nome', 'nome_serie', 'serie.nome', 'serie'),
    curso_id:   pick(o, 'curso_id', 'curso.id', 'id_curso'),
    curso_nome: pick(o, 'curso_nome', 'nome_curso', 'curso.nome', 'curso'),
    unidade_id: pick(o, 'unidade_id', 'unidade.id', 'id_unidade'),
    unidade_nome: pick(o, 'unidade_nome', 'unidade.nome') ?? (typeof unidade === 'string' && !/^\d+$/.test(unidade.trim()) ? unidade.trim() : undefined),
    ano:        yearOf(pick(o, 'ano', 'ano_letivo'), periodo) ?? yearFromSigla(pick(o, 'sigla_periodo')) ?? yearOf(pick(o, 'nome')),
  }) }
}

// lista_unidades pode estar sem permissão no token: a unidade sai da própria turma
export function unidadeFromTurma(t: Staged): Staged | null {
  const id = t.data.unidade_id
  return id ? { external_id: id, data: clean({ id, nome: t.data.unidade_nome }) } : null
}

export function normEnturmacao(o: Obj, situacaoSistema: string): Staged | null {
  const aluno = pick(o, 'aluno_id', 'id_aluno', 'aluno.id', 'aluno')
  const turma = pick(o, 'turma_id', 'id_turma', 'turma.id', 'turma')
  if (!aluno) return null
  const periodo = pick(o, 'periodo_nome', 'periodo.nome', 'periodo_letivo', 'periodo', 'ano_letivo', 'ano')
  const ano = yearOf(pick(o, 'ano', 'ano_letivo'), periodo)
  return {
    external_id: pick(o, 'id', 'enturmacao_id') ?? `${aluno}|${turma ?? ''}|${ano ?? ''}`,
    data: clean({
      aluno_id:         aluno,
      turma_id:         turma,
      turma_nome:       pick(o, 'nome_turma_completo', 'turma_nome', 'nome_turma', 'turma.nome'),
      matricula:        pick(o, 'matricula', 'aluno_matricula', 'aluno.matricula', 'numero_matricula'),
      serie_id:         pick(o, 'serie_id', 'serie.id', 'id_serie'),
      serie_nome:       pick(o, 'serie_nome', 'nome_serie', 'serie.nome', 'serie'),
      curso_nome:       pick(o, 'curso_nome', 'nome_curso', 'curso.nome', 'curso'),
      unidade_id:       pick(o, 'unidade_id', 'unidade.id', 'id_unidade'),
      ano,
      situacao:         pick(o, 'situacao_aluno_turma', 'situacao', 'situacao_descricao', 'situacao_nome', 'descricao_situacao', 'status'),
      situacao_sistema: situacaoSistema,
      novato:           pick(o, 'novato_considerando_periodo_anterior'),
      efetivacao:       pick(o, 'data_efetivacao_matricula', 'data_matricula'),
    }),
  }
}

// Ids dos responsáveis que vêm no próprio aluno (lista_alunos), na ordem de
// prioridade: responsável, secundário, filiação 1 e 2, adicionais. Sem repetir.
export function guardianIds(o: Obj): string[] {
  const out: string[] = []
  const add = (v: unknown) => {
    if (v === null || v === undefined || typeof v === 'object') return
    const t = String(v).trim()
    if (t && t !== '0' && !out.includes(t)) out.push(t)
  }
  for (const k of ['responsavel_id', 'responsavel_secundario_id', 'filiacao_1_id', 'filiacao_2_id']) add(o?.[k])
  const extra = o?.responsaveis_adicionais_ids
  if (Array.isArray(extra)) extra.forEach(add)
  else if (typeof extra === 'string') extra.split(/[,;\s]+/).forEach(add)
  else add(extra)
  return out
}

// Aluno: id e matrícula sempre; nome e ids dos responsáveis só com `names`.
// Celular, data de nascimento, CPF e documentos ficam de fora.
export function normAluno(o: Obj, names: boolean): Staged | null {
  const id = pick(o, 'id', 'aluno_id', 'codigo')
  if (!id) return null
  const resp = names ? guardianIds(o) : []
  return { external_id: id, data: clean({
    id,
    matricula: pick(o, 'matricula', 'numero_matricula', 'codigo_matricula'),
    nome:      names ? pick(o, 'nome', 'nome_aluno', 'nome_completo') : undefined,
    resp_ids:  resp.length ? resp.join(',') : undefined,
  }) }
}

// Responsável: só existe com `names` — nome e celular (para a equipe ligar).
// CPF, e-mail, login, digitais, foto e o resto ficam de fora.
export function normResponsavel(o: Obj): Staged | null {
  const id = pick(o, 'id', 'responsavel_id', 'codigo')
  return id ? { external_id: id, data: clean({ id, nome: pick(o, 'nome', 'nome_responsavel', 'nome_completo'), telefone: pick(o, 'celular', 'telefone', 'telefone_celular') }) } : null
}

// Vínculos aluno → responsável a partir dos ids do aluno (a rota
// acesso/vinculo_aluno_responsavel_liberado é a lista da portaria — quem pode
// buscar o aluno —, não a família, e não é lida). O 1º id é o principal.
export function vinculosFromAluno(aluno: Staged): Staged[] {
  const ids = (aluno.data.resp_ids ?? '').split(',').filter(Boolean)
  return ids.map((r, i) => ({ external_id: `${aluno.external_id}|${r}`, data: {
    aluno_id: aluno.external_id, responsavel_id: r, principal: i === 0 ? 'true' : 'false', ordem: String(i + 1),
  } }))
}

// Plano da leitura (fila retomável): cada passo é paginado de 25 em 25.
// Responsáveis só entram com os nomes liberados (aditivo LGPD). Nunca:
// lista_*_dados_sensiveis, lista_*_endereco, vínculo da portaria.
export type Step = { key: string; route: RouteKey; entity: string; params: Record<string, string | boolean>; situacao?: string; ano?: string }

// Períodos lidos: o atual e o seguinte (rematrícula). Documentação do Activesoft:
//   * lista_turmas aceita periodo_sigla ("2027"); sem ele, só o ano atual;
//   * enturmacao_com_detalhes aceita periodo e turma. O modo do período seguinte
//     vem do teste de conexão (periods.ts): 'sigla' (periodo=2027), 'id'
//     (periodo=<número>), 'turma' (uma chamada por turma de 2027) ou 'nenhum'. A enturmação NÃO recebe ano: herda o da turma
//     (sigla_periodo). Se a API ignorar o filtro e devolver 2026, as linhas caem
//     no mesmo registro (mesmo id) e nada vira 2027 por engano.
export type PeriodMode = 'sigla' | 'id' | 'turma' | 'nenhum'
export type PeriodPlan = { atual: string; seguinte: string; anteriores?: string[]; modo: PeriodMode; valor?: string | null; turmasSeguinte?: string[] }
export function periodYears(now = new Date()): { atual: string; seguinte: string; anteriores: string[] } {
  const y = now.getFullYear()
  // anteriores: histórico lido para separar novato, rematrícula e ex-aluno que voltou
  return { atual: String(y), seguinte: String(y + 1), anteriores: [String(y - 1), String(y - 2), String(y - 3), String(y - 4)] }
}
const SITUACOES = ['A', 'I', 'P', 'S']
// Rota que pode estar fora do token sem impedir a carga: unidades (a
// documentação não diz a permissão; unidade_id e unidade já vêm nas turmas).
export const OPTIONAL_STEPS = new Set(['unidades'])

export function plan(names: boolean, p: PeriodPlan = { ...periodYears(), modo: 'nenhum' }): Step[] {
  const { atual, seguinte, modo } = p
  const valor = p.valor ?? (modo === 'sigla' ? seguinte : null)
  const ent = (ano: string, sit: string, extra: Record<string, string>, keySuffix = ''): Step => ({
    key: `enturmacao_${ano}${keySuffix}_${sit}`, route: 'enturmacao', entity: 'enturmacao',
    params: { situacao_sistema: sit, ...extra }, situacao: sit, ano,
  })
  const s: Step[] = [
    { key: 'unidades', route: 'unidades', entity: 'unidade', params: {} },
    { key: 'cursos',   route: 'cursos',   entity: 'curso',   params: {} },
    { key: `turmas_${atual}`,    route: 'turmas', entity: 'turma', params: { mostrar_todas_as_turmas: true, periodo_sigla: atual },    ano: atual },
    { key: `turmas_${seguinte}`, route: 'turmas', entity: 'turma', params: { mostrar_todas_as_turmas: true, periodo_sigla: seguinte }, ano: seguinte },
    ...(modo === 'sigla' ? (p.anteriores ?? []).map(a => ({ key: `turmas_${a}`, route: 'turmas' as const, entity: 'turma', params: { mostrar_todas_as_turmas: true, periodo_sigla: a }, ano: a })) : []),
    // período atual: sem filtro (é o padrão da API, já validado)
    ...SITUACOES.map(sit => ent(atual, sit, {})),
    // anos anteriores (só quando o período pode ser pedido pela sigla)
    ...(modo === 'sigla' ? (p.anteriores ?? []).flatMap(a => SITUACOES.map(sit => ent(a, sit, { periodo: a }))) : []),
    // período seguinte: pelo modo descoberto no teste
    ...((modo === 'sigla' || modo === 'id') && valor ? SITUACOES.map(sit => ent(seguinte, sit, { periodo: valor })) : []),
    ...(modo === 'turma' ? (p.turmasSeguinte ?? []).flatMap(t => SITUACOES.map(sit => ent(seguinte, sit, { turma: t }, `_t${t}`))) : []),
    { key: 'alunos',   route: 'alunos',   entity: 'aluno',   params: {} },
  ]
  if (names) {
    s.push({ key: 'responsaveis', route: 'responsaveis', entity: 'responsavel', params: { possui_aluno_vinculado_ativo: true } })
  }
  return s
}

export function normalize(step: Step, o: Obj, names: boolean): Staged | null {
  switch (step.entity) {
    case 'unidade':     return normUnidade(o)
    case 'curso':       return normCurso(o)
    case 'turma':       return normTurma(o)
    case 'enturmacao':  return normEnturmacao(o, step.situacao ?? '')
    case 'aluno':       return normAluno(o, names)
    case 'responsavel': return names ? normResponsavel(o) : null
    default:            return null
  }
}

// ── teste de conexão ──
// Resultado de uma rota: passou?, status HTTP (0 = sem resposta) e mensagem
// curta (o "detail" da API, nunca o token nem dados).
export type Probe = { ok: boolean; status: number; msg: string; fields?: string[] }

export function apiMessage(status: number, bodyText: string): string {
  let m = ''
  try {
    const b = JSON.parse(bodyText)
    m = String(b?.detail ?? b?.message ?? b?.erro ?? b?.error ?? '')
  } catch { m = '' }
  if (!m) m = status === 401 ? 'credencial recusada' : status === 403 ? 'sem permissão para esta rota'
    : status === 404 ? 'rota não encontrada' : status === 0 ? 'sem resposta (tempo esgotado ou rede)' : `HTTP ${status}`
  return m.replace(/\s+/g, ' ').trim().slice(0, 140)
}

// Escolhe a autenticação pela que mais passou (empate: a ordem dada, Bearer
// primeiro — é o que o servidor anuncia em WWW-Authenticate).
export function pickScheme(results: Record<string, Record<string, Probe>>, order: string[] = ['Bearer', 'Token']) {
  let best = order[0]
  let bestOk = -1
  for (const s of order) {
    const n = Object.values(results[s] ?? {}).filter(p => p.ok).length
    if (n > bestOk) { best = s; bestOk = n }
  }
  const routes = results[best] ?? {}
  const total = Object.keys(routes).length
  return {
    scheme: bestOk > 0 ? best : null,     // nenhuma rota passou: nenhuma autenticação aceita
    shown: best,                          // a que aparece na tela
    okCount: Math.max(bestOk, 0),
    total,
    allOk: total > 0 && bestOk === total,
    routes,
    tried: Object.fromEntries(order.map(s => [s, Object.values(results[s] ?? {}).filter(p => p.ok).length])),
  }
}
