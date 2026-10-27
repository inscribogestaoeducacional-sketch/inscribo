import { F, D, curto, kids, bairroDe, type RaioXCtx } from './data'

export const STG = [
  { nome: 'Creche', k: 'cre', q: 4, idade: '0 a 3 anos' },
  { nome: 'Pré-escola', k: 'pre', q: 2, idade: '4 e 5 anos' },
  { nome: 'Anos iniciais', k: 'ai', q: 5, idade: '1º ao 5º ano' },
  { nome: 'Anos finais', k: 'af', q: 4, idade: '6º ao 9º ano' },
  { nome: 'Ensino médio', k: 'med', q: 3, idade: '1ª a 3ª série' },
] as const
export type StgKey = (typeof STG)[number]['k']

// ano mais recente em que a escola tem as etapas detalhadas (creche, pré...)
export function anoEtapas(c: RaioXCtx): number | null {
  const ok = c.R.serie.filter(s => s.escola && s.escola.cre != null)
  return ok.length ? ok[ok.length - 1].ano : null
}

export interface Oportunidade { tipo: string; forca: number; titulo: string; texto: string; modulo: string; como: string }
export interface Fatos { lider_em?: string[]; passagem?: [string, number, number]; creche?: [number, number]; enem?: [number | null, number, number, string, string, number, number, number]; bairro_sem?: string[]; integral?: [boolean, number, number] }

const NOM = { inf: 'Educação infantil', fund: 'Ensino fundamental', med: 'Ensino médio' } as const

