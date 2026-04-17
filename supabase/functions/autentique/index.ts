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
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1A202C;">

  <!-- HEADER -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#007A6E;">
    <tr>
      <td style="padding:40px 56px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              <img src="https://www.aionedu.com.br/aion-logo-full.png" alt="Aion Edu" height="42" style="display:block;height:42px;width:auto;filter:brightness(0) invert(1);" />
            </td>
            <td style="vertical-align:middle;text-align:right;">
              <div style="color:#ffffff;font-size:19px;font-weight:700;line-height:1.3;">Contrato de Prestacao<br>de Servicos</div>
              <div style="color:rgba(255,255,255,0.75);font-size:11px;margin-top:4px;">Documento com validade juridica</div>
            </td>
          </tr>
        </table>
        <div style="margin-top:20px;display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:#ffffff;font-size:10px;font-weight:600;padding:5px 14px;border-radius:20px;letter-spacing:0.3px;">
          Assinatura digital certificada · Aion Edu
        </div>
      </td>
    </tr>
  </table>

  <!-- META BAR -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7FAFC;border-bottom:1px solid #E2E8F0;">
    <tr>
      <td style="padding:16px 56px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:40px;vertical-align:top;">
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#A0AEC0;margin-bottom:3px;">Data de emissao</div>
              <div style="font-size:13px;font-weight:600;color:#2D3748;">${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </td>
            <td style="padding-right:40px;vertical-align:top;">
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#A0AEC0;margin-bottom:3px;">Signatario</div>
              <div style="font-size:13px;font-weight:600;color:#2D3748;">${signer_name}</div>
            </td>
            <td style="padding-right:40px;vertical-align:top;">
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#A0AEC0;margin-bottom:3px;">E-mail</div>
              <div style="font-size:13px;font-weight:600;color:#2D3748;">${signer_email}</div>
            </td>
            <td style="vertical-align:top;">
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#A0AEC0;margin-bottom:3px;">Status</div>
              <div style="font-size:13px;font-weight:600;color:#2D3748;">Aguardando assinatura</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- CONTENT -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
    <tr>
      <td style="padding:48px 56px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00A896;margin-bottom:20px;border-bottom:1px solid #E2E8F0;padding-bottom:10px;">Conteudo do contrato</div>
        <div style="font-size:13px;line-height:1.9;color:#4A5568;white-space:pre-wrap;word-break:break-word;">${contractText}</div>

        <!-- ASSINATURAS -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:48px;border-top:2px solid #EDF2F7;padding-top:32px;">
          <tr>
            <td colspan="3" style="padding-top:24px;padding-bottom:20px;text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#A0AEC0;">Bloco de assinaturas</td>
          </tr>
          <tr>
            <td width="48%" style="background:#F7FAFC;border:1px dashed #CBD5E0;padding:24px 20px;text-align:center;vertical-align:top;">
              <div style="font-size:9px;color:#A0AEC0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Contratante</div>
              <div style="font-size:13px;font-weight:700;color:#2D3748;margin-bottom:2px;">${signer_name}</div>
              <div style="font-size:11px;color:#718096;margin-bottom:16px;">${signer_email}</div>
              <div style="height:1px;background:#CBD5E0;margin-bottom:8px;"></div>
              <div style="font-size:10px;color:#A0AEC0;">Assinar digitalmente via link recebido por e-mail</div>
            </td>
            <td width="4%"></td>
            <td width="48%" style="background:#F7FAFC;border:1px dashed #CBD5E0;padding:24px 20px;text-align:center;vertical-align:top;">
              <div style="font-size:9px;color:#A0AEC0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Contratada</div>
              <div style="font-size:13px;font-weight:700;color:#2D3748;margin-bottom:2px;">Aion Solucoes Tecnologicas LTDA</div>
              <div style="font-size:11px;color:#718096;margin-bottom:16px;">contato@aionedu.com.br</div>
              <div style="height:1px;background:#CBD5E0;margin-bottom:8px;"></div>
              <div style="font-size:10px;color:#A0AEC0;">CNPJ: 65.835.064/0001-58</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- FOOTER -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1A202C;">
    <tr>
      <td style="padding:28px 56px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
          <tr>
            <td width="33%" style="vertical-align:top;padding-right:20px;">
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#4A5568;margin-bottom:4px;">Empresa</div>
              <div style="font-size:11px;color:#A0AEC0;line-height:1.6;">Aion Solucoes Tecnologicas LTDA<br>CNPJ: 65.835.064/0001-58</div>
            </td>
            <td width="33%" style="vertical-align:top;padding-right:20px;">
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#4A5568;margin-bottom:4px;">Endereco</div>
              <div style="font-size:11px;color:#A0AEC0;line-height:1.6;">R. Francisco Vicente de Araujo, 48<br>Patos/PB · CEP: 58700-000</div>
            </td>
            <td width="33%" style="vertical-align:top;">
              <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#4A5568;margin-bottom:4px;">Contato</div>
              <div style="font-size:11px;color:#A0AEC0;line-height:1.6;">contato@aionedu.com.br<br>aionedu.com.br</div>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #2D3748;padding-top:16px;">
          <tr>
            <td style="padding-top:16px;font-size:10px;color:#4A5568;">© ${new Date().getFullYear()} Aion Edu · Todos os direitos reservados</td>
            <td style="padding-top:16px;font-size:10px;color:#4A5568;text-align:right;">Documento gerado em ${new Date().toLocaleDateString('pt-BR')}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

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