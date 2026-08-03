import { supabase } from './supabase'

// ─── tipos ──────────────────────────────────────────────────────────────────
export interface CompetitorRow {
  rank: number
  co_entidade: string
  no_entidade: string
  qt_mat_total: number
  marketSharePct: number
  isSelected: boolean
}

export interface RaioXMetrics {
  co_entidade: string
  schoolName: string
  city: string
  state: string
  anoCenso: number

  qtMatTotal: number
  qtMatInf: number | null
  qtMatFund: number | null
  qtMatMed: number | null

  totalPrivateSchools: number
  totalPrivateStudents: number
  avgStudentsPerSchool: number
  marketSharePct: number

  ranking: number
  rankingTotal: number
  distanceToLeader: number
  distanceToTop5: number

  topCompetitors: CompetitorRow[]

  cityAvgInf: number
  cityAvgFund: number
  cityAvgMed: number

  marketScore: number
  scoreLabel: string
}

const PRIVATE_DEPENDENCIA = 4 // tp_dependencia: 1 Federal, 2 Estadual, 3 Municipal, 4 Privada

interface RawSchoolRow {
  co_entidade: string
  no_entidade: string | null
  tp_dependencia: number | null
  qt_mat_total: number | null
  qt_mat_inf: number | null
  qt_mat_fund: number | null
  qt_mat_med: number | null
  ano_censo: number
}

// ─── cálculo dos indicadores ────────────────────────────────────────────────
// Consulta reutilizável — roda no client porque inep_escolas tem RLS desabilitado.
export async function calculateRaioXMetrics(
  coEntidade: string,
  city: string,
  state: string
): Promise<RaioXMetrics | null> {
  const { data, error } = await supabase
    .from('inep_escolas')
    .select('co_entidade, no_entidade, tp_dependencia, qt_mat_total, qt_mat_inf, qt_mat_fund, qt_mat_med, ano_censo')
    .eq('no_municipio', city)
    .eq('sg_uf', state)

  if (error || !data || data.length === 0) return null

  const rows = data as RawSchoolRow[]
  const anoCenso = Math.max(...rows.map(r => r.ano_censo))
  const latest = rows.filter(r => r.ano_censo === anoCenso)

  const school = latest.find(r => r.co_entidade === coEntidade)
  if (!school) return null

  // universo de comparação: escolas privadas do município no ano mais recente
  let group = latest.filter(r => r.tp_dependencia === PRIVATE_DEPENDENCIA && (r.qt_mat_total ?? 0) > 0)
  if (!group.some(r => r.co_entidade === coEntidade)) group = [...group, school]

  const sorted = [...group].sort((a, b) => (b.qt_mat_total ?? 0) - (a.qt_mat_total ?? 0))
  const rankingTotal = sorted.length
  const ranking = sorted.findIndex(r => r.co_entidade === coEntidade) + 1

  const totalPrivateStudents = sorted.reduce((sum, r) => sum + (r.qt_mat_total ?? 0), 0)
  const avgStudentsPerSchool = rankingTotal > 0 ? totalPrivateStudents / rankingTotal : 0
  const qtMatTotal = school.qt_mat_total ?? 0
  const marketSharePct = totalPrivateStudents > 0 ? (qtMatTotal / totalPrivateStudents) * 100 : 0

  const leaderTotal = sorted[0]?.qt_mat_total ?? 0
  const distanceToLeader = Math.max(0, leaderTotal - qtMatTotal)
  const fifthTotal = sorted[4]?.qt_mat_total ?? null
  const distanceToTop5 = fifthTotal != null && ranking > 5 ? Math.max(0, fifthTotal - qtMatTotal) : 0

  const topCompetitors: CompetitorRow[] = sorted.slice(0, 10).map((r, i) => ({
    rank: i + 1,
    co_entidade: r.co_entidade,
    no_entidade: r.no_entidade ?? '—',
    qt_mat_total: r.qt_mat_total ?? 0,
    marketSharePct: totalPrivateStudents > 0 ? ((r.qt_mat_total ?? 0) / totalPrivateStudents) * 100 : 0,
    isSelected: r.co_entidade === coEntidade,
  }))
  if (!topCompetitors.some(c => c.isSelected)) {
    topCompetitors.push({
      rank: ranking,
      co_entidade: school.co_entidade,
      no_entidade: school.no_entidade ?? '—',
      qt_mat_total: qtMatTotal,
      marketSharePct,
      isSelected: true,
    })
  }

  const cityAvgInf  = rankingTotal > 0 ? sorted.reduce((s, r) => s + (r.qt_mat_inf ?? 0), 0) / rankingTotal : 0
  const cityAvgFund = rankingTotal > 0 ? sorted.reduce((s, r) => s + (r.qt_mat_fund ?? 0), 0) / rankingTotal : 0
  const cityAvgMed  = rankingTotal > 0 ? sorted.reduce((s, r) => s + (r.qt_mat_med ?? 0), 0) / rankingTotal : 0

  // score de mercado (0-100, regra simples e transparente — não é IA):
  // 60 pts pela posição relativa no ranking + até 40 pts pelo market share (cap em 20% de share)
  const rankingScore = rankingTotal > 1 ? 60 * (1 - (ranking - 1) / (rankingTotal - 1)) : 60
  const shareScore = Math.min(40, marketSharePct * 2)
  const marketScore = Math.round(Math.max(0, Math.min(100, rankingScore + shareScore)))
  const scoreLabel =
    marketScore >= 70 ? 'Posição de destaque' :
    marketScore >= 40 ? 'Posição consolidada' :
    'Espaço para crescimento'

  return {
    co_entidade: coEntidade,
    schoolName: school.no_entidade ?? '—',
    city,
    state,
    anoCenso,
    qtMatTotal,
    qtMatInf: school.qt_mat_inf,
    qtMatFund: school.qt_mat_fund,
    qtMatMed: school.qt_mat_med,
    totalPrivateSchools: rankingTotal,
    totalPrivateStudents,
    avgStudentsPerSchool,
    marketSharePct,
    ranking,
    rankingTotal,
    distanceToLeader,
    distanceToTop5,
    topCompetitors,
    cityAvgInf,
    cityAvgFund,
    cityAvgMed,
    marketScore,
    scoreLabel,
  }
}

