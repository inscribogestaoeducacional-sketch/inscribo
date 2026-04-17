// @ts-nocheck — Deno runtime
// supabase/functions/autentique/index.ts
// Cria documento no Autentique para assinatura digital e atualiza o contrato
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Substituição de variáveis do template ───────────────────────────────
function applyVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, val]) => text.replaceAll(key, val ?? ''),
    template
  )
}

function fmtBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

// ─── Mutation GraphQL Autentique ─────────────────────────────────────────
const CREATE_DOCUMENT_MUTATION = `
  mutation CreateDocument($document: CreateDocumentInput!, $signers: [SignerInput!]!) {
    createDocument(document: $document, signers: $signers) {
      document { id name }
      signers {
        action { name }
        link { short_link }
        user { email name }
      }
    }
  }
`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const {
      institution_id,
      contract_id,
      school_name,
      signer_name,
      signer_email,
      signer_phone,
      monthly_value,
      implementation_value,
    } = await req.json()

    if (!contract_id || !signer_name || !signer_email) {
      return new Response(
        JSON.stringify({ error: 'contract_id, signer_name e signer_email são obrigatórios' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // ── Supabase admin client ────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── Buscar configurações ─────────────────────────────────────────────
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['autentique_api_token', 'contract_template_text'])

    const settingsMap = Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value]))
    const AUTENTIQUE_TOKEN = settingsMap['autentique_api_token'] || Deno.env.get('AUTENTIQUE_API_TOKEN')

    if (!AUTENTIQUE_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Token Autentique não configurado em Configurações → Autentique' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // ── Buscar dados complementares da instituição ───────────────────────
    const { data: inst } = await supabase
      .from('institutions')
      .select('name, cnpj, city, state, consultant_name, billing_due_day')
      .eq('id', institution_id)
      .maybeSingle()

    // ── Montar texto do contrato ─────────────────────────────────────────
    const templateText = settingsMap['contract_template_text'] || ''
    const today = new Date()
    const contractText = applyVars(templateText, {
      '{{escola}}':            school_name ?? inst?.name ?? '',
      '{{cnpj}}':              inst?.cnpj ?? '',
      '{{cidade_uf}}':         inst?.city && inst?.state ? `${inst.city}/${inst.state}` : '',
      '{{gestor}}':            signer_name,
      '{{email_gestor}}':      signer_email,
      '{{valor_implantacao}}': fmtBRL(Number(implementation_value ?? 0)),
      '{{valor_mensal}}':      fmtBRL(Number(monthly_value ?? 0)),
      '{{dia_vencimento}}':    String(inst?.billing_due_day ?? 10),
      '{{data_inicio}}':       today.toLocaleDateString('pt-BR'),
      '{{consultor}}':         inst?.consultant_name ?? '',
      '{{data_hoje}}':         today.toLocaleDateString('pt-BR'),
    })

    // ── Montar HTML do contrato ──────────────────────────────────────────
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; background: #f8fafc; color: #1e293b; }
  .page { max-width: 800px; margin: 0 auto; background: white; }
  .header { background: linear-gradient(135deg, #00A896 0%, #028090 100%); padding: 40px 50px; text-align: center; }
  .header img { height: 52px; margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto; }
  .header h1 { color: white; font-size: 22px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
  .header p { color: rgba(255,255,255,0.8); font-size: 13px; }
  .badge { display: inline-block; background: rgba(255,255,255,0.2); color: white; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 20px; margin-top: 10px; letter-spacing: 0.5px; }
  .content { padding: 50px; }
  .contract-text { font-size: 13.5px; line-height: 1.9; color: #334155; white-space: pre-wrap; }
  .divider { border: none; border-top: 2px solid #e2e8f0; margin: 40px 0; }
  .footer { background: #f1f5f9; padding: 30px 50px; border-top: 3px solid #00A896; }
  .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .footer-item p { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 3px; }
  .footer-item span { font-size: 13px; color: #475569; font-weight: 500; }
  .footer-bottom { text-align: center; font-size: 11px; color: #94a3b8; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .seal { text-align: center; margin: 40px 0 20px; }
  .seal-box { display: inline-block; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px 40px; }
  .seal-box p { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
  .seal-box strong { font-size: 13px; color: #475569; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <img src="https://www.aionedu.com.br/aion-logo-full.png" alt="Áion Edu" />
    <h1>Contrato de Prestação de Serviços</h1>
    <p>Documento com validade jurídica — Assinatura digital</p>
    <span class="badge">🔒 Documento seguro e autenticado</span>
  </div>
  <div class="content">
    <div class="contract-text">${contractText}</div>
    <hr class="divider" />
    <div class="seal">
      <div class="seal-box">
        <p>Este documento será assinado digitalmente por</p>
        <strong>${signer_name} — ${signer_email}</strong>
        <p style="margin-top:8px;">Data de emissão: ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-grid">
      <div class="footer-item">
        <p>Contratada</p>
        <span>Áion Soluções Tecnológicas LTDA</span>
      </div>
      <div class="footer-item">
        <p>CNPJ</p>
        <span>65.835.064/0001-58</span>
      </div>
      <div class="footer-item">
        <p>Endereço</p>
        <span>R. Francisco Vicente de Araújo, 48 · Patos/PB</span>
      </div>
      <div class="footer-item">
        <p>Contato</p>
        <span>contato@aionedu.com.br</span>
      </div>
    </div>
    <div class="footer-bottom">
      <p>Áion Edu © ${new Date().getFullYear()} · Todos os direitos reservados · aionedu.com.br</p>
      <p style="margin-top:4px;">Documento gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
    </div>
  </div>
</div>
</body>
</html>`

    // ── Chamar API GraphQL Autentique ────────────────────────────────────
    const gqlRes = await fetch('https://api.autentique.com.br/2/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTENTIQUE_TOKEN}`,
      },
      body: JSON.stringify({
        query: CREATE_DOCUMENT_MUTATION,
        variables: {
          document: {
            name: `Contrato Áion Edu — ${school_name ?? inst?.name}`,
            content: htmlContent,
          },
          signers: [
            {
              email: signer_email,
              name: signer_name,
              action: 'SIGN',
              send_email: true,
              ...(signer_phone ? { phone_number: signer_phone, send_whatsapp: true } : {}),
            },
          ],
        },
      }),
    })

    if (!gqlRes.ok) {
      const errText = await gqlRes.text()
      console.error('Autentique HTTP error:', errText)
      return new Response(
        JSON.stringify({ error: `Erro Autentique HTTP ${gqlRes.status}`, details: errText }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const gqlData = await gqlRes.json()

    if (gqlData.errors?.length) {
      console.error('Autentique GraphQL errors:', JSON.stringify(gqlData.errors))
      return new Response(
        JSON.stringify({ error: gqlData.errors[0]?.message ?? 'Erro GraphQL Autentique', details: gqlData.errors }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const doc      = gqlData.data?.createDocument
    const documentId = doc?.document?.id ?? null
    const signUrl    = doc?.signers?.[0]?.link?.short_link ?? null

    // ── Atualizar contrato no banco ──────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('contracts')
      .update({
        autentique_document_id: documentId,
        sign_url:               signUrl,
        status:                 'sent',
        signer_name,
        signer_email,
        updated_at:             new Date().toISOString(),
      })
      .eq('id', contract_id)

    if (updateErr) {
      console.error('Supabase update error:', updateErr.message)
    }

    return new Response(
      JSON.stringify({ success: true, documentId, signUrl }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Autentique function error:', String(err))
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})