// supabase/functions/erp-activesoft-sync/adapter.ts
//
// Peças puras do adaptador Activesoft (sem Deno, sem banco), testáveis fora:
//   * ROTAS: lista FIXA das 7 rotas de leitura. Qualquer outra é recusada antes
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
  vinculos:     'acesso/vinculo_aluno_responsavel_liberado',
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
    }),
  }
}

// Aluno: id e matrícula sempre; nome só com `names`. Celular, data de
// nascimento e documentos ficam de fora nesta etapa.
export function normAluno(o: Obj, names: boolean): Staged | null {
  const id = pick(o, 'id', 'aluno_id', 'codigo')
  if (!id) return null
  return { external_id: id, data: clean({
    id,
    matricula: pick(o, 'matricula', 'numero_matricula', 'codigo_matricula'),
    nome:      names ? pick(o, 'nome', 'nome_aluno', 'nome_completo') : undefined,
  }) }
}

// Responsável: só existe com `names` (é só o nome; CPF não entra nesta etapa).
export function normResponsavel(o: Obj): Staged | null {
  const id = pick(o, 'id', 'responsavel_id', 'codigo')
  return id ? { external_id: id, data: clean({ id, nome: pick(o, 'nome', 'nome_responsavel', 'nome_completo') }) } : null
}

export function normVinculo(o: Obj): Staged | null {
  const aluno = pick(o, 'id_aluno', 'aluno_id', 'aluno.id', 'aluno')
  const resp  = pick(o, 'id_responsavel', 'responsavel_id', 'responsavel.id', 'responsavel')
  if (!aluno || !resp) return null
  return { external_id: `${aluno}|${resp}`, data: clean({
    aluno_id: aluno, responsavel_id: resp, principal: pick(o, 'principal', 'responsavel_principal', 'financeiro'),
  }) }
}

// Plano da leitura (fila retomável): cada passo é paginado de 25 em 25.
// Responsáveis e vínculos só entram com os nomes liberados (aditivo LGPD).
export type Step = { key: string; route: RouteKey; entity: string; params: Record<string, string | boolean>; situacao?: string }
// Rotas que podem estar fora do token sem impedir a carga: unidades (vêm das
// turmas) e vínculos (só servem com nomes liberados).
export const OPTIONAL_STEPS = new Set(['unidades', 'vinculos'])

export function plan(names: boolean): Step[] {
  const s: Step[] = [
    { key: 'unidades', route: 'unidades', entity: 'unidade', params: {} },
    { key: 'cursos',   route: 'cursos',   entity: 'curso',   params: {} },
    { key: 'turmas',   route: 'turmas',   entity: 'turma',   params: { mostrar_todas_as_turmas: true } },
    ...['A', 'I', 'P', 'S'].map(sit => ({ key: `enturmacao_${sit}`, route: 'enturmacao' as RouteKey, entity: 'enturmacao',
      params: { situacao_sistema: sit }, situacao: sit })),
    { key: 'alunos',   route: 'alunos',   entity: 'aluno',   params: {} },
  ]
  if (names) {
    s.push({ key: 'responsaveis', route: 'responsaveis', entity: 'responsavel', params: { possui_aluno_vinculado_ativo: true } })
    s.push({ key: 'vinculos',     route: 'vinculos',     entity: 'vinculo',     params: {} })
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
    case 'vinculo':     return names ? normVinculo(o) : null
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
