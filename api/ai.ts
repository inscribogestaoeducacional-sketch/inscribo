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

    return res.status(400).json({ error: `Action desconhecida: ${action}` })

  } catch (error) {
    console.error('AI handler error:', error)
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return res.status(500).json({ error: msg })
  }
}
