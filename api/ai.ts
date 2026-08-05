import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
// ─── Distribuição mensal real de rematrículas (returning_students_by_month) ──
function calcRealReenrollDistribution(
  historicalData: { returning_students_by_month?: Record<string, number> | null }[]
): Record<number, number> | null {
  const monthSums: Record<number, number> = {}
  const yearCount: Record<number, number> = {}
  // Usar apenas o ano mais recente para distribuição mais precisa
  const sortedData = [...historicalData].sort((a, b) => (b as any).year - (a as any).year)
  const recentData = sortedData.slice(0, 2) // últimos 2 anos
  for (const entry of recentData) {
    const byMonth = entry.returning_students_by_month
    if (!byMonth || typeof byMonth !== 'object') continue
    const total = Object.values(byMonth).reduce((s, v) => s + Number(v), 0)
    if (total === 0) continue
    for (const [key, count] of Object.entries(byMonth)) {
      const monthNum = key.includes('-') ? parseInt(key.split('-')[1]) : parseInt(key)
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) continue
      const pct = Number(count) / total
      monthSums[monthNum] = (monthSums[monthNum] ?? 0) + pct
      yearCount[monthNum] = (yearCount[monthNum] ?? 0) + 1
    }
  }
  if (Object.keys(monthSums).length === 0) return null
  const raw: Record<number, number> = {}
  for (const [m, sum] of Object.entries(monthSums)) {
    raw[Number(m)] = sum / yearCount[Number(m)]
  }
  const totalSum = Object.values(raw).reduce((s, v) => s + v, 0)
  if (totalSum === 0) return null
  const result: Record<number, number> = {}
  for (const [m, v] of Object.entries(raw)) result[Number(m)] = v / totalSum
  return result
}
// ── Extração robusta do texto da resposta da Anthropic ───────────────────────
// Não confia em content[0] ser o bloco de texto — procura o primeiro bloco
// com type === 'text' explicitamente. Lança erro claro se nenhum existir, em
// vez de deixar `undefined` se propagar e quebrar mais adiante sem contexto.
function extractClaudeText(data: { content?: Array<{ type: string; text?: string }> }): string {
  const block = data.content?.find(b => b.type === 'text' && typeof b.text === 'string')
  if (!block?.text) throw new Error('Resposta da Anthropic sem conteúdo de texto')
  return block.text
}

// ── Extração tolerante de JSON de uma resposta em texto livre ────────────────
// 1. Remove cercas de markdown (```json ... ```) se existirem.
// 2. Extrai do primeiro `{` até a chave de FECHAMENTO CORRESPONDENTE (chaves
//    balanceadas, ignorando chaves dentro de strings) — não até a última `}`
//    da resposta inteira, que quebra se o modelo escrever qualquer texto
//    (nota, explicação) depois do JSON.
function extractJsonObject(raw: string): string {
  const cleaned = raw.replace(/```json\s*|```/g, '').trim()
  const start = cleaned.indexOf('{')
  if (start === -1) return cleaned
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return cleaned.slice(start, i + 1)
    }
  }
  return cleaned.slice(start) // sem fechamento balanceado — deixa o JSON.parse acusar o erro real
}

async function callClaude(prompt: string, maxTokens = 1024): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${err}`)
  }
  const data = await response.json() as { content: Array<{ type: string; text?: string }> }
  return extractClaudeText(data)
}

async function callClaudeWithDocument(pdfBase64: string, textPrompt: string, maxTokens = 2000): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: textPrompt }
        ]
      }]
    })
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${err}`)
  }
  const data = await response.json() as { content: Array<{ type: string; text?: string }> }
  return extractClaudeText(data)
}

// ─── Helper: sazonalidade real a partir do historical_funnel ─────────────────
function calcRealSeasonality(
  historicalData: { historical_funnel?: Record<string, number> | null }[]
): Record<number, number> | null {
  const monthSums: Record<number, number> = {}
  const yearCount: Record<number, number> = {}
  for (const entry of historicalData) {
    const funnel = entry.historical_funnel
    if (!funnel || typeof funnel !== 'object') continue
    const total = Object.values(funnel).reduce((s, v) => s + Number(v), 0)
    if (total === 0) continue
    for (const [key, count] of Object.entries(funnel)) {
      const monthNum = key.includes('-')
        ? new Date(key + '-01T12:00:00').getMonth() + 1
        : Number(key)
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) continue
      const pct = (Number(count) / total) * 100
      monthSums[monthNum] = (monthSums[monthNum] ?? 0) + pct
      yearCount[monthNum] = (yearCount[monthNum] ?? 0) + 1
    }
  }
  if (Object.keys(monthSums).length === 0) return null
  const result: Record<number, number> = {}
  for (const [m, sum] of Object.entries(monthSums)) {
    result[Number(m)] = +(sum / yearCount[Number(m)]).toFixed(1)
  }
  return result
}

