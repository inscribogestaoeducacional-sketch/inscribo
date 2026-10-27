// ─── formatação (pt-BR) ──────────────────────────────────────────────────────
export const F = (n: number | null | undefined): string => (n == null || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString('pt-BR'))
export const D = (x: number | null | undefined, d = 1): string => (x == null || Number.isNaN(x) ? '—' : x.toFixed(d).replace('.', ','))
export const sgn = (x: number, d = 1): string => (x >= 0 ? '+' : '−') + D(Math.abs(x), d)

const ACC: Record<string, string> = {
  Colegio: 'Colégio', Agape: 'Ágape', Dionisio: 'Dionísio', Queiros: 'Queirós', Educacao: 'Educação', Esc: 'Escola', Inst: 'Instituto', Educ: 'Educacional',
  Joao: 'João', Sao: 'São', Cesar: 'César', Jose: 'José', Fund: 'Fundamental',
}
// remove caracteres de controle e invisíveis (causavam quadradinhos no PDF)
function semLixo(s: string): string {
  return Array.from(s).map(ch => {
    const c = ch.codePointAt(0) as number
    const ruim = c < 32 || (c >= 127 && c <= 159) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202f) || c === 0xfeff || c === 0xfffd
    return ruim ? ' ' : ch
  }).join('')
}
export function limpaTexto(s: string | null | undefined): string { return semLixo(s ?? '').replace(/\s+/g, ' ').trim() }
// "COLEGIO CRISTO REI LTDA" -> "Colégio Cristo Rei"
export function nome(s: string | null | undefined): string {
  const limpo = limpaTexto(s).replace(/\b(LTDA|EIRELI|ME|EPP|S\/?A)\b\.?/gi, '').replace(/\s+/g, ' ').trim()
  return limpo.split(' ').filter(Boolean).map((w, i) => {
    let t = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    if (i && ['de', 'do', 'da', 'dos', 'das', 'e'].includes(t.toLowerCase())) t = t.toLowerCase()
    return ACC[t] ?? t
  }).join(' ')
}
export function curto(s: string | null | undefined, n = 40): string {
  const t = nome(s); return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…'
}

// ─── tipos do relatório (saída de raiox_relatorio e afins) ───────────────────
export interface Seg { seg: 'inf' | 'fund' | 'med'; minha: number; alunos: number; ativas: number; ranking: number | null }
export interface Etapas { af?: number | null; ai?: number | null; cre?: number | null; inf?: number | null; med?: number | null; pre?: number | null; fund?: number | null; total: number; escolas?: number }
export interface SerieAno { ano: number; cidade: Etapas & { escolas: number }; escola: Etapas | null }
export interface EnemCidade { n: number; co: string; nome: string; ch: number; cn: number; lc: number; mt: number; red: number; geral: number }
export interface RaioXRel {
  escola: { co: string; uf: string; nome: string; municipio: string; co_municipio: string; lat: number | null; lng: number | null }
  posicao: { ano: number; lider: { co: string; mat: number; nome: string }; minha: number; ranking: number; segmentos: Seg[]; total_alunos: number; total_escolas: number }
  serie: SerieAno[]
  estrutura: null | { ano: number; escola: Record<string, number> | null; cidade: { parque: number; quadra: number; escolas: number; integral: number; lab_info: number; biblioteca: number; lab_ciencias: number; prof_por_100_alunos: number } }
  nascimentos: { ano: number; nascidos: number }[] | null
  pop_municipio: Record<string, number> | null
  renda_municipio: { ano: number; renda_media: number } | null
  concorrentes: { co: string; nome: string; rank_cidade: number; total: number; inf: number; fund: number; med: number; estrutura?: Record<string, number> | null; serie: { ano: number; total: number }[] }[]
  enem: null | { ano: number; escola: { n_part: number; media_ch: number; media_cn: number; media_lc: number; media_mt: number; media_red: number; media_geral: number } | null; cidade: EnemCidade[]; uf_privadas: { mt: number; red: number; geral: number; escolas: number } }
  lideres: Record<'inf' | 'fund' | 'med', { co: string; nome: string; mat: number }[]>
}
export interface Bairro { n: string; a: number; b: number; c: number; d: number; r: number | null; m: number | null; p: number; g: number[][][][] }
export interface EscolaMapa { c: string; n: string; t: number; d: number | null; lat: number | null; lng: number | null; bairro_ibge?: string | null }
export interface AtendCtx { pontuacao: number; faixa: 'forte' | 'falhas' | 'perdendo'; respostas: Record<string, string> }
export interface RaioXCtx { R: RaioXRel; B: Bairro[]; ESC: EscolaMapa[]; me: string; nome: string; cid: string; uf: string; ano: number; atend?: AtendCtx | null; textoIA?: string | null }

// ─── geografia ───────────────────────────────────────────────────────────────
function pip(x: number, y: number, rings: number[][][]): boolean {
  let ins = false
  for (const ring of rings) {
    let j = ring.length - 1
    for (let i = 0; i < ring.length; i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) ins = !ins
      j = i
    }
  }
  return ins
}
export function bairroDe(lng: number, lat: number, bairros: Bairro[]): string | null {
  for (const b of bairros) for (const poly of b.g) if (pip(lng, lat, poly)) return b.n
  return null
}
const SM = 1212 // salário mínimo 2022
export function faixaRenda(r: number | null | undefined): 0 | 1 | 2 | 3 | null {
  if (r == null) return null
  const s = r / SM
  return s <= 2 ? 0 : s <= 5 ? 1 : s <= 10 ? 2 : 3
}
export const CORES_RENDA = ['#D7F0E8', '#8ED6C2', '#2FAE94', '#00523C']
export const NOMES_RENDA = ['até 2 salários mín.', '2 a 5', '5 a 10', 'mais de 10']
export const kids = (b: Bairro) => (b.a || 0) + (b.b || 0) + (b.c || 0)