export function insights(c: RaioXCtx): { ops: Oportunidade[]; fatos: Fatos } {
  const { R, B, ESC } = c; const cid = c.cid; const P = R.posicao; const L = R.lideres ?? ({} as any)
  const out: Oportunidade[] = []; const fatos: Fatos = {}
  for (const s of P.segmentos) {
    if (s.minha && s.ranking && s.ranking > 1) {
      const ld = L[s.seg][0]; const gap = ld.mat - s.minha
      out.push({ tipo: 'seg', forca: (100 * gap) / ld.mat, titulo: `${NOM[s.seg]}: ${s.ranking}º lugar, com espaço para crescer`,
        texto: `O 1º lugar, ${curto(ld.nome, 26)}, tem ${F(ld.mat)} alunos; a escola tem ${F(s.minha)}. Faltam ${F(gap)} alunos para alcançar o líder.`,
        modulo: 'Campanha de Matrículas + Mapa da Escola', como: 'Anunciar a etapa nos bairros com mais famílias e medir cada matrícula que chega.' })
    }
    if (s.minha && s.ranking === 1) (fatos.lider_em ??= []).push(NOM[s.seg])
  }
  const ay = anoEtapas(c)
  if (ay) {
    const sy = R.serie.find(s => s.ano === ay)!
    const ge: any = {}, gc: any = {}
    for (const s of STG) { ge[s.k] = ((sy.escola as any)[s.k] || 0) / s.q; gc[s.k] = ((sy.cidade as any)[s.k] || 0) / s.q }
    const pares: [StgKey, StgKey, string][] = [['pre', 'ai', 'da pré-escola para o 1º ano'], ['ai', 'af', 'do 5º para o 6º ano'], ['af', 'med', 'do 9º ano para o ensino médio']]
    const pr: [number, string, number, number][] = []
    for (const [a, b, t] of pares) if (ge[a] > 0 && gc[a] > 0) pr.push([ge[b] / ge[a] - gc[b] / gc[a], t, ge[b] / ge[a], gc[b] / gc[a]])
    if (pr.length) {
      const [d, t, re, rc] = pr.reduce((m, x) => (x[0] < m[0] ? x : m))
      if (d < -0.05) {
        out.push({ tipo: 'pass', forca: Math.abs(d) * 100, titulo: `Alunos que saem ${t}`, texto: `A escola mantém ${D(100 * re, 0)} alunos para cada 100 da etapa anterior; a média das particulares de ${cid} mantém ${D(100 * rc, 0)}.`,
          modulo: 'Rematrícula + Funil de Matrículas', como: 'Ver quais famílias estão em risco antes da rematrícula e agir uma a uma.' })
        fatos.passagem = [t, re, rc]
      }
    }
    const s0 = R.serie[0]
    if (s0.escola?.cre && s0.cidade.cre && sy.escola?.cre != null && sy.cidade.cre != null) {
      const ce = 100 * (sy.escola.cre / s0.escola.cre - 1), cc = 100 * (sy.cidade.cre / s0.cidade.cre - 1)
      fatos.creche = [ce, cc]
      if (ce < cc - 5) out.push({ tipo: 'creche', forca: (cc - ce) / 2, titulo: 'Creche cresce menos que a cidade', texto: `Desde ${s0.ano}, a creche da escola cresceu ${D(ce, 0)}% e a da cidade, ${D(cc, 0)}%.`,
        modulo: 'Captação', como: 'Descobrir qual canal traz pais de crianças de 0 a 3 anos e investir nele.' })
    }
  }
  const E = R.enem
  if (E?.escola && E.cidade?.length) {
    const me = E.escola; const cols = [['cn', 'Ciências da Natureza'], ['ch', 'Ciências Humanas'], ['lc', 'Linguagens'], ['mt', 'Matemática'], ['red', 'Redação']] as const
    const best: any = {}; for (const [k] of cols) best[k] = Math.max(...E.cidade.map((x: any) => x[k]))
    const dif = (k: string) => best[k] - (me as any)['media_' + k]
    const [k, nm] = cols.reduce((m, x) => (dif(x[0]) > dif(m[0]) ? x : m))
    const idx = E.cidade.findIndex(x => x.co === c.me); const pos = idx >= 0 ? idx + 1 : null
    fatos.enem = [pos, E.cidade.length, me.media_geral, k, nm, dif(k), best[k], (me as any)['media_' + k]]
    if (pos && pos > 1) out.push({ tipo: 'enem', forca: (100 * dif(k)) / best[k], titulo: `ENEM: ${pos}º entre ${E.cidade.length} particulares; ${nm} é a maior distância`,
      texto: `Na prova de ${nm}, a escola teve ${D((me as any)['media_' + k])} pontos e a melhor particular da cidade, ${D(best[k])}.`,
      modulo: 'Campanha de Matrículas', como: 'Usar a nota nos pontos fortes (por exemplo, redação) como argumento nos anúncios do ensino médio.' })
  }
  if (B.length) {
    const loc = ESC.filter(o => o.lat != null && o.lng != null && o.d != null && o.d <= 1000); const cont: Record<string, number> = {}
    for (const o of loc) { const bn = bairroDe(o.lng!, o.lat!, B); if (bn) cont[bn] = (cont[bn] || 0) + 1 }
    const topk = [...B].sort((a, b) => kids(b) - kids(a)).slice(0, 5); const sem = topk.filter(b => !cont[b.n])
    fatos.bairro_sem = sem.map(b => b.n)
    if (sem.length) {
      const tk = B.reduce((s, b) => s + kids(b), 0), ks = sem.reduce((s, b) => s + kids(b), 0)
      out.push({ tipo: 'bairro', forca: (100 * ks) / tk * 2, titulo: `Bairros com muitas crianças e sem escola particular: ${sem.map(b => b.n).join(', ')}`,
        texto: `Juntos, esses bairros têm ${F(ks)} crianças de 0 a 14 anos, ${D((100 * ks) / tk, 0)}% do total da cidade, e nenhuma escola particular marcada no mapa.`,
        modulo: 'Mapa da Escola', como: 'Ver onde moram seus alunos e leads e anunciar por geolocalização nesses bairros.' })
    }
  }
  const Es = R.estrutura
  if (Es?.escola && Es.cidade) {
    const me = Es.escola, ci = Es.cidade
    const integ = (me.qt_mat_inf_int || 0) + (me.qt_mat_fund_int || 0) + (me.qt_mat_med_int || 0) > 0
    fatos.integral = [integ, ci.integral, ci.escolas]
    if (!integ && ci.integral <= 3) out.push({ tipo: 'integral', forca: 12, titulo: 'Tempo integral: quase ninguém oferece', texto: `Só ${ci.integral} de ${ci.escolas} escolas particulares de ${cid} têm alunos em tempo integral.`,
      modulo: 'Campanha de Matrículas', como: 'Testar demanda com uma campanha antes de investir na estrutura.' })
  }
  out.sort((a, b) => b.forca - a.forca)
  const vistos = new Set<string>(); const final: Oportunidade[] = []
  for (const o of out) { if (vistos.has(o.tipo)) continue; vistos.add(o.tipo); final.push(o) }
  return { ops: final, fatos }
}