// ─── Helper: gerar lista de meses da campanha ────────────────────────────────
function getCampaignMonths(startDate: string, endDate: string) {
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const months: { label: string; month: number; year: number; period: string }[] = []
  const start = new Date(startDate + 'T12:00:00')
  const end   = new Date(endDate   + 'T12:00:00')
  const cur   = new Date(start)
  while (cur <= end && months.length < 24) {
    months.push({
      label:  `${names[cur.getMonth()]}/${cur.getFullYear()}`,
      month:  cur.getMonth() + 1,
      year:   cur.getFullYear(),
      period: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
    })
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  const { action, payload } = req.body as { action: string; payload: Record<string, unknown> }
  if (!action || !payload) return res.status(400).json({ error: 'action e payload são obrigatórios' })

  try {

    // ── INSIGHT SEMANAL ───────────────────────────────────────────────────────
    if (action === 'weekly_insight') {
      const { funnel, previousFunnel, reenrollments, campaignWeek } = payload as {
        funnel: { registrations: number; registrations_target: number; schedules: number; schedules_target: number; visits: number; visits_target: number; enrollments: number; enrollments_target: number }
        previousFunnel: typeof funnel | null
        reenrollments: { re_enrolled: number; total_base: number; target_percentage: number } | null
        campaignWeek: string
      }
      const devReg = funnel.registrations_target > 0 ? Math.round((funnel.registrations / funnel.registrations_target * 100) - 100) : 0
      const devSch = funnel.schedules_target > 0 ? Math.round((funnel.schedules / funnel.schedules_target * 100) - 100) : 0
      const devVis = funnel.visits_target > 0 ? Math.round((funnel.visits / funnel.visits_target * 100) - 100) : 0
      const devEnr = funnel.enrollments_target > 0 ? Math.round((funnel.enrollments / funnel.enrollments_target * 100) - 100) : 0
      const prompt = `Você é um consultor especialista em campanhas de matrículas de escolas privadas brasileiras.

Analise os dados abaixo da semana ${campaignWeek} e gere UM parágrafo de análise em português brasileiro, direto e objetivo, com:
1. O principal gargalo identificado (fase com maior desvio negativo)
2. Comparação com a semana anterior (se disponível)
3. Uma ação concreta e específica para o gestor fazer AGORA

Dados atuais:
- Cadastros: ${funnel.registrations} (meta: ${funnel.registrations_target}, desvio: ${devReg > 0 ? '+' : ''}${devReg}%)
- Agendas: ${funnel.schedules} (meta: ${funnel.schedules_target}, desvio: ${devSch > 0 ? '+' : ''}${devSch}%)
- Visitas: ${funnel.visits} (meta: ${funnel.visits_target}, desvio: ${devVis > 0 ? '+' : ''}${devVis}%)
- Matrículas: ${funnel.enrollments} (meta: ${funnel.enrollments_target}, desvio: ${devEnr > 0 ? '+' : ''}${devEnr}%)
${previousFunnel ? `\nSemana anterior: Cadastros ${previousFunnel.registrations} | Agendas ${previousFunnel.schedules} | Visitas ${previousFunnel.visits} | Matrículas ${previousFunnel.enrollments}` : ''}
${reenrollments ? `Rematrículas: ${reenrollments.re_enrolled} de ${reenrollments.total_base} (${Math.round(reenrollments.re_enrolled / reenrollments.total_base * 100)}%, meta: ${reenrollments.target_percentage}%)` : ''}

Máximo 4 linhas. Sem subtítulos. Sem markdown. Seja objetivo e prático.`
      const result = await callClaude(prompt, 350)
      return res.json({ result })
    }

    // ── EXTRAÇÃO DE ARQUIVO ERP (SIGA/PDF CORRIGIDO) ─────────────────────────
    if (action === 'extract_file') {
      const { fileContent, fileType, fileName, isPdfImage } = payload as {
        fileContent: string; fileType: 'csv' | 'xlsx' | 'pdf'; fileName: string; isPdfImage?: boolean
      }
      console.log('[extract_file] modo:', isPdfImage ? 'PDF visão' : 'texto')
      let raw: string

      if (isPdfImage) {
        // ── PDF SIGA: Relatório de Matrículas Efetivadas ──────────────────────
        const visionPrompt = `Você está analisando um "RELATÓRIO DE MATRÍCULAS EFETIVADAS" do sistema SIGA (Activesoft) de uma escola brasileira.

O relatório tem colunas: Data de matrícula | Novatos (Qtd, %) | Veteranos (Qtd, %) | Total (Qtd, %)
A última linha "Total de alunos" contém os totais globais do relatório.

━━━ DEFINIÇÕES CRÍTICAS ━━━
- "Novatos" = alunos NOVOS que entraram pela primeira vez → new_students
- "Veteranos" = alunos que JÁ ESTUDAVAM e renovaram matrícula → returning_students E reenrollments
- IMPORTANTE: o campo "reenrollments" deve ser EXATAMENTE igual a "returning_students" (veteranos)
- "transfers" = null (este relatório não tem dados de transferências)

━━━ REGRA DE ANO LETIVO ━━━
- Matrículas de set/YYYY até mar/YYYY+1 → pertencem ao ano letivo YYYY+1
- Exemplo: matrículas de set/2025 a mar/2026 → detected_year = 2026

━━━ HISTÓRICO MENSAL ━━━
Some todas as matrículas por mês no formato YYYY-MM:
- historical_funnel: soma de Novatos + Veteranos por mês
- new_students_by_month: soma só de Novatos por mês
- returning_students_by_month: soma só de Veteranos por mês

Retorne APENAS JSON válido sem markdown, sem texto adicional:
{
  "detected_year": <ano letivo inteiro ex: 2026>,
  "period_start": "<YYYY-MM mais antigo>",
  "period_end": "<YYYY-MM mais recente>",
  "total_students": <linha Total de alunos — coluna Total Qtd>,
  "new_students": <linha Total de alunos — coluna Novatos Qtd>,
  "returning_students": <linha Total de alunos — coluna Veteranos Qtd>,
  "new_students_pct": <% novatos ex: 12.1>,
  "returning_students_pct": <% veteranos ex: 87.9>,
  "avg_monthly_fee": null,
  "reenrollments": <IGUAL a returning_students — veteranos São rematrículas>,
  "transfers": null,
  "historical_funnel": { "YYYY-MM": <novatos+veteranos do mês> },
  "new_students_by_month": { "YYYY-MM": <só novatos do mês> },
  "returning_students_by_month": { "YYYY-MM": <só veteranos do mês> },
  "summary": "<ex: 2026: 956 alunos — 116 novatos (12.1%) + 840 veteranos/rematrículas (87.9%)>"
}`
        raw = await callClaudeWithDocument(fileContent, visionPrompt, 2000)
      } else {
        const prompt = `Você está analisando um arquivo exportado de um sistema ERP de escola privada brasileira.
Arquivo: ${fileName} | Tipo: ${fileType}

INSTRUÇÕES:
1. detected_year = ANO LETIVO dos alunos (matrículas set/YYYY–mar/YYYY+1 → detected_year = YYYY+1)
2. Se o arquivo tiver colunas "Novatos" e "Veteranos": returning_students = Veteranos = reenrollments
3. Extraia historical_funnel: { "YYYY-MM": total_matriculas_mes }
4. Retorne null nos campos não encontrados.

Retorne SOMENTE JSON válido:
{
  "file_type_detected": "enrollments|active_students|historical|unknown",
  "confidence": 0.0,
  "detected_year": null,
  "period_start": null,
  "period_end": null,
  "total_students": null,
  "new_students": null,
  "returning_students": null,
  "new_students_pct": null,
  "returning_students_pct": null,
  "avg_monthly_fee": null,
  "reenrollments": null,
  "transfers": null,
  "historical_funnel": {},
  "new_students_by_month": {},
  "returning_students_by_month": {},
  "summary": { "total_records": 0, "date_range": "", "notes": "" }
}

Conteúdo:
${fileContent.slice(0, 8000)}`
        raw = await callClaude(prompt, 4000)
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(extractJsonObject(raw))
      } catch {
        console.error('[extract_file] falha ao parsear resposta da IA. Raw completo:', raw)
        return res.status(422).json({ error: 'Não foi possível extrair dados estruturados do arquivo', raw })
      }

      // ── Pós-processamento: garantir que reenrollments = returning_students ──
      const p = parsed as Record<string, unknown>
      if (p.returning_students && !p.reenrollments) {
        p.reenrollments = p.returning_students
      }

      console.log('[extract_file] resultado:', JSON.stringify(parsed).slice(0, 400))
      return res.json({ result: parsed })
    }

    // ── DIAGNÓSTICO DE TRANSFERÊNCIA ──────────────────────────────────────────
    if (action === 'transfer_diagnosis') {
      const { responses, studentName, grade } = payload as { responses: Record<string, unknown>; studentName: string; grade: string }
      const prompt = `Você é especialista em retenção de alunos em escolas privadas brasileiras.
Analise as respostas da pesquisa de saída e retorne APENAS JSON válido, sem markdown.
Aluno: ${studentName} | Série: ${grade}
Respostas: ${JSON.stringify(responses)}
{
  "primary_reason": "financial|pedagogical|distance|competition|relocation|other",
  "confidence": <0-100>,
  "diagnosis": "<análise em 2-3 frases>",
  "risk_factors": ["<fator 1>", "<fator 2>"],
  "retention_opportunity": true,
  "retention_note": "<o que poderia ter sido feito>"
}`
      const raw = await callClaude(prompt, 600)
      let parsed
      try {
        parsed = JSON.parse(extractJsonObject(raw))
      } catch {
        parsed = { primary_reason: 'other', confidence: 30, diagnosis: raw.substring(0, 400), risk_factors: [], retention_opportunity: false, retention_note: 'Análise manual necessária' }
      }
      return res.json({ result: parsed })
    }

    // ── DADOS DE MERCADO ──────────────────────────────────────────────────────
    if (action === 'fetch_ibge') {
      const { city, state } = payload as { city: string; state: string }
      const fallback = {
        city, state, school_age_population: 15000, private_school_rate: 18,
        sector_growth: 3, avg_students_per_school: 500, confidence: 'estimado',
        notes: `Dados estimados para ${city}`,
        inep_data: {
          school_classification: 'médio',
          main_competitors: ['Escolas públicas municipais', 'Redes privadas regionais', 'Escolas confessionais'],
          market_opportunity: 'Crescimento da classe média local com demanda por ensino privado de qualidade.',
          risk_factors: 'Expansão de redes nacionais com mensalidades competitivas na região.',
        }
      }
      const prompt = `Você é especialista em dados educacionais brasileiros (IBGE, Censo Escolar MEC).
Para ${city}, ${state}, retorne SOMENTE JSON válido. Se não tiver dados precisos, estime com base no porte do município.
{
  "city": "${city}", "state": "${state}",
  "school_age_population": <estimativa população 4-17 anos>,
  "total_population": <estimativa total>,
  "private_school_students": <estimativa alunos rede privada>,
  "private_school_rate": <% alunos em escola privada>,
  "sector_growth_rate": <% crescimento anual setor privado>,
  "total_private_schools": <número de escolas privadas>,
  "average_students_per_school": <média de alunos por escola privada>,
  "ibge_year": 2022,
  "data_source": "IBGE Censo 2022 / Censo Escolar MEC 2023",
  "confidence": "high|medium|estimado",
  "notes": "<observação breve>",
  "inep_data": {
    "school_classification": "<pequeno|médio|grande>",
    "main_competitors": ["<tipo 1>", "<tipo 2>", "<tipo 3>"],
    "market_opportunity": "<oportunidade em 1 frase>",
    "risk_factors": "<risco em 1 frase>"
  }
}`
      let parsed = fallback
      try {
        const result = await callClaude(prompt, 700)
        parsed = JSON.parse(extractJsonObject(result))
      } catch { }
      return res.json({ result: parsed })
    }

    // ── GERADOR DE CAMPANHA ───────────────────────────────────────────────────
    if (action === 'generate_campaign') {
      const {
        schoolData, historicalData, marketData, growthTarget,
        campaignYear, executionYear, start_date, end_date,
        current_date, campaign_start_month, months_until_campaign, total_exits
      } = payload as {
        schoolData: { name: string; city: string; state: string; grades: string[]; avg_monthly_fee: number; current_students: number }
        historicalData: {
          year: number; total_students: number; new_enrollments: number
          reenrollments: number; transfers: number
          historical_funnel?: Record<string, number> | null
          returning_students?: number
          returning_students_by_month?: Record<string, number> | null
        }[]
        marketData: { school_age_population?: number; private_school_rate?: number; sector_growth_rate?: number }
        growthTarget: { type: 'percentage' | 'absolute' | 'students'; value: number }
        campaignYear: number; executionYear?: number
        start_date?: string; end_date?: string; current_date?: string
        campaign_start_month?: string; months_until_campaign?: number; total_exits?: number
      }

      const execYear = executionYear ?? (campaignYear - 1)
      const sd = start_date || `${execYear}-08-01`
      const ed = end_date   || `${execYear + 1}-02-28`

      const campaignMonths = getCampaignMonths(sd, ed)
      const totalMonths = campaignMonths.length
      const monthsStr = campaignMonths.map(m => m.label).join(', ')

      const realSeasonality = calcRealSeasonality(historicalData || [])
      const benchmarkSeas: Record<number, number> = { 1: 5, 2: 4, 8: 8, 9: 12, 10: 28, 11: 23, 12: 20 }
      const rawPcts = campaignMonths.map(m => ({ ...m, pct: realSeasonality?.[m.month] ?? benchmarkSeas[m.month] ?? 5 }))
      const totalPct = rawPcts.reduce((s, m) => s + m.pct, 0)
      const normalizedSeas = rawPcts.map(m => ({
        ...m,
        pct: totalPct > 0 ? +(m.pct / totalPct * 100).toFixed(1) : +(100 / totalMonths).toFixed(1)
      }))

      const hasHistory = historicalData && historicalData.length > 0

      // ── Taxa histórica de rematrícula (Veteranos / Total do ano anterior) ──
      // Para o SIGA: returning_students = veteranos = rematrículas reais
      const avgReenrollRate = hasHistory
        ? historicalData.reduce((s, d) => {
            // Usa returning_students se disponível (do SIGA), senão usa reenrollments
            const reEnroll = (d.returning_students ?? d.reenrollments) || 0
            const eligible = d.total_students > 0 ? d.total_students - (d.new_enrollments || 0) : 0
            // Taxa = veteranos / (total do ano - novatos) = veteranos / base elegível do ano anterior
            // Mas mais simples: taxa = veteranos / total
            const rate = d.total_students > 0 ? reEnroll / d.total_students : 0
            return s + Math.min(rate, 1)
          }, 0) / historicalData.length
        : 0.85

      // ── Histórico detalhado para análise ──
      const histSummary = hasHistory
        ? historicalData.map(d => {
            const reEnroll = (d.returning_students ?? d.reenrollments) || 0
            const retention = d.total_students > 0 ? ((reEnroll / d.total_students) * 100).toFixed(1) : '—'
            return `${d.year}: ${d.total_students} alunos | ${d.new_enrollments} novatos | ${reEnroll} veteranos/rematrículas | retenção ${retention}%`
          }).join('\n')
        : 'Sem histórico — usar benchmarks do setor'

      const currentStudents = schoolData.current_students || 0
      const exits = total_exits || 0
      const eligibleForReenroll = Math.max(0, currentStudents - exits)
      const reenrollTarget = Math.round(eligibleForReenroll * avgReenrollRate)

      // Meta de novatos baseada no objetivo
      let targetNewStudents: number
      if (growthTarget.type === 'percentage') {
        targetNewStudents = exits + Math.round(currentStudents * (growthTarget.value / 100))
      } else if (growthTarget.type === 'absolute') {
        targetNewStudents = Math.max(exits, Math.round(growthTarget.value))
      } else {
        targetNewStudents = Math.max(0, growthTarget.value - reenrollTarget)
      }

      // Distribuição mensal rematrícula (acumulada progressiva)
      const realReenrollDist = calcRealReenrollDistribution(historicalData || [])
const reenrollMonthlyDist: Record<number, number> = realReenrollDist
  ?? { 8: 0, 9: 0.05, 10: 0.25, 11: 0.30, 12: 0.20, 1: 0.15, 2: 0.05 }
console.log('[generate_campaign] distribuição:', realReenrollDist ? 'REAL da escola' : 'padrão Brasil')

      const conv = { regToSch: 0.76, schToVis: 0.63, visToEnr: 0.40 }

      const monthlyContext = normalizedSeas.map(m => {
        const newEnr = Math.round(targetNewStudents * (m.pct / 100))
        const reEnr  = Math.round(reenrollTarget * (reenrollMonthlyDist[m.month] ?? 0.03))
        const vis    = newEnr > 0 ? Math.round(newEnr / conv.visToEnr) : 0
        const sch    = vis > 0 ? Math.round(vis / conv.schToVis) : 0
        const reg    = sch > 0 ? Math.round(sch / conv.regToSch) : 0
        return `${m.label}: sazon ${m.pct}% | novatos ${newEnr} | remat ${reEnr} | total ${newEnr + reEnr} | cadastros ~${reg}`
      }).join('\n')

      const hasPrecampaign = months_until_campaign && months_until_campaign > 0

      const prompt = `Você é especialista em campanhas de matrículas de escolas privadas brasileiras com 15 anos de experiência.

━━━ CONTEXTO ━━━
Escola: ${schoolData.name} — ${schoolData.city}/${schoolData.state}
Séries: ${schoolData.grades?.join(', ')}
Mensalidade média: R$ ${schoolData.avg_monthly_fee}
Alunos atuais: ${currentStudents} | Formandos: ${exits} | Elegíveis rematrícula: ${eligibleForReenroll}
Período: ${sd} → ${ed} | Meses: ${monthsStr} (${totalMonths} meses)
Ano letivo alvo: ${campaignYear}

━━━ OBJETIVO DO GESTOR (analise criticamente) ━━━
${growthTarget.type === 'percentage' ? `Crescer ~${growthTarget.value}% no volume de alunos` : ''}
${growthTarget.type === 'absolute' ? `Adicionar ~${growthTarget.value} alunos novos` : ''}
${growthTarget.type === 'students' ? `Atingir ~${growthTarget.value} alunos total` : ''}

━━━ HISTÓRICO REAL DA ESCOLA ━━━
${histSummary}

━━━ ANÁLISE DE RETENÇÃO ━━━
Taxa histórica média de retenção (veteranos/total): ${(avgReenrollRate * 100).toFixed(1)}%
Esta taxa é baseada nos dados REAIS do SIGA — Veteranos são os alunos que renovaram matrícula.
Meta de rematrícula calculada: ${reenrollTarget} alunos (${(avgReenrollRate * 100).toFixed(1)}% × ${eligibleForReenroll} elegíveis)
Meta de novatos calculada: ${targetNewStudents}
Sazonalidade: ${realSeasonality ? 'REAL da escola (histórico mensal SIGA)' : 'Benchmark setor'}

Distribuição mensal estimada:
${monthlyContext}

━━━ MERCADO ━━━
Pop. escolar: ${marketData.school_age_population?.toLocaleString('pt-BR') ?? 'N/D'}
Rede privada: ${marketData.private_school_rate ?? 18}% | Crescimento: ${marketData.sector_growth_rate ?? 3}%/ano

━━━ REGRAS OBRIGATÓRIAS ━━━
1. enrollments_returning em Set/Out/Nov/Dez/Jan DEVE ser > 0
   Distribua ${reenrollTarget} rematrículas conforme distribuição ${realReenrollDist ? 'REAL da escola' : 'padrão Brasil'}: ${Object.entries(reenrollMonthlyDist).map(([m,p]) => `Mês ${m}: ${(Number(p)*100).toFixed(1)}%`).join(' | ')}
2. enrollments_new = novatos do mês pela sazonalidade calculada
3. enrollments = enrollments_new + enrollments_returning
4. registrations = ceil(schedules/0.76) | schedules = ceil(visits/0.63) | visits = ceil(enrollments_new/0.40)
5. investment_suggested: CPA R$100-250 × enrollments_new
6. Gere EXATAMENTE ${totalMonths} meses em ordem: ${monthsStr}
7. No reasoning: analise CRITICAMENTE a tendência histórica (escola perdeu alunos de 2023→2026?) e comente se o objetivo é realista

Retorne SOMENTE JSON válido:
{
  "summary": {
    "total_new_students_target": ${targetNewStudents},
    "reenrollment_target": ${reenrollTarget},
    "reenrollment_rate_target": ${avgReenrollRate.toFixed(3)},
    "total_students_end": <reenrollTarget + targetNewStudents>,
    "growth_rate": <% vs alunos atuais>,
    "realism_score": "conservative|realistic|aggressive",
    "reasoning": "<5-6 frases: analise a TENDÊNCIA histórica (crescimento ou queda?), a taxa de retenção real, se o objetivo é realista, o maior risco e o que precisa melhorar>"
  },
  ${hasPrecampaign ? `"pre_campaign": {
    "period": "preparação antes de ${campaign_start_month}",
    "months_count": ${months_until_campaign},
    "focus_areas": ["rematrículas", "captação orgânica", "treinamento do time"],
    "key_actions": ["ação 1", "ação 2", "ação 3"],
    "reenrollment_projection": { "target": ${reenrollTarget}, "current_rate": ${avgReenrollRate.toFixed(2)}, "actions_needed": "o que fazer" }
  },` : ''}
  "monthly_targets": [
    {
      "month": "Set", "year": ${execYear},
      "registrations": 0, "schedules": 0, "visits": 0,
      "enrollments_new": 0, "enrollments_returning": 0, "enrollments": 0,
      "investment_suggested": 0, "leads_target": 0, "cpa_target": 0
    }
  ],
  "funnel_rates": { "registration_to_schedule": 0.76, "schedule_to_visit": 0.63, "visit_to_enrollment": 0.40 },
  "total_investment_suggested": 0,
  "total_leads_needed": 0,
  "average_cpa": 0,
  "key_risks": ["risco 1", "risco 2", "risco 3"],
  "key_actions": ["ação 1", "ação 2", "ação 3"],
  "recalibration_note": "quando e como recalibrar após ter dados reais"
}`

      const result = await callClaude(prompt, 3000)
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(extractJsonObject(result)) as Record<string, unknown>
      } catch {
        console.error('[generate_campaign] falha ao parsear resposta da IA. Raw completo:', result)
        return res.status(422).json({ error: 'Erro ao parsear resposta da IA', raw: result })
      }
// ✅ Sobrescrever rematrículas com distribuição real — não confiar na IA para isso
      if (reenrollTarget > 0 && parsed.monthly_targets) {
        const tgts = parsed.monthly_targets as any[]
        tgts.forEach((m, idx) => {
          const monthNum = campaignMonths[idx]?.month ?? 9
          const pct = reenrollMonthlyDist[monthNum] ?? 0.03
          m.enrollments_returning = Math.round(reenrollTarget * pct)
          m.enrollments = (m.enrollments_new || 0) + m.enrollments_returning
          m.cpa_target = m.enrollments > 0 && m.investment_suggested ? Math.round(m.investment_suggested / m.enrollments) : 0
        })
        // Corrigir arredondamento
        const reenSum = tgts.reduce((s: number, m: any) => s + m.enrollments_returning, 0)
        const diff = reenrollTarget - reenSum
        if (diff !== 0) {
          const maxIdx = tgts.reduce((best: number, m: any, i: number) => m.enrollments_returning > tgts[best].enrollments_returning ? i : best, 0)
          tgts[maxIdx].enrollments_returning += diff
          tgts[maxIdx].enrollments = (tgts[maxIdx].enrollments_new || 0) + tgts[maxIdx].enrollments_returning
        }
      }
      // Fallback: rematrícula não pode ser zero se há histórico
      const targets = parsed.monthly_targets as { month: number; enrollments_returning?: number; enrollments_new?: number; enrollments?: number; investment_suggested?: number }[] | undefined
      if (targets && reenrollTarget > 0) {
        const totalReturning = targets.reduce((s, m) => s + (m.enrollments_returning || 0), 0)
        if (totalReturning === 0) {
          const dist: Record<number, number> = { 1: 0.15, 2: 0.05, 8: 0, 9: 0.05, 10: 0.25, 11: 0.30, 12: 0.20 }
          parsed.monthly_targets = targets.map((m, idx) => {
            const monthNum = campaignMonths[idx]?.month || 9
            const returning = Math.round(reenrollTarget * (dist[monthNum] || 0.03))
            const total = (m.enrollments_new || 0) + returning
            return { ...m, enrollments_returning: returning, enrollments: total, cpa_target: total > 0 && m.investment_suggested ? Math.round(m.investment_suggested / total) : 0 }
          });
          (parsed.summary as Record<string, unknown>).reenrollment_target = reenrollTarget
          ;(parsed.summary as Record<string, unknown>).reenrollment_rate_target = avgReenrollRate
        }
      }

      const mode = hasHistory ? (historicalData.length >= 2 ? 'historical' : 'hybrid') : 'benchmark'
      return res.json({ result: parsed, mode, reenroll_distribution: realReenrollDist })
    }

    // ── RELATÓRIO MENSAL IA ───────────────────────────────────────────────────
    if (action === 'monthly_report') {
      const { institutionName, period, cycle, funnel, reenrollments, avg_time_days, monthly_data } = payload as {
        institutionName: string; period: string
        cycle: { year: number; target_new: number; target_reenroll: number; base_students: number }
        funnel: { registrations: number; registrations_target: number; visits: number; visits_target: number; enrollments: number; enrollments_target: number }
        reenrollments: { confirmed: number; target: number }
        avg_time_days: number | null
        monthly_data: { period: string; registrations: number; visits: number; enrollments: number }[]
      }
      const devReg  = funnel.registrations_target > 0 ? ((funnel.registrations / funnel.registrations_target - 1) * 100).toFixed(1) : '0'
      const devVis  = funnel.visits_target > 0         ? ((funnel.visits / funnel.visits_target - 1) * 100).toFixed(1) : '0'
      const devEnr  = funnel.enrollments_target > 0    ? ((funnel.enrollments / funnel.enrollments_target - 1) * 100).toFixed(1) : '0'
      const devReen = reenrollments.target > 0         ? ((reenrollments.confirmed / reenrollments.target - 1) * 100).toFixed(1) : '0'
      const prompt = `Você é consultor especialista em campanhas de matrículas de escolas privadas brasileiras.
Gere o relatório mensal para ${institutionName} — período ${period}.
FUNIL: Cadastros ${funnel.registrations}/${funnel.registrations_target} (${devReg}%) | Visitas ${funnel.visits}/${funnel.visits_target} (${devVis}%) | Matrículas ${funnel.enrollments}/${funnel.enrollments_target} (${devEnr}%) | Rematrículas ${reenrollments.confirmed}/${reenrollments.target} (${devReen}%)
${avg_time_days !== null ? `Tempo médio matrícula: ${avg_time_days} dias` : ''}
HISTÓRICO: ${monthly_data.map(m => `${m.period}: ${m.registrations} cad | ${m.visits} vis | ${m.enrollments} mat`).join(' | ')}
Seções: RESUMO EXECUTIVO | ANÁLISE DO FUNIL | ANÁLISE DE REMATRÍCULAS | AÇÕES MARKETING | AÇÕES TIME | AÇÕES REMATRÍCULAS | PRÓXIMOS PASSOS
Máximo 400 palavras. Direto e prático.`
      const result = await callClaude(prompt, 900)
      return res.json({ result })
    }

    // ── PESQUISA DE SATISFAÇÃO ────────────────────────────────────────────────
    if (action === 'survey_report') {
      const { responses, surveyTitle, institutionName, surveyMode, questions } = payload as {
        responses: { answers: Record<string, unknown>; custom_answers?: Record<string, unknown> | null }[]
        surveyTitle: string; institutionName: string
        surveyMode?: 'default' | 'custom'
        questions?: { id: string; title: string; question_type: string; options?: { options?: string[] } | null }[]
      }
      function avg(nums: number[]) {
        const valid = nums.filter(n => typeof n === 'number' && !isNaN(n))
        return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
      }

      let prompt: string
      if (surveyMode === 'custom' && questions && questions.length > 0) {
        const perQuestion = questions.map(q => {
          const values = responses.map(r => r.custom_answers?.[q.id]).filter(v => v !== undefined && v !== null && v !== '')
          if (q.question_type === 'scale' || q.question_type === 'nps') {
            return { title: q.title, type: q.question_type, average: avg(values.filter(v => typeof v === 'number') as number[]), n: values.length }
          }
          if (q.question_type === 'multiple_choice') {
            const dist = (q.options?.options || []).reduce((acc: Record<string, number>, opt) => {
              acc[opt] = values.filter(v => v === opt).length
              return acc
            }, {})
            return { title: q.title, type: q.question_type, distribution: dist }
          }
          return { title: q.title, type: q.question_type, samples: (values as string[]).slice(0, 8) }
        })
        prompt = `Especialista em gestão escolar brasileira. Analise a pesquisa customizada "${surveyTitle}" do ${institutionName}, com ${responses.length} respostas. Retorne APENAS JSON.
Esta pesquisa tem perguntas próprias da escola (não as 7 perguntas padrão) — interprete cada pergunta pelo seu título e tipo.
Perguntas e agregados: ${JSON.stringify(perQuestion)}
Se não houver pergunta sobre rematrícula/renovação, estime "reenrollment_risk" como "médio" e diga em "reenrollment_analysis" que a pesquisa não perguntou diretamente sobre isso.
{ "overall_score": <0-10>, "summary": "<2-3 frases>", "strengths": ["<1>","<2>","<3>"], "weaknesses": ["<1>","<2>"], "reenrollment_risk": "<baixo|médio|alto>", "reenrollment_analysis": "<2 frases>", "priority_actions": ["<1>","<2>","<3>"], "retention_opportunities": "<1 frase>" }`
      } else {
        const avgScores = {
          general:        avg(responses.map(r => r.answers.general as number)),
          teaching:       avg(responses.map(r => r.answers.teaching as number)),
          communication:  avg(responses.map(r => r.answers.communication as number)),
          infrastructure: avg(responses.map(r => r.answers.infrastructure as number)),
          cost_benefit:   avg(responses.map(r => r.answers.cost_benefit as number)),
        }
        const reenrollmentDist = responses.reduce((acc: Record<string, number>, r) => {
          const key = r.answers.reenrollment as string
          if (key) acc[key] = (acc[key] ?? 0) + 1
          return acc
        }, {})
        const comments = responses.filter(r => r.answers.comment).map(r => r.answers.comment as string).slice(0, 10)
        prompt = `Especialista em gestão escolar brasileira. Analise "${surveyTitle}" do ${institutionName}. Retorne APENAS JSON.
Médias (1-5): ${JSON.stringify(avgScores)} | Rematrícula: ${JSON.stringify(reenrollmentDist)} | Respostas: ${responses.length}
Comentários: ${JSON.stringify(comments)}
{ "overall_score": <0-10>, "summary": "<2-3 frases>", "strengths": ["<1>","<2>","<3>"], "weaknesses": ["<1>","<2>"], "reenrollment_risk": "<baixo|médio|alto>", "reenrollment_analysis": "<2 frases>", "priority_actions": ["<1>","<2>","<3>"], "retention_opportunities": "<1 frase>" }`
      }
      const raw = await callClaude(prompt, 800)
      let parsed
      try {
        parsed = JSON.parse(extractJsonObject(raw))
      } catch {
        parsed = { overall_score: 0, summary: raw.substring(0, 300), strengths: [], weaknesses: [], reenrollment_risk: 'médio', reenrollment_analysis: 'Análise manual necessária.', priority_actions: [], retention_opportunities: 'Análise manual necessária.' }
      }
      return res.json({ result: parsed })
    }

    // ── INTELIGÊNCIA DE MERCADO (INEP) ────────────────────────────────────────
    if (action === 'market_insight') {
      const { marketShare, myRank, totalSchools, totalStudents, myStudents, city, state, schoolName } = payload as {
        marketShare: number; myRank: number | null; totalSchools: number
        totalStudents: number; myStudents: number; city: string; state: string; schoolName?: string
      }
      const name = schoolName || 'a escola'
      const systemPrompt = `Você é um consultor estratégico especialista em gestão escolar no Brasil.
Seja direto, prático e use linguagem simples. Máximo 150 palavras no total.`
      const userPrompt = `Análise de mercado para ${name} em ${city}/${state}:
- Market share: ${marketShare}% (posição #${myRank ?? '?'} de ${totalSchools} escolas privadas)
- Total de alunos na rede privada da cidade: ${totalStudents}
- Alunos da escola: ${myStudents}
- Média por escola: ${totalSchools > 0 ? Math.round(totalStudents / totalSchools) : 0} alunos

Gere uma análise em 3 parágrafos curtos:
1. Posição atual no mercado (1-2 frases)
2. Principal oportunidade identificada (1-2 frases)
3. Recomendação prática para os próximos 3 meses (1-2 frases)`
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      })
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Anthropic API error ${response.status}: ${err}`)
      }
      const data = await response.json() as { content: Array<{ type: string; text?: string }> }
      return res.json({ result: extractClaudeText(data) })
    }

    return res.status(400).json({ error: `Action desconhecida: ${action}` })

  } catch (error) {
    console.error('AI handler error:', error)
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return res.status(500).json({ error: msg })
  }
}