// ─── interpretação textual automática (regras simples, não IA) ─────────────
export function buildInterpretation(m: RaioXMetrics): string[] {
  const paragraphs: string[] = []

  if (m.ranking <= 5) {
    paragraphs.push(
      `${m.schoolName} está entre as maiores escolas privadas de ${m.city}/${m.state}, ocupando a ${m.ranking}ª posição em número de matrículas entre ${m.rankingTotal} escolas privadas do município.`
    )
  } else {
    paragraphs.push(
      `${m.schoolName} ocupa a ${m.ranking}ª posição entre ${m.rankingTotal} escolas privadas de ${m.city}/${m.state}. Há espaço para crescimento: faltam ${Math.round(m.distanceToTop5).toLocaleString('pt-BR')} matrículas para alcançar o 5º colocado do município.`
    )
  }

  if (m.marketSharePct >= 15) {
    paragraphs.push(`Com ${m.marketSharePct.toFixed(1)}% de participação no mercado privado local, a escola tem penetração relevante frente à concorrência.`)
  } else if (m.marketSharePct >= 5) {
    paragraphs.push(`A participação de mercado atual (${m.marketSharePct.toFixed(1)}%) é sólida, mas ainda há potencial de expansão frente às ${m.totalPrivateSchools} escolas privadas do município.`)
  } else {
    paragraphs.push(`A participação de mercado atual (${m.marketSharePct.toFixed(1)}%) indica potencial significativo de crescimento em um mercado com ${m.totalPrivateSchools} escolas privadas concorrentes.`)
  }

  const stageNote = (label: string, schoolVal: number | null, cityAvg: number) => {
    if (schoolVal == null) return null
    if (schoolVal > cityAvg * 1.1) return `${label} acima da média do município (${Math.round(schoolVal)} vs. média de ${Math.round(cityAvg)}).`
    if (schoolVal < cityAvg * 0.9) return `${label} abaixo da média do município (${Math.round(schoolVal)} vs. média de ${Math.round(cityAvg)}) — oportunidade de captação nessa etapa.`
    return `${label} na média do município (${Math.round(schoolVal)} vs. média de ${Math.round(cityAvg)}).`
  }
  ;[
    stageNote('Educação Infantil', m.qtMatInf, m.cityAvgInf),
    stageNote('Ensino Fundamental', m.qtMatFund, m.cityAvgFund),
    stageNote('Ensino Médio', m.qtMatMed, m.cityAvgMed),
  ].forEach(note => { if (note) paragraphs.push(note) })

  return paragraphs
}
