// supabase/functions/erp-activesoft-sync/periods.ts
//
// Períodos do Activesoft (ano atual e o seguinte, da rematrícula). Peças sem
// Deno e sem banco: recebem um `get(rota, params)` já autenticado, então rodam
// igual na edge function e no ensaio local. NADA é gravado aqui.
//   * lista_turmas aceita periodo_sigla ("2027"); sem ele, só o ano atual.
//   * enturmacao_com_detalhes aceita `periodo` (a documentação não diz se é o
//     id ou a sigla) e `turma`. Nenhuma rota lista os períodos nem traz o id do
//     período, então o teste tenta: periodo=2027 (sigla), periodo=1..N (id) e,
//     por último, turma=<uma turma de 2027>. Vale a forma em que TODAS as
//     enturmações devolvidas são de turmas de 2027 (se a API ignorar o filtro,
//     vêm turmas de 2026 e a forma é descartada).
//   * Sem turmas de 2027 em lista_turmas, a escola ainda não preencheu o
//     "Próximo período" no Activesoft (Administrativo → Configurações → Novo ano
//     letivo → Lista de períodos).
import { PAGE_SIZE, ROUTES, readPage, type PeriodMode } from './adapter.ts'

type Obj = Record<string, unknown>
export type Getter = (route: string, params: Record<string, string | number | boolean>) => Promise<unknown>
export type Years = { atual: string; seguinte: string }

// Erro de uma chamada sem token nem dados: status HTTP e mensagem curta da API
export const failInfo = (e: unknown) => {
  const o = (e ?? {}) as { status?: number; detail?: string; message?: string }
  return { status: typeof o.status === 'number' ? o.status : 0, msg: String(o.detail || o.message || 'falha na chamada').slice(0, 160) }
}

const s = (v: unknown) => (v === null || v === undefined || typeof v === 'object' ? undefined : String(v).trim() || undefined)
const turmaOf = (o: Obj) => s(o?.turma_id) ?? s(o?.id_turma) ?? s((o?.turma as Obj | undefined)?.id) ?? s(o?.turma)
const alunoOf = (o: Obj) => s(o?.aluno_id) ?? s(o?.id_aluno) ?? s((o?.aluno as Obj | undefined)?.id) ?? s(o?.aluno)

// O "resultado cru" mostrado na tela: só campos sem dado pessoal (nada de
// aluno_id, nome, CPF). Bastam para ver de que turma/ano/situação veio.
const RAW_FIELDS = ['turma_id', 'nome_turma_completo', 'situacao_aluno_turma', 'situacao_aluno_turma_tipo', 'situacao_aluno_turma_id',
                    'data_efetivacao_matricula', 'novato_considerando_periodo_anterior', 'unidade_id', 'turno']
export function rawSample(items: Obj[], n = 2): Obj[] {
  return items.slice(0, n).map(it => Object.fromEntries(RAW_FIELDS.filter(k => k in (it ?? {})).map(k => [k, it[k]])))
}

