import { supabase } from '../supabase'
import { limpaTexto, nome, type RaioXRel, type Bairro, type EscolaMapa, type RaioXCtx } from './data'

// ─── busca no banco ──────────────────────────────────────────────────────────
export async function fetchRaioX(co: string): Promise<RaioXCtx | null> {
  const { data: R, error } = await supabase.rpc('raiox_relatorio', { p_co: String(co) })
  if (error || !R || !(R as RaioXRel).escola) return null
  const rel = R as RaioXRel
  const mun = rel.escola.co_municipio
  const [rb, re, rl] = await Promise.all([
    supabase.rpc('raiox_bairros', { p_mun: mun }),
    supabase.rpc('raiox_escolas_mapa', { p_mun: mun, p_ano: rel.posicao.ano }),
    supabase.rpc('raiox_lideres', { p_co: String(co) }),
  ])
  if (!rel.lideres) rel.lideres = ((rl.data as RaioXRel['lideres']) ?? { inf: [], fund: [], med: [] })
  const B: Bairro[] = ((rb.data as any[]) ?? []).filter(b => b.geom?.coordinates).map(b => ({
    n: limpaTexto(b.nome), a: b.p0_4 ?? 0, b: b.p5_9 ?? 0, c: b.p10_14 ?? 0, d: b.p15_19 ?? 0, r: b.renda_media ?? null, m: b.renda_mediana ?? null, p: b.pop ?? 0, g: b.geom.coordinates,
  }))
  const ESC: EscolaMapa[] = ((re.data as EscolaMapa[]) ?? []).map(e => ({ ...e }))
  return { R: rel, B, ESC, me: rel.escola.co, nome: nome(rel.escola.nome), cid: limpaTexto(rel.escola.municipio), uf: limpaTexto(rel.escola.uf), ano: rel.posicao.ano }
}

