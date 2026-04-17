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
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', Arial, sans-serif; background: #F0F4F8; color: #1A202C; }
  .wrapper { max-width: 820px; margin: 0 auto; background: white; }

  /* HEADER */
  .header { background: linear-gradient(135deg, #00A896 0%, #007A6E 100%); padding: 48px 56px 40px; position: relative; overflow: hidden; }
  .header::before { content: ''; position: absolute; top: -60px; right: -60px; width: 200px; height: 200px; border-radius: 50%; background: rgba(255,255,255,0.07); }
  .header::after { content: ''; position: absolute; bottom: -80px; left: 40%; width: 240px; height: 240px; border-radius: 50%; background: rgba(255,255,255,0.05); }
  .header-inner { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 24px; }
  .header-logo img { height: 48px; filter: brightness(0) invert(1); }
  .header-title { text-align: right; }
  .header-title h1 { color: white; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.3; }
  .header-title p { color: rgba(255,255,255,0.75); font-size: 12px; margin-top: 4px; }
  .header-badge { margin-top: 28px; display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); color: white; font-size: 11px; font-weight: 600; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.3px; }

  /* META BAR */
  .meta-bar { background: #F7FAFC; border-bottom: 1px solid #E2E8F0; padding: 16px 56px; display: flex; gap: 40px; flex-wrap: wrap; }
  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-item .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #A0AEC0; }
  .meta-item .meta-value { font-size: 13px; font-weight: 600; color: #2D3748; }

  /* CONTENT */
  .content { padding: 48px 56px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #00A896; margin-bottom: 20px; display: flex; align-items: center; gap-8px; }
  .section-title::after { content: ''; flex: 1; height: 1px; background: #E2E8F0; margin-left: 12px; display: inline-block; }
  .contract-body { font-size: 13.5px; line-height: 1.95; color: #4A5568; white-space: pre-wrap; word-break: break-word; }

  /* SIGNATURE BLOCK */
  .signature-section { margin-top: 48px; padding-top: 32px; border-top: 2px solid #EDF2F7; }
  .signature-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #A0AEC0; margin-bottom: 20px; text-align: center; }
  .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .signature-box { background: #F7FAFC; border: 1.5px dashed #CBD5E0; border-radius: 12px; padding: 24px 20px; text-align: center; }
  .signature-box .sig-label { font-size: 10px; color: #A0AEC0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .signature-box .sig-name { font-size: 13px; font-weight: 700; color: #2D3748; margin-bottom: 2px; }
  .signature-box .sig-email { font-size: 11px; color: #718096; }
  .signature-box .sig-line { height: 1px; background: #CBD5E0; margin: 16px 0 8px; }
  .signature-box .sig-date { font-size: 10px; color: #A0AEC0; }

  /* FOOTER */
  .footer { background: #1A202C; padding: 28px 56px; margin-top: 0; }
  .footer-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .footer-col .footer-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #4A5568; margin-bottom: 4px; }
  .footer-col .footer-value { font-size: 11px; color: #A0AEC0; line-height: 1.5; }
  .footer-bottom { border-top: 1px solid #2D3748; padding-top: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .footer-bottom .footer-brand { font-size: 10px; color: #4A5568; }
  .footer-bottom .footer-secure { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #4A5568; }
</style>
</head>
<body>
<div class="wrapper">

  <!-- HEADER -->
  <div class="header">
    <div class="header-inner">
      <div class="header-logo">
        <img src="https://www.aionedu.com.br/aion-logo-full.png" alt="Áion Edu" />
      </div>
      <div class="header-title">
        <h1>Contrato de Prestação<br>de Serviços</h1>
        <p>Documento com validade jurídica</p>
      </div>
    </div>
    <div class="header-badge">🔒 Assinatura digital certificada · Áion Edu</div>
  </div>

  <!-- META BAR -->
  <div class="meta-bar">
    <div class="meta-item">
      <span class="meta-label">Data de emissão</span>
      <span class="meta-value">${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Signatário</span>
      <span class="meta-value">${signer_name}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">E-mail</span>
      <span class="meta-value">${signer_email}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Status</span>
      <span class="meta-value">⏳ Aguardando assinatura</span>
    </div>
  </div>

  <!-- CONTENT -->
  <div class="content">
    <div class="section-title">Conteúdo do contrato</div>
    <div class="contract-body">${contractText}</div>

    <!-- ASSINATURAS -->
    <div class="signature-section">
      <div class="signature-title">Bloco de assinaturas</div>
      <div class="signature-grid">
        <div class="signature-box">
          <div class="sig-label">Contratante</div>
          <div class="sig-name">${signer_name}</div>
          <div class="sig-email">${signer_email}</div>
          <div class="sig-line"></div>
          <div class="sig-date">Assinar digitalmente via link recebido por e-mail</div>
        </div>
        <div class="signature-box">
          <div class="sig-label">Contratada</div>
          <div class="sig-name">Áion Soluções Tecnológicas LTDA</div>
          <div class="sig-email">contato@aionedu.com.br</div>
          <div class="sig-line"></div>
          <div class="sig-date">CNPJ: 65.835.064/0001-58</div>
        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-grid">
      <div class="footer-col">
        <div class="footer-label">Empresa</div>
        <div class="footer-value">Áion Soluções Tecnológicas LTDA<br>CNPJ: 65.835.064/0001-58</div>
      </div>
      <div class="footer-col">
        <div class="footer-label">Endereço</div>
        <div class="footer-value">R. Francisco Vicente de Araújo, 48<br>Patos/PB · CEP: 58700-000</div>
      </div>
      <div class="footer-col">
        <div class="footer-label">Contato</div>
        <div class="footer-value">contato@aionedu.com.br<br>aionedu.com.br</div>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-brand">© ${new Date().getFullYear()} Áion Edu · Todos os direitos reservados</span>
      <span class="footer-secure">🔒 Documento gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
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