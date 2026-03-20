import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

async function callClaude(prompt: string, maxTokens = 1024): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { content: { text: string }[] }
  return data.content[0].text
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // CORS para chamadas do frontend
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  const { action, payload } = req.body as { action: string; payload: Record<string, unknown> }

  if (!action || !payload) {
    return res.status(400).json({ error: 'action e payload são obrigatórios' })
  }

  try {
    // ─────────────────────────────────────────────
    // INSIGHT SEMANAL
    // ─────────────────────────────────────────────
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

    // ─────────────────────────────────────────────
    // EXTRAÇÃO DE ARQUIVO ERP
    // ─────────────────────────────────────────────
    if (action === 'extract_file') {
      const { fileContent, fileType, fileName } = payload as {
        fileContent: string
        fileType: 'csv' | 'xlsx' | 'pdf'
        fileName: string
      }

      const prompt = fileType === 'pdf'
        ? `Você está analisando um arquivo exportado de um sistema ERP de escola privada brasileira.
Arquivo: ${fileName}

Extraia os dados e retorne SOMENTE um JSON válido, sem texto adicional:
{
  "file_type_detected": "enrollments|active_students|historical|unknown",
  "confidence": 0.0,
  "enrollments": [
    { "student_name": "", "course_grade": "", "enrollment_date": "YYYY-MM-DD", "enrollment_value": 0 }
  ],
  "active_students": [
    { "student_name": "", "course_grade": "", "enrollment_year": 0 }
  ],
  "historical_funnel": [
    { "period": "MMM/YYYY", "registrations": 0, "schedules": 0, "visits": 0, "enrollments": 0 }
  ],
  "summary": { "total_records": 0, "date_range": "", "notes": "" }
}

Conteúdo:
${fileContent.slice(0, 8000)}`
        : `Você está analisando dados de planilha (CSV/Excel) de escola privada brasileira.
Arquivo: ${fileName}

Dados:
${fileContent.slice(0, 8000)}

Identifique o tipo e retorne SOMENTE JSON válido:
{
  "file_type_detected": "enrollments|active_students|historical|unknown",
  "confidence": 0.0,
  "column_mapping": {},
  "enrollments": [
    { "student_name": "", "course_grade": "", "enrollment_date": "YYYY-MM-DD", "enrollment_value": 0 }
  ],
  "active_students": [
    { "student_name": "", "course_grade": "", "enrollment_year": 0 }
  ],
  "historical_funnel": [
    { "period": "MMM/YYYY", "registrations": 0, "schedules": 0, "visits": 0, "enrollments": 0 }
  ],
  "summary": { "total_records": 0, "date_range": "", "notes": "" }
}

Normalize séries para: Infantil I, Infantil II, Infantil III, Infantil IV, Infantil V, 1º EF até 9º EF, 1ª EM, 2ª EM, 3ª EM.
Arrays vazios [] se o tipo não existir no arquivo.`

      const raw = await callClaude(prompt, 4000)

      let parsed: unknown
      try {
        const match = raw.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(match ? match[0] : raw)
      } catch {
        return res.status(422).json({ error: 'Não foi possível extrair dados estruturados do arquivo', raw })
      }

      return res.json({ result: parsed })
    }

    // ─────────────────────────────────────────────
    // DIAGNÓSTICO DE TRANSFERÊNCIA
    // ─────────────────────────────────────────────
    if (action === 'transfer_diagnosis') {
      const { responses, studentName, grade } = payload as {
        responses: Record<string, unknown>
        studentName: string
        grade: string
      }

      const prompt = `Você é especialista em gestão e retenção escolar de escolas privadas brasileiras.

Aluno da ${grade} (${studentName}) pediu transferência e respondeu:
${JSON.stringify(responses, null, 2)}

Retorne SOMENTE JSON:
{
  "primary_reason": "financial|pedagogical|distance|competition|relocation|other",
  "confidence": 0.0,
  "diagnosis": "explicação do motivo real em 2-3 linhas",
  "risk_factors": ["fator 1", "fator 2"],
  "school_actions": ["ação que a escola poderia ter tomado"],
  "retention_opportunity": true,
  "retention_note": "o que poderia ter sido feito para reter"
}`

      const raw = await callClaude(prompt, 600)
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match ? match[0] : raw)
      return res.json({ result: parsed })
    }

    // ─────────────────────────────────────────────
    // DADOS DE MERCADO (IBGE / CENSO ESCOLAR)
    // ─────────────────────────────────────────────
    if (action === 'fetch_ibge') {
      const { city, state } = payload as { city: string; state: string }

      const prompt = `Você tem conhecimento atualizado sobre dados demográficos brasileiros do IBGE e do Censo Escolar do MEC.

Para a cidade de ${city}, ${state}, forneça em JSON:
{
  "city": "${city}",
  "state": "${state}",
  "school_age_population": 0,
  "total_population": 0,
  "private_school_students": 0,
  "public_school_students": 0,
  "private_school_rate": 0.0,
  "sector_growth_rate": 0.0,
  "total_private_schools": 0,
  "average_students_per_school": 0,
  "ibge_year": 2022,
  "data_source": "IBGE Censo 2022 / Censo Escolar MEC 2023",
  "confidence": "high|medium|low",
  "notes": "observações sobre o mercado educacional desta cidade"
}

Use os dados mais recentes que você conhece. Se não tiver dados precisos desta cidade, use dados regionais proporcionais e indique confidence: "medium".
Retorne SOMENTE o JSON válido.`

      const result = await callClaude(prompt, 600)
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result)
      return res.json({ result: parsed })
    }

    // ─────────────────────────────────────────────
    // GERADOR DE CAMPANHA DE MATRÍCULAS
    // ─────────────────────────────────────────────
    if (action === 'generate_campaign') {
      const { schoolData, historicalData, marketData, growthTarget, campaignYear, current_date, campaign_start_month, months_until_campaign } = payload as {
        schoolData: { name: string; city: string; state: string; grades: string[]; avg_monthly_fee: number; current_students: number }
        historicalData: { year: number; total_students: number; new_enrollments: number; reenrollments: number; transfers: number }[]
        marketData: { school_age_population?: number; private_school_rate?: number; sector_growth_rate?: number }
        growthTarget: { type: 'percentage' | 'absolute' | 'students'; value: number }
        campaignYear: number
        current_date?: string
        campaign_start_month?: string
        months_until_campaign?: number
      }

      const hasHistory = historicalData && historicalData.length > 0
      const mode = hasHistory
        ? (historicalData.length >= 2 ? 'historical' : 'hybrid')
        : 'benchmark'

      const hasPrecampaign = months_until_campaign && months_until_campaign > 0

      const prompt = `Você é um especialista em campanhas de matrículas de escolas privadas brasileiras com 15 anos de experiência.

DADOS DA ESCOLA:
- Nome: ${schoolData.name}
- Cidade: ${schoolData.city} / ${schoolData.state}
- Séries: ${schoolData.grades?.join(', ')}
- Mensalidade média: R$ ${schoolData.avg_monthly_fee}
- Alunos atuais: ${schoolData.current_students}
- Data atual: ${current_date || 'não informada'}
- Início da campanha: ${campaign_start_month || `Agosto/${campaignYear}`}
- Meses até a campanha: ${months_until_campaign ?? 0}

DADOS DE MERCADO:
- População escolar (4-17 anos): ${marketData.school_age_population?.toLocaleString('pt-BR') ?? 'N/D'}
- Taxa escola particular: ${marketData.private_school_rate ? (marketData.private_school_rate * 100).toFixed(1) + '%' : 'N/D'}
- Crescimento setor: ${marketData.sector_growth_rate ? (marketData.sector_growth_rate * 100).toFixed(1) + '%/ano' : 'N/D'}

${hasHistory
  ? `HISTÓRICO DA ESCOLA:\n${historicalData.map(d =>
    `- ${d.year}: ${d.total_students} alunos, ${d.new_enrollments} novas matrículas, ${d.reenrollments} rematrículas, ${d.transfers} transferências`
  ).join('\n')}`
  : 'HISTÓRICO: Primeiro ano no sistema. Use benchmarks do setor educacional privado brasileiro.'}

OBJETIVO:
${growthTarget.type === 'percentage' ? `Crescer ${growthTarget.value}%` : ''}
${growthTarget.type === 'absolute' ? `Adicionar ${growthTarget.value} alunos novos` : ''}
${growthTarget.type === 'students' ? `Atingir ${growthTarget.value} alunos total` : ''}

SAZONALIDADE TÍPICA DO MERCADO EDUCACIONAL BRASILEIRO:
- Ago: abertura da campanha, primeiros cadastros
- Set: 11-12% dos cadastros | Out: 28-30% | Nov: 23-25%
- Dez: 20-22% | Jan: 7-8% | Fev: 4-5%
- Conversões típicas: Cadastro→Agenda 75-80%, Agenda→Visita 63-65%, Visita→Matrícula 38-42%

Gere o plano completo em JSON:
{
  "summary": {
    "total_new_students_target": 0,
    "reenrollment_target": 0,
    "reenrollment_rate_target": 0.0,
    "total_students_end": 0,
    "growth_rate": 0.0,
    "realism_score": "conservative|realistic|aggressive",
    "reasoning": "3-4 linhas em português explicando como chegou nos números"
  },${hasPrecampaign ? `
  "pre_campaign": {
    "period": "período de preparação antes de ${campaign_start_month}",
    "months_count": ${months_until_campaign},
    "focus_areas": ["rematrículas", "captação orgânica", "treinamento do time"],
    "key_actions": [
      "ação concreta 1 para fazer agora",
      "ação concreta 2",
      "ação concreta 3"
    ],
    "reenrollment_projection": {
      "target": 0,
      "current_rate": 0.0,
      "actions_needed": "o que fazer para atingir a meta de rematrícula"
    }
  },` : ''}
  "monthly_targets": [
    {
      "month": "Ago", "year": ${campaignYear},
      "registrations": 0, "schedules": 0,
      "visits": 0, "enrollments": 0,
      "investment_suggested": 0, "leads_target": 0, "cpa_target": 0.0
    }
  ],
  "funnel_rates": {
    "registration_to_schedule": 0.0,
    "schedule_to_visit": 0.0,
    "visit_to_enrollment": 0.0
  },
  "total_investment_suggested": 0,
  "total_leads_needed": 0,
  "average_cpa": 0.0,
  "key_risks": ["risco 1", "risco 2"],
  "key_actions": ["ação 1", "ação 2", "ação 3"],
  "recalibration_note": "quando recalibrar após ter dados reais"
}

Inclua monthly_targets para: Ago, Set, Out, Nov, Dez, Jan, Fev.${hasPrecampaign ? ' Preencha pre_campaign com ações práticas e realistas para os meses de preparação.' : ''}
Retorne SOMENTE o JSON válido.`

      const result = await callClaude(prompt, 2200)
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result)
      return res.json({ result: parsed, mode })
    }

    return res.status(400).json({ error: `Action desconhecida: ${action}` })

  } catch (error) {
    console.error('AI handler error:', error)
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return res.status(500).json({ error: msg })
  }
}