// Situação canônica (mesma regra de base_status_from_text no banco)
export function statusOf(texto: string | undefined, sistema: string): string {
  const t = (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  if (/pre.?matric/.test(t)) return 'pre_matricula'
  if (/^cursando|matriculad|^ativ/.test(t)) return 'ativo'
  if (/^aprovad|^reprovad|^conclu|^retid/.test(t)) return 'concluido'
  if (/transfer/.test(t)) return 'transferido'
  if (/cancel/.test(t)) return 'cancelado'
  if (/desist|abandon|evad/.test(t)) return 'desistente'
  if (/remanej/.test(t)) return 'remanejado'
  if (!t) return sistema === 'A' ? 'ativo' : sistema === 'P' ? 'pre_matricula' : 'desconhecido'
  return 'desconhecido'
}

// Todas as páginas de uma chamada (até maxPages), em memória.
async function readAll(get: Getter, route: string, params: Record<string, string | number | boolean>, maxPages: number, deadline: number) {
  const items: Obj[] = []
  let parcial = false
  for (let pg = 0; pg < maxPages; pg++) {
    if (Date.now() > deadline) { parcial = true; break }
    const page = readPage(await get(route, { ...params, limit: PAGE_SIZE, offset: pg * PAGE_SIZE }), pg * PAGE_SIZE)
    items.push(...page.items)
    if (!page.hasMore || page.items.length === 0) return { items, parcial }
    if (pg === maxPages - 1) parcial = true
  }
  return { items, parcial }
}

export type Tentativa = {
  forma: 'sigla' | 'id' | 'turma'
  parametro: string               // ex.: "periodo=2027 & situacao_sistema=P"
  http: number                    // 200, 400, 403… (0 = sem resposta)
  itens: number                   // enturmações na 1ª página
  total?: number                  // total do envelope, se a API mandar
  turmas: { seguinte: number; atual: number; outras: number }   // de que ano são as turmas devolvidas
  resultado: 'funciona' | 'ignorou_o_filtro' | 'misturado' | 'vazio' | 'erro'
  msg?: string
  cru: Obj[]                      // até 2 itens, sem dado pessoal
  envelope?: string[]             // chaves do envelope (count, next, results…)
}

export type PeriodProbe = {
  atual: string; seguinte: string
  modo: PeriodMode; valor: string | null           // o que usar na carga: periodo=<valor> ou turma
  detalhe: string
  falta_proximo_periodo: boolean
  turmas: Record<string, { n: number; parcial: boolean; siglas: Record<string, number>; http: number; msg?: string }>
  tentativas: Tentativa[]
  turmas_atual_ids: string[]                       // ids de turma (não são dado pessoal)
  turmas_seguinte_ids: string[]                    // usados no modo 'turma'
}

// Descobre a forma de pedir as enturmações do ano seguinte. ~10–30 chamadas.
// `comparar`: mesmo com a sigla funcionando, tenta periodo=1..comparar como id
// (só para a tela mostrar o cru das duas formas).
export async function periodProbe(get: Getter, y: Years, opts: { maxId?: number; deadline?: number; comparar?: number } = {}): Promise<PeriodProbe> {
  const deadline = opts.deadline ?? Date.now() + 60_000
  const maxId = opts.maxId ?? 12
  const turmas: PeriodProbe['turmas'] = {}
  const ids: Record<string, Set<string>> = { [y.atual]: new Set(), [y.seguinte]: new Set() }
  for (const ano of [y.atual, y.seguinte]) {
    try {
      const r = await readAll(get, ROUTES.turmas, { mostrar_todas_as_turmas: true, periodo_sigla: ano }, 20, deadline)
      const siglas: Record<string, number> = {}
      for (const t of r.items) {
        const sg = s(t?.sigla_periodo) ?? '(sem sigla)'
        siglas[sg] = (siglas[sg] ?? 0) + 1
        const id = s(t?.id) ?? s(t?.turma_id)
        // só conta como turma do ano se a sigla bater (ou não vier sigla)
        if (id && (sg === '(sem sigla)' || sg.includes(ano) || sg === ano.slice(2))) ids[ano].add(id)
      }
      turmas[ano] = { n: ids[ano].size, parcial: r.parcial, siglas, http: 200 }
    } catch (e) {
      const f = failInfo(e)
      turmas[ano] = { n: 0, parcial: false, siglas: {}, http: f.status, msg: f.msg }
    }
  }
  const classify = (items: Obj[]) => {
    const c = { seguinte: 0, atual: 0, outras: 0 }
    for (const it of items) {
      const t = turmaOf(it)
      if (t && ids[y.seguinte].has(t)) c.seguinte++
      else if (t && ids[y.atual].has(t)) c.atual++
      else c.outras++
    }
    return c
  }
  const tentar = async (forma: Tentativa['forma'], params: Record<string, string>): Promise<Tentativa> => {
    const parametro = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' & ')
    try {
      const body = await get(ROUTES.enturmacao, { ...params, limit: PAGE_SIZE, offset: 0 })
      const page = readPage(body, 0)
      const c = classify(page.items)
      const resultado: Tentativa['resultado'] = page.items.length === 0 ? 'vazio'
        : c.seguinte === page.items.length ? 'funciona'
        : c.seguinte === 0 && c.atual > 0 ? 'ignorou_o_filtro'
        : c.seguinte === 0 ? 'vazio' : 'misturado'
      return { forma, parametro, http: 200, itens: page.items.length, total: page.total, turmas: c, resultado, cru: rawSample(page.items),
               envelope: Array.isArray(body) ? ['(lista)'] : Object.keys((body ?? {}) as Obj).sort() }
    } catch (e) {
      const f = failInfo(e)
      return { forma, parametro, http: f.status, itens: 0, turmas: { seguinte: 0, atual: 0, outras: 0 }, resultado: 'erro', msg: f.msg, cru: [] }
    }
  }

  const tentativas: Tentativa[] = []
  let modo: PeriodMode = 'nenhum'
  let valor: string | null = null
  const semSeguinte = ids[y.seguinte].size === 0
  // 1. sigla (pré-matrícula primeiro: é o que existe no ano seguinte)
  for (const sit of ['P', 'A']) {
    const t = await tentar('sigla', { periodo: y.seguinte, situacao_sistema: sit })
    tentativas.push(t)
    if (t.resultado === 'funciona') { modo = 'sigla'; valor = y.seguinte; break }
    if (t.resultado !== 'vazio') break
  }
  // 2. id: 1..maxId. Só dá para validar com turmas de 2027 conhecidas.
  if (modo === 'nenhum' && !semSeguinte) {
    for (let n = 1; n <= maxId && Date.now() < deadline; n++) {
      const t = await tentar('id', { periodo: String(n), situacao_sistema: 'P' })
      tentativas.push(t)
      if (t.resultado === 'funciona') { modo = 'id'; valor = String(n); break }
    }
    if (modo === 'nenhum') {
      // o mesmo com cursando, para id que só tenha ativos
      for (let n = 1; n <= maxId && Date.now() < deadline; n++) {
        const t = await tentar('id', { periodo: String(n), situacao_sistema: 'A' })
        if (t.resultado === 'funciona') { tentativas.push(t); modo = 'id'; valor = String(n); break }
      }
    }
  } else if (modo === 'sigla' && opts.comparar) {
    for (let n = 1; n <= opts.comparar; n++) tentativas.push(await tentar('id', { periodo: String(n), situacao_sistema: 'P' }))
  } else if (modo === 'nenhum') {
    // sem turmas de 2027 não há como validar: registra uma tentativa de id só para mostrar o cru
    tentativas.push(await tentar('id', { periodo: '1', situacao_sistema: 'P' }))
  }
  // 3. uma turma de 2027 por vez
  if (modo === 'nenhum' && !semSeguinte) {
    const t0 = [...ids[y.seguinte]][0]
    for (const sit of ['P', 'A']) {
      const t = await tentar('turma', { turma: t0, situacao_sistema: sit })
      tentativas.push(t)
      if (t.resultado === 'funciona') { modo = 'turma'; break }
    }
  }
  const forma = (t: Tentativa) => t.forma === 'id' ? `periodo como id (${t.parametro.split(' & ')[0]})` : t.forma === 'sigla' ? 'periodo como sigla' : 'filtro por turma'
  const ok = tentativas.find(t => t.resultado === 'funciona')
  const detalhe = semSeguinte
    ? `O Activesoft não devolveu turmas de ${y.seguinte}: falta preencher o "Próximo período" (Administrativo → Configurações → Novo ano letivo → Lista de períodos).`
    : ok ? `Funciona: ${forma(ok)}.`
    : `Há ${ids[y.seguinte].size} turma(s) de ${y.seguinte}, mas nenhuma forma devolveu enturmações delas (ainda sem pré-matrículas, ou o filtro não é aceito).`
  return { atual: y.atual, seguinte: y.seguinte, modo, valor, detalhe, falta_proximo_periodo: semSeguinte, turmas, tentativas,
           turmas_atual_ids: [...ids[y.atual]].sort(), turmas_seguinte_ids: [...ids[y.seguinte]].sort() }
}

