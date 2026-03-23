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

async function callClaudeWithDocument(pdfBase64: string, textPrompt: string, maxTokens = 1500): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64
            }
          },
          { type: 'text', text: textPrompt }
        ]
      }]
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
      const { fileContent, fileType, fileName, isPdfImage } = payload as {
        fileContent: string
        fileType: 'csv' | 'xlsx' | 'pdf'
        fileName: string
        isPdfImage?: boolean
      }

      console.log('[extract_file] modo:', isPdfImage ? 'PDF visão' : 'texto')

      let raw: string

      if (isPdfImage) {
        // PDF baseado em imagem (ex: SIGA escaneado) — usa document vision
        const visionPrompt = `Você está analisando um Relatório de Matrículas Efetivadas de uma escola brasileira gerado pelo sistema SIGA (Activesoft).

O relatório tem uma tabela com as colunas: Data de matrícula | Novatos (Quantidade, %) | Veteranos (Quantidade, %) | Total (Quantidade, %).

REGRA DE ANO LETIVO: matrículas feitas entre set/YYYY e fev/YYYY+1 são para o ano letivo YYYY+1.
Exemplo: matrículas de set/2024 a fev/2025 → detected_year = 2025.

Extraia todos os dados e retorne APENAS um JSON válido sem markdown:
{
  "detected_year": <número inteiro do ano letivo alvo>,
  "period_start": "<YYYY-MM da data mais antiga>",
  "period_end": "<YYYY-MM da data mais recente>",
  "total_students": <número total — última linha "Total de alunos">,
  "new_students": <total da coluna Novatos>,
  "returning_students": <total da coluna Veteranos>,
  "new_students_pct": <percentual de novatos como número>,
  "returning_students_pct": <percentual de veteranos como número>,
  "avg_monthly_fee": null,
  "reenrollments": null,
  "transfers": null,
  "historical_funnel": [],
  "summary": "<resumo em uma linha>"
}`
        raw = await callClaudeWithDocument(fileContent, visionPrompt, 1500)
      } else {
        const prompt = `Você está analisando um arquivo exportado de um sistema ERP de escola privada brasileira.
Arquivo: ${fileName}
Tipo: ${fileType}

INSTRUÇÕES IMPORTANTES:
1. detected_year = ANO LETIVO ao qual esses alunos foram matriculados (NÃO o ano em que as matrículas foram feitas).
   Regra: matrículas feitas entre set/YYYY e fev/YYYY+1 são para o ano letivo YYYY+1.
   Exemplo: matrículas de set/2024 a fev/2025 → detected_year = 2025.
   Se o arquivo tiver matrículas de ago/2025 a fev/2026 → detected_year = 2026.
2. Inferir period_start e period_end pelas datas mais antigas e mais recentes encontradas no conteúdo.
3. Retornar null nos campos que não conseguir extrair — NUNCA inventar valores.
4. Se o arquivo for claramente um relatório de matrículas, preencher os campos de novatos/veteranos.
5. detected_year deve ser um número inteiro (ex: 2025), não uma string.

Retorne SOMENTE um JSON válido sem texto adicional:
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
  "historical_funnel": [],
  "summary": { "total_records": 0, "date_range": "", "notes": "" }
}

Conteúdo do arquivo:
${fileContent.slice(0, 8000)}`
        raw = await callClaude(prompt, 4000)
      }

      let parsed: unknown
      try {
        const match = raw.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(match ? match[0] : raw)
      } catch {
        return res.status(422).json({ error: 'Não foi possível extrair dados estruturados do arquivo', raw })
      }

      console.log('[extract_file] resultado:', JSON.stringify(parsed).slice(0, 300))
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

      const fallback = {
        city,
        state,
        school_age_population: 15000,
        private_school_rate: 18,
        sector_growth: 3,
        avg_students_per_school: 500,
        confidence: 'estimado',
        notes: `Dados estimados para ${city}`,
        inep_data: {
          school_classification: 'médio',
          main_competitors: ['Escolas públicas municipais', 'Redes privadas regionais', 'Escolas confessionais'],
          market_opportunity: 'Crescimento da classe média local com demanda por ensino privado de qualidade.',
          risk_factors: 'Expansão de redes nacionais com mensalidades competitivas na região.',
        },
      }

      const prompt = `Você é especialista em dados educacionais brasileiros (IBGE, Censo Escolar MEC).

Para a cidade de ${city}, ${state}, retorne SOMENTE um JSON válido com os campos abaixo.
Se não tiver dados precisos, ESTIME com base no porte do município e região — nunca retorne texto livre ou mensagem de erro.

{
  "city": "${city}",
  "state": "${state}",
  "school_age_population": <estimativa população 4-17 anos>,
  "total_population": <estimativa total>,
  "private_school_students": <estimativa alunos rede privada>,
  "private_school_rate": <% alunos em escola privada, ex: 18.5>,
  "sector_growth_rate": <% crescimento anual setor privado, ex: 3.2>,
  "total_private_schools": <número de escolas privadas>,
  "average_students_per_school": <média de alunos por escola privada>,
  "ibge_year": 2022,
  "data_source": "IBGE Censo 2022 / Censo Escolar MEC 2023",
  "confidence": "high|medium|estimado",
  "notes": "<observação breve sobre o mercado educacional desta cidade>",
  "inep_data": {
    "school_classification": "<pequeno|médio|grande — baseado no porte típico da cidade>",
    "main_competitors": ["<tipo ou nome de concorrente 1>", "<tipo 2>", "<tipo 3>"],
    "market_opportunity": "<oportunidade principal do mercado educacional desta cidade em 1 frase>",
    "risk_factors": "<principal risco competitivo em 1 frase>"
  }
}

Retorne SOMENTE o JSON, sem markdown, sem explicações adicionais.`

      let parsed = fallback
      try {
        const result = await callClaude(prompt, 600)
        const jsonMatch = result.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result)
      } catch {
        // usa fallback definido acima
      }
      return res.json({ result: parsed })
    }

    // ─────────────────────────────────────────────
    // GERADOR DE CAMPANHA DE MATRÍCULAS
    // ─────────────────────────────────────────────
    if (action === 'generate_campaign') {
      const { schoolData, historicalData, marketData, growthTarget, campaignYear, executionYear, current_date, campaign_start_month, months_until_campaign } = payload as {
        schoolData: { name: string; city: string; state: string; grades: string[]; avg_monthly_fee: number; current_students: number }
        historicalData: { year: number; total_students: number; new_enrollments: number; reenrollments: number; transfers: number }[]
        marketData: { school_age_population?: number; private_school_rate?: number; sector_growth_rate?: number }
        growthTarget: { type: 'percentage' | 'absolute' | 'students'; value: number }
        campaignYear: number
        executionYear?: number
        current_date?: string
        campaign_start_month?: string
        months_until_campaign?: number
      }
      const execYear = executionYear ?? (campaignYear - 1)

      const hasHistory = historicalData && historicalData.length > 0
      const mode = hasHistory
        ? (historicalData.length >= 2 ? 'historical' : 'hybrid')
        : 'benchmark'

      const hasPrecampaign = months_until_campaign && months_until_campaign > 0

      const startMonthName = campaign_start_month?.split('/')[0] || 'Agosto'

      const prompt = `Você é um especialista em campanhas de matrículas de escolas privadas brasileiras com 15 anos de experiência.

CONTEXTO DE DATAS — LEIA COM ATENÇÃO:
- Ano letivo alvo: ${campaignYear} (estes são os alunos que vão estudar em ${campaignYear})
- Ano de execução da campanha: ${execYear} (a campanha acontece em ${execYear}/${execYear + 1})
- Mês de início: ${startMonthName}/${execYear}
- Os meses do plano devem ser: ${startMonthName}/${execYear} até Fev/${execYear + 1}
- O histórico fornecido representa campanhas anteriores (cada uma captou alunos para o ano letivo SEGUINTE)
- NÃO use datas além de Fev/${execYear + 1} nas metas mensais

DADOS DA ESCOLA:
- Nome: ${schoolData.name}
- Cidade: ${schoolData.city} / ${schoolData.state}
- Séries: ${schoolData.grades?.join(', ')}
- Mensalidade média: R$ ${schoolData.avg_monthly_fee}
- Alunos atuais: ${schoolData.current_students}
- Data atual: ${current_date || 'não informada'}
- Início da campanha: ${startMonthName}/${execYear}
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
      "month": "Ago", "year": ${execYear},
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

Inclua monthly_targets para: Ago/${execYear}, Set/${execYear}, Out/${execYear}, Nov/${execYear}, Dez/${execYear}, Jan/${execYear + 1}, Fev/${execYear + 1}.${hasPrecampaign ? ' Preencha pre_campaign com ações práticas e realistas para os meses de preparação.' : ''}
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