// Contagem por ano e situação, em memória (nada gravado). Ano seguinte pela
// forma descoberta no probe. Rematrícula do ano seguinte, por aluno da base do
// ano atual (cursando, concluído ou pré-matrícula): rematriculado (cursando no
// seguinte), pré-matriculado, saiu ou a rematricular (sem enturmação no seguinte).
export type YearCount = {
  enturmacoes: number; alunos: number; parcial: boolean
  por_situacao_sistema: Record<string, number>
  por_situacao: Record<string, number>        // texto do Activesoft → quantos alunos
  por_status: Record<string, number>          // situação canônica → quantos alunos
  turmas_de_outro_ano: number                 // enturmações cujas turmas não são do ano pedido
  erros: string[]
}
export type PeriodCount = {
  anos: Record<string, YearCount>
  rematricula: { ano: string; base: number; rematriculados: number; pre_matriculados: number; sairam: number; a_rematricular: number; novatos: number } | null
  chamadas: number
}

const SIT = ['A', 'I', 'P', 'S']
export async function periodCount(get: Getter, p: PeriodProbe, opts: { deadline?: number; maxPages?: number } = {}): Promise<PeriodCount> {
  const deadline = opts.deadline ?? Date.now() + 100_000
  const maxPages = opts.maxPages ?? 200
  let chamadas = 0
  const counted: Getter = (r, q) => { chamadas++; return get(r, q) }
  // filtra pelas turmas do ano (se a lista de turmas veio inteira)
  const turmasDoAno = (ano: string) => p.turmas[ano]?.parcial || !p.turmas[ano]?.n ? null
    : new Set(ano === p.seguinte ? p.turmas_seguinte_ids : p.turmas_atual_ids)
  // por ano: aluno → [situação canônica, texto, sistema]; a ativa (A) vale sobre as outras
  const porAluno: Record<string, Map<string, { st: string; txt: string; sis: string }>> = {}
  const anos: Record<string, YearCount> = {}

  const lerAno = async (ano: string, calls: Record<string, string>[]) => {
    const yc: YearCount = { enturmacoes: 0, alunos: 0, parcial: false, por_situacao_sistema: {}, por_situacao: {}, por_status: {}, turmas_de_outro_ano: 0, erros: [] }
    const m = new Map<string, { st: string; txt: string; sis: string }>()
    const doAno = turmasDoAno(ano)
    // 4 em paralelo (uma por situação ou por turma)
    let i = 0
    const worker = async () => {
      while (i < calls.length) {
        const params = calls[i++]
        const sis = params.situacao_sistema
        try {
          const r = await readAll(counted, ROUTES.enturmacao, params, maxPages, deadline)
          if (r.parcial) yc.parcial = true
          for (const it of r.items) {
            const t = turmaOf(it)
            if (doAno && t && !doAno.has(t)) { yc.turmas_de_outro_ano++; continue }
            yc.enturmacoes++
            yc.por_situacao_sistema[sis] = (yc.por_situacao_sistema[sis] ?? 0) + 1
            const a = alunoOf(it); if (!a) continue
            const txt = s(it?.situacao_aluno_turma) ?? `(sistema ${sis})`
            const cur = m.get(a)
            if (!cur || (sis === 'A' && cur.sis !== 'A')) m.set(a, { st: statusOf(s(it?.situacao_aluno_turma), sis), txt, sis })
          }
        } catch (e) { yc.erros.push(`${Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')}: ${failInfo(e).msg}`) }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    for (const v of m.values()) {
      yc.por_status[v.st] = (yc.por_status[v.st] ?? 0) + 1
      yc.por_situacao[v.txt] = (yc.por_situacao[v.txt] ?? 0) + 1
    }
    yc.alunos = m.size
    porAluno[ano] = m
    anos[ano] = yc
  }

  // ano atual: padrão da API (sem período), já validado nas cargas
  await lerAno(p.atual, SIT.map(sit => ({ situacao_sistema: sit })))
  // ano seguinte: pela forma que funcionou
  if ((p.modo === 'sigla' || p.modo === 'id') && p.valor) await lerAno(p.seguinte, SIT.map(sit => ({ situacao_sistema: sit, periodo: p.valor! })))
  else if (p.modo === 'turma') await lerAno(p.seguinte, p.turmas_seguinte_ids.flatMap(t => SIT.map(sit => ({ situacao_sistema: sit, turma: t }))))

  let rematricula: PeriodCount['rematricula'] = null
  const a = porAluno[p.atual], b = porAluno[p.seguinte]
  if (a) {
    const base = [...a.entries()].filter(([, v]) => ['ativo', 'concluido', 'pre_matricula'].includes(v.st))
    const r = { ano: p.seguinte, base: base.length, rematriculados: 0, pre_matriculados: 0, sairam: 0, a_rematricular: 0, novatos: 0 }
    for (const [id] of base) {
      const c = b?.get(id)
      if (!c) r.a_rematricular++
      else if (c.st === 'ativo') r.rematriculados++
      else if (c.st === 'pre_matricula') r.pre_matriculados++
      else if (['transferido', 'cancelado', 'desistente'].includes(c.st)) r.sairam++
      else r.a_rematricular++
    }
    if (b) for (const [id, v] of b) if (!a.has(id) && ['ativo', 'pre_matricula'].includes(v.st)) r.novatos++
    rematricula = r
  }
  return { anos, rematricula, chamadas }
}